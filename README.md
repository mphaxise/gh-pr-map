# gh-pr-map

> Visualize where GitHub pull request contributors are located — plot them on an interactive world map.

Given any GitHub repo, this tool fetches PR authors, reads their optional profile location, geocodes it via OpenStreetMap, and renders a self-contained interactive Leaflet HTML map.

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
5. **Cache** results in `.geocache.json` so re-runs are instant
6. **Render** a dark-themed, interactive HTML map with contributor cards on click

## Output

A single `output/map.html` file — open directly in any browser, no server needed.

Each marker shows:
- GitHub avatar
- Username (links to GitHub profile)
- Location string

## Requirements

- Node.js v16+
- Internet (GitHub API + Nominatim)
- Optional: `GITHUB_TOKEN` env var for higher API rate limits

## Notes

- Only uses publicly visible GitHub profile data
- Contributors without a location set are skipped
- Nominatim rate-limited to 1 req/sec per [usage policy](https://operations.osmfoundation.org/policies/nominatim/)

## Ideas / Extensions

See [BRAINSTORM.md](BRAINSTORM.md) for potential next features.
