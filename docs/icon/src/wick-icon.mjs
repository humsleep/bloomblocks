#!/usr/bin/env node
// Alternate app icon B "Wick in the lantern" (App Store Product Page Optimization).
// A close-up of the shipped icon's framed paper lantern (C3, same geometry/colours as
// apps/client/src/render/lantern.ts drawFramedLantern, which was itself traced from
// docs/icon/duskwick-icon.svg) whose glowing paper carries Wick's idle face, built exactly
// like drawLanternFace(ctx, w, "idle") in apps/client/src/render/wick.ts (u = w/26, w = 0.92 ×
// paper width as on the board), plus Wick's tip flame glowing through the top of the paper.
//
// usage: node wick-icon.mjs [outDir]   (default: docs/icon) -> duskwick-icon-wick{,-dark,-tinted}.svg
// No deps. Rasterise with: node render.mjs <outDir> <svgs...>
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const W = 1024;
const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(process.argv[2] ?? join(here, ".."));

// palette (apps/client/src/render/palette.ts PAL + wick.ts WICK_PAL / WICK_INK)
const SKY = { night: "#141A33", dusk: "#2B2350", hillFar: "#5B4470", hillMid: "#3A2D58", hillNear: "#231F40", deep: "#0F1124" };
const WOOD = "#3E2A22";
const WOOD_HI = "#6E4C38";
const WICK_PAL = { core: "#FFF8E8", body: "#FFE6B8", rim: "#F4B96E", flameA: "#FF9A3C", flameB: "#FFDF7A", flameCore: "#FFF6D6" };
const WICK_INK = "#3B2C45";
const BLUSH = "#F28C8C";

// lantern geometry in the shipped icon's 1024 space (lantern.ts)
const BODY = { x: 430.4, y: 332.6, w: 163.2, h: 168.6, rx: 73.4, ry: 54.4 };
const BCX = BODY.x + BODY.w / 2; // 512
const BCY = BODY.y + BODY.h / 2; // 416.9
const TOP = 314.9 - 46.2 - 6.8; // handle top (outer edge of the stroke)
const BOTTOM = 493.1 + 27.2; // base bottom
// Wick's flame (wick.ts WICK_PATHS, 100-box)
const FLAME = "M52 12.5 C53.5 18 59.5 22 59.5 28 C59.5 32.8 55.3 35.8 50 35.8 C44.7 35.8 40.5 32.8 40.5 28 C40.5 22.5 47 20 52 12.5 Z";
const FLAME_CORE = "M50.8 22 C52 25 55 27 55 30 C55 32.5 52.8 33.8 50 33.8 C47.2 33.8 45 32.5 45 30 C45 27.5 48.5 26 50.8 22 Z";

// close-up framing: lantern (handle top -> base bottom) fills FILL of the icon height
const FILL = 0.75;
const S = (FILL * W) / (BOTTOM - TOP);
const TY = (W - FILL * W) / 2 + 6; // a hair below centre: the ground carries the weight
const toY = (y) => TY + (y - TOP) * S; // icon-space y -> 1024 y

const n = (x) => (Math.round(x * 100) / 100).toString();
const gray = (v) => {
  const c = Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, "0").toUpperCase();
  return `#${c}${c}${c}`;
};

class Svg {
  constructor(uid) {
    this.uid = uid;
    this.defs = [];
    this.body = [];
    this.k = 0;
  }
  id(name) {
    return `${this.uid}-${name}${++this.k}`;
  }
  stops(st) {
    return st.map(([o, c, a = 1]) => `<stop offset="${n(o)}" stop-color="${c}"${a === 1 ? "" : ` stop-opacity="${n(a)}"`}/>`).join("");
  }
  lin(x1, y1, x2, y2, st) {
    const i = this.id("lg");
    this.defs.push(`<linearGradient id="${i}" gradientUnits="userSpaceOnUse" x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}">${this.stops(st)}</linearGradient>`);
    return `url(#${i})`;
  }
  rad(cx, cy, r, st, tf) {
    const i = this.id("rg");
    const t = tf ? ` gradientTransform="${tf}"` : "";
    this.defs.push(`<radialGradient id="${i}" gradientUnits="userSpaceOnUse" cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}"${t}>${this.stops(st)}</radialGradient>`);
    return `url(#${i})`;
  }
  blur(sd) {
    const i = this.id("bl");
    this.defs.push(`<filter id="${i}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${n(sd)}"/></filter>`);
    return `url(#${i})`;
  }
  clip(inner) {
    const i = this.id("cp");
    this.defs.push(`<clipPath id="${i}">${inner}</clipPath>`);
    return `url(#${i})`;
  }
  add(s) {
    this.body.push(s);
  }
  out(title) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">\n<title>${title}</title>\n<defs>\n${this.defs.join("\n")}\n</defs>\n${this.body.join("\n")}\n</svg>\n`;
  }
}

