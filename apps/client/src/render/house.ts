// Procedural house silhouette for a level, from its seed key. Each solved
// courtyard belongs to one house: its "heart" window (round, at the top) lights
// when the level is solved; the other windows light up as the courtyard does.
//
// Units: body width = 1 ("hu"). Origin = bottom-centre of the body.
import { PAL, rgba } from "./palette.ts";
import { drawGlow, GLOW, mix, rrectPath, type Ctx } from "./draw.ts";
import { hashStr, rng } from "./rng.ts";
import { grain } from "./court.ts";
import { drawLanternHouseSpec } from "./village/lanternHouse.ts";

export interface HouseWindow {
  /** centre, hu (y negative = up) */
  x: number;
  y: number;
  w: number;
  h: number;
  round: boolean;
  /** "lantern" = a lantern-house window (its lit overlay is round warm glass, render/village) */
  glass?: "lantern";
}

export interface HouseSpec {
  /** "tower" = the deduce track's lighthouse-like tower (round 5); default house */
  kind?: "house" | "tower" | "lantern";
  /** lantern-house colours (render/village/lanternHouse.ts LANTERN_THEMES key) */
  theme?: string;
  seed: number;
  bodyH: number;
  roof: "gable" | "flat";
  roofH: number;
  windows: HouseWindow[]; // [0] = heart window
  /** order in which the progress windows (1..n-1) light up */
  order: number[];
  door: { x: number; w: number; h: number };
  chimney: { x: number; w: number; h: number } | null;
  /** clothesline side (-1 left, 1 right) or 0 */
  line: -1 | 0 | 1;
  cat: boolean;
  pots: number;
  wall: string;
  /** extent in hu around the origin (for texture sizing) */
  left: number;
  right: number;
  top: number;
}

export function houseFor(seedKey: string, levelNumber: number): HouseSpec {
  const r = rng(hashStr(`house:${seedKey}`));
  const roof = r() < 0.62 ? "gable" : "flat";
  const nWin = 3 + Math.floor(r() * 4); // 3..6 including the heart window
  const prog = nWin - 1;
  const top = Math.min(prog, 3);
  const bottom = prog - top;
  const bodyH = bottom > 0 ? 0.74 + r() * 0.1 : 0.6 + r() * 0.12;
  const roofH = roof === "gable" ? 0.36 + r() * 0.12 : 0.16;
  const ww = Math.min(0.16, 0.62 / (top + 0.6));
  const wh = ww * (1.18 + r() * 0.2);
  const windows: HouseWindow[] = [];
  // heart window: in the gable, or in the raised parapet of a flat roof
  const heartR = roof === "gable" ? Math.min(0.09, roofH * 0.26) : 0.075;
  windows.push({ x: 0, y: -bodyH - (roof === "gable" ? roofH * 0.38 : roofH * 0.42), w: heartR * 2, h: heartR * 2, round: true });
  const topY = bottom > 0 ? -bodyH * 0.7 : -bodyH * 0.62;
  for (let k = 0; k < top; k++) windows.push({ x: -0.5 + (k + 1) / (top + 1), y: topY, w: ww, h: wh, round: false });
  const doorSide = r() < 0.5 ? -1 : 1;
  let doorX = 0;
  if (bottom === 1) {
    windows.push({ x: 0.27 * doorSide, y: -bodyH * 0.3, w: ww, h: wh, round: false });
    doorX = -0.2 * doorSide;
  } else if (bottom === 2) {
    windows.push({ x: -0.3, y: -bodyH * 0.3, w: ww, h: wh, round: false });
    windows.push({ x: 0.3, y: -bodyH * 0.3, w: ww, h: wh, round: false });
  } else {
    doorX = (r() - 0.5) * 0.3;
  }
  const order = Array.from({ length: prog }, (_, i) => i + 1);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const chimney = r() < (roof === "gable" ? 0.7 : 0.35) ? { x: (r() < 0.5 ? -1 : 1) * (0.22 + r() * 0.1), w: 0.09, h: 0.22 + r() * 0.08 } : null;
  const line: -1 | 0 | 1 = r() < 0.45 ? (doorSide === 1 ? -1 : 1) : 0;
  const cat = levelNumber >= 8 && r() < 0.45;
  const wallT = r();
  return {
    seed: hashStr(seedKey),
    bodyH,
    roof,
    roofH,
    windows,
    order,
    door: { x: doorX, w: 0.15, h: Math.min(0.32, bodyH * 0.42) },
    chimney,
    line,
    cat,
    pots: Math.floor(r() * 3),
    wall: mix(PAL.wall, "#33264A", wallT),
    left: line === -1 ? 1.05 : 0.62,
    right: line === 1 ? 1.05 : 0.62,
    top: bodyH + roofH + (chimney ? 0.25 : 0.06) + (cat ? 0.16 : 0),
  };
}

