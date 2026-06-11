---
name: lite:execute
description: Orchestrate a phase plan one step at a time — dispatch a fresh executor per step, inspect each handoff skeptically, fix or re-plan as needed, then verify the whole phase and write SUMMARY.md.
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
Build the phase as an **orchestrator**. You do not write the whole phase in one shot. You read the plan, then dispatch **one fresh subagent per step, sequentially** — each builds exactly one step and returns a structured HANDOFF. You inspect every handoff skeptically against the real diff, fix small issues yourself or dispatch a targeted fix, dynamically re-plan the remaining steps in light of what you learn, and keep your own context lean. After all steps, run the verifier gate, write `SUMMARY.md`, and advance the roadmap + state.

Why this shape: a single agent running an entire phase degrades as its context fills (quality is best at 0–30% usage, worse past 50%). One fresh agent per step keeps every step's build in peak-quality context, and your oversight between steps catches drift early.
</objective>

<determinism>
A deterministic helper handles bookkeeping that must never drift — especially roadmap ticks and state advancement, which are easy to get wrong by hand. Discover it once:

```bash
LITE=""; for p in "${CLAUDE_PLUGIN_ROOT:-}/bin/lite.cjs" ".claude/lite/bin/lite.cjs" "$HOME/.claude/lite/bin/lite.cjs"; do [ -n "$p" ] && [ -f "$p" ] && LITE="$p" && break; done
lite() { node "$LITE" "$@"; }
```

When `$LITE` is set, PREFER: `lite phase <n>` (→ {padded, slug, dir, goal}), `lite config-get` (verifier flag, mode), `lite tick-phase <n> --status "Complete (<date>)"` (ticks the roadmap checkbox AND sets the detail Status line atomically), `lite set-state --position … --activity …`, `lite commit "<msg>" -- <files…>`. When empty, edit PROJECT.md inline as described.
</determinism>

<process>

## 1. Initialize

Phase number from `$ARGUMENTS`. Read `.planning/config.json`, `.planning/PROJECT.md` (roadmap + state).

```bash
PHASE=[number]; PADDED="$(printf '%02d' "${PHASE%%.*}")"; case "$PHASE" in *.*) PADDED="${PADDED}.${PHASE#*.}";; esac   # pad integer part, keep decimal suffix (2.1 → 02.1), matching bin/lite.cjs
SLUG=[kebab-case phase name]; PHASE_DIR=".planning/phases/${PADDED}-${SLUG}"
TODAY=$(date +%F)
test -f ${PHASE_DIR}/${PADDED}-PLAN.md && echo "plan: ok" || echo "no plan"
```

If there's no PLAN.md, tell the user to run `/lite:plan [X]` first and stop.

**Read fully:** `${PADDED}-PLAN.md` (its Steps, Must-Haves, and the Execution State already there), `${PADDED}-CONTEXT.md` (locked decisions — immutable). **Skim** `${PADDED}-RESEARCH.md` (so you can quote the relevant findings into each dispatch). Note the phase goal one-liner.

**Resume check:** if Execution State already shows steps done (`- [x] Step k — …`), skip those steps. Rebuild your "what previous steps did" digest from their recorded status notes plus `git log --oneline`. Start the loop at the first pending step.

Mark the phase in-progress: set the PLAN.md frontmatter `status: executing` (and `lite set-state --activity "executing phase [X]"`).

## 2. Orchestrate the steps

```
─── gsd-lite ▸ executing phase [X] · [N] steps ───
```

**FOR EACH pending step, in order — one at a time, never two executors at once:**

### 2a. Compose the dispatch prompt
Paste the step in **full** — never "read Step 3 from the plan". Quote the locked decisions and research findings the step actually needs, and distill from prior handoffs what this step must know. Use this template:

