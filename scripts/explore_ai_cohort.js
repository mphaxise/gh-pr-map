#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

const DEFAULT_LIMIT_PER_REPO = 25;
const DEFAULT_OUT_JSON = 'output/ai-cohort-exploration.json';
const DEFAULT_OUT_HTML = 'output/ai-cohort-exploration.html';
const PROFILE_CACHE_FILE = '.profilecache.json';
const DEFAULT_COHORT = [
  'OpenHands/OpenHands',
  'huggingface/transformers',
  'vllm-project/vllm',
  'langchain-ai/langchain',
  'ollama/ollama',
];

const AGENT_KEYWORDS = [
  {
    label: 'codex',
    loginPattern: /\bcodex\b/i,
    textPattern: /\b(generated with|authored by|created by|written by|co-authored by|assisted by|using)\b[\s\S]{0,40}\bcodex\b/i,
  },
  {
    label: 'claude',
    loginPattern: /\bclaude\b/i,
    textPattern: /\b(generated with|authored by|created by|written by|co-authored by|assisted by|using)\b[\s\S]{0,40}\bclaude(\s+code)?\b/i,
  },
  {
    label: 'copilot',
    loginPattern: /\bcopilot\b/i,
    textPattern: /\b(copilot coding agent|generated with copilot|authored by copilot|using copilot)\b/i,
  },
  {
    label: 'openhands',
    loginPattern: /\bopenhands\b/i,
    textPattern: /\b(openhands agent|generated with openhands|authored by openhands|created by openhands|using openhands)\b/i,
  },
  {
    label: 'swe-agent',
    loginPattern: /\bswe[- ]agent\b/i,
    textPattern: /\b(swe[- ]agent|generated with swe[- ]agent|authored by swe[- ]agent)\b/i,
  },
  {
    label: 'aider',
    loginPattern: /\baider\b/i,
    textPattern: /\b(generated with|authored by|created by|written by|co-authored by|assisted by|using)\b[\s\S]{0,40}\baider\b/i,
  },
  {
    label: 'devin',
    loginPattern: /\bdevin\b/i,
    textPattern: /\b(generated with|authored by|created by|written by|co-authored by|assisted by|using)\b[\s\S]{0,40}\bdevin\b/i,
  },
];

const AUTOMATION_LOGIN_HINTS = [
  'dependabot[bot]',
  'renovate[bot]',
  'github-actions[bot]',
];

const BAY_AREA_PATTERN = /\b(san francisco|sf|bay area|oakland|berkeley|palo alto|mountain view|menlo park|redwood city|sunnyvale|cupertino|santa clara|san jose)\b/i;

function usage() {
  return [
    'Usage: node scripts/explore_ai_cohort.js [options]',
    '',
    'Options:',
    '  --limit-per-repo <n>   PRs to fetch per repo (default: 25)',
    '  --out-json <path>      JSON output path',
    '  --out-html <path>      HTML output path',
    '  --repos <a,b,c>        Comma-separated owner/repo cohort override',
    '  --date-from <date>     Inclusive start date in YYYY-MM-DD',
    '  --date-to <date>       Inclusive end date in YYYY-MM-DD',
    '  --window <label,from,to>  Repeatable comparison window override',
    '  --skip-profiles       Skip profile/location lookups',
  ].join('\n');
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const parsed = {
    help: false,
    limitPerRepo: DEFAULT_LIMIT_PER_REPO,
    outJson: DEFAULT_OUT_JSON,
    outHtml: DEFAULT_OUT_HTML,
    repos: DEFAULT_COHORT.slice(),
    dateFrom: '',
    dateTo: '',
    windows: [],
    skipProfiles: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }

    if (arg === '--limit-per-repo') {
      parsed.limitPerRepo = parseInt(args[i + 1], 10);
      i += 1;
      continue;
    }

    if (arg === '--out-json') {
      parsed.outJson = args[i + 1];
      i += 1;
      continue;
    }

    if (arg === '--out-html') {
      parsed.outHtml = args[i + 1];
      i += 1;
      continue;
    }

    if (arg === '--repos') {
      parsed.repos = args[i + 1].split(',').map(item => item.trim()).filter(Boolean);
      i += 1;
      continue;
    }

    if (arg === '--date-from') {
      parsed.dateFrom = args[i + 1];
      i += 1;
      continue;
    }

    if (arg === '--date-to') {
      parsed.dateTo = args[i + 1];
      i += 1;
      continue;
    }

    if (arg === '--window') {
      parsed.windows.push(parseWindowSpec(args[i + 1]));
      i += 1;
      continue;
    }

    if (arg === '--skip-profiles') {
      parsed.skipProfiles = true;
      continue;
    }

    throw new Error(usage());
  }

  return parsed;
}

function ghGet(apiPath, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: apiPath,
      headers: {
        'User-Agent': 'gh-pr-map-ai-cohort',
        'Accept': 'application/vnd.github+json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
          reject(new Error(`JSON parse error: ${data.slice(0, 120)}`));
          return;
        }

        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`GitHub API ${res.statusCode}: ${parsed.message || 'Unknown error'}`));
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

function countDaysInclusive(start, end) {
  if (!start || !end) {
    return null;
  }

  const DAY_MS = 24 * 60 * 60 * 1000;
  return Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
}

function normalizeDateWindow(dateFrom, dateTo) {
  const from = cleanText(dateFrom);
  const to = cleanText(dateTo);

  if (!from && !to) {
    return null;
  }

  const start = from ? new Date(`${from}T00:00:00Z`) : null;
  const end = to ? new Date(`${to}T23:59:59Z`) : null;

  if ((start && Number.isNaN(start.getTime())) || (end && Number.isNaN(end.getTime()))) {
    throw new Error('Invalid date window. Use YYYY-MM-DD for --date-from and --date-to.');
  }

  if (start && end && start > end) {
    throw new Error('--date-from must be earlier than or equal to --date-to.');
  }

  return {
    start,
    end,
    dateFrom: from,
    dateTo: to,
    dayCount: countDaysInclusive(start, end),
    label: `${from || 'start'} to ${to || 'present'}`,
  };
}

function parseWindowSpec(spec) {
  const [label, dateFrom, dateTo] = cleanText(spec).split(',').map(part => cleanText(part));
  if (!label || !dateFrom || !dateTo) {
    throw new Error(`Invalid --window value "${spec}". Use label,YYYY-MM-DD,YYYY-MM-DD.`);
  }

  const normalized = normalizeDateWindow(dateFrom, dateTo);
  return {
    ...normalized,
    label,
    rangeLabel: normalized.label,
  };
}

