// The lantern-house (docs/team/r2-village-art.md §v2 R2): a house that IS a paper lantern — a glowing
// paper barrel between bamboo staves, a chunky lid for a roof (the resident's colour) with value-band
// scallops, a carry handle joined into the lid knob, round windows with flower boxes, a round door.
// ONE architecture for the village, the far hill and the puzzle screen's house of the level.
//
// Units: the barrel is 124 wide; origin = bottom-centre on the ground; y up = negative.
// LH_UNITS units = 1 "hu" (the HouseSpec unit of render/house.ts).
import type { HouseSpec, HouseWindow } from "../house.ts";
import type { Ctx } from "../draw.ts";
import { hashStr, rng } from "../rng.ts";
import { contact, flower, glow, hexA, lineW, miniLantern, mix, P, rrect, setPxPerPt, solid, stoneBlob, T, texture } from "./shade.ts";

export const LH_UNITS = 128;

export interface LanternTheme {
  paper: string;
  paperLo: string;
  roof: string;
  door: string;
  flower: string;
}
export type ResidentId = "wick" | "momo" | "sage" | "luna" | "pip" | "kuri" | "yuki";
export const RESIDENT_IDS: readonly ResidentId[] = ["wick", "momo", "sage", "luna", "pip", "kuri", "yuki"];

/** Each resident's house colours (lid = the resident's colour); "level" = the puzzle screen's terracotta house. */
export const LANTERN_THEMES: Record<ResidentId | "level", LanternTheme> = {
  wick: { paper: "#FFE9C2", paperLo: "#F0C489", roof: "#E7A75A", door: "#8A5A3E", flower: T.lilac },
  momo: { paper: "#FFE6E4", paperLo: "#F2B7BE", roof: "#E58C9E", door: "#9A5B5E", flower: T.pink },
  sage: { paper: "#ECF6E8", paperLo: "#BCDDC6", roof: "#6FAE8C", door: "#6E5A44", flower: T.lemon },
  luna: { paper: "#F1EBFF", paperLo: "#CBBDF0", roof: "#8E7BCF", door: "#5E4E80", flower: T.lilac },
  pip: { paper: "#FFF8DC", paperLo: "#EFD58C", roof: "#E8876A", door: "#86643A", flower: T.lemon },
  // round 3 (owner: full village): Kuri the knitter (chestnut lid), Yuki of the first snow (frost-blue lid)
  kuri: { paper: "#FCEBDC", paperLo: "#E2B48E", roof: "#9C6B4E", door: "#6E4A36", flower: T.coral },
  yuki: { paper: "#F2F7FF", paperLo: "#BFD3EE", roof: "#7FA3CF", door: "#4E5E86", flower: "#FFFFFF" },
  level: { paper: "#FFEBD0", paperLo: "#E9BE8C", roof: "#B97A62", door: "#7A5240", flower: T.pink },
};

export interface LanternWindow {
  x: number;
  y: number;
  r: number;
  /** a flower box under it */
  box?: boolean;
}
/** The two main windows; the optional small lower ones; the heart skylight in the lid. */
export const LH_MAIN: readonly LanternWindow[] = [
  { x: -24, y: -70, r: 10.5, box: true },
  { x: 24, y: -70, r: 10.5, box: true },
];
export const LH_SMALL: readonly LanternWindow[] = [
  { x: -38, y: -36, r: 6.5 },
  { x: 38, y: -36, r: 6.5 },
];
export const LH_HEART: LanternWindow = { x: 0, y: -124, r: 8 };
/** How far a main window's flower box hangs below its glass (hu), for plate clearance. */
export const LH_BOX_BELOW = (18 - 10.5) / 128;
/** Round door (30 wide, top of the arch at 48 above the ground). */
export const LH_DOOR = { x: 0, w: 30, h: 48 } as const;
/** Drawing extent (units) around the origin, incl. the contact shadow and the warm ground glow. */
export const LH_EXTENT = { left: 79, right: 79, top: 170 } as const;