```
You are executing ONE step of a phase. Do exactly this step — nothing more.

PHASE GOAL: <one-liner from PLAN.md>
STEP <n> OF <total>: <full step text pasted verbatim: Goal / Files / Approach / Key context / Done when / Size>

LOCKED DECISIONS (immutable — implement within these):
<relevant bullets quoted from NN-CONTEXT.md>

RESEARCH YOU NEED (verified earlier — don't re-research):
<relevant bullets quoted from NN-RESEARCH.md>

WHAT PREVIOUS STEPS DID (you build on this):
<2–5 bullets distilled from prior handoffs: files created/changed, interfaces to use, gotchas>

KEY FILES TO READ FIRST: <list from the step + prior handoffs, with paths>

RULES:
- Read the key files before writing. Follow existing code conventions.
- Deviation rules: auto-fix bugs you caused or that block you (record them);
  add genuinely missing critical pieces within step scope (record them);
  for anything architectural or scope-changing: STOP and return NEEDS_DECISION.
- Verify before claiming done: run the step's "Done when" command(s) fresh and
  read the output. No completion claims without verification evidence.
- Commit your work as one or a few atomic commits, concise messages,
  NO signatures/trailers/attribution of any kind.
- End by returning the HANDOFF block exactly in the format below. Your final
  message IS the handoff — make it complete.

<paste the HANDOFF format from step 2c here>
```

### 2b. Dispatch one executor
```
Agent(subagent_type="lite-executor", description="Phase [X] step [n]", prompt="<the composed prompt>")
```
Sequential. Wait for it. Never run more than one step subagent at a time.

### 2c. Receive the HANDOFF
The executor's final message must be exactly:

```markdown
## HANDOFF — Step [n]: [title]
- **Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_DECISION
- **Commits:** [sha — message] (one line each)
- **Files changed:** [path — one-phrase what/why] (one line each)
- **Done-when evidence:** [command run + relevant output line(s) — verbatim, fresh]
- **Deviations:** [none | what changed vs the step text and why]
- **Discoveries for next steps:** [none | things that affect remaining steps]
- **Concerns:** [none | honest doubts]
```

### 2d. Verify the handoff SKEPTICALLY
Do not trust the report — the executor may be optimistic or incomplete.
- `git log --oneline -n <k>` and `git diff <base>..HEAD --stat` — confirm the commits exist and touch roughly the declared files.
- Spot-read the diff for the core change. Compare what was actually done against the step's **Done when** criteria. If the criteria include a command, **run it fresh yourself** and read the output — don't take the pasted evidence on faith for anything load-bearing.

