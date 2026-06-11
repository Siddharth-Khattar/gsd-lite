---
name: lite:config
description: View or change gsd-lite workflow settings (research, gates, mode, granularity, models) in .planning/config.json.
argument-hint: "[get | set <key> <value>]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - AskUserQuestion
---

<objective>
View and edit `.planning/config.json` — the small set of toggles that shape how gsd-lite works. Defaults are sensible; the file is only written when something changes.
</objective>

<config_schema>
```json
{
  "mode": "interactive | autonomous",   // interactive = confirm at each step; autonomous = auto-approve and keep moving
  "granularity": "coarse | standard | fine",  // how finely /lite:start slices scope into phases
  "research": true,                       // run research before planning each phase (and the project)
  "plan_check": true,                     // run the plan-quality gate before executing
  "verifier": true,                       // run goal-backward verification after executing
  "parallel": true,                       // run independent read-only subagents (e.g. the two codebase-mapping passes) in parallel; phase execution is always sequential, one step at a time
  "commit_docs": true,                    // commit planning docs to git (false → add .planning/ to .gitignore)
  "model_profile": "inherit | quality | balanced | budget"  // model tier for spawned subagents
}
```
Meaning of `model_profile`: `inherit` uses the current session model for all subagents; `quality` prefers Opus for research/planning; `balanced` prefers Sonnet; `budget` prefers the fastest/cheapest viable model.
</config_schema>

<determinism>
A deterministic helper reads and validates config for you. Discover it once:

```bash
LITE=""; for p in "${CLAUDE_PLUGIN_ROOT:-}/bin/lite.cjs" ".claude/lite/bin/lite.cjs" "$HOME/.claude/lite/bin/lite.cjs"; do [ -n "$p" ] && [ -f "$p" ] && LITE="$p" && break; done
lite() { node "$LITE" "$@"; }
```

When `$LITE` is set, use `lite config-get [key]` (returns JSON with defaults applied) and `lite config-set <key> <value>` (validates the key/value against the schema, writes with defaults filled in, and exits non-zero with the valid options on bad input). This is the preferred path — it guarantees a valid file. Still commit afterward with `lite commit`. When empty, edit the JSON inline as below.
</determinism>

<process>

## 1. Load

```bash
test -f .planning/config.json && cat .planning/config.json || echo "no config (using defaults)"
```

If there's no config, treat all values as their defaults (shown in `<config_schema>`). If `$LITE` is set, prefer `lite config-get`.

## 2. Operate

**No args** — print the current settings as a readable list (each key, its value, and a one-line meaning), then offer to change any via AskUserQuestion (one question per setting the user wants to touch — use the option sets implied by the schema).

**`get`** — print the current settings only. No changes.

**`set <key> <value>`** — validate the key against the schema and the value against its allowed set, then update just that key. Reject unknown keys/values with the valid options.

## 3. Write + commit

Create `.planning/config.json` if needed (fill unspecified keys with defaults), write the change, and:

```bash
git add .planning/config.json && git commit -m "chore: update config (<key>)" >/dev/null 2>&1 || true
```

If `commit_docs` was set to `false`, also ensure `.planning/` is in `.gitignore`. Confirm the new value(s) back to the user.

</process>

<success_criteria>
- Current config shown accurately (defaults applied when the file is absent)
- Only valid keys/values accepted; one setting changed cleanly per `set`
- config.json written with defaults filled in; change committed
</success_criteria>
