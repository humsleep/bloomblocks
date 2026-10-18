// Round 3 (owner: full village): 4 times of day × 4 seasons. ONE light model throughout: the key light
// always comes from the upper LEFT — the low sun at dawn, the high sun by day, the afterglow at dusk, the
// moon at night (each placed upper-left); only its colour and strength change. Seasons only add props and
// tint the greens. The current atmosphere is module state set per bake (drawing is synchronous).
import type { Ctx } from "../draw.ts";
import { glow, hexA, mix, moon, T, type Box } from "./shade.ts";

export type TimeOfDay = "dawn" | "day" | "dusk" | "night";
export type Season = "spring" | "summer" | "autumn" | "winter";
export const TIMES: readonly TimeOfDay[] = ["dawn", "day", "dusk", "night"];
export const SEASONS: readonly Season[] = ["spring", "summer", "autumn", "winter"];

export interface SkyStyle {
  /** sky gradient top → horizon (5 stops) */
  sky: readonly [string, string, string, string, string];
  /** the light's glow colour + strength at the horizon (left) */
  glow: string;
  glowA: number;
  /** cool wash on the right of the horizon */
  coolA: number;
  stars: number;
  /** multiplier on lamp / window / string-light glows */
  lamp: number;
  /** the lawn (near, far) before the season tint */
  lawn: readonly [string, string];
  cloud: string;
  /** hills far / mid / near */
  hills: readonly [string, string, string];
}

export const SKIES: Record<TimeOfDay, SkyStyle> = {
  dawn: { sky: ["#3A3A72", "#6C5E9A", "#C98FAE", "#F6B9A6", "#FFE0B8"], glow: "#FFD2A8", glowA: 0.7, coolA: 0.25, stars: 18, lamp: 0.6, lawn: ["#5D648F", "#3E4470"], cloud: "#E6B6C4", hills: ["#A889B4", "#7A6698", "#565084"] },
  day: { sky: ["#6FA6DA", "#93C1E6", "#BFDDEF", "#E6F1EE", "#FFF4DC"], glow: "#FFF1C8", glowA: 0.55, coolA: 0.05, stars: 0, lamp: 0.22, lawn: ["#7CA478", "#557D63"], cloud: "#FFFFFF", hills: ["#A9C3B8", "#7FA592", "#5F8A78"] },
  dusk: { sky: [T.skyTop, T.skyMid, T.skyMauve, T.skyRose, T.skyPeach], glow: "#FFC9A0", glowA: 0.6, coolA: 0.6, stars: 110, lamp: 1, lawn: [T.lawn, T.lawnLo], cloud: "#C3A7C8", hills: [T.hillFar, T.hillMid, T.hillNear] },
  night: { sky: ["#0E1030", "#1A1C48", "#2A2B62", "#3A3B74", "#4A4880"], glow: "#C9D6FF", glowA: 0.28, coolA: 0.2, stars: 230, lamp: 1.25, lawn: ["#2C3562", "#1A1F42"], cloud: "#5A5C8E", hills: ["#4A4A7E", "#36386A", "#262856"] },
};

/** Season tints for greens and the lawn; props are drawn by the backdrop (nature.ts). */
export const SEASON_STYLE: Record<Season, { canopy: readonly string[]; lawnTint: string; lawnK: number }> = {
  spring: { canopy: ["#7FB08E", "#8DBB93"], lawnTint: "#9CC48E", lawnK: 0.1 },
  summer: { canopy: [T.leaf, "#5C9474"], lawnTint: "#6FAE7E", lawnK: 0.08 },
  autumn: { canopy: ["#D98A3F", "#C2563A", "#E3B04B"], lawnTint: "#B08A55", lawnK: 0.28 },
  winter: { canopy: ["#5E7A86", "#6D8494"], lawnTint: "#E4ECF8", lawnK: 0.6 },
};

let time: TimeOfDay = "dusk";
let season: Season = "summer";
export function setAtmos(t: TimeOfDay = "dusk", s: Season = "summer"): void {
  time = t;
  season = s;
}
export const atmos = (): { time: TimeOfDay; season: Season; sky: SkyStyle } => ({ time, season, sky: SKIES[time] });

