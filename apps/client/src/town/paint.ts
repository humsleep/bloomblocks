// Canvas2D painters for the lit street. They run once per baked texture (the
// backdrop once per open, a street chunk whenever it scrolls into range) — never
// per frame. Coordinates are in pt; the caller sets a pt → texture-px transform.
// Everything is drawn in code (no assets), reusing the main scene's house painter
// and palette so each house looks like the one the player lit.
import { drawGlow, drawKeepRibbon, drawLantern, drawMoonPhase, drawPlate, GLOW, mix, rrectPath, type Ctx } from "../render/draw.ts";
import { scaledPt, vis } from "../render/vis.ts";
import { drawHouse, drawWindowPane, type HouseSpec } from "../render/house.ts";
import { PAL, rgba } from "../render/palette.ts";
import { drawNumerals } from "../render/glyphs.ts";
import { hashStr, rng } from "../render/rng.ts";
import type { Keepsake, Landmark, Street, StreetHouse, StreetItem } from "./layout.ts";

const TAU = Math.PI * 2;

export interface TownGeom {
  /** screen size, pt */
  W: number;
  H: number;
  safeTop: number;
  safeBottom: number;
  /** pt per hu (house body width) */
  S: number;
  /** staging unit for the backdrop (far ridge, tower), pt — independent of the house scale */
  V: number;
  /** street baseline (house bottoms), pt from the top */
  yb: number;
  /** top of the street chunks, pt */
  top: number;
  /** street chunk width, pt */
  CW: number;
}

export function townGeom(W: number, H: number, safeTop: number, safeBottom: number): TownGeom {
  // phase 2b: houses small enough that the first view shows several lit houses side by side
  // ("my lit street" at a glance: ≈ 3 houses across a phone) …
  // v10 (coordinator round 2): bigger houses so the street fills the lower half with depth
  // (≈ 2½ houses across; layered far houses and a foreground fence carry the rest)
  const S = Math.round(Math.max(84, Math.min(118, W * 0.25)));
  // … while the backdrop keeps the phase-2 staging (audit P2-15: the ridge and the tower stand
  // high enough that the upper sky is not an empty band)
  const V = Math.round(1.3 * Math.max(90, Math.min(132, W * 0.27)));
  // road band (0.5 S) ends just above the home button (56 pt, 12 pt off the safe bottom)
  const yb = Math.round(H - safeBottom - 68 - 16 - 0.5 * S);
  return { W, H, safeTop, safeBottom, S, V, yb, top: Math.floor(yb - 2.75 * S), CW: Math.ceil(W) };
}

const SIL = "#1A1631";
const INK = "#0E0B1A";
const h32 = (a: number, b: number): number => hashStr(`${a}:${b}`);

// ---------------------------------------------------------------- backdrop

function hillY(x: number, W: number, base: number, amp: number, phase: number, freq: number): number {
  const t = x / W;
  return base - amp * (0.6 * Math.sin(t * Math.PI * freq + phase) + 0.4 * Math.sin(t * Math.PI * freq * 2.3 + phase * 1.7));
}

function hill(ctx: Ctx, W: number, H: number, base: number, amp: number, phase: number, freq: number, fill: string | CanvasGradient): void {
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let i = 0; i <= 48; i++) {
    const x = (W * i) / 48;
    ctx.lineTo(x, hillY(x, W, base, amp, phase, freq));
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

export interface TowerInfo {
  /** window centres (pt), bottom floor first; the first `lit` are lit */
  windows: { x: number; y: number; w: number; h: number }[];
  lit: number;
  beacon: { x: number; y: number } | null;
}

/** Tower floors / windows for `d` cleared deduce levels: it grows with progress, always a few dark windows above. */
export function towerPlan(d: number): { floors: number; windows: number; beacon: boolean } {
  const floors = Math.max(4, Math.min(12, Math.ceil(d / 2) + 2));
  return { floors, windows: floors * 2, beacon: d >= 24 };
}

/** The tower is open after gentle 5 or once a deduce level is done (mirror of the main scene's rule, minus its guide bit). */
export function towerUnlocked(gentle: number, deduce: number): boolean {
  return gentle >= 5 || deduce > 0;
}

/**
 * Fixed backdrop: dusk sky, stars, today's moon, the far hill with the deduce
 * track's tower (one window per cleared deduce level), the mid hill behind the street.
 */
export function paintBackdrop(ctx: Ctx, g: TownGeom, deduce: number, gentle: number, moonP: number): TowerInfo {
  const { W, H, S, V, yb } = g;
  const sky = ctx.createLinearGradient(0, 0, 0, yb);
  sky.addColorStop(0, PAL.skyNight);
  sky.addColorStop(0.45, PAL.skyDusk);
  sky.addColorStop(0.8, mix(PAL.skyDusk, PAL.skyHorizon, 0.55));
  sky.addColorStop(1, PAL.skyHorizon);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  const haze = ctx.createRadialGradient(W * 0.6, yb - 1.6 * V, 0, W * 0.6, yb - 1.6 * V, W * 0.8);
  haze.addColorStop(0, rgba(PAL.skyGlow, 0.3));
  haze.addColorStop(1, rgba(PAL.skyGlow, 0));
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, W, H);
  const r = rng(0x70a1);
  for (let i = 0; i < 34; i++) {
    const x = r() * W;
    const y = g.safeTop + r() * (yb - 2.6 * V - g.safeTop) * 0.8;
    ctx.fillStyle = rgba(PAL.moon, 0.2 + r() * 0.5);
    ctx.beginPath();
    ctx.arc(x, y, 0.6 + r() * 0.9, 0, TAU);
    ctx.fill();
  }
  // v10: two long moonlit cloud wisps give the upper sky a texture (no empty band)
  for (const [cyK, cxK, wK, a] of [[0.3, 0.32, 0.9, 0.1], [0.46, 0.7, 0.7, 0.08]] as const) {
    const cy = g.safeTop + (yb - g.safeTop) * cyK;
    const cx = W * cxK;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, 0.12);
    drawGlow(ctx, 0, 0, W * wK * 0.5, [[0, `rgba(216,180,200,${a})`], [0.6, `rgba(200,170,196,${a * 0.5})`], [1, "rgba(200,170,196,0)"]]);
    ctx.restore();
  }
  const ms = 85;
  ctx.save();
  ctx.translate(W * 0.8 - ms / 2, g.safeTop + 46 - ms / 2);
  drawMoonPhase(ctx, ms, moonP, true);
  ctx.restore();

  // far ridge + tower
  // phase 2: the ridge sits nearer the mid hill (no flat band between them at the 1.3× street)
  // (the ridge comes down a little toward the smaller houses: no flat band between the hills)
  const farBase = yb - 1.3 * V - 0.35 * S; // v10: the ridge rises with the bigger street
  hill(ctx, W, H, farBase, 12, 1.2, 1.5, mix(PAL.hillFar, PAL.skyHorizon, 0.22));
  const tx = W * 0.27;
  const tower = paintTower(ctx, tx, hillY(tx, W, farBase, 12, 1.2, 1.5) + 6, V, deduce, towerUnlocked(gentle, deduce));
  // a few tiny far houses on the ridge (scale cue for the tower)
  for (const fx of [0.04, 0.1, 0.15, 0.42, 0.49, 0.56, 0.63, 0.74, 0.83, 0.92]) {
    const x = W * fx;
    const y = hillY(x, W, farBase, 12, 1.2, 1.5) + 3;
    const hw = 9 + (fx * 37) % 5;
    ctx.fillStyle = mix(PAL.hillFar, PAL.roof, 0.4);
    ctx.fillRect(x - hw / 2, y - hw * 0.7, hw, hw);
    ctx.beginPath();
    ctx.moveTo(x - hw / 2 - 1.5, y - hw * 0.7);
    ctx.lineTo(x, y - hw * 1.2);
    ctx.lineTo(x + hw / 2 + 1.5, y - hw * 0.7);
    ctx.closePath();
    ctx.fill();
    if ((fx * 100) % 3 < 1.4) {
      // a far window lit (atmospheric perspective: small, soft)
      drawGlow(ctx, x, y - hw * 0.35, hw * 0.9, GLOW.window);
      ctx.fillStyle = rgba(PAL.windowLit, 0.85);
      ctx.fillRect(x - 1.3, y - hw * 0.45, 2.6, 2.6);
    }
  }
  // mid hill behind the street
  const midBase = yb - 1.1 * S - 0.2 * (V - S);
  const mg = ctx.createLinearGradient(0, midBase - 20, 0, yb + 40);
  mg.addColorStop(0, PAL.hillMid);
  mg.addColorStop(1, PAL.hillNear);
  // a few round trees on the mid-hill crest (texture for the band behind the roofs)
  const tr = rng(0x7ee5);
  for (let i = 0; i < 9; i++) {
    const x = W * (0.03 + 0.94 * ((i + 0.2 + tr() * 0.6) / 9));
    const y = hillY(x, W, midBase, 9, 2.6, 1.2) + 4;
    const rr = (0.1 + tr() * 0.08) * S;
    ctx.fillStyle = mix(PAL.hillMid, PAL.roof, 0.25 + tr() * 0.2);
    ctx.beginPath();
    ctx.arc(x, y - rr * 0.9, rr, 0, TAU);
    ctx.arc(x + rr * 0.7, y - rr * 0.5, rr * 0.75, 0, TAU);
    ctx.arc(x - rr * 0.7, y - rr * 0.45, rr * 0.7, 0, TAU);
    ctx.fill();
  }
  // v10: a back street on the mid hill — a row of house silhouettes between the ridge and the
  // street (depth), a third of them with a lit window; the street's roofs overlap their feet
  {
    const br = rng(0xbac5);
    const n = Math.max(5, Math.round(W / (0.62 * S)));
    for (let i = 0; i < n; i++) {
      const x = W * ((i + 0.15 + br() * 0.7) / n);
      const y = hillY(x, W, midBase, 9, 2.6, 1.2) + 6;
      const hw = (0.3 + br() * 0.14) * S;
      const hh = hw * (0.75 + br() * 0.4);
      const roof = hw * (0.4 + br() * 0.25);
      ctx.fillStyle = mix(PAL.hillMid, PAL.roof, 0.45);
      ctx.fillRect(x - hw / 2, y - hh, hw, hh + 6);
      ctx.beginPath();
      ctx.moveTo(x - hw / 2 - 2, y - hh + 1);
      ctx.lineTo(x, y - hh - roof);
      ctx.lineTo(x + hw / 2 + 2, y - hh + 1);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rgba(PAL.wallRim, 0.16);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y - hh - roof);
      ctx.lineTo(x + hw / 2 + 2, y - hh + 1);
      ctx.stroke();
      if (br() < 0.4) {
        const wx = x + (br() - 0.5) * hw * 0.4;
        const wy = y - hh * 0.6;
        drawGlow(ctx, wx, wy, hw * 0.45, GLOW.window);
        ctx.fillStyle = PAL.windowLit;
        ctx.fillRect(wx - hw * 0.07, wy - hw * 0.08, hw * 0.14, hw * 0.16);
      } else {
        ctx.fillStyle = rgba(PAL.windowDark, 0.8);
        ctx.fillRect(x - hw * 0.07, y - hh * 0.68, hw * 0.14, hw * 0.16);
      }
    }
  }
  hill(ctx, W, H, midBase + 0.12 * S, 9, 2.6, 1.2, mg);
  ctx.strokeStyle = rgba(PAL.plum, 0.18);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 48; i++) {
    const x = (W * i) / 48;
    const y = hillY(x, W, midBase, 9, 2.6, 1.2);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  return tower;
}

