# Implementation Options

## Recommended Option: Fixed-Window Coding-Agent Comparison

Build on the cohort explorer so it can:

- compare multiple named windows in one run
- skip profile and location fetching
- reuse the same public coding-agent cohort across windows
- break visible agent attribution out by vendor signal
- render a static HTML page with cards, tables, and simple bar charts

### Why This Wins

- best fit for the current question
- keeps scope inside GitHub PR analysis
- makes year-over-year comparison explicit
- reduces noise by dropping location
- stays lightweight and runnable in the current repo

## Option 2: Keep Single-Window Exploration Only

Generate one page per window and compare manually.

### Why Not Now

- makes the trend harder to read
- forces the user to mentally reconcile multiple artifacts
- loses the bridge-window story

## Option 3: Jump To Richer Visualization

Build timelines, interactive filters, or a hosted dashboard now.

### Why Not Yet

- the core claim is still being validated
- a table-first artifact is enough to test the hypothesis
- premature UI depth would add work faster than insight

## Chosen Path

Use Option 1 for this session.

## Minimal Artifact Set

- [scripts/explore_ai_cohort.js](/Users/praneet/gh-pr-map/scripts/explore_ai_cohort.js)
- [test/explore_ai_cohort.test.js](/Users/praneet/gh-pr-map/test/explore_ai_cohort.test.js)
- [output/coding-agent-window-2025-vs-2026-with-late-2025.json](/Users/praneet/gh-pr-map/output/coding-agent-window-2025-vs-2026-with-late-2025.json)
- [output/coding-agent-window-2025-vs-2026-with-late-2025.html](/Users/praneet/gh-pr-map/output/coding-agent-window-2025-vs-2026-with-late-2025.html)

## Evaluation Criteria

The exploration is successful if the output page makes these questions easy to answer:

- which repo is busiest in each fixed window?
- which repo has the highest normalized `PRs/day` in each window?
- did the equal-length early windows change in total PR volume?
- did visible bot share change?
- did visible agent-attributed share change more sharply than total PR volume?
- which visible attribution vendor dominates each window?
- which repos are driving the shift?

## Follow-On Paths If This Holds Up

1. repo-by-vendor attribution view: `Claude`, `Codex`, `OpenHands`, `Copilot`, `Aider`
2. repo-normalized rates instead of raw PR totals
3. control cohort comparison after the coding-agent baseline is stable
