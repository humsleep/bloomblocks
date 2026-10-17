// Builds the village dialogue files the app ships (src/village/lines/<locale>.json) from the
// narrative's canonical sources: docs/team/r2-village-lines.en.json (ids, triggers, conditions,
// English) and the Korean column of docs/team/r2-village-narrative.md (§2 tables).
// 1.0 = the owner's 4-week cut: residents Wick · Momo · Sage · Luna · Pip, triggers without
// time-of-day / season / market / requests, no puzzle.hard / chat (≈ 60 lines).
//   node scripts/village-lines.mjs          write the files
//   node scripts/village-lines.mjs --check  exit 1 when the files are stale (verify)
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const SRC = JSON.parse(readFileSync(here("../../../docs/team/r2-village-lines.en.json"), "utf8"));
const MD = readFileSync(here("../../../docs/team/r2-village-narrative.md"), "utf8");

// 1.0 = the full village (owner, round 3): all 7 residents, every trigger the narrative ships in 1.0
// (time bands, seasons, market, requests included); 1.1 lines stay out.
export const RESIDENTS = ["wick", "momo", "sage", "luna", "pip", "kuri", "yuki"];
const keep = (l) => RESIDENTS.includes(l.resident) && l.ship === "1.0";

// Korean column: per resident section, rows in order
const ko = {};
let cur = null;
for (const line of MD.split("\n")) {
  const h = /^### 2\.\d (\w+)/.exec(line);
  if (h) {
    cur = h[1].toLowerCase();
    ko[cur] = [];
    continue;
  }
  if (line.startsWith("## 3")) cur = null;
  const m = cur && /^\| `([a-z._]+)` \|([^|]*)\|\s*(1\.[01])\s*\|([^|]*)\|([^|]*)\|$/.exec(line);
  if (m) ko[cur].push({ trigger: m[1], en: m[4].trim(), ko: m[5].trim() });
}

const cpEn = Object.fromEntries(SRC.residents.map((r) => [r.id, r.catchphrase.en]));
const out = { en: [], ko: {} };
for (const r of RESIDENTS) {
  const all = SRC.lines.filter((l) => l.resident === r);
  const rows = ko[r] ?? [];
  if (rows.length !== all.length) throw new Error(`${r}: ${rows.length} md rows vs ${all.length} json lines`);
  all.forEach((l, i) => {
    const row = rows[i];
    const en = l.text.replaceAll("{cp}", cpEn[r]).replaceAll("\n", " / ");
    if (row.trigger !== l.trigger || row.en !== en) throw new Error(`${l.id}: md row "${row.en}" ≠ json "${en}"`);
    if (!keep(l)) return;
    out.en.push({ id: l.id, r, t: l.trigger, ...(l.cond ? { c: l.cond } : {}), x: l.text });
    out.ko[l.id] = row.ko.replaceAll(" / ", "\n");
  });
}

const pick = (lang) => Object.fromEntries(SRC.residents.filter((r) => RESIDENTS.includes(r.id)).map((r) => [r.id, r.catchphrase[lang]]));
const files = {
  en: { locale: "en", source: "docs/team/r2-village-lines.en.json", cp: pick("en"), lines: out.en },
  ko: { locale: "ko", source: "docs/team/r2-village-narrative.md §2 (한국어)", cp: pick("ko"), text: out.ko },
};
// the other 8 locales: the narrative's drafts docs/team/r2-village-lines.<locale>.json ({ names, cp, text, uncertain })
const ids = out.en.map((l) => l.id);
const missingBy = {};
for (const loc of ["ja", "de", "fr", "es", "pt-BR", "it", "zh-Hans", "zh-Hant"]) {
  const d = JSON.parse(readFileSync(here(`../../../docs/team/r2-village-lines.${loc}.json`), "utf8"));
  // a line a locale lacks is not shown there (never English, narrative §4): listed for the translators
  const missing = ids.filter((id) => typeof d.text?.[id] !== "string" || !d.text[id].trim());
  missingBy[loc] = missing;
  const extra = Object.keys(d.text).filter((id) => !ids.includes(id));
  if (extra.length) throw new Error(`${loc}: unknown ids ${extra.join(", ")}`);
  // catchphrases: the draft's, else the narrative's table (residents[].catchphrase[locale])
  const cpSrc = Object.fromEntries(SRC.residents.map((r) => [r.id, r.catchphrase[loc]]));
  d.cp = { ...cpSrc, ...(d.cp ?? {}) };
  for (const r of RESIDENTS) if (!d.cp[r]) throw new Error(`${loc}: no catchphrase for ${r}`);
  files[loc] = {
    locale: loc,
    status: d.status ?? "draft",
    source: `docs/team/r2-village-lines.${loc}.json`,
    cp: Object.fromEntries(RESIDENTS.map((r) => [r, d.cp[r]])),
    text: Object.fromEntries(ids.filter((id) => !missing.includes(id)).map((id) => [id, d.text[id]])),
    ...(d.uncertain ? { uncertain: d.uncertain } : {}),
  };
}
const check = process.argv.includes("--check");
let stale = false;
for (const [loc, data] of Object.entries(files)) {
  const path = here(`../src/village/lines/${loc}.json`);
  const text = JSON.stringify(data, null, 1) + "\n";
  let have = "";
  try {
    have = readFileSync(path, "utf8");
  } catch {}
  if (have === text) continue;
  if (check) {
    stale = true;
    console.error(`stale: ${path}`);
  } else writeFileSync(path, text);
}
// the translators' to-do: which 1.0 lines each locale still lacks
const report = [
  "# 마을 대사 — 로캘별 빠진 줄 (scripts/village-lines.mjs가 만든다, 손으로 고치지 않는다)",
  "",
  `1.0 줄 ${ids.length}개. 빠진 줄은 그 로캘에서 나오지 않는다(영어로 대체하지 않음). 정본: docs/team/r2-village-lines.<locale>.json.`,
  "",
  "| 로캘 | 있음 | 빠짐 |",
  "|---|---|---|",
  ...Object.entries(missingBy).map(([loc, m]) => `| ${loc} | ${ids.length - m.length} | ${m.length} |`),
  "",
  ...Object.entries(missingBy).filter(([, m]) => m.length).map(([loc, m]) => `- **${loc}**: ${m.join(", ")}`),
  "",
].join("\n");
const reportPath = here("../../../docs/team/village-lines-missing.md");
let haveReport = "";
try {
  haveReport = readFileSync(reportPath, "utf8");
} catch {}
if (haveReport !== report) {
  if (check) {
    stale = true;
    console.error(`stale: ${reportPath}`);
  } else writeFileSync(reportPath, report);
}
console.log(`village lines: ${out.en.length} × ${Object.keys(files).length} locales${check && !stale ? " — up to date" : ""}`);
if (stale) process.exit(1);
