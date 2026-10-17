// Shared checks for the Lanterns-P tracks (not a test file itself): exact
// uniqueness, tiers, openings, bands, and the hint loop.
import { describe, expect, it } from "vitest";
import { Rng } from "../../core/rng.ts";
import { grade, openingCells } from "../../games/lanterns-pips/deduce.ts";
import { type PipsGeneratedLevel, UNIQUE_GATE_NODES, openingBucket } from "../../games/lanterns-pips/generator.ts";
import { hintTrace } from "../../games/lanterns-pips/hint.ts";
import * as P from "../../games/lanterns-pips/index.ts";
import { countSolutions } from "../../games/lanterns-pips/solver.ts";
import { type Rays, buildRays } from "../../games/lanterns/solver.ts";
import {
  DEDUCE_START, DEDUCE_T3_FROM, GENTLE_FINALES, GENTLE_FINALE_REAL_T2, GENTLE_RAMP_FROM, OPENING_WINDOW, TRACK_BANDS, type Track, beatTarget, clampForSize, finaleIndex, isFinale, trackParams,
} from "../../games/lanterns-pips/tracks.ts";
import { percentile } from "../../sim/stats.ts";

export const idx = (b: P.BB): number[] => P.cellsOf(b).map((c) => P.index(c.x, c.y));
export const bbOf = (cells: readonly number[]): P.BB => cells.reduce((b, i) => P.withBit(b, i, true), P.EMPTY);
export const rowsOf = (l: P.PipsLevel): string => P.levelRows(l).join("\n");

export interface LoopResult {
  completed: boolean;
  error: string | null;
  /** Placement hints per tier: [fallback, T1, T2, T3]. */
  tiers: number[];
  removeHints: number;
}

/**
 * Apply hints until complete: removeWrong must name exactly ONE lantern that is
 * not in the solution, with `remaining` = how many such lanterns there are (so
 * it drops by one per removal); a placement must be on a dark, empty floor
 * cell, never create a conflict, and belong to the solution. The toggle
 * history is passed as `recent`.
 */
/** anchor must explain the cell: a numbered stone next to it, or a dark cell it lights. */
export function anchorError(level: P.PipsLevel, a: P.BoardAnalysis, h: { cell: number; reason: string; anchor: number }, rays?: Rays): string | null {
  const isNumber = level.clues[h.anchor] !== P.NO_CLUE;
  const adj = P.neighbours(level.w, level.h, h.anchor).includes(h.cell);
  const r = rays ?? buildRays(level);
  const inRay = ((h.cell < 32 ? r.lo[h.anchor]! >>> h.cell : r.hi[h.anchor]! >>> (h.cell - 32)) & 1) === 1;
  const dark = !P.hasBit(level.stones, h.anchor) && a.lit[h.anchor] === 0;
  if (h.reason === "stone") return isNumber && adj ? null : `stone anchor ${h.anchor} does not border ${h.cell}`;
  if (h.reason === "onlyLight") return dark && inRay ? null : `onlyLight anchor ${h.anchor} is not a dark cell lit from ${h.cell}`;
  return (isNumber && adj) || (dark && inRay) ? null : `contradiction anchor ${h.anchor} does not explain ${h.cell}`;
}

