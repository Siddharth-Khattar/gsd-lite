---
name: lite:execute
description: Execute a phase plan with atomic commits, track progress inline in PLAN.md, verify the work against the phase goal, and write SUMMARY.md.
argument-hint: "<phase> [--skip-verify]"
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
Build the phase. Execute every substep in the plan with atomic commits, record execution state inline in `PLAN.md` as you go, verify the result actually achieves the phase goal, and write a single `SUMMARY.md`. Then advance the roadmap and project state.
</objective>

<determinism>
A deterministic helper handles bookkeeping that must never drift — especially roadmap ticks and state advancement, which are easy to get wrong by hand. Discover it once:

```bash
LITE=""; for p in "${CLAUDE_PLUGIN_ROOT:-}/bin/lite.cjs" ".claude/lite/bin/lite.cjs" "$HOME/.claude/lite/bin/lite.cjs"; do [ -n "$p" ] && [ -f "$p" ] && LITE="$p" && break; done
lite() { node "$LITE" "$@"; }
```

When `$LITE` is set, PREFER: `lite phase <n>` (→ {padded, slug, dir}), `lite config-get` (verifier flag), `lite tick-phase <n> --status "Complete (<date>)"` (ticks the roadmap checkbox AND sets the detail Status line atomically), `lite set-state --position … --activity …`, `lite commit "<msg>" -- <files…>`. When empty, edit PROJECT.md inline as described.
</determinism>

<process>

## 1. Initialize

Phase number from `$ARGUMENTS`. Read `.planning/config.json`, `.planning/PROJECT.md` (roadmap + state).

```bash
PHASE=[number]; PADDED=$(printf "%02d" "$PHASE" 2>/dev/null || echo "$PHASE")
SLUG=[kebab-case phase name]; PHASE_DIR=".planning/phases/${PADDED}-${SLUG}"
TODAY=$(date +%F)
test -f ${PHASE_DIR}/${PADDED}-PLAN.md && echo "plan: ok" || echo "no plan"
```

If there's no PLAN.md, tell the user to run `/lite:plan [X]` first and stop. Read the plan fully — its substeps, must-haves, and the locked decisions / canonical refs it references in CONTEXT.md.

## 2. Execute

```
─── gsd-lite ▸ executing phase [X] ───
```

Spawn the **lite-executor** subagent to do the build in a fresh context (it can hold the whole plan + codebase without crowding this thread):
```
Agent(subagent_type="lite-executor", description="Execute phase [X]",
  prompt="Execute ${PHASE_DIR}/${PADDED}-PLAN.md. Today: [TODAY].
Read the plan, ${PHASE_DIR}/${PADDED}-CONTEXT.md (honor locked decisions), ${PHASE_DIR}/${PADDED}-RESEARCH.md, and .planning/ARCHITECTURE.md.
For each substep: implement it, commit atomically (feat/fix/test(phase-${PADDED}): ...) with a concise one-line message and NO signature/trailer of any kind (no Co-Authored-By, no 'Generated with', no attribution), and update that substep's checkbox + status note INLINE in PLAN.md's '## Execution State' section.
Apply the deviation rules (auto-fix bugs, add missing critical functionality, fix blocking issues) and record each deviation in PLAN.md. Return a concise execution report (substeps done, commits, deviations, any stubs/blockers).")
```

If the executor reports a hard blocker (missing credential, ambiguous requirement it can't safely resolve), surface it to the user and pause rather than guessing.

## 3. Verify gate

Skip if `verifier` is off in config or `--skip-verify`. Otherwise spawn the **lite-verifier** subagent for a goal-backward check:
```
Agent(subagent_type="lite-verifier", description="Verify phase [X]",
  prompt="Goal-backward verification of phase [X]. Today: [TODAY].
Read ${PHASE_DIR}/${PADDED}-PLAN.md (must-haves), the phase success criteria in .planning/PROJECT.md, and inspect the actual codebase.
For each must-have truth: is it really delivered (artifact present, substantive — not a stub — wired, and data flowing)? Check requirement coverage and watch for anti-patterns / debt markers / suspicious code.
Write the verdict INTO ${PHASE_DIR}/${PADDED}-PLAN.md under a '## Verification' section: status (passed | gaps_found | human_needed), score (truths verified / total), and a gaps list with what's missing. Return the verdict + score.")
```

- **passed:** continue.
- **gaps_found:** show the gaps. Offer to close them — re-run the executor on just the gap items (record as additional substeps in PLAN.md), then re-verify. Loop until passed or the user accepts the gaps.
- **human_needed:** list the manual checks the user must run (things grep/code can't confirm, e.g. dynamic UI behavior) and pause for their confirmation.

## 4. Write SUMMARY.md

Write `${PHASE_DIR}/${PADDED}-SUMMARY.md` — one wrap-up for the whole phase:

```markdown
---
phase: [X]-[name]
subsystem: [auth | api | ui | database | infra | testing | ...]
tags: [searchable tech keywords]
requires: [prior phases this depended on]
provides: [what this phase delivered]
affects: [later phases that will need this]
requirements-completed: [REQ-IDs delivered]
verification: [passed | gaps_found | human_needed] ([score])
completed: [date]
status: complete
---

# Phase [X]: [Name] — Summary

**[Substantive one-liner: what actually shipped — e.g. "JWT auth with refresh rotation using jose + protected API middleware". NOT "phase complete".]**

## Accomplishments
- [Most important outcome]
- [Second]

## Key Files
- `path/to/file.ts` — what it does

## Decisions Made
[Key decisions + brief rationale, or "None — followed plan as written".]

## Deviations from Plan
[Auto-fixes applied during execution with why, or "None".]

## Verification
[passed | gaps_found | human_needed] — [score]. [Any remaining gaps or manual checks.]

## Next Phase Readiness
[What's ready; any blockers carried forward.]
```

## 5. Advance roadmap + state

In `.planning/PROJECT.md`:
- Tick the phase in the `## Roadmap` list (`- [x] **Phase [X]: …**`) and set its `**Status:**` to `Complete ([date])`.
- Update the `## State` block: current position → next phase ("Phase [X+1] — ready to discuss") or "All phases complete"; last activity; add any new blockers; log notable decisions in the Key Decisions table.

In `.planning/REQUIREMENTS.md`: mark delivered requirements complete in the Traceability table.

Commit:
```bash
git add ${PHASE_DIR}/${PADDED}-SUMMARY.md ${PHASE_DIR}/${PADDED}-PLAN.md .planning/PROJECT.md .planning/REQUIREMENTS.md && git commit -m "docs(phase-${PADDED}): complete phase" >/dev/null 2>&1 || true
```

## 6. Done

```
─── gsd-lite ▸ phase [X] complete ✓ ───

  [Substantive one-liner of what shipped]
  Verification: [status] ([score])

▶ Next:  /clear  then  /lite:discuss [X+1]   (or /lite:status to see where you are)
```

</process>

<success_criteria>
- Every substep executed with atomic commits; progress tracked inline in PLAN.md
- Locked decisions honored; deviations recorded
- Verify gate run (unless skipped); gaps surfaced and optionally closed
- SUMMARY.md written with substantive one-liner + verification status
- Roadmap ticked, State advanced, requirements traceability updated → committed
- User pointed to the next phase
</success_criteria>
