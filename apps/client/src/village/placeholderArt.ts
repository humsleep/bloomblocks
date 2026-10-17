// Stand-in drawings behind the art interface (art.ts) until the kit (src/render/village) exports
// them: plain shapes in the palette, one silhouette per category, so the scene, its hit areas and
// the tests work without the final art. Pure Canvas2D, deterministic.
import type { Colorway, ItemId, ResidentId } from "./catalog.ts";
import { itemById } from "./catalog.ts";
import type { Expression, HouseSpec, PaintBox, VillageArt } from "./art.ts";

const CW: Record<Colorway, string> = { cream: "#F1E4C8", sage: "#A9C7A0", rose: "#E9A9B4" };
const RES: Record<ResidentId, string> = { wick: "#FFC864", momo: "#F4A7B9", sage: "#9FD3A8", luna: "#C7B8F0", pip: "#FFE08A", kuri: "#E8A87C", yuki: "#A9D4E8" };
const INK = "#3B2C45";
const LOCK = "#7D7590";

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
}

function shadow(g: CanvasRenderingContext2D, cx: number, by: number, rx: number): void {
  g.fillStyle = "rgba(20,15,44,0.35)";
  g.beginPath();
  g.ellipse(cx, by, rx, rx * 0.22, 0, 0, Math.PI * 2);
  g.fill();
}

