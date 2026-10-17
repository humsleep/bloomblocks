// The village at dusk (1.0: one time of day) — sky, hills, lawn, paths and props in the kit's light
// model, and the default layout of the plots (houses, the cottage, the mailbox) the paths lead to.
// Design space 430 × 932 pt (iPhone 15 Pro Max); villageLayout(at) maps it onto any box (width-fit,
// bottom-anchored: a taller box shows more sky, a shorter one crops sky).
import type { Ctx } from "../draw.ts";
import { drawLanternHouse, LANTERN_THEMES, type LanternTheme, type ResidentId } from "./lanternHouse.ts";
import { contact, flower, glow, hexA, miniLantern, mix, moon, P, reseed, rnd, rrect, solid, stoneBlob, T, texture, type Box } from "./shade.ts";
import { atmos, canopy, drawKeyLight, drawTimeWash, lawnColours, setAtmos, type Season, type TimeOfDay } from "./atmos.ts";

export const DESIGN = { w: 430, h: 932 } as const;

export interface Plot {
  /** bottom centre (door) in design pt, and the house scale (units → pt) */
  x: number;
  y: number;
  s: number;
}
/** Where the lantern-houses stand (back row, middle row, front row). */
export const PLOTS: Record<ResidentId | "cottage", Plot> = {
  // back row (round 3: four houses — Sage, Kuri, Luna, Yuki)
  sage: { x: 54, y: 438, s: 0.5 },
  kuri: { x: 160, y: 430, s: 0.52 },
  luna: { x: 270, y: 428, s: 0.5 },
  yuki: { x: 376, y: 436, s: 0.5 },
  wick: { x: 92, y: 640, s: 0.98 },
  momo: { x: 340, y: 640, s: 0.92 },
  pip: { x: 84, y: 836, s: 0.84 },
  cottage: { x: 338, y: 846, s: 0.92 },
};
/** The cottage's mailbox (the letters), bottom centre + scale. */
export const MAILBOX_PLOT = { x: 254, y: 858, s: 1.1 } as const;

/** Map design pt → the box: k px per pt, (ox, oy) = where design (0, 0) lands. */
export function villageMap(at: Box): { k: number; ox: number; oy: number } {
  const k = at.w / DESIGN.w;
  return { k, ox: at.x, oy: at.y + at.h - DESIGN.h * k };
}

/**
 * The plots in canvas px for the box: each house's PaintBox (bottom centre at its door), plus the mailbox.
 * Houses are drawn by drawLanternHouse(spec, box) — the box's bottom centre is the door's ground point.
 */
export function villageLayout(at: Box): { houses: Record<ResidentId | "cottage", Box>; mailbox: Box; k: number } {
  const m = villageMap(at);
  const box = (p: Plot, wU: number, hU: number): Box => {
    const w = wU * p.s * m.k;
    const h = hU * p.s * m.k;
    return { x: m.ox + p.x * m.k - w / 2, y: m.oy + p.y * m.k - h, w, h };
  };
  const houses = {} as Record<ResidentId | "cottage", Box>;
  for (const id of Object.keys(PLOTS) as (ResidentId | "cottage")[]) houses[id] = box(PLOTS[id], 158, 170);
  return { houses, mailbox: box({ ...MAILBOX_PLOT }, 30, 44), k: m.k };
}

// ---------------------------------------------------------------- sky & land

function sky(ctx: Ctx, w: number, top: number, horizon: number): void {
  const A = atmos().sky;
  const g = ctx.createLinearGradient(0, top, 0, horizon);
  g.addColorStop(0, A.sky[0]);
  g.addColorStop(0.38, A.sky[1]);
  g.addColorStop(0.72, A.sky[2]);
  g.addColorStop(0.9, A.sky[3]);
  g.addColorStop(1, A.sky[4]);
  ctx.fillStyle = g;
  ctx.fillRect(0, top, w, horizon - top + 40);
  // the afterglow sits LEFT (the key light's source); the right horizon cools to mauve
  const cool = ctx.createLinearGradient(0, 0, w, 0);
  cool.addColorStop(0, hexA("#77598C", 0));
  cool.addColorStop(0.55, hexA("#77598C", 0.15));
  cool.addColorStop(1, hexA("#5A4A86", A.coolA));
  ctx.fillStyle = cool;
  ctx.fillRect(0, horizon * 0.55, w, horizon * 0.45 + 40);
  const ag = ctx.createRadialGradient(-30, horizon, 10, -30, horizon, w * 0.95);
  ag.addColorStop(0, hexA(A.glow, A.glowA));
  ag.addColorStop(0.5, hexA(A.glow, A.glowA * 0.3));
  ag.addColorStop(1, hexA(A.glow, 0));
  ctx.fillStyle = ag;
  ctx.fillRect(0, top, w, horizon - top + 40);
  reseed(11);
  for (let i = 0; i < A.stars; i++) {
    const x = rnd() * w;
    const y = top + rnd() * (horizon * 0.62 - top);
    const r = rnd() < 0.1 ? 1.4 : 0.5 + rnd() * 0.6;
    ctx.fillStyle = hexA(T.cream, 0.35 + rnd() * 0.55);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 6.3);
    ctx.fill();
  }
}

