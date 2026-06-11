#!/usr/bin/env node
/*
 * lite.cjs — gsd-lite's deterministic helper.
 *
 * A tiny, dependency-free CLI for the bookkeeping that should never drift:
 * phase-path resolution, roadmap/state parsing + updates, status inference,
 * config read/write, and scoped commits. Commands prefer this when present
 * and fall back to inline behavior when it isn't.
 *
 * Usage:  node lite.cjs <command> [args]
 *   init                          → JSON: git/brownfield/map/project flags + date
 *   today                         → today's date (YYYY-MM-DD)
 *   phase <n>                     → JSON: {phase, padded, slug, dir, exists, found, name, goal}
 *   roadmap                       → JSON: parsed phases from PROJECT.md ## Roadmap
 *   status                        → JSON: per-phase status inferred from disk + verification
 *   config-get [key]              → JSON config (defaults applied) or one value
 *   config-set <key> <value>      → validate + write one config key
 *   tick-phase <n> [--status S]   → mark phase done in roadmap (- [x]) + set its Status
 *   set-state [--position P] [--activity A] [--blockers B]  → update PROJECT.md ## State
 *   commit <msg> -- <files...>    → git add+commit the files iff config.commit_docs
 *
 * All read commands print JSON to stdout. Exit non-zero only on hard errors.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PLANNING = '.planning';
const PROJECT = path.join(PLANNING, 'PROJECT.md');
const REQUIREMENTS = path.join(PLANNING, 'REQUIREMENTS.md');
const CONFIG = path.join(PLANNING, 'config.json');
const PHASES = path.join(PLANNING, 'phases');

const CONFIG_DEFAULTS = {
  mode: 'interactive',
  granularity: 'standard',
  research: true,
  plan_check: true,
  verifier: true,
  parallel: true,
  commit_docs: true,
  model_profile: 'inherit',
};
const CONFIG_ENUMS = {
  mode: ['interactive', 'autonomous'],
  granularity: ['coarse', 'standard', 'fine'],
  model_profile: ['inherit', 'quality', 'balanced', 'budget'],
};
const CONFIG_BOOLS = ['research', 'plan_check', 'verifier', 'parallel', 'commit_docs'];

// ---------- small utils ----------
const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } };
const exists = (p) => { try { fs.accessSync(p); return true; } catch { return false; } };
const out = (obj) => process.stdout.write(typeof obj === 'string' ? obj + '\n' : JSON.stringify(obj, null, 2) + '\n');
const die = (msg, code = 1) => { process.stderr.write('lite: ' + msg + '\n'); process.exit(code); };

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function sh(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  return { code: r.status === null ? 1 : r.status, stdout: (r.stdout || '').trim(), stderr: (r.stderr || '').trim() };
}

function kebab(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function pad(num) {
  const parts = String(num).split('.');
  parts[0] = parts[0].padStart(2, '0');
  return parts.join('.');
}

// ---------- config ----------
function loadConfig() {
  const raw = read(CONFIG);
  let cfg = {};
  if (raw) { try { cfg = JSON.parse(raw); } catch { cfg = {}; } }
  return Object.assign({}, CONFIG_DEFAULTS, cfg);
}

function writeConfig(cfg) {
  if (!exists(PLANNING)) fs.mkdirSync(PLANNING, { recursive: true });
  fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2) + '\n');
}

function configSet(key, value) {
  if (!(key in CONFIG_DEFAULTS)) die(`unknown config key "${key}". Valid: ${Object.keys(CONFIG_DEFAULTS).join(', ')}`);
  let v = value;
  if (CONFIG_BOOLS.includes(key)) {
    if (!/^(true|false)$/i.test(value)) die(`${key} must be true or false`);
    v = /^true$/i.test(value);
  } else if (CONFIG_ENUMS[key]) {
    if (!CONFIG_ENUMS[key].includes(value)) die(`${key} must be one of: ${CONFIG_ENUMS[key].join(', ')}`);
  }
  const cfg = loadConfig();
  cfg[key] = v;
  writeConfig(cfg);
  return cfg;
}

// ---------- roadmap parsing ----------
function section(md, heading) {
  if (!md) return null;
  const re = new RegExp(`^##\\s+${heading}\\s*$`, 'mi');
  const m = re.exec(md);
  if (!m) return null;
  const start = m.index + m[0].length;
  const rest = md.slice(start);
  const next = /^##\s+/m.exec(rest);
  return rest.slice(0, next ? next.index : rest.length);
}

function parseRoadmap(md) {
  const sec = section(md, 'Roadmap');
  const phases = [];
  if (!sec) return phases;
  // Checklist lines: - [ ] **Phase 1: Name** — desc
  const checkRe = /^- \[([ xX])\] \*\*Phase ([0-9]+(?:\.[0-9]+)?):\s*([^*]+?)\*\*\s*(?:[—-]\s*(.*))?$/gm;
  let m;
  const byNum = {};
  while ((m = checkRe.exec(sec)) !== null) {
    const num = m[2];
    const p = { num, name: m[3].trim(), done: m[1].toLowerCase() === 'x', desc: (m[4] || '').trim(), status: null, goal: null };
    byNum[num] = p;
    phases.push(p);
  }
  // Detail blocks: ### Phase 1: Name ... **Goal:** ... **Status:** ...
  const detailRe = /^###\s+Phase ([0-9]+(?:\.[0-9]+)?):\s*(.+?)\s*$/gm;
  let d;
  const idxs = [];
  while ((d = detailRe.exec(sec)) !== null) idxs.push({ num: d[1], name: d[2].trim(), index: d.index });
  for (let i = 0; i < idxs.length; i++) {
    const blk = sec.slice(idxs[i].index, i + 1 < idxs.length ? idxs[i + 1].index : sec.length);
    const goal = /\*\*Goal:\*\*\s*(.+)/i.exec(blk);
    const status = /\*\*Status:\*\*\s*(.+)/i.exec(blk);
    let p = byNum[idxs[i].num];
    if (!p) { p = { num: idxs[i].num, name: idxs[i].name, done: false, desc: '' }; phases.push(p); byNum[idxs[i].num] = p; }
    if (goal) p.goal = goal[1].trim();
    if (status) p.status = status[1].trim();
    if (!p.name) p.name = idxs[i].name;
  }
  phases.forEach((p) => { p.padded = pad(p.num); p.slug = kebab(p.name); });
  // numeric-aware sort (handles decimals)
  phases.sort((a, b) => parseFloat(a.num) - parseFloat(b.num));
  return phases;
}

function findPhaseDir(padded) {
  if (!exists(PHASES)) return null;
  const hit = fs.readdirSync(PHASES).find((d) => d === padded || d.startsWith(padded + '-'));
  return hit ? path.join(PHASES, hit) : null;
}

// ---------- commands ----------
function cmdInit() {
  const git = sh('git', ['rev-parse', '--is-inside-work-tree']);
  const manifests = ['package.json', 'pyproject.toml', 'requirements.txt', 'Cargo.toml', 'go.mod', 'pom.xml', 'build.gradle', 'Gemfile', 'composer.json'];
  const hasManifest = manifests.some(exists);
  let hasSource = false;
  try {
    const walk = (dir, depth) => {
      if (depth > 2 || hasSource) return;
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (hasSource) return;
        if (e.name === 'node_modules' || e.name === '.git' || e.name === PLANNING || e.name.startsWith('.')) continue;
        const fp = path.join(dir, e.name);
        if (e.isDirectory()) walk(fp, depth + 1);
        else if (/\.(ts|tsx|js|jsx|py|go|rs|java|rb|php|swift|kt|c|cpp)$/.test(e.name)) hasSource = true;
      }
    };
    walk('.', 0);
  } catch { /* ignore */ }
  const brownfield = hasManifest || hasSource;
  out({
    has_git: git.code === 0,
    brownfield,
    has_manifest: hasManifest,
    has_source: hasSource,
    has_map: exists(path.join(PLANNING, 'ARCHITECTURE.md')),
    planning_exists: exists(PLANNING),
    project_exists: exists(PROJECT),
    today: today(),
  });
}

