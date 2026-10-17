// Duskwick CLI play harness for AI playtesters (stateless: all state lives in
// a session JSON file). See tools/PLAYTEST.md.
//
//   npm run play -- new --mode free --index 3        (or --mode daily --date 2026-10-13)
//   npm run play -- new --variant <N|P|E|code> --index 3   (rule variants, free play)
//   npm run play -- new --variant P --track gentle|deduce --index 3   (pips tracks)
//   npm run play -- new --mode daily --date 2026-10-14 --variant <pips code>   (pips daily)
//   npm run play -- move --session <file> --cell C4
//   npm run play -- show|undo|hint|restart --session <file>
//
// Variants (tools/variantLevels.ts): N = current rules, E = N with two spare
// lanterns, P = numbered stones (games/lanterns-pips; round-1 stream), PG / PD =
// numbered stones, gentle / deduce track (`--variant P --track ...`). Opaque
// codes for blinded playtests come from playtest/variants.json (round 1) and
// playtest/variants2.json (round 2); a session made with a code stores only the
// code (no seed key), so the file does not reveal the variant.
//
// Numbered boards use the core hint engine (games/lanterns-pips/hint.ts) and
// board read-out (analysis.ts): stone statuses, stuck cells and stuck numbers,
// no "numbers matched" counter. Round 5: one lantern to blame instead of every
// cause — `Stuck: B3 — take back A1` (the read-out's culprit: the most culpable
// lantern that is not in the answer), `Stuck number: D4 (2) — take back F2`;
// only when no such lantern is involved the short cause is shown
// (`Stuck: B3 (light from E1; rocks A3 C3)`). Round 7: a forced dead end (analysis.ts
// deadEnd — nothing stuck yet, but the forced moves run into a contradiction) is printed the
// same way: `Stuck: A4 — take back C7` (or `Stuck number: …` when it shows at a number).
// The removal hint is progressive: one lantern at a time ("(1 of 3)").
// Messages (hints, move notes, ILLEGAL) print first, above the board.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { type GeneratedLevel, levelForDaily, levelForIndex, parseDate } from "../games/lanterns/generator.ts";
import * as L from "../games/lanterns/index.ts";
import { solve } from "../games/lanterns/solver.ts";
import * as P from "../games/lanterns-pips/index.ts";
import { mostCulpable } from "../games/lanterns-pips/hint.ts";
import { RULE_TEXT, type Variant, VARIANTS, isPips, resolveVariant, trackVariant, variantLevel } from "./variantLevels.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
/** `npm run` switches cwd to the repo root; resolve user paths against where the command was typed. */
const CWD = process.env.INIT_CWD ?? process.cwd();
const FORMAT = "lanternly-play-session/1";
const COLS = "ABCDEFGH";

type Cmd = "new" | "move" | "show" | "undo" | "hint" | "restart";

interface Action {
  /** Wall-clock timestamp (ISO 8601). */
  t: string;
  /** Milliseconds since the session was created. */
  ms: number;
  cmd: Cmd;
  cell?: string;
  result: string;
  reason?: string;
  used: number;
  lit: number;
  conflicts: number;
  /** Numbered boards: numbered stones per status. */
  stones?: { ok: number; under: number; over: number; blocked: number };
  /** Numbered boards: dark cells nothing legal can light any more. */
  dead?: number;
  /** Numbered boards: numbered stones that can no longer come right (⊘ or ✗). */
  stuckNumbers?: number;
  complete: boolean;
}

interface SessionFile {
  format: typeof FORMAT;
  mode: "free" | "daily";
  /** What `new --variant` was given (N/P/E or an opaque code); absent = classic session. */
  variant?: string;
  index: number | null;
  date: string | null;
  /** null for sessions created with an opaque variant code (blinding). */
  seedKey: string | null;
  levelId: number;
  tag: string;
  /** budget null = no lantern limit (numbered boards). Rows use digits for numbered stones. */
  level: { w: number; h: number; budget: number | null; rows: string[] };
  /** Current lanterns, e.g. ["A1", "C4"]. */
  lanterns: string[];
  /** Toggles since the last restart, for undo. */
  history: string[];
  complete: boolean;
  createdAt: string;
  completedAt: string | null;
  actions: Action[];
}

type AnyState = L.LanternsState | P.PipsState;

// ------------------------------------------------------------------ helpers

const cellName = (x: number, y: number): string => `${COLS[x]}${y + 1}`;

