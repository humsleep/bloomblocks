// Wick — the lantern spirit (docs/team/r1-visual.md §5, decision A4). Wick B+ "mochi":
// a squat daifuku body (no tip), low-set small eyes, a small flame floating off-axis above it.
// Everything is drawn from the path strings below into canvas textures ONCE (TextureBank) —
// no per-frame vector work. Motion is a transform of the baked images (src/game/WickActor.ts).
//
// Construction box 100×100, ground contact (50, 92). Paths use absolute M / L / C / Q / Z only
// (traced by tracePath, so the same strings work in a test fake context and in Path2D).
import type { Ctx } from "./draw.ts";

export const WICK_INK = "#3B2C45";

/** Wick's own palette (r1-visual §5.4). The glow uses the scene's warm halo colour. */
export const WICK_PAL = {
  core: "#FFF8E8",
  body: "#FFE6B8",
  rim: "#F4B96E",
  line: "#E9A85E",
  flameA: "#FF9A3C",
  flameB: "#FFDF7A",
  flameCore: "#FFF6D6",
  blush: "#F59A9A",
} as const;

export type WickExpr = "idle" | "happy" | "cheer" | "curious" | "sleepy" | "worried" | "shy" | "surprised" | "talk";
export const WICK_EXPRS: readonly WickExpr[] = ["idle", "happy", "cheer", "curious", "sleepy", "worried", "shy", "surprised"];

/** Faces painted on a board lantern's paper (a subset: the board's states). */
export type FaceExpr = "idle" | "happy" | "worried" | "sleepy";
export const FACE_EXPRS: readonly FaceExpr[] = ["idle", "happy", "worried", "sleepy"];

export const WICK_PATHS = {
  /** squat mochi, 73 wide × 52 tall, widest low (y ≈ 69) — wider than any onion / ghost silhouette */
  body: "M50 40 C70 40 84 52 85.5 69 C87 84 73 92 50 92 C27 92 13 84 14.5 69 C16 52 30 40 50 40 Z",
  sheen: "M24.5 64 C25.5 55 32.5 48.5 41.5 46.5 C36 51.5 32.5 57 31.5 64 Z",
  /** the flame as drawn around its own base (50, 35.8); placed by FLAME below */
  flame: "M52 12.5 C53.5 18 59.5 22 59.5 28 C59.5 32.8 55.3 35.8 50 35.8 C44.7 35.8 40.5 32.8 40.5 28 C40.5 22.5 47 20 52 12.5 Z",
  flameCore: "M50.8 22 C52 25 55 27 55 30 C55 32.5 52.8 33.8 50 33.8 C47.2 33.8 45 32.5 45 30 C45 27.5 48.5 26 50.8 22 Z",
  /** arm nubs (cheer / wave only), drawn behind the body */
  armL: "M18.5 75 C10.5 71.5 8 63.5 12 61 C15.5 59.5 20 65 23.5 70 Z",
  armR: "M81.5 75 C89.5 71.5 92 63.5 88 61 C84.5 59.5 80 65 76.5 70 Z",
} as const;

/** Ground contact in the 100 box. */
export const WICK_GROUND = { x: 50, y: 92 } as const;
/** Body top (y) — the flame floats GAP above it. */
export const WICK_BODY_TOP = 40;
/**
 * B+ flame placement: its source base (50, 35.8) lands at (55, 32.8) — 5 off-axis, lifted 3
 * (gap 7.2 to the body), tilted 10°, scaled 0.85 (the silhouette-misread fix, r1-visual §4).
 */
export const WICK_FLAME = { srcX: 50, srcY: 35.8, x: 55, y: 32.8, tiltDeg: 10, scale: 0.85 } as const;

/** Face rig (100 box): eyes low (60 % down the body) and wide, blush right under them. */
export const WICK_FACE = { ey: 71, ex: [39.5, 60.5], erx: 3.0, ery: 3.8, by: 78.3, bx: [32.5, 67.5], my: 77.2 } as const;

// ---------------------------------------------------------------- path strings

