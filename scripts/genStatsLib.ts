// Batch statistics for the Lanterns generator (shared by scripts/genStats.ts
// and tests/lanterns/generatorBatch.test.ts).

import { type GeneratedLevel, REJECT_REASONS, type RejectReason } from "../games/lanterns/generator.ts";

export interface BatchStats {
  levels: number;
  bySize: Record<string, { levels: number; minLanterns: Record<number, number> }>;
  minLanterns: Record<number, number>;
  forced: { zeroPct: number; meanPermille: number; maxPermille: number };
  solutions: { uniquePct: number; capped64Pct: number; medianSolutions: number };
  candidates: { total: number; rejected: number; rejectedPct: number; byReason: Record<RejectReason, number>; outOfBand: number };
  inBandPct: number;
  difficulty: { p10: number; p50: number; p90: number };
}

const pct = (a: number, b: number): number => (b === 0 ? 0 : Math.round((1000 * a) / b) / 10);

export function batchStats(gens: readonly GeneratedLevel[]): BatchStats {
  const bySize: BatchStats["bySize"] = {};
  const minL: Record<number, number> = {};
  const byReason = Object.fromEntries(REJECT_REASONS.map((r) => [r, 0])) as Record<RejectReason, number>;
  let total = 0;
  let rejected = 0;
  let outOfBand = 0;
  let inBand = 0;
  const forced: number[] = [];
  const sols: number[] = [];
  const diffs: number[] = [];
  for (const g of gens) {
    const size = `${g.level.w}x${g.level.h}`;
    const s = (bySize[size] ??= { levels: 0, minLanterns: {} });
    s.levels++;
    s.minLanterns[g.meta.minLanterns] = (s.minLanterns[g.meta.minLanterns] ?? 0) + 1;
    minL[g.meta.minLanterns] = (minL[g.meta.minLanterns] ?? 0) + 1;
    const rej = REJECT_REASONS.reduce((n, r) => n + g.meta.rejected[r], 0);
    for (const r of REJECT_REASONS) byReason[r] += g.meta.rejected[r];
    total += g.meta.attempts;
    rejected += rej;
    outOfBand += g.meta.outOfBand;
    if (g.meta.inBand) inBand++;
    forced.push(g.meta.forcedPermille);
    sols.push(g.meta.solutionsCapped ? 64 : g.meta.solutions);
    diffs.push(g.meta.difficulty);
  }
  const sorted = (a: number[]): number[] => a.slice().sort((x, y) => x - y);
  const q = (a: number[], p: number): number => sorted(a)[Math.min(a.length - 1, Math.floor((p * a.length) / 100))] ?? 0;
  return {
    levels: gens.length,
    bySize,
    minLanterns: minL,
    forced: {
      zeroPct: pct(forced.filter((f) => f === 0).length, forced.length),
      meanPermille: Math.round(forced.reduce((a, b) => a + b, 0) / Math.max(1, forced.length)),
      maxPermille: Math.max(0, ...forced),
    },
    solutions: {
      uniquePct: pct(sols.filter((s) => s === 1).length, sols.length),
      capped64Pct: pct(gens.filter((g) => g.meta.solutionsCapped).length, gens.length),
      medianSolutions: q(sols, 50),
    },
    candidates: { total, rejected, rejectedPct: pct(rejected, total), byReason, outOfBand },
    inBandPct: pct(inBand, gens.length),
    difficulty: { p10: q(diffs, 10), p50: q(diffs, 50), p90: q(diffs, 90) },
  };
}

export function formatStats(s: BatchStats): string {
  const lines = [
    `levels: ${s.levels}`,
    `minLanterns: ${JSON.stringify(s.minLanterns)}`,
    ...Object.entries(s.bySize).map(([k, v]) => `  ${k}: ${v.levels} levels, minLanterns ${JSON.stringify(v.minLanterns)}`),
    `forced-move ratio: ${s.forced.zeroPct}% of levels at 0‰, mean ${s.forced.meanPermille}‰, max ${s.forced.maxPermille}‰`,
    `optimal solutions: unique ${s.solutions.uniquePct}%, ≥64 ${s.solutions.capped64Pct}%, median ${s.solutions.medianSolutions}`,
    `candidates: ${s.candidates.total}, rejected by filters ${s.candidates.rejected} (${s.candidates.rejectedPct}%) ${JSON.stringify(s.candidates.byReason)}, valid but off-band ${s.candidates.outOfBand}`,
    `levels inside their difficulty band: ${s.inBandPct}%`,
    `difficulty (bot seconds) p10/p50/p90: ${s.difficulty.p10}/${s.difficulty.p50}/${s.difficulty.p90}`,
  ];
  return lines.join("\n");
}
