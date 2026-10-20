// The courtyard (v9 light + material model). Everything here runs at bake time only:
//   - stone-slab floor: a tileable value-noise fbm (128², made once), stamped through
//     6 baked slab variants (noise, cracks, pits, worn corners, moonlit bevel)
//   - the low stone wall that makes the board a courtyard in the ground (no UI card)
//   - carved marker stones (numbered rocks) with a flat face and a 0.12-cell side
//   - light: a second bake of the same slabs under full lantern light ("lit floor"); a cell shows
//     its lit slab when the light reaches it, times a falloff (multiply) along the ray
//     I(t) = max(0.55, 1 − 0.09·t), t = distance from the lantern in cells; the farthest lit cell
//     still lands at relative luminance ≥ 0.27 (≥ 4.3:1 against the dark floor)
//   - lantern pool, rock rim crescents, contact shadow
// The per-frame side (alpha / crop / rotation only) lives in BoardView.
import { PAL, rgba } from "./palette.ts";
import { hashStr, rng } from "./rng.ts";
import { drawRock, mix, rrectPath, type Ctx, type Rnd } from "./draw.ts";

const TAU = Math.PI * 2;

// ---------------------------------------------------------------- light model

/** Bloom strength over a lit cell d steps from its lantern (0 = the lantern's own cell). */
export function bloomA(d: number): number {
  return 0.55 + 0.45 * Math.exp(-Math.max(0, d - 1) / 1.7);
}

/** Rim strength on a stone whose ray from the lantern is d steps long. */
export function rimA(d: number): number {
  return Math.exp(-Math.max(0, d - 1) / 1.7);
}

/** Light intensity t cells from the lantern (continuous). */
export function lightI(t: number): number {
  return Math.max(0.55, 1 - 0.09 * Math.max(0, t));
}

/**
 * Multiply colour (0–1 per channel) on the baked lit floor t cells from the lantern. The lit
 * floor is the same slabs under full lantern light; the light cools to amber and dims with
 * distance — w(t) = e^(−(t − 0.5)/1.7) blends from white (at the lantern) to FAR. FAR keeps the
 * farthest lit cell at relative luminance ≥ 0.27 (≥ 4.3:1 against the dark floor; audited).
 */
const FAR = [0.89, 0.78, 0.63] as const;
export function falloffRGB(t: number, out: number[]): number[] {
  const w = Math.exp(-Math.max(0, t - 0.5) / 1.7);
  for (let c = 0; c < 3; c++) out[c] = FAR[c]! + (1 - FAR[c]!) * w;
  return out;
}

/** Slab inset (grout) for a cell of cs px: never thinner than the layout gap. */
export function groutOf(cs: number, gap: number): number {
  return Math.max(gap, Math.round(cs * 0.06));
}

