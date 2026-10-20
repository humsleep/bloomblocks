// Canvas2D painters for everything that ends up in a cached texture. They run
// once per (texture, size) — never per frame — so gradients and a one-off
// shadowBlur for soft light bleed are fine here.
import { PAL, UI, hex, rgba } from "./palette.ts";
import { vis } from "./vis.ts";
import { drawMarkerStone, NUM_FACE_Y, stampSlab } from "./court.ts";
import { strokeNumerals, drawNumerals } from "./glyphs.ts";
import { drawFramedLantern, type SkinId, strokeLanternOutline } from "./lantern.ts";

export type Ctx = CanvasRenderingContext2D;
export type Rnd = () => number;

const TAU = Math.PI * 2;

export function mix(a: string, b: string, t: number): string {
  const x = hex(a);
  const y = hex(b);
  const ch = (s: number): number => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

export function rrectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Closed smooth blob through `pts` (x,y pairs), quadratic through midpoints. */
function blobPath(ctx: Ctx, pts: number[]): void {
  const n = pts.length / 2;
  ctx.beginPath();
  const mx = (i: number): number => (pts[(i % n) * 2]! + pts[((i + 1) % n) * 2]!) / 2;
  const my = (i: number): number => (pts[(i % n) * 2 + 1]! + pts[((i + 1) % n) * 2 + 1]!) / 2;
  ctx.moveTo(mx(n - 1), my(n - 1));
  for (let i = 0; i < n; i++) ctx.quadraticCurveTo(pts[i * 2]!, pts[i * 2 + 1]!, mx(i), my(i));
  ctx.closePath();
}

function rockPoints(cx: number, cy: number, r: number, rnd: Rnd, squash = 0.86): number[] {
  const n = 9;
  const rot = rnd() * TAU;
  const pts: number[] = [];
  for (let k = 0; k < n; k++) {
    const a = rot + (k / n) * TAU;
    const rr = r * (0.84 + 0.16 * rnd());
    pts.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * squash);
  }
  return pts;
}

/**
 * A rounded, mossy courtyard rock. Reads as "raised and solid" in grayscale:
 * light top face, dark underside, cast shadow, crisp outline.
 */
export function drawRock(ctx: Ctx, cx: number, cy: number, r: number, rnd: Rnd, moss = true, pale = false): void {
  const pts = rockPoints(cx, cy, r, rnd);
  // cast shadow
  ctx.save();
  ctx.translate(r * 0.04, r * 0.2);
  blobPath(ctx, pts);
  ctx.fillStyle = "rgba(4,5,14,0.6)";
  ctx.fill();
  ctx.restore();
  // body
  const g = ctx.createLinearGradient(cx - r * 0.5, cy - r * 0.85, cx + r * 0.35, cy + r * 0.9);
  g.addColorStop(0, pale ? PAL.paleHi : PAL.stoneHi);
  g.addColorStop(0.45, pale ? PAL.pale : PAL.stone);
  g.addColorStop(1, pale ? PAL.paleLo : PAL.stoneLo);
  blobPath(ctx, pts);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  blobPath(ctx, pts);
  ctx.clip();
  // underside occlusion
  const u = ctx.createLinearGradient(0, cy + r * 0.2, 0, cy + r);
  u.addColorStop(0, "rgba(10,10,28,0)");
  u.addColorStop(1, "rgba(10,10,28,0.45)");
  ctx.fillStyle = u;
  ctx.fillRect(cx - r * 1.2, cy - r, r * 2.4, r * 2.2);
  if (moss) {
    const blobs = 3 + Math.floor(rnd() * 2);
    for (let k = 0; k < blobs; k++) {
      const bx = cx + (rnd() - 0.5) * r * 1.3;
      const by = cy - r * (0.45 + rnd() * 0.45);
      const br = r * (0.28 + rnd() * 0.22);
      const mg = ctx.createRadialGradient(bx - br * 0.3, by - br * 0.4, br * 0.1, bx, by, br);
      mg.addColorStop(0, PAL.mossHi);
      mg.addColorStop(0.7, PAL.moss);
      mg.addColorStop(1, rgba(PAL.moss, 0));
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.ellipse(bx, by, br * 1.25, br * 0.85, 0, 0, TAU);
      ctx.fill();
    }
  }
  // specular
  const s = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.45, 0, cx - r * 0.35, cy - r * 0.45, r * 0.7);
  s.addColorStop(0, "rgba(255,250,235,0.28)");
  s.addColorStop(1, "rgba(255,250,235,0)");
  ctx.fillStyle = s;
  ctx.fillRect(cx - r * 1.2, cy - r * 1.2, r * 2.4, r * 2.4);
  ctx.restore();
  blobPath(ctx, pts);
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.strokeStyle = "rgba(6,6,18,0.75)";
  ctx.stroke();
}

/** Dice layouts for 0–4 pips, in units of the pip spacing (0 = an empty ring). */
export const PIP_LAYOUTS: readonly (readonly (readonly [number, number])[])[] = [
  [],
  [[0, 0]],
  [[-1, -1], [1, 1]],
  [[-1, -1], [0, 0], [1, 1]],
  [[-1, -1], [1, -1], [-1, 1], [1, 1]],
];

/** Pip geometry for a cell of `cs` px (shared by the baked inlay and the pip overlays). */
export function pipGeom(cs: number): { inlay: number; d: number; pr: number; oy: number } {
  return { inlay: cs * 0.3, d: cs * 0.14, pr: cs * 0.08, oy: NUM_FACE_Y * cs };
}

/**
 * Numbered stone (pips rules): a pale, dice-white rock — the lightest thing on
 * the dark courtyard after a lit tile, so it separates from the floor even in
 * grayscale. No moss on it (v3's moss tuft was counted as a pip); plain rocks
 * keep theirs. The number itself is an overlay sprite (drawDigit / drawPips)
 * so it can turn gold / moonlit and pulse.
 */
export function drawNumberedRock(ctx: Ctx, cx: number, cy: number, cs: number, rnd: Rnd): void {
  drawMarkerStone(ctx, cx, cy, cs, rnd);
}

/** Rounded system digits (SF Pro Rounded on iOS); system fonts need no load on the cold-start path. */
export const DIGIT_FONT = 'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", system-ui, -apple-system, sans-serif';

/**
 * The number of a numbered stone as a big rounded digit, centred at (cx, cy)
 * for a cell of `cs` px (cap height ≈ 0.43 cs: 19 pt on a 44 pt cell).
 * "ink" = neutral (engraved near-black on the pale rock, ≈ 8:1),
 * "warm" = satisfied (v11: the ink digit inside a lantern-gold ring + warm glow — never a gold digit),
 * "over" = too many (warm coral with a dark rim, on the dimmed rock; an overflow
 * chevron mark rides above it as its own sprite).
 */
export function drawDigit(ctx: Ctx, cx: number, cy: number, cs: number, n: number, tone: NumTone): void {
  // v9: the carved Duskwick numeral (src/render/glyphs.ts), cap height 0.43 cell
  const h = cs * 0.43;
  const t = String(n);
  const wt = vis.p.boldText ? 1.22 : 1;
  const hc = vis.p.boldText || vis.p.increaseContrast;
  if (tone === "ink") {
    // engraved: light lip below, the dark groove, a faint lighter floor inside the groove
    strokeNumerals(ctx, t, cx, cy, h, [
      { style: "rgba(255,252,240,0.75)", dy: cs * 0.016, widthK: 1.05 },
      { style: PAL.pipInk },
      { style: "rgba(70,76,112,0.55)", dy: cs * 0.008, widthK: 0.42 },
    ], wt);
    return;
  }
  if (tone === "warm") {
    // v11 (BENCHMARK-CUTE §3.4): satisfied keeps the INK digit (≈ 8:1 on the pale stone — the old
    // gold digit read ≈ 1.5:1) inside a warm lantern-light ring + a soft glow on the stone face
    drawOkRing(ctx, cx, cy, cs);
    strokeNumerals(ctx, t, cx, cy, h, [
      { style: "rgba(255,252,240,0.8)", dy: cs * 0.016, widthK: 1.05 },
      { style: PAL.pipInk },
    ], wt * (hc ? 1.08 : 1));
    return;
  }
  // over: the groove fills coral (the rock is dimmed by its veil underneath)
  drawGlow(ctx, cx, cy, cs * 0.42, [[0, "rgba(242,144,122,0.4)"], [0.6, "rgba(242,144,122,0.14)"], [1, "rgba(242,144,122,0)"]]);
  const g = ctx.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
  g.addColorStop(0, PAL.coralHi);
  g.addColorStop(0.5, PAL.coral);
  g.addColorStop(1, "#E06A50");
  strokeNumerals(ctx, t, cx, cy, h, [
    { style: "rgba(40,8,4,0.95)", widthK: hc ? 1.55 : 1.42 },
    { style: g, widthK: 0.86 },
  ], wt);
}

