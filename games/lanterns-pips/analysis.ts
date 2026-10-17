// Board read-out for the UI and the CLI harness (pure, integer-only).
// Cell index = y * 8 + x (stride 8), as everywhere in lanterns.
//
// "Legal additional lantern" on cell q, given the current lanterns and numbers:
//   q is floor, holds no lantern, is not lit (a lantern there would see the
//   one lighting it), and no numbered stone next to q is already full (a
//   lantern on q would push that number over its count).
// blocked = dark floor cells that no legal additional lantern can light (none
//   of the cells of its row/column runs, itself included, is legal), each with
//   every cause present (round 4: testers were sent to the rocks when their own
//   lantern's light was the real blocker):
//   lanterns  placed lanterns whose light covers a candidate that light alone
//             excludes (the candidate is lit but borders no full numbered stone,
//             so it could otherwise have lit the cell), ascending; if every lit
//             candidate also borders a full number, the lanterns lighting any
//             lit candidate (light is still half of the cause)
//   stones    full numbered stones that exclude a dark (light-legal) candidate,
//             ascending (as before; a dark cell is always its own light-legal
//             candidate, so this is never empty)
//   causes    'light' if lanterns ≠ [], 'stone' if stones ≠ [] (in that order)
//   by        'light' if lanterns ≠ [] (light is the more actionable cause), else 'stone'
// deadCells = blocked.map(b => b.cell) (compatibility).
// Stone status (numbered stones only; no "numbers matched" counter exists):
//   over     more adjacent lanterns than the number
//   ok       exactly the number (a 0-stone is ok only with no adjacent lantern)
//   blocked  fewer than the number, and its free adjacent cells (legal as
//            above) are fewer than it still needs — none at all included
//   under    fewer than the number, still completable around it
//
// Round 5 — who to blame (testers: "J-16 listed five lanterns and three rocks";
// "J-12's 2 went ⊘ with no explanation"). "Wrong" = a placed lantern that is
// not in the level's unique solution (first solution found for hand-made
// boards; none when the board has no solution).
//   blocked[].culprits  the WRONG lanterns involved in the cell being blocked:
//             lighting one of its spots, or filling a full number that rules
//             out one of its spots; ascending. Usually one. For a board with a
//             unique solution it is never empty (the solution's lantern for the
//             cell is out, and only a wrong lantern can put it out).
//             (Superset of `lanterns ∩ wrong`: a wrong lantern that fills one of
//             the listed `stones` is a culprit too.)
//   stuckStones  numbered stones that can no longer come right, ascending:
//             'cannotReach' (status 'blocked': fewer legal free sides than it
//             still needs) with the lanterns lighting its free sides, filling a
//             full number next to one of its sides, or standing on its sides;
//             'over' (too many) with the lanterns on its sides. Each list is
//             filtered to the wrong lanterns when any of them is wrong.
//   culprit   ONE wrong lantern to point at: among the wrong lanterns in
//             blocked[].culprits and stuckStones[].lanterns, the most culpable
//             (mostCulpable: blocked cells freed + stuck numbers freed when it
//             is taken back, then the most recent in `recent`, then conflicts
//             cleared, then lowest cell); null if no wrong lantern is involved.
//
// Round 7 (r6 Priya J-25: "take back A5" was right, but after it nothing was
// stuck although the wrong C7 had made the board unsolvable).
//   deadEnd   when nothing is stuck locally (no blocked cell, no stuck number,
//             no conflict): following forced moves (T1 + T2, all of a round at
//             once, up to FORCED_ROUNDS rounds; deduce.ts forcedDeadEnd) from
//             the placed lanterns breaks — { at, kind: 'number' | 'cell', rounds }.
//             Sound rules ⇒ some placed lantern is wrong. The culprit is then
//             chosen among ALL wrong lanterns. null otherwise.
//   culprit ranking (mostCulpableOf, also the removeWrong hint): first the
//             lanterns whose removal makes the position solvable again (exact
//             solver with the remaining lanterns fixed), then those whose removal
//             leaves nothing stuck (no blocked cell, stuck number or dead end),
//             then the round-5 keys. Solvability is cached per (level, lanterns).

