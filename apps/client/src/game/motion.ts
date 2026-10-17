// Motion settings + easing. iOS "Reduce Motion" (prefers-reduced-motion) turns
// off non-essential movement: flights, blooms, waves, slides, drifting particles.
// Light still changes (that is information), just as a short fade.

import { vis } from "../render/vis.ts";

// The source of truth is src/render/vis.ts (agent A's native prefs once attached, matchMedia before).
export const motion = {
  get reduced(): boolean {
    return vis.p.reduceMotion;
  },
};

export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);
export const easeOutCubic = (t: number): number => 1 - (1 - t) * (1 - t) * (1 - t);
export const easeInCubic = (t: number): number => t * t * t;
export const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutQuad = (t: number): number => 1 - (1 - t) * (1 - t);
/** 0 → 1.12 → 1 bloom (back-out with ~12% overshoot). */
export const easeOutBack = (t: number): number => {
  const c1 = 1.9;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Light reaches a cell `d` steps from the lantern after this many ms (~40 ms/cell, easing out). */
export function spreadDelay(d: number): number {
  return Math.round(40 * d * (1 - 0.025 * Math.min(d, 12)));
}