/** Satisfied number: a warm glow on the stone face and a lantern-gold ring with a dark edge around the digit. */
function drawOkRing(ctx: Ctx, cx: number, cy: number, cs: number): void {
  // (the number texture is 0.8 cs square: the glow fades out inside it)
  drawGlow(ctx, cx, cy, cs * 0.4, [[0, "rgba(255,214,140,0.55)"], [0.6, "rgba(255,190,100,0.25)"], [1, "rgba(255,170,80,0)"]]);
  const r = cs * 0.33;
  const hc = vis.p.increaseContrast || vis.p.boldText;
  ctx.lineWidth = cs * (hc ? 0.085 : 0.07);
  ctx.strokeStyle = UI.okRingEdge;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = cs * (hc ? 0.055 : 0.045);
  ctx.strokeStyle = UI.okRing;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.stroke();
}

/**
 * The pips of a numbered stone, centred at (cx, cy) for a cell of `cs` px.
 * tone "ink" = neutral (dark dice pips on the pale rock, ~6:1),
 * "warm" = satisfied (amber pips with a dark rim + glow), "over" = too many
 * (coral pips on the dimmed rock).
 */
export function drawPips(ctx: Ctx, cx: number, cy: number, cs: number, n: number, tone: NumTone): void {
  const { d, pr } = pipGeom(cs);
  // v11: satisfied pips stay ink (contrast) inside the warm ring, like the digits
  const core = tone === "over" ? PAL.coral : PAL.pipInk;
  const edge = tone === "over" ? PAL.coralDeep : PAL.pipInk;
  if (tone === "warm") drawOkRing(ctx, cx, cy, cs);
  const rim = (x: number, y: number, rr: number): void => {
    if (tone !== "over") return;
    ctx.fillStyle = "rgba(40,8,4,0.9)";
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, TAU);
    ctx.fill();
  };
  if (n === 0) {
    const rr = d * 1.05;
    const lw = pr * 0.7;
    if (tone === "over") {
      ctx.strokeStyle = "rgba(40,8,4,0.9)";
      ctx.lineWidth = lw * 1.8;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, TAU);
      ctx.stroke();
    }
    ctx.strokeStyle = core;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, TAU);
    ctx.stroke();
    return;
  }
  for (const [px, py] of PIP_LAYOUTS[Math.max(0, Math.min(4, n))]!) {
    const x = cx + px * d;
    const y = cy + py * d;
    rim(x, y, pr * 1.2);
    if (tone !== "over") {
      // recessed dice pip: dark fill, faint light lip at the bottom
      ctx.fillStyle = "rgba(255,252,240,0.45)";
      ctx.beginPath();
      ctx.arc(x, y + pr * 0.14, pr, 0, TAU);
      ctx.fill();
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(x, y, pr, 0, TAU);
      ctx.fill();
      continue;
    }
    const g = ctx.createRadialGradient(x - pr * 0.3, y - pr * 0.35, 0, x, y, pr);
    g.addColorStop(0, "#FFFFFF");
    g.addColorStop(0.55, core);
    g.addColorStop(1, edge);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, pr, 0, TAU);
    ctx.fill();
  }
}

export type NumTone = "ink" | "warm" | "over";

/** "Too many lanterns" veil: the numbered boulder dims (dark in grayscale), a warm coral edge rims it. */
export function drawStoneVeil(ctx: Ctx, cx: number, cy: number, cs: number, lw: number): void {
  const rx = cs * 0.45;
  const ry = rx * 0.86;
  ctx.fillStyle = "rgba(24,10,16,0.62)";
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.shadowColor = rgba(PAL.coral, 0.9);
  ctx.shadowBlur = lw * 3;
  ctx.strokeStyle = rgba(PAL.coralHi, 0.95);
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx + lw * 0.5, ry + lw * 0.5, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

/** "Can no longer be satisfied": a subtle cool outline around the rock. */
export function drawStoneOutline(ctx: Ctx, cx: number, cy: number, cs: number, lw: number): void {
  const rx = cs * 0.47;
  ctx.setLineDash([lw * 2.2, lw * 1.6]);
  ctx.strokeStyle = rgba(PAL.conflict, 0.85);
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, rx * 0.9, 0, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Dead cell (can no longer be lit): faint cool wash + a diagonal sheen; the scene animates its alpha. */
export function drawDeadTile(ctx: Ctx, cx: number, cy: number, s: number, r: number, lw: number): void {
  const x = cx - s / 2;
  const y = cy - s / 2;
  ctx.save();
  rrectPath(ctx, x, y, s, s, r);
  ctx.clip();
  ctx.fillStyle = rgba(PAL.conflict, 0.16);
  ctx.fillRect(x, y, s, s);
  const g = ctx.createLinearGradient(x, y + s, x + s, y);
  g.addColorStop(0.3, rgba("#DCEBFA", 0));
  g.addColorStop(0.5, rgba("#DCEBFA", 0.32));
  g.addColorStop(0.7, rgba("#DCEBFA", 0));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, s, s);
  ctx.restore();
  rrectPath(ctx, x + lw, y + lw, s - lw * 2, s - lw * 2, r);
  ctx.strokeStyle = rgba(PAL.conflict, 0.7);
  ctx.lineWidth = lw;
  ctx.setLineDash([lw * 2.5, lw * 2]);
  ctx.stroke();
  ctx.setLineDash([]);
}

/**
 * Hint "a lantern belongs here": the real lantern shape washed in moonlight
 * (so it reads as "a lantern", not a symbol) with a bright outline and a dark
 * under-stroke — v4 is stronger than v3's dashed outline and reads on dark and
 * lit tiles alike. Same proportions as drawLantern.
 */
export function drawGhostLantern(ctx: Ctx, h: number): void {
  const cx = h * 0.4;
  const cy = h * 0.56;
  const rx = h * 0.35;
  const ry = h * 0.32;
  const lw = Math.max(2, h * 0.05);
  drawGlow(ctx, cx, cy, Math.min(cx, rx * 1.15), [[0, rgba("#FFFFFF", 0.55)], [0.6, rgba(PAL.moon, 0.25)], [1, rgba(PAL.moon, 0)]]);
  strokeLanternOutline(ctx, h, lw * 2.2, "rgba(14,20,48,0.65)");
  // the lantern itself, then a moonlight wash over exactly its pixels
  const off = document.createElement("canvas");
  off.width = Math.ceil(h * 0.8);
  off.height = Math.ceil(h);
  const o = off.getContext("2d")!;
  drawLantern(o, h, 0.7);
  o.globalCompositeOperation = "source-atop";
  o.fillStyle = "rgba(226,238,252,0.62)";
  o.fillRect(0, 0, off.width, off.height);
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.drawImage(off, 0, 0);
  ctx.restore();
  strokeLanternOutline(ctx, h, lw, "#F7FBFF");
}

/**
 * The dark disc behind every HUD button (44 pt targets read as buttons on any background).
 * Increase Contrast: a near-opaque disc and a solid rim.
 */
export function drawHudDisc(ctx: Ctx, s: number, rim: string = PAL.moon, rimA = 0.35, lwK = 0.031): void {
  // R2 HUD grammar (docs/team/r1-critique-visual.md (b)): ONE disc for every HUD button — fill
  // rgba(30,26,61,.72), a 1.5 pt cream rim at 35 % (at a 48 pt disc); the emphasis state ("tap this
  // now") keeps the disc and only turns the rim amber 2 pt (drawHudDiscEmph). Glyphs are cream round strokes.
  const hc = vis.p.increaseContrast;
  ctx.fillStyle = hc ? "rgba(10,9,26,0.94)" : "rgba(30,26,61,0.72)";
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s * 0.48, 0, TAU);
  ctx.fill();
  if (!hc) {
    // v14 (the mock's glass disc, Reality G1 #24): a soft top light, a touch darker at the bottom
    const hl = ctx.createLinearGradient(0, s * 0.02, 0, s * 0.98);
    hl.addColorStop(0, "rgba(255,243,222,0.16)");
    hl.addColorStop(0.5, "rgba(255,243,222,0.02)");
    hl.addColorStop(1, "rgba(0,0,0,0.12)");
    ctx.fillStyle = hl;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.48, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = rgba(rim, hc ? 1 : Math.max(rimA, rim === PAL.moon ? 0.35 : rimA));
  ctx.lineWidth = Math.max(1, s * (hc ? lwK * 1.4 : lwK));
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s * 0.48 - ctx.lineWidth / 2, 0, TAU);
  ctx.stroke();
}

/** "Something new here": a calm amber dot on the disc's upper right (no count, never red — the HUD grammar). */
export function drawNewDot(ctx: Ctx, s: number): void {
  const x = s * 0.82;
  const y = s * 0.18;
  const r = s * 0.1;
  drawGlow(ctx, x, y, r * 1.9, [[0, "rgba(255,200,100,0.45)"], [1, "rgba(255,200,100,0)"]]);
  ctx.fillStyle = "#FFC864";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.lineWidth = Math.max(1, s * 0.032);
  ctx.strokeStyle = "#191838";
  ctx.stroke();
}

/** The emphasis state of the HUD disc: the same disc, its rim amber 2 pt (at 48 pt). */
export function drawHudDiscEmph(ctx: Ctx, s: number): void {
  drawHudDisc(ctx, s, PAL.flame, 1, 0.042);
}

/**
 * R2 (Reality P1-7, spec 5-C "−🏮"): the remove mark — a coral disc with a cream minus and a dark
 * rim, centred on (cx, cy), radius r. The SAME mark sits on the wrong lantern and on the hint button
 * (it never looks like undo's curved arrow).
 */
