// Seeded Lanterns level generator. Pure and integer-only (CLAUDE.md): the same
// seed key yields the same level on every platform, so the Workers verifier
// can regenerate a daily from its key. Spec + filter rationale:
// docs/lanterns-generator.md.
//
// generate(params):
//   rng = Rng.from(seedKey)
//   repeat (attempt = 0..):
//     stones  = seeded layout (density in [densityMin, densityMax] %, optional symmetry),
//               or (2 of 3 attempts once a candidate exists) the best candidate
//               with one stone moved — hill-climbing toward the target band
//     reject  structural filters (disconnected floor, isolated cell, open room)
//     solve   exact minimum + number of minimum solutions (solver.ts)
//     reject  solution filters (minimum too small, trivially forced, solver gave up)
//     score   difficulty = human-like bot runs (8 screen + 56 confirm), estimated seconds (human.ts)
//     accept  median inside params.target, fast runs >= 0.4 × lo, slow runs
//             <= 1.5 × hi; otherwise keep the closest
//   after maxAttempts the closest valid candidate is returned (meta.inBand = false).
//   budget = minLanterns + slack (0 = tight, 1 = one spare lantern).

import { Rng } from "../../core/rng.ts";
import { type HumanTrace, humanSolve } from "./human.ts";
import { type BB, EMPTY, type LanternsLevel, index, validateLevel } from "./rules.ts";
import { type Rays, buildRays, candCount, low32, pop32, solve } from "./solver.ts";

export const GENERATOR_VERSION = 1;

export type Symmetry = "none" | "rot180" | "mirror";

export interface Band {
  readonly lo: number;
  readonly hi: number;
}

export interface GenParams {
  readonly seedKey: string;
  readonly levelId: number;
  readonly w: number;
  readonly h: number;
  /** Stone density range, percent of all cells (inclusive). */
  readonly densityMin: number;
  readonly densityMax: number;
  /** "any": drawn per attempt (rot180 2/4, mirror 1/4, none 1/4). */
  readonly symmetry: Symmetry | "any";
  /** budget = minLanterns + slack. */
  readonly slack: number;
  /** Target difficulty (estimated seconds, see difficultyOf). */
  readonly target: Band;
  readonly maxAttempts: number;
  /** Label for UIs/logs, e.g. "easy" for a roller-coaster breather. */
  readonly tag: string;
}

/** Why candidates were thrown away (counted per generate call). */
export const REJECT_REASONS = ["disconnected", "isolated", "openRoom", "tooFew", "forced", "solverLimit"] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

export interface GenMeta {
  readonly minLanterns: number;
  /** Distinct minimum solutions, capped at SOLUTION_CAP. */
  readonly solutions: number;
  readonly solutionsCapped: boolean;
  /** One minimum solution (for hints / dev tools; never shown up front). */
  readonly solution: BB;
  /** ‰ of placements a deduction-only player can make without a guess (see forcedPermille). */
  readonly forcedPermille: number;
  /** Difficulty score: median estimated seconds of the human-like bot (see difficultyFrom). */
  readonly difficulty: number;
  /** Fast-run estimate (~p20 of the bot runs), seconds. */
  readonly difficultyFast: number;
  /** Slow-run estimate (~p88 of the bot runs), seconds. */
  readonly difficultyTail: number;
  readonly inBand: boolean;
  readonly attempts: number;
  readonly rejected: Readonly<Record<RejectReason, number>>;
  readonly outOfBand: number;
  readonly stones: number;
  readonly symmetry: Symmetry;
}

export interface GeneratedLevel {
  readonly seedKey: string;
  readonly levelId: number;
  readonly tag: string;
  readonly level: LanternsLevel;
  readonly meta: GenMeta;
}

export const SOLUTION_CAP = 64;
const SOLVER_NODE_CAP = 300000;

/** Time model shared with sim/ (seconds; integer). */
export const TIME_MODEL = { place: 4, remove: 2, deadEnd: 6 } as const;

