// Furniture (1.0: 12 items × 2–3 colourways) in the PASS grammar (Reality v2): front view, one body
// (parts joined), handles as band shapes, the OUTLINE rule, 1–2 material details, 3 token colours.
// Units: a room slot is 40 units wide; origin = bottom centre on the floor (y up = negative).
// The item numbers / names / colourways are src/village/catalog.ts's (the contract, §3); drawings only here.
import type { Ctx } from "../draw.ts";
import { contact, ellipseP, glow, hexA, lineW, miniLantern, mix, P, rrect, solid, T, type Box } from "./shade.ts";

export type Colorway = "cream" | "sage" | "rose";
export type ItemId =
  | "paperLantern" | "archChair" | "cushion" | "teaTable" | "smallBed" | "smallPot"
  | "flowerVase" | "bookshelf" | "roundRug" | "wallClock" | "frame" | "teapot"
  // round 3 (full village): 12 more (src/village/catalog.ts order)
  | "floorLamp" | "candles" | "stringLights" | "rockingChair" | "roundTable" | "cactus"
  | "hangingPlant" | "dresser" | "stripedRug" | "wreath" | "knitBasket" | "snowGlobe";

interface Tone {
  base: string;
  hi: string;
  lo: string;
  deep: string;
  accent: string;
}
export const CW: Record<Colorway, Tone> = {
  cream: { base: "#F1DFC0", hi: "#FFF6E4", lo: "#C8A47E", deep: "#A07A58", accent: "#E3A86A" },
  sage: { base: "#A6CDB4", hi: "#DDF1E3", lo: "#6E9A82", deep: "#4F7A66", accent: "#E8C46A" },
  rose: { base: "#EDB0BC", hi: "#FCE0E5", lo: "#C27A8B", deep: "#9C5A6C", accent: "#FFD27A" },
};
const WOOD = { base: "#B07A55", hi: "#D9A57C", lo: "#7E5038", deep: "#5A3828" };
const B = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });

/** Silhouette pass (locked cards): no glows, no contact shadows — only the item's own shape. */
let silhouette = false;
const fxGlow = (ctx: Ctx, x: number, y: number, r: number, col: string, a: number, sy = 1): void => {
  if (!silhouette) glow(ctx, x, y, r, col, a, sy);
};
const fxContact = (ctx: Ctx, x: number, y: number, rx: number, ry: number, a = 0.4): void => {
  if (!silhouette) contact(ctx, x, y, rx, ry, a);
};

function stitch(ctx: Ctx, path: Path2D, col: string): void {
  ctx.save();
  ctx.setLineDash([1.6, 1.4]);
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = hexA(col, 0.75);
  ctx.stroke(path);
  ctx.restore();
}
function shine(ctx: Ctx, x: number, y: number, w: number, a = 0.55): void {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = hexA("#FFFFFF", a);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y - w * 0.12);
  ctx.stroke();
  ctx.restore();
}

export interface ItemArt {
  /** drawn extent in units (x0 … x1, top = highest point, negative) — fit + clip checks */
  x0: number;
  x1: number;
  top: number;
  /** floor slots it spans (the bed is 2) */
  span: 1 | 2;
  colorways: readonly Colorway[];
  draw(ctx: Ctx, c: Tone, cw: Colorway): void;
}