function paintTower(ctx: Ctx, cx: number, base: number, S: number, d: number, unlocked: boolean): TowerInfo {
  // same silhouette as the main scene's far tower (render/draw.ts drawFarTower): tapered stone
  // body, gallery, glass lantern room, cone roof — plus one window per cleared deduce level
  const plan = towerPlan(d);
  const fh = 0.125 * S;
  const bw = 0.4 * S;
  const tw = 0.3 * S;
  const bodyH = plan.floors * fh + 0.3 * S;
  const top = base - bodyH;
  ctx.fillStyle = mix(PAL.hillFar, PAL.roof, 0.42);
  ctx.beginPath();
  ctx.moveTo(cx - bw / 2, base + 4);
  ctx.lineTo(cx - tw / 2, top);
  ctx.lineTo(cx + tw / 2, top);
  ctx.lineTo(cx + bw / 2, base + 4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgba(PAL.wallRim, 0.5);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx - bw / 2, base + 4);
  ctx.lineTo(cx - tw / 2, top);
  ctx.stroke();
  // gallery
  ctx.fillStyle = PAL.roof;
  ctx.fillRect(cx - tw * 0.72, top - 0.03 * S, tw * 1.44, 0.045 * S);
  // lantern room: glass, lit once the tower is open
  const lrH = 0.2 * S;
  const lrY = top - 0.03 * S - lrH;
  ctx.fillStyle = PAL.windowFrame;
  ctx.fillRect(cx - tw * 0.46, lrY, tw * 0.92, lrH);
  if (unlocked) drawGlow(ctx, cx, lrY + lrH / 2, 0.42 * S, GLOW.flame);
  ctx.fillStyle = unlocked ? PAL.windowLitCore : PAL.windowDark;
  ctx.fillRect(cx - tw * 0.34, lrY + lrH * 0.1, tw * 0.68, lrH * 0.8);
  ctx.strokeStyle = PAL.windowFrame;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, lrY);
  ctx.lineTo(cx, lrY + lrH);
  ctx.stroke();
  // cone roof + finial
  ctx.fillStyle = PAL.roof;
  ctx.beginPath();
  ctx.moveTo(cx - tw * 0.62, lrY + 0.01 * S);
  ctx.lineTo(cx, lrY - 0.17 * S);
  ctx.lineTo(cx + tw * 0.62, lrY + 0.01 * S);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgba(PAL.wallRim, 0.5);
  ctx.fillRect(cx - 0.5, lrY - 0.22 * S, 1.5, 0.06 * S);
  // door
  ctx.fillStyle = PAL.windowFrame;
  rrectPath(ctx, cx - 0.065 * S, base - 0.2 * S, 0.13 * S, 0.21 * S, 0.05 * S);
  ctx.fill();
  // windows: two per floor, lit from the bottom
  const windows: TowerInfo["windows"] = [];
  const ww = 0.07 * S;
  const wh = 0.085 * S;
  for (let f = 0; f < plan.floors; f++) {
    const y = base - 0.36 * S - f * fh;
    for (const sx of [-1, 1]) windows.push({ x: cx + sx * tw * 0.2, y, w: ww, h: wh });
  }
  const lit = Math.min(d, windows.length);
  windows.forEach((w, i) => {
    if (i < lit) drawGlow(ctx, w.x, w.y, ww * 2.2, GLOW.window);
    drawWindowPane(ctx, w.x, w.y, w.w, w.h, false, i < lit);
  });
  const beacon = plan.beacon ? { x: cx, y: lrY + lrH / 2 } : null;
  if (beacon) drawGlow(ctx, beacon.x, beacon.y, 0.6 * S, GLOW.flame);
  // plate = the tower's current level, the same number the main scene shows on it
  if (unlocked) plate(ctx, cx, base - 0.13 * S, String(d + 1), scaledPt(13, 22), "deduce");
  return { windows, lit, beacon };
}

/** Number plate (digits only), centred on (cx, cy). */
function plate(ctx: Ctx, cx: number, cy: number, label: string, fpt: number, track: "gentle" | "deduce"): void {
  const ph = Math.round(fpt + 6);
  const pw = Math.round(Math.max(fpt * 1.7, fpt * 0.62 * label.length + 10));
  ctx.save();
  ctx.translate(cx - pw / 2, cy - ph / 2);
  drawPlate(ctx, pw, ph, 1, track);
  // v9: the Duskwick numerals (src/render/glyphs.ts), same as the house plate and the board
  drawNumerals(ctx, label, pw / 2, (ph - 2) / 2, fpt * 0.72, "#1E1A33", null, vis.p.boldText ? 1.25 : 1.08);
  ctx.restore();
}

