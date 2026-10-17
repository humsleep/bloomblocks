// Static scenery baked once per screen size: sky + moon + stars + far hills with
// the distant hill town (back layer), and the near hill / courtyard ground
// (front layer, drawn over the house so a house can sink behind it).
import { PAL, rgba } from "./palette.ts";
import { drawGlow, drawLantern, GLOW, mix, type Ctx } from "./draw.ts";
import { rng } from "./rng.ts";

export interface SceneryGeom {
  W: number;
  H: number;
  /** px per pt */
  u: number;
  safeTop: number;
  /** y of the house base (on the mid hill) */
  houseBaseY: number;
  /** y of the near-hill crest (top of the front layer) */
  crestY: number;
  /** HUD buttons (canvas px): decoration keeps ≥ 30 pt away from them (audit P1-14) */
  hud?: readonly { x: number; y: number; r: number }[];
  /**
   * R2 (A1): the bottom of the top HUD row (discs + captions below them). Given, the moon sits under
   * that row at the right edge (the "this alley" strip runs in the row itself, right of the discs).
   */
  topBottom?: number;
  /** R2: every HUD disc (top row too): twinkling stars and fireflies keep (radius + 8 pt) off them */
  keep?: readonly { x: number; y: number; r: number }[];
}

/** Where the moon sits (canvas px, k = 1) and its radius. */
export function moonPos(g: SceneryGeom): { x: number; y: number; r: number } {
  if (g.topBottom !== undefined) return { x: g.W - 34 * g.u, y: g.topBottom + 24 * g.u, r: 17 * g.u };
  return { x: g.W * 0.8, y: g.safeTop + 46 * g.u, r: 17 * g.u };
}

export interface TownLight {
  x: number;
  y: number;
  /** window size, px */
  s: number;
}

