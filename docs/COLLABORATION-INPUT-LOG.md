# Collaboration Input Log

## 2026-03-19 - AI Cohort Exploration Pivot

### User Direction

- Before building a larger visualization, inspect the idea through tables, charts, and plots.
- Pull some data first.
- Build a sample HTML page for a seed AI cohort.
- Treat this as exploration, not a ship-ready product expansion.

### Resulting Decisions

- Move from single-repo product expansion to discovery-first cohort exploration.
- Use a small, high-signal AI repo cohort rather than a large scrape.
- Emphasize recent PR data and public profile metadata.
- Treat agent detection as best-effort signal classification, not ground truth.
- Build a static exploratory HTML artifact first.

### Immediate Execution Plan

1. Fetch recent PR and profile data for the cohort.
2. Produce summary tables and charts.
3. Review whether the story supports a stronger multi-repo GHPR slice.

## 2026-03-19 - Narrow To Hugging Face Only

### User Direction

- Focus on Hugging Face repos only for now.
- Do not mix in outside projects at this stage.

### Resulting Decisions

- Narrow the exploration from a cross-org AI cohort to a first-party Hugging Face cohort.
- Use a small set of active Hugging Face repos for a more controlled comparison.
- Revisit broader cross-org comparisons only after the Hugging Face-only pattern is clear.

### Immediate Execution Plan

1. Regenerate the cohort analysis using only Hugging Face repos.
2. Inspect tables and charts for geography, bot activity, and visible agent signals.
3. Rewrite the working hypothesis around the Hugging Face-only sample.

## 2026-03-19 - Coding Agent Repo Window

### User Direction

- Stay inside GitHub repo and PR analysis.
- Explore alternative open-source coding-agent repos.
- Compare a bounded window from 2026-01-01 through 2026-03-15.
- Play with the framing before deciding between biggest repos and most active repos.

### Resulting Decisions

- Reuse the cohort explorer for a date-window comparison.
- Add repo metadata so size and activity can be compared in the same artifact.
- Use a candidate coding-agent cohort rather than a broad AI-repo universe.

### Immediate Execution Plan

1. Generate a windowed comparison page for candidate coding-agent repos.
2. Compare repo size against PR activity, author diversity, and visible automation.
3. Use the output to decide whether the next slice should prioritize biggest repos, busiest repos, or a filtered subset.

## 2026-03-19 - Fixed Windows, No Location

### User Direction

- Keep the primary frame as busiest public coding-agent repos.
- Compare `2025-01-01..2025-03-15` against `2026-01-01..2026-03-15`.
- Add `2025-09-15..2025-12-31` as a bridge window.
- Drop location from the current analysis.
- Focus on software-agent and bot signals instead.
- Run a research sidecar on public discussion and existing visualizations of AI-based PRs.

### Resulting Decisions

- Add multi-window comparison mode to the explorer.
- Skip profile fetching entirely for this slice.
- Use provenance-aware language such as `agent-attributed` instead of `AI-written`.
- Treat the equal-length early windows as the anchor comparison and late 2025 as contextual support.

### Immediate Execution Plan

1. Generate a three-window coding-agent comparison artifact.
2. Verify the page in a browser and run a quick QA smoke pass.
3. Rewrite the working hypothesis around PR volume, bot share, and visible agent-attributed share over time.

## 2026-03-19 - Vendor Breakdown And Normalized Throughput

### User Direction

- Continue the exploration without broadening the scope.
- Go deeper on the current coding-agent cohort rather than adding a control group yet.

### Resulting Decisions

- Add vendor-level signal summaries on top of the existing three-window artifact.
- Surface repo `PRs/day` explicitly so the longer late-2025 window is easier to compare.
- Keep the cohort, windows, and attribution heuristic unchanged.

### Immediate Execution Plan

1. Add vendor summaries and per-day repo comparison to the report.
2. Regenerate the live HTML and JSON artifacts.
3. Re-verify the updated page in Safari and refresh the written hypothesis.

## 2026-03-19 - Bot-Opened Versus PR-Body Attribution

### User Direction

- Make the split between bot-opened PRs and PR-body attribution cleaner.

### Resulting Decisions

- Keep the existing cohort and windows unchanged.
- Separate explicit PR-body attribution from weaker login-based attribution.
- Reframe vendor charts around PR-body attribution only.

### Immediate Execution Plan

1. Refactor classification to track body and login attribution separately.
2. Update the window report to show bot-opened, PR-body attributed, and login-attributed shares.
3. Regenerate the artifact and verify the new split in Safari.