// ---------------------------------------------------------------- street chunk

let scratch: HTMLCanvasElement | null = null;

/** Draw `fn` (pt space) as a flat silhouette with a faint moonlit rim. */
function silhouette(ctx: Ctx, q: number, bx: number, by: number, bw: number, bh: number, fn: (c: Ctx) => void): void {
  scratch ??= document.createElement("canvas");
  const w = Math.max(1, Math.ceil(bw * q));
  const h = Math.max(1, Math.ceil(bh * q));
  if (scratch.width < w || scratch.height < h) {
    scratch.width = Math.max(scratch.width, w);
    scratch.height = Math.max(scratch.height, h);
  }
  const c = scratch.getContext("2d")!;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = "source-over";
  c.clearRect(0, 0, w, h);
  c.setTransform(q, 0, 0, q, -bx * q, -by * q);
  fn(c);
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = "source-in";
  c.fillStyle = PAL.wallRim;
  c.fillRect(0, 0, w, h);
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.drawImage(scratch, 0, 0, w, h, bx - 0.8, by - 0.8, w / q, h / q);
  ctx.restore();
  c.fillStyle = SIL;
  c.fillRect(0, 0, w, h);
  ctx.drawImage(scratch, 0, 0, w, h, bx, by, w / q, h / q);
  c.globalCompositeOperation = "source-over";
}

function road(ctx: Ctx, g: TownGeom, x0: number, x1: number): void {
  const { S, yb, H } = g;
  const rb = yb + 0.5 * S;
  const rg = ctx.createLinearGradient(0, yb - 0.02 * S, 0, rb);
  rg.addColorStop(0, mix(PAL.ground, PAL.stone, 0.22));
  rg.addColorStop(1, mix(PAL.ground, PAL.stone, 0.08));
  ctx.fillStyle = rg;
  ctx.fillRect(x0, yb - 0.02 * S, x1 - x0, rb - yb + 0.02 * S);
  // cobbles: rows grow toward the viewer; colours from a hash of (row, col) so chunks join seamlessly
  const tones = [mix(PAL.stoneLo, PAL.ground, 0.35), mix(PAL.stoneLo, PAL.ground, 0.15), mix(PAL.stone, PAL.ground, 0.45)];
  let y = yb + 0.015 * S;
  for (let row = 0; row < 4; row++) {
    const rh = (0.085 + row * 0.022) * S;
    const sw = (0.16 + row * 0.03) * S;
    const off = (row % 2) * sw * 0.5;
    const c0 = Math.floor((x0 - off) / sw) - 1;
    const c1 = Math.ceil((x1 - off) / sw) + 1;
    for (let t = 0; t < 3; t++) {
      ctx.fillStyle = tones[t]!;
      ctx.beginPath();
      for (let c = c0; c <= c1; c++) {
        if (h32(row, c) % 3 !== t) continue;
        const sx = c * sw + off;
        const j = ((h32(c, row + 7) % 100) / 100 - 0.5) * 0.12 * sw;
        ctx.roundRect(sx + 0.06 * sw + j, y + rh * 0.1, sw * 0.86, rh * 0.8, rh * 0.35);
      }
      ctx.fill();
    }
    y += rh;
  }
  // curb + verge down to the screen bottom
  ctx.fillStyle = mix(PAL.stoneLo, PAL.ground, 0.5);
  ctx.fillRect(x0, rb - 0.02 * S, x1 - x0, 0.05 * S);
  const vg = ctx.createLinearGradient(0, rb, 0, H);
  vg.addColorStop(0, PAL.hillNear);
  vg.addColorStop(0.35, PAL.ground);
  vg.addColorStop(1, PAL.groundDeep);
  ctx.fillStyle = vg;
  ctx.fillRect(x0, rb + 0.03 * S, x1 - x0, H - rb);
  ctx.fillStyle = mix(PAL.hillNear, PAL.moss, 0.2);
  const tw = 0.11 * S;
  for (let c = Math.floor(x0 / tw) - 1; c <= Math.ceil(x1 / tw) + 1; c++) {
    const hsh = h32(c, 99);
    if (hsh % 3 === 0) continue;
    const x = c * tw + (hsh % 17) / 17 * tw;
    const ty = rb + 0.05 * S;
    const ht = (0.04 + ((hsh >>> 5) % 9) / 100) * S;
    ctx.beginPath();
    ctx.moveTo(x - 0.02 * S, ty + 0.01 * S);
    ctx.quadraticCurveTo(x, ty - ht, x + 0.025 * S, ty - ht * 1.05);
    ctx.quadraticCurveTo(x + 0.005 * S, ty - ht * 0.4, x + 0.02 * S, ty + 0.01 * S);
    ctx.closePath();
    ctx.fill();
  }
  // (no bushes on the verge: alone below the street they read as a button next to home)
  // v10 foreground: a continuous low picket fence in silhouette along the verge (depth cue; one
  // long shape, so it never reads as a button)
  const fy = rb + 0.2 * S;
  const fh = 0.2 * S;
  ctx.fillStyle = "rgba(10,8,22,0.92)";
  ctx.fillRect(x0, fy - fh * 0.62, x1 - x0, 0.03 * S);
  ctx.fillRect(x0, fy - fh * 0.25, x1 - x0, 0.03 * S);
  const pw = 0.13 * S;
  for (let c = Math.floor(x0 / pw) - 1; c <= Math.ceil(x1 / pw) + 1; c++) {
    const x = c * pw;
    const hj = ((h32(c, 41) % 100) / 100) * 0.04 * S;
    ctx.beginPath();
    ctx.moveTo(x - 0.022 * S, fy + 0.05 * S);
    ctx.lineTo(x - 0.022 * S, fy - fh + 0.02 * S + hj);
    ctx.lineTo(x, fy - fh - 0.01 * S + hj);
    ctx.lineTo(x + 0.022 * S, fy - fh + 0.02 * S + hj);
    ctx.lineTo(x + 0.022 * S, fy + 0.05 * S);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = rgba(PAL.moon, 0.12);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, fy - fh * 0.62);
  ctx.lineTo(x1, fy - fh * 0.62);
  ctx.stroke();
}

/** Warm light pool on the cobbles. */
function pool(ctx: Ctx, x: number, yb: number, S: number, w: number, a = 1): void {
  ctx.save();
  ctx.translate(x, yb + 0.12 * S);
  ctx.scale(1, 0.3);
  ctx.globalAlpha = a;
  drawGlow(ctx, 0, 0, w * S, [[0, "rgba(255,200,110,0.42)"], [0.5, "rgba(255,180,90,0.14)"], [1, "rgba(255,170,80,0)"]]);
  ctx.restore();
}

function litHouse(ctx: Ctx, h: StreetHouse, g: TownGeom): void {
  const s = g.S * h.scale;
  const X = h.x * g.S;
  const yb = g.yb;
  const sp = h.spec;
  // keepsakes that sit behind the body
  for (const k of h.keepsakes) if (k === "laundry") laundry(ctx, sp, X, yb, s, h.n);
  drawHouse(ctx, sp, X, yb, s);
  for (const w of sp.windows) {
    const cx = X + w.x * s;
    const cy = yb + w.y * s;
    drawGlow(ctx, cx, cy, Math.max(w.w, w.h) * s * 1.7, GLOW.window);
    drawWindowPane(ctx, cx, cy, w.w * s, w.h * s, w.round, true);
  }
  for (const k of h.keepsakes) if (k !== "laundry") keepsake(ctx, k, sp, X, yb, s, h.n);
  const d = sp.door;
  // Dynamic Type: 14 pt at the default size, up to 24 pt (audit P1-6; v6 was 9–13 pt)
  const fpt = scaledPt(14, 24);
  plate(ctx, X + d.x * s, Math.max(yb - d.h * s * 0.66, yb - d.h * s + (fpt + 6) / 2 + 1), String(h.n), fpt, "gentle");
}

function houseBox(h: StreetHouse, g: TownGeom): { x: number; y: number; w: number; h: number } {
  const s = g.S * h.scale;
  return { x: h.x * g.S - h.spec.left * s - 2, y: g.yb - h.spec.top * s - 2, w: (h.spec.left + h.spec.right) * s + 4, h: (h.spec.top + 0.04) * s + 4 };
}

