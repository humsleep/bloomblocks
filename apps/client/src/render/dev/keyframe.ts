// DEV ONLY: the v9 target keyframe — the play screen (house + courtyard mid-solve) composed
// with the production bake code, as one still at iPhone Pro Max resolution (440×956 pt @3x).
// Open /src/render/dev/keyframe.html on the dev server; ?se renders the SE layout.
import { bakeFront, bakeSky, moonPos } from "../backdrop.ts";
import { drawGlow, drawHintIcon, drawLantern, drawMoonPhase, drawRock, drawStreetIcon, drawUndoIcon, drawDigit, drawCalendarTile, GLOW, drawPlate } from "../draw.ts";
import { drawHouse, drawLitWindow, houseFor } from "../house.ts";
import { drawMarkerStone, lightStamps, markerGeom, paintContactShadow, paintCourtyard, paintLightStill, paintLitFloor, planLight } from "../court.ts";
import { drawNumerals } from "../glyphs.ts";
import { hashStr, rng } from "../rng.ts";

const q = new URLSearchParams(location.search);
const se = q.has("se");
const PT = se ? { w: 375, h: 667, u: 2, top: 20, bottom: 0 } : { w: 440, h: 956, u: 3, top: 62, bottom: 34 };
const u = PT.u;
const W = PT.w * u;
const H = PT.h * u;
const canvas = document.getElementById("c") as HTMLCanvasElement;
canvas.width = W;
canvas.height = H;
canvas.style.width = `${PT.w}px`;
const ctx = canvas.getContext("2d")!;

// ---- layout (mirrors LanternsScene.layout)
const far = q.has("far");
const cols = far ? 8 : 5, rows = far ? 8 : 5;
const st = PT.top * u;
const bottomMargin = Math.max(PT.bottom * u, 12 * u) + 10 * u;
const usableH = H - st - bottomMargin;
const fit = (bw: number, bh: number) => {
  let pad = Math.round(8 * u);
  let side = Math.max(10 * u, 6 * u);
  let cs = Math.floor(Math.min((W - side * 2 - pad * 2) / bw, (usableH * 0.62 - pad * 2) / bh, 80 * u));
  if (cs < 44 * u) { pad = Math.round(5 * u); side = 6 * u; cs = Math.floor(Math.min((W - side * 2 - pad * 2) / bw, (usableH * 0.7 - pad * 2) / bh, 80 * u)); }
  return { cs, pad, side };
};
const { cs, pad } = fit(cols, rows);
const gap = Math.max(2, Math.round(3 * u));
const boardH = cs * rows + pad * 2;
const bcy = Math.round(H - bottomMargin - boardH / 2);
const boardTop = bcy - boardH / 2;
const ref = fit(8, 8);
const refTop = H - bottomMargin - (ref.cs * 8 + ref.pad * 2);
const ctrlS = Math.round(48 * u);
const houseBaseY = Math.round(refTop - ctrlS - 14 * u);
const crestY = houseBaseY + 12 * u;
const ctrlY = Math.round(boardTop - ctrlS / 2 - 8 * u);
const bxs = Math.max(fit(cols, rows).side + ctrlS / 2, 16 * u + ctrlS / 2);
const hud = [bxs, bxs + ctrlS + 14 * u, W / 2, W - bxs - ctrlS - 14 * u, W - bxs].map((x) => ({ x, y: ctrlY, r: ctrlS / 2 }));
const geom = { W, H, u, safeTop: st, houseBaseY, crestY, hud };

