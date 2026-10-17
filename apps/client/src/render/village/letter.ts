// Letters and gifts (1.0): the letter paper (upright — the text sits ON its ruled lines), the envelope with
// a wax seal, the gift box (front projection, lid included), a light-ray rim as an inner gradient (no
// hairlines, Reality #6), and the emote bubble anchored to a resident's head (Reality #11).
// No text here: the village scene lays the words out (src/village/wrap.ts) on letterLines()'s baselines.
import type { Ctx } from "../draw.ts";
import { contact, glow, hexA, mix, P, rrect, solid, T, texture, type Box } from "./shade.ts";

// ---------------------------------------------------------------- the letter paper

export interface LetterLines {
  /** baselines (canvas px), one per line of text — exactly the lines the text needs (+ ≤ 1 blank, #8) */
  baselines: number[];
  x0: number;
  x1: number;
  /** line pitch px */
  pitch: number;
}

/**
 * Ruled lines for `n` lines of text in a paper box: margins 9 % / 11 %, pitch = font px × 1.55.
 * The paper's height follows: letterHeight() gives the box height for n lines.
 */
export function letterLines(at: Box, n: number, fontPx: number): LetterLines {
  const pitch = Math.round(fontPx * 1.55);
  const top = at.y + Math.max(pitch * 1.25, at.w * 0.1);
  const baselines: number[] = [];
  for (let i = 0; i < n; i++) baselines.push(Math.round(top + pitch * (i + 0.78)));
  return { baselines, x0: at.x + at.w * 0.09, x1: at.x + at.w * 0.91, pitch };
}
/** Paper height for n text lines (+ the signature line) at a font size — no more than one blank line. */
export function letterHeight(w: number, n: number, fontPx: number): number {
  const pitch = Math.round(fontPx * 1.55);
  return Math.round(Math.max(pitch * 1.25, w * 0.1) + pitch * (n + 0.6) + Math.max(pitch * 0.7, w * 0.05));
}

/** The letter paper (upright, deckled cream, ruled for n lines), a pressed flower in the corner. */
export function drawLetterPaper(ctx: Ctx, at: Box, n: number, fontPx: number, accent: string = T.pink): void {
  const { x, y, w, h } = at;
  contact(ctx, x + w / 2 + 3, y + h + 2, w * 0.48, 8, 0.4);
  const r = Math.min(10, w * 0.03);
  const paper = P((q) => {
    // a softly deckled edge: tiny scallops on the top and bottom
    q.moveTo(x + r, y);
    const n2 = Math.max(6, Math.round(w / 22));
    for (let i = 0; i < n2; i++) q.quadraticCurveTo(x + r + ((w - 2 * r) * (i + 0.5)) / n2, y - 1.6, x + r + ((w - 2 * r) * (i + 1)) / n2, y);
    q.quadraticCurveTo(x + w, y, x + w, y + r);
    q.lineTo(x + w, y + h - r);
    q.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    for (let i = 0; i < n2; i++) q.quadraticCurveTo(x + w - r - ((w - 2 * r) * (i + 0.5)) / n2, y + h + 1.6, x + w - r - ((w - 2 * r) * (i + 1)) / n2, y + h);
    q.quadraticCurveTo(x, y + h, x, y + h - r);
    q.lineTo(x, y + r);
    q.quadraticCurveTo(x, y, x + r, y);
    q.closePath();
  });
  solid(ctx, paper, "#FFF6E6", at, { rim: 2, lit: 0.18, shade: 0.16, ao: 0.08, tex: "paper", texA: 0.3 });
  const L = letterLines(at, n, fontPx);
  // ruled lines: soft value bands (≥ 1 pt), the text's baseline sits on the band's top edge
  ctx.fillStyle = hexA("#C9A6B4", 0.42);
  for (const b of L.baselines) ctx.fillRect(L.x0, b + 1, L.x1 - L.x0, Math.max(1, fontPx * 0.07));
  // a pressed flower (top right) in the sender's accent
  const fx = x + w - w * 0.1;
  const fy = y + Math.max(fontPx * 1.1, w * 0.07);
  const fr = Math.max(3, fontPx * 0.32);
  ctx.save();
  ctx.globalAlpha = 0.85;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - 1.2;
    const pe = P((q) => q.ellipse(fx + Math.cos(a) * fr * 0.8, fy + Math.sin(a) * fr * 0.8, fr * 0.6, fr * 0.4, a, 0, 6.3));
    solid(ctx, pe, accent, { x: fx - fr * 1.4, y: fy - fr * 1.4, w: fr * 2.8, h: fr * 2.8 }, { rim: 0, ao: 0, line: false });
  }
  ctx.fillStyle = T.lemon;
  ctx.beginPath();
  ctx.arc(fx, fy, fr * 0.36, 0, 6.3);
  ctx.fill();
  ctx.restore();
}

