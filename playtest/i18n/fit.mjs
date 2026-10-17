// v12 i18n fit check (read-only on src): measures every SHOWN string of every locale with the real
// fonts (Chromium + WebKit on this Mac: PingFang TC / SC, Hiragino, Apple SD Gothic Neo, the rounded
// UI face) at the layout widths of an iPhone SE (375 pt) and reports lines / overflow per slot.
//   node playtest/i18n/fit.mjs [out=playtest/i18n/fit-report.md]
// Slots mirror the layout code: LineBand (src/game/LineBand.ts), tutorial end card (Tutorial.ts),
// "?" sheet cards (HowToSheet.ts), HUD captions (LanternsScene.placeCaptions, 76 pt then scaled),
// settings captions (SettingsSheet, segment − 8 pt), primary buttons, result labels, first-daily card.
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire("/Users/hyukahn/workspace/puzzle-lab/apps/client/package.json");
const { chromium, webkit } = require("playwright");
const { STRINGS, LANGS } = await import("/Users/hyukahn/workspace/puzzle-lab/apps/client/src/a11y/strings.ts");
const { BREAK_CARD } = await import("/Users/hyukahn/workspace/puzzle-lab/apps/client/src/ads/breakCard.ts");
const OUT = process.argv[2] ?? "/Users/hyukahn/workspace/puzzle-lab/playtest/i18n/fit-report.md";

const W = 375; // iPhone SE width in pt (u = 1)
const DIGIT_FONT = 'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", system-ui, -apple-system, sans-serif';
const FACE = { ja: '"Hiragino Sans", "Hiragino Kaku Gothic ProN"', "zh-Hans": '"PingFang SC", "Heiti SC"', "zh-Hant": '"PingFang TC", "Heiti TC"' };
const font = (l) => (FACE[l] ? DIGIT_FONT.replace("system-ui", `${FACE[l]}, system-ui`) : DIGIT_FONT);

const band = Math.min(W - 24, 420) - 32 - 18; // warn mark included (worst case)
const SLOTS = [
  // [name, keys (regex), pt, weight, wrap width (0 = single line), max lines, single-line max width]
  ["band main", /^(err\.(conflict|over|zero|stuckNum|stuckCell|early|numbers|stone)|hint\.(remove|place)|tut\.(t1|t1ok|t2a|t2b|t2c|lit|t3a|t3b|t3c|t3ok|t3wrong|t4a|t4b|t4ok|t4c|t4corner|t4over|t5a|t5wrong|follow|nice))$/, 18, "700", band, 2],
  ["band sub", /^(err\.earlySub|hint\.removeSub)$/, 17, "600", band, 2],
  ["tutorial end title", /^tut\.end$/, 22, "800", Math.min(W - 40, 340) - 44, 2],
  ["tutorial end sub", /^tut\.end2$/, 18, "600", Math.min(W - 40, 340) - 44, 2],
  ["how card main", /^how\.c[1-4]$/, 18, "700", Math.min(W, 520) - 32 - 32, 2],
  ["how card sub", /^how\.c[1-4]s$/, 17, "500", Math.min(W, 520) - 32 - 32, 2],
  ["how title", /^how\.title$/, 22, "800", 0, 1, W - 120],
  ["HUD caption", /^cap\.(town|today|undo|hint|how|back)$/, 13, "700", 0, 1, 76],
  ["settings caption", /^cap\.(sound|numbers|shareTime|haptics|notify|restart|privacy|policy|replay)$/, 13, "600", 0, 1, Math.round((Math.min(W - 24, 360) - 32 - 12) / 2) - 8],
  ["button: next house", /^done\.next$/, 20, "800", 0, 1, Math.min(W - 64, 300) - 24],
  ["button: tutorial start", /^tut\.start$/, 21, "800", 0, 1, Math.min(W - 40, 340) - 44 - 24],
  ["button: continue", /^res\.continue$/, 19, "800", 0, 1, Math.round((W - 40) * 0.62 - 12) - 20],
  // share: when glyph + word do not fit, the button shows the glyph alone (ResultSheet) — reported, not a failure
  ["button: share (glyph-only if over)", /^share$/, 17, "700", 0, 1, Math.round((W - 40) * 0.38) - 16 - 7 - 22],
  ["button: replay tutorial", /^how\.replay$/, 18, "800", 0, 1, W - 64 - 24],
  ["solved word", /^done\.solved$/, 40, "800", 0, 1, W - 40],
  ["result label", /^res\.(time|streak1|streak|shields1|shields|month)$/, 16, "600", 0, 1, W - 40 - 44 - 18 - 80],
  ["card text", /^(daily\.intro|daily\.intro2|ask\.(notify|restart|break))$/, 18, "500", Math.min(W - 40, 320) - 40, 3],
  ["card button", /^(daily\.ok|ask\.(yes|later|restartYes|cancel|breakYes))$/, 16, "700", 0, 1, Math.round((Math.min(W - 40, 320) - 40 - 12) / 2) - 12],
  ["skip", /^tut\.skip$/, 17, "700", 0, 1, 140],
];

