// THE Duskwick lantern (v9): the framed paper lantern of the app icon
// (docs/icon/duskwick-icon.svg), redrawn from the icon's own path data so the board,
// the guide, the town, the result sheet and the icon show the same object:
// arched handle, a wooden roof cap, a glowing rounded paper body between two wooden
// posts, and a wooden base. Coordinates are the icon's (1024 grid); the canvas is
// h tall and 0.8h wide with the paper body centred at (0.4h, 0.56h) — the anchor every
// caller (flame sprite, halo, guide) already uses. Painted only at bake time.
import { mix, type Ctx } from "./draw.ts";

/** icon units per lantern height (handle top → base bottom fits with a small margin) */
const K = 272;
/** icon-space origin of the texture (so the body centre 512,417 lands on 0.4h, 0.56h) */
const OX = 512 - 0.4 * K;
const OY = 417 - 0.56 * K;

const BODY = { x: 430.4, y: 332.6, w: 163.2, h: 168.6, rx: 73.4, ry: 54.4 };

function bodyPath(ctx: Ctx, grow = 0): void {
  const { x, y, w, h } = BODY;
  const rx = BODY.rx + grow;
  const ry = BODY.ry + grow;
  const x0 = x - grow;
  const y0 = y - grow;
  const x1 = x + w + grow;
  const y1 = y + h + grow;
  ctx.beginPath();
  ctx.moveTo(x0 + rx, y0);
  ctx.lineTo(x1 - rx, y0);
  ctx.ellipse(x1 - rx, y0 + ry, rx, ry, 0, -Math.PI / 2, 0);
  ctx.lineTo(x1, y1 - ry);
  ctx.ellipse(x1 - rx, y1 - ry, rx, ry, 0, 0, Math.PI / 2);
  ctx.lineTo(x0 + rx, y1);
  ctx.ellipse(x0 + rx, y1 - ry, rx, ry, 0, Math.PI / 2, Math.PI);
  ctx.lineTo(x0, y0 + ry);
  ctx.ellipse(x0 + rx, y0 + ry, rx, ry, 0, Math.PI, Math.PI * 1.5);
  ctx.closePath();
}

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** R4 lantern skins (board lanterns only; game/cosmetics.ts): each resident's paper colour + one small mark. */
export type SkinId = "wick" | "momo" | "sage" | "luna" | "pip" | "kuri" | "yuki";
/** lit paper gradient stops (centre → rim) per skin; "wick" is the icon's own warm paper */
const PAPER: Record<SkinId, readonly [string, string, string, string, string]> = {
  wick: ["#FFF3DA", "#FFEECB", "#FFDD94", "#FFC864", "#E8B05A"],
  momo: ["#FFF3F2", "#FFE6E6", "#FFCAD3", "#F6A6B8", "#E08AA0"],
  sage: ["#F7FCEC", "#ECF6D6", "#D3EBAE", "#AFD585", "#8CBA66"],
  luna: ["#F8F3FF", "#ECE2FF", "#D6C4F8", "#BBA0EA", "#9C82D2"],
  pip: ["#FFF9E0", "#FFF2B8", "#FFE184", "#FFC950", "#EFAE3A"],
  kuri: ["#FFF3EA", "#FFE3CF", "#FFC9A6", "#F2A479", "#D9875A"],
  yuki: ["#F6FBFF", "#E5F2FF", "#CAE3F8", "#A6CDEE", "#88B4DC"],
};

/**
 * The framed lantern, `h` px tall. glow 1 = lit (warm paper, the flame sprite adds the
 * light), 0 = unlit (cool dusk paper: basket, town "waiting", shields). `skin` (R4): board lanterns only.
 */
