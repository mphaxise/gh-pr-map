# Implementation Strategy

## Goal

Implement a small, safe improvement to the current CLI and renderer so the generated HTML behaves like a geography report, not just a pin canvas.

## Architecture And Tech Choices

- Keep Node.js + CommonJS
- Keep a single executable entrypoint: `map_prs.js`
- Add pure helper functions inside the current file so we can test summary and rendering logic without introducing build tooling
- Continue using Leaflet from CDN in the generated HTML
- Continue using `.geocache.json`, but support richer cached geocode metadata while remaining backward-compatible with old `{lat,lng}` entries

## Current Codepath

```text
GitHub PRs -> unique logins -> GitHub profiles -> location strings
-> Nominatim geocode -> contributor list -> render Leaflet HTML
```

## Proposed Delta

```text
GitHub PRs -> contributor counts + profiles -> enriched geocode metadata
-> summary rollups -> render Leaflet map + stats sidebar + empty states
```

## Execution Plan

1. Add helper functions for:
   - counting PRs per contributor
   - normalizing cached geocode entries
   - extracting country and location labels from geocoder responses
   - computing summary rollups
   - escaping HTML safely for rendered content
2. Update the renderer to:
   - show summary cards
   - show top countries and top locations
   - show a ranked contributor roster
   - fit bounds when markers exist
   - show explicit empty states when no markers exist
3. Expose helper functions for tests and guard `main()` with `require.main === module`
4. Add `node --test` coverage for summary generation and empty-state rendering
5. Generate a real HTML artifact from a live repo and verify it

## Edge Cases To Handle

- Repo has zero PRs
- Repo has PRs but no contributors with profile locations
- Old cache entries only contain coordinates
- Geocoder returns coordinates without address details
- Raw location strings contain HTML-significant characters

## Risks And Assumptions

- Country rollups depend on best-effort geocoder metadata
- Marker overlap remains possible for identical or nearby coordinates
- The HTML page should stay readable without adding frontend dependencies

## Minimal Test Plan

- Summary rollups count contributors, PRs, countries, and locations correctly
- Empty-state HTML renders useful guidance when there are no markers
- Rendered HTML includes the new sidebar sections for non-empty inputs

## Explicit Not In Scope

- Splitting the app into multiple runtime packages
- Introducing a server, React app, or API layer
- Adding search, clustering, or time animation in this pass

## 60-90 Minute First Milestone

Land the helper functions, sidebar HTML, and tests in a way that still preserves the existing CLI contract.

## End-Of-Day Outcome

`node map_prs.js <owner/repo>` produces a more informative static report that can be smoke-tested locally and reviewed in a browser.
