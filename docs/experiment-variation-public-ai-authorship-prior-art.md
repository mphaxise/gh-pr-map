# Experiment Variation: Public AI Authorship Prior Art Report

Prepared on `2026-03-20` for the GHPR exploration.

This document is one experiment variation inside the broader repo. It is intentionally framed as a side investigation into public AI-authorship signals and prior work, not as the repo's single product direction.

Related follow-up:

- [experiment-variation-vibe-coding-landscape.md](./experiment-variation-vibe-coding-landscape.md)

## Question

Has anyone already analyzed public GitHub repositories or pull requests to distinguish AI-authored code from human-authored code, or to identify repositories that look mostly or entirely AI-generated?

## Short Answer

Yes, but mostly in adjacent forms rather than as a clean repo-level classifier.

The clearest prior work I found falls into three buckets:

- PR-level studies of explicitly attributed agent-authored pull requests
- code-level detection work that tries to separate machine-written and human-written code
- repo-level mining of agent workflow artifacts such as `CLAUDE.md`

I did **not** find a widely used public benchmark that cleanly labels entire repositories as `completely AI` versus `human`. That repo-level framing still looks relatively open.

## Closest Prior Work

I expanded the notes below with four things for each item: the sample they studied, how they built it, what they found, and what it means for GHPR. Where an abstract page did not expose enough detail on its own, I supplemented it with an open full-text mirror or a public literature-review mirror and list those in the sources.

### 1. PR-level analysis of agent-authored GitHub work

