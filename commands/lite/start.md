---
name: lite:start
description: Initialize a project — detect greenfield vs brownfield, run the deep interview, and write PROJECT, REQUIREMENTS, FEATURES + an initial roadmap.
argument-hint: "[--skip-research]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
  - Agent
  - mcp__context7__resolve-library-id
  - mcp__context7__query-docs
---

<objective>
Initialize a new gsd-lite project through one flow: questioning → (optional) research → requirements → roadmap. This is the highest-leverage moment in the project. Deep questioning here means better plans, better execution, better outcomes.

You are a thinking partner, not an interviewer. The user is the visionary; you are the builder. Help them sharpen a fuzzy idea into something concrete enough to act on.
</objective>

<determinism>
A deterministic helper handles bookkeeping that must never drift — env detection, phase-path resolution, roadmap/state parsing + edits, status inference, config, and scoped commits. Discover it once:

```bash
LITE=""; for p in "${CLAUDE_PLUGIN_ROOT:-}/bin/lite.cjs" ".claude/lite/bin/lite.cjs" "$HOME/.claude/lite/bin/lite.cjs"; do [ -n "$p" ] && [ -f "$p" ] && LITE="$p" && break; done
lite() { node "$LITE" "$@"; }
```

When `$LITE` is set, PREFER it over hand-rolling: `lite init` (setup flags + date), `lite config-set <k> <v>`, `lite set-state --position P --activity A`, `lite commit "<msg>" -- <files…>` (respects commit_docs). Read commands emit JSON. When `$LITE` is empty, use the inline steps below.
</determinism>

<process>

## 1. Setup

Run these checks before any user interaction:

```bash
git rev-parse --is-inside-work-tree >/dev/null 2>&1 && echo "git: yes" || echo "git: no"
test -d .planning && echo "planning: exists" || echo "planning: none"
test -d .planning/codebase -o -f .planning/ARCHITECTURE.md && echo "map: yes" || echo "map: no"
# Detect existing source code (brownfield signal)
ls package.json pyproject.toml requirements.txt Cargo.toml go.mod pom.xml build.gradle Gemfile composer.json 2>/dev/null | head -5
find . -maxdepth 3 -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.py' -o -name '*.go' -o -name '*.rs' -o -name '*.java' -o -name '*.rb' \) -not -path './node_modules/*' -not -path './.git/*' 2>/dev/null | head -5
TODAY=$(date +%F)
```

Determine:
- **has_git** — is this a git repo?
- **brownfield** — does real source code or a package/manifest file exist?
- **has_map** — does `.planning/ARCHITECTURE.md` already exist (from `/lite:map`)?

**If `.planning/PROJECT.md` already exists:** stop. The project is already initialized — point the user at `/lite:status`.

**If not a git repo:** run `git init` (gsd-lite tracks planning docs and atomic commits in git).

## 2. Brownfield offer

**If brownfield AND NOT has_map:**

AskUserQuestion:
- header: "Codebase"
- question: "I detected existing code here. Map the codebase first so the project is grounded in what already exists?"
- options:
  - "Map first (Recommended)" — exit, run `/lite:map`, then return to `/lite:start`
  - "Skip mapping" — proceed without a codebase map

If "Map first": tell the user to run `/lite:map` then re-run `/lite:start`, and stop.

## 3. Deep questioning

Display:
```
─── gsd-lite ▸ interview ───
```

**Open with a freeform question (NOT AskUserQuestion):**

> "What do you want to build?"

Wait for their answer. Then follow the thread. The questioning guide below governs how you ask.

<questioning_guide>
Project initialization is **dream extraction, not requirements gathering.** You're helping the user discover and articulate what they want. It's collaborative thinking, not a contract negotiation.

**How to question:**
- **Start open.** Let them dump their mental model. Don't interrupt with structure.
- **Follow energy.** Whatever they emphasized, dig into that. What excited them? What problem sparked this?
- **Challenge vagueness.** Never accept fuzzy answers. "Good" means what? "Users" means who? "Simple" means how?
- **Make the abstract concrete.** "Walk me through using this." "What does that actually look like?"
- **Clarify ambiguity.** "When you say Z, do you mean A or B?" "You mentioned X — tell me more."
- **Know when to stop.** When you understand what they want, why, who it's for, and what done looks like — offer to proceed.

