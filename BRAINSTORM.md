# gh-pr-map — Ideas & Extensions

## Core Extensions

### 🔥 Heatmap mode
Instead of individual markers, render a density heatmap using Leaflet.heat — great for large repos with hundreds of contributors.

### 📅 Time dimension
Animate contributions over time — show when different regions "adopted" a project. Use PR `created_at` to drive a time slider.

### 🏢 Organization breakdown
Color markers by the contributor's GitHub organization affiliation. See which companies contribute most, and from where.

### 🌐 Multi-repo comparison
Accept multiple repos and show side-by-side maps or overlapping layers with different colors per repo.

### 📊 Stats sidebar
Add a collapsible sidebar showing:
- Top contributing countries/cities
- Contributor count by region
- PR volume vs. location density

## Quality of Life

### 🔍 Search/filter
Filter markers by username, location, or date range directly on the map.

### 📤 Export
Export contributor location data as CSV or GeoJSON for further analysis in QGIS/Kepler.gl.

### 🖥 Web UI
Wrap in a simple Express app with a form — enter any repo URL, click "Map it", see results without touching the CLI.

### 🐙 GitHub Action
Run as a GitHub Action on PR merge, auto-updating a hosted map in GitHub Pages.

## Data Sources

- **Commit-based**: Use `/repos/{owner}/{repo}/commits` instead of PRs for all-time contributor geography
- **Issue authors**: Map issue reporters to understand where user pain comes from geographically
- **Stars**: Map repo stargazers to understand adoption geography

## Stretch

- NLP to normalize location strings before geocoding (e.g. "Bay Area" → "San Francisco, CA")
- Detect and handle corporate VPN / P.O. Box locations
- Privacy mode: cluster at country level only
