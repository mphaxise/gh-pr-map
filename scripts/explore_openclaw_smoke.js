#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

const DEFAULT_PER_QUERY = 8;
const DEFAULT_OUT_JSON = 'output/openclaw-github-smoke.json';
const DEFAULT_OUT_HTML = 'output/openclaw-github-smoke.html';

const DEFAULT_QUERY_SPECS = [
  {
    id: 'repo-mentions',
    label: 'Repo mentions of OpenClaw',
    category: 'repositories',
    strength: 'medium',
    endpoint: 'repositories',
    query: 'openclaw in:name,description,readme,topics archived:false fork:false',
    why: 'Broad ecosystem footprint across public repositories.',
  },
  {
    id: 'readme-openclaw',
    label: 'README mentions of OpenClaw',
    category: 'code',
    strength: 'medium',
    endpoint: 'code',
    query: 'openclaw filename:README.md',
    why: 'Broad repo-level integration or attribution signal.',
  },
  {
    id: 'readme-generated-with-openclaw',
    label: 'README claims generated with OpenClaw',
    category: 'code',
    strength: 'strong',
    endpoint: 'code',
    query: '"generated with openclaw" filename:README.md',
    why: 'High-signal claim that a repo or artifact was explicitly generated with OpenClaw.',
  },
  {
    id: 'readme-built-with-openclaw',
    label: 'README claims built with OpenClaw',
    category: 'code',
    strength: 'strong',
    endpoint: 'code',
    query: '"built with openclaw" filename:README.md',
    why: 'High-signal claim that a repo or app was built with OpenClaw.',
  },
  {
    id: 'agents-openclaw',
    label: 'AGENTS.md files mentioning OpenClaw',
    category: 'configs',
    strength: 'medium',
    endpoint: 'code',
    query: 'openclaw filename:AGENTS.md',
    why: 'Signals that OpenClaw is part of a repo-level agent workflow.',
  },
  {
    id: 'claude-md-openclaw',
    label: 'CLAUDE.md files mentioning OpenClaw',
    category: 'configs',
    strength: 'medium',
    endpoint: 'code',
    query: 'openclaw filename:CLAUDE.md',
    why: 'Signals cross-tool agent setup and explicit repo instructions mentioning OpenClaw.',
  },
  {
    id: 'workflows-openclaw',
    label: 'Workflow files mentioning OpenClaw',
    category: 'configs',
    strength: 'medium',
    endpoint: 'code',
    query: 'openclaw path:.github/workflows',
    why: 'Signals CI or automation-level integration around OpenClaw.',
  },
  {
    id: 'dot-openclaw',
    label: 'Code mentions of ~/.openclaw',
    category: 'configs',
    strength: 'strong',
    endpoint: 'code',
    query: '"~/.openclaw"',
    why: 'High-signal operational footprint tied to local OpenClaw setups.',
  },
  {
    id: 'pr-mentions',
    label: 'Pull requests mentioning OpenClaw',
    category: 'pull_requests',
    strength: 'medium',
    endpoint: 'issues',
    query: 'openclaw type:pr is:public',
    why: 'Broad PR-level footprint, including submissions against OpenClaw repos and PR bodies discussing OpenClaw.',
  },
  {
    id: 'pr-explicit-generated',
    label: 'Pull requests explicitly saying generated with OpenClaw',
    category: 'pull_requests',
    strength: 'strong',
    endpoint: 'issues',
    query: '"generated with openclaw" type:pr is:public',
    why: 'Best quick smoke-test for direct PR-level OpenClaw attribution.',
  },
  {
    id: 'commit-mentions',
    label: 'Commits mentioning OpenClaw',
    category: 'commits',
    strength: 'medium',
    endpoint: 'commits',
    query: 'openclaw',
    why: 'Broad commit-message footprint that can capture pushed code or operational commits tied to OpenClaw.',
  },
  {
    id: 'commit-explicit-generated',
    label: 'Commits explicitly saying generated with OpenClaw',
    category: 'commits',
    strength: 'strong',
    endpoint: 'commits',
    query: '"generated with openclaw"',
    why: 'High-signal commit-level evidence that OpenClaw-authored changes were pushed to GitHub.',
  },
  {
    id: 'commit-coauthored-openclaw',
    label: 'Commits with Co-Authored-By OpenClaw',
    category: 'commits',
    strength: 'strong',
    endpoint: 'commits',
    query: '"Co-Authored-By: OpenClaw"',
    why: 'High-signal co-authorship breadcrumb if OpenClaw is recorded directly in commit metadata.',
  },
];

