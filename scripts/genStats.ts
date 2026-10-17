// npm run gen:stats -- --count 1000 [--from 1] [--daily]
// Generates `count` levels (free curve levelForIndex(from..), or dailies from
// 2026-01-01 with --daily) and prints batch statistics.

import { parseArgs } from "node:util";
import { type GeneratedLevel, levelForDaily, levelForIndex } from "../games/lanterns/generator.ts";
import { batchStats, formatStats } from "./genStatsLib.ts";

const { values: a } = parseArgs({
  options: { count: { type: "string", default: "1000" }, from: { type: "string", default: "1" }, daily: { type: "boolean", default: false } },
});
const count = Number(a.count);
const from = Number(a.from);
const t0 = performance.now();
const gens: GeneratedLevel[] = [];
for (let k = 0; k < count; k++) {
  if (a.daily) {
    const d = new Date(Date.UTC(2026, 0, 1 + k)).toISOString().slice(0, 10);
    gens.push(levelForDaily(d));
  } else {
    gens.push(levelForIndex(from + k));
  }
}
console.log(formatStats(batchStats(gens)));
console.log(`time: ${Math.round(performance.now() - t0)} ms (${((performance.now() - t0) / count).toFixed(1)} ms/level)`);
