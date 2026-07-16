# Experiment Variation: OpenClaw Two-Bucket Landscape

## Why this variation

The earlier `app repo` bucket was useful for identifying repo type, but it mixed together several different realities:

- repos where OpenClaw appears to have directly authored code
- established product/tool repos that merely accepted an OpenClaw-attributed contribution
- repos whose sampled PRs only mentioned OpenClaw compatibility or probe logic

This note uses two stricter buckets instead:

- `OpenClaw-authored product repo`
- `OpenClaw-assisted contribution to active product repo`

## Live pass

On March 20, 2026 Pacific time, a fresh explicit-PR sample was pulled with:

```bash
node scripts/explore_openclaw_explicit_prs.js \
  --sample-size 80 \
  --per-query 40 \
  --exclude-repos openclaw/openclaw \
  --out-json output/openclaw-two-bucket-landscape.raw.json \
  --out-html output/openclaw-two-bucket-landscape.raw.html
```

The raw sample was generated at `2026-03-21T02:23:45Z` and surfaced:

- 66 sampled explicit PRs
- 58 unique repos
- 1,379 raw query hits across the four explicit OpenClaw PR searches

The default repo bucketer still mostly saw `agent infra`, but manual review of product-like repos showed that some important product/tool cases were hiding inside infra-style labels because terms like `agent`, `server`, or `framework` dominated the keyword heuristics.

## Bucket A: OpenClaw-authored product repo

This bucket is intentionally strict: the repo should look like a standalone product or tool, and the sampled PR body should directly attribute the code to OpenClaw.

Current high-confidence example:

- `AtlasCloudAI/atlascloud_comfyui`
  - Repo shape: Python product/tool repo, created `2025-12-16`, pushed `2026-03-20`, 8 stars.
  - Sampled PR: `feat: sync new AtlasCloud vision models (2026-03-20)` / PR `#26`
  - Explicit signal: PR body ends with `Generated with OpenClaw`.
  - Read: this looks like a relatively small product/tool repo where OpenClaw is directly participating in product work, not just plugin plumbing.

Tentative but not yet high-confidence:

- `xixiaohui/comics`
  - Repo shape: small TypeScript web product, created `2026-03-15`, pushed `2026-03-19`, homepage on Vercel.
  - Sampled PR: `feat: OpenClaw Comics Platform — full implementation` / PR `#1`
  - What we can see: the body describes a complete Next.js 16 + PostgreSQL comic platform.
  - Why tentative: the GitHub search hit matched `Built with OpenClaw`, but the fetched PR body visible in this pass did not itself show a direct OpenClaw attribution line. This is promising, but not yet clean enough to count as high-confidence.

Not counted in this bucket:

- `praetorian-inc/julius`
  - Real active product repo, but the sampled PR says `Generated with Claude Code` and only mentions OpenClaw in probe logic.
- `coco-xyz/coco-labs`
  - Product showcase site, but the sampled PR is OpenClaw compatibility messaging and says `Generated with Claude Code`.
- `manamana32321/opencampus`
  - Product repo, but the sampled PR adds MCP/OpenClaw integration work and says `Generated with Claude Code`.

## Bucket B: OpenClaw-assisted Contribution To Active Product Repo

This bucket covers clearly active existing product/tool repos where a sampled PR explicitly attributes the contribution to OpenClaw.

Current high-confidence examples:

- `projectdiscovery/nuclei`
  - Repo shape: large Go security scanner, 27,556 stars, pushed `2026-03-20`.
  - Sampled PR: `fix: improve XSS context analyzer for edge cases` / PR `#7089`
  - Explicit signal: PR body says `Generated with OpenClaw`.
  - Read: strong evidence of OpenClaw contributing to an already-active, human-led security product.

- `dart-lang/shelf`
  - Repo shape: long-running Dart web server middleware repo, 997 stars, pushed `2026-03-16`.
  - Sampled PR: `refactor: remove http_methods dependency` / PR `#513`
  - Explicit signal: PR body ends with `Generated with [OpenClaw]`.
  - Read: another clean example of OpenClaw contributing into an established active developer product/tool repo.

- `deepmodeling/deepmd-kit`
  - Repo shape: active scientific software package, 1,896 stars, pushed `2026-03-21`.
  - Sampled PRs:
    - `feat(pretrained): add DPA3-Omol-Large`
    - `fix(dpmodel): align Loss.call return type with implementation`
  - Explicit signal: sampled PRs use `Authored by OpenClaw`.
  - Read: strong evidence that OpenClaw is showing up inside an already-active research/software tool ecosystem, not just new hobby repos.

Borderline but worth tracking:

- `TauricResearch/TradingAgents`
  - Repo shape: very large active LLM trading framework/tool repo, 34,170 stars, pushed `2026-03-15`.
  - Sampled PR: `feat: Add Momentum Dashboard with EMA/BB/RSI indicators`
  - Explicit signal: sampled PR matched `Generated with OpenClaw`.
  - Read: this looks more like a framework/tool than a classic app repo, but it still supports the same broader story: OpenClaw is landing explicit contributions in active product/tool codebases.

## What The GitHub Landscape Suggests Today

- High-confidence `OpenClaw-authored product repo` examples exist, but they are still relatively rare in the public explicit-PR surface.
- High-confidence `OpenClaw-assisted contribution to active product repo` examples are easier to find than fully authored product repos.
- Phrase-based GitHub search overstates direct authorship because compatibility work, bridge work, and OpenClaw-specific probe logic can trigger the same explicit query set.
- The strongest near-term classifier for GHPR should probably split product/tool repos into four states:
  - OpenClaw-authored
  - OpenClaw-assisted contribution
  - OpenClaw integration-only
  - false positive / adjacency hit

## Practical Direction For GHPR

If this two-bucket variation is the one to keep pushing, the next useful move is not broader search first. It is a tighter classifier that asks, in order:

1. Does the PR body explicitly attribute the code to OpenClaw?
2. Is the repo actually a standalone product/tool, or just infra/plugin/config?
3. Is the repo clearly active and pre-existing, or does it look like a newer OpenClaw-heavy build?
4. Is the hit actually about authorship, or merely about OpenClaw compatibility?

That should make the product-side landscape much cleaner than the older `app repo` label on its own.
