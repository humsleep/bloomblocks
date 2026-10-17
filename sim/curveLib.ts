// Human-like bot timing over the free-play curve (shared by sim/curve.ts and tests).

import { Rng } from "../core/rng.ts";
import { levelForIndex, traceSeconds } from "../games/lanterns/generator.ts";
import { humanSolve } from "../games/lanterns/human.ts";
import { percentile } from "./stats.ts";

/** Plan target for one free-play level (estimated human seconds). */
export const CURVE_TARGET = { medianLo: 50, medianHi: 80, p90Max: 140 } as const;

export interface CurveOptions {
  from: number;
  to: number;
  runs: number;
  model: { place: number; remove: number; deadEnd: number };
  giveUpSeconds: number;
}

export interface CurveLevel {
  n: number;
  size: string;
  tag: string;
  minLanterns: number;
  budget: number;
  solutions: number;
  solutionsCapped: boolean;
  forcedPermille: number;
  difficulty: number;
  median: number;
  p90: number;
  completionPct: number;
}

export function curveReport(o: CurveOptions) {
  const levels: CurveLevel[] = [];
  const all: number[] = [];
  for (let n = o.from; n <= o.to; n++) {
    const g = levelForIndex(n);
    const secs: number[] = [];
    let done = 0;
    for (let k = 0; k < o.runs; k++) {
      const t = humanSolve(g.level, { rng: Rng.from(`sim:curve:${n}:${k}`), lookahead: true, maxActions: 400 });
      const s = t.completed ? traceSeconds(t, o.model) : o.giveUpSeconds;
      if (t.completed) done++;
      secs.push(Math.min(s, o.giveUpSeconds));
    }
    secs.sort((x, y) => x - y);
    all.push(...secs);
    levels.push({
      n, size: `${g.level.w}x${g.level.h}`, tag: g.tag, minLanterns: g.meta.minLanterns, budget: g.level.budget,
      solutions: g.meta.solutions, solutionsCapped: g.meta.solutionsCapped, forcedPermille: g.meta.forcedPermille,
      difficulty: g.meta.difficulty, median: percentile(secs, 50)!, p90: percentile(secs, 90)!,
      completionPct: Math.round((100 * done) / o.runs),
    });
  }
  all.sort((x, y) => x - y);
  const meds = levels.map((l) => l.median).sort((x, y) => x - y);
  const overall = {
    median: percentile(all, 50)!, p90: percentile(all, 90)!,
    medianOfMedians: percentile(meds, 50)!, p90OfMedians: percentile(meds, 90)!,
  };
  const meetsTarget = overall.median >= CURVE_TARGET.medianLo && overall.median <= CURVE_TARGET.medianHi && overall.p90 <= CURVE_TARGET.p90Max;
  return { options: o, target: CURVE_TARGET, levels, overall, meetsTarget };
}