// ---------------------------------------------------------------- scene (1024 space)

function sky(s) {
  s.add(`<rect width="${W}" height="${W}" fill="${s.lin(0, 0, 0, W, [[0, SKY.night], [0.5, SKY.dusk], [1, SKY.hillFar]])}"/>`);
  // the last of the sunset low on the horizon, very soft
  s.add(`<rect width="${W}" height="${W}" fill="${s.rad(W / 2, 1000, 620, [[0, "#E8A08A", 0.34], [1, "#E8A08A", 0]])}"/>`);
  // a few quiet stars / motes high up (tiny; they vanish at 60 px, which is fine)
  for (const [x, y, r, a] of [[150, 128, 4.5, 0.55], [262, 74, 3, 0.4], [868, 110, 4, 0.5], [770, 58, 2.6, 0.35], [930, 236, 3, 0.35], [92, 300, 3, 0.3]]) {
    s.add(`<circle cx="${x}" cy="${y}" r="${r * 3}" fill="${s.rad(x, y, r * 3, [[0, "#F4EBD0", a * 0.5], [1, "#F4EBD0", 0]])}"/>`);
    s.add(`<circle cx="${x}" cy="${y}" r="${r}" fill="#F4EBD0" opacity="${a}"/>`);
  }
}

function ground(s) {
  // far ridge and the near rise the lantern stands on
  s.add(`<path d="M0 760 C 180 728, 360 722, 520 736 C 690 750, 860 716, 1024 730 L1024 1024 L0 1024Z" fill="${SKY.hillMid}" opacity="0.92"/>`);
  s.add(`<path d="M0 852 C 220 826, 400 820, 540 828 C 700 836, 880 818, 1024 830 L1024 1024 L0 1024Z" fill="${s.lin(0, 820, 0, 1024, [[0, SKY.hillNear], [1, SKY.deep]])}"/>`);
}

function halo(s, k, cream) {
  const cx = W / 2;
  const cy = toY(BCY) - 10;
  const c = cream ? ["#FFE9B4", "#FFD98C", "#FFC870", "#FFC060"] : ["#FFD99A", "#FFC877", "#FFB45E", "#FFA850"];
  const r = 540;
  s.add(`<circle cx="${cx}" cy="${n(cy)}" r="${r}" fill="${s.rad(cx, cy, r, [[0, c[0], 0.7 * k], [0.4, c[1], 0.34 * k], [0.7, c[2], 0.1 * k], [1, c[3], 0]])}"/>`);
  // a tighter golden core right around the frame, so the paper reads as the light source
  const r2 = 360;
  s.add(`<circle cx="${cx}" cy="${n(cy)}" r="${r2}" fill="${s.rad(cx, cy, r2, [[0, c[0], 0.5 * k], [0.55, c[1], 0.2 * k], [1, c[2], 0]])}"/>`);
}

function groundLight(s, tint) {
  const by = toY(BOTTOM);
  if (tint) return;
  // warm pool where the lantern's light falls, then the contact shadow
  s.add(`<ellipse cx="${W / 2}" cy="${n(by + 4)}" rx="380" ry="70" fill="${s.rad(W / 2, by + 4, 380, [[0, "#FFC870", 0.55], [0.45, "#FFB45E", 0.2], [1, "#FFB45E", 0]], `translate(${W / 2} ${n(by + 4)}) scale(1 0.184) translate(${-W / 2} ${n(-(by + 4))})`)}"/>`);
  s.add(`<ellipse cx="${W / 2}" cy="${n(by - 2)}" rx="${n(0.58 * 196 * S / 2 * 1.9)}" ry="22" fill="${SKY.deep}" opacity="0.55" filter="${s.blur(7)}"/>`);
}

// ---------------------------------------------------------------- the lantern (icon space, scaled)

