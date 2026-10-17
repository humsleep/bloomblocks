// Dusk hill-town palette (design tokens). Every pair the player must tell apart
// is separated by LIGHTNESS, not hue, so it survives grayscale / 45+ eyes:
//   relative luminance  floor 0.024 · stone body 0.15 / top 0.29 / moss 0.17 · lit edge 0.27 · lit core 0.60
//   floor→stone body 2.7:1 (top face 4.6:1), floor→lit edge 4.3:1, floor→lit core 8.7:1,
//   floor→conflict 6.7:1 (see docs/visual-v2.md). Stone vs lit is told apart by shape
//   (outlined blob with cast shadow vs. square glowing tile), not only lightness.
// Round 4: "not allowed" (two lanterns that see each other, a number with too
// many lanterns) is a calm warm coral — the one red-family colour, used for that
// meaning only. Stuck / hints stay cool moonlight.

export const PAL = {
  // sky (top → horizon)
  skyNight: "#141A33",
  skyDusk: "#2B2350",
  skyHorizon: "#C97B84",
  skyGlow: "#E8A08A",
  moon: "#F4EBD0",
  // hills, back → front
  hillFar: "#5B4470",
  hillMid: "#3A2D58",
  hillNear: "#231F40",
  ground: "#171A31",
  groundDeep: "#0F1124",
  // house
  wall: "#2A2240",
  wallRim: "#D88BA6",
  roof: "#1B1630",
  windowDark: "#3B3560",
  windowFrame: "#140F24",
  windowLit: "#FFC864",
  windowLitCore: "#FFF4D6",
  // courtyard
  grout: "#11142A",
  rim: "#2E3354",
  rimHi: "#424A72",
  floor: "#232946",
  floorHi: "#2B3254",
  floorLo: "#1E2340",
  stoneHi: "#8C92B0",
  stone: "#646A88",
  stoneLo: "#3A3F55",
  // numbered stone (pips rules): dice-pale rock (top ≈ L 0.55, body ≈ 0.38) + ink pips (≈ 0.01)
  paleHi: "#E2E5F0",
  pale: "#B4BAD2",
  paleLo: "#737A9A",
  pipInk: "#151829",
  moss: "#5E7A5A",
  mossHi: "#86A57A",
  // light
  litCore: "#F2C46D",
  litEdge: "#B9814A",
  flame: "#FFC864",
  wick: "#FFF4D6",
  conflict: "#8FB7D9",
  // "not allowed" / "too many" (round 4)
  coral: "#F2907A",
  coralHi: "#FFC2B0",
  coralDeep: "#B4503C",
  coralInk: "#3A120A",
  // accents
  plum: "#D88BA6",
  sage: "#9DBF9E",
  koi: "#F08A5D",
  // wood / basket
  wood: "#4A3328",
  woodHi: "#6E4C38",
  basket: "#7A5538",
  basketHi: "#A57850",
  basketLo: "#4E3423",
} as const;

/**
 * v11 UI kit (playtest/BENCHMARK-CUTE.md §3.4): paper cards / guidance bands with ink text. Every
 * guidance line is ink on paper (11.7:1, target ≥ 7:1); inkSoft is for small captions only (4.5:1).
 */
export const UI = {
  ink: "#3B2C45",
  inkSoft: "#6A5A76",
  paper: "#FFF3DE",
  paperEdge: "#E8D4B8",
  primary: "#FFC864",
  primaryLip: "#D9983F",
  /** HUD captions on the night ground (on #171A31: 13.9:1) */
  caption: "#F4EBD0",
  /** satisfied numbers: the warm ring / glow around an ink digit (never a gold digit: 1.5:1 on the pale stone) */
  okRing: "#FFC864",
  okRingEdge: "#8A5A1C",
} as const;

export const BG_HEX = 0x141a33;

/** "#RRGGBB" → 0xRRGGBB */
export function hex(c: string): number {
  return parseInt(c.slice(1), 16);
}

/** "#RRGGBB" + alpha → css rgba() */
export function rgba(c: string, a: number): string {
  const n = hex(c);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
