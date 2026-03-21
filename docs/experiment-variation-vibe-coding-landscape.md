# Experiment Variation: Vibe Coding Landscape And OpenClaw Positioning

Prepared on `2026-03-20` for the GHPR exploration.

This document is a companion to the prior-art report, but it answers a different question. The prior-art page is about public authorship-classification research. This page is about the current product landscape: which tools people are using to generate apps, how those tools should be grouped for analysis, and where OpenClaw fits.

Related background:

- [experiment-variation-public-ai-authorship-prior-art.md](./experiment-variation-public-ai-authorship-prior-art.md)

## Question

What are the main "vibe coding" or agentic app-building tools people are using right now, how should we group overlapping products, and where does OpenClaw fit in that environment?

## Short Answer

The market is real, but it is not one flat category.

The cleanest way to track it is to separate:

- `vendor family`: Anthropic, OpenAI, Replit, Vercel, Google, GitHub, and so on
- `product surface`: CLI agent, IDE agent, browser app builder, cloud coding workspace
- `use case`: new app, existing repo, or both

That avoids double-counting products that sit in the same vendor family but have very different workflows.

## Why This Is A Separate Note

This research is adjacent to repo-level authorship classification, but it is not the same problem.

- The prior-art page helps us design labels and evidence fusion.
- This page helps us decide which ecosystems to sample, which provenance strings to search for, and which products should be treated as separate surfaces versus one family.

## Top 10 Product Surfaces

These are not ranked as exact market-share winners. They are the ten most visible product surfaces worth tracking for GHPR as of `2026-03-20`.

| Product surface | Company | Primary mode | Best fit | Why it matters now |
|---|---|---|---|---|
| `Lovable` | Lovable | browser app builder | new apps, rapid iteration | Strong greenfield app-builder posture and unusually large public growth claims in its one-year update |
| `Replit Agent` | Replit | cloud workspace plus agent | both | One of the clearest "idea to deployed app" products, with agent and runtime in one loop |
| `Cursor` | Anysphere | IDE agent/editor | existing repos, also full apps | One of the dominant editor-native coding-agent surfaces |
| `Windsurf` | Windsurf | IDE agent/editor | existing repos, also full apps | Strong enterprise-oriented coding-agent product with visible momentum |
| `Claude Code` | Anthropic | terminal/CLI agent | existing repos | A major repo-first and task-loop-first agentic coding surface |
| `OpenAI Codex` | OpenAI | multi-surface coding agent | both | Important because it spans app, IDE, terminal, and computer-use workflows |
| `GitHub Copilot` | GitHub / Microsoft | IDE, CLI, and GitHub-native assistant | existing repos, also both | Not purely "vibe coding," but still one of the biggest active coding-agent surfaces |
| `v0` | Vercel | browser app builder | new apps, frontend-heavy MVPs | Important for prompt-to-UI and app-scaffold workflows |
| `Firebase Studio` | Google | cloud IDE plus app prototyper | both | Explicitly positions itself as a prompt-driven full-stack app environment |
| `Bolt.new` | StackBlitz | browser app builder | new apps and prototypes | One of the most visible browser-native full-app generators |

## Product Notes

### 1. Lovable

- Surface: browser app builder and full-stack app generator
- Best for: greenfield app generation, quick product ideas, and iterative prompt-driven app building
- Public evidence: Lovable's `2025-11-18` one-year post says the product reached `100,000` new projects per day and `5M` visits per day. Lovable then announced a `$330M` Series B on `2025-12-18`.
- Why GHPR should care: Lovable is a strong seed source for repos that are likely to be `AI-explicit` or at least `AI-first` when the generated app is later exported or linked to GitHub

### 2. Replit Agent

- Surface: cloud coding workspace plus agent
- Best for: both greenfield app creation and iteration on existing projects
- Public evidence: Replit introduced Agent 4 on `2026-03-11` as a production-ready creative coding loop inside Replit. Replit has also publicly described its broader platform scale in its `2025-11-18` funding announcement.
- Why GHPR should care: Replit blurs app builder and repo environment, which makes it important for classification and grouping

### 3. Cursor

- Surface: IDE agent/editor
- Best for: existing repositories, but also full app work by developers who want an editor-native loop
- Public evidence: Cursor says it is used by millions of developers, and its `2026-03-17` blog highlighted a large internal deployment at Stripe
- Why GHPR should care: Cursor is one of the biggest likely sources of `mixed` repositories where humans remain highly active

### 4. Windsurf

- Surface: IDE agent/editor
- Best for: existing repositories and enterprise development workflows
- Public evidence: Windsurf presents strong enterprise and adoption claims on its public site and maintained a fast product cadence through `2026-03`
- Why GHPR should care: Windsurf is a likely source of mixed human-plus-agent repos rather than cleanly AI-explicit repos

