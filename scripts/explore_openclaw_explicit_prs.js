#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

const DEFAULT_SAMPLE_SIZE = 50;
const DEFAULT_PER_QUERY = 25;
const DEFAULT_MANUAL_REVIEW_LIMIT = 20;
const DEFAULT_OUT_JSON = 'output/openclaw-explicit-pr-sample.json';
const DEFAULT_OUT_HTML = 'output/openclaw-explicit-pr-sample.html';

const EXPLICIT_PR_QUERIES = [
  {
    id: 'generated-with-openclaw',
    label: 'Generated with OpenClaw',
    query: '"generated with openclaw" type:pr is:public',
  },
  {
    id: 'built-with-openclaw',
    label: 'Built with OpenClaw',
    query: '"built with openclaw" type:pr is:public',
  },
  {
    id: 'created-with-openclaw',
    label: 'Created with OpenClaw',
    query: '"created with openclaw" type:pr is:public',
  },
  {
    id: 'authored-by-openclaw',
    label: 'Authored by OpenClaw',
    query: '"authored by openclaw" type:pr is:public',
  },
];

const CATEGORY_RULES = [
  {
    label: 'plugin/add-on',
    patterns: [
      /\b(plugin|plugins|extension|extensions|addon|add-on|adapter|connector|integration|sdk|skill|skills|module|package)\b/i,
      /\bhome assistant\b/i,
      /\bmcp server\b/i,
    ],
  },
  {
    label: 'agent infra',
    patterns: [
      /\b(openclaw|agent|agents|gateway|orchestrat|workflow|automation|memory|runbook|onboard|self-hosted assistant|platform|framework|tooling|dashboard|control plane|cli)\b/i,
      /\bskills?\s+(library|collection|registry)\b/i,
    ],
  },
  {
    label: 'app repo',
    patterns: [
      /\b(app|application|website|web app|mobile app|ios app|android app|dashboard|site|product|service|client|server|chat app|game|studio)\b/i,
      /\bfull-stack\b/i,
    ],
  },
];

function usage() {
  return [
    'Usage: node scripts/explore_openclaw_explicit_prs.js [options]',
    '',
    'Options:',
    `  --sample-size <n>    Number of unique PRs to classify (default: ${DEFAULT_SAMPLE_SIZE})`,
    `  --per-query <n>      Search results to fetch per explicit query (default: ${DEFAULT_PER_QUERY})`,
    `  --manual-review-limit <n>  Ambiguous repos to highlight (default: ${DEFAULT_MANUAL_REVIEW_LIMIT})`,
    '  --date-from <date>   Inclusive PR created date in YYYY-MM-DD',
    '  --date-to <date>     Inclusive PR created date in YYYY-MM-DD',
    '  --exclude-repos <a,b>  Comma-separated repos to exclude from the sampled PR set',
    `  --out-json <path>    JSON output path (default: ${DEFAULT_OUT_JSON})`,
    `  --out-html <path>    HTML output path (default: ${DEFAULT_OUT_HTML})`,
  ].join('\n');
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const parsed = {
    help: false,
    sampleSize: DEFAULT_SAMPLE_SIZE,
    perQuery: DEFAULT_PER_QUERY,
    manualReviewLimit: DEFAULT_MANUAL_REVIEW_LIMIT,
    dateFrom: '',
    dateTo: '',
    excludeRepos: [],
    outJson: DEFAULT_OUT_JSON,
    outHtml: DEFAULT_OUT_HTML,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }

    if (arg === '--sample-size') {
      parsed.sampleSize = Math.max(1, Math.min(100, parseInt(args[index + 1], 10)));
      index += 1;
      continue;
    }

    if (arg === '--per-query') {
      parsed.perQuery = Math.max(1, Math.min(100, parseInt(args[index + 1], 10)));
      index += 1;
      continue;
    }

    if (arg === '--manual-review-limit') {
      parsed.manualReviewLimit = Math.max(1, Math.min(50, parseInt(args[index + 1], 10)));
      index += 1;
      continue;
    }

    if (arg === '--date-from') {
      parsed.dateFrom = cleanText(args[index + 1]);
      index += 1;
      continue;
    }

    if (arg === '--date-to') {
      parsed.dateTo = cleanText(args[index + 1]);
      index += 1;
      continue;
    }

    if (arg === '--exclude-repos') {
      parsed.excludeRepos = cleanText(args[index + 1]).split(',').map(item => cleanText(item)).filter(Boolean);
      index += 1;
      continue;
    }

    if (arg === '--out-json') {
      parsed.outJson = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--out-html') {
      parsed.outHtml = args[index + 1];
      index += 1;
      continue;
    }

    throw new Error(usage());
  }

  return parsed;
}