- [On the Use of Agentic Coding: An Empirical Study of Pull Requests on GitHub](https://huggingface.co/papers/2509.14745)
- Sample: `567` Claude Code pull requests across `157` open-source repositories, plus a matched comparison set of `567` human pull requests from the same repositories and authors.
- Process: the authors mined PRs explicitly marked `Generated with Claude Code`, restricted to projects with at least `10` stars, and compared them with matched human PRs. They then manually coded PR purpose, rejection reasons, and post-submission revisions, and paired that with statistical analysis of merge rate, change size, PR description length, and revision effort.
- Findings: this is the closest prior work to GHPR. Agentic PRs were merged `83.8%` of the time versus `91.0%` for matched human PRs, but `54.9%` of merged agentic PRs landed without further modification. Agentic PRs skewed toward refactoring, tests, documentation, and multi-purpose submissions; when humans revised them, the most common fixes were bug fixes (`45.1%` of revised APRs), docs (`27.4%`), refactoring (`25.7%`), and style cleanup (`22.1%`).
- GHPR takeaway: explicit PR-body provenance is a very strong signal and a realistic way to build a high-confidence labeled set. It also shows why merge status alone is not a useful AI-versus-human label: many accepted AI PRs still need human shaping.

### 2. Public GitHub mining of explicitly AI-generated code

- [Security Vulnerabilities in AI-Generated Code: A Large-Scale Analysis of Public GitHub Repositories](https://link.springer.com/chapter/10.1007/978-981-95-3537-8_9)
- Sample: the paper reports `82,413` raw GitHub code-search hits for explicit AI attribution patterns, filtered down to `10,387` files overall and then to roughly `7.7k` Python, JavaScript, and TypeScript files for detailed CodeQL analysis. The abstract summarizes the study as analyzing `7,703` explicitly attributed files.
- Process: the authors used GitHub REST API code search with explicit attribution phrases tied to four tools: ChatGPT, GitHub Copilot, Amazon CodeWhisperer, and Tabnine. They then ran duplicate, language, and file-size filtering before applying CodeQL and mapping findings to CWE and CVSS-style security categories.
- Findings: they found `4,241` CWE instances across `77` vulnerability types. Most files (`87.9%`) had no identifiable CWE-mapped vulnerability, but the risk was not uniform: Python showed consistently higher vulnerability rates than JavaScript or TypeScript, and documentation files made up a surprisingly large share of the collected corpus (`39%` of deduplicated files).
- GHPR takeaway: this is strong precedent for building a public dataset from explicit provenance signals in GitHub itself. It also shows the main limitation of that strategy: explicit attribution is high precision but incomplete, so it should be treated as one evidence layer rather than full coverage of AI use.

### 3. Detection of machine-written versus human-written code

- [Between Lines of Code: Unraveling the Distinct Patterns of Machine and Human Programmers](https://arxiv.org/abs/2401.06461)
- Sample: the paper uses `10,000` Python functions from CodeSearchNet as the human reference set and generates matched machine-written code with CodeLlama `7B`; the detection stage is then evaluated across CodeSearchNet and The Stack with six code language models.
- Process: the authors compare human and machine code along lexical diversity, conciseness, and naturalness. They use `tree-sitter` to break code into token categories, study token frequencies and whitespace behavior, and then build `DetectCodeGPT`, which perturbs code by inserting spaces and newlines instead of calling an external LLM to generate paraphrases.
- Findings: machine-authored code was more concise, more "natural" under language-model scoring, and used a narrower token spectrum than human code. The most important discriminator was syntactic segmentation, especially whitespace and line-break structure. Their detector reached an average `AUROC` of `0.8308`, beat the strongest baseline by about `7.6%` on average, and had the best result in `21` of `24` dataset/model settings.
- GHPR takeaway: code-style and segmentation signals are useful, but they are much weaker than explicit provenance metadata. This line of work is most useful as a backstop or tie-breaker when repo metadata is thin, not as the primary repo-level labeling strategy.
- [DetectCodeGPT](https://github.com/YerbaPage/DetectCodeGPT)
- Why it matters separately: the companion repository makes the detection pipeline concrete and reusable, but it is still solving a code-snippet provenance problem, not a repository-history problem.

### 4. PR-quality comparison using AI-vs-human labels

- [CodeRabbit: State of AI vs Human Code Generation Report](https://www.coderabbit.ai/blog/state-of-ai-vs-human-code-generation-report)
- Sample: `470` open-source GitHub pull requests, including `320` AI-co-authored PRs and `150` human-only PRs.
- Process: CodeRabbit applied its issue taxonomy to the PRs, normalized issue rates, and compared the two groups statistically. Their important limitation is explicit: AI authorship was inferred from co-authorship or other visible signals, and PRs without those signals were treated as human-authored for the report.
- Findings: AI PRs had about `1.7x` more issues overall. Logic and correctness problems were `75%` more common, readability issues were more than `3x` higher, and critical, major, security, and performance issues were all elevated in the AI-labeled group.
- GHPR takeaway: this is useful as a downstream outcome study once you already have an AI-versus-human label. It is not a ground-truth authorship benchmark, but it is a good reminder that `mixed` and `AI-first` repos may show different review-risk patterns than `human-led` repos.

### 5. Repo-level mining of agent manifests

- [On the Use of Agentic Coding Manifests: An Empirical Study of Claude Code](https://huggingface.co/papers/2509.14744)
- Sample: the authors started from `838` `CLAUDE.md` files across `806` repositories and filtered down to `253` manifest files in `242` repositories, keeping only repos that accumulated at least `20` commits after the manifest appeared. They also retrieved `1,249` associated commits.
- Process: they did two kinds of analysis. First, they measured manifest structure using markdown heading depth and section counts. Second, they ran a manual content classification workflow that started with candidate labels from Claude, Gemini, and ChatGPT, then had human researchers consolidate and assign the final manifest labels.
- Findings: the files were structurally shallow, typically with a single main heading and a moderate number of `H2` and `H3` sections. Content was dominated by `Build and Run` (`77.1%` of files), `Implementation Details` (`71.9%`), `Architecture` (`64.8%`), and `Testing` (`60.5%`). `AI Integration` appeared in `15.4%` of manifests, while `Security` appeared in only `8.7%`.
- GHPR takeaway: manifest files are one of the strongest repo-level signals of agentic tooling and are directly relevant to labels like `AI-first` or `mixed`. But they are configuration evidence, not proof that the code history itself is mostly AI-authored.

## GitHub Search Signals That Already Exist

These searches show that public GitHub already contains many explicit authorship breadcrumbs:

- [Commit search: `"Generated with Claude Code"`](https://github.com/search?q=%22Generated+with+Claude+Code%22&type=commits)
- [Commit search: `"Co-Authored-By: Claude"`](https://github.com/search?q=%22Co-Authored-By%3A+Claude%22&type=commits)
- [Code search: `path:CLAUDE.md`](https://github.com/search?q=path%3ACLAUDE.md&type=code)
- [Pull request search: `"Generated with Claude Code"`](https://github.com/search?q=%22Generated+with+Claude+Code%22&type=pullrequests)
- [Issue search: `"Generated with Claude Code"`](https://github.com/search?q=%22Generated+with+Claude+Code%22&type=issues)

Observed on `2026-03-20`:

- GitHub commit search for [`"Co-Authored-By: Claude"`](https://github.com/search?q=%22Co-Authored-By%3A+Claude%22&type=commits) was showing about `2M` results
- GitHub search counts are rough, change quickly, and are not the same thing as a deduplicated research dataset

## Explicit Repo Examples Found Via GitHub Search

These are useful because they provide public, self-disclosed examples of repos that look strongly AI-first.

### Explicitly AI-first or heavily AI-generated

- [asmeurer/swe-bench-analysis](https://github.com/asmeurer/swe-bench-analysis)
  - README says the entire project was generated with Claude Code, with some initial help from Grok DeepSearch
- [ConechoAI/Nano-Banana-MCP](https://github.com/ConechoAI/Nano-Banana-MCP)
  - README says the project was entirely generated by Claude Code

### Explicitly AI-generated but human-supervised

- [math-inc/strongpnt](https://github.com/math-inc/strongpnt)
  - README says the repository contains an AI-generated Lean formalization
  - also makes the human supervision and review role explicit

These examples are important because they suggest a practical seed set for an `AI-explicit` class. They also show why a binary `AI repo` versus `human repo` label is too coarse: some repos are clearly agent-generated but still involve meaningful human scaffolding, review, and curation.

## What Seems Open

The following still looks underexplored:

- a repo-level benchmark with labels like `AI-explicit`, `AI-first`, `mixed`, `human-led`, and `unknown`
- a public dataset of whole repositories, not just files or PRs
- a method that combines README signals, PR attribution, commit metadata, manifest files, and workflow config into one repo-level score
- a reliable way to separate `explicitly AI-built` from `AI-assisted but human-led`

## Practical Takeaways For GHPR

If GHPR wants to build something differentiated, the strongest public angle looks like:

1. mine explicit provenance signals first
2. treat PRs, commits, manifests, and README claims as separate evidence layers
3. avoid claiming hard binary truth when the evidence is mixed
4. use labels such as `AI-explicit`, `AI-first`, `mixed`, `human-led`, and `unknown`

The current public landscape suggests that:

- PR-level attribution is already researchable
- code-level machine-vs-human detection already has literature
- repo-level `fully AI repo` classification is still much less mature

That makes repo-level evidence fusion a promising niche for GHPR.

## Sources

- [On the Use of Agentic Coding: An Empirical Study of Pull Requests on GitHub](https://huggingface.co/papers/2509.14745)
- [On the Use of Agentic Coding: An Empirical Study of Pull Requests on GitHub - DBLP metadata](https://dblp.org/rec/journals/corr/abs-2509-14745)
- [Between Lines of Code: Unraveling the Distinct Patterns of Machine and Human Programmers](https://arxiv.org/abs/2401.06461)
- [DetectCodeGPT](https://github.com/YerbaPage/DetectCodeGPT)
- [Security Vulnerabilities in AI-Generated Code: A Large-Scale Analysis of Public GitHub Repositories](https://link.springer.com/chapter/10.1007/978-981-95-3537-8_9)
- [CodeRabbit: State of AI vs Human Code Generation Report](https://www.coderabbit.ai/blog/state-of-ai-vs-human-code-generation-report)
- [On the Use of Agentic Coding Manifests: An Empirical Study of Claude Code](https://huggingface.co/papers/2509.14744)
- [asmeurer/swe-bench-analysis](https://github.com/asmeurer/swe-bench-analysis)
- [ConechoAI/Nano-Banana-MCP](https://github.com/ConechoAI/Nano-Banana-MCP)
- [math-inc/strongpnt](https://github.com/math-inc/strongpnt)
