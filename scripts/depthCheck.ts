// npm run depth -- [--variants N,P,E] [--from 1] [--to 30] [--runs 200] [--human-runs 64] [--levels]
// Depth pre-check without personas (see scripts/depthCheckLib.ts for the bots
// and the pre-registered verdict rule).

import { parseArgs } from "node:util";
import type { Variant } from "../tools/variantLevels.ts";
import { formatDepth, variantDepth } from "./depthCheckLib.ts";

const { values: a } = parseArgs({
  options: {
    variants: { type: "string", default: "N,P,E" }, from: { type: "string", default: "1" }, to: { type: "string", default: "30" },
    runs: { type: "string", default: "200" }, "human-runs": { type: "string", default: "64" }, levels: { type: "boolean", default: false },
  },
});
const vs = a.variants.split(",").map((s) => s.trim().toUpperCase()) as Variant[];
const rs = vs.map((v) => variantDepth(v, Number(a.from), Number(a.to), Number(a.runs), Number(a["human-runs"])));
console.log(formatDepth(rs, a.levels));
console.log(`\ntime: ${rs.map((r) => `${r.variant} ${r.seconds}s`).join(", ")}`);