export function drawMinusBadge(ctx: Ctx, cx: number, cy: number, r: number): void {
  ctx.fillStyle = "rgba(16,4,2,0.9)";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = PAL.coral;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.84, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = PAL.moon;
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(1.5, r * 0.3);
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.42, cy);
  ctx.lineTo(cx + r * 0.42, cy);
  ctx.stroke();
  ctx.lineCap = "butt";
}

/** The HUD glyph stroke: 2.25 pt at a 48 pt disc, round caps and joins, moon colour. */
export function hudStroke(ctx: Ctx, s: number, color: string = PAL.moon): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, s * 0.047 * (vis.p.boldText ? 1.25 : 1));
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

/**
 * The one house glyph (audit P1-12: three different houses became one): the daily's way home,
 * the result sheet's home button and the town's home button all draw this, in a HUD disc.
 */
export function drawHomeButton(ctx: Ctx, s: number): void {
  drawHudDisc(ctx, s);
  strokeHomeGlyph(ctx, s / 2, s / 2, s);
}

/** The house in the HUD grammar (one stroked outline + a lit window), centred on (cx, cy) for a disc of `s` px. */
export function strokeHomeGlyph(ctx: Ctx, cx: number, cy: number, s: number): void {
  const c = cx;
  const m = cy;
  hudStroke(ctx, s);
  ctx.beginPath();
  ctx.moveTo(c - s * 0.2, m - s * 0.02);
  ctx.lineTo(c, m - s * 0.2);
  ctx.lineTo(c + s * 0.2, m - s * 0.02);
  ctx.moveTo(c - s * 0.15, m - s * 0.06);
  ctx.lineTo(c - s * 0.15, m + s * 0.19);
  ctx.lineTo(c + s * 0.15, m + s * 0.19);
  ctx.lineTo(c + s * 0.15, m - s * 0.06);
  ctx.stroke();
  drawGlow(ctx, c - s * 0.045, m + s * 0.05, s * 0.12, GLOW.window);
  ctx.fillStyle = PAL.windowLit;
  rrectPath(ctx, c - s * 0.09, m + s * 0.01, s * 0.09, s * 0.08, s * 0.015);
  ctx.fill();
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
}

/**
 * Hint button icon, `s` px square. "ask" = a gold disc with a magnifier (drawHintAsk);
 * "lift" = a dimmed lantern with a coral return curl (tap again to take the highlighted
 * lantern back).
 * `dots` = wrong lanterns left after the highlighted one (beads on the rim).
 */
export function drawHintIcon(ctx: Ctx, s: number, mode: "ask" | "lift", dots = 0, attn = false): void {
  if (mode === "ask") {
    drawHintAsk(ctx, s, attn);
    drawHintDots(ctx, s, dots);
    return;
  }
  const cx = s / 2;
  // "lift" (the remove hint's second tap) — R2 (P1-7): the emphasis disc (amber rim: "tap me
  // again"), the lantern + the coral minus badge it shows on the board ("−🏮"); never a curl (= undo)
  drawHudDiscEmph(ctx, s);
  const h = s * 0.5;
  const lx = cx - s * 0.05;
  const ly = s * 0.22;
  ctx.save();
  ctx.translate(lx - h * 0.4, ly);
  drawLantern(ctx, h, 0.35);
  ctx.restore();
  drawMinusBadge(ctx, cx + s * 0.17, s * 0.62, s * 0.13);
  drawHintDots(ctx, s, dots);
}

/**
 * r6 (3/8 read the lantern-with-? as "a second undo" or "a die"): the hint is a warm GOLD disc
 * (undo stays a dark disc with a moonlight arrow) with a dark magnifier and a small spark in its
 * lens — "look closer". Shape and colour both differ from undo, also in grey / at SE size.
 */
function drawHintAsk(ctx: Ctx, s: number, attn = false): void {
  // v9 HUD grammar: the same night disc as undo; a stroked magnifier whose lens holds lantern
  // light (a bright warm lens — shape AND lightness still differ from undo, r6) + a flame dot
  const c = s / 2;
  // R2: the plain disc (the amber rim is the emphasis state only); the warm lens still tells it from undo
  // v14 (mock g): the attention state = amber rim + amber glyph (after a quiet spell on an unsolved board)
  if (attn) drawHudDiscEmph(ctx, s);
  else drawHudDisc(ctx, s);
  const lx = c - s * 0.045;
  const ly = c - s * 0.045;
  const r = s * 0.14;
  drawGlow(ctx, lx, ly, r * 1.9, [[0, "rgba(255,214,140,0.55)"], [0.5, "rgba(255,190,100,0.2)"], [1, "rgba(255,170,80,0)"]]);
  const lg = ctx.createRadialGradient(lx - r * 0.3, ly - r * 0.3, 0, lx, ly, r);
  lg.addColorStop(0, "#FFF4D6");
  lg.addColorStop(0.6, "#FFD27A");
  lg.addColorStop(1, "#F2A23A");
  ctx.fillStyle = lg;
  ctx.beginPath();
  ctx.arc(lx, ly, r, 0, TAU);
  ctx.fill();
  hudStroke(ctx, s, attn ? PAL.flame : PAL.moon);
  ctx.beginPath();
  ctx.arc(lx, ly, r, 0, TAU);
  ctx.stroke();
  ctx.lineWidth *= 1.35;
  ctx.beginPath();
  ctx.moveTo(lx + r * 0.75, ly + r * 0.75);
  ctx.lineTo(c + s * 0.21, c + s * 0.21);
  ctx.stroke();
  // v11 (NOVICE-TEST C18 / D8): no standing flame dot on the upper right — it read as "new message"
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
}

/** Wrong lanterns still left after the highlighted one: small beads on the lower rim (max 5). */
function drawHintDots(ctx: Ctx, s: number, dots: number): void {
  const cx = s / 2;
  const n = Math.min(5, dots);
  for (let k = 0; k < n; k++) {
    const ang = Math.PI / 2 + (k - (n - 1) / 2) * 0.3;
    const x = cx + Math.cos(ang) * s * 0.48;
    const y = s / 2 + Math.sin(ang) * s * 0.48;
    ctx.fillStyle = "rgba(8,14,40,0.9)";
    ctx.beginPath();
    ctx.arc(x, y, s * 0.055, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#DCEBFA";
    ctx.beginPath();
    ctx.arc(x, y, s * 0.036, 0, TAU);
    ctx.fill();
  }
}

/**
 * Track entrance icons, `s` px square, showing where the button goes.
 * "deduce" = a steep hill with a lit lantern on its summit under two small
 * stars (the harder way up; v4's "+" badge read as "paid"); "gentle" = a little house with a lit window
 * (the way home). v3's winding-path squiggle read as nothing (8/8).
 */
export function drawTrackIcon(ctx: Ctx, s: number, to: "deduce" | "gentle"): void {
  // the way home is THE house button (one glyph everywhere)
  if (to === "gentle") {
    drawHomeButton(ctx, s);
    return;
  }
  drawHudDisc(ctx, s);
  {
    ctx.save();
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.46, 0, TAU);
    ctx.clip();
    // steep hill
    const hg = ctx.createLinearGradient(0, s * 0.35, 0, s);
    hg.addColorStop(0, mix(PAL.hillFar, PAL.moon, 0.25));
    hg.addColorStop(1, PAL.hillMid);
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.moveTo(s * 0.08, s * 0.96);
    ctx.quadraticCurveTo(s * 0.32, s * 0.62, s * 0.44, s * 0.46);
    ctx.quadraticCurveTo(s * 0.5, s * 0.38, s * 0.56, s * 0.46);
    ctx.quadraticCurveTo(s * 0.7, s * 0.64, s * 0.94, s * 0.96);
    ctx.closePath();
    ctx.fill();
    // path up
    ctx.strokeStyle = rgba(PAL.moon, 0.7);
    ctx.lineWidth = s * 0.035;
    ctx.lineCap = "round";
    ctx.setLineDash([s * 0.05, s * 0.05]);
    ctx.beginPath();
    ctx.moveTo(s * 0.5, s * 0.95);
    ctx.quadraticCurveTo(s * 0.62, s * 0.74, s * 0.46, s * 0.62);
    ctx.quadraticCurveTo(s * 0.4, s * 0.55, s * 0.5, s * 0.47);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    // lantern on the summit
    drawGlow(ctx, s * 0.5, s * 0.32, s * 0.2, GLOW.flame);
    ctx.save();
    const lh = s * 0.26;
    ctx.translate(s * 0.5 - lh * 0.4, s * 0.32 - lh * 0.56);
    drawLantern(ctx, lh, 1);
    ctx.restore();
    // two small stars over the summit: the starrier, harder hills (v4's "+" read as "paid")
    for (const [sx, sy, sr] of [[0.74, 0.24, 0.05], [0.27, 0.3, 0.035]] as const) drawSparkle(ctx, s * sx, s * sy, s * sr, rgba(PAL.moon, 0.95));
  }
}

/** Courtyard flagstone (unlit): a baked v9 slab (keepsake boards and previews). */
export function drawFloorTile(ctx: Ctx, x: number, y: number, s: number, r: number, rnd: Rnd): void {
  void r;
  stampSlab(ctx, Math.round(x), Math.round(y), Math.max(1, Math.round(s)), rnd, Math.max(1, s / 60));
}