export const ITEMS: Record<ItemId, ItemArt> = {
  // 0 ★ paper lantern — the room's warm light (its pool is part of the asset)
  paperLantern: {
    x0: -15.5, x1: 15.5, top: -45, span: 1, colorways: ["cream", "sage", "rose"],
    draw(ctx, c) {
      fxGlow(ctx, 0, -2, 20, T.glow, 0.3, 0.3);
      fxContact(ctx, 1.5, 0, 12, 2.6, 0.45);
      fxGlow(ctx, 0, -22, 22, T.glow, 0.45);
      for (const dx of [-7, 0, 7]) solid(ctx, rrect(dx - 1, -7, 2, 7, 1), WOOD.lo, B(dx - 1, -7, 2, 7), { rim: 0.4 });
      const body = P((q) => {
        q.moveTo(-9, -8);
        q.bezierCurveTo(-14, -16, -14, -30, -9, -37);
        q.lineTo(9, -37);
        q.bezierCurveTo(14, -30, 14, -16, 9, -8);
        q.closePath();
      });
      const g = ctx.createRadialGradient(-1.5, -24, 0.5, 0, -22, 15);
      g.addColorStop(0, "#FFFBEA");
      g.addColorStop(0.45, mix(c.hi, "#FFE7B0", 0.5));
      g.addColorStop(1, mix(c.base, T.amber, 0.25));
      ctx.fillStyle = g;
      ctx.fill(body);
      ctx.save();
      ctx.clip(body);
      // ribs: value bands (no hairlines)
      for (const yy of [-13, -18.5, -24, -29.5, -34]) {
        ctx.fillStyle = hexA(c.deep, 0.24);
        ctx.beginPath();
        ctx.moveTo(-15, yy - 0.5);
        ctx.quadraticCurveTo(0, yy + 1.1, 15, yy - 0.5);
        ctx.lineTo(15, yy + 0.5);
        ctx.quadraticCurveTo(0, yy + 2.1, -15, yy + 0.5);
        ctx.closePath();
        ctx.fill();
      }
      const side = ctx.createLinearGradient(-14, 0, 14, 0);
      side.addColorStop(0, hexA(T.key, 0.25));
      side.addColorStop(0.3, hexA(T.key, 0));
      side.addColorStop(0.7, hexA(T.plum, 0));
      side.addColorStop(1, hexA(T.plum, 0.22));
      ctx.fillStyle = side;
      ctx.fillRect(-15, -38, 30, 31);
      ctx.restore();
      ctx.lineWidth = lineW(ctx, 30);
      ctx.strokeStyle = mix(c.lo, T.ink, 0.5);
      ctx.stroke(body);
      // handle: a solid band whose ends sit in the lid
      const handle = P((q) => {
        q.arc(0, -38.6, 5.6, Math.PI * 1.04, Math.PI * 1.96);
        q.arc(0, -38.6, 4, Math.PI * 1.96, Math.PI * 1.04, true);
        q.closePath();
      });
      solid(ctx, handle, WOOD.lo, B(-5.6, -44.2, 11.2, 5.6), { rim: 0.4, tex: "wood" });
      for (const [cy, w] of [[-39, 22], [-10, 20]] as const) solid(ctx, rrect(-w / 2, cy, w, 3.4, 1.6), WOOD.base, B(-w / 2, cy, w, 3.4), { rim: 0.6 });
      // tassel on a cord from the lid's right end
      ctx.strokeStyle = mix(c.accent, T.ink, 0.25);
      ctx.lineWidth = lineW(ctx, 30);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(10.4, -37.2);
      ctx.quadraticCurveTo(13.4, -33, 12.6, -28);
      ctx.stroke();
      solid(ctx, ellipseP(12.6, -27.6, 1.3, 1.3), c.accent, B(11.3, -28.9, 2.6, 2.6), { rim: 0.2, ao: 0 });
      const tas = P((q) => {
        q.moveTo(11.4, -26.6);
        q.lineTo(13.8, -26.6);
        q.quadraticCurveTo(14.8, -22.6, 14.2, -21.4);
        q.lineTo(11, -21.4);
        q.quadraticCurveTo(10.4, -22.6, 11.4, -26.6);
        q.closePath();
      });
      solid(ctx, tas, c.accent, B(10.4, -26.6, 4.4, 5.2), { rim: 0.4, lit: 0.35 });
    },
  },
  // 1 ★ arched chair (renamed from "Round chair": the back is an arch on two posts)
  archChair: {
    x0: -15.5, x1: 15.5, top: -49.5, span: 1, colorways: ["cream", "sage", "rose"],
    draw(ctx, c) {
      fxContact(ctx, 1.5, 0, 15, 3, 0.42);
      for (const px of [-13, 10]) solid(ctx, rrect(px, -34, 3, 34, 1.2), WOOD.lo, B(px, -34, 3, 34), { rim: 0.4, tex: "wood" });
      const arch = (inset: number, bottom: number): Path2D =>
        P((q) => {
          const w = 13 - inset;
          q.moveTo(-w, bottom);
          q.lineTo(-w, -36);
          q.quadraticCurveTo(-w, -49 + inset, 0, -49 + inset);
          q.quadraticCurveTo(w, -49 + inset, w, -36);
          q.lineTo(w, bottom);
          q.closePath();
        });
      solid(ctx, arch(0, -22), WOOD.base, B(-13, -49, 26, 27), { rim: 1, tex: "wood" });
      solid(ctx, arch(3.4, -23), c.base, B(-9.6, -45.6, 19.2, 22.6), { rim: 1.1, lit: 0.34, tex: "cloth" });
      stitch(ctx, P((q) => {
        q.moveTo(-7.4, -25);
        q.lineTo(-7.4, -36);
        q.quadraticCurveTo(-7.4, -43.4, 0, -43.4);
        q.quadraticCurveTo(7.4, -43.4, 7.4, -36);
        q.lineTo(7.4, -25);
      }), c.hi);
      ctx.fillStyle = hexA(c.deep, 0.6);
      ctx.beginPath();
      ctx.arc(0, -35, 1, 0, 6.3);
      ctx.fill();
      solid(ctx, rrect(-15, -18, 30, 4.4, 1.6), WOOD.base, B(-15, -18, 30, 4.4), { rim: 0.6, tex: "wood" });
      solid(ctx, rrect(-14, -24.5, 28, 7.5, 3.6), mix(c.base, c.hi, 0.2), B(-14, -24.5, 28, 7.5), { rim: 1, lit: 0.32, tex: "cloth" });
      stitch(ctx, P((q) => q.roundRect(-11.6, -22.6, 23.2, 3.6, 1.8)), c.hi);
      for (const sx of [-1, 1]) {
        const lx = sx * 11.5;
        const l = P((q) => {
          q.moveTo(lx - 1.4, -14);
          q.lineTo(lx + 1.4, -14);
          q.lineTo(lx + 1.4 + sx * 0.9, 0);
          q.lineTo(lx - 1.4 + sx * 0.9, 0);
          q.closePath();
        });
        solid(ctx, l, WOOD.base, B(lx - 2.4, -14, 4.8, 14), { rim: 0.5, tex: "wood" });
      }
      shine(ctx, -9, -42, 4, 0.4);
    },
  },
  // 2 floor cushion ("꽃잎 방석", Reality G1 #11): a round petal-edged zabuton seen from the front-top —
  // six puffed petals, its thickness below, tufted creases to a centre button (no corner tassels: not a candy)
  cushion: {
    x0: -20, x1: 20, top: -20, span: 1, colorways: ["rose", "cream"],
    draw(ctx, c) {
      fxContact(ctx, 1.5, 0, 19, 3, 0.42);
      const cy = -10.5;
      const petals = (dy: number, sx: number, sy: number): Path2D =>
        P((q) => {
          const n = 6;
          for (let i = 0; i <= n; i++) {
            const a = (i / n) * Math.PI * 2 - Math.PI / 2;
            const am = a - Math.PI / n;
            const x = Math.cos(a) * sx;
            const y = cy + dy + Math.sin(a) * sy;
            if (i === 0) q.moveTo(x, y);
            else q.quadraticCurveTo(Math.cos(am) * sx * 1.32, cy + dy + Math.sin(am) * sy * 1.32, x, y);
          }
          q.closePath();
        });
      // the thickness (the side band), then the top
      const side = petals(4.2, 15.2, 6.4);
      solid(ctx, side, mix(c.base, c.deep, 0.35), B(-20, -20, 40, 18), { rim: 0.6, lit: 0.18, tex: "cloth" });
      const top = petals(0, 15.2, 6.4);
      solid(ctx, top, c.base, B(-20, -19.5, 40, 17), { rim: 1.2, lit: 0.36, tex: "cloth" });
      // tufted creases: soft value wedges from the button outwards
      ctx.save();
      ctx.clip(top);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2 + Math.PI / 6;
        const g = ctx.createLinearGradient(0, cy, Math.cos(a) * 14, cy + Math.sin(a) * 6);
        g.addColorStop(0, hexA(c.deep, 0.42));
        g.addColorStop(1, hexA(c.deep, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, cy);
        ctx.lineTo(Math.cos(a - 0.08) * 16, cy + Math.sin(a - 0.08) * 7);
        ctx.lineTo(Math.cos(a + 0.08) * 16, cy + Math.sin(a + 0.08) * 7);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      stitch(ctx, petals(0, 12.2, 5), c.hi);
      solid(ctx, ellipseP(0, cy, 2.1, 1.4), c.accent, B(-2.1, cy - 1.4, 4.2, 2.8), { rim: 0.3, ao: 0 });
      shine(ctx, -10, -14.6, 5, 0.45);
    },
  },
  // 3 ★ tea table — front projection; cream = the cream token (warm), mottle at half contrast
  teaTable: {
    x0: -23, x1: 23, top: -24, span: 1, colorways: ["cream", "sage", "rose"],
    draw(ctx, c, cw) {
      // cream = the cream token, warm (not a grey "concrete" white), its wood mottle at half contrast
      const top = cw === "cream" ? { base: "#F2DBB2", hi: "#FFF3DC", lo: "#C99F74" } : { base: c.base, hi: c.hi, lo: c.lo };
      fxContact(ctx, 2, 0, 23, 3.4, 0.45);
      for (const dx of [-12, 9.6]) solid(ctx, rrect(dx, -11, 2.4, 9.5, 1), mix(top.lo, T.plum, 0.25), B(dx, -11, 2.4, 9.5), { rim: 0.2, lit: 0.1 });
      for (const dx of [-19, 16.4]) solid(ctx, rrect(dx, -11, 2.8, 11, 1.1), mix(top.base, top.lo, 0.45), B(dx, -11, 2.8, 11), { rim: 0.4, tex: "wood", texA: 0.12 });
      solid(ctx, rrect(-20, -14.5, 40, 5, 1.6), mix(top.base, top.lo, 0.3), B(-20, -14.5, 40, 5), { rim: 0.5, tex: "wood", texA: 0.12 });
      solid(ctx, rrect(-22, -18, 44, 4.4, 2.2), top.base, B(-22, -18, 44, 4.4), { rim: 1, lit: 0.38, ao: 0.08, tex: "wood", texA: 0.12 });
      shine(ctx, -16, -16.6, 9, 0.55);
      fxContact(ctx, 7, -17.8, 5, 0.9, 0.4);
      solid(ctx, rrect(2.6, -19.2, 8.8, 1.6, 0.8), "#FFF6E8", B(2.6, -19.2, 8.8, 1.6), { rim: 0.2, ao: 0 });
      const cup = P((q) => {
        q.moveTo(4.2, -23.6);
        q.lineTo(9.8, -23.6);
        q.quadraticCurveTo(9.6, -19.2, 7, -19.2);
        q.quadraticCurveTo(4.4, -19.2, 4.2, -23.6);
        q.closePath();
      });
      solid(ctx, cup, "#FFF6E8", B(4.2, -23.6, 5.6, 4.4), { rim: 0.3, ao: 0.14 });
      ctx.fillStyle = "#C98A5A";
      ctx.beginPath();
      ctx.ellipse(7, -23.4, 2.5, 0.6, 0, 0, 6.3);
      ctx.fill();
    },
  },
  // 4 ★ little bed — 64 long (2 slots), head 1.31 × the mattress, two pillows
  smallBed: {
    x0: -35, x1: 35, top: -24, span: 2, colorways: ["cream", "sage", "rose"],
    draw(ctx, c) {
      fxContact(ctx, 2, 0, 34, 3.8, 0.45);
      const L = -32;
      const R = 32;
      for (const dx of [L + 2, R - 5]) solid(ctx, rrect(dx, -5, 3, 5, 1), WOOD.lo, B(dx, -5, 3, 5), { rim: 0.3 });
      const head = P((q) => {
        q.moveTo(L, -4);
        q.lineTo(L, -17);
        q.quadraticCurveTo(L, -21, L + 4, -21);
        q.quadraticCurveTo(L + 7, -23, L + 10, -21);
        q.quadraticCurveTo(L + 13, -21, L + 13, -17);
        q.lineTo(L + 13, -4);
        q.closePath();
      });
      solid(ctx, head, WOOD.base, B(L, -23, 13, 19), { rim: 1, tex: "wood" });
      ctx.fillStyle = c.accent;
      ctx.fill(ellipseP(L + 7, -21.6, 1.4, 1.4));
      const foot = P((q) => {
        q.moveTo(R - 8, -4);
        q.lineTo(R - 8, -14);
        q.quadraticCurveTo(R - 8, -16.5, R - 4, -16.5);
        q.quadraticCurveTo(R, -16.5, R, -14);
        q.lineTo(R, -4);
        q.closePath();
      });
      solid(ctx, foot, WOOD.base, B(R - 8, -16.5, 8, 12.5), { rim: 0.8, tex: "wood" });
      solid(ctx, rrect(L + 1, -10, R - L - 2, 6, 2), WOOD.base, B(L + 1, -10, R - L - 2, 6), { rim: 0.6, tex: "wood" });
      solid(ctx, rrect(L + 11, -16, R - L - 18, 6.4, 3), "#FFF7EA", B(L + 11, -16, R - L - 18, 6.4), { rim: 0.8, tex: "cloth" });
      solid(ctx, rrect(L + 11.5, -21, 12, 6.4, 3.2), "#FFFBF2", B(L + 11.5, -21, 12, 6.4), { rim: 1, lit: 0.3, tex: "cloth" });
      const qx0 = L + 22;
      const qx1 = R - 6;
      const quilt = P((q) => {
        q.moveTo(qx0, -18);
        q.quadraticCurveTo((qx0 + qx1) / 2, -19.5, qx1, -17.5);
        q.lineTo(qx1 + 1, -9);
        const n = 7;
        const step = (qx1 + 1 - qx0) / n;
        for (let i = 0; i < n; i++) q.quadraticCurveTo(qx1 + 1 - step * (i + 0.5), -6.6, qx1 + 1 - step * (i + 1), -9);
        q.closePath();
      });
      solid(ctx, quilt, c.base, B(qx0, -19.5, qx1 - qx0 + 1, 13), { rim: 1, lit: 0.3, tex: "cloth" });
      ctx.save();
      ctx.clip(quilt);
      ctx.fillStyle = hexA(c.hi, 0.55);
      for (let i = 0; i < 9; i++) for (let j = 0; j < 3; j++) if (!((i + j) % 2)) ctx.fillRect(qx0 + i * 4, -20 + j * 4, 4, 4);
      ctx.restore();
      stitch(ctx, P((q) => {
        q.moveTo(qx0 + 1, -16.5);
        q.quadraticCurveTo((qx0 + qx1) / 2, -18, qx1 - 1, -16);
      }), "#FFFFFF");
      shine(ctx, L + 2, -18, 3, 0.45);
    },
  },
  // 5 ★ little pot
  smallPot: {
    x0: -11, x1: 11, top: -26, span: 1, colorways: ["sage", "cream", "rose"],
    draw(ctx, c) {
      fxContact(ctx, 1, 0, 9, 2.2, 0.42);
      const leaves: [number, number, number][] = [[-6, -0.9, 7], [6, 0.8, 7.4], [0, 0.05, 7.6], [-9, -1.3, 5.6], [9, 1.3, 5.6], [-2, -0.35, 6]];
      for (const [dx, a, l] of leaves) {
        ctx.save();
        ctx.translate(dx * 0.3, -13);
        ctx.rotate(a);
        const lf = P((q) => {
          q.moveTo(0, 0);
          q.bezierCurveTo(-l * 0.55, -l * 0.4, -l * 0.45, -l * 1.1, 0, -l * 1.45);
          q.bezierCurveTo(l * 0.45, -l * 1.1, l * 0.55, -l * 0.4, 0, 0);
          q.closePath();
        });
        solid(ctx, lf, a < -0.5 ? "#5E9474" : a > 0.5 ? "#4F8466" : "#6BA683", B(-l * 0.55, -l * 1.45, l * 1.1, l * 1.45), { rim: 0.7, lit: 0.38, ao: 0 });
        ctx.strokeStyle = hexA("#DFF5E6", 0.55);
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, -0.5);
        ctx.quadraticCurveTo(0.4, -l * 0.7, 0, -l * 1.3);
        ctx.stroke();
        ctx.restore();
      }
      const body = P((q) => {
        q.moveTo(-8, -12);
        q.lineTo(8, -12);
        q.bezierCurveTo(8.4, -6, 7, -1, 5.5, 0);
        q.lineTo(-5.5, 0);
        q.bezierCurveTo(-7, -1, -8.4, -6, -8, -12);
        q.closePath();
      });
      solid(ctx, body, c.base, B(-8.4, -12, 16.8, 12), { rim: 0.9, lit: 0.36 });
      ctx.save();
      ctx.clip(body);
      ctx.strokeStyle = hexA(c.hi, 0.7);
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(-8, -6);
      for (let i = 0; i < 8; i++) ctx.quadraticCurveTo(-7 + i * 2, i % 2 ? -7.6 : -4.6, -6 + i * 2, -6);
      ctx.stroke();
      ctx.restore();
      solid(ctx, rrect(-9.2, -14, 18.4, 3.2, 1.6), mix(c.base, "#FFFFFF", 0.15), B(-9.2, -14, 18.4, 3.2), { rim: 0.5, ao: 0 });
      ctx.fillStyle = "#4A3A52";
      ctx.beginPath();
      ctx.ellipse(0, -13.4, 7.6, 0.9, 0, 0, 6.3);
      ctx.fill();
      shine(ctx, -6, -9.5, 2.4, 0.6);
    },
  },
  // 6 flower vase — a round glazed vase, three stems (pink, lemon, cream) and two leaves
  flowerVase: {
    x0: -11, x1: 11, top: -40, span: 1, colorways: ["rose", "cream"],
    draw(ctx, c) {
      fxContact(ctx, 1, 0, 9, 2.2, 0.42);
      const stems: [number, number, number, string][] = [[-6.5, -33, -0.25, T.pink], [0.5, -37.5, 0.02, T.lemon], [6.5, -31, 0.3, "#FFF3DE"]];
      ctx.lineCap = "round";
      for (const [x, y] of stems) {
        ctx.strokeStyle = "#4F8466";
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.quadraticCurveTo(x * 0.4, (y - 18) / 2, x, y);
        ctx.stroke();
      }
      for (const [sx, y, a] of [[-1, -24, -0.7], [1, -22, 0.8]] as const) {
        ctx.save();
        ctx.translate(sx * 1.2, y);
        ctx.rotate(a);
        const lf = P((q) => {
          q.moveTo(0, 0);
          q.bezierCurveTo(-2.6, -1.6, -2.2, -6, 0, -7.6);
          q.bezierCurveTo(2.2, -6, 2.6, -1.6, 0, 0);
          q.closePath();
        });
        solid(ctx, lf, "#5E9474", B(-2.6, -7.6, 5.2, 7.6), { rim: 0.5, lit: 0.36, ao: 0 });
        ctx.restore();
      }
      for (const [x, y, a, col] of stems) {
        // five round petals around a lemon heart, each petal shaded (one solid shape)
        const f = P((q) => {
          for (let i = 0; i < 5; i++) {
            const t = a + (i / 5) * Math.PI * 2 - Math.PI / 2;
            q.moveTo(x + Math.cos(t) * 2.4 + 2, y + Math.sin(t) * 2.4);
            q.arc(x + Math.cos(t) * 2.4, y + Math.sin(t) * 2.4, 2, 0, Math.PI * 2);
          }
        });
        solid(ctx, f, col, B(x - 4.4, y - 4.4, 8.8, 8.8), { rim: 0.5, lit: 0.3, ao: 0 });
        solid(ctx, ellipseP(x, y, 1.5, 1.5), col === T.lemon ? T.coral : T.lemon, B(x - 1.5, y - 1.5, 3, 3), { rim: 0.2, ao: 0, line: false });
      }
      const body = P((q) => {
        q.moveTo(-3.6, -19);
        q.lineTo(3.6, -19);
        q.quadraticCurveTo(3.4, -15.5, 6.4, -13);
        q.bezierCurveTo(10.6, -9.6, 9.6, -1.4, 5.4, 0);
        q.lineTo(-5.4, 0);
        q.bezierCurveTo(-9.6, -1.4, -10.6, -9.6, -6.4, -13);
        q.quadraticCurveTo(-3.4, -15.5, -3.6, -19);
        q.closePath();
      });
      solid(ctx, body, c.base, B(-9.6, -19, 19.2, 19), { rim: 1, lit: 0.36 });
      // a glaze band (value band, not a hairline)
      ctx.save();
      ctx.clip(body);
      ctx.fillStyle = hexA(c.deep, 0.3);
      ctx.beginPath();
      ctx.moveTo(-10, -8.6);
      ctx.quadraticCurveTo(0, -6.8, 10, -8.6);
      ctx.lineTo(10, -6.8);
      ctx.quadraticCurveTo(0, -5, -10, -6.8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      solid(ctx, rrect(-4.6, -20.4, 9.2, 2.4, 1.2), mix(c.base, "#FFFFFF", 0.15), B(-4.6, -20.4, 9.2, 2.4), { rim: 0.4, ao: 0 });
      shine(ctx, -6.4, -10.5, 2.6, 0.6);
    },
  },
  // 7 ★ bookshelf — arch top, token-coloured books, a jar of fireflies, a little lantern on top
  bookshelf: {
    x0: -15.5, x1: 15.5, top: -59, span: 1, colorways: ["cream", "sage", "rose"],
    draw(ctx, c) {
      fxContact(ctx, 2, 0, 17, 3, 0.45);
      const arch = (w: number, b: number, t: number): Path2D =>
        P((q) => {
          q.moveTo(-w, b);
          q.lineTo(-w, -40 + (14 - w) * 0.3);
          q.quadraticCurveTo(-w, t + 1, 0, t);
          q.quadraticCurveTo(w, t + 1, w, -40 + (14 - w) * 0.3);
          q.lineTo(w, b);
          q.closePath();
        });
      solid(ctx, arch(14, -2, -51), c.base, B(-14, -51, 28, 49), { rim: 1.2, lit: 0.3 });
      const inner = arch(11, -5, -48);
      ctx.fillStyle = mix(c.lo, T.plum, 0.35);
      ctx.fill(inner);
      ctx.save();
      ctx.clip(inner);
      const ig = ctx.createLinearGradient(-11, 0, 11, 0);
      ig.addColorStop(0, hexA(T.plum, 0.35));
      ig.addColorStop(0.4, hexA(T.plum, 0));
      ctx.fillStyle = ig;
      ctx.fillRect(-11, -48, 22, 44);
      ctx.restore();
      const cols = [T.coral, T.lilac, T.lemon, T.mint, "#9DBDE6", T.pink, "#F2C6A8"];
      [-37, -24, -11].forEach((sy, si) => {
        solid(ctx, rrect(-11, sy, 22, 2, 0.6), c.base, B(-11, sy, 22, 2), { rim: 0.4, ao: 0 });
        let bx = -10;
        const n = si === 1 ? 4 : si === 0 ? 5 : 6;
        for (let i = 0; i < n; i++) {
          const bw = 2.4 + ((i * 7 + si) % 3) * 0.6;
          const bh = si === 0 ? 6.2 + ((i * 5) % 2) * 0.8 : 8 + ((i * 5 + si) % 3) * 1.4;
          const lean = i === n - 1 && si === 2 ? 0.16 : 0;
          ctx.save();
          ctx.translate(bx + bw / 2, sy);
          ctx.rotate(lean);
          const col = cols[(i * 3 + si * 2) % cols.length]!;
          solid(ctx, rrect(-bw / 2, -bh, bw, bh, 0.6), col, B(-bw / 2, -bh, bw, bh), { rim: 0.35, ao: 0.1 });
          ctx.fillStyle = hexA("#FFFFFF", 0.45);
          ctx.fillRect(-bw / 2 + 0.4, -bh * 0.7, bw - 0.8, 0.7);
          ctx.restore();
          bx += bw + 0.5;
        }
        if (si === 1) {
          fxGlow(ctx, 6, sy - 4, 7, "#FFF2A8", 0.55);
          const jar = rrect(3.6, sy - 7.4, 5, 7.4, 1.6);
          ctx.fillStyle = hexA("#DDF0FF", 0.45);
          ctx.fill(jar);
          ctx.strokeStyle = hexA("#FFFFFF", 0.7);
          ctx.lineWidth = 0.5;
          ctx.stroke(jar);
          ctx.fillStyle = "#FFFBE0";
          for (const [dx, dy] of [[5, -3], [6.6, -5], [5.6, -6]] as const) {
            ctx.beginPath();
            ctx.arc(dx, sy + dy, 0.5, 0, 6.3);
            ctx.fill();
          }
        }
      });
      fxGlow(ctx, 0, -54, 8, T.glow, 0.45);
      miniLantern(ctx, 0, -54.5, 6, true);
      solid(ctx, rrect(-15, -3, 30, 3, 1.2), mix(c.base, T.plum, 0.12), B(-15, -3, 30, 3), { rim: 0.4 });
      shine(ctx, -12.5, -43, 3, 0.4);
    },
  },
  // 8 round rug — the rug layer: a braided oval seen from the front, two value bands, a soft fringe
  roundRug: {
    x0: -31, x1: 31, top: -12, span: 1, colorways: ["sage", "rose"],
    draw(ctx, c) {
      fxContact(ctx, 1.5, -4.6, 30, 6, 0.25);
      const rug = ellipseP(0, -5.6, 29, 5.6);
      solid(ctx, rug, c.base, B(-29, -11.2, 58, 11.2), { rim: 1.1, lit: 0.3, ao: 0.12, tex: "cloth" });
      ctx.save();
      ctx.clip(rug);
      for (const [rx, ry, col, a] of [[22, 4.2, c.hi, 0.55], [14, 2.7, c.lo, 0.45], [6, 1.2, c.accent, 0.7]] as const) {
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = hexA(col, a);
        ctx.beginPath();
        ctx.ellipse(0, -5.6, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      // fringe tufts at both ends (bands, ≥ 1 pt)
      ctx.lineCap = "round";
      ctx.strokeStyle = mix(c.hi, c.base, 0.3);
      ctx.lineWidth = 1;
      for (const sx of [-1, 1]) {
        for (let i = -2; i <= 2; i++) {
          const y = -5.6 + i * 1.6;
          ctx.beginPath();
          ctx.moveTo(sx * (29 - Math.abs(i) * 0.6), y);
          ctx.lineTo(sx * (31 - Math.abs(i) * 0.6), y + 0.2);
          ctx.stroke();
        }
      }
    },
  },
  // 9 wall clock — a round wooden clock on a band hanger, cream face, ink hands, a little pendulum box
  wallClock: {
    x0: -11, x1: 11, top: -36, span: 1, colorways: ["cream", "sage"],
    draw(ctx, c) {
      const hanger = P((q) => {
        q.arc(0, -30, 3.8, Math.PI * 1.05, Math.PI * 1.95);
        q.arc(0, -30, 2.4, Math.PI * 1.95, Math.PI * 1.05, true);
        q.closePath();
      });
      solid(ctx, hanger, WOOD.lo, B(-3.8, -33.8, 7.6, 3.8), { rim: 0.3, ao: 0 });
      // pendulum case (joined under the dial)
      const box = rrect(-5, -12, 10, 12, [1.5, 1.5, 4, 4]);
      solid(ctx, box, mix(c.base, WOOD.base, 0.35), B(-5, -12, 10, 12), { rim: 0.6, tex: "wood" });
      ctx.fillStyle = mix(c.lo, T.plum, 0.4);
      ctx.fill(rrect(-3, -10, 6, 8, [1, 1, 3, 3]));
      solid(ctx, ellipseP(0, -4.4, 1.8, 1.8), T.amber, B(-1.8, -6.2, 3.6, 3.6), { rim: 0.3, ao: 0 });
      ctx.fillStyle = T.amberLip;
      ctx.fillRect(-0.4, -10, 0.8, 4);
      const rim = ellipseP(0, -20, 10.5, 10.5);
      solid(ctx, rim, c.base, B(-10.5, -30.5, 21, 21), { rim: 1, lit: 0.34, tex: "wood" });
      const face = ellipseP(0, -20, 7.8, 7.8);
      solid(ctx, face, "#FFF6E4", B(-7.8, -27.8, 15.6, 15.6), { rim: 0.6, lit: 0.18, ao: 0.1 });
      ctx.fillStyle = T.ink;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const r = i % 3 ? 0.45 : 0.8;
        ctx.beginPath();
        ctx.arc(Math.sin(a) * 6.1, -20 - Math.cos(a) * 6.1, r, 0, 6.3);
        ctx.fill();
      }
      ctx.lineCap = "round";
      ctx.strokeStyle = T.ink;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.lineTo(0, -25.4);
      ctx.moveTo(0, -20);
      ctx.lineTo(3.4, -18.2);
      ctx.stroke();
      ctx.fillStyle = c.accent;
      ctx.beginPath();
      ctx.arc(0, -20, 0.9, 0, 6.3);
      ctx.fill();
      shine(ctx, -7, -25.5, 2.6, 0.5);
    },
  },
  // 10 picture frame — the village at dusk in a wooden frame, hung from a band cord
  frame: {
    x0: -13, x1: 13, top: -33, span: 1, colorways: ["cream", "rose"],
    draw(ctx, c) {
      const cord = P((q) => {
        q.moveTo(-6, -24);
        q.lineTo(0, -32.4);
        q.lineTo(6, -24);
        q.lineTo(4.6, -24);
        q.lineTo(0, -30.2);
        q.lineTo(-4.6, -24);
        q.closePath();
      });
      solid(ctx, cord, WOOD.lo, B(-6, -32.4, 12, 8.4), { rim: 0, ao: 0 });
      solid(ctx, ellipseP(0, -31.4, 1.3, 1.3), WOOD.hi, B(-1.3, -32.7, 2.6, 2.6), { rim: 0.2, ao: 0 });
      const fr = rrect(-12.5, -25, 25, 20, 2.4);
      solid(ctx, fr, c.base, B(-12.5, -25, 25, 20), { rim: 1, lit: 0.34, tex: "wood" });
      const pic = rrect(-9.4, -22, 18.8, 14, 1);
      ctx.save();
      ctx.clip(pic);
      const sky = ctx.createLinearGradient(0, -22, 0, -8);
      sky.addColorStop(0, "#3A3070");
      sky.addColorStop(0.6, "#B97A9A");
      sky.addColorStop(1, "#F4BFA0");
      ctx.fillStyle = sky;
      ctx.fillRect(-10, -23, 20, 16);
      ctx.fillStyle = "#F4EBD0";
      ctx.beginPath();
      ctx.arc(-5, -18, 1.8, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = T.hillMid;
      ctx.beginPath();
      ctx.moveTo(-10, -11);
      ctx.quadraticCurveTo(-3, -15.5, 3, -12.4);
      ctx.quadraticCurveTo(7, -10.6, 10, -12.6);
      ctx.lineTo(10, -7);
      ctx.lineTo(-10, -7);
      ctx.closePath();
      ctx.fill();
      // a tiny lantern-house on the hill (one world)
      ctx.fillStyle = "#FFE9C2";
      ctx.beginPath();
      ctx.ellipse(4, -12.4, 1.6, 1.8, 0, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = "#E58C9E";
      ctx.beginPath();
      ctx.moveTo(2, -13.8);
      ctx.quadraticCurveTo(4, -16, 6, -13.8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.lineWidth = lineW(ctx, 20);
      ctx.strokeStyle = mix(c.lo, T.ink, 0.5);
      ctx.stroke(pic);
      shine(ctx, -11, -23.4, 4, 0.45);
    },
  },
  // 11 teapot — a round pot, band handle, spout joined to the body, a lid with a knob
  teapot: {
    x0: -16, x1: 15, top: -22, span: 1, colorways: ["rose", "sage"],
    draw(ctx, c) {
      fxContact(ctx, 1, 0, 12, 2.4, 0.42);
      const handle = P((q) => {
        q.arc(9.6, -9.6, 5.4, -Math.PI * 0.55, Math.PI * 0.55);
        q.arc(9.6, -9.6, 3.6, Math.PI * 0.55, -Math.PI * 0.55, true);
        q.closePath();
      });
      solid(ctx, handle, c.lo, B(9.6, -15, 5.4, 10.8), { rim: 0.4, ao: 0 });
      const spout = P((q) => {
        q.moveTo(-8, -9);
        q.quadraticCurveTo(-11.6, -10, -13.6, -15.6);
        q.lineTo(-15.6, -16.4);
        q.lineTo(-15.2, -14.4);
        q.quadraticCurveTo(-13.6, -7.8, -8.4, -4.6);
        q.closePath();
      });
      solid(ctx, spout, c.base, B(-15.6, -16.4, 7.6, 11.8), { rim: 0.5, lit: 0.34 });
      const body = P((q) => {
        q.moveTo(-6, -15.4);
        q.lineTo(6, -15.4);
        q.bezierCurveTo(13, -14, 12.4, -1.6, 6.6, 0);
        q.lineTo(-6.6, 0);
        q.bezierCurveTo(-12.4, -1.6, -13, -14, -6, -15.4);
        q.closePath();
      });
      solid(ctx, body, c.base, B(-11.4, -15.4, 22.8, 15.4), { rim: 1.1, lit: 0.36 });
      // a painted band of dots (value shapes)
      ctx.fillStyle = hexA(c.hi, 0.8);
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(i * 2.8, -8 + Math.abs(i) * 0.15, 0.85, 0, 6.3);
        ctx.fill();
      }
      const lid = P((q) => {
        q.moveTo(-6.4, -15.2);
        q.quadraticCurveTo(0, -20, 6.4, -15.2);
        q.closePath();
      });
      solid(ctx, lid, mix(c.base, c.hi, 0.25), B(-6.4, -18.6, 12.8, 3.4), { rim: 0.5, ao: 0 });
      solid(ctx, ellipseP(0, -19.4, 1.8, 1.6), c.accent, B(-1.8, -21, 3.6, 3.2), { rim: 0.3, ao: 0 });
      shine(ctx, -8, -10.5, 2.6, 0.6);
    },
  },
  // ---------------------------------------------------------------- round 3 (owner: full village): the catalog's 12 → 24
  // 12 floor lamp — a tulip shade (the colourway) on a wooden pole and a round foot; its own warm pool
  floorLamp: {
    x0: -12, x1: 12, top: -56, span: 1, colorways: ["cream", "sage"],
    draw(ctx, c) {
      fxGlow(ctx, 0, -2, 18, T.glow, 0.26, 0.3);
      fxContact(ctx, 1, 0, 9, 2, 0.42);
      fxGlow(ctx, 0, -42, 22, T.glow, 0.45);
      solid(ctx, rrect(-1.2, -40, 2.4, 39, 1.2), WOOD.lo, B(-1.2, -40, 2.4, 39), { rim: 0.3, tex: "wood" });
      solid(ctx, ellipseP(0, -1.6, 7.5, 2.2), WOOD.base, B(-7.5, -3.8, 15, 4.4), { rim: 0.5, ao: 0 });
      const shade = P((q) => {
        q.moveTo(-10, -40);
        q.quadraticCurveTo(-12, -52, 0, -56);
        q.quadraticCurveTo(12, -52, 10, -40);
        q.quadraticCurveTo(0, -37, -10, -40);
        q.closePath();
      });
      const g = ctx.createRadialGradient(-2, -46, 1, 0, -45, 13);
      g.addColorStop(0, "#FFFBEA");
      g.addColorStop(1, mix(c.base, T.amber, 0.3));
      ctx.fillStyle = g;
      ctx.fill(shade);
      ctx.save();
      ctx.clip(shade);
      ctx.fillStyle = hexA(c.deep, 0.22);
      for (const x of [-5, 0, 5]) ctx.fillRect(x - 0.5, -57, 1, 18);
      ctx.restore();
      ctx.lineWidth = lineW(ctx, 20);
      ctx.strokeStyle = mix(c.lo, T.ink, 0.5);
      ctx.stroke(shade);
      solid(ctx, ellipseP(0, -40, 4.4, 1.4), "#FFE7A8", B(-4.4, -41.4, 8.8, 2.8), { rim: 0, ao: 0, line: false });
    },
  },
  // 13 candle stand — a glazed dish (the colourway) with three candles of different heights, lit
  candles: {
    x0: -13, x1: 13, top: -34, span: 1, colorways: ["cream", "rose"],
    draw(ctx, c) {
      fxGlow(ctx, 0, -2, 16, T.glow, 0.24, 0.3);
      fxContact(ctx, 1, 0, 11, 2.2, 0.42);
      for (const [x, h] of [[-6, 16], [0, 22], [6, 12]] as const) {
        fxGlow(ctx, x, -6 - h - 4, 9, T.glow, 0.45);
        solid(ctx, rrect(x - 2.2, -6 - h, 4.4, h, 1.6), "#FFF6E4", B(x - 2.2, -6 - h, 4.4, h), { rim: 0.5, lit: 0.36, ao: 0.1, tex: "paper" });
        ctx.fillStyle = hexA("#E9D8B8", 0.9);
        ctx.fillRect(x - 0.4, -7 - h, 0.8, 1.4);
        const f = P((q) => {
          q.moveTo(x, -6 - h - 7);
          q.quadraticCurveTo(x + 2.2, -6 - h - 3, x, -6 - h - 1.2);
          q.quadraticCurveTo(x - 2.2, -6 - h - 3, x, -6 - h - 7);
          q.closePath();
        });
        const g = ctx.createLinearGradient(0, -6 - h - 1, 0, -6 - h - 7);
        g.addColorStop(0, "#FF9A3C");
        g.addColorStop(1, "#FFE7A0");
        ctx.fillStyle = g;
        ctx.fill(f);
      }
      const dish = P((q) => {
        q.moveTo(-12, -7);
        q.lineTo(12, -7);
        q.quadraticCurveTo(10, 0, 0, 0);
        q.quadraticCurveTo(-10, 0, -12, -7);
        q.closePath();
      });
      solid(ctx, dish, c.base, B(-12, -7, 24, 7), { rim: 0.8, lit: 0.36 });
      solid(ctx, rrect(-12.8, -8.4, 25.6, 2.4, 1.2), mix(c.base, "#FFFFFF", 0.15), B(-12.8, -8.4, 25.6, 2.4), { rim: 0.3, ao: 0 });
    },
  },
  // 14 string lights (wall) — a cord swag between two nails with five paper bulbs, each its own glow
  stringLights: {
    x0: -22, x1: 22, top: -22, span: 1, colorways: ["cream", "rose"],
    draw(ctx, c, cw) {
      const cols = cw === "rose" ? ["#F6A7B8", "#FFD0DA", "#F2907A", "#FFD0DA", "#F6A7B8"] : ["#FFE59A", "#FFF3DE", "#FFC864", "#FFF3DE", "#FFE59A"];
      for (const x of [-20, 20]) solid(ctx, ellipseP(x, -20, 1.8, 1.8), WOOD.lo, B(x - 1.8, -21.8, 3.6, 3.6), { rim: 0.2, ao: 0 });
      ctx.strokeStyle = hexA("#3B2C45", 0.85);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(-20, -20);
      ctx.quadraticCurveTo(0, -4, 20, -20);
      ctx.stroke();
      for (let i = 0; i < 5; i++) {
        const t = (i + 0.5) / 5;
        const x = (1 - t) * (1 - t) * -20 + 2 * (1 - t) * t * 0 + t * t * 20;
        const y = (1 - t) * (1 - t) * -20 + 2 * (1 - t) * t * -4 + t * t * -20;
        fxGlow(ctx, x, y + 5, 7, cols[i]!, 0.5);
        ctx.fillStyle = "#3B2C45";
        ctx.fillRect(x - 0.9, y - 0.4, 1.8, 2);
        solid(ctx, rrect(x - 2.6, y + 1.4, 5.2, 6.4, 2.6), cols[i]!, B(x - 2.6, y + 1.4, 5.2, 6.4), { rim: 0.5, lit: 0.42, ao: 0 });
      }
      void c;
    },
  },
  // 15 rocking chair — spindle back under an arched top rail, a seat cushion (the colourway), arms,
  // and the curved rockers that make it a rocking chair (they reach past the legs both ways)
  rockingChair: {
    x0: -20, x1: 20, top: -44, span: 1, colorways: ["cream", "sage", "rose"],
    draw(ctx, c) {
      fxContact(ctx, 1.5, 0, 19, 3, 0.42);
      const rocker = P((q) => {
        q.moveTo(-20, -3.4);
        q.quadraticCurveTo(0, 3.4, 20, -3.4);
        q.quadraticCurveTo(20.6, -1.6, 19.4, -0.8);
        q.quadraticCurveTo(0, 5.6, -19.4, -0.8);
        q.quadraticCurveTo(-20.6, -1.6, -20, -3.4);
        q.closePath();
      });
      solid(ctx, rocker, WOOD.lo, B(-20.6, -3.4, 41.2, 9), { rim: 0.4, tex: "wood" });
      for (const x of [-11, 9]) solid(ctx, rrect(x, -16, 2.6, 15, 1), WOOD.base, B(x, -16, 2.6, 15), { rim: 0.4, tex: "wood" });
      for (const x of [-12.5, 10]) solid(ctx, rrect(x, -42, 2.6, 27, 1.2), WOOD.lo, B(x, -42, 2.6, 27), { rim: 0.4, tex: "wood" });
      const rail = P((q) => {
        q.moveTo(-13.5, -38);
        q.quadraticCurveTo(0, -48, 13.5, -38);
        q.lineTo(13.5, -35);
        q.quadraticCurveTo(0, -44, -13.5, -35);
        q.closePath();
      });
      solid(ctx, rail, WOOD.base, B(-13.5, -44, 27, 9), { rim: 0.5, tex: "wood" });
      for (const x of [-6, -1, 4]) solid(ctx, rrect(x, -39, 2, 22, 1), WOOD.base, B(x, -39, 2, 22), { rim: 0.3, ao: 0 });
      solid(ctx, rrect(-14, -20, 28, 6, 3), c.base, B(-14, -20, 28, 6), { rim: 1, lit: 0.34, tex: "cloth" });
      stitch(ctx, P((q) => q.roundRect(-11.5, -18.6, 23, 3, 1.5)), c.hi);
      for (const sx of [-1, 1] as const) solid(ctx, rrect(sx < 0 ? -16 : 11, -28, 5, 2.4, 1.2), WOOD.base, B(sx < 0 ? -16 : 11, -28, 5, 2.4), { rim: 0.3, ao: 0 });
      shine(ctx, -10, -40, 4, 0.4);
    },
  },
  // 16 round table — a wide round top (front projection) on a turned pedestal and a cross foot, a cup
  roundTable: {
    x0: -19, x1: 19, top: -27, span: 1, colorways: ["cream", "sage"],
    draw(ctx, c) {
      fxContact(ctx, 1.5, 0, 17, 2.8, 0.42);
      solid(ctx, rrect(-11, -2.6, 22, 2.6, 1.2), WOOD.lo, B(-11, -2.6, 22, 2.6), { rim: 0.3, ao: 0 });
      const ped = P((q) => {
        q.moveTo(-2.4, -2);
        q.quadraticCurveTo(-5, -8, -2, -12);
        q.quadraticCurveTo(-4, -16, -2, -19);
        q.lineTo(2, -19);
        q.quadraticCurveTo(4, -16, 2, -12);
        q.quadraticCurveTo(5, -8, 2.4, -2);
        q.closePath();
      });
      solid(ctx, ped, WOOD.base, B(-5, -19, 10, 17), { rim: 0.5, tex: "wood" });
      const top = c.base === CW.cream.base ? { base: "#F2DBB2", lo: "#C99F74" } : { base: c.base, lo: c.lo };
      solid(ctx, rrect(-19, -21, 38, 3, 1.5), mix(top.base, top.lo, 0.35), B(-19, -21, 38, 3), { rim: 0.4, ao: 0 });
      solid(ctx, P((q) => q.ellipse(0, -21.5, 19, 3, 0, 0, Math.PI * 2)), top.base, B(-19, -24.5, 38, 6), { rim: 0.8, lit: 0.38, ao: 0, tex: "wood", texA: 0.12 });
      fxContact(ctx, 6, -21.6, 4, 0.8, 0.4);
      const cup = P((q) => {
        q.moveTo(3.4, -26.6);
        q.lineTo(8.6, -26.6);
        q.quadraticCurveTo(8.4, -22, 6, -22);
        q.quadraticCurveTo(3.6, -22, 3.4, -26.6);
        q.closePath();
      });
      solid(ctx, cup, "#FFF6E8", B(3.4, -26.6, 5.2, 4.6), { rim: 0.3, ao: 0.14 });
    },
  },
  // 17 cactus — a round cactus with two arms in a glazed pot (the colourway), a small pink bloom on top
  cactus: {
    x0: -12, x1: 12, top: -34, span: 1, colorways: ["sage", "rose"],
    draw(ctx, c) {
      fxContact(ctx, 1, 0, 9, 2.2, 0.42);
      const green = "#6FA287";
      for (const sx of [-1, 1] as const) {
        const arm = P((q) => {
          q.moveTo(sx * 4, -18);
          q.quadraticCurveTo(sx * 10, -18, sx * 10, -24);
          q.lineTo(sx * 10, -27);
          q.quadraticCurveTo(sx * 10, -30, sx * 7.5, -30);
          q.quadraticCurveTo(sx * 5, -30, sx * 5, -27);
          q.lineTo(sx * 5, -24);
          q.quadraticCurveTo(sx * 5, -22, sx * 3, -22);
          q.closePath();
        });
        solid(ctx, arm, mix(green, "#4F8466", sx > 0 ? 0.4 : 0), B(Math.min(sx * 3, sx * 10), -30, 7, 12), { rim: 0.6, lit: 0.36, ao: 0 });
      }
      const body = P((q) => q.roundRect(-5.5, -31, 11, 22, 5.5));
      solid(ctx, body, green, B(-5.5, -31, 11, 22), { rim: 0.9, lit: 0.38, ao: 0.1 });
      ctx.save();
      ctx.clip(body);
      ctx.fillStyle = hexA("#2E5442", 0.3);
      for (const x of [-2.6, 0.6, 3.4]) ctx.fillRect(x - 0.5, -31, 1, 22);
      ctx.restore();
      ctx.fillStyle = hexA("#FFFFFF", 0.7);
      for (const [x, y] of [[-3, -26], [2, -22], [-1, -17], [3, -14], [-3, -12]] as const) ctx.fillRect(x, y, 0.8, 0.8);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        solid(ctx, ellipseP(Math.cos(a) * 1.6, -32 + Math.sin(a) * 1.4, 1.5, 1.1), T.pink, B(-3, -34, 6, 4), { rim: 0, ao: 0, line: false });
      }
      const pot = P((q) => {
        q.moveTo(-8, -10);
        q.lineTo(8, -10);
        q.lineTo(6.4, 0);
        q.lineTo(-6.4, 0);
        q.closePath();
      });
      solid(ctx, pot, c.base, B(-8, -10, 16, 10), { rim: 0.9, lit: 0.36 });
      solid(ctx, rrect(-9, -12, 18, 3, 1.4), mix(c.base, "#FFFFFF", 0.14), B(-9, -12, 18, 3), { rim: 0.4, ao: 0 });
      ctx.fillStyle = "#4A3A52";
      ctx.beginPath();
      ctx.ellipse(0, -11.4, 7.2, 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      shine(ctx, -6, -7, 2.2, 0.55);
    },
  },
  // 18 hanging plant — a round pot on three cords (band shapes) meeting at a ring; trailing leaves (wall slot)
  hangingPlant: {
    x0: -14, x1: 14, top: -38, span: 1, colorways: ["sage", "cream"],
    draw(ctx, c) {
      solid(ctx, ellipseP(0, -36, 2, 2), WOOD.lo, B(-2, -38, 4, 4), { rim: 0.2, ao: 0 });
      ctx.fillStyle = mix(WOOD.base, T.ink, 0.2);
      for (const x of [-8, 0, 8]) {
        ctx.beginPath();
        ctx.moveTo(-0.5, -35);
        ctx.lineTo(0.5, -35);
        ctx.lineTo(x + 0.6, -20);
        ctx.lineTo(x - 0.6, -20);
        ctx.closePath();
        ctx.fill();
      }
      // trailing vines first (behind the pot's rim): a stem each with pointed leaves alternating left / right
      // (self-check: round dot chains read as grapes — leaves are long, pointed and tilted off the stem)
      for (const [x, n, bend] of [[-6.5, 4, -1], [0, 5, 0.6], [6.5, 3, 1]] as const) {
        ctx.strokeStyle = "#4F8466";
        ctx.lineWidth = 0.9;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x, -13);
        ctx.quadraticCurveTo(x + bend * 2, -13 + n * 2.4, x + bend, -13 + n * 4.4);
        ctx.stroke();
        for (let i = 0; i < n; i++) {
          const sd = i % 2 ? 1 : -1;
          ctx.save();
          ctx.translate(x + bend * (i / n) * 1.6 + sd * 1.2, -11 + i * 4.2);
          ctx.rotate(sd * 0.9);
          const lf = P((q) => {
            q.moveTo(0, -3.4);
            q.quadraticCurveTo(1.9, -0.6, 0, 2.6);
            q.quadraticCurveTo(-1.9, -0.6, 0, -3.4);
            q.closePath();
          });
          solid(ctx, lf, i % 2 ? "#5E9474" : "#6BA683", B(-1.9, -3.4, 3.8, 6), { rim: 0.4, lit: 0.36, ao: 0 });
          ctx.restore();
        }
      }
      const pot = P((q) => {
        q.moveTo(-9, -21);
        q.lineTo(9, -21);
        q.quadraticCurveTo(8.6, -12, 0, -11);
        q.quadraticCurveTo(-8.6, -12, -9, -21);
        q.closePath();
      });
      solid(ctx, pot, c.base, B(-9, -21, 18, 10), { rim: 0.8, lit: 0.36 });
      for (const [a, l] of [[-0.6, 6], [0.1, 7], [0.7, 6]] as const) {
        ctx.save();
        ctx.translate(0, -21);
        ctx.rotate(a);
        solid(ctx, ellipseP(0, -l / 2 - 1, 2.2, l / 2 + 0.6), "#6BA683", B(-2.2, -l - 1.6, 4.4, l + 1.2), { rim: 0.4, lit: 0.36, ao: 0 });
        ctx.restore();
      }
    },
  },
  // 19 dresser — a chest of three drawers (the colourway) with round knobs, turned feet, a vase on top
  dresser: {
    x0: -17, x1: 17, top: -44, span: 1, colorways: ["cream", "sage", "rose"],
    draw(ctx, c) {
      fxContact(ctx, 1.5, 0, 17, 3, 0.44);
      for (const x of [-14, 11]) solid(ctx, rrect(x, -4, 3, 4, 1.2), WOOD.lo, B(x, -4, 3, 4), { rim: 0.3, ao: 0 });
      const body = rrect(-16, -34, 32, 30, 3);
      solid(ctx, body, c.base, B(-16, -34, 32, 30), { rim: 1.2, lit: 0.3, tex: "wood", texA: 0.14 });
      for (let i = 0; i < 3; i++) {
        const y = -31 + i * 9;
        solid(ctx, rrect(-13, y, 26, 7.4, 1.6), mix(c.base, c.hi, 0.3), B(-13, y, 26, 7.4), { rim: 0.6, lit: 0.3, ao: 0.1 });
        solid(ctx, ellipseP(0, y + 3.7, 1.5, 1.5), c.accent, B(-1.5, y + 2.2, 3, 3), { rim: 0.2, ao: 0 });
      }
      solid(ctx, rrect(-17.5, -36, 35, 3.2, 1.4), mix(c.base, WOOD.base, 0.35), B(-17.5, -36, 35, 3.2), { rim: 0.6, tex: "wood" });
      // a bud vase on top
      const v = P((q) => {
        q.moveTo(7, -36);
        q.quadraticCurveTo(4.4, -39, 6.2, -41);
        q.lineTo(7.8, -41);
        q.quadraticCurveTo(9.6, -39, 7, -36);
        q.closePath();
      });
      solid(ctx, v, T.lilac, B(4.4, -41, 5.2, 5), { rim: 0.3, ao: 0 });
      ctx.strokeStyle = "#4F8466";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(7, -41);
      ctx.lineTo(7.6, -43.4);
      ctx.stroke();
      solid(ctx, ellipseP(7.6, -43.4, 1.4, 1.2), T.pink, B(6.2, -44.6, 2.8, 2.4), { rim: 0, ao: 0, line: false });
      shine(ctx, -13, -32.6, 5, 0.45);
    },
  },
  // 20 striped rug (rug layer) — a woven slab in front projection: broad colourway stripes, fringed ends
  stripedRug: {
    x0: -32, x1: 32, top: -10, span: 1, colorways: ["sage", "rose"],
    draw(ctx, c) {
      fxContact(ctx, 1.5, -3.6, 31, 5, 0.22);
      const rug = P((q) => {
        q.moveTo(-26, -9);
        q.lineTo(26, -9);
        q.lineTo(30, -1);
        q.lineTo(-30, -1);
        q.closePath();
      });
      solid(ctx, rug, mix(c.hi, "#FFF3DE", 0.4), B(-30, -9, 60, 8), { rim: 1, lit: 0.3, ao: 0.1, tex: "cloth" });
      ctx.save();
      ctx.clip(rug);
      for (const [x, col] of [[-22, c.base], [-10, c.lo], [2, c.base], [14, c.accent]] as const) {
        ctx.fillStyle = hexA(col, 0.85);
        ctx.beginPath();
        ctx.moveTo(x, -9);
        ctx.lineTo(x + 6, -9);
        ctx.lineTo(x + 6 + (x + 3) * 0.08, -1);
        ctx.lineTo(x + (x + 3) * 0.08, -1);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = mix(c.hi, "#FFF3DE", 0.5);
      for (const sx of [-1, 1] as const) for (let i = 0; i < 4; i++) ctx.fillRect(sx < 0 ? -30.4 - (3 - i) * 0.6 : 28.4 + (3 - i) * 0.6, -8.4 + i * 2, 2, 1);
    },
  },
  // 21 wreath (wall) — a ring of leaves with berries and a bow (the colourway), hung on a nail
  wreath: {
    x0: -15, x1: 15, top: -34, span: 1, colorways: ["sage", "rose"],
    draw(ctx, c) {
      solid(ctx, ellipseP(0, -32.4, 1.6, 1.6), WOOD.lo, B(-1.6, -34, 3.2, 3.2), { rim: 0.2, ao: 0 });
      const cx = 0;
      const cy = -16;
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        ctx.save();
        ctx.translate(cx + Math.cos(a) * 10.5, cy + Math.sin(a) * 10.5);
        ctx.rotate(a + Math.PI / 2 + 0.5);
        solid(ctx, ellipseP(0, 0, 4.2, 2.2), i % 2 ? "#5E9474" : "#4F8466", B(-4.2, -2.2, 8.4, 4.4), { rim: 0.5, lit: 0.36, ao: 0 });
        ctx.restore();
      }
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + 0.3;
        solid(ctx, ellipseP(cx + Math.cos(a) * 11.5, cy + Math.sin(a) * 11.5, 1.4, 1.4), T.coral, B(cx - 13, cy - 13, 26, 26), { rim: 0.3, lit: 0.4, ao: 0 });
      }
      // the bow (two loops + tails) at the bottom, in the colourway
      for (const sx of [-1, 1] as const) {
        const loop = P((q) => {
          q.moveTo(0, -5);
          q.bezierCurveTo(sx * 3, -9.6, sx * 8.4, -8.4, sx * 7, -4.2);
          q.bezierCurveTo(sx * 6, -2.2, sx * 2.6, -3.6, 0, -5);
          q.closePath();
        });
        solid(ctx, loop, c.base, B(sx < 0 ? -8.4 : 0, -9.6, 8.4, 7.4), { rim: 0.5, lit: 0.38, ao: 0 });
        const tail = P((q) => {
          q.moveTo(sx * 0.6, -4.6);
          q.lineTo(sx * 4.4, 1);
          q.lineTo(sx * 2.6, 1.6);
          q.lineTo(sx * -0.2, -3.6);
          q.closePath();
        });
        solid(ctx, tail, mix(c.base, T.plum, 0.12), B(sx < 0 ? -4.4 : -0.2, -4.6, 4.6, 6.2), { rim: 0.3, ao: 0 });
      }
      solid(ctx, ellipseP(0, -5, 1.6, 1.4), mix(c.base, "#FFFFFF", 0.15), B(-1.6, -6.4, 3.2, 2.8), { rim: 0.2, ao: 0 });
    },
  },
  // 22 knitting basket (Kuri's) — a woven basket (value-band weave), two yarn balls, crossed needles
  knitBasket: {
    x0: -12, x1: 12, top: -24, span: 1, colorways: ["rose", "cream"],
    draw(ctx, c) {
      fxContact(ctx, 1, 0, 11, 2.2, 0.42);
      // needles behind the yarn (band shapes with round heads)
      for (const [a, x] of [[-0.45, -2], [0.4, 3]] as const) {
        ctx.save();
        ctx.translate(x, -12);
        ctx.rotate(a);
        solid(ctx, rrect(-0.8, -12, 1.6, 12, 0.8), WOOD.hi, B(-0.8, -12, 1.6, 12), { rim: 0.2, ao: 0 });
        solid(ctx, ellipseP(0, -12, 1.5, 1.5), c.accent, B(-1.5, -13.5, 3, 3), { rim: 0.2, ao: 0 });
        ctx.restore();
      }
      for (const [x, y, r, col] of [[-4, -12.5, 4.6, c.base], [4, -11.5, 4, T.lemon]] as const) {
        const ball = ellipseP(x, y, r, r);
        solid(ctx, ball, col, B(x - r, y - r, r * 2, r * 2), { rim: 0.8, lit: 0.38, tex: "cloth" });
        ctx.save();
        ctx.clip(ball);
        ctx.strokeStyle = hexA(mix(col, T.plum, 0.4), 0.45);
        ctx.lineWidth = 0.8;
        for (const k of [-0.5, 0, 0.5]) {
          ctx.beginPath();
          ctx.ellipse(x, y, r * 0.95, r * 0.4, 0.7 + k, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
      const bask = P((q) => {
        q.moveTo(-11, -10);
        q.lineTo(11, -10);
        q.lineTo(9, 0);
        q.lineTo(-9, 0);
        q.closePath();
      });
      solid(ctx, bask, "#C99A6A", B(-11, -10, 22, 10), { rim: 0.9, lit: 0.34, tex: "wood" });
      ctx.save();
      ctx.clip(bask);
      ctx.fillStyle = hexA(T.woodLo, 0.32);
      for (let r = 0; r < 3; r++) for (let i = -6; i < 6; i++) ctx.fillRect(i * 2 + (r % 2), -9 + r * 3.2, 1, 2.2);
      ctx.restore();
      solid(ctx, rrect(-11.6, -11.4, 23.2, 2.6, 1.2), "#B07F52", B(-11.6, -11.4, 23.2, 2.6), { rim: 0.4, ao: 0 });
    },
  },
  // 23 snow globe (Yuki's) — a glass dome over a tiny lantern-house and snow, on a wooden base
  snowGlobe: {
    x0: -10, x1: 10, top: -25, span: 1, colorways: ["cream", "sage"],
    draw(ctx, c) {
      fxContact(ctx, 1, 0, 9, 2, 0.42);
      const base = P((q) => {
        q.moveTo(-8.5, -6);
        q.lineTo(8.5, -6);
        q.lineTo(7, 0);
        q.lineTo(-7, 0);
        q.closePath();
      });
      solid(ctx, base, c.base === CW.cream.base ? WOOD.base : c.lo, B(-8.5, -6, 17, 6), { rim: 0.6, tex: "wood" });
      const dome = P((q) => q.arc(0, -14.5, 9, 0, Math.PI * 2));
      ctx.save();
      ctx.clip(dome);
      const g = ctx.createLinearGradient(0, -24, 0, -6);
      g.addColorStop(0, "#3A3D78");
      g.addColorStop(1, "#7A86C0");
      ctx.fillStyle = g;
      ctx.fillRect(-9, -24, 18, 18);
      ctx.fillStyle = "#EEF3FB";
      ctx.beginPath();
      ctx.ellipse(0, -8, 9, 3.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#FFE9C2";
      ctx.beginPath();
      ctx.ellipse(0, -12, 2.8, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#7FA3CF";
      ctx.beginPath();
      ctx.moveTo(-3.6, -14);
      ctx.quadraticCurveTo(0, -18.4, 3.6, -14);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      for (const [x, y] of [[-5, -19], [4, -21], [-2, -17], [6, -15], [-6, -13], [1, -22]] as const) {
        ctx.beginPath();
        ctx.arc(x, y, 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      // the glass: a key-lit gradient from the upper left + a darker rim (no hairline highlight)
      ctx.save();
      ctx.clip(dome);
      const gl = ctx.createLinearGradient(-9, -24, 6, -8);
      gl.addColorStop(0, hexA("#FFFFFF", 0.4));
      gl.addColorStop(0.45, hexA("#FFFFFF", 0));
      ctx.fillStyle = gl;
      ctx.fillRect(-9, -24, 18, 18);
      ctx.restore();
      ctx.lineWidth = lineW(ctx, 20);
      ctx.strokeStyle = hexA("#3B2C45", 0.55);
      ctx.stroke(dome);
    },
  },
};

/** Catalog order (= sync bit index, src/village/catalog.ts §3). */
export const FURNITURE_IDS: readonly ItemId[] = [
  "paperLantern", "archChair", "cushion", "teaTable", "smallBed", "smallPot",
  "flowerVase", "bookshelf", "roundRug", "wallClock", "frame", "teapot",
  "floorLamp", "candles", "stringLights", "rockingChair", "roundTable", "cactus",
  "hangingPlant", "dresser", "stripedRug", "wreath", "knitBasket", "snowGlobe",
];

/** Units per slot: a room slot is 40 units wide and 60 tall (the tallest item is the bookshelf, 59). */
export const SLOT_UNITS = { w: 40, h: 60 } as const;

/**
 * Scale (px per unit) for an item in a box: the room's common scale (box = span slots), shrunk if the
 * drawing would cross the box (catalog cards never clip, Reality #9).
 */
export function furnitureScale(id: ItemId, w: number, h: number, mode: "room" | "card" = "room"): number {
  const it = ITEMS[id];
  const fit = Math.min(w / (it.x1 - it.x0) / 1.02, h / -it.top / 1.02);
  if (mode === "card") return fit * 0.92;
  // the rug layer is sized by its width (it lies flat); wall pieces hang 1.6 × (they are seen across the room)
  if (id === "roundRug" || id === "stripedRug") return w / (it.x1 - it.x0) / 1.02;
  // v15 (Reality G1 re-review 2 #1): the room's pieces are 1.45 × their slot's share so the floor reads lived-in
  // (a mid piece ≈ 16 % of the room's width); they may overhang their slot box (≤ 1.6 × its fit) — the room
  // draws them back row first, so the overlap reads as depth
  const common = Math.min(w / (SLOT_UNITS.w * it.span), h / SLOT_UNITS.h) * (WALL.has(id) ? 1.6 : ROOM_K);
  return Math.min(common, fit * 1.6);
}
/** how much bigger than its slot's share a floor piece is drawn in the room */
export const ROOM_K = 1.55;
const WALL: ReadonlySet<ItemId> = new Set<ItemId>(["wallClock", "frame", "stringLights", "hangingPlant", "wreath"]);

/** Draw an item with its floor point at (x, y), s px per unit. silhouette = locked card (the shape only). */
export function drawFurnitureAt(ctx: Ctx, id: ItemId, cw: Colorway, x: number, y: number, s: number, mono = false): void {
  const it = ITEMS[id];
  const use = it.colorways.includes(cw) ? cw : it.colorways[0]!;
  ctx.save();
  ctx.translate(x - ((it.x0 + it.x1) / 2) * s, y);
  ctx.scale(s, s);
  silhouette = mono;
  try {
    it.draw(ctx, CW[use], use);
  } finally {
    silhouette = false;
    ctx.restore();
  }
}
