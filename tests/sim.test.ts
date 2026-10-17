import { describe, expect, it } from "vitest";
import { SIM_GAMES, runChunk } from "../sim/registry.ts";
import { percentile, summarize } from "../sim/stats.ts";
import type { ChunkJob } from "../sim/types.ts";

const job: ChunkJob = {
  game: "lanterns", policy: "random-dark", start: 0, count: 40, maxActions: 200,
  time: { secondsPerAction: 4, fixedSeconds: 2 },
};

describe("sim pipeline (in-process)", () => {
  it("is deterministic and chunking does not change results", () => {
    const whole = runChunk(job);
    const split = [...runChunk({ ...job, count: 15 }), ...runChunk({ ...job, start: 15, count: 25 })];
    expect(split).toEqual(whole);
    expect(runChunk(job)).toEqual(whole);
  });

  it("applies the time model and cycles fixture levels", () => {
    // 200 games: random-dark completes rarely, so 40 games across 5 levels can all miss.
    const r = runChunk({ ...job, count: 200 });
    for (const g of r) expect(g.seconds).toBe(2 + 4 * g.actions);
    expect(new Set(r.map((g) => g.levelId)).size).toBe(SIM_GAMES.lanterns!.levels.length);
    expect(r.some((g) => g.completed)).toBe(true);
  });

  it("both lanterns policies only make legal moves", () => {
    for (const policy of SIM_GAMES.lanterns!.policies) expect(() => runChunk({ ...job, policy, count: 8 })).not.toThrow();
  });

  it("summary uses nearest-rank percentiles over completed games", () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50)).toBe(5);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90)).toBe(9);
    expect(percentile([], 50)).toBeNull();
    const s = summarize([
      { index: 0, levelId: 1, completed: true, actions: 3, seconds: 12 },
      { index: 1, levelId: 1, completed: false, actions: 9, seconds: 36 },
    ]);
    expect(s).toMatchObject({ games: 2, completed: 1, completionRate: 0.5, medianSeconds: 12, meanActions: 6 });
  });
});
