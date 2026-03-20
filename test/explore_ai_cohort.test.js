const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildReport,
  buildWindowComparison,
  classifyPullRequest,
  countDaysInclusive,
  detectBayArea,
  isPullRequestInWindow,
  normalizeDateWindow,
  parseWindowSpec,
  renderHtml,
} = require('../scripts/explore_ai_cohort');

test('detectBayArea matches common Bay Area profile strings', () => {
  assert.equal(detectBayArea('San Francisco, CA'), true);
  assert.equal(detectBayArea('Bay Area'), true);
  assert.equal(detectBayArea('Mountain View, California'), true);
  assert.equal(detectBayArea('Toronto, Canada'), false);
});

test('classifyPullRequest marks bot authors and agent signal keywords separately', () => {
  const botPr = classifyPullRequest({
    user: { login: 'dependabot[bot]', type: 'Bot' },
    title: 'build: bump requests',
    body: '',
  });

  const agentPr = classifyPullRequest({
    user: { login: 'openhands-runner', type: 'User' },
    title: 'Fix bug with Codex-assisted test updates',
    body: 'Generated with OpenHands and Codex',
  });

  assert.equal(botPr.botAuthor, true);
  assert.equal(botPr.agentSignalPr, false);
  assert.deepEqual(agentPr.agentSignals.sort(), ['codex', 'openhands']);
  assert.equal(agentPr.botAuthor, false);
  assert.equal(agentPr.agentSignalPr, true);
});

test('buildReport produces repo summaries and top locations', () => {
  const report = buildReport({
    cohort: ['OpenHands/OpenHands', 'ollama/ollama'],
    limitPerRepo: 10,
    dateWindow: null,
    repoMetaByName: {
      'OpenHands/OpenHands': {
        stars: 100,
        forks: 10,
        license: 'MIT',
        pushedAt: '2026-03-19T00:00:00Z',
        htmlUrl: 'https://github.com/OpenHands/OpenHands',
      },
      'ollama/ollama': {
        stars: 90,
        forks: 9,
        license: 'MIT',
        pushedAt: '2026-03-19T00:00:00Z',
        htmlUrl: 'https://github.com/ollama/ollama',
      },
    },
    repoRows: [
      {
        repo: 'OpenHands/OpenHands',
        number: 1,
        title: 'Agent change',
        body: '',
        htmlUrl: 'https://example.com/1',
        createdAt: '2026-03-19T00:00:00Z',
        authorLogin: 'openhands-runner',
        authorType: 'User',
        botAuthor: false,
        agentSignalPr: true,
        agentSignals: ['openhands'],
      },
      {
        repo: 'ollama/ollama',
        number: 2,
        title: 'Human change',
        body: '',
        htmlUrl: 'https://example.com/2',
        createdAt: '2026-03-19T00:00:00Z',
        authorLogin: 'alice',
        authorType: 'User',
        botAuthor: false,
        agentSignalPr: false,
        agentSignals: [],
      },
      {
        repo: 'ollama/ollama',
        number: 3,
        title: 'Dependency bump',
        body: '',
        htmlUrl: 'https://example.com/3',
        createdAt: '2026-03-19T00:00:00Z',
        authorLogin: 'dependabot[bot]',
        authorType: 'Bot',
        botAuthor: true,
        agentSignalPr: false,
        agentSignals: [],
      },
    ],
    humanContributorRows: [
      {
        repo: 'OpenHands/OpenHands',
        authorLogin: 'openhands-runner',
        authorType: 'User',
        location: 'San Francisco, CA',
        bayAreaMatch: true,
        company: '',
        profileUrl: 'https://github.com/openhands-runner',
      },
      {
        repo: 'ollama/ollama',
        authorLogin: 'alice',
        authorType: 'User',
        location: 'Toronto, Canada',
        bayAreaMatch: false,
        company: '',
        profileUrl: 'https://github.com/alice',
      },
    ],
  });

  assert.equal(report.summary.totalPrs, 3);
  assert.equal(report.summary.uniqueAuthors, 3);
  assert.equal(report.summary.humanPrs, 2);
  assert.equal(report.summary.botPrs, 1);
  assert.equal(report.summary.agentSignalPrs, 1);
  assert.equal(report.summary.humanAuthors, 2);
  assert.equal(report.summary.bayAreaAuthors, 1);
  assert.equal(report.repoSummaries[0].totalPrs, 1);
  assert.equal(report.topLocations[0].label, 'San Francisco, CA');
});

test('renderHtml includes core exploration sections', () => {
  const report = buildReport({
    cohort: ['OpenHands/OpenHands'],
    limitPerRepo: 5,
    dateWindow: { label: '2026-01-01 to 2026-03-15' },
    repoMetaByName: {
      'OpenHands/OpenHands': {
        stars: 100,
        forks: 10,
        license: 'MIT',
        pushedAt: '2026-03-19T00:00:00Z',
        htmlUrl: 'https://github.com/OpenHands/OpenHands',
      },
    },
    repoRows: [
      {
        repo: 'OpenHands/OpenHands',
        number: 1,
        title: 'Agent change',
        body: '',
        htmlUrl: 'https://example.com/1',
        createdAt: '2026-03-19T00:00:00Z',
        authorLogin: 'openhands-runner',
        authorType: 'User',
        botAuthor: false,
        agentSignalPr: true,
        agentSignals: ['openhands'],
      },
    ],
    humanContributorRows: [
      {
        repo: 'OpenHands/OpenHands',
        authorLogin: 'openhands-runner',
        authorType: 'User',
        location: 'San Francisco, CA',
        bayAreaMatch: true,
        company: '',
        profileUrl: 'https://github.com/openhands-runner',
      },
    ],
  });

  const html = renderHtml(report);
  assert.match(html, /Agent repo comparison: size versus activity/);
  assert.match(html, /Repo summary table/);
  assert.match(html, /Visible agent-signal PRs/);
  assert.match(html, /Repo context/);
  assert.match(html, /2026-01-01 to 2026-03-15/);
});

