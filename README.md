# gsd-lite

A lightweight, Claude-Code-native framework for getting real software built — without the ceremony.

gsd-lite gives you a tight loop: **map** an existing codebase, **interview** to capture what you actually want, **research** the right way to build it, **plan** it into concrete steps, and **execute** with verification. It works for both greenfield (brand-new) and brownfield (existing) projects, and it keeps a small, readable paper trail in `.planning/` instead of a sprawl of files.

The thing that makes it worth using is the **interview**. Before any code is written, gsd-lite asks you the right questions — challenging vague answers, making the abstract concrete, and capturing your priorities and preferences — so the plan reflects what you meant, not what a model guessed.

## Why "lite"

- **One namespace, ten commands.** No sprawling surface area.
- **4 files per phase**, not a folder of a dozen. A phase is: the interview (`CONTEXT`), the research (`RESEARCH`), one plan that also tracks its own execution state (`PLAN`), and one wrap-up (`SUMMARY`).
- **4 docs at the root** — `PROJECT.md` (vision + roadmap + live state in one place), `REQUIREMENTS.md`, `ARCHITECTURE.md`, `FEATURES.md`.
- **Claude Code only.** No multi-runtime shims, no external CLI to install.

## Install

### Option A — copy script (simplest)

```bash
git clone <this-repo> gsd-lite
cd gsd-lite
./install.sh /path/to/your/project     # or ./install.sh --global for ~/.claude
```

This copies the `/lite:*` commands and `lite-*` subagents into the project's `.claude/` directory. Restart Claude Code (or `/help`) to pick them up.

### Option B — Claude Code plugin

Load this repository as a plugin (it ships a `.claude-plugin/plugin.json`). The commands register under the `lite` namespace automatically.

To uninstall the copied files: `./install.sh --uninstall /path/to/your/project`.

## The workflow

```
                         ┌─────────────────────────────────────────────┐
  existing codebase ──▶  │  /lite:map      map the codebase            │
                         └─────────────────────────────────────────────┘
                                          │
                         ┌─────────────────────────────────────────────┐
        new idea  ──────▶│  /lite:start    interview → PROJECT, etc.   │
                         └─────────────────────────────────────────────┘
                                          │
                         ┌──── per phase ──────────────────────────────┐
                         │  /lite:discuss   interview → CONTEXT         │
                         │  /lite:plan      research + plan (+ check)   │
                         │  /lite:execute   build + verify → SUMMARY    │
                         └─────────────────────────────────────────────┘
```

1. **`/lite:map`** — *(existing codebases)* Maps the repo into `ARCHITECTURE.md` (stack, structure, conventions, testing, integrations) and `CONCERNS.md` (tech debt, risks). Run it before `/lite:start` so your project context is grounded in what already exists.
2. **`/lite:start`** — Detects greenfield vs brownfield, runs the deep interview, and writes `PROJECT.md`, `REQUIREMENTS.md`, `FEATURES.md`, and an initial roadmap. Optionally researches the domain first.
3. **`/lite:discuss <phase>`** — The per-phase interview. Surfaces the real implementation decisions ("gray areas"), asks one focused question at a time, and locks your answers into `CONTEXT.md`.
4. **`/lite:plan <phase>`** — Researches the phase (`RESEARCH.md`), writes a single `PLAN.md` whose steps are each sized for one focused build session, and runs a plan-quality check before you execute.
5. **`/lite:execute <phase>`** — Orchestrates the phase **one step at a time**: it dispatches a fresh subagent per step, inspects each result against the real diff, fixes or re-plans as needed, then runs a goal-backward verification and writes `SUMMARY.md`. Keeping each step in its own fresh context is what holds build quality up across a long phase.

Execution makes one clean, modular commit per step with concise, imperative messages. Commit messages carry **no signatures, trailers, or attribution** (no `Co-Authored-By`, no "Generated with") — just the change description.

Supporting commands: **`/lite:phase`** (add/edit/insert/remove phases), **`/lite:status`** (where am I?), **`/lite:view`** (render the architecture diagrams + roadmap to an HTML page), **`/lite:config`** (toggles), **`/lite:help`**.

## Determinism helper

gsd-lite is prompt-native, but the bookkeeping that *must not drift* — phase-path/slug resolution, roadmap and state parsing + edits, status inference, config validation, and `commit_docs`-aware commits — is handled by one small, dependency-free Node script (`bin/lite.cjs`, ~300 lines, no `npm install`). Commands discover it automatically and prefer it; when it isn't present they fall back to doing the same work inline. It ships with both the plugin and the copy-script install. You never call it directly — the commands do.

## Working with larger codebases

gsd-lite deliberately relies on **agentic search (grep/glob/read) over markdown maps**, not a prebuilt index. That's the current industry default: agentic search outperforms vector retrieval for code, and indexes go stale the moment you edit. The `## Codebase orientation` block at the top of `ARCHITECTURE.md` plus the per-step "key files" lists give agents a cheap, always-fresh way in.

A couple of optional upgrades for bigger repos, none bundled:

- **Install an LSP plugin for your language** (`/plugin` → search "lsp"; Claude Code ≥ v2.0.74 ships native LSP tools). Precise go-to-definition and find-references beat grep for symbol-level work.
- **For very large repos (1,000+ files)**, you can add an MCP companion yourself — e.g. **Serena** (LSP-based, strong for heavy refactoring) or **GitNexus** (a code knowledge graph; note its **PolyForm Noncommercial** license). These are opt-in; gsd-lite never installs them for you.

## On-disk layout

```
.planning/
├── PROJECT.md          # vision · requirements · roadmap · live state · decisions
├── REQUIREMENTS.md     # scoped, IDed, traceable requirements
├── ARCHITECTURE.md     # system architecture (+ codebase map for brownfield)
├── FEATURES.md         # feature landscape: table stakes / differentiators / anti-features
├── CONCERNS.md         # (brownfield) tech debt, risks, fragile areas
├── config.json         # workflow toggles
└── phases/
    └── 01-foundation/
        ├── 01-CONTEXT.md    # the interview: locked decisions + canonical refs
        ├── 01-RESEARCH.md   # how experts build this phase
        ├── 01-PLAN.md       # substeps + plan + inline execution & verification state
        └── 01-SUMMARY.md    # what shipped
```

## License

MIT
