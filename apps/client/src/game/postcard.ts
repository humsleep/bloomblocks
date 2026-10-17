// The daily's spoiler-free POSTCARD (R2, decision A5; r1-critique-visual (b) "스포일러 없는 엽서").
//
// What it shows: today's house (the daily's own house, from its seed key = the DATE), lit; a
// perforated stamp with Wick; a postmark "#n · date"; the result in words (time, streak, ✨ no
// hints); the placement-order strip — one chip per lantern PLACED, in order: amber = it stayed,
// coral = it was taken away later (a fix), a bulb = a hint was used there. ORDER only, never where.
//
// What it can NOT show: the board. Nothing here receives the level, the solution, a cell index or
// a lantern position — PostcardSpec has no such field (type level), placementStrip() drops the
// cells as it reads the moves, and the pixel test (tests/postcard.test.ts + e2e/share.spec.ts)
// bakes postcards from two different boards / move cells with the same story and requires
// byte-identical pixels.
//
// Two layouts from the same pieces: the in-app result sheet's card (landscape; its stat rows are
// Phaser objects laid over it, ResultSheet.ts) and the 1080×1350 share image (portrait, baked
// offscreen only when Share is tapped — never on the result sheet's first frame).
import { drawGlow, DIGIT_FONT, GLOW, mix, rrectPath, type Ctx } from "../render/draw.ts";
import { drawHouse, drawWindowPane, houseFor, type HouseSpec } from "../render/house.ts";
import { PAL, rgba, UI } from "../render/palette.ts";
import { hashStr, rng } from "../render/rng.ts";
import { type DailyResult, dailyNumber, dailyParams, mmss, moonPhase } from "./pipsApi.ts";
import { drawWickBody, drawWickFlame, flameBox, WICK_FLAME, WICK_PAL } from "../render/wick.ts";

/** One placement in the strip. */
export type StripChip = "keep" | "fixed" | "hint";

/** Everything a postcard may know. NO board: no level, no cells, no positions (see header). */
export interface PostcardSpec {
  dateISO: string;
  /** daily number (≤ 0 before DAILY_EPOCH: no "#n") */
  n: number;
  /** the daily's seed key — derived from the date only (lanterns-pips:daily:g<v>:<date>) */
  houseKey: string;
  /** 0..7 moon phase of the date (the sky) */
  moon8: number;
  /** "m:ss", or "" when the player hides the time from shares (share image only) */
  time: string;
  streak: number;
  hints: number;
  strip: StripChip[];
}

/** The words a postcard prints (the UI language, resolved by the caller). */
export interface PostcardWords {
  time: string;
  streak: string;
  noHints: string;
  order: string;
  yourTurn: string;
  /** "Nov 14" in the UI language */
  date: string;
  /** the link line without the scheme (humsleep.github.io/duskwick/14) */
  link: string;
  /** the font-family list for the words (uiFont()) */
  font: string;
}

/**
 * The strip from the move history: `cells` = the toggled cell of every move in order (any
 * numbering — only equality is used, the values are dropped); `hintAt` = how many moves had
 * been made when each hint was used.
 */
export function placementStrip(cells: readonly number[], hintAt: readonly number[] = []): StripChip[] {
  const on = new Map<number, number>(); // cell → index of its live chip
  const out: StripChip[] = [];
  const hints = [...hintAt].map((k) => Math.max(0, Math.min(cells.length, k | 0))).sort((a, b) => a - b);
  let h = 0;
  for (let k = 0; k < cells.length; k++) {
    while (h < hints.length && hints[h]! <= k) {
      out.push("hint");
      h++;
    }
    const c = cells[k]!;
    const live = on.get(c);
    if (live === undefined) {
      on.set(c, out.length);
      out.push("keep");
    } else {
      out[live] = "fixed";
      on.delete(c);
    }
  }
  for (; h < hints.length; h++) out.push("hint");
  return out;
}

/**
 * The spec of a finished daily: the result, the move story (cells are only compared, then
 * dropped) and whether the time may show (the "time in share" setting; the in-app card always
 * shows it). The board is not a parameter — on purpose.
 */
