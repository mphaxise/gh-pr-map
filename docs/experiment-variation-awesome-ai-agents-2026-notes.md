# Experiment Variation: Notes From Awesome AI Agents 2026

Prepared on `2026-03-20` for the GHPR exploration.

This note is a companion to the broader market map in [experiment-variation-vibe-coding-landscape.md](./experiment-variation-vibe-coding-landscape.md). It does not treat the curated list as ground truth. Instead, it uses the list as a discovery surface for additional product categories, tools, and evidence layers that GHPR may want to watch.

## Source

- Repository: [caramaschiHG/awesome-ai-agents-2026](https://github.com/caramaschiHG/awesome-ai-agents-2026)
- GitHub API snapshot checked on `2026-03-20`
- Repository metadata at check time:
  - created: `2026-03-07T13:21:09Z`
  - updated: `2026-03-21T02:25:21Z`
  - stars: `126`
  - forks: `35`

## Short Answer

Yes, there are useful new things to add to our research, but mostly as taxonomy and watchlist expansion rather than as direct evidence.

The list is most valuable for:

- broadening the product-surface map beyond coding agents alone
- separating products from frameworks, protocols, and observability tools
- identifying extra ecosystems that may leave public GitHub traces

It is less useful as:

- proof of repo-level AI authorship
- proof of market share
- proof that a tool is widely used in public repos just because it appears in a curated list

## What Looks Net-New For GHPR

### 1. Additional Coding-Agent Surfaces

These were not yet covered in our current vibe-coding note and are worth adding to the watchlist:

- [Kilo Code](https://kilocode.ai)
- [OpenCode](https://github.com/opencode-ai/opencode)
- [Kiro](https://kiro.dev)
- [Google Antigravity](https://idx.google.com)

Why this matters:

- they expand the set of coding-agent surfaces beyond the most obvious `Cursor`, `Windsurf`, `Claude Code`, and `Codex` family
- they may produce distinct provenance strings, repo conventions, or README mentions

### 2. Browser And Desktop Agent Surfaces

This was the biggest blind spot in our earlier note. The curated list makes it clearer that there is a separate browser-agent category that should not be collapsed into coding agents.

Candidate surfaces worth tracking:

- [OpenAI Operator](https://operator.chatgpt.com)
- [Claude Computer Use](https://docs.anthropic.com/en/docs/agents-and-tools/computer-use)
- [Claude in Chrome](https://claude.ai)
- [Google Project Mariner](https://deepmind.google/technologies/project-mariner/)
- [OpenAI Atlas](https://atlas.openai.com)
- [Dia Browser](https://diabrowser.com)
- [Fellou](https://fellou.ai)
- [Genspark](https://genspark.ai)

Why this matters:

- some repos may be built or operated through browser agents rather than through IDE or terminal coding agents
- these tools may leave different public traces, such as workflow files, browser automation integrations, or product branding in docs

### 3. Workflow Builders And No-Code Agent Platforms

These tools are especially relevant if GHPR expands from authorship detection into "agent-built repo ecosystem" mapping.

Candidate surfaces:

- [Dify](https://github.com/langgenius/dify)
- [Flowise](https://github.com/FlowiseAI/Flowise)
- [Langflow](https://github.com/langflow-ai/langflow)
- [n8n](https://github.com/n8n-io/n8n)
- [Activepieces](https://github.com/activepieces/activepieces)

Why this matters:

- many public repos are not pure code products; they are templates, workflows, integrations, connectors, or exported agent stacks
- these may deserve a separate GHPR label rather than being forced into `app repo` or `agent infra`

### 4. Framework And Orchestration Layer

The list reinforces that frameworks and orchestration stacks are their own evidence layer.

Candidate frameworks worth tracking:

- [Mastra](https://github.com/mastra-ai/mastra)
- [Google ADK](https://github.com/google/adk-python)
- [Strands Agents](https://github.com/strands-agents/sdk-python)
- [DeerFlow](https://github.com/bytedance/deer-flow)
- [OpenAI Agents SDK](https://github.com/openai/openai-agents-python)

Why this matters:

- these frameworks are likely to show up in repo manifests, lockfiles, README setup instructions, and generated scaffolds
- they help explain how a repo was built, even when the actual model or coding assistant is not public

### 5. Protocols, Observability, And Benchmarks

This is the most important structural addition to our research model.

New ecosystem layers to track:

- Protocols: [MCP](https://github.com/modelcontextprotocol), [A2A](https://github.com/google/A2A)
- Observability: [Langfuse](https://github.com/langfuse/langfuse), [LangSmith](https://smith.langchain.com), [Arize Phoenix](https://github.com/Arize-ai/phoenix), [Helicone](https://github.com/Helicone/helicone)
- Benchmarks: [Terminal-Bench](https://terminalbench.com), [WebArena](https://github.com/web-arena-x/webarena), [AgentBench](https://github.com/THUDM/AgentBench)

Why this matters:

- GHPR should not only ask "which app built this repo?"
- it should also ask "which protocol stack, eval stack, or orchestration layer is visible around the repo?"
- this is especially important when repo-level authorship is mixed or ambiguous

## Recommended Additions To Our Research Model

The curated list suggests that GHPR should track at least six separate research layers:

1. `coding agents`
2. `browser or desktop agents`
3. `workflow builders and no-code agent platforms`
4. `frameworks and orchestration`
5. `protocols and standards`
6. `observability and benchmarks`

This is broader than our earlier vibe-coding note, which focused mostly on direct coding and app-building surfaces.

## What Not To Over-Interpret

The list includes strong growth and market claims, such as category sizes, market-share splits, and OpenClaw growth claims. Those should be treated as discovery prompts, not accepted as research-grade evidence on their own.

The same caution applies to inclusion itself:

- appearing in the list does not prove widespread public GitHub usage
- appearing in the list does not prove repo-level authorship relevance
- appearing in the list does not prove a repo was built by that tool

## Practical Takeaways For GHPR

The best additions to our current research are:

- expand the tool watchlist to include browser-agent surfaces
- add workflow-builder and framework signals as separate evidence layers
- track protocols and observability tooling as repo metadata, not just side context
- keep curated-list discoveries separate from verified repo-level evidence

## Suggested Next Research Moves

- sample public repos that explicitly mention `Kilo Code`, `OpenCode`, `Project Mariner`, `OpenAI Atlas`, `Dify`, or `Langfuse`
- see whether browser-agent and workflow-builder repos leave distinct GitHub signals compared with coding-agent repos
- extend GHPR's taxonomy so that `product`, `framework`, `protocol`, `observability`, and `benchmark` are separate classes
