const test = require('node:test');
const assert = require('node:assert/strict');

const {
  EXPLICIT_PR_QUERIES,
  buildInterpretation,
  buildManualReviewRows,
  buildSummary,
  classifyRepo,
  dedupePullRequests,
  extractRepoFromApiUrl,
  renderHtml,
} = require('../scripts/explore_openclaw_explicit_prs');

test('explicit PR queries cover multiple attribution phrasings', () => {
  const ids = EXPLICIT_PR_QUERIES.map(query => query.id);

  assert.equal(ids.includes('generated-with-openclaw'), true);
  assert.equal(ids.includes('built-with-openclaw'), true);
  assert.equal(ids.includes('created-with-openclaw'), true);
  assert.equal(ids.includes('authored-by-openclaw'), true);
});

test('dedupePullRequests merges repeated hits across query templates', () => {
  const rows = dedupePullRequests([
    {
      label: 'Generated with OpenClaw',
      items: [
        {
          html_url: 'https://github.com/example/repo/pull/1',
          title: 'Generated with OpenClaw',
          repository_url: 'https://api.github.com/repos/example/repo',
          user: { login: 'alice' },
          updated_at: '2026-03-20T10:00:00Z',
          body: 'Generated with OpenClaw',
          number: 1,
        },
      ],
    },
    {
      label: 'Built with OpenClaw',
      items: [
        {
          html_url: 'https://github.com/example/repo/pull/1',
          title: 'Generated with OpenClaw',
          repository_url: 'https://api.github.com/repos/example/repo',
          user: { login: 'alice' },
          updated_at: '2026-03-20T10:00:00Z',
          body: 'Built with OpenClaw',
          number: 1,
        },
      ],
    },
  ], 10);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].repo, 'example/repo');
  assert.deepEqual(rows[0].matchedQueries, ['Built with OpenClaw', 'Generated with OpenClaw']);
});

test('classifyRepo separates agent infra, plugins, apps, and unclear', () => {
  const infra = classifyRepo({
    repo: 'openclaw/openclaw',
    metadata: {
      description: 'Self-hosted personal AI assistant platform and gateway',
      homepage: '',
      topics: ['openclaw', 'agent'],
    },
    readme: {
      text: 'OpenClaw is a self-hosted assistant with gateway, skills, automation, and memory.',
    },
  });

  const plugin = classifyRepo({
    repo: 'example/openclaw-ha-addon',
    metadata: {
      description: 'Home Assistant add-on for OpenClaw',
      homepage: '',
      topics: ['addon'],
    },
    readme: {
      text: 'Install this plugin to integrate OpenClaw with Home Assistant.',
    },
  });

  const app = classifyRepo({
    repo: 'example/budget-app',
    metadata: {
      description: 'A full-stack budgeting app built with OpenClaw',
      homepage: '',
      topics: ['app'],
    },
    readme: {
      text: 'This application helps users track budgets and spending.',
    },
  });

  const unclear = classifyRepo({
    repo: 'example/misc',
    metadata: {
      description: 'Assorted experiments',
      homepage: '',
      topics: [],
    },
    readme: {
      text: 'Notebook for random ideas.',
    },
  });

  assert.equal(infra.label, 'agent infra');
  assert.equal(infra.ambiguous, false);
  assert.equal(plugin.label, 'plugin/add-on');
  assert.equal(app.label, 'app repo');
  assert.equal(unclear.label, 'unclear');
  assert.equal(unclear.ambiguous, true);
});

test('summary and interpretation describe category mix', () => {
  const summary = buildSummary(
    [
      { totalCount: 10 },
      { totalCount: 5 },
    ],
    [
      { repo: 'a/repo' },
      { repo: 'a/repo' },
      { repo: 'b/repo' },
    ],
    [
      { classification: { label: 'agent infra' }, prCount: 2 },
      { classification: { label: 'app repo' }, prCount: 1 },
    ]
  );

  const interpretation = buildInterpretation(summary);

  assert.equal(summary.rawHits, 15);
  assert.equal(summary.sampledPrs, 3);
  assert.equal(summary.uniqueRepos, 2);
  assert.equal(summary.manualReviewCount, 0);
  assert.equal(summary.categoryCounts[0].label, 'agent infra');
  assert.equal(interpretation.some(note => note.includes('largest bucket is agent infra')), true);
  assert.equal(interpretation.some(note => note.includes('user-facing app repos')), true);
});

test('buildManualReviewRows surfaces ambiguous repos first', () => {
  const rows = buildManualReviewRows([
    {
      repo: 'example/clear',
      prCount: 5,
      classification: { ambiguous: false, scoreGap: 4, topScore: 6 },
    },
    {
      repo: 'example/ambiguous-low-gap',
      prCount: 2,
      classification: { ambiguous: true, scoreGap: 0, topScore: 4 },
    },
    {
      repo: 'example/ambiguous-low-score',
      prCount: 3,
      classification: { ambiguous: true, scoreGap: 2, topScore: 1 },
    },
  ], 10);

  assert.deepEqual(rows.map(row => row.repo), [
    'example/ambiguous-low-gap',
    'example/ambiguous-low-score',
  ]);
});

test('renderHtml includes sampled PR and repo classification sections', () => {
  const html = renderHtml({
    generatedAt: '2026-03-20T00:00:00Z',
    summary: {
      queryCount: 4,
      rawHits: 50,
      sampledPrs: 10,
      uniqueRepos: 4,
      manualReviewCount: 1,
      categoryCounts: [{ label: 'agent infra', repoCount: 2, prCount: 6 }],
    },
    interpretation: ['In this explicit-PR sample, the largest bucket is agent infra.'],
    prs: [
      {
        htmlUrl: 'https://github.com/example/repo/pull/1',
        title: 'Generated with OpenClaw',
        repo: 'example/repo',
        authorLogin: 'alice',
        repoCategory: 'agent infra',
        matchedQueries: ['Generated with OpenClaw'],
        updatedAt: '2026-03-20T00:00:00Z',
      },
    ],
    repos: [
      {
        repo: 'example/repo',
        prCount: 3,
        metadata: {
          htmlUrl: 'https://github.com/example/repo',
          description: 'Agent platform',
          stars: 10,
          pushedAt: '2026-03-20T00:00:00Z',
        },
        classification: {
          label: 'agent infra',
          topScore: 5,
          scoreGap: 3,
          rationale: ['Matched agent infra terms: agent, platform'],
        },
      },
    ],
    manualReview: [
      {
        repo: 'example/repo',
        prCount: 3,
        metadata: {
          htmlUrl: 'https://github.com/example/repo',
        },
        classification: {
          label: 'agent infra',
          topScore: 2,
          scoreGap: 0,
          rationale: ['Weak mixed evidence across categories; closest match was agent infra.'],
        },
      },
    ],
  });

  assert.equal(extractRepoFromApiUrl('https://api.github.com/repos/example/repo'), 'example/repo');
  assert.match(html, /OpenClaw Explicit PR Sample/);
  assert.match(html, /Sampled PRs/);
  assert.match(html, /Repo Classification Cards/);
  assert.match(html, /Manual Review Queue/);
  assert.match(html, /example\/repo/);
});