export type PathCmd = { op: "M" | "L" | "C" | "Q" | "Z"; n: number[] };
const ARITY = { M: 2, L: 2, C: 6, Q: 4, Z: 0 } as const;
const parsed = new Map<string, PathCmd[]>();

/** Parse an absolute M / L / C / Q / Z path (the only commands Wick uses). Throws on anything else. */
export function parsePath(d: string): PathCmd[] {
  const hit = parsed.get(d);
  if (hit) return hit;
  const toks = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const out: PathCmd[] = [];
  let i = 0;
  while (i < toks.length) {
    const op = toks[i++]!;
    if (!(op in ARITY)) throw new Error(`wick path: unsupported command "${op}"`);
    const k = ARITY[op as keyof typeof ARITY];
    const n: number[] = [];
    for (let j = 0; j < k; j++) {
      const v = Number(toks[i++]);
      if (!Number.isFinite(v)) throw new Error(`wick path: bad number after "${op}"`);
      n.push(v);
    }
    out.push({ op: op as PathCmd["op"], n });
  }
  parsed.set(d, out);
  return out;
}

/** beginPath + the commands of d on ctx (the caller fills / strokes). */
export function tracePath(ctx: Ctx, d: string): void {
  ctx.beginPath();
  for (const c of parsePath(d)) {
    const n = c.n;
    if (c.op === "M") ctx.moveTo(n[0]!, n[1]!);
    else if (c.op === "L") ctx.lineTo(n[0]!, n[1]!);
    else if (c.op === "C") ctx.bezierCurveTo(n[0]!, n[1]!, n[2]!, n[3]!, n[4]!, n[5]!);
    else if (c.op === "Q") ctx.quadraticCurveTo(n[0]!, n[1]!, n[2]!, n[3]!);
    else ctx.closePath();
  }
}

/** Bounding box of a path's points (end + control points: a hull of the curve). */
export function pathBounds(d: string): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const c of parsePath(d)) {
    for (let j = 0; j + 1 < c.n.length; j += 2) {
      x0 = Math.min(x0, c.n[j]!);
      x1 = Math.max(x1, c.n[j]!);
      y0 = Math.min(y0, c.n[j + 1]!);
      y1 = Math.max(y1, c.n[j + 1]!);
    }
  }
  return { x0, y0, x1, y1 };
}

// ---------------------------------------------------------------- the body (+ face)

export interface WickBodyOpts {
  expr: WickExpr;
  /** 0 open … 1 closed (idle / curious / surprised eyes only) */
  blink?: number;
  /** eye offset in box units (look direction) */
  look?: readonly [number, number];
  arms?: "up" | "wave" | null;
  /** blush colour (village residents; default Wick's) */
  blush?: string;
}

/** Wick's body, arms and face (no flame, no glow, no shadow) in a size × size box. */
export function drawWickBody(ctx: Ctx, size: number, o: WickBodyOpts): void {
  const k = size / 100;
  const P = WICK_PAL;
  ctx.save();
  ctx.scale(k, k);
  const fill = (): CanvasGradient => {
    const g = ctx.createRadialGradient(45, 63, 2, 50, 68, 40);
    g.addColorStop(0, P.core);
    g.addColorStop(0.55, P.body);
    g.addColorStop(1, P.rim);
    return g;
  };
  const arms = o.arms ?? (o.expr === "cheer" ? "up" : null);
  if (arms) {
    for (const a of arms === "wave" ? [WICK_PATHS.armR] : [WICK_PATHS.armL, WICK_PATHS.armR]) {
      tracePath(ctx, a);
      ctx.fillStyle = fill();
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = P.line;
      ctx.stroke();
    }
  }
  tracePath(ctx, WICK_PATHS.body);
  ctx.fillStyle = fill();
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = P.line;
  ctx.stroke();
  tracePath(ctx, WICK_PATHS.sheen);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fill();
  drawWickFace(ctx, o);
  ctx.restore();
}

function strokeInk(ctx: Ctx, w: number): void {
  ctx.lineWidth = w;
  ctx.strokeStyle = WICK_INK;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
}

