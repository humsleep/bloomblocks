// Phase 5 flow glyphs: the alley strip, the month strip, milestone / gift badges, the reminder /
// restart / privacy icons and the daily's back chip. v9 (agent V): redrawn in the HUD grammar of
// src/render/draw.ts — round-capped strokes at ≈ 0.094 of the glyph box (2.25 pt on a 24 pt glyph),
// moon ink, one warm accent (lantern light) for "done / lit / now", the same disc as the HUD.
// Callers depend only on the function names, signatures and sizes (U, phase 5).
import { DIGIT_FONT, drawBreakChip, drawDoneBadge, drawGear, drawGlow, drawHudDisc, drawHudDiscEmph, drawLantern, drawNewDot, drawSparkle, GLOW, hudStroke, rrectPath, strokeHomeGlyph } from "../render/draw.ts";
import { PAL, rgba } from "../render/palette.ts";
import type { DayMark } from "./progress.ts";

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

/** The grammar's stroke for a glyph box of `s` px. */
function pen(ctx: Ctx, s: number, col: string, k = 1): void {
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(1.2, s * 0.094 * k);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

function done(ctx: Ctx): void {
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
}

/** The festoon cord across a cell (y = cord height at the cell edges, sags 0.08 s mid-cell). One band, no hairline. */
function cord(ctx: Ctx, s: number, y: number, hc: boolean): void {
  ctx.lineCap = "round";
  ctx.strokeStyle = hc ? "rgba(236,228,206,0.9)" : "rgba(26,22,54,0.9)";
  ctx.lineWidth = Math.max(1, s * 0.055);
  ctx.beginPath();
  ctx.moveTo(-1, y);
  ctx.quadraticCurveTo(s / 2, y + s * 0.12, s + 1, y);
  ctx.stroke();
  ctx.lineCap = "butt";
}

/**
 * One cell of the alley strip — v14 (Reality G1 #24): the village kit's string-light bulb (a small paper
 * lantern: rounded paper, wooden caps, value-band ribs, one-step-darker outline), hanging from a cord
 * strung across the sky. done = lit, current = half-lit (U breathes a glow on it), ahead = unlit paper.
 * Its glow is a radial pool that fits INSIDE the cell (no square clipping, v1 #5). The 10th (finale,
 * 1.4× texture) is bigger with the landmark sparkle. The cord sits at the same screen height in every cell.
 */
export function drawAlleyHouse(ctx: Ctx, s: number, state: "done" | "current" | "ahead", finale: boolean, hc: boolean): void {
  const cy = finale ? s * 0.357 : s * 0.1;
  cord(ctx, s, cy, hc);
  const bh = finale ? s * 0.5 : s * 0.6;
  const bw = bh * 0.78;
  const lx = s / 2;
  const top = cy + s * (finale ? 0.07 : 0.1);
  const mid = top + bh / 2;
  const lit = state === "done" ? 1 : state === "current" ? 0.55 : 0;
  // the hook (a short band)
  ctx.fillStyle = hc ? "rgba(236,228,206,0.9)" : "rgba(26,22,54,0.9)";
  ctx.fillRect(lx - Math.max(0.5, s * 0.02), cy, Math.max(1, s * 0.04), top - cy + 1);
  if (lit > 0) {
    // the pool of light, kept inside the cell (radius ≤ the distance to every edge)
    const r = Math.min(s / 2, mid, s - mid) * 0.98;
    drawGlow(ctx, lx, mid, r, [[0, `rgba(255,214,140,${0.5 * lit})`], [0.45, `rgba(255,190,110,${0.18 * lit})`], [1, "rgba(255,170,90,0)"]]);
  }
  ctx.save();
  if (state === "ahead") ctx.globalAlpha = hc ? 0.92 : 0.7;
  // paper body
  const body = new Path2D();
  body.roundRect(lx - bw / 2, top + bh * 0.1, bw, bh * 0.8, bw * 0.42);
  const g = ctx.createRadialGradient(lx - bw * 0.12, mid - bh * 0.08, bw * 0.05, lx, mid, bw * 0.75);
  if (lit > 0) {
    g.addColorStop(0, lit === 1 ? "#FFF8E0" : "#FFE9C0");
    g.addColorStop(0.55, lit === 1 ? "#FFD27A" : "#F2C890");
    g.addColorStop(1, lit === 1 ? "#E9A04A" : "#C9A07A");
  } else {
    g.addColorStop(0, "#CFC3D8");
    g.addColorStop(1, "#8F82A6");
  }
  ctx.fillStyle = g;
  ctx.fill(body);
  // ribs: value bands (no hairlines); key light from the upper left, plum on the right
  ctx.save();
  ctx.clip(body);
  ctx.fillStyle = lit > 0 ? "rgba(190,120,60,0.28)" : "rgba(70,56,100,0.3)";
  for (const k of [0.38, 0.62]) ctx.fillRect(lx - bw / 2, top + bh * k - Math.max(0.5, bh * 0.025), bw, Math.max(1, bh * 0.05));
  const side = ctx.createLinearGradient(lx - bw / 2, 0, lx + bw / 2, 0);
  side.addColorStop(0, "rgba(255,214,176,0.22)");
  side.addColorStop(0.4, "rgba(255,214,176,0)");
  side.addColorStop(0.7, "rgba(20,15,44,0)");
  side.addColorStop(1, "rgba(20,15,44,0.3)");
  ctx.fillStyle = side;
  ctx.fillRect(lx - bw / 2, top, bw, bh);
  ctx.restore();
  ctx.lineWidth = Math.max(1, s * 0.035);
  ctx.strokeStyle = lit > 0 ? "#8A5A3A" : "#4E4266";
  ctx.stroke(body);
  // wooden caps (one body with the paper)
  for (const [y, w] of [[top + bh * 0.04, bw * 0.62], [top + bh * 0.84, bw * 0.56]] as const) {
    const cap = new Path2D();
    cap.roundRect(lx - w / 2, y, w, bh * 0.12, bh * 0.05);
    ctx.fillStyle = "#7A5440";
    ctx.fill(cap);
    ctx.fillStyle = "rgba(255,214,176,0.35)";
    ctx.fillRect(lx - w / 2 + bh * 0.04, y + bh * 0.015, w - bh * 0.08, Math.max(0.8, bh * 0.03));
    ctx.lineWidth = Math.max(0.8, s * 0.03);
    ctx.strokeStyle = "#3E2A30";
    ctx.stroke(cap);
  }
  ctx.restore();
  if (finale) {
    // the alley's landmark: a sparkle beside the big lantern
    drawSparkle(ctx, lx + bw * 0.62, top + bh * 0.22, s * 0.08, state === "ahead" ? rgba(PAL.moon, hc ? 0.9 : 0.6) : PAL.flame);
  }
}

/** One floor of the tower column (deduce), `w × h`. Two windows; done = lit, current = warm outline. */
export function drawTowerFloor(ctx: Ctx, w: number, h: number, state: "done" | "current" | "ahead", top: boolean, hc: boolean): void {
  const k = h * 0.09;
  rrectPath(ctx, k, k, w - k * 2, h - k * 2, h * 0.16);
  ctx.fillStyle = state === "ahead" ? "rgba(20,22,48,0.5)" : PAL.wall;
  ctx.fill();
  pen(ctx, h, state === "current" ? PAL.flame : state === "done" ? rgba(PAL.moon, 0.8) : rgba(PAL.moon, hc ? 0.75 : 0.3), 0.9);
  ctx.stroke();
  const ws = h * 0.34;
  for (const x of [0.32, 0.68]) {
    if (state === "done") drawGlow(ctx, w * x, h / 2, ws, GLOW.window);
    ctx.fillStyle = state === "done" ? PAL.windowLit : state === "current" ? rgba(PAL.windowLit, 0.45) : rgba(PAL.moon, hc ? 0.4 : 0.14);
    rrectPath(ctx, w * x - ws / 2, h / 2 - ws / 2, ws, ws, ws * 0.2);
    ctx.fill();
  }
  if (top) {
    if (state !== "ahead") drawGlow(ctx, w / 2, h * 0.1, h * 0.3, GLOW.flame);
    ctx.fillStyle = state === "ahead" ? rgba(PAL.moon, 0.5) : PAL.flame;
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.1, h * 0.11, 0, TAU);
    ctx.fill();
  }
  done(ctx);
}

