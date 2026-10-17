// Tap a lit house on the street → the board the player solved there, shown briefly as a small
// keepsake card (audit P2-15). The level comes from the same deterministic generator, in a worker
// (a late gentle level can take seconds to generate: never on the main thread). Painted once into
// a canvas; nothing per frame.
import { drawDigit, drawFloorTile, drawGlow, drawLantern, drawLitTile, drawNumberedRock, drawPanel, drawRock, GLOW, rrectPath, type Ctx } from "../render/draw.ts";
import { PAL } from "../render/palette.ts";
import { hashStr, rng } from "../render/rng.ts";
import { hasBit, index, NO_CLUE, type PipsLevel, solutionOf } from "../game/pipsApi.ts";

/** Card size (pt) for a level: square-ish, ≤ maxW wide. */
export function keepsakeSize(level: { w: number; h: number }, maxW: number): { w: number; h: number; cs: number } {
  const pad = 14;
  const cs = Math.floor(Math.min((maxW - pad * 2) / level.w, 40));
  return { w: cs * level.w + pad * 2, h: cs * level.h + pad * 2, cs };
}

/** Paint the solved board of `level` at `q` px per pt (the caller made the canvas w × h pt × q). */
export function paintKeepsake(ctx: Ctx, level: PipsLevel, seedKey: string, maxW: number, q: number): void {
  const { w, h, cs } = keepsakeSize(level, maxW);
  ctx.save();
  ctx.scale(q, q);
  drawPanel(ctx, w, h, 16, 1);
  const pad = 14;
  rrectPath(ctx, pad - 2, pad - 2, cs * level.w + 4, cs * level.h + 4, 8);
  ctx.fillStyle = PAL.grout;
  ctx.fill();
  const sol = solutionOf(level);
  const r = rng(hashStr(seedKey));
  for (let y = 0; y < level.h; y++) {
    for (let x = 0; x < level.w; x++) {
      const i = index(x, y);
      if (hasBit(level.stones, i)) continue;
      const px = pad + x * cs;
      const py = pad + y * cs;
      drawFloorTile(ctx, px + 1, py + 1, cs - 2, cs * 0.14, r);
      // solved: every floor tile is lit
      drawLitTile(ctx, px + cs / 2, py + cs / 2, cs - 2, cs * 0.14, 0);
    }
  }
  for (let y = 0; y < level.h; y++) {
    for (let x = 0; x < level.w; x++) {
      const i = index(x, y);
      const cx = pad + x * cs + cs / 2;
      const cy = pad + y * cs + cs / 2;
      if (hasBit(level.stones, i)) {
        if (level.clues[i] !== NO_CLUE) {
          drawNumberedRock(ctx, cx, cy, cs, rng(hashStr(`${seedKey}:${i}`)));
          drawDigit(ctx, cx, cy - cs * 0.025, cs, level.clues[i]!, "warm");
        } else drawRock(ctx, cx, cy - cs * 0.02, cs * 0.43, rng(hashStr(`${seedKey}:${i}`)));
      } else if (sol && hasBit(sol, i)) {
        drawGlow(ctx, cx, cy, cs * 0.9, GLOW.halo);
        const lh = cs * 0.8;
        ctx.save();
        ctx.translate(cx - lh * 0.4, cy - lh * 0.56 - cs * 0.03);
        drawLantern(ctx, lh, 1);
        ctx.restore();
        drawGlow(ctx, cx, cy - cs * 0.03, cs * 0.3, GLOW.flame);
      }
    }
  }
  ctx.restore();
}

/**
 * The card while its board is still being generated: the same panel and board well (same size,
 * so nothing jumps when the board arrives), unlit floor tiles — the town breathes a warm light
 * over it until the board is in. Never a blank card.
 */
export function paintKeepsakeWaiting(ctx: Ctx, cols: number, rowsN: number, maxW: number, q: number): void {
  const { w, h, cs } = keepsakeSize({ w: cols, h: rowsN }, maxW);
  ctx.save();
  ctx.scale(q, q);
  drawPanel(ctx, w, h, 16, 1);
  const pad = 14;
  rrectPath(ctx, pad - 2, pad - 2, cs * cols + 4, cs * rowsN + 4, 8);
  ctx.fillStyle = PAL.grout;
  ctx.fill();
  const r = rng(hashStr(`wait:${cols}x${rowsN}`));
  ctx.globalAlpha = 0.55;
  for (let y = 0; y < rowsN; y++) for (let x = 0; x < cols; x++) drawFloorTile(ctx, pad + x * cs + 1, pad + y * cs + 1, cs - 2, cs * 0.14, r);
  ctx.restore();
}