/** The face in box units (called inside drawWickBody's scale). */
export function drawWickFace(ctx: Ctx, o: WickBodyOpts): void {
  const F = WICK_FACE;
  const [lx, ly] = o.look ?? [0, 0];
  const blink = Math.min(1, Math.max(0, o.blink ?? 0));
  const ellipse = (x: number, y: number, rx: number, ry: number, col: string): void => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  const blush = (a: number, s = 1): void => {
    ctx.globalAlpha = a;
    for (const x of F.bx) ellipse(x, F.by, 5.4 * s, 3.0 * s, o.blush ?? WICK_PAL.blush);
    ctx.globalAlpha = 1;
  };
  const ovals = (rx: number, ry: number): void => {
    for (const x of F.ex) {
      const cx = x + lx;
      const cy = F.ey + ly;
      const open = 1 - blink;
      if (open < 0.18) {
        ctx.beginPath();
        ctx.moveTo(cx - rx - 0.6, cy + 0.6);
        ctx.quadraticCurveTo(cx, cy + 2.2, cx + rx + 0.6, cy + 0.6);
        strokeInk(ctx, 2.2);
        continue;
      }
      ellipse(cx, cy + (1 - open) * ry * 0.5, rx, ry * open, WICK_INK);
      if (open > 0.6) ellipse(cx + rx * 0.33, cy - ry * 0.36, rx * 0.36, rx * 0.36, "#FFFFFF");
    }
  };
  const arcs = (w: number, h: number, sw: number, dy = 0): void => {
    for (const x of F.ex) {
      ctx.beginPath();
      ctx.moveTo(x - w, F.ey + 1 + dy);
      ctx.quadraticCurveTo(x, F.ey + 1 - h + dy, x + w, F.ey + 1 + dy);
      strokeInk(ctx, sw);
    }
  };
  const smile = (w: number, h: number, sw: number): void => {
    ctx.beginPath();
    ctx.moveTo(50 - w, F.my);
    ctx.quadraticCurveTo(50, F.my + h, 50 + w, F.my);
    strokeInk(ctx, sw);
  };
  switch (o.expr) {
    case "happy":
      blush(0.85);
      arcs(4.2, 5.0, 2.5);
      smile(2.6, 3.2, 2.1);
      break;
    case "cheer": {
      blush(0.95, 1.08);
      arcs(4.5, 5.6, 2.7);
      const y = F.my - 0.6;
      ctx.fillStyle = WICK_INK;
      ctx.beginPath();
      ctx.moveTo(46.4, y);
      ctx.lineTo(53.6, y);
      ctx.quadraticCurveTo(53.6, y + 5.6, 50, y + 5.6);
      ctx.quadraticCurveTo(46.4, y + 5.6, 46.4, y);
      ctx.closePath();
      ctx.fill();
      ellipse(50, y + 3.9, 2.1, 1.3, "#F0868F");
      break;
    }
    case "curious":
      blush(0.6);
      F.ex.forEach((x, i) => {
        const s = i ? 1.16 : 0.94;
        const cy = F.ey + ly - (i ? 0.4 : 0);
        ellipse(x + lx, cy, F.erx * s, F.ery * s, WICK_INK);
        ellipse(x + lx + F.erx * 0.35 * s, cy - F.ery * 0.38 * s, F.erx * 0.36 * s, F.erx * 0.36 * s, "#FFFFFF");
      });
      ellipse(51, F.my + 1, 1.5, 1.5, WICK_INK);
      break;
    case "sleepy":
      blush(0.55);
      for (const x of F.ex) {
        ctx.beginPath();
        ctx.moveTo(x - 3.6, F.ey + 0.5);
        ctx.quadraticCurveTo(x, F.ey + 3.6, x + 3.6, F.ey + 0.5);
        strokeInk(ctx, 2.2);
      }
      break;
    case "worried":
      blush(0.45);
      for (const x of F.ex) {
        ellipse(x + lx, F.ey + 0.8 + ly, 2.5, 2.5, WICK_INK);
        ellipse(x + lx + 0.8, F.ey - 0.2 + ly, 0.8, 0.8, "#FFFFFF");
      }
      // soft brows, inner ends up
      ctx.beginPath();
      ctx.moveTo(F.ex[0] - 4.2, F.ey - 4.4);
      ctx.lineTo(F.ex[0] + 3.4, F.ey - 6.4);
      ctx.moveTo(F.ex[1] - 3.4, F.ey - 6.4);
      ctx.lineTo(F.ex[1] + 4.2, F.ey - 4.4);
      strokeInk(ctx, 1.8);
      ctx.beginPath();
      ctx.moveTo(46.4, F.my + 1);
      ctx.quadraticCurveTo(47.3, F.my - 0.6, 48.2, F.my + 1);
      ctx.quadraticCurveTo(49.1, F.my + 2.6, 50, F.my + 1);
      ctx.quadraticCurveTo(50.9, F.my - 0.6, 51.8, F.my + 1);
      ctx.quadraticCurveTo(52.7, F.my + 2.6, 53.6, F.my + 1);
      strokeInk(ctx, 1.8);
      break;
    case "shy":
      blush(1, 1.22);
      arcs(3.6, 3.2, 2.3, 0.6);
      smile(1.6, 1.2, 1.7);
      break;
    case "talk":
      // village dialogue: open eyes, a small open mouth
      blush(0.75);
      ovals(F.erx, F.ery);
      ctx.fillStyle = WICK_INK;
      ctx.beginPath();
      ctx.ellipse(50, F.my + 1.2, 2.2, 1.9, 0, 0, Math.PI * 2);
      ctx.fill();
      ellipse(50, F.my + 1.9, 1.3, 0.8, "#F0868F");
      break;
    case "surprised":
      blush(0.6);
      ovals(F.erx * 1.12, F.ery * 1.12);
      ellipse(50, F.my + 1.4, 1.7, 2.1, WICK_INK);
      break;
    default:
      blush(0.75);
      ovals(F.erx, F.ery);
      smile(1.8, 1.6, 1.8);
  }
}