/**
 * Between cell 5 and 6 of the alley (U draws it at 0.8× with the cells' centre): v10 = the festoon
 * cord continues, with a small round paper globe on it (lit once the first five are done).
 */
export function drawLampMark(ctx: Ctx, s: number, lit: boolean, hc: boolean): void {
  const y = s * 0.025;
  cord(ctx, s, y, hc);
  const gy = y + s * 0.2;
  if (lit) drawGlow(ctx, s / 2, gy, s * 0.32, GLOW.flame);
  const g = ctx.createRadialGradient(s / 2 - s * 0.03, gy - s * 0.03, 0, s / 2, gy, s * 0.11);
  g.addColorStop(0, lit ? PAL.windowLitCore : "#C9C2B0");
  g.addColorStop(1, lit ? PAL.flame : "#8E8676");
  ctx.fillStyle = g;
  ctx.globalAlpha = lit ? 1 : hc ? 0.9 : 0.6;
  ctx.beginPath();
  ctx.arc(s / 2, gy, s * 0.11, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** One day of the month strip. done = a small lit lantern-light, shield = the kept day's ribbon. */
export function drawMonthDay(ctx: Ctx, s: number, mark: DayMark, today: boolean, hc: boolean): void {
  const c = s / 2;
  const r = s * 0.28;
  if (mark === "done") {
    drawGlow(ctx, c, c, s * 0.5, GLOW.window);
    const g = ctx.createRadialGradient(c - r * 0.3, c - r * 0.35, 0, c, c, r);
    g.addColorStop(0, PAL.windowLitCore);
    g.addColorStop(0.6, PAL.flame);
    g.addColorStop(1, "#E8964A");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c, c, r, 0, TAU);
    ctx.fill();
  } else if (mark === "shield") {
    // the kept lantern's moon-blue ribbon (the same colour as the shields)
    ctx.fillStyle = PAL.conflict;
    ctx.beginPath();
    ctx.moveTo(c - r * 0.6, c - r);
    ctx.lineTo(c + r * 0.6, c - r);
    ctx.lineTo(c + r * 0.6, c + r);
    ctx.lineTo(c, c + r * 0.5);
    ctx.lineTo(c - r * 0.6, c + r);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(14,22,48,0.9)";
    ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.lineJoin = "round";
    ctx.stroke();
  } else if (mark === "missed") {
    pen(ctx, s, rgba(PAL.moon, hc ? 0.7 : 0.3), 0.7);
    ctx.beginPath();
    ctx.arc(c, c, r * 0.8, 0, TAU);
    ctx.stroke();
  } else {
    ctx.fillStyle = rgba(PAL.moon, hc ? 0.45 : 0.18);
    ctx.beginPath();
    ctx.arc(c, c, r * 0.35, 0, TAU);
    ctx.fill();
  }
  if (today) {
    pen(ctx, s, PAL.moon, 0.75);
    ctx.beginPath();
    ctx.arc(c, c, s * 0.45, 0, TAU);
    ctx.stroke();
  }
  done(ctx);
}

/** Streak milestone badge: a big festival lantern in its own colour (3 sage, 7 plum, 30 koi, 100 moon, 365 gold). */
export function drawMilestoneLantern(ctx: Ctx, s: number, n: number): void {
  const col = n >= 365 ? PAL.flame : n >= 100 ? PAL.moon : n >= 30 ? PAL.koi : n >= 7 ? PAL.plum : PAL.sage;
  drawGlow(ctx, s / 2, s * 0.5, s / 2, [[0, rgba(col, 0.5)], [0.5, rgba(col, 0.18)], [1, rgba(col, 0)]]);
  ctx.save();
  ctx.translate(s / 2 - s * 0.78 * 0.4, s * 0.06);
  drawLantern(ctx, s * 0.78, 1);
  ctx.restore();
  drawGlow(ctx, s / 2, s * 0.06 + s * 0.78 * 0.56, s * 0.2, GLOW.flame);
  // a ribbon of the milestone colour across the lantern's base
  ctx.fillStyle = col;
  rrectPath(ctx, s * 0.27, s * 0.8, s * 0.46, s * 0.1, s * 0.05);
  ctx.fill();
  ctx.strokeStyle = "rgba(14,12,30,0.6)";
  ctx.lineWidth = Math.max(1, s * 0.015);
  ctx.stroke();
}

/** The 7-day gift: the ad-break chip (moon + pause) + an hourglass (one hour without ads). */
export function drawGiftChip(ctx: Ctx, w: number, h: number): void {
  drawBreakChip(ctx, h);
  drawHourglass(ctx, h + (w - h) / 2 - h * 0.25, h * 0.16, h * 0.5, h * 0.68, PAL.flame);
}

export function drawHourglass(ctx: Ctx, x: number, y: number, w: number, h: number, col: string): void {
  pen(ctx, h, col, 0.8);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.moveTo(x, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.moveTo(x + w * 0.15, y);
  ctx.quadraticCurveTo(x + w * 0.15, y + h * 0.42, x + w * 0.5, y + h * 0.5);
  ctx.quadraticCurveTo(x + w * 0.85, y + h * 0.58, x + w * 0.85, y + h);
  ctx.moveTo(x + w * 0.85, y);
  ctx.quadraticCurveTo(x + w * 0.85, y + h * 0.42, x + w * 0.5, y + h * 0.5);
  ctx.quadraticCurveTo(x + w * 0.15, y + h * 0.58, x + w * 0.15, y + h);
  ctx.stroke();
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.28, y + h * 0.94);
  ctx.lineTo(x + w * 0.72, y + h * 0.94);
  ctx.lineTo(x + w * 0.5, y + h * 0.74);
  ctx.closePath();
  ctx.fill();
  done(ctx);
}

/** Bell (reminders), drawn in a `s` box. `off` = struck through. */
export function drawBell(ctx: Ctx, x: number, y: number, s: number, col: string, off = false): void {
  pen(ctx, s, col);
  ctx.beginPath();
  ctx.moveTo(x + s * 0.2, y + s * 0.7);
  ctx.quadraticCurveTo(x + s * 0.28, y + s * 0.6, x + s * 0.28, y + s * 0.44);
  ctx.quadraticCurveTo(x + s * 0.28, y + s * 0.2, x + s * 0.5, y + s * 0.2);
  ctx.quadraticCurveTo(x + s * 0.72, y + s * 0.2, x + s * 0.72, y + s * 0.44);
  ctx.quadraticCurveTo(x + s * 0.72, y + s * 0.6, x + s * 0.8, y + s * 0.7);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + s * 0.5, y + s * 0.2);
  ctx.lineTo(x + s * 0.5, y + s * 0.13);
  ctx.stroke();
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(x + s * 0.5, y + s * 0.8, s * 0.07, 0, TAU);
  ctx.fill();
  if (off) strike(ctx, x, y, s, col);
  done(ctx);
}