function cmdPhase(n) {
  if (!n) die('phase <n> requires a phase number');
  const padded = pad(n);
  const phases = parseRoadmap(read(PROJECT));
  const inRoadmap = phases.find((p) => p.num === String(n) || p.padded === padded);
  const name = inRoadmap ? inRoadmap.name : null;
  const slug = inRoadmap ? inRoadmap.slug : null;
  const dir = findPhaseDir(padded) || (slug ? path.join(PHASES, `${padded}-${slug}`) : null);
  out({
    phase: String(n),
    padded,
    slug,
    name,
    goal: inRoadmap ? inRoadmap.goal : null,
    dir,
    exists: dir ? exists(dir) : false,
    found: !!inRoadmap,
  });
}

function cmdRoadmap() {
  out({ phases: parseRoadmap(read(PROJECT)) });
}

function frontmatter(md) {
  const m = /^---\n([\s\S]*?)\n---/.exec(md || '');
  if (!m) return {};
  const fm = {};
  m[1].split('\n').forEach((line) => {
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (kv) fm[kv[1]] = kv[2].trim();
  });
  return fm;
}

function cmdStatus() {
  const phases = parseRoadmap(read(PROJECT));
  const result = phases.map((p) => {
    const dir = findPhaseDir(p.padded);
    let state = 'not_started';
    let verification = null;
    if (dir) {
      const files = fs.readdirSync(dir);
      const summary = files.find((f) => /-SUMMARY\.md$/.test(f));
      const plan = files.find((f) => /-PLAN\.md$/.test(f));
      const ctx = files.find((f) => /-CONTEXT\.md$/.test(f));
      if (summary) {
        state = 'complete';
        verification = frontmatter(read(path.join(dir, summary))).verification || null;
      } else if (plan) {
        state = 'planned';
        const v = section(read(path.join(dir, plan)), 'Verification');
        const sm = v && /Status:\s*(\w+)/i.exec(v);
        if (sm && sm[1].toLowerCase() !== 'pending') { state = 'executed'; verification = sm[1]; }
      } else if (ctx) {
        state = 'discussed';
      }
    }
    return { num: p.num, name: p.name, padded: p.padded, slug: p.slug, roadmap_done: p.done, state, verification };
  });
  const complete = result.filter((p) => p.state === 'complete').length;
  // requirements coverage
  let reqDone = 0, reqTotal = 0;
  const req = read(REQUIREMENTS);
  if (req) {
    const v1 = section(req, 'v1 Requirements') || req;
    const items = v1.match(/^- \[([ xX])\]/gm) || [];
    reqTotal = items.length;
    reqDone = items.filter((i) => /x/i.test(i)).length;
  }
  // next command
  let next = '/lite:start';
  if (phases.length) {
    const firstUnfinished = result.find((p) => p.state !== 'complete');
    if (!firstUnfinished) next = 'all phases complete';
    else if (firstUnfinished.state === 'not_started') next = `/lite:discuss ${firstUnfinished.num}`;
    else if (firstUnfinished.state === 'discussed') next = `/lite:plan ${firstUnfinished.num}`;
    else next = `/lite:execute ${firstUnfinished.num}`;
  }
  out({ phases: result, complete, total: phases.length, requirements: { done: reqDone, total: reqTotal }, next });
}