// ---------------------------------------------------------------- the flame

/** Flame texture size for a Wick of `size` px, and where its base sits in it (origin for the image). */
export function flameBox(size: number): { w: number; h: number; ox: number; oy: number } {
  const k = size / 100;
  const w = Math.max(4, Math.ceil(24 * k));
  const h = Math.max(4, Math.ceil(27 * k));
  return { w, h, ox: 0.5, oy: (h - 1.5 * k) / h };
}

/** The flame (unplaced, base at the texture's origin point flameBox().ox/oy). */
export function drawWickFlame(ctx: Ctx, size: number): void {
  const k = size / 100;
  const b = flameBox(size);
  ctx.save();
  ctx.translate(b.w / 2, b.h * b.oy);
  ctx.scale(k, k);
  ctx.translate(-WICK_FLAME.srcX, -WICK_FLAME.srcY);
  const g = ctx.createLinearGradient(0, 36, 6, 12);
  g.addColorStop(0, WICK_PAL.flameA);
  g.addColorStop(1, WICK_PAL.flameB);
  tracePath(ctx, WICK_PATHS.flame);
  ctx.fillStyle = g;
  ctx.fill();
  tracePath(ctx, WICK_PATHS.flameCore);
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = WICK_PAL.flameCore;
  ctx.fill();
  ctx.restore();
}