// ---- sky + house + front
bakeSky(ctx, geom, 1);
const m = moonPos(geom);
{
  const s = Math.round(m.r / 0.2);
  ctx.save();
  ctx.translate(m.x - s / 2, m.y - s / 2);
  drawMoonPhase(ctx, s, 0.18, true);
  ctx.restore();
}
const spec = houseFor("keyframe-7", 7);
{
  const wHu = spec.left + spec.right;
  const s = Math.min(Math.min(W * 0.64, 300 * u) / wHu, Math.max(60 * u, houseBaseY - st - 64 * u) / spec.top, 230 * u);
  const ox = W / 2;
  drawHouse(ctx, spec, ox, houseBaseY, s);
  // lit windows: progress 3 of n
  spec.windows.forEach((w, k) => {
    if (k === 0 || !spec.order.slice(0, 3).includes(k)) return;
    const cw = Math.round(w.w * s * 2.6);
    const ch = Math.round(w.h * s * 2.2 + w.w * s * 0.6);
    const c = document.createElement("canvas");
    c.width = cw; c.height = ch;
    drawLitWindow(c.getContext("2d")!, cw, ch, w.w * s, w.h * s, w.round);
    ctx.drawImage(c, ox + w.x * s - cw / 2, houseBaseY + w.y * s - ch / 2);
  });
  // plate
  const d = spec.door;
  const fpt = 20;
  const ph = Math.round((fpt + 8) * u);
  const pw = Math.round(fpt * 1.7 * u);
  const py = houseBaseY + Math.max(-d.h * s * 0.68, -d.h * s + ph / 2 + 2 * u);
  ctx.save();
  ctx.translate(ox + d.x * s - pw / 2, py - ph / 2);
  drawPlate(ctx, pw, ph, u, "gentle");
  drawNumerals(ctx, "7", pw / 2, ph / 2 - 1 * u, fpt * u * 0.7, "#1E1A33", null, 1.1);
  ctx.restore();
}
{
  const frontTop = crestY - 18 * u;
  ctx.save();
  ctx.translate(0, frontTop);
  bakeFront(ctx, geom, 1, H - frontTop);
  ctx.restore();
}