function cleanText(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
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
    dateFrom: from,
    dateTo: to,
    label: `${from || 'start'} to ${to || 'present'}`,
    query: `created:${from || '*'}..${to || '*'}`,
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

function formatCount(value) {
  return new Intl.NumberFormat('en-US').format(value || 0);
}

function formatDate(value) {
  return cleanText(value).slice(0, 10) || '—';
}

function encodePathSegment(value) {
  return cleanText(value).split('/').map(segment => encodeURIComponent(segment)).join('/');
}

function requestJson(apiPath, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: apiPath,
      headers: {
        'User-Agent': 'gh-pr-map-openclaw-explicit-prs',
        'Accept': 'application/vnd.github.text-match+json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };

    https.get(options, response => {
      let data = '';
      response.on('data', chunk => {
        data += chunk;
      });
      response.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          const error = new Error(`Failed to parse JSON from ${apiPath}: ${data.slice(0, 160)}`);
          error.statusCode = response.statusCode || 500;
          reject(error);
          return;
        }

        if ((response.statusCode || 0) >= 400) {
          const error = new Error(`GitHub API ${response.statusCode}: ${parsed.message || 'Unknown error'}`);
          error.statusCode = response.statusCode || 500;
          reject(error);
          return;
        }

        resolve(parsed);
      });
    }).on('error', reject);
  });
}

async function ghGet(apiPath, token) {
  return requestJson(apiPath, token);
}

async function ghGetOptional(apiPath, token) {
  try {
    return await ghGet(apiPath, token);
  } catch (error) {
    if (error && error.statusCode === 404) {
      return null;
    }
    throw error;
  }
}

async function fetchUrlText(url) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
      headers: {
        'User-Agent': 'gh-pr-map-openclaw-explicit-prs',
      },
    };

    https.get(options, response => {
      let data = '';
      response.on('data', chunk => {
        data += chunk;
      });
      response.on('end', () => {
        if ((response.statusCode || 0) >= 400) {
          reject(new Error(`HTTP ${response.statusCode} while fetching ${url}`));
          return;
        }
        resolve(data);
      });
    }).on('error', reject);
  });
}

async function decodeContentFile(file) {
  if (!file) {
    return '';
  }

  if (file.content) {
    return Buffer.from(file.content, file.encoding || 'base64').toString('utf8');
  }

  if (file.download_url) {
    return fetchUrlText(file.download_url);
  }

  return '';
}

function extractRepoFromApiUrl(apiUrl) {
  const match = cleanText(apiUrl).match(/\/repos\/([^/]+\/[^/]+)$/);
  return match ? match[1] : '';
}

async function searchExplicitPullRequests(spec, perQuery, token) {
  const apiPath = `/search/issues?q=${encodeURIComponent(spec.query)}&sort=updated&order=desc&per_page=${perQuery}`;
  return ghGet(apiPath, token);
}

