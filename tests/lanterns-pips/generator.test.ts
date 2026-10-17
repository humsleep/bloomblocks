import { describe, expect, it } from "vitest";
import { Rng } from "../../core/rng.ts";
import { buildRays } from "../../games/lanterns/solver.ts";
import { grade, pipsHumanSolve } from "../../games/lanterns-pips/deduce.ts";
import {
  PIPS_BANDS, type PipsGeneratedLevel, RELAX_LAST, freeLanterns, fullClues, generatePips, levelForIndex, pipsLevelForIndex, pipsParamsForIndex, randomSolution, relaxStage,
} from "../../games/lanterns-pips/generator.ts";
import { trackParams } from "../../games/lanterns-pips/tracks.ts";
import * as P from "../../games/lanterns-pips/index.ts";
import { countSolutions } from "../../games/lanterns-pips/solver.ts";
import { percentile } from "../../sim/stats.ts";
import { bruteSolutions } from "./brute.ts";

function play(level: P.PipsLevel, moves: readonly P.PipsMove[]): P.PipsState {
  let s = P.lanternsPips.init("t", level);
  for (const m of moves) {
    const n = P.lanternsPips.apply(s, m);
    if (!n) throw new Error(`illegal ${m.x},${m.y}`);
    s = n;
  }
  return s;
}