### 2e. Decide
- **PASS** → mark the step done in Execution State (see 2g) and continue.
- **SMALL ISSUE** (cosmetic, a missed edge, a broken-but-obvious fix) → fix it yourself inline now, commit atomically, note it under the step's status, continue.
- **BIG ISSUE** (wrong approach, failing tests you can't quickly fix, a missing major piece) → dispatch **ONE** targeted fix subagent (`lite-executor`) with exact instructions: what's wrong, what right looks like, which files, and the same RULES/HANDOFF contract. Re-verify its handoff. **If 3+ fix attempts fail on the same step, STOP patching** — the approach/architecture is likely wrong; surface it to the user (interactive) or record it as a blocking deviation (autonomous) and stop.
- **BLOCKED / NEEDS_DECISION** → in **interactive** mode, stop and ask the user with a concrete recommendation. In **autonomous** mode, pick the most conservative documented option, record it as a deviation, continue — and surface every such pick prominently in SUMMARY.

### 2f. Re-plan the remaining steps
Re-read the still-pending steps in light of this handoff and its **Discoveries**. If reality diverged — an API differs from what was planned, a step became unnecessary, a new step is needed — **edit the remaining steps in PLAN.md now**: update their Approach/Files/Key context, insert or remove steps. Record each change under `### Plan adjustments` in Execution State, one line + rationale.

**HARD CONSTRAINT:** locked decisions in CONTEXT.md are immutable. Re-planning may change **HOW**, never **WHAT** or scope. Any scope change goes to the user, not into the plan.

### 2g. Record state (you own PLAN.md bookkeeping)
Update Execution State in `${PADDED}-PLAN.md` — keep the planner's format exactly so the helper's parsing stays valid:
```markdown
## Execution State
- [x] Step 1 — done (<short-sha>); [one-line note if anything notable]
- [ ] Step 2 — pending

### Plan adjustments
- Step 4 Approach updated: API returns `{data,meta}` not a bare array (per Step 3 handoff).

### Deviations
- [Rule 2] Step 2 — added input validation the step omitted (commit <sha>).
```
Record any deviation the executor reported (or you applied) under `### Deviations`.

### 2h. Context hygiene (keep yourself lean)
Carry forward only: the handoff summaries, your decisions, and the running "what previous steps did" digest. Do **not** re-read full diffs of completed steps, and do not carry executor transcripts forward. Aim to keep your own context light (~15%) so your judgment stays sharp across the whole phase.

## 3. Verify gate

Skip if `verifier` is off in config or `--skip-verify`. Otherwise spawn the **lite-verifier** subagent for a goal-backward check:
```
Agent(subagent_type="lite-verifier", description="Verify phase [X]",
  prompt="Goal-backward verification of phase [X]. Today: [TODAY].
Read ${PHASE_DIR}/${PADDED}-PLAN.md (Must-Haves + Execution State), the phase success criteria in .planning/PROJECT.md, and inspect the actual codebase.
Do NOT trust the execution notes — read the real code. For each must-have truth: is it really delivered (artifact present, substantive — not a stub — wired, and data flowing)? Check requirement coverage and watch for anti-patterns / debt markers / suspicious code. Apply the confidence rubric: report only findings you'd score ≥80.
Write the verdict INTO ${PHASE_DIR}/${PADDED}-PLAN.md under '## Verification': status (passed | gaps_found | human_needed), score (truths verified / total), and the gaps. Return the verdict + score.")
```

- **passed:** continue.
- **gaps_found:** show the gaps. Offer to close them — dispatch a targeted executor on just the gap items (record them as extra steps in Execution State), then re-verify. Loop until passed or the user accepts the gaps.
- **human_needed:** list the manual checks the user must run (things grep/code can't confirm) and pause for their confirmation.

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
[Auto-fixes and re-plans applied during execution, with why. In autonomous mode, list every NEEDS_DECISION you resolved and the option you chose. Or "None".]

## Verification
[passed | gaps_found | human_needed] — [score]. [Any remaining gaps or manual checks.]

## Next Phase Readiness
[What's ready; any blockers carried forward.]
```

## 5. Refresh the architecture view

If this phase **added, removed, or moved a module, or changed module-level dependencies** (judge from the union of the steps' "Files changed"), update the `## System diagram` Mermaid blocks and the `## Codebase orientation` section in `.planning/ARCHITECTURE.md` to match — same validation rules as `/lite:map` (every `click` path must exist; validate Mermaid syntax before writing). If nothing structural changed, leave it. Include ARCHITECTURE.md in the docs commit below when you touch it.

## 6. Advance roadmap + state

In `.planning/PROJECT.md`:
- Tick the phase in `## Roadmap` (`- [x] **Phase [X]: …**`) and set its `**Status:**` to `Complete ([date])` — prefer `lite tick-phase [X] --status "Complete ([date])"`.
- Update `## State`: current position → next phase ("Phase [X+1] — ready to discuss") or "All phases complete"; last activity; new blockers; log notable decisions in the Key Decisions table.

In `.planning/REQUIREMENTS.md`: mark delivered requirements complete in the Traceability table.

Commit (prefer the helper, which respects `commit_docs`):
```bash
lite commit "docs(phase-${PADDED}): complete phase" -- ${PHASE_DIR}/${PADDED}-SUMMARY.md ${PHASE_DIR}/${PADDED}-PLAN.md .planning/PROJECT.md .planning/REQUIREMENTS.md .planning/ARCHITECTURE.md
# fallback when $LITE is empty:
# git add ${PHASE_DIR}/${PADDED}-SUMMARY.md ${PHASE_DIR}/${PADDED}-PLAN.md .planning/PROJECT.md .planning/REQUIREMENTS.md .planning/ARCHITECTURE.md && git commit -m "docs(phase-${PADDED}): complete phase" >/dev/null 2>&1 || true
```

## 7. Done

```
─── gsd-lite ▸ phase [X] complete ✓ ───

  [Substantive one-liner of what shipped]   ([N] steps · [n] deviations)
  Verification: [status] ([score])

▶ Next:  /clear  then  /lite:discuss [X+1]   (or /lite:status to see where you are)
```

</process>

<success_criteria>
- One fresh executor dispatched per step, sequentially; every handoff inspected against the real diff
- Small issues fixed inline; big issues sent to one targeted fix subagent; 3+ failed fixes escalated to the user
- Remaining steps re-planned when reality diverged; locked decisions never changed; Plan adjustments + Deviations recorded in PLAN.md
- Execution State kept in the helper-compatible format; orchestrator is the single writer of PLAN.md bookkeeping
- Verify gate run (unless skipped); gaps surfaced and optionally closed
- ARCHITECTURE.md diagram refreshed if the phase changed module structure
- SUMMARY.md written with substantive one-liner + verification status; roadmap ticked, State advanced, requirements traceability updated → committed
- User pointed to the next phase
</success_criteria>
</content>