/** Lit flagstone (still image: keepsakes): the v9 lit slab (same stone under lantern light). */
export function drawLitTile(ctx: Ctx, cx: number, cy: number, s: number, r: number, bleed: number): void {
  void r;
  void bleed;
  const n = Math.max(1, Math.round(s));
  stampSlab(ctx, Math.round(cx - s / 2), Math.round(cy - s / 2), n, () => 0.5, Math.max(1, s / 60), true);
}

/** Additive "double light" overlay (+~25% brightness, whiter). */
export function drawDoubleTile(ctx: Ctx, cx: number, cy: number, s: number, r: number): void {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.7);
  g.addColorStop(0, "rgba(255,248,226,0.55)");
  g.addColorStop(1, "rgba(255,228,176,0.22)");
  rrectPath(ctx, cx - s / 2, cy - s / 2, s, s, r);
  ctx.fillStyle = g;
  ctx.fill();
}

/** "Still dark" breathing hint: a cool moonlit inner rim. */
export function drawDarkHint(ctx: Ctx, cx: number, cy: number, s: number, r: number, lw: number): void {
  rrectPath(ctx, cx - s / 2 + lw, cy - s / 2 + lw, s - lw * 2, s - lw * 2, r);
  ctx.save();
  ctx.shadowColor = rgba(PAL.moon, 0.9);
  ctx.shadowBlur = lw * 3;
  ctx.lineWidth = lw;
  ctx.strokeStyle = rgba(PAL.moon, 0.85);
  ctx.stroke();
  ctx.restore();
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.6);
  g.addColorStop(0, rgba(PAL.conflict, 0.0));
  g.addColorStop(1, rgba(PAL.conflict, 0.22));
  ctx.fillStyle = g;
  ctx.fill();
}

/** Five-petal flower, petals pointing out from the centre. */
export function drawFlower(ctx: Ctx, cx: number, cy: number, r: number, petal: string, rot: number): void {
  for (let k = 0; k < 5; k++) {
    const a = rot + (k / 5) * TAU;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    const g = ctx.createLinearGradient(0, 0, r, 0);
    g.addColorStop(0, mix(petal, "#3A2030", 0.25));
    g.addColorStop(0.6, petal);
    g.addColorStop(1, mix(petal, "#FFFFFF", 0.35));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(r * 0.52, 0, r * 0.5, r * 0.3, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = PAL.wick;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.24, 0, TAU);
  ctx.fill();
  ctx.fillStyle = PAL.litCore;
  ctx.beginPath();
  ctx.arc(cx + r * 0.05, cy + r * 0.05, r * 0.13, 0, TAU);
  ctx.fill();
}

/**
 * Round paper lantern, `h` px tall (width 0.8h). Origin = canvas top-left;
 * body centre at (0.4h, 0.56h) — the flame sprite sits there.
 */
export function drawLantern(ctx: Ctx, h: number, glow: number, skin: SkinId = "wick"): void {
  // v9: the icon's framed paper lantern (src/render/lantern.ts) — one object everywhere
  drawFramedLantern(ctx, h, glow, skin);
}

/** Soft radial glow (for additive sprites). stops: [pos, css color][] */
export function drawGlow(ctx: Ctx, cx: number, cy: number, r: number, stops: readonly (readonly [number, string])[]): void {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  for (const [p, c] of stops) g.addColorStop(p, c);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fill();
}

export const GLOW = {
  flame: [[0, "rgba(255,250,232,1)"], [0.18, "rgba(255,244,214,0.95)"], [0.4, "rgba(255,200,100,0.6)"], [0.7, "rgba(255,170,70,0.18)"], [1, "rgba(255,150,60,0)"]],
  flameMoon: [[0, "rgba(240,248,255,1)"], [0.2, "rgba(214,232,248,0.9)"], [0.45, "rgba(143,183,217,0.55)"], [0.75, "rgba(143,183,217,0.15)"], [1, "rgba(143,183,217,0)"]],
  halo: [[0, "rgba(255,206,120,0.42)"], [0.35, "rgba(255,190,100,0.2)"], [0.7, "rgba(255,170,80,0.06)"], [1, "rgba(255,160,70,0)"]],
  firefly: [[0, "rgba(255,252,220,1)"], [0.22, "rgba(236,246,160,0.75)"], [0.5, "rgba(200,230,120,0.22)"], [1, "rgba(180,220,100,0)"]],
  star: [[0, "rgba(255,255,255,1)"], [0.3, "rgba(244,235,208,0.6)"], [1, "rgba(244,235,208,0)"]],
  smoke: [[0, "rgba(190,176,206,0.32)"], [0.6, "rgba(170,156,190,0.14)"], [1, "rgba(160,146,180,0)"]],
  window: [[0, "rgba(255,214,130,0.55)"], [0.4, "rgba(255,190,100,0.22)"], [1, "rgba(255,170,80,0)"]],
} as const;

/** A small ring used for tap / restore pulses (moonlight). */
export function drawRing(ctx: Ctx, cx: number, cy: number, r: number, lw: number, color: string = PAL.moon): void {
  if (color !== PAL.moon) {
    // dark under-stroke so the cool ring reads on bright (lit) floor too
    ctx.strokeStyle = "rgba(14,20,48,0.55)";
    ctx.lineWidth = lw * 2.2;
    ctx.beginPath();
    ctx.arc(cx, cy, r - lw * 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.save();
  ctx.shadowColor = rgba(color, 0.9);
  ctx.shadowBlur = lw * 2;
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.arc(cx, cy, r - lw * 2, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

/**
 * Stuck dark cell (round 4): a dim four-point sparkle — "light would go here" —
 * crossed out by one diagonal stroke. Deliberately unlike the hint's "place
 * here" ghost lantern and the old dashed ring.
 */
export function drawBlockedMark(ctx: Ctx, s: number, lw: number): void {
  const c = s / 2;
  drawGlow(ctx, c, c, c, [[0, rgba(PAL.conflict, 0.22)], [0.6, rgba(PAL.conflict, 0.1)], [1, rgba(PAL.conflict, 0)]]);
  const r = s * 0.3;
  const star = (): void => {
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU - Math.PI / 2;
      const rr = k % 2 === 0 ? r : r * 0.3;
      if (k === 0) ctx.moveTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr);
      else ctx.lineTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr);
    }
    ctx.closePath();
  };
  star();
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(8,12,32,0.7)";
  ctx.lineWidth = lw * 2.2;
  ctx.stroke();
  ctx.fillStyle = rgba("#C9DBEE", vis.p.increaseContrast ? 0.9 : 0.55);
  ctx.fill();
  ctx.strokeStyle = rgba("#DCEBFA", 0.85);
  ctx.lineWidth = lw * 0.8;
  ctx.stroke();
  // the cross-out stroke
  ctx.lineCap = "round";
  const d = r * 0.95;
  for (const [col, w] of [["rgba(8,12,32,0.85)", lw * 2.6], ["#DCEBFA", lw * 1.1]] as const) {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(c - d, c + d);
    ctx.lineTo(c + d, c - d);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
}

/** Small four-point sparkle (stars on icons). */
export function drawSparkle(ctx: Ctx, cx: number, cy: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU - Math.PI / 2;
    const rr = k % 2 === 0 ? r : r * 0.32;
    if (k === 0) ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    else ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

/** "Return / away" curl: from the top it dips down a half circle and turns back left with an arrow head. */
export function drawReturnCurl(ctx: Ctx, cx: number, cy: number, r: number, color: string, lw: number): void {
  const path = (): void => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI * 0.5, Math.PI * 0.62, false);
  };
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const tipA = Math.PI * 0.62;
  const tx = cx + Math.cos(tipA) * r;
  const ty = cy + Math.sin(tipA) * r;
  const head = (): void => {
    ctx.beginPath();
    ctx.moveTo(tx - r * 0.05, ty - r * 0.55);
    ctx.lineTo(tx, ty);
    ctx.lineTo(tx + r * 0.55, ty + r * 0.08);
  };
  for (const [col, w] of [["rgba(8,14,40,0.85)", lw * 2], [color, lw]] as const) {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    path();
    ctx.stroke();
    head();
    ctx.stroke();
  }
  ctx.lineCap = "butt";
}

/** Undo button: dark disc, moonlight rim, a counter-clockwise curved arrow. */
export function drawUndoIcon(ctx: Ctx, s: number): void {
  const c = s / 2;
  drawHudDisc(ctx, s);
  // v9 HUD grammar: an open arc with a stroked chevron head ("back")
  const r = s * 0.17;
  const a0 = -Math.PI * 0.95;
  const a1 = Math.PI * 0.6;
  const ox = c + s * 0.02;
  const oy = c + s * 0.02;
  hudStroke(ctx, s);
  ctx.beginPath();
  ctx.arc(ox, oy, r, a0, a1, false);
  ctx.stroke();
  const hx = ox + Math.cos(a0) * r;
  const hy = oy + Math.sin(a0) * r;
  ctx.beginPath();
  ctx.moveTo(hx + s * 0.005, hy - s * 0.11);
  ctx.lineTo(hx, hy);
  ctx.lineTo(hx + s * 0.11, hy + s * 0.02);
  ctx.stroke();
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
}

/** Two lanterns that see each other: a coral ✕ with a dark rim and a soft warm glow. */
export function drawConflictX(ctx: Ctx, s: number): void {
  const c = s / 2;
  // phase 2 (audit P1-8): drawn at 0.8 cell; a heavy near-black outline carries the ✕ for
  // red-green colour-blind players (the coral turns grey-brown there; the shape stays)
  if (!vis.p.increaseContrast) drawGlow(ctx, c, c, c, [[0, rgba(PAL.coral, 0.4)], [0.55, rgba(PAL.coral, 0.14)], [1, rgba(PAL.coral, 0)]]);
  const d = s * 0.25;
  ctx.lineCap = "round";
  for (const [col, w] of [["rgba(16,4,2,0.95)", s * 0.2], [PAL.coral, s * 0.11], [PAL.coralHi, s * 0.035]] as const) {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(c - d, c - d);
    ctx.lineTo(c + d, c + d);
    ctx.moveTo(c + d, c - d);
    ctx.lineTo(c - d, c + d);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
}

/**
 * Over-full mark (round 5): v5's up-chevrons read as "needs more" (7/8). Now a
 * coral tag with a bold MINUS and a small lantern: "one lantern less". It sits
 * on the rock's shoulder and bobs DOWN. Grayscale: dark rim, mid coral body,
 * near-white minus — the minus is the shape that carries the meaning.
 * Canvas w × h (w ≈ 1.75 h).
 */
export function drawOverMark(ctx: Ctx, w: number, h: number): void {
  const lw = h * 0.1;
  const r = h / 2 - lw;
  ctx.fillStyle = "rgba(40,8,4,0.92)";
  rrectPath(ctx, lw * 0.3, lw * 0.3, w - lw * 0.6, h - lw * 0.6, h / 2);
  ctx.fill();
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, PAL.coralHi);
  g.addColorStop(0.45, PAL.coral);
  g.addColorStop(1, PAL.coralDeep);
  ctx.fillStyle = g;
  rrectPath(ctx, lw, lw, w - lw * 2, h - lw * 2, r);
  ctx.fill();
  // minus (left half)
  const mx = lw + r * 1.05;
  const my = h / 2;
  const mw = r * 1.05;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#2A0A04";
  ctx.lineWidth = h * 0.3;
  ctx.beginPath();
  ctx.moveTo(mx - mw / 2, my);
  ctx.lineTo(mx + mw / 2, my);
  ctx.stroke();
  ctx.strokeStyle = "#FFF6EE";
  ctx.lineWidth = h * 0.19;
  ctx.stroke();
  ctx.lineCap = "butt";
  // a small lantern (right half): "minus one lantern"
  const lh = h * 0.72;
  ctx.save();
  ctx.translate(w - lw - r * 0.9 - lh * 0.4, h / 2 - lh * 0.56);
  drawLantern(ctx, lh, 0.55);
  ctx.restore();
}

/**
 * Today's calendar tile (daily board + result card): a little page with two
 * binder rings, a moonlit band carrying the date's moon phase, and the
 * day-of-month in big ink digits. Canvas w × h.
 */
/** A gold check badge (today's daily solved): dark rim, gold disc, cream tick. Centre (cx, cy), radius r. */
export function drawDoneBadge(ctx: Ctx, cx: number, cy: number, r: number): void {
  ctx.fillStyle = "rgba(30,16,4,0.9)";
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.14, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#F2B04E";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "#FFF6DC";
  ctx.lineWidth = r * 0.32;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.45, cy + r * 0.02);
  ctx.lineTo(cx - r * 0.1, cy + r * 0.38);
  ctx.lineTo(cx + r * 0.5, cy - r * 0.36);
  ctx.stroke();
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
}

export function drawCalendarTile(ctx: Ctx, w: number, h: number, day: number, phase: number, u: number): void {
  const r = w * 0.16;
  ctx.fillStyle = "rgba(4,5,14,0.55)";
  rrectPath(ctx, 0, 3 * u, w, h - 3 * u, r);
  ctx.fill();
  ctx.fillStyle = "#140F24";
  rrectPath(ctx, 0, 0, w, h - 3 * u, r);
  ctx.fill();
  const pg = ctx.createLinearGradient(0, 0, 0, h);
  pg.addColorStop(0, "#FBF6E8");
  pg.addColorStop(1, "#E9DFC6");
  ctx.fillStyle = pg;
  rrectPath(ctx, 1.5 * u, 1.5 * u, w - 3 * u, h - 6 * u, r * 0.85);
  ctx.fill();
  // moonlit band with the moon phase
  const bandH = h * 0.36;
  ctx.save();
  rrectPath(ctx, 1.5 * u, 1.5 * u, w - 3 * u, h - 6 * u, r * 0.85);
  ctx.clip();
  const bg = ctx.createLinearGradient(0, 0, 0, bandH);
  bg.addColorStop(0, "#3E4675");
  bg.addColorStop(1, "#2A2F55");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, bandH);
  ctx.restore();
  const ms = bandH * 2.2;
  ctx.save();
  ctx.translate(w / 2 - ms / 2, bandH * 0.54 - ms / 2);
  drawMoonPhase(ctx, ms, phase, false);
  ctx.restore();
  // binder rings
  for (const x of [w * 0.24, w * 0.76]) {
    ctx.fillStyle = "#140F24";
    rrectPath(ctx, x - 2.2 * u, -2 * u, 4.4 * u, bandH * 0.38, 2.2 * u);
    ctx.fill();
    ctx.fillStyle = "#B7CBE0";
    rrectPath(ctx, x - 1.2 * u, -1.2 * u, 2.4 * u, bandH * 0.32, 1.2 * u);
    ctx.fill();
  }
  // day of month
  const txt = String(day);
  const ch = (h - 3 * u - bandH) * 0.5;
  drawNumerals(ctx, txt, w / 2, bandH + (h - 3 * u - bandH) * 0.52, ch, "#1E1A33", null, vis.p.boldText ? 1.25 : 1.08);
}