export function postcardSpec(r: DailyResult, cells: readonly number[], hintAt: readonly number[] = [], showTime = true): PostcardSpec {
  return {
    dateISO: r.dateISO,
    n: dailyNumber(r.dateISO),
    houseKey: dailyParams(r.dateISO).seedKey,
    moon8: Math.round(moonPhase(r.dateISO) * 8) % 8,
    time: showTime ? mmss(r.seconds) : "",
    streak: Math.max(0, r.streak | 0),
    hints: Math.max(0, r.hints | 0),
    strip: placementStrip(cells, hintAt),
  };
}

// ---------------------------------------------------------------- pieces

const TAU = Math.PI * 2;
const INK = UI.ink;
const PAPER = UI.paper;

/** The picture: dusk sky with the date's moon, stars, hills and today's house, every window lit. */
export function drawPicture(ctx: Ctx, x: number, y: number, w: number, h: number, spec: PostcardSpec, r: number, houseAt = 0.5, moonAt = 0.06): void {
  ctx.save();
  rrectPath(ctx, x, y, w, h, r);
  ctx.clip();
  const sky = ctx.createLinearGradient(0, y, 0, y + h);
  sky.addColorStop(0, PAL.skyNight);
  sky.addColorStop(0.45, PAL.skyDusk);
  sky.addColorStop(0.75, PAL.hillFar);
  sky.addColorStop(1, PAL.skyHorizon);
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);
  drawGlow(ctx, x + w / 2, y + h * 0.78, w * 0.75, [[0, rgba(PAL.skyGlow, 0.35)], [1, rgba(PAL.skyGlow, 0)]]);
  // stars (from the date, so every day's sky is its own)
  const rnd = rng(hashStr(`postcard-sky:${spec.dateISO}`));
  for (let k = 0; k < 18; k++) {
    const sx = x + rnd() * w;
    const sy = y + rnd() * h * 0.5;
    const sr = Math.max(0.6, w * (0.004 + rnd() * 0.005));
    ctx.fillStyle = rgba(PAL.moon, 0.35 + rnd() * 0.5);
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, TAU);
    ctx.fill();
  }
  // the moon of the date (upper left)
  const ms = Math.min(w * 0.32, h * 0.5);
  ctx.save();
  ctx.translate(x + w * moonAt, y + h * 0.02);
  drawMoonPhaseAt(ctx, ms, spec.moon8 / 8);
  ctx.restore();
  // hills
  const hill = (base: number, amp: number, col: string, ph: number): void => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      ctx.lineTo(x + w * t, y + h * base - h * amp * (0.6 * Math.sin(t * Math.PI * 1.6 + ph) + 0.4 * Math.sin(t * Math.PI * 3.4 + ph * 1.7)));
    }
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fill();
  };
  hill(0.74, 0.05, PAL.hillMid, 0.7);
  hill(0.84, 0.03, PAL.hillNear, 2.1);
  // today's house, lit
  const spec2: HouseSpec = houseFor(spec.houseKey, Math.max(1, spec.n));
  const tall = spec2.top + 0.12;
  const wide = spec2.left + spec2.right + 0.1;
  const s = Math.min((h * 0.62) / tall, (w * 0.78) / wide);
  const ox = x + w * houseAt + ((spec2.left - spec2.right) * s) / 2;
  const oy = y + h * 0.88;
  drawGlow(ctx, ox, oy - spec2.bodyH * s * 0.5, s * 1.1, GLOW.halo);
  drawHouse(ctx, spec2, ox, oy, s);
  for (const win of spec2.windows) {
    const cx = ox + win.x * s;
    const cy = oy + win.y * s;
    drawGlow(ctx, cx, cy, Math.max(win.w, win.h) * s * 1.6, GLOW.window);
    drawWindowPane(ctx, cx, cy, win.w * s, win.h * s, win.round, true);
  }
  // ground under the house + a soft light pool
  ctx.fillStyle = PAL.ground;
  ctx.fillRect(x, oy, w, y + h - oy);
  drawGlow(ctx, ox, oy + 2, s * 0.8, [[0, "rgba(255,200,110,0.28)"], [1, "rgba(255,200,110,0)"]]);
  ctx.restore();
}

