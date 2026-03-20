# gh-pr-map

> Visualize where GitHub pull request contributors are located with a static geography report and interactive world map.

Given any GitHub repo, this tool fetches PR authors, reads their optional profile location, geocodes it via OpenStreetMap, and renders a self-contained Leaflet HTML report with an interactive map, summary cards, and contributor roster.

## Quick Start

```bash
# No dependencies — just Node.js!
node map_prs.js <owner/repo>

# Example:
node map_prs.js facebook/react
node map_prs.js microsoft/vscode --limit 500
```

Then open `output/map.html` in your browser.

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `--token` | `$GITHUB_TOKEN` | GitHub Personal Access Token (higher rate limits) |
| `--state` | `all` | PR state: `open`, `closed`, or `all` |
| `--limit` | `200` | Max PRs to fetch |
| `--out` | `output/map.html` | Output HTML path |

## How It Works

```
GitHub API → PRs → Unique Authors → Profile Locations → Geocode (Nominatim) → Leaflet Map
```

1. **Fetch PRs** via GitHub REST API
2. **Deduplicate** by contributor login
3. **Read profile** location field (free-text, e.g. "San Francisco, CA")
4. **Geocode** using Nominatim (OpenStreetMap) — 1 req/sec, no API key needed
5. **Cache** results in `.geocache.json` so re-runs are fast and old entries can be enriched over time
6. **Render** a self-contained HTML report with:
   - summary cards for PRs, contributors, mapped contributors, and countries
   - top-country and top-location rollups
   - a clickable contributor roster that focuses markers on the map
   - clear empty states for repos with no PRs or no mappable contributors

## Output

A single `output/map.html` file — open directly in any browser, no server needed.

Each report includes:
- summary cards for repo coverage
- top countries and top locations
- contributor roster sorted by PR count
- map markers with popups

Each marker popup shows:
- GitHub avatar
- Username (links to GitHub profile)
- PR count
- Geocoded location string

## Requirements

- Node.js v16+
- Internet (GitHub API + Nominatim)
- Optional: `GITHUB_TOKEN` env var for higher API rate limits

## Testing

```bash
npm test
```

## Exploration Scripts

The repo also includes a discovery-first cohort explorer for PR activity analysis before committing to a bigger product slice.

```bash
# Generic cohort explorer
npm run explore:cohort -- --help

# Current coding-agent window comparison
npm run explore:agent-windows
```

The current comparison artifact writes:

- `output/coding-agent-window-2025-vs-2026-with-late-2025.json`
- `output/coding-agent-window-2025-vs-2026-with-late-2025.html`

This exploration mode is optimized for:

- fixed date-window comparisons
- bot-opened PR detection
- explicit PR-body attribution versus login-attributed signals
- vendor-level attribution breakdowns from visible PR metadata
- tables and simple charts instead of map output

## Notes

- Only uses publicly visible GitHub profile data
- Contributors without a location set are skipped
- Nominatim rate-limited to 1 req/sec per [usage policy](https://operations.osmfoundation.org/policies/nominatim/)

## Ideas / Extensions

See [BRAINSTORM.md](BRAINSTORM.md) for potential next features.

## Strategy Docs

- [docs/idea-strategy.md](docs/idea-strategy.md)
- [docs/product-strategy.md](docs/product-strategy.md)
- [docs/implementation-strategy.md](docs/implementation-strategy.md)
- [docs/mvp-plan.md](docs/mvp-plan.md)

## Experiment Variations

- [docs/experiment-variation-public-ai-authorship-prior-art.md](docs/experiment-variation-public-ai-authorship-prior-art.md)