function cleanText(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

function normalizeLocation(location) {
  return cleanText(location).replace(/\s+/g, ' ');
}

function detectBayArea(location) {
  return BAY_AREA_PATTERN.test(normalizeLocation(location));
}

function isBotAuthor(user) {
  const login = cleanText(user && user.login).toLowerCase();
  const type = cleanText(user && user.type).toLowerCase();
  return type === 'bot' || /\[bot\]$/.test(login);
}

function uniqueLabels(...lists) {
  return Array.from(new Set(lists.flat().filter(Boolean)));
}

function extractAgentSignalSources(pr) {
  const login = cleanText(pr.user && pr.user.login);
  const body = cleanText(pr.body);

  const loginSignals = AGENT_KEYWORDS
    .filter(keyword => keyword.loginPattern.test(login))
    .map(keyword => keyword.label);
  const bodySignals = AGENT_KEYWORDS
    .filter(keyword => keyword.textPattern.test(body))
    .map(keyword => keyword.label);

  return {
    loginSignals,
    bodySignals,
    agentSignals: uniqueLabels(loginSignals, bodySignals),
  };
}

function extractAgentSignals(pr) {
  return extractAgentSignalSources(pr).agentSignals;
}

function classifyPullRequest(pr) {
  const login = cleanText(pr.user && pr.user.login);
  const botAuthor = isBotAuthor(pr.user);
  const {
    loginSignals,
    bodySignals,
    agentSignals,
  } = extractAgentSignalSources(pr);
  const automationSignals = AUTOMATION_LOGIN_HINTS.filter(hint => login.toLowerCase() === hint);
  const attributionSources = [];

  if (bodySignals.length) {
    attributionSources.push('body');
  }

  if (loginSignals.length) {
    attributionSources.push('login');
  }

  return {
    authorLogin: login,
    authorType: cleanText(pr.user && pr.user.type) || 'Unknown',
    botAuthor,
    automationSignals,
    bodyAgentSignals: bodySignals,
    loginAgentSignals: loginSignals,
    agentSignals,
    attributionSources,
    bodyAttributedPr: bodySignals.length > 0,
    loginAttributedPr: loginSignals.length > 0,
    agentSignalPr: agentSignals.length > 0,
  };
}

function loadCache(cacheFile) {
  if (!fs.existsSync(cacheFile)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  } catch {
    return {};
  }
}

function saveCache(cacheFile, cache) {
  fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
}

async function fetchProfile(login, token, cache) {
  if (cache[login]) {
    return cache[login];
  }

  const profile = await ghGet(`/users/${login}`, token);
  const cached = {
    login,
    type: cleanText(profile.type) || 'Unknown',
    location: normalizeLocation(profile.location),
    company: cleanText(profile.company),
    profileUrl: cleanText(profile.html_url) || `https://github.com/${login}`,
  };
  cache[login] = cached;
  await sleep(50);
  return cached;
}

function isPullRequestInWindow(pr, dateWindow) {
  if (!dateWindow) {
    return true;
  }

  const createdAt = new Date(pr.created_at);
  if (dateWindow.start && createdAt < dateWindow.start) {
    return false;
  }
  if (dateWindow.end && createdAt > dateWindow.end) {
    return false;
  }

  return true;
}

async function fetchRepoMetadata(repo, token) {
  const metadata = await ghGet(`/repos/${repo}`, token);
  return {
    repo,
    stars: metadata.stargazers_count || 0,
    forks: metadata.forks_count || 0,
    language: cleanText(metadata.language),
    pushedAt: cleanText(metadata.pushed_at),
    htmlUrl: cleanText(metadata.html_url),
    description: cleanText(metadata.description),
    license: metadata.license
      ? (cleanText(metadata.license.spdx_id) || cleanText(metadata.license.name) || 'Present')
      : 'No license detected',
    createdAt: cleanText(metadata.created_at),
  };
}

async function fetchRepoMetadataMap(repos, token) {
  const repoMetaByName = {};

  for (const repo of repos) {
    repoMetaByName[repo] = await fetchRepoMetadata(repo, token);
  }

  return repoMetaByName;
}

async function fetchRepoPullRequests(repo, limitPerRepo, token, dateWindow) {
  if (!dateWindow) {
    const prs = await ghGet(`/repos/${repo}/pulls?state=all&sort=updated&direction=desc&per_page=${limitPerRepo}`, token);
    if (!Array.isArray(prs)) {
      throw new Error(`Unexpected PR response for ${repo}`);
    }
    return prs;
  }

  const all = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const prs = await ghGet(`/repos/${repo}/pulls?state=all&sort=created&direction=desc&per_page=${perPage}&page=${page}`, token);
    if (!Array.isArray(prs) || prs.length === 0) {
      break;
    }

    let reachedOlderWindow = false;

    for (const pr of prs) {
      const createdAt = new Date(pr.created_at);

      if (dateWindow.end && createdAt > dateWindow.end) {
        continue;
      }

      if (dateWindow.start && createdAt < dateWindow.start) {
        reachedOlderWindow = true;
        continue;
      }

      all.push(pr);
    }

    if (limitPerRepo && all.length >= limitPerRepo) {
      return all.slice(0, limitPerRepo);
    }

    if (reachedOlderWindow || prs.length < perPage) {
      break;
    }

    page += 1;
  }

  return all;
}

function countByLabel(items, getLabel) {
  const counts = new Map();

  for (const item of items) {
    const label = getLabel(item);
    if (!label) {
      continue;
    }
    if (!counts.has(label)) {
      counts.set(label, { label, count: 0 });
    }
    counts.get(label).count += 1;
  }

  return Array.from(counts.values()).sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }
    return left.label.localeCompare(right.label);
  });
}

function countSignalLabels(rows, getLabels = row => row.agentSignals || []) {
  return countByLabel(
    rows.flatMap(row => getLabels(row).map(label => ({ label }))),
    item => item.label
  );
}

function topLocationRows(humanContributorRows) {
  const deduped = new Map();

  for (const row of humanContributorRows) {
    if (!row.location) {
      continue;
    }
    const key = row.location.toLowerCase();
    if (!deduped.has(key)) {
      deduped.set(key, {
        label: row.location,
        count: 0,
        bayAreaMatchCount: 0,
      });
    }

    const target = deduped.get(key);
    target.count += 1;
    if (row.bayAreaMatch) {
      target.bayAreaMatchCount += 1;
    }
  }

  return Array.from(deduped.values()).sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }
    return left.label.localeCompare(right.label);
  });
}

function pluralize(count, singular, plural) {
  return count === 1 ? singular : (plural || `${singular}s`);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCount(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatRate(value) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
  }).format(value);
}

function renderBars(rows, config) {
  if (!rows.length) {
    return '<p class="panel-empty">No chart data available.</p>';
  }

  const max = Math.max(...rows.map(config.getValue), 1);
  return `<div class="bars">
${rows.map(row => {
  const value = config.getValue(row);
  const width = Math.max((value / max) * 100, value > 0 ? 4 : 0);
  const formattedValue = config.formatValue
    ? config.formatValue(value, row)
    : String(value);
  return `  <div class="bar-row">
    <div class="bar-label">${escapeHtml(config.getLabel(row))}</div>
    <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
    <div class="bar-value">${escapeHtml(formattedValue)}</div>
  </div>`;
}).join('\n')}
</div>`;
}

function renderStackedRepoRows(repoSummaries) {
  if (!repoSummaries.length) {
    return '<p class="panel-empty">No repo mix data available.</p>';
  }

  return `<div class="stacked-chart">
${repoSummaries.map(summary => {
  const total = Math.max(summary.totalPrs, 1);
  const humanWidth = (summary.humanPrs / total) * 100;
  const botWidth = (summary.botPrs / total) * 100;
  const agentWidth = (summary.agentSignalPrs / total) * 100;
  return `  <div class="stacked-row">
    <div class="bar-label">${escapeHtml(summary.repo)}</div>
    <div class="stacked-track">
      <div class="stacked-segment human" style="width:${humanWidth}%"></div>
      <div class="stacked-segment bot" style="width:${botWidth}%"></div>
      <div class="stacked-segment agent" style="width:${agentWidth}%"></div>
    </div>
    <div class="bar-value">${formatCount(summary.totalPrs)}</div>
  </div>`;
}).join('\n')}
</div>`;
}

function renderTable(headers, rows) {
  return `<table>
  <thead>
    <tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
  </thead>
  <tbody>
${rows.map(row => `    <tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('\n')}
  </tbody>