function dedupePullRequests(queryResults, sampleSize) {
  const byUrl = new Map();

  for (const queryResult of queryResults) {
    for (const item of queryResult.items) {
      const prUrl = cleanText(item.html_url);
      if (!prUrl) {
        continue;
      }

      if (!byUrl.has(prUrl)) {
        byUrl.set(prUrl, {
          htmlUrl: prUrl,
          title: cleanText(item.title),
          repo: extractRepoFromApiUrl(item.repository_url),
          authorLogin: cleanText(item.user && item.user.login),
          updatedAt: cleanText(item.updated_at),
          body: cleanText(item.body),
          number: item.number || null,
          matchedQueries: [],
        });
      }

      byUrl.get(prUrl).matchedQueries.push(queryResult.label);
    }
  }

  return Array.from(byUrl.values())
    .map(row => ({
      ...row,
      matchedQueries: Array.from(new Set(row.matchedQueries)).sort(),
    }))
    .sort((left, right) => {
      const leftTime = Date.parse(left.updatedAt || 0);
      const rightTime = Date.parse(right.updatedAt || 0);
      return rightTime - leftTime;
    })
    .slice(0, sampleSize);
}

async function fetchRepoMetadata(repo, token) {
  const metadata = await ghGet(`/repos/${repo}`, token);
  return {
    repo,
    htmlUrl: cleanText(metadata.html_url),
    description: cleanText(metadata.description),
    homepage: cleanText(metadata.homepage),
    language: cleanText(metadata.language),
    stars: metadata.stargazers_count || 0,
    forks: metadata.forks_count || 0,
    topics: Array.isArray(metadata.topics) ? metadata.topics.map(item => cleanText(item)).filter(Boolean) : [],
    pushedAt: cleanText(metadata.pushed_at),
  };
}

async function fetchReadme(repo, token) {
  const readme = await ghGetOptional(`/repos/${repo}/readme`, token);
  if (!readme) {
    return { path: '', htmlUrl: '', text: '' };
  }

  return {
    path: cleanText(readme.path),
    htmlUrl: cleanText(readme.html_url),
    text: await decodeContentFile(readme),
  };
}

function gatherCategoryEvidence(text, patterns) {
  const matches = [];
  for (const pattern of patterns) {
    const found = cleanText(text).match(pattern);
    if (found && found[0]) {
      matches.push(cleanText(found[0]));
    }
  }
  return Array.from(new Set(matches));
}

function classifyRepo(repoContext) {
  const surfaceText = [
    repoContext.repo,
    repoContext.metadata.description,
    repoContext.metadata.homepage,
    repoContext.metadata.topics.join(' '),
  ].filter(Boolean).join('\n');
  const readmeText = cleanText(repoContext.readme.text).slice(0, 8000);
  const combined = [surfaceText, readmeText].filter(Boolean).join('\n');

  const evidence = CATEGORY_RULES.map(rule => {
    const surfaceMatches = gatherCategoryEvidence(surfaceText, rule.patterns);
    const readmeMatches = gatherCategoryEvidence(readmeText, rule.patterns);
    return {
      label: rule.label,
      surfaceMatches,
      readmeMatches,
      matches: Array.from(new Set([...surfaceMatches, ...readmeMatches])),
      score: (surfaceMatches.length * 3) + readmeMatches.length,
    };
  });

  const evidenceByLabel = new Map(evidence.map(item => [item.label, item]));
  const pluginEvidence = evidenceByLabel.get('plugin/add-on');
  const infraEvidence = evidenceByLabel.get('agent infra');
  const appEvidence = evidenceByLabel.get('app repo');

  const ranked = evidence
    .filter(item => item.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.label.localeCompare(right.label);
    });

  let label = ranked.length ? ranked[0].label : 'unclear';
  const topScore = ranked[0]?.score || 0;
  const secondScore = ranked[1]?.score || 0;
  const scoreGap = topScore - secondScore;

  if (
    label === 'plugin/add-on' &&
    infraEvidence.score >= pluginEvidence.score &&
    /(?:platform|gateway|self-hosted assistant|control plane|framework|orchestrat|automation|memory)/i.test(combined)
  ) {
    label = 'agent infra';
  }

  const ambiguous = label === 'unclear' || topScore <= 3 || scoreGap <= 1;

  const rationale = [];
  if (label === 'plugin/add-on' && pluginEvidence.matches.length) {
    rationale.push(`Matched plugin/add-on terms: ${pluginEvidence.matches.slice(0, 4).join(', ')}`);
  }
  if (label === 'agent infra' && infraEvidence.matches.length) {
    rationale.push(`Matched agent infra terms: ${infraEvidence.matches.slice(0, 4).join(', ')}`);
  }
  if (label === 'app repo' && appEvidence.matches.length) {
    rationale.push(`Matched app-style terms: ${appEvidence.matches.slice(0, 4).join(', ')}`);
  }
  if (!rationale.length && ranked.length) {
    rationale.push(`Weak mixed evidence across categories; closest match was ${ranked[0].label}.`);
  }
  if (!rationale.length) {
    rationale.push('No strong keyword evidence from repo name, description, topics, or README sample.');
  }

  return {
    label,
    topScore,
    secondScore,
    scoreGap,
    ambiguous,
    evidence,
    rationale,
  };
}