export interface LanternHouseOpts {
  theme: LanternTheme;
  /** windows to draw (default the two main ones) */
  windows?: readonly LanternWindow[];
  /** indices (into windows) drawn dark; the rest lit */
  dark?: readonly number[];
  /** the heart skylight in the lid: "lit" | "dark" | absent */
  heart?: "lit" | "dark";
  /** paper dimmed 0…1 (an unsolved / sleeping house) */
  dim?: number;
  /** the small lantern by the door (village houses) */
  doorLantern?: boolean;
  /** the warm pool on the ground in front (off when the scene paints its own pools) */
  groundGlow?: boolean;
  /** the threshold stone (off on the puzzle screen: Wick stands at the door there) */
  threshold?: boolean;
  /** winter: a snow cap on the lid (round 3) */
  snow?: boolean;
}

function windowGlass(ctx: Ctx, w: LanternWindow, lit: boolean, roof: string): void {
  const { x: wx, y: wy, r } = w;
  if (lit) glow(ctx, wx, wy, r * 2.9, T.glow, 0.5);
  const g = P((q) => q.arc(wx, wy, r, 0, 6.3));
  const wg = ctx.createRadialGradient(wx - r * 0.2, wy - r * 0.3, r * 0.1, wx, wy, r * 1.05);
  wg.addColorStop(0, lit ? "#FFF8DA" : "#6A5C92");
  wg.addColorStop(1, lit ? T.amber : "#463A72");
  ctx.fillStyle = wg;
  ctx.fill(g);
  // a curtain edge in the lid colour, on the light side
  ctx.save();
  ctx.clip(g);
  ctx.fillStyle = hexA(roof, 0.7);
  ctx.beginPath();
  ctx.moveTo(wx - r * 1.05, wy - r * 1.05);
  ctx.quadraticCurveTo(wx - r * 0.38, wy - r * 0.2, wx - r * 0.95, wy + r * 1.05);
  ctx.lineTo(wx - r * 1.15, wy + r * 1.05);
  ctx.closePath();
  ctx.fill();
  if (!lit) {
    // the sky's reflection, so a dark window still reads as glass
    ctx.strokeStyle = hexA("#D18E9D", 0.35);
    ctx.lineWidth = r * 0.16;
    ctx.beginPath();
    ctx.arc(wx, wy, r * 0.62, Math.PI * 1.1, Math.PI * 1.45);
    ctx.stroke();
  }
  ctx.restore();
  ctx.lineCap = "round";
  ctx.strokeStyle = T.ink;
  ctx.lineWidth = lineW(ctx, 50);
  ctx.beginPath();
  ctx.moveTo(wx - r * 0.95, wy);
  ctx.lineTo(wx + r * 0.95, wy);
  ctx.moveTo(wx, wy - r * 0.95);
  ctx.lineTo(wx, wy + r * 0.95);
  ctx.stroke();
}

function windowFrame(ctx: Ctx, w: LanternWindow): void {
  const { x: wx, y: wy, r } = w;
  const fr = r * 0.18 + 0.4;
  const frame = P((q) => {
    q.arc(wx, wy, r + fr, 0, 6.3);
    q.arc(wx, wy, r - 0.3, 0, 6.3, true);
  });
  solid(ctx, frame, T.woodHi, { x: wx - r - fr, y: wy - r - fr, w: (r + fr) * 2, h: (r + fr) * 2 }, { rim: 0.5, ao: 0 });
}

/**
 * The lantern-house at (cx, gy) (bottom centre, on the ground), s = px per unit.
 * Window glass is painted lit or dark here; the puzzle screen fades its lit overlays (drawLanternGlass) on top.
 */
