---
name: lite:phase
description: Manage phases in the roadmap — add, insert, edit, or remove phases in PROJECT.md.
argument-hint: "add \"<name>\" | insert <after> \"<name>\" | edit <n> | remove <n>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - AskUserQuestion
---

<objective>
CRUD for the flat phase roadmap that lives in the `## Roadmap` section of `.planning/PROJECT.md`. Keep requirements traceability and project state consistent when phases change.
</objective>

<determinism>
A deterministic helper handles roadmap parsing and commits. Discover it once:

```bash
LITE=""; for p in "${CLAUDE_PLUGIN_ROOT:-}/bin/lite.cjs" ".claude/lite/bin/lite.cjs" "$HOME/.claude/lite/bin/lite.cjs"; do [ -n "$p" ] && [ -f "$p" ] && LITE="$p" && break; done
lite() { node "$LITE" "$@"; }
```

When `$LITE` is set, use `lite roadmap` (→ JSON list of phases with num/name/slug/status — the source of truth for the current roadmap) and `lite commit "<msg>" -- <files…>`. You still author phase additions/edits as prose Edits to PROJECT.md; use the helper to read the current roadmap accurately and to commit. When empty, parse the roadmap inline.
</determinism>

<process>

## 1. Load

Read `.planning/PROJECT.md` (`## Roadmap`, `## State`) and `.planning/REQUIREMENTS.md`. Parse `$ARGUMENTS` for the operation. If no operation is given, show the current roadmap and ask what the user wants to do.

## 2. Operations

**add "<name>"** — Append a new phase at the end. Interview briefly (freeform or 1-2 AskUserQuestion) for: goal (an outcome, not tasks), which requirements it covers, and 2-5 success criteria. Add both the checklist line and the `### Phase N:` detail block. Update REQUIREMENTS.md traceability for any requirements now mapped here.

**insert <after> "<name>"** — Insert an urgent phase using a decimal number (e.g. insert after 2 → `Phase 2.1`). Decimal phases sort between their integer neighbors and execute in numeric order. Mark the detail block heading with `(inserted)`. Gather goal + success criteria as in `add`.

**edit <n>** — Show the phase detail block and ask what to change (name, goal, requirements, success criteria, order). Apply the edit in place. If requirements change, update REQUIREMENTS.md traceability.

**remove <n>** — Confirm first (show what will be deleted). Refuse if the phase is already complete or has a phase directory with executed work, unless the user explicitly insists; warn that downstream phases may depend on it. On removal: delete the checklist line + detail block, and move any requirements that were only covered by this phase back to "unmapped" (flag them).

## 3. Keep consistent + commit

After any change:
- Renumber/relabel nothing automatically except decimal-insert ordering — keep phase numbers stable so existing `phases/NN-*/` directories stay valid. (Prefer decimal inserts over renumbering.)
- Re-check requirements coverage; surface any now-unmapped requirements.
- Update the `## State` block if the current position changed.

```bash
git add .planning/PROJECT.md .planning/REQUIREMENTS.md && git commit -m "docs: update roadmap (phase [op])" >/dev/null 2>&1 || true
```

Show the updated roadmap and the next sensible command (`/lite:discuss <n>`).

</process>

<success_criteria>
- Requested phase operation applied to PROJECT.md's roadmap
- Decimal numbering used for inserts; existing phase numbers kept stable
- Requirements traceability and project state kept consistent
- Change committed; updated roadmap shown
</success_criteria>
