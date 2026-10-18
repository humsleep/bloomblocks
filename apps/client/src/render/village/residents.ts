// The village residents (1.0: Wick + Momo, Sage, Luna, Pip). One body grammar — Wick B+'s mochi
// (render/wick.ts paths and face rig) — told apart by palette, flame shape and proportion only
// (r1-visual §6, r2-village-art.md). Static drawings; breathing / blinking are image transforms in the scene.
import type { Ctx } from "../draw.ts";
import { drawWickFace, tracePath, WICK_FLAME, WICK_GROUND, WICK_PATHS, type WickExpr } from "../wick.ts";
import type { ResidentId } from "./lanternHouse.ts";
import { hexA, T } from "./shade.ts";

export interface ResidentPal {
  core: string;
  body: string;
  rim: string;
  line: string;
  /** flame base → tip, flame core */
  fA: string;
  fB: string;
  fC: string;
  blush: string;
  glow: string;
}
export type FlameKind = "drop" | "petal" | "leaf" | "moon" | "twin" | "flake";
export interface ResidentLook {
  pal: ResidentPal;
  flame: FlameKind;
  sx: number;
  sy: number;
  /** whole-body scale (Pip is the small one) */
  k: number;
  /** one accessory at most (Kuri's knit scarf) */
  acc?: "scarf";
}

export const RESIDENTS: Record<ResidentId, ResidentLook> = {
  wick: { pal: { core: "#FFF8E8", body: "#FFE6B8", rim: "#F4B96E", line: "#E9A85E", fA: "#FF9A3C", fB: "#FFDF7A", fC: "#FFF6D6", blush: "#F59A9A", glow: "#FFD98A" }, flame: "drop", sx: 1, sy: 1, k: 1 },
  momo: { pal: { core: "#FFF4F1", body: "#FFDCD6", rim: "#F0A0A6", line: "#E8949B", fA: "#FF8FA8", fB: "#FFD8E2", fC: "#FFF2F5", blush: "#F27D8E", glow: "#FFC2CF" }, flame: "petal", sx: 1, sy: 1, k: 1 },
  sage: { pal: { core: "#F5FCF6", body: "#D9F0DF", rim: "#93CDAE", line: "#7FBF9D", fA: "#6DBE8C", fB: "#D9F5C2", fC: "#F2FFE8", blush: "#F2A3A0", glow: "#BFF0C8" }, flame: "leaf", sx: 1.04, sy: 0.97, k: 1 },
  luna: { pal: { core: "#FAF6FF", body: "#E6DCFA", rim: "#AF9BE6", line: "#9F8AD9", fA: "#FFD86B", fB: "#FFF4C4", fC: "#FFFBEA", blush: "#F2A0BE", glow: "#D9CCFF" }, flame: "moon", sx: 0.95, sy: 1.06, k: 1 },
  pip: { pal: { core: "#FFFDE6", body: "#FFF1A6", rim: "#EBC555", line: "#DDB444", fA: "#FF9F3A", fB: "#FFE36B", fC: "#FFF8D6", blush: "#F7989A", glow: "#FFEB8A" }, flame: "twin", sx: 1, sy: 1, k: 0.84 },
  // round 3: Kuri (cozy knitter: wide, low, a knit scarf) and Yuki (quiet, first snow: tall, a snowflake flame)
  kuri: { pal: { core: "#FCF1E6", body: "#EFD2B6", rim: "#C9946C", line: "#B9845D", fA: "#FF7E4F", fB: "#FFC27A", fC: "#FFEBD6", blush: "#EE8D86", glow: "#FFC79A" }, flame: "drop", sx: 1.06, sy: 0.96, k: 1, acc: "scarf" },
  yuki: { pal: { core: "#F7FBFF", body: "#DCEBFA", rim: "#9DBDE6", line: "#8AAEDB", fA: "#8FC4FF", fB: "#E8F6FF", fC: "#FFFFFF", blush: "#F2A6B6", glow: "#CDE6FF" }, flame: "flake", sx: 0.96, sy: 1.04, k: 0.96 },
};

