// Frames the raw simulator captures (store-shots.ts / capture.sh) into App Store marketing images
// (1320×2868, the 6.9" iPhone size) with localized captions, plus one contact sheet per locale.
//   cd apps/client && node ../../playtest/store/compose.mjs [--lang en,ko] [--raw build/store-raw]
// Output: docs/store/screenshots/<dir>/01.png … 08.png and contact.png (dir from captions.json; other sizes: <dir>-<size>).
//   [--size 6.9] picks sizes.json (canvas size, board crop); raw captures from apps/client/build/store-raw/<size>/<lang>.
// Fonts: Fredoka 600/700 (OFL, @fontsource/fredoka, the app's UI font) for Latin; CJK falls back to
// the system's rounded / UI faces (Hiragino Maru Gothic, Apple SD Gothic Neo, PingFang), as the app does.
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, existsSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const CLIENT = join(ROOT, "apps/client");
const require = createRequire(join(CLIENT, "package.json"));
const { chromium } = require("@playwright/test");

const { values: a } = parseArgs({ options: { lang: { type: "string" }, size: { type: "string", default: "6.9" }, raw: { type: "string" }, out: { type: "string", default: join(ROOT, "docs/store/screenshots") } } });
const SIZE = JSON.parse(readFileSync(join(HERE, "sizes.json"), "utf8"))[a.size];
if (!SIZE) throw new Error(`unknown size ${a.size} (sizes.json)`);
a.raw ??= join(CLIENT, "build/store-raw", a.size);
const CAP = JSON.parse(readFileSync(join(HERE, "captions.json"), "utf8"));
const langs = a.lang && a.lang !== "all" ? a.lang.split(",") : Object.keys(CAP).filter((k) => !k.startsWith("/") && k !== "shots");

const W = SIZE.w;
const H = SIZE.h;
const [CROP_Y, CROP_H] = SIZE.boardCrop;
const fredoka = (w) => pathToFileURL(require.resolve(`@fontsource/fredoka/files/fredoka-latin-${w}-normal.woff2`)).href;
const fredokaExt = (w) => pathToFileURL(require.resolve(`@fontsource/fredoka/files/fredoka-latin-ext-${w}-normal.woff2`)).href;
const FACE = {
  latin: `'Fredoka'`,
  ko: `'Fredoka', 'Apple SD Gothic Neo'`,
  ja: `'Fredoka', 'Hiragino Maru Gothic ProN', 'Hiragino Sans'`,
  "zh-Hans": `'Fredoka', 'PingFang SC'`,
  "zh-Hant": `'Fredoka', 'PingFang TC'`,
};
// palette (apps/client/src/render/palette.ts + the UI kit)
const C = { night: "#141A33", dusk: "#2B2350", horizon: "#C97B84", cream: "#FFF3DE", amber: "#FFC864", moon: "#F4EBD0", ink: "#0F1124" };

const css = `
@font-face { font-family: Fredoka; font-weight: 600; src: url(${fredoka(600)}) format("woff2"); }
@font-face { font-family: Fredoka; font-weight: 700; src: url(${fredoka(700)}) format("woff2"); }
@font-face { font-family: Fredoka; font-weight: 600; src: url(${fredokaExt(600)}) format("woff2"); unicode-range: U+0100-024F, U+1E00-1EFF; }
@font-face { font-family: Fredoka; font-weight: 700; src: url(${fredokaExt(700)}) format("woff2"); unicode-range: U+0100-024F, U+1E00-1EFF; }
* { margin: 0; box-sizing: border-box; }
html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
body { position: relative; background:
  radial-gradient(1200px 700px at 50% 108%, ${C.horizon}55, transparent 70%),
  radial-gradient(900px 500px at 50% -10%, #3B2F6A, transparent 70%),
  linear-gradient(180deg, ${C.dusk} 0%, #1D1E3E 55%, ${C.night} 100%); }
body.ko * { word-break: keep-all; }
body.ja * { word-break: keep-all; line-break: strict; }
body.zh-Hans *, body.zh-Hant * { line-break: strict; }
.stars { position: absolute; inset: 0; }
.cap { position: absolute; left: 90px; right: 90px; top: 150px; text-align: center; }
.h { color: ${C.cream}; font-weight: 700; font-size: 104px; line-height: 1.12; letter-spacing: -0.5px; text-wrap: balance; }
.h.cjk { font-size: 96px; line-height: 1.25; letter-spacing: 1px; }
.s { margin-top: 26px; color: ${C.amber}; font-weight: 600; font-size: 54px; line-height: 1.25; text-wrap: balance; }
.dev { position: absolute; left: 50%; transform: translateX(-50%); width: 1010px; border-radius: 104px; padding: 16px;
  background: linear-gradient(160deg, #3A3468, #1B1630); box-shadow: 0 40px 90px rgba(5,6,20,.55), 0 0 0 3px #4A4380 inset; }
.dev img { display: block; width: 100%; border-radius: 90px; }
.rules { position: absolute; left: 70px; right: 70px; display: flex; flex-direction: column; gap: 46px; }
.rule { display: flex; align-items: center; gap: 44px; }
.rule img { width: 640px; border-radius: 40px; box-shadow: 0 26px 60px rgba(5,6,20,.5), 0 0 0 4px #4A4380; }
.rule .t { text-wrap: balance; flex: 1; color: ${C.cream}; font-weight: 600; font-size: 58px; line-height: 1.22; }
.rule .n { display: inline-flex; width: 76px; height: 76px; border-radius: 50%; background: ${C.amber}; color: #3B2C45; font-weight: 700; font-size: 48px; align-items: center; justify-content: center; margin-bottom: 18px; }
.sheet { display: grid; grid-template-columns: repeat(4, 1fr); gap: 28px; padding: 40px; background: ${C.night}; width: max-content; }
.sheet img { width: 330px; display: block; border-radius: 18px; }
.sheet figcaption { color: ${C.cream}; font: 600 26px Fredoka, system-ui; text-align: center; margin-top: 10px; }
`;

