// npm run gen:stats:pips -- [--from 1] [--count 200] [--track gentle|deduce] [--levels]
// Batch statistics of the Lanterns-P generator (pipsLevelForIndex, or a track).
// --levels also prints the per-level depth/time table (size, tag, tier, T2/T3
// steps, numbers, 0-numbers, visible start, bot ~p20/median/~p88, bot P90 of 40
// fresh runs, isolated single cells (tricks.ts), trick signature).

import { parseArgs } from "node:util";
import { Rng } from "../core/rng.ts";
import { type PipsGeneratedLevel, pipsBotSeconds, pipsLevelForIndex, startCells } from "../games/lanterns-pips/generator.ts";
import { OPENING_WINDOW, type Track, generatedForTrack } from "../games/lanterns-pips/tracks.ts";
import { percentile } from "../sim/stats.ts";

const { values: a } = parseArgs({ options: { from: { type: "string", default: "1" }, count: { type: "string", default: "200" }, track: { type: "string" }, levels: { type: "boolean", default: false } } });
if (a.track !== undefined && a.track !== "gentle" && a.track !== "deduce") throw new Error(`--track must be gentle or deduce`);
const make = (n: number): PipsGeneratedLevel => (a.track === undefined ? pipsLevelForIndex(n) : generatedForTrack(a.track as Track, n));
const from = Number(a.from);
const count = Number(a.count);
const gens: PipsGeneratedLevel[] = [];
const ms: number[] = [];
for (let n = from; n < from + count; n++) {
  const t = performance.now();
  gens.push(make(n));
  ms.push(performance.now() - t);
}
const sum = (f: (g: PipsGeneratedLevel) => number): number => gens.reduce((s, g) => s + f(g), 0);
/** Bot P90 over 40 fresh runs (same seed scheme as the gentle P90 test). */
const p90 = (g: PipsGeneratedLevel): number =>
  percentile(pipsBotSeconds(g.level, Rng.from(`test:p90:${a.track ?? "free"}:${g.levelId}`), 40, []).sort((x, y) => x - y), 90)!;
