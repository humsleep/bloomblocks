// Village art kit — tokens, the ONE light model and the ONE shading recipe (docs/team/r2-village-art.md).
//   key   warm afterglow from the upper LEFT (#FFD6B0) → highlights on top-left edges
//   fill  cool sky from above (#9C8FD0)                → the shadow side never goes black
//   local lantern / window light (#FFC864)              → pools on the ground, additive glows
//   ink   #3B2C45, shadows are plum (#140F2C), never pure black
// Every solid goes through solid(): base → key gradient → AO → inner rim → inner shade → material
// texture → the one outline rule (OUTLINE). Everything is drawn once into a baked texture.
import type { Ctx } from "../draw.ts";

export const T = {
  skyTop: "#191838", skyMid: "#352C5E", skyMauve: "#77598C", skyRose: "#D18E9D", skyPeach: "#F4BFA0",
  hillFar: "#8B6CA0", hillMid: "#5E4A80", hillNear: "#3F3469", ground: "#302957", groundDeep: "#1D1938",
  lawn: "#3F4B78", lawnLo: "#2C3260",
  leaf: "#4F7F68", leafHi: "#86C29C", leafLo: "#2E4D4B", moss: "#7FA678",
  wood: "#7A5440", woodHi: "#A57B5C", woodLo: "#4A3328",
  stone: "#8E88AE", stoneHi: "#D4D0E6", stoneLo: "#5B557E",
  paper: "#FFF3DE", cream: "#FFF3DE", ink: "#3B2C45", inkSoft: "#7A6A86",
  amber: "#FFC864", amberLip: "#D9983F", glow: "#FFD98A",
  pink: "#F6A7B8", mint: "#A8DCC8", lilac: "#C9B6F0", lemon: "#FFE59A", coral: "#F2907A",
  water: "#3C4A86", plum: "#140F2C", key: "#FFD6B0", fill: "#9C8FD0",
} as const;

export const hexA = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
export const mix = (a: string, b: string, t: number): string => {
  const x = parseInt(a.slice(1), 16);
  const y = parseInt(b.slice(1), 16);
  const c = (s: number): number => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t);
  return "#" + ((1 << 24) + (c(16) << 16) + (c(8) << 8) + c(0)).toString(16).slice(1);
};

let seed = 7;
export const rnd = (): number => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
export const reseed = (s: number): void => {
  seed = s >>> 0;
};

/** Path2D built by a callback. */
export const P = (fn: (p: Path2D) => void): Path2D => {
  const p = new Path2D();
  fn(p);
  return p;
};
export const rrect = (x: number, y: number, w: number, h: number, r: number | number[]): Path2D => P((p) => p.roundRect(x, y, w, h, r));
export const ellipseP = (x: number, y: number, rx: number, ry: number): Path2D => P((p) => p.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2));
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ---------------------------------------------------------------- the one outline rule (R4)

/** Outline = 2.5 % of the object's on-screen height, min 0.5 pt (1.5 px @3x), max 1.6 pt. */
export const OUTLINE = { k: 0.025, minPt: 0.5, maxPt: 1.6 } as const;
/** canvas px per pt for the bake in progress (TextureBank canvases are px; the scene's u). */
let pxPerPt = 3;
export function setPxPerPt(u: number): void {
  pxPerPt = Math.max(0.5, u);
}
export function getPxPerPt(): number {
  return pxPerPt;
}
/** pt per user unit under the current transform. */
export function userScale(ctx: Ctx): number {
  const m = ctx.getTransform();
  return Math.hypot(m.a, m.b) / pxPerPt;
}
export const outlinePt = (hPt: number): number => Math.min(OUTLINE.maxPt, Math.max(OUTLINE.minPt, OUTLINE.k * hPt));
/** Stroke width (user units) for a drawn line on something `hUser` tall (stems, muntins, cords). */
export function lineW(ctx: Ctx, hUser: number): number {
  const ts = userScale(ctx);
  return outlinePt(hUser * ts) / ts;
}

// ---------------------------------------------------------------- material texture