// a fixed star field (same in every image)
let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
const stars = Array.from({ length: 70 }, () => `<circle cx="${(rnd() * W).toFixed(0)}" cy="${(rnd() * H * 0.55).toFixed(0)}" r="${(1.5 + rnd() * 3).toFixed(1)}" fill="${C.moon}" opacity="${(0.25 + rnd() * 0.55).toFixed(2)}"/>`).join("");
const starSvg = `<svg class="stars" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${stars}</svg>`;

// Japanese has no spaces: allow a line break only after 、。 and where hiragana meets kanji / katakana, so
// phrases stay whole (the headless Chromium has no phrase dictionary for word-break: auto-phrase)
const phrase = (t) => t.replace(/([、。！？])/g, "$1<wbr>").replace(/([\u3041-\u309f])(?=[\u30a0-\u30ff\u4e00-\u9fff])/g, "$1<wbr>");
const esc0 = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
let esc = esc0;
const src = (lang, name) => {
  const p = join(a.raw, lang, `${name}.png`);
  if (!existsSync(p)) throw new Error(`missing raw capture ${p}`);
  return pathToFileURL(p).href;
};

function page(lang, i, shot, [head, sub, rules], font) {
  esc = font === "ja" ? (t) => phrase(esc0(t)) : esc0;
  const cjk = font !== "latin";
  const capHtml = `<div class="cap" style="font-family:${FACE[font]}"><div class="h${cjk ? " cjk" : ""}">${esc(head)}</div>${sub ? `<div class="s">${esc(sub)}</div>` : ""}</div>`;
  let body;
  if (shot === "rules") {
    // the board area of three real captures (sizes.json boardCrop)
    const crops = ["rule-light", "rule-conflict", "rule-number"].map((n) => src(lang, n));
    body = `<div class="rules" style="top:${cjk ? 520 : 560}px;font-family:${FACE[font]}">${rules.map((t, k) => `<div class="rule"><canvas data-src="${crops[k]}" data-y="${CROP_Y}" width="${W}" height="${CROP_H}"></canvas><div class="t"><div class="n">${k + 1}</div><div>${esc(t)}</div></div></div>`).join("")}</div>`;
  } else {
    body = `<div class="dev" style="top:${sub ? 632 : 520}px"><img src="${src(lang, shot)}"></div>`;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body class="${font}">${starSvg}${capHtml}${body}</body></html>`;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const pg = await ctx.newPage();
const TMP = mkdtempSync(join(tmpdir(), "dw-store-"));
const show = async (html) => {
  const f = join(TMP, "p.html");
  writeFileSync(f, html);
  await pg.goto(pathToFileURL(f).href, { waitUntil: "load" });
};
for (const lang of langs) {
  const L = CAP[lang];
  const dir = join(a.out, a.size === "6.9" ? L.dir : `${L.dir}-${a.size}`);
  mkdirSync(dir, { recursive: true });
  const files = [];
  for (let i = 0; i < CAP.shots.length; i++) {
    const shot = CAP.shots[i];
    await show(page(lang, i, shot, L.c[i], L.font));
    // rules: draw the board crops into canvases (an <img> cannot crop without CSS tricks)
    await pg.evaluate(async () => {
      for (const c of document.querySelectorAll("canvas[data-src]")) {
        const im = new Image();
        im.src = c.dataset.src;
        await im.decode();
        c.getContext("2d").drawImage(im, 0, Number(c.dataset.y), c.width, c.height, 0, 0, c.width, c.height);
        c.style.width = "640px";
        c.style.borderRadius = "40px";
        c.style.boxShadow = "0 26px 60px rgba(5,6,20,.5), 0 0 0 4px #4A4380";
      }
    });
    await pg.evaluate(() => document.fonts.ready);
    const f = join(dir, `${String(i + 1).padStart(2, "0")}.png`);
    await pg.screenshot({ path: f, type: "png" });
    files.push(f);
  }
  // contact sheet: the 8 images in order, 4 × 2
  await pg.setViewportSize({ width: 1500, height: 1700 });
  await show(`<!doctype html><html><head><meta charset="utf-8"><style>${css} html,body{width:auto;height:auto;background:${C.night}}</style></head><body><div class="sheet">${files.map((f, k) => `<figure><img src="${pathToFileURL(f).href}"><figcaption>${String(k + 1).padStart(2, "0")} · ${CAP.shots[k]}</figcaption></figure>`).join("")}</div></body></html>`);
  await pg.locator(".sheet").screenshot({ path: join(dir, "contact.png") });
  await pg.setViewportSize({ width: W, height: H });
  console.log(`${lang}: ${dir}`);
}
await browser.close();