function itemHalfW(kind: StreetItem["kind"]): number {
  return kind === "lamp" ? 0.2 : kind === "bridge" ? 1.0 : kind === "bellTower" ? 0.4 : 0.8;
}
function itemTop(kind: StreetItem["kind"]): number {
  return kind === "lamp" ? 0.95 : kind === "bellTower" ? 2.5 : kind === "windmill" ? 2.4 : kind === "tree" ? 1.85 : kind === "bandstand" ? 1.5 : 1.0;
}

/** Paint the street strip [x0, x0 + CW) (pt) — the caller set the pt → px transform. */
export function paintChunk(ctx: Ctx, street: Street, g: TownGeom, x0: number, q: number): void {
  const x1 = x0 + g.CW;
  const { S, yb } = g;
  road(ctx, g, x0, x1);
  const inRange = (a: number, b: number): boolean => b >= x0 - 2 && a <= x1 + 2;
  // light pools first (on the cobbles, under everything)
  for (const h of street.houses) if (h.lit && inRange((h.x - 1.2) * S, (h.x + 1.2) * S)) pool(ctx, h.x * S, yb, S, 0.95);
  for (const it of street.items) if (it.lit && it.kind === "lamp" && inRange((it.x - 1) * S, (it.x + 1) * S)) pool(ctx, it.x * S, yb, S, 0.75, 1);
  // v9: a lit landmark throws its own light on the cobbles too (the visit's "after" frame)
  for (const it of street.items) if (it.lit && it.kind !== "lamp" && inRange((it.x - 1.6) * S, (it.x + 1.6) * S)) pool(ctx, it.x * S, yb, S, 1.1 * it.scale, 0.85);
  // gap items behind the houses' neighbours: draw items first, then houses
  for (const it of street.items) {
    const hw = itemHalfW(it.kind) * S * it.scale;
    if (!inRange(it.x * S - hw, it.x * S + hw)) continue;
    if (it.lit) paintItem(ctx, it, g);
    else {
      const top = itemTop(it.kind) * S * it.scale;
      silhouette(ctx, q, it.x * S - hw - 2, yb - top - 2, hw * 2 + 4, top + 0.06 * S + 4, (c) => paintItem(c, it, g, true));
    }
  }
  for (const h of street.houses) {
    const b = houseBox(h, g);
    if (!inRange(b.x, b.x + b.w)) continue;
    if (h.lit) litHouse(ctx, h, g);
    else silhouette(ctx, q, b.x, b.y, b.w, b.h, (c) => drawHouse(c, h.spec, h.x * S, yb, S * h.scale));
  }
  festival(ctx, street, g, x0, x1);
  // the street fades into the dark past the last house (only over painted pixels)
  const endA = (street.length - 1.6) * S;
  if (x1 > endA) {
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    const fg = ctx.createLinearGradient(endA, 0, street.length * S + 0.3 * S, 0);
    fg.addColorStop(0, "rgba(15,17,36,0)");
    fg.addColorStop(1, "rgba(15,17,36,0.85)");
    ctx.fillStyle = fg;
    ctx.fillRect(Math.max(x0, endA), g.top, x1 - Math.max(x0, endA), g.H - g.top);
    ctx.restore();
  }
}