function parseCell(s: string): { x: number; y: number } | null {
  const m = /^([A-Ha-h])([1-8])$/.exec(s.trim());
  if (!m) return null;
  return { x: COLS.indexOf(m[1]!.toUpperCase()), y: Number(m[2]) - 1 };
}

/** The session's rules: N/E use the lanterns rules, P the numbered-stone rules. */
function variantOf(f: SessionFile): Variant {
  if (f.variant === undefined) return "N";
  const v = resolveVariant(f.variant);
  if (v === null) fail(`unknown variant code ${f.variant}`);
  return v;
}

const numbered = (f: SessionFile): boolean => isPips(variantOf(f));

function lanternsLevelOf(f: SessionFile): L.LanternsLevel {
  return L.parseLevel(f.level.rows, f.level.budget ?? 0);
}

function pipsLevelOf(f: SessionFile): P.PipsLevel {
  return P.parseLevel(f.level.rows);
}

function lanternBB(f: SessionFile): L.BB {
  let b = L.EMPTY;
  for (const c of f.lanterns) {
    const p = parseCell(c)!;
    b = L.withBit(b, L.index(p.x, p.y), true);
  }
  return b;
}

function stateOf(f: SessionFile): AnyState {
  if (numbered(f)) return { ...P.initialState(pipsLevelOf(f)), lanterns: lanternBB(f) };
  return { ...L.initialState(lanternsLevelOf(f)), lanterns: lanternBB(f) };
}

function freshState(f: SessionFile): AnyState {
  return numbered(f) ? P.initialState(pipsLevelOf(f)) : L.initialState(lanternsLevelOf(f));
}

function toggleState(f: SessionFile, s: AnyState, p: { x: number; y: number }): AnyState | null {
  return numbered(f) ? P.toggle(s as P.PipsState, p) : L.toggle(s as L.LanternsState, p);
}

function isComplete(f: SessionFile, s: AnyState): boolean {
  return numbered(f) ? P.isComplete(s as P.PipsState) : L.isComplete(s as L.LanternsState);
}

function lanternNames(s: AnyState): string[] {
  return L.cellsOf(s.lanterns).map((c) => cellName(c.x, c.y));
}

interface Stats {
  used: number;
  lit: number;
  floor: number;
  conflicts: string[];
  complete: boolean;
  /** Numbered boards: every numbered stone with its status, the stuck (blocked) cells and stuck numbers, worded. */
  numbers: { stones: P.StoneInfo[]; dead: string[]; stuck: string; stuckNumbers: string[] } | null;
}

const idxName = (i: number): string => cellName(i & 7, i >> 3);
const STATUS_MARK: Readonly<Record<P.StoneStatus, string>> = { ok: "✓", under: "↑", over: "✗", blocked: "⊘" };

/** Short cause (no wrong lantern involved): `B3 (light from E1)`, `B3 (rocks A3 C3)`, or both: `B3 (light from E1; rocks A3 C3)`. */
function stuckText(b: P.BlockedCell): string {
  const parts: string[] = [];
  if (b.lanterns.length > 0) parts.push(`light from ${b.lanterns.map(idxName).join(" ")}`);
  if (b.stones.length > 0) parts.push(`${b.stones.length === 1 ? "rock" : "rocks"} ${b.stones.map(idxName).join(" ")}`);
  return `${idxName(b.cell)} (${parts.join("; ")})`;
}

/** Of `cands` (wrong lanterns), the one to name: the read-out's culprit if listed, else the most culpable. */
function blame(level: P.PipsLevel, s: P.PipsState, cands: readonly number[], culprit: number | null, recent: readonly number[]): number {
  if (culprit !== null && cands.includes(culprit)) return culprit;
  return mostCulpable(level, s, cands, recent.length > 0 ? recent[recent.length - 1]! : -1, recent);
}

/**
 * `C2, G2 — take back A1` (cells grouped by the lantern to take back, the
 * culprit's group first); cells with no wrong lantern involved keep the short cause.
 */
