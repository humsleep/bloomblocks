// 1,000-seed batch over the shipped free-play curve: prints the statistics
// (also: npm run gen:stats -- --count 1000) and checks the batch-level claims.
import { describe, expect, it } from "vitest";
import { type GeneratedLevel, levelForIndex, minLanternsFloor } from "../../games/lanterns/generator.ts";
import { batchStats, formatStats } from "../../scripts/genStatsLib.ts";

describe("lanterns generator batch", () => {
  it("1,000 seeds: statistics + every level within the filters", { timeout: 600_000 }, () => {
    const gens: GeneratedLevel[] = [];
    for (let n = 1; n <= 1000; n++) gens.push(levelForIndex(n));
    const s = batchStats(gens);
    console.log(`\n[generator batch: levelForIndex(1..1000)]\n${formatStats(s)}\n`);
    expect(s.levels).toBe(1000);
    for (const g of gens) {
      expect(g.meta.minLanterns).toBeGreaterThanOrEqual(minLanternsFloor(g.level.w, g.level.h));
      expect(g.meta.forcedPermille).toBeLessThan(1000);
      expect(g.level.budget - g.meta.minLanterns).toBeLessThanOrEqual(1);
    }
    // Distinct boards (the seed actually drives the layout). Exact repeats
    // happen (~1%: 7×7 symmetric layouts that pass the bands are a small
    // space); a cross-level dedupe is a TODO, so only guard against collapse.
    const distinct = new Set(gens.map((g) => `${g.level.w}:${g.level.stones.lo}:${g.level.stones.hi}`)).size;
    console.log(`distinct boards: ${distinct}/1000`);
    expect(distinct).toBeGreaterThanOrEqual(980);
  });
});