</table>`;
}

function renderSingleWindowHtml(report) {
  const summary = report.summary;
  const repoContextRows = report.repoSummaries.slice().sort((left, right) => {
    if (right.stars !== left.stars) {
      return right.stars - left.stars;
    }
    return left.repo.localeCompare(right.repo);
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Coding Agent Repo Comparison</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root {
      --bg: #f5efe3;
      --paper: #fffaf2;
      --ink: #1f2b38;
      --muted: #6b7783;
      --border: #d7c8b2;
      --accent: #7b4b33;
      --accent-soft: #b66f3a;
      --human: #4f7a63;
      --bot: #8d3d39;
      --agent: #db9646;
      --shadow: 0 18px 40px rgba(64, 43, 20, 0.12);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      font-family: "Iowan Old Style", "Palatino Linotype", serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(214, 182, 135, 0.45), transparent 28%),
        linear-gradient(180deg, #f7f1e7, #efe4d0 42%, #f5efe3);
    }

    main {
      max-width: 1240px;
      margin: 0 auto;
      padding: 28px 20px 48px;
    }

    .hero,
    .panel {
      background: var(--paper);
      border: 1px solid var(--border);
      border-radius: 24px;
      box-shadow: var(--shadow);
    }

    .hero {
      padding: 28px;
      margin-bottom: 18px;
    }

    .eyebrow {
      margin: 0 0 8px;
      font-family: "Avenir Next", "Segoe UI", sans-serif;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 12px;
      color: var(--accent-soft);
    }

    h1, h2, h3 {
      margin: 0;
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    h1 { font-size: 42px; margin-bottom: 10px; }
    h2 { font-size: 28px; margin-bottom: 10px; }
    h3 { font-size: 22px; margin-bottom: 12px; }

    p {
      margin: 0;
      line-height: 1.6;
    }

    .muted { color: var(--muted); }

    .grid {
      display: grid;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      gap: 18px;
    }

    .panel {
      padding: 22px;
    }

    .span-12 { grid-column: span 12; }
    .span-8 { grid-column: span 8; }
    .span-6 { grid-column: span 6; }
    .span-4 { grid-column: span 4; }

    .cards {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
      margin-top: 18px;
    }

    .card {
      padding: 16px;
      border: 1px solid var(--border);
      border-radius: 18px;
      background: rgba(255, 247, 236, 0.88);
    }

    .card-label {
      font-size: 12px;
      font-family: "Avenir Next", "Segoe UI", sans-serif;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--muted);
    }

    .card-value {
      margin-top: 8px;
      font-size: 34px;
      color: var(--accent);
    }

    .cards p {
      font-size: 14px;
      margin-top: 6px;
      color: var(--muted);
    }

    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 10px 16px;
      margin-top: 10px;
      font-family: "Avenir Next", "Segoe UI", sans-serif;
      font-size: 13px;
    }

    .legend span::before {
      content: "";
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 999px;
      margin-right: 8px;
      vertical-align: baseline;
    }

    .legend .human::before { background: var(--human); }
    .legend .bot::before { background: var(--bot); }
    .legend .agent::before { background: var(--agent); }

    .bars,
    .stacked-chart {
      display: grid;
      gap: 12px;
      margin-top: 10px;
    }

    .bar-row,
    .stacked-row {
      display: grid;
      grid-template-columns: minmax(120px, 180px) 1fr 48px;
      gap: 12px;
      align-items: center;
      font-family: "Avenir Next", "Segoe UI", sans-serif;
    }

    .bar-label,
    .bar-value {
      font-size: 14px;
      color: var(--ink);
    }

    .bar-track,
    .stacked-track {
      height: 14px;
      border-radius: 999px;
      background: #eadfce;
      overflow: hidden;
      position: relative;
    }

    .bar-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--accent), var(--accent-soft));
      border-radius: 999px;
    }

    .stacked-track {
      display: flex;
    }

    .stacked-segment {
      height: 100%;
    }

    .stacked-segment.human { background: var(--human); }
    .stacked-segment.bot { background: var(--bot); }
    .stacked-segment.agent { background: var(--agent); }

    table {
      width: 100%;
      border-collapse: collapse;
      font-family: "Avenir Next", "Segoe UI", sans-serif;
      font-size: 14px;
    }

    th, td {
      text-align: left;
      padding: 10px 8px;
      border-bottom: 1px solid #eadfce;
      vertical-align: top;
    }

    th {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
    }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 12px;
      background: #efe2d1;
      color: var(--accent);
      border: 1px solid var(--border);
    }

    .panel-empty {
      color: var(--muted);
      font-family: "Avenir Next", "Segoe UI", sans-serif;
    }

    .footnote {
      margin-top: 16px;
      font-size: 13px;
      color: var(--muted);
      font-family: "Avenir Next", "Segoe UI", sans-serif;
    }

    a { color: var(--accent); }

    @media (max-width: 960px) {
      .span-8, .span-6, .span-4 { grid-column: span 12; }
      .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }

    @media (max-width: 640px) {
      main { padding: 14px 12px 28px; }
      h1 { font-size: 34px; }
      .cards { grid-template-columns: 1fr; }
      .bar-row, .stacked-row { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <p class="eyebrow">GHPR Exploration</p>
      <h1>Agent repo comparison: size versus activity</h1>
      <p>This sample page looks at ${formatCount(summary.totalPrs)} pull requests across ${formatCount(report.cohort.length)} GitHub repos${report.dateWindow ? ` in the window ${escapeHtml(report.dateWindow.label)}` : ''}. The goal is to compare repo size, PR activity, visible automation, and location coverage before deciding what GHPR should visualize next.</p>
      <div class="cards">
        <article class="card">
          <div class="card-label">Window PRs</div>
          <div class="card-value">${formatCount(summary.totalPrs)}</div>
          <p>${formatCount(summary.botPrs)} bot-authored and ${formatCount(summary.agentSignalPrs)} with visible agent signals</p>
        </article>
        <article class="card">
          <div class="card-label">Human Authors</div>
          <div class="card-value">${formatCount(summary.humanAuthors)}</div>
          <p>${formatCount(summary.humanAuthorsWithLocation)} publish a profile location</p>
        </article>
        <article class="card">
          <div class="card-label">Bay Area Matches</div>
          <div class="card-value">${formatCount(summary.bayAreaAuthors)}</div>
          <p>Best-effort match against self-reported locations</p>
        </article>
        <article class="card">
          <div class="card-label">Coverage</div>
          <div class="card-value">${summary.locationCoveragePct}%</div>
          <p>Of human authors in this sample with a public location</p>
        </article>
      </div>
      <p class="footnote">Caveat: <code>agent signal</code> means visible keyword evidence in author login, title, or PR body. It does not mean all other PRs were human-only.</p>
    </section>

    <div class="grid">
      <section class="panel span-6">
        <h2>PR volume in window</h2>
        ${renderBars(report.repoSummaries, {
          getLabel: row => row.repo,
          getValue: row => row.totalPrs,
        })}
      </section>

      <section class="panel span-6">
        <h2>Repo size by stars</h2>
        ${renderBars(repoContextRows, {
          getLabel: row => row.repo,
          getValue: row => row.stars,
        })}
      </section>

      <section class="panel span-6">
        <h2>Human, bot, and agent-signal mix</h2>
        <p class="muted">Agent-signal PRs can overlap with bot-authored PRs.</p>
        <div class="legend">
          <span class="human">human-authored PRs</span>
          <span class="bot">bot-authored PRs</span>
          <span class="agent">agent-signal PRs</span>
        </div>
        ${renderStackedRepoRows(report.repoSummaries)}
      </section>

      <section class="panel span-6">
        <h2>Location coverage by repo</h2>
        ${renderBars(report.repoSummaries, {
          getLabel: row => row.repo,
          getValue: row => row.humanAuthorsWithLocation,
        })}
        <p class="footnote">This counts unique human authors with a non-empty GitHub profile location in the sampled PR window.</p>
      </section>

      <section class="panel span-6">
        <h2>Bay Area matches by repo</h2>
        ${renderBars(report.repoSummaries, {
          getLabel: row => row.repo,
          getValue: row => row.bayAreaAuthors,
        })}
      </section>

      <section class="panel span-12">
        <h2>Repo context</h2>
        ${renderTable(
          ['Repo', 'Stars', 'Forks', 'License', 'Last push'],
          repoContextRows.map(row => [
            `<a href="${escapeHtml(row.htmlUrl)}" target="_blank" rel="noreferrer">${escapeHtml(row.repo)}</a>`,
            formatCount(row.stars),
            formatCount(row.forks),
            escapeHtml(row.license),
            escapeHtml(row.pushedAt ? row.pushedAt.slice(0, 10) : '—'),
          ])
        )}
      </section>

      <section class="panel span-12">
        <h2>Repo summary table</h2>
        ${renderTable(
          ['Repo', 'PRs', 'Unique authors', 'Bot PRs', 'Agent-signal PRs', 'Humans w/ location', 'Bay Area matches'],
          report.repoSummaries.map(row => [
            escapeHtml(row.repo),
            formatCount(row.totalPrs),
            formatCount(row.uniqueAuthors),
            formatCount(row.botPrs),
            formatCount(row.agentSignalPrs),
            formatCount(row.humanAuthorsWithLocation),
            formatCount(row.bayAreaAuthors),
          ])
        )}
      </section>

      <section class="panel span-6">
        <h2>Top self-reported locations</h2>
        ${report.topLocations.length
          ? renderTable(
              ['Location', 'Authors', 'Bay Area matches'],
              report.topLocations.slice(0, 12).map(row => [
                escapeHtml(row.label),
                formatCount(row.count),
                formatCount(row.bayAreaMatchCount),
              ])
            )
          : '<p class="panel-empty">No public profile locations in this sample.</p>'}
      </section>

      <section class="panel span-6">
        <h2>Top recurring authors</h2>
        ${report.topAuthors.length
          ? renderTable(
              ['Author', 'Type', 'PRs', 'Location'],
              report.topAuthors.slice(0, 12).map(row => [
                escapeHtml(row.authorLogin),
                `<span class="badge">${escapeHtml(row.authorType)}</span>`,
                formatCount(row.prCount),
                escapeHtml(row.location || '—'),
              ])
            )
          : '<p class="panel-empty">No author data available.</p>'}
      </section>

      <section class="panel span-12">
        <h2>Visible agent-signal PRs</h2>
        ${report.agentSignalPrs.length
          ? renderTable(
              ['Repo', 'PR', 'Author', 'Signals', 'Created'],
              report.agentSignalPrs.slice(0, 20).map(row => [
                escapeHtml(row.repo),
                `<a href="${escapeHtml(row.htmlUrl)}" target="_blank" rel="noreferrer">${escapeHtml(`#${row.number} ${row.title}`)}</a>`,
                escapeHtml(row.authorLogin),
                escapeHtml(row.agentSignals.join(', ')),
                escapeHtml(row.createdAt.slice(0, 10)),
              ])
            )
          : '<p class="panel-empty">No explicit agent-signal PRs were detected in the sampled window.</p>'}
      </section>

      <section class="panel span-12">
        <h2>What this page is good for</h2>
        <p>Use this exploration to answer whether the next GHPR slice should focus on the biggest repos, the busiest repos inside a date window, or the subset where visible automation actually shows up. If the tables say more than the eventual map, that is still a useful result.</p>
        <p class="footnote">Generated ${escapeHtml(report.generatedAt)} from a cohort of ${escapeHtml(report.cohort.join(', '))}${report.dateWindow ? ` using the date window ${escapeHtml(report.dateWindow.label)}` : ` with ${formatCount(report.limitPerRepo)} PRs per repo`}.</p>
      </section>
    </div>
  </main>
</body>
</html>`;
}