/** Soft ground shadow (an ellipse, w × h px). */
export function drawWickShadow(ctx: Ctx, w: number, h: number): void {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, "rgba(10,8,30,0.42)");
  g.addColorStop(0.7, "rgba(10,8,30,0.22)");
  g.addColorStop(1, "rgba(10,8,30,0)");
  ctx.save();
  ctx.translate(0, h / 2);
  ctx.scale(1, h / w);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(w / 2, 0, w / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- the board lantern's face

/**
 * A face on a lantern's paper, in a w × w texture (w ≈ the paper body's width). Under it a soft
 * cream underlay: the lantern's white-hot core would wash the blush out (r1-visual §5.5).
 * look: −1 / 0 / 1 (the eyes turn towards a conflict partner).
 */
export function drawLanternFace(ctx: Ctx, w: number, expr: FaceExpr, look = 0): void {
  const cx = w / 2;
  const cy = w / 2;
  const u = w / 26;
  const under = ctx.createRadialGradient(cx, cy + 1.5 * u, 0, cx, cy + 1.5 * u, w * 0.5);
  under.addColorStop(0, "rgba(255,236,196,0.62)");
  under.addColorStop(0.6, "rgba(255,232,186,0.4)");
  under.addColorStop(1, "rgba(255,232,186,0)");
  ctx.fillStyle = under;
  ctx.fillRect(0, 0, w, w);
  const ex = 4.6 * u;
  const ey = cy + 2.0 * u;
  const lx = look * 1.3 * u;
  const dot = (x: number, y: number, rx: number, ry: number, col: string): void => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  const ink = (lw: number): void => {
    ctx.lineWidth = lw;
    ctx.strokeStyle = WICK_INK;
    ctx.lineCap = "round";
    ctx.stroke();
  };
  const blush = (a: number): void => {
    ctx.globalAlpha = a;
    for (const s of [-1, 1]) dot(cx + s * 7.6 * u, ey + 3.9 * u, 2.4 * u, 1.35 * u, "#F28C8C");
    ctx.globalAlpha = 1;
  };
  if (expr === "happy") {
    blush(0.9);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * ex - 2 * u, ey + 0.7 * u);
      ctx.quadraticCurveTo(cx + s * ex, ey - 2.2 * u, cx + s * ex + 2 * u, ey + 0.7 * u);
      ink(1.5 * u);
    }
    ctx.beginPath();
    ctx.moveTo(cx - 1.4 * u, ey + 3.2 * u);
    ctx.quadraticCurveTo(cx, ey + 5 * u, cx + 1.4 * u, ey + 3.2 * u);
    ink(1.2 * u);
  } else if (expr === "worried") {
    blush(0.5);
    for (const s of [-1, 1]) dot(cx + s * ex + lx, ey + 0.4 * u, 1.45 * u, 1.45 * u, WICK_INK);
    ctx.beginPath();
    ctx.moveTo(cx - ex - 2.2 * u, ey - 2.6 * u);
    ctx.lineTo(cx - ex + 1.8 * u, ey - 3.8 * u);
    ctx.moveTo(cx + ex - 1.8 * u, ey - 3.8 * u);
    ctx.lineTo(cx + ex + 2.2 * u, ey - 2.6 * u);
    ctx.moveTo(cx - 2 * u, ey + 4 * u);
    ctx.quadraticCurveTo(cx - 1 * u, ey + 3 * u, cx, ey + 4 * u);
    ctx.quadraticCurveTo(cx + 1 * u, ey + 5 * u, cx + 2 * u, ey + 4 * u);
    ink(1.1 * u);
  } else if (expr === "sleepy") {
    blush(0.5);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * ex - 1.9 * u, ey);
      ctx.quadraticCurveTo(cx + s * ex, ey + 1.8 * u, cx + s * ex + 1.9 * u, ey);
      ink(1.3 * u);
    }
  } else {
    blush(0.75);
    for (const s of [-1, 1]) {
      dot(cx + s * ex + lx, ey, 1.55 * u, 1.95 * u, WICK_INK);
      dot(cx + s * ex + lx + 0.55 * u, ey - 0.75 * u, 0.55 * u, 0.55 * u, "#FFFFFF");
    }
    ctx.beginPath();
    ctx.moveTo(cx - 1 * u, ey + 3.3 * u);
    ctx.quadraticCurveTo(cx, ey + 4.2 * u, cx + 1 * u, ey + 3.3 * u);
    ink(1.05 * u);
  }
}

// ---------------------------------------------------------------- motion (r1-visual §5.6)

const easeOut = (t: number): number => 1 - (1 - t) * (1 - t);
const easeIn = (t: number): number => t * t;
const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