/** A soft cloud (blurred by a shadow, which every WebView supports; no ctx.filter). */
function cloud(ctx: Ctx, x: number, y: number, s: number, a = 0.5): void {
  const p = P((q) => {
    q.moveTo(x - 60 * s, y);
    q.bezierCurveTo(x - 62 * s, y - 16 * s, x - 40 * s, y - 22 * s, x - 28 * s, y - 14 * s);
    q.bezierCurveTo(x - 22 * s, y - 34 * s, x + 10 * s, y - 36 * s, x + 16 * s, y - 18 * s);
    q.bezierCurveTo(x + 34 * s, y - 28 * s, x + 62 * s, y - 16 * s, x + 58 * s, y);
    q.closePath();
  });
  ctx.save();
  ctx.globalAlpha = a;
  // the shape is drawn far off-canvas; only its blurred shadow lands at (x, y)
  const m = ctx.getTransform();
  const sc = Math.hypot(m.a, m.b);
  const off = 10000;
  ctx.shadowColor = atmos().sky.cloud;
  ctx.shadowBlur = 5 * s * sc;
  ctx.shadowOffsetX = off * sc;
  ctx.translate(-off, 0);
  ctx.fillStyle = "#000";
  ctx.fill(p);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = a * 0.9;
  ctx.clip(p);
  const lip = ctx.createLinearGradient(x - 60 * s, 0, x + 60 * s, 0);
  lip.addColorStop(0, hexA("#FFD6C0", 0.45));
  lip.addColorStop(0.5, hexA("#FFD6C0", 0));
  ctx.fillStyle = lip;
  ctx.fillRect(x - 64 * s, y - 40 * s, 128 * s, 44 * s);
  ctx.restore();
}