export function hintLoop(level: P.PipsLevel, solution: P.BB, start: readonly number[]): LoopResult {
  let s: P.PipsState = { ...P.initialState(level), lanterns: bbOf(start) };
  let last: number | undefined = start.length > 0 ? start[start.length - 1] : undefined;
  const recent = start.slice();
  const sol = new Set(idx(solution));
  const rays = buildRays(level);
  const tiers = [0, 0, 0, 0];
  let removeHints = 0;
  let prevRemaining = -1;
  for (let step = 0; step < 4 * 64; step++) {
    if (P.isComplete(s)) return { completed: true, error: null, tiers, removeHints };
    const { hint: h, tier } = hintTrace(level, s, last, recent);
    if (h.kind === "none") return { completed: false, error: "hint none before completion", tiers, removeHints };
    if (h.kind === "removeWrong") {
      removeHints++;
      const wrong = idx(s.lanterns).filter((i) => !sol.has(i));
      if (h.cells.length !== 1 || !wrong.includes(h.cells[0]!) || h.remaining !== wrong.length) {
        return { completed: false, error: `removeWrong ${JSON.stringify(h)} vs wrong ${JSON.stringify(wrong)}`, tiers, removeHints };
      }
      if (prevRemaining >= 0 && h.remaining !== prevRemaining - 1) {
        return { completed: false, error: `remaining ${h.remaining} after ${prevRemaining}`, tiers, removeHints };
      }
      prevRemaining = h.remaining;
      s = { ...s, lanterns: P.withBit(s.lanterns, h.cells[0]!, false) };
      last = h.cells[0];
      recent.push(h.cells[0]!);
      continue;
    }
    if (prevRemaining > 1) return { completed: false, error: `placement hint with ${prevRemaining - 1} wrong lanterns left`, tiers, removeHints };
    prevRemaining = -1;
    tiers[tier]!++;
    const before = P.analyzeBoard(level, s);
    if (before.conflicts.length > 0) return { completed: false, error: "placement hint while conflicts exist", tiers, removeHints };
    const lantern = P.hasBit(s.lanterns, h.cell);
    if (before.lit[h.cell] === 1 || lantern || P.hasBit(level.stones, h.cell)) {
      return { completed: false, error: `hint cell ${h.cell} is lit/occupied/stone`, tiers, removeHints };
    }
    if (!sol.has(h.cell)) return { completed: false, error: `hint cell ${h.cell} not in the solution`, tiers, removeHints };
    const ae = anchorError(level, before, h, rays);
    if (ae !== null) return { completed: false, error: ae, tiers, removeHints };
    if ((h.reason === "contradiction") !== (h.ruledOut !== undefined && h.ruledOut.length > 0)) {
      return { completed: false, error: "ruledOut must be present exactly for contradiction hints", tiers, removeHints };
    }
    // The cell was dark and empty, so the new lantern sees no other lantern iff none lies on its runs.
    if (idx(s.lanterns).some((q) => ((q < 32 ? rays.lo[h.cell]! >>> q : rays.hi[h.cell]! >>> (q - 32)) & 1) === 1)) {
      return { completed: false, error: `hint ${h.cell} created a conflict`, tiers, removeHints };
    }
    s = { ...s, lanterns: P.withBit(s.lanterns, h.cell, true) };
    last = h.cell;
    recent.push(h.cell);
  }
  return { completed: false, error: "too many hints", tiers, removeHints };
}

/** Start states: empty, 2 random correct subsets, 3 states with 1, 2, 3 wrong lanterns (+ a correct subset). */
export function startStates(level: P.PipsLevel, solution: P.BB, key: string): number[][] {
  const rng = Rng.from(key);
  const sol = idx(solution);
  const others = idx(P.floorMask(level)).filter((i) => !sol.includes(i));
  const out: number[][] = [[]];
  for (let k = 0; k < 2; k++) out.push(sol.filter(() => rng.nextInt(2) === 0));
  for (let wrong = 1; wrong <= 3; wrong++) {
    const base = sol.filter(() => rng.nextInt(2) === 0);
    const w = others.slice();
    rng.shuffle(w);
    out.push([...base, ...w.slice(0, wrong)]);
  }
  return out;
}

export interface TrackSuiteOptions {
  readonly track: Track;
  readonly uniqueTo: number;
  readonly hintTo: number;
  /** Allowed sizes per level. */
  readonly size: (n: number, w: number) => boolean;
  /** Bot median-of-medians window on levels 1–30. */
  readonly median: { lo: number; hi: number };
  /** Extra tests sharing the suite's level cache. */
  readonly extra?: (get: (n: number) => PipsGeneratedLevel) => void;
}

