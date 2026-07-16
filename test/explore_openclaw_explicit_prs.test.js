const test = require('node:test');
const assert = require('node:assert/strict');

const {
  EXPLICIT_PR_QUERIES,
  buildInterpretation,
  buildManualReviewRows,
  buildProductLandscapeCounts,
  buildSummary,
  classifyPrAttribution,
  classifyProductLandscape,
  classifyRepo,
  dedupePullRequests,
  diffDays,
  extractRepoFromApiUrl,
  normalizeDateWindow,
  renderHtml,
} = require('../scripts/explore_openclaw_explicit_prs');

test('explicit PR queries cover multiple attribution phrasings', () => {
  const ids = EXPLICIT_PR_QUERIES.map(query => query.id);

  assert.equal(ids.includes('generated-with-openclaw'), true);
  assert.equal(ids.includes('built-with-openclaw'), true);
  assert.equal(ids.includes('created-with-openclaw'), true);
  assert.equal(ids.includes('authored-by-openclaw'), true);
});

test('normalizeDateWindow builds an inclusive created-date qualifier', () => {
  const window = normalizeDateWindow('2025-10-01', '2026-03-15');

  assert.equal(window.label, '2025-10-01 to 2026-03-15');
  assert.equal(window.query, 'created:2025-10-01..2026-03-15');
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

test('classifyPrAttribution separates direct attribution, integration-only, and adjacent hits', () => {
  const direct = classifyPrAttribution({
    title: 'fix: improve scanner',
    body: 'This patch tightens the scanner. Generated with [OpenClaw](https://github.com/openclaw/openclaw).',
    matchedQueries: ['Generated with OpenClaw'],
  });

  const integrationOnly = classifyPrAttribution({
    title: 'feat: add OpenClaw bridge integration',
    body: 'Adds an OpenClaw bridge and remote installer. Generated with [Claude Code](https://claude.com/claude-code)',
    matchedQueries: ['Generated with OpenClaw'],
  });

  const adjacency = classifyPrAttribution({
    title: 'fix: remove OpenClaw probe check',
    body: 'The OpenClaw probe no longer emits this field. Generated with [Claude Code](https://claude.com/claude-code)',
    matchedQueries: ['Generated with OpenClaw'],
  });

  assert.equal(direct.label, 'direct-attribution');
  assert.equal(integrationOnly.label, 'integration-only');
  assert.equal(adjacency.label, 'adjacent-hit');
});

test('classifyProductLandscape distinguishes authored products from assisted active repos', () => {
  const authored = classifyProductLandscape({
    repo: 'example/new-product',
    metadata: {
      createdAt: '2026-02-01T00:00:00Z',
      pushedAt: '2026-03-20T00:00:00Z',
      description: 'Image generation product',
      homepage: '',
      topics: [],
    },
    readme: {
      text: 'A product website with image generation.',
    },
    classification: {
      label: 'app repo',
    },
  }, [
    {
      title: 'feat: ship new image node',
      body: 'Adds a new image node. Generated with OpenClaw.',
      matchedQueries: ['Generated with OpenClaw'],
    },
  ], '2026-03-21T00:00:00Z');

  const assisted = classifyProductLandscape({
    repo: 'example/old-tool',
    metadata: {
      createdAt: '2024-01-01T00:00:00Z',
      pushedAt: '2026-03-20T00:00:00Z',
      description: 'A vulnerability scanner for APIs',
      homepage: '',
      topics: [],
    },
    readme: {
      text: 'A scanner and middleware package.',
    },
    classification: {
      label: 'agent infra',
    },
  }, [
    {
      title: 'fix: improve scanner edge case',
      body: 'Generated with OpenClaw.',
      matchedQueries: ['Generated with OpenClaw'],
    },
  ], '2026-03-21T00:00:00Z');

  const falsePositive = classifyProductLandscape({
    repo: 'example/compat-site',
    metadata: {
      createdAt: '2026-02-01T00:00:00Z',
      pushedAt: '2026-03-20T00:00:00Z',
      description: 'Product showcase site',
      homepage: '',
      topics: [],
    },
    readme: {
      text: 'A product site.',
    },
    classification: {
      label: 'app repo',
    },
  }, [
    {
      title: 'chore: add OpenClaw compatibility copy',
      body: 'Adds OpenClaw compatibility messaging. Generated with [Claude Code](https://claude.com/claude-code)',
      matchedQueries: ['Generated with OpenClaw'],
    },
  ], '2026-03-21T00:00:00Z');

  assert.equal(authored.label, 'OpenClaw-authored product repo');
  assert.equal(assisted.label, 'OpenClaw-assisted contribution to active product repo');
  assert.equal(falsePositive.label, 'OpenClaw integration-only product repo');
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
      {
        classification: { label: 'agent infra' },
        productLandscape: { productLike: true, label: 'OpenClaw-assisted contribution to active product repo' },
        prCount: 2,
      },
      {
        classification: { label: 'app repo' },
        productLandscape: { productLike: true, label: 'OpenClaw-authored product repo' },
        prCount: 1,
      },
    ]
  );

  const interpretation = buildInterpretation(summary);

  assert.equal(summary.rawHits, 15);
  assert.equal(summary.sampledPrs, 3);
  assert.equal(summary.uniqueRepos, 2);
  assert.equal(summary.manualReviewCount, 0);
  assert.equal(summary.productCandidateRepos, 2);
  assert.equal(summary.categoryCounts[0].label, 'agent infra');
  assert.equal(summary.productLandscapeCounts[0].label, 'OpenClaw-assisted contribution to active product repo');
  assert.equal(interpretation.some(note => note.includes('largest bucket is agent infra')), true);
  assert.equal(interpretation.some(note => note.includes('product/tool candidates')), true);
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
    dateWindow: { label: '2025-10-01 to 2026-03-15' },
    summary: {
      queryCount: 4,
      rawHits: 50,
      sampledPrs: 10,
      uniqueRepos: 4,
      productCandidateRepos: 2,
      manualReviewCount: 1,
      categoryCounts: [{ label: 'agent infra', repoCount: 2, prCount: 6 }],
      productLandscapeCounts: [
        { label: 'OpenClaw-assisted contribution to active product repo', repoCount: 1, prCount: 3 },
      ],
    },
    interpretation: ['In this explicit-PR sample, the largest bucket is agent infra.'],
    prs: [
      {
        htmlUrl: 'https://github.com/example/repo/pull/1',
        title: 'Generated with OpenClaw',
        repo: 'example/repo',
        authorLogin: 'alice',
        repoCategory: 'agent infra',
        productLandscapeLabel: 'OpenClaw-assisted contribution to active product repo',
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
          createdAt: '2024-01-01T00:00:00Z',
          pushedAt: '2026-03-20T00:00:00Z',
        },
        classification: {
          label: 'agent infra',
          topScore: 5,
          scoreGap: 3,
          rationale: ['Matched agent infra terms: agent, platform'],
        },
        productLandscape: {
          productLike: true,
          label: 'OpenClaw-assisted contribution to active product repo',
          rationale: ['Direct OpenClaw attribution: Generated with OpenClaw'],
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
  assert.match(html, /Product Landscape Buckets/);
  assert.match(html, /2025-10-01 to 2026-03-15/);
  assert.match(html, /example\/repo/);
});

test('buildProductLandscapeCounts tallies only product-like repos', () => {
  const counts = buildProductLandscapeCounts([
    {
      prCount: 2,
      productLandscape: {
        productLike: true,
        label: 'OpenClaw-assisted contribution to active product repo',
      },
    },
    {
      prCount: 1,
      productLandscape: {
        productLike: true,
        label: 'OpenClaw-authored product repo',
      },
    },
    {
      prCount: 4,
      productLandscape: {
        productLike: false,
        label: 'Non-product repo',
      },
    },
  ]);

  assert.deepEqual(counts.map(row => row.label), [
    'OpenClaw-assisted contribution to active product repo',
    'OpenClaw-authored product repo',
  ]);
});

test('diffDays returns whole-day differences and null on invalid dates', () => {
  assert.equal(diffDays('2026-03-21T00:00:00Z', '2026-03-20T00:00:00Z'), 1);
  assert.equal(diffDays('bad', '2026-03-20T00:00:00Z'), null);
});