/** The envelope (closed, seal in the resident's colour) in a box, bottom-centred. */
export function drawEnvelope(ctx: Ctx, at: Box, seal: string = T.coral): void {
  const w = Math.min(at.w, at.h * 1.5);
  const h = w / 1.5;
  const x = at.x + (at.w - w) / 2;
  const y = at.y + at.h - h;
  contact(ctx, x + w / 2 + 2, y + h + 1, w * 0.48, h * 0.08, 0.4);
  const body = rrect(x, y, w, h, w * 0.04);
  solid(ctx, body, "#FFF1DC", { x, y, w, h }, { rim: Math.max(1, w * 0.012), lit: 0.22, tex: "paper", texA: 0.28 });
  // the flaps as value shapes
  ctx.save();
  ctx.clip(body);
  ctx.fillStyle = hexA("#E9CFAE", 0.55);
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x + w / 2, y + h * 0.5);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  const flap = P((q) => {
    q.moveTo(x + w * 0.02, y + h * 0.04);
    q.lineTo(x + w / 2, y + h * 0.58);
    q.lineTo(x + w * 0.98, y + h * 0.04);
    q.closePath();
  });
  solid(ctx, flap, "#FBE6C8", { x, y, w, h: h * 0.58 }, { rim: Math.max(0.8, w * 0.008), lit: 0.3, ao: 0 });
  // the wax seal: a scalloped disc + a heart pressed in
  const sx = x + w / 2;
  const sy = y + h * 0.56;
  const sr = w * 0.085;
  const wax = P((q) => {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const rr = sr * (i % 2 ? 0.92 : 1.04);
      if (i === 0) q.moveTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr);
      else q.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr);
    }
    q.closePath();
  });
  solid(ctx, wax, seal, { x: sx - sr, y: sy - sr, w: sr * 2, h: sr * 2 }, { rim: sr * 0.12, lit: 0.4 });
  heartPath(ctx, sx, sy + sr * 0.05, sr * 0.48);
  ctx.fillStyle = hexA(mix(seal, T.plum, 0.4), 0.55);
  ctx.fill();
}

function heartPath(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.8);
  ctx.bezierCurveTo(x - r * 1.3, y - r * 0.1, x - r * 0.6, y - r * 1.1, x, y - r * 0.45);
  ctx.bezierCurveTo(x + r * 0.6, y - r * 1.1, x + r * 1.3, y - r * 0.1, x, y + r * 0.8);
  ctx.closePath();
}

// ---------------------------------------------------------------- the gift box

/** A warm light on a shape's upper edge, painted INSIDE it as a gradient (no hairline), Reality #6. */
export function rimLight(ctx: Ctx, path: Path2D, box: Box, a = 0.55, col: string = T.glow): void {
  ctx.save();
  ctx.clip(path);
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createLinearGradient(0, box.y, 0, box.y + box.h * 0.38);
  g.addColorStop(0, hexA(col, a));
  g.addColorStop(1, hexA(col, 0));
  ctx.fillStyle = g;
  ctx.fillRect(box.x, box.y, box.w, box.h * 0.4);
  ctx.restore();
}

