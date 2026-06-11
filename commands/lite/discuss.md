---
name: lite:discuss
description: The per-phase interview — surface the real implementation decisions for a phase, discuss them one at a time, and lock your answers into CONTEXT.md.
argument-hint: "<phase>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
  - mcp__context7__resolve-library-id
  - mcp__context7__query-docs
---

<objective>
Extract the implementation decisions that downstream research and planning need. Analyze the phase to identify its **gray areas** (decisions that could go multiple ways and would change the result), let the user choose which to discuss, then deep-dive each one until satisfied. Capture the decisions in `CONTEXT.md`.

You are a thinking partner, not an interviewer. The user is the visionary — you are the builder. Your job is to capture decisions that guide research and planning, not to figure out implementation yourself.
</objective>

<philosophy>
**User = visionary. Claude = builder.**

The user knows: how they imagine it working, what it should look/feel like, what's essential vs nice-to-have, specific behaviors or references they have in mind.

The user does NOT know (and shouldn't be asked): codebase patterns (you read the code), technical risks (research identifies these), implementation approach (planning figures this out), success metrics (inferred from the work).

Ask about vision and implementation choices. Capture decisions for downstream agents.
</philosophy>

<scope_guardrail>
**No scope creep.** The phase boundary comes from the roadmap and is FIXED. Discussion clarifies HOW to implement what's scoped — never WHETHER to add new capabilities.

- **Allowed (clarifying ambiguity):** "How should posts be displayed?" · "What happens on empty state?" · "Pull to refresh or manual?"
- **Not allowed (scope creep):** "Should we also add comments?" · "What about search?" — those are new capabilities and belong in their own phase.

Heuristic: does this clarify how we implement what's already in the phase, or does it add a new capability that could be its own phase? When the user raises scope creep, capture it under "Deferred Ideas" and redirect: *"[Feature] sounds like a new capability — that's its own phase. I'll note it as a deferred idea. Back to [current area]: …"*
</scope_guardrail>

<determinism>
A deterministic helper handles bookkeeping that must never drift. Discover it once:

```bash
LITE=""; for p in "${CLAUDE_PLUGIN_ROOT:-}/bin/lite.cjs" ".claude/lite/bin/lite.cjs" "$HOME/.claude/lite/bin/lite.cjs"; do [ -n "$p" ] && [ -f "$p" ] && LITE="$p" && break; done
lite() { node "$LITE" "$@"; }
```

When `$LITE` is set, PREFER: `lite phase <n>` (→ JSON {padded, slug, dir, name, goal, found} — use it instead of computing the padded number / slug / directory yourself), `lite set-state --position …`, `lite commit "<msg>" -- <files…>` (respects commit_docs). When empty, use the inline steps below.
</determinism>

<process>

## 1. Initialize

Phase number from `$ARGUMENTS` (required). Read `.planning/PROJECT.md` and find the phase in the `## Roadmap` section. If the phase isn't there, tell the user and point them at `/lite:status`. Get the phase name, goal, requirements, and success criteria.

```bash
PHASE=[number]; PADDED="$(printf '%02d' "${PHASE%%.*}")"; case "$PHASE" in *.*) PADDED="${PADDED}.${PHASE#*.}";; esac   # pad integer part, keep decimal suffix (2.1 → 02.1), matching bin/lite.cjs
SLUG=[kebab-case phase name]
PHASE_DIR=".planning/phases/${PADDED}-${SLUG}"
TODAY=$(date +%F)
ls ${PHASE_DIR}/*-CONTEXT.md 2>/dev/null || true
```

**If a CONTEXT.md already exists for this phase:** ask — Update it / View it / Skip.

## 2. Load prior context

Read what's already decided so you never re-ask:
```bash
sed -n '1,200p' .planning/PROJECT.md
cat .planning/REQUIREMENTS.md 2>/dev/null || true
# Up to 3 most recent prior CONTEXT.md files:
find .planning/phases -name "*-CONTEXT.md" 2>/dev/null | sort -r | head -3
```
Extract locked decisions and preferences from prior phases (e.g. "user prefers minimal UI", "chose infinite scroll in Phase 4"). These get carried forward, not re-asked.

## 3. Scout the codebase (lightweight)

Read `.planning/ARCHITECTURE.md` if it exists. Do a quick, targeted scan (~10% of context) for assets this phase could reuse and patterns it must fit. Build a short internal note of reusable components/hooks/utilities, established patterns, and integration points. Don't deep-dive — just enough to annotate questions with real code context.

## 4. Analyze the phase → gray areas

1. **Domain boundary** — state clearly what capability this phase delivers.
2. **Check prior decisions** — mark any gray areas already decided in earlier phases; don't re-ask them.
3. **Generate phase-specific gray areas** — implementation decisions the user cares about. **Do NOT use generic category labels** (UI, UX, Behavior). Generate specific ones:
   - Phase "User authentication" → Session handling · Error responses · Multi-device policy · Recovery flow
   - Phase "Organize photo library" → Grouping criteria · Duplicate handling · Naming convention · Folder structure
   - Phase "CLI for backups" → Output format · Flag design · Progress reporting · Error recovery
4. **You handle these silently (don't ask):** technical implementation details, architecture patterns, performance optimization, scope.
5. **Canonical refs accumulator** — start a list of docs downstream agents MUST read. Seed it from any specs/ADRs referenced in the roadmap/REQUIREMENTS. Add to it whenever the user references a doc during discussion (these are often the most important).

## 5. Present gray areas

```
Phase [X]: [Name]
Domain: [what this phase delivers]

We'll clarify HOW to implement this. (New capabilities belong in other phases.)

[If prior decisions apply:]
Carrying forward from earlier phases:
- [Decision from Phase N that applies here]
```

AskUserQuestion (multiSelect: true):
- header: "Discuss"
- question: "Which areas do you want to discuss for [phase name]?"
- options: 3-4 phase-specific gray areas, each a concrete label with 1-2 questions in the description, annotated with code context / prior decisions:
  ```
  ☐ Layout style — Cards vs list vs timeline?
    (You already have a Card component with shadow/rounded variants — reusing it keeps the app consistent.)
  ☐ Loading behavior — Infinite scroll or pagination?
    (You chose infinite scroll in Phase 4. useInfiniteQuery is already set up.)
  ```

**Do NOT include a "skip" or "you decide" option here** — the user ran this command to discuss; give real choices.

## 6. Discuss each selected area (default interactive flow)

For each selected area, run a focused loop. Stay adaptive — each answer should reveal the next question.

1. **Announce:** "Let's talk about [Area]."
2. **Ask up to 4 single-question turns** using AskUserQuestion:
   - header: "[Area]" (≤12 chars — abbreviate)
   - question: a specific decision for this area
   - options: 2-3 concrete choices (AskUserQuestion adds "Other" automatically), recommended one highlighted with a brief why. Annotate with code context when relevant:
     ```
     "How should posts be displayed?"
     - Cards (reuses existing Card component — consistent with Messages)
     - List (simpler, would be a new pattern)
     - Timeline (needs a new Timeline component — none exists yet)
     ```
   - Include "You decide" as an option when reasonable — captures your discretion.
   - **Context7 for library choices:** when a gray area involves picking a library or API approach (e.g. "magic links" → next-auth), use the `mcp__context7__*` tools to fetch current docs and inform the options. Only when library-specific knowledge improves the options — not every question.
3. **After the set, check in:** AskUserQuestion — header "[Area]", question "More questions about [area], or move on? (Remaining: [other unvisited areas])", options "More questions" / "Next area". Interpret freeform: "keep going"/"more" → continue; "done"/"next"/"move on" → advance.
4. **After all selected areas:** summarize what was captured, then AskUserQuestion — header "Done", question "We've discussed [areas]. Which gray areas remain unclear?", options "Explore more gray areas" / "I'm ready". On "Explore more", identify 2-4 new gray areas and return to step 5.

**Universal rules (every turn):**
- **Canonical refs** — when the user references a doc/spec/ADR ("read adr-014", "per browse-spec.md"), immediately read it (or confirm it exists), add it to the accumulator with a full relative path, and use what you learned to inform later questions.
- **Scope creep** — capture out-of-phase ideas as deferred and redirect (see `<scope_guardrail>`).
- **Freeform** — if the user picks "Other" to explain in their own words, ask your follow-up as plain text (NOT AskUserQuestion), wait for them to type, reflect it back, then resume.
- **Empty answer** — retry once with the same parameters; if still empty, present the options as a plain-text numbered list. Never proceed on empty input.

## 7. Write CONTEXT.md

```bash
mkdir -p "${PHASE_DIR}"
```

Write `${PHASE_DIR}/${PADDED}-CONTEXT.md` with this structure (omit sections that have no content rather than padding them):

```markdown
# Phase [X]: [Name] — Context

**Gathered:** [date]
**Status:** Ready for planning

## Phase Boundary
[Clear statement of what this phase delivers — the scope anchor.]

## Implementation Decisions
### [Category discussed]
- **D-01:** [Decision captured]
- **D-02:** [Another decision]

### Claude's Discretion
[Areas where the user said "you decide" — you have flexibility here.]

## Canonical References
**Downstream agents MUST read these before planning or implementing.** Every entry needs a full relative path.
### [Topic area]
- `path/to/adr-or-spec.md` — [what it decides that's relevant]
[If none: "No external specs — requirements fully captured in the decisions above."]

## Existing Code Insights
- **Reusable:** [component/hook/utility] — [how it's used in this phase]
- **Patterns:** [pattern] — [how it constrains/enables this phase]
- **Integration points:** [where new code connects]

## Specific Ideas
["I want it like X" moments, references, examples. If none: "Open to standard approaches."]

## Deferred Ideas
[Ideas that came up but belong in other phases. Don't lose them. If none: "None — stayed within phase scope."]

---
*Phase: [X]-[Name] · Context gathered: [date]*
```

## 8. Confirm + commit

```
Created: ${PHASE_DIR}/${PADDED}-CONTEXT.md

Decisions captured:
- [key decision]
[If deferred ideas: "Noted for later: [idea] — future phase"]

▶ Next:  /clear  then  /lite:plan [X]
```

Update the `## State` block in PROJECT.md (current position → "Phase [X] — context gathered"). Commit:

```bash
git add "${PHASE_DIR}/${PADDED}-CONTEXT.md" .planning/PROJECT.md && git commit -m "docs(phase-${PADDED}): capture phase context" >/dev/null 2>&1 || true
```

</process>

<success_criteria>
- Phase validated against the roadmap; prior decisions loaded and carried forward (not re-asked)
- Codebase scouted for reusable assets and patterns
- Phase-specific gray areas identified (not generic categories), annotated with code context
- User selected which areas to discuss; each explored one question at a time until satisfied
- Scope creep redirected to deferred ideas
- CONTEXT.md captures real decisions + a canonical-references section with full paths (mandatory)
- State updated; user pointed to `/lite:plan [X]`
</success_criteria>