export function traceSeconds(t: HumanTrace, m: { place: number; remove: number; deadEnd: number } = TIME_MODEL): number {
  return t.placements * m.place + t.removals * m.remove + t.deadEnds * m.deadEnd;
}

/** Unsigned integer division for 0 <= a < 2^31, b > 0 (no `/` in pure code). */
export function udiv(a: number, b: number): number {
  let q = 0;
  let rem = 0;
  for (let i = 30; i >= 0; i--) {
    rem = (rem << 1) | ((a >>> i) & 1);
    if (rem >= b) {
      rem -= b;
      q |= 1 << i;
    }
  }
  return q;
}

// ---------------------------------------------------------------- layout

function setBit(b: BB, i: number): BB {
  return i < 32 ? { lo: (b.lo | (1 << i)) >>> 0, hi: b.hi } : { lo: b.lo, hi: (b.hi | (1 << (i - 32))) >>> 0 };
}

function bit(b: BB, i: number): boolean {
  return ((i < 32 ? b.lo >>> i : b.hi >>> (i - 32)) & 1) === 1;
}

function partner(sym: Symmetry, w: number, h: number, i: number): number {
  const x = i & 7;
  const y = i >> 3;
  if (sym === "rot180") return index(w - 1 - x, h - 1 - y);
  if (sym === "mirror") return index(w - 1 - x, y);
  return i;
}

function drawSymmetry(p: GenParams, rng: Rng): Symmetry {
  if (p.symmetry !== "any") return p.symmetry;
  const r = rng.nextInt(4);
  return r < 2 ? "rot180" : r === 2 ? "mirror" : "none";
}

function layStones(p: GenParams, rng: Rng, sym: Symmetry): BB {
  const area = p.w * p.h;
  const pct = p.densityMin + rng.nextInt(p.densityMax - p.densityMin + 1);
  const k = udiv(area * pct + 50, 100);
  const cells: number[] = [];
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) cells.push(index(x, y));
  rng.shuffle(cells);
  let stones = EMPTY;
  let n = 0;
  for (const c of cells) {
    if (n >= k) break;
    if (bit(stones, c)) continue;
    const q = partner(sym, p.w, p.h, c);
    if (q !== c && n + 2 > k + 1) continue; // a pair may overshoot by at most one
    stones = setBit(stones, c);
    n++;
    if (q !== c) {
      stones = setBit(stones, q);
      n++;
    }
  }
  return stones;
}

/**
 * Hill-climbing step: move one stone (with its symmetry partner) to a random
 * floor cell (with its partner). Returns null if the draw does not fit.
 */
function mutateStones(p: GenParams, rng: Rng, sym: Symmetry, stones: BB): BB | null {
  const st: number[] = [];
  const fl: number[] = [];
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) (bit(stones, index(x, y)) ? st : fl).push(index(x, y));
  if (st.length === 0 || fl.length === 0) return null;
  const c = st[rng.nextInt(st.length)]!;
  const d = fl[rng.nextInt(fl.length)]!;
  const cq = partner(sym, p.w, p.h, c);
  const dq = partner(sym, p.w, p.h, d);
  if ((cq === c) !== (dq === d)) return null; // keep the stone count
  const clear = (b: BB, i: number): BB =>
    i < 32 ? { lo: (b.lo & ~(1 << i)) >>> 0, hi: b.hi } : { lo: b.lo, hi: (b.hi & ~(1 << (i - 32))) >>> 0 };
  let out = clear(clear(stones, c), cq);
  if (bit(out, d) || bit(out, dq)) return null;
  out = setBit(setBit(out, d), dq);
  return out;
}

// ---------------------------------------------------------------- filters

