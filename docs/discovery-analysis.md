# Discovery Analysis

## Session Goal

Run a discovery-first exploration of whether GHPR should stay focused on GitHub PR analysis and examine:

- busiest public coding-agent repos
- fixed PR windows instead of all-time activity
- visible bot-authored PRs
- visible agent-attributed PRs
- tables and charts before any heavier visualization choice

This pass explicitly removes location from the active question. The immediate goal is not geography. It is to see whether the public PR stream already shows a meaningful software-agent story.

## Problem Framing

The sharpest question now is:

`Did the busiest public coding-agent repos become more active, more bot-heavy, or more visibly agent-attributed between early 2025 and early 2026?`

That framing is better than a broad “AI repo” scan because:

- it stays inside GitHub repo and PR analysis
- it keeps the cohort legible
- it avoids muddying the story with sparse location metadata
- it creates a clear year-over-year comparison anchor

## What Already Exists

- single-repo GHPR map flow
- static HTML report rendering patterns
- live GitHub PR fetching
- bot and best-effort agent-signal classification
- a reusable cohort exploration script

## Exploration Scope

### In Scope

- fixed-window PR analysis for a small public coding-agent cohort
- direct comparison between `2025-01-01..2025-03-15` and `2026-01-01..2026-03-15`
- bridge window `2025-09-15..2025-12-31`
- summary cards, tables, and simple charts
- provenance-minded labels such as `agent-attributed`

### Not In Scope

- location analysis
- licensing strictness filters
- non-GitHub proprietary-company footprint analysis
- claiming all AI-assisted PRs are detectable
- shipping a hosted product or full web app

## Active Cohort

- `anthropics/claude-code`
- `OpenHands/OpenHands`
- `cline/cline`
- `Aider-AI/aider`
- `continuedev/continue`

Why this cohort:

- all are public coding-agent or coding-assistant repos
- they are active enough to show real PR flow
- they let us compare repo size and repo activity separately
- they stay close to the “software agents making PRs” question

## Window Design

- `early-2025`: `2025-01-01` through `2025-03-15` inclusive, 74 days
- `late-2025`: `2025-09-15` through `2025-12-31` inclusive, 108 days
- `early-2026`: `2026-01-01` through `2026-03-15` inclusive, 74 days

The equal-length early windows are the cleanest comparison. Late 2025 is a bridge window, not the main year-over-year claim.

## Current Findings

Generated from [output/coding-agent-window-2025-vs-2026-with-late-2025.json](/Users/praneet/gh-pr-map/output/coding-agent-window-2025-vs-2026-with-late-2025.json) on 2026-03-19:

- total sampled PRs across all three windows: `7,984`
- early-2025: `1,923` PRs, `26` PRs/day, `148` bot PRs, `32` agent-attributed PRs
- late-2025: `3,304` PRs, `30.6` PRs/day, `399` bot PRs, `86` agent-attributed PRs
- early-2026: `2,757` PRs, `37.3` PRs/day, `275` bot PRs, `282` agent-attributed PRs

Equal-window takeaway:

- early-2026 had `834` more PRs than early-2025, a `43%` increase
- bot share moved from `8%` to `10%`
- visible agent-attributed share moved from `2%` to `10%`
- repo throughput also shifted:
  - `cline/cline` moved from `5.6` PRs/day in early-2025 to `13.1` PRs/day in early-2026
  - `OpenHands/OpenHands` stayed consistently high at `11.7` and `12.2` PRs/day in the equal-length early windows
  - `anthropics/claude-code` jumped from `0.2` to `5.2` PRs/day

Repo-level pattern:

- `OpenHands/OpenHands` led early-2025 with `864` PRs
- `cline/cline` led late-2025 with `1,221` PRs and early-2026 with `970` PRs
- `anthropics/claude-code` jumped from `14` PRs in early-2025 to `384` in early-2026
- `continuedev/continue` peaked in late-2025 and cooled in early-2026

Vendor-level visible attribution pattern:

- `claude`: `304`
- `openhands`: `77`
- `codex`: `7`
- `aider`: `5`
- `copilot`: `4`
- `swe-agent`: `3`

Window split:

- early-2025 visible attribution was led by `openhands`
- late-2025 and early-2026 were both dominated by `claude`

## Working Hypothesis

The current best hypothesis is:

`Public coding-agent repos got substantially busier from early 2025 to early 2026, and the fastest-growing signal was not just raw PR count but visible agent-attributed PR activity.`

More specifically:

- total PR activity increased materially
- bot activity increased, but not as sharply as visible agent attribution
- the visible attribution mix became much more `Claude`-heavy by late-2025 and early-2026
- some repos appear to have distinct operational modes:
  - `OpenHands/OpenHands` looks consistently high-volume
  - `cline/cline` appears to surge into late 2025 and stay very active
  - `anthropics/claude-code` appears to ramp rapidly as a public PR surface

## Terminology And Caveats

Online research and platform docs support provenance-based wording.

Preferred labels:

- `agent-attributed`
- `agent-created`
- `bot-authored`

Avoid:

- `AI-written` unless the evidence standard is much stronger

Why:

- GitHub explicitly frames some agent work as co-authored with the human requester
- many human-authored PRs may still be AI-assisted without any public signal
- login and PR-body heuristics detect only visible attribution, not hidden usage

## Discovery Deliverables

- [scripts/explore_ai_cohort.js](/Users/praneet/gh-pr-map/scripts/explore_ai_cohort.js)
- [test/explore_ai_cohort.test.js](/Users/praneet/gh-pr-map/test/explore_ai_cohort.test.js)
- [output/coding-agent-window-2025-vs-2026-with-late-2025.json](/Users/praneet/gh-pr-map/output/coding-agent-window-2025-vs-2026-with-late-2025.json)
- [output/coding-agent-window-2025-vs-2026-with-late-2025.html](/Users/praneet/gh-pr-map/output/coding-agent-window-2025-vs-2026-with-late-2025.html)

## Recommended Next Step

Stay with tables-first exploration for one more slice.

Best next comparison options:

1. break vendor attribution down by repo, not just by window
2. compare PR-opened bots versus PR-body attribution signals
3. add a non-coding-agent control cohort only after the coding-agent trend is well-characterized
