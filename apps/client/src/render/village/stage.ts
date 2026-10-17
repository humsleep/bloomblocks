// The village's two "moments" as kit compositions (Reality G1 #6–#7, #10–#11): the gift reveal and the
// letter. Each draws its picture into a box and returns where the scene puts its words (the kit draws
// no text). Static: the scene animates the baked image (contract §4).
import type { Ctx } from "../draw.ts";
import { drawFurnitureAt, furnitureScale, ITEMS, type Colorway, type ItemId } from "./furniture.ts";
import { drawEnvelope, letterHeight, letterLines, type LetterLines } from "./letter.ts";
import type { ResidentId } from "./lanternHouse.ts";
import { drawResidentAt, RESIDENTS } from "./residents.ts";
import { contact, glow, hexA, mix, P, reseed, rnd, solid, T, type Box } from "./shade.ts";

function sparkle(ctx: Ctx, x: number, y: number, r: number, col: string): void {
  const k = r * 0.26;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + k, y - k, x + r, y);
  ctx.quadraticCurveTo(x + k, y + k, x, y + r);
  ctx.quadraticCurveTo(x - k, y + k, x - r, y);
  ctx.quadraticCurveTo(x - k, y - k, x, y - r);
  ctx.fill();
}

/** Soft light wedges from a point (additive radial fills — no hairlines anywhere). */
function rays(ctx: Ctx, x: number, y: number, r: number, n: number, col: string, a: number): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < n; i++) {
    const a0 = Math.PI + (i / (n - 1)) * Math.PI - 0.08;
    const a1 = a0 + Math.PI / n / 1.8;
    const g = ctx.createRadialGradient(x, y, r * 0.08, x, y, r);
    g.addColorStop(0, hexA(col, a));
    g.addColorStop(0.6, hexA(col, a * 0.35));
    g.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, r, a0, a1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** A soft paper stage a resident stands on (nobody floats). */
function stagePad(ctx: Ctx, x: number, y: number, rx: number): void {
  // v15 (re-review 2 #8): no paper plate (it overlapped the houses behind) — a pool of the gift's light + a shadow
  glow(ctx, x, y, rx * 1.3, "#FFD9A0", 0.28, 0.3);
  contact(ctx, x, y + rx * 0.06, rx * 0.8, rx * 0.16, 0.4);
}

export interface GiftStageOpts {
  item: ItemId;
  cw: Colorway;
  /** who sent it (reacts on the left); Wick cheers on the right (Momo, if Wick sent it) */
  sender: ResidentId;
  /** gift wrap colours (the sender's) */
  paper?: string;
  ribbon?: string;
}

const WRAP: Record<ResidentId, [string, string]> = {
  wick: ["#F6D7A0", "#E7A75A"],
  momo: ["#F2B9C4", "#FFF1D6"],
  sage: ["#BFE3CB", "#FFF1D6"],
  luna: ["#D4C8F2", "#FFE59A"],
  pip: ["#FFE59A", "#F2907A"],
  kuri: ["#EFD2B6", "#D9707E"],
  yuki: ["#DCEBFA", "#FFFFFF"],
};

/**
 * The gift reveal in a box (≈ 360 × 420 pt): the opened box on a cushion of light, its lid tipped
 * aside, light wedges, the piece floating out of it, the sender peeking from the left and a friend
 * cheering on the right, both on paper stages. Returns the name chip's box (the scene writes the
 * item's name in it) and the piece's box (tap target / VoiceOver).
 */
export function drawGiftStage(ctx: Ctx, at: Box, o: GiftStageOpts): { chip: Box; item: Box } {
  // v15 (re-review 2 #8): bigger, and centred in its box (no empty top 40 %)
  const k = Math.min(at.w / 330, at.h / 400);
  const cx = at.x + at.w / 2;
  const base = at.y + (at.h + 400 * k) / 2 - 20 * k;
  const [paper, ribbon] = o.paper && o.ribbon ? [o.paper, o.ribbon] : WRAP[o.sender];
  // the warm pool and the wedges of light from the box mouth
  glow(ctx, cx, base - 120 * k, 230 * k, "#FFD9A0", 0.2);
  const mouthY = base - 86 * k;
  rays(ctx, cx, mouthY, 220 * k, 9, "#FFE3A8", 0.2);
  // paper stages for the residents
  const lx = cx - 118 * k;
  const rx = cx + 118 * k;
  stagePad(ctx, lx, base - 4 * k, 46 * k);
  stagePad(ctx, rx, base - 2 * k, 46 * k);
  // the opened box (front projection) + its lid tipped against the right side
  const mouth = drawOpenBox(ctx, cx, base, k, paper, ribbon);
  void mouth;
  // piece floating out of the box: glow under it, the card-fit drawing, sparkles
  const item = ITEMS[o.item];
  const iw = (item.span === 2 ? 170 : 130) * k;
  const ih = 116 * k;
  const ib: Box = { x: cx - iw / 2, y: mouthY - 52 * k - ih, w: iw, h: ih };
  glow(ctx, cx, ib.y + ih * 0.7, 96 * k, T.glow, 0.5);
  const fs = furnitureScale(o.item, iw, ih, "card");
  drawFurnitureAt(ctx, o.item, o.cw, cx, ib.y + ih, fs);
  reseed(41);
  for (let i = 0; i < 7; i++) {
    const a = rnd() * Math.PI * 2;
    const r = (70 + rnd() * 70) * k;
    sparkle(ctx, cx + Math.cos(a) * r, ib.y + ih * 0.55 + Math.sin(a) * r * 0.6, (3 + rnd() * 4) * k, [T.cream, T.lemon, T.pink][i % 3]!);
  }
  // the residents: the sender peeks (shy), the friend cheers
  const friend: ResidentId = o.sender === "wick" ? "momo" : "wick";
  drawResidentAt(ctx, o.sender, "shy", lx, base - 6 * k, 76 * k * RESIDENTS[o.sender].k);
  drawResidentAt(ctx, friend, "happy", rx, base - 4 * k, 72 * k * RESIDENTS[friend].k, { arms: "up" });
  const cw = Math.min(at.w - 24 * k, 220 * k);
  const chip: Box = { x: cx - cw / 2, y: ib.y - 46 * k, w: cw, h: 34 * k };
  return { chip, item: ib };
}

/**
 * The open gift box alone (the stage uses drawGift's closed box; this is the open one): a front box with
 * a dark mouth and the light rising from it, the lid tipped against its right side.
 */
export function drawOpenBox(ctx: Ctx, cx: number, base: number, k: number, paper: string, ribbon: string): number {
  const w = 120 * k;
  const h = 84 * k;
  const top = base - h;
  contact(ctx, cx + 3 * k, base + 2 * k, w * 0.6, 9 * k, 0.45);
  ctx.save();
  // the lid, the box's own projection (a front slab a little wider than the box, square-ish corners), tossed
  // BEHIND the box to the right (re-review 3 #4: it never passes under the floating piece), its bow on top
  ctx.translate(cx + w * 0.62, top - 4 * k);
  ctx.rotate(0.34);
  const lw = w + 10 * k;
  const lh = 20 * k;
  solid(ctx, P((q) => q.roundRect(-lw / 2, -lh / 2, lw, lh, 3 * k)), mix(paper, "#FFFFFF", 0.1), { x: -lw / 2, y: -lh / 2, w: lw, h: lh }, { rim: 1.1, lit: 0.34, tex: "paper" });
  solid(ctx, P((q) => q.roundRect(-9 * k, -lh / 2, 18 * k, lh, 1.5 * k)), ribbon, { x: -9 * k, y: -lh / 2, w: 18 * k, h: lh }, { rim: 0.5, ao: 0 });
  for (const sx of [-1, 1] as const) {
    const loop = P((q) => {
      q.moveTo(0, -lh / 2);
      q.bezierCurveTo(sx * 6 * k, -lh / 2 - 16 * k, sx * 24 * k, -lh / 2 - 16 * k, sx * 20 * k, -lh / 2 - 4 * k);
      q.bezierCurveTo(sx * 16 * k, -lh / 2, sx * 6 * k, -lh / 2, 0, -lh / 2);
      q.closePath();
    });
    solid(ctx, loop, ribbon, { x: sx < 0 ? -24 * k : 0, y: -lh / 2 - 16 * k, w: 24 * k, h: 16 * k }, { rim: 0.6, lit: 0.36, ao: 0.08 });
  }
  ctx.restore();
  const body = P((q) => q.roundRect(cx - w / 2, top, w, h, 8 * k));
  solid(ctx, body, paper, { x: cx - w / 2, y: top, w, h }, { rim: 1.6, lit: 0.3, tex: "paper" });
  solid(ctx, P((q) => q.roundRect(cx - 9 * k, top, 18 * k, h, 2 * k)), ribbon, { x: cx - 9 * k, y: top, w: 18 * k, h }, { rim: 0.6, lit: 0.3, ao: 0.1 });
  // the open mouth (front projection: a dark band) and its light
  solid(ctx, P((q) => q.roundRect(cx - w / 2 + 4 * k, top - 5 * k, w - 8 * k, 9 * k, 4 * k)), mix(paper, T.plum, 0.55), { x: cx - w / 2, y: top - 5 * k, w, h: 9 * k }, { rim: 0, ao: 0, line: false });
  glow(ctx, cx, top - 2 * k, 70 * k, T.glow, 0.55, 0.5);
  // the inner light on the box front (gradient from the top edge — no hairline)
  ctx.save();
  ctx.clip(body);
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createLinearGradient(0, top, 0, top + h * 0.4);
  g.addColorStop(0, hexA(T.glow, 0.4));
  g.addColorStop(1, hexA(T.glow, 0));
  ctx.fillStyle = g;
  ctx.fillRect(cx - w / 2, top, w, h * 0.4);
  ctx.restore();
  // the lid, tipped against the right side (same projection: a slab with its ribbon and bow)
  return top;
}

// ---------------------------------------------------------------- the letter

export interface LetterStageOpts {
  /** text lines of the body (the signature is separate) */
  n: number;
  fontPx: number;
  who: ResidentId;
  accent: string;
}

/**
 * The letter in a box: the opened envelope behind (its flap up, the wax seal on it), the upright paper
 * centred, the sender leaning on the paper's lower left (72 pt), the signature on its OWN last line.
 * Returns the paper, its lines (n body lines + 1 signature line) and the signature's baseline + right edge.
 */
export function drawLetterStage(ctx: Ctx, at: Box, o: LetterStageOpts): { paper: Box; lines: LetterLines; sign: { x: number; y: number } } {
  const pw = at.w;
  const n = o.n + 1;
  const ph = letterHeight(pw, n, o.fontPx);
  const envH = pw * 0.36;
  const total = envH * 0.55 + ph;
  const top = at.y + Math.max(0, (at.h - total) / 2);
  const px = at.x + (at.w - pw) / 2;
  const py = top + envH * 0.55;
  // the envelope behind the paper, its flap open upwards
  const ew = pw * 0.86;
  const ex = at.x + (at.w - ew) / 2;
  const ey = py - envH * 0.5;
  const env = P((q) => q.roundRect(ex, ey, ew, envH + ph * 0.6, 12));
  solid(ctx, env, mix(o.accent, "#FFF3DE", 0.45), { x: ex, y: ey, w: ew, h: envH + ph * 0.6 }, { rim: 1.4, lit: 0.25, tex: "paper" });
  const flap = P((q) => {
    q.moveTo(ex + 4, ey + 4);
    q.lineTo(ex + ew / 2, ey - envH * 0.55);
    q.lineTo(ex + ew - 4, ey + 4);
    q.closePath();
  });
  solid(ctx, flap, mix(o.accent, "#FFF3DE", 0.6), { x: ex, y: ey - envH * 0.55, w: ew, h: envH * 0.55 }, { rim: 1.2, lit: 0.3, tex: "paper" });
  // the letter paper (the kit's ruled paper) and its seal
  const paper = { x: px, y: py, w: pw, h: ph };
  // (drawn by the scene via drawLetterPaper so its fonts / lines match; here only the frame around it)
  const lines = letterLines(paper, n, o.fontPx);
  // the wax seal on the envelope flap's tip
  drawEnvelopeSeal(ctx, ex + ew / 2, ey - envH * 0.08, Math.max(12, pw * 0.05), o.accent);
  const sign = { x: lines.x1, y: lines.baselines[n - 1]! };
  return { paper, lines, sign };
}

/** The sender leaning on the paper's lower-left corner (drawn AFTER the paper). */
export function drawLetterSender(ctx: Ctx, paper: Box, who: ResidentId, size = 72): void {
  drawResidentAt(ctx, who, "shy", paper.x + size * 0.18, paper.y + paper.h + size * 0.06, size, { glow: false });
}

function drawEnvelopeSeal(ctx: Ctx, x: number, y: number, r: number, col: string): void {
  const wax = P((q) => {
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const rr = r * (1 + Math.sin(i * 2.7) * 0.07 + (i % 6 === 0 ? 0.11 : 0));
      if (i) q.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      else q.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    q.closePath();
  });
  solid(ctx, wax, mix(col, "#C0405A", 0.35), { x: x - r, y: y - r, w: r * 2, h: r * 2 }, { rim: r * 0.1, lit: 0.4 });
  ctx.fillStyle = hexA(T.plum, 0.18);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.62, 0, Math.PI * 2);
  ctx.fill();
  // a pressed petal flower
  ctx.fillStyle = hexA("#FFE3EA", 0.85);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * r * 0.26, y + Math.sin(a) * r * 0.26, r * 0.2, r * 0.14, a, 0, Math.PI * 2);
    ctx.fill();
  }
}

export { drawEnvelope };