// ---- courtyard
// stones: (2,1)=2  (0,2)=1  (4,2)=rock  (2,3)=4  (0,4)=rock ; lanterns (2,0) (0,1) (4,1) (3,4)
const clue = new Int8Array(64).fill(-1);
const stone = new Uint8Array(64);
const lan = new Uint8Array(64);
const I = (x: number, y: number) => y * 8 + x;
for (const [x, y, n] of (far ? [] : [[2, 1, 2], [0, 2, 1], [4, 2, -1], [2, 3, 4], [0, 4, -1]]) as [number, number, number][]) { stone[I(x, y)] = 1; clue[I(x, y)] = n; }
const lanterns = far ? [[0, 0]] : q.get("lan") === "solved" ? [[2, 0], [0, 1], [4, 1], [3, 4], [1, 3], [2, 2], [2, 4]] : [[2, 0], [0, 1], [4, 1], [3, 3]];
for (const [x, y] of lanterns) lan[I(x!, y!)] = 1;
const ext = Math.min(Math.max(0, (W - cols * cs - pad * 2) / 2 - 6 * u), 9 * u);
const wall = pad + ext;
const face = Math.max(3 * u, cs * 0.07);
const gx = W / 2 - (cols * cs) / 2;
const gy = bcy - (rows * cs) / 2;
const t0 = performance.now();
paintCourtyard(ctx, { cw: W, ch: H, gx, gy, cols, rows, cs, gap, wall, face, u }, "track", "keyframe", (c, r) => stone[I(c, r)] === 0);
// rocks + marker stones
for (let i = 0; i < 64; i++) {
  if (!stone[i]) continue;
  const cx = gx + ((i & 7) + 0.5) * cs;
  const cy = gy + ((i >> 3) + 0.5) * cs;
  if (clue[i]! >= 0) drawMarkerStone(ctx, cx, cy, cs, rng(hashStr(`k:${i}`)));
  else drawRock(ctx, cx, cy - cs * 0.02, cs * 0.43, rng(hashStr(`k:${i}`)));
}
const bakeMs = performance.now() - t0;
// light
const d = new Int8Array(64), dir = new Int8Array(64), rim = new Int8Array(256);
planLight(cols, rows, (i) => stone[i] === 1, (i) => lan[i] === 1, d, dir, rim);
const t1 = performance.now();
const stamps = lightStamps(cs);
const litC = document.createElement("canvas");
litC.width = W; litC.height = H;
paintLitFloor(litC.getContext("2d")!, { cw: W, ch: H, gx, gy, cols, rows, cs, gap, wall, face, u }, "keyframe", (c, r) => stone[I(c, r)] === 0);
const stampMs = performance.now() - t1;
paintLightStill(ctx, litC, gx, gy, gx, gy, cs, cols, rows, { d, dir, rim }, stamps, (i) => clue[i]! >= 0);
// numerals (satisfied = the 1 next to (0,1)… count each)
const count = (i: number) => { let n = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = (i & 7) + dx!, y = (i >> 3) + dy!; if (x >= 0 && y >= 0 && x < cols && y < rows && lan[I(x, y)]) n++; } return n; };
for (let i = 0; i < 64; i++) {
  if (clue[i]! < 0) continue;
  const cx = gx + ((i & 7) + 0.5) * cs;
  const cy = gy + ((i >> 3) + 0.5) * cs + markerGeom(cs).cy;
  const n = count(i);
  drawDigit(ctx, cx, cy, cs, clue[i]!, n === clue[i] ? "warm" : n > clue[i]! ? "over" : "ink");
}
// lanterns: contact shadow, body, flame
const lh = Math.round(cs * 0.92);
for (let i = 0; i < 64; i++) {
  if (!lan[i]) continue;
  const cx = gx + ((i & 7) + 0.5) * cs;
  const cy = gy + ((i >> 3) + 0.5) * cs - cs * 0.03;
  const sw = cs * 0.72, sh = cs * 0.22;
  const sc = document.createElement("canvas"); sc.width = sw; sc.height = sh;
  paintContactShadow(sc.getContext("2d")!, sw, sh);
  ctx.drawImage(sc, cx - sw / 2, cy + lh * 0.37 - sh / 2);
  ctx.save();
  ctx.translate(cx - lh * 0.4, cy - lh * 0.56);
  drawLantern(ctx, lh, 1);
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.translate(cx, cy - cs * 0.02);
  ctx.scale(1, 1.15);
  ctx.globalAlpha = 0.8;
  drawGlow(ctx, 0, 0, cs * 0.22, GLOW.flame);
  ctx.restore();
}
// HUD
const disc = (x: number, y: number, f: (c: CanvasRenderingContext2D, s: number) => void, s = ctrlS) => { ctx.save(); ctx.translate(x - s / 2, y - s / 2); f(ctx, s); ctx.restore(); };
disc(hud[0]!.x, ctrlY, (c, s) => drawStreetIcon(c, s), Math.round(ctrlS * 0.86));
disc(hud[1]!.x, ctrlY - 2 * u, (c) => drawCalendarTile(c, Math.round(46 * u), Math.round(46 * u * 1.12), 16, 0.18, u), Math.round(46 * u));
disc(hud[3]!.x, ctrlY, (c, s) => drawUndoIcon(c, s));
disc(hud[4]!.x, ctrlY, (c, s) => drawHintIcon(c, s, "ask", 0));
console.log(`[keyframe] court bake ${bakeMs.toFixed(1)} ms, light stamps ${stampMs.toFixed(1)} ms, cs ${cs}`);
(window as unknown as { __done: boolean }).__done = true;
// luminance audit: per cell, mean + 5th percentile relative luminance of the slab's centre 70 %
{
  const lin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const out: string[] = [];
  for (let i = 0; i < 64; i++) {
    if ((i & 7) >= cols || i >> 3 >= rows || stone[i] || lan[i]) continue;
    const x0 = Math.round(gx + (i & 7) * cs + cs * 0.15), y0 = Math.round(gy + (i >> 3) * cs + cs * 0.15), n = Math.round(cs * 0.7);
    const px = ctx.getImageData(x0, y0, n, n).data;
    const L: number[] = [];
    for (let k = 0; k < px.length; k += 16) L.push(0.2126 * lin(px[k]!) + 0.7152 * lin(px[k + 1]!) + 0.0722 * lin(px[k + 2]!));
    L.sort((a, b) => a - b);
    const mean = L.reduce((a, b) => a + b, 0) / L.length;
    out.push(`${i & 7},${i >> 3} d=${d[i]} mean=${mean.toFixed(3)} p5=${L[Math.floor(L.length * 0.05)]!.toFixed(3)}`);
  }
  console.log("[lum] " + out.join(" | "));
}