function bodyRect(extra = "") {
  return `<rect x="${BODY.x}" y="${BODY.y}" width="${BODY.w}" height="${BODY.h}" rx="${BODY.rx}" ry="${BODY.ry}"${extra}/>`;
}

function lantern(s, mode) {
  const tint = mode === "tinted";
  const wood = tint ? gray(0.42) : WOOD;
  const woodHi = tint ? gray(0.56) : WOOD_HI;
  s.add(`<g transform="translate(${n(W / 2)} ${n(TY)}) scale(${n(S)}) translate(${-BCX} ${n(-TOP)})">`);
  // handle
  s.add(`<path d="M${512 - 46.2} 314.9 A46.2 46.2 0 0 1 ${512 + 46.2} 314.9" fill="none" stroke="${wood}" stroke-width="13.6" stroke-linecap="round"/>`);
  // paper body: Wick's palette (core -> body -> rim), centre a touch high like the candle inside
  const pf = tint
    ? s.rad(BCX, BCY - 6, 100, [[0, "#FFFFFF"], [0.6, "#F4F4F4"], [1, "#D0D0D0"]])
    : s.rad(BCX, BCY - 10, 96, [[0, WICK_PAL.core], [0.42, "#FFF0D2"], [0.7, WICK_PAL.body], [1, WICK_PAL.rim]]);
  s.add(bodyRect(` fill="${pf}"`));
  const cp = s.clip(bodyRect());
  s.add(`<g clip-path="${cp}">`);
  if (!tint) {
    // side shading (lantern.ts): the paper curves away at the posts
    const side = s.lin(BODY.x, 0, BODY.x + BODY.w, 0, [[0, "#7A4A1C", 0.2], [0.26, "#7A4A1C", 0], [0.74, "#7A4A1C", 0], [1, "#7A4A1C", 0.28]]);
    s.add(`<rect x="${BODY.x}" y="${BODY.y}" width="${BODY.w}" height="${BODY.h}" fill="${side}"/>`);
    // a faint shadow under the roof cap and a warm floor to the paper
    s.add(`<rect x="${BODY.x}" y="${BODY.y}" width="${BODY.w}" height="${BODY.h}" fill="${s.lin(0, BODY.y, 0, BODY.y + BODY.h, [[0, "#B8742E", 0.18], [0.12, "#B8742E", 0], [0.85, "#E79A48", 0], [1, "#E79A48", 0.22]])}"/>`);
  }
  flame(s, tint);
  face(s, tint);
  s.add(`</g>`);
  s.add(bodyRect(` fill="none" stroke="${tint ? "#1E1E1E" : "#5A3A1C"}" stroke-opacity="${tint ? 0.9 : 0.5}" stroke-width="${tint ? 4.4 : 3.6}"`));
  // posts, with a lit inner edge
  for (const x of [422.2, 588.2]) {
    s.add(`<rect x="${x}" y="324.4" width="13.6" height="179.5" rx="6.8" fill="${wood}"/>`);
    if (!tint) s.add(`<rect x="${x < 500 ? x + 9.5 : x + 0.5}" y="340" width="3.6" height="150" rx="1.8" fill="#FFC878" opacity="0.38"/>`);
  }
  // roof cap
  s.add(`<path d="M430.6 312.6 Q435.8 305.4 444.8 305.4 L579.2 305.4 Q588.2 305.4 593.4 312.6 L604.6 328.1 Q609.9 335.3 600.9 335.3 L423.1 335.3 Q414.1 335.3 419.4 328.1 Z" fill="${s.lin(0, 305.4, 0, 335.3, [[0, woodHi], [1, wood]])}"/>`);
  if (!tint) s.add(`<rect x="440" y="306.5" width="144" height="2.6" rx="1.3" fill="#FFE6BE" opacity="0.2"/>`);
  // base
  s.add(`<rect x="416.8" y="493.1" width="190.4" height="27.2" rx="8.2" fill="${s.lin(0, 493.1, 0, 520.3, [[0, woodHi], [1, wood]])}"/>`);
  if (!tint) s.add(`<rect x="432" y="493.6" width="160" height="2.6" rx="1.3" fill="#FFD68C" opacity="0.42"/>`);
  s.add(`</g>`);
}