/** Kuri's knit scarf (a band under the face + a knotted tail), drawn over the body. */
const SCARF = "M17.2 80 C30 86.5 70 86.5 82.8 80 C83.8 82.5 83.6 85 82.4 87 C70 92.5 30 92.5 17.6 87 C16.4 85 16.2 82.5 17.2 80 Z";
const SCARF_TAIL = "M70 86 C72 91 71 97 68.5 101 L76 101.5 C78.5 97 78.5 91 76.5 85.5 Z";

/** Friend flame shapes, all around the same base point (50, 35.8) as Wick's. */
export const FLAME_PATHS: Record<Exclude<FlameKind, "drop" | "twin">, string> & { twinL: string; twinR: string; leafVein: string } = {
  petal: "M50 35.8 C43 34.2 39.8 27 42.4 20 C43.8 16.4 47 14.8 48.6 16.6 L50 19.2 L51.4 16.6 C53 14.8 56.2 16.4 57.6 20 C60.2 27 57 34.2 50 35.8 Z",
  leaf: "M50 35.8 C41.5 31.5 40.5 21 51.5 12.5 C58.5 21 58.5 31.5 50 35.8 Z",
  leafVein: "M50 34 C50.5 27 51 21 51.3 16",
  moon: "M55 13 C45 14 39.5 21.5 40.5 28.5 C41.5 34 46 36.5 51 35.8 C55.5 35.2 58.5 32.5 59.5 29 C56 31 50.5 30.5 48 26.5 C45.5 22 48 16 55 13 Z",
  twinL: "M44.5 20 C45.5 24 49 26.5 49 30 C49 33 47 35 44.5 35 C42 35 40 33 40 30 C40 26.5 43 24.5 44.5 20 Z",
  twinR: "M56.5 14.5 C57.8 19.5 61.5 22.5 61.5 27.5 C61.5 31.8 59.2 34.6 56 34.6 C52.8 34.6 50.6 31.8 50.6 27.5 C50.6 22.5 55 19.5 56.5 14.5 Z",
  /** Yuki: a six-point snowflake (round 3), its bottom tip on the same base point */
  flake: "M50.00 12.80 L52.30 20.32 L59.96 18.55 L54.60 24.30 L59.96 30.05 L52.30 28.28 L50.00 35.80 L47.70 28.28 L40.04 30.05 L45.40 24.30 L40.04 18.55 L47.70 20.32 Z",
};

export type ResidentExpr = "idle" | "happy" | "shy" | "sleepy" | "talk" | "silhouette";
const FACE: Record<Exclude<ResidentExpr, "silhouette">, WickExpr> = { idle: "idle", happy: "happy", shy: "shy", sleepy: "sleepy", talk: "talk" };

/** The resident's drawn extent in its 100 box (incl. flame tip and ground shadow): fit + PAD. */
export const RESIDENT_BOX = { x0: 12, x1: 88, y0: 11, y1: 95 } as const;