export function drawFramedLantern(ctx: Ctx, h: number, glow: number, skin: SkinId = "wick"): void {
  const P = PAPER[skin];
  const s = h / K;
  ctx.save();
  ctx.scale(s, s);
  ctx.translate(-OX, -OY);
  const wood = "#3E2A22";
  const woodHi = "#6E4C38";
  // handle
  ctx.strokeStyle = wood;
  ctx.lineWidth = 13.6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(512, 314.9, 46.2, Math.PI, 0);
  ctx.stroke();
  // paper body
  const g = ctx.createRadialGradient(512, 408.8, 0, 512, 408.8, 108.8);
  // v12 (A4): a cream centre, not white — the lantern face's ink and blush stay readable on it
  g.addColorStop(0, mix("#D9CDB0", P[0], glow));
  g.addColorStop(0.3, mix("#CDBE9C", P[1], glow));
  g.addColorStop(0.6, mix("#B9A47E", P[2], glow));
  g.addColorStop(0.9, mix("#9C8462", P[3], glow));
  g.addColorStop(1, mix("#7E6A50", P[4], glow));
  bodyPath(ctx);
  ctx.fillStyle = g;
  ctx.fill();
  // paper ribs: two faint horizontal bands (reads "paper lantern" at large sizes, vanishes when small)
  ctx.save();
  bodyPath(ctx);
  ctx.clip();
  const side = ctx.createLinearGradient(BODY.x, 0, BODY.x + BODY.w, 0);
  side.addColorStop(0, "rgba(122,74,28,0.22)");
  side.addColorStop(0.3, "rgba(122,74,28,0)");
  side.addColorStop(0.7, "rgba(122,74,28,0)");
  side.addColorStop(1, "rgba(122,74,28,0.32)");
  ctx.fillStyle = side;
  ctx.fillRect(BODY.x, BODY.y, BODY.w, BODY.h);
  ctx.strokeStyle = `rgba(122,74,28,${0.16 + 0.06 * (1 - glow)})`;
  ctx.lineWidth = 3.2;
  for (const y of [388, 446]) {
    ctx.beginPath();
    ctx.moveTo(BODY.x, y);
    ctx.quadraticCurveTo(512, y + 7, BODY.x + BODY.w, y);
    ctx.stroke();
  }
  ctx.restore();
  bodyPath(ctx);
  ctx.strokeStyle = "rgba(90,58,28,0.5)";
  ctx.lineWidth = 5.4;
  ctx.stroke();
  // posts (with a lit inner edge when glowing)
  for (const x of [422.2, 588.2]) {
    rr(ctx, x, 324.4, 13.6, 179.5, 6.8);
    ctx.fillStyle = wood;
    ctx.fill();
    ctx.fillStyle = `rgba(255,200,120,${0.35 * glow})`;
    ctx.fillRect(x < 500 ? x + 9.5 : x + 0.5, 340, 3.6, 150);
  }
  // roof cap
  const rg = ctx.createLinearGradient(0, 305.4, 0, 335.3);
  rg.addColorStop(0, woodHi);
  rg.addColorStop(1, wood);
  ctx.beginPath();
  ctx.moveTo(430.6, 312.6);
  ctx.quadraticCurveTo(435.8, 305.4, 444.8, 305.4);
  ctx.lineTo(579.2, 305.4);
  ctx.quadraticCurveTo(588.2, 305.4, 593.4, 312.6);
  ctx.lineTo(604.6, 328.1);
  ctx.quadraticCurveTo(609.9, 335.3, 600.9, 335.3);
  ctx.lineTo(423.1, 335.3);
  ctx.quadraticCurveTo(414.1, 335.3, 419.4, 328.1);
  ctx.closePath();
  ctx.fillStyle = rg;
  ctx.fill();
  ctx.fillStyle = "rgba(255,230,190,0.18)";
  ctx.fillRect(440, 306.5, 144, 3);
  // base
  const bg = ctx.createLinearGradient(0, 493.1, 0, 520.3);
  bg.addColorStop(0, woodHi);
  bg.addColorStop(1, wood);
  rr(ctx, 416.8, 493.1, 190.4, 27.2, 8.2);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.fillStyle = `rgba(255,214,140,${0.4 * glow})`;
  ctx.fillRect(432, 493.6, 160, 2.6);
  if (skin !== "wick") drawSkinMark(ctx, skin);
  ctx.restore();
}