### 5. Claude Code

- Surface: terminal/CLI coding agent
- Best for: repo-first workflows, longer engineering tasks, review loops, and multi-step coding work
- Public evidence: Anthropic's Claude Code product page and `2026-03-04` webinar position it as a terminal-based developer workflow, not just a code autocomplete tool
- Why GHPR should care: Claude Code already appears directly in public PR provenance, commit co-authorship strings, and manifest files such as `CLAUDE.md`

### 6. OpenAI Codex

- Surface: multi-surface coding agent spanning app, IDE, terminal, and computer-use workflows
- Best for: both greenfield and repo-first work
- Public evidence: OpenAI launched the Codex app on `2026-02-02` and followed with GPT-5.3-Codex on `2026-02-05`
- Why GHPR should care: Codex is likely to produce visible repo signals, but OpenAI has multiple overlapping coding surfaces, so grouping discipline matters

### 7. GitHub Copilot

- Surface: IDE assistant, CLI, and GitHub-native coding assistant
- Best for: existing repositories and developer-in-the-loop workflows
- Public evidence: GitHub continues to position Copilot as a mass-market coding surface and shipped Copilot CLI general availability on `2026-02-25`
- Why GHPR should care: Copilot is one of the largest public AI coding ecosystems, but its authorship signals are often weaker or less explicit than Claude Code-style provenance

### 8. v0

- Surface: browser app builder
- Best for: landing pages, dashboards, UI-first products, and MVP generation
- Public evidence: Vercel rebranded `v0.dev` to `v0.app` on `2025-08-11` and launched the v0 Platform API on `2025-07-23`
- Why GHPR should care: v0 is a strong candidate source for UI-heavy exported repos and prompt-built frontends

### 9. Firebase Studio

- Surface: cloud IDE plus app prototyper
- Best for: both new apps and imported repos
- Public evidence: Google states in the Firebase Studio docs and `2025-04` release notes that the platform can generate full-stack AI apps from multimodal prompts and that Project IDX became part of Firebase Studio in April 2025
- Why GHPR should care: Firebase Studio is part editor, part app generator, which makes it important when we build product-family groupings

### 10. Bolt.new

- Surface: browser app builder
- Best for: prompt-built apps, prototypes, and increasingly production-oriented browser-native app work
- Public evidence: StackBlitz launched Bolt v2 on `2025-10-02`, and Bolt's hackathon writeup says the 2025 event drew more than `130,000` participants
- Why GHPR should care: Bolt is a major browser-native app-generation surface and likely source of exported codebases

## Grouping Recommendation

For GHPR, I would normalize the landscape with three layers.

### Layer 1: Vendor Family

Use this when we want vendor-level rollups.

- `Anthropic`
- `OpenAI`
- `Replit`
- `GitHub/Microsoft`
- `Google`
- `Vercel`
- `Lovable`
- `StackBlitz`
- `Anysphere`
- `Windsurf`

### Layer 2: Product Surface

Use this when we want workflow-level comparisons.

- `CLI agent`
- `IDE agent`
- `browser app builder`
- `cloud coding workspace`
- `GitHub-native assistant`
- `agent platform/orchestrator`

### Layer 3: Use Case

Use this when we want repo-origin hypotheses.

- `new app`
- `existing repo`
- `both`

## Specific Grouping Decisions

### Anthropic: Claude vs Claude Code

- Recommendation: separate them
- Reason: `Claude` is the broader chat/model family, while `Claude Code` is a distinct repo-first coding surface with its own CLI, workflow, and public provenance markers

### OpenAI: ChatGPT coding vs Codex

- Recommendation: separate them
- Reason: `Codex` is a coding-specific agent surface. `ChatGPT` can help with coding, but for GHPR we should count the coding surface actually used when it is visible

### Replit Agent vs Replit platform

- Recommendation: separate them for tool-level analysis, group them for vendor-level analysis
- Reason: the agent is the direct app-building surface, but the broader platform is the runtime and collaboration environment

### GitHub Copilot family

- Recommendation: usually keep as one family unless we specifically need to split `IDE`, `CLI`, and `GitHub review` surfaces
- Reason: public repo metadata often makes it hard to cleanly distinguish which Copilot surface was used

## OpenClaw Positioning

### What OpenClaw Is

OpenClaw appears to be a self-hosted personal AI assistant platform and agent operating environment, not a model and not a pure app builder.

- The official repository describes it as a personal AI assistant you run on your own devices
- The FAQ says it is not an AI model like ChatGPT and explains that it integrates with external model providers
- The docs frame the `Gateway` as the control plane, with channels, skills, auth, and routing around it

### How OpenClaw Fits The Market

OpenClaw fits best in an `agent platform/orchestrator` category.