function stuckLine(level: P.PipsLevel, s: P.PipsState, a: P.BoardAnalysis, recent: readonly number[]): string {
  const groups = new Map<number, string[]>();
  const plain: string[] = [];
  if (a.culprit !== null) groups.set(a.culprit, []);
  for (const b of a.blocked) {
    if (b.culprits.length === 0) {
      plain.push(stuckText(b));
      continue;
    }
    const w = blame(level, s, b.culprits, a.culprit, recent);
    if (!groups.has(w)) groups.set(w, []);
    groups.get(w)!.push(idxName(b.cell));
  }
  // Round 7: nothing stuck locally but forced moves run into a dead end — shown like any stuck cell.
  const de = a.deadEnd;
  if (de !== null && de.kind === "cell" && a.culprit !== null) groups.get(a.culprit)!.push(idxName(de.at));
  const parts = [...groups].filter(([, cells]) => cells.length > 0).map(([w, cells]) => `${cells.join(", ")} — take back ${idxName(w)}`);
  return [...parts, ...plain].join("; ") || "none";
}

/** `D4 (2) — take back F2`; without a wrong lantern involved, the short reason. */
function stuckNumberText(level: P.PipsLevel, s: P.PipsState, a: P.BoardAnalysis, x: P.StuckStone, recent: readonly number[]): string {
  const sol = P.solutionOf(level);
  const wrong = sol === null ? [] : x.lanterns.filter((l) => !P.hasBit(sol, l));
  const head = `${idxName(x.stone)} (${level.clues[x.stone]})`;
  if (wrong.length > 0) return `${head} — take back ${idxName(blame(level, s, wrong, a.culprit, recent))}`;
  return `${head} — ${x.reason === "over" ? "too many lanterns touch it" : "not enough free sides left"}`;
}

function stats(f: SessionFile, s: AnyState): Stats {
  const a = L.analyze({ ...s, budget: 0 });
  const floor = L.floorMask(s);
  const litFloor = { lo: (a.lit.lo & floor.lo) >>> 0, hi: (a.lit.hi & floor.hi) >>> 0 };
  let numbers: Stats["numbers"] = null;
  if (numbered(f)) {
    const ps = s as P.PipsState;
    const recent = historyCells(f);
    const ba = P.analyzeBoard(ps, ps, recent);
    numbers = {
      stones: ba.stones,
      dead: [...ba.deadCells, ...(ba.deadEnd !== null && ba.deadEnd.kind === "cell" ? [ba.deadEnd.at] : [])].map(idxName),
      stuck: stuckLine(ps, ps, ba, recent),
      stuckNumbers: [
        ...ba.stuckStones.map((x) => stuckNumberText(ps, ps, ba, x, recent)),
        // Round 7: a dead end that shows at a number reads as a stuck number.
        ...(ba.deadEnd !== null && ba.deadEnd.kind === "number" && ba.culprit !== null
          ? [`${idxName(ba.deadEnd.at)} (${ps.clues[ba.deadEnd.at]}) — take back ${idxName(ba.culprit)}`]
          : []),
      ],
    };
  }
  return {
    used: a.used,
    lit: L.popcount(litFloor),
    floor: L.popcount(floor),
    conflicts: L.cellsOf(a.conflicts).map((c) => cellName(c.x, c.y)),
    complete: isComplete(f, s),
    numbers,
  };
}

/** The toggle history as cell indices, oldest first. */
function historyCells(f: SessionFile): number[] {
  return f.history.map((c) => {
    const p = parseCell(c)!;
    return P.index(p.x, p.y);
  });
}

const LEGEND = "Legend: # stone  · dark floor  + lit floor  L lantern  ! lantern in conflict";
const LEGEND_NUMBERS =
  "Legend: # stone  0-4 stone with a number (exactly that many lanterns touch this stone's sides)  · dark floor  + lit floor  L lantern  ! lantern in conflict\n" +
  "Number marks: ✓ exact  ↑ needs more  ✗ too many  ⊘ needs more than its free sides can take\n" +
  "Stuck = dark cells no allowed lantern can light any more; \"take back A1\" names the one lantern to move first · " +
  "Stuck number = a number that can no longer come right, and the lantern to move";