/**
 * The reminder's time as an alarm clock (v10: at 16–24 pt the old face read as a "1"): a bold
 * ring, two bells and a hammer on top, two feet, 12 / 3 / 6 / 9 ticks, and the hands at the
 * reminder time — the minute hand never hides under the hour hand (it is nudged 25° aside).
 */
export function drawClock(ctx: Ctx, x: number, y: number, s: number, col: string, minute: number): void {
  const cx = x + s / 2;
  const cy = y + s * 0.54;
  const r = s * 0.33;
  // bells + hammer
  ctx.fillStyle = col;
  for (const sd of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(cx + sd * r * 0.78, cy - r * 0.86, s * 0.1, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
  }
  pen(ctx, s, col, 0.8);
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx, cy - r - s * 0.07);
  // feet
  for (const sd of [-1, 1]) {
    ctx.moveTo(cx + sd * r * 0.62, cy + r * 0.8);
    ctx.lineTo(cx + sd * r * 0.9, cy + r * 1.15);
  }
  ctx.stroke();
  // face: a filled dark disc inside a bold ring (reads as a face even at 16 pt)
  ctx.fillStyle = "rgba(14,12,30,0.55)";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fill();
  pen(ctx, s, col, 1.15);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.stroke();
  const hA = (((minute / 60) % 12) / 12) * TAU;
  let mA = ((minute % 60) / 60) * TAU;
  const dA = Math.atan2(Math.sin(mA - hA), Math.cos(mA - hA));
  if (Math.abs(dA) < 0.44) mA = hA + (dA >= 0 ? 0.44 : -0.44);
  if (Math.abs(Math.abs(dA) - Math.PI) < 0.2) mA += 0.3; // a straight line also reads as "1"
  pen(ctx, s, col, 0.8);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.sin(hA) * r * 0.5, cy - Math.cos(hA) * r * 0.5);
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.sin(mA) * r * 0.74, cy - Math.cos(mA) * r * 0.74);
  ctx.stroke();
  ctx.fillStyle = PAL.flame;
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.04, 0, TAU);
  ctx.fill();
  done(ctx);
}