import { buildRays, low32, pop32 } from "../lanterns/solver.ts";
import { type DeadEnd, FORCED_ROUNDS, forcedDeadEnd } from "./deduce.ts";
import { UNIQUE_GATE_NODES } from "./generator.ts";
import { type BB, NO_CLUE, type PipsLevel, type PipsState, hasBit, isComplete, neighbours } from "./rules.ts";
import { type PipsModel, buildModel, countSolutions } from "./solver.ts";

export type StoneStatus = "under" | "ok" | "over" | "blocked";

export interface StoneInfo {
  cell: number;
  need: number;
  have: number;
  status: StoneStatus;
}

export interface BlockedCell {
  cell: number;
  /** 'light' if `lanterns` is non-empty (the more actionable cause), else 'stone'. */
  by: "light" | "stone";
  /** Full numbered stones that exclude a dark (light-legal) candidate, ascending. */
  stones: number[];
  /** Placed lanterns whose light covers a candidate that could otherwise have lit the cell, ascending. */
  lanterns: number[];
  /** Causes present: 'light' (lanterns ≠ []) then 'stone' (stones ≠ []). */
  causes: Array<"light" | "stone">;
  /** The wrong lanterns (not in the unique solution) involved: lighting a spot or filling a full number that rules one out, ascending. */
  culprits: number[];
}

export type StuckReason = "cannotReach" | "over";

export interface StuckStone {
  /** Numbered stone cell. */
  stone: number;
  /** cannotReach = too few legal free sides left for its count; over = too many lanterns on its sides. */
  reason: StuckReason;
  /** The player's lanterns making it impossible, ascending; only the wrong ones when any is wrong. */
  lanterns: number[];
}

export interface BoardAnalysis {
  /** Lit floor cells (lantern cells included) / floor cells. */
  litCount: number;
  floorCount: number;
  /** Per cell (64, index y*8+x): 1 = lit floor. */
  lit: Uint8Array;
  /** Per cell: number of lanterns lighting it (a lantern lights its own cell). ≥ 2 = double-lit. */
  litBy: Uint8Array;
  /** Pairs [a, b] (a < b) of lantern cells that see each other, ascending. */
  conflicts: Array<[number, number]>;
  /** Numbered stones, ascending cell. */
  stones: StoneInfo[];
  /** Dark floor cells no legal additional lantern can light, with the cause, ascending cell. */
  blocked: BlockedCell[];
  /** = blocked.map(b => b.cell) (kept for compatibility). */
  deadCells: number[];
  complete: boolean;
  /** Numbered stones that can no longer come right (cannotReach / over), ascending. */
  stuckStones: StuckStone[];
  /** ONE wrong lantern to point at when stuck (the most culpable one involved in a blocked cell, a stuck stone or the dead end), else null. */
  culprit: number | null;
  /** Round 7: forced moves lead into a contradiction although nothing is stuck locally (see header), else null. */
  deadEnd: DeadEnd | null;
}

/** Board read-out without the blame fields (culprits / stuckStones / culprit). */
export type CoreAnalysis = Omit<BoardAnalysis, "blocked" | "stuckStones" | "culprit" | "deadEnd"> & {
  blocked: Array<Omit<BlockedCell, "culprits">>;
};

const inMask = (lo: number, hi: number, i: number): boolean => ((i < 32 ? lo >>> i : hi >>> (i - 32)) & 1) === 1;

function bitsOf(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let t = lo >>> 0; t !== 0; t = (t & (t - 1)) >>> 0) out.push(low32(t));
  for (let t = hi >>> 0; t !== 0; t = (t & (t - 1)) >>> 0) out.push(low32(t) + 32);
  return out;
}

interface Internals {
  lanterns: number[];
  lightFrom: number[][];
  fullNext: number[][];
  legal: Uint8Array;
}

/** The board read-out without blame (no solver call); used for culpability scoring. */
export function analyzeCore(level: PipsLevel, state: PipsState): CoreAnalysis {
  return core(level, state).a;
}

