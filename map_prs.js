#!/usr/bin/env node
/**
 * gh-pr-map — visualize GitHub PR contributor locations on an interactive map.
 *
 * Usage:
 *   node map_prs.js <owner/repo> [options]
 *
 * Options:
 *   --token    GitHub PAT (or set GITHUB_TOKEN env var)
 *   --state    PR state: open | closed | all  (default: all)
 *   --limit    Max PRs to fetch (default: 200)
 *   --out      Output HTML file path (default: output/map.html)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const DEFAULT_OUTFILE = 'output/map.html';
const CACHE_FILE = '.geocache.json';

function usage() {
  return 'Usage: node map_prs.js <owner/repo> [--token ...] [--state all] [--limit 200] [--out output/map.html]';
}

function parseArgs(argv) {
  const args = argv.slice(2);
  if (!args.length || args[0] === '--help' || args[0] === '-h') {
    return { help: true };
  }
  if (args[0].startsWith('--')) {
    throw new Error(usage());
  }

  const repo = args[0];
  const opts = {};

  for (let i = 1; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];
    if (!key || !key.startsWith('--') || value === undefined) {
      throw new Error(usage());
    }
    opts[key.replace(/^--/, '')] = value;
  }

  return {
    help: false,
    repo,
    token: opts.token || process.env.GITHUB_TOKEN || '',
    state: opts.state || 'all',
    limit: parseInt(opts.limit || '200', 10),
    outFile: opts.out || DEFAULT_OUTFILE,
  };
}

function ghGet(apiPath, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: apiPath,
      headers: {
        'User-Agent': 'gh-pr-map',
        'Accept': 'application/vnd.github+json',
        ...(token ? { 'Authorization': `token ${token}` } : {}),
      },
    };

    https.get(options, res => {
      let data = '';
      res.on('data', chunk => {
        data += chunk;
      });
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          reject(new Error(`JSON parse error: ${data.slice(0, 100)}`));
          return;
        }

        if (res.statusCode && res.statusCode >= 400) {
          const detail = parsed && parsed.message ? parsed.message : 'Unknown GitHub API error';
          reject(new Error(`GitHub API ${res.statusCode}: ${detail}`));
          return;
        }

        resolve(parsed);
      });
    }).on('error', reject);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanText(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

function normalizeCachedGeocode(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const lat = Number(entry.lat);
  const lng = Number(entry.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    lat,
    lng,
    country: cleanText(entry.country) || '',
    countryCode: cleanText(entry.countryCode || entry.country_code).toUpperCase() || '',
    locationLabel: cleanText(entry.locationLabel || entry.location) || '',
    displayName: cleanText(entry.displayName || entry.display_name) || '',
  };
}

function needsGeocodeRefresh(entry) {
  return !entry || !entry.locationLabel || !entry.displayName || !entry.countryCode;
}

async function resolveGeocode(location, cache, geocodeLookup = nominatimGeocode) {
  const cached = normalizeCachedGeocode(cache[location]);

  if (!needsGeocodeRefresh(cached)) {
    return {
      geocode: cached,
      didRequestRefresh: false,
    };
  }

  const refreshed = await geocodeLookup(location);
  if (refreshed) {
    cache[location] = refreshed;
  }

  return {
    geocode: refreshed || cached,
    didRequestRefresh: true,
  };
}

function extractLocationLabel(address) {
  if (!address || typeof address !== 'object') {
    return '';
  }

  return cleanText(
    address.city ||
    address.town ||
    address.village ||
    address.suburb ||
    address.state ||
    address.county
  );
}

function nominatimGeocode(location) {
  return new Promise(resolve => {
    const query = encodeURIComponent(location);
    const options = {
      hostname: 'nominatim.openstreetmap.org',
      path: `/search?q=${query}&format=jsonv2&limit=1&addressdetails=1`,
      headers: { 'User-Agent': 'gh-pr-map/1.1' },
    };

    https.get(options, res => {
      let data = '';
      res.on('data', chunk => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const results = JSON.parse(data);
          const first = Array.isArray(results) ? results[0] : null;
          if (!first) {
            resolve(null);
            return;
          }

          const lat = Number(first.lat);
          const lng = Number(first.lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            resolve(null);
            return;
          }

          const address = first.address || {};
          resolve({
            lat,
            lng,
            country: cleanText(address.country),
            countryCode: cleanText(address.country_code).toUpperCase(),
            locationLabel: extractLocationLabel(address),
            displayName: cleanText(first.display_name),
          });
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

function loadCache(cacheFile) {
  if (!fs.existsSync(cacheFile)) {
    return {};
  }

  try {
    const raw = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    const normalized = {};
    for (const [location, entry] of Object.entries(raw)) {
      const value = normalizeCachedGeocode(entry);
      if (value) {
        normalized[location] = value;
      }
    }
    return normalized;
  } catch {
    return {};
  }
}

function saveCache(cacheFile, cache) {
  fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
}

function fetchContributorCounts(prs) {
  const counts = new Map();

  for (const pr of prs) {
    const login = pr && pr.user && pr.user.login ? pr.user.login : '';
    if (!login) {
      continue;
    }
    counts.set(login, (counts.get(login) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([login, prCount]) => ({ login, prCount }))
    .sort((left, right) => {
      if (right.prCount !== left.prCount) {
        return right.prCount - left.prCount;
      }
      return left.login.localeCompare(right.login);
    });
}

async function fetchAllPRs(repo, state, limit, token) {
  const allPRs = [];
  let page = 1;

  while (allPRs.length < limit) {
    const perPage = Math.min(100, limit - allPRs.length);
    const batch = await ghGet(`/repos/${repo}/pulls?state=${state}&per_page=${perPage}&page=${page}`, token);
    if (!Array.isArray(batch) || batch.length === 0) {
      break;
    }

    allPRs.push(...batch);

    if (batch.length < perPage) {
      break;
    }
    page += 1;
  }

  return allPRs;
}

function buildSummary({ repo, totalPrs, uniqueContributors, contributorsWithProfileLocation, unmappedContributors, contributors }) {
  const countries = new Map();
  const locations = new Map();

  for (const contributor of contributors) {
    const country = formatCountry(contributor.countryCode, contributor.country);
    const location = cleanText(contributor.locationLabel || contributor.location);
    if (country) {
      countries.set(country, (countries.get(country) || 0) + 1);
    }
    if (location) {
      locations.set(location, (locations.get(location) || 0) + 1);
    }
  }

  const topCountries = Array.from(countries.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.label.localeCompare(right.label);
    });

  const topLocations = Array.from(locations.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.label.localeCompare(right.label);
    });

  const mappedContributors = contributors.length;
  const countriesRepresented = topCountries.length;
  const contributorsWithoutProfileLocation = Math.max(uniqueContributors - contributorsWithProfileLocation, 0);

  let emptyState = null;
  if (totalPrs === 0) {
    emptyState = {
      title: 'No pull requests found yet',
      body: 'This repo does not have PR history in the selected query window, so there are no contributors to plot yet.',
    };
  } else if (contributorsWithProfileLocation === 0) {
    emptyState = {
      title: 'Contributors found, but no profile locations were set',
      body: 'GitHub PR authors were found, but none had a public profile location. The map cannot place contributors until that field is available.',
    };
  } else if (mappedContributors === 0) {
    emptyState = {
      title: 'Contributor locations could not be mapped',
      body: 'Profile location text was found, but the geocoder could not turn it into coordinates. The summary still shows coverage so you can see what was missing.',
    };
  }

  let caption = `${mappedContributors} mapped contributors`;
  if (mappedContributors > 0 && countriesRepresented > 0) {
    caption += ` across ${countriesRepresented} countries`;
  }
  if (mappedContributors === 0) {
    caption = 'No mappable contributors yet';
  } else {
    caption = `${mappedContributors} mapped ${pluralize(mappedContributors, 'contributor')}`;
    if (countriesRepresented > 0) {
      caption += ` across ${countriesRepresented} ${pluralize(countriesRepresented, 'country', 'countries')}`;
    }
  }

  return {
    repo,
    totalPrs,
    uniqueContributors,
    contributorsWithProfileLocation,
    contributorsWithoutProfileLocation,
    unmappedContributors,
    mappedContributors,
    countriesRepresented,
    topCountries,
    topLocations,
    emptyState,
    caption,
    cards: [
      {
        label: 'PRs scanned',
        value: String(totalPrs),
        hint: 'Based on the selected repo and state filter',
      },
      {
        label: 'Contributors',
        value: String(uniqueContributors),
        hint: `${contributorsWithProfileLocation} with profile locations`,
      },
      {
        label: 'Mapped',
        value: String(mappedContributors),
        hint: `${unmappedContributors} unresolved, ${contributorsWithoutProfileLocation} missing locations`,
      },
      {
        label: 'Countries',
        value: String(countriesRepresented),
        hint: countriesRepresented > 0 ? 'Best-effort from geocoder metadata' : 'No country data available yet',
      },
    ],
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

function formatCount(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

function pluralize(count, singular, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

function formatCountry(countryCode, fallback = '') {
  const normalizedCode = cleanText(countryCode).toUpperCase();
  if (normalizedCode && typeof Intl.DisplayNames === 'function') {
    try {
      const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
      const label = displayNames.of(normalizedCode);
      if (label) {
        return label;
      }
    } catch {
      // Fall back to the geocoder-provided string below.
    }
  }

  return cleanText(fallback);
}

function renderCountList(items, emptyMessage) {
  if (!items.length) {
    return `<p class="panel-empty">${escapeHtml(emptyMessage)}</p>`;
  }

  return `<ol class="stat-list">
${items.map(item => `  <li><span>${escapeHtml(item.label)}</span><strong>${formatCount(item.count)}</strong></li>`).join('\n')}
</ol>`;
}

function renderContributorPopup(contributor) {
  const location = contributor.displayName || contributor.location || 'Unknown location';
  const countryLabel = formatCountry(contributor.countryCode, contributor.country);
  const country = countryLabel ? `<div class="popup-meta">${escapeHtml(countryLabel)}</div>` : '';
  const avatar = contributor.avatar || '';

  return `<div class="popup-card">
  <img src="${escapeHtml(avatar)}" width="40" height="40" alt="${escapeHtml(contributor.login)} avatar">
  <div>
    <a href="${escapeHtml(contributor.profileUrl)}" target="_blank" rel="noreferrer"><strong>${escapeHtml(contributor.login)}</strong></a>
    <div class="popup-meta">${formatCount(contributor.prCount)} ${pluralize(contributor.prCount, 'PR')}</div>
    <div class="popup-location">${escapeHtml(location)}</div>
    ${country}
  </div>
</div>`;
}

function renderRoster(contributors) {
  if (!contributors.length) {
    return '<p class="panel-empty">No mapped contributors yet.</p>';
  }

  return `<div class="roster-list">
${contributors.map(contributor => `  <button class="roster-item" type="button" data-contributor-id="${contributor.id}">
    <img src="${escapeHtml(contributor.avatar || '')}" width="40" height="40" alt="${escapeHtml(contributor.login)} avatar">
    <span class="roster-copy">
      <strong>${escapeHtml(contributor.login)}</strong>
      <span>${formatCount(contributor.prCount)} ${pluralize(contributor.prCount, 'PR')} · ${escapeHtml(contributor.locationLabel || contributor.location)}</span>
    </span>
  </button>`).join('\n')}
</div>`;
}

function renderEmptyMapOverlay(summary) {
  if (!summary.emptyState) {
    return '';
  }

  return `<div class="map-overlay">
  <div class="map-overlay-card">
    <h3>${escapeHtml(summary.emptyState.title)}</h3>
    <p>${escapeHtml(summary.emptyState.body)}</p>
  </div>
</div>`;
}

function renderHTML(repo, contributors, summary) {
  const contributorData = contributors.map(contributor => ({
    id: contributor.id,
    lat: contributor.lat,
    lng: contributor.lng,
    popupHtml: renderContributorPopup(contributor),
  }));

  const heroText = summary.emptyState
    ? summary.emptyState.body
    : 'A static report built from GitHub pull request authors, public profile locations, and OpenStreetMap geocoding.';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>PR Contributors — ${escapeHtml(repo)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <style>
    :root {
      --bg: #08111a;
      --bg-panel: rgba(8, 17, 26, 0.9);
      --bg-card: rgba(19, 34, 49, 0.82);
      --border: rgba(173, 196, 221, 0.18);
      --text: #ecf4fb;
      --muted: #9fb6ca;
      --accent: #7ed4c8;
      --accent-strong: #f3bd68;
      --shadow: 0 20px 60px rgba(0, 0, 0, 0.28);
      --radius: 22px;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: "Avenir Next", "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at top left, rgba(49, 92, 132, 0.55), transparent 34%),
        radial-gradient(circle at bottom right, rgba(132, 92, 49, 0.38), transparent 30%),
        linear-gradient(150deg, #0c1722 0%, #08111a 52%, #05090d 100%);
      color: var(--text);
    }

    .app-shell {
      min-height: 100vh;
      display: grid;
      grid-template-columns: minmax(320px, 380px) 1fr;
      gap: 20px;
      padding: 20px;
    }

    .sidebar,
    .map-column {
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--bg-panel);
      backdrop-filter: blur(14px);
      box-shadow: var(--shadow);
    }

    .sidebar {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 18px;
      overflow: hidden;
    }

    .hero {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .eyebrow {
      margin: 0;
      font-size: 12px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--accent);
    }

    .hero h1,
    .map-header h2,
    .panel h3,
    .map-overlay-card h3 {
      margin: 0;
      font-family: Georgia, "Times New Roman", serif;
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    .hero h1 {
      font-size: 30px;
      line-height: 1.05;
    }

    .repo-name,
    .hero p,
    .map-header p,
    .panel-empty,
    .map-overlay-card p,
    .card p,
    .roster-copy span,
    .popup-meta,
    .popup-location {
      margin: 0;
      color: var(--muted);
    }

    .repo-name {
      font-size: 15px;
    }

    .cards {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .card,
    .panel {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 18px;
    }

    .card {
      padding: 16px;
    }

    .card-label {
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
    }

    .card-value {
      margin: 10px 0 6px;
      font-size: 30px;
      line-height: 1;
      color: var(--text);
    }

    .panel {
      padding: 16px;
    }

    .panel-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }

    .panel-header span {
      font-size: 12px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .panel-empty {
      font-size: 14px;
      line-height: 1.5;
    }

    .stat-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 10px;
    }

    .stat-list li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid rgba(173, 196, 221, 0.1);
      font-size: 14px;
    }

    .stat-list li:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }

    .stat-list strong {
      color: var(--accent-strong);
      font-weight: 600;
    }

    .roster-list {
      display: grid;
      gap: 10px;
      max-height: 34vh;
      overflow: auto;
      padding-right: 4px;
    }

    .roster-item {
      display: grid;
      grid-template-columns: 40px 1fr;
      gap: 12px;
      align-items: center;
      width: 100%;
      padding: 10px 12px;
      background: rgba(8, 17, 26, 0.52);
      border: 1px solid rgba(173, 196, 221, 0.12);
      border-radius: 14px;
      color: var(--text);
      text-align: left;
      cursor: pointer;
      transition: border-color 120ms ease, transform 120ms ease, background 120ms ease;
    }

    .roster-item:hover,
    .roster-item.is-active {
      border-color: rgba(126, 212, 200, 0.6);
      background: rgba(17, 40, 53, 0.9);
      transform: translateY(-1px);
    }

    .roster-item img,
    .popup-card img {
      border-radius: 999px;
      object-fit: cover;
      background: rgba(255, 255, 255, 0.12);
    }

    .roster-copy {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .roster-copy strong {
      color: var(--text);
    }

    .map-column {
      display: flex;
      flex-direction: column;
      min-height: calc(100vh - 40px);
      overflow: hidden;
    }

    .map-header {
      padding: 22px 24px 12px;
      border-bottom: 1px solid var(--border);
    }

    .map-header h2 {
      font-size: 32px;
      margin-bottom: 6px;
    }

    .map-wrap {
      position: relative;
      flex: 1;
      min-height: 420px;
    }

    #map {
      width: 100%;
      height: 100%;
    }

    .map-overlay {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      padding: 24px;
      background: linear-gradient(180deg, rgba(8, 17, 26, 0.18), rgba(8, 17, 26, 0.44));
      pointer-events: none;
    }

    .map-overlay-card {
      max-width: 420px;
      padding: 22px 24px;
      border-radius: 20px;
      background: rgba(8, 17, 26, 0.92);
      border: 1px solid var(--border);
      text-align: center;
      box-shadow: var(--shadow);
    }

    .map-overlay-card h3 {
      font-size: 28px;
      margin-bottom: 8px;
    }

    .map-overlay-card p {
      line-height: 1.6;
    }

    .popup-card {
      display: grid;
      grid-template-columns: 40px 1fr;
      gap: 12px;
      align-items: start;
      min-width: 240px;
    }

    .popup-card a {
      color: #1858b6;
      text-decoration: none;
    }

    .popup-card strong {
      color: #0c1722;
    }

    .popup-meta,
    .popup-location {
      font-size: 12px;
      line-height: 1.45;
    }

    @media (max-width: 960px) {
      .app-shell {
        grid-template-columns: 1fr;
      }

      .sidebar {
        order: 2;
      }

      .map-column {
        min-height: 65vh;
      }
    }

    @media (max-width: 640px) {
      .app-shell {
        padding: 12px;
        gap: 12px;
      }

      .sidebar,
      .map-column {
        border-radius: 18px;
      }

      .cards {
        grid-template-columns: 1fr;
      }

      .hero h1 {
        font-size: 26px;
      }

      .map-header h2 {
        font-size: 26px;
      }
    }
  </style>
</head>
<body>
  <div class="app-shell">
    <aside class="sidebar">
      <section class="hero">
        <p class="eyebrow">GitHub PR Geography</p>
        <h1>GHPR Map</h1>
        <p class="repo-name">${escapeHtml(repo)}</p>
        <p>${escapeHtml(heroText)}</p>
      </section>

      <section class="cards">
        ${summary.cards.map(card => `<article class="card">
          <div class="card-label">${escapeHtml(card.label)}</div>
          <div class="card-value">${escapeHtml(card.value)}</div>
          <p>${escapeHtml(card.hint)}</p>
        </article>`).join('\n')}
      </section>

      <section class="panel">
        <div class="panel-header">
          <h3>Top countries</h3>
          <span>${escapeHtml(String(summary.countriesRepresented))} represented</span>
        </div>
        ${renderCountList(summary.topCountries.slice(0, 5), 'Country rollups will appear once geocoder metadata is available.')}
      </section>

      <section class="panel">
        <div class="panel-header">
          <h3>Top locations</h3>
          <span>${escapeHtml(String(summary.mappedContributors))} mapped</span>
        </div>
        ${renderCountList(summary.topLocations.slice(0, 5), 'Location rollups will appear once contributors can be mapped.')}
      </section>

      <section class="panel">
        <div class="panel-header">
          <h3>Contributor roster</h3>
          <span>Click to focus</span>
        </div>
        ${renderRoster(contributors)}
      </section>
    </aside>

    <main class="map-column">
      <header class="map-header">
        <h2>${escapeHtml(repo)}</h2>
        <p>${escapeHtml(summary.caption)}</p>
      </header>
      <div class="map-wrap">
        <div id="map"></div>
        ${renderEmptyMapOverlay(summary)}
      </div>
    </main>
  </div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const contributorData = ${safeJson(contributorData)};
    const map = L.map('map', { zoomControl: true, worldCopyJump: true }).setView([20, 0], 2);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18
    }).addTo(map);

    const markerLookup = new Map();
    const markers = [];

    function setActiveContributor(id) {
      document.querySelectorAll('.roster-item').forEach(element => {
        element.classList.toggle('is-active', element.dataset.contributorId === String(id));
      });
    }

    contributorData.forEach(contributor => {
      const marker = L.marker([contributor.lat, contributor.lng]).addTo(map).bindPopup(contributor.popupHtml);
      markerLookup.set(String(contributor.id), marker);
      markers.push(marker);
      marker.on('click', () => setActiveContributor(contributor.id));
    });

    if (markers.length > 0) {
      const bounds = L.featureGroup(markers).getBounds();
      map.fitBounds(bounds.pad(0.18));
    }

    document.querySelectorAll('.roster-item').forEach(element => {
      element.addEventListener('click', () => {
        const marker = markerLookup.get(element.dataset.contributorId);
        if (!marker) {
          return;
        }
        setActiveContributor(element.dataset.contributorId);
        map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 4), { duration: 0.6 });
        marker.openPopup();
      });
    });
  </script>
</body>
</html>`;
}

async function buildReport({ repo, state, limit, token, cacheFile }) {
  const allPRs = await fetchAllPRs(repo, state, limit, token);
  console.log(`Fetched ${allPRs.length} PRs`);

  const contributorCounts = fetchContributorCounts(allPRs);
  console.log(`${contributorCounts.length} unique contributors`);

  const cache = loadCache(cacheFile);
  const contributors = [];
  let contributorsWithProfileLocation = 0;
  let unmappedContributors = 0;

  for (const author of contributorCounts) {
    const profile = await ghGet(`/users/${author.login}`, token);
    await sleep(50);

    const location = cleanText(profile.location);
    if (!location) {
      continue;
    }

    contributorsWithProfileLocation += 1;
    const { geocode, didRequestRefresh } = await resolveGeocode(location, cache);
    if (didRequestRefresh) {
      await sleep(1100);
    }

    if (!geocode) {
      unmappedContributors += 1;
      continue;
    }

    const contributor = {
      id: contributors.length + 1,
      login: author.login,
      prCount: author.prCount,
      avatar: cleanText(profile.avatar_url),
      profileUrl: cleanText(profile.html_url) || `https://github.com/${author.login}`,
      location,
      locationLabel: geocode.locationLabel || location,
      displayName: geocode.displayName || location,
      country: geocode.country,
      countryCode: geocode.countryCode,
      lat: geocode.lat,
      lng: geocode.lng,
    };

    contributors.push(contributor);
    console.log(`- mapped ${author.login} (${location})`);
  }

  saveCache(cacheFile, cache);

  const summary = buildSummary({
    repo,
    totalPrs: allPRs.length,
    uniqueContributors: contributorCounts.length,
    contributorsWithProfileLocation,
    unmappedContributors,
    contributors,
  });

  return { contributors, summary };
}

async function main() {
  const parsed = parseArgs(process.argv);
  if (parsed.help) {
    console.log(usage());
    return;
  }

  console.log(`\nGHPR Map — ${parsed.repo}\n`);

  const { contributors, summary } = await buildReport({
    repo: parsed.repo,
    state: parsed.state,
    limit: parsed.limit,
    token: parsed.token,
    cacheFile: CACHE_FILE,
  });

  console.log(`${summary.mappedContributors} contributors with mappable locations`);

  fs.mkdirSync(path.dirname(parsed.outFile), { recursive: true });
  const html = renderHTML(parsed.repo, contributors, summary);
  fs.writeFileSync(parsed.outFile, html);
  console.log(`Map saved to ${parsed.outFile}`);
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  buildReport,
  buildSummary,
  escapeHtml,
  fetchContributorCounts,
  normalizeCachedGeocode,
  needsGeocodeRefresh,
  parseArgs,
  pluralize,
  resolveGeocode,
  renderHTML,
  renderRoster,
  safeJson,
};