async function measureAll(engine) {
  const b = await engine.launch();
  const p = await b.newPage();
  await p.setContent("<canvas id=c></canvas>");
  const jobs = [];
  for (const l of LANGS) {
    const d = { ...STRINGS[l] };
    for (const [k, v] of Object.entries(BREAK_CARD[l])) d[`break.${k}`] = v;
    for (const [name, re, pt, weight, wrap, maxLines, maxW] of SLOTS)
      for (const k of Object.keys(d)) if (re.test(k)) jobs.push({ l, k, name, pt, weight, wrap, maxLines, maxW: maxW ?? 0, text: d[k].replace(/\{n\}/g, "12").replace(/\{\w+\}/g, "3"), font: font(l) });
    for (const k of ["break.title", "break.body", "break.watch", "break.notNow"]) {
      const spec = k === "break.body" ? ["card text", 18, "500", Math.min(W - 40, 320) - 40, 3, 0] : k === "break.title" ? ["card title", 18, "800", Math.min(W - 40, 320) - 40, 2, 0] : ["card button", 16, "700", 0, 1, Math.round((Math.min(W - 40, 320) - 40 - 12) / 2) - 12];
      jobs.push({ l, k, name: spec[0], pt: spec[1], weight: spec[2], wrap: spec[3], maxLines: spec[4], maxW: spec[5], text: d[k], font: font(l) });
    }
  }
  const res = await p.evaluate((jobs) => {
    const ctx = document.getElementById("c").getContext("2d");
    const CJK = /[　-〿぀-ヿ㐀-鿿豈-﫿＀-￯]/;
    const NO_START = /^[、。，．！？!?：；:;）」』〉》】〕ー・…～）]/;
    const wrap = (text, maxW) => {
      const out = [];
      const tokens = [];
      let cur = "";
      for (const ch of text) {
        if (CJK.test(ch)) {
          if (cur) tokens.push(cur);
          cur = "";
          if (tokens.length > 0 && NO_START.test(ch)) tokens[tokens.length - 1] += ch;
          else tokens.push(ch);
        } else if (ch === " ") {
          tokens.push(cur + " ");
          cur = "";
        } else if (NO_START.test(ch) && !cur && tokens.length > 0) tokens[tokens.length - 1] += ch;
        else cur += ch;
      }
      if (cur) tokens.push(cur);
      let line = "";
      for (const t of tokens) {
        const next = line + t;
        if (line && ctx.measureText(next.trimEnd()).width > maxW) {
          out.push(line.trimEnd());
          line = t.trimStart();
        } else line = next;
      }
      out.push(line.trimEnd());
      return out;
    };
    return jobs.map((j) => {
      ctx.font = `${j.weight} ${j.pt}px ${j.font}`;
      const w = ctx.measureText(j.text).width;
      if (j.wrap > 0) {
        const lines = wrap(j.text, j.wrap);
        const widest = Math.max(...lines.map((s) => ctx.measureText(s).width));
        return { ...j, w, lines: lines.length, widest, ok: lines.length <= j.maxLines && widest <= j.wrap + 0.5, out: lines };
      }
      return { ...j, w, lines: 1, scale: w > j.maxW ? j.maxW / w : 1, ok: w <= j.maxW };
    });
  }, jobs);
  await b.close();
  return res;
}

const rows = [];
const bad = [];
for (const [ename, engine] of [["chromium", chromium], ["webkit", webkit]]) {
  const res = await measureAll(engine);
  for (const r of res) {
    const row = { engine: ename, ...r };
    rows.push(row);
    if (!r.ok && !/glyph-only/.test(r.name)) bad.push(row);
  }
}
const fmt = (r) => `| ${r.engine} | ${r.l} | ${r.name} | \`${r.k}\` | ${r.text.replace(/\|/g, "\\|")} | ${r.wrap ? `${r.lines}/${r.maxLines} lines, widest ${Math.round(r.widest)}/${Math.round(r.wrap)}` : `${Math.round(r.w)}/${Math.round(r.maxW)} pt${r.scale < 1 ? ` → scaled ×${r.scale.toFixed(2)}` : ""}`} |`;
const byLang = {};
for (const r of rows) if (r.engine === "webkit") byLang[r.l] = Math.max(byLang[r.l] ?? 0, r.wrap ? r.lines / r.maxLines : r.w / r.maxW);
let md = `# i18n fit report (iPhone SE, 375 pt; generated by playtest/i18n/fit.mjs)\n\n`;
md += `Slots checked: ${SLOTS.length + 2}, strings × locales × engines: ${rows.length}. Over the limit: **${bad.length}**.\n\n`;
md += `Worst ratio per locale (WebKit; 1.00 = exactly at the limit): ${Object.entries(byLang).map(([l, v]) => `${l} ${v.toFixed(2)}`).join(" · ")}\n\n`;
if (bad.length) md += `## Over the limit\n\n| engine | lang | slot | key | text | measure |\n|---|---|---|---|---|---|\n${bad.map(fmt).join("\n")}\n\n`;
const tight = rows.filter((r) => r.ok && r.engine === "webkit" && (r.wrap ? r.lines === r.maxLines && r.maxLines > 1 : r.w / r.maxW > 0.85));
md += `## Tight but fitting (WebKit)\n\n| engine | lang | slot | key | text | measure |\n|---|---|---|---|---|---|\n${tight.map(fmt).join("\n")}\n`;
writeFileSync(OUT, md);
console.log(`fit: ${rows.length} measurements, ${bad.length} over the limit → ${OUT}`);
for (const r of bad) console.log("OVER", fmt(r));
