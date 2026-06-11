---
name: lite:view
description: Render the project's architecture diagrams and roadmap into a single self-contained HTML page and open it in the browser.
argument-hint: ""
allowed-tools:
  - Read
  - Write
  - Bash
---

<objective>
Turn the Mermaid diagrams in `.planning/ARCHITECTURE.md` plus the roadmap/state in `.planning/PROJECT.md` into one self-contained `.planning/view.html` — no build step, no dependencies, just a file the browser renders via the Mermaid CDN — then open it.
</objective>

<determinism>
A deterministic helper can supply the roadmap and project state. Discover it once:

```bash
LITE=""; for p in "${CLAUDE_PLUGIN_ROOT:-}/bin/lite.cjs" ".claude/lite/bin/lite.cjs" "$HOME/.claude/lite/bin/lite.cjs"; do [ -n "$p" ] && [ -f "$p" ] && LITE="$p" && break; done
lite() { node "$LITE" "$@"; }
```

When `$LITE` is set, use `lite roadmap` (phases + done flags) and `lite status` (progress) for the header/checklist. When empty, parse the `## Roadmap` and `## State` sections of PROJECT.md yourself.
</determinism>

<process>

## 1. Gather

```bash
test -f .planning/ARCHITECTURE.md || { echo "No ARCHITECTURE.md — run /lite:map (existing repo) or /lite:start first."; exit 0; }
```

Read `.planning/ARCHITECTURE.md` and extract **every fenced ```mermaid block** verbatim (in document order) — these are usually under `## System diagram`. Read `.planning/PROJECT.md` for the project name (the top `# ` heading), the `## Roadmap` checklist (phase names + `[x]`/`[ ]`), and the `## State` block (current position, last activity, blockers). If there are no Mermaid blocks, still build the page with the roadmap and a note that no diagrams exist yet.

## 2. Write `.planning/view.html`

One self-contained file. Put each extracted Mermaid block inside a `<pre class="mermaid">` element (the diagram source goes between the tags, unescaped — Mermaid reads the text content). Load Mermaid from the CDN as an ES module. Minimal, clean CSS. Render the roadmap as a checklist (done phases checked). Use this skeleton:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>[Project Name] — architecture</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 15px/1.5 -apple-system, system-ui, sans-serif; max-width: 1100px; margin: 2rem auto; padding: 0 1.25rem; }
  header { border-bottom: 1px solid color-mix(in srgb, currentColor 18%, transparent); padding-bottom: 1rem; margin-bottom: 1.5rem; }
  h1 { margin: 0 0 .25rem; }
  .meta { opacity: .7; font-size: .9rem; }
  .mermaid { background: color-mix(in srgb, currentColor 4%, transparent); border-radius: 10px; padding: 1rem; margin: 1rem 0; overflow-x: auto; }
  ul.roadmap { list-style: none; padding: 0; }
  ul.roadmap li { padding: .2rem 0; }
  ul.roadmap li.done { opacity: .55; text-decoration: line-through; }
  section { margin-bottom: 2.5rem; }
</style>
</head>
<body>
<header>
  <h1>[Project Name]</h1>
  <div class="meta">[Current position] · updated [last activity]</div>
</header>

<section>
  <h2>System diagram</h2>
  <pre class="mermaid">
[FIRST mermaid block source, verbatim]
  </pre>
  <!-- repeat one <pre class="mermaid"> per extracted block -->
</section>

<section>
  <h2>Roadmap</h2>
  <ul class="roadmap">
    <li class="done">✓ Phase 1: [Name]</li>
    <li>○ Phase 2: [Name]</li>
  </ul>
</section>

<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
  mermaid.initialize({ startOnLoad: true });
</script>
</body>
</html>
```

Substitute the real project name, state, every Mermaid block, and the real roadmap. Skip any `click` directives that would point at files only if you want — they're harmless in the browser (they just won't navigate), so leave them as authored.

## 3. Open it

```bash
( command -v open >/dev/null 2>&1 && open .planning/view.html ) \
  || ( command -v xdg-open >/dev/null 2>&1 && xdg-open .planning/view.html ) \
  || echo "Open .planning/view.html in your browser."
```

Tell the user the file path and that it re-renders whenever they re-run `/lite:view` after the diagrams change. Do not commit `view.html` (it's a generated artifact).

</process>

<success_criteria>
- Every Mermaid block from ARCHITECTURE.md embedded in `.planning/view.html`, rendered via the Mermaid CDN (no local dependencies)
- Project name + state header and the roadmap checklist included
- File opened in the browser (or the path printed if no opener is available)
</success_criteria>
</content>
