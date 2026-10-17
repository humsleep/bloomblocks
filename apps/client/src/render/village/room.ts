// The cottage room (1.0: one room, 18 snap slots = 15 floor in 3 rows of 5 + 3 wall, plus the rug layer).
// A cut-away dollhouse under a lantern lid: back wall (wallpaper 0..2), shallow side walls, floor (0..2),
// a round window on the right (the cool fill), the paper lantern's warm pool on the left (the key).
// Design space 400 × 420 units; roomGeometry(at) gives the slot boxes in canvas px (drawFurniture boxes).
import type { Ctx } from "../draw.ts";
import { drawLanternHouse, LANTERN_THEMES } from "./lanternHouse.ts";
import { glow, hexA, miniLantern, mix, moon, P, reseed, rnd, rrect, solid, T, texture, flower, type Box, contact } from "./shade.ts";
import { drawResidentAt } from "./residents.ts";
import { atmos, setAtmos, type Season, type TimeOfDay } from "./atmos.ts";

export const ROOM = { w: 400, h: 420 } as const;
/** floor rows: the line items stand on (units, at ex = 0), front-most last */
export const FLOOR_ROWS = [282, 326, 376] as const;
export const FLOOR_COLS = 5;
/** wall slots: bottom centre of each hanging item (units, ex = 0); the round window sits right of them */
export const WALL_SLOTS = [[88, 186], [158, 186], [228, 186]] as const;
export const WINDOW0 = { x: 300, y: 152, r: 36 } as const;

// v15 (Reality G1 re-review 2 #1): a box taller than 400 × 420 gives the room a TALLER BACK WALL (ex units):
// the wall's things move down by ex / 2, the wainscot, the floor and the rows by ex. Geometry below is set
// per call by useEx() (drawing is synchronous; same inputs = same pixels).
let ex = 0;
let IN = { x0: 18, x1: 382, y0: 70, y1: 404 };
let BACK = { x0: 50, x1: 350, y1: 262 };
let ROWS: number[] = [...FLOOR_ROWS];
let WALLS: [number, number][] = WALL_SLOTS.map(([x, y]) => [x, y]);
let WINDOW: { x: number; y: number; r: number } = { ...WINDOW0 };
let WAIN = 220;
function useEx(e: number): void {
  // half of the extra height deepens the floor (rows spread toward the viewer), half raises the back wall
  ex = Math.max(0, e);
  const wall = ex * 0.5;
  IN = { x0: 18, x1: 382, y0: 70, y1: 404 + ex };
  BACK = { x0: 50, x1: 350, y1: 262 + wall };
  ROWS = FLOOR_ROWS.map((y) => BACK.y1 + ((y - 262) / (404 - 262)) * (IN.y1 - BACK.y1));
  WALLS = WALL_SLOTS.map(([x, y]) => [x, y + wall * 0.5]);
  WINDOW = { ...WINDOW0, y: WINDOW0.y + wall * 0.5 };
  WAIN = 220 + wall;
}

/** Floor width at a given y (the floor widens towards the viewer). */
function floorSpan(y: number): [number, number] {
  const t = (y - BACK.y1) / (IN.y1 - BACK.y1);
  return [BACK.x0 + (IN.x0 - BACK.x0) * t, BACK.x1 + (IN.x1 - BACK.x1) * t];
}

/** Map the design onto the box: fit, bottom-centre. */
export function roomMap(at: Box): { k: number; ox: number; oy: number; ex: number } {
  // width-fit when the box is taller than the design (the extra height goes to the back wall, ≤ 45 %)
  const kw = at.w / ROOM.w;
  const e = Math.min(ROOM.h * 0.32, Math.max(0, at.h / kw - ROOM.h));
  const k = Math.min(kw, at.h / (ROOM.h + e));
  useEx(e);
  return { k, ox: at.x + (at.w - ROOM.w * k) / 2, oy: at.y + at.h - (ROOM.h + e) * k, ex: e };
}

