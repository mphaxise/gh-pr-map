const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_QUERY_SPECS,
  applyDateWindowToQuery,
  buildInterpretation,
  buildSummary,
  extractRepoFromApiUrl,
  normalizeDateWindow,
  normalizeSearchItem,
  renderHtml,
} = require('../scripts/explore_openclaw_smoke');

test('default OpenClaw smoke queries cover repos, PRs, and config files', () => {
  const ids = DEFAULT_QUERY_SPECS.map(query => query.id);

  assert.equal(ids.includes('repo-mentions'), true);
  assert.equal(ids.includes('pr-explicit-generated'), true);
  assert.equal(ids.includes('commit-explicit-generated'), true);
  assert.equal(ids.includes('commit-coauthored-openclaw'), true);
  assert.equal(ids.includes('agents-openclaw'), true);
  assert.equal(ids.includes('claude-md-openclaw'), true);
});

test('date window applies created to PRs and committer-date to commits', () => {
  const window = normalizeDateWindow('2025-10-01', '2026-03-15');
  const prQuery = applyDateWindowToQuery(
    { category: 'pull_requests', query: '"generated with openclaw" type:pr is:public' },
    window
  );
  const commitQuery = applyDateWindowToQuery(
    { category: 'commits', query: '"generated with openclaw"' },
    window
  );

  assert.match(prQuery, /created:2025-10-01\.\.2026-03-15/);
  assert.match(commitQuery, /committer-date:2025-10-01\.\.2026-03-15/);
});

test('summary separates explicit, integration, and broad signals', () => {
  const summary = buildSummary([
    { id: 'repo-mentions', category: 'repositories', strength: 'medium', totalCount: 12 },
    { id: 'readme-openclaw', category: 'code', strength: 'medium', totalCount: 7 },
    { id: 'readme-generated-with-openclaw', category: 'code', strength: 'strong', totalCount: 2 },
    { id: 'readme-built-with-openclaw', category: 'code', strength: 'strong', totalCount: 1 },
    { id: 'agents-openclaw', category: 'configs', strength: 'medium', totalCount: 4 },
    { id: 'claude-md-openclaw', category: 'configs', strength: 'medium', totalCount: 3 },
    { id: 'workflows-openclaw', category: 'configs', strength: 'medium', totalCount: 1 },
    { id: 'dot-openclaw', category: 'configs', strength: 'strong', totalCount: 2 },
    { id: 'pr-mentions', category: 'pull_requests', strength: 'medium', totalCount: 5 },
    { id: 'pr-explicit-generated', category: 'pull_requests', strength: 'strong', totalCount: 1 },
    { id: 'commit-mentions', category: 'commits', strength: 'medium', totalCount: 8 },
    { id: 'commit-explicit-generated', category: 'commits', strength: 'strong', totalCount: 2 },
    { id: 'commit-coauthored-openclaw', category: 'commits', strength: 'strong', totalCount: 1 },
  ]);

  assert.equal(summary.queryCount, 13);
  assert.equal(summary.explicitProjectSignals, 3);
  assert.equal(summary.explicitPrSignals, 1);
  assert.equal(summary.explicitCommitSignals, 3);
  assert.equal(summary.integrationSignals, 10);
  assert.equal(summary.broadRepoSignals, 19);
  assert.equal(summary.broadPrSignals, 5);
  assert.equal(summary.broadCommitSignals, 8);
  assert.equal(summary.countsByCategory.configs, 10);
});

test('interpretation calls out sparse explicit attribution separately from integration', () => {
  const notes = buildInterpretation({
    explicitProjectSignals: 0,
    explicitPrSignals: 0,
    explicitCommitSignals: 0,
    integrationSignals: 9,
    broadRepoSignals: 20,
    broadPrSignals: 11,
    broadCommitSignals: 7,
  });

  assert.equal(notes.some(note => note.includes('Explicit OpenClaw generation claims look sparse')), true);
  assert.equal(notes.some(note => note.includes('config and workflow-style files')), true);
  assert.equal(notes.some(note => note.includes('Repo-level OpenClaw mentions appear broader')), true);
  assert.equal(notes.some(note => note.includes('Commit mentions exist')), true);
});

test('normalizeSearchItem extracts repo names from issue and code search results', () => {
  const issueItem = normalizeSearchItem(
    { endpoint: 'issues' },
    {
      title: 'Generated with OpenClaw',
      html_url: 'https://github.com/example/repo/pull/1',
      repository_url: 'https://api.github.com/repos/example/repo',
      updated_at: '2026-03-20T00:00:00Z',
      user: { login: 'alice' },
      pull_request: {},
    }
  );

  const codeItem = normalizeSearchItem(
    { endpoint: 'code' },
    {
      name: 'AGENTS.md',
      path: 'AGENTS.md',
      html_url: 'https://github.com/example/repo/blob/main/AGENTS.md',
      repository: { full_name: 'example/repo' },
    }
  );

  assert.equal(extractRepoFromApiUrl('https://api.github.com/repos/example/repo'), 'example/repo');
  assert.equal(issueItem.repo, 'example/repo');
  assert.equal(codeItem.title, 'example/repo:AGENTS.md');
});

test('renderHtml includes smoke-test framing and query labels', () => {
  const html = renderHtml({
    generatedAt: '2026-03-20T00:00:00Z',
    dateWindow: { label: '2025-10-01 to 2026-03-15' },
    summary: {
      queryCount: 13,
      broadRepoSignals: 12,
      broadPrSignals: 5,
      broadCommitSignals: 7,
      integrationSignals: 8,
      explicitProjectSignals: 1,
      explicitPrSignals: 0,
      explicitCommitSignals: 2,
    },
    interpretation: ['OpenClaw appears in config and workflow-style files.'],
    results: [
      {
        label: 'Repo mentions of OpenClaw',
        category: 'repositories',
        strength: 'medium',
        query: 'openclaw in:name,description,readme,topics archived:false fork:false',
        totalCount: 12,
        why: 'Broad ecosystem footprint.',
        sampleItems: [
          {
            title: 'openclaw/openclaw',
            url: 'https://github.com/openclaw/openclaw',
            repo: 'openclaw/openclaw',
            subtitle: 'self-hosted assistant',
            updatedAt: '2026-03-20T00:00:00Z',
            metric: '1,000 stars',
          },
        ],
      },
    ],
  });

  assert.match(html, /OpenClaw GitHub Smoke Test/);
  assert.match(html, /Quick Read/);
  assert.match(html, /Repo mentions of OpenClaw/);
  assert.match(html, /Explicit commit signals/);
  assert.match(html, /2025-10-01 to 2026-03-15/);
  assert.match(html, /openclaw\/openclaw/);
});