/**
 * A kept day (r6: the moon-silver cloth hood read as a cupcake to 8/8 testers): a moon-blue
 * bookmark ribbon hangs over the front of the lantern and below it, its tail cut in a V —
 * "this day is marked and kept". Shape (a long ribbon with a notched tail) carries the meaning;
 * blue on the orange/tan lantern stays apart for protan / deutan / tritan and in grey (lighter
 * than the body, dark navy edge). `ty` = the lantern's top, `lh` its height (drawLantern units).
 */
export function drawKeepRibbon(ctx: Ctx, x: number, ty: number, lh: number, lw = Math.max(0.8, lh * 0.04)): void {
  const w = lh * 0.2;
  const x0 = x + lh * 0.06 - w / 2;
  const y0 = ty + lh * 0.2;
  const y1 = ty + lh * 1.16;
  const notch = w * 0.62;
  const path = (): void => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + w, y0);
    ctx.lineTo(x0 + w, y1);
    ctx.lineTo(x0 + w / 2, y1 - notch);
    ctx.lineTo(x0, y1);
    ctx.closePath();
  };
  // dark edge first (reads on lit and unlit lanterns, on navy and on the sky)
  path();
  ctx.strokeStyle = "rgba(14,22,48,0.92)";
  ctx.lineWidth = lw * 2;
  ctx.lineJoin = "round";
  ctx.stroke();
  const g = ctx.createLinearGradient(x0, 0, x0 + w, 0);
  g.addColorStop(0, "#A9D2F2");
  g.addColorStop(0.55, "#86B9E6");
  g.addColorStop(1, "#5E93C8");
  ctx.fillStyle = g;
  path();
  ctx.fill();
  // the fold where it comes over the lantern's top
  ctx.fillStyle = "rgba(20,40,80,0.35)";
  ctx.fillRect(x0, y0, w, Math.max(lw, lh * 0.05));
  ctx.lineJoin = "miter";
}

/**
 * Streak shield: the town's kept day — an unlit lantern carrying the moon-blue bookmark ribbon
 * (drawKeepRibbon; one shape for one meaning on the street, the result sheet and its bubble).
 * lit = still available this month; used = a dim, faded one.
 */
export function drawShield(ctx: Ctx, s: number, lit: boolean): void {
  const lh = s * 0.76;
  const x = s / 2 - s * 0.04;
  const ty = s * 0.04;
  if (lit) drawGlow(ctx, x, ty + lh * 0.55, s * 0.5, [[0, rgba(PAL.moon, 0.26)], [1, rgba(PAL.moon, 0)]]);
  ctx.save();
  if (!lit) ctx.globalAlpha = 0.45;
  ctx.translate(x - lh * 0.4, ty);
  drawLantern(ctx, lh, 0);
  ctx.restore();
  ctx.save();
  if (!lit) ctx.globalAlpha = 0.4;
  drawKeepRibbon(ctx, x, ty, lh);
  ctx.restore();
}

/**
 * "No hints" mark (the share text's ✨): three four-point sparkles, gold with a dark rim.
 * Shown on the result sheet exactly when the share text carries ✨.
 */