function festival(ctx: Ctx, street: Street, g: TownGeom, x0: number, x1: number): void {
  const { S, yb } = g;
  ctx.strokeStyle = rgba(PAL.moon, 0.5);
  ctx.lineWidth = 1;
  for (const sw of street.swags) {
    if (sw.bx * S < x0 - 4 || sw.ax * S > x1 + 4) continue;
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const x = sw.ax + (sw.bx - sw.ax) * t;
      const y = sw.ay + (sw.by - sw.ay) * t + sw.sag * 4 * t * (1 - t);
      if (i === 0) ctx.moveTo(x * S, yb + y * S);
      else ctx.lineTo(x * S, yb + y * S);
    }
    ctx.stroke();
  }
  const lh = 0.2 * S;
  for (const l of street.lanterns) {
    const x = l.x * S;
    if (x < x0 - lh || x > x1 + lh) continue;
    const y = yb + l.y * S;
    ctx.strokeStyle = rgba(PAL.moon, 0.4);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + 0.035 * S);
    ctx.stroke();
    const ty = y + 0.03 * S;
    if (l.state === "lit") drawGlow(ctx, x, ty + lh * 0.56, lh * 1.5, GLOW.halo);
    ctx.save();
    ctx.translate(x - lh * 0.4, ty);
    if (l.state === "waiting") ctx.globalAlpha = 0.55;
    drawLantern(ctx, lh, l.state === "lit" ? 1 : 0);
    ctx.restore();
    if (l.state === "covered") cover(ctx, x, ty, lh);
    if (l.state === "waiting") {
      // empty: no flame, a faint moonlit outline so it reads as "tonight's lantern"
      ctx.strokeStyle = rgba(PAL.moon, 0.55);
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.ellipse(x, ty + lh * 0.56, lh * 0.4, lh * 0.37, 0, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

/** Kept day (a shield covered it): the unlit lantern carries the moon-blue bookmark ribbon — the result sheet's shield. */
function cover(ctx: Ctx, x: number, ty: number, lh: number): void {
  drawKeepRibbon(ctx, x, ty, lh);
}

// ---------------------------------------------------------------- milestones

function paintItem(ctx: Ctx, it: StreetItem, g: TownGeom, ghost = false): void {
  const s = g.S * it.scale;
  const cx = it.x * g.S;
  const yb = g.yb;
  switch (it.kind) {
    case "lamp":
      return lampPost(ctx, cx, yb, s, !ghost);
    case "fountain":
      return fountain(ctx, cx, yb, s, !ghost);
    case "bellTower":
      return bellTower(ctx, cx, yb, s, !ghost);
    case "bridge":
      return bridge(ctx, cx, yb, s, g, !ghost);
    case "tree":
      return tree(ctx, cx, yb, s, !ghost);
    case "windmill":
      return windmill(ctx, cx, yb, s, !ghost);
    case "bandstand":
      return bandstand(ctx, cx, yb, s, !ghost);
  }
}

/**
 * The street-visit lighting moment (for TownScene.stepVisit, k = 0 → 1 → 0 over the bloom):
 * a warm pool spreading on the cobbles under the item plus a soft bloom on its light points.
 * Paint into an ADD layer (or a bake) in street pt space.
 */
export function paintItemBloom(ctx: Ctx, it: StreetItem, g: TownGeom, k: number): void {
  if (k <= 0) return;
  const s = g.S * it.scale;
  pool(ctx, it.x * g.S, g.yb, g.S, (0.6 + 0.8 * k) * it.scale, Math.min(1, k * 1.4));
  const pts = itemLights({ ...it, lit: true }, g.S, g.yb);
  if (pts.length === 0) pts.push({ x: it.x * g.S, y: g.yb - 0.7 * s, r: 0.6 * s });
  for (const p of pts) drawGlow(ctx, p.x, p.y, p.r * (1 + 1.4 * k), [[0, `rgba(255,226,160,${(0.55 * k).toFixed(3)})`], [0.4, `rgba(255,196,120,${(0.22 * k).toFixed(3)})`], [1, "rgba(255,170,90,0)"]]);
}

/** Glow points (pt) of lit milestones, for the live flicker sprites. */
export function itemLights(it: StreetItem, S: number, yb: number): { x: number; y: number; r: number }[] {
  if (!it.lit) return [];
  const s = S * it.scale;
  const cx = it.x * S;
  if (it.kind === "lamp") return [{ x: cx + 0.13 * s, y: yb - 0.8 * s, r: 0.5 * s }];
  if (it.kind === "bellTower") return [{ x: cx, y: yb - 1.45 * s, r: 0.4 * s }];
  if (it.kind === "bridge") return [{ x: cx - 0.86 * s, y: yb - 0.42 * s, r: 0.3 * s }, { x: cx + 0.86 * s, y: yb - 0.42 * s, r: 0.3 * s }];
  if (it.kind === "bandstand") return [{ x: cx, y: yb - 0.55 * s, r: 0.6 * s }];
  return [];
}

function lampPost(ctx: Ctx, cx: number, yb: number, s: number, lit: boolean): void {
  const top = yb - 0.8 * s;
  ctx.fillStyle = INK;
  ctx.fillRect(cx - 0.018 * s, top, 0.036 * s, 0.8 * s);
  ctx.fillRect(cx - 0.045 * s, yb - 0.06 * s, 0.09 * s, 0.06 * s);
  // curled arm
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.025 * s;
  ctx.beginPath();
  ctx.moveTo(cx, top + 0.04 * s);
  ctx.quadraticCurveTo(cx + 0.02 * s, top - 0.06 * s, cx + 0.13 * s, top - 0.05 * s);
  ctx.stroke();
  // lantern head
  const hx = cx + 0.13 * s;
  const hy = top;
  if (lit) drawGlow(ctx, hx, hy + 0.02 * s, 0.32 * s, GLOW.flame);
  ctx.fillStyle = INK;
  ctx.fillRect(hx - 0.055 * s, hy - 0.06 * s, 0.11 * s, 0.02 * s);
  ctx.fillStyle = lit ? PAL.windowLitCore : PAL.windowDark;
  ctx.fillRect(hx - 0.04 * s, hy - 0.04 * s, 0.08 * s, 0.1 * s);
  ctx.fillStyle = INK;
  ctx.fillRect(hx - 0.05 * s, hy + 0.06 * s, 0.1 * s, 0.018 * s);
}

function fountain(ctx: Ctx, cx: number, yb: number, s: number, lit: boolean): void {
  const stone = mix(PAL.stone, PAL.roof, 0.45);
  const rim = mix(PAL.stoneHi, PAL.roof, 0.35);
  // basin
  ctx.fillStyle = stone;
  ctx.beginPath();
  ctx.moveTo(cx - 0.62 * s, yb - 0.22 * s);
  ctx.lineTo(cx - 0.56 * s, yb);
  ctx.lineTo(cx + 0.56 * s, yb);
  ctx.lineTo(cx + 0.62 * s, yb - 0.22 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rim;
  ctx.fillRect(cx - 0.66 * s, yb - 0.26 * s, 1.32 * s, 0.05 * s);
  // column + upper bowl
  ctx.fillStyle = stone;
  ctx.fillRect(cx - 0.05 * s, yb - 0.62 * s, 0.1 * s, 0.4 * s);
  ctx.beginPath();
  ctx.moveTo(cx - 0.26 * s, yb - 0.66 * s);
  ctx.quadraticCurveTo(cx, yb - 0.5 * s, cx + 0.26 * s, yb - 0.66 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rim;
  ctx.fillRect(cx - 0.28 * s, yb - 0.69 * s, 0.56 * s, 0.035 * s);
  // water: a spout and arcs falling into the basin
  if (lit) drawGlow(ctx, cx, yb - 0.45 * s, 0.6 * s, [[0, rgba(PAL.conflict, 0.25)], [1, rgba(PAL.conflict, 0)]]);
  ctx.strokeStyle = rgba(PAL.moon, lit ? 0.7 : 0.4);
  ctx.lineWidth = Math.max(1, 0.018 * s);
  ctx.beginPath();
  ctx.moveTo(cx, yb - 0.7 * s);
  ctx.lineTo(cx, yb - 0.86 * s);
  for (const sx of [-1, 1]) {
    ctx.moveTo(cx, yb - 0.86 * s);
    ctx.quadraticCurveTo(cx + sx * 0.2 * s, yb - 0.92 * s, cx + sx * 0.27 * s, yb - 0.68 * s);
    ctx.moveTo(cx + sx * 0.27 * s, yb - 0.66 * s);
    ctx.quadraticCurveTo(cx + sx * 0.45 * s, yb - 0.6 * s, cx + sx * 0.5 * s, yb - 0.27 * s);
  }
  ctx.stroke();
}

function bellTower(ctx: Ctx, cx: number, yb: number, s: number, lit: boolean): void {
  const w = 0.5 * s;
  const H = 1.8 * s;
  const wall = mix(PAL.wall, PAL.stone, 0.18);
  const wg = ctx.createLinearGradient(0, yb - H, 0, yb);
  wg.addColorStop(0, wall);
  wg.addColorStop(1, mix(wall, PAL.roof, 0.5));
  ctx.fillStyle = wg;
  ctx.fillRect(cx - w / 2, yb - H, w, H);
  ctx.strokeStyle = rgba(PAL.wallRim, 0.4);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, yb);
  ctx.lineTo(cx - w / 2, yb - H);
  ctx.stroke();
  // belfry arch with the bell
  const by = yb - 1.5 * s;
  ctx.fillStyle = PAL.windowFrame;
  rrectPath(ctx, cx - 0.15 * s, by - 0.17 * s, 0.3 * s, 0.34 * s, 0.14 * s);
  ctx.fill();
  if (lit) drawGlow(ctx, cx, by + 0.02 * s, 0.32 * s, GLOW.window);
  ctx.fillStyle = lit ? PAL.flame : mix(PAL.flame, PAL.roof, 0.6);
  ctx.beginPath();
  ctx.moveTo(cx - 0.1 * s, by + 0.09 * s);
  ctx.quadraticCurveTo(cx - 0.08 * s, by - 0.1 * s, cx, by - 0.1 * s);
  ctx.quadraticCurveTo(cx + 0.08 * s, by - 0.1 * s, cx + 0.1 * s, by + 0.09 * s);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, by + 0.11 * s, 0.025 * s, 0, TAU);
  ctx.fill();
  // cornice + spire
  ctx.fillStyle = PAL.roof;
  ctx.fillRect(cx - w / 2 - 0.04 * s, yb - H - 0.05 * s, w + 0.08 * s, 0.06 * s);
  ctx.beginPath();
  ctx.moveTo(cx - w / 2 - 0.02 * s, yb - H - 0.04 * s);
  ctx.lineTo(cx, yb - H - 0.6 * s);
  ctx.lineTo(cx + w / 2 + 0.02 * s, yb - H - 0.04 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PAL.flame;
  ctx.beginPath();
  ctx.arc(cx, yb - H - 0.63 * s, 0.03 * s, 0, TAU);
  ctx.fill();
  // round clock-less window + door
  drawWindowPane(ctx, cx, yb - 0.95 * s, 0.13 * s, 0.13 * s, true, lit);
  ctx.fillStyle = PAL.windowFrame;
  rrectPath(ctx, cx - 0.08 * s, yb - 0.3 * s, 0.16 * s, 0.31 * s, 0.07 * s);
  ctx.fill();
}

function bridge(ctx: Ctx, cx: number, yb: number, s: number, g: TownGeom, lit: boolean): void {
  const hw = 0.82 * s;
  const rb = yb + 0.5 * g.S;
  // the stream runs toward the viewer under the road
  const wg = ctx.createLinearGradient(0, yb, 0, g.H);
  wg.addColorStop(0, "#1C2448");
  wg.addColorStop(1, "#0D1230");
  ctx.fillStyle = wg;
  ctx.beginPath();
  ctx.moveTo(cx - hw * 0.8, yb);
  ctx.lineTo(cx + hw * 0.8, yb);
  ctx.lineTo(cx + hw * 1.05, g.H);
  ctx.lineTo(cx - hw * 1.05, g.H);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgba(PAL.moon, 0.22);
  ctx.lineWidth = 1;
  const r = rng(hashStr(`bridge${cx | 0}`));
  ctx.beginPath();
  for (let k = 0; k < 9; k++) {
    const y = rb + 0.1 * s + r() * (g.H - rb - 0.2 * s);
    const x = cx + (r() - 0.5) * hw * 1.2;
    const l = (0.08 + r() * 0.14) * s;
    ctx.moveTo(x - l, y);
    ctx.lineTo(x + l, y);
  }
  ctx.stroke();
  // stone face with an arch, parapet on top
  const stone = mix(PAL.stone, PAL.roof, 0.5);
  ctx.fillStyle = stone;
  ctx.beginPath();
  ctx.moveTo(cx - hw - 0.08 * s, yb - 0.2 * s);
  ctx.lineTo(cx + hw + 0.08 * s, yb - 0.2 * s);
  ctx.lineTo(cx + hw + 0.08 * s, rb);
  ctx.lineTo(cx + hw * 0.62, rb);
  ctx.ellipse(cx, rb, hw * 0.62, 0.42 * g.S, 0, 0, Math.PI, true);
  ctx.lineTo(cx - hw - 0.08 * s, rb);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = mix(PAL.stoneHi, PAL.roof, 0.4);
  ctx.fillRect(cx - hw - 0.1 * s, yb - 0.24 * s, (hw + 0.1 * s) * 2, 0.05 * s);
  ctx.strokeStyle = rgba(PAL.roof, 0.5);
  ctx.beginPath();
  for (let k = -3; k <= 3; k++) {
    const a = Math.PI * (0.5 + k / 8);
    ctx.moveTo(cx - Math.cos(a) * hw * 0.62, rb - Math.sin(a) * 0.42 * g.S);
    ctx.lineTo(cx - Math.cos(a) * hw * 0.78, rb - Math.sin(a) * 0.54 * g.S);
  }
  ctx.stroke();
  // reflection of the arch in the water
  ctx.strokeStyle = rgba(PAL.moon, 0.12);
  ctx.beginPath();
  ctx.ellipse(cx, rb + 0.02 * s, hw * 0.55, 0.06 * s, 0, 0, Math.PI);
  ctx.stroke();
  // two post lanterns at the ends
  for (const sx of [-1, 1]) {
    const px = cx + sx * 0.86 * s;
    ctx.fillStyle = INK;
    ctx.fillRect(px - 0.02 * s, yb - 0.4 * s, 0.04 * s, 0.2 * s);
    if (lit) drawGlow(ctx, px, yb - 0.44 * s, 0.2 * s, GLOW.flame);
    ctx.fillStyle = lit ? PAL.windowLitCore : PAL.windowDark;
    ctx.fillRect(px - 0.035 * s, yb - 0.49 * s, 0.07 * s, 0.09 * s);
  }
}

function tree(ctx: Ctx, cx: number, yb: number, s: number, lit: boolean): void {
  ctx.fillStyle = PAL.wood;
  ctx.beginPath();
  ctx.moveTo(cx - 0.09 * s, yb);
  ctx.lineTo(cx - 0.05 * s, yb - 0.85 * s);
  ctx.lineTo(cx + 0.05 * s, yb - 0.85 * s);
  ctx.lineTo(cx + 0.1 * s, yb);
  ctx.closePath();
  ctx.fill();
  // branch with a swing
  ctx.strokeStyle = PAL.wood;
  ctx.lineWidth = 0.045 * s;
  ctx.beginPath();
  ctx.moveTo(cx + 0.02 * s, yb - 0.75 * s);
  ctx.quadraticCurveTo(cx + 0.3 * s, yb - 0.85 * s, cx + 0.55 * s, yb - 0.95 * s);
  ctx.stroke();
  const r = rng(hashStr(`tree${cx | 0}`));
  const tones = [mix(PAL.moss, PAL.roof, 0.55), mix(PAL.moss, PAL.roof, 0.4), mix(PAL.sage, PAL.roof, 0.55)];
  for (let k = 0; k < 11; k++) {
    const a = r() * TAU;
    const rr = r() * 0.38 * s;
    ctx.fillStyle = tones[k % 3]!;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * rr * 1.25, yb - 1.32 * s + Math.sin(a) * rr * 0.75, (0.26 + r() * 0.12) * s, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = rgba(PAL.moon, 0.5);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx + 0.36 * s, yb - 0.87 * s);
  ctx.lineTo(cx + 0.36 * s, yb - 0.32 * s);
  ctx.moveTo(cx + 0.52 * s, yb - 0.93 * s);
  ctx.lineTo(cx + 0.52 * s, yb - 0.32 * s);
  ctx.stroke();
  ctx.fillStyle = PAL.woodHi;
  ctx.fillRect(cx + 0.32 * s, yb - 0.33 * s, 0.24 * s, 0.035 * s);
  // fairy lights in the canopy
  if (lit) {
    for (let k = 0; k < 14; k++) {
      const x = cx + (r() - 0.5) * 1.1 * s;
      const y = yb - 1.32 * s + (r() - 0.5) * 0.7 * s;
      drawGlow(ctx, x, y, 0.06 * s, GLOW.flame);
    }
  }
}

function windmill(ctx: Ctx, cx: number, yb: number, s: number, lit: boolean): void {
  const wall = mix(PAL.wall, PAL.stone, 0.12);
  ctx.fillStyle = wall;
  ctx.beginPath();
  ctx.moveTo(cx - 0.32 * s, yb);
  ctx.lineTo(cx - 0.18 * s, yb - 1.35 * s);
  ctx.lineTo(cx + 0.18 * s, yb - 1.35 * s);
  ctx.lineTo(cx + 0.32 * s, yb);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PAL.roof;
  ctx.beginPath();
  ctx.moveTo(cx - 0.23 * s, yb - 1.33 * s);
  ctx.quadraticCurveTo(cx, yb - 1.68 * s, cx + 0.23 * s, yb - 1.33 * s);
  ctx.closePath();
  ctx.fill();
  drawWindowPane(ctx, cx, yb - 0.85 * s, 0.1 * s, 0.13 * s, false, lit);
  ctx.fillStyle = PAL.windowFrame;
  rrectPath(ctx, cx - 0.08 * s, yb - 0.3 * s, 0.16 * s, 0.31 * s, 0.07 * s);
  ctx.fill();
  // sails (lattice blades)
  const hx = cx;
  const hy = yb - 1.38 * s;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(0.35);
  for (let k = 0; k < 4; k++) {
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = INK;
    ctx.fillRect(-0.012 * s, 0, 0.024 * s, 0.9 * s);
    ctx.fillStyle = rgba(PAL.moon, 0.28);
    ctx.fillRect(0.012 * s, 0.18 * s, 0.13 * s, 0.7 * s);
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1, 0.01 * s);
    ctx.beginPath();
    for (let j = 0; j < 5; j++) {
      ctx.moveTo(0.012 * s, 0.22 * s + j * 0.14 * s);
      ctx.lineTo(0.142 * s, 0.22 * s + j * 0.14 * s);
    }
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(hx, hy, 0.045 * s, 0, TAU);
  ctx.fill();
}

function bandstand(ctx: Ctx, cx: number, yb: number, s: number, lit: boolean): void {
  const hw = 0.62 * s;
  ctx.fillStyle = mix(PAL.stone, PAL.roof, 0.5);
  ctx.fillRect(cx - hw - 0.04 * s, yb - 0.16 * s, (hw + 0.04 * s) * 2, 0.16 * s);
  ctx.fillStyle = mix(PAL.stoneHi, PAL.roof, 0.4);
  ctx.fillRect(cx - hw - 0.06 * s, yb - 0.19 * s, (hw + 0.06 * s) * 2, 0.04 * s);
  ctx.fillStyle = INK;
  const posts = [-hw + 0.04 * s, -hw / 3, hw / 3, hw - 0.04 * s];
  for (const px of posts) ctx.fillRect(cx + px - 0.02 * s, yb - 0.95 * s, 0.04 * s, 0.78 * s);
  // railing
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, 0.02 * s);
  ctx.beginPath();
  ctx.moveTo(cx - hw, yb - 0.4 * s);
  ctx.lineTo(cx + hw, yb - 0.4 * s);
  ctx.stroke();
  // roof
  ctx.fillStyle = PAL.roof;
  ctx.beginPath();
  ctx.moveTo(cx - hw - 0.12 * s, yb - 0.92 * s);
  ctx.quadraticCurveTo(cx - hw * 0.4, yb - 1.05 * s, cx, yb - 1.42 * s);
  ctx.quadraticCurveTo(cx + hw * 0.4, yb - 1.05 * s, cx + hw + 0.12 * s, yb - 0.92 * s);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgba(PAL.wallRim, 0.45);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - hw - 0.12 * s, yb - 0.92 * s);
  ctx.quadraticCurveTo(cx - hw * 0.4, yb - 1.05 * s, cx, yb - 1.42 * s);
  ctx.stroke();
  ctx.fillStyle = PAL.flame;
  ctx.beginPath();
  ctx.arc(cx, yb - 1.46 * s, 0.03 * s, 0, TAU);
  ctx.fill();
  // scalloped string lights under the eave
  for (let k = 0; k < 3; k++) {
    const a = cx + posts[k]!;
    const b = cx + posts[k + 1]!;
    for (let j = 1; j < 5; j++) {
      const t = j / 5;
      const x = a + (b - a) * t;
      const y = yb - 0.9 * s + 0.12 * s * 4 * t * (1 - t);
      if (lit) drawGlow(ctx, x, y, 0.07 * s, GLOW.flame);
      else {
        ctx.fillStyle = PAL.windowDark;
        ctx.beginPath();
        ctx.arc(x, y, 0.02 * s, 0, TAU);
        ctx.fill();
      }
    }
  }
}

// ---------------------------------------------------------------- keepsakes

function keepsake(ctx: Ctx, k: Keepsake, sp: HouseSpec, X: number, yb: number, s: number, n: number): void {
  const x = (v: number): number => X + v * s;
  const y = (v: number): number => yb + v * s;
  const accents = [PAL.plum, PAL.koi, PAL.sage, PAL.moon];
  const accent = accents[(n + k.length) % 4]!;
  const d = sp.door;
  const far = d.x <= 0 ? 1 : -1; // side away from the door
  const upper = sp.windows.slice(1).filter((w) => w.y < -sp.bodyH * 0.5);
  const lower = sp.windows.slice(1).filter((w) => w.y >= -sp.bodyH * 0.5);
  switch (k) {
    case "flowerBox": {
      for (const w of (lower.length ? lower : upper).slice(0, 2)) {
        const bx = w.x - w.w * 0.65;
        const by = w.y + w.h * 0.5 + 0.035;
        ctx.fillStyle = PAL.woodHi;
        ctx.fillRect(x(bx), y(by), w.w * 1.3 * s, 0.045 * s);
        for (let j = 0; j < 5; j++) {
          ctx.fillStyle = mix(PAL.sage, PAL.roof, 0.35);
          ctx.beginPath();
          ctx.arc(x(bx + 0.02 + j * w.w * 0.3), y(by - 0.005), 0.022 * s, 0, TAU);
          ctx.fill();
          ctx.fillStyle = accents[(j + n) % 4]!;
          ctx.beginPath();
          ctx.arc(x(bx + 0.03 + j * w.w * 0.3), y(by - 0.025), 0.016 * s, 0, TAU);
          ctx.fill();
        }
      }
      return;
    }
    case "doorLantern": {
      const lx = d.x - (d.w / 2 + 0.07) * (d.x < 0.2 ? -1 : 1);
      const ly = -d.h - 0.02;
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1, 0.012 * s);
      ctx.beginPath();
      ctx.moveTo(x(lx), y(ly - 0.07));
      ctx.lineTo(x(lx), y(ly - 0.04));
      ctx.stroke();
      const lh = 0.1 * s;
      drawGlow(ctx, x(lx), y(ly), 0.2 * s, GLOW.flame);
      ctx.save();
      ctx.translate(x(lx) - lh * 0.4, y(ly) - lh * 0.56);
      drawLantern(ctx, lh, 1);
      ctx.restore();
      return;
    }
    case "shutters": {
      ctx.fillStyle = mix(accent, PAL.roof, 0.45);
      for (const w of upper.length ? upper : lower) {
        if (w.round) continue;
        for (const sx of [-1, 1]) {
          const px = w.x + sx * (w.w / 2 + 0.035);
          ctx.fillRect(x(px - 0.025), y(w.y - w.h / 2 - 0.01), 0.05 * s, (w.h + 0.02) * s);
        }
      }
      ctx.strokeStyle = rgba(PAL.roof, 0.6);
      ctx.lineWidth = Math.max(1, 0.006 * s);
      ctx.beginPath();
      for (const w of upper.length ? upper : lower) {
        for (const sx of [-1, 1]) {
          const px = w.x + sx * (w.w / 2 + 0.035);
          for (let j = 1; j < 4; j++) {
            const yy = w.y - w.h / 2 + (j * w.h) / 4;
            ctx.moveTo(x(px - 0.02), y(yy));
            ctx.lineTo(x(px + 0.02), y(yy));
          }
        }
      }
      ctx.stroke();
      return;
    }
    case "garland": {
      const cx = d.x;
      const top = -d.h;
      for (let j = 0; j <= 10; j++) {
        const a = Math.PI + (j / 10) * Math.PI;
        const px = cx + Math.cos(a) * (d.w * 0.62);
        const py = top + 0.03 + Math.sin(a) * 0.06 + (Math.abs(Math.cos(a)) > 0.85 ? 0.04 : 0);
        ctx.fillStyle = mix(PAL.sage, PAL.roof, 0.3 + (j % 2) * 0.15);
        ctx.beginPath();
        ctx.arc(x(px), y(py), 0.024 * s, 0, TAU);
        ctx.fill();
        if (j % 3 === 1) {
          ctx.fillStyle = PAL.koi;
          ctx.beginPath();
          ctx.arc(x(px + 0.01), y(py - 0.01), 0.011 * s, 0, TAU);
          ctx.fill();
        }
      }
      return;
    }
    case "bench": {
      const bx = far * 0.66;
      ctx.fillStyle = PAL.woodHi;
      ctx.fillRect(x(bx - 0.13), y(-0.1), 0.26 * s, 0.03 * s);
      ctx.fillRect(x(bx - 0.13), y(-0.18), 0.26 * s, 0.025 * s);
      ctx.fillStyle = INK;
      ctx.fillRect(x(bx - 0.11), y(-0.1), 0.02 * s, 0.1 * s);
      ctx.fillRect(x(bx + 0.09), y(-0.1), 0.02 * s, 0.1 * s);
      return;
    }
    case "bird": {
      const c = sp.chimney;
      const bx = c ? c.x : far * 0.25;
      const by = c ? -sp.bodyH - c.h - 0.1 : -sp.bodyH - (sp.roof === "gable" ? sp.roofH * (1 - 0.25 / 0.57) : 0.05);
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(x(bx), y(by - 0.035), 0.04 * s, 0.028 * s, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x(bx + 0.035), y(by - 0.065), 0.02 * s, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x(bx - 0.03), y(by - 0.04));
      ctx.lineTo(x(bx - 0.08), y(by - 0.06));
      ctx.lineTo(x(bx - 0.03), y(by - 0.02));
      ctx.fill();
      ctx.fillStyle = PAL.koi;
      ctx.beginPath();
      ctx.moveTo(x(bx + 0.052), y(by - 0.07));
      ctx.lineTo(x(bx + 0.075), y(by - 0.062));
      ctx.lineTo(x(bx + 0.052), y(by - 0.056));
      ctx.fill();
      return;
    }
    case "ivy": {
      const ix = far * 0.47;
      let px = ix;
      for (let j = 0; j < 16; j++) {
        const py = -0.02 - j * (sp.bodyH * 0.8) / 16;
        px = ix + Math.sin(j * 0.9 + n) * 0.035;
        ctx.fillStyle = mix(PAL.moss, PAL.roof, 0.2 + (j % 3) * 0.12);
        ctx.beginPath();
        ctx.ellipse(x(px + (j % 2 ? 0.02 : -0.02)), y(py), 0.028 * s, 0.018 * s, j % 2 ? 0.6 : -0.6, 0, TAU);
        ctx.fill();
      }
      return;
    }
    case "cat": {
      // on the roof slope away from the generator's own cat (house 8 may get two)
      const cx = sp.roof === "gable" ? -0.22 : -0.34;
      const cy = sp.roof === "gable" ? -sp.bodyH - sp.roofH * (1 - 0.22 / 0.57) : -sp.bodyH - 0.05;
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(x(cx), y(cy - 0.05), 0.045 * s, 0.055 * s, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x(cx - 0.012), y(cy - 0.12), 0.03 * s, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x(cx + 0.012), y(cy - 0.14));
      ctx.lineTo(x(cx + 0.004), y(cy - 0.175));
      ctx.lineTo(x(cx - 0.012), y(cy - 0.145));
      ctx.lineTo(x(cx - 0.028), y(cy - 0.175));
      ctx.lineTo(x(cx - 0.038), y(cy - 0.135));
      ctx.closePath();
      ctx.fill();
      // (the tail is a live sprite now: it swishes now and then — TownScene, catTail())
      // two tiny eyes catch the light
      ctx.fillStyle = PAL.flame;
      ctx.fillRect(x(cx - 0.026), y(cy - 0.128), 0.008 * s, 0.006 * s);
      ctx.fillRect(x(cx - 0.006), y(cy - 0.128), 0.008 * s, 0.006 * s);
      return;
    }
    case "mailbox": {
      const mx = d.x + far * (d.w / 2 + 0.16);
      ctx.fillStyle = INK;
      ctx.fillRect(x(mx - 0.012), y(-0.2), 0.024 * s, 0.2 * s);
      ctx.fillStyle = mix(PAL.sage, PAL.roof, 0.35);
      rrectPath(ctx, x(mx - 0.06), y(-0.29), 0.12 * s, 0.09 * s, 0.04 * s);
      ctx.fill();
      ctx.fillStyle = PAL.koi;
      ctx.fillRect(x(mx + 0.05), y(-0.33), 0.015 * s, 0.06 * s);
      ctx.fillRect(x(mx + 0.05), y(-0.33), 0.04 * s, 0.022 * s);
      return;
    }
    case "awning": {
      const aw = d.w + 0.14;
      const ay = -d.h - 0.04;
      const stripes = 5;
      for (let j = 0; j < stripes; j++) {
        ctx.fillStyle = j % 2 ? rgba(PAL.moon, 0.85) : accent === PAL.moon ? PAL.plum : accent;
        const sx = d.x - aw / 2 + (j * aw) / stripes;
        ctx.beginPath();
        ctx.moveTo(x(sx), y(ay - 0.05));
        ctx.lineTo(x(sx + aw / stripes), y(ay - 0.05));
        ctx.lineTo(x(sx + aw / stripes), y(ay + 0.02));
        ctx.arc(x(sx + aw / stripes / 2), y(ay + 0.02), (aw / stripes / 2) * s, 0, Math.PI);
        ctx.closePath();
        ctx.fill();
      }
      return;
    }
    case "weathervane": {
      const top = -sp.bodyH - sp.roofH * (sp.roof === "gable" ? 1 : 0.95);
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1, 0.012 * s);
      ctx.beginPath();
      ctx.moveTo(x(0), y(top));
      ctx.lineTo(x(0), y(top - 0.2));
      ctx.moveTo(x(-0.08), y(top - 0.12));
      ctx.lineTo(x(0.08), y(top - 0.12));
      ctx.stroke();
      // a little moon-fish vane
      ctx.fillStyle = PAL.flame;
      ctx.beginPath();
      ctx.moveTo(x(-0.09), y(top - 0.19));
      ctx.quadraticCurveTo(x(0), y(top - 0.26), x(0.08), y(top - 0.2));
      ctx.lineTo(x(0.11), y(top - 0.23));
      ctx.lineTo(x(0.11), y(top - 0.16));
      ctx.lineTo(x(0.08), y(top - 0.19));
      ctx.quadraticCurveTo(x(0), y(top - 0.14), x(-0.09), y(top - 0.19));
      ctx.fill();
      return;
    }
    case "birdhouse": {
      const bx = far * 0.72;
      ctx.fillStyle = INK;
      ctx.fillRect(x(bx - 0.012), y(-0.42), 0.024 * s, 0.42 * s);
      ctx.fillStyle = mix(accent, PAL.roof, 0.4);
      ctx.fillRect(x(bx - 0.06), y(-0.54), 0.12 * s, 0.12 * s);
      ctx.fillStyle = PAL.roof;
      ctx.beginPath();
      ctx.moveTo(x(bx - 0.085), y(-0.53));
      ctx.lineTo(x(bx), y(-0.62));
      ctx.lineTo(x(bx + 0.085), y(-0.53));
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(x(bx), y(-0.49), 0.022 * s, 0, TAU);
      ctx.fill();
      return;
    }
    case "laundry":
      return;
  }
}