if (a.levels) {
  console.log("| n | size | tag | tier | T1 | T2 | T3 | numbers | 0s | start | bot p20 / median / p88 s | P90 (40 runs) s | in band | singles | trick |");
  console.log("| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | --- | ---: | --- |");
  for (const g of gens) {
    const zeros = g.level.clues.filter((c) => c === 0).length;
    const gr = g.meta.grade;
    console.log(
      `| ${g.levelId} | ${g.level.w}×${g.level.h} | ${g.tag} | T${gr.maxTierUsed} | ${gr.t1} | ${gr.t2} | ${gr.t3} | ${g.meta.clues} | ${zeros} | ${startCells(g.level).length} |` +
        ` ${g.meta.difficultyFast} / ${g.meta.difficulty} / ${g.meta.difficultyTail} | ${p90(g)} | ${g.meta.inBand ? "yes" : "no"} | ${g.meta.singles} | ${g.meta.trick || "-"} |`,
    );
  }
}
const pct = (x: number, n: number): string => `${((100 * x) / n).toFixed(1)}%`;
const bySize = new Map<number, PipsGeneratedLevel[]>();
for (const g of gens) bySize.set(g.level.w, [...(bySize.get(g.level.w) ?? []), g]);
console.log(`${a.track ?? "legacy free stream"} levels ${from}..${from + count - 1}: ${gens.length}`);
for (const [size, gs] of [...bySize].sort((x, y) => x[0] - y[0])) {
  const s = (f: (g: PipsGeneratedLevel) => number): number => gs.reduce((t, g) => t + f(g), 0);
  const meds = gs.map((g) => g.meta.difficulty).sort((x, y) => x - y);
  console.log(
    `${size}x${size}: n=${gs.length} stones ${(s((g) => g.meta.stones) / gs.length).toFixed(1)} clues ${(s((g) => g.meta.clues) / gs.length).toFixed(1)}` +
      ` (density ${pct(s((g) => g.meta.clues), s((g) => g.meta.stones))} of stones) lanterns ${(s((g) => g.meta.lanterns) / gs.length).toFixed(1)}` +
      ` bot median ${percentile(meds, 50)} s (p10 ${percentile(meds, 10)}, p90 ${percentile(meds, 90)}) inBand ${pct(gs.filter((g) => g.meta.inBand).length, gs.length)}`,
  );
}
const tiers = [0, 1, 2, 3].map((t) => gens.filter((g) => g.meta.grade.maxTierUsed === t).length);
const steps = { t1: sum((g) => g.meta.grade.t1), t2: sum((g) => g.meta.grade.t2), t3: sum((g) => g.meta.grade.t3) };
const all = steps.t1 + steps.t2 + steps.t3;
console.log(`clue density: ${pct(sum((g) => g.meta.clues), sum((g) => g.meta.stones))} of stones numbered; ${(sum((g) => g.meta.clues) / gens.length).toFixed(1)} numbers/level`);
console.log(`highest tier needed: T1 ${pct(tiers[1]!, gens.length)} · T2 ${pct(tiers[2]!, gens.length)} · T3 ${pct(tiers[3]!, gens.length)}`);
console.log(`deduction steps: T1 ${pct(steps.t1, all)} · T2 ${pct(steps.t2, all)} · T3 ${pct(steps.t3, all)} (per level: ${(steps.t1 / gens.length).toFixed(1)} / ${(steps.t2 / gens.length).toFixed(1)} / ${(steps.t3 / gens.length).toFixed(1)})`);
const t3levels = gens.filter((g) => g.meta.grade.t3 > 0);
console.log(`T3 uses on T3 levels: mean ${(t3levels.reduce((s, g) => s + g.meta.grade.t3, 0) / Math.max(1, t3levels.length)).toFixed(1)}, max ${Math.max(0, ...t3levels.map((g) => g.meta.grade.t3))}`);
const rej = { disconnected: 0, isolated: 0, openRoom: 0, notUnique: 0, tooDeep: 0, solverLimit: 0 } as Record<string, number>;
for (const g of gens) for (const [k, v] of Object.entries(g.meta.rejected)) rej[k] = (rej[k] ?? 0) + v;
console.log(`attempts/level ${(sum((g) => g.meta.attempts) / gens.length).toFixed(1)}; rejected ${JSON.stringify(rej)}`);
ms.sort((x, y) => x - y);
console.log(`generation time: total ${Math.round(ms.reduce((s, x) => s + x, 0))} ms; per level median ${ms[ms.length >> 1]!.toFixed(1)} ms, max ${ms[ms.length - 1]!.toFixed(1)} ms`);
const key = (g: PipsGeneratedLevel): string => JSON.stringify(g.meta.opening);
let consecutive = 0;
let inWindow = 0;
for (let k = 0; k < gens.length; k++) {
  if (k > 0 && key(gens[k]!) === key(gens[k - 1]!)) consecutive++;
  for (let j = Math.max(0, k - OPENING_WINDOW + 1); j < k; j++) if (key(gens[j]!) === key(gens[k]!)) inWindow++;
}
const emptyOpen = gens.filter((g) => g.meta.opening.length === 0).length;
console.log(`openings: consecutive repeats ${consecutive}/${gens.length - 1}, repeats within ${OPENING_WINDOW} ${inWindow}, empty ${emptyOpen}, mean size ${(sum((g) => g.meta.opening.length) / gens.length).toFixed(1)}`);
const all30 = gens.filter((g) => g.levelId <= 30).map((g) => g.meta.difficulty).sort((x, y) => x - y);
if (all30.length > 0) console.log(`bot median of level medians, levels ≤ 30: ${percentile(all30, 50)} s; tail (~p88) max ${Math.max(...gens.map((g) => g.meta.difficultyTail))} s`);
