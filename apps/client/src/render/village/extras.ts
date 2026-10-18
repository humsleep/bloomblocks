// Round 3 (owner: full village): the market stall (3 item slots), the request bubbles (one glyph per
// furniture category) and the room postcard frame (1080 × 1350, spoiler-free). Same light, same recipe;
// no text (the scene writes the words in the boxes these return).
import type { Ctx } from "../draw.ts";
import { contact, glow, hexA, miniLantern, mix, P, rrect, solid, T, texture, type Box } from "./shade.ts";
import { drawLanternHouse, LANTERN_THEMES } from "./lanternHouse.ts";

// ---------------------------------------------------------------- the market stall

/**
 * A market stall in a box (bottom-centred, ≈ 220 × 200 units): striped awning (value bands), two posts,
 * a counter with three display pedestals, a hanging lantern. Returns the 3 slot boxes the scene draws
 * the day's pieces into (drawFurniture fit "card"), and the sign's box above the awning (for its words).
 */
export function drawMarketStall(ctx: Ctx, at: Box, open = true): { slots: Box[]; sign: Box } {
  const k = Math.min(at.w / 220, at.h / 200);
  const cx = at.x + at.w / 2;
  const gy = at.y + at.h;
  ctx.save();
  ctx.translate(cx, gy);
  ctx.scale(k, k);
  contact(ctx, 4, 2, 104, 10, 0.45);
  if (open) glow(ctx, -88, -116, 70, T.glow, 0.32);
  for (const x of [-96, 90]) solid(ctx, rrect(x, -160, 7, 160, 3), T.wood, { x, y: -160, w: 7, h: 160 }, { rim: 0.8, tex: "wood" });
  // the back board + the counter (front projection)
  solid(ctx, rrect(-92, -118, 184, 64, 6), mix(T.woodHi, "#FFF3DE", 0.25), { x: -92, y: -118, w: 184, h: 64 }, { rim: 1, lit: 0.3, tex: "wood" });
  const counter = rrect(-104, -56, 208, 56, 8);
  solid(ctx, counter, T.woodHi, { x: -104, y: -56, w: 208, h: 56 }, { rim: 1.4, lit: 0.32, tex: "wood" });
  ctx.save();
  ctx.clip(counter);
  ctx.fillStyle = hexA(T.plum, 0.14);
  for (const x of [-52, 0, 52]) ctx.fillRect(x - 1, -50, 2, 50);
  ctx.restore();
  solid(ctx, rrect(-108, -62, 216, 9, 3), T.wood, { x: -108, y: -62, w: 216, h: 9 }, { rim: 0.8, tex: "wood" });
  // three pedestals (cream plinths) the pieces stand on
  const slots: Box[] = [];
  for (const x of [-64, 0, 64]) {
    solid(ctx, P((q) => q.ellipse(x, -64, 24, 5, 0, 0, Math.PI * 2)), "#FFF3DE", { x: x - 24, y: -69, w: 48, h: 10 }, { rim: 0.8, lit: 0.3, ao: 0, tex: "paper" });
    slots.push({ x: cx + (x - 26) * k, y: gy + (-66 - 52) * k, w: 52 * k, h: 52 * k });
  }
  // the awning: scalloped stripes in cream / coral (value bands), its edge scallops one shape
  const aw = P((q) => {
    q.moveTo(-112, -158);
    q.lineTo(112, -158);
    q.lineTo(112, -132);
    for (let i = 0; i < 8; i++) {
      const x0 = 112 - i * 28;
      q.quadraticCurveTo(x0 - 14, -118, x0 - 28, -132);
    }
    q.closePath();
  });
  solid(ctx, aw, "#FFF3DE", { x: -112, y: -170, w: 224, h: 52 }, { rim: 1.4, lit: 0.34, shade: 0.4, tex: "cloth" });
  ctx.save();
  ctx.clip(aw);
  ctx.fillStyle = hexA(T.coral, 0.85);
  for (let i = 0; i < 8; i += 2) ctx.fillRect(-112 + i * 28, -170, 28, 60);
  ctx.restore();
  solid(ctx, rrect(-116, -166, 232, 10, 4), T.wood, { x: -116, y: -166, w: 232, h: 10 }, { rim: 0.8, tex: "wood" });
  // the sign board on top + the hanging lantern
  solid(ctx, rrect(-46, -196, 92, 28, 8), "#FFF3DE", { x: -46, y: -196, w: 92, h: 28 }, { rim: 1, lit: 0.3, tex: "paper" });
  // the lantern hangs at the left post (the key light's side), clear of the third pedestal
  ctx.fillStyle = T.woodLo;
  ctx.fillRect(-89, -132, 1.6, 8);
  miniLantern(ctx, -88, -114, 14, open);
  ctx.restore();
  return { slots, sign: { x: cx - 42 * k, y: gy - 194 * k, w: 84 * k, h: 24 * k } };
}