function buildRepoCounts(repoRows) {
  const counts = new Map();

  for (const row of repoRows) {
    const bucket = counts.get(row.classification.label) || { label: row.classification.label, repoCount: 0, prCount: 0 };
    bucket.repoCount += 1;
    bucket.prCount += row.prCount;
    counts.set(row.classification.label, bucket);
  }

  return Array.from(counts.values()).sort((left, right) => {
    if (right.prCount !== left.prCount) {
      return right.prCount - left.prCount;
    }
    return left.label.localeCompare(right.label);
  });
}

function buildTopRepos(prRows) {
  const counts = new Map();

  for (const pr of prRows) {
    const bucket = counts.get(pr.repo) || { repo: pr.repo, count: 0 };
    bucket.count += 1;
    counts.set(pr.repo, bucket);
  }

  return Array.from(counts.values())
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.repo.localeCompare(right.repo);
    })
    .slice(0, 12);
}

function buildSummary(queryResults, prRows, repoRows) {
  const categoryCounts = buildRepoCounts(repoRows);
  const manualReviewCount = repoRows.filter(row => row.classification.ambiguous).length;

  return {
    queryCount: queryResults.length,
    rawHits: queryResults.reduce((sum, query) => sum + query.totalCount, 0),
    sampledPrs: prRows.length,
    uniqueRepos: repoRows.length,
    manualReviewCount,
    categoryCounts,
    topRepos: buildTopRepos(prRows),
  };
}

function buildInterpretation(summary) {
  const notes = [];
  const dominant = summary.categoryCounts[0];

  if (dominant) {
    notes.push(`In this explicit-PR sample, the largest bucket is ${dominant.label} with ${formatCount(dominant.prCount)} of ${formatCount(summary.sampledPrs)} sampled PRs.`);
  }

  const appBucket = summary.categoryCounts.find(item => item.label === 'app repo');
  if (appBucket && appBucket.prCount > 0) {
    notes.push(`There are explicit OpenClaw PRs landing in user-facing app repos, so OpenClaw does appear to participate in app-building, not just tooling.`);
  }

  const infraBucket = summary.categoryCounts.find(item => item.label === 'agent infra');
  if (infraBucket && infraBucket.prCount > 0) {
    notes.push('Agent infrastructure repos remain a major share of the explicit sample, which supports the theory that OpenClaw is often the system around coding work rather than only the direct generator.');
  }

  const pluginBucket = summary.categoryCounts.find(item => item.label === 'plugin/add-on');
  if (pluginBucket && pluginBucket.prCount > 0) {
    notes.push('A meaningful plugin/add-on bucket suggests a lot of visible OpenClaw activity happens through integrations, skills, and ecosystem packages.');
  }

  if (summary.manualReviewCount > 0) {
    notes.push(`${formatCount(summary.manualReviewCount)} repos in the sample still look ambiguous enough to justify manual review.`);
  }

  if (!notes.length) {
    notes.push('The sample did not surface enough stable structure to interpret confidently.');
  }

  return notes;
}