export interface RoomGeometry {
  /** px per unit */
  k: number;
  /** 18 slot boxes (canvas px): 0..14 floor (row-major, back row first), 15..17 wall. Bottom centre = where the item stands / hangs. */
  slots: Box[];
  /** the rug layer's box (centre of the floor) */
  rug: Box;
  /** the window (canvas px), e.g. for a moonlight tween */
  window: { x: number; y: number; r: number };
}

/**
 * Slot boxes for drawFurniture: a floor slot is one column wide and 1.5 × as tall (items are drawn at the
 * room's common scale inside it — furniture.ts furnitureScale); back rows are smaller (perspective).
 */
export function roomGeometry(at: Box): RoomGeometry {
  const m = roomMap(at);
  const X = (x: number): number => m.ox + x * m.k;
  const Y = (y: number): number => m.oy + y * m.k;
  const slots: Box[] = [];
  for (const fy of ROWS) {
    const [a, b] = floorSpan(fy);
    const colW = (b - a - 12) / FLOOR_COLS;
    for (let c = 0; c < FLOOR_COLS; c++) {
      const cx = a + 6 + colW * (c + 0.5);
      const w = colW * m.k;
      const h = colW * 1.5 * m.k;
      slots.push({ x: X(cx) - w / 2, y: Y(fy) - h, w, h });
    }
  }
  for (const [wx, wy] of WALLS) {
    const w = 56 * m.k;
    const h = 56 * m.k;
    slots.push({ x: X(wx) - w / 2, y: Y(wy) - h, w, h });
  }
  const rw = 170 * m.k;
  const rh = 30 * m.k;
  return { k: m.k, slots, rug: { x: X(200) - rw / 2, y: Y(ROWS[1]! + 14) - rh, w: rw, h: rh }, window: { x: X(WINDOW.x), y: Y(WINDOW.y), r: WINDOW.r * m.k } };
}

// ---------------------------------------------------------------- wallpapers / floors (0..2)

const PAPERS = [
  { top: "#E9D3C9", bottom: "#F6E6D4", motif: "petal" as const },
  { top: "#D9E6D6", bottom: "#ECF2E4", motif: "stripe" as const },
  { top: "#DCD3EC", bottom: "#ECE6F4", motif: "dot" as const },
];
const FLOORS = [
  { near: "#C08A60", far: "#9A6C4C", kind: "plank" as const },
  { near: "#E3C9A4", far: "#B89A78", kind: "tile" as const },
  { near: "#8C6A7E", far: "#6A4E62", kind: "plank" as const },
];

function wallpaper(ctx: Ctx, n: number, x: number, y: number, w: number, h: number): void {
  const pp = PAPERS[((n % 3) + 3) % 3]!;
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, pp.top);
  g.addColorStop(1, pp.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  reseed(31 + n);
  if (pp.motif === "petal") {
    for (let j = 0; j < 8; j++)
      for (let i = 0; i < 10; i++) {
        ctx.save();
        ctx.globalAlpha = 0.24;
        flower(ctx, x + 14 + i * 32 + (j % 2) * 16, y + 16 + j * 26, 3.2, j % 2 ? "#E8A0AE" : "#C9B6F0");
        ctx.restore();
      }
  } else if (pp.motif === "stripe") {
    // value bands (≥ 1 pt), a sprig in every other band
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = hexA("#9CC8AE", i % 2 ? 0.28 : 0.12);
      ctx.fillRect(x + i * 20, y, 10, h);
    }
  } else {
    for (let j = 0; j < 10; j++)
      for (let i = 0; i < 12; i++) {
        ctx.fillStyle = hexA(j % 2 ? "#B9A6E0" : "#F6B7C4", 0.35);
        ctx.beginPath();
        ctx.arc(x + 12 + i * 26 + (j % 2) * 13, y + 12 + j * 22, 2.2, 0, 6.3);
        ctx.fill();
      }
  }
  texture(ctx, rrect(x, y, w, h, 0), { x, y, w, h }, "paper", 0.18);
}

