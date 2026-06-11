---
name: lite:status
description: Show where the project stands — current phase, progress, decisions, blockers — and the next sensible command.
argument-hint: ""
allowed-tools:
  - Read
  - Bash
  - Glob
---

<objective>
Give a fast, accurate "where am I and what's next" read of the project from the planning files. No code changes, no analysis beyond what the files say.
</objective>

<process>

<determinism>
A deterministic helper computes the entire status read for you. Discover it once:

```bash
LITE=""; for p in "${CLAUDE_PLUGIN_ROOT:-}/bin/lite.cjs" ".claude/lite/bin/lite.cjs" "$HOME/.claude/lite/bin/lite.cjs"; do [ -n "$p" ] && [ -f "$p" ] && LITE="$p" && break; done
lite() { node "$LITE" "$@"; }
```
</determinism>

## 1. Read state

```bash
test -d .planning || { echo "No .planning/ — run /lite:start first."; exit 0; }
```

If `.planning/` doesn't exist, tell the user to run `/lite:start` (or `/lite:map` for an existing codebase) and stop.

**If `$LITE` is set:** run `lite status` — it returns the authoritative JSON (per-phase `state` ∈ not_started/discussed/planned/executed/complete, `verification`, requirements done/total, and the correct `next` command), all inferred deterministically from disk. Use it directly; also read the `## State` block and Core Value from `.planning/PROJECT.md` for the narrative bits. Skip to step 3.

## 2. Determine progress (fallback — only when `$LITE` is unset)

```bash
sed -n '1,250p' .planning/PROJECT.md
ls -d .planning/phases/*/ 2>/dev/null
```

For each phase in the roadmap, infer status from its directory contents:
- no directory → **Not started**
- `*-CONTEXT.md` only → **Discussed**
- `*-PLAN.md` present → **Planned**
- `*-SUMMARY.md` present → **Complete** (read its `verification:` frontmatter)

Cross-check against the `## Roadmap` checklist and `## State` block in PROJECT.md; if they disagree with the files on disk, trust the files and note the drift.

## 3. Present

```
─── gsd-lite ▸ [Project Name] ───

Phase 1: Foundation      [x] complete      (verify: passed 5/5)
Phase 2: Feed            [~] in progress    (planned — ready to execute)
Phase 3: Social          [ ] not started

Progress: ███████░░░  2/3 phases · [X]/[Y] requirements done

Core value: [one-liner from PROJECT.md]
Recent decisions:
- [from Key Decisions]
Blockers: [from State, or "none"]

▶ Next:  [the next sensible command, e.g. /lite:execute 2]
```

Pick the "Next" command from the furthest-along phase: discussed → `/lite:plan N`; planned → `/lite:execute N`; complete → `/lite:discuss N+1`; nothing started → `/lite:discuss 1`.

</process>

<success_criteria>
- Per-phase status inferred from disk and reconciled with PROJECT.md
- Progress, core value, recent decisions, and blockers shown
- A single, correct "Next" command suggested
</success_criteria>
