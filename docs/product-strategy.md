# Product Strategy

## Product Goal

GHPR should feel like a one-command geography snapshot for GitHub repositories. The product advantage is not depth or hosting; it is that the output is lightweight, immediate, and shareable.

## Problem Statement

Pin maps alone are weak summaries. Users need to understand the shape of contributor geography, not just click around to discover it marker by marker.

## Target Users

- Open source maintainers doing quick project analysis
- Builders exploring contributor distribution across repos
- People who want a static artifact they can open locally or attach to a writeup

## Current Repo Leverage

- Zero-dependency Node CLI
- Existing GitHub and Nominatim pipeline
- Self-contained HTML artifact with no server requirement
- Existing brainstorm aligned with a statistics-first improvement

## Best Next Slice

Improve the output artifact before expanding the input surface:

- make the generated map interpretable at a glance
- surface the leading locations and contributors
- keep the workflow as `CLI -> static HTML`

## Why This Slice Wins

- It compounds current repo leverage instead of replacing it
- It creates a better demo for both sparse and moderately active repos
- It increases product value without requiring deployment or auth work
- It keeps the repo easy to understand and easy to run

## Scope: Now Vs Later

### Now

- Summary cards
- Country or location rollups when available
- Ranked contributor roster with PR counts
- Better empty states and map framing

### Later

- Search and filtering
- Export formats
- Heatmap or cluster mode
- Time slider
- Web UI

## Risks And Assumptions

- Some geocodes will only resolve to broad places
- Country extraction will be best-effort, not guaranteed
- Static HTML remains the right delivery choice for the near term

## Not In Scope

- Full analytics dashboard
- User accounts or saved reports
- Hosted backend services
- Organization-level enrichment

## 60-90 Minute First Milestone

Ship the first useful "report-like" HTML page using the existing CLI data path.

## End-Of-Day Outcome

The repo demonstrates a clear product step beyond proof of concept: a static geography report that is easier to interpret and easier to share.