export function drawSparkles(ctx: Ctx, s: number): void {
  const pts: Array<[number, number, number]> = [[0.42, 0.5, 0.3], [0.78, 0.24, 0.16], [0.8, 0.74, 0.12]];
  for (const [x, y, r] of pts) drawSparkle(ctx, s * x, s * y, s * r * 1.18, "rgba(40,20,4,0.85)");
  for (const [x, y, r] of pts) drawSparkle(ctx, s * x, s * y, s * r, "#FFD27A");
  for (const [x, y, r] of pts) drawSparkle(ctx, s * x, s * y, s * r * 0.45, "#FFF6DC");
}

/**
 * Ad-break chip (wordless): a small crescent moon with two pause bars beside it — "a quiet
 * 30 minutes without breaks". HUD disc style.
 */
export function drawBreakChip(ctx: Ctx, s: number): void {
  drawHudDisc(ctx, s, PAL.moon, 0.55);
  const c = s / 2;
  // crescent (filled: the moon is a thing, not a line) + stroked pause bars (HUD grammar)
  ctx.save();
  ctx.fillStyle = PAL.moon;
  ctx.beginPath();
  ctx.arc(c - s * 0.08, c, s * 0.2, 0, TAU);
  ctx.arc(c + s * 0.02, c - s * 0.06, s * 0.17, 0, TAU, true);
  ctx.fill("evenodd");
  ctx.restore();
  hudStroke(ctx, s);
  ctx.beginPath();
  ctx.moveTo(c + s * 0.15, c - s * 0.1);
  ctx.lineTo(c + s * 0.15, c + s * 0.1);
  ctx.moveTo(c + s * 0.25, c - s * 0.1);
  ctx.lineTo(c + s * 0.25, c + s * 0.1);
  ctx.stroke();
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
}

/** Haptics on/off for the settings sheet: a phone with buzz arcs; off = arcs gone, struck through. */
export function drawHaptic(ctx: Ctx, w: number, h: number, off: boolean, color: string): void {
  const ph = h * 0.86;
  const pw = ph * 0.52;
  const x0 = w / 2 - pw / 2;
  const y0 = h / 2 - ph / 2;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.5, h * 0.075);
  ctx.lineJoin = "round";
  rrectPath(ctx, x0, y0, pw, ph, pw * 0.22);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w / 2, y0 + ph * 0.86, h * 0.04, 0, TAU);
  ctx.fill();
  ctx.lineCap = "round";
  if (!off) {
    for (const side of [-1, 1]) {
      for (let k = 0; k < 2; k++) {
        const r = h * (0.22 + k * 0.16);
        const cx = w / 2 + side * (pw / 2 + h * 0.02);
        ctx.beginPath();
        if (side > 0) ctx.arc(cx, h / 2, r, -0.6, 0.6);
        else ctx.arc(cx, h / 2, r, Math.PI - 0.6, Math.PI + 0.6);
        ctx.stroke();
      }
    }
  } else {
    for (const [c, lw] of [["rgba(8,10,26,0.9)", h * 0.16], [color, h * 0.08]] as const) {
      ctx.strokeStyle = c;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(w / 2 - pw * 1.1, h / 2 + ph * 0.42);
      ctx.lineTo(w / 2 + pw * 1.1, h / 2 - ph * 0.42);
      ctx.stroke();
    }
  }
  ctx.lineCap = "butt";
}

/** "Show the guide again": the guide's finger inside a circular replay arrow. */
export function drawReplayGuide(ctx: Ctx, w: number, h: number, color: string): void {
  const c = { x: w / 2, y: h / 2 };
  const r = h * 0.42;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.5, h * 0.07);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, -Math.PI * 0.35, Math.PI * 1.45);
  ctx.stroke();
  // arrow head at the arc's end
  const a = Math.PI * 1.45;
  const hx = c.x + Math.cos(a) * r;
  const hy = c.y + Math.sin(a) * r;
  ctx.beginPath();
  ctx.moveTo(hx + h * 0.16, hy - h * 0.02);
  ctx.lineTo(hx - h * 0.02, hy - h * 0.14);
  ctx.lineTo(hx - h * 0.04, hy + h * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.lineCap = "butt";
  // the guide's finger, small, in the middle
  const fh = h * 0.6;
  ctx.save();
  ctx.translate(c.x - fh * 0.8 * 0.36, c.y - fh * 0.45);
  drawFinger(ctx, fh);
  ctx.restore();
}

/** Remove-hint "take back" curl: coral, dark rim (the curl dips down and turns back). */
export function drawTakeBack(ctx: Ctx, s: number): void {
  // R2 (P1-7): the remove mark is the minus badge (the hint button shows the same one)
  drawMinusBadge(ctx, s / 2, s / 2, s * 0.4);
}

/**
 * Street icon (opens the town, round 5): three little houses in a row, two with
 * lit windows, and a street lamp. Dark disc + moonlight rim like the other buttons.
 */
export function drawStreetIcon(ctx: Ctx, s: number): void {
  drawHudDisc(ctx, s);
  // v9 HUD grammar: one stroked roofline of three gables over a street line, one lit window
  const yb = s * 0.66;
  hudStroke(ctx, s);
  ctx.beginPath();
  ctx.moveTo(s * 0.2, yb);
  ctx.lineTo(s * 0.2, s * 0.5);
  ctx.lineTo(s * 0.3, s * 0.4);
  ctx.lineTo(s * 0.4, s * 0.5);
  ctx.lineTo(s * 0.4, s * 0.44);
  ctx.lineTo(s * 0.5, s * 0.32);
  ctx.lineTo(s * 0.6, s * 0.44);
  ctx.lineTo(s * 0.6, s * 0.5);
  ctx.lineTo(s * 0.7, s * 0.4);
  ctx.lineTo(s * 0.8, s * 0.5);
  ctx.lineTo(s * 0.8, yb);
  ctx.stroke();
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.moveTo(s * 0.14, yb + s * 0.075);
  ctx.lineTo(s * 0.86, yb + s * 0.075);
  ctx.stroke();
  ctx.globalAlpha = 1;
  drawGlow(ctx, s * 0.5, s * 0.52, s * 0.11, GLOW.window);
  ctx.fillStyle = PAL.windowLit;
  rrectPath(ctx, s * 0.465, s * 0.48, s * 0.07, s * 0.08, s * 0.012);
  ctx.fill();
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
}

/** Far tower geometry (shared by the drawing and the live window lights), canvas w × h, base at (w/2, h). */
export function farTowerGeom(w: number, h: number): { windows: Array<{ x: number; y: number; s: number }>; beacon: { x: number; y: number; r: number }; door: { x: number; y: number } } {
  const bw = w * 0.5;
  const windows: Array<{ x: number; y: number; s: number }> = [];
  for (let k = 0; k < 5; k++) windows.push({ x: w / 2 + (k % 2 === 0 ? -1 : 1) * bw * 0.12, y: h * (0.86 - k * 0.12), s: Math.max(2, bw * 0.24) });
  return { windows, beacon: { x: w / 2, y: h * 0.17, r: w * 0.2 }, door: { x: w / 2, y: h * 0.93 } };
}

/**
 * The deduce tower on the far ridge (round 5: the track entrance is a place, not an
 * icon): a tall stone tower with a glass lantern room and a cone roof. Windows are
 * drawn dark; live sprites light them. Canvas w × h, base centre at (w/2, h).
 */