/** Start over: a small 3×3 board inside a circling arrow (stroked chevron head, the undo's grammar). */
export function drawRestart(ctx: Ctx, w: number, h: number, col: string): void {
  const s = Math.min(w, h);
  const cx = w / 2;
  const cy = h / 2;
  const r = s * 0.38;
  pen(ctx, s, col, 0.75);
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI * 0.35, Math.PI * 1.45);
  ctx.stroke();
  const a = -Math.PI * 0.35;
  const ax = cx + Math.cos(a) * r;
  const ay = cy + Math.sin(a) * r;
  ctx.beginPath();
  ctx.moveTo(ax - s * 0.11, ay - s * 0.06);
  ctx.lineTo(ax, ay);
  ctx.lineTo(ax - s * 0.02, ay + s * 0.12);
  ctx.stroke();
  const g = s * 0.13;
  ctx.fillStyle = col;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    ctx.globalAlpha = (i + j) % 2 ? 0.45 : 0.9;
    rrectPath(ctx, cx - g * 1.5 + i * g + 1, cy - g * 1.5 + j * g + 1, g - 2, g - 2, g * 0.2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  done(ctx);
}

/** Privacy choices: a stroked shield with a keyhole. */
export function drawPrivacy(ctx: Ctx, w: number, h: number, col: string): void {
  const s = Math.min(w, h) * 0.78;
  const x = w / 2 - s / 2;
  const y = h / 2 - s / 2;
  pen(ctx, s, col, 0.9);
  ctx.beginPath();
  ctx.moveTo(x + s * 0.5, y + s * 0.04);
  ctx.lineTo(x + s * 0.88, y + s * 0.18);
  ctx.quadraticCurveTo(x + s * 0.88, y + s * 0.72, x + s * 0.5, y + s * 0.96);
  ctx.quadraticCurveTo(x + s * 0.12, y + s * 0.72, x + s * 0.12, y + s * 0.18);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(x + s * 0.5, y + s * 0.44, s * 0.09, 0, TAU);
  ctx.fill();
  rrectPath(ctx, x + s * 0.465, y + s * 0.46, s * 0.07, s * 0.2, s * 0.03);
  ctx.fill();
  done(ctx);
}

