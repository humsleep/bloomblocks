// The text each letter font must cover: letters + gift tags + catchphrases (the handwriting face is only
// used there; dialogue is set in the UI face). Writes <out>/{latin,ko,ja,zh-Hans,zh-Hant}.txt for
// scripts/subset-letter-fonts.py --text <group>=<out>/<group>.txt.
//   node scripts/village-letter-text.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const out = process.argv[2];
if (!out) throw new Error("usage: node scripts/village-letter-text.mjs <out-dir>");
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const read = (loc) => JSON.parse(readFileSync(here(`../src/village/lines/${loc}.json`), "utf8"));
const en = read("en");
const hand = new Set(en.lines.filter((l) => l.t.startsWith("letter.") || l.t === "gift.tag").map((l) => l.id));
const GROUPS = { latin: ["en", "de", "fr", "es", "pt-BR", "it"], ko: ["ko"], ja: ["ja"], "zh-Hans": ["zh-Hans"], "zh-Hant": ["zh-Hant"] };
mkdirSync(out, { recursive: true });
for (const [g, locs] of Object.entries(GROUPS)) {
  const text = [];
  for (const loc of locs) {
    const d = loc === "en" ? en : read(loc);
    if (loc === "en") for (const l of en.lines) if (hand.has(l.id)) text.push(l.x.replaceAll("{cp}", en.cp[l.r] ?? ""));
    if (d.text) for (const [id, t] of Object.entries(d.text)) if (hand.has(id)) text.push(t);
    text.push(...Object.values(d.cp ?? {}));
  }
  writeFileSync(`${out}/${g}.txt`, text.join("\n"));
}
console.log(`letter text → ${out}`);