// Wick's tip flame, seen through the top of the paper: a soft bloom + the flame shape, slightly veiled
function flame(s, tint) {
  const fh = 38; // icon units, flame height (path is 23.3 tall in its 100-box)
  const k = fh / 23.3;
  const fx = BCX;
  const fy = BODY.y + 58; // flame base
  const tf = `translate(${n(fx)} ${n(fy)}) rotate(6) scale(${n(k)}) translate(-50 -35.8)`;
  if (tint) {
    s.add(`<path d="${FLAME}" transform="${tf}" fill="${gray(0.74)}"/>`);
    s.add(`<path d="${FLAME_CORE}" transform="${tf}" fill="#FFFFFF"/>`);
    return;
  }
  s.add(`<circle cx="${n(fx)}" cy="${n(fy - 14)}" r="50" fill="${s.rad(fx, fy - 14, 50, [[0, "#FFC86A", 0.55], [0.4, "#FFC060", 0.2], [1, "#FFB050", 0]])}"/>`);
  const g = s.lin(50, 36, 56, 12, [[0, WICK_PAL.flameA], [1, WICK_PAL.flameB]]);
  s.add(`<g transform="${tf}" opacity="0.95"><path d="${FLAME}" fill="${g}"/><path d="${FLAME_CORE}" fill="${WICK_PAL.flameCore}" opacity="0.9"/></g>`);
}

// drawLanternFace(ctx, w, "idle"): a w × w box centred on the paper. On the board w = 0.92 × paper
// width (BoardView faceW); the icon uses 1.08 × so the eyes survive 40 px. Every offset stays in u = w/26.
function face(s, tint) {
  const w = 1.08 * BODY.w;
  const u = w / 26;
  const cx = BCX;
  const cy = BCY + 2; // ey = cy + 2u puts the eyes below centre: the flame owns the top of the paper
  const ex = 4.6 * u;
  const ey = cy + 2.0 * u;
  const ink = tint ? "#1E1E1E" : WICK_INK;
  // soft cream underlay
  if (!tint) {
    s.add(`<rect x="${n(cx - w / 2)}" y="${n(cy - w / 2)}" width="${n(w)}" height="${n(w)}" fill="${s.rad(cx, cy + 1.5 * u, w * 0.5, [[0, "#FFECC4", 0.62], [0.6, "#FFE8BA", 0.4], [1, "#FFE8BA", 0]])}"/>`);
  }
  // blush 0.75
  for (const sx of [-1, 1]) {
    s.add(`<ellipse cx="${n(cx + sx * 7.6 * u)}" cy="${n(ey + 3.9 * u)}" rx="${n(2.4 * u)}" ry="${n(1.35 * u)}" fill="${tint ? gray(0.66) : BLUSH}" opacity="0.75"/>`);
  }
  for (const sx of [-1, 1]) {
    s.add(`<ellipse cx="${n(cx + sx * ex)}" cy="${n(ey)}" rx="${n(1.55 * u)}" ry="${n(1.95 * u)}" fill="${ink}"/>`);
    s.add(`<circle cx="${n(cx + sx * ex + 0.55 * u)}" cy="${n(ey - 0.75 * u)}" r="${n(0.55 * u)}" fill="#FFFFFF"/>`);
  }
  s.add(`<path d="M${n(cx - 1 * u)} ${n(ey + 3.3 * u)} Q${n(cx)} ${n(ey + 4.2 * u)} ${n(cx + 1 * u)} ${n(ey + 3.3 * u)}" fill="none" stroke="${ink}" stroke-width="${n(1.05 * u)}" stroke-linecap="round"/>`);
}

// ---------------------------------------------------------------- variants

function icon(mode) {
  const s = new Svg(`wk${mode[0]}`);
  if (mode === "any") {
    sky(s);
    halo(s, 1, false);
    ground(s);
    groundLight(s, false);
  } else if (mode === "dark") {
    // transparent: iOS lays its own dark backdrop under it (duskwick-icon-dark.svg convention)
    halo(s, 0.9, true);
    groundLight(s, false);
  }
  lantern(s, mode);
  return s.out(`Duskwick icon B: Wick in the lantern (${mode})`);
}

for (const [mode, suffix] of [["any", ""], ["dark", "-dark"], ["tinted", "-tinted"]]) {
  const f = join(outDir, `duskwick-icon-wick${suffix}.svg`);
  writeFileSync(f, icon(mode));
  console.log(f);
}