export function trackSuite(o: TrackSuiteOptions): void {
  const gens: PipsGeneratedLevel[] = [];
  const get = (n: number): PipsGeneratedLevel => {
    while (gens.length < n) gens.push(P.generatedForTrack(o.track, gens.length + 1));
    return gens[n - 1]!;
  };

  describe(`lanterns-pips ${o.track} track`, () => {
    it("levelForTrack is deterministic and returns the generated level", () => {
      for (const n of [1, 9, 37]) {
        const a = P.levelForTrack(o.track, n);
        expect(P.levelRows(a)).toEqual(P.levelRows(get(n).level));
        expect(a.w).toBe(get(n).level.w);
      }
      expect(() => P.levelForTrack(o.track, 0)).toThrow();
    });

    it(`uniqueness gate: levels 1–${o.uniqueTo} have exactly one solution (exact solver), consistent with meta`, { timeout: 300_000 }, () => {
      for (let n = 1; n <= o.uniqueTo; n++) {
        const g = get(n);
        const ctx = `${o.track} ${n}\n${rowsOf(g.level)}`;
        const res = countSolutions(g.level, 2, UNIQUE_GATE_NODES);
        expect(res.aborted, ctx).toBe(false);
        expect(res.count, ctx).toBe(1);
        expect(P.bbEqual(res.solution, g.meta.solution), ctx).toBe(true);
        let s = P.initialState(g.level);
        for (const c of P.cellsOf(g.meta.solution)) s = P.toggle(s, c)!;
        expect(P.isComplete(s), ctx).toBe(true);
        expect(o.size(n, g.level.w), `${ctx}\nsize ${g.level.w}`).toBe(true);
        expect(g.level.w).toBe(g.level.h);
      }
    });

    it("tier profile matches the track", { timeout: 300_000 }, () => {
      for (let n = 1; n <= o.uniqueTo; n++) {
        const g = get(n);
        const ctx = `${o.track} ${n}\n${rowsOf(g.level)}`;
        const t2 = grade(g.level, 2).solved;
        if (o.track === "gentle") {
          expect(t2, ctx).toBe(true); // T1+T2 only
          expect(g.meta.grade.t3, ctx).toBe(0);
        } else {
          expect(grade(g.level, 3).solved, ctx).toBe(true);
          if (n >= DEDUCE_T3_FROM) expect(t2, `${ctx}\nmust need a T3 step`).toBe(false);
          else expect(t2, `${ctx}\nthe start is T1+T2 only`).toBe(true);
        }
      }
    });

    it(`openings: no repeat within ${OPENING_WINDOW} levels (opening = T1-forced cells from the empty board)`, { timeout: 300_000 }, () => {
      for (let n = 1; n <= o.uniqueTo; n++) {
        const g = get(n);
        const op = g.meta.opening;
        expect(op, `${o.track} ${n}`).toEqual(openingCells(g.level));
        if (o.track === "gentle") expect(op.length, `${o.track} ${n} has an opening`).toBeGreaterThan(0);
        expect(openingBucket(op, OPENING_WINDOW)).toBe(n % OPENING_WINDOW);
        for (let m = n - OPENING_WINDOW + 1; m < n; m++) {
          if (m < 1) continue;
          expect(JSON.stringify(get(m).meta.opening) === JSON.stringify(op), `${o.track} ${m} and ${n} share an opening`).toBe(false);
        }
      }
    });

    it("bands are a monotone ladder; no level is tagged above its band; targets sit inside the band", () => {
      const bands = TRACK_BANDS[o.track];
      for (let b = 1; b < bands.length; b++) {
        expect(bands[b]!.lo).toBeGreaterThanOrEqual(bands[b - 1]!.lo);
        expect(bands[b]!.hi).toBeGreaterThanOrEqual(bands[b - 1]!.hi);
      }
      let prevBand = 0;
      let prevFinale: { lo: number; hi: number } | null = null;
      for (let n = 1; n <= 400; n++) {
        const p = trackParams(o.track, n);
        expect(p.band).toBeGreaterThanOrEqual(prevBand);
        prevBand = p.band;
        const band = bands[p.band]!;
        if (isFinale(o.track, n)) {
          // Finales: their own monotone ladder, 7×7, T1+T2, above their band, tail capped.
          const f = GENTLE_FINALES[finaleIndex(n)]!;
          expect(p.finale).toBe(true);
          expect(p.target).toEqual(f.time);
          // Round 7 (from GENTLE_RAMP_FROM): `t2` is the real-T2 floor, the table row is the total range.
          if (n >= GENTLE_RAMP_FROM) {
            expect(p.t2).toEqual(GENTLE_FINALE_REAL_T2);
            expect(p.search?.t2Total).toEqual(f.t2);
          } else expect(p.t2).toEqual(f.t2);
          expect(p.w).toBe(f.size);
          expect(p.w).toBeGreaterThanOrEqual(7);
          expect(p.tierCap).toBe(2);
          expect(p.tailMax).toBeLessThanOrEqual(110);
          expect(p.target.hi).toBeLessThanOrEqual(110);
          expect(p.target.lo).toBeGreaterThanOrEqual(band.lo);
          if (prevFinale !== null) {
            expect(p.target.lo).toBeGreaterThanOrEqual(prevFinale.lo);
            expect(p.target.hi).toBeGreaterThanOrEqual(prevFinale.hi);
          }
          prevFinale = p.target;
          expect(p.tag).toBe(`b${p.band}-finale`);
          continue;
        }
        expect(p.finale ?? false).toBe(false);
        if (o.track === "deduce" && n < DEDUCE_T3_FROM) expect(p.target).toEqual(DEDUCE_START.time);
        else expect(p.target).toEqual(clampForSize(p.w, beatTarget(band, p.beat)));
        expect(p.target.lo).toBeGreaterThanOrEqual(band.lo);
        expect(p.target.hi).toBeLessThanOrEqual(band.hi);
        // No level is harder than the next level's band ceiling.
        expect(p.target.hi).toBeLessThanOrEqual(bands[trackParams(o.track, n + 1).band]!.hi);
        expect(p.tag).toBe(`b${p.band}-${p.beat}`);
      }
    });

    it(`bot time: median of level medians on 1–30 in ${o.median.lo}–${o.median.hi} s`, () => {
      const meds = Array.from({ length: 30 }, (_, k) => get(k + 1).meta.difficulty).sort((a, b) => a - b);
      const m = percentile(meds, 50)!;
      expect(m).toBeGreaterThanOrEqual(o.median.lo);
      expect(m).toBeLessThanOrEqual(o.median.hi);
    });

    it(`hints: levels 1–${o.hintTo}, from empty / partial correct / 1–3 wrong lanterns, always reach completion without a conflict`, { timeout: 300_000 }, () => {
      const tiers = [0, 0, 0, 0];
      for (let n = 1; n <= o.hintTo; n++) {
        const g = get(n);
        for (const [k, start] of startStates(g.level, g.meta.solution, `test:hints:${o.track}:${n}`).entries()) {
          const r = hintLoop(g.level, g.meta.solution, start);
          expect(r.error, `${o.track} ${n} start #${k} ${JSON.stringify(start)}\n${rowsOf(g.level)}`).toBeNull();
          expect(r.completed).toBe(true);
          if (k >= 3) expect(r.removeHints).toBeGreaterThan(0);
          for (let t = 0; t < 4; t++) tiers[t]! += r.tiers[t]!;
        }
      }
      expect(tiers[0], "fallback placements (no deduction found)").toBe(0);
      if (o.track === "gentle") expect(tiers[3], "gentle never needs a contradiction hint").toBe(0);
      else expect(tiers[3]).toBeGreaterThan(0);
    });

    o.extra?.(get);
  });
}
