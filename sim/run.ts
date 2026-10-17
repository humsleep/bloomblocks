// npm run sim -- --game lanterns --policy random-dark --games 2000 --workers 4 \
//                --sec-per-action 4 --fixed-sec 0 --max-actions 200 --out sim/out/x.json
// Runs N games across worker_threads and writes summary stats JSON.

import { mkdirSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { Worker } from "node:worker_threads";
import { SIM_GAMES } from "./registry.ts";
import { summarize } from "./stats.ts";
import type { ChunkJob, GameResult } from "./types.ts";

// Kill criteria from Puzzle_Portfolio_결정_v2 §0 (per unit, estimated human seconds).
const GATE = { medianMax: 120, p90Max: 180 };
const GATE_MIN_COMPLETION = 0.9;

const { values: a } = parseArgs({
  options: {
    game: { type: "string", default: "lanterns" },
    policy: { type: "string", default: "random-dark" },
    games: { type: "string", default: "2000" },
    workers: { type: "string", default: String(Math.min(8, availableParallelism())) },
    "sec-per-action": { type: "string", default: "4" },
    "fixed-sec": { type: "string", default: "0" },
    "max-actions": { type: "string", default: "200" },
    out: { type: "string" },
  },
});

const entry = SIM_GAMES[a.game];
if (!entry) throw new Error(`unknown game ${a.game}; have ${Object.keys(SIM_GAMES).join(", ")}`);
if (!entry.policies.includes(a.policy)) throw new Error(`unknown policy ${a.policy}; have ${entry.policies.join(", ")}`);

const num = (k: keyof typeof a): number => {
  const v = Number(a[k]);
  if (!Number.isFinite(v) || v < 0) throw new Error(`--${k} must be a non-negative number`);
  return v;
};
const total = num("games");
const workers = Math.max(1, Math.min(num("workers"), total));
const base = {
  game: a.game, policy: a.policy, maxActions: num("max-actions"),
  time: { secondsPerAction: num("sec-per-action"), fixedSeconds: num("fixed-sec") },
};

function runWorker(job: ChunkJob): Promise<GameResult[]> {
  return new Promise((ok, fail) => {
    const w = new Worker(new URL("./worker.ts", import.meta.url), { workerData: job });
    w.once("message", ok);
    w.once("error", fail);
    w.once("exit", (code) => code !== 0 && fail(new Error(`worker exited ${code}`)));
  });
}

const t0 = process.hrtime.bigint();
const per = Math.ceil(total / workers);
const jobs: ChunkJob[] = [];
for (let start = 0; start < total; start += per) jobs.push({ ...base, start, count: Math.min(per, total - start) });
const results = (await Promise.all(jobs.map(runWorker))).flat().sort((x, y) => x.index - y.index);
const wallMs = Number(process.hrtime.bigint() - t0) / 1e6;

const overall = summarize(results);
const summary = {
  game: a.game,
  policy: a.policy,
  config: { games: total, workers: jobs.length, ...base },
  overall,
  // Times are over completed units only, so the gate is meaningless (survivor
  // bias) unless the policy completes nearly everything.
  gate: {
    ...GATE,
    pass: overall.completionRate < GATE_MIN_COMPLETION ? null
      : overall.medianSeconds! <= GATE.medianMax && overall.p90Seconds! <= GATE.p90Max,
    note: overall.completionRate < GATE_MIN_COMPLETION ? `completionRate < ${GATE_MIN_COMPLETION}: not evaluated` : "ok",
  },
  perLevel: entry.levels.map((l) => ({ ...l, ...summarize(results.filter((r) => r.levelId === l.levelId)) })),
  wallMs: Math.round(wallMs),
};

const out = resolve(a.out ?? `sim/out/${a.game}-${a.policy}.json`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify({ ...summary.overall, gatePass: summary.gate.pass, wallMs: summary.wallMs }));
console.log(`wrote ${out}`);
