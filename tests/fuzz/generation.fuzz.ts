// SLOW lane (FUZZ_SLOW=1, npm run test:fuzz:slow): generation time (PERF-1). Every level a player
// can get — gentle 1–200, deduce 1–200 and the dailies 2026-11-01..2028-12-31 — is generated fresh
// (no cache) on one thread: p99 ≤ 400 ms and max ≤ 1500 ms per level on the dev Mac; the gentle
// finales (the slowest kind) are checked up to 300. Phones are ~3–5× slower, so this keeps the worst
// phone case near 5 s and the typical one well under a second (the client also pre-generates in a
// worker). Time is CPU time of this process (process.cpuUsage): wall clock on a shared, overloaded
// machine would measure the neighbours. Report table: npx tsx scripts/genTiming.ts.
import { describe, expect, it } from "vitest";
import { generatePips, type PipsGenParams } from "../../games/lanterns-pips/generator.ts";
import { dailyParams, trackParams } from "../../games/lanterns-pips/tracks.ts";

const P99_MS = Number(process.env["FUZZ_GEN_P99_MS"] ?? 400);
const MAX_MS = Number(process.env["FUZZ_GEN_MAX_MS"] ?? 1500);

function cpuMs(p: PipsGenParams): number {
  const c0 = process.cpuUsage();
  generatePips(p);
  const c = process.cpuUsage(c0);
  return (c.user + c.system) / 1000;
}

function dates(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

describe.runIf(process.env["FUZZ_SLOW"])("generation time (slow lane)", () => {
  it(`gentle 1–200, deduce 1–200, dailies 2026-11-01..2028-12-31: p99 ≤ ${P99_MS} ms, max ≤ ${MAX_MS} ms`, () => {
    const all: { id: string; ms: number }[] = [];
    for (let n = 1; n <= 200; n++) all.push({ id: `gentle ${n}`, ms: cpuMs(trackParams("gentle", n)) });
    for (let n = 1; n <= 200; n++) all.push({ id: `deduce ${n}`, ms: cpuMs(trackParams("deduce", n)) });
    for (const d of dates("2026-11-01", "2028-12-31")) all.push({ id: `daily ${d}`, ms: cpuMs(dailyParams(d)) });
    const ms = all.map((x) => x.ms).sort((a, b) => a - b);
    const p99 = ms[Math.ceil(ms.length * 0.99) - 1]!;
    const slow = all.filter((x) => x.ms > MAX_MS).map((x) => `${x.id}: ${Math.round(x.ms)} ms`);
    expect(all.length).toBe(400 + 792);
    expect(slow).toEqual([]);
    expect(p99, `p99 over ${all.length} levels`).toBeLessThanOrEqual(P99_MS);
  }, 900_000);

  it(`gentle finales 10..300 each ≤ ${MAX_MS} ms`, () => {
    const slow: string[] = [];
    for (let n = 10; n <= 300; n += 10) {
      const ms = cpuMs(trackParams("gentle", n));
      if (ms > MAX_MS) slow.push(`gentle ${n}: ${Math.round(ms)} ms`);
    }
    expect(slow).toEqual([]);
  }, 600_000);
});