function render(f: SessionFile, s: AnyState, mark?: string): string {
  const a = L.analyze({ ...s, budget: 0 });
  const clues = numbered(f) ? (s as P.PipsState).clues : null;
  const out: string[] = [];
  // Messages first: round-4 testers missed the hint printed under the legend.
  if (mark) out.push(mark, "");
  out.push(`    ${COLS.slice(0, s.w).split("").join(" ")}`);
  for (let y = 0; y < s.h; y++) {
    let row = `${String(y + 1).padStart(2)}  `;
    for (let x = 0; x < s.w; x++) {
      const i = L.index(x, y);
      const ch = L.hasBit(s.stones, i) ? (clues && clues[i] !== P.NO_CLUE ? String(clues[i]) : "#")
        : L.hasBit(s.lanterns, i) ? (L.hasBit(a.conflicts, i) ? "!" : "L")
        : L.hasBit(a.lit, i) ? "+" : "·";
      row += ch + (x < s.w - 1 ? " " : "");
    }
    out.push(row);
  }
  const st = stats(f, s);
  const elapsed = Math.round((Date.now() - Date.parse(f.createdAt)) / 1000);
  const budget = f.level.budget;
  out.push("");
  const lanternPart = budget === null ? `Lanterns ${st.used}` : `Lanterns ${st.used}/${budget}${st.used > budget ? " (OVER BUDGET)" : ""}`;
  out.push(`${lanternPart} · Lit ${st.lit}/${st.floor} · Conflicts: ${st.conflicts.length ? st.conflicts.join(" ") : "none"}`);
  if (st.numbers) {
    out.push(`Numbers: ${st.numbers.stones.map((x) => `${idxName(x.cell)} ${x.need}${STATUS_MARK[x.status]}`).join("  ") || "-"}`);
    out.push(`Stuck: ${st.numbers.stuck}`);
    for (const x of st.numbers.stuckNumbers) out.push(`Stuck number: ${x}`);
  }
  out.push(`Lanterns at: ${lanternNames(s).join(" ") || "-"}`);
  const n = (cmd: Cmd): number => f.actions.filter((x) => x.cmd === cmd && x.result !== "illegal").length;
  out.push(`Moves ${n("move")} · undos ${n("undo")} · hints ${n("hint")} · restarts ${n("restart")} · ${elapsed}s since start`);
  out.push(numbered(f) ? LEGEND_NUMBERS : LEGEND);
  if (f.complete) {
    out.push(budget === null
      ? "COMPLETE — every floor cell is lit and every number matches. No more moves on this level."
      : `COMPLETE — every floor cell is lit with ${st.used}/${budget} lanterns. No more moves on this level.`);
  }
  return out.join("\n");
}

function header(f: SessionFile): string {
  const what = f.mode === "free" ? `free level ${f.index}` : `daily ${f.date}`;
  const tag = f.variant !== undefined ? ` ${f.variant}` : "";
  const budget = f.level.budget === null ? "" : ` · budget ${f.level.budget} lanterns`;
  return `Duskwick${tag} — ${what} · ${f.level.w}×${f.level.h}${budget}`;
}

function load(path: string | undefined): { f: SessionFile; path: string } {
  if (!path) fail("missing --session <file>");
  const p = resolve(CWD, path);
  let f: SessionFile;
  try {
    f = JSON.parse(readFileSync(p, "utf8")) as SessionFile;
  } catch (e) {
    fail(`cannot read session ${p}: ${(e as Error).message}`);
  }
  if (f.format !== FORMAT) fail(`${p} is not a ${FORMAT} file`);
  return { f, path: p };
}

function save(path: string, f: SessionFile): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(f, null, 2) + "\n");
}

function log(f: SessionFile, cmd: Cmd, s: AnyState, result: string, extra: { cell?: string; reason?: string } = {}): void {
  const st = stats(f, s);
  const now = new Date();
  f.actions.push({
    t: now.toISOString(), ms: now.getTime() - Date.parse(f.createdAt), cmd, ...extra, result,
    used: st.used, lit: st.lit, conflicts: st.conflicts.length,
    ...(st.numbers ? { stones: countStatuses(st.numbers.stones), dead: st.numbers.dead.length, stuckNumbers: st.numbers.stuckNumbers.length } : {}),
    complete: f.complete,
  });
}

function countStatuses(stones: readonly P.StoneInfo[]): { ok: number; under: number; over: number; blocked: number } {
  const c = { ok: 0, under: 0, over: 0, blocked: 0 };
  for (const x of stones) c[x.status]++;
  return c;
}

function fail(msg: string): never {
  console.error(`error: ${msg}`);
  console.error("usage: npm run play -- new --variant <code> --index <n>   (or --variant P --track gentle|deduce)");
  console.error("       npm run play -- new --mode daily --date YYYY-MM-DD [--variant <code>]");
  console.error("       npm run play -- move --session <file> --cell C4 | show|undo|hint|restart --session <file>");
  process.exit(1);
}