export const placeholderArt: VillageArt = {
  drawVillageBackdrop(g, at) {
    g.save();
    const sky = g.createLinearGradient(0, at.y, 0, at.y + at.h);
    sky.addColorStop(0, "#2B2552");
    sky.addColorStop(0.32, "#7C5A86");
    sky.addColorStop(0.42, "#E8A27C");
    sky.addColorStop(0.43, "#3C4A6B");
    sky.addColorStop(1, "#23304D");
    g.fillStyle = sky;
    g.fillRect(at.x, at.y, at.w, at.h);
    // a path of stepping stones
    g.fillStyle = "rgba(244,235,208,0.12)";
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      g.beginPath();
      g.ellipse(at.x + at.w * (0.2 + 0.6 * t), at.y + at.h * (0.62 + 0.3 * Math.sin(t * 3)), at.w * 0.035, at.w * 0.014, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  },

  drawLanternHouse(g, spec: HouseSpec, at) {
    g.save();
    const cx = at.x + at.w / 2;
    const by = at.y + at.h;
    const w = at.w * 0.78;
    const h = at.h * 0.62;
    shadow(g, cx, by, w * 0.55);
    const body = spec.resident === "cottage" ? "#E8C9A0" : spec.lit ? "#F6D9A2" : "#4A4466";
    if (spec.lit) {
      const glow = g.createRadialGradient(cx, by - h * 0.5, 0, cx, by - h * 0.5, w);
      glow.addColorStop(0, "rgba(255,200,100,0.45)");
      glow.addColorStop(1, "rgba(255,200,100,0)");
      g.fillStyle = glow;
      g.fillRect(at.x, at.y, at.w, at.h);
    }
    rr(g, cx - w / 2, by - h, w, h, w * 0.3);
    g.fillStyle = body;
    g.fill();
    g.lineWidth = Math.max(1, at.w * 0.02);
    g.strokeStyle = INK;
    g.stroke();
    // lid roof in the resident's colour
    const lid = spec.resident && spec.resident !== "cottage" ? RES[spec.resident] : spec.resident === "cottage" ? "#C98F5A" : "#3A3552";
    rr(g, cx - w * 0.56, by - h - at.h * 0.12, w * 1.12, at.h * 0.14, at.h * 0.06);
    g.fillStyle = lid;
    g.fill();
    g.stroke();
    // door + window
    rr(g, cx - w * 0.14, by - h * 0.42, w * 0.28, h * 0.42, w * 0.14);
    g.fillStyle = spec.lit ? "#8A5A3C" : "#2E2944";
    g.fill();
    g.beginPath();
    g.arc(cx, by - h * 0.68, w * 0.13, 0, Math.PI * 2);
    g.fillStyle = spec.lit ? "#FFE3A3" : spec.eve ? "#5A4E7A" : "#2E2944";
    g.fill();
    if (spec.eve) {
      g.fillStyle = "#1C1630";
      g.beginPath();
      g.arc(cx, by - h * 0.66, w * 0.07, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#FFC864";
      g.beginPath();
      g.arc(cx, by - h * 0.75, w * 0.025, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  },

  drawResident(g, id, expr: Expression, at) {
    g.save();
    const cx = at.x + at.w / 2;
    const by = at.y + at.h;
    const r = Math.min(at.w, at.h) * 0.3;
    shadow(g, cx, by, r);
    const col = expr === "silhouette" ? "#1C1630" : RES[id];
    // body (a small lantern) + flame
    rr(g, cx - r, by - r * 2.1, r * 2, r * 2, r * 0.9);
    g.fillStyle = col;
    g.fill();
    g.beginPath();
    g.moveTo(cx, by - r * 3.1);
    g.quadraticCurveTo(cx + r * 0.45, by - r * 2.4, cx, by - r * 2.1);
    g.quadraticCurveTo(cx - r * 0.45, by - r * 2.4, cx, by - r * 3.1);
    g.fillStyle = expr === "silhouette" ? "#FFC864" : "#FFB347";
    g.fill();
    if (expr !== "silhouette") {
      g.fillStyle = INK;
      const ey = by - r * 1.2;
      if (expr === "sleepy") {
        g.fillRect(cx - r * 0.5, ey, r * 0.3, r * 0.08);
        g.fillRect(cx + r * 0.2, ey, r * 0.3, r * 0.08);
      } else {
        g.beginPath();
        g.arc(cx - r * 0.35, ey, r * 0.12, 0, Math.PI * 2);
        g.arc(cx + r * 0.35, ey, r * 0.12, 0, Math.PI * 2);
        g.fill();
      }
      if (expr === "happy" || expr === "talk") {
        g.beginPath();
        g.arc(cx, by - r * 0.95, r * (expr === "talk" ? 0.16 : 0.22), 0, Math.PI);
        g.fill();
      }
      if (expr === "shy" || id === "momo") {
        g.fillStyle = "rgba(233,120,140,0.5)";
        g.beginPath();
        g.arc(cx - r * 0.62, by - r * 0.95, r * 0.15, 0, Math.PI * 2);
        g.arc(cx + r * 0.62, by - r * 0.95, r * 0.15, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.restore();
  },

  drawFurniture(g, itemId: ItemId, colorway: Colorway, at: PaintBox, opts) {
    const item = itemById(itemId);
    if (!item) return;
    g.save();
    const locked = !!opts?.locked;
    const fill = locked ? LOCK : CW[item.colorways.includes(colorway) ? colorway : item.colorways[0]!];
    const line = locked ? "#5E5772" : INK;
    const cx = at.x + at.w / 2;
    const by = at.y + at.h;
    const s = Math.min(at.w / (item.span === 2 ? 2 : 1), at.h);
    g.lineWidth = Math.max(1, s * 0.03);
    g.strokeStyle = line;
    g.fillStyle = fill;
    if (item.layer !== "wall" && item.layer !== "rug") shadow(g, cx, by, at.w * 0.36);
    const shape = (x: number, y: number, w: number, h: number, r: number): void => {
      rr(g, x, y, w, h, r);
      g.fill();
      g.stroke();
    };
    switch (item.cat) {
      case "lighting":
        shape(cx - s * 0.18, by - s * 0.72, s * 0.36, s * 0.5, s * 0.16);
        shape(cx - s * 0.04, by - s * 0.22, s * 0.08, s * 0.22, s * 0.02);
        break;
      case "seating":
        if (itemId === "cushion") shape(cx - s * 0.32, by - s * 0.22, s * 0.64, s * 0.22, s * 0.11);
        else {
          shape(cx - s * 0.22, by - s * 0.78, s * 0.44, s * 0.44, s * 0.22);
          shape(cx - s * 0.28, by - s * 0.38, s * 0.56, s * 0.14, s * 0.05);
          shape(cx - s * 0.24, by - s * 0.26, s * 0.06, s * 0.26, s * 0.02);
          shape(cx + s * 0.18, by - s * 0.26, s * 0.06, s * 0.26, s * 0.02);
        }
        break;
      case "table":
        shape(cx - s * 0.36, by - s * 0.42, s * 0.72, s * 0.1, s * 0.04);
        shape(cx - s * 0.3, by - s * 0.32, s * 0.07, s * 0.32, s * 0.02);
        shape(cx + s * 0.23, by - s * 0.32, s * 0.07, s * 0.32, s * 0.02);
        break;
      case "bed":
        shape(cx - at.w * 0.45, by - s * 0.62, at.w * 0.12, s * 0.62, s * 0.06);
        shape(cx - at.w * 0.42, by - s * 0.34, at.w * 0.84, s * 0.26, s * 0.08);
        break;
      case "plant":
        shape(cx - s * 0.16, by - s * 0.3, s * 0.32, s * 0.3, s * 0.06);
        g.fillStyle = locked ? LOCK : itemId === "flowerVase" ? "#E9A9B4" : "#7FB58A";
        g.beginPath();
        g.arc(cx, by - s * 0.48, s * 0.2, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        break;
      case "storage":
        shape(cx - s * 0.3, by - s * 0.92, s * 0.6, s * 0.92, s * 0.26);
        break;
      case "rug":
        g.beginPath();
        g.ellipse(cx, by - at.h * 0.4, at.w * 0.46, at.h * 0.36, 0, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        break;
      case "wall":
        if (itemId === "wallClock") {
          g.beginPath();
          g.arc(cx, at.y + at.h * 0.5, s * 0.3, 0, Math.PI * 2);
          g.fill();
          g.stroke();
        } else shape(cx - s * 0.3, at.y + at.h * 0.22, s * 0.6, s * 0.5, s * 0.04);
        break;
      case "small":
        g.beginPath();
        g.ellipse(cx, by - s * 0.2, s * 0.24, s * 0.2, 0, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        break;
    }
    g.restore();
  },

  drawRoom(g, at, spec) {
    g.save();
    const walls = ["#5B4A6E", "#4E5D6E", "#6E4F5B"];
    const floors = ["#8A6A50", "#7A6A5A", "#6E5A4A"];
    g.fillStyle = walls[spec.wallpaper % 3]!;
    g.fillRect(at.x, at.y, at.w, at.h * 0.55);
    g.fillStyle = floors[spec.floor % 3]!;
    g.fillRect(at.x, at.y + at.h * 0.55, at.w, at.h * 0.45);
    // window
    g.fillStyle = "#E8A27C";
    g.beginPath();
    g.arc(at.x + at.w * 0.5, at.y + at.h * 0.2, at.w * 0.08, 0, Math.PI * 2);
    g.fill();
    // lantern pool (key light, top left)
    const pool = g.createRadialGradient(at.x + at.w * 0.25, at.y + at.h * 0.45, 0, at.x + at.w * 0.25, at.y + at.h * 0.45, at.w * 0.6);
    pool.addColorStop(0, "rgba(255,200,100,0.22)");
    pool.addColorStop(1, "rgba(255,200,100,0)");
    g.fillStyle = pool;
    g.fillRect(at.x, at.y, at.w, at.h);
    g.restore();
  },

  drawMarketStall(g, at, open) {
    g.save();
    const { x, y, w, h } = at;
    shadow(g, x + w / 2, y + h, w * 0.45);
    g.fillStyle = "#8A5A3C";
    g.fillRect(x + w * 0.1, y + h * 0.35, w * 0.06, h * 0.65);
    g.fillRect(x + w * 0.84, y + h * 0.35, w * 0.06, h * 0.65);
    rr(g, x + w * 0.05, y + h * 0.62, w * 0.9, h * 0.2, 4);
    g.fillStyle = "#C98F5A";
    g.fill();
    // a striped awning
    for (let i = 0; i < 6; i++) {
      g.fillStyle = i % 2 ? "#F1E4C8" : "#E9A9B4";
      g.fillRect(x + (w * i) / 6, y + h * 0.18, w / 6, h * 0.2);
    }
    if (open) {
      g.fillStyle = "#FFC864";
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.arc(x + w * (0.25 + 0.25 * i), y + h * 0.5, h * 0.05, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.restore();
  },

  drawRequestBubble(g, cx, by, r, cat) {
    g.save();
    g.fillStyle = "#FFF6E6";
    g.strokeStyle = INK;
    g.lineWidth = Math.max(1, r * 0.12);
    g.beginPath();
    g.arc(cx, by - r, r, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = INK;
    g.font = `700 ${Math.round(r)}px system-ui`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(cat.slice(0, 1).toUpperCase(), cx, by - r);
    g.restore();
  },

  drawPostcardFrame(g, at) {
    g.save();
    g.fillStyle = "#FFF6E6";
    g.fillRect(at.x, at.y, at.w, at.h);
    const m = at.w * 0.06;
    const picture = { x: at.x + m, y: at.y + m, w: at.w - 2 * m, h: at.h * 0.78 };
    g.fillStyle = "#2B2552";
    g.fillRect(picture.x, picture.y, picture.w, picture.h);
    const stamp = { x: at.x + at.w - m - at.w * 0.16, y: picture.y + picture.h + m * 0.5, w: at.w * 0.16, h: at.w * 0.18 };
    g.strokeStyle = "#E9A9B4";
    g.lineWidth = 4;
    g.setLineDash([6, 6]);
    g.strokeRect(stamp.x, stamp.y, stamp.w, stamp.h);
    g.restore();
    return { picture, stamp, caption: { x: at.x + m, y: picture.y + picture.h + m * 0.5, w: at.w * 0.6, h: at.h - picture.h - 2 * m } };
  },

  drawMailbox(g, at, flag) {
    g.save();
    const cx = at.x + at.w / 2;
    const by = at.y + at.h;
    shadow(g, cx, by, at.w * 0.3);
    g.fillStyle = "#8A5A3C";
    g.fillRect(cx - at.w * 0.04, by - at.h * 0.5, at.w * 0.08, at.h * 0.5);
    rr(g, cx - at.w * 0.3, by - at.h * 0.85, at.w * 0.6, at.h * 0.38, at.h * 0.12);
    g.fillStyle = "#E9A9B4";
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = Math.max(1, at.w * 0.03);
    g.stroke();
    if (flag) {
      g.fillStyle = "#FFC864";
      g.fillRect(cx + at.w * 0.26, by - at.h * 1.0, at.w * 0.06, at.h * 0.3);
      g.fillRect(cx + at.w * 0.26, by - at.h * 1.0, at.w * 0.2, at.h * 0.12);
    }
    g.restore();
  },
};