function floorConnected(r: Rays): boolean {
  if ((r.floorLo | r.floorHi) === 0) return false;
  const start = r.floorLo !== 0 ? low32(r.floorLo) : low32(r.floorHi) + 32;
  let seen = setBit(EMPTY, start);
  const queue = [start];
  while (queue.length > 0) {
    const c = queue.pop()!;
    const x = c & 7;
    const y = c >> 3;
    const nb = [x > 0 ? c - 1 : -1, x < r.w - 1 ? c + 1 : -1, y > 0 ? c - 8 : -1, y < r.h - 1 ? c + 8 : -1];
    for (const d of nb) {
      if (d < 0 || bit(seen, d)) continue;
      if (!bit({ lo: r.floorLo, hi: r.floorHi }, d)) continue;
      seen = setBit(seen, d);
      queue.push(d);
    }
  }
  return seen.lo === r.floorLo && seen.hi === r.floorHi;
}

/** Floor cells whose row and column segments are both length 1 (a free, forced lantern). */
function isolatedCells(r: Rays): number {
  let n = 0;
  for (let i = 0; i < 64; i++) if (pop32(r.lo[i]!) + pop32(r.hi[i]!) === 1) n++;
  return n;
}

/** Area of the largest stone-free axis-aligned rectangle. */
export function largestOpenRect(level: { w: number; h: number; stones: BB }): number {
  let best = 0;
  for (let y0 = 0; y0 < level.h; y0++) {
    for (let x0 = 0; x0 < level.w; x0++) {
      for (let y1 = y0; y1 < level.h; y1++) {
        for (let x1 = x0; x1 < level.w; x1++) {
          let open = true;
          for (let y = y0; y <= y1 && open; y++) for (let x = x0; x <= x1 && open; x++) if (bit(level.stones, index(x, y))) open = false;
          if (!open) break; // widening further keeps the stone inside
          const a = (x1 - x0 + 1) * (y1 - y0 + 1);
          if (a > best) best = a;
        }
      }
    }
  }
  return best;
}

/** Open-room limit: a stone-free rectangle may cover at most 36% of the board (5×5: 9, 6×6: 12, 7×7: 17, 8×8: 23). */
export function openRoomLimit(w: number, h: number): number {
  return udiv(w * h * 36, 100);
}

/** Minimum acceptable minLanterns: max(3, side - 1) with side = min(w, h). */
export function minLanternsFloor(w: number, h: number): number {
  const side = w < h ? w : h;
  return side - 1 > 3 ? side - 1 : 3;
}

/**
 * Forced-move ratio (‰). A deduction-only player repeatedly places a lantern
 * where a dark cell has exactly ONE non-conflicting position that lights it;
 * when no such cell exists it must guess (we let it guess right: a lantern of
 * `solution` that lights the most constrained dark cell). Ratio = forced
 * placements / all placements. 1000 = solvable with no decision at all.
 */
export function forcedPermille(r: Rays, solution: BB): { forced: number; steps: number; permille: number } {
  let dLo = r.floorLo;
  let dHi = r.floorHi;
  let forced = 0;
  let steps = 0;
  while ((dLo | dHi) !== 0) {
    let best = -1;
    let bestN = 99;
    for (let i = 0; i < 64; i++) {
      if (!bit({ lo: dLo, hi: dHi }, i)) continue;
      const n = candCount(r, i, dLo, dHi);
      if (n < bestN) {
        best = i;
        bestN = n;
      }
    }
    let p = -1;
    const cLo = (r.lo[best]! & dLo) >>> 0;
    const cHi = (r.hi[best]! & dHi) >>> 0;
    if (bestN === 1) {
      p = cLo !== 0 ? low32(cLo) : low32(cHi) + 32;
      forced++;
    } else {
      const sLo = (cLo & solution.lo) >>> 0;
      const sHi = (cHi & solution.hi) >>> 0;
      p = sLo !== 0 ? low32(sLo) : low32(sHi) + 32;
    }
    dLo = (dLo & ~r.lo[p]!) >>> 0;
    dHi = (dHi & ~r.hi[p]!) >>> 0;
    steps++;
  }
  return { forced, steps, permille: steps === 0 ? 1000 : udiv(forced * 1000, steps) };
}