/** Settings: the privacy policy (a web page, opens in Safari) — a page with a folded corner and three lines. */
export function drawPolicy(ctx: Ctx, w: number, h: number, col: string): void {
  const s = Math.min(w, h) * 0.78;
  const pw = s * 0.7;
  const x = w / 2 - pw / 2;
  const y = h / 2 - s / 2;
  const f = s * 0.22; // folded corner
  pen(ctx, s, col, 0.9);
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.06);
  ctx.lineTo(x + pw - f, y + s * 0.06);
  ctx.lineTo(x + pw, y + s * 0.06 + f);
  ctx.lineTo(x + pw, y + s * 0.94);
  ctx.lineTo(x, y + s * 0.94);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + pw - f, y + s * 0.06);
  ctx.lineTo(x + pw - f, y + s * 0.06 + f);
  ctx.lineTo(x + pw, y + s * 0.06 + f);
  ctx.stroke();
  pen(ctx, s, col, 0.6);
  ctx.beginPath();
  for (const [ly, lw] of [[0.46, 0.62], [0.62, 0.62], [0.78, 0.4]] as const) {
    ctx.moveTo(x + pw * 0.19, y + s * ly);
    ctx.lineTo(x + pw * (0.19 + lw), y + s * ly);
  }
  ctx.stroke();
  done(ctx);
}