**Question types** (inspiration, not a checklist — pick what's relevant to the thread):
- *Motivation:* "What prompted this?" "What are you doing today that this replaces?"
- *Concreteness:* "Walk me through using this." "You said X — what does that actually look like?" "Give me an example."
- *Clarification:* "When you say Z, do you mean A or B?" "You mentioned X — tell me more."
- *Success:* "How will you know this is working?" "What does done look like?"

**Using AskUserQuestion** — present concrete options to react to:
- *Good options:* interpretations of what they might mean, specific examples to confirm/deny, concrete choices that reveal priorities.
- *Bad options:* generic categories ("Technical", "Business", "Other"), leading options, too many options (2-4 ideal), headers over 12 characters.
- Example — user says "it should be fast": header "Fast", question "Fast how?", options ["Sub-second response", "Handles large datasets", "Quick to build", "Let me explain"].

**Freeform rule:** When the user wants to explain freely (selects "Other" / says "let me describe it"), STOP using AskUserQuestion. Ask your follow-up as plain text, wait for them to type, then resume.

**Context checklist** (background, not conversation structure — check mentally, weave in naturally):
- [ ] What they're building (concrete enough to explain to a stranger)
- [ ] Why it needs to exist (the problem or desire driving it)
- [ ] Who it's for (even if just themselves)
- [ ] What "done" looks like (observable outcomes)

**Anti-patterns to avoid:**
- Checklist walking — going through domains regardless of what they said
- Canned questions / corporate speak — "What are your success criteria?" "Who are your stakeholders?"
- Interrogation — firing questions without building on answers
- Rushing — minimizing questions to get to "the work"
- Shallow acceptance — taking vague answers without probing
- Premature constraints — asking about tech stack before understanding the idea
- NEVER ask about the user's technical experience. You build.
</questioning_guide>

**For brownfield projects:** read `.planning/ARCHITECTURE.md` (and `.planning/CONCERNS.md`) first. Frame questions around what's being *added* to the existing system, not building from scratch. The stack is already decided — don't re-ask it.

**Decision gate** — when you could write a clear PROJECT.md, AskUserQuestion:
- header: "Ready?"
- question: "I think I understand what you're after. Ready to create PROJECT.md?"
- options: "Create PROJECT.md" / "Keep exploring"

Loop until "Create PROJECT.md".

## 4. Write PROJECT.md

Synthesize everything into `.planning/PROJECT.md`. This single file holds the vision, requirements, **roadmap**, and **live state** — it is the project's home base. Use this structure exactly:

```markdown
# [Project Name]

## What This Is
[2-3 sentences: what it does and who it's for, in the user's words.]

## Core Value
[The ONE thing that must work. Drives prioritization when tradeoffs arise.]

## Context
[Background that informs implementation — environment, prior work, known issues. For brownfield, note the existing system.]

## Constraints
- **[Type]**: [What] — [Why]    <!-- Tech stack, Timeline, Budget, Compatibility, Performance, Security -->

## Requirements

### Validated
<!-- Greenfield: "(None yet — ship to validate)". Brownfield: infer from .planning/ARCHITECTURE.md, e.g. "- ✓ Express API with 12 endpoints — existing" -->

### Active
- [ ] [Requirement 1]
- [ ] [Requirement 2]

### Out of Scope
- [Exclusion] — [why]

## Roadmap
<!-- Filled in step 7. Flat phase list — no milestones. -->

## Key Decisions
| Decision | Rationale | Outcome |
|----------|-----------|---------|
| [Choice from questioning] | [Why] | — Pending |

## State
**Current position:** Not started — roadmap pending
**Last activity:** [date] — project initialized
**Decisions log:** see Key Decisions above
**Blockers:** none

---
*Last updated: [date] after initialization*
```

Do not compress — capture everything gathered. Then commit:

```bash
mkdir -p .planning
git add .planning/PROJECT.md && git commit -m "docs: initialize project" >/dev/null
```

## 5. Workflow preferences

Write `.planning/config.json`. Ask the user with AskUserQuestion (two rounds; skip any the user clearly stated already):

**Round 1 — mode & granularity:**
- header "Mode": "Interactive (Recommended)" (confirm at each step) / "Autonomous" (auto-approve, keep moving)
- header "Granularity": "Coarse" (3-5 phases) / "Standard (Recommended)" (5-8 phases) / "Fine" (8-12 phases)

**Round 2 — quality gates & models:**
- header "Research": "Yes (Recommended)" / "No" — research before planning each phase
- header "Gates": multiSelect — "Plan check (Recommended)" (verify plan before executing) / "Verify (Recommended)" (verify work after executing)
- header "Models": "Inherit (Recommended)" (use session model) / "Quality" (Opus for deep work) / "Balanced" (Sonnet)

Write the config:

```bash
cat > .planning/config.json <<'JSON'
{
  "mode": "interactive",
  "granularity": "standard",
  "research": true,
  "plan_check": true,
  "verifier": true,
  "parallel": true,
  "commit_docs": true,
  "model_profile": "inherit"
}
JSON
git add .planning/config.json && git commit -m "chore: add project config" >/dev/null
```

Substitute the user's choices. **If commit_docs is No,** add `.planning/` to `.gitignore` and skip the doc commits.

## 6. Research (optional)

Skip if `--skip-research` was passed or the user chose Research = No in step 5.

Otherwise AskUserQuestion (header "Research", "Research the domain before defining requirements?" — "Research first (Recommended)" / "Skip"). If research:

```
─── gsd-lite ▸ researching ───
```

Spawn the **lite-project-researcher** subagent. Pass it: the project domain (from PROJECT.md), whether this is greenfield or brownfield, and whether `.planning/ARCHITECTURE.md` already exists.

```
Agent(subagent_type="lite-project-researcher", description="Research project domain",
  prompt="Domain: [domain from PROJECT.md]. Mode: [greenfield|brownfield]. Today: [TODAY].
Read .planning/PROJECT.md (and .planning/ARCHITECTURE.md if it exists).
Write .planning/FEATURES.md (always). Write .planning/ARCHITECTURE.md ONLY if it does not already exist (greenfield); if it exists, append a '## Planned Additions' section instead of overwriting.
Return a short summary only.")
```

When it returns, show the user the key findings (stack, table stakes, watch-outs) and the files written. Commit:

```bash
git add .planning/FEATURES.md .planning/ARCHITECTURE.md 2>/dev/null; git commit -m "docs: research project domain" >/dev/null 2>&1 || true
```

## 6b. Architecture decision (greenfield, non-trivial)

**Run this only for greenfield projects that are more than a script or a single-page tool** — anything with multiple components, a data layer, or real structural choices. For a trivial project, skip this step and keep the researched `ARCHITECTURE.md` as-is. If you're unsure whether it qualifies, ask the user with one AskUserQuestion ("This looks substantial enough to be worth a quick architecture decision — want me to lay out a couple of options, or keep it simple?").

When it qualifies, **don't just accept one architecture** — put real options on the table:

1. **Generate 2–3 decisive proposals**, each with a different bias. Build them from the interview + the research baseline in `ARCHITECTURE.md`/`FEATURES.md`. Generate them inline, or spawn one subagent told to argue all three stances if the main thread is heavy:
   - **(a) Minimal** — the simplest thing that delivers the core value; least to build and maintain.
   - **(b) Clean / maintainable** — the structure that ages best; clear seams, easy to extend.
   - **(c) Pragmatic balance** — ships fast without painting into a corner.

   Each proposal must be **DECISIVE — one committed approach, no option lists inside it** — and contain:
   - **Decision + rationale** — what it is and why, in one tight paragraph.
   - **Trade-offs** — what you gain and what you give up.
   - **Component breakdown** — each component: what it does · how you'd use it · what it depends on.
   - **Build sequence** — the order you'd build it in.

2. **Present the trade-offs with YOUR recommendation.** Lay the proposals side by side, then state which one you'd pick and *why* — never a bare menu. AskUserQuestion to choose (put your recommended option first, labeled "(Recommended)"). If the user says "whatever you think is best": state your recommendation explicitly and ask for a one-word confirmation before proceeding — don't silently decide.

3. **Walk the chosen design section by section for approval** — present the component breakdown, get a nod, then the build sequence, then any key patterns. Do **not** dump the whole design at once and ask "good?". Incorporate the user's adjustments as you go.

4. **Write the approved design into `.planning/ARCHITECTURE.md`** (refine/replace the researched baseline; keep the research `## Sources`). Include a `## System diagram` with a Mermaid `flowchart TD` of the planned components grouped into `subgraph` layers — **syntax-validate it** (Mermaid MCP if available, else `npx -y @mermaid-js/mermaid-cli`, else self-check), but **omit `click` file links for now** since nothing is built yet; `/lite:execute` wires those in as modules appear. Record the decision and the **rejected alternatives** in PROJECT.md's `## Key Decisions` table (e.g. `| Architecture: chose [B] clean/maintainable | [why] | Rejected: [A] too thin for the data layer, [C] over-built for v1 |`). Commit:

```bash
git add .planning/ARCHITECTURE.md .planning/PROJECT.md && git commit -m "docs: decide project architecture" >/dev/null 2>&1 || true
```

## 7. Define requirements + roadmap

```
─── gsd-lite ▸ requirements ───
```

**Requirements.** If `.planning/FEATURES.md` exists, present features by category (table stakes / differentiators) and let the user scope v1 with AskUserQuestion (multiSelect per category). If no research, gather through conversation ("What are the main things users need to be able to do?"). Then write `.planning/REQUIREMENTS.md`:

```markdown
# Requirements: [Project Name]

**Defined:** [date]
**Core Value:** [from PROJECT.md]

## v1 Requirements
### [Category]
- [ ] **[CAT]-01**: [Specific, testable, user-centric, atomic requirement]

## v2 Requirements
### [Category]
- **[CAT]-01**: [Deferred requirement]

## Out of Scope
| Feature | Reason |
|---------|--------|
| [Feature] | [Why excluded] |

## Traceability
| Requirement | Phase | Status |
|-------------|-------|--------|
| [CAT]-01 | Phase 1 | Pending |
```

REQ-ID format `[CATEGORY]-[NUMBER]` (AUTH-01, CONTENT-02). Reject vague requirements — push for "User can reset password via email link", not "Handle password reset".

**Roadmap.** Derive phases from requirements (don't impose structure). Phase count follows the granularity setting. Each phase delivers something coherent end-to-end. Map **every** v1 requirement to exactly one phase. Write the roadmap into the `## Roadmap` section of `.planning/PROJECT.md`:

```markdown
## Roadmap

- [ ] **Phase 1: [Name]** — [one-line description]
- [ ] **Phase 2: [Name]** — [one-line description]

### Phase 1: [Name]
**Goal:** [What this phase delivers — an outcome, not a task list]
**Depends on:** Nothing (first phase)
**Requirements:** [CAT-01, CAT-02]
**Success Criteria** (what must be TRUE):
  1. [Observable behavior from the user's perspective]
  2. [Observable behavior]
**Status:** Not started

### Phase 2: [Name]
...
```

Update the Traceability table in REQUIREMENTS.md so every requirement maps to a phase (flag any unmapped). Update the `## State` block in PROJECT.md: current position = "Phase 1 — ready to discuss".

**Present the roadmap inline** and (interactive mode) AskUserQuestion to approve / adjust before committing. Loop on adjustments.

Commit:
```bash
git add .planning/PROJECT.md .planning/REQUIREMENTS.md && git commit -m "docs: define requirements and roadmap" >/dev/null
```

## 8. Done

```
─── gsd-lite ▸ initialized ✓ ───

[Project Name] — [N] phases · [X] requirements

  PROJECT       .planning/PROJECT.md   (vision · roadmap · state)
  Requirements  .planning/REQUIREMENTS.md
  Features      .planning/FEATURES.md
  Architecture  .planning/ARCHITECTURE.md

▶ Next:  /clear  then  /lite:discuss 1
```

</process>

<success_criteria>
- `.planning/` created; git initialized
- Greenfield vs brownfield detected; brownfield offered a codebase map first
- Deep questioning followed threads (not rushed, not a checklist)
- PROJECT.md captures full context with merged Roadmap + State sections → committed
- config.json written with the user's preferences → committed
- Research run (unless skipped) → FEATURES.md / ARCHITECTURE.md written
- REQUIREMENTS.md created with REQ-IDs and traceability → committed
- Roadmap written into PROJECT.md; every v1 requirement mapped to one phase
- User knows the next step is `/lite:discuss 1`
</success_criteria>