const smooth = (e0: number, e1: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * Falloff (multiply) on one ray cell d steps from the lantern, light travelling +x, along x.
 * Canvas w² (bake at ½ res: it is smooth). Rotate for the direction.
 */
export function paintRayFalloff(ctx: Ctx, w: number, d: number): void {
  const m = [0, 0, 0];
  for (let x = 0; x < w; x++) {
    falloffRGB(d - 0.5 + (x + 0.5) / w, m);
    ctx.fillStyle = `rgb(${Math.round(255 * m[0]!)},${Math.round(255 * m[1]!)},${Math.round(255 * m[2]!)})`;
    ctx.fillRect(x, 0, 1, w);
  }
}

/** The lantern's own cell: radial falloff (white at the centre). */
export function paintSrcFalloff(ctx: Ctx, w: number): void {
  const img = ctx.createImageData(w, w);
  const c = w / 2;
  const m = [0, 0, 0];
  for (let y = 0; y < w; y++) {
    for (let x = 0; x < w; x++) {
      falloffRGB(Math.hypot(x + 0.5 - c, y + 0.5 - c) / w, m);
      const o = (y * w + x) * 4;
      img.data[o] = 255 * m[0]!;
      img.data[o + 1] = 255 * m[1]!;
      img.data[o + 2] = 255 * m[2]!;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Lantern light pool (ADD), radius = w / 2 (≈ 1.3 cells): the hot spot + the spill past the slabs. */
export const POOL_STOPS = [
  [0, "rgba(255,240,200,0.85)"], [0.14, "rgba(255,226,166,0.62)"], [0.3, "rgba(255,204,128,0.3)"],
  [0.48, "rgba(240,176,100,0.1)"], [0.7, "rgba(220,150,80,0.03)"], [1, "rgba(200,130,70,0)"],
] as const;

/**
 * Warm rim on the side of a plain rock that faces a lantern (ADD), light coming from −x.
 * Canvas w² for a rock of radius r px (w ≈ 2.3 r).
 */
export function paintRockRim(ctx: Ctx, w: number, r: number): void {
  const img = ctx.createImageData(w, w);
  const px = img.data;
  const c = w / 2;
  for (let y = 0; y < w; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x + 0.5 - c;
      const dy = (y + 0.5 - c) / 0.86;
      const d = Math.hypot(dx, dy) / r;
      const facing = Math.max(0, -dx / (Math.hypot(dx, dy) || 1));
      const band = smooth(0.42, 0.7, d) * (1 - smooth(0.72, 0.84, d));
      const a = band * facing * facing * (0.7 + 0.3 * Math.max(0, -dy / r));
      const o = (y * w + x) * 4;
      // ADD stamps carry their strength in alpha (premultiplied when drawn): correct on the live
      // framebuffer and on a transparent bake alike
      px[o] = 255;
      px[o + 1] = 190;
      px[o + 2] = 100;
      px[o + 3] = 255 * a * 0.8;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * Warm rim on a carved marker stone's face edge that looks at a lantern (ADD), in the cell's
 * frame (w = cell px · k, centre = cell centre). dir = the way the light travels (0 +x … 3 −y).
 */
export function paintMarkerRim(ctx: Ctx, w: number, dir: number): void {
  const m = markerGeom(w);
  const img = ctx.createImageData(w, w);
  const px = img.data;
  const c = w / 2;
  // signed distance to the face's rounded rect (negative inside)
  const hx = m.hw;
  const hy = (m.bottom - m.top) / 2;
  const cy0 = c + m.cy;
  for (let y = 0; y < w; y++) {
    for (let x = 0; x < w; x++) {
      const qx = Math.abs(x + 0.5 - c) - (hx - m.r);
      const qy = Math.abs(y + 0.5 - cy0) - (hy - m.r);
      const sd = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - m.r;
      const nx = (x + 0.5 - c) / hx;
      const ny = (y + 0.5 - cy0) / hy;
      const f = dir === 0 ? -nx : dir === 1 ? nx : dir === 2 ? -ny : ny;
      const band = smooth(-w * 0.09, -w * 0.01, sd) * (1 - smooth(-w * 0.005, w * 0.012, sd));
      const a = band * smooth(0.25, 0.95, f);
      const o = (y * w + x) * 4;
      px[o] = 255;
      px[o + 1] = 196;
      px[o + 2] = 108;
      px[o + 3] = 255 * a * 0.85;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * Bloom over a lit cell (ADD): a soft warm square-ish haze BLOOM_K cells wide, so light corridors
 * glow and spill a little into the grout and the edges of their dark neighbours (centres stay dark).
 */
export const BLOOM_K = 1.6;
export function paintBloom(ctx: Ctx, w: number, amp = 0.27): void {
  const img = ctx.createImageData(w, w);
  const c = w / 2;
  for (let y = 0; y < w; y++) {
    for (let x = 0; x < w; x++) {
      // squircle distance, 0 at the centre, 1 at the texture edge
      const dx = Math.abs(x + 0.5 - c) / c;
      const dy = Math.abs(y + 0.5 - c) / c;
      const d = Math.pow(Math.pow(dx, 4) + Math.pow(dy, 4), 0.25);
      const a = Math.pow(1 - smooth(0.0, 1, d), 1.6);
      const o = (y * w + x) * 4;
      img.data[o] = 255;
      img.data[o + 1] = 204;
      img.data[o + 2] = 128;
      img.data[o + 3] = 255 * Math.min(1, a * amp);
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Soft contact shadow under a lantern (normal blend), w × h ellipse. */
export function paintContactShadow(ctx: Ctx, w: number, h: number): void {
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(1, h / w);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w / 2);
  g.addColorStop(0, "rgba(40,18,6,0.7)");
  g.addColorStop(0.55, "rgba(40,18,6,0.4)");
  g.addColorStop(1, "rgba(40,18,6,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, w / 2, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- noise + slabs

let noise: HTMLCanvasElement | null = null;
const NOISE = 128;

/** Tileable value-noise fbm (3 octaves), grey around 128 — used through "overlay". Made once. */
export function noiseTile(): HTMLCanvasElement {
  if (noise) return noise;
  const c = document.createElement("canvas");
  c.width = NOISE;
  c.height = NOISE;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(NOISE, NOISE);
  const r = rng(0xd05c);
  const octs = [8, 16, 32].map((n) => {
    const v = new Float32Array(n * n);
    for (let i = 0; i < v.length; i++) v[i] = r();
    return { n, v };
  });
  const fade = (t: number): number => t * t * (3 - 2 * t);
  const amps = [0.55, 0.3, 0.15];
  for (let y = 0; y < NOISE; y++) {
    for (let x = 0; x < NOISE; x++) {
      let s = 0;
      for (let o = 0; o < 3; o++) {
        const { n, v } = octs[o]!;
        const fx = (x / NOISE) * n;
        const fy = (y / NOISE) * n;
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const tx = fade(fx - x0);
        const ty = fade(fy - y0);
        const i00 = v[(y0 % n) * n + (x0 % n)]!;
        const i10 = v[(y0 % n) * n + ((x0 + 1) % n)]!;
        const i01 = v[((y0 + 1) % n) * n + (x0 % n)]!;
        const i11 = v[((y0 + 1) % n) * n + ((x0 + 1) % n)]!;
        s += amps[o]! * ((i00 * (1 - tx) + i10 * tx) * (1 - ty) + (i01 * (1 - tx) + i11 * tx) * ty);
      }
      const g = Math.round(128 + (s - 0.5) * 2 * 90);
      const o = (y * NOISE + x) * 4;
      img.data[o] = g;
      img.data[o + 1] = g;
      img.data[o + 2] = g;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  noise = c;
  return c;
}

/**
 * Overlay the (tileable) noise on the rect (x, y, w, h) of the current clip: luminance ±~5 %.
 * `scale` = noise period relative to max(w, h) (a repeating pattern, random phase).
 */
export function grain(ctx: Ctx, x: number, y: number, w: number, h: number, r: Rnd, alpha: number, scale = 1): void {
  const n = noiseTile();
  const pat = ctx.createPattern(n, "repeat");
  if (!pat) return;
  const k = (Math.max(w, h) * scale * 2) / NOISE;
  pat.setTransform(new DOMMatrix([k, 0, 0, k, x - r() * NOISE * k, y - r() * NOISE * k]));
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = alpha;
  ctx.fillStyle = pat;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/** Irregular rounded slab path (per-corner radius jitter = worn edges). */
function slabPath(ctx: Ctx, x: number, y: number, s: number, r: Rnd): void {
  const rad = [0, 0, 0, 0].map(() => s * (0.05 + r() * 0.07));
  const j = (): number => (r() - 0.5) * s * 0.012;
  ctx.beginPath();
  ctx.moveTo(x + rad[0]!, y + j());
  ctx.lineTo(x + s - rad[1]!, y + j());
  ctx.quadraticCurveTo(x + s, y, x + s + j(), y + rad[1]!);
  ctx.lineTo(x + s + j(), y + s - rad[2]!);
  ctx.quadraticCurveTo(x + s, y + s, x + s - rad[2]!, y + s + j());
  ctx.lineTo(x + rad[3]!, y + s + j());
  ctx.quadraticCurveTo(x, y + s, x + j(), y + s - rad[3]!);
  ctx.lineTo(x + j(), y + rad[0]!);
  ctx.quadraticCurveTo(x, y, x + rad[0]!, y);
  ctx.closePath();
}

const slabs = new Map<string, HTMLCanvasElement>();

/** R4 board themes (game/cosmetics.ts): only the DARK slabs change, so lit vs dark reads the same in every theme. */
export type ThemeId = "stone" | "garden" | "snow";
let theme: ThemeId = "stone";
export function setBoardTheme(t: ThemeId): void {
  theme = t;
}
export const boardThemeId = (): ThemeId => theme;
/** two dark slab tints of a theme (the village's theme swatches) */
export const themeTints = (t: ThemeId): readonly [string, string] => [DARK_TINT[t][1]!, DARK_TINT[t][2]!];
const DARK_TINT: Record<ThemeId, readonly string[]> = {
  stone: [PAL.floorHi, "#2A3050", "#2E2F52", PAL.floorHi, "#282E4E", "#2D3150", "#29304F", "#2C2F4F"],
  // mossy garden flagstones: green-grey, same lightness as the stone set
  garden: ["#2A3A3A", "#263634", "#2C3B38", "#2A3A3A", "#243431", "#2B3A37", "#273734", "#2A3936"],
  // frosted slate: a cool blue, a touch lighter, with frost flecks (still far darker than a lit slab)
  snow: ["#33405E", "#303C5A", "#364362", "#33405E", "#2E3A57", "#35425F", "#313E5B", "#34415E"],
};

/** Lit stone palette: the same slab under full lantern light (warm sandstone, ≈ L 0.42 average). */
const LIT_TINT = ["#F0C688", "#ECC084", "#EEC282", "#F2CA8E", "#E9BD84", "#EFC58A", "#EDC083", "#F1C88C"] as const;

/** One flagstone `s` px square, variant v (0–7); lit = the same stone under lantern light. Cached. */
export function slab(s: number, v: number, u: number, lit = false): HTMLCanvasElement {
  const key = `${s}:${v}:${lit ? 1 : 0}:${lit ? "" : theme}`;
  const hit = slabs.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const ctx = c.getContext("2d")!;
  const seed = hashStr(`slab${v}`);
  const r = rng(seed);
  const tint = lit ? LIT_TINT[v % 8]! : DARK_TINT[theme][v % 8]!;
  const g = ctx.createLinearGradient(0, 0, s * 0.35, s);
  if (lit) {
    g.addColorStop(0, mix(tint, "#FFE2A8", 0.35));
    g.addColorStop(0.55, tint);
    g.addColorStop(1, mix(tint, "#B87A44", 0.45));
  } else {
    g.addColorStop(0, mix(tint, "#3A4064", 0.18));
    g.addColorStop(0.55, tint);
    g.addColorStop(1, PAL.floorLo);
  }
  slabPath(ctx, 0, 0, s, rng(seed));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  slabPath(ctx, 0, 0, s, rng(seed));
  ctx.clip();
  // v12 (A4, softer board under the lantern faces): lit grain ×0.6, dark grain ×0.75
  grain(ctx, 0, 0, s, s, r, lit ? 0.18 : 0.32, 1.1);
  grain(ctx, 0, 0, s, s, r, lit ? 0.18 : 0.21, 0.45);
  // pits and flecks
  for (let k = 0; k < 7; k++) {
    ctx.fillStyle = k < 4 ? (lit ? `rgba(110,60,24,${0.1 + r() * 0.1})` : `rgba(8,10,24,${0.13 + r() * 0.15})`) : lit ? `rgba(255,246,220,${0.12 + r() * 0.1})` : `rgba(220,226,255,${0.04 + r() * 0.05})`;
    ctx.beginPath();
    ctx.ellipse(r() * s, r() * s, s * (0.006 + r() * 0.012), s * (0.005 + r() * 0.009), r() * 3, 0, TAU);
    ctx.fill();
  }
  // a crack on half the variants — v12 (A4): dark slabs only (a lit tile carries a lantern face nearby)
  if (v % 2 === 1 && !lit) {
    ctx.strokeStyle = lit ? "rgba(96,50,20,0.5)" : "rgba(8,10,24,0.3)";
    ctx.lineWidth = Math.max(1, 0.9 * u);
    ctx.lineCap = "round";
    ctx.beginPath();
    let x = s * (0.15 + r() * 0.3);
    let y = r() < 0.5 ? 0 : s * (0.2 + r() * 0.3);
    ctx.moveTo(x, y);
    const n = 3 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      x += s * (0.08 + r() * 0.12);
      y += s * (r() - 0.3) * 0.16;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.strokeStyle = lit ? "rgba(255,240,205,0.3)" : "rgba(200,210,255,0.06)";
    ctx.translate(0, Math.max(1, u));
    ctx.stroke();
  }
  // worn hollow (slightly darker dish) on some
  if (v % 3 === 0) {
    const hg = ctx.createRadialGradient(s * 0.6, s * 0.55, 0, s * 0.6, s * 0.55, s * 0.4);
    hg.addColorStop(0, lit ? "rgba(120,64,24,0.14)" : "rgba(8,10,24,0.12)");
    hg.addColorStop(1, "rgba(8,10,24,0)");
    ctx.fillStyle = hg;
    ctx.fillRect(0, 0, s, s);
  }
  // R4 theme marks on dark slabs: moss tufts along the edges (garden), frost flecks (snow)
  if (!lit && theme !== "stone") {
    const n = theme === "garden" ? 5 : 9;
    for (let k = 0; k < n; k++) {
      const edge = r() < 0.5;
      const x = edge ? (r() < 0.5 ? s * 0.06 : s * 0.94) : s * (0.1 + r() * 0.8);
      const y = edge ? s * (0.1 + r() * 0.8) : r() < 0.5 ? s * 0.06 : s * 0.94;
      ctx.fillStyle = theme === "garden" ? `rgba(124,176,108,${0.3 + r() * 0.25})` : `rgba(232,242,255,${0.22 + r() * 0.25})`;
      ctx.beginPath();
      ctx.ellipse(x, y, s * (0.03 + r() * 0.04), s * (0.02 + r() * 0.025), r() * 3, 0, TAU);
      ctx.fill();
    }
  }
  // edge occlusion: worn slabs are a touch darker towards their rims
  const ao = ctx.createRadialGradient(s / 2, s / 2, s * 0.32, s / 2, s / 2, s * 0.75);
  ao.addColorStop(0, "rgba(0,0,0,0)");
  ao.addColorStop(1, lit ? "rgba(90,40,10,0.24)" : "rgba(4,5,14,0.16)");
  ctx.fillStyle = ao;
  ctx.fillRect(0, 0, s, s);
  ctx.restore();
  slabs.set(key, c);
  return c;
}

/** Draw one of the 8 slab variants at (x, y), its grain turned by a random quarter (bevel stays upright). */
export function stampSlab(ctx: Ctx, x: number, y: number, s: number, r: Rnd, u: number, lit = false): void {
  const v = Math.floor(r() * 8);
  const q = Math.floor(r() * 4);
  ctx.save();
  ctx.translate(x + s / 2, y + s / 2);
  ctx.rotate((q * Math.PI) / 2);
  ctx.drawImage(slab(s, v, u, lit), -s / 2, -s / 2, s, s);
  ctx.restore();
  ctx.drawImage(bevel(s, u, lit), x, y, s, s);
}

/** The slab bevel (moonlit / lamp-lit top + right lip, dark bottom + left), kept upright under rotated grain. */
function bevel(s: number, u: number, lit: boolean): HTMLCanvasElement {
  const key = `bevel${s}:${lit ? 1 : 0}`;
  const hit = slabs.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const ctx = c.getContext("2d")!;
  rrectPath(ctx, 0, 0, s, s, s * 0.09);
  ctx.clip();
  const lw = Math.max(1, 1.1 * u);
  ctx.fillStyle = lit ? "rgba(255,246,220,0.3)" : "rgba(210,218,255,0.075)";
  ctx.fillRect(0, 0, s, lw);
  ctx.fillRect(s - lw, 0, lw, s);
  ctx.fillStyle = lit ? "rgba(80,36,10,0.32)" : "rgba(4,5,14,0.28)";
  ctx.fillRect(0, s - lw * 1.4, s, lw * 1.4);
  ctx.fillRect(0, 0, lw * 1.2, s);
  slabs.set(key, c);
  return c;
}

// ---------------------------------------------------------------- the courtyard wall

export type CourtFrame = "track" | "daily" | "deduce";

const WALL = {
  track: { top: "#383C5E", mid: "#2A2D4A", side: "#15172B", seam: "rgba(8,9,24,0.5)", rim: "rgba(214,200,240,0.22)" },
  daily: { top: "#646C9A", mid: "#454C7A", side: "#23284A", seam: "rgba(14,16,40,0.45)", rim: "rgba(244,235,208,0.5)" },
  deduce: { top: "#333C78", mid: "#232A5C", side: "#121638", seam: "rgba(6,8,26,0.55)", rim: "rgba(200,210,255,0.3)" },
} as const;

export interface CourtGeom {
  /** canvas size */
  cw: number;
  ch: number;
  /** top-left of the playing grid (cell 0,0) in the canvas */
  gx: number;
  gy: number;
  cols: number;
  rows: number;
  cs: number;
  gap: number;
  /** wall top-face width (outer edge to grid) */
  wall: number;
  /** wall front face height (the drop to the ground at the bottom) */
  face: number;
  /** max outward bulge of single wall stones (irregular edge), px */
  bulge?: number;
  /** px of ground around the wall the vignette darkens */
  vig?: number;
  u: number;
}

/**
 * The courtyard: cast shadow on the ground, the low stone wall (top face with block seams,
 * moonlit outer lip, front face), the grout bed, the slabs, and the wall's shadow on the floor.
 * Rocks and marker stones are drawn by the caller afterwards (their shadows fall over slabs).
 */
export function paintCourtyard(ctx: Ctx, g: CourtGeom, frame: CourtFrame, seed: string, isFloor: (col: number, row: number) => boolean): void {
  const { cs, u } = g;
  const W = WALL[frame];
  const r = rng(hashStr(`court:${seed}`));
  const ox = g.gx - g.wall;
  const oy = g.gy - g.wall;
  const ow = g.cols * cs + g.wall * 2;
  const oh = g.rows * cs + g.wall * 2;
  const rad = Math.min(g.wall * 0.8, 9 * u);
  // 1. the ground hugs the courtyard: a soft vignette darkening toward the wall (into `vig`
  // px of ground) and the wall's cast shadow (stacked soft rings — no canvas shadowBlur: ~10 ms)
  const vig = g.vig ?? 0;
  for (let k = 0; k < 8 && vig > 0; k++) {
    const e = vig * (1 - k / 8);
    ctx.fillStyle = "rgba(3,4,12,0.05)";
    rrectPath(ctx, ox - e, oy - e * 0.7, ow + e * 2, oh + g.face + e * 1.7, rad + e);
    ctx.fill();
  }
  for (let k = 5; k >= 0; k--) {
    const e = k * 2.2 * u;
    ctx.fillStyle = `rgba(2,3,10,${(0.09 + 0.05 * (5 - k)).toFixed(3)})`;
    rrectPath(ctx, ox - e, oy + 3 * u - e * 0.6, ow + e * 2, oh + g.face + 2 * u + e * 1.6, rad + e);
    ctx.fill();
  }
  // 2. the wall: mortar bed, then individual dressed stones with an irregular outer edge
  const bulge = g.bulge ?? 0;
  rrectPath(ctx, ox, oy + g.face, ow, oh, rad);
  ctx.fillStyle = W.side;
  ctx.fill();
  rrectPath(ctx, ox, oy, ow, oh, rad);
  ctx.fillStyle = "#15172B";
  ctx.fill();
  const mortar = Math.max(1, 1.3 * u);
  const block = (x: number, y: number, w: number, h: number, front: boolean): void => {
    const rr = Math.min(w, h) * 0.22;
    if (front) {
      rrectPath(ctx, x + 0.5 * u, y + h - rr, w - u, rr + g.face, rr);
      ctx.fillStyle = W.side;
      ctx.fill();
    }
    const t = r();
    const bg = ctx.createLinearGradient(x, y, x + w * 0.3, y + h);
    bg.addColorStop(0, mix(W.top, PAL.moon, 0.04 + 0.06 * t));
    bg.addColorStop(1, mix(W.mid, W.top, 0.3 * t));
    rrectPath(ctx, x, y, w, h, rr);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.save();
    rrectPath(ctx, x, y, w, h, rr);
    ctx.clip();
    grain(ctx, x, y, w, h, r, 0.55, 1.2);
    // moonlit top lip, dark lower lip
    ctx.fillStyle = W.rim;
    ctx.fillRect(x, y, w, Math.max(1, 1.1 * u));
    ctx.fillStyle = "rgba(4,5,14,0.35)";
    ctx.fillRect(x, y + h - Math.max(1, 1.4 * u), w, Math.max(1, 1.4 * u));
    ctx.restore();
  };
  const run = (len: number, at: (p: number, l: number, b: number) => void): void => {
    let p = 0;
    while (p < len - 1) {
      let l = cs * (0.5 + r() * 0.45);
      if (len - p - l < cs * 0.3) l = len - p;
      at(p, l - mortar, bulge * r());
      p += l;
    }
  };
  const cw0 = g.wall;
  // left / right runs (between the corners)
  run(oh - cw0 * 2, (p, l, b) => block(ox - b, oy + cw0 + p, cw0 + b, l, false));
  run(oh - cw0 * 2, (p, l, b) => block(ox + ow - cw0, oy + cw0 + p, cw0 + b, l, false));
  // top / bottom runs incl. the corners
  run(ow, (p, l, b) => block(ox + p, oy - b, l, cw0 + b, false));
  run(ow, (p, l, b) => block(ox + p, oy + oh - cw0, l, cw0 + b, true));
  // moss in the joints and on the inner lip
  for (let k = 0; k < 12; k++) {
    const t = r();
    const sideK = Math.floor(r() * 4);
    const x = sideK < 2 ? ox + g.wall + t * (ow - g.wall * 2) : sideK === 2 ? ox + g.wall * (0.3 + r() * 0.5) : ox + ow - g.wall * (0.3 + r() * 0.5);
    const y = sideK >= 2 ? oy + g.wall + t * (oh - g.wall * 2) : sideK === 0 ? oy + g.wall * (0.3 + r() * 0.6) : oy + oh - g.wall * (0.3 + r() * 0.6);
    const n = 3 + Math.floor(r() * 4);
    for (let j = 0; j < n; j++) {
      ctx.fillStyle = j % 2 ? rgba(PAL.mossHi, 0.5) : rgba(PAL.moss, 0.55);
      ctx.beginPath();
      ctx.arc(x + (r() - 0.5) * 6 * u, y + (r() - 0.5) * 3 * u, (0.9 + r() * 1.3) * u, 0, TAU);
      ctx.fill();
    }
  }
  // grass blades at the foot of the wall (left, right, bottom)
  ctx.fillStyle = mix(PAL.hillNear, PAL.moss, 0.35);
  for (let k = 0; k < 26; k++) {
    const side = k % 3;
    const t = 0.04 + 0.92 * r();
    const x = side === 2 ? ox + t * ow : side === 0 ? ox - bulge * 0.5 : ox + ow + bulge * 0.5;
    const y = side === 2 ? oy + oh + g.face : oy + t * oh;
    const hgt = (2.5 + r() * 4) * u;
    const dir = side === 0 ? -1 : side === 1 ? 1 : (r() - 0.5) * 0.6;
    ctx.beginPath();
    ctx.moveTo(x - 1.2 * u, y);
    ctx.quadraticCurveTo(x + dir * hgt * 0.4, y - hgt * 0.6, x + dir * hgt * 0.7, y - hgt);
    ctx.quadraticCurveTo(x + dir * hgt * 0.2, y - hgt * 0.3, x + 1.2 * u, y);
    ctx.closePath();
    ctx.fill();
  }
  if (frame !== "track") {
    // daily: a fine moon-silver inlay line; deduce: small gold stars on the wall top
    const sr = rng(hashStr(`frame:${seed}`));
    if (frame === "daily") {
      rrectPath(ctx, ox + g.wall * 0.42, oy + g.wall * 0.42, ow - g.wall * 0.84, oh - g.wall * 0.84, rad * 0.7);
      ctx.strokeStyle = "rgba(244,235,208,0.5)";
      ctx.lineWidth = Math.max(1, 1.1 * u);
      ctx.stroke();
    }
    for (let k = 0; k < (frame === "daily" ? 12 : 20); k++) {
      const side = k % 4;
      const t = 0.05 + 0.9 * sr();
      const x = side < 2 ? ox + t * ow : side === 2 ? ox + g.wall * 0.42 : ox + ow - g.wall * 0.42;
      const y = side === 0 ? oy + g.wall * 0.42 : side === 1 ? oy + oh - g.wall * 0.42 : oy + t * oh;
      const c = frame === "deduce" && k % 3 === 0 ? "rgba(255,214,140,0.95)" : `rgba(244,235,208,${(0.5 + sr() * 0.4).toFixed(2)})`;
      sparkle(ctx, x, y, (1 + sr() * 1.6) * u, c);
    }
  }
  // the threshold where the path from the house door meets the wall: one wide, paler step
  {
    const tw = Math.min(cs * 1.15, 76 * u);
    const tx = ox + ow / 2 - tw / 2;
    ctx.fillStyle = "rgba(4,5,14,0.45)";
    rrectPath(ctx, tx - 1.5 * u, oy - bulge - 1 * u, tw + 3 * u, g.wall + bulge + 1 * u, 4 * u);
    ctx.fill();
    const thg = ctx.createLinearGradient(0, oy - bulge, 0, oy + g.wall);
    thg.addColorStop(0, mix(W.top, PAL.moon, 0.2));
    thg.addColorStop(1, mix(W.top, PAL.moon, 0.05));
    ctx.fillStyle = thg;
    rrectPath(ctx, tx, oy - bulge, tw, g.wall + bulge - 2 * u, 4 * u);
    ctx.fill();
    ctx.save();
    rrectPath(ctx, tx, oy - bulge, tw, g.wall + bulge - 2 * u, 4 * u);
    ctx.clip();
    grain(ctx, tx, oy - bulge, tw, g.wall + bulge, r, 0.5, 0.6);
    ctx.fillStyle = "rgba(244,235,208,0.3)";
    ctx.fillRect(tx, oy - bulge, tw, Math.max(1, 1.2 * u));
    ctx.restore();
  }
  // 4. the sunken bed (grout) — an inner bevel: dark top/right lip where the wall drops to the floor
  const bx = g.gx - g.gap / 2;
  const by = g.gy - g.gap / 2;
  const bw = g.cols * cs + g.gap;
  const bh = g.rows * cs + g.gap;
  rrectPath(ctx, bx - 1.5 * u, by - 1.5 * u, bw + 3 * u, bh + 3 * u, rad * 0.55);
  ctx.fillStyle = "#0A0C1E";
  ctx.fill();
  rrectPath(ctx, bx, by, bw, bh, rad * 0.45);
  ctx.fillStyle = PAL.grout;
  ctx.fill();
  // 5. slabs
  const gr = groutOf(cs, g.gap);
  const s = cs - gr;
  const sr = rng(hashStr(`slabs:${seed}`));
  for (let row = 0; row < g.rows; row++) {
    for (let col = 0; col < g.cols; col++) {
      if (!isFloor(col, row)) {
        // under a rock: packed earth + a sunk slab edge
        const ex = g.gx + col * cs + gr / 2;
        const ey = g.gy + row * cs + gr / 2;
        ctx.fillStyle = "#15182E";
        rrectPath(ctx, ex, ey, s, s, s * 0.1);
        ctx.fill();
        void sr();
        continue;
      }
      stampSlab(ctx, g.gx + col * cs + gr / 2, g.gy + row * cs + gr / 2, s, sr, u);
    }
  }
  // 6. the wall's shadow on the floor (top band + right band: the moon is up-right)
  ctx.save();
  rrectPath(ctx, bx, by, bw, bh, rad * 0.45);
  ctx.clip();
  const st = ctx.createLinearGradient(0, by, 0, by + cs * 0.3);
  st.addColorStop(0, "rgba(3,4,12,0.55)");
  st.addColorStop(1, "rgba(3,4,12,0)");
  ctx.fillStyle = st;
  ctx.fillRect(bx, by, bw, cs * 0.3);
  const sl = ctx.createLinearGradient(bx + bw, 0, bx + bw - cs * 0.18, 0);
  sl.addColorStop(0, "rgba(3,4,12,0.42)");
  sl.addColorStop(1, "rgba(3,4,12,0)");
  ctx.fillStyle = sl;
  ctx.fillRect(bx + bw - cs * 0.18, by, cs * 0.18, bh);
  ctx.restore();
}

/**
 * The lit floor: the courtyard's slabs (same seed, same stones) under full lantern light, on a
 * warm grout bed. Same canvas geometry as paintCourtyard; only the grid area is painted. The
 * live board shows its cells as light arrives (normal blend), then multiplies the falloff.
 */
export function paintLitFloor(ctx: Ctx, g: CourtGeom, seed: string, isFloor: (col: number, row: number) => boolean): void {
  const { cs, u } = g;
  ctx.fillStyle = "#5A3A22";
  ctx.fillRect(g.gx - g.gap / 2, g.gy - g.gap / 2, g.cols * cs + g.gap, g.rows * cs + g.gap);
  const gr = groutOf(cs, g.gap);
  const s = cs - gr;
  const sr = rng(hashStr(`slabs:${seed}`));
  for (let row = 0; row < g.rows; row++) {
    for (let col = 0; col < g.cols; col++) {
      if (!isFloor(col, row)) {
        void sr();
        continue;
      }
      stampSlab(ctx, g.gx + col * cs + gr / 2, g.gy + row * cs + gr / 2, s, sr, u, true);
    }
  }
}

function sparkle(ctx: Ctx, cx: number, cy: number, r: number, color: string): void {
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

// ---------------------------------------------------------------- marker stone

/** Marker-stone face geometry for a cell of cs px (the numeral sits on the face centre). */
export function markerGeom(cs: number): { hw: number; top: number; bottom: number; side: number; r: number; cy: number } {
  const hw = cs * 0.365;
  const top = -cs * 0.35;
  const bottom = cs * 0.25;
  return { hw, top, bottom, side: cs * 0.12, r: cs * 0.14, cy: (top + bottom) / 2 };
}

/**
 * Numbered rock (v10): the SAME boulder family as the plain rocks (organic outline, cast shadow,
 * underside occlusion, outline, moss) in a paler limestone so the engraved numeral keeps ≈ 8:1,
 * with a dressed (smoothed) face where the numeral is cut. Moss grows only along the lower rim as
 * a band — never as round tufts (v3: a moss tuft was counted as a pip in dots mode).
 * The numeral itself is a live overlay (BoardView) so it can fill with light.
 */
export function drawMarkerStone(ctx: Ctx, cx: number, cy: number, cs: number, r: Rnd): void {
  const R = cs * 0.46;
  drawRock(ctx, cx, cy, R, r, false, true);
  // dressed face: a soft, slightly irregular lighter oval around the numeral
  const fy = cy + cs * NUM_FACE_Y;
  const fg = ctx.createRadialGradient(cx - R * 0.1, fy - R * 0.12, 0, cx, fy, R * 0.7);
  fg.addColorStop(0, "rgba(250,251,255,0.26)");
  fg.addColorStop(0.7, "rgba(240,242,250,0.12)");
  fg.addColorStop(1, "rgba(240,242,250,0)");
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.ellipse(cx, fy, R * 0.72, R * 0.66, (r() - 0.5) * 0.3, 0, TAU);
  ctx.fill();
  // limestone grain + pits so it reads as stone, not a glossy egg
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, R * 0.95, R * 0.83, 0, 0, TAU);
  ctx.clip();
  grain(ctx, cx - R, cy - R, R * 2, R * 2, r, 0.7, 0.5);
  grain(ctx, cx - R, cy - R, R * 2, R * 2, r, 0.45, 0.2);
  for (let k = 0; k < 9; k++) {
    const a = r() * TAU;
    const d = R * (0.35 + r() * 0.5);
    ctx.fillStyle = `rgba(70,76,110,${(0.18 + r() * 0.22).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.86, cs * (0.004 + r() * 0.007), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  // moss band along the lower rim (clipped to the boulder outline drawn by drawRock: approximate
  // with an ellipse of the same size)
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, R * 0.92, R * 0.8, 0, 0, TAU);
  ctx.clip();
  const side = r() < 0.5 ? -1 : 1;
  const mg = ctx.createLinearGradient(0, cy + R * 0.45, 0, cy + R * 0.9);
  mg.addColorStop(0, rgba(PAL.moss, 0));
  mg.addColorStop(0.35, rgba(PAL.moss, 0.75));
  mg.addColorStop(1, rgba(PAL.mossHi, 0.85));
  ctx.fillStyle = mg;
  ctx.beginPath();
  ctx.moveTo(cx + side * R, cy + R * 0.3);
  for (let k = 0; k <= 8; k++) {
    const t = k / 8;
    const x = cx + side * R * (1 - t * 1.5);
    const y = cy + R * (0.5 + 0.14 * Math.sin(t * 9 + r() * 2)) + t * R * 0.12;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(cx - side * R * 0.5, cy + R);
  ctx.lineTo(cx + side * R, cy + R);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Numeral face centre (cell fraction, from the cell centre). */
export const NUM_FACE_Y = -0.03;


// ---------------------------------------------------------------- light plan (shared by the live board and stills)

/** Directions light travels: 0 +x, 1 −x, 2 +y, 3 −y (rotation of the +x ray texture). */
export const DIR_ROT = [0, Math.PI, Math.PI / 2, -Math.PI / 2] as const;
const DX = [1, -1, 0, 0] as const;
const DY = [0, 0, 1, -1] as const;

/**
 * Which light every cell gets (index = row·8 + col, 64 cells): `d` = −1 dark, 0 a lantern's own
 * cell, k > 0 = k steps along the nearest lantern's ray (`dir` = the way that light travels);
 * `rim[i·4 + dir]` = distance of the stone i from the lantern whose ray stops at it (−1 = none).
 * No allocation: callers own the arrays.
 */
export function planLight(cols: number, rows: number, stone: (i: number) => boolean, lantern: (i: number) => boolean, d: Int8Array, dir: Int8Array, rim: Int8Array): void {
  d.fill(-1);
  dir.fill(0);
  rim.fill(-1);
  for (let i = 0; i < 64; i++) {
    if ((i & 7) >= cols || i >> 3 >= rows || !lantern(i)) continue;
    d[i] = 0;
  }
  for (let i = 0; i < 64; i++) {
    if (d[i] !== 0 || !lantern(i)) continue;
    for (let k = 0; k < 4; k++) {
      let x = (i & 7) + DX[k]!;
      let y = (i >> 3) + DY[k]!;
      let step = 1;
      while (x >= 0 && y >= 0 && x < cols && y < rows) {
        const j = y * 8 + x;
        if (stone(j)) {
          const o = j * 4 + k;
          if (rim[o]! < 0 || rim[o]! > step) rim[o] = step;
          break;
        }
        if (d[j]! < 0 || d[j]! > step) {
          d[j] = step;
          dir[j] = k;
        }
        x += DX[k]!;
        y += DY[k]!;
        step++;
      }
    }
  }
}

/** Cached light stamps for a cell size (plain canvases; the live board bakes the same into its TextureBank). */
export interface LightStamps {
  src: CanvasImageSource;
  ray: CanvasImageSource[]; // index d (1..8)
  pool: CanvasImageSource;
  rim: CanvasImageSource;
  marker: CanvasImageSource[]; // per direction
  bloom: CanvasImageSource;
}

export const LIGHT_BAKE = 0.5; // falloff / pool / rims are soft: bake at ½ resolution
export const POOL_R = 1.5; // pool radius, cells
export const RIM_K = 2.3; // rock rim texture size / rock radius

function cv(w: number, h: number, f: (c: Ctx, w: number, h: number) => void): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  f(c.getContext("2d")!, c.width, c.height);
  return c;
}

export function paintPool(c: Ctx, a: number): void {
  const g = c.createRadialGradient(a / 2, a / 2, 0, a / 2, a / 2, a / 2);
  for (const [p, col] of POOL_STOPS) g.addColorStop(p, col);
  c.fillStyle = g;
  c.fillRect(0, 0, a, a);
}

export function lightStamps(cs: number): LightStamps {
  const k = LIGHT_BAKE;
  const w = Math.max(4, Math.round(cs * k));
  const ray: HTMLCanvasElement[] = [];
  for (let d = 0; d <= 8; d++) ray.push(cv(w, w, (c, a) => paintRayFalloff(c, a, Math.max(1, d))));
  const ps = Math.round(cs * POOL_R * 2 * k);
  const rr = cs * 0.43;
  return {
    src: cv(w, w, (c, a) => paintSrcFalloff(c, a)),
    ray,
    pool: cv(ps, ps, (c, a) => paintPool(c, a)),
    rim: cv(rr * RIM_K * k, rr * RIM_K * k, (c, a) => paintRockRim(c, a, rr * k)),
    marker: [0, 1, 2, 3].map((dir) => cv(w, w, (c, a) => paintMarkerRim(c, a, dir))),
    bloom: cv(Math.round(cs * BLOOM_K * k * 0.5), Math.round(cs * BLOOM_K * k * 0.5), (c, a) => paintBloom(c, a)),
  };
}

/**
 * A still of the lit courtyard (keepsakes, postcard, keyframe): copies the lit floor's lit cells
 * from `litFloor` (same canvas geometry as ctx's grid), multiplies the falloff, adds rims and
 * pools. Lanterns themselves are drawn by the caller.
 */
export function paintLightStill(ctx: Ctx, litFloor: CanvasImageSource, lx: number, ly: number, gx: number, gy: number, cs: number, cols: number, rows: number, plan: { d: Int8Array; dir: Int8Array; rim: Int8Array }, st: LightStamps, isNumber: (i: number) => boolean, pools = true): void {
  for (let i = 0; i < 64; i++) {
    const dd = plan.d[i]!;
    if (dd < 0 || (i & 7) >= cols || i >> 3 >= rows) continue;
    const x = gx + (i & 7) * cs;
    const y = gy + (i >> 3) * cs;
    ctx.drawImage(litFloor, lx + (i & 7) * cs, ly + (i >> 3) * cs, cs, cs, x, y, cs, cs);
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.translate(x + cs / 2, y + cs / 2);
    if (dd === 0) ctx.drawImage(st.src, -cs / 2, -cs / 2, cs, cs);
    else {
      ctx.rotate(DIR_ROT[plan.dir[i]!]!);
      ctx.drawImage(st.ray[Math.min(8, dd)]!, -cs / 2, -cs / 2, cs, cs);
    }
    ctx.restore();
  }
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const bs = cs * BLOOM_K;
  for (let i = 0; i < 64; i++) {
    const dd = plan.d[i]!;
    if (dd < 0 || (i & 7) >= cols || i >> 3 >= rows) continue;
    ctx.globalAlpha = bloomA(dd);
    ctx.drawImage(st.bloom, gx + ((i & 7) + 0.5) * cs - bs / 2, gy + ((i >> 3) + 0.5) * cs - bs / 2, bs, bs);
  }
  for (let i = 0; i < 64; i++) {
    for (let k = 0; k < 4; k++) {
      const dd = plan.rim[i * 4 + k]!;
      if (dd < 0) continue;
      const cx = gx + ((i & 7) + 0.5) * cs;
      const cy = gy + ((i >> 3) + 0.5) * cs;
      ctx.globalAlpha = rimA(dd);
      {
        // v10: numbered stones are boulders too — the same rim, a touch larger
        const s = cs * 0.43 * RIM_K * (isNumber(i) ? 1.07 : 1);
        ctx.save();
        ctx.translate(cx, cy - (isNumber(i) ? 0 : cs * 0.02));
        ctx.rotate(DIR_ROT[k]!);
        ctx.drawImage(st.rim, -s / 2, -s / 2, s, s);
        ctx.restore();
      }
    }
  }
  ctx.globalAlpha = 1;
  if (pools) {
    for (let i = 0; i < 64; i++) {
      if (plan.d[i] !== 0) continue;
      const cx = gx + ((i & 7) + 0.5) * cs;
      const cy = gy + ((i >> 3) + 0.5) * cs;
      const s = cs * POOL_R * 2;
      ctx.drawImage(st.pool, cx - s / 2, cy - s / 2, s, s);
    }
  }
  ctx.restore();
}