/** The key light's disc: the sun low-left at dawn, high-left by day; the moon upper-left at night (none at dusk: the afterglow). */
export function drawKeyLight(ctx: Ctx, w: number, horizon: number): void {
  if (time === "dawn") {
    glow(ctx, w * 0.12, horizon - 6, 150, "#FFD9B0", 0.6);
    ctx.fillStyle = "#FFE7C4";
    ctx.beginPath();
    ctx.arc(w * 0.12, horizon - 6, 20, Math.PI, 0);
    ctx.fill();
  } else if (time === "day") {
    glow(ctx, w * 0.16, 104, 150, "#FFF6D8", 0.38);
    ctx.fillStyle = "#FFF9E6";
    ctx.beginPath();
    ctx.arc(w * 0.16, 104, 15, 0, Math.PI * 2);
    ctx.fill();
  } else if (time === "night") {
    moon(ctx, w * 0.18, 132, 17, 0.92);
  }
}

/**
 * The time's colour over a finished picture (the scene applies it over its houses layer too): night =
 * blue multiply, dawn = a rose soft-light, day = a warm lift, dusk = none (the kit's base light).
 */
export function drawTimeWash(ctx: Ctx, at: Box, t: TimeOfDay = time): void {
  const w = { dawn: ["soft-light", "#FFB4BE", 0.26], day: ["screen", "#FFF2DC", 0.07], dusk: null, night: ["multiply", "#5E6CB4", 0.42] }[t] as [GlobalCompositeOperation, string, number] | null;
  if (!w) return;
  ctx.save();
  ctx.globalCompositeOperation = w[0];
  // fade in over the first 14 % of the box: no hard top edge (the "sky seam")
  const g = ctx.createLinearGradient(0, at.y, 0, at.y + at.h);
  g.addColorStop(0, hexA(w[1], 0));
  g.addColorStop(0.14, hexA(w[1], w[2]));
  g.addColorStop(1, hexA(w[1], w[2]));
  ctx.fillStyle = g;
  ctx.fillRect(at.x, at.y, at.w, at.h);
  ctx.restore();
}

/**
 * Daytime depth inside the one-light rule (Reality final G1 #4): soft light shafts from the sun (upper left)
 * falling to the lower right, cloud-lit haze on the horizon, and a ground that darkens towards the viewer.
 */
export function drawDayDepth(ctx: Ctx, w: number, top: number, horizon: number, bottom: number): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const sx = w * 0.16;
  const sy = 104;
  for (const [a, l] of [[0.42, 0.055], [0.62, 0.075], [0.82, 0.05], [1.02, 0.04]] as const) {
    const g = ctx.createLinearGradient(sx, sy, sx + Math.cos(a) * 760, sy + Math.sin(a) * 760);
    g.addColorStop(0, hexA("#FFF3C8", l));
    g.addColorStop(1, hexA("#FFF3C8", 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(a - 0.07) * 900, sy + Math.sin(a - 0.07) * 900);
    ctx.lineTo(sx + Math.cos(a + 0.07) * 900, sy + Math.sin(a + 0.07) * 900);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // horizon haze: paler where the far hills meet the sky (atmospheric depth)
  const hz = ctx.createLinearGradient(0, horizon - 70, 0, horizon + 30);
  hz.addColorStop(0, hexA("#FFF4DC", 0));
  hz.addColorStop(1, hexA("#FFF4DC", 0.22));
  ctx.fillStyle = hz;
  ctx.fillRect(0, horizon - 70, w, 100);
  // the ground darkens towards the viewer (plum multiply), the lit side staying on the left
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  const gd = ctx.createLinearGradient(0, 350, 0, bottom);
  gd.addColorStop(0, hexA("#FFFFFF", 0));
  gd.addColorStop(1, hexA("#6A6A9A", 0.38));
  ctx.fillStyle = gd;
  ctx.fillRect(0, 350, w, bottom - 350);
  const side = ctx.createLinearGradient(0, 0, w, 0);
  side.addColorStop(0, hexA("#FFFFFF", 0));
  side.addColorStop(1, hexA("#7A7AA8", 0.18));
  ctx.fillStyle = side;
  ctx.fillRect(0, 350, w, bottom - 350);
  ctx.restore();
  void top;
}

/** A canopy colour for the current season (i picks among its tones). */
export const canopy = (i: number, base: string = T.leaf): string => {
  const c = SEASON_STYLE[season].canopy;
  return season === "summer" ? base : c[Math.abs(i) % c.length]!;
};
/** The lawn's near / far colours for the current time + season. */
export function lawnColours(): [string, string] {
  const st = SEASON_STYLE[season];
  const [a, b] = SKIES[time].lawn;
  // snow keeps the night's blue (the wash darkens it); other tints are lighter by day
  const k = season === "winter" && time === "night" ? st.lawnK * 0.6 : st.lawnK;
  return [mix(a, st.lawnTint, k), mix(b, st.lawnTint, k * 0.85)];
}