function wainscot(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  const wg = ctx.createLinearGradient(0, y, 0, y + h);
  wg.addColorStop(0, "#C99A72");
  wg.addColorStop(1, "#A97852");
  ctx.fillStyle = wg;
  ctx.fillRect(x, y, w, h);
  // panels as value bands
  ctx.fillStyle = hexA(T.plum, 0.12);
  for (let i = 1; i < 8; i++) ctx.fillRect(x + (w * i) / 8 - 0.8, y + 6, 1.6, h - 6);
  texture(ctx, rrect(x, y, w, h, 0), { x, y, w, h }, "wood", 0.2);
  ctx.fillStyle = "#E3B98E";
  ctx.fillRect(x, y - 4, w, 5);
  ctx.fillStyle = hexA(T.plum, 0.18);
  ctx.fillRect(x, y + 1, w, 3);
}

function roomWindow(ctx: Ctx, cx: number, cy: number, r: number): void {
  const glass = P((q) => q.arc(cx, cy, r, 0, 6.3));
  ctx.save();
  ctx.clip(glass);
  // round 3: the window shows the time of day (same skies as the village) and the season
  const A = atmos();
  const sk = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  sk.addColorStop(0, A.sky.sky[1]);
  sk.addColorStop(0.7, A.sky.sky[2]);
  sk.addColorStop(1, A.sky.sky[3]);
  ctx.fillStyle = sk;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  // the afterglow on the left of the window too (one light)
  const ag = ctx.createRadialGradient(cx - r, cy + r, 2, cx - r, cy + r, r * 1.6);
  ag.addColorStop(0, hexA("#FFC9A0", 0.45));
  ag.addColorStop(1, hexA("#FFC9A0", 0));
  ctx.fillStyle = ag;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  if (A.time === "dusk") moon(ctx, cx + r * 0.4, cy - r * 0.38, r * 0.16, 0.58);
  else if (A.time === "night") moon(ctx, cx - r * 0.4, cy - r * 0.42, r * 0.17, 0.92);
  else {
    // the sun on the left (the key light's side): low at dawn, high by day
    const sy = A.time === "dawn" ? cy + r * 0.3 : cy - r * 0.45;
    glow(ctx, cx - r * 0.45, sy, r * 0.9, "#FFF1C8", 0.6);
    ctx.fillStyle = "#FFF7E0";
    ctx.beginPath();
    ctx.arc(cx - r * 0.45, sy, r * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }
  reseed(4);
  for (let i = 0; i < (A.time === "day" ? 0 : A.time === "dawn" ? 4 : 12); i++) {
    ctx.fillStyle = hexA(T.cream, 0.4 + rnd() * 0.5);
    ctx.beginPath();
    ctx.arc(cx - r + rnd() * r * 2, cy - r + rnd() * r, 0.8, 0, 6.3);
    ctx.fill();
  }
  ctx.fillStyle = A.season === "winter" ? "#DCE6F4" : A.sky.hills[1];
  ctx.beginPath();
  ctx.moveTo(cx - r, cy + r * 0.5);
  ctx.quadraticCurveTo(cx - r * 0.2, cy + r * 0.2, cx + r, cy + r * 0.45);
  ctx.lineTo(cx + r, cy + r);
  ctx.lineTo(cx - r, cy + r);
  ctx.closePath();
  ctx.fill();
  const snow = A.season === "winter";
  drawLanternHouse(ctx, cx - r * 0.38, cy + r * 0.66, 0.15, { theme: LANTERN_THEMES.momo, groundGlow: false, threshold: false, snow });
  drawLanternHouse(ctx, cx + r * 0.4, cy + r * 0.7, 0.12, { theme: LANTERN_THEMES.sage, groundGlow: false, threshold: false, snow });
  if (A.season === "spring" || A.season === "autumn" || snow) {
    reseed(9);
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = snow ? "#FFFFFF" : A.season === "spring" ? "#F8C4D2" : "#E3934A";
      ctx.beginPath();
      ctx.ellipse(cx - r + rnd() * r * 2, cy - r + rnd() * r * 1.4, 1.2, snow ? 1.2 : 0.8, rnd() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  // frame (a wood band), muntins, sill
  const ring = P((q) => {
    q.arc(cx, cy, r + 4, 0, 6.3);
    q.arc(cx, cy, r - 0.5, 0, 6.3, true);
  });
  solid(ctx, ring, T.woodHi, { x: cx - r - 4, y: cy - r - 4, w: r * 2 + 8, h: r * 2 + 8 }, { rim: 0.8, ao: 0, tex: "wood" });
  const mun = P((q) => {
    q.rect(cx - r, cy - 1.6, r * 2, 3.2);
    q.rect(cx - 1.6, cy - r, 3.2, r * 2);
  });
  ctx.save();
  ctx.clip(P((q) => q.arc(cx, cy, r, 0, 6.3)));
  solid(ctx, mun, T.woodHi, { x: cx - r, y: cy - r, w: r * 2, h: r * 2 }, { rim: 0.4, ao: 0 });
  ctx.restore();
  solid(ctx, rrect(cx - r - 8, cy + r - 1, (r + 8) * 2, 7, 3), T.woodHi, { x: cx - r - 8, y: cy + r - 1, w: (r + 8) * 2, h: 7 }, { rim: 0.8, tex: "wood" });
}

/** The room shell into the box (no furniture, no residents): frame, walls, floor, window, lid roof, string lights. */
export function drawRoomShell(ctx: Ctx, at: Box, spec: { wallpaper: number; floor: number; time?: TimeOfDay; season?: Season }): void {
  setAtmos(spec.time ?? "dusk", spec.season ?? "summer");
  const m = roomMap(at);
  ctx.save();
  ctx.translate(m.ox, m.oy);
  ctx.scale(m.k, m.k);
  contact(ctx, 200, 414 + ex, 196, 10, 0.5);
  // the frame (the cottage body)
  solid(ctx, rrect(4, 58, 392, 356 + ex, 28), T.wood, { x: 4, y: 58, w: 392, h: 356 + ex }, { rim: 2.4, lit: 0.3, tex: "wood" });
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(IN.x0, IN.y0, IN.x1 - IN.x0, IN.y1 - IN.y0, 20);
  ctx.clip();
  // back wall + wainscot
  const wainY = WAIN;
  wallpaper(ctx, spec.wallpaper, BACK.x0, IN.y0, BACK.x1 - BACK.x0, BACK.y1 - IN.y0);
  wainscot(ctx, BACK.x0, wainY, BACK.x1 - BACK.x0, BACK.y1 - wainY);
  // side walls (shallow perspective): the same paper + wainscot heights, darker on the right (away from the lantern)
  for (const side of [-1, 1] as const) {
    const xo = side < 0 ? IN.x0 : IN.x1;
    const xi = side < 0 ? BACK.x0 : BACK.x1;
    const sw = P((q) => {
      q.moveTo(xo, IN.y0);
      q.lineTo(xi, IN.y0 + 8);
      q.lineTo(xi, BACK.y1);
      q.lineTo(xo, IN.y1);
      q.closePath();
    });
    ctx.save();
    ctx.clip(sw);
    wallpaper(ctx, spec.wallpaper, Math.min(xo, xi), IN.y0, Math.abs(xi - xo), IN.y1 - IN.y0);
    const f = (wainY - IN.y0 - 8) / (BACK.y1 - IN.y0 - 8);
    const yo = IN.y0 + f * (IN.y1 - IN.y0);
    const wq = P((q) => {
      q.moveTo(xi, wainY);
      q.lineTo(xi, BACK.y1);
      q.lineTo(xo, IN.y1);
      q.lineTo(xo, yo);
      q.closePath();
    });
    const wg = ctx.createLinearGradient(0, wainY, 0, IN.y1);
    wg.addColorStop(0, "#C99A72");
    wg.addColorStop(1, "#A97852");
    ctx.fillStyle = wg;
    ctx.fill(wq);
    ctx.restore();
    ctx.fillStyle = hexA(T.plum, side < 0 ? 0.1 : 0.26);
    ctx.fill(sw);
  }
  // floor (0..2)
  const fl = FLOORS[((spec.floor % 3) + 3) % 3]!;
  const floor = P((q) => {
    q.moveTo(BACK.x0, BACK.y1);
    q.lineTo(BACK.x1, BACK.y1);
    q.lineTo(IN.x1, IN.y1);
    q.lineTo(IN.x0, IN.y1);
    q.closePath();
  });
  const fg = ctx.createLinearGradient(0, BACK.y1, 0, IN.y1);
  fg.addColorStop(0, fl.far);
  fg.addColorStop(1, fl.near);
  ctx.fillStyle = fg;
  ctx.fill(floor);
  ctx.save();
  ctx.clip(floor);
  if (fl.kind === "plank") {
    // boards converge to the back (value bands, no hairlines)
    ctx.fillStyle = hexA(T.plum, 0.14);
    for (let i = -7; i <= 7; i++) {
      const a = 200 + i * 22;
      const b = 200 + i * 28;
      ctx.beginPath();
      ctx.moveTo(a - 0.6, BACK.y1);
      ctx.lineTo(a + 0.6, BACK.y1);
      ctx.lineTo(b + 1, IN.y1);
      ctx.lineTo(b - 1, IN.y1);
      ctx.closePath();
      ctx.fill();
    }
    texture(ctx, floor, { x: IN.x0, y: BACK.y1, w: IN.x1 - IN.x0, h: IN.y1 - BACK.y1 }, "wood", 0.22);
  } else {
    // checker tiles in perspective
    const rows = 5;
    for (let j = 0; j < rows; j++) {
      const ya = BACK.y1 + ((IN.y1 - BACK.y1) * j) / rows;
      const yb = BACK.y1 + ((IN.y1 - BACK.y1) * (j + 1)) / rows;
      const [a0, a1] = floorSpan(ya);
      const [b0, b1] = floorSpan(yb);
      for (let i = 0; i < 8; i++) {
        if ((i + j) % 2) continue;
        const t0 = i / 8;
        const t1 = (i + 1) / 8;
        ctx.fillStyle = hexA("#C27A5A", 0.28);
        ctx.beginPath();
        ctx.moveTo(a0 + (a1 - a0) * t0, ya);
        ctx.lineTo(a0 + (a1 - a0) * t1, ya);
        ctx.lineTo(b0 + (b1 - b0) * t1, yb);
        ctx.lineTo(b0 + (b1 - b0) * t0, yb);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  // the back wall's contact shadow on the floor
  const fs = ctx.createLinearGradient(0, BACK.y1, 0, BACK.y1 + 16);
  fs.addColorStop(0, hexA(T.plum, 0.3));
  fs.addColorStop(1, hexA(T.plum, 0));
  ctx.fillStyle = fs;
  ctx.fillRect(IN.x0, BACK.y1, IN.x1 - IN.x0, 16);
  ctx.restore();
  // ceiling beam + string lights (bulbs below the beam, clear of the window and the wall slots' tops)
  solid(ctx, rrect(IN.x0, IN.y0, IN.x1 - IN.x0, 16, 4), T.woodHi, { x: IN.x0, y: IN.y0, w: IN.x1 - IN.x0, h: 16 }, { rim: 0.8, tex: "wood" });
  const wire = (x: number): number => IN.y0 + 22 + Math.sin(((x - IN.x0) / (IN.x1 - IN.x0)) * Math.PI) * 14;
  ctx.strokeStyle = hexA("#1A1636", 0.8);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let x = IN.x0 + 6; x <= IN.x1 - 6; x += 6) (x === IN.x0 + 6 ? ctx.moveTo(x, wire(x)) : ctx.lineTo(x, wire(x)));
  ctx.stroke();
  const cols = [T.amber, T.pink, T.mint, T.lemon, T.lilac];
  for (let i = 0; i < 11; i++) {
    const x = IN.x0 + 22 + i * 32;
    const y = wire(x);
    const c = cols[i % cols.length]!;
    glow(ctx, x, y + 6, 12, c, 0.5);
    ctx.fillStyle = "#1A1636";
    ctx.fillRect(x - 1, y - 1, 2, 3);
    solid(ctx, rrect(x - 3, y + 1.5, 6, 7, 3), c, { x: x - 3, y: y + 1.5, w: 6, h: 7 }, { rim: 0.5, lit: 0.4, ao: 0 });
  }
  roomWindow(ctx, WINDOW.x, WINDOW.y, WINDOW.r);
  // the room's key light: a paper lantern hanging from the beam, upper left (Reality G1 #15)
  {
    const lx = 112;
    const ly = IN.y0 + 58 + ex * 0.25;
    ctx.fillStyle = "#3E2A30";
    ctx.fillRect(lx - 0.8, IN.y0 + 14, 1.6, ly - IN.y0 - 24);
    glow(ctx, lx, ly, 70, "#FFD98A", 0.4);
    miniLantern(ctx, lx, ly, 22, true);
  }
  // the room's light: the paper lantern's warm pool (left), cool window light (right)
  glow(ctx, 110, 300, 200, "#FFD9A0", 0.2, 0.75);
  glow(ctx, WINDOW.x, WINDOW.y + 30, 90, "#C9D2FF", 0.08);
  ctx.restore();
  // the lid roof (the cottage is a lantern too): scallops as VALUE BANDS (Reality #12), no hairlines
  const roof = "#B97A62"; // the cottage's lid colour (index.ts COTTAGE)
  const cap = P((q) => {
    q.moveTo(-4, 70);
    q.quadraticCurveTo(-8, 54, 18, 46);
    q.lineTo(156, 14);
    q.quadraticCurveTo(200, 4, 244, 14);
    q.lineTo(382, 46);
    q.quadraticCurveTo(408, 54, 404, 70);
    q.quadraticCurveTo(200, 60, -4, 70);
    q.closePath();
  });
  solid(ctx, cap, roof, { x: -8, y: 4, w: 416, h: 66 }, { rim: 2.4, lit: 0.34, shade: 0.4, tex: "wood" });
  ctx.save();
  ctx.clip(cap);
  for (const [y, n, x0] of [[62, 16, 4], [46, 13, 38], [30, 9, 96]] as const) {
    for (let i = 0; i < n; i++) {
      const x = x0 + i * 26;
      const sc = P((q) => {
        q.moveTo(x - 13, y);
        q.arc(x, y, 13, Math.PI, 0, true);
        q.arc(x, y - 2.6, 13, 0, Math.PI, false);
        q.closePath();
      });
      ctx.fillStyle = hexA(mix(roof, T.plum, 0.55), 0.36);
      ctx.fill(sc);
    }
  }
  ctx.restore();
  const knob = rrect(184, 0, 32, 12, 5);
  solid(ctx, knob, T.woodHi, { x: 184, y: 0, w: 32, h: 12 }, { rim: 1, tex: "wood" });
  ctx.restore();
  setAtmos();
}

/** The visitors (Wick + Momo) at the front corners of the floor, in front of the furniture (Reality G1 #15). */
export function drawRoomGuests(ctx: Ctx, at: Box): void {
  const m = roomMap(at);
  const X = (x: number): number => m.ox + x * m.k;
  const Y = (y: number): number => m.oy + y * m.k;
  drawResidentAt(ctx, "wick", "happy", X(52), Y(IN.y1 - 2), 60 * m.k, { glow: true });
  drawResidentAt(ctx, "momo", "shy", X(348), Y(IN.y1 - 2), 56 * m.k, { glow: true });
}

/**
 * The night outside the cottage (Reality G1 #13): the room screen is not a flat navy page — dusk sky with
 * stars and the moon (lit side left), far hills at the eaves, and the lawn the cottage stands on.
 * `screen` = the whole canvas, `room` = the cottage's box (drawRoomShell's).
 */
export function drawCottageOutside(ctx: Ctx, screen: Box, room: Box): void {
  const m = roomMap(room);
  const ground = m.oy + IN.y1 * m.k + 6 * m.k;
  const sky = ctx.createLinearGradient(0, screen.y, 0, ground);
  sky.addColorStop(0, T.skyTop);
  sky.addColorStop(0.55, T.skyMid);
  sky.addColorStop(0.85, "#5A4580");
  sky.addColorStop(1, "#7A5A8C");
  ctx.fillStyle = sky;
  ctx.fillRect(screen.x, screen.y, screen.w, ground - screen.y);
  // the afterglow low on the left (the key light's side)
  glow(ctx, screen.x - screen.w * 0.1, ground, screen.w * 0.9, "#FFC9A0", 0.22);
  reseed(23);
  for (let i = 0; i < 70; i++) {
    const x = screen.x + rnd() * screen.w;
    const y = screen.y + rnd() * (ground - screen.y) * 0.7;
    ctx.fillStyle = hexA(T.cream, 0.25 + rnd() * 0.5);
    ctx.beginPath();
    ctx.arc(x, y, rnd() < 0.1 ? 1.3 : 0.5 + rnd() * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // the moon in the sky's free strip above the lid (left of the title column); where that strip is the header
  // itself (short screens: SE), there is no moon here — the window inside shows it (re-review 3 #2)
  const mr = Math.max(9, screen.w * 0.035);
  const my = m.oy - mr * 2.2;
  if (my - mr > screen.y + 100) moon(ctx, screen.x + screen.w * 0.22, my, mr, 0.58);
  // far hills just under the eaves
  const hy = m.oy + 150 * m.k;
  ctx.fillStyle = mix(T.hillMid, T.plum, 0.25);
  ctx.beginPath();
  ctx.moveTo(screen.x, hy);
  ctx.quadraticCurveTo(screen.x + screen.w * 0.3, hy - 30 * m.k, screen.x + screen.w * 0.55, hy - 6 * m.k);
  ctx.quadraticCurveTo(screen.x + screen.w * 0.8, hy + 14 * m.k, screen.x + screen.w, hy - 18 * m.k);
  ctx.lineTo(screen.x + screen.w, ground);
  ctx.lineTo(screen.x, ground);
  ctx.closePath();
  ctx.fill();
  // the lawn under the cottage, down to the screen's bottom
  const lg = ctx.createLinearGradient(0, ground - 10 * m.k, 0, screen.y + screen.h);
  lg.addColorStop(0, T.lawn);
  lg.addColorStop(1, T.groundDeep);
  ctx.fillStyle = lg;
  ctx.beginPath();
  ctx.moveTo(screen.x, ground - 4 * m.k);
  ctx.quadraticCurveTo(screen.x + screen.w / 2, ground - 16 * m.k, screen.x + screen.w, ground - 4 * m.k);
  ctx.lineTo(screen.x + screen.w, screen.y + screen.h);
  ctx.lineTo(screen.x, screen.y + screen.h);
  ctx.closePath();
  ctx.fill();
  texture(ctx, rrect(screen.x, ground - 16 * m.k, screen.w, screen.y + screen.h - ground + 16 * m.k, 0), { x: screen.x, y: ground - 16 * m.k, w: screen.w, h: screen.h }, "grass", 0.2);
  // (v15: no flower specks — they read as a starfield; the dialogue card sits on this lawn)
  // a wooden porch deck BELOW the frame (re-review 3 #1: it was hidden under the frame): two planks + a step
  const py = m.oy + (414 + m.ex) * m.k - 2 * m.k;
  const deck = { x: m.ox + 14 * m.k, y: py, w: 372 * m.k, h: 15 * m.k };
  solid(ctx, rrect(deck.x, deck.y, deck.w, deck.h, 4 * m.k), T.woodHi, deck, { rim: 1, lit: 0.32, tex: "wood" });
  ctx.fillStyle = hexA(T.plum, 0.16);
  ctx.fillRect(deck.x + 6 * m.k, deck.y + deck.h * 0.48, deck.w - 12 * m.k, Math.max(1, 1.2 * m.k));
  const step = { x: m.ox + 150 * m.k, y: py + 14 * m.k, w: 100 * m.k, h: 10 * m.k };
  contact(ctx, m.ox + 200 * m.k, step.y + step.h + 2 * m.k, 64 * m.k, 5 * m.k, 0.35);
  solid(ctx, rrect(step.x, step.y, step.w, step.h, 3 * m.k), T.wood, step, { rim: 0.8, tex: "wood" });
}