/** A rolling hill band (top edge from a few sines), shaded and rim-lit (a value band) along its crest. */
function hill(ctx: Ctx, w: number, y: number, amp: number, phase: number, col: string, h: number, rimA = 0.3): void {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 40; i++) {
    const x = (w * i) / 40;
    pts.push([x, y - amp * (0.6 * Math.sin((x / w) * Math.PI * 1.6 + phase) + 0.4 * Math.sin((x / w) * Math.PI * 3.7 + phase * 1.9))]);
  }
  const p = P((q) => {
    q.moveTo(0, pts[0]![1]);
    for (const [x, yy] of pts) q.lineTo(x, yy);
    q.lineTo(w, y + h);
    q.lineTo(0, y + h);
    q.closePath();
  });
  const g = ctx.createLinearGradient(0, y - amp, 0, y + h);
  g.addColorStop(0, mix(col, T.key, 0.08));
  g.addColorStop(1, mix(col, T.plum, 0.4));
  ctx.fillStyle = g;
  ctx.fill(p);
  ctx.save();
  ctx.clip(p);
  ctx.translate(0, 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = hexA(T.key, rimA);
  ctx.beginPath();
  pts.forEach(([x, yy], i) => (i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy)));
  ctx.stroke();
  if (atmos().season === "winter") {
    // snow on the crest: a soft white band (value band, no outline), lit from the left
    ctx.lineWidth = 8;
    const sg = ctx.createLinearGradient(0, 0, w, 0);
    sg.addColorStop(0, hexA("#F4F8FF", 0.9));
    sg.addColorStop(1, hexA("#C9D6EE", 0.75));
    ctx.strokeStyle = sg;
    ctx.beginPath();
    pts.forEach(([x, yy], i) => (i ? ctx.lineTo(x, yy + 2) : ctx.moveTo(x, yy + 2)));
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- nature props

function tree(ctx: Ctx, x: number, y: number, s: number, tint = 0): void {
  contact(ctx, x, y + 2 * s, 30 * s, 7 * s);
  solid(ctx, rrect(x - 5 * s, y - 34 * s, 10 * s, 36 * s, 4 * s), T.wood, { x: x - 5 * s, y: y - 34 * s, w: 10 * s, h: 36 * s }, { rim: 1, tex: "wood" });
  const lobes: [number, number, number][] = [[0, -70, 30], [-22, -56, 22], [22, -54, 23], [-8, -88, 20], [14, -84, 19]];
  const leaf = mix(canopy(Math.round(x + y)), T.lilac, tint);
  const can = P((q) => {
    for (const [dx, dy, r] of lobes) {
      q.moveTo(x + (dx + r) * s, y + dy * s);
      q.arc(x + dx * s, y + dy * s, r * s, 0, 6.3);
    }
  });
  ctx.save();
  ctx.translate(1.4 * s, 1.8 * s);
  ctx.fillStyle = hexA(T.plum, 0.5);
  ctx.fill(can);
  ctx.restore();
  const bx = { x: x - 45 * s, y: y - 108 * s, w: 90 * s, h: 76 * s };
  solid(ctx, can, leaf, bx, { rim: 0, lit: 0.34, shade: 0.4, line: false, tex: "leaf" });
  ctx.save();
  ctx.clip(can);
  ctx.fillStyle = hexA(T.leafHi, 0.28);
  for (const [dx, dy, r] of [[-14, -86, 14], [-26, -62, 10], [2, -96, 9]] as const) {
    ctx.beginPath();
    ctx.arc(x + dx * s, y + dy * s, r * s, 0, 6.3);
    ctx.fill();
  }
  seasonTop(ctx, x, y, s, lobes);
  ctx.restore();
}

/** Season marks on a canopy (inside its clip): spring blossoms, winter snow caps on the lit tops. */
function seasonTop(ctx: Ctx, x: number, y: number, s: number, lobes: readonly (readonly [number, number, number])[]): void {
  const se = atmos().season;
  if (se === "spring") {
    reseed(Math.round(x * 7 + y));
    for (let i = 0; i < 14; i++) {
      const [dx, dy, r] = lobes[i % lobes.length]!;
      flower(ctx, x + (dx + (rnd() - 0.5) * r * 1.4) * s, y + (dy + (rnd() - 0.6) * r) * s, 2.6 * s, i % 3 ? "#F8C4D2" : "#FFFFFF");
    }
  } else if (se === "winter") {
    ctx.fillStyle = hexA("#F4F8FF", 0.92);
    for (const [dx, dy, r] of lobes) {
      ctx.beginPath();
      ctx.ellipse(x + (dx - r * 0.12) * s, y + (dy - r * 0.62) * s, r * 0.78 * s, r * 0.34 * s, -0.12, 0, 6.3);
      ctx.fill();
    }
  }
}

function bush(ctx: Ctx, x: number, y: number, s: number, col: string = T.leaf, flowers: readonly string[] | null = null): void {
  contact(ctx, x, y + 1, 22 * s, 5 * s, 0.3);
  const p = P((q) => {
    for (const [dx, dy, r] of [[-12, -10, 11], [0, -15, 13], [13, -10, 11], [-4, -6, 10], [7, -6, 10]] as const) {
      q.moveTo(x + (dx + r) * s, y + dy * s);
      q.arc(x + dx * s, y + dy * s, r * s, 0, 6.3);
    }
  });
  ctx.save();
  ctx.translate(1 * s, 1.4 * s);
  ctx.fillStyle = hexA(T.plum, 0.5);
  ctx.fill(p);
  ctx.restore();
  const bc = atmos().season === "summer" ? col : canopy(Math.round(x), col);
  solid(ctx, p, bc, { x: x - 24 * s, y: y - 28 * s, w: 48 * s, h: 28 * s }, { rim: 0, lit: 0.34, line: false, tex: "leaf" });
  ctx.save();
  ctx.clip(p);
  ctx.fillStyle = hexA(T.leafHi, 0.3);
  for (const [dx, dy, r] of [[-12, -16, 6], [0, -22, 6]] as const) {
    ctx.beginPath();
    ctx.arc(x + dx * s, y + dy * s, r * s, 0, 6.3);
    ctx.fill();
  }
  ctx.restore();
  if (atmos().season === "winter") seasonTop(ctx, x, y, s, [[-12, -10, 11], [0, -15, 13], [13, -10, 11]]);
  if (flowers && (atmos().season === "spring" || atmos().season === "summer")) {
    reseed(Math.round(x * 13 + y));
    for (let i = 0; i < 6; i++) flower(ctx, x + (rnd() - 0.5) * 34 * s, y - (8 + rnd() * 16) * s, 2.6 * s, flowers[i % flowers.length]!);
  }
}

function grassTufts(ctx: Ctx, x0: number, x1: number, y: number, n: number, col: string, s = 1): void {
  ctx.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const x = x0 + rnd() * (x1 - x0);
    const h = (4 + rnd() * 6) * s;
    for (const lean of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x - 1.4 * s, y);
      ctx.quadraticCurveTo(x + lean * 0.5 * s, y - h * 0.6, x + lean * 2.4 * s, y - h * (lean > 0 ? 1 : 0.8));
      ctx.quadraticCurveTo(x + lean * 0.4 * s, y - h * 0.35, x + 1.4 * s, y);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function fence(ctx: Ctx, x0: number, x1: number, y: number, s = 1): void {
  const n = Math.max(2, Math.round((x1 - x0) / (16 * s)));
  for (const ry of [-14, -7]) solid(ctx, rrect(x0, y + ry * s, x1 - x0, 3 * s, 1.5 * s), T.woodHi, { x: x0, y: y + ry * s, w: x1 - x0, h: 3 * s }, { rim: 0.6, ao: 0 });
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    contact(ctx, x, y + 1, 5 * s, 1.6 * s, 0.3);
    const post = P((q) => {
      q.moveTo(x - 3 * s, y);
      q.lineTo(x - 3 * s, y - 18 * s);
      q.quadraticCurveTo(x, y - 22 * s, x + 3 * s, y - 18 * s);
      q.lineTo(x + 3 * s, y);
      q.closePath();
    });
    solid(ctx, post, T.wood, { x: x - 3 * s, y: y - 22 * s, w: 6 * s, h: 22 * s }, { rim: 0.8, tex: "wood" });
  }
}

function lampPost(ctx: Ctx, x: number, y: number, s = 1): void {
  contact(ctx, x, y + 1, 10 * s, 3 * s);
  const L = atmos().sky.lamp;
  glow(ctx, x, y + 2, 46 * s, T.glow, 0.28 * L, 0.32);
  solid(ctx, rrect(x - 2 * s, y - 58 * s, 4 * s, 58 * s, 2 * s), T.woodLo, { x: x - 2 * s, y: y - 58 * s, w: 4 * s, h: 58 * s }, { rim: 0.8, tex: "wood" });
  glow(ctx, x, y - 52 * s, 30 * s, T.glow, 0.55 * L);
  miniLantern(ctx, x, y - 52 * s, 12 * s, true);
}

type Pt = [number, number, number];
function spline(pts: Pt[], n = 12): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    for (let j = 0; j < n; j++) {
      const t = j / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number): number => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), p1[2] + (p2[2] - p1[2]) * t]);
    }
  }
  out.push(pts[pts.length - 1]!);
  return out;
}