export interface GiftOpts {
  /** paper colour and ribbon colour */
  paper?: string;
  ribbon?: string;
  /** 0 = closed … 1 = lid lifted off (the reveal) */
  open?: number;
  /** the light from inside when open (rays are the scene's, the rim is here) */
  glowA?: number;
}
/** The gift box, front projection like every object (the lid too), bottom-centred in the box. */
export function drawGift(ctx: Ctx, at: Box, o: GiftOpts = {}): void {
  const paper = o.paper ?? T.mint;
  const ribbon = o.ribbon ?? T.coral;
  const open = Math.max(0, Math.min(1, o.open ?? 0));
  // the box is 40 units wide, 30 tall; the lid 44 × 9; the bow 14 tall: 40 + lift
  const unitsH = 30 + 9 + 14 + open * 24;
  const s = Math.min(at.w / 48, at.h / unitsH);
  ctx.save();
  ctx.translate(at.x + at.w / 2, at.y + at.h);
  ctx.scale(s, s);
  contact(ctx, 2, 0, 24, 3.4, 0.45);
  if (open > 0) glow(ctx, 0, -30, 34, T.glow, 0.5 * open * (o.glowA ?? 1));
  const body = rrect(-20, -30, 40, 30, 3);
  solid(ctx, body, paper, { x: -20, y: -30, w: 40, h: 30 }, { rim: 1.2, lit: 0.32, tex: "paper" });
  // ribbon band (front), joined to the lid's band
  const band = rrect(-3.4, -30, 6.8, 30, 1);
  solid(ctx, band, ribbon, { x: -3.4, y: -30, w: 6.8, h: 30 }, { rim: 0.6, lit: 0.3, ao: 0.1 });
  if (open > 0) {
    // the open top: a dark mouth with the warm light rising from inside
    const mouth = rrect(-18, -31.5, 36, 3.2, 1.4);
    ctx.fillStyle = mix(paper, T.plum, 0.55);
    ctx.fill(mouth);
    rimLight(ctx, body, { x: -20, y: -30, w: 40, h: 30 }, 0.45 * open);
  }
  // the lid: lifted and tipped a little when opening (same projection: a front slab with a sliver of top)
  ctx.save();
  ctx.translate(open * 6, -open * 24);
  ctx.rotate(open * 0.16);
  const lid = rrect(-22, -38, 44, 9, 2.6);
  solid(ctx, lid, mix(paper, "#FFFFFF", 0.1), { x: -22, y: -38, w: 44, h: 9 }, { rim: 1, lit: 0.36, tex: "paper" });
  solid(ctx, rrect(-3.6, -38, 7.2, 9, 1), ribbon, { x: -3.6, y: -38, w: 7.2, h: 9 }, { rim: 0.5, lit: 0.3, ao: 0 });
  // the bow: two loops + a knot + two tails (one body, the ribbon's colour, not grey)
  for (const sx of [-1, 1] as const) {
    const loop = P((q) => {
      q.moveTo(0, -38.5);
      q.bezierCurveTo(sx * 4, -49, sx * 15, -50, sx * 13, -42.5);
      q.bezierCurveTo(sx * 12, -39, sx * 5, -38.5, 0, -38.5);
      q.closePath();
    });
    solid(ctx, loop, ribbon, { x: sx < 0 ? -15 : 0, y: -50, w: 15, h: 11.5 }, { rim: 0.8, lit: 0.38, ao: 0.1 });
    const tail = P((q) => {
      q.moveTo(sx * 1, -38);
      q.lineTo(sx * 7.5, -31.5);
      q.lineTo(sx * 5.2, -30.6);
      q.lineTo(sx * 0.2, -36.4);
      q.closePath();
    });
    solid(ctx, tail, mix(ribbon, T.plum, 0.12), { x: sx < 0 ? -7.5 : 0, y: -38, w: 7.5, h: 7.4 }, { rim: 0.4, ao: 0 });
  }
  solid(ctx, rrect(-3, -42, 6, 5, 2.2), mix(ribbon, "#FFFFFF", 0.12), { x: -3, y: -42, w: 6, h: 5 }, { rim: 0.4, ao: 0 });
  if (open > 0) rimLight(ctx, lid, { x: -22, y: -38, w: 44, h: 9 }, 0.35 * open);
  ctx.restore();
  ctx.restore();
}