/** Laundry strung from the wall out to a pole in the yard (side without the generator's own line). */
function laundry(ctx: Ctx, sp: HouseSpec, X: number, yb: number, s: number, n: number): void {
  const side = sp.line === 0 ? (n % 2 ? 1 : -1) : -sp.line;
  const x = (v: number): number => X + v * s;
  const y = (v: number): number => yb + v * s;
  const yl = -sp.bodyH * 0.45;
  ctx.strokeStyle = PAL.roof;
  ctx.lineWidth = 0.022 * s;
  ctx.beginPath();
  ctx.moveTo(x(0.86 * side), y(0));
  ctx.lineTo(x(0.86 * side), y(yl - 0.04));
  ctx.stroke();
  ctx.strokeStyle = rgba(PAL.moon, 0.35);
  ctx.lineWidth = Math.max(1, 0.006 * s);
  ctx.beginPath();
  ctx.moveTo(x(0.45 * side), y(yl - 0.06));
  ctx.quadraticCurveTo(x(0.66 * side), y(yl + 0.04), x(0.86 * side), y(yl - 0.02));
  ctx.stroke();
  const cloth = [PAL.moon, PAL.koi, PAL.plum, PAL.sage];
  for (let k = 0; k < 3; k++) {
    const t = 0.25 + k * 0.25;
    const cx = (0.45 + 0.41 * t) * side;
    const cy = yl - 0.06 + 0.04 * t + 0.07 * 4 * t * (1 - t) * 0.5;
    ctx.fillStyle = mix(cloth[(n + k) % 4]!, "#2B2350", 0.3);
    if (k === 1) {
      // a little shirt
      ctx.beginPath();
      ctx.moveTo(x(cx - 0.05), y(cy));
      ctx.lineTo(x(cx + 0.05), y(cy));
      ctx.lineTo(x(cx + 0.065), y(cy + 0.03));
      ctx.lineTo(x(cx + 0.035), y(cy + 0.035));
      ctx.lineTo(x(cx + 0.035), y(cy + 0.1));
      ctx.lineTo(x(cx - 0.035), y(cy + 0.1));
      ctx.lineTo(x(cx - 0.035), y(cy + 0.035));
      ctx.lineTo(x(cx - 0.065), y(cy + 0.03));
      ctx.closePath();
      ctx.fill();
    } else {
      rrectPath(ctx, x(cx - 0.035), y(cy), 0.07 * s, 0.09 * s, 0.01 * s);
      ctx.fill();
    }
  }
}