function flame(ctx: Ctx, look: ResidentLook, mono: string | null): void {
  const pal = look.pal;
  ctx.save();
  ctx.translate(WICK_FLAME.x, WICK_FLAME.y);
  ctx.rotate((WICK_FLAME.tiltDeg * Math.PI) / 180);
  ctx.scale(WICK_FLAME.scale, WICK_FLAME.scale);
  ctx.translate(-WICK_FLAME.srcX, -WICK_FLAME.srcY);
  let fill: string | CanvasGradient = mono ?? "";
  if (!mono) {
    const g = ctx.createLinearGradient(0, 36, 6, 12);
    g.addColorStop(0, pal.fA);
    g.addColorStop(1, pal.fB);
    fill = g;
  }
  ctx.fillStyle = fill;
  if (look.flame === "drop") {
    tracePath(ctx, WICK_PATHS.flame);
    ctx.fill();
    if (!mono) {
      tracePath(ctx, WICK_PATHS.flameCore);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = pal.fC;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  } else if (look.flame === "twin") {
    tracePath(ctx, FLAME_PATHS.twinL);
    ctx.fill();
    tracePath(ctx, FLAME_PATHS.twinR);
    ctx.fill();
  } else {
    tracePath(ctx, FLAME_PATHS[look.flame]);
    ctx.fill();
    if (!mono && look.flame === "leaf") {
      tracePath(ctx, FLAME_PATHS.leafVein);
      ctx.strokeStyle = hexA(pal.fC, 0.9);
      ctx.lineWidth = 1.3;
      ctx.lineCap = "round";
      ctx.stroke();
    }
  }
  ctx.restore();
}

/**
 * A resident standing with the bottom-centre of its 100-unit box at (gx, gy), `size` px per 100 units.
 * silhouette = the eve-of-moving-in shape in a window: plum, one warm dot of lantern light.
 */
export function drawResidentAt(ctx: Ctx, id: ResidentId, expr: ResidentExpr, gx: number, gy: number, size: number, o: { glow?: boolean; shadow?: boolean; arms?: "up" | "wave" | null; pose?: "stand" | "sit" } = {}): void {
  const look = RESIDENTS[id];
  const pal = look.pal;
  // the eve silhouette: one dusky plum (never black), one warm dot of lantern light
  const mono = expr === "silhouette" ? "#4A3866" : null;
  const k = size / 100;
  ctx.save();
  ctx.translate(gx - WICK_GROUND.x * k, gy - WICK_GROUND.y * k);
  ctx.scale(k, k);
  if (!mono && o.glow !== false) {
    const g = ctx.createRadialGradient(50, 64, 0, 50, 64, 44);
    g.addColorStop(0, hexA(pal.glow, 0.5));
    g.addColorStop(1, hexA(pal.glow, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(50, 64, 44, 0, Math.PI * 2);
    ctx.fill();
  }
  if (o.shadow !== false && !mono) {
    const g = ctx.createRadialGradient(50, 93, 0, 50, 93, 26 * look.sx * look.k);
    g.addColorStop(0, "rgba(20,15,44,0.42)");
    g.addColorStop(0.7, "rgba(20,15,44,0.2)");
    g.addColorStop(1, "rgba(20,15,44,0)");
    ctx.save();
    ctx.translate(50, 93);
    ctx.scale(1, 0.16);
    ctx.translate(-50, -93);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(50, 93, 26 * look.sx * look.k, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // proportions about the ground point; "sit" = settled onto the floor: a lower, wider mochi leaning a little
  // (final G1 #2: visitors lounge by their piece instead of standing over it)
  const sit = o.pose === "sit";
  ctx.translate(WICK_GROUND.x, WICK_GROUND.y);
  if (sit) ctx.rotate(-0.06);
  ctx.scale(look.sx * look.k * (sit ? 1.1 : 1), look.sy * look.k * (sit ? 0.82 : 1));
  ctx.translate(-WICK_GROUND.x, -WICK_GROUND.y);
  const bodyFill = (): string | CanvasGradient => {
    if (mono) return mono;
    const g = ctx.createRadialGradient(45, 63, 2, 50, 68, 40);
    g.addColorStop(0, pal.core);
    g.addColorStop(0.55, pal.body);
    g.addColorStop(1, pal.rim);
    return g;
  };
  if (o.arms) {
    for (const a of o.arms === "wave" ? [WICK_PATHS.armR] : [WICK_PATHS.armL, WICK_PATHS.armR]) {
      tracePath(ctx, a);
      ctx.fillStyle = bodyFill();
      ctx.fill();
      if (!mono) {
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = pal.line;
        ctx.stroke();
      }
    }
  }
  flame(ctx, look, mono);
  tracePath(ctx, WICK_PATHS.body);
  ctx.fillStyle = bodyFill();
  ctx.fill();
  if (mono) {
    // one warm dot: the lantern light they carry
    const g = ctx.createRadialGradient(58, 30, 0, 58, 30, 9);
    g.addColorStop(0, hexA(T.amber, 0.95));
    g.addColorStop(1, hexA(T.amber, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(58, 30, 9, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = pal.line;
    ctx.stroke();
    tracePath(ctx, WICK_PATHS.sheen);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fill();
    drawWickFace(ctx, { expr: FACE[expr as Exclude<ResidentExpr, "silhouette">], blush: pal.blush });
  }
  if (look.acc === "scarf") {
    // knit: a coral band with stitch ribs as value bands (no hairlines), its tail knotted on the right
    ctx.fillStyle = mono ?? "#D9707E";
    tracePath(ctx, SCARF_TAIL);
    ctx.fill();
    tracePath(ctx, SCARF);
    ctx.fill();
    if (!mono) {
      ctx.fillStyle = "rgba(255,255,255,0.28)";
      for (let i = 0; i < 9; i++) {
        const x = 24 + i * 6.5;
        ctx.beginPath();
        ctx.ellipse(x + 0.8, 85.6, 1.1, 2.2, 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
      tracePath(ctx, SCARF);
      ctx.lineWidth = 1.1;
      ctx.strokeStyle = "#A9505E";
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Scale that fits a resident's box (RESIDENT_BOX) into w × h px. */
export function residentFit(w: number, h: number): number {
  const bw = (RESIDENT_BOX.x1 - RESIDENT_BOX.x0) / 100;
  const bh = (RESIDENT_BOX.y1 - RESIDENT_BOX.y0) / 100;
  return Math.min(w / bw, h / bh);
}

/** Where a resident drawn in box `at` (drawResident) has the top of its head (for emote tails), canvas px. */
export function residentHead(at: { x: number; y: number; w: number; h: number }, id: ResidentId = "wick"): { x: number; y: number } {
  const size = residentFit(at.w, at.h);
  const look = RESIDENTS[id];
  const gy = at.y + at.h - ((RESIDENT_BOX.y1 - 92) / 100) * size;
  // the body top (y 40 of 100) through the resident's proportions about the ground point; slightly left of centre
  return { x: at.x + at.w / 2 - 6 * (size / 100) * look.sx * look.k, y: gy - (92 - 41) * (size / 100) * look.sy * look.k };
}

/**
 * A resident framed by its FACE (dialogue portraits, Reality G1 re-review 2 #2): residents are drawn from
 * their feet, so a portrait computes where the feet go for the face centre (eyes / mouth, y ≈ 72 of the box)
 * to sit on (cx, cy). The body fills ≈ 1.6 r across; the flame may leave the frame at the top.
 */
export function portraitLayout(id: ResidentId, r: number): { size: number; dy: number; eyes: { x0: number; x1: number; y0: number; y1: number } } {
  const look = RESIDENTS[id];
  const ks = look.sx * look.k;
  const ky = look.sy * look.k;
  const size = (1.6 * r) / (0.73 * ks);
  const u = size / 100;
  const faceY = 72;
  const dy = (92 - faceY) * ky * u; // feet below the centre
  const ex = (10.5 + 3.4) * ks * u;
  const ey0 = (71 - 4.2 - faceY) * ky * u;
  const ey1 = (71 + 4.2 - faceY) * ky * u;
  return { size, dy, eyes: { x0: -ex, x1: ex, y0: ey0, y1: ey1 } };
}

export function drawResidentPortrait(ctx: Ctx, id: ResidentId, expr: ResidentExpr, cx: number, cy: number, r: number): void {
  const p = portraitLayout(id, r);
  drawResidentAt(ctx, id, expr, cx, cy + p.dy, p.size, { glow: false, shadow: false });
}
