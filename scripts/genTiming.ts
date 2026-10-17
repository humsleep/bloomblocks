// npx tsx scripts/genTiming.ts [--gentle 200] [--deduce 200] [--from 2026-11-01] [--to 2028-12-31] [--json out.json] [--only gentle|deduce|daily]
// Generation time of every shipped level (PERF-1): gentle 1..N, deduce 1..N and every daily in
// [from, to], each generated fresh (no cache) on ONE thread, in order. Prints a per-stream table
// (p50 / p90 / p99 / max ms, attempts, in-band share) and the slowest levels; --json writes the
// per-level rows (size, T1/T2/T3 steps, exact-solver nodes, bot median, attempts, ms) for diffs.
// Budget (release gate): p99 ≤ 400 ms and max ≤ 1500 ms per level on the dev Mac.

import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { generatePips, type PipsGenParams } from "../games/lanterns-pips/generator.ts";
import { countSolutions } from "../games/lanterns-pips/solver.ts";
import { dailyParams, trackParams } from "../games/lanterns-pips/tracks.ts";
import { levelRows } from "../games/lanterns-pips/level.ts";

const { values: a } = parseArgs({
  options: {
    gentle: { type: "string", default: "200" },
    deduce: { type: "string", default: "200" },
    from: { type: "string", default: "2026-11-01" },
    to: { type: "string", default: "2028-12-31" },
    json: { type: "string" },
    only: { type: "string" },
  },
});

export interface Row {
  stream: string;
  id: string;
  tag: string;
  size: number;
  t1: number;
  t2: number;
  t3: number;
  nodes: number;
  bot: number;
  inBand: boolean;
  attempts: number;
  relaxed: number;
  t2lo: number;
  t2hi: number;
  singles: number;
  ms: number;
  cpu: number;
  rows: string;
}

const rows: Row[] = [];
function run(stream: string, id: string, params: PipsGenParams): void {
  const c0 = process.cpuUsage();
  const t0 = performance.now();
  const g = generatePips(params);
  const ms = performance.now() - t0;
  const c = process.cpuUsage(c0);
  const gr = g.meta.grade;
  rows.push({
    stream, id, tag: g.tag, size: g.level.w, t1: gr.t1, t2: gr.t2, t3: gr.t3, nodes: countSolutions(g.level, 2, 2_000_000).nodes,
    bot: g.meta.difficulty, inBand: g.meta.inBand, attempts: g.meta.attempts, relaxed: g.meta.relaxed ?? 0, t2lo: params.t2?.lo ?? 0, t2hi: params.t2?.hi ?? 99, singles: g.meta.singles, ms, cpu: (c.user + c.system) / 1000, rows: levelRows(g.level).join("/"),
  });
}

const want = (s: string): boolean => a.only === undefined || a.only === s;
if (want("gentle")) for (let n = 1; n <= Number(a.gentle); n++) run("gentle", String(n), trackParams("gentle", n));
if (want("deduce")) for (let n = 1; n <= Number(a.deduce); n++) run("deduce", String(n), trackParams("deduce", n));
if (want("daily")) {
  const [y0, m0, d0] = a.from!.split("-").map(Number) as [number, number, number];
  const [y1, m1, d1] = a.to!.split("-").map(Number) as [number, number, number];
  // Script-side date walk (not game logic).
  for (let t = Date.UTC(y0, m0 - 1, d0); t <= Date.UTC(y1, m1 - 1, d1); t += 86_400_000) {
    const date = new Date(t).toISOString().slice(0, 10);
    run("daily", date, dailyParams(date));
  }
}

const q = (xs: number[], p: number): number => xs[Math.min(xs.length - 1, Math.ceil((p / 100) * xs.length) - 1)]!;
for (const clock of ["ms", "cpu"] as const) {
console.log(clock === "ms" ? "wall clock (ms)" : "CPU time of this process (ms; robust when the machine is shared)");
console.log("| stream | levels | p50 ms | p90 ms | p99 ms | max ms | attempts max | in band | relaxed | over 400 ms | over 1500 ms |");
console.log("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
for (const s of ["gentle", "deduce", "daily", "all"]) {
  const rs = s === "all" ? rows : rows.filter((r) => r.stream === s);
  if (rs.length === 0) continue;
  const ms = rs.map((r) => r[clock]).sort((x, y) => x - y);
  console.log(
    `| ${s} | ${rs.length} | ${q(ms, 50).toFixed(0)} | ${q(ms, 90).toFixed(0)} | ${q(ms, 99).toFixed(0)} | ${ms[ms.length - 1]!.toFixed(0)} |` +
      ` ${Math.max(...rs.map((r) => r.attempts))} | ${rs.filter((r) => r.inBand).length}/${rs.length} | ${rs.filter((r) => r.relaxed > 0).length} | ${ms.filter((x) => x > 400).length} | ${ms.filter((x) => x > 1500).length} |`,
  );
}
}
console.log("slowest:", rows.slice().sort((x, y) => y.ms - x.ms).slice(0, 12).map((r) => `${r.stream} ${r.id} ${r.ms.toFixed(0)} ms (${r.attempts} att, inBand ${r.inBand})`).join("; "));
if (a.json !== undefined) writeFileSync(a.json, JSON.stringify(rows));