function replaceInState(md, field, value) {
  const sec = section(md, 'State');
  if (sec == null) return md;
  const re = new RegExp(`(\\*\\*${field}:\\*\\*).*`, 'i');
  let newSec;
  if (re.test(sec)) newSec = sec.replace(re, `$1 ${value}`);
  else newSec = sec.replace(/\n*$/, `\n**${field}:** ${value}\n`);
  return md.replace(sec, newSec);
}

function cmdSetState(args) {
  let md = read(PROJECT);
  if (md == null) die('PROJECT.md not found');
  const map = { '--position': 'Current position', '--activity': 'Last activity', '--blockers': 'Blockers' };
  for (let i = 0; i < args.length; i += 2) {
    const field = map[args[i]];
    if (field && args[i + 1] != null) md = replaceInState(md, field, args[i + 1]);
  }
  fs.writeFileSync(PROJECT, md);
  out({ ok: true });
}

function cmdTickPhase(n, statusText) {
  let md = read(PROJECT);
  if (md == null) die('PROJECT.md not found');
  const num = String(n).replace('.', '\\.');
  // checklist tick
  const checkRe = new RegExp(`(^- \\[)[ xX](\\] \\*\\*Phase ${num}:)`, 'm');
  if (checkRe.test(md)) md = md.replace(checkRe, `$1x$2`);
  // detail status line
  const st = statusText || `Complete (${today()})`;
  const detailRe = new RegExp(`(^###\\s+Phase ${num}:[^\\n]*\\n[\\s\\S]*?\\*\\*Status:\\*\\*).*`, 'm');
  if (detailRe.test(md)) md = md.replace(detailRe, `$1 ${st}`);
  fs.writeFileSync(PROJECT, md);
  out({ ok: true, status: st });
}

function cmdCommit(args) {
  const sep = args.indexOf('--');
  const msg = (sep === -1 ? args : args.slice(0, sep)).join(' ').trim();
  const files = sep === -1 ? [] : args.slice(sep + 1);
  if (!msg) die('commit requires a message');
  const cfg = loadConfig();
  if (cfg.commit_docs === false) { out({ skipped: true, reason: 'commit_docs is false' }); return; }
  const targets = files.length ? files.filter(exists) : [];
  if (!targets.length) { out({ skipped: true, reason: 'no existing files to commit' }); return; }
  sh('git', ['add', ...targets]);
  const diff = sh('git', ['diff', '--cached', '--quiet']);
  if (diff.code === 0) { out({ skipped: true, reason: 'nothing staged to commit' }); return; }
  const r = sh('git', ['commit', '-m', msg]);
  out({ committed: r.code === 0, message: msg, files: targets, error: r.code === 0 ? undefined : (r.stderr || r.stdout) });
}

// ---------- dispatch ----------
const [, , cmd, ...rest] = process.argv;
switch (cmd) {
  case 'init': cmdInit(); break;
  case 'today': out(today()); break;
  case 'phase': cmdPhase(rest[0]); break;
  case 'roadmap': cmdRoadmap(); break;
  case 'status': cmdStatus(); break;
  case 'config-get': { const c = loadConfig(); out(rest[0] ? { [rest[0]]: c[rest[0]] } : c); break; }
  case 'config-set': cmdConfigSetCli(rest); break;
  case 'tick-phase': { const i = rest.indexOf('--status'); cmdTickPhase(rest[0], i !== -1 ? rest[i + 1] : null); break; }
  case 'set-state': cmdSetState(rest); break;
  case 'commit': cmdCommit(rest); break;
  case undefined: die('no command. See header of lite.cjs for usage.', 2); break;
  default: die(`unknown command "${cmd}"`, 2);
}

function cmdConfigSetCli(args) {
  if (args.length < 2) die('config-set <key> <value>');
  out(configSet(args[0], args.slice(1).join(' ')));
}
