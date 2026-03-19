#!/usr/bin/env node
/**
 * gh-pr-map — Visualize GitHub PR contributor locations on an interactive map.
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

// ─── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (!args.length || args[0].startsWith('--')) {
  console.error('Usage: node map_prs.js <owner/repo> [--token ...] [--state all] [--limit 200] [--out output/map.html]');
  process.exit(1);
}
const repo = args[0];
const opts = {};
for (let i = 1; i < args.length; i += 2) opts[args[i].replace(/^--/, '')] = args[i + 1];

const TOKEN  = opts.token || process.env.GITHUB_TOKEN || '';
const STATE  = opts.state || 'all';
const LIMIT  = parseInt(opts.limit || '200', 10);
const OUTFILE = opts.out || 'output/map.html';
const CACHE_FILE = '.geocache.json';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function ghGet(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path,
      headers: {
        'User-Agent': 'gh-pr-map',
        'Accept': 'application/vnd.github+json',
        ...(TOKEN ? { 'Authorization': `token ${TOKEN}` } : {}),
      },
    };
    https.get(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse error: ${data.slice(0, 100)}`)); }
      });
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function nominatimGeocode(location) {
  return new Promise((resolve) => {
    const query = encodeURIComponent(location);
    const options = {
      hostname: 'nominatim.openstreetmap.org',
      path: `/search?q=${query}&format=json&limit=1`,
      headers: { 'User-Agent': 'gh-pr-map/1.0' },
    };
    https.get(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const results = JSON.parse(data);
          if (results && results.length > 0) {
            resolve({ lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) });
          } else {
            resolve(null);
          }
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🗺  gh-pr-map — ${repo}\n`);

  // 1. Fetch PRs
  const allPRs = [];
  let page = 1;
  while (allPRs.length < LIMIT) {
    const perPage = Math.min(100, LIMIT - allPRs.length);
    const batch = await ghGet(`/repos/${repo}/pulls?state=${STATE}&per_page=${perPage}&page=${page}`);
    if (!Array.isArray(batch) || batch.length === 0) break;
    allPRs.push(...batch);
    if (batch.length < perPage) break;
    page++;
  }
  console.log(`✅ Fetched ${allPRs.length} PRs`);

  // 2. Unique authors
  const authorMap = {};
  for (const pr of allPRs) {
    if (pr.user && pr.user.login) authorMap[pr.user.login] = true;
  }
  const logins = Object.keys(authorMap);
  console.log(`👥 ${logins.length} unique contributors`);

  // 3. Load geocache
  let cache = {};
  if (fs.existsSync(CACHE_FILE)) {
    try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch {}
  }

  // 4. Fetch profile locations + geocode
  const contributors = [];
  for (const login of logins) {
    const profile = await ghGet(`/users/${login}`);
    await sleep(50);
    const location = (profile.location || '').trim();
    if (!location) continue;

    let coords = cache[location];
    if (!coords) {
      coords = await nominatimGeocode(location);
      await sleep(1100); // Nominatim rate limit: 1 req/sec
      if (coords) cache[location] = coords;
    }
    if (coords) {
      contributors.push({ login, location, avatar: profile.avatar_url, ...coords });
      process.stdout.write(`  📍 ${login} (${location})\n`);
    }
  }
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  console.log(`\n🌍 ${contributors.length} contributors with mappable locations`);

  // 5. Render HTML
  fs.mkdirSync(path.dirname(OUTFILE), { recursive: true });
  const html = renderHTML(repo, contributors);
  fs.writeFileSync(OUTFILE, html);
  console.log(`\n✨ Map saved to ${OUTFILE} — open it in your browser!\n`);
}

// ─── HTML renderer ───────────────────────────────────────────────────────────
function renderHTML(repo, contributors) {
  const markers = contributors.map(c => `
    L.marker([${c.lat}, ${c.lng}])
      .addTo(map)
      .bindPopup(\`<img src="${c.avatar}" width="40" style="border-radius:50%;vertical-align:middle"> &nbsp;<a href="https://github.com/${c.login}" target="_blank"><b>${c.login}</b></a><br><small>${c.location}</small>\`);
  `).join('\n');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>PR Contributors — ${repo}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, sans-serif; background: #0d1117; color: #e6edf3; }
    #header { padding: 16px 24px; background: #161b22; border-bottom: 1px solid #30363d; }
    #header h1 { font-size: 18px; font-weight: 600; }
    #header p  { font-size: 13px; color: #8b949e; margin-top: 4px; }
    #map { height: calc(100vh - 64px); }
  </style>
</head>
<body>
  <div id="header">
    <h1>🗺 PR Contributor Map — ${repo}</h1>
    <p>${contributors.length} contributors with location data</p>
  </div>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map').setView([20, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18
    }).addTo(map);
    ${markers}
  </script>
</body>
</html>`;
}

main().catch(err => { console.error(err); process.exit(1); });