/**
 * The deduce track's tower (round 5: the track is a place — a tall tower on the far
 * ridge; its courtyard has the bigger, starrier boards). Narrow stone body, a glass
 * lantern room = the heart window, a cone roof; progress windows stacked up the body.
 */
export function towerFor(seedKey: string, levelNumber: number): HouseSpec {
  const r = rng(hashStr(`tower:${seedKey}`));
  const bodyH = 1.22 + r() * 0.1;
  const nProg = 3 + Math.floor(r() * 3); // 3..5
  const windows: HouseWindow[] = [];
  const roomH = 0.3;
  windows.push({ x: 0, y: -bodyH - roomH * 0.5, w: 0.2, h: 0.2, round: true });
  const ww = 0.1;
  const wh = 0.14;
  for (let k = 0; k < nProg; k++) {
    const t = (k + 0.5) / nProg;
    windows.push({ x: (k % 2 === 0 ? -1 : 1) * 0.07, y: -bodyH * (0.42 + 0.48 * t), w: ww, h: wh, round: false });
  }
  const order = Array.from({ length: nProg }, (_, i) => i + 1);
  return {
    kind: "tower",
    seed: hashStr(seedKey),
    bodyH,
    roof: "gable",
    roofH: roomH + 0.3,
    windows,
    order,
    door: { x: 0, w: 0.17, h: 0.27 },
    chimney: null,
    line: 0,
    cat: levelNumber >= 8 && r() < 0.35,
    pots: 1 + Math.floor(r() * 2),
    wall: mix(PAL.wall, "#2E3354", 0.5 + r() * 0.3),
    left: 0.5,
    right: 0.5,
    top: bodyH + roomH + 0.36,
  };
}