function renderWindowComparisonHtml(comparison) {
  const firstWindow = comparison.windows[0] || null;
  const lastWindow = comparison.windows[comparison.windows.length - 1] || null;
  const anchor = comparison.anchorComparison;
  const activeVendors = comparison.activeVendors || [];
  const latestLeader = lastWindow && lastWindow.topRepo
    ? `${lastWindow.topRepo.repo} (${formatCount(lastWindow.topRepo.totalPrs)} PRs)`
    : 'No repo activity in sampled windows';

  const repoComparisonHeaders = ['Repo']
    .concat(comparison.windows.map(window => `${window.label} PRs`))
    .concat(
      firstWindow && lastWindow ? [`${firstWindow.label} -> ${lastWindow.label}`] : [],
      firstWindow ? [`${firstWindow.label} body share`] : [],
      lastWindow ? [`${lastWindow.label} body share`] : []
    );
  const repoThroughputHeaders = ['Repo'].concat(
    comparison.windows.map(window => `${window.label} PRs/day`)
  );
  const vendorWindowHeaders = ['Window', 'PR-body attributed PRs']
    .concat(activeVendors.map(label => `${label} PRs`));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Coding Agent Window Comparison</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root {
      --bg: #f5efe3;
      --paper: #fffaf2;
      --ink: #1f2b38;
      --muted: #6b7783;
      --border: #d7c8b2;
      --accent: #7b4b33;
      --accent-soft: #b66f3a;
      --human: #4f7a63;
      --bot: #8d3d39;
      --agent: #db9646;
      --shadow: 0 18px 40px rgba(64, 43, 20, 0.12);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      font-family: "Iowan Old Style", "Palatino Linotype", serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(214, 182, 135, 0.45), transparent 28%),
        linear-gradient(180deg, #f7f1e7, #efe4d0 42%, #f5efe3);
    }

    main {
      max-width: 1280px;
      margin: 0 auto;
      padding: 28px 20px 48px;
    }

    .hero,
    .panel {
      background: var(--paper);
      border: 1px solid var(--border);
      border-radius: 24px;
      box-shadow: var(--shadow);
    }

    .hero {
      padding: 28px;
      margin-bottom: 18px;
    }

    .eyebrow {
      margin: 0 0 8px;
      font-family: "Avenir Next", "Segoe UI", sans-serif;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 12px;
      color: var(--accent-soft);
    }

    h1, h2, h3 {
      margin: 0;
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    h1 { font-size: 42px; margin-bottom: 10px; }
    h2 { font-size: 28px; margin-bottom: 10px; }
    h3 { font-size: 22px; margin-bottom: 12px; }

    p {
      margin: 0;
      line-height: 1.6;
    }

    .muted { color: var(--muted); }

    .grid {
      display: grid;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      gap: 18px;
    }

    .panel {
      padding: 22px;
    }

    .span-12 { grid-column: span 12; }
    .span-6 { grid-column: span 6; }
    .span-4 { grid-column: span 4; }

    .cards {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
      margin-top: 18px;
    }

    .window-cards {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
      margin-top: 12px;
    }

    .card {
      padding: 16px;
      border: 1px solid var(--border);
      border-radius: 18px;
      background: rgba(255, 247, 236, 0.88);
    }

    .card-label {
      font-size: 12px;
      font-family: "Avenir Next", "Segoe UI", sans-serif;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--muted);
    }

    .card-value {
      margin-top: 8px;
      font-size: 34px;
      color: var(--accent);
    }

    .cards p,
    .window-cards p {
      font-size: 14px;
      margin-top: 6px;
      color: var(--muted);
    }

    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 10px 16px;
      margin-top: 10px;
      font-family: "Avenir Next", "Segoe UI", sans-serif;
      font-size: 13px;
    }

    .legend span::before {
      content: "";
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 999px;
      margin-right: 8px;
      vertical-align: baseline;
    }

    .legend .human::before { background: var(--human); }
    .legend .bot::before { background: var(--bot); }
    .legend .agent::before { background: var(--agent); }

    .bars {
      display: grid;
      gap: 12px;
      margin-top: 10px;
    }

    .bar-row {
      display: grid;
      grid-template-columns: minmax(120px, 190px) 1fr 72px;
      gap: 12px;
      align-items: center;
      font-family: "Avenir Next", "Segoe UI", sans-serif;
    }

    .bar-label,
    .bar-value {
      font-size: 14px;
      color: var(--ink);
    }

    .bar-track {
      height: 14px;
      border-radius: 999px;
      background: #eadfce;
      overflow: hidden;
      position: relative;
    }

    .bar-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--accent), var(--accent-soft));
      border-radius: 999px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-family: "Avenir Next", "Segoe UI", sans-serif;
      font-size: 14px;
    }

    th, td {
      text-align: left;
      padding: 10px 8px;
      border-bottom: 1px solid #eadfce;
      vertical-align: top;
    }

    th {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
    }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 12px;
      background: #efe2d1;
      color: var(--accent);
      border: 1px solid var(--border);
    }

    .panel-empty {
      color: var(--muted);
      font-family: "Avenir Next", "Segoe UI", sans-serif;
    }

    .footnote {
      margin-top: 16px;
      font-size: 13px;
      color: var(--muted);
      font-family: "Avenir Next", "Segoe UI", sans-serif;
    }

    a { color: var(--accent); }

    @media (max-width: 960px) {
      .span-6, .span-4 { grid-column: span 12; }
      .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .window-cards { grid-template-columns: 1fr; }
    }

    @media (max-width: 640px) {
      main { padding: 14px 12px 28px; }
      h1 { font-size: 34px; }
      .cards { grid-template-columns: 1fr; }
      .bar-row { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <p class="eyebrow">GHPR Exploration</p>
      <h1>Busiest public coding-agent repos across three windows</h1>
      <p>This sample compares the same public coding-agent cohort across ${formatCount(comparison.windows.length)} fixed windows. The goal is to see how total PR volume, bot-opened PRs, and explicit PR-body attribution changed from early 2025 into early 2026 without relying on location data.</p>
      <div class="cards">
        <article class="card">
          <div class="card-label">Total Window PRs</div>
          <div class="card-value">${formatCount(comparison.summary.totalPrs)}</div>
          <p>${formatCount(comparison.summary.botPrs)} bot-opened, ${formatCount(comparison.summary.bodyAttributedPrs)} PR-body attributed, ${formatCount(comparison.summary.loginAttributedPrs)} login-attributed</p>
        </article>
        <article class="card">
          <div class="card-label">Unique Authors</div>
          <div class="card-value">${formatCount(comparison.summary.uniqueAuthors)}</div>
          <p>Across all sampled windows in this cohort</p>
        </article>
        <article class="card">
          <div class="card-label">Early Window Delta</div>
          <div class="card-value">${anchor ? `${anchor.totalPrDelta >= 0 ? '+' : ''}${formatCount(anchor.totalPrDelta)}` : '—'}</div>
          <p>${anchor ? `${firstWindow.label} to ${lastWindow.label}: ${anchor.totalPrDeltaPct >= 0 ? '+' : ''}${anchor.totalPrDeltaPct}% PR change, ${anchor.bodyShareDeltaPct >= 0 ? '+' : ''}${anchor.bodyShareDeltaPct} body-share points` : 'No matched early-window delta available'}</p>
        </article>
        <article class="card">
          <div class="card-label">Latest Window Leader</div>
          <div class="card-value">${lastWindow && lastWindow.topRepo ? formatCount(lastWindow.topRepo.totalPrs) : '0'}</div>
          <p>${escapeHtml(latestLeader)}</p>
        </article>
      </div>
      <div class="window-cards">
        ${comparison.windows.map(window => `        <article class="card">
          <div class="card-label">${escapeHtml(window.label)}</div>
          <div class="card-value">${formatCount(window.totalPrs)}</div>
          <p>${formatRate(window.prPerDay)} PRs/day across ${window.dayCount ? `${formatCount(window.dayCount)} days` : 'the sampled range'}</p>
          <p>${window.botSharePct}% bot-opened, ${window.bodySharePct}% PR-body attributed, ${window.loginSharePct}% login-attributed</p>
        </article>`).join('\n')}
      </div>
      <p class="footnote">Caveat: <code>PR-body attributed</code> means explicit provenance text in the PR body. <code>login-attributed</code> means the author login matched an agent keyword and is a weaker signal.</p>
    </section>

    <div class="grid">
      <section class="panel span-12">
        <h2>Window snapshots</h2>
        ${renderTable(
          ['Window', 'Dates', 'Days', 'PRs', 'PRs/day', 'Unique authors', 'Bot-opened PRs', 'PR-body attributed', 'Login-attributed', 'Busiest repo'],
          comparison.windows.map(window => [
            escapeHtml(window.label),
            escapeHtml(window.dateRangeLabel),
            formatCount(window.dayCount || 0),
            formatCount(window.totalPrs),
            formatRate(window.prPerDay),
            formatCount(window.uniqueAuthors),
            `${formatCount(window.botPrs)} (${window.botSharePct}%)`,
            `${formatCount(window.bodyAttributedPrs)} (${window.bodySharePct}%)`,
            `${formatCount(window.loginAttributedPrs)} (${window.loginSharePct}%)`,
            escapeHtml(window.topRepo ? `${window.topRepo.repo} (${formatCount(window.topRepo.totalPrs)})` : '—'),
          ])
        )}
      </section>

      ${comparison.windows.map(window => `      <section class="panel span-4">
        <h2>${escapeHtml(window.label)}</h2>
        <p class="muted">${escapeHtml(window.dateRangeLabel)}</p>
        ${renderBars(window.repoSummaries, {
          getLabel: row => row.repo,
          getValue: row => row.totalPrs,
          formatValue: value => formatCount(value),
        })}
      </section>`).join('\n')}

      <section class="panel span-4">
        <h2>Bot-opened share by window</h2>
        ${renderBars(comparison.windows, {
          getLabel: row => row.label,
          getValue: row => row.botSharePct,
          formatValue: value => `${value}%`,
        })}
      </section>

      <section class="panel span-4">
        <h2>PR-body share by window</h2>
        ${renderBars(comparison.windows, {
          getLabel: row => row.label,
          getValue: row => row.bodySharePct,
          formatValue: value => `${value}%`,
        })}
      </section>

      <section class="panel span-4">
        <h2>Login-attributed share by window</h2>
        ${renderBars(comparison.windows, {
          getLabel: row => row.label,
          getValue: row => row.loginSharePct,
          formatValue: value => `${value}%`,
        })}
      </section>

      <section class="panel span-12">
        <h2>Repo comparison table</h2>
        ${renderTable(
          repoComparisonHeaders,
          comparison.repoComparisons.map(row => [
            `<a href="${escapeHtml(row.htmlUrl)}" target="_blank" rel="noreferrer">${escapeHtml(row.repo)}</a>`,
            ...row.windowStats.map(stat => formatCount(stat.totalPrs)),
            ...(firstWindow && lastWindow ? [`${row.anchorPrDelta >= 0 ? '+' : ''}${formatCount(row.anchorPrDelta)} (${row.anchorPrDeltaPct >= 0 ? '+' : ''}${row.anchorPrDeltaPct}%)`] : []),
            ...(firstWindow ? [`${row.windowStats[0].bodySharePct}%`] : []),
            ...(lastWindow ? [`${row.windowStats[row.windowStats.length - 1].bodySharePct}%`] : []),
          ])
        )}
        <p class="footnote">Raw totals answer which repos were busiest in each window. Use the per-day table below when comparing the longer late-2025 window against the equal-length early windows.</p>
      </section>

      <section class="panel span-12">
        <h2>Repo PRs/day comparison</h2>
        ${renderTable(
          repoThroughputHeaders,
          comparison.repoComparisons.map(row => [
            `<a href="${escapeHtml(row.htmlUrl)}" target="_blank" rel="noreferrer">${escapeHtml(row.repo)}</a>`,
            ...row.windowStats.map(stat => formatRate(stat.prPerDay)),
          ])
        )}
      </section>

      <section class="panel span-6">
        <h2>Most active bot accounts</h2>
        ${comparison.botAuthors.length
          ? renderTable(
              ['Author', 'PRs'],
              comparison.botAuthors.slice(0, 12).map(row => [
                escapeHtml(row.label),
                formatCount(row.count),
              ])
            )
          : '<p class="panel-empty">No bot-opened PRs were detected in these windows.</p>'}
      </section>

      <section class="panel span-6">
        <h2>Top repos by PR-body attribution</h2>
        ${renderBars(comparison.repoBodyTotals, {
          getLabel: row => row.repo,
          getValue: row => row.bodyAttributedPrs,
          formatValue: value => formatCount(value),
        })}
      </section>

      <section class="panel span-6">
        <h2>PR-body attribution by vendor</h2>
        ${comparison.bodyVendorTotals.length
          ? renderBars(comparison.bodyVendorTotals, {
              getLabel: row => row.label,
              getValue: row => row.count,
              formatValue: value => formatCount(value),
            })
          : '<p class="panel-empty">No vendor-level PR-body attribution was detected in the sampled windows.</p>'}
      </section>

      <section class="panel span-6">
        <h2>PR-body vendor signals by window</h2>
        ${activeVendors.length
          ? renderTable(
              vendorWindowHeaders,
              comparison.windows.map(window => [
                escapeHtml(window.label),
                formatCount(window.bodyAttributedPrs),
                ...activeVendors.map(label => {
                  const vendor = window.bodyVendorTotals.find(item => item.label === label);
                  return formatCount(vendor ? vendor.count : 0);
                }),
              ])
            )
          : '<p class="panel-empty">No vendor-level PR-body attribution was detected in the sampled windows.</p>'}
        <p class="footnote">A single PR can contribute to more than one vendor label if its PR body explicitly mentions multiple tools.</p>
      </section>

      <section class="panel span-12">
        <h2>Visible attribution examples</h2>
        ${comparison.agentSignalPrs.length
          ? renderTable(
              ['Window', 'Repo', 'PR', 'Author', 'Sources', 'Body signals', 'Login signals', 'Created'],
              comparison.agentSignalPrs.slice(0, 25).map(row => [
                escapeHtml(row.windowLabel),
                escapeHtml(row.repo),
                `<a href="${escapeHtml(row.htmlUrl)}" target="_blank" rel="noreferrer">${escapeHtml(`#${row.number} ${row.title}`)}</a>`,
                escapeHtml(row.authorLogin),
                escapeHtml(row.attributionSources.join(', ') || '—'),
                escapeHtml(row.bodyAgentSignals.join(', ') || '—'),
                escapeHtml(row.loginAgentSignals.join(', ') || '—'),
                escapeHtml(row.createdAt.slice(0, 10)),
              ])
            )
          : '<p class="panel-empty">No explicit attribution signals were detected in the sampled windows.</p>'}
      </section>

      <section class="panel span-12">
        <h2>What this page is good for</h2>
        <p>Use this comparison to test whether coding-agent repos got busier, more bot-opened, or more explicitly attributed in PR bodies over time. The equal-length early-2025 and early-2026 windows are the clean year-over-year anchor; late 2025 is a bridge window that helps show whether the change was gradual or sudden.</p>
        <p class="footnote">Generated ${escapeHtml(comparison.generatedAt)} from ${escapeHtml(comparison.cohort.join(', '))}.</p>
      </section>
    </div>
  </main>
</body>
</html>`;
}

function renderHtml(report) {
  if (report && report.type === 'windowComparison') {
    return renderWindowComparisonHtml(report);
  }

  return renderSingleWindowHtml(report);
}

function buildReport({ cohort, limitPerRepo, dateWindow, repoMetaByName, repoRows, humanContributorRows }) {
  const totalPrs = repoRows.length;
  const botPrs = repoRows.filter(row => row.botAuthor).length;
  const humanPrs = repoRows.filter(row => !row.botAuthor).length;
  const bodyAttributedPrs = repoRows.filter(row => row.bodyAttributedPr).length;
  const loginAttributedPrs = repoRows.filter(row => row.loginAttributedPr).length;
  const agentSignalPrs = repoRows.filter(row => row.agentSignalPr).length;
  const authorMap = new Map();
  const humanAuthorMap = new Map();

  for (const row of repoRows) {
    if (!authorMap.has(row.authorLogin)) {
      authorMap.set(row.authorLogin, {
        authorLogin: row.authorLogin,
        authorType: row.authorType,
        prCount: 0,
        location: '',
      });
    }
    authorMap.get(row.authorLogin).prCount += 1;
  }

  for (const row of humanContributorRows) {
    if (!humanAuthorMap.has(row.authorLogin)) {
      humanAuthorMap.set(row.authorLogin, row);
    }
    const target = authorMap.get(row.authorLogin);
    if (target && row.location && !target.location) {
      target.location = row.location;
    }
  }

  const repoSummaries = cohort.map(repo => {
    const rows = repoRows.filter(row => row.repo === repo);
    const uniqueAuthors = new Set(rows.map(row => row.authorLogin)).size;
    const humanAuthors = new Set(rows.filter(row => !row.botAuthor).map(row => row.authorLogin));
    const humanRows = humanContributorRows.filter(row => row.repo === repo);
    const humansWithLocation = new Set(humanRows.filter(row => row.location).map(row => row.authorLogin));
    const bayAreaAuthors = new Set(humanRows.filter(row => row.bayAreaMatch).map(row => row.authorLogin));
    const repoMeta = repoMetaByName[repo] || {};

    return {
      repo,
      totalPrs: rows.length,
      uniqueAuthors,
      humanPrs: rows.filter(row => !row.botAuthor).length,
      botPrs: rows.filter(row => row.botAuthor).length,
      bodyAttributedPrs: rows.filter(row => row.bodyAttributedPr).length,
      loginAttributedPrs: rows.filter(row => row.loginAttributedPr).length,
      agentSignalPrs: rows.filter(row => row.agentSignalPr).length,
      humanAuthors: humanAuthors.size,
      humanAuthorsWithLocation: humansWithLocation.size,
      bayAreaAuthors: bayAreaAuthors.size,
      stars: repoMeta.stars || 0,
      forks: repoMeta.forks || 0,
      license: repoMeta.license || '',
      pushedAt: repoMeta.pushedAt || '',
      htmlUrl: repoMeta.htmlUrl || `https://github.com/${repo}`,
    };
  });

  const uniqueAuthors = new Set(repoRows.map(row => row.authorLogin)).size;
  const humanAuthors = new Set(
    repoRows.filter(row => !row.botAuthor).map(row => row.authorLogin)
  ).size;
  const humanAuthorsWithLocation = new Set(
    humanContributorRows.filter(row => row.location).map(row => row.authorLogin)
  ).size;
  const bayAreaAuthors = new Set(
    humanContributorRows.filter(row => row.bayAreaMatch).map(row => row.authorLogin)
  ).size;

  const topAuthors = Array.from(authorMap.values()).sort((left, right) => {
    if (right.prCount !== left.prCount) {
      return right.prCount - left.prCount;
    }
    return left.authorLogin.localeCompare(right.authorLogin);
  });

  const topLocations = topLocationRows(humanContributorRows);

  return {
    generatedAt: new Date().toISOString(),
    cohort,
    limitPerRepo,
    dateWindow,
    summary: {
      totalPrs,
      uniqueAuthors,
      humanPrs,
      botPrs,
      bodyAttributedPrs,
      loginAttributedPrs,
      agentSignalPrs,
      humanAuthors,
      humanAuthorsWithLocation,
      bayAreaAuthors,
      locationCoveragePct: humanAuthors > 0
        ? Math.round((humanAuthorsWithLocation / humanAuthors) * 100)
        : 0,
    },
    repoSummaries,
    topLocations,
    topAuthors,
    agentSignalPrs: repoRows.filter(row => row.agentSignalPr),
    repoRows,
  };
}

