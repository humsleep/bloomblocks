// npm run sim:curve -- --from 1 --to 30 --runs 200 --place 4 --remove 2 --dead-end 6 --give-up 300
// Human-like bot (games/lanterns/human.ts) on the free-play difficulty curve
// (levelForIndex). Estimated seconds per run = place × placements +
// remove × removals + deadEnd × deadEnds; a run that gives up (maxActions)
// counts as --give-up seconds. Writes sim/out/lanterns-curve.json.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { curveReport } from "./curveLib.ts";

const { values: a } = parseArgs({
  options: {
    from: { type: "string", default: "1" },
    to: { type: "string", default: "30" },
    runs: { type: "string", default: "200" },
    place: { type: "string", default: "4" },
    remove: { type: "string", default: "2" },
    "dead-end": { type: "string", default: "6" },
    "give-up": { type: "string", default: "300" },
    out: { type: "string", default: "sim/out/lanterns-curve.json" },
  },
});
const n = (k: keyof typeof a): number => {
  const v = Number(a[k]);
  if (!Number.isInteger(v) || v < 0) throw new Error(`--${k} must be a non-negative integer`);
  return v;
};

const rep = curveReport({
  from: n("from"), to: n("to"), runs: n("runs"),
  model: { place: n("place"), remove: n("remove"), deadEnd: n("dead-end") }, giveUpSeconds: n("give-up"),
});

const pad = (s: string | number, w: number): string => String(s).padStart(w);
console.log(" lvl  size tag    min bud sols forced‰ genDiff | med  p90  done%");
for (const l of rep.levels) {
  console.log(
    `${pad(l.n, 4)}  ${l.size}  ${l.tag.padEnd(6)} ${pad(l.minLanterns, 3)} ${pad(l.budget, 3)} ${pad(l.solutions + (l.solutionsCapped ? "+" : ""), 4)} ${pad(l.forcedPermille, 7)} ${pad(l.difficulty, 7)} | ${pad(l.median, 4)} ${pad(l.p90, 4)} ${pad(l.completionPct, 5)}`,
  );
}
const o = rep.overall;
console.log(`overall (all runs): median ${o.median}s  p90 ${o.p90}s  | per-level medians: median ${o.medianOfMedians}s  p90 ${o.p90OfMedians}s`);
console.log(`target: median ${rep.target.medianLo}–${rep.target.medianHi}s, p90 ≤ ${rep.target.p90Max}s → ${rep.meetsTarget ? "MEETS" : "MISSES"}`);
const out = resolve(a.out!);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(rep, null, 2) + "\n");
console.log(`wrote ${out}`);