// ---------------------------------------------------------------- request bubbles

export type RequestCategory = "seating" | "table" | "lighting" | "plant" | "rug" | "wall" | "bed" | "storage" | "small";

/** One line glyph per category (cream strokes on the HUD grammar's look, inside a bubble). */
function categoryGlyph(ctx: Ctx, cat: RequestCategory, x: number, y: number, s: number, col: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  ctx.lineWidth = Math.max(1.4, s * 0.1);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  const u = s / 2;
  switch (cat) {
    case "seating": // a chair: arched back on posts, a seat, legs
      ctx.moveTo(-u * 0.5, u * 0.7);
      ctx.lineTo(-u * 0.5, -u * 0.35);
      ctx.quadraticCurveTo(-u * 0.5, -u * 0.8, 0, -u * 0.8);
      ctx.quadraticCurveTo(u * 0.5, -u * 0.8, u * 0.5, -u * 0.35);
      ctx.lineTo(u * 0.5, u * 0.7);
      ctx.moveTo(-u * 0.62, u * 0.1);
      ctx.lineTo(u * 0.62, u * 0.1);
      break;
    case "table": // a table top and two legs, a cup on it
      ctx.moveTo(-u * 0.8, -u * 0.05);
      ctx.lineTo(u * 0.8, -u * 0.05);
      ctx.moveTo(-u * 0.6, -u * 0.05);
      ctx.lineTo(-u * 0.6, u * 0.7);
      ctx.moveTo(u * 0.6, -u * 0.05);
      ctx.lineTo(u * 0.6, u * 0.7);
      ctx.moveTo(-u * 0.2, -u * 0.5);
      ctx.lineTo(u * 0.2, -u * 0.5);
      ctx.lineTo(u * 0.14, -u * 0.12);
      ctx.lineTo(-u * 0.14, -u * 0.12);
      ctx.closePath();
      break;
    case "lighting": // a paper lantern with its handle
      ctx.roundRect(-u * 0.42, -u * 0.5, u * 0.84, u * 1.1, u * 0.34);
      ctx.moveTo(-u * 0.22, -u * 0.5);
      ctx.quadraticCurveTo(0, -u * 0.95, u * 0.22, -u * 0.5);
      break;
    case "plant": // a pot and two leaves
      ctx.moveTo(-u * 0.4, u * 0.15);
      ctx.lineTo(u * 0.4, u * 0.15);
      ctx.lineTo(u * 0.3, u * 0.75);
      ctx.lineTo(-u * 0.3, u * 0.75);
      ctx.closePath();
      ctx.moveTo(0, u * 0.15);
      ctx.quadraticCurveTo(-u * 0.75, -u * 0.2, -u * 0.35, -u * 0.75);
      ctx.quadraticCurveTo(-u * 0.05, -u * 0.35, 0, u * 0.15);
      ctx.moveTo(0, u * 0.15);
      ctx.quadraticCurveTo(u * 0.75, -u * 0.1, u * 0.4, -u * 0.6);
      ctx.quadraticCurveTo(u * 0.05, -u * 0.3, 0, u * 0.15);
      break;
    case "rug": // two nested ellipses
      ctx.ellipse(0, u * 0.1, u * 0.85, u * 0.38, 0, 0, Math.PI * 2);
      ctx.moveTo(u * 0.4, u * 0.1);
      ctx.ellipse(0, u * 0.1, u * 0.4, u * 0.16, 0, 0, Math.PI * 2);
      break;
    case "wall": // a picture on a nail
      ctx.roundRect(-u * 0.62, -u * 0.35, u * 1.24, u * 0.95, u * 0.1);
      ctx.moveTo(-u * 0.3, -u * 0.35);
      ctx.lineTo(0, -u * 0.75);
      ctx.lineTo(u * 0.3, -u * 0.35);
      ctx.moveTo(-u * 0.45, u * 0.42);
      ctx.lineTo(-u * 0.1, u * 0.05);
      ctx.lineTo(u * 0.15, u * 0.3);
      ctx.lineTo(u * 0.45, 0);
      break;
    case "bed": // a headboard, a mattress, a pillow
      ctx.moveTo(-u * 0.8, u * 0.6);
      ctx.lineTo(-u * 0.8, -u * 0.5);
      ctx.moveTo(-u * 0.8, u * 0.2);
      ctx.lineTo(u * 0.8, u * 0.2);
      ctx.lineTo(u * 0.8, u * 0.6);
      ctx.moveTo(-u * 0.8, -u * 0.05);
      ctx.lineTo(u * 0.8, -u * 0.05);
      ctx.moveTo(-u * 0.55, -u * 0.25);
      ctx.roundRect(-u * 0.6, -u * 0.32, u * 0.45, u * 0.24, u * 0.1);
      break;
    case "storage": // a shelf with books
      ctx.roundRect(-u * 0.62, -u * 0.75, u * 1.24, u * 1.5, u * 0.12);
      ctx.moveTo(-u * 0.62, 0);
      ctx.lineTo(u * 0.62, 0);
      for (const x of [-0.35, -0.12, 0.15]) {
        ctx.moveTo(u * x, -u * 0.05);
        ctx.lineTo(u * x, -u * 0.5);
      }
      break;
    default: // small things: a teacup
      ctx.moveTo(-u * 0.55, -u * 0.25);
      ctx.lineTo(u * 0.4, -u * 0.25);
      ctx.quadraticCurveTo(u * 0.35, u * 0.55, -u * 0.08, u * 0.55);
      ctx.quadraticCurveTo(-u * 0.5, u * 0.55, -u * 0.55, -u * 0.25);
      ctx.moveTo(u * 0.4, -u * 0.1);
      ctx.quadraticCurveTo(u * 0.8, -u * 0.05, u * 0.38, u * 0.25);
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * A resident's request: a paper thought-bubble above the head (its tail touches (hx, hy) — residentHead()),
 * the category's glyph in it, a calm amber dot = "new" (no red, no count). r = bubble radius px.
 */
export function drawRequestBubble(ctx: Ctx, hx: number, hy: number, r: number, cat: RequestCategory, fresh = true): void {
  const bx = hx + r * 0.8;
  const by = hy - r * 1.9;
  ctx.save();
  ctx.shadowColor = hexA(T.plum, 0.4);
  ctx.shadowBlur = r * 0.5;
  ctx.shadowOffsetY = r * 0.08;
  ctx.fillStyle = "#FFF8EC";
  ctx.beginPath();
  ctx.arc(bx, by, r, 0, Math.PI * 2);
  ctx.fill();
  // a thought tail: two small dots stepping down to the head
  ctx.beginPath();
  ctx.arc(bx - r * 0.55, by + r * 1.08, r * 0.2, 0, Math.PI * 2);
  ctx.arc(hx + r * 0.08, hy - r * 0.12, r * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  categoryGlyph(ctx, cat, bx, by, r * 1.15, T.ink);
  if (fresh) {
    glow(ctx, bx + r * 0.72, by - r * 0.72, r * 0.5, T.amber, 0.45);
    ctx.fillStyle = T.amber;
    ctx.beginPath();
    ctx.arc(bx + r * 0.72, by - r * 0.72, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

export const REQUEST_CATEGORIES: readonly RequestCategory[] = ["seating", "table", "lighting", "plant", "rug", "wall", "bed", "storage", "small"];

// ---------------------------------------------------------------- the room postcard

/**
 * The cottage postcard (share image, 1080 × 1350 px design): deckled cream card, the cottage window
 * (the scene draws the room + furniture + residents into `room`), a lantern-house stamp, a postmark of
 * soft rings (no text, no date, no level — spoiler-free), a caption line for the scene's words.
 */
export function drawPostcardFrame(ctx: Ctx, w = 1080, h = 1350): { room: Box; caption: Box; stamp: Box } {
  const k = w / 1080;
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#2A2350");
  bg.addColorStop(1, "#3A2F63");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const card = { x: 48 * k, y: 48 * k, w: w - 96 * k, h: h - 96 * k };
  contact(ctx, w / 2, card.y + card.h + 10 * k, card.w * 0.5, 22 * k, 0.45);
  const cp = rrect(card.x, card.y, card.w, card.h, 26 * k);
  solid(ctx, cp, "#FFF6E6", card, { rim: 4 * k, lit: 0.18, shade: 0.14, ao: 0.06, tex: "paper", texA: 0.3 });
  // the window onto the cottage (the scene paints the room in it)
  const room = { x: card.x + 54 * k, y: card.y + 54 * k, w: card.w - 108 * k, h: card.h * 0.74 };
  ctx.save();
  ctx.fillStyle = "#191838";
  ctx.beginPath();
  ctx.roundRect(room.x, room.y, room.w, room.h, 18 * k);
  ctx.fill();
  ctx.restore();
  // the stamp: a scalloped cream stamp with a lantern-house, top right of the caption band
  const stamp = { x: card.x + card.w - 220 * k, y: room.y + room.h + 30 * k, w: 160 * k, h: 190 * k };
  const sp = P((q) => {
    const n = 10;
    q.moveTo(stamp.x, stamp.y);
    for (let i = 0; i < n; i++) q.arc(stamp.x + (stamp.w * (i + 0.5)) / n, stamp.y, stamp.w / n / 2, Math.PI, 0);
    q.lineTo(stamp.x + stamp.w, stamp.y + stamp.h);
    for (let i = n - 1; i >= 0; i--) q.arc(stamp.x + (stamp.w * (i + 0.5)) / n, stamp.y + stamp.h, stamp.w / n / 2, 0, Math.PI);
    q.closePath();
  });
  solid(ctx, sp, "#FBEFD8", stamp, { rim: 2 * k, lit: 0.2, tex: "paper" });
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(stamp.x + 14 * k, stamp.y + 14 * k, stamp.w - 28 * k, stamp.h - 28 * k, 8 * k);
  ctx.clip();
  const sg = ctx.createLinearGradient(0, stamp.y, 0, stamp.y + stamp.h);
  sg.addColorStop(0, T.skyMid);
  sg.addColorStop(1, T.skyRose);
  ctx.fillStyle = sg;
  ctx.fillRect(stamp.x, stamp.y, stamp.w, stamp.h);
  drawLanternHouse(ctx, stamp.x + stamp.w / 2, stamp.y + stamp.h - 22 * k, 0.72 * k, { theme: LANTERN_THEMES.level, groundGlow: false, threshold: false });
  ctx.restore();
  // the postmark: soft concentric rings + wavy lines over the stamp's corner (no text)
  ctx.save();
  ctx.strokeStyle = hexA("#7A6A86", 0.45);
  ctx.lineWidth = 4 * k;
  const pmx = stamp.x - 10 * k;
  const pmy = stamp.y + 60 * k;
  for (const r of [46, 34]) {
    ctx.beginPath();
    ctx.arc(pmx, pmy, r * k, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    const y = pmy - 20 * k + i * 20 * k;
    ctx.moveTo(pmx + 50 * k, y);
    for (let x = 0; x < 4; x++) ctx.quadraticCurveTo(pmx + (62 + x * 24) * k, y - 8 * k, pmx + (74 + x * 24) * k, y);
    ctx.stroke();
  }
  ctx.restore();
  texture(ctx, cp, card, "paper", 0.12);
  // the caption ends 14 units before the postmark ring's left edge (ring r = 46 at stamp.x − 10 → left = stamp.x − 56)
  const caption = { x: card.x + 60 * k, y: room.y + room.h + 60 * k, w: stamp.x - 70 * k - (card.x + 60 * k), h: 120 * k };
  return { room, caption, stamp };
}