It is adjacent to vibe coding, but it is not best understood as a direct competitor to Lovable, v0, Bolt, Cursor, or Claude Code. It is closer to the layer that coordinates models, skills, memory, chat interfaces, and automations.

That means OpenClaw is more likely to show up in repos as:

- agent infrastructure
- add-ons and deployment packaging
- runbooks and automation templates
- personal agent setups
- gateway extensions

rather than as the primary branded generator behind a large volume of standalone exported apps.

### Are People Building Apps With OpenClaw?

Yes, but the strongest public evidence suggests the visible ecosystem skews more toward agent systems and scaffolding than toward a large population of clearly OpenClaw-branded standalone app repos.

The public showcase suggests people are using it to build real outputs, including:

- a complete iOS app built through Telegram
- site migration work done through Telegram
- multi-agent orchestration workflows and writeups

But the repos most clearly tied to OpenClaw are more often infrastructure-oriented:

- [openclaw/nix-openclaw](https://github.com/openclaw/nix-openclaw)
- [ngutman/openclaw-ha-addon](https://github.com/ngutman/openclaw-ha-addon)
- [digitalknk/openclaw-runbook](https://github.com/digitalknk/openclaw-runbook)
- [supermemoryai/clawdbot-supermemory](https://github.com/supermemoryai/clawdbot-supermemory)
- [essamamdani/openclaw-coolify](https://github.com/essamamdani/openclaw-coolify)

### OpenClaw Classification Recommendation

For GHPR, classify OpenClaw as:

- `vendor family`: `OpenClaw`
- `product surface`: `agent platform/orchestrator`
- `use case`: `both`, but skewed toward infrastructure and personal-agent workflows

### OpenClaw Detection Signals

If we want to detect OpenClaw-related public repos, the highest-signal breadcrumbs are:

- `OpenClaw` branding in README or docs
- `openclaw onboard`
- `gateway`
- `skills`
- `~/.openclaw`
- explicit references to the OpenClaw dashboard, onboarding, or auth flow
- repo types such as runbooks, add-ons, deployment wrappers, and agent templates

These should be treated as ecosystem and tooling signals, not direct proof that the code in the repo was mostly AI-generated.

## What This Means For GHPR

This landscape suggests a practical next step for GHPR:

1. keep repo-level authorship research separate from market-surface mapping
2. build explicit vendor-family and product-surface vocabularies
3. sample a small number of repos from each major surface, not just from one vendor
4. treat app builders, IDE agents, CLI agents, and orchestrators as different evidence regimes

In other words: a repo likely carries different public breadcrumbs if it came from Lovable, Claude Code, Cursor, or OpenClaw. The classifier should not assume these products leave the same kind of trace.

## Sources

- [Lovable: One year of Lovable](https://lovable.dev/blog/one-year-of-lovable)
- [Lovable: Series B announcement](https://lovable.dev/blog/company-news/series-b)
- [Replit: Introducing Agent 4](https://blog.replit.com/introducing-agent-4-built-for-creativity)
- [Replit: funding and growth announcement](https://blog.replit.com/replit-raises-400-million-dollars)
- [Cursor pricing](https://cursor.com/pricing)
- [Cursor blog](https://cursor.com/blog)
- [Windsurf homepage](https://windsurf.com/)
- [Windsurf changelog](https://windsurf.com/changelog)
- [Anthropic Claude Code](https://www.anthropic.com/claude-code)
- [Anthropic webinar: Claude Code in an hour](https://www.anthropic.com/webinars/claude-code-in-an-hour-a-developers-intro)
- [OpenAI: Introducing the Codex app](https://openai.com/index/introducing-the-codex-app/)
- [OpenAI: Introducing GPT-5.3-Codex](https://openai.com/index/introducing-gpt-5-3-codex/)
- [GitHub Copilot overview](https://github.com/features/copilot)
- [GitHub Copilot CLI GA](https://github.blog/changelog/2026-02-25-github-copilot-cli-is-now-generally-available/)
- [Vercel: v0.app launch](https://vercel.com/blog/v0-app)
- [Vercel: v0 Platform API](https://vercel.com/blog/build-your-own-ai-app-builder-with-the-v0-platform-api)
- [Firebase Studio docs](https://firebase.google.com/docs/studio)
- [Firebase Studio release notes](https://firebase.google.com/support/release-notes/firebase-studio)
- [Bolt v2](https://bolt.new/blog/bolt-v2)
- [Bolt hackathon winners](https://bolt.new/blog/announcing-the-2025-bolt-hackathon-winners)
- [OpenClaw repository](https://github.com/openclaw/openclaw)
- [OpenClaw FAQ](https://docs.openclaw.ai/help/faq)
- [OpenClaw showcase](https://docs.openclaw.ai/start/showcase)