export function drawFarTower(ctx: Ctx, w: number, h: number): void {
  const c = w / 2;
  const bw = w * 0.5;
  const tw = w * 0.38;
  const body = mix(PAL.hillFar, PAL.roof, 0.42);
  const rim = rgba(PAL.wallRim, 0.5);
  // body (tapered)
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(c - bw / 2, h);
  ctx.lineTo(c - tw / 2, h * 0.3);
  ctx.lineTo(c + tw / 2, h * 0.3);
  ctx.lineTo(c + bw / 2, h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rim;
  ctx.lineWidth = Math.max(1, w * 0.035);
  ctx.beginPath();
  ctx.moveTo(c - bw / 2, h);
  ctx.lineTo(c - tw / 2, h * 0.3);
  ctx.stroke();
  // gallery
  ctx.fillStyle = PAL.roof;
  ctx.fillRect(c - w * 0.34, h * 0.28, w * 0.68, h * 0.035);
  // lantern room (glass, dark until lit)
  ctx.fillStyle = PAL.windowFrame;
  ctx.fillRect(c - tw * 0.46, h * 0.11, tw * 0.92, h * 0.17);
  ctx.fillStyle = PAL.windowDark;
  ctx.fillRect(c - tw * 0.34, h * 0.125, tw * 0.68, h * 0.14);
  // cone roof + finial
  ctx.fillStyle = PAL.roof;
  ctx.beginPath();
  ctx.moveTo(c - tw * 0.62, h * 0.115);
  ctx.lineTo(c, h * 0.015);
  ctx.lineTo(c + tw * 0.62, h * 0.115);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rim;
  ctx.fillRect(c - 0.5, 0, 1.5, h * 0.03);
  // windows + door
  const g = farTowerGeom(w, h);
  for (const win of g.windows) {
    ctx.fillStyle = PAL.windowFrame;
    ctx.fillRect(win.x - win.s * 0.65, win.y - win.s * 0.8, win.s * 1.3, win.s * 1.6);
    ctx.fillStyle = PAL.windowDark;
    ctx.fillRect(win.x - win.s * 0.45, win.y - win.s * 0.6, win.s * 0.9, win.s * 1.2);
  }
  ctx.fillStyle = PAL.windowFrame;
  rrectPath(ctx, c - bw * 0.16, h * 0.9, bw * 0.32, h * 0.1, bw * 0.12);
  ctx.fill();
}

/**
 * The home house seen from the tower's courtyard (far hill, right): a small
 * house with a warm window and a door. Canvas w × h, base centre at (w/2, h).
 */
export function drawFarHome(ctx: Ctx, w: number, h: number): void {
  const c = w / 2;
  const bw = w * 0.72;
  const bh = h * 0.52;
  ctx.fillStyle = mix(PAL.hillMid, PAL.roof, 0.3);
  ctx.fillRect(c - bw / 2, h - bh, bw, bh);
  ctx.fillStyle = PAL.roof;
  ctx.beginPath();
  ctx.moveTo(c - bw / 2 - w * 0.08, h - bh + 1);
  ctx.lineTo(c, h - bh - h * 0.4);
  ctx.lineTo(c + bw / 2 + w * 0.08, h - bh + 1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgba(PAL.wallRim, 0.5);
  ctx.lineWidth = Math.max(1, w * 0.03);
  ctx.beginPath();
  ctx.moveTo(c - bw / 2 - w * 0.08, h - bh + 1);
  ctx.lineTo(c, h - bh - h * 0.4);
  ctx.stroke();
  drawGlow(ctx, c - bw * 0.2, h - bh * 0.55, w * 0.3, GLOW.window);
  ctx.fillStyle = PAL.windowLit;
  ctx.fillRect(c - bw * 0.34, h - bh * 0.72, bw * 0.26, bh * 0.3);
  ctx.fillStyle = PAL.windowFrame;
  rrectPath(ctx, c + bw * 0.08, h - bh * 0.6, bw * 0.24, bh * 0.6, bw * 0.08);
  ctx.fill();
}

/**
 * Moon in the sky / daily icon with the real phase: p ∈ [0, 1) (0 new, 0.5 full).
 * v14 (one world, r2 re-review #1): the lit side always faces the scene's light — the afterglow on
 * the upper LEFT — so the phase AMOUNT is real and the orientation is the world's. Earthshine keeps
 * the dark part faintly visible.
 */
export function drawMoonPhase(ctx: Ctx, s: number, p: number, glow = true): void {
  const c = s / 2;
  const r = s * 0.2;
  if (glow) drawGlow(ctx, c, c, c, [[0, rgba(PAL.moon, 0.3)], [0.35, rgba(PAL.moon, 0.1)], [1, rgba(PAL.moon, 0)]]);
  ctx.fillStyle = "rgba(60,62,96,0.85)";
  ctx.beginPath();
  ctx.arc(c, c, r, 0, TAU);
  ctx.fill();
  const waning = p > 0.5;
  const q = waning ? 1 - p : p; // 0..0.5, waxing geometry
  const k = r * Math.abs(Math.cos(q * TAU));
  ctx.save();
  // the geometry below lights the right half; mirror it always so the lit side faces the light (left)
  ctx.translate(s, 0);
  ctx.scale(-1, 1);
  ctx.beginPath();
  ctx.arc(c, c, r, -Math.PI / 2, Math.PI / 2, false); // lit half, top → bottom
  // terminator back up: bulges right for a crescent, left for a gibbous moon
  ctx.ellipse(c, c, Math.max(0.01, k), r, 0, Math.PI / 2, -Math.PI / 2, q < 0.25);
  ctx.closePath();
  ctx.fillStyle = PAL.moon;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = rgba(PAL.moon, 0.35);
  ctx.lineWidth = Math.max(1, s * 0.012);
  ctx.beginPath();
  ctx.arc(c, c, r, 0, TAU);
  ctx.stroke();
}

/** Stopwatch glyph (result card), moonlight stroke. */
export function drawStopwatch(ctx: Ctx, s: number, color: string = PAL.moon): void {
  const c = s / 2;
  const r = s * 0.33;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = s * 0.09;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(c, c + s * 0.06, r, 0, TAU);
  ctx.stroke();
  ctx.fillRect(c - s * 0.1, s * 0.04, s * 0.2, s * 0.09);
  ctx.beginPath();
  ctx.moveTo(c, c + s * 0.06);
  ctx.lineTo(c, c - r * 0.55 + s * 0.06);
  ctx.moveTo(c, c + s * 0.06);
  ctx.lineTo(c + r * 0.45, c + s * 0.06);
  ctx.stroke();
  ctx.lineCap = "butt";
}

/** Streak flame glyph (warm). */
export function drawStreakFlame(ctx: Ctx, s: number, lit = true): void {
  const c = s / 2;
  const g = ctx.createLinearGradient(0, s * 0.1, 0, s * 0.95);
  g.addColorStop(0, lit ? "#FFE7A8" : "#8A8DA8");
  g.addColorStop(0.55, lit ? PAL.flame : "#6A6E8C");
  g.addColorStop(1, lit ? PAL.koi : "#4C5070");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(c, s * 0.06);
  ctx.bezierCurveTo(c + s * 0.42, s * 0.38, c + s * 0.36, s * 0.92, c, s * 0.94);
  ctx.bezierCurveTo(c - s * 0.36, s * 0.92, c - s * 0.38, s * 0.5, c - s * 0.12, s * 0.3);
  ctx.bezierCurveTo(c - s * 0.08, s * 0.46, c - s * 0.02, s * 0.5, c + s * 0.02, s * 0.5);
  ctx.bezierCurveTo(c + s * 0.06, s * 0.36, c - s * 0.04, s * 0.2, c, s * 0.06);
  ctx.fill();
  ctx.fillStyle = lit ? "rgba(255,250,232,0.9)" : "rgba(200,200,220,0.5)";
  ctx.beginPath();
  ctx.ellipse(c, s * 0.74, s * 0.1, s * 0.15, 0, 0, TAU);
  ctx.fill();
}

/** iOS-style share glyph: open box with an arrow up out of it. */
export function drawShareGlyph(ctx: Ctx, s: number, color: string): void {
  const c = s / 2;
  ctx.strokeStyle = color;
  ctx.lineWidth = s * 0.075;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(c - s * 0.12, s * 0.42);
  ctx.lineTo(c - s * 0.26, s * 0.42);
  ctx.lineTo(c - s * 0.26, s * 0.86);
  ctx.lineTo(c + s * 0.26, s * 0.86);
  ctx.lineTo(c + s * 0.26, s * 0.42);
  ctx.lineTo(c + s * 0.12, s * 0.42);
  ctx.moveTo(c, s * 0.62);
  ctx.lineTo(c, s * 0.12);
  ctx.moveTo(c - s * 0.13, s * 0.25);
  ctx.lineTo(c, s * 0.12);
  ctx.lineTo(c + s * 0.13, s * 0.25);
  ctx.stroke();
  ctx.lineCap = "butt";
}

/** Little house glyph (back home from the daily). */
export function drawHomeGlyph(ctx: Ctx, s: number, color: string, window: string = PAL.windowLit): void {
  const w = s * 0.56;
  const x0 = s / 2 - w / 2;
  const yb = s * 0.84;
  ctx.fillStyle = color;
  ctx.fillRect(x0, yb - w * 0.62, w, w * 0.62);
  ctx.beginPath();
  ctx.moveTo(x0 - s * 0.08, yb - w * 0.58);
  ctx.lineTo(s / 2, yb - w * 1.18);
  ctx.lineTo(x0 + w + s * 0.08, yb - w * 0.58);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = window;
  ctx.fillRect(s / 2 - w * 0.32, yb - w * 0.46, w * 0.26, w * 0.24);
  ctx.fillStyle = PAL.windowFrame;
  ctx.fillRect(s / 2 + w * 0.08, yb - w * 0.4, w * 0.2, w * 0.4);
}

/** Blocked dark cell: a cool dashed ring with a dark under-stroke (reads on dark and lit floor). */
export function drawBlockedRing(ctx: Ctx, cx: number, cy: number, r: number, lw: number): void {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, rgba(PAL.conflict, 0.05));
  g.addColorStop(0.8, rgba(PAL.conflict, 0.2));
  g.addColorStop(1, rgba(PAL.conflict, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fill();
  const rr = r - lw * 2;
  ctx.strokeStyle = "rgba(8,12,32,0.6)";
  ctx.lineWidth = lw * 2.4;
  ctx.beginPath();
  ctx.arc(cx, cy, rr, 0, TAU);
  ctx.stroke();
  const dash = (TAU * rr) / 14;
  ctx.setLineDash([dash * 0.62, dash * 0.38]);
  ctx.lineCap = "round";
  ctx.strokeStyle = "#DCEBFA";
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.arc(cx, cy, rr, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineCap = "butt";
}

/**
 * Ghost finger (wordless guide), `h` px tall, width 0.8h. A pale pointing hand,
 * index finger up; the fingertip is at (0.36w, 0.05h) — use it as the origin.
 */
export function drawFinger(ctx: Ctx, h: number): void {
  const w = h * 0.8;
  const cap = (x0: number, y0: number, x1: number, y1: number, r: number): void => {
    ctx.beginPath();
    ctx.lineCap = "round";
    ctx.lineWidth = r * 2;
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };
  const shapes = (grow: number): void => {
    cap(w * 0.36, h * 0.12, w * 0.36, h * 0.6, w * 0.11 + grow);
    cap(w * 0.53, h * 0.47, w * 0.53, h * 0.66, w * 0.1 + grow);
    cap(w * 0.68, h * 0.5, w * 0.68, h * 0.68, w * 0.095 + grow);
    cap(w * 0.81, h * 0.55, w * 0.81, h * 0.7, w * 0.085 + grow);
    cap(w * 0.24, h * 0.66, w * 0.12, h * 0.52, w * 0.09 + grow);
    ctx.beginPath();
    rrectPath(ctx, w * 0.25 - grow, h * 0.56 - grow, w * 0.64 + grow * 2, h * 0.36 + grow * 2, w * 0.2 + grow);
    ctx.fill();
  };
  drawGlow(ctx, w * 0.5, h * 0.55, h * 0.45, [[0, rgba(PAL.moon, 0.28)], [0.6, rgba(PAL.moon, 0.1)], [1, rgba(PAL.moon, 0)]]);
  const o = Math.max(1.5, h * 0.025);
  ctx.strokeStyle = "rgba(16,18,40,0.75)";
  ctx.fillStyle = "rgba(16,18,40,0.75)";
  shapes(o);
  ctx.strokeStyle = "#F7F0DC";
  ctx.fillStyle = "#F7F0DC";
  shapes(0);
  // nail
  ctx.fillStyle = "rgba(200,190,170,0.6)";
  ctx.beginPath();
  ctx.ellipse(w * 0.36, h * 0.1, w * 0.06, h * 0.035, 0, 0, TAU);
  ctx.fill();
  ctx.lineCap = "butt";
}

/** Tap ripple for the ghost finger. */
export function drawTapRipple(ctx: Ctx, s: number, lw: number): void {
  ctx.strokeStyle = "rgba(244,235,208,0.95)";
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s / 2 - lw, 0, TAU);
  ctx.stroke();
}

/** Small "lift" arrow above a lantern the hint wants back (up arrow, cool, dark rim). */
export function drawLiftArrow(ctx: Ctx, s: number): void {
  const cx = s / 2;
  const path = (): void => {
    ctx.beginPath();
    ctx.moveTo(cx, s * 0.12);
    ctx.lineTo(cx + s * 0.32, s * 0.48);
    ctx.lineTo(cx + s * 0.13, s * 0.48);
    ctx.lineTo(cx + s * 0.13, s * 0.86);
    ctx.lineTo(cx - s * 0.13, s * 0.86);
    ctx.lineTo(cx - s * 0.13, s * 0.48);
    ctx.lineTo(cx - s * 0.32, s * 0.48);
    ctx.closePath();
  };
  ctx.lineJoin = "round";
  path();
  ctx.strokeStyle = "rgba(8,14,40,0.9)";
  ctx.lineWidth = s * 0.12;
  ctx.stroke();
  const g = ctx.createLinearGradient(0, s * 0.12, 0, s * 0.86);
  g.addColorStop(0, "#FFFFFF");
  g.addColorStop(1, "#A9CCEB");
  ctx.fillStyle = g;
  path();
  ctx.fill();
}

/** Forward chevron (next house), pale with a soft glow. */
export function drawChevron(ctx: Ctx, s: number): void {
  drawGlow(ctx, s / 2, s / 2, s / 2, [[0, rgba(PAL.moon, 0.35)], [1, rgba(PAL.moon, 0)]]);
  ctx.strokeStyle = PAL.moon;
  ctx.lineWidth = s * 0.11;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(s * 0.4, s * 0.26);
  ctx.lineTo(s * 0.64, s * 0.5);
  ctx.lineTo(s * 0.4, s * 0.74);
  ctx.stroke();
}

/** Gear (settings), moonlight stroke, `s` px square. */
export function drawGear(ctx: Ctx, s: number): void {
  // v9 HUD grammar: the gear as a stroked outline (same 2.25 pt round stroke as the disc glyphs)
  const cx = s / 2;
  const cy = s / 2;
  const ro = s * 0.4;
  const ri = s * 0.3;
  const teeth = 8;
  ctx.beginPath();
  for (let k = 0; k < teeth * 2; k++) {
    const a0 = (k / (teeth * 2)) * TAU - TAU / (teeth * 4);
    const a1 = ((k + 1) / (teeth * 2)) * TAU - TAU / (teeth * 4);
    const r = k % 2 === 0 ? ro : ri;
    if (k === 0) ctx.moveTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r);
    else ctx.lineTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r);
    ctx.lineTo(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
  }
  ctx.closePath();
  ctx.strokeStyle = PAL.moon;
  ctx.lineWidth = Math.max(1.5, s * 0.094 * (vis.p.boldText ? 1.2 : 1));
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.12, 0, TAU);
  ctx.stroke();
  ctx.lineJoin = "miter";
}

/** Speaker (sound on) or speaker with a cross (sound off), `w`×`h` px, in `color`. */
export function drawSpeaker(ctx: Ctx, w: number, h: number, muted: boolean, color: string = PAL.moon): void {
  const k = h / 18;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.7 * k;
  ctx.lineCap = "round";
  const x0 = w / 2 - 11 * k;
  ctx.beginPath();
  ctx.moveTo(x0 + 2 * k, h * 0.36);
  ctx.lineTo(x0 + 6 * k, h * 0.36);
  ctx.lineTo(x0 + 11 * k, h * 0.12);
  ctx.lineTo(x0 + 11 * k, h * 0.88);
  ctx.lineTo(x0 + 6 * k, h * 0.64);
  ctx.lineTo(x0 + 2 * k, h * 0.64);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  if (muted) {
    ctx.moveTo(x0 + 14 * k, h * 0.3);
    ctx.lineTo(x0 + 21 * k, h * 0.7);
    ctx.moveTo(x0 + 21 * k, h * 0.3);
    ctx.lineTo(x0 + 14 * k, h * 0.7);
  } else {
    ctx.arc(x0 + 11 * k, h / 2, 5 * k, -0.7, 0.7);
    ctx.moveTo(x0 + 11 * k + 9 * k * Math.cos(-0.7), h / 2 + 9 * k * Math.sin(-0.7));
    ctx.arc(x0 + 11 * k, h / 2, 9 * k, -0.7, 0.7);
  }
  ctx.stroke();
  ctx.lineCap = "butt";
}

/** Settings sheet card. */
export function drawPanel(ctx: Ctx, w: number, h: number, r: number, u: number, grabber = true): void {
  ctx.fillStyle = "rgba(4,5,14,0.5)";
  rrectPath(ctx, 0, 4 * u, w, h - 4 * u, r);
  ctx.fill();
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#2A2F55");
  g.addColorStop(1, "#1B1F3C");
  ctx.fillStyle = g;
  rrectPath(ctx, 0, 0, w, h - 4 * u, r);
  ctx.fill();
  ctx.strokeStyle = rgba(PAL.moon, 0.28);
  ctx.lineWidth = Math.max(1, 1.2 * u);
  rrectPath(ctx, 0.5 * u, 0.5 * u, w - u, h - 5 * u, r);
  ctx.stroke();
  // grabber (bottom sheets only: a centred card that cannot be dragged has none — Reality #17)
  if (!grabber) return;
  ctx.fillStyle = rgba(PAL.moon, 0.35);
  rrectPath(ctx, w / 2 - 18 * u, 8 * u, 36 * u, 4 * u, 2 * u);
  ctx.fill();
}

/** One segment of a two-way choice (selected = warm rim + lifted fill). */
export function drawSegment(ctx: Ctx, w: number, h: number, r: number, u: number, selected: boolean): void {
  rrectPath(ctx, u, u, w - 2 * u, h - 2 * u, r);
  ctx.fillStyle = selected ? "#3B3F6A" : "rgba(10,12,30,0.45)";
  ctx.fill();
  ctx.strokeStyle = selected ? PAL.flame : rgba(PAL.moon, 0.22);
  ctx.lineWidth = (selected ? 2.4 : 1.2) * u;
  ctx.stroke();
}

/**
 * House number plate (level number, in-world): enamel plate with a dark rim.
 * gentle = cream plate, deduce = moonlit blue plate. Digits are a live Text on top.
 */
export function drawPlate(ctx: Ctx, w: number, h: number, u: number, track: "gentle" | "deduce"): void {
  const r = h * 0.3;
  ctx.fillStyle = "rgba(4,5,14,0.55)";
  rrectPath(ctx, 0, 2 * u, w, h - 2 * u, r);
  ctx.fill();
  ctx.fillStyle = "#140F24";
  rrectPath(ctx, 0, 0, w, h - 2 * u, r);
  ctx.fill();
  const g = ctx.createLinearGradient(0, 0, 0, h);
  if (track === "gentle") {
    g.addColorStop(0, "#FBF3DC");
    g.addColorStop(1, "#E6D7B0");
  } else {
    g.addColorStop(0, "#E4EEF8");
    g.addColorStop(1, "#B7CBE0");
  }
  ctx.fillStyle = g;
  rrectPath(ctx, 1.5 * u, 1.5 * u, w - 3 * u, h - 5 * u, r * 0.8);
  ctx.fill();
}