function core(level: PipsLevel, state: PipsState): { a: CoreAnalysis; x: Internals } {
  const r = buildRays(level);
  const lanterns = bitsOf((state.lanterns.lo & r.floorLo) >>> 0, (state.lanterns.hi & r.floorHi) >>> 0);
  const litBy = new Uint8Array(64);
  let litLo = 0;
  let litHi = 0;
  for (const q of lanterns) {
    litLo = (litLo | r.lo[q]!) >>> 0;
    litHi = (litHi | r.hi[q]!) >>> 0;
    for (const c of bitsOf(r.lo[q]!, r.hi[q]!)) litBy[c] = litBy[c]! + 1;
  }
  const lit = new Uint8Array(64);
  const litCells = bitsOf((litLo & r.floorLo) >>> 0, (litHi & r.floorHi) >>> 0);
  for (const c of litCells) lit[c] = 1;
  const floorCount = pop32(r.floorLo) + pop32(r.floorHi);
  const conflicts: Array<[number, number]> = [];
  for (let a = 0; a < lanterns.length; a++) {
    const p = lanterns[a]!;
    for (let b = a + 1; b < lanterns.length; b++) {
      const q = lanterns[b]!;
      if (inMask(r.lo[p]!, r.hi[p]!, q)) conflicts.push([p, q]);
    }
  }
  // Numbered stones: have / need; a full stone forbids lanterns on its sides.
  const have = new Uint8Array(64);
  const legal = new Uint8Array(64);
  const darkFloor = bitsOf((r.floorLo & ~litLo) >>> 0, (r.floorHi & ~litHi) >>> 0);
  for (const c of darkFloor) legal[c] = 1;
  /** Per cell: full numbered stones next to it (a lantern there would overfill them). */
  const fullNext: number[][] = Array.from({ length: 64 }, () => []);
  const numbered: number[] = [];
  for (let i = 0; i < 64; i++) {
    const v = level.clues[i]!;
    if (v === NO_CLUE) continue;
    numbered.push(i);
    const ns = neighbours(level.w, level.h, i);
    let n = 0;
    for (const j of ns) if (hasBit(state.lanterns, j)) n++;
    have[i] = n;
    if (n >= v) {
      for (const j of ns) {
        legal[j] = 0;
        fullNext[j]!.push(i);
      }
    }
  }
  const stones: StoneInfo[] = [];
  for (const i of numbered) {
    const need = level.clues[i]!;
    const h = have[i]!;
    let status: StoneStatus;
    if (h > need) status = "over";
    else if (h === need) status = "ok";
    else {
      let free = 0;
      for (const j of neighbours(level.w, level.h, i)) free += legal[j]!;
      status = h + free < need ? "blocked" : "under";
    }
    stones.push({ cell: i, need, have: h, status });
  }
  /** Per cell: the lanterns lighting it. */
  const lightFrom: number[][] = Array.from({ length: 64 }, () => []);
  for (const q of lanterns) for (const c of bitsOf(r.lo[q]!, r.hi[q]!)) lightFrom[c]!.push(q);
  const blocked: Array<Omit<BlockedCell, "culprits">> = [];
  for (const c of darkFloor) {
    const cands = bitsOf(r.lo[c]!, r.hi[c]!);
    if (cands.some((q) => legal[q] === 1)) continue;
    const stoneBy: number[] = [];
    const lightOnly: number[] = [];
    const lightAny: number[] = [];
    for (const q of cands) {
      if (!inMask(r.floorLo, r.floorHi, q)) continue;
      if (lit[q] === 1) {
        // Excluded by light: q would see the lantern(s) lighting it.
        const into = fullNext[q]!.length === 0 ? lightOnly : lightAny;
        for (const l of lightFrom[q]!) {
          if (!into.includes(l)) into.push(l);
          if (into !== lightAny && !lightAny.includes(l)) lightAny.push(l);
        }
        continue;
      }
      // Dark candidate: excluded only by full numbered stones.
      for (const s of fullNext[q]!) if (!stoneBy.includes(s)) stoneBy.push(s);
    }
    const byLight = (lightOnly.length > 0 ? lightOnly : lightAny).sort((x, y) => x - y);
    const causes: Array<"light" | "stone"> = [];
    if (byLight.length > 0) causes.push("light");
    if (stoneBy.length > 0) causes.push("stone");
    blocked.push({ cell: c, by: byLight.length > 0 ? "light" : "stone", stones: stoneBy.sort((x, y) => x - y), lanterns: byLight, causes });
  }
  return {
    a: { litCount: litCells.length, floorCount, lit, litBy, conflicts, stones, blocked, deadCells: blocked.map((b) => b.cell), complete: isComplete(state) },
    x: { lanterns, lightFrom, fullNext, legal },
  };
}