function usage() {
  return [
    'Usage: node scripts/explore_openclaw_smoke.js [options]',
    '',
    'Options:',
    `  --per-query <n>      Search result sample size per query (default: ${DEFAULT_PER_QUERY})`,
    '  --date-from <date>   Inclusive window start in YYYY-MM-DD for PR and commit queries',
    '  --date-to <date>     Inclusive window end in YYYY-MM-DD for PR and commit queries',
    `  --out-json <path>    JSON output path (default: ${DEFAULT_OUT_JSON})`,
    `  --out-html <path>    HTML output path (default: ${DEFAULT_OUT_HTML})`,
  ].join('\n');
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const parsed = {
    help: false,
    perQuery: DEFAULT_PER_QUERY,
    dateFrom: '',
    dateTo: '',
    outJson: DEFAULT_OUT_JSON,
    outHtml: DEFAULT_OUT_HTML,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }

    if (arg === '--per-query') {
      parsed.perQuery = Math.max(1, Math.min(20, parseInt(args[index + 1], 10)));
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
    pullRequestQualifier: `created:${from || '*'}..${to || '*'}`,
    commitQualifier: `committer-date:${from || '*'}..${to || '*'}`,
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

function requestJson(apiPath, token, accept) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: apiPath,
      headers: {
        'User-Agent': 'gh-pr-map-openclaw-smoke',
        'Accept': accept || 'application/vnd.github.text-match+json',
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

function applyDateWindowToQuery(spec, dateWindow) {
  if (!dateWindow) {
    return spec.query;
  }

  if (spec.category === 'pull_requests') {
    return `${spec.query} ${dateWindow.pullRequestQualifier}`;
  }

  if (spec.category === 'commits') {
    return `${spec.query} ${dateWindow.commitQualifier}`;
  }

  return spec.query;
}

async function ghSearch(spec, perQuery, token, dateWindow) {
  const query = applyDateWindowToQuery(spec, dateWindow);
  const basePath = `/search/${spec.endpoint}?q=${encodeURIComponent(query)}&per_page=${perQuery}`;
  const apiPath = spec.endpoint === 'repositories'
    ? `${basePath}&sort=updated&order=desc`
    : `${basePath}&sort=updated&order=desc`;
  const accept = spec.endpoint === 'commits'
    ? 'application/vnd.github.cloak-preview+json'
    : 'application/vnd.github.text-match+json';
  const response = await requestJson(apiPath, token, accept);
  return { response, query };
}

function extractRepoFromApiUrl(apiUrl) {
  const match = cleanText(apiUrl).match(/\/repos\/([^/]+\/[^/]+)$/);
  return match ? match[1] : '';
}

function normalizeSearchItem(spec, item) {
  if (spec.endpoint === 'repositories') {
    return {
      title: cleanText(item.full_name) || 'unknown repo',
      url: cleanText(item.html_url),
      repo: cleanText(item.full_name),
      subtitle: cleanText(item.description),
      updatedAt: cleanText(item.updated_at || item.pushed_at),
      metric: `${formatCount(item.stargazers_count || 0)} stars`,
    };
  }

  if (spec.endpoint === 'issues') {
    return {
      title: cleanText(item.title) || 'untitled pull request',
      url: cleanText(item.html_url),
      repo: extractRepoFromApiUrl(item.repository_url),
      subtitle: cleanText(item.user && item.user.login),
      updatedAt: cleanText(item.updated_at),
      metric: item.pull_request ? 'pull request' : 'issue',
    };
  }

  if (spec.endpoint === 'commits') {
    return {
      title: cleanText(item.commit && item.commit.message).split('\n')[0] || cleanText(item.sha) || 'commit result',
      url: cleanText(item.html_url),
      repo: cleanText(item.repository && item.repository.full_name),
      subtitle: cleanText(item.author && item.author.login) || cleanText(item.commit && item.commit.author && item.commit.author.name),
      updatedAt: cleanText(item.commit && item.commit.author && item.commit.author.date),
      metric: cleanText(item.sha).slice(0, 12),
    };
  }

  return {
    title: cleanText(item.repository && item.repository.full_name)
      ? `${cleanText(item.repository.full_name)}:${cleanText(item.path)}`
      : cleanText(item.path) || 'code result',
    url: cleanText(item.html_url),
    repo: cleanText(item.repository && item.repository.full_name),
    subtitle: cleanText(item.name),
    updatedAt: '',
    metric: cleanText(item.path),
  };
}

function summarizeQueryResult(spec, response, resolvedQuery) {
  const items = Array.isArray(response.items) ? response.items : [];

  return {
    id: spec.id,
    label: spec.label,
    category: spec.category,
    strength: spec.strength,
    query: resolvedQuery || spec.query,
    why: spec.why,
    totalCount: response.total_count || 0,
    incompleteResults: Boolean(response.incomplete_results),
    sampleItems: items.map(item => normalizeSearchItem(spec, item)),
  };
}

function sumCounts(rows, predicate) {
  return rows
    .filter(predicate)
    .reduce((sum, row) => sum + (row.totalCount || 0), 0);
}

function buildSummary(results) {
  const countsByCategory = {};
  const countsByStrength = {};

  for (const row of results) {
    countsByCategory[row.category] = (countsByCategory[row.category] || 0) + row.totalCount;
    countsByStrength[row.strength] = (countsByStrength[row.strength] || 0) + row.totalCount;
  }

  const explicitProjectSignals = sumCounts(
    results,
    row => row.id === 'readme-generated-with-openclaw' || row.id === 'readme-built-with-openclaw'
  );
  const explicitPrSignals = sumCounts(results, row => row.id === 'pr-explicit-generated');
  const explicitCommitSignals = sumCounts(
    results,
    row => row.id === 'commit-explicit-generated' || row.id === 'commit-coauthored-openclaw'
  );
  const integrationSignals = sumCounts(
    results,
    row => ['agents-openclaw', 'claude-md-openclaw', 'workflows-openclaw', 'dot-openclaw'].includes(row.id)
  );
  const broadRepoSignals = sumCounts(
    results,
    row => ['repo-mentions', 'readme-openclaw'].includes(row.id)
  );
  const broadPrSignals = sumCounts(results, row => row.id === 'pr-mentions');
  const broadCommitSignals = sumCounts(results, row => row.id === 'commit-mentions');

  return {
    queryCount: results.length,
    countsByCategory,
    countsByStrength,
    explicitProjectSignals,
    explicitPrSignals,
    explicitCommitSignals,
    integrationSignals,
    broadRepoSignals,
    broadPrSignals,
    broadCommitSignals,
  };
}

function buildInterpretation(summary) {
  const notes = [];

  if (summary.explicitProjectSignals > 0 || summary.explicitPrSignals > 0 || summary.explicitCommitSignals > 0) {
    notes.push('There is direct public evidence that at least some GitHub artifacts explicitly claim OpenClaw generation or OpenClaw-authored submissions.');
  } else {
    notes.push('Explicit OpenClaw generation claims look sparse, so public repo output may be under-labeled even if OpenClaw is being used heavily.');
  }

  if (summary.integrationSignals > 0) {
    notes.push('OpenClaw appears in config and workflow-style files, which supports the theory that it is often used as agent infrastructure around coding work.');
  }

  if (summary.broadRepoSignals > summary.explicitProjectSignals && summary.broadRepoSignals > 0) {
    notes.push('Repo-level OpenClaw mentions appear broader than explicit “built/generated with OpenClaw” claims, which suggests ecosystem presence is easier to detect than direct authorship.');
  }

  if (summary.broadPrSignals > summary.explicitPrSignals && summary.broadPrSignals > 0) {
    notes.push('PR mentions likely mix together true OpenClaw-authored changes with discussion about OpenClaw itself, so broad PR counts should be treated as directional rather than as authorship counts.');
  }

  if (summary.explicitCommitSignals > 0) {
    notes.push('Commit-level explicit signals suggest at least some OpenClaw usage survives beyond PR text and is being written directly into pushed commit history.');
  } else if (summary.broadCommitSignals > 0) {
    notes.push('Commit mentions exist, but without explicit attribution they are best treated as weak directional evidence rather than direct authorship proof.');
  }

  if (!notes.length) {
    notes.push('This smoke test did not surface enough signal to draw a strong conclusion.');
  }

  return notes;
}

function renderHtml(report) {
  const cards = [
    ['Queries', formatCount(report.summary.queryCount)],
    ['Broad repo signals', formatCount(report.summary.broadRepoSignals)],
    ['Broad PR signals', formatCount(report.summary.broadPrSignals)],
    ['Broad commit signals', formatCount(report.summary.broadCommitSignals)],
    ['Integration signals', formatCount(report.summary.integrationSignals)],
    ['Explicit project signals', formatCount(report.summary.explicitProjectSignals)],
    ['Explicit PR signals', formatCount(report.summary.explicitPrSignals)],
    ['Explicit commit signals', formatCount(report.summary.explicitCommitSignals)],
  ];

  const queryRows = report.results.map(result => `
    <tr>
      <td>${escapeHtml(result.label)}</td>
      <td>${escapeHtml(result.category)}</td>
      <td>${escapeHtml(result.strength)}</td>
      <td><code>${escapeHtml(result.query)}</code></td>
      <td>${formatCount(result.totalCount)}</td>
      <td>${escapeHtml(result.why)}</td>
    </tr>
  `).join('');

  const querySections = report.results.map(result => `
    <section class="query-block">
      <h3>${escapeHtml(result.label)}</h3>
      <p class="meta">${escapeHtml(result.category)} · ${escapeHtml(result.strength)} signal · ${formatCount(result.totalCount)} hits</p>
      <p class="why">${escapeHtml(result.why)}</p>
      <div class="sample-list">
        ${result.sampleItems.length ? result.sampleItems.map(item => `
          <article class="sample-item">
            <a href="${escapeHtml(item.url)}">${escapeHtml(item.title)}</a>
            <div class="sample-meta">${escapeHtml(item.repo || item.subtitle || '')}</div>
            <div class="sample-meta">${escapeHtml(item.metric)}${item.updatedAt ? ` · updated ${escapeHtml(formatDate(item.updatedAt))}` : ''}</div>
          </article>
        `).join('') : '<p class="empty">No sampled results returned for this query.</p>'}
      </div>
    </section>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenClaw GitHub Smoke Test</title>
  <style>
    :root {
      --bg: #f5f1e8;
      --panel: rgba(255, 252, 245, 0.94);
      --ink: #1d2a1f;
      --muted: #59665b;
      --line: rgba(29, 42, 31, 0.12);
      --accent: #2b6f57;
      --accent-soft: rgba(43, 111, 87, 0.12);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Georgia, "Iowan Old Style", serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(43, 111, 87, 0.16), transparent 32%),
        linear-gradient(180deg, #fbf8f1 0%, var(--bg) 100%);
    }
    main {
      max-width: 1200px;
      margin: 0 auto;
      padding: 48px 24px 72px;
    }
    h1, h2, h3 { margin: 0; line-height: 1.1; }
    p { line-height: 1.5; }
    .hero {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 28px;
      padding: 32px;
      box-shadow: 0 24px 60px rgba(34, 41, 36, 0.08);
    }
    .eyebrow {
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 12px;
      margin-bottom: 12px;
    }
    .lede {
      max-width: 760px;
      color: var(--muted);
      margin-top: 16px;
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 14px;
      margin: 28px 0 16px;
    }
    .card, .section, .query-block {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 20px;
      box-shadow: 0 16px 40px rgba(34, 41, 36, 0.05);
    }
    .card {
      padding: 18px 18px 16px;
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
      grid-template-columns: 1.1fr 1.5fr;
      gap: 18px;
      margin-top: 18px;
    }
    .section {
      padding: 22px;
    }
    .section h2 {
      margin-bottom: 12px;
      font-size: 24px;
    }
    .notes {
      display: grid;
      gap: 10px;
    }
    .note {
      padding: 12px 14px;
      border-radius: 14px;
      background: var(--accent-soft);
      color: var(--ink);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    th, td {
      border-top: 1px solid var(--line);
      text-align: left;
      padding: 12px 10px;
      vertical-align: top;
    }
    th {
      font-size: 12px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      border-top: none;
    }
    .queries {
      display: grid;
      gap: 16px;
      margin-top: 18px;
    }
    .query-block {
      padding: 20px;
    }
    .meta, .why, .sample-meta, .empty {
      color: var(--muted);
    }
    .sample-list {
      display: grid;
      gap: 12px;
      margin-top: 14px;
    }
    .sample-item {
      padding: 14px;
      border-radius: 14px;
      border: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.45);
    }
    .sample-item a {
      color: var(--accent);
      text-decoration: none;
      font-weight: 700;
    }
    code {
      font-family: "SFMono-Regular", ui-monospace, Menlo, Monaco, monospace;
      font-size: 12px;
      background: rgba(29, 42, 31, 0.06);
      padding: 2px 5px;
      border-radius: 6px;
    }
    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <div class="eyebrow">OpenClaw Smoke Test</div>
      <h1>GitHub Signal Probe For OpenClaw-Created Repos And Submissions</h1>
      <p class="lede">
        Generated on ${escapeHtml(report.generatedAt)}. This report is a quick directional test, not a deduplicated benchmark.
        It separates broad OpenClaw ecosystem mentions from stronger explicit claims such as “generated with OpenClaw”.
      </p>
      <p class="lede">Window applied to PR and commit queries: ${escapeHtml(report.dateWindow ? report.dateWindow.label : 'all available dates')}</p>
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
      <article class="section">
        <h2>Quick Read</h2>
        <div class="notes">
          ${report.interpretation.map(note => `<div class="note">${escapeHtml(note)}</div>`).join('')}
        </div>
      </article>
      <article class="section">
        <h2>Query Table</h2>
        <table>
          <thead>
            <tr>
              <th>Query</th>
              <th>Category</th>
              <th>Strength</th>
              <th>Search</th>
              <th>Hits</th>
              <th>Why</th>
            </tr>
          </thead>
          <tbody>${queryRows}</tbody>
        </table>
      </article>
    </section>

    <section class="queries">
      ${querySections}
    </section>
  </main>
</body>
</html>`;
}

async function buildReport(options) {
  const token = cleanText(options.token || process.env.GITHUB_TOKEN);
  const perQuery = options.perQuery || DEFAULT_PER_QUERY;
  const dateWindow = normalizeDateWindow(options.dateFrom, options.dateTo);
  const results = [];

  for (const spec of DEFAULT_QUERY_SPECS) {
    const { response, query } = await ghSearch(spec, perQuery, token, dateWindow);
    results.push(summarizeQueryResult(spec, response, query));
  }

  const summary = buildSummary(results);

  return {
    generatedAt: new Date().toISOString(),
    tokenPresent: Boolean(token),
    perQuery,
    dateWindow,
    summary,
    interpretation: buildInterpretation(summary),
    results,
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
    `OpenClaw smoke test complete.\nJSON: ${parsed.outJson}\nHTML: ${parsed.outHtml}\n`
  );
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  DEFAULT_QUERY_SPECS,
  applyDateWindowToQuery,
  buildInterpretation,
  buildReport,
  buildSummary,
  extractRepoFromApiUrl,
  normalizeDateWindow,
  normalizeSearchItem,
  renderHtml,
  summarizeQueryResult,
};