export function drawLanternHouse(ctx: Ctx, cx: number, gy: number, s: number, o: LanternHouseOpts): void {
  const th = o.theme;
  const dim = o.dim ?? 0;
  const wins = o.windows ?? LH_MAIN;
  ctx.save();
  ctx.translate(cx, gy);
  ctx.scale(s, s);
  if (o.groundGlow !== false) glow(ctx, -4, 6, 70, T.glow, 0.32 * (1 - dim * 0.5), 0.3);
  contact(ctx, 6, 2, 72, 13, 0.45);
  // ---- paper barrel, lit from inside
  const body = P((q) => {
    q.moveTo(-38, -14);
    q.bezierCurveTo(-66, -36, -66, -88, -40, -108);
    q.lineTo(40, -108);
    q.bezierCurveTo(66, -88, 66, -36, 38, -14);
    q.closePath();
  });
  const bb = { x: -62, y: -108, w: 124, h: 94 };
  const pg = ctx.createRadialGradient(-8, -64, 4, 0, -60, 70);
  pg.addColorStop(0, mix("#FFF8E8", th.paperLo, dim));
  pg.addColorStop(0.45, mix(th.paper, th.paperLo, dim * 0.8));
  pg.addColorStop(1, mix(th.paperLo, T.plum, dim * 0.25));
  ctx.fillStyle = pg;
  ctx.fill(body);
  ctx.save();
  ctx.clip(body);
  // key light from the upper left, plum on the far side
  const side = ctx.createLinearGradient(-62, 0, 62, 0);
  side.addColorStop(0, hexA(T.key, 0.22));
  side.addColorStop(0.28, hexA(T.key, 0));
  side.addColorStop(0.7, hexA(T.plum, 0));
  side.addColorStop(1, hexA(T.plum, 0.36));
  ctx.fillStyle = side;
  ctx.fillRect(-62, -110, 124, 100);
  // ribs: soft value bands, not hairlines
  for (const y of [-38, -62, -86]) {
    const rib = P((q) => {
      q.moveTo(-64, y - 1.4);
      q.quadraticCurveTo(0, y + 4.6, 64, y - 1.4);
      q.lineTo(64, y + 1.4);
      q.quadraticCurveTo(0, y + 7.4, -64, y + 1.4);
      q.closePath();
    });
    ctx.fillStyle = hexA(mix(th.paperLo, T.wood, 0.45), 0.4);
    ctx.fill(rib);
  }
  ctx.restore();
  texture(ctx, body, bb, "paper", 0.4);
  ctx.lineWidth = lineW(ctx, 94);
  ctx.strokeStyle = mix(th.paperLo, T.ink, 0.5);
  ctx.stroke(body);
  // bamboo staves following the barrel
  for (const sx of [-1, 1]) {
    const st = P((q) => {
      q.moveTo(sx * 35.5, -14);
      q.bezierCurveTo(sx * 61.5, -36, sx * 61.5, -88, sx * 37.5, -108);
      q.lineTo(sx * 41.5, -108);
      q.bezierCurveTo(sx * 66.5, -88, sx * 66.5, -36, sx * 40.5, -14);
      q.closePath();
    });
    solid(ctx, st, T.wood, { x: sx < 0 ? -67 : 35, y: -108, w: 32, h: 94 }, { rim: 0.8, tex: "wood" });
  }
  // windows (glass, frame, flower box)
  const dark = o.dark ?? [];
  wins.forEach((w, i) => {
    windowGlass(ctx, w, !dark.includes(i), th.roof);
    windowFrame(ctx, w);
    if (w.box) {
      const fb = rrect(w.x - 12, w.y + 13, 24, 5, 2);
      solid(ctx, fb, T.wood, { x: w.x - 12, y: w.y + 13, w: 24, h: 5 }, { rim: 0.6, tex: "wood" });
      for (let k = 0; k < 4; k++) flower(ctx, w.x - 8 + k * 5.3, w.y + 11, 2.3, [T.pink, T.lemon, "#FFF6E8", th.flower][k]!);
    }
  });
  // round door in a frame
  const door = P((q) => {
    q.moveTo(-15, -14);
    q.lineTo(-15, -33);
    q.arc(0, -33, 15, Math.PI, 0);
    q.lineTo(15, -14);
    q.closePath();
  });
  const frame = P((q) => {
    q.moveTo(-19, -12);
    q.lineTo(-19, -33);
    q.arc(0, -33, 19, Math.PI, 0);
    q.lineTo(19, -12);
    q.closePath();
  });
  solid(ctx, frame, T.woodHi, { x: -19, y: -52, w: 38, h: 40 }, { rim: 1, tex: "wood" });
  solid(ctx, door, th.door, { x: -15, y: -48, w: 30, h: 34 }, { rim: 1.2, lit: 0.2, tex: "wood" });
  ctx.save();
  ctx.clip(door);
  // planks as value bands (≥ 1 pt wide, no hairlines)
  ctx.fillStyle = hexA(T.plum, 0.2);
  for (const x of [-7.5, 0, 7.5]) ctx.fillRect(x - 0.8, -50, 1.6, 38);
  ctx.restore();
  ctx.fillStyle = T.amber;
  ctx.beginPath();
  ctx.arc(9, -27, 1.8, 0, 6.3);
  ctx.fill();
  if (o.doorLantern) {
    glow(ctx, 25, -44, 18, T.glow, 0.5);
    miniLantern(ctx, 25, -44, 9, true);
  }
  const base = rrect(-46, -16, 92, 14, 6);
  solid(ctx, base, T.woodHi, { x: -46, y: -16, w: 92, h: 14 }, { rim: 1.2, tex: "wood" });
  if (o.threshold !== false) stoneBlob(ctx, 0, -4, 16, 4, T.stoneHi);
  // ---- the carry handle, drawn first so the knob covers its ends (they meet the lid)
  const handle = P((q) => {
    q.arc(0, -150, 17, Math.PI * 1.02, Math.PI * 1.98);
    q.arc(0, -150, 12.5, Math.PI * 1.98, Math.PI * 1.02, true);
    q.closePath();
  });
  solid(ctx, handle, T.woodLo, { x: -17, y: -167, w: 34, h: 17 }, { rim: 0.9, lit: 0.35, tex: "wood" });
  // ---- the lid (resident colour)
  const cap = P((q) => {
    q.moveTo(-64, -104);
    q.quadraticCurveTo(-68, -114, -56, -118);
    q.lineTo(-22, -138);
    q.quadraticCurveTo(0, -150, 22, -138);
    q.lineTo(56, -118);
    q.quadraticCurveTo(68, -114, 64, -104);
    q.quadraticCurveTo(0, -96, -64, -104);
    q.closePath();
  });
  solid(ctx, cap, th.roof, { x: -68, y: -150, w: 136, h: 54 }, { rim: 2.2, lit: 0.36, shade: 0.42, tex: "wood" });
  // scallop rows as value bands (≥ 1 pt; no hairlines)
  ctx.save();
  ctx.clip(cap);
  for (const [y, n] of [[-114, 9], [-126, 7], [-138, 4]] as const) {
    for (let i = 0; i < n; i++) {
      const x = -((n - 1) * 13) / 2 + i * 13;
      const sc = P((q) => {
        q.moveTo(x - 6.5, y);
        q.arc(x, y, 6.5, Math.PI, 0, true);
        q.arc(x, y - 1.6, 6.5, 0, Math.PI, false);
        q.closePath();
      });
      ctx.fillStyle = hexA(mix(th.roof, T.plum, 0.55), 0.38);
      ctx.fill(sc);
    }
  }
  ctx.restore();
  const eave = P((q) => {
    q.moveTo(-64, -104);
    q.quadraticCurveTo(0, -96, 64, -104);
    q.quadraticCurveTo(66, -99, 60, -97);
    q.quadraticCurveTo(0, -89, -60, -97);
    q.quadraticCurveTo(-66, -99, -64, -104);
    q.closePath();
  });
  solid(ctx, eave, mix(th.roof, T.plum, 0.25), { x: -66, y: -104, w: 132, h: 15 }, { rim: 0.8 });
  if (o.snow) {
    // a soft snow cap over the lid's top: one white value shape, lit from the left (no outline band)
    const snowCap = P((q) => {
      q.moveTo(-58, -116);
      q.lineTo(-22, -137);
      q.quadraticCurveTo(0, -149, 22, -137);
      q.lineTo(58, -116);
      q.quadraticCurveTo(46, -112, 36, -118);
      q.quadraticCurveTo(26, -110, 12, -122);
      q.quadraticCurveTo(0, -114, -14, -123);
      q.quadraticCurveTo(-30, -111, -40, -119);
      q.quadraticCurveTo(-50, -111, -58, -116);
      q.closePath();
    });
    const sg = ctx.createLinearGradient(-58, 0, 58, 0);
    sg.addColorStop(0, "#FFFFFF");
    sg.addColorStop(1, "#D3DEF0");
    ctx.fillStyle = sg;
    ctx.fill(snowCap);
  }
  if (o.heart) {
    windowGlass(ctx, LH_HEART, o.heart === "lit", th.roof);
    windowFrame(ctx, LH_HEART);
  }
  const knob = rrect(-10, -153, 20, 10, 4.5);
  solid(ctx, knob, T.woodHi, { x: -10, y: -153, w: 20, h: 10 }, { rim: 1, tex: "wood" });
  ctx.restore();
}