/** Screening runs per candidate; candidates that pass are confirmed with CONFIRM_RUNS more. */
export const SCREEN_RUNS = 8;
export const CONFIRM_RUNS = 56;

export interface Difficulty {
  /** ~p20 of the bot runs (seconds). */
  readonly fast: number;
  readonly median: number;
  /** ~p88. */
  readonly tail: number;
  readonly runs: number;
}

/** Seconds charged for a bot run that gives up (maxActions). */
export const GIVE_UP_SECONDS = 300;

/** Append `runs` human-like bot runs (estimated seconds, TIME_MODEL; give-up = GIVE_UP_SECONDS). */
export function botSeconds(level: LanternsLevel, rng: Rng, runs: number, out: number[], rays?: Rays): number[] {
  const r = rays ?? buildRays(level);
  for (let k = 0; k < runs; k++) {
    const botRng = new Rng(rng.nextU32(), rng.nextU32(), rng.nextU32(), rng.nextU32() | 1);
    const t = humanSolve(level, { rng: botRng, lookahead: true, maxActions: 400, record: false }, r);
    const sec = t.completed ? traceSeconds(t) : GIVE_UP_SECONDS;
    out.push(sec < GIVE_UP_SECONDS ? sec : GIVE_UP_SECONDS);
  }
  return out;
}

/** Quantiles of bot seconds (index = (n−1)·q‰, rounded down). */
export function difficultyFrom(samples: readonly number[]): Difficulty {
  const s = samples.slice().sort((a, b) => a - b);
  const q = (pm: number): number => s[udiv((s.length - 1) * pm, 1000)]!;
  return { fast: q(200), median: q(500), tail: q(880), runs: s.length };
}

/** Difficulty of a level from `runs` seeded bot runs. */
export function difficultyOf(level: LanternsLevel, rng: Rng, runs = SCREEN_RUNS + CONFIRM_RUNS, rays?: Rays): Difficulty {
  return difficultyFrom(botSeconds(level, rng, runs, [], rays));
}

// ---------------------------------------------------------------- generate

/**
 * 0 = in band: median inside [lo, hi], fast runs ≥ FAST_PERMILLE of lo (the
 * level is not usually solved by a lucky greedy pass), slow runs ≤
 * TAIL_PERMILLE of hi (no long grind). Otherwise: total seconds off.
 */
function bandDistance(d: Difficulty, b: Band): number {
  const m = d.median < b.lo ? b.lo - d.median : d.median > b.hi ? d.median - b.hi : 0;
  const fastMin = udiv(b.lo * FAST_PERMILLE, 1000);
  const tailMax = udiv(b.hi * TAIL_PERMILLE, 1000);
  // Tail excess weighs 1/2: a slightly long tail beats a board that is trivially fast.
  return m + (d.fast < fastMin ? fastMin - d.fast : 0) + (d.tail > tailMax ? (d.tail - tailMax) >>> 1 : 0);
}

export const FAST_PERMILLE = 400;
export const TAIL_PERMILLE = 1500;

