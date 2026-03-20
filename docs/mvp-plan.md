# MVP Plan

## MVP Statement

Advance GHPR from "it plots contributor pins" to "it explains contributor geography" without changing the core CLI workflow.

## Slice Scope

### In Scope

- contributor PR counts
- enriched geocode metadata when available
- summary cards in the HTML output
- top-country and top-location breakdowns
- ranked contributor roster
- map fit-to-data
- empty/no-data states
- minimal automated tests

### Later

- search and filter controls
- clustering or heatmap mode
- multi-repo support
- export formats
- hosted UI

## Milestone 1: First 60-90 Minutes

- Add docs for strategy and scope
- Refactor current logic into testable helpers
- Render a sidebar with summary blocks and roster
- Add one or two focused tests

## Milestone 2: End Of Day

- Generate at least one real HTML artifact from a live repo
- Run browse-style verification on the generated page
- Run a quick QA pass
- Leave a short backlog of the next highest-value follow-ups

## Risks And Assumptions

- Live verification depends on network access for GitHub and Nominatim
- Small repos may still produce empty or sparse maps, so UX for those cases matters
- This MVP improves interpretability, not data coverage

## Not In Scope

- Authentication flows
- Browser session setup
- Backend persistence
- Deployment work
- Shipping a PR unless the branch is clean, reviewed, and ready
