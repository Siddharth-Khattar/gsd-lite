---
name: lite:plan
description: Research a phase and write a single PLAN.md with all substeps, then run a plan-quality check before execution.
argument-hint: "<phase> [--skip-research] [--skip-check]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Agent
---

<objective>
Turn a discussed phase into an executable plan. First research how experts build this phase (→ `RESEARCH.md`), then decompose the phase goal into a single `PLAN.md` with all substeps and explicit "must-haves," then verify the plan will actually achieve the goal before anyone executes it.
</objective>

<determinism>
A deterministic helper handles bookkeeping that must never drift. Discover it once:

```bash
LITE=""; for p in "${CLAUDE_PLUGIN_ROOT:-}/bin/lite.cjs" ".claude/lite/bin/lite.cjs" "$HOME/.claude/lite/bin/lite.cjs"; do [ -n "$p" ] && [ -f "$p" ] && LITE="$p" && break; done
lite() { node "$LITE" "$@"; }
```

When `$LITE` is set, PREFER: `lite phase <n>` (→ {padded, slug, dir, goal} — don't compute these yourself), `lite config-get` (read research/plan_check flags), `lite set-state …`, `lite commit "<msg>" -- <files…>`. When empty, use the inline steps below.
</determinism>

<process>

## 1. Initialize

Phase number from `$ARGUMENTS`. Read `.planning/PROJECT.md` (roadmap + state), `.planning/REQUIREMENTS.md`, and `.planning/config.json`.

```bash
PHASE=[number]; PADDED=$(printf "%02d" "$PHASE" 2>/dev/null || echo "$PHASE")
SLUG=[kebab-case phase name]; PHASE_DIR=".planning/phases/${PADDED}-${SLUG}"
TODAY=$(date +%F)
mkdir -p "${PHASE_DIR}"
cat ${PHASE_DIR}/${PADDED}-CONTEXT.md 2>/dev/null || echo "no context"
```

Read the phase's `CONTEXT.md` if present (locked decisions, canonical refs, deferred ideas). If it's missing, suggest running `/lite:discuss [X]` first, but allow the user to proceed without it.

Read config flags: `research`, `plan_check`. Command flags `--skip-research` / `--skip-check` override them off.

## 2. Research the phase

Skip if research is off or `--skip-research`. Otherwise:

```
─── gsd-lite ▸ researching phase [X] ───  (subagent runs silently ~1-5 min)
```

Spawn the **lite-phase-researcher** subagent:
```
Agent(subagent_type="lite-phase-researcher", description="Research phase [X]",
  prompt="Phase [X]: [name]. Goal: [goal]. Today: [TODAY].
Read: ${PHASE_DIR}/${PADDED}-CONTEXT.md (honor locked decisions verbatim), .planning/ARCHITECTURE.md, .planning/REQUIREMENTS.md, and any canonical refs listed in CONTEXT.md.
Write ${PHASE_DIR}/${PADDED}-RESEARCH.md. Return a short summary only.")
```

When it returns, surface the headline findings (standard stack, key patterns, top pitfalls). Commit:
```bash
git add ${PHASE_DIR}/${PADDED}-RESEARCH.md && git commit -m "docs(phase-${PADDED}): research phase" >/dev/null 2>&1 || true
```

## 3. Plan the phase

```
─── gsd-lite ▸ planning phase [X] ───
```

Spawn the **lite-planner** subagent:
```
Agent(subagent_type="lite-planner", description="Plan phase [X]",
  prompt="Phase [X]: [name]. Goal: [goal]. Requirements: [REQ-IDs]. Today: [TODAY].
Read: ${PHASE_DIR}/${PADDED}-CONTEXT.md, ${PHASE_DIR}/${PADDED}-RESEARCH.md, .planning/ARCHITECTURE.md, .planning/REQUIREMENTS.md, recent prior phase SUMMARY.md files.
Write a SINGLE plan at ${PHASE_DIR}/${PADDED}-PLAN.md containing ALL substeps for the phase, plus the must-haves block and the inline execution/verification tracking scaffold (see the lite-planner spec). Honor every locked decision in CONTEXT.md. Return a short summary only.")
```

## 4. Plan-check gate

Skip if `plan_check` is off or `--skip-check`. Otherwise spawn the **lite-plan-checker** subagent:
```
Agent(subagent_type="lite-plan-checker", description="Check plan [X]",
  prompt="Verify ${PHASE_DIR}/${PADDED}-PLAN.md will achieve the phase goal BEFORE execution.
Read the plan, ${PHASE_DIR}/${PADDED}-CONTEXT.md, .planning/REQUIREMENTS.md, and the phase success criteria in .planning/PROJECT.md.
Check: requirement coverage, every success criterion has a substep that delivers it, substeps are concrete and wired together, locked decisions honored, no scope creep. Return a verdict: PASS or REVISE with a specific, numbered list of gaps.")
```

- **PASS:** continue to step 5.
- **REVISE:** show the gaps, re-spawn **lite-planner** with the gap list as revision context, then re-check. Loop until PASS or the user says to proceed anyway.

## 5. Commit + next steps

Update the `## State` block in PROJECT.md (position → "Phase [X] — planned, ready to execute"). Commit:
```bash
git add ${PHASE_DIR}/${PADDED}-PLAN.md .planning/PROJECT.md && git commit -m "docs(phase-${PADDED}): create phase plan" >/dev/null 2>&1 || true
```

```
─── gsd-lite ▸ phase [X] planned ✓ ───

  Research  ${PHASE_DIR}/${PADDED}-RESEARCH.md
  Plan      ${PHASE_DIR}/${PADDED}-PLAN.md   ([N] substeps · plan-check: PASS)

▶ Next:  /clear  then  /lite:execute [X]
```

</process>

<success_criteria>
- RESEARCH.md written (unless skipped), honoring CONTEXT.md decisions
- A single PLAN.md written with all substeps + must-haves + inline tracking scaffold
- Plan-check gate run (unless skipped); revisions looped until PASS
- Locked decisions honored; every success criterion covered by a substep
- State updated; user pointed to `/lite:execute [X]`
</success_criteria>
