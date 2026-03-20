# QA Report: GHPR Coding Agent Window Comparison

| Field | Value |
| --- | --- |
| Date | 2026-03-19 |
| URL | `/Users/praneet/gh-pr-map/output/coding-agent-window-2025-vs-2026-with-late-2025.html` |
| Branch | `codex/stats-sidebar-slice` |
| Commit | working tree after `978c2bb` |
| Mode | Quick |
| Scope | Static HTML smoke test for the three-window coding-agent comparison page |
| Duration | ~10 minutes |
| Pages visited | 1 |
| Screenshots | 0 |

## Health Score: 95/100

| Category | Score |
| --- | --- |
| Console | 90 |
| Functional | 95 |
| Visual | 92 |
| UX | 94 |
| Accessibility | 90 |

## Top 3 Things To Fix

1. Break vendor attribution down by repo, not just overall and by window.
2. Separate bot-opened PRs from PR-body attribution signals more explicitly.
3. Add a small explanation near the vendor table about why `Claude` dominates the visible signal in this sample.

## Issues

### ISSUE-001: Vendor mix is still hidden at the repo level

| Field | Value |
| --- | --- |
| Severity | low |
| Category | content |
| URL | `/Users/praneet/gh-pr-map/output/coding-agent-window-2025-vs-2026-with-late-2025.html` |

Description: The page now shows overall vendor totals and vendor-by-window counts, which is a clear improvement, but it still does not show which repos are driving the `Claude`-heavy visible attribution pattern. That means the next natural reader question still requires opening the JSON.

Repro steps:

1. Open the generated comparison HTML page.
2. Review `Agent attribution by vendor` and `Vendor signals by window`.
3. Observe: the page explains vendor totals, but not which repos contribute most to each vendor.

Evidence:

- browser notes: Safari DOM verification confirmed the vendor bars and vendor-window table rendered as expected
- runtime notes: no load or rendering errors observed during smoke test

### ISSUE-002: Bot and attribution provenance are still combined at the summary level

| Field | Value |
| --- | --- |
| Severity | low |
| Category | ux |
| URL | `/Users/praneet/gh-pr-map/output/coding-agent-window-2025-vs-2026-with-late-2025.html` |

Description: The summary cards still compress `bot-authored` and `agent-attributed` into adjacent topline numbers. The page explains the caveat, but a faster visual split between bot-opened PRs and body-attributed PRs would make the provenance story easier to scan.

Repro steps:

1. Open the generated comparison HTML page.
2. Review the hero cards and the vendor sections.
3. Observe: the page shows both metrics, but does not visually separate authorship provenance modes.

Evidence:

- browser notes: DOM check returned the expected hero cards, vendor bars, and visible PR rows
- runtime notes: no blocking issue, but the explanatory depth is still limited

### ISSUE-003: The page could narrate the `Claude` spike more directly

| Field | Value |
| --- | --- |
| Severity | low |
| Category | content |
| URL | `/Users/praneet/gh-pr-map/output/coding-agent-window-2025-vs-2026-with-late-2025.html` |

Description: The updated page clearly shows `Claude` as the dominant visible attribution vendor, but the narrative sections do not yet spell out that the big visible-attribution jump from late-2025 to early-2026 is mostly a `Claude` story in this sample.

Repro steps:

1. Open the generated comparison HTML page.
2. Read the hero, vendor bars, and `What this page is good for`.
3. Observe: the numbers are present, but the main narrative does not yet name the vendor shift directly.

Evidence:

- browser notes: Safari DOM check showed the new vendor sections correctly
- runtime notes: this is a framing refinement, not a functional bug

## Blind Spots

- No automated console capture was available from the local static-file run; browser verification used Safari DOM inspection.
- QA covered the generated HTML artifact, not an interactive hosted flow.
- The smoke pass did not review every PR row in the large tables; it validated headings, cards, and representative rendered rows.