let noise: HTMLCanvasElement | null = null;
function noiseTile(): HTMLCanvasElement {
  if (noise) return noise;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d")!;
  const d = x.createImageData(128, 128);
  reseed(1234);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = 128 + (rnd() - 0.5) * 200;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
    d.data[i + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  const b = document.createElement("canvas");
  b.width = b.height = 128;
  const bx = b.getContext("2d")!;
  bx.filter = "blur(0.6px)";
  bx.drawImage(c, 0, 0);
  noise = b;
  return b;
}
export type Material = "paper" | "wood" | "leaf" | "stone" | "cloth" | "grass";
const MAT: Record<Material, { sx: number; sy: number; a: number }> = {
  paper: { sx: 0.9, sy: 0.12, a: 0.3 },
  wood: { sx: 1.6, sy: 0.1, a: 0.24 },
  leaf: { sx: 0.22, sy: 0.22, a: 0.3 },
  stone: { sx: 0.3, sy: 0.3, a: 0.25 },
  cloth: { sx: 0.35, sy: 0.35, a: 0.16 },
  grass: { sx: 0.5, sy: 0.12, a: 0.3 },
};
/** Painterly material inside a shape (soft-light noise, stretched per material). */
export function texture(ctx: Ctx, path: Path2D, box: Box, kind: Material, a?: number): void {
  const m = MAT[kind];
  const ts = userScale(ctx);
  ctx.save();
  ctx.clip(path);
  ctx.globalCompositeOperation = "soft-light";
  ctx.globalAlpha = a ?? m.a;
  const pat = ctx.createPattern(noiseTile(), "repeat");
  if (pat) {
    pat.setTransform(new DOMMatrix([m.sx / ts, 0, 0, m.sy / ts, box.x, box.y]));
    ctx.fillStyle = pat;
    ctx.fillRect(box.x - 2, box.y - 2, box.w + 4, box.h + 4);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- the shading recipe

export interface SolidOpts {
  lit?: number;
  shade?: number;
  ao?: number;
  rim?: number;
  rimA?: number;
  tex?: Material;
  texA?: number;
  /** false = no outline; a colour = that outline colour */
  line?: false | string;
}
export function solid(ctx: Ctx, path: Path2D, base: string, box: Box, o: SolidOpts = {}): void {
  ctx.fillStyle = base;
  ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  const g = ctx.createLinearGradient(box.x, box.y, box.x + box.w * 0.55, box.y + box.h);
  g.addColorStop(0, hexA(T.key, o.lit ?? 0.26));
  g.addColorStop(0.45, hexA(T.key, 0));
  g.addColorStop(1, hexA(T.plum, o.shade ?? 0.34));
  ctx.fillStyle = g;
  ctx.fillRect(box.x - 2, box.y - 2, box.w + 4, box.h + 4);
  if (o.ao !== 0) {
    const a = ctx.createLinearGradient(0, box.y + box.h * 0.62, 0, box.y + box.h);
    a.addColorStop(0, hexA(T.plum, 0));
    a.addColorStop(1, hexA(T.plum, o.ao ?? 0.22));
    ctx.fillStyle = a;
    ctx.fillRect(box.x - 2, box.y, box.w + 4, box.h + 2);
  }
  const rw = o.rim ?? 1.6;
  if (rw > 0) {
    ctx.save();
    ctx.translate(rw, rw);
    ctx.lineWidth = rw * 2.2;
    ctx.strokeStyle = hexA(T.key, o.rimA ?? 0.55);
    ctx.stroke(path);
    ctx.restore();
    ctx.save();
    ctx.translate(-rw * 0.8, -rw * 0.8);
    ctx.lineWidth = rw * 2;
    ctx.strokeStyle = hexA(T.plum, 0.22);
    ctx.stroke(path);
    ctx.restore();
  }
  ctx.restore();
  if (o.tex) texture(ctx, path, box, o.tex, o.texA);
  if (o.line !== false) {
    const ts = userScale(ctx);
    ctx.lineWidth = outlinePt(box.h * ts) / ts;
    ctx.lineJoin = "round";
    ctx.strokeStyle = typeof o.line === "string" ? o.line : base.startsWith("#") ? mix(base, T.ink, 0.55) : hexA(T.ink, 0.6);
    ctx.stroke(path);
  }
}

export function contact(ctx: Ctx, x: number, y: number, rx: number, ry: number, a = 0.38): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, hexA(T.plum, a));
  g.addColorStop(0.6, hexA(T.plum, a * 0.45));
  g.addColorStop(1, hexA(T.plum, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
export function glow(ctx: Ctx, x: number, y: number, r: number, col: string = T.glow, a = 0.5, sy = 1): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.translate(x, y);
  ctx.scale(1, sy);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, hexA(col, a));
  g.addColorStop(0.45, hexA(col, a * 0.35));
  g.addColorStop(1, hexA(col, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
/** Whole-picture painterly grain (overlay noise). */
export function grain(ctx: Ctx, w: number, h: number, a = 0.05): void {
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = a;
  const pat = ctx.createPattern(noiseTile(), "repeat");
  if (pat) {
    pat.setTransform(new DOMMatrix([1, 0, 0, 1, 0, 0]));
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- small shared props

export function flower(ctx: Ctx, x: number, y: number, r: number, col: string): void {
  ctx.fillStyle = col;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * 6.283 - 1.57;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75, r * 0.62, r * 0.48, a, 0, 6.3);
    ctx.fill();
  }
  ctx.fillStyle = "#FFE59A";
  ctx.beginPath();
  ctx.arc(x, y, r * 0.38, 0, 6.3);
  ctx.fill();
}
export function stoneBlob(ctx: Ctx, x: number, y: number, rx: number, ry: number, col: string = T.stone): void {
  contact(ctx, x + 1, y + ry * 0.6, rx * 1.05, ry * 0.5, 0.35);
  const p = ellipseP(x, y, rx, ry);
  solid(ctx, p, col, { x: x - rx, y: y - ry, w: rx * 2, h: ry * 2 }, { rim: Math.min(1.6, ry * 0.4), lit: 0.35, tex: "stone" });
}
/** A small framed paper lantern (door lanterns, lamp posts, the room's light). */
export function miniLantern(ctx: Ctx, cx: number, cy: number, h: number, lit: boolean): void {
  const w = h * 0.78;
  const handle = P((q) => {
    q.arc(cx, cy - h * 0.48, w * 0.27, Math.PI * 1.02, Math.PI * 1.98);
    q.arc(cx, cy - h * 0.48, w * 0.17, Math.PI * 1.98, Math.PI * 1.02, true);
    q.closePath();
  });
  solid(ctx, handle, T.woodLo, { x: cx - w * 0.27, y: cy - h * 0.48 - w * 0.27, w: w * 0.54, h: w * 0.27 }, { rim: 0, ao: 0 });
  const body = rrect(cx - w * 0.42, cy - h * 0.4, w * 0.84, h * 0.8, w * 0.32);
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.6);
  g.addColorStop(0, lit ? "#FFF6DC" : "#CDBE9C");
  g.addColorStop(1, lit ? T.amber : "#9C8462");
  ctx.fillStyle = g;
  ctx.fill(body);
  for (const yy of [cy - h * 0.48, cy + h * 0.38]) {
    const cap = rrect(cx - w * 0.5, yy, w, h * 0.12, h * 0.05);
    solid(ctx, cap, T.wood, { x: cx - w * 0.5, y: yy, w, h: h * 0.12 }, { rim: 0, ao: 0 });
  }
}

/**
 * THE moon of the village and the room window (same look as the puzzle sky's drawMoonPhase): a dusky
 * disc whose lit side faces the light on the upper LEFT. phase = lit fraction 0…1.
 */
export function moon(ctx: Ctx, x: number, y: number, r: number, lit = 0.58): void {
  glow(ctx, x, y, r * 3.6, "#FFF3DE", 0.16);
  const disc = P((q) => q.arc(x, y, r, 0, 6.3));
  ctx.fillStyle = "rgba(60,62,96,0.85)";
  ctx.fill(disc);
  ctx.save();
  ctx.clip(disc);
  const k = r * Math.abs(1 - 2 * lit);
  const litP = P((q) => {
    q.arc(x, y, r, Math.PI / 2, Math.PI * 1.5);
    q.ellipse(x, y, Math.max(0.01, k), r, 0, -Math.PI / 2, Math.PI / 2, lit < 0.5);
  });
  ctx.fillStyle = "#F4EBD0";
  ctx.fill(litP);
  ctx.restore();
  ctx.lineWidth = Math.max(0.5, r * 0.05);
  ctx.strokeStyle = hexA("#F4EBD0", 0.35);
  ctx.stroke(disc);
}
