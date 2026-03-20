# QA Report: GHPR Coding Agent Window Comparison

| Field | Value |
| --- | --- |
| Date | 2026-03-19 |
| URL | `/Users/praneet/gh-pr-map/output/coding-agent-window-2025-vs-2026-with-late-2025.html` |
| Branch | `codex/stats-sidebar-slice` |
| Commit | working tree |
| Mode | Quick |
| Scope | Static HTML smoke test for the three-window coding-agent comparison page |
| Duration | ~10 minutes |
| Pages visited | 1 |
| Screenshots | 0 |

## Health Score: 96/100

| Category | Score |
| --- | --- |
| Console | 90 |
| Functional | 95 |
| Visual | 95 |
| UX | 96 |
| Accessibility | 90 |

## Top 3 Things To Fix

1. Break PR-body attribution down by repo and vendor together.
2. Add a small explanation near the vendor table about why `Claude` dominates the PR-body signal in this sample.
3. Surface login-attributed examples separately so the weaker signal is even easier to inspect.

## Issues

### ISSUE-001: Repo-by-vendor attribution is still missing

| Field | Value |
| --- | --- |
| Severity | low |
| Category | content |
| URL | `/Users/praneet/gh-pr-map/output/coding-agent-window-2025-vs-2026-with-late-2025.html` |

Description: The page now cleanly separates bot-opened PRs, explicit PR-body attribution, and login-attributed PRs. It also shows PR-body vendor totals, but it still does not show which repos are driving the `Claude`-heavy body-attribution pattern. That means the next natural reader question still requires opening the JSON.

Repro steps:

1. Open the generated comparison HTML page.
2. Review `PR-body attribution by vendor` and `PR-body vendor signals by window`.
3. Observe: the page explains vendor totals, but not which repos contribute most to each vendor.

Evidence:

- browser notes: Safari DOM verification confirmed the body-vendor bars and vendor-window table rendered as expected
- runtime notes: no load or rendering errors observed during smoke test

### ISSUE-002: Login-attributed examples are present but not isolated into their own view

| Field | Value |
| --- | --- |
| Severity | low |
| Category | content |
| URL | `/Users/praneet/gh-pr-map/output/coding-agent-window-2025-vs-2026-with-late-2025.html` |

Description: The page now exposes login-attributed counts and includes source columns in the examples table, which is much cleaner. A dedicated login-attributed slice or filter would still make it faster to inspect the weaker attribution cases without reading across the larger mixed examples table.

Repro steps:

1. Open the generated comparison HTML page.
2. Review `Login-attributed share by window` and `Visible attribution examples`.
3. Observe: login-attributed evidence is present, but still embedded in the broader examples table.

Evidence:

- browser notes: DOM check returned the expected hero cards, split-share headings, and visible attribution rows
- runtime notes: no blocking issue, but the explanatory depth is still limited

### ISSUE-003: The page could narrate the `Claude` spike more directly

| Field | Value |
| --- | --- |
| Severity | low |
| Category | content |
| URL | `/Users/praneet/gh-pr-map/output/coding-agent-window-2025-vs-2026-with-late-2025.html` |

Description: The updated page clearly shows `Claude` as the dominant PR-body attribution vendor, but the narrative sections do not yet spell out that the jump from the old combined attribution bucket to the cleaner body-only view also shrinks `OpenHands` materially.

Repro steps:

1. Open the generated comparison HTML page.
2. Read the hero, `PR-body attribution by vendor`, and `What this page is good for`.
3. Observe: the numbers are present, but the main narrative does not yet name the body-vs-login distinction directly.

Evidence:

- browser notes: Safari DOM check showed the split summary cards and new body-vendor sections correctly
- runtime notes: this is a framing refinement, not a functional bug

## Blind Spots

- No automated console capture was available from the local static-file run; browser verification used Safari DOM inspection.
- QA covered the generated HTML artifact, not an interactive hosted flow.
- The smoke pass did not review every PR row in the large tables; it validated headings, cards, and representative rendered rows, including one explicit body-attribution example.