/** A dirt path along a smooth curve (value bands, no outline), stepping stones ±30 % in size and spacing. */
function softPath(ctx: Ctx, pts: Pt[], width: number): void {
  const road = (wk: number, col: string): void => {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = col;
    for (let i = 0; i < pts.length - 1; i++) {
      ctx.lineWidth = width * wk * pts[i]![2];
      ctx.beginPath();
      ctx.moveTo(pts[i]![0], pts[i]![1]);
      ctx.lineTo(pts[i + 1]![0], pts[i + 1]![1]);
      ctx.stroke();
    }
    ctx.restore();
  };
  road(1.3, hexA("#1E1A40", 0.5));
  road(1.12, "#7B6A8E");
  road(0.7, hexA("#9E8A9E", 0.7));
  road(0.28, hexA("#BBA4A8", 0.4));
  reseed(Math.round(pts[0]![0] * 3 + pts[0]![1]));
  let acc = 0;
  let next = 14;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]!;
    const [x1, y1, k] = pts[i]!;
    acc += Math.hypot(x1 - x0, y1 - y0);
    if (acc < next * k) continue;
    acc = 0;
    next = 22 + rnd() * 14;
    const side = rnd() < 0.5 ? -1 : 1;
    const r = (8 + rnd() * 5) * k;
    stoneBlob(ctx, x1 + side * width * 0.16 * k * rnd(), y1, r, r * 0.4, mix(T.stoneHi, "#E8D6C8", 0.2 + rnd() * 0.3));
  }
}

function pond(ctx: Ctx, x: number, y: number, rx: number, ry: number): void {
  ctx.fillStyle = mix(T.stoneLo, T.plum, 0.3);
  ctx.fill(P((q) => q.ellipse(x, y, rx + 6, ry + 4, 0, 0, 6.3)));
  const p = P((q) => q.ellipse(x, y, rx, ry, 0, 0, 6.3));
  const g = ctx.createLinearGradient(0, y - ry, 0, y + ry);
  g.addColorStop(0, "#2C3570");
  g.addColorStop(1, T.water);
  ctx.fillStyle = g;
  ctx.fill(p);
  ctx.save();
  ctx.clip(p);
  const r = ctx.createLinearGradient(0, y - ry, 0, y + ry);
  r.addColorStop(0, hexA("#D18E9D", 0.35));
  r.addColorStop(1, hexA("#D18E9D", 0));
  ctx.fillStyle = r;
  ctx.fillRect(x - rx, y - ry, rx * 2, ry * 2);
  // the moon's streak — on the LEFT half (the light's side)
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = hexA("#FFF3DE", 0.45 - i * 0.08);
    ctx.beginPath();
    ctx.ellipse(x - rx * 0.3, y - ry * 0.45 + i * ry * 0.26, rx * (0.14 - i * 0.02), Math.max(0.6, ry * 0.06), 0, 0, 6.3);
    ctx.fill();
  }
  ctx.restore();
  reseed(17);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * 6.283 + rnd() * 0.3;
    stoneBlob(ctx, x + Math.cos(a) * (rx + 5), y + Math.sin(a) * (ry + 3), 4.4 + rnd() * 2.4, 2.6 + rnd() * 1.4, mix(T.stone, T.lilac, rnd() * 0.4));
  }
  for (const [dx, dy, rr] of [[-0.45, 0.1, 6], [0.3, 0.25, 5]] as const) {
    const lx = x + dx * rx;
    const ly = y + dy * ry;
    const lp = P((q) => {
      q.moveTo(lx, ly);
      q.ellipse(lx, ly, rr, rr * 0.45, 0, 0.3, 6.0);
      q.closePath();
    });
    solid(ctx, lp, "#5F9C7C", { x: lx - rr, y: ly - rr * 0.45, w: rr * 2, h: rr * 0.9 }, { rim: 0.6 });
  }
  if (atmos().season === "winter") {
    // frozen: pale ice over the water, a key-lit streak
    ctx.fillStyle = hexA("#DCE8F8", 0.72);
    ctx.fill(p);
    ctx.fillStyle = hexA("#FFFFFF", 0.6);
    ctx.beginPath();
    ctx.ellipse(x - rx * 0.35, y - ry * 0.3, rx * 0.3, ry * 0.12, -0.15, 0, 6.3);
    ctx.fill();
  } else flower(ctx, x - 0.45 * rx + 1.5, y + 0.1 * ry - 1.5, 2.6, T.pink);
}