function buildWindowComparison({ cohort, limitPerRepo, repoMetaByName, windowReports }) {
  const allRepoRows = [];
  const windows = windowReports.map(({ label, report }) => {
    const repoSummaries = report.repoSummaries.map(summary => ({
      ...summary,
      prPerDay: report.dateWindow && report.dateWindow.dayCount
        ? Number((summary.totalPrs / report.dateWindow.dayCount).toFixed(1))
        : summary.totalPrs,
      botSharePct: summary.totalPrs
        ? Math.round((summary.botPrs / summary.totalPrs) * 100)
        : 0,
      bodySharePct: summary.totalPrs
        ? Math.round((summary.bodyAttributedPrs / summary.totalPrs) * 100)
        : 0,
      loginSharePct: summary.totalPrs
        ? Math.round((summary.loginAttributedPrs / summary.totalPrs) * 100)
        : 0,
      agentSharePct: summary.totalPrs
        ? Math.round((summary.agentSignalPrs / summary.totalPrs) * 100)
        : 0,
    })).sort((left, right) => {
      if (right.totalPrs !== left.totalPrs) {
        return right.totalPrs - left.totalPrs;
      }
      return left.repo.localeCompare(right.repo);
    });

    const rows = report.repoRows.map(row => ({
      ...row,
      windowLabel: label,
      dateRangeLabel: report.dateWindow
        ? (report.dateWindow.rangeLabel || report.dateWindow.label)
        : label,
    }));
    allRepoRows.push(...rows);
    const bodyRows = rows.filter(row => row.bodyAttributedPr);

    return {
      label,
      dateRangeLabel: report.dateWindow
        ? (report.dateWindow.rangeLabel || report.dateWindow.label)
        : label,
      dateFrom: report.dateWindow ? report.dateWindow.dateFrom : '',
      dateTo: report.dateWindow ? report.dateWindow.dateTo : '',
      dayCount: report.dateWindow ? report.dateWindow.dayCount : null,
      totalPrs: report.summary.totalPrs,
      uniqueAuthors: report.summary.uniqueAuthors,
      humanPrs: report.summary.humanPrs,
      botPrs: report.summary.botPrs,
      bodyAttributedPrs: report.summary.bodyAttributedPrs,
      loginAttributedPrs: report.summary.loginAttributedPrs,
      agentSignalPrs: report.summary.agentSignalPrs,
      prPerDay: report.dateWindow && report.dateWindow.dayCount
        ? Number((report.summary.totalPrs / report.dateWindow.dayCount).toFixed(1))
        : report.summary.totalPrs,
      botSharePct: report.summary.totalPrs
        ? Math.round((report.summary.botPrs / report.summary.totalPrs) * 100)
        : 0,
      bodySharePct: report.summary.totalPrs
        ? Math.round((report.summary.bodyAttributedPrs / report.summary.totalPrs) * 100)
        : 0,
      loginSharePct: report.summary.totalPrs
        ? Math.round((report.summary.loginAttributedPrs / report.summary.totalPrs) * 100)
        : 0,
      agentSharePct: report.summary.totalPrs
        ? Math.round((report.summary.agentSignalPrs / report.summary.totalPrs) * 100)
        : 0,
      bodyVendorTotals: countSignalLabels(bodyRows, row => row.bodyAgentSignals),
      topRepo: repoSummaries[0] || null,
      repoSummaries,
    };
  });

  const firstWindow = windows[0] || null;
  const lastWindow = windows[windows.length - 1] || null;
  const repoComparisons = cohort.map(repo => {
    const windowStats = windows.map(window => {
      const found = window.repoSummaries.find(summary => summary.repo === repo);
      if (found) {
        return found;
      }

      const repoMeta = repoMetaByName[repo] || {};
      return {
        repo,
        totalPrs: 0,
        uniqueAuthors: 0,
        humanPrs: 0,
        botPrs: 0,
        bodyAttributedPrs: 0,
        loginAttributedPrs: 0,
        agentSignalPrs: 0,
        prPerDay: 0,
        botSharePct: 0,
        bodySharePct: 0,
        loginSharePct: 0,
        agentSharePct: 0,
        stars: repoMeta.stars || 0,
        forks: repoMeta.forks || 0,
        license: repoMeta.license || '',
        pushedAt: repoMeta.pushedAt || '',
        htmlUrl: repoMeta.htmlUrl || `https://github.com/${repo}`,
      };
    });

    const anchorStart = windowStats[0] || null;
    const anchorEnd = windowStats[windowStats.length - 1] || null;
    const totalPrs = windowStats.reduce((sum, stat) => sum + stat.totalPrs, 0);

    return {
      repo,
      htmlUrl: (repoMetaByName[repo] && repoMetaByName[repo].htmlUrl) || `https://github.com/${repo}`,
      stars: (repoMetaByName[repo] && repoMetaByName[repo].stars) || 0,
      totalPrs,
      windowStats,
      anchorPrDelta: anchorEnd && anchorStart ? anchorEnd.totalPrs - anchorStart.totalPrs : 0,
      anchorPrDeltaPct: anchorEnd && anchorStart && anchorStart.totalPrs
        ? Math.round(((anchorEnd.totalPrs - anchorStart.totalPrs) / anchorStart.totalPrs) * 100)
        : 0,
    };
  }).sort((left, right) => {
    if (right.totalPrs !== left.totalPrs) {
      return right.totalPrs - left.totalPrs;
    }
    return left.repo.localeCompare(right.repo);
  });

  const repoBodyTotals = repoComparisons.map(row => ({
    repo: row.repo,
    bodyAttributedPrs: row.windowStats.reduce((sum, stat) => sum + stat.bodyAttributedPrs, 0),
  })).sort((left, right) => {
    if (right.bodyAttributedPrs !== left.bodyAttributedPrs) {
      return right.bodyAttributedPrs - left.bodyAttributedPrs;
    }
    return left.repo.localeCompare(right.repo);
  });
  const bodyVendorTotals = countSignalLabels(
    allRepoRows.filter(row => row.bodyAttributedPr),
    row => row.bodyAgentSignals
  );
  const activeVendors = AGENT_KEYWORDS
    .map(keyword => keyword.label)
    .filter(label => bodyVendorTotals.some(item => item.label === label));

  return {
    type: 'windowComparison',
    generatedAt: new Date().toISOString(),
    cohort,
    limitPerRepo,
    windows,
    summary: {
      totalPrs: allRepoRows.length,
      uniqueAuthors: new Set(allRepoRows.map(row => row.authorLogin)).size,
      botPrs: allRepoRows.filter(row => row.botAuthor).length,
      bodyAttributedPrs: allRepoRows.filter(row => row.bodyAttributedPr).length,
      loginAttributedPrs: allRepoRows.filter(row => row.loginAttributedPr).length,
      agentSignalPrs: allRepoRows.filter(row => row.agentSignalPr).length,
    },
    repoComparisons,
    repoBodyTotals,
    activeVendors,
    bodyVendorTotals,
    botAuthors: countByLabel(
      allRepoRows.filter(row => row.botAuthor),
      row => row.authorLogin
    ),
    agentSignalPrs: allRepoRows
      .filter(row => row.agentSignalPr)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    anchorComparison: firstWindow && lastWindow
      ? {
          startLabel: firstWindow.label,
          endLabel: lastWindow.label,
          totalPrDelta: lastWindow.totalPrs - firstWindow.totalPrs,
          totalPrDeltaPct: firstWindow.totalPrs
            ? Math.round(((lastWindow.totalPrs - firstWindow.totalPrs) / firstWindow.totalPrs) * 100)
            : 0,
          bodyShareDeltaPct: lastWindow.bodySharePct - firstWindow.bodySharePct,
          loginShareDeltaPct: lastWindow.loginSharePct - firstWindow.loginSharePct,
          botShareDeltaPct: lastWindow.botSharePct - firstWindow.botSharePct,
        }
      : null,
  };
}