function drawMoonPhaseAt(ctx: Ctx, s: number, p: number): void {
  const c = s / 2;
  const r = s * 0.2;
  drawGlow(ctx, c, c, c, [[0, rgba(PAL.moon, 0.3)], [0.35, rgba(PAL.moon, 0.1)], [1, rgba(PAL.moon, 0)]]);
  ctx.fillStyle = "rgba(60,62,96,0.85)";
  ctx.beginPath();
  ctx.arc(c, c, r, 0, TAU);
  ctx.fill();
  const waning = p > 0.5;
  const q = waning ? 1 - p : p;
  const k = r * Math.abs(Math.cos(q * TAU));
  ctx.save();
  // v14 (Reality #1, same as render/draw.ts drawMoonPhase): the geometry lights the right half; mirror it
  // always so the lit side faces the afterglow (the world's light, upper left)
  ctx.translate(s, 0);
  ctx.scale(-1, 1);
  ctx.beginPath();
  ctx.arc(c, c, r, -Math.PI / 2, Math.PI / 2, false);
  ctx.ellipse(c, c, Math.max(0.01, k), r, 0, Math.PI / 2, -Math.PI / 2, q < 0.25);
  ctx.closePath();
  ctx.fillStyle = PAL.moon;
  ctx.fill();
  ctx.restore();
}