function rock(ctx: Ctx, x: number, y: number, s: number): void {
  stoneBlob(ctx, x, y, 9 * s, 6 * s, mix(T.stone, T.lilac, 0.25));
  ctx.fillStyle = hexA(T.moss, 0.7);
  ctx.beginPath();
  ctx.ellipse(x - 2 * s, y - 4 * s, 5 * s, 2 * s, -0.2, 0, 6.3);
  ctx.fill();
}

function flowerBed(ctx: Ctx, x0: number, x1: number, y: number, k: number): void {
  const se = atmos().season;
  if (se === "winter") return;
  reseed(Math.round(x0 * 7 + y));
  const cols = se === "autumn" ? ["#E3B04B", "#D98A3F", "#C2563A", "#B07A4A", "#E8C88A"] : [T.pink, T.lemon, "#FFFFFF", T.lilac, T.coral];
  for (let x = x0; x < x1; x += 7 * k) {
    grassTufts(ctx, x - 3, x + 3, y + rnd() * 3, 1, "#5E8F6E", k);
    flower(ctx, x + rnd() * 3, y - 4 * k - rnd() * 4 * k, 2.1 * k, cols[Math.floor(rnd() * 5)]!);
  }
}

function mushrooms(ctx: Ctx, x: number, y: number, s: number): void {
  for (const [dx, h, r, c] of [[-4, 8, 5, "#F6A7B8"], [4, 12, 6, "#FFE59A"]] as const) {
    glow(ctx, x + dx * s, y - h * s, 12 * s, c, 0.35);
    solid(ctx, rrect(x + (dx - 1.5) * s, y - h * s, 3 * s, h * s, 1.5 * s), "#FFF3DE", { x: x + (dx - 1.5) * s, y: y - h * s, w: 3 * s, h: h * s }, { rim: 0.4 });
    const cap = P((q) => {
      q.moveTo(x + (dx - r) * s, y - h * s);
      q.quadraticCurveTo(x + dx * s, y - (h + r * 1.6) * s, x + (dx + r) * s, y - h * s);
      q.closePath();
    });
    solid(ctx, cap, c, { x: x + (dx - r) * s, y: y - (h + r) * s, w: 2 * r * s, h: r * s }, { rim: 0.8 });
  }
}

/** String lights on a sagging wire. Bulbs hang BELOW the wire and skip `avoid` x ranges (house handles). */
function stringLights(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, sag: number, n: number, avoid: readonly [number, number][] = []): void {
  const mx = (x0 + x1) / 2;
  const my = Math.max(y0, y1) + sag;
  ctx.strokeStyle = hexA("#1A1636", 0.85);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(mx, my, x1, y1);
  ctx.stroke();
  const cols = [T.amber, T.pink, T.mint, T.lemon, T.lilac];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * mx + t * t * x1;
    if (avoid.some(([a, b]) => x > a && x < b)) continue;
    const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * my + t * t * y1;
    const c = cols[i % cols.length]!;
    glow(ctx, x, y + 5, 14, c, 0.55 * atmos().sky.lamp);
    ctx.fillStyle = "#1A1636";
    ctx.fillRect(x - 1, y - 1, 2, 3);
    const b = rrect(x - 3.4, y + 1.5, 6.8, 8, 3);
    solid(ctx, b, c, { x: x - 3.4, y: y + 1.5, w: 6.8, h: 8 }, { rim: 0.6, lit: 0.4, ao: 0 });
  }
}

