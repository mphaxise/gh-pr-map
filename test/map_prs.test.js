const test = require('node:test');
const assert = require('node:assert/strict');

const { buildSummary, renderHTML } = require('../map_prs');

test('buildSummary aggregates contributor geography and coverage', () => {
  const contributors = [
    {
      id: 1,
      login: 'alice',
      prCount: 3,
      avatar: 'https://example.com/alice.png',
      profileUrl: 'https://github.com/alice',
      location: 'San Francisco, CA',
      locationLabel: 'San Francisco',
      displayName: 'San Francisco, California, United States',
      country: 'United States',
      lat: 37.7749,
      lng: -122.4194,
    },
    {
      id: 2,
      login: 'bob',
      prCount: 2,
      avatar: 'https://example.com/bob.png',
      profileUrl: 'https://github.com/bob',
      location: 'New York, NY',
      locationLabel: 'New York',
      displayName: 'New York, United States',
      country: 'United States',
      lat: 40.7128,
      lng: -74.006,
    },
    {
      id: 3,
      login: 'carol',
      prCount: 1,
      avatar: 'https://example.com/carol.png',
      profileUrl: 'https://github.com/carol',
      location: 'Toronto, Canada',
      locationLabel: 'Toronto',
      displayName: 'Toronto, Ontario, Canada',
      country: 'Canada',
      lat: 43.6532,
      lng: -79.3832,
    },
  ];

  const summary = buildSummary({
    repo: 'owner/repo',
    totalPrs: 8,
    uniqueContributors: 4,
    contributorsWithProfileLocation: 4,
    unmappedContributors: 1,
    contributors,
  });

  assert.equal(summary.mappedContributors, 3);
  assert.equal(summary.countriesRepresented, 2);
  assert.deepEqual(summary.topCountries.slice(0, 2), [
    { label: 'United States', count: 2 },
    { label: 'Canada', count: 1 },
  ]);
  assert.deepEqual(summary.topLocations.slice(0, 2), [
    { label: 'New York', count: 1 },
    { label: 'San Francisco', count: 1 },
  ]);
  assert.equal(summary.cards[2].hint, '1 unresolved, 0 missing locations');
});

test('renderHTML shows a useful empty state when there are no PRs', () => {
  const summary = buildSummary({
    repo: 'owner/repo',
    totalPrs: 0,
    uniqueContributors: 0,
    contributorsWithProfileLocation: 0,
    unmappedContributors: 0,
    contributors: [],
  });

  const html = renderHTML('owner/repo', [], summary);

  assert.match(html, /No pull requests found yet/);
  assert.match(html, /Contributor roster/);
  assert.match(html, /No mapped contributors yet/);
});

test('renderHTML includes the report sections for mapped contributors', () => {
  const contributors = [
    {
      id: 1,
      login: 'dana',
      prCount: 4,
      avatar: 'https://example.com/dana.png',
      profileUrl: 'https://github.com/dana',
      location: 'Paris, France',
      locationLabel: 'Paris',
      displayName: 'Paris, Ile-de-France, France',
      country: 'France',
      lat: 48.8566,
      lng: 2.3522,
    },
  ];

  const summary = buildSummary({
    repo: 'owner/repo',
    totalPrs: 4,
    uniqueContributors: 1,
    contributorsWithProfileLocation: 1,
    unmappedContributors: 0,
    contributors,
  });

  const html = renderHTML('owner/repo', contributors, summary);

  assert.match(html, /Top countries/);
  assert.match(html, /Top locations/);
  assert.match(html, /GHPR Map/);
  assert.match(html, /dana/);
  assert.match(html, /4 PRs/);
});