/** The daily's way out (top left, beside the gear): the HUD disc as a pill, a back chevron and the house glyph. */
export function drawBackChip(ctx: Ctx, w: number, h: number): void {
  const r = h / 2;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "rgba(40,45,82,0.74)");
  g.addColorStop(1, "rgba(22,25,50,0.74)");
  rrectPath(ctx, 1, 1, w - 2, h - 2, r - 1);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = rgba(PAL.moon, 0.28);
  ctx.lineWidth = Math.max(1, h * 0.021);
  ctx.stroke();
  pen(ctx, h, PAL.moon, 0.5);
  ctx.beginPath();
  ctx.moveTo(h * 0.5, h * 0.32);
  ctx.lineTo(h * 0.32, h * 0.5);
  ctx.lineTo(h * 0.5, h * 0.68);
  ctx.stroke();
  strokeHomeGlyph(ctx, h * 0.98, h * 0.5, h);
  done(ctx);
}

function strike(ctx: Ctx, x: number, y: number, s: number, col: string): void {
  ctx.lineCap = "round";
  for (const [c, lw] of [["rgba(8,10,26,0.9)", s * 0.17], [col, s * 0.085]] as const) {
    ctx.strokeStyle = c;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x + s * 0.15, y + s * 0.9);
    ctx.lineTo(x + s * 0.85, y + s * 0.1);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
}

// ---------------------------------------------------------------- R2 HUD grammar (decision A1)
// Every HUD button is the same disc (drawHudDisc) with its caption BELOW it (the scene's captions);
// "tap this now" = drawHudDiscEmph (amber rim, amber glyph). These replace the bare gear, the outlined
// "?", the paper "today" tile and the "〈⌂" chip (docs/team/r1-critique-visual.md (b)).

/** Settings: the gear glyph in the disc. */
export function drawGearDisc(ctx: Ctx, s: number): void {
  drawHudDisc(ctx, s);
  const g = Math.round(s * 0.56);
  ctx.save();
  ctx.translate((s - g) / 2, (s - g) / 2);
  drawGear(ctx, g);
  ctx.restore();
}

