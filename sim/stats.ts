import type { GameResult } from "./types.ts";

/** Nearest-rank percentile of an ascending array (p in 0..100). */
export function percentile(sorted: readonly number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[rank - 1]!;
}

export interface Summary {
  games: number;
  completed: number;
  completionRate: number;
  /** Estimated human seconds over completed units. */
  medianSeconds: number | null;
  p90Seconds: number | null;
  medianActions: number | null;
  meanActions: number;
}

export function summarize(results: readonly GameResult[]): Summary {
  const done = results.filter((r) => r.completed);
  const secs = done.map((r) => r.seconds).sort((a, b) => a - b);
  const acts = done.map((r) => r.actions).sort((a, b) => a - b);
  const total = results.reduce((n, r) => n + r.actions, 0);
  return {
    games: results.length,
    completed: done.length,
    completionRate: results.length ? done.length / results.length : 0,
    medianSeconds: percentile(secs, 50),
    p90Seconds: percentile(secs, 90),
    medianActions: percentile(acts, 50),
    meanActions: results.length ? total / results.length : 0,
  };
}