test('parseWindowSpec and countDaysInclusive capture labeled inclusive windows', () => {
  const early2025 = parseWindowSpec('early-2025,2025-01-01,2025-03-15');
  const late2025 = parseWindowSpec('late-2025,2025-09-15,2025-12-31');

  assert.equal(early2025.label, 'early-2025');
  assert.equal(early2025.dayCount, 74);
  assert.equal(late2025.dayCount, 108);
  assert.equal(countDaysInclusive(early2025.start, early2025.end), 74);
});

test('buildWindowComparison summarizes cross-window deltas without location sections', () => {
  const cohort = ['OpenHands/OpenHands', 'cline/cline'];
  const repoMetaByName = {
    'OpenHands/OpenHands': {
      stars: 100,
      forks: 10,
      license: 'MIT',
      pushedAt: '2026-03-19T00:00:00Z',
      htmlUrl: 'https://github.com/OpenHands/OpenHands',
    },
    'cline/cline': {
      stars: 90,
      forks: 9,
      license: 'Apache-2.0',
      pushedAt: '2026-03-19T00:00:00Z',
      htmlUrl: 'https://github.com/cline/cline',
    },
  };

  const early2025 = buildReport({
    cohort,
    limitPerRepo: 0,
    dateWindow: normalizeDateWindow('2025-01-01', '2025-03-15'),
    repoMetaByName,
    repoRows: [
      {
        repo: 'OpenHands/OpenHands',
        number: 1,
        title: 'Agent change',
        body: '',
        htmlUrl: 'https://example.com/1',
        createdAt: '2025-01-10T00:00:00Z',
        authorLogin: 'openhands-runner',
        authorType: 'User',
        botAuthor: false,
        agentSignalPr: true,
        agentSignals: ['openhands'],
      },
      {
        repo: 'cline/cline',
        number: 2,
        title: 'Dependency bump',
        body: '',
        htmlUrl: 'https://example.com/2',
        createdAt: '2025-02-10T00:00:00Z',
        authorLogin: 'dependabot[bot]',
        authorType: 'Bot',
        botAuthor: true,
        agentSignalPr: false,
        agentSignals: [],
      },
    ],
    humanContributorRows: [],
  });

  const early2026 = buildReport({
    cohort,
    limitPerRepo: 0,
    dateWindow: normalizeDateWindow('2026-01-01', '2026-03-15'),
    repoMetaByName,
    repoRows: [
      {
        repo: 'OpenHands/OpenHands',
        number: 3,
        title: 'Automation update',
        body: 'Generated with OpenHands',
        htmlUrl: 'https://example.com/3',
        createdAt: '2026-01-12T00:00:00Z',
        authorLogin: 'openhands-runner',
        authorType: 'User',
        botAuthor: false,
        agentSignalPr: true,
        agentSignals: ['openhands'],
      },
      {
        repo: 'OpenHands/OpenHands',
        number: 4,
        title: 'Bot fix',
        body: '',
        htmlUrl: 'https://example.com/4',
        createdAt: '2026-02-15T00:00:00Z',
        authorLogin: 'github-actions[bot]',
        authorType: 'Bot',
        botAuthor: true,
        agentSignalPr: false,
        agentSignals: [],
      },
      {
        repo: 'cline/cline',
        number: 5,
        title: 'Claude-assisted change',
        body: 'Generated with Claude Code',
        htmlUrl: 'https://example.com/5',
        createdAt: '2026-03-01T00:00:00Z',
        authorLogin: 'alice',
        authorType: 'User',
        botAuthor: false,
        agentSignalPr: true,
        agentSignals: ['claude'],
      },
    ],
    humanContributorRows: [],
  });

  const comparison = buildWindowComparison({
    cohort,
    limitPerRepo: 0,
    repoMetaByName,
    windowReports: [
      { label: 'early-2025', report: early2025 },
      { label: 'early-2026', report: early2026 },
    ],
  });

  assert.equal(comparison.type, 'windowComparison');
  assert.equal(comparison.summary.totalPrs, 5);
  assert.equal(comparison.summary.botPrs, 2);
  assert.equal(comparison.summary.agentSignalPrs, 3);
  assert.equal(comparison.windows[0].dayCount, 74);
  assert.equal(comparison.windows[1].totalPrs, 3);
  assert.equal(comparison.anchorComparison.totalPrDelta, 1);
  assert.equal(comparison.repoComparisons[0].windowStats.length, 2);

  const html = renderHtml(comparison);
  assert.match(html, /Busiest public coding-agent repos across three windows/);
  assert.match(html, /Bot share by window/);
  assert.doesNotMatch(html, /Location coverage by repo/);
});

test('normalizeDateWindow and isPullRequestInWindow handle inclusive ranges', () => {
  const dateWindow = normalizeDateWindow('2026-01-01', '2026-03-15');

  assert.equal(
    isPullRequestInWindow({ created_at: '2026-01-01T00:00:00Z' }, dateWindow),
    true
  );
  assert.equal(
    isPullRequestInWindow({ created_at: '2026-03-15T23:59:59Z' }, dateWindow),
    true
  );
  assert.equal(
    isPullRequestInWindow({ created_at: '2025-12-31T23:59:59Z' }, dateWindow),
    false
  );
  assert.equal(
    isPullRequestInWindow({ created_at: '2026-03-16T00:00:00Z' }, dateWindow),
    false
  );
});
