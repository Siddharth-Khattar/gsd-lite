---
name: lite:help
description: Show the gsd-lite command reference and workflow.
argument-hint: "[<command>]"
allowed-tools:
  - Read
---

<objective>
Print the gsd-lite reference. Output only the reference content — no project analysis, no git status, no next-step suggestions beyond what's written here. If `$ARGUMENTS` names a command, print just that command's section.
</objective>

<reference>

# gsd-lite

A lightweight loop for getting software built: map → interview → research → plan → execute, with a slim paper trail in `.planning/`.

## The loop

```
existing codebase ─▶ /lite:map        map the repo into ARCHITECTURE.md + CONCERNS.md
new idea ──────────▶ /lite:start      interview → PROJECT, REQUIREMENTS, FEATURES, roadmap
                                       │
            per phase:                 ▼
              /lite:discuss <n>        interview the phase → CONTEXT.md
              /lite:plan <n>           research + plan (+ plan-check) → RESEARCH.md, PLAN.md
              /lite:execute <n>        build + verify → SUMMARY.md
```

## Commands

- **/lite:map** `[--paths a,b,c] [--refresh]` — Map an existing codebase into a consolidated `ARCHITECTURE.md` (stack, structure, conventions, testing, integrations) and `CONCERNS.md` (tech debt, risks). Run before `/lite:start` on existing projects.
- **/lite:start** `[--skip-research]` — Initialize a project. Detects greenfield vs brownfield, runs the deep interview, and writes `PROJECT.md` (vision + roadmap + state), `REQUIREMENTS.md`, `FEATURES.md`, and an initial roadmap.
- **/lite:discuss** `<phase>` — The per-phase interview. Surfaces the real implementation decisions ("gray areas"), asks one focused question at a time, and locks answers into `CONTEXT.md`.
- **/lite:plan** `<phase> [--skip-research] [--skip-check]` — Research the phase (`RESEARCH.md`), write a single `PLAN.md` with all steps (each sized for one fresh executor), and run a plan-quality check before execution.
- **/lite:execute** `<phase> [--skip-verify]` — Orchestrate the plan one step at a time: dispatch a fresh subagent per step, inspect each result against the real diff, fix or re-plan as needed, then verify against the phase goal and write `SUMMARY.md`. Atomic commits throughout.
- **/lite:phase** `add|insert|edit|remove …` — Manage the flat phase roadmap in `PROJECT.md`.
- **/lite:status** — Where am I? Per-phase progress, decisions, blockers, and the next sensible command.
- **/lite:view** — Render the architecture diagrams (Mermaid) and roadmap from `ARCHITECTURE.md`/`PROJECT.md` into a self-contained `.planning/view.html` and open it in the browser. No build step.
- **/lite:config** `[get | set <key> <value>]` — View or change workflow toggles (research, gates, mode, granularity, models).
- **/lite:help** `[<command>]` — This reference.

## What gets written

```
.planning/
├── PROJECT.md        vision · requirements · roadmap · live state · decisions
├── REQUIREMENTS.md   scoped, IDed, traceable requirements
├── ARCHITECTURE.md   system architecture (+ codebase map for existing projects)
├── FEATURES.md       feature landscape: table stakes / differentiators / anti-features
├── CONCERNS.md       (existing projects) tech debt, risks, fragile areas
├── config.json       workflow toggles
└── phases/NN-slug/
    ├── NN-CONTEXT.md   the interview: locked decisions + canonical refs
    ├── NN-RESEARCH.md  how experts build this phase
    ├── NN-PLAN.md      steps + plan + inline execution & verification state
    └── NN-SUMMARY.md   what shipped
```

## Typical sessions

- **New project:** `/lite:start` → `/lite:discuss 1` → `/lite:plan 1` → `/lite:execute 1` → repeat per phase.
- **Existing project:** `/lite:map` → `/lite:start` → per-phase loop.
- **Lost the thread:** `/lite:status`.

Tip: `/clear` between phases keeps each step's context focused.

State, roadmap, status, config, and commits are kept consistent by a small deterministic helper that the commands use automatically — you never invoke it yourself.

</reference>