/** Keep lanterns + completion in sync with a state. */
function setLanterns(f: SessionFile, s: AnyState): void {
  f.lanterns = lanternNames(s);
  if (isComplete(f, s) && !f.complete) {
    f.complete = true;
    f.completedAt = new Date().toISOString();
  }
}

// ------------------------------------------------------------------ commands

function cmdNew(a: Record<string, string | undefined>): void {
  const mode = a.mode ?? "free";
  let index: number | null = null;
  let date: string | null = null;
  let variant: Variant | null = null;
  let code: string | undefined;
  if (a.variant !== undefined) {
    variant = resolveVariant(a.variant);
    if (variant === null) fail(`unknown variant code ${a.variant}`);
    code = a.variant.trim().toUpperCase();
    if (mode === "daily" && !isPips(variant)) fail("--mode daily with --variant works for the numbered-stone codes only");
    if (mode !== "free" && mode !== "daily") fail(`--mode must be free or daily, got ${mode}`);
    if (a.track !== undefined) {
      if (mode === "daily") fail("--track does not apply to --mode daily (the daily is one level for everyone)");
      if (code !== "P") fail("--track works with --variant P only");
      if (a.track !== "gentle" && a.track !== "deduce") fail(`--track must be gentle or deduce, got ${a.track}`);
      variant = trackVariant(a.track);
      code = variant;
    }
  } else if (a.track !== undefined) {
    fail("--track works with --variant P only");
  }
  const blinded = code !== undefined && !(VARIANTS as readonly string[]).includes(code);
  let level: SessionFile["level"];
  let seedKey: string;
  let levelId: number;
  let tag: string;
  if (mode === "free") {
    index = Number(a.index ?? "1");
    if (!Number.isInteger(index) || index < 1) fail("--index must be a positive integer");
    if (variant === null) {
      const g: GeneratedLevel = levelForIndex(index);
      ({ seedKey, levelId, tag } = g);
      level = { w: g.level.w, h: g.level.h, budget: g.level.budget, rows: L.levelRows(g.level) };
    } else {
      const v = variantLevel(variant, index);
      ({ seedKey, levelId, tag } = v);
      level = v.variant === "P" || v.variant === "PG" || v.variant === "PD"
        ? { w: v.level.w, h: v.level.h, budget: null, rows: P.levelRows(v.level) }
        : { w: v.level.w, h: v.level.h, budget: v.level.budget, rows: L.levelRows(v.level) };
    }
  } else if (mode === "daily") {
    date = a.date ?? "";
    try {
      parseDate(date);
    } catch (e) {
      fail((e as Error).message);
    }
    if (variant !== null) {
      // Numbered-stone daily (games/lanterns-pips/tracks.ts levelForDaily): the same level for every pips code.
      const g = P.generatedForDaily(date);
      ({ seedKey, levelId, tag } = g);
      level = { w: g.level.w, h: g.level.h, budget: null, rows: P.levelRows(g.level) };
    } else {
      const g = levelForDaily(date);
      ({ seedKey, levelId, tag } = g);
      level = { w: g.level.w, h: g.level.h, budget: g.level.budget, rows: L.levelRows(g.level) };
    }
  } else {
    fail(`--mode must be free or daily, got ${mode}`);
  }
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\..*$/, "").replace("T", "-");
  const rand = Math.random().toString(36).slice(2, 6);
  const name = code !== undefined ? `${mode}-${code}-${index ?? date}-${stamp}-${rand}.json` : `${mode}-${index ?? date}-${stamp}-${rand}.json`;
  const path = a.out ? resolve(CWD, a.out) : join(ROOT, "playtest", "sessions", name);
  const f: SessionFile = {
    format: FORMAT, mode, ...(code !== undefined ? { variant: code } : {}), index, date, seedKey: blinded ? null : seedKey, levelId, tag,
    level, lanterns: [], history: [], complete: false, createdAt: now.toISOString(), completedAt: null, actions: [],
  };
  const s = stateOf(f);
  log(f, "new", s, "created");
  save(path, f);
  console.log(`session: ${path}`);
  console.log(header(f));
  if (variant !== null) {
    console.log(RULE_TEXT[variant]);
  } else {
    console.log("Goal: light every floor cell. A lantern lights its own cell and shines in 4 directions until a stone or the edge.");
    console.log("Two lanterns that shine on each other conflict. Use at most the budget.");
  }
  console.log(render(f, s));
}