export interface WickPose {
  sx: number;
  sy: number;
  /** vertical offset, box units (negative = up) */
  dy: number;
  /** body tilt, degrees */
  rot: number;
  /** horizontal shiver, box units */
  dx: number;
  flameS: number;
  flameRot: number;
}
export const REST: Readonly<WickPose> = { sx: 1, sy: 1, dy: 0, rot: 0, dx: 0, flameS: 1, flameRot: 0 };

/** Idle breathe: 3.2 s loop (sy ±2.2 %, sx ∓1.4 %), flame flicker 900 + 370 ms, sway ±4° / 2.1 s. */
export function wickBreathe(ms: number, slow = false): WickPose {
  const T = slow ? 4800 : 3200;
  const s = Math.sin((2 * Math.PI * ms) / T);
  const a = slow ? 0.6 : 1;
  return {
    ...REST,
    sy: 1 + 0.022 * a * s,
    sx: 1 - 0.014 * a * s,
    flameS: (slow ? 0.8 : 1) + 0.05 * a * Math.sin((2 * Math.PI * ms) / 900) + 0.03 * a * Math.sin((2 * Math.PI * ms) / 370),
    flameRot: 4 * a * Math.sin((2 * Math.PI * ms) / 2100),
  };
}

/** Blink: 140 ms (close 50 · hold 30 · open 60) → eye closure 0…1. */
export function wickBlink(ms: number): number {
  if (ms < 0 || ms > 140) return 0;
  if (ms < 50) return easeIn(ms / 50);
  if (ms < 80) return 1;
  return 1 - easeOut((ms - 80) / 60);
}
export const BLINK_MS = 140;
export const HOP_MS = 620;
export const WORRY_MS = 480;

/** Happy hop, 620 ms: squash 90 → rise 210 (dy −14) → fall 180 → land squash 80 → settle 60. */
export function wickHop(ms: number, height = 14): WickPose {
  const r: WickPose = { ...REST };
  if (ms < 0 || ms >= HOP_MS) return r;
  if (ms < 90) {
    const t = easeOut(ms / 90);
    r.sx = 1 + 0.12 * t;
    r.sy = 1 - 0.12 * t;
  } else if (ms < 300) {
    const t = (ms - 90) / 210;
    r.dy = -height * easeOut(t);
    r.sx = 0.93 + 0.07 * t;
    r.sy = 1.09 - 0.09 * t;
    r.flameS = 1 + 0.2 * t;
  } else if (ms < 480) {
    const t = (ms - 300) / 180;
    r.dy = -height * (1 - easeIn(t));
    r.sx = 1 - 0.04 * t;
    r.sy = 1 + 0.05 * t;
    r.flameS = 1.2 - 0.15 * t;
  } else if (ms < 560) {
    const t = (ms - 480) / 80;
    r.sx = 1 + 0.1 * Math.sin(Math.PI * t);
    r.sy = 1 - 0.1 * Math.sin(Math.PI * t);
    r.flameS = 1.05;
  } else {
    const t = clamp01((ms - 560) / 60);
    r.sx = 1 - 0.02 * Math.sin(Math.PI * t);
    r.sy = 1 + 0.02 * Math.sin(Math.PI * t);
    r.flameS = 1.05 - 0.05 * t;
  }
  return r;
}

/** Worried: react 120 ms (flame −20 %, leans away 8°), 14 Hz shiver ±0.8 decaying to 480 ms, hold lean −3°. */
export function wickWorry(ms: number): WickPose {
  const t = easeOut(clamp01(ms / 120));
  const r: WickPose = { ...REST, flameS: 1 - 0.2 * t, flameRot: -8 * t, rot: -3 * t, sy: 1 - 0.03 * t, sx: 1 + 0.02 * t };
  if (ms > 120 && ms < WORRY_MS) r.dx = 0.8 * Math.sin(((ms - 120) / 1000) * 14 * 2 * Math.PI) * (1 - (ms - 120) / (WORRY_MS - 120));
  return r;
}
