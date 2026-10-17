// Duskwick numerals (v9): one hand-drawn digit set for every number the game shows —
// carved marker stones, the house / tower plates, the calendar tile, the result time.
// Each digit is a monoline centre path (SVG path data, cap height 100 units, y down) that
// is stroked with round caps and joins, so the stroke contrast is ~1:1 and the shapes
// stay soft and calm at every size. Width units = advance; the colon is a pair of dots.
// Baked into textures only (Path2D once per digit, never per frame).
import type { Ctx } from "./draw.ts";

/** Centre-line paths, cap height 0..100, x 0..advance. */
const D: Record<string, { d: string; adv: number }> = {
  "0": { d: "M30 4 C45 4 53 21 53 50 C53 79 45 96 30 96 C15 96 7 79 7 50 C7 21 15 4 30 4 Z", adv: 60 },
  "1": { d: "M13 22 C21 18 27 12 32 4 L32 96 M16 96 L48 96", adv: 60 },
  "2": { d: "M9 25 C11 12 20 4 31 4 C43 4 51 12 51 25 C51 41 37 54 9 96 L54 96", adv: 60 },
  "3": { d: "M9 15 C15 8 22 4 31 4 C43 4 50 12 50 24 C50 37 41 46 26 46 C43 46 53 55 53 70 C53 87 42 96 29 96 C20 96 12 92 7 85", adv: 60 },
  "4": { d: "M41 96 L41 4 L6 67 L56 67", adv: 60 },
  "5": { d: "M50 4 L17 4 L13 44 C19 39 25 37 32 37 C46 37 54 48 54 65 C54 84 43 96 29 96 C20 96 12 92 7 85", adv: 60 },
  "6": { d: "M47 9 C42 6 37 4 31 4 C16 4 8 22 8 52 C8 80 17 96 31 96 C45 96 53 85 53 69 C53 53 44 43 31 43 C21 43 12 50 8 60", adv: 60 },
  "7": { d: "M8 4 L52 4 C39 30 29 60 25 96", adv: 60 },
  "8": { d: "M30 46 C18 46 11 39 11 26 C11 13 19 4 30 4 C41 4 49 13 49 26 C49 39 42 46 30 46 C16 46 7 56 7 71 C7 87 17 96 30 96 C43 96 53 87 53 71 C53 56 44 46 30 46 Z", adv: 60 },
  "9": { d: "M13 91 C18 94 23 96 29 96 C44 96 52 78 52 48 C52 20 43 4 29 4 C15 4 7 15 7 31 C7 47 16 57 29 57 C39 57 48 50 52 40", adv: 60 },
  ":": { d: "M12 32 L12 33 M12 78 L12 79", adv: 24 },
  "#": { d: "M24 14 L17 88 M45 14 L38 88 M7 36 L56 36 M5 66 L54 66", adv: 62 },
};

/** Stroke width in cap-height units (bold text = heavier). */
export const GLYPH_STROKE = 15;
const cache = new Map<string, Path2D>();

function path(ch: string): Path2D | null {
  const g = D[ch];
  if (!g) return null;
  let p = cache.get(ch);
  if (!p) {
    p = new Path2D(g.d);
    cache.set(ch, p);
  }
  return p;
}

/** Advance of `text` in px for cap height `h` (tracking included). */
export function numeralWidth(text: string, h: number, weight = 1): number {
  let w = 0;
  for (const ch of text) w += ((D[ch]?.adv ?? 40) + 4) * (h / 100);
  return w - 4 * (h / 100) + GLYPH_STROKE * weight * (h / 100);
}

export interface NumeralPaint {
  /** stroke colour / gradient for this pass */
  style: string | CanvasGradient;
  /** stroke width multiplier (1 = the glyph's own weight) */
  widthK?: number;
  /** pass offset in px */
  dx?: number;
  dy?: number;
  alpha?: number;
  /** canvas shadow glow (bake time only) */
  glow?: { color: string; blur: number };
}

/**
 * Strokes `text` centred on (cx, cy) with cap height h, once per pass (back to front).
 * weight 1 = regular; Bold Text callers pass ~1.2.
 */
export function strokeNumerals(ctx: Ctx, text: string, cx: number, cy: number, h: number, passes: readonly NumeralPaint[], weight = 1): void {
  const k = h / 100;
  const total = numeralWidth(text, h, weight) - GLYPH_STROKE * weight * k;
  const x0 = cx - total / 2;
  const y0 = cy - h / 2;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const p of passes) {
    ctx.save();
    ctx.globalAlpha *= p.alpha ?? 1;
    ctx.strokeStyle = p.style;
    if (p.glow) {
      ctx.shadowColor = p.glow.color;
      ctx.shadowBlur = p.glow.blur;
    }
    let x = x0;
    for (const ch of text) {
      const g = D[ch];
      const pp = path(ch);
      if (g && pp) {
        ctx.save();
        ctx.translate(x + (p.dx ?? 0), y0 + (p.dy ?? 0));
        ctx.scale(k, k);
        ctx.lineWidth = GLYPH_STROKE * weight * (p.widthK ?? 1);
        ctx.stroke(pp);
        ctx.restore();
      }
      x += ((g?.adv ?? 40) + 4) * k;
    }
    ctx.restore();
  }
  ctx.restore();
}

/** Plain ink numerals (plates, calendar, result): one dark pass with a faint light lip under it. */
export function drawNumerals(ctx: Ctx, text: string, cx: number, cy: number, h: number, ink: string, lip: string | null, weight = 1): void {
  const passes: NumeralPaint[] = [];
  if (lip) passes.push({ style: lip, dy: h * 0.045 });
  passes.push({ style: ink });
  strokeNumerals(ctx, text, cx, cy, h, passes, weight);
}