async function exploreCohort({ repos, limitPerRepo, token, dateWindow, fetchProfiles = true, repoMetaByName: providedRepoMeta }) {
  const profileCache = fetchProfiles ? loadCache(PROFILE_CACHE_FILE) : {};
  const repoRows = [];
  const humanContributorRows = [];
  const repoMetaByName = providedRepoMeta || {};

  for (const repo of repos) {
    console.log(`Sampling ${repo}...`);
    if (!repoMetaByName[repo]) {
      repoMetaByName[repo] = await fetchRepoMetadata(repo, token);
    }
    const prs = await fetchRepoPullRequests(repo, limitPerRepo, token, dateWindow);

    const seenHumans = new Set();

    for (const pr of prs) {
      const classification = classifyPullRequest(pr);
      const row = {
        repo,
        number: pr.number,
        title: cleanText(pr.title),
        body: cleanText(pr.body),
        htmlUrl: cleanText(pr.html_url),
        createdAt: cleanText(pr.created_at),
        authorLogin: classification.authorLogin,
        authorType: classification.authorType,
        botAuthor: classification.botAuthor,
        bodyAttributedPr: classification.bodyAttributedPr,
        loginAttributedPr: classification.loginAttributedPr,
        attributionSources: classification.attributionSources,
        bodyAgentSignals: classification.bodyAgentSignals,
        loginAgentSignals: classification.loginAgentSignals,
        agentSignalPr: classification.agentSignalPr,
        agentSignals: classification.agentSignals,
      };
      repoRows.push(row);

      if (
        !fetchProfiles ||
        classification.botAuthor ||
        !classification.authorLogin ||
        seenHumans.has(classification.authorLogin)
      ) {
        continue;
      }

      seenHumans.add(classification.authorLogin);
      const profile = await fetchProfile(classification.authorLogin, token, profileCache);
      humanContributorRows.push({
        repo,
        authorLogin: classification.authorLogin,
        authorType: profile.type,
        location: profile.location,
        bayAreaMatch: detectBayArea(profile.location),
        company: profile.company,
        profileUrl: profile.profileUrl,
      });
    }
  }

  if (fetchProfiles) {
    saveCache(PROFILE_CACHE_FILE, profileCache);
  }

  return buildReport({
    cohort: repos,
    limitPerRepo,
    dateWindow,
    repoMetaByName,
    repoRows,
    humanContributorRows,
  });
}