export function generate(p: GenParams): GeneratedLevel {
  validateLevel({ w: p.w, h: p.h, budget: 0, stones: EMPTY });
  const rng = Rng.from(p.seedKey);
  const rejected: Record<RejectReason, number> = { disconnected: 0, isolated: 0, openRoom: 0, tooFew: 0, forced: 0, solverLimit: 0 };
  let outOfBand = 0;
  let best: { level: LanternsLevel; meta: Omit<GenMeta, "attempts" | "rejected" | "outOfBand" | "inBand">; dist: number } | null = null;
  const roomMax = openRoomLimit(p.w, p.h);
  const minFloor = minLanternsFloor(p.w, p.h);
  let attempt = 0;
  // Hard stop far beyond maxAttempts so a pathological parameter set still returns.
  for (; attempt < p.maxAttempts * 20; attempt++) {
    if (best !== null && attempt >= p.maxAttempts) break;
    // Two of every three attempts once a candidate exists: hill-climb from the
    // best one (move a stone); otherwise a fresh random layout.
    let sym: Symmetry;
    let stones: BB | null = null;
    if (best !== null && attempt % 3 !== 0) {
      sym = best.meta.symmetry;
      stones = mutateStones(p, rng, sym, best.level.stones);
    } else {
      sym = drawSymmetry(p, rng);
    }
    if (stones === null) stones = layStones(p, rng, (sym = drawSymmetry(p, rng)));
    const shape = { w: p.w, h: p.h, stones };
    const r = buildRays(shape);
    if (!floorConnected(r)) {
      rejected.disconnected++;
      continue;
    }
    if (isolatedCells(r) > 0) {
      rejected.isolated++;
      continue;
    }
    if (largestOpenRect(shape) > roomMax) {
      rejected.openRoom++;
      continue;
    }
    const sol = solve(shape, { countCap: SOLUTION_CAP, nodeCap: SOLVER_NODE_CAP }, r);
    if (sol.aborted || sol.min < 0) {
      rejected.solverLimit++;
      continue;
    }
    if (sol.min < minFloor) {
      rejected.tooFew++;
      continue;
    }
    const fm = forcedPermille(r, sol.solution);
    if (fm.permille >= 1000) {
      rejected.forced++;
      continue;
    }
    const level: LanternsLevel = { w: p.w, h: p.h, budget: sol.min + p.slack, stones };
    // Two stages: a cheap screen, then confirmation on the pooled runs. Picking
    // the best of many candidates on few noisy runs would select lucky
    // estimates (winner's curse); the confirmation runs undo most of that.
    const samples = botSeconds(level, rng, SCREEN_RUNS, [], r);
    let difficulty = difficultyFrom(samples);
    let dist = bandDistance(difficulty, p.target);
    if (dist === 0 || best === null || dist < best.dist) {
      difficulty = difficultyFrom(botSeconds(level, rng, CONFIRM_RUNS, samples, r));
      dist = bandDistance(difficulty, p.target);
    }
    const meta: Omit<GenMeta, "attempts" | "rejected" | "outOfBand" | "inBand"> = {
      minLanterns: sol.min, solutions: sol.count, solutionsCapped: sol.capped, solution: sol.solution,
      forcedPermille: fm.permille, difficulty: difficulty.median, difficultyFast: difficulty.fast, difficultyTail: difficulty.tail, stones: pop32(stones.lo) + pop32(stones.hi), symmetry: sym,
    };
    if (best === null || dist < best.dist) best = { level, meta, dist };
    if (dist === 0) break;
    outOfBand++;
  }
  if (best === null) throw new Error(`generator: no valid level for ${p.seedKey}`);
  validateLevel(best.level);
  return {
    seedKey: p.seedKey, levelId: p.levelId, tag: p.tag, level: best.level,
    meta: { ...best.meta, inBand: best.dist === 0, attempts: attempt + (best.dist === 0 ? 1 : 0), rejected, outOfBand },
  };
}

// ---------------------------------------------------------------- curves

/** Size tiers for free play: 1–5 → 5×5, 6–14 → 6×6, 15+ → 7×7. */
export function sizeForIndex(n: number): number {
  return n <= 5 ? 5 : n <= 14 ? 6 : 7;
}

/**
 * Roller-coaster within a 5-level cycle: mid, mid+, HARD, easy (breather with a
 * spare lantern), mid. Levels 1–2 are a gentle on-ramp with a spare lantern.
 */
export const CYCLE = ["mid", "mid+", "hard", "easy", "mid"] as const;