function lawn(ctx: Ctx, w: number, y0: number, h: number): void {
  const base = ctx.createLinearGradient(0, y0, 0, y0 + h);
  const [ln, lf] = lawnColours();
  base.addColorStop(0, hexA(ln, 0));
  base.addColorStop(0.07, ln);
  base.addColorStop(1, lf);
  ctx.fillStyle = base;
  ctx.fillRect(0, y0 - 6, w, h + 6);
  reseed(21);
  for (let i = 0; i < 30; i++) {
    const x = rnd() * w;
    const y = y0 + 20 + rnd() * h;
    const r = 24 + rnd() * 46;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, hexA(rnd() < 0.55 ? mix(ln, "#FFFFFF", 0.14) : mix(lf, T.plum, 0.3), 0.5));
    g.addColorStop(1, hexA(lf, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.34, 0, 0, 6.3);
    ctx.fill();
  }
  // mowed bands of light across the lawn (follow the hill)
  for (let i = 0; i < 7; i++) {
    const y = y0 + 30 + i * 64;
    const band = P((q) => {
      q.moveTo(0, y);
      q.bezierCurveTo(140, y - 14, 290, y + 14, w, y - 6);
      q.lineTo(w, y + 18);
      q.bezierCurveTo(290, y + 38, 140, y + 10, 0, y + 24);
      q.closePath();
    });
    ctx.fillStyle = hexA(mix(ln, "#FFFFFF", 0.25), 0.1);
    ctx.fill(band);
  }
  texture(ctx, rrect(0, y0, w, h, 0), { x: 0, y: y0, w, h }, "grass", 0.22);
  for (let i = 0; i < 170; i++) {
    const y = y0 + 16 + rnd() * h;
    const k = 0.55 + ((y - y0) / h) * 0.6;
    const x = rnd() * w;
    grassTufts(ctx, x - 5, x + 5, y, 2, hexA(rnd() < 0.5 ? mix(ln, "#FFFFFF", 0.22) : mix(lf, "#5E8F86", 0.5), 0.75), k);
  }
  const se = atmos().season;
  for (let i = 0; i < (se === "winter" ? 0 : se === "autumn" ? 12 : 40); i++) {
    const y = y0 + 20 + rnd() * h;
    const k = 0.6 + ((y - y0) / h) * 0.7;
    const x = rnd() * w;
    const col = [T.pink, T.lemon, "#FFFFFF", T.lilac][i % 4]!;
    for (let j = 0; j < 4; j++) flower(ctx, x + (rnd() - 0.5) * 12 * k, y + (rnd() - 0.5) * 4 * k, 1.9 * k, col);
  }
}

function fireflies(ctx: Ctx, pts: readonly [number, number, number][]): void {
  for (const [x, y, r] of pts) {
    glow(ctx, x, y, r * 6, "#FFF2A8", 0.5);
    ctx.fillStyle = "#FFFBE0";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 6.3);
    ctx.fill();
  }
}

/** Warm pool of light on the ground (a lit house / lamp). */
const pool = (ctx: Ctx, x: number, y: number, r: number, a = 0.3): void => glow(ctx, x, y, r * 1.35, "#FFC98A", a * 1.25 * atmos().sky.lamp, 0.34);

/** Season particles over the ground (static; the scene may drift copies as ambient() images). */
function seasonProps(ctx: Ctx, w: number, top: number): void {
  const { season: se, time } = atmos();
  reseed(se.length * 31);
  if (se === "spring") {
    // drifting petals (soft pink ovals, a lit edge)
    for (let i = 0; i < 34; i++) {
      const x = rnd() * w;
      const y = 300 + rnd() * 620;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rnd() * 3);
      ctx.fillStyle = i % 4 ? "#F8C4D2" : "#FFFFFF";
      ctx.beginPath();
      ctx.ellipse(0, 0, 2.6, 1.5, 0, 0, 6.3);
      ctx.fill();
      ctx.restore();
    }
  } else if (se === "summer") {
    if (time === "dusk" || time === "night")
      fireflies(ctx, [[40, 500, 1.4], [150, 506, 1.2], [262, 500, 1.3], [400, 520, 1.4], [380, 700, 1.2], [140, 712, 1.1], [248, 770, 1.3], [24, 736, 1.2], [300, 392, 1.1], [92, 590, 1.2], [330, 600, 1.1]]);
  } else if (se === "autumn") {
    // fallen leaves on the lawn + a few on the wind
    const cols = ["#D98A3F", "#C2563A", "#E3B04B"];
    for (let i = 0; i < 46; i++) {
      const x = rnd() * w;
      const y = i < 36 ? 360 + rnd() * 560 : 300 + rnd() * 300;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rnd() * 6.3);
      ctx.fillStyle = cols[i % 3]!;
      ctx.beginPath();
      ctx.moveTo(0, -3.4);
      ctx.quadraticCurveTo(2.6, 0, 0, 3.4);
      ctx.quadraticCurveTo(-2.6, 0, 0, -3.4);
      ctx.fill();
      ctx.restore();
    }
    mushrooms(ctx, 300, 560, 1.1);
    mushrooms(ctx, 110, 880, 1.2);
  } else {
    // falling snow (soft white dots, larger in front) — winter snow caps are drawn by the props themselves
    for (let i = 0; i < 120; i++) {
      const y = top + rnd() * (932 - top);
      const r = 0.6 + (y / 932) * 1.6 * rnd();
      ctx.fillStyle = hexA("#FFFFFF", 0.55 + rnd() * 0.4);
      ctx.beginPath();
      ctx.arc(rnd() * w, y, r, 0, 6.3);
      ctx.fill();
    }
  }
}

