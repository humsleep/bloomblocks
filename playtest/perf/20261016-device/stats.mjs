// Pooled cold-start stats for measure-ios.sh run.jsonl files.
// Usage: node stats.mjs <run.jsonl>... → per-file p50/p75/p90/max, outliers >1.5 s, phase split,
// and pooled p75 with a 95% bootstrap CI (10k resamples) + nearest-rank order-statistic CI.
import { readFileSync } from "node:fs";
const q = (a, p) => a[Math.min(a.length - 1, Math.ceil(p * a.length) - 1)];
const med = (a) => q(a, 0.5);
const rows = (f) => readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.ms >= 0);
const pooled = [];
for (const f of process.argv.slice(2)) {
  const r = rows(f); const ms = r.map((x) => x.ms).sort((a, b) => a - b);
  const pre = r.map((x) => x.ms - x.webMs).sort((a, b) => a - b); // process start → WebView navigation start
  const web = r.map((x) => x.webMs).sort((a, b) => a - b); // navigation start → 2 rAF after first board frame
  const dfl = r.map((x) => x.dflMs).sort((a, b) => a - b);
  const fast = r.filter((x) => x.ms <= 1500);
  console.log(`${f.split("/").slice(-2).join("/")}  ${r[0]?.variant}  n=${ms.length} p50=${med(ms)} p75=${q(ms, 0.75)} p90=${q(ms, 0.9)} max=${ms.at(-1)}  >1.5s: ${ms.length - fast.length}`);
  console.log(`   median split: start→didFinishLaunching ${med(dfl)} | start→nav ${med(pre).toFixed(0)} | nav→interactive (webMs) ${med(web).toFixed(0)}   (non-outliers webMs median ${fast.length ? med(fast.map((x) => x.webMs).sort((a, b) => a - b)).toFixed(0) : "-"})`);
  if (r[0]?.variant === "m1") pooled.push(...ms);
}
if (pooled.length) {
  const a = [...pooled].sort((x, y) => x - y); const n = a.length; const p75 = q(a, 0.75);
  let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
  const bs = []; for (let k = 0; k < 10000; k++) { const s = Array.from({ length: n }, () => a[Math.floor(rnd() * n)]).sort((x, y) => x - y); bs.push(q(s, 0.75)); }
  bs.sort((x, y) => x - y);
  // order-statistic CI: ranks from Binomial(n, .75) normal approx
  const sd = Math.sqrt(n * 0.75 * 0.25); const lo = Math.max(1, Math.floor(n * 0.75 - 1.96 * sd)); const hi = Math.min(n, Math.ceil(n * 0.75 + 1.96 * sd));
  const pass = bs.filter((v) => v <= 1000).length / bs.length;
  console.log(`POOLED M1 n=${n} p75=${p75}  bootstrap95%=[${q(bs, 0.025)}, ${q(bs, 0.975)}]  order-stat95%=[${a[lo - 1]}, ${a[hi - 1]}]  P(boot p75 ≤ 1000)=${(pass * 100).toFixed(0)}%`);
}