/** Heart window centre of a lit house (pt) — the newest one breathes. */
export function heartOf(h: StreetHouse, S: number, yb: number): { x: number; y: number; r: number } {
  const w = h.spec.windows[0]!;
  const s = S * h.scale;
  return { x: h.x * S + w.x * s, y: yb + w.y * s, r: w.w * s };
}

/** The keepsake cat's tail root (pt, street space) and its scale, for the live swishing tail. */
export function catTail(h: StreetHouse, S: number, yb: number): { x: number; y: number; s: number } | null {
  if (!h.lit || !h.keepsakes.includes("cat")) return null;
  const sp = h.spec;
  const s = S * h.scale;
  const cx = sp.roof === "gable" ? -0.22 : -0.34;
  const cy = sp.roof === "gable" ? -sp.bodyH - sp.roofH * (1 - 0.22 / 0.57) : -sp.bodyH - 0.05;
  return { x: h.x * S + (cx + 0.035) * s, y: yb + (cy - 0.01) * s, s };
}

/** The tail itself, drawn from its root at (0.1 w, 0.9 h) curling up to the right (canvas w × h). */
export function paintTail(ctx: Ctx, w: number, h: number, s: number): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.014 * s;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(w * 0.1, h * 0.9);
  ctx.quadraticCurveTo(w * 0.1 + 0.075 * s, h * 0.9 + 0.01 * s, w * 0.1 + 0.055 * s, h * 0.9 - 0.07 * s);
  ctx.stroke();
  ctx.lineCap = "butt";
}