function hill(ctx: Ctx, W: number, H: number, baseY: number, amp: number, phase: number, freq: number, fill: string | CanvasGradient): void {
  ctx.beginPath();
  ctx.moveTo(0, H);
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const x = (W * i) / steps;
    const t = x / W;
    const y = baseY - amp * (0.6 * Math.sin(t * Math.PI * freq + phase) + 0.4 * Math.sin(t * Math.PI * freq * 2.3 + phase * 1.7));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function hillY(W: number, x: number, baseY: number, amp: number, phase: number, freq: number): number {
  const t = x / W;
  return baseY - amp * (0.6 * Math.sin(t * Math.PI * freq + phase) + 0.4 * Math.sin(t * Math.PI * freq * 2.3 + phase * 1.7));
}

/** Window positions of the two distant house rows (canvas px): one light per cleared level. */
export interface TownRows {
  /** gentle track: the hill town (village) on the far hill — tapping it opens the town street */
  gentle: TownLight[];
  /** round 5: the deduce track is the TOWER on the farthest ridge (left); base centre, canvas px */
  tower: { x: number; y: number };
  /** the home house on the far hill (right), seen from the tower's courtyard; base centre, canvas px */
  home: { x: number; y: number };
}

/** Where the far tower / far home stand (fractions of W). */
export const FAR_TOWER_X = 0.09;
export const FAR_HOME_X = 0.9;

/**
 * Back layer. `k` = bake scale (texture px per canvas px). Returns the distant
 * towns' window positions (canvas px) so cleared levels can light them.
 */
export function bakeSky(ctx: Ctx, g: SceneryGeom, k: number): TownRows {
  const W = g.W * k;
  const H = g.H * k;
  const u = g.u * k;
  const horizon = g.houseBaseY * k - 40 * u;
  const sky = ctx.createLinearGradient(0, 0, 0, horizon + 30 * u);
  sky.addColorStop(0, PAL.skyNight);
  sky.addColorStop(0.42, PAL.skyDusk);
  sky.addColorStop(0.78, mix(PAL.skyDusk, PAL.skyHorizon, 0.55));
  sky.addColorStop(1, PAL.skyHorizon);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // horizon haze
  const haze = ctx.createRadialGradient(W * 0.35, horizon, 0, W * 0.35, horizon, W * 0.7);
  haze.addColorStop(0, rgba(PAL.skyGlow, 0.35));
  haze.addColorStop(1, rgba(PAL.skyGlow, 0));
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, W, H);

  const r = rng(0x5eed);
  // baked stars (static); a few twinkling ones are live sprites
  for (let i = 0; i < 26; i++) {
    const x = r() * W;
    const y = g.safeTop * k + r() * (horizon - g.safeTop * k) * 0.55;
    const a = 0.25 + r() * 0.5;
    ctx.fillStyle = rgba(PAL.moon, a);
    ctx.beginPath();
    ctx.arc(x, y, (0.6 + r() * 0.9) * u, 0, Math.PI * 2);
    ctx.fill();
  }
  // the moon is a live sprite now (real phase, opens the daily): Scenery.moon at moonPos()
  // farthest ridge; the deduce track's tower stands on it (left), drawn live by Scenery
  const ridgeBase = horizon - 26 * u;
  const ridgeAmp = 10 * u;
  hill(ctx, W, H, ridgeBase, ridgeAmp, 1.9, 1.6, mix(PAL.hillFar, PAL.skyHorizon, 0.35));
  const tx = W * FAR_TOWER_X;
  const tower = { x: tx / k, y: (hillY(W, tx, ridgeBase, ridgeAmp, 1.9, 1.6) + 4 * u) / k };
  void r(); // keep the town's random sequence independent of the old ridge row

  // far hill + town
  const farBase = horizon + 6 * u;
  const farAmp = 14 * u;
  const fg = ctx.createLinearGradient(0, farBase - farAmp, 0, farBase + 80 * u);
  fg.addColorStop(0, PAL.hillFar);
  fg.addColorStop(1, PAL.hillMid);
  hill(ctx, W, H, farBase, farAmp, 0.6, 2.2, fg);
  const town: TownLight[] = [];
  const nTown = 11;
  for (let i = 0; i < nTown; i++) {
    const x = W * (0.06 + (0.88 * (i + r() * 0.6)) / nTown);
    if (Math.abs(x - W / 2) < 70 * u) continue; // keep the centre clear for the current house
    if (Math.abs(x - tx) < 22 * u || Math.abs(x - W * FAR_HOME_X) < 26 * u) continue; // tower / far home stand here
    const y = hillY(W, x, farBase, farAmp, 0.6, 2.2) + 3 * u;
    const hw = (9 + r() * 7) * u;
    const hh = (7 + r() * 6) * u;
    ctx.fillStyle = mix(PAL.hillMid, PAL.roof, 0.4);
    ctx.fillRect(x - hw / 2, y - hh, hw, hh + 4 * u);
    ctx.beginPath();
    ctx.moveTo(x - hw / 2 - 1.5 * u, y - hh);
    ctx.lineTo(x, y - hh - hw * 0.45);
    ctx.lineTo(x + hw / 2 + 1.5 * u, y - hh);
    ctx.closePath();
    ctx.fill();
    const s = 2.6 * u;
    ctx.fillStyle = rgba(PAL.windowDark, 0.9);
    ctx.fillRect(x - s / 2, y - hh * 0.6 - s / 2, s, s);
    town.push({ x: x / k, y: (y - hh * 0.6) / k, s: s / k });
  }
  // mid hill (the current house stands on it)
  const midBase = g.houseBaseY * k + 6 * u;
  const mg = ctx.createLinearGradient(0, midBase - 20 * u, 0, midBase + 120 * u);
  mg.addColorStop(0, PAL.hillMid);
  mg.addColorStop(1, PAL.hillNear);
  hill(ctx, W, H, midBase, 9 * u, 2.1, 1.3, mg);
  // flatten the plot under the house
  ctx.fillStyle = mg;
  ctx.beginPath();
  ctx.ellipse(W / 2, midBase + 2 * u, 120 * u, 12 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  const hx = W * FAR_HOME_X;
  const home = { x: hx / k, y: (hillY(W, hx, farBase, farAmp, 0.6, 2.2) + 5 * u) / k };
  return { gentle: town, tower, home };
}

/**
 * v9 framing (benchmark #9 "empty sky"): a bough reaching in from the right edge below the
 * moon, leaves in silhouette with a moonlit top edge, and one small lit lantern hanging from it
 * (the game's one object, again). Behind the house; clear of the moon and the HUD.
 */
/** Where the bough sits (canvas px, k = 1): its own small texture so it can hide on the tower screen. */
export function boughBox(g: SceneryGeom): { x: number; y: number; w: number; h: number } {
  // anchored where the moon used to be (R2 moved the moon under the top HUD row; the bough stays put)
  const y0 = g.safeTop + 46 * g.u + 17 * g.u * 3.4;
  return { x: g.W * 0.8, y: y0 - 40 * g.u, w: g.W * 0.2 + 8 * g.u, h: 110 * g.u };
}

/** Paint the bough into a canvas whose origin is boughBox(g) (scaled by k). */
export function bakeBough(ctx: Ctx, g: SceneryGeom, k: number): void {
  const b = boughBox(g);
  ctx.save();
  ctx.translate(-b.x * k, -b.y * k);
  paintBough(ctx, g, k);
  ctx.restore();
}

function paintBough(ctx: Ctx, g: SceneryGeom, k: number): void {
  const W = g.W * k;
  const u = g.u * k;
  // the bough's anchor stays where the moon used to be (boughBox)
  const y0 = (g.safeTop + 46 * g.u + 17 * g.u * 3.4) * k;
  const r = rng(0xb0b6);
  // v14 (Reality re-review #3): painted in the kit's light model, not a black cut-out — plum-brown
  // wood and night-green leaves, key light (upper left) on the top edges, plum on the undersides
  const bark = "#4A3646";
  const barkLit = "#7A5A62";
  const barkLo = "#2A1F33";
  const leafBase = "#2F4A4E";
  const leafLit = "#5E8C7A";
  const leafLo = "#1E2A3A";
  const P = [W + 6 * u, y0 + 26 * u, W * 0.95, y0 + 4 * u, W * 0.9, y0 + 6 * u, W * 0.84, y0 + 18 * u];
  ctx.lineCap = "round";
  const limb = (pts: number[], w0: number, w1: number): void => {
    const n = 18;
    const at = (t: number, o: number): number => {
      const a = 1 - t;
      return a * a * a * pts[o]! + 3 * a * a * t * pts[o + 2]! + 3 * a * t * t * pts[o + 4]! + t * t * t * pts[o + 6]!;
    };
    // three passes: the plum underside, the bark, the key-lit top edge (all ≥ 1 pt wide)
    for (const [col, kw, dy] of [[barkLo, 1.15, 0.22], [bark, 0.86, 0], [barkLit, 0.34, -0.26]] as const) {
      for (let i = 0; i < n; i++) {
        const t0 = i / n;
        const t1 = (i + 1) / n;
        const lw = (w0 + (w1 - w0) * t0) * kw;
        if (col === barkLit && lw < 1 * u) continue;
        ctx.strokeStyle = col;
        ctx.lineWidth = lw;
        const oy = (w0 + (w1 - w0) * t0) * dy;
        ctx.beginPath();
        ctx.moveTo(at(t0, 0) - oy * 0.4, at(t0, 1) + oy);
        ctx.lineTo(at(t1, 0) - oy * 0.4, at(t1, 1) + oy);
        ctx.stroke();
      }
    }
  };
  limb(P, 9 * u, 2 * u);
  limb([W * 0.93, y0 + 4 * u, W * 0.915, y0 - 10 * u, W * 0.895, y0 - 18 * u, W * 0.865, y0 - 22 * u], 3.5 * u, 1.2 * u);
  limb([W * 0.9, y0 + 6 * u, W * 0.885, y0 + 18 * u, W * 0.87, y0 + 26 * u, W * 0.85, y0 + 32 * u], 3 * u, 1 * u);
  // leaves: a shaded ellipse each (key-lit upper-left half, plum lower right, a soft midrib band)
  const leaf = (x: number, y: number, s: number, a: number): void => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    // the key light's direction (up-left in the world) in the leaf's rotated frame
    const lx = ((-Math.cos(a) - Math.sin(a)) / Math.SQRT2) * s * 0.6;
    const ly = ((Math.sin(a) - Math.cos(a)) / Math.SQRT2) * s * 0.6;
    const lg = ctx.createLinearGradient(lx, ly, -lx, -ly);
    lg.addColorStop(0, leafLit);
    lg.addColorStop(0.45, leafBase);
    lg.addColorStop(1, leafLo);
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.ellipse(0, 0, s, s * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rgba("#140F2C", 0.25);
    ctx.beginPath();
    ctx.ellipse(0, s * 0.05, s * 0.85, Math.max(0.5 * u, s * 0.07), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = Math.max(0.5 * u, s * 0.08);
    ctx.strokeStyle = mix(leafLo, "#3B2C45", 0.4);
    ctx.beginPath();
    ctx.ellipse(0, 0, s, s * 0.42, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };
  const spots: [number, number][] = [[0.97, 8], [0.945, -2], [0.92, 2], [0.905, -12], [0.885, -19], [0.865, -23], [0.895, 6], [0.875, 12], [0.86, 19], [0.845, 25], [0.87, 26], [0.855, 33], [0.96, 14], [0.99, 20]];
  for (const [fx, dy] of spots) {
    for (let j = 0; j < 3; j++) leaf(W * fx + (r() - 0.5) * 10 * u, y0 + dy * u + (r() - 0.5) * 8 * u, (4 + r() * 3) * u, -0.6 + r() * 1.2 + (j - 1) * 0.9);
  }
  // the hanging lantern: a cord, a soft glow, the framed lantern (lit)
  const lx = W * 0.915;
  const ly0 = y0 + 9 * u;
  const lh = 20 * u;
  const ly = ly0 + 26 * u;
  ctx.strokeStyle = barkLo;
  ctx.lineWidth = 1.1 * u;
  ctx.beginPath();
  ctx.moveTo(lx, ly0);
  ctx.lineTo(lx, ly);
  ctx.stroke();
  drawGlow(ctx, lx, ly + lh * 0.55, 34 * u, [[0, "rgba(255,214,140,0.42)"], [0.35, "rgba(255,190,110,0.16)"], [1, "rgba(255,170,90,0)"]]);
  ctx.save();
  ctx.translate(lx - lh * 0.4, ly);
  drawLantern(ctx, lh, 1);
  ctx.restore();
  drawGlow(ctx, lx, ly + lh * 0.56, lh * 0.32, GLOW.flame);
}

/** Front layer: near-hill crest with grass tufts, then the dark courtyard ground. */
/**
 * x of stepping stone i (of 3). v14 (Reality re-review #2): the middle stone steps aside to the left,
 * so it never sits right behind Wick's flame (a "candle on a dish" read); the path winds door → left → Wick.
 */
function stoneX(i: number, t: number, W: number, u: number): number {
  return W / 2 + (i === 1 ? -27 * u : Math.sin(t * 3.2 + 0.6) * 9 * u);
}

/**
 * v12 (Wick, A4): the stepping stones bakeFront paints, in WORLD px (same formulas: centre, radii).
 * Index 0 is the top one (by the door), the last the one by the courtyard wall.
 */
export function steppingStones(g: SceneryGeom): { x: number; y: number; rx: number; ry: number }[] {
  const hud = g.hud?.[0];
  if (!hud) return [];
  const u = g.u;
  const crestTop = g.crestY - 18 * u;
  const y0 = crestTop + hillY(g.W, g.W / 2, 18 * u, 7 * u, 4.2, 1.7) + 8 * u;
  const y1 = hud.y + hud.r + 8 * u - 12 * u;
  const out: { x: number; y: number; rx: number; ry: number }[] = [];
  const n = 3;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.35) / n;
    const rx = (15 + 9 * t) * u;
    out.push({ x: stoneX(i, t, g.W, u), y: y0 + (y1 - y0) * t, rx, ry: rx * (0.28 + 0.05 * t) });
  }
  return out;
}

export function bakeFront(ctx: Ctx, g: SceneryGeom, k: number, h: number): void {
  const W = g.W * k;
  const u = g.u * k;
  const top = 18 * u; // crest sits this far below the canvas top
  const gg = ctx.createLinearGradient(0, 0, 0, h * k);
  gg.addColorStop(0, PAL.hillNear);
  gg.addColorStop(Math.min(0.5, (60 * u) / (h * k)), PAL.ground);
  gg.addColorStop(1, PAL.groundDeep);
  hill(ctx, W, h * k, top, 7 * u, 4.2, 1.7, gg);
  // rim light on the crest
  ctx.strokeStyle = rgba(PAL.plum, 0.22);
  ctx.lineWidth = 1.2 * u;
  ctx.beginPath();
  for (let i = 0; i <= 48; i++) {
    const x = (W * i) / 48;
    const y = hillY(W, x, top, 7 * u, 4.2, 1.7);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  const r = rng(0x9a55);
  ctx.fillStyle = PAL.hillNear;
  for (let i = 0; i < 34; i++) {
    const x = r() * W;
    const y = hillY(W, x, top, 7 * u, 4.2, 1.7) + 1 * u;
    const hgt = (3 + r() * 6) * u;
    ctx.beginPath();
    ctx.moveTo(x - 2 * u, y);
    ctx.quadraticCurveTo(x + (r() - 0.5) * 3 * u, y - hgt, x + (r() - 0.3) * 4 * u, y - hgt * 1.1);
    ctx.quadraticCurveTo(x + 0.5 * u, y - hgt * 0.5, x + 2 * u, y);
    ctx.closePath();
    ctx.fill();
  }
  // two little bushes framing the courtyard — never behind a HUD button (≥ 30 pt clear; on small
  // screens they move inwards or are left out: audit P1-14, "bushes show through the buttons")
  const crestTop = g.crestY - 18 * g.u; // canvas px of this layer's top
  const clear = (bx: number, by: number): boolean =>
    (g.hud ?? []).every((b) => Math.abs(bx / k - b.x) > b.r + 30 * g.u + 20 * g.u || Math.abs(crestTop + by / k - b.y) > b.r + 30 * g.u + 14 * g.u);
  for (const side of [-1, 1]) {
    let bx = -1;
    let by = 0;
    for (const f of [0.42, 0.34, 0.27]) {
      const x = W / 2 + side * (W * f);
      const y = hillY(W, x, top, 7 * u, 4.2, 1.7) + 6 * u;
      if (clear(x, y)) {
        bx = x;
        by = y;
        break;
      }
    }
    if (bx < 0) continue;
    ctx.fillStyle = mix(PAL.hillNear, PAL.moss, 0.25);
    for (let j = 0; j < 3; j++) {
      ctx.beginPath();
      ctx.arc(bx + (j - 1) * 9 * u, by - (j === 1 ? 7 : 3) * u, (j === 1 ? 11 : 8) * u, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // v9: stepping stones from the house door down to the courtyard wall (the board is ground,
  // not a card); between the HUD's centre slot and the crest, so they never sit under a digit
  if (g.hud?.length) {
    const boardTop = (g.hud[0]!.y + g.hud[0]!.r + 8 * g.u - crestTop) * k;
    const y0 = hillY(W, W / 2, top, 7 * u, 4.2, 1.7) + 8 * u;
    const y1 = boardTop - 12 * u;
    const pr = rng(0x57e9);
    const n = 3;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.35) / n;
      const y = y0 + (y1 - y0) * t;
      // v14: only Wick's stone is painted — the door stone sat behind his flame, and the side stone read
      // as a dark hole behind his body (Reality G1 #27)
      if (i !== n - 1) continue;
      const x = stoneX(i, t, W, u);
      // v10: bigger, flatter stepping stones (they lead from the door to the courtyard threshold)
      const rx = (15 + 9 * t) * u;
      const ry = rx * (0.28 + 0.05 * t);
      const rot = (pr() - 0.5) * 0.25;
      // side / shadow
      ctx.fillStyle = "rgba(4,5,14,0.55)";
      ctx.beginPath();
      ctx.ellipse(x + 0.5 * u, y + 2.2 * u, rx * 1.02, ry * 1.05, rot, 0, Math.PI * 2);
      ctx.fill();
      const sg = ctx.createLinearGradient(x, y - ry, x, y + ry);
      sg.addColorStop(0, mix(PAL.rimHi, PAL.moon, 0.12));
      sg.addColorStop(1, mix(PAL.rim, PAL.hillNear, 0.35));
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
      ctx.fill();
      // moonlit far lip
      ctx.strokeStyle = rgba(PAL.moon, 0.18);
      ctx.lineWidth = 1 * u;
      ctx.beginPath();
      ctx.ellipse(x, y, rx * 0.92, ry * 0.8, rot, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();
      // grass tufts beside the stones
      ctx.fillStyle = mix(PAL.hillNear, PAL.moss, 0.3);
      for (const sx of [-1, 1]) {
        if (pr() < 0.4) continue;
        const gx = x + sx * (rx + 3 * u);
        ctx.beginPath();
        ctx.moveTo(gx - 2 * u, y + ry * 0.6);
        ctx.quadraticCurveTo(gx, y - 4 * u, gx + 1.5 * u, y - 5 * u);
        ctx.quadraticCurveTo(gx + 0.5 * u, y, gx + 2 * u, y + ry * 0.6);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
}
