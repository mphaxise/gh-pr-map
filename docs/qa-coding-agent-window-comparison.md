# QA Report: GHPR Coding Agent Window Comparison

| Field | Value |
| --- | --- |
| Date | 2026-03-19 |
| URL | `/Users/praneet/gh-pr-map/output/coding-agent-window-2025-vs-2026-with-late-2025.html` |
| Branch | `codex/stats-sidebar-slice` |
| Commit | `096638e` |
| Mode | Quick |
| Scope | Static HTML smoke test for the three-window coding-agent comparison page |
| Duration | ~10 minutes |
| Pages visited | 1 |
| Screenshots | 0 |

## Health Score: 92/100

| Category | Score |
| --- | --- |
| Console | 90 |
| Functional | 95 |
| Visual | 92 |
| UX | 90 |
| Accessibility | 90 |

## Top 3 Things To Fix

1. Add a repo-level `PRs/day` view so the longer `late-2025` window is normalized more visibly.
2. Split `agent-attributed` counts by detected vendor keyword so the trend is easier to interpret.
3. Surface the overlap between `bot-authored` and `agent-attributed` more explicitly near the summary cards.

## Issues

### ISSUE-001: Late-2025 normalization is still mostly tucked into the window summary

| Field | Value |
| --- | --- |
| Severity | low |
| Category | ux |
| URL | `/Users/praneet/gh-pr-map/output/coding-agent-window-2025-vs-2026-with-late-2025.html` |

Description: The page includes `PRs/day` in the window cards and summary table, but repo-level comparisons still default to raw PR totals. Because `late-2025` covers 108 days while the early windows cover 74 days, readers may overread the raw late-2025 totals unless they also notice the normalized view.

Repro steps:

1. Open the generated comparison HTML page.
2. Compare the `Window snapshots` table with the `Repo comparison table`.
3. Observe: repo-level raw totals are prominent, while per-day normalization is only visible at the window level.

Evidence:

- browser notes: Safari DOM verification confirmed the page rendered the expected cards and tables
- runtime notes: no load or rendering errors observed during smoke test

### ISSUE-002: Vendor mix is still hidden inside the agent-attributed bucket

| Field | Value |
| --- | --- |
| Severity | low |
| Category | content |
| URL | `/Users/praneet/gh-pr-map/output/coding-agent-window-2025-vs-2026-with-late-2025.html` |

Description: The current charts answer whether visible agent attribution increased, but not whether the rise is driven more by `Claude`, `Codex`, `OpenHands`, or another attribution signal. That limits how far the narrative can go without opening the raw JSON.

Repro steps:

1. Open the generated comparison HTML page.
2. Review the summary cards, window charts, and the `Visible agent-attributed PRs` table.
3. Observe: the page shows attribution counts, but no breakdown by detected signal label.

Evidence:

- browser notes: DOM check returned the expected `Visible agent-attributed PRs` section and agent-signal rows
- runtime notes: no blocking issue, but the explanatory depth is still limited

### ISSUE-003: Overlap caveat could be more prominent

| Field | Value |
| --- | --- |
| Severity | low |
| Category | content |
| URL | `/Users/praneet/gh-pr-map/output/coding-agent-window-2025-vs-2026-with-late-2025.html` |

Description: The footnote correctly says `agent-attributed` is a visible provenance hint rather than proof of full AI authorship, but the summary cards do not restate that bot and agent-attributed counts can overlap. Readers scanning only the top of the page could treat them as mutually exclusive.

Repro steps:

1. Open the generated comparison HTML page.
2. Read only the hero cards and window cards.
3. Observe: the overlap caveat is present, but easy to miss if the reader does not continue into the footnote.

Evidence:

- browser notes: Safari DOM check showed the cards correctly, with the caveat further down in the hero section
- runtime notes: this is a framing refinement, not a functional bug

## Blind Spots

- No automated console capture was available from the local static-file run; browser verification used Safari DOM inspection.
- QA covered the generated HTML artifact, not an interactive hosted flow.
- The smoke pass did not review every PR row in the large tables; it validated headings, cards, and representative rendered rows.