/** Rules: a bold "?" in the disc (the sheet is called "Rules" everywhere; the glyph asks the question). */
export function drawRulesDisc(ctx: Ctx, s: number, bold: boolean): void {
  drawHudDisc(ctx, s);
  ctx.fillStyle = PAL.moon;
  ctx.font = `${bold ? 900 : 800} ${Math.round(s * 0.5)}px ${DIGIT_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("?", s / 2, s * 0.53);
}

/** Back (the daily's way home): a back chevron and the house glyph in the disc. */
export function drawBackDisc(ctx: Ctx, s: number): void {
  drawHudDisc(ctx, s);
  hudStroke(ctx, s);
  ctx.beginPath();
  ctx.moveTo(s * 0.3, s * 0.36);
  ctx.lineTo(s * 0.2, s * 0.5);
  ctx.lineTo(s * 0.3, s * 0.64);
  ctx.stroke();
  strokeHomeGlyph(ctx, s * 0.56, s * 0.52, s * 0.86);
  done(ctx);
}

/**
 * Today: a stroked calendar (two binder rings) with today's day number — emphasis (amber rim + amber
 * glyph) while today's puzzle is unplayed, a gold check badge once it is done.
 */
export function drawTodayDisc(ctx: Ctx, s: number, day: number, open: boolean, isDone: boolean, bold: boolean): void {
  // v14 (mock g, Reality G1 #24): always the plain disc + cream glyph; "today's puzzle is waiting" is the
  // grammar's amber "new" dot (the amber rim belongs to the hint's attention state)
  drawHudDisc(ctx, s);
  const col = PAL.moon;
  const w = s * 0.46;
  const h = s * 0.42;
  const x = (s - w) / 2;
  const y = s * 0.3;
  hudStroke(ctx, s, col);
  rrectPath(ctx, x, y, w, h, s * 0.06);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.3);
  ctx.lineTo(x + w, y + h * 0.3);
  ctx.stroke();
  for (const rx of [x + w * 0.28, x + w * 0.72]) {
    ctx.beginPath();
    ctx.moveTo(rx, y - s * 0.05);
    ctx.lineTo(rx, y + s * 0.04);
    ctx.stroke();
  }
  ctx.fillStyle = col;
  ctx.font = `${bold ? 900 : 800} ${Math.round(s * (day >= 10 ? 0.2 : 0.22))}px ${DIGIT_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(day), s / 2, y + h * 0.66);
  if (isDone) drawDoneBadge(ctx, s * 0.76, s * 0.74, s * 0.11);
  else if (open) drawNewDot(ctx, s);
  done(ctx);
}

/**
 * The village (mock g "Village"): the lantern jar as a line glyph in the disc — a round jar, its lid band,
 * the light level inside with three drops. `fill` 0…1 = how full the jar is. `fresh` = the amber "new" dot.
 */
export function drawVillageDisc(ctx: Ctx, s: number, fill = 0.66, fresh = false): void {
  drawHudDisc(ctx, s);
  const x = s / 2;
  const y = s * 0.52;
  const k = s * 0.5;
  pen(ctx, s, PAL.moon, 0.5);
  ctx.lineWidth = Math.max(1.5, s * 0.047);
  const body = new Path2D();
  body.moveTo(x - k * 0.24, y - k * 0.2);
  body.quadraticCurveTo(x - k * 0.38, y + k * 0.12, x - k * 0.27, y + k * 0.4);
  body.quadraticCurveTo(x, y + k * 0.48, x + k * 0.27, y + k * 0.4);
  body.quadraticCurveTo(x + k * 0.38, y + k * 0.12, x + k * 0.24, y - k * 0.2);
  // the light inside (a warm fill up to the level), under the glyph
  const ly = y + k * 0.42 - k * 0.56 * Math.max(0, Math.min(1, fill));
  ctx.save();
  ctx.clip(body);
  const g = ctx.createLinearGradient(0, ly, 0, y + k * 0.46);
  g.addColorStop(0, "rgba(255,214,140,0.75)");
  g.addColorStop(1, "rgba(255,170,80,0.55)");
  ctx.fillStyle = g;
  ctx.fillRect(x - k * 0.4, ly, k * 0.8, k);
  ctx.restore();
  ctx.stroke(body);
  rrectPath(ctx, x - k * 0.31, y - k * 0.37, k * 0.62, k * 0.15, k * 0.06);
  ctx.stroke();
  ctx.fillStyle = "#FFF4D6";
  for (const [dx, dy] of [[-0.1, 0.14], [0.09, 0.22], [0.12, 0.06]] as const) {
    ctx.beginPath();
    ctx.arc(x + dx * k, ly + dy * k, Math.max(0.8, k * 0.045), 0, TAU);
    ctx.fill();
  }
  if (fresh) drawNewDot(ctx, s);
  done(ctx);
}