/** Lit glass of one lantern-house window, centred in a cw × ch canvas (the puzzle screen's fade-in overlay). */
export function drawLanternGlass(ctx: Ctx, cw: number, ch: number, d: number, u = 3): void {
  setPxPerPt(u);
  const r = d / 2;
  ctx.save();
  ctx.translate(cw / 2, ch / 2);
  const k = r / 10.5;
  ctx.scale(k, k);
  glow(ctx, 0, 0, Math.min(cw, ch) / 2 / k, T.glow, 0.42);
  windowGlass(ctx, { x: 0, y: 0, r: 10.5 }, true, "#B97A62");
  ctx.restore();
}

// ---------------------------------------------------------------- the puzzle screen's house of the level

const U = LH_UNITS;
const win = (w: LanternWindow): HouseWindow => ({ x: w.x / U, y: w.y / U, w: (w.r * 2) / U, h: (w.r * 2) / U, round: true, glass: "lantern" });

/**
 * The house of a level as a lantern-house (HouseSpec kind "lantern"): the heart = the skylight in the
 * lid (lit on solve), 2–4 progress windows (two main + 0–2 small lower ones) lit as the courtyard is.
 * Colours: a resident's or the terracotta level theme, by seed (one village, one architecture).
 */
export function lanternHouseFor(seedKey: string, levelNumber: number, plateHalfW = 0): HouseSpec {
  const r = rng(hashStr(`lhouse:${seedKey}`));
  // 0..2 small lower windows — only when they stay clear of the number plate (plateHalfW, hu)
  const roll = Math.floor(r() * 3);
  const small = levelNumber <= 2 || plateHalfW > (LH_SMALL[1]!.x - LH_SMALL[1]!.r * 1.25) / LH_UNITS - 0.02 ? 0 : roll;
  const smallSet = small === 2 ? [LH_SMALL[0]!, LH_SMALL[1]!] : small === 1 ? [LH_SMALL[r() < 0.5 ? 0 : 1]!] : [];
  const windows = [win(LH_HEART), ...LH_MAIN.map(win), ...smallSet.map(win)];
  const prog = windows.length - 1;
  const order = Array.from({ length: prog }, (_, i) => i + 1);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const themes: (ResidentId | "level")[] = ["level", "level", "wick", "momo", "sage", "luna", "pip"];
  const theme = themes[Math.floor(r() * themes.length)]!;
  return {
    kind: "lantern",
    theme,
    seed: hashStr(`lhouse:${seedKey}`),
    bodyH: 108 / U,
    roof: "gable",
    roofH: 42 / U,
    windows,
    order,
    door: { x: LH_DOOR.x / U, w: LH_DOOR.w / U, h: LH_DOOR.h / U },
    chimney: null,
    line: 0,
    cat: false,
    pots: 0,
    wall: LANTERN_THEMES[theme].roof,
    left: LH_EXTENT.left / U,
    right: LH_EXTENT.right / U,
    top: LH_EXTENT.top / U,
  };
}

/** drawHouse() for kind "lantern": every window dark (the lit overlays fade in on top), heart dark. */
export function drawLanternHouseSpec(ctx: Ctx, h: HouseSpec, ox: number, oy: number, s: number, u = 3): void {
  setPxPerPt(u);
  const k = s / U;
  const windows: LanternWindow[] = h.windows.slice(1).map((w) => ({ x: w.x * U, y: w.y * U, r: (w.w * U) / 2, box: w.w * U > 16 }));
  drawLanternHouse(ctx, ox, oy, k, {
    theme: LANTERN_THEMES[(h.theme as ResidentId | "level" | undefined) ?? "level"] ?? LANTERN_THEMES.level,
    windows,
    dark: windows.map((_, i) => i),
    heart: "dark",
    dim: 0.3,
    doorLantern: false,
    groundGlow: false,
    threshold: false,
  });
}