/** Postcard paper: cream, soft deckle shadow, a thin inner rule. */
export function drawPaper(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, u: number): void {
  ctx.save();
  ctx.shadowColor = "rgba(8,6,24,0.45)";
  ctx.shadowBlur = 14 * u;
  ctx.shadowOffsetY = 4 * u;
  ctx.fillStyle = PAPER;
  rrectPath(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.restore();
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(232,212,184,0.35)");
  ctx.fillStyle = g;
  rrectPath(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = rgba(UI.paperEdge, 0.9);
  ctx.lineWidth = Math.max(1, 1.2 * u);
  rrectPath(ctx, x + 4 * u, y + 4 * u, w - 8 * u, h - 8 * u, Math.max(2, r - 3 * u));
  ctx.stroke();
}

/** A perforated stamp, w × h, with Wick cheering (top-left at x, y). */
export function drawStamp(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  const tooth = Math.max(1.5, w * 0.055);
  // the perforated edge as ONE path (notches bitten inward), so nothing under the stamp is erased
  const rr = tooth * 0.55;
  const nx = Math.max(3, Math.round(w / (tooth * 2)));
  const ny = Math.max(3, Math.round(h / (tooth * 2)));
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (let i = 1; i < nx; i++) ctx.arc(x + (w * i) / nx, y, rr, Math.PI, 0, true);
  ctx.lineTo(x + w, y);
  for (let i = 1; i < ny; i++) ctx.arc(x + w, y + (h * i) / ny, rr, -Math.PI / 2, Math.PI / 2, true);
  ctx.lineTo(x + w, y + h);
  for (let i = nx - 1; i >= 1; i--) ctx.arc(x + (w * i) / nx, y + h, rr, 0, Math.PI, true);
  ctx.lineTo(x, y + h);
  for (let i = ny - 1; i >= 1; i--) ctx.arc(x, y + (h * i) / ny, rr, Math.PI / 2, -Math.PI / 2, true);
  ctx.closePath();
  ctx.save();
  ctx.shadowColor = "rgba(40,24,40,0.3)";
  ctx.shadowBlur = w * 0.06;
  ctx.shadowOffsetY = w * 0.02;
  ctx.fillStyle = "#FFFDF7";
  ctx.fill();
  ctx.restore();
  // the stamp's picture: a warm dusk field with Wick
  const m = w * 0.12;
  const ix = x + m;
  const iy = y + m;
  const iw = w - 2 * m;
  const ih = h - 2 * m;
  const bg = ctx.createLinearGradient(0, iy, 0, iy + ih);
  bg.addColorStop(0, "#3A2D58");
  bg.addColorStop(1, "#8A5A78");
  ctx.fillStyle = bg;
  ctx.fillRect(ix, iy, iw, ih);
  drawGlow(ctx, ix + iw / 2, iy + ih * 0.62, iw * 0.7, GLOW.halo);
  const size = Math.min(iw * 1.05, ih * 1.0);
  const wx = ix + iw / 2 - size / 2;
  const wy = iy + ih - size * 0.95;
  ctx.save();
  ctx.beginPath();
  ctx.rect(ix, iy, iw, ih);
  ctx.clip();
  ctx.save();
  ctx.translate(wx, wy);
  drawWickBody(ctx, size, { expr: "cheer" });
  const fb = flameBox(size);
  const k = size / 100;
  ctx.translate(WICK_FLAME.x * k, WICK_FLAME.y * k);
  ctx.rotate((WICK_FLAME.tiltDeg * Math.PI) / 180);
  ctx.scale(WICK_FLAME.scale, WICK_FLAME.scale);
  ctx.translate(-fb.w * fb.ox, -fb.h * fb.oy);
  drawWickFlame(ctx, size);
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = rgba(WICK_PAL.rim, 0.7);
  ctx.lineWidth = Math.max(1, w * 0.02);
  ctx.strokeRect(ix, iy, iw, ih);
}

/** The postmark: a double ring with "#n" and the date, plus wavy cancellation lines to its left. */
export function drawPostmark(ctx: Ctx, cx: number, cy: number, r: number, n: number, date: string, font: string, waves = true, onPicture = false): void {
  const col = onPicture ? rgba(PAL.moon, 0.92) : rgba(INK, 0.62);
  if (onPicture) drawGlow(ctx, cx, cy, r * 1.25, [[0, "rgba(20,16,44,0.55)"], [0.75, "rgba(20,16,44,0.4)"], [1, "rgba(20,16,44,0)"]]);
  ctx.save();
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = Math.max(0.8, r * 0.035);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.82, 0, TAU);
  ctx.stroke();
  if (waves) {
    ctx.lineWidth = Math.max(1, r * 0.06);
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      const yy = cy + k * r * 0.34;
      for (let i = 0; i <= 20; i++) {
        const xx = cx - r * 1.1 - (r * 1.5 * i) / 20;
        const v = yy + Math.sin(i * 0.9) * r * 0.08;
        if (i === 0) ctx.moveTo(xx, v);
        else ctx.lineTo(xx, v);
      }
      ctx.stroke();
    }
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (n >= 1) {
    ctx.font = `800 ${Math.round(r * 0.62)}px ${DIGIT_FONT}`;
    ctx.fillText(`#${n}`, cx, cy - r * 0.16, r * 1.5);
    ctx.font = `700 ${Math.round(r * 0.3)}px ${font}`;
    ctx.fillText(date, cx, cy + r * 0.4, r * 1.45);
  } else {
    ctx.font = `700 ${Math.round(r * 0.36)}px ${font}`;
    ctx.fillText(date, cx, cy, r * 1.5);
  }
  ctx.restore();
}

/** The placement-order strip from (x, y) (left / vertical centre), chips of size s, at most maxW wide. */
export function drawStrip(ctx: Ctx, x: number, y: number, s: number, maxW: number, strip: readonly StripChip[], font: string): void {
  const gap = s * 0.28;
  const room = Math.max(1, Math.floor((maxW + gap) / (s + gap)));
  const shown = strip.length > room ? strip.slice(0, Math.max(0, room - 1)) : strip;
  const more = strip.length - shown.length;
  shown.forEach((c, i) => drawChip(ctx, x + i * (s + gap) + s / 2, y, s, c));
  if (more > 0) {
    ctx.save();
    ctx.fillStyle = rgba(INK, 0.75);
    ctx.font = `700 ${Math.round(s * 0.62)}px ${font}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(`+${more}`, x + shown.length * (s + gap), y);
    ctx.restore();
  }
}

function drawChip(ctx: Ctx, cx: number, cy: number, s: number, c: StripChip): void {
  const r = s * 0.3;
  ctx.save();
  if (c === "hint") {
    ctx.fillStyle = "#E7E2F2";
    rrectPath(ctx, cx - s / 2, cy - s / 2, s, s, r);
    ctx.fill();
    // a tiny bulb
    ctx.fillStyle = "#FFD27A";
    ctx.strokeStyle = rgba(INK, 0.8);
    ctx.lineWidth = Math.max(0.8, s * 0.07);
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.08, s * 0.22, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = rgba(INK, 0.8);
    ctx.fillRect(cx - s * 0.1, cy + s * 0.14, s * 0.2, s * 0.12);
  } else {
    const keep = c === "keep";
    const g = ctx.createLinearGradient(0, cy - s / 2, 0, cy + s / 2);
    g.addColorStop(0, keep ? "#FFE3A0" : PAL.coralHi);
    g.addColorStop(1, keep ? "#F2B85A" : PAL.coral);
    ctx.fillStyle = g;
    rrectPath(ctx, cx - s / 2, cy - s / 2, s, s, r);
    ctx.fill();
    ctx.strokeStyle = keep ? "#C98A3A" : PAL.coralDeep;
    ctx.lineWidth = Math.max(0.8, s * 0.06);
    rrectPath(ctx, cx - s / 2, cy - s / 2, s, s, r);
    ctx.stroke();
    if (keep) {
      // a lit lantern's warm core
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.36);
      core.addColorStop(0, "rgba(255,250,232,0.95)");
      core.addColorStop(1, "rgba(255,250,232,0)");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.36, 0, TAU);
      ctx.fill();
    } else {
      // taken back: a small return arrow
      ctx.strokeStyle = PAL.coralInk;
      ctx.fillStyle = PAL.coralInk;
      ctx.lineWidth = Math.max(0.8, s * 0.09);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(cx + s * 0.02, cy + s * 0.04, s * 0.2, -Math.PI * 0.9, Math.PI * 0.55);
      ctx.stroke();
      const ax = cx + s * 0.02 + Math.cos(-Math.PI * 0.9) * s * 0.2;
      const ay = cy + s * 0.04 + Math.sin(-Math.PI * 0.9) * s * 0.2;
      ctx.beginPath();
      ctx.moveTo(ax - s * 0.14, ay - s * 0.02);
      ctx.lineTo(ax + s * 0.07, ay - s * 0.12);
      ctx.lineTo(ax + s * 0.04, ay + s * 0.11);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

function sparkle(ctx: Ctx, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.quadraticCurveTo(cx, cy, cx + r, cy);
  ctx.quadraticCurveTo(cx, cy, cx, cy + r);
  ctx.quadraticCurveTo(cx, cy, cx - r, cy);
  ctx.quadraticCurveTo(cx, cy, cx, cy - r);
  ctx.fill();
}

/** "✨ No hints" pill (drawn wherever the caller puts it; returns its width). */
export function drawNoHintPill(ctx: Ctx, x: number, cy: number, h: number, text: string, font: string, dark: boolean): number {
  ctx.save();
  ctx.font = `700 ${Math.round(h * 0.52)}px ${font}`;
  const tw = ctx.measureText(text).width;
  const w = tw + h * 1.25;
  ctx.fillStyle = dark ? "rgba(20,16,44,0.72)" : "rgba(255,243,222,0.9)";
  rrectPath(ctx, x, cy - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = "#FFD27A";
  sparkle(ctx, x + h * 0.5, cy, h * 0.3);
  ctx.fillStyle = dark ? PAL.moon : INK;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(text, x + h * 0.85, cy + h * 0.02);
  ctx.restore();
  return w;
}

// ---------------------------------------------------------------- in-app card (landscape)

/** Geometry of the in-app card, in px (u = px per pt). The rows' column is left for Phaser text. */
export interface SheetCardGeo {
  w: number;
  h: number;
  pic: { x: number; y: number; w: number; h: number };
  stamp: { x: number; y: number; w: number; h: number };
  mark: { cx: number; cy: number; r: number };
  /** the stat rows' box (Phaser objects go here) */
  rows: { x: number; y: number; w: number; h: number };
  strip: { x: number; y: number; w: number; chip: number };
}

export function sheetCardGeo(w: number, rowsH: number, u: number, compact: boolean): SheetCardGeo {
  const m = (compact ? 8 : 10) * u;
  const chip = Math.round((compact ? 14 : 16) * u);
  const stripH = chip + (compact ? 8 : 12) * u;
  const picH = Math.round(Math.max(rowsH + 6 * u, (compact ? 92 : 104) * u));
  const picW = Math.round(Math.min(w * 0.5, picH * 1.75));
  const h = Math.round(m + picH + stripH + m * 0.5);
  // the stamp in the picture's top-right corner; the postmark below it, over the dark ground
  const stampW = Math.round((compact ? 34 : 40) * u);
  const stampH = Math.round(stampW * 1.2);
  const r = Math.round((compact ? 17 : 19) * u);
  const colX = m + picW + 14 * u;
  return {
    w,
    h,
    pic: { x: m, y: m, w: picW, h: picH },
    stamp: { x: m + picW - stampW - 6 * u, y: m + 6 * u, w: stampW, h: stampH },
    mark: { cx: m + picW - r - 6 * u, cy: m + picH - r - 4 * u, r },
    rows: { x: colX, y: m + (picH - rowsH) / 2, w: w - m - colX - 2 * u, h: rowsH },
    strip: { x: m + 2 * u, y: m + picH + stripH / 2 + 1 * u, w: w - 2 * m - 4 * u, chip },
  };
}

/** The in-app card: paper, picture (+ stamp + postmark) and strip. The rows are not drawn here. */
export function drawSheetCard(ctx: Ctx, g: SheetCardGeo, spec: PostcardSpec, words: PostcardWords, u: number): void {
  drawPaper(ctx, 0, 0, g.w, g.h, 14 * u, u);
  drawPicture(ctx, g.pic.x, g.pic.y, g.pic.w, g.pic.h, spec, 8 * u, 0.4, 0.03);
  if (spec.hints === 0) drawNoHintPill(ctx, g.pic.x + 6 * u, g.pic.y + g.pic.h - 15 * u, 22 * u, words.noHints, words.font, true);
  drawStamp(ctx, g.stamp.x, g.stamp.y, g.stamp.w, g.stamp.h);
  drawPostmark(ctx, g.mark.cx, g.mark.cy, g.mark.r, spec.n, words.date, words.font, false, true);
  ctx.save();
  ctx.fillStyle = rgba(INK, 0.7);
  ctx.font = `700 ${Math.round(11 * u)}px ${words.font}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const label = words.order;
  const lw = Math.min(ctx.measureText(label).width, g.strip.w * 0.42);
  ctx.fillText(label, g.strip.x, g.strip.y, g.strip.w * 0.42);
  ctx.restore();
  drawStrip(ctx, g.strip.x + lw + 10 * u, g.strip.y, g.strip.chip, g.strip.w - lw - 10 * u, spec.strip, words.font);
}

// ---------------------------------------------------------------- the share image (portrait 4:5)

export const SHARE_W = 1080;
export const SHARE_H = 1350;

/** The 1080×1350 share postcard. Same pieces, bigger; words drawn in the UI font. */
export function drawSharePostcard(ctx: Ctx, spec: PostcardSpec, words: PostcardWords, W = SHARE_W, H = SHARE_H): void {
  const u = W / 390;
  // the night table it lies on
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, PAL.skyNight);
  bg.addColorStop(0.6, PAL.skyDusk);
  bg.addColorStop(1, mix(PAL.hillFar, PAL.skyDusk, 0.4));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  drawGlow(ctx, W / 2, H * 0.42, W * 0.8, [[0, "rgba(255,200,120,0.14)"], [1, "rgba(255,200,120,0)"]]);
  const px = 18 * u;
  const py = 22 * u;
  const cw = W - 2 * px;
  const ch = H - 2 * py;
  drawPaper(ctx, px, py, cw, ch, 18 * u, u);
  const m = 14 * u;
  const picX = px + m;
  const picY = py + m;
  const picW = cw - 2 * m;
  const picH = Math.round(ch * 0.48);
  drawPicture(ctx, picX, picY, picW, picH, spec, 10 * u);
  // stamp over the picture's top-right corner
  const sw = 74 * u;
  const sh = sw * 1.2;
  drawStamp(ctx, picX + picW - sw - 12 * u, picY + 12 * u, sw, sh);
  // the postmark crosses the picture's lower edge; the title beside it says the name once (#n is the postmark's)
  const left = picX + 4 * u;
  const y1 = picY + picH + 40 * u;
  ctx.save();
  ctx.fillStyle = INK;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.font = `800 ${Math.round(30 * u)}px ${words.font}`;
  ctx.fillText("Duskwick", left, y1, picW * 0.6);
  ctx.restore();
  drawPostmark(ctx, picX + picW - 44 * u, picY + picH + 46 * u, 34 * u, spec.n, words.date, words.font, true);
  // the stats: label over value, each fact once
  const y2 = y1 + 29 * u;
  const stats: Array<[string, string]> = [];
  if (spec.time) stats.push([words.time, spec.time]);
  stats.push([words.streak, String(Math.max(0, spec.streak))]);
  const colW = picW / 3;
  stats.forEach(([lbl, val], i) => {
    const x = left + i * colW;
    ctx.save();
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = rgba(INK, 0.68);
    ctx.font = `700 ${Math.round(13 * u)}px ${words.font}`;
    ctx.fillText(lbl, x, y2, colW - 8 * u);
    ctx.fillStyle = INK;
    ctx.font = `800 ${Math.round(26 * u)}px ${DIGIT_FONT}`;
    ctx.fillText(val, x, y2 + 27 * u, colW - 8 * u);
    ctx.restore();
  });
  if (spec.hints === 0) drawNoHintPill(ctx, left + stats.length * colW, y2 + 14 * u, 28 * u, words.noHints, words.font, false);
  // the placement-order strip
  const y3 = y2 + 27 * u + 25 * u;
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = rgba(INK, 0.68);
  ctx.font = `700 ${Math.round(13 * u)}px ${words.font}`;
  ctx.fillText(words.order, left, y3, picW);
  ctx.restore();
  drawStrip(ctx, left, y3 + 18 * u, 18 * u, picW - 8 * u, spec.strip, words.font);
  // the invitation + link (bottom)
  const by = py + ch - 26 * u;
  ctx.save();
  ctx.strokeStyle = rgba(UI.paperEdge, 1);
  ctx.lineWidth = Math.max(1, u);
  ctx.beginPath();
  ctx.moveTo(left, by - 30 * u);
  ctx.lineTo(left + picW - 8 * u, by - 30 * u);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.textBaseline = "alphabetic";
  ctx.font = `800 ${Math.round(17 * u)}px ${words.font}`;
  ctx.fillText(words.yourTurn, left, by, picW * 0.45);
  ctx.textAlign = "right";
  ctx.fillStyle = rgba(INK, 0.75);
  ctx.font = `600 ${Math.round(13 * u)}px ${words.font}`;
  ctx.fillText(words.link, left + picW - 8 * u, by, picW * 0.55);
  ctx.restore();
}

/** Bake the share image offscreen → PNG base64 (no data: prefix). null when the WebView cannot. */
export function bakeSharePng(spec: PostcardSpec, words: PostcardWords): string | null {
  try {
    const c = document.createElement("canvas");
    c.width = SHARE_W;
    c.height = SHARE_H;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    drawSharePostcard(ctx, spec, words);
    const url = c.toDataURL("image/png");
    const i = url.indexOf(",");
    return i > 0 ? url.slice(i + 1) : null;
  } catch {
    return null;
  }
}
