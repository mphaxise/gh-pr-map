# Advance gh-pr-map: Interactive map of GitHub PR contributors by location

## Idea Context

- Project name: GHPR Map
- Short name: GHPR
- Rank: 2
- Priority: 7
- Source: Repository gh-pr-map
- Idea link: https://github.com/mphaxise/gh-pr-map
- Review date: 2026-03-20

## Problem Statement

The repo already proves that GitHub PR contributors can be fetched, geocoded, and plotted on a static HTML map. What it does not yet do well is help someone understand the geography quickly. A pin-only map is hard to read for larger repos and confusing for sparse repos, including `mphaxise/gh-pr-map`, which currently produces an empty map because it has no PR data yet.

## Real User Outcome

Generate a self-contained artifact that answers, within a few seconds, "where do contributors to this repo come from?" without requiring a server, dashboard backend, or manual analysis.

## Target Users

- Repository maintainers who want a fast visual summary of contributor geography
- Curious open source contributors exploring who participates in a project
- Project owners who want a shareable static artifact rather than a hosted app

## Current Repo Leverage

- Working CLI fetches PRs from GitHub and deduplicates authors
- Existing geocoding cache avoids repeated Nominatim requests
- HTML output is already self-contained enough to open directly in a browser
- README and brainstorm list already point toward a stats-oriented next step

## Current Repo Audit

### Current CLI Flow

`node map_prs.js <owner/repo>` fetches PRs, extracts unique authors, fetches profiles, geocodes profile locations, caches coordinates, and writes `output/map.html`.

### Current HTML Output Flow

The renderer writes a single Leaflet page with a dark header and one marker per contributor. Popups show avatar, GitHub link, and raw location text.

### Existing Map Behavior

- No summary beyond contributor count
- No ranked breakdown by country, city, or contributor volume
- No empty-state guidance when a repo has zero PRs or zero mappable contributors
- Map always starts at a fixed world view instead of fitting to actual data

### Brainstormed Extensions Already Captured

- Stats sidebar
- Search/filter
- Heatmap
- Time dimension
- Multi-repo comparison
- Web UI
- Export

## Chosen Slice For This Session

Turn the generated HTML map into a lightweight geography report:

- add repo-level summary cards
- add top-country and top-location rollups
- add a ranked contributor roster with PR counts
- fit the map to available markers
- show clear empty-state messaging when there is no data to plot

## Scope For This Slice Vs Later

### This Slice

- Better data shaping from the existing PR and geocoder responses
- Better HTML output using the current static-map model
- Small tests for summary and rendering logic

### Later

- Search and filtering controls
- Heatmap and clustering
- Time-based animation
- Multi-repo compare
- Hosted web UI or GitHub Action automation
- CSV or GeoJSON export

## Risks And Assumptions

- GitHub profile locations are free text and sometimes low quality
- Nominatim metadata may not always include clean country or city fields
- Repos with many contributors can still create crowded markers; this slice improves readability but does not solve clustering
- The best near-term value is in analysis and readability, not more input surfaces

## Explicit Not In Scope

- Adding a server or database
- Building a form-based web UI
- Supporting multiple repos in one run
- Animating data over time
- Adding organization enrichment

## 60-90 Minute First Milestone

- Create strategy docs
- Refactor `map_prs.js` into testable helper functions
- Compute contributor PR counts and summary rollups
- Render a sidebar and empty states in the HTML

## End-Of-Day Outcome

A user can run the existing CLI, open the generated HTML file, and immediately see contributor totals, leading countries or locations, a ranked contributor roster, and a map view that behaves well even when the repo has no plottable data.