/**
 * The village backdrop for a box: everything but the houses, the residents and the mailbox (the scene
 * paints those at villageLayout(at)). The lane and its branches end at every plot's door.
 * o.time / o.season (round 3): dawn · day · dusk (default) · night × spring · summer (default) · autumn · winter.
 */
export function drawVillageBackdrop(ctx: Ctx, at: Box, o: { time?: TimeOfDay; season?: Season } = {}): void {
  setAtmos(o.time ?? "dusk", o.season ?? "summer");
  const A = atmos();
  const m = villageMap(at);
  ctx.save();
  ctx.beginPath();
  ctx.rect(at.x, at.y, at.w, at.h);
  ctx.clip();
  ctx.translate(m.ox, m.oy);
  ctx.scale(m.k, m.k);
  const w = DESIGN.w;
  const top = Math.min(0, (at.y - m.oy) / m.k);
  const horizon = 282;
  sky(ctx, w, top, horizon);
  drawKeyLight(ctx, w, horizon);
  // at dusk the moon rises on the right (a disc, not the light: the afterglow on the left is)
  if (A.time === "dusk") moon(ctx, 346, 196, 17, 0.58);
  cloud(ctx, 160, 226, 0.75, A.time === "day" ? 0.7 : 0.45);
  if (A.time === "day") cloud(ctx, 330, 160, 0.55, 0.6);
  hill(ctx, w, 262, 9, 0.8, A.sky.hills[0], 140, 0.35);
  // the far village: tiny lantern-houses on the far hill (same architecture, hazed)
  const far: [number, number, number, string][] = [[40, 270, 0.1, "#E58C9E"], [96, 266, 0.08, "#6FAE8C"], [300, 266, 0.09, "#8E7BCF"], [352, 270, 0.1, "#E7A75A"], [404, 264, 0.08, "#6FAE8C"]];
  for (const [x, y, sc, roof] of far) {
    ctx.save();
    ctx.globalAlpha = 0.7;
    const th: LanternTheme = { paper: "#FFE9C2", paperLo: "#E2B98A", roof, door: T.wood, flower: T.pink };
    drawLanternHouse(ctx, x, y, sc, { theme: th, windows: [{ x: 0, y: -70, r: 12 }], groundGlow: false, threshold: false, snow: A.season === "winter" });
    ctx.restore();
  }
  hill(ctx, w, 300, 10, 2.1, A.sky.hills[1], 120, 0.3);
  tree(ctx, 22, 340, 0.7, 0.2);
  tree(ctx, 410, 332, 0.78, 0.15);
  tree(ctx, 330, 344, 0.46, 0.3);
  tree(ctx, 96, 350, 0.46, 0.3);
  hill(ctx, w, 346, 7, 4.4, A.sky.hills[2], 700, 0.34);
  lawn(ctx, w, 350, 600);
  // warm light from the string lights onto the lawn
  for (let i = 0; i < 6; i++) glow(ctx, 30 + i * 74, 372, 60, "#FFC98A", 0.14 * A.sky.lamp, 0.3);
  // the lane + a branch to every door (curves, varied stones)
  softPath(ctx, spline([[212, 940, 1.2], [204, 860, 1.1], [196, 740, 1.0], [210, 660, 0.85], [228, 560, 0.7], [216, 460, 0.55], [212, 380, 0.42]]), 40);
  softPath(ctx, spline([[198, 706, 0.85], [150, 670, 0.62], [104, 648, 0.42]]), 30);
  softPath(ctx, spline([[214, 664, 0.8], [276, 650, 0.6], [334, 646, 0.42]]), 30);
  // back row: four short branches (round 3)
  softPath(ctx, spline([[218, 488, 0.6], [140, 466, 0.45], [62, 444, 0.3]]), 26);
  softPath(ctx, spline([[214, 456, 0.52], [188, 442, 0.4], [164, 434, 0.3]]), 24);
  softPath(ctx, spline([[220, 454, 0.52], [246, 442, 0.4], [268, 432, 0.3]]), 24);
  softPath(ctx, spline([[222, 482, 0.58], [300, 462, 0.44], [370, 442, 0.3]]), 26);
  softPath(ctx, spline([[204, 878, 1.05], [150, 860, 0.8], [96, 842, 0.6]]), 32);
  softPath(ctx, spline([[206, 888, 1.05], [272, 870, 0.8], [330, 854, 0.6]]), 32);
  // pools of light at every door (the houses are lit or not; the pool is the street's)
  for (const p of Object.values(PLOTS)) pool(ctx, p.x, p.y - 2, 70 * p.s + 30, 0.28);
  // string lights over the back row — bulbs skip the back houses' handles (no tangents, Reality #5)
  const handles = (["sage", "kuri", "luna", "yuki"] as const).map((id): [number, number] => [PLOTS[id].x - 20, PLOTS[id].x + 20]);
  stringLights(ctx, -6, 290, 436, 284, 14, 15, handles);
  tree(ctx, 216, 384, 0.36, 0.1);
  mushrooms(ctx, 104, 480, 1.1);
  rock(ctx, 322, 470, 0.8);
  pond(ctx, 404, 492, 24, 9);
  flowerBed(ctx, 166, 196, 556, 0.85);
  flowerBed(ctx, 252, 282, 548, 0.85);
  tree(ctx, 18, 566, 0.6, 0.05);
  lampPost(ctx, 182, 612, 0.86);
  bush(ctx, 16, 662, 0.85, T.leaf, [T.lilac, T.lemon]);
  bush(ctx, 418, 664, 0.8, T.leaf, [T.pink, T.lemon]);
  flowerBed(ctx, 36, 80, 694, 1);
  flowerBed(ctx, 262, 296, 684, 1);
  mushrooms(ctx, 158, 756, 1.2);
  bush(ctx, 166, 906, 0.62, T.leaf, [T.coral, T.lemon]);
  flowerBed(ctx, 232, 262, 790, 1.1);
  flowerBed(ctx, 404, 430, 872, 1.05);
  fence(ctx, 0, 30, 900, 0.9);
  seasonProps(ctx, w, top);
  // the time's colour over the ground (the sky already carries it), then a soft plum vignette
  drawTimeWash(ctx, { x: 0, y: 250, w, h: 932 - 250 }, A.time);
  const v = ctx.createRadialGradient(w / 2, 932 * 0.5, 932 * 0.28, w / 2, 932 * 0.5, 932 * 0.75);
  v.addColorStop(0, hexA(T.plum, 0));
  v.addColorStop(1, hexA(T.plum, A.time === "day" ? 0.16 : 0.34));
  ctx.fillStyle = v;
  ctx.fillRect(0, top, w, 932 - top);
  ctx.restore();
  setAtmos();
}