/** The skin's one mark, in icon units (body 430–594 × 333–501, roof 305–335, handle top ≈ 269). */
function drawSkinMark(ctx: Ctx, skin: SkinId): void {
  const ink = "rgba(59,44,69,0.55)";
  ctx.lineWidth = 3;
  ctx.strokeStyle = ink;
  if (skin === "momo") {
    // a blossom on the roof's right corner
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.ellipse(586 + Math.cos(a) * 11, 316 + Math.sin(a) * 11, 9, 7, a, 0, Math.PI * 2);
      ctx.fillStyle = "#FF9FB6";
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(586, 316, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#FFE08A";
    ctx.fill();
  } else if (skin === "sage") {
    // two leaves sprouting from the handle's top
    for (const d of [-1, 1]) {
      ctx.save();
      ctx.translate(512 + d * 12, 262);
      ctx.rotate(d * 0.7);
      ctx.beginPath();
      ctx.ellipse(0, 0, 18, 8, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#7DBB6A";
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  } else if (skin === "luna") {
    // a gold star on the roof's left corner
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
      const r = k % 2 ? 7 : 16;
      ctx.lineTo(438 + Math.cos(a) * r, 314 + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = "#F4D38A";
    ctx.fill();
    ctx.stroke();
  } else if (skin === "pip") {
    // a little bow on the handle
    ctx.fillStyle = "#FF9A4D";
    for (const d of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(512, 269);
      ctx.lineTo(512 + d * 22, 257);
      ctx.lineTo(512 + d * 22, 281);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(512, 269, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (skin === "kuri") {
    // a knitted scarf across the body's lower part (cream stitches on rust)
    ctx.save();
    bodyPath(ctx, 3);
    ctx.clip();
    ctx.fillStyle = "#C8553D";
    ctx.fillRect(400, 456, 230, 22);
    ctx.fillStyle = "rgba(255,243,222,0.85)";
    for (let x = 436; x < 596; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, 461);
      ctx.lineTo(x + 5, 467);
      ctx.lineTo(x + 10, 461);
      ctx.lineTo(x + 5, 473);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  } else if (skin === "yuki") {
    // snow resting on the roof
    ctx.beginPath();
    ctx.moveTo(424, 312);
    ctx.quadraticCurveTo(430, 294, 456, 297);
    ctx.quadraticCurveTo(476, 286, 500, 296);
    ctx.quadraticCurveTo(526, 284, 552, 296);
    ctx.quadraticCurveTo(580, 290, 598, 308);
    ctx.quadraticCurveTo(604, 318, 592, 316);
    ctx.quadraticCurveTo(586, 326, 578, 316);
    ctx.lineTo(450, 316);
    ctx.quadraticCurveTo(440, 326, 434, 316);
    ctx.quadraticCurveTo(418, 320, 424, 312);
    ctx.closePath();
    ctx.fillStyle = "#F4FAFF";
    ctx.fill();
    ctx.strokeStyle = "rgba(120,150,190,0.6)";
    ctx.stroke();
  }
}

/** The lantern's silhouette outline (ghost / hint): paper body + roof + base as one stroke path set. */
export function strokeLanternOutline(ctx: Ctx, h: number, lw: number, color: string): void {
  const s = h / K;
  ctx.save();
  ctx.scale(s, s);
  ctx.translate(-OX, -OY);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw / s;
  ctx.lineJoin = "round";
  bodyPath(ctx, 14);
  ctx.stroke();
  ctx.restore();
}

/** Lantern geometry in texture px for a lantern `h` tall (body box, roof top, base bottom). */
export function lanternGeom(h: number): { bodyW: number; bodyH: number; top: number; bottom: number; cx: number; cy: number } {
  const s = h / K;
  return { bodyW: BODY.w * s, bodyH: BODY.h * s, top: (268.7 - OY) * s, bottom: (520.3 - OY) * s, cx: 0.4 * h, cy: 0.56 * h };
}