// ---------------------------------------------------------------- blame

const solutionCache = new WeakMap<object, BB | null>();

/** The level's solution (unique for generated levels; the first found otherwise), null if none. Cached per level object. */
export function levelSolution(level: PipsLevel): BB | null {
  if (solutionCache.has(level)) return solutionCache.get(level)!;
  const res = countSolutions(level, 1, UNIQUE_GATE_NODES);
  const sol = res.count > 0 ? res.solution : null;
  solutionCache.set(level, sol);
  return sol;
}

const modelCache = new WeakMap<object, PipsModel>();

function modelOf(level: PipsLevel): PipsModel {
  let m = modelCache.get(level);
  if (m === undefined) {
    m = buildModel(level);
    modelCache.set(level, m);
  }
  return m;
}

const solvableCache = new WeakMap<object, Map<string, boolean>>();
const SOLVABLE_CACHE_MAX = 512;

/** Round 7: the placed lanterns extend to a full solution (exact solver, lanterns fixed). Cached per (level, lanterns). */
export function solvableWith(level: PipsLevel, lanterns: BB): boolean {
  let c = solvableCache.get(level);
  if (c === undefined) {
    c = new Map();
    solvableCache.set(level, c);
  }
  const key = `${lanterns.lo >>> 0}:${lanterns.hi >>> 0}`;
  const hit = c.get(key);
  if (hit !== undefined) return hit;
  const res = countSolutions(level, 1, UNIQUE_GATE_NODES, modelOf(level), lanterns);
  const ok = res.count > 0;
  if (c.size >= SOLVABLE_CACHE_MAX) c.delete(c.keys().next().value!);
  c.set(key, ok);
  return ok;
}

/** Something is stuck: a blocked cell, a stuck number, or (no conflict) a forced dead end. */
function stuckAnywhere(level: PipsLevel, a: CoreAnalysis, lanterns: BB): boolean {
  if (a.blocked.length > 0 || a.stones.some((s) => s.status === "over" || s.status === "blocked")) return true;
  if (a.conflicts.length > 0 || (lanterns.lo | lanterns.hi) === 0) return false;
  return forcedDeadEnd(modelOf(level), lanterns, FORCED_ROUNDS) !== null;
}

function clearBit(b: BB, i: number): BB {
  return i < 32 ? { lo: (b.lo & ~(1 << i)) >>> 0, hi: b.hi } : { lo: b.lo, hi: (b.hi & ~(1 << (i - 32))) >>> 0 };
}

function dist(a: number, b: number): number {
  const dx = (a & 7) - (b & 7);
  const dy = (a >> 3) - (b >> 3);
  return (dx < 0 ? -dx : dx) + (dy < 0 ? -dy : dy);
}

/** Blocked cells freed + numbered stones no longer over / no longer stuck, between two read-outs. */
export function culpability(before: CoreAnalysis, after: CoreAnalysis): number {
  const still = new Set(after.deadCells);
  let n = 0;
  for (const c of before.deadCells) if (!still.has(c)) n++;
  const statusAfter = new Map(after.stones.map((x) => [x.cell, x.status]));
  for (const x of before.stones) {
    if ((x.status === "over" || x.status === "blocked") && statusAfter.get(x.cell) !== x.status) n++;
  }
  return n;
}

/**
 * The most culpable of `cands` (placed lanterns). Round 7 first: taking it back makes the position
 * solvable (exact solver), then taking it back leaves nothing stuck (stuckAnywhere). Then round 5:
 * the most blocked cells + stuck numbers freed by taking it back; ties → latest in `recent`, then
 * most conflicts cleared, then nearest to `last`, then lowest cell. -1 if empty.
 */
