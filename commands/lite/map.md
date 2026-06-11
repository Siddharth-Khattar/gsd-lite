---
name: lite:map
description: Map an existing codebase into a consolidated ARCHITECTURE.md (stack, structure, conventions, testing, integrations) and CONCERNS.md (tech debt, risks).
argument-hint: "[--paths a,b,c] [--refresh]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Agent
---

<objective>
Analyze an existing codebase and produce two grounded reference documents that downstream interview, planning, and execution steps rely on:

- `.planning/ARCHITECTURE.md` — the consolidated map: stack, structure, architecture, conventions, testing, and integrations, all in one file.
- `.planning/CONCERNS.md` — tech debt, known bugs, security risks, performance bottlenecks, and fragile areas.

These write the canonical `ARCHITECTURE.md` that the rest of gsd-lite treats as the system-of-record for "what already exists."
</objective>

<determinism>
A deterministic helper may be available for scoped commits. Discover it once:

```bash
LITE=""; for p in "${CLAUDE_PLUGIN_ROOT:-}/bin/lite.cjs" ".claude/lite/bin/lite.cjs" "$HOME/.claude/lite/bin/lite.cjs"; do [ -n "$p" ] && [ -f "$p" ] && LITE="$p" && break; done
lite() { node "$LITE" "$@"; }
```

When `$LITE` is set, use `lite today` for the date and `lite commit "<msg>" -- <files…>` (respects commit_docs) instead of raw git. When empty, use the inline commands below.
</determinism>

<process>

## 1. Init

```bash
mkdir -p .planning
TODAY=$(date +%F)
test -f .planning/ARCHITECTURE.md && echo "exists" || echo "fresh"
```

**If `.planning/ARCHITECTURE.md` already exists and `--refresh` was NOT passed:** ask the user — Refresh (remap from scratch) / Skip (keep existing). On Skip, exit.

Parse optional `--paths a,b,c` — when present, restrict mapping to those repo-relative path prefixes only (incremental remap). Reject any path containing `..`, a leading `/`, or shell metacharacters; if all are invalid, fall back to a full-repo scan.

## 2. Map (parallel subagents)

Spawn **two** `lite-codebase-mapper` subagents in parallel (fresh context each, so they don't contaminate the main thread). Each writes its document directly and returns only a confirmation + line count.

```
─── gsd-lite ▸ mapping codebase ───  (subagents run silently ~1-5 min — expected, not a freeze)
```

**Agent 1 — Architecture focus** (writes `.planning/ARCHITECTURE.md`):
```
Agent(subagent_type="lite-codebase-mapper", description="Map architecture",
  prompt="Focus: architecture. Today: [TODAY]. Scope: [full repo | --paths <list>].
Explore the codebase and write .planning/ARCHITECTURE.md as a SINGLE consolidated document, opening with a tight orientation map and then going deep:
  ## Codebase orientation — FIRST section, HARD CAP ~60 lines: top-level directories with one-line descriptions, entry points (path:line), where tests live + how to run them, and a 'Key files (read these first)' list of 5-10 load-bearing files each with path:line + a one-phrase reason.
  ## Stack — languages, runtime, frameworks, key dependencies (with versions), package manager, build/config.
  ## System Overview — a data-flow diagram (arrows, conceptual components) + component responsibilities table with file paths.
  ## Structure — directory layout, key locations, naming conventions.
  ## Conventions — code style, naming, import organization, error handling.
  ## Testing — framework, test layout, run commands, mocking, coverage.
  ## Integrations — external APIs, databases, auth providers, webhooks.
Always include real file paths in backticks. Use [TODAY] for any date. Return confirmation + line count + the orientation's key-files list.")
```

**Agent 2 — Concerns focus** (writes `.planning/CONCERNS.md`):
```
Agent(subagent_type="lite-codebase-mapper", description="Map concerns",
  prompt="Focus: concerns. Today: [TODAY]. Scope: [full repo | --paths <list>].
Explore the codebase and write .planning/CONCERNS.md with sections: ## Tech Debt, ## Known Bugs, ## Security Considerations, ## Performance Bottlenecks, ## Fragile Areas. For each item: what/why, affected files (backticked paths), impact, and a fix approach. Use [TODAY] for any date. Return confirmation + line count only.")
```

Wait for both to complete before continuing. (Do not analyze the codebase yourself while they run.)

## 3. Verify + secret-scan

```bash
wc -l .planning/ARCHITECTURE.md .planning/CONCERNS.md 2>/dev/null
# Refuse to commit leaked credentials:
grep -nE '(sk-[a-zA-Z0-9]{20,}|sk_live_[a-zA-Z0-9]+|ghp_[a-zA-Z0-9]{36}|AKIA[A-Z0-9]{16}|xox[baprs]-[a-zA-Z0-9-]+|-----BEGIN.*PRIVATE KEY)' .planning/ARCHITECTURE.md .planning/CONCERNS.md 2>/dev/null && echo "SECRETS_FOUND" || echo "clean"
```

Each document should be non-trivial (>20 lines). If a secret pattern is found, show it and pause for the user before committing.

## 4. Commit + next steps

```bash
git add .planning/ARCHITECTURE.md .planning/CONCERNS.md && git commit -m "docs: map existing codebase" >/dev/null 2>&1 || true
```

```
─── gsd-lite ▸ codebase mapped ✓ ───

  Architecture  .planning/ARCHITECTURE.md  ([N] lines)
  Concerns      .planning/CONCERNS.md      ([N] lines)

▶ Next:  /clear  then  /lite:start   (the interview will build on this map)
```

</process>

<success_criteria>
- `.planning/ARCHITECTURE.md` written as one consolidated map (stack, overview, structure, conventions, testing, integrations)
- `.planning/CONCERNS.md` written with tech debt / risks / fragile areas
- Real file paths included throughout; no leaked secrets committed
- User pointed to `/lite:start` next
</success_criteria>