describe("lanterns-pips generator", () => {
  const gens: PipsGeneratedLevel[] = [];
  const get = (n: number): PipsGeneratedLevel => {
    while (gens.length < n) gens.push(pipsLevelForIndex(gens.length + 1));
    return gens[n - 1]!;
  };

  it("is deterministic (same seed → same level) and levelForIndex is the same function", () => {
    for (const n of [1, 7, 23]) {
      const a = pipsLevelForIndex(n);
      const b = levelForIndex(n);
      expect(P.levelRows(b.level)).toEqual(P.levelRows(a.level));
      expect(b.meta).toEqual(a.meta);
      expect(a.seedKey).toBe(`lanterns-pips:free:g1:${n}`);
    }
  });

  it("canary: the first levels are pinned (bump PIPS_GENERATOR_VERSION if this changes)", () => {
    expect(P.levelRows(get(1).level)).toEqual(["..#0.", "1....", ".....", "....0", ".12.."]);
    expect(P.levelRows(get(2).level)).toEqual([".....", ".0.1.", "..2..", ".#.2.", "....."]);
  });

  it("indices 1–200: every level unique, numbers consistent with the unique solution, tier-solvable", { timeout: 120_000 }, () => {
    for (let n = 1; n <= 200; n++) {
      const g = get(n);
      const { level, meta } = g;
      const ctx = `level ${n}\n${P.levelRows(level).join("\n")}`;
      const res = countSolutions(level, 2, 2_000_000);
      expect(res.aborted, ctx).toBe(false);
      expect(res.count, ctx).toBe(1);
      expect(P.bbEqual(res.solution, meta.solution), ctx).toBe(true);
      // Every number equals the adjacent lanterns of the unique solution.
      const full = fullClues(level.w, level.h, level.stones, meta.solution);
      for (let i = 0; i < 64; i++) if (level.clues[i] !== P.NO_CLUE) expect(level.clues[i], `${ctx}\ncell ${i}`).toBe(full[i]);
      // The solution completes under the rules.
      expect(P.isComplete(play(level, P.cellsOf(meta.solution))), ctx).toBe(true);
      // Size ramp, tier cap and metadata.
      expect(level.w).toBe(n <= 5 ? 5 : n <= 14 ? 6 : 7);
      const gr = grade(level, pipsParamsForIndex(n).tierCap);
      expect(gr.solved, ctx).toBe(true);
      expect(gr).toEqual(meta.grade);
      expect(meta.clues).toBe(level.clues.filter((c) => c !== P.NO_CLUE).length);
    }
  });

  it("brute force confirms uniqueness on the 5×5 and 6×6 levels", { timeout: 120_000 }, () => {
    for (let n = 1; n <= 14; n++) {
      const sols = bruteSolutions(get(n).level, 3);
      expect(sols.length, `level ${n}`).toBe(1);
      expect(P.bbEqual(sols[0]!, get(n).meta.solution)).toBe(true);
    }
  });

  it("exact counter matches brute force on random partially numbered boards (incl. non-unique)", () => {
    const rng = Rng.from("pips:solver-vs-brute");
    let multi = 0;
    for (let k = 0; k < 60; k++) {
      const g = get(1 + (k % 5));
      const r = buildRays(g.level);
      const sol = randomSolution(r, rng);
      const clues = fullClues(5, 5, g.level.stones, sol);
      for (let i = 0; i < 64; i++) if (clues[i] !== P.NO_CLUE && rng.nextInt(2) === 0) clues[i] = P.NO_CLUE;
      const level = { w: 5, h: 5, stones: g.level.stones, clues };
      const brute = bruteSolutions(level, 1000).length;
      expect(countSolutions(level, 1000).count).toBe(brute);
      if (brute > 1) multi++;
    }
    expect(multi).toBeGreaterThan(5);
  });

  it("the human-like bot's moves replay through the rules to completion", () => {
    for (const n of [1, 3, 8, 15, 18, 28]) {
      const g = get(n);
      for (let k = 0; k < 4; k++) {
        const t = pipsHumanSolve(g.level, { rng: Rng.from(`test:pips:bot:${n}:${k}`) });
        expect(t.completed).toBe(true);
        expect(P.isComplete(play(g.level, t.moves))).toBe(true);
        expect(t.placements - t.removals).toBe(g.meta.lanterns);
      }
    }
  });

  it("curve 1–30: median of the bot medians lies in 50–80 s; bands are defined for every size/tag", () => {
    const meds = Array.from({ length: 30 }, (_, k) => get(k + 1).meta.difficulty).sort((a, b) => a - b);
    const m = percentile(meds, 50)!;
    expect(m).toBeGreaterThanOrEqual(50);
    expect(m).toBeLessThanOrEqual(80);
    for (let n = 1; n <= 30; n++) {
      const p = pipsParamsForIndex(n);
      expect(PIPS_BANDS[p.w]![p.tag]).toEqual(p.target);
    }
  });

  it("search path (round 6): bounded — an impossible T2 floor relaxes in stages and still returns a unique board within 2 × maxAttempts", () => {
    expect([0, 99, 100, 199, 200, 299, 300, 399, 400, 10_000].map((a) => relaxStage(a, 400))).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
    expect(RELAX_LAST).toBe(4);
    const p = trackParams("gentle", 25);
    const g = generatePips({ ...p, seedKey: "test:relax", maxAttempts: 80, t2: { lo: 30, hi: 31 } });
    expect(g.meta.relaxed).toBe(RELAX_LAST);
    expect(g.meta.attempts).toBeLessThanOrEqual(160);
    expect(countSolutions(g.level, 2, 2_000_000).count).toBe(1);
    expect(grade(g.level, 2).solved).toBe(true);
    // Deterministic, like every stream.
    expect(P.levelRows(generatePips({ ...p, seedKey: "test:relax", maxAttempts: 80, t2: { lo: 30, hi: 31 } }).level)).toEqual(P.levelRows(g.level));
  });

  it("freeLanterns counts solution lanterns with no stone beside them (each one can only be a T2 step)", () => {
    const l = P.parseLevel([".#...", ".....", ".....", ".....", "....."]);
    const sol = { lo: (1 << 0) | (1 << 2) | (1 << 12), hi: 0 }; // A1 (stone at B1 beside), C1 (beside B1), E2 (free)
    expect(freeLanterns(5, 5, l.stones, sol)).toBe(1);
  });
});
