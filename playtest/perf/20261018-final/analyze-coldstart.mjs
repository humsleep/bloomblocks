// node analyze-coldstart.mjs coldstart3-<ts>.json : per arm median/p75/MAD, delta vs each reference arm with a bootstrap 95% CI of the median difference.
import { readFileSync } from "node:fs";
const data = JSON.parse(readFileSync(process.argv[2], "utf8"));
const fin = (a) => a.filter(Number.isFinite).sort((x, y) => x - y);
const med = (a) => { const s = fin(a); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const p75 = (a) => { const s = fin(a); return s[Math.ceil(s.length * 0.75) - 1]; };
const mad = (a) => med(fin(a).map((x) => Math.abs(x - med(a))));
let seed = 12345; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const boot = (a, b, f) => { const d = []; for (let i = 0; i < 4000; i++) { const ra = fin(a).map(() => fin(a)[Math.floor(rnd() * fin(a).length)]); const rb = fin(b).map(() => fin(b)[Math.floor(rnd() * fin(b).length)]); d.push(f(rb) - f(ra)); } d.sort((x, y) => x - y); return [d[Math.floor(d.length * 0.025)], d[Math.floor(d.length * 0.975)]]; };
for (const [mode, res] of Object.entries(data)) {
  const arms = Object.keys(res);
  for (const metric of mode === "returning" ? ["i", "t"] : ["i"]) {
    console.log(`\n## ${mode} / ${metric === "i" ? "interactive ms" : "first tap->render ms"}  n=${fin(res[arms[0]][metric]).length}`);
    for (const k of arms) console.log(`${k}: median ${med(res[k][metric]).toFixed(1)}  p75 ${p75(res[k][metric]).toFixed(1)}  MAD ${mad(res[k][metric]).toFixed(1)}  min ${fin(res[k][metric])[0].toFixed(1)}  max ${fin(res[k][metric]).at(-1).toFixed(1)}`);
    for (const k of arms.slice(1)) for (const ref of arms.filter((r) => r !== k && arms.indexOf(r) < arms.indexOf(k))) {
      const dm = med(res[k][metric]) - med(res[ref][metric]), dp = p75(res[k][metric]) - p75(res[ref][metric]);
      const ci = boot(res[ref][metric], res[k][metric], med), ci75 = boot(res[ref][metric], res[k][metric], p75);
      console.log(`delta ${k} - ${ref}: median ${dm >= 0 ? "+" : ""}${dm.toFixed(1)} (95% CI ${ci[0].toFixed(1)}..${ci[1].toFixed(1)}) | p75 ${dp >= 0 ? "+" : ""}${dp.toFixed(1)} (95% CI ${ci75[0].toFixed(1)}..${ci75[1].toFixed(1)})`);
    }
  }
}