export function mostCulpableOf(level: PipsLevel, state: PipsState, cands: readonly number[], last: number, recent: readonly number[]): number {
  const before = analyzeCore(level, state);
  let best = -1;
  let bk: number[] = [];
  for (const w of cands) {
    const rest = clearBit(state.lanterns, w);
    const after = analyzeCore(level, { ...state, lanterns: rest });
    const key = [
      solvableWith(level, rest) ? 1 : 0,
      stuckAnywhere(level, after, rest) ? 0 : 1,
      culpability(before, after),
      recent.lastIndexOf(w),
      before.conflicts.length - after.conflicts.length,
      last >= 0 ? -dist(w, last) : 0,
      -w,
    ];
    let better = best < 0;
    for (let t = 0; t < key.length && !better; t++) {
      if (key[t]! > bk[t]!) better = true;
      else if (key[t]! < bk[t]!) break;
    }
    if (better) [best, bk] = [w, key];
  }
  return best;
}

const inSol = (sol: BB, i: number): boolean => ((i < 32 ? sol.lo >>> i : sol.hi >>> (i - 32)) & 1) === 1;

function addAll(into: number[], xs: readonly number[]): void {
  for (const x of xs) if (!into.includes(x)) into.push(x);
}

/**
 * Board read-out for the UI (see header). `recent` = the player's toggles,
 * oldest first (optional): the culprit tie-break prefers the latest.
 */
export function analyzeBoard(level: PipsLevel, state: PipsState, recent?: readonly number[]): BoardAnalysis {
  const { a, x } = core(level, state);
  const sol = x.lanterns.length > 0 && (a.blocked.length > 0 || a.stones.some((s) => s.status === "over" || s.status === "blocked")) ? levelSolution(level) : null;
  const isWrong = (l: number): boolean => sol !== null && !inSol(sol, l);
  /** Lanterns on the sides of numbered stone s. */
  const sideLanterns = (s: number): number[] => neighbours(level.w, level.h, s).filter((j) => x.lanterns.includes(j));
  const r = buildRays(level);
  const blocked: BlockedCell[] = a.blocked.map((b) => {
    const involved: number[] = [];
    for (const q of bitsOf(r.lo[b.cell]!, r.hi[b.cell]!)) {
      addAll(involved, x.lightFrom[q]!);
      for (const s of x.fullNext[q]!) addAll(involved, sideLanterns(s));
    }
    return { ...b, culprits: involved.filter(isWrong).sort((p, q) => p - q) };
  });
  const stuckStones: StuckStone[] = [];
  for (const st of a.stones) {
    if (st.status !== "over" && st.status !== "blocked") continue;
    const involved: number[] = sideLanterns(st.cell);
    if (st.status === "blocked") {
      for (const j of neighbours(level.w, level.h, st.cell)) {
        if (x.legal[j] === 1 || x.lanterns.includes(j) || hasBit(level.stones, j)) continue;
        addAll(involved, x.lightFrom[j]!);
        for (const s of x.fullNext[j]!) if (s !== st.cell) addAll(involved, sideLanterns(s));
      }
    }
    const wrong = involved.filter(isWrong);
    stuckStones.push({ stone: st.cell, reason: st.status === "over" ? "over" : "cannotReach", lanterns: (wrong.length > 0 ? wrong : involved).sort((p, q) => p - q) });
  }
  const cands: number[] = [];
  for (const b of blocked) addAll(cands, b.culprits);
  for (const s of stuckStones) addAll(cands, s.lanterns.filter(isWrong));
  // Round 7: nothing stuck locally — a forced dead end still proves a wrong lantern; blame among all wrong ones.
  let deadEnd: DeadEnd | null = null;
  if (blocked.length === 0 && stuckStones.length === 0 && a.conflicts.length === 0 && x.lanterns.length > 0) {
    deadEnd = forcedDeadEnd(modelOf(level), state.lanterns, FORCED_ROUNDS);
    if (deadEnd !== null) {
      const s2 = levelSolution(level);
      if (s2 !== null) addAll(cands, x.lanterns.filter((l) => !inSol(s2, l)));
    }
  }
  cands.sort((p, q) => p - q);
  const hist = recent ?? [];
  const last = hist.length > 0 ? hist[hist.length - 1]! : -1;
  const culprit = cands.length === 0 ? null : mostCulpableOf(level, state, cands, last, hist);
  return { ...a, blocked, stuckStones, culprit, deadEnd };
}