async function main() {
  const parsed = parseArgs(process.argv);
  if (parsed.help) {
    console.log(usage());
    return;
  }

  const token = process.env.GITHUB_TOKEN || '';
  if (!token) {
    console.warn('Warning: GITHUB_TOKEN is not set. API rate limits may be low.');
  }
  let report;

  if (parsed.windows.length) {
    const repoMetaByName = await fetchRepoMetadataMap(parsed.repos, token);
    const windowReports = [];

    for (const window of parsed.windows) {
      console.log(`Sampling window ${window.label} (${window.dateFrom} to ${window.dateTo})...`);
      const singleWindowReport = await exploreCohort({
        repos: parsed.repos,
        limitPerRepo: parsed.limitPerRepo,
        token,
        dateWindow: window,
        fetchProfiles: !parsed.skipProfiles,
        repoMetaByName,
      });
      windowReports.push({ label: window.label, report: singleWindowReport });
    }

    report = buildWindowComparison({
      cohort: parsed.repos,
      limitPerRepo: parsed.limitPerRepo,
      repoMetaByName,
      windowReports,
    });
  } else {
    const dateWindow = normalizeDateWindow(parsed.dateFrom, parsed.dateTo);
    report = await exploreCohort({
      repos: parsed.repos,
      limitPerRepo: parsed.limitPerRepo,
      token,
      dateWindow,
      fetchProfiles: !parsed.skipProfiles,
    });
  }

  fs.mkdirSync(path.dirname(parsed.outJson), { recursive: true });
  fs.writeFileSync(parsed.outJson, JSON.stringify(report, null, 2));
  fs.mkdirSync(path.dirname(parsed.outHtml), { recursive: true });
  fs.writeFileSync(parsed.outHtml, renderHtml(report));

  console.log(`Saved JSON to ${parsed.outJson}`);
  console.log(`Saved HTML to ${parsed.outHtml}`);
  console.log(`${formatCount(report.summary.totalPrs)} PRs across ${formatCount(report.cohort.length)} repos`);
  if (report.type === 'windowComparison') {
    console.log(`${formatCount(report.summary.botPrs)} bot-opened PRs across ${formatCount(report.windows.length)} windows`);
    console.log(`${formatCount(report.summary.bodyAttributedPrs)} PRs had explicit body attribution`);
    console.log(`${formatCount(report.summary.loginAttributedPrs)} PRs had login-based attribution`);
  } else {
    console.log(`${formatCount(report.summary.humanAuthorsWithLocation)} of ${formatCount(report.summary.humanAuthors)} human authors publish a location`);
    console.log(`${formatCount(report.summary.agentSignalPrs)} PRs had visible agent signals`);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  AGENT_KEYWORDS,
  AUTOMATION_LOGIN_HINTS,
  BAY_AREA_PATTERN,
  buildReport,
  buildWindowComparison,
  classifyPullRequest,
  countDaysInclusive,
  detectBayArea,
  extractAgentSignals,
  fetchRepoPullRequests,
  isBotAuthor,
  isPullRequestInWindow,
  normalizeDateWindow,
  normalizeLocation,
  parseArgs,
  parseWindowSpec,
  renderHtml,
};