/** A soft cushion the gift rests on (front projection), its top lit from the gift's light as a gradient. */
export function drawGiftCushion(ctx: Ctx, at: Box, col: string = T.pink, lightA = 0.5): void {
  const s = Math.min(at.w / 70, at.h / 18);
  ctx.save();
  ctx.translate(at.x + at.w / 2, at.y + at.h);
  ctx.scale(s, s);
  contact(ctx, 2, 0, 34, 4, 0.45);
  const p = P((q) => {
    q.moveTo(-32, -3);
    q.quadraticCurveTo(-35, -10, -30, -14);
    q.quadraticCurveTo(0, -17.5, 30, -14);
    q.quadraticCurveTo(35, -10, 32, -3);
    q.quadraticCurveTo(0, 0.5, -32, -3);
    q.closePath();
  });
  const box = { x: -35, y: -17.5, w: 70, h: 17.5 };
  solid(ctx, p, col, box, { rim: 1.4, lit: 0.32, tex: "cloth" });
  rimLight(ctx, p, box, lightA);
  ctx.restore();
}

// ---------------------------------------------------------------- the emote bubble

export type Emote = "heart" | "note" | "star" | "zzz";

/**
 * An emote bubble whose tail TOUCHES the head at (hx, hy) (a resident's body top, see residentHead()):
 * the bubble sits up and to the LEFT (the flame floats right), r = bubble radius px.
 */
export function drawEmote(ctx: Ctx, hx: number, hy: number, r: number, icon: Emote, col: string = "#E58C9E"): void {
  const bx = hx - r * 0.9;
  const by = hy - r * 1.9;
  ctx.save();
  ctx.shadowColor = hexA(T.plum, 0.4);
  ctx.shadowBlur = r * 0.6;
  ctx.shadowOffsetY = r * 0.08;
  const bubble = P((q) => {
    q.arc(bx, by, r, 0, Math.PI * 2);
    // a tail from the bubble's lower right to the head
    q.moveTo(bx + r * 0.2, by + r * 0.9);
    q.quadraticCurveTo(bx + r * 0.55, by + r * 1.25, hx, hy);
    q.quadraticCurveTo(bx + r * 0.75, by + r * 0.9, bx + r * 0.72, by + r * 0.66);
    q.closePath();
  });
  ctx.fillStyle = "#FFF8EC";
  ctx.fill(bubble);
  ctx.restore();
  texture(ctx, bubble, { x: bx - r, y: by - r, w: r * 2, h: r * 2 }, "paper", 0.12);
  const s = r * 0.62;
  ctx.save();
  ctx.translate(bx, by + r * 0.04);
  if (icon === "heart") {
    heartPath(ctx, 0, 0, s * 0.75);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.fillStyle = hexA("#FFFFFF", 0.55);
    ctx.beginPath();
    ctx.ellipse(-s * 0.32, -s * 0.28, s * 0.14, s * 0.1, -0.6, 0, 6.3);
    ctx.fill();
  } else if (icon === "star") {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 ? s * 0.38 : s * 0.82;
      if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = T.amber;
    ctx.fill();
  } else if (icon === "note") {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(-s * 0.25, s * 0.42, s * 0.3, s * 0.22, -0.4, 0, 6.3);
    ctx.fill();
    ctx.fillRect(s * 0.0, -s * 0.62, s * 0.14, s * 1.05);
    ctx.beginPath();
    ctx.moveTo(s * 0.14, -s * 0.62);
    ctx.quadraticCurveTo(s * 0.62, -s * 0.4, s * 0.48, -s * 0.05);
    ctx.lineTo(s * 0.14, -s * 0.3);
    ctx.closePath();
    ctx.fill();
  } else {
    // a drawn "z" (no text in the kit)
    ctx.strokeStyle = T.inkSoft;
    ctx.lineWidth = s * 0.16;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(-s * 0.4, -s * 0.4);
    ctx.lineTo(s * 0.4, -s * 0.4);
    ctx.lineTo(-s * 0.4, s * 0.4);
    ctx.lineTo(s * 0.4, s * 0.4);
    ctx.stroke();
  }
  ctx.restore();
}