/** Difficulty bands (estimated seconds) per size and tag. */
export const BANDS: Readonly<Record<number, Readonly<Record<string, Band>>>> = {
  5: { intro: { lo: 16, hi: 24 }, easy: { lo: 16, hi: 28 }, mid: { lo: 28, hi: 44 }, "mid+": { lo: 32, hi: 52 }, hard: { lo: 40, hi: 64 } },
  6: { easy: { lo: 40, hi: 52 }, mid: { lo: 60, hi: 84 }, "mid+": { lo: 68, hi: 100 }, hard: { lo: 80, hi: 120 } },
  7: { easy: { lo: 48, hi: 60 }, mid: { lo: 64, hi: 92 }, "mid+": { lo: 76, hi: 108 }, hard: { lo: 88, hi: 128 } },
  8: { daily: { lo: 70, hi: 110 }, hard: { lo: 90, hi: 140 } },
};

export const DENSITY: Readonly<Record<number, Band>> = {
  5: { lo: 16, hi: 24 },
  6: { lo: 17, hi: 26 },
  7: { lo: 18, hi: 28 },
  8: { lo: 18, hi: 30 },
};

export function freeSeedKey(n: number): string {
  return `lanterns:free:g${GENERATOR_VERSION}:${n}`;
}

/** Generator parameters for free-play level n (1-based). levelId = n. */
export function paramsForIndex(n: number): GenParams {
  if (!Number.isInteger(n) || n < 1 || n > 0xefffffff) throw new RangeError(`level index ${n} out of range`);
  const size = sizeForIndex(n);
  const tag = n <= 2 ? "intro" : CYCLE[(n - 1) % 5]!;
  const band = BANDS[size]![tag] ?? BANDS[size]!.mid!;
  const d = DENSITY[size]!;
  return {
    seedKey: freeSeedKey(n), levelId: n, w: size, h: size, densityMin: d.lo, densityMax: d.hi, symmetry: "any",
    // A spare lantern makes a 6×6/7×7 board trivial (≈ 4 s × lanterns), so
    // breathers there are tight-but-easy; only 5×5 intro/easy get the spare.
    slack: size === 5 && (tag === "intro" || tag === "easy") ? 1 : 0, target: band, maxAttempts: 80, tag,
  };
}

/** Free-play level n (1-based): the difficulty curve. */
export function levelForIndex(n: number): GeneratedLevel {
  return generate(paramsForIndex(n));
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 0 = Sunday … 6 = Saturday (Sakamoto). */
export function weekday(y: number, m: number, d: number): number {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const yy = m < 3 ? y - 1 : y;
  return (yy + udiv(yy, 4) - udiv(yy, 100) + udiv(yy, 400) + t[m - 1]! + d) % 7;
}

export function parseDate(date: string): { y: number; m: number; d: number } {
  const mt = DATE_RE.exec(date);
  if (!mt) throw new RangeError(`date must be YYYY-MM-DD, got ${date}`);
  const y = parseInt(mt[1]!, 10);
  const m = parseInt(mt[2]!, 10);
  const d = parseInt(mt[3]!, 10);
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const dim = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (y < 2000 || y > 2399 || m < 1 || m > 12 || d < 1 || d > dim[m - 1]!) throw new RangeError(`invalid date ${date}`);
  return { y, m, d };
}

/**
 * Daily: weekdays 7×7 (Mon mid … Fri hard), weekends 8×8. levelId = yyyymmdd.
 */
export function paramsForDaily(date: string): GenParams {
  const { y, m, d } = parseDate(date);
  const wd = weekday(y, m, d);
  const weekend = wd === 0 || wd === 6;
  const size = weekend ? 8 : 7;
  const tag = weekend ? "daily" : wd <= 2 ? "mid" : wd <= 4 ? "mid+" : "hard";
  const dens = DENSITY[size]!;
  return {
    seedKey: `lanterns:daily:g${GENERATOR_VERSION}:${date}`, levelId: y * 10000 + m * 100 + d, w: size, h: size,
    densityMin: dens.lo, densityMax: dens.hi, symmetry: "rot180", slack: 0, target: BANDS[size]![tag]!, maxAttempts: 60, tag,
  };
}

export function levelForDaily(date: string): GeneratedLevel {
  return generate(paramsForDaily(date));
}
