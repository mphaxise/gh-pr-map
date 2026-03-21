# Experiment Variation: OpenClaw Windowed Manual Review

Prepared on `2026-03-20` for the GHPR exploration.

This note records a manual review pass over the ambiguous repos from the OpenClaw explicit-PR sample for the window `2025-10-01` to `2026-03-15`, excluding `openclaw/openclaw`.

Related artifacts:

- [experiment-variation-vibe-coding-landscape.md](./experiment-variation-vibe-coding-landscape.md)
- [openclaw-manual-review-2025-10-01-to-2026-03-15.json](../data/openclaw-manual-review-2025-10-01-to-2026-03-15.json)

## Scope

Source run:

```bash
npm run explore:openclaw-explicit-prs -- --sample-size 100 --per-query 100 --date-from 2025-10-01 --date-to 2026-03-15 --exclude-repos openclaw/openclaw --manual-review-limit 50
```

That run produced:

- `73` deduped explicit OpenClaw PRs
- `57` unique repos
- `32` ambiguous repos queued for manual review

## Label Policy

For this manual pass, I used the following interpretation:

- `app repo`: user-facing application, site, or standalone product/tool repo
- `plugin/add-on`: integration, extension, skill pack, config collection, or downstream add-on layer
- `agent infra`: agent platform, orchestrator, workflow engine, deployment/runtime wrapper, template, or control-plane repo
- `unclear`: community/docs/config repo or mixed case that did not fit the other buckets cleanly

One important nuance: `app repo` here includes standalone software products and developer tools, not only consumer-facing GUI apps.

## Before And After

Heuristic bucket counts before manual review:

- `agent infra`: `47` repos / `60` PRs
- `plugin/add-on`: `5` repos / `8` PRs
- `app repo`: `5` repos / `5` PRs

After manual review of the `32` ambiguous repos:

- `agent infra`: `28` repos / `31` PRs
- `app repo`: `13` repos / `19` PRs
- `plugin/add-on`: `12` repos / `17` PRs
- `unclear`: `4` repos / `6` PRs

## Takeaways

- The heuristic was too eager to call mixed repos `agent infra`.
- Manual review materially enlarged the `app repo` bucket, especially by reclassifying repos like `sledtools/pika`, `tianxiao1430-jpg/kuma-claw`, `projectdiscovery/nuclei`, `roseforljh/EveryTalk`, and `biomejs/biome`.
- The `plugin/add-on` bucket also grew after manually moving explicit extension/integration repos such as `agentcontrol/openclaw-plugin`, `BankrBot/skills`, `MemphisOS-OpenClaw`, and `openclaw-memory-core-plus`.
- Only `4` repos remained genuinely unclear after inspection: `funkymonkeymonk/nix`, `hesamsheikh/awesome-openclaw-usecases`, `bitcoin/bips`, and `milvus-io/community`.

## Reviewed Repos

| Repo | PRs | Reviewed label | Reason |
|---|---:|---|---|
| `sledtools/pika` | 4 | `app repo` | End-to-end encrypted messaging app across iOS, Android, desktop, and CLI. |
| `tianxiao1430-jpg/kuma-claw` | 4 | `app repo` | Intelligent office assistant product rather than a generic agent framework. |
| `scarnyc/sentinel` | 2 | `plugin/add-on` | OpenClaw-specific security integration and plugin wiring. |
| `projectdiscovery/nuclei` | 1 | `app repo` | Standalone security scanner product/tool rather than agent infra. |
| `jadsondamasceno77-cmyk/JOD_ROBO` | 1 | `agent infra` | Autonomous multi-agent software-development system. |
| `pesulabs/pesuclaw` | 1 | `agent infra` | Overlay runtime and deployment tooling around OpenClaw. |
| `roseforljh/EveryTalk` | 1 | `app repo` | User-facing intelligent conversation platform. |
| `funkymonkeymonk/nix` | 1 | `unclear` | Generic Nix config repo with one OpenClaw-related addition. |
| `electron-rare/Kill_LIFE` | 1 | `agent infra` | AI-native embedded-project template and workflow scaffold. |
| `vignesh07/clawdbot-railway-template` | 1 | `agent infra` | Deployment template and onboarding wrapper for OpenClaw. |
| `deepmodeling/reacnetgenerator` | 1 | `app repo` | Standalone scientific software tool. |
| `srinivas486/skillfield-landing` | 1 | `app repo` | Landing site / web property. |
| `AINYC/aeo-audit` | 1 | `app repo` | Standalone audit product/tool. |
| `BankrBot/skills` | 1 | `plugin/add-on` | Skill collection for builders; plugin-style ecosystem package. |
| `Monkey-D-Luisi/vibe-flow` | 1 | `agent infra` | Autonomous multi-agent product-team framework. |
| `openclaw/lobster` | 1 | `agent infra` | Workflow shell and automation engine for OpenClaw. |
| `rjmurillo/ai-agents` | 1 | `agent infra` | Multi-agent framework for software-development workflows. |
| `daggerhashimoto/openclaw-nerve` | 1 | `agent infra` | Cockpit/control-plane style product for operating OpenClaw agents. |
| `agentcontrol/openclaw-plugin` | 1 | `plugin/add-on` | Explicit OpenClaw plugin. |
| `nsxdavid/anthropic-max-router` | 1 | `agent infra` | Routing and compatibility layer for agent/tool use. |
| `Memphis-Chains/MemphisOS-OpenClaw` | 1 | `plugin/add-on` | Downstream OpenClaw integration pack for another platform. |
| `Gen-Verse/OpenClaw-RL` | 1 | `agent infra` | Agent training / reinforcement-learning layer. |
| `augmentedmike/miniclaw-os` | 1 | `agent infra` | Cognitive architecture / memory-planning layer for agents. |
| `hesamsheikh/awesome-openclaw-usecases` | 1 | `unclear` | Community use-case collection rather than app, plugin, or infra code. |
| `thedotmack/claude-mem` | 1 | `plugin/add-on` | Plugin-style context/memory extension with IDE integrations. |
| `aloong-planet/openclaw-memory-core-plus` | 1 | `plugin/add-on` | OpenClaw memory enhancement extension. |
| `bitcoin/bips` | 2 | `unclear` | Standards/docs repository; not cleanly an app, plugin, or agent-infra repo. |
| `milvus-io/community` | 2 | `unclear` | Community/blog repository rather than a direct app or integration package. |
| `ArchieIndian/openclaw-superpowers` | 2 | `plugin/add-on` | Skill pack and extension bundle for OpenClaw. |
| `KamNoob/everything-claude-code` | 1 | `plugin/add-on` | Configuration and extension collection rather than a standalone product repo. |
| `biomejs/biome` | 1 | `app repo` | Standalone developer product/toolchain rather than agent infra. |
| `dontriskit/submarine` | 1 | `app repo` | Standalone product/project repo rather than a plugin or agent framework. |

## Bottom Line

After a human pass, the windowed OpenClaw sample still leans infrastructure-heavy, but much less extremely than the heuristic suggested. In this reviewed slice, explicit OpenClaw PRs from `2025-10-01` to `2026-03-15` point to a mixed ecosystem:

- a substantial `agent infra` core
- a real `plugin/add-on` layer
- a non-trivial `app repo` bucket

That makes OpenClaw look less like "only agent infrastructure" and more like an ecosystem that is visibly touching all three surfaces.