function cmdMove(a: Record<string, string | undefined>): void {
  const { f, path } = load(a.session);
  const s = stateOf(f);
  const raw = a.cell ?? "";
  const illegal = (reason: string): void => {
    log(f, "move", s, "illegal", { cell: raw, reason });
    save(path, f);
    console.log(render(f, s, `ILLEGAL: ${reason}`));
  };
  if (f.complete) return illegal("the level is already complete (no moves after completion)");
  const p = parseCell(raw);
  if (!p) return illegal(`"${raw}" is not a cell; use a column letter and a row number, e.g. C4`);
  if (p.x >= s.w || p.y >= s.h) {
    return illegal(`${raw.toUpperCase()} is outside the board (columns A–${COLS[s.w - 1]}, rows 1–${s.h})`);
  }
  const name = cellName(p.x, p.y);
  if (L.hasBit(s.stones, L.index(p.x, p.y))) return illegal(`${name} is a stone`);
  const next = toggleState(f, s, p);
  if (!next) return illegal(`${name} cannot be toggled`);
  const placed = L.popcount(next.lanterns) > L.popcount(s.lanterns);
  f.history.push(name);
  setLanterns(f, next);
  log(f, "move", next, placed ? "placed" : "removed", { cell: name });
  save(path, f);
  const st = stats(f, next);
  let note = placed ? `Placed a lantern at ${name}.` : `Removed the lantern at ${name}.`;
  if (placed && st.conflicts.includes(name)) note += ` It conflicts with ${st.conflicts.filter((c) => c !== name).join(" ")}.`;
  const budget = f.level.budget;
  if (budget !== null && st.used > budget) note += ` Over budget (${st.used}/${budget}): it cannot complete like this.`;
  console.log(render(f, next, note));
}

function cmdShow(a: Record<string, string | undefined>): void {
  const { f, path } = load(a.session);
  const s = stateOf(f);
  log(f, "show", s, "shown");
  save(path, f);
  console.log(header(f));
  console.log(render(f, s));
}

function cmdUndo(a: Record<string, string | undefined>): void {
  const { f, path } = load(a.session);
  const s = stateOf(f);
  if (f.complete || f.history.length === 0) {
    const reason = f.complete ? "the level is already complete" : "nothing to undo";
    log(f, "undo", s, "illegal", { reason });
    save(path, f);
    console.log(render(f, s, `ILLEGAL: ${reason}`));
    return;
  }
  const name = f.history.pop()!;
  const next = toggleState(f, s, parseCell(name)!)!;
  const placed = L.popcount(next.lanterns) > L.popcount(s.lanterns);
  setLanterns(f, next);
  log(f, "undo", next, placed ? "re-placed" : "un-placed", { cell: name });
  save(path, f);
  console.log(render(f, next, `Undid the last toggle at ${name} (${placed ? "lantern back" : "lantern removed"}).`));
}

function cmdRestart(a: Record<string, string | undefined>): void {
  const { f, path } = load(a.session);
  const s = stateOf(f);
  if (f.complete) {
    log(f, "restart", s, "illegal", { reason: "the level is already complete" });
    save(path, f);
    console.log(render(f, s, "ILLEGAL: the level is already complete; start a new session with `new`."));
    return;
  }
  const next = freshState(f);
  f.history = [];
  setLanterns(f, next);
  log(f, "restart", next, "cleared");
  save(path, f);
  console.log(render(f, next, "Board cleared."));
}

/** Of `cells`, the one lighting the most still-dark cells (the most useful nudge). */
function bestNudge(s: AnyState, cells: readonly { x: number; y: number }[]): string | null {
  const dark = L.darkCells({ ...s, budget: 0 });
  let bestCell: string | null = null;
  let bestGain = -1;
  for (const c of cells) {
    const lit = L.analyze({ ...s, budget: 0, lanterns: L.withBit(L.EMPTY, L.index(c.x, c.y), true) }).lit;
    const g = L.popcount({ lo: (lit.lo & dark.lo) >>> 0, hi: (lit.hi & dark.hi) >>> 0 });
    if (g > bestGain) [bestGain, bestCell] = [g, cellName(c.x, c.y)];
  }
  return bestCell;
}