/** The cottage's mailbox (flag up = an unread letter), bottom centre at (x, y), s pt per unit. */
export function drawMailboxAt(ctx: Ctx, x: number, y: number, s: number, flag: boolean, col: string = T.coral): void {
  contact(ctx, x, y + 1, 9 * s, 2.5 * s);
  solid(ctx, rrect(x - 1.8 * s, y - 22 * s, 3.6 * s, 22 * s, 1.4 * s), T.wood, { x: x - 2 * s, y: y - 22 * s, w: 4 * s, h: 22 * s }, { rim: 0.6, tex: "wood" });
  if (flag) {
    // the flag is a band shape joined to the box side (one body)
    glow(ctx, x + 12 * s, y - 36 * s, 14 * s, T.amber, 0.35);
    const f = P((q) => {
      q.moveTo(x + 8.6 * s, y - 26 * s);
      q.lineTo(x + 10.4 * s, y - 26 * s);
      q.lineTo(x + 10.4 * s, y - 36 * s);
      q.lineTo(x + 17.4 * s, y - 36 * s);
      q.quadraticCurveTo(x + 18.6 * s, y - 33.6 * s, x + 17.4 * s, y - 31.2 * s);
      q.lineTo(x + 10.4 * s, y - 31.2 * s);
      q.lineTo(x + 10.4 * s, y - 26 * s);
      q.closePath();
    });
    solid(ctx, f, T.amber, { x: x + 8.6 * s, y: y - 36 * s, w: 10 * s, h: 10 * s }, { rim: 0.5, ao: 0 });
  }
  const body = rrect(x - 10 * s, y - 36 * s, 20 * s, 16 * s, [7 * s, 7 * s, 2 * s, 2 * s]);
  solid(ctx, body, col, { x: x - 10 * s, y: y - 36 * s, w: 20 * s, h: 16 * s }, { rim: 1.1 * s });
  ctx.fillStyle = hexA(T.plum, 0.5);
  ctx.beginPath();
  ctx.roundRect(x - 7 * s, y - 27 * s, 6 * s, 2 * s, 1 * s);
  ctx.fill();
}

export { LANTERN_THEMES };