function drawTower(ctx: Ctx, h: HouseSpec, ox: number, oy: number, s: number): void {
  const X = (v: number): number => ox + v * s;
  const Y = (v: number): number => oy + v * s;
  const bh = h.bodyH;
  const roomH = h.roofH - 0.3;
  const rim = rgba(PAL.wallRim, 0.42);
  const lw = Math.max(1, s * 0.012);
  const bot = 0.3;
  const topW = 0.22;
  // body (tapered) with stone courses
  const wg = ctx.createLinearGradient(0, Y(-bh), 0, Y(0));
  wg.addColorStop(0, h.wall);
  wg.addColorStop(1, mix(h.wall, PAL.roof, 0.5));
  ctx.fillStyle = wg;
  ctx.beginPath();
  ctx.moveTo(X(-bot), Y(0));
  ctx.lineTo(X(-topW), Y(-bh));
  ctx.lineTo(X(topW), Y(-bh));
  ctx.lineTo(X(bot), Y(0));
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = rgba(PAL.roof, 0.35);
  ctx.lineWidth = lw;
  for (let y = 0.16; y < bh; y += 0.16) {
    ctx.beginPath();
    ctx.moveTo(X(-0.4), Y(-y));
    ctx.lineTo(X(0.4), Y(-y));
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = rim;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(X(-bot), Y(0));
  ctx.lineTo(X(-topW), Y(-bh));
  ctx.stroke();
  // gallery + railing
  ctx.fillStyle = PAL.roof;
  ctx.fillRect(X(-0.33), Y(-bh - 0.03), 0.66 * s, 0.05 * s);
  ctx.strokeStyle = rgba(PAL.moon, 0.28);
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(X(-0.31), Y(-bh - 0.1));
  ctx.lineTo(X(0.31), Y(-bh - 0.1));
  for (let k = -3; k <= 3; k++) {
    ctx.moveTo(X(k * 0.1), Y(-bh - 0.1));
    ctx.lineTo(X(k * 0.1), Y(-bh - 0.03));
  }
  ctx.stroke();
  // lantern room frame (the heart window draws the glass)
  ctx.fillStyle = PAL.windowFrame;
  ctx.fillRect(X(-0.17), Y(-bh - roomH), 0.34 * s, roomH * s);
  // cone roof + finial
  ctx.fillStyle = PAL.roof;
  ctx.beginPath();
  ctx.moveTo(X(-0.26), Y(-bh - roomH + 0.01));
  ctx.lineTo(X(0), Y(-bh - roomH - 0.3));
  ctx.lineTo(X(0.26), Y(-bh - roomH + 0.01));
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rim;
  ctx.lineWidth = lw * 1.4;
  ctx.beginPath();
  ctx.moveTo(X(-0.26), Y(-bh - roomH + 0.01));
  ctx.lineTo(X(0), Y(-bh - roomH - 0.3));
  ctx.stroke();
  ctx.strokeStyle = rgba(PAL.moon, 0.5);
  ctx.beginPath();
  ctx.moveTo(X(0), Y(-bh - roomH - 0.3));
  ctx.lineTo(X(0), Y(-bh - roomH - 0.36));
  ctx.stroke();
  for (const w of h.windows) drawWindowPane(ctx, X(w.x), Y(w.y), w.w * s, w.h * s, w.round, false);
  const d = h.door;
  ctx.fillStyle = PAL.windowFrame;
  rrectPath(ctx, X(d.x - d.w / 2), Y(-d.h), d.w * s, d.h * s + 1, d.w * s * 0.45);
  ctx.fill();
  ctx.fillStyle = mix(PAL.roof, "#000000", 0.2);
  ctx.fillRect(X(d.x - d.w * 0.8), Y(-0.025), d.w * 1.6 * s, 0.03 * s);
  for (let k = 0; k < h.pots; k++) {
    const px = d.x + (k === 0 ? 1 : -1) * (d.w * 0.5 + 0.06);
    ctx.fillStyle = "#5A3A30";
    ctx.beginPath();
    ctx.moveTo(X(px - 0.03), Y(-0.06));
    ctx.lineTo(X(px + 0.03), Y(-0.06));
    ctx.lineTo(X(px + 0.022), Y(0));
    ctx.lineTo(X(px - 0.022), Y(0));
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = mix(PAL.sage, PAL.roof, 0.5);
    ctx.beginPath();
    ctx.arc(X(px), Y(-0.09), 0.035 * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Draws the unlit house; (ox, oy) = body bottom-centre in px, s = px per hu. */
export function drawHouse(ctx: Ctx, h: HouseSpec, ox: number, oy: number, s: number, u = 3): void {
  if (h.kind === "lantern") {
    drawLanternHouseSpec(ctx, h, ox, oy, s, u);
    return;
  }
  if (h.kind === "tower") {
    drawTower(ctx, h, ox, oy, s);
    return;
  }
  const X = (v: number): number => ox + v * s;
  const Y = (v: number): number => oy + v * s;
  const bh = h.bodyH;
  const over = 0.07;
  const rim = rgba(PAL.wallRim, 0.42);
  const lw = Math.max(1, s * 0.012);

  // clothesline (behind the house)
  if (h.line !== 0) {
    const d = h.line;
    const x0 = 0.5 * d;
    const x1 = 0.98 * d;
    const yl = -bh * 0.62;
    ctx.strokeStyle = PAL.roof;
    ctx.lineWidth = s * 0.022;
    ctx.beginPath();
    ctx.moveTo(X(x1), Y(0));
    ctx.lineTo(X(x1), Y(yl - 0.04));
    ctx.stroke();
    ctx.strokeStyle = rgba(PAL.moon, 0.35);
    ctx.lineWidth = Math.max(1, s * 0.006);
    ctx.beginPath();
    ctx.moveTo(X(x0), Y(yl));
    ctx.quadraticCurveTo(X((x0 + x1) / 2), Y(yl + 0.07), X(x1), Y(yl - 0.02));
    ctx.stroke();
    const cloth = [PAL.plum, PAL.sage, PAL.koi, PAL.moon];
    for (let k = 0; k < 3; k++) {
      const t = 0.22 + k * 0.27;
      const cx = x0 + (x1 - x0) * t;
      const cy = yl + 0.07 * 4 * t * (1 - t) - 0.005;
      const cw = 0.1 + (k % 2) * 0.03;
      ctx.fillStyle = mix(cloth[(h.seed + k) % 4]!, "#2B2350", 0.35);
      rrectPath(ctx, X(cx - cw / 2), Y(cy), cw * s, (0.09 + (k % 2) * 0.04) * s, s * 0.01);
      ctx.fill();
    }
  }

  // chimney
  if (h.chimney) {
    const c = h.chimney;
    ctx.fillStyle = PAL.roof;
    ctx.fillRect(X(c.x - c.w / 2), Y(-bh - c.h - 0.08), c.w * s, (c.h + 0.1) * s);
    ctx.fillStyle = mix(PAL.roof, "#000000", 0.3);
    ctx.fillRect(X(c.x - c.w / 2 - 0.015), Y(-bh - c.h - 0.1), (c.w + 0.03) * s, 0.035 * s);
  }

  // body
  const wg = ctx.createLinearGradient(0, Y(-bh), 0, Y(0));
  wg.addColorStop(0, h.wall);
  wg.addColorStop(1, mix(h.wall, PAL.roof, 0.5));
  ctx.fillStyle = wg;
  ctx.fillRect(X(-0.5), Y(-bh), s, bh * s);
  // v10 facades (coordinator round 2 / BENCHMARK #9): four wall treatments × roof styles ×
  // shutters × window boxes, chosen from the house seed (its own stream: layout is unchanged)
  const fr = rng(h.seed ^ 0x5a5a17);
  const style = Math.floor(fr() * 4); // 0 timber frame · 1 clapboard · 2 stone base · 3 brick
  ctx.save();
  ctx.beginPath();
  ctx.rect(X(-0.5), Y(-bh), s, bh * s);
  ctx.clip();
  grain(ctx, X(-0.5), Y(-bh), s, bh * s, fr, 0.35, 0.8);
  const ink = "rgba(10,8,22,0.38)";
  const hi = "rgba(216,139,166,0.10)";
  ctx.lineWidth = Math.max(1, s * 0.012);
  if (style === 0) {
    // timber frame: posts, a mid rail and two braces
    ctx.strokeStyle = mix(PAL.roof, h.wall, 0.25);
    ctx.lineWidth = s * 0.026;
    ctx.beginPath();
    for (const x of [-0.47, 0.47]) {
      ctx.moveTo(X(x), Y(0));
      ctx.lineTo(X(x), Y(-bh));
    }
    ctx.moveTo(X(-0.5), Y(-bh * 0.5));
    ctx.lineTo(X(0.5), Y(-bh * 0.5));
    ctx.moveTo(X(-0.47), Y(-bh * 0.5));
    ctx.lineTo(X(-0.3), Y(-bh * 0.92));
    ctx.moveTo(X(0.47), Y(-bh * 0.5));
    ctx.lineTo(X(0.3), Y(-bh * 0.92));
    ctx.stroke();
  } else if (style === 1) {
    // clapboard: horizontal boards with a lit upper lip
    const n = Math.round(bh / 0.06);
    for (let i = 1; i < n; i++) {
      const y = -bh + (i * bh) / n;
      ctx.strokeStyle = ink;
      ctx.beginPath();
      ctx.moveTo(X(-0.5), Y(y));
      ctx.lineTo(X(0.5), Y(y));
      ctx.stroke();
      ctx.strokeStyle = hi;
      ctx.beginPath();
      ctx.moveTo(X(-0.5), Y(y + 0.012));
      ctx.lineTo(X(0.5), Y(y + 0.012));
      ctx.stroke();
    }
  } else if (style === 2) {
    // a stone plinth band
    const ph = Math.min(0.2, bh * 0.26);
    ctx.fillStyle = mix(h.wall, PAL.stoneLo, 0.45);
    ctx.fillRect(X(-0.5), Y(-ph), s, ph * s);
    ctx.strokeStyle = ink;
    let x = -0.5;
    let row = 0;
    for (let y = -ph; y < -0.005; y += ph / 2, row++) {
      ctx.beginPath();
      ctx.moveTo(X(-0.5), Y(y));
      ctx.lineTo(X(0.5), Y(y));
      ctx.stroke();
      for (x = -0.5 + (row % 2) * 0.07; x < 0.5; x += 0.14 + fr() * 0.04) {
        ctx.beginPath();
        ctx.moveTo(X(x), Y(y));
        ctx.lineTo(X(x), Y(y + ph / 2));
        ctx.stroke();
      }
    }
  } else {
    // brick: faint courses
    ctx.strokeStyle = "rgba(10,8,22,0.2)";
    let row = 0;
    for (let y = -bh + 0.035; y < 0; y += 0.035, row++) {
      ctx.beginPath();
      ctx.moveTo(X(-0.5), Y(y));
      ctx.lineTo(X(0.5), Y(y));
      ctx.stroke();
      for (let x = -0.5 + (row % 2) * 0.04; x < 0.5; x += 0.08) {
        ctx.beginPath();
        ctx.moveTo(X(x), Y(y - 0.035));
        ctx.lineTo(X(x), Y(y));
        ctx.stroke();
      }
    }
  }
  // occlusion under the eaves
  const eg = ctx.createLinearGradient(0, Y(-bh), 0, Y(-bh + 0.12));
  eg.addColorStop(0, "rgba(8,6,18,0.45)");
  eg.addColorStop(1, "rgba(8,6,18,0)");
  ctx.fillStyle = eg;
  ctx.fillRect(X(-0.5), Y(-bh), s, 0.12 * s);
  ctx.restore();
  // moonlit rim on the right edge (the moon is up and to the right)
  ctx.strokeStyle = rgba(PAL.wallRim, 0.4);
  ctx.lineWidth = Math.max(1, s * 0.012) * 1.2;
  ctx.beginPath();
  ctx.moveTo(X(0.5), Y(0));
  ctx.lineTo(X(0.5), Y(-bh));
  ctx.stroke();

  // roof
  ctx.fillStyle = PAL.roof;
  ctx.beginPath();
  if (h.roof === "gable") {
    ctx.moveTo(X(-0.5 - over), Y(-bh + 0.02));
    ctx.lineTo(X(0), Y(-bh - h.roofH));
    ctx.lineTo(X(0.5 + over), Y(-bh + 0.02));
    ctx.closePath();
    ctx.fill();
    // shingle courses (clipped to the roof)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(X(-0.5 - over), Y(-bh + 0.02));
    ctx.lineTo(X(0), Y(-bh - h.roofH));
    ctx.lineTo(X(0.5 + over), Y(-bh + 0.02));
    ctx.closePath();
    ctx.clip();
    ctx.strokeStyle = "rgba(216,139,166,0.09)";
    ctx.lineWidth = Math.max(1, s * 0.008);
    for (let y = -bh + 0.02 - 0.045; y > -bh - h.roofH; y -= 0.045) {
      ctx.beginPath();
      ctx.moveTo(X(-0.6), Y(y));
      ctx.lineTo(X(0.6), Y(y));
      ctx.stroke();
    }
    ctx.restore();
    // gable face (slightly lighter so the heart window sits on something)
    ctx.fillStyle = mix(h.wall, PAL.roof, 0.25);
    ctx.beginPath();
    ctx.moveTo(X(-0.4), Y(-bh));
    ctx.lineTo(X(0), Y(-bh - h.roofH * 0.8));
    ctx.lineTo(X(0.4), Y(-bh));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rim;
    ctx.lineWidth = lw * 1.4;
    ctx.beginPath();
    ctx.moveTo(X(-0.5 - over), Y(-bh + 0.02));
    ctx.lineTo(X(0), Y(-bh - h.roofH));
    ctx.stroke();
  } else {
    // v10: no flat box — a mansard: sloped slate band with courses, the crest dormer on top
    ctx.fillStyle = mix(PAL.roof, h.wall, 0.3);
    ctx.beginPath();
    ctx.moveTo(X(-0.5 - 0.04), Y(-bh + 0.01));
    ctx.lineTo(X(-0.4), Y(-bh - h.roofH * 0.9));
    ctx.lineTo(X(0.4), Y(-bh - h.roofH * 0.9));
    ctx.lineTo(X(0.5 + 0.04), Y(-bh + 0.01));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rim;
    ctx.lineWidth = lw * 1.2;
    ctx.beginPath();
    ctx.moveTo(X(-0.5 - 0.04), Y(-bh + 0.01));
    ctx.lineTo(X(-0.4), Y(-bh - h.roofH * 0.9));
    ctx.lineTo(X(0.4), Y(-bh - h.roofH * 0.9));
    ctx.stroke();
    ctx.strokeStyle = "rgba(216,139,166,0.1)";
    ctx.lineWidth = Math.max(1, s * 0.008);
    for (const t of [0.33, 0.66]) {
      ctx.beginPath();
      ctx.moveTo(X(-0.54 + 0.14 * t), Y(-bh + 0.01 - h.roofH * 0.91 * t));
      ctx.lineTo(X(0.54 - 0.14 * t), Y(-bh + 0.01 - h.roofH * 0.91 * t));
      ctx.stroke();
    }
    ctx.fillStyle = PAL.roof;
    ctx.fillRect(X(-0.5 - 0.03), Y(-bh - 0.02), (1 + 0.06) * s, 0.03 * s);
    // raised parapet crest
    ctx.beginPath();
    ctx.moveTo(X(-0.17), Y(-bh - 0.04));
    ctx.lineTo(X(-0.17), Y(-bh - h.roofH * 0.6));
    ctx.quadraticCurveTo(X(0), Y(-bh - h.roofH * 1.25), X(0.17), Y(-bh - h.roofH * 0.6));
    ctx.lineTo(X(0.17), Y(-bh - 0.04));
    ctx.closePath();
    ctx.fillStyle = mix(h.wall, PAL.roof, 0.35);
    ctx.fill();
    ctx.strokeStyle = rim;
    ctx.lineWidth = lw * 1.4;
    ctx.beginPath();
    ctx.moveTo(X(-0.53), Y(-bh - 0.05));
    ctx.lineTo(X(0.53), Y(-bh - 0.05));
    ctx.stroke();
  }

  // windows (unlit): frame + pane; v10: shutters on some houses, window boxes under lower windows
  const shutters = fr() < 0.5;
  const boxes = fr() < 0.6;
  const shut = mix([PAL.sage, PAL.plum, PAL.koi, "#6E86B4"][Math.floor(fr() * 4)]!, PAL.roof, 0.55);
  for (const w of h.windows) {
    if (!w.round && shutters) {
      ctx.fillStyle = shut;
      for (const sd of [-1, 1]) {
        const sx = w.x + sd * (w.w / 2 + 0.035);
        rrectPath(ctx, X(sx - 0.026), Y(w.y - w.h / 2 - 0.01), 0.052 * s, (w.h + 0.02) * s, s * 0.006);
        ctx.fill();
      }
      ctx.strokeStyle = "rgba(10,8,22,0.35)";
      ctx.lineWidth = Math.max(1, s * 0.006);
      for (const sd of [-1, 1]) {
        const sx = w.x + sd * (w.w / 2 + 0.035);
        for (let k = 1; k < 4; k++) {
          const yy = w.y - w.h / 2 + (k * w.h) / 4;
          ctx.beginPath();
          ctx.moveTo(X(sx - 0.02), Y(yy));
          ctx.lineTo(X(sx + 0.02), Y(yy));
          ctx.stroke();
        }
      }
    }
    drawWindowPane(ctx, X(w.x), Y(w.y), w.w * s, w.h * s, w.round, false);
    if (!w.round && boxes && w.y > -bh * 0.5) {
      // window box with a few blossoms
      const by = w.y + w.h / 2 + 0.02;
      ctx.fillStyle = "#4A3328";
      rrectPath(ctx, X(w.x - w.w / 2 - 0.015), Y(by), (w.w + 0.03) * s, 0.04 * s, s * 0.008);
      ctx.fill();
      ctx.fillStyle = mix(PAL.sage, PAL.roof, 0.4);
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.arc(X(w.x - w.w / 2 + (k + 0.5) * (w.w / 4)), Y(by - 0.004), 0.018 * s, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = mix([PAL.plum, PAL.koi, PAL.moon][(k + h.seed) % 3]!, PAL.roof, 0.3);
        ctx.beginPath();
        ctx.arc(X(w.x - w.w / 3 + (k * w.w) / 3), Y(by - 0.016), 0.01 * s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // door + step
  const d = h.door;
  ctx.fillStyle = PAL.windowFrame;
  rrectPath(ctx, X(d.x - d.w / 2), Y(-d.h), d.w * s, d.h * s + 1, d.w * s * 0.45);
  ctx.fill();
  ctx.fillStyle = rgba(PAL.flame, 0.55);
  ctx.beginPath();
  ctx.arc(X(d.x + d.w * 0.28), Y(-d.h * 0.45), Math.max(1, s * 0.01), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = mix(PAL.roof, "#000000", 0.2);
  ctx.fillRect(X(d.x - d.w * 0.75), Y(-0.025), d.w * 1.5 * s, 0.03 * s);

  // pots
  for (let k = 0; k < h.pots; k++) {
    const px = d.x + (k === 0 ? 1 : -1) * (d.w * 0.5 + 0.07);
    ctx.fillStyle = "#5A3A30";
    ctx.beginPath();
    ctx.moveTo(X(px - 0.035), Y(-0.07));
    ctx.lineTo(X(px + 0.035), Y(-0.07));
    ctx.lineTo(X(px + 0.025), Y(0));
    ctx.lineTo(X(px - 0.025), Y(0));
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = mix(PAL.sage, PAL.roof, 0.5);
    for (const [dx, dy, rr] of [[-0.022, -0.09, 0.028], [0.02, -0.095, 0.026], [0, -0.12, 0.03]] as const) {
      ctx.beginPath();
      ctx.arc(X(px + dx), Y(dy), rr * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // cat on the roof (later levels)
  if (h.cat) {
    const cx = h.roof === "gable" ? 0.17 : 0.34;
    const cy = h.roof === "gable" ? -bh - h.roofH * (1 - 0.17 / 0.5) - 0.005 : -bh - 0.05;
    ctx.fillStyle = "#0E0B1A";
    ctx.beginPath();
    ctx.ellipse(X(cx), Y(cy - 0.05), 0.045 * s, 0.055 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(X(cx + 0.012), Y(cy - 0.12), 0.03 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(X(cx - 0.012), Y(cy - 0.14));
    ctx.lineTo(X(cx - 0.004), Y(cy - 0.175));
    ctx.lineTo(X(cx + 0.012), Y(cy - 0.145));
    ctx.lineTo(X(cx + 0.028), Y(cy - 0.175));
    ctx.lineTo(X(cx + 0.038), Y(cy - 0.135));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#0E0B1A";
    ctx.lineWidth = 0.014 * s;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(X(cx - 0.035), Y(cy - 0.01));
    ctx.quadraticCurveTo(X(cx - 0.11), Y(cy - 0.0), X(cx - 0.09), Y(cy - 0.08));
    ctx.stroke();
    ctx.lineCap = "butt";
  }
}

/** A window pane, centred at (cx, cy) px. lit = warm glass for the overlay texture. */
export function drawWindowPane(ctx: Ctx, cx: number, cy: number, w: number, h: number, round: boolean, lit: boolean): void {
  const f = Math.max(1, w * 0.12);
  ctx.fillStyle = PAL.windowFrame;
  ctx.beginPath();
  if (round) ctx.arc(cx, cy, w / 2 + f * 0.6, 0, Math.PI * 2);
  else rrectPath(ctx, cx - w / 2 - f * 0.6, cy - h / 2 - f * 0.6, w + f * 1.2, h + f * 1.2, f * 0.6);
  ctx.fill();
  if (lit) {
    ctx.save();
    ctx.shadowColor = rgba(PAL.flame, 0.9);
    ctx.shadowBlur = w * 0.6;
  }
  const g = ctx.createRadialGradient(cx, cy + h * 0.15, 0, cx, cy, Math.max(w, h) * 0.7);
  if (lit) {
    g.addColorStop(0, PAL.windowLitCore);
    g.addColorStop(0.5, PAL.windowLit);
    g.addColorStop(1, "#E8964A");
  } else {
    g.addColorStop(0, mix(PAL.windowDark, PAL.skyHorizon, 0.12));
    g.addColorStop(1, PAL.windowDark);
  }
  ctx.fillStyle = g;
  ctx.beginPath();
  if (round) ctx.arc(cx, cy, w / 2, 0, Math.PI * 2);
  else rrectPath(ctx, cx - w / 2, cy - h / 2, w, h, f * 0.3);
  ctx.fill();
  if (lit) ctx.restore();
  // mullions
  ctx.strokeStyle = PAL.windowFrame;
  ctx.lineWidth = Math.max(1, f * 0.55);
  ctx.beginPath();
  if (round) {
    ctx.moveTo(cx - w / 2, cy);
    ctx.lineTo(cx + w / 2, cy);
    ctx.moveTo(cx, cy - w / 2);
    ctx.lineTo(cx, cy + w / 2);
  } else {
    ctx.moveTo(cx, cy - h / 2);
    ctx.lineTo(cx, cy + h / 2);
    ctx.moveTo(cx - w / 2, cy - h * 0.08);
    ctx.lineTo(cx + w / 2, cy - h * 0.08);
  }
  ctx.stroke();
  if (!lit) {
    // faint sky reflection so dark windows still read as glass
    ctx.strokeStyle = rgba(PAL.skyHorizon, 0.28);
    ctx.lineWidth = Math.max(1, f * 0.35);
    ctx.beginPath();
    if (round) ctx.arc(cx, cy, w * 0.32, Math.PI * 1.1, Math.PI * 1.45);
    else {
      ctx.moveTo(cx - w * 0.36, cy + h * 0.05);
      ctx.lineTo(cx - w * 0.12, cy - h * 0.38);
    }
    ctx.stroke();
  }
}

/** Lit window overlay texture: pane + its own warm spill (normal blend). */
export function drawLitWindow(ctx: Ctx, cw: number, ch: number, w: number, h: number, round: boolean): void {
  drawGlow(ctx, cw / 2, ch / 2, Math.min(cw, ch) / 2, GLOW.window);
  drawWindowPane(ctx, cw / 2, ch / 2, w, h, round, true);
}