/** Numbered boards: the core hint engine, worded neutrally (it never says which solution or "optimal"). */
function hintNumbered(f: SessionFile, s: P.PipsState): { cell: string; msg: string } {
  const level = pipsLevelOf(f);
  const recent = historyCells(f);
  const h = P.hintFor(level, s, recent[recent.length - 1], recent);
  if (h.kind === "none") return { cell: "", msg: "Hint: nothing to add." };
  if (h.kind === "removeWrong") {
    const name = idxName(h.cells[0]!);
    return { cell: name, msg: `Take back the lantern at ${name} (1 of ${h.remaining})` };
  }
  const cell = idxName(h.cell);
  const anchor = idxName(h.anchor);
  const isNumber = level.clues[h.anchor] !== P.NO_CLUE;
  let why: string;
  if (h.reason === "stone") why = `look at the number at ${anchor}.`;
  else if (h.reason === "onlyLight") why = h.anchor === h.cell ? `${cell} can only be lit by a lantern on itself.` : `it is the only cell left that can light ${anchor}.`;
  else {
    const ruled = (h.ruledOut ?? []).slice(0, 3).map(idxName);
    const self = !isNumber && h.anchor === h.cell;
    const what = isNumber ? `the number at ${anchor}` : `lighting ${anchor}`;
    const breaks = `a lantern at ${ruled.join(" or ")} would break the board right away`;
    why = ruled.length === 0
      ? `try the other cells for ${what}: each breaks the board right away.`
      : self ? `${breaks}, so ${cell} has to light itself.` : `${breaks}, which leaves ${cell} for ${what}.`;
  }
  return { cell, msg: `Hint: put a lantern at ${cell} — ${why}` };
}

function cmdHint(a: Record<string, string | undefined>): void {
  const { f, path } = load(a.session);
  const s = stateOf(f);
  if (f.complete) {
    log(f, "hint", s, "illegal", { reason: "the level is already complete" });
    save(path, f);
    console.log(render(f, s, "ILLEGAL: the level is already complete."));
    return;
  }
  if (numbered(f)) {
    const { cell, msg } = hintNumbered(f, s as P.PipsState);
    log(f, "hint", s, "given", { cell });
    save(path, f);
    console.log(render(f, s, msg));
    return;
  }
  const ls = s as L.LanternsState;
  const level = lanternsLevelOf(f);
  const best = solve(level, { firstOnly: true });
  const optimal = best.min;
  // E (spare lanterns): extend the current position to any solution within the budget.
  const spare = variantOf(f) === "E";
  const a0 = L.analyze(ls);
  let msg: string;
  let cell: string | null = null;
  // Prefer a lantern that extends the current (conflict-free) position to an
  // optimal solution; otherwise point at an optimal solution from scratch.
  const ext = L.popcount(a0.conflicts) === 0 && a0.used > 0
    ? solve(level, { fixed: ls.lanterns, firstOnly: true, maxTotal: spare ? level.budget : optimal })
    : null;
  const pickFrom = (sol: L.BB): string | null => bestNudge(s, L.cellsOf(sol).filter((c) => !L.hasBit(ls.lanterns, L.index(c.x, c.y))));
  if (ext && ext.min > 0) {
    cell = pickFrom(ext.solution);
    msg = spare
      ? `Hint: put a lantern at ${cell} — it fits with all your current lanterns.`
      : `Hint: put a lantern at ${cell} — it fits with all your current lanterns.`;
  } else {
    cell = pickFrom(best.solution);
    msg = `Hint: ${cell} — try a lantern there.`;
    if (a0.used > 0) {
      msg += L.popcount(a0.conflicts) > 0
        ? " First resolve the conflict."
        : " Some of your current lanterns need to move.";
    }
  }
  log(f, "hint", s, "given", { cell: cell ?? "" });
  save(path, f);
  console.log(render(f, s, msg));
}

// ------------------------------------------------------------------ main

const [cmd, ...rest] = process.argv.slice(2);
const { values } = parseArgs({
  args: rest,
  options: {
    mode: { type: "string" }, index: { type: "string" }, date: { type: "string" }, out: { type: "string" }, variant: { type: "string", short: "v" },
    session: { type: "string", short: "s" }, cell: { type: "string", short: "c" }, track: { type: "string" },
  },
  strict: true,
});
const args = values as Record<string, string | undefined>;
switch (cmd) {
  case "new": cmdNew(args); break;
  case "move": cmdMove(args); break;
  case "show": cmdShow(args); break;
  case "undo": cmdUndo(args); break;
  case "hint": cmdHint(args); break;
  case "restart": cmdRestart(args); break;
  default: fail(cmd ? `unknown command ${cmd}` : "missing command");
}