function buildManualReviewRows(repoRows, limit) {
  return repoRows
    .filter(row => row.classification.ambiguous)
    .sort((left, right) => {
      if (left.classification.scoreGap !== right.classification.scoreGap) {
        return left.classification.scoreGap - right.classification.scoreGap;
      }
      if (left.classification.topScore !== right.classification.topScore) {
        return left.classification.topScore - right.classification.topScore;
      }
      return right.prCount - left.prCount;
    })
    .slice(0, limit);
}

function renderHtml(report) {
  const cards = [
    ['Explicit queries', formatCount(report.summary.queryCount)],
    ['Raw hits', formatCount(report.summary.rawHits)],
    ['Sampled PRs', formatCount(report.summary.sampledPrs)],
    ['Unique repos', formatCount(report.summary.uniqueRepos)],
    ['Manual review repos', formatCount(report.summary.manualReviewCount)],
  ];

  const categoryRows = report.summary.categoryCounts.map(row => `
    <tr>
      <td>${escapeHtml(row.label)}</td>
      <td>${formatCount(row.repoCount)}</td>
      <td>${formatCount(row.prCount)}</td>
    </tr>
  `).join('');

  const prRows = report.prs.map(row => `
    <tr>
      <td><a href="${escapeHtml(row.htmlUrl)}">${escapeHtml(row.title || 'untitled PR')}</a></td>
      <td>${escapeHtml(row.repo)}</td>
      <td>${escapeHtml(row.authorLogin || 'unknown')}</td>
      <td>${escapeHtml(row.repoCategory)}</td>
      <td>${escapeHtml(row.matchedQueries.join(', '))}</td>
      <td>${escapeHtml(formatDate(row.updatedAt))}</td>
    </tr>
  `).join('');

  const repoCards = report.repos.map(row => `
    <article class="repo-card">
      <div class="repo-top">
        <div>
          <h3><a href="${escapeHtml(row.metadata.htmlUrl)}">${escapeHtml(row.repo)}</a></h3>
          <p class="muted">${escapeHtml(row.metadata.description || 'No description')}</p>
        </div>
        <span class="badge">${escapeHtml(row.classification.label)}</span>
      </div>
      <p class="muted">Sample PRs: ${formatCount(row.prCount)} · Stars: ${formatCount(row.metadata.stars)} · Updated: ${escapeHtml(formatDate(row.metadata.pushedAt))}</p>
      <ul class="rationale">
        ${row.classification.rationale.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
      </ul>
    </article>
  `).join('');

  const manualReviewRows = report.manualReview.map(row => `
    <tr>
      <td><a href="${escapeHtml(row.metadata.htmlUrl)}">${escapeHtml(row.repo)}</a></td>
      <td>${escapeHtml(row.classification.label)}</td>
      <td>${escapeHtml(String(row.classification.topScore))}</td>
      <td>${escapeHtml(String(row.classification.scoreGap))}</td>
      <td>${formatCount(row.prCount)}</td>
      <td>${escapeHtml(row.classification.rationale[0] || '')}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenClaw Explicit PR Sample</title>
  <style>
    :root {
      --bg: #eef3f0;
      --ink: #15221b;
      --muted: #546259;
      --panel: rgba(255,255,255,0.92);
      --line: rgba(21,34,27,0.12);
      --accent: #0f766e;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Georgia, "Palatino Linotype", serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top right, rgba(15,118,110,0.14), transparent 30%),
        linear-gradient(180deg, #f9fcfb 0%, var(--bg) 100%);
    }
    main {
      max-width: 1220px;
      margin: 0 auto;
      padding: 48px 24px 72px;
    }
    .hero, .panel, .repo-card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 22px;
      box-shadow: 0 16px 40px rgba(21,34,27,0.06);
    }
    .hero, .panel {
      padding: 28px;
    }
    .eyebrow {
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 12px;
      margin-bottom: 10px;
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 14px;
      margin-top: 24px;
    }
    .card {
      padding: 18px;
      border-radius: 16px;
      background: rgba(15,118,110,0.08);
    }
    .card-label {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .card-value {
      margin-top: 8px;
      font-size: 32px;
      font-weight: 700;
    }
    .layout {
      display: grid;
      grid-template-columns: 0.95fr 1.05fr;
      gap: 18px;
      margin-top: 18px;
    }
    h1, h2, h3 { margin: 0; line-height: 1.1; }
    p, li { line-height: 1.5; }
    .muted { color: var(--muted); }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      font-size: 14px;
    }
    th, td {
      text-align: left;
      padding: 10px 8px;
      border-top: 1px solid var(--line);
      vertical-align: top;
    }
    th {
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 12px;
      border-top: none;
    }
    .notes {
      display: grid;
      gap: 10px;
      margin-top: 14px;
    }
    .note {
      padding: 12px 14px;
      border-radius: 14px;
      background: rgba(15,118,110,0.1);
    }
    .repo-grid {
      display: grid;
      gap: 14px;
      margin-top: 18px;
    }
    .repo-card {
      padding: 18px;
    }
    .repo-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 14px;
    }
    .repo-card a { color: var(--accent); text-decoration: none; }
    .badge {
      white-space: nowrap;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(15,118,110,0.12);
      color: var(--accent);
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .rationale {
      margin: 12px 0 0;
      padding-left: 18px;
    }
    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <div class="eyebrow">OpenClaw Explicit PR Sample</div>
      <h1>What Kinds Of Repos Show Up Behind Explicit OpenClaw Pull Requests?</h1>
      <p class="muted">
        Generated on ${escapeHtml(report.generatedAt)} from ${formatCount(report.summary.queryCount)} explicit query templates.
        This is a sampled classification pass over the most recent deduped PR hits, not a complete census.
      </p>
      <p class="muted">Window: ${escapeHtml(report.dateWindow ? report.dateWindow.label : 'all available dates')}</p>
      <div class="cards">
        ${cards.map(([label, value]) => `
          <article class="card">
            <div class="card-label">${escapeHtml(label)}</div>
            <div class="card-value">${escapeHtml(value)}</div>
          </article>
        `).join('')}
      </div>
    </section>

    <section class="layout">
      <article class="panel">
        <h2>Quick Read</h2>
        <div class="notes">
          ${report.interpretation.map(note => `<div class="note">${escapeHtml(note)}</div>`).join('')}
        </div>
        <h2 style="margin-top:22px;">Category Counts</h2>
        <table>
          <thead>
            <tr>
              <th>Repo type</th>
              <th>Repos</th>
              <th>PRs</th>
            </tr>
          </thead>
          <tbody>${categoryRows}</tbody>
        </table>
      </article>
      <article class="panel">
        <h2>Sampled PRs</h2>
        <table>
          <thead>
            <tr>
              <th>PR</th>
              <th>Repo</th>
              <th>Author</th>
              <th>Repo type</th>
              <th>Matched query</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>${prRows}</tbody>
        </table>
      </article>
    </section>

    <section class="panel" style="margin-top:18px;">
      <h2>Repo Classification Cards</h2>
      <div class="repo-grid">${repoCards}</div>
    </section>

    <section class="panel" style="margin-top:18px;">
      <h2>Manual Review Queue</h2>
      <p class="muted">These repos have low-confidence or mixed keyword evidence and are the best candidates for a quick human pass.</p>
      <table>
        <thead>
          <tr>
            <th>Repo</th>
            <th>Current bucket</th>
            <th>Top score</th>
            <th>Score gap</th>
            <th>PRs</th>
            <th>Why review</th>
          </tr>
        </thead>
        <tbody>${manualReviewRows || '<tr><td colspan="6">No manual-review candidates in this sample.</td></tr>'}</tbody>
      </table>
    </section>
  </main>
</body>
</html>`;
}

async function buildReport(options) {
  const token = cleanText(options.token || process.env.GITHUB_TOKEN);
  const perQuery = options.perQuery || DEFAULT_PER_QUERY;
  const sampleSize = options.sampleSize || DEFAULT_SAMPLE_SIZE;
  const manualReviewLimit = options.manualReviewLimit || DEFAULT_MANUAL_REVIEW_LIMIT;
  const excludedRepos = new Set((options.excludeRepos || []).map(item => cleanText(item)).filter(Boolean));
  const dateWindow = normalizeDateWindow(options.dateFrom, options.dateTo);

  const rawQueryResults = [];
  for (const spec of EXPLICIT_PR_QUERIES) {
    const query = dateWindow ? `${spec.query} ${dateWindow.query}` : spec.query;
    const response = await searchExplicitPullRequests({ ...spec, query }, perQuery, token);
    rawQueryResults.push({
      ...spec,
      query,
      totalCount: response.total_count || 0,
      items: Array.isArray(response.items) ? response.items : [],
    });
  }

  const prRows = dedupePullRequests(rawQueryResults, sampleSize + excludedRepos.size + 20)
    .filter(row => !excludedRepos.has(row.repo))
    .slice(0, sampleSize);
  const uniqueRepos = Array.from(new Set(prRows.map(row => row.repo).filter(Boolean)));

  const repoRows = [];
  const repoMap = new Map();

  for (const repo of uniqueRepos) {
    const metadata = await fetchRepoMetadata(repo, token);
    const readme = await fetchReadme(repo, token);
    const classification = classifyRepo({ repo, metadata, readme });

    const repoRow = {
      repo,
      metadata,
      readme,
      classification,
      prCount: prRows.filter(row => row.repo === repo).length,
    };

    repoRows.push(repoRow);
    repoMap.set(repo, repoRow);
  }

  prRows.forEach(row => {
    row.repoCategory = repoMap.get(row.repo)?.classification.label || 'unclear';
  });

  const summary = buildSummary(rawQueryResults, prRows, repoRows);
  const manualReview = buildManualReviewRows(repoRows, manualReviewLimit);

  return {
    generatedAt: new Date().toISOString(),
    sampleSize,
    perQuery,
    manualReviewLimit,
    dateWindow,
    excludeRepos: Array.from(excludedRepos),
    summary,
    interpretation: buildInterpretation(summary),
    queries: rawQueryResults.map(row => ({ id: row.id, label: row.label, query: row.query, totalCount: row.totalCount })),
    prs: prRows,
    repos: repoRows.sort((left, right) => right.prCount - left.prCount),
    manualReview,
  };
}

async function main() {
  const parsed = parseArgs(process.argv);
  if (parsed.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const report = await buildReport(parsed);

  fs.mkdirSync(path.dirname(parsed.outJson), { recursive: true });
  fs.mkdirSync(path.dirname(parsed.outHtml), { recursive: true });

  fs.writeFileSync(parsed.outJson, JSON.stringify(report, null, 2));
  fs.writeFileSync(parsed.outHtml, renderHtml(report));

  process.stdout.write(
    `OpenClaw explicit PR sample complete.\nJSON: ${parsed.outJson}\nHTML: ${parsed.outHtml}\n`
  );
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  CATEGORY_RULES,
  EXPLICIT_PR_QUERIES,
  buildInterpretation,
  buildReport,
  buildManualReviewRows,
  buildSummary,
  classifyRepo,
  dedupePullRequests,
  extractRepoFromApiUrl,
  normalizeDateWindow,
  renderHtml,
};
