// Cached canvas textures. Every visual is painted once into a CanvasTexture
// (keyed by its pixel size) and then drawn as a plain image — no per-frame
// vector paths, gradients or shadowBlur.
import type PhaserTypes from "phaser";
import {
  drawBlockedMark, drawBreakChip, drawCalendarTile, drawDoneBadge, drawHomeButton, drawSparkles, drawConflictX, drawFarHome, drawFarTower, drawShield, drawStreetIcon, drawTakeBack, drawMoonPhase, drawOverMark, drawShareGlyph, drawStopwatch, drawStreakFlame, drawUndoIcon,
  drawChevron, drawDarkHint, drawDigit, drawDoubleTile, drawFinger, drawFlower, drawGear, drawGhostLantern, drawGlow,
  drawHintIcon, drawLantern, drawLitTile, drawPips, drawRing, drawStoneOutline, drawStoneVeil, drawTapRipple, drawTrackIcon,
  GLOW, type NumTone, pipGeom, type Ctx,
} from "./draw.ts";
import { drawLitWindow } from "./house.ts";
import { drawLanternGlass } from "./village/lanternHouse.ts";
import { drawNumerals, numeralWidth } from "./glyphs.ts";
import { BLOOM_K, LIGHT_BAKE, paintBloom, paintContactShadow, paintMarkerRim, paintPool, paintRayFalloff, paintRockRim, paintSrcFalloff, POOL_R, RIM_K } from "./court.ts";
import { PAL } from "./palette.ts";
import { drawLanternFace, drawWickBody, drawWickFlame, drawWickShadow, type FaceExpr, flameBox, type WickExpr } from "./wick.ts";
import { vis } from "./vis.ts";

export type NumberStyle = "digits" | "dots";

export const FLOWER_COLORS = [PAL.plum, PAL.koi, PAL.sage, PAL.moon] as const;

export class TextureBank {
  constructor(private readonly scene: PhaserTypes.Scene) {}

  /** Get-or-create a canvas texture. */
  canvas(key: string, w: number, h: number, draw: (ctx: Ctx, w: number, h: number) => void): string {
    const tm = this.scene.textures;
    if (tm.exists(key)) return key;
    const t = tm.createCanvas(key, Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h)));
    if (!t) return "__DEFAULT";
    draw(t.getContext(), t.width, t.height);
    t.refresh();
    return key;
  }

  /** Replace a texture (same key) — callers must re-setTexture their images. */
  replace(key: string, w: number, h: number, draw: (ctx: Ctx, w: number, h: number) => void): string {
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    return this.canvas(key, w, h, draw);
  }

  remove(key: string): void {
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
  }

  /** Lit tile incl. soft bleed; draw it centred on the cell. */
  lit(cs: number, gap: number): string {
    const bleed = Math.round(cs * 0.14);
    const size = cs + bleed * 2;
    return this.canvas(`lit@${cs}`, size, size, (ctx, w) => drawLitTile(ctx, w / 2, w / 2, cs - gap, cs * 0.14, bleed * 0.8));
  }

  // ---- v9 light (src/render/court.ts): soft textures baked at ½ res; draw with displayK(cs)

  /** Display scale for a ½-res light texture of a cell of cs px. */
  lightK(cs: number): number {
    return cs / Math.max(4, Math.round(cs * LIGHT_BAKE));
  }

  /** Falloff (multiply) texture: d = 0 the lantern's own cell, d ≥ 1 a ray cell (light travelling +x). */
  falloff(cs: number, d: number): string {
    const w = Math.max(4, Math.round(cs * LIGHT_BAKE));
    const dd = Math.min(8, d);
    return this.canvas(`fall${dd}@${cs}`, w, w, (ctx, a) => (dd === 0 ? paintSrcFalloff(ctx, a) : paintRayFalloff(ctx, a, dd)));
  }

  /** Warm haze over a lit cell (ADD), BLOOM_K cells wide; `amp` 0.27 play, stronger for the finale wave. */
  bloom(cs: number, amp = 0.27): string {
    const w = Math.max(4, Math.round(cs * BLOOM_K * LIGHT_BAKE * 0.5));
    return this.canvas(`bloom${amp}@${cs}`, w, w, (ctx, a) => paintBloom(ctx, a, amp));
  }

  /** Display scale of bloom(cs). */
  bloomK(cs: number): number {
    return (cs * BLOOM_K) / Math.max(4, Math.round(cs * BLOOM_K * LIGHT_BAKE * 0.5));
  }

  /** Lantern pool (ADD), POOL_R cells radius; display scale = poolK(cs). */
  pool(cs: number): string {
    const w = Math.round(cs * POOL_R * 2 * LIGHT_BAKE);
    return this.canvas(`pool@${cs}`, w, w, (ctx, a) => paintPool(ctx, a));
  }

  poolK(cs: number): number {
    return (cs * POOL_R * 2) / Math.round(cs * POOL_R * 2 * LIGHT_BAKE);
  }

  /** Rim light on a plain rock (light from −x); display scale = rockRimK(cs). */
  rockRim(cs: number): string {
    const rr = cs * 0.43;
    const w = Math.ceil(rr * RIM_K * LIGHT_BAKE);
    return this.canvas(`rockRim@${cs}`, w, w, (ctx, a) => paintRockRim(ctx, a, rr * LIGHT_BAKE));
  }

  rockRimK(cs: number): number {
    return (cs * 0.43 * RIM_K) / Math.ceil(cs * 0.43 * RIM_K * LIGHT_BAKE);
  }

  /** Rim light on a marker stone's face for light travelling `dir` (0 +x, 1 −x, 2 +y, 3 −y). */
  markerRim(cs: number, dir: number): string {
    const w = Math.max(4, Math.round(cs * LIGHT_BAKE));
    return this.canvas(`markRim${dir}@${cs}`, w, w, (ctx, a) => paintMarkerRim(ctx, a, dir));
  }

  /** Soft contact shadow under a board lantern. */
  contactShadow(cs: number): string {
    const w = Math.round(cs * 0.74);
    const h = Math.round(cs * 0.24);
    return this.canvas(`lanShadow@${cs}`, w, h, (ctx, a, b) => paintContactShadow(ctx, a, b));
  }

  dbl(cs: number, gap: number): string {
    return this.canvas(`dbl@${cs}`, cs, cs, (ctx, w) => drawDoubleTile(ctx, w / 2, w / 2, cs - gap, cs * 0.14));
  }

  dark(cs: number, gap: number, u: number): string {
    const pad = Math.round(4 * u);
    return this.canvas(`dark@${cs}`, cs + pad * 2, cs + pad * 2, (ctx, w) => drawDarkHint(ctx, w / 2, w / 2, cs - gap, cs * 0.14, Math.max(1.5, 1.6 * u)));
  }

  flower(size: number, variant: number): string {
    const v = variant % FLOWER_COLORS.length;
    return this.canvas(`flower${v}@${size}`, size, size, (ctx, w) => drawFlower(ctx, w / 2, w / 2, w * 0.46, FLOWER_COLORS[v]!, -Math.PI / 2));
  }

  /**
   * The Duskwick numerals as a texture (plates, result time): cap height `cap` px, ink colour,
   * optional light lip. Bold Text = heavier strokes (key carries vis.sig).
   */
  numerals(text: string, cap: number, ink = "#1E1A33", lip: string | null = null): string {
    const c = Math.max(4, Math.round(cap));
    const wt = vis.p.boldText ? 1.25 : 1.08;
    const w = Math.ceil(numeralWidth(text, c, wt) + c * 0.2);
    const h = Math.ceil(c * 1.45);
    return this.canvas(`num:${text}:${ink}:${lip ?? ""}${vis.sig}@${c}`, w, h, (ctx, cw, ch) => drawNumerals(ctx, text, cw / 2, ch / 2, c, ink, lip, wt));
  }

  /** Lantern body, `h` px tall; glow 0 (basket, cool paper) .. 1 (lit on the board). */
  lantern(h: number, glow: number): string {
    return this.canvas(`lantern${glow}@${h}`, h * 0.8, h, (ctx, _w, hh) => drawLantern(ctx, hh, glow));
  }

  flame(size: number, moon: boolean): string {
    return this.canvas(`${moon ? "flameMoon" : "flame"}@${size}`, size, size, (ctx, w) =>
      drawGlow(ctx, w / 2, w / 2, w / 2, moon ? GLOW.flameMoon : GLOW.flame));
  }

  halo(size: number): string {
    return this.canvas(`halo@${size}`, size, size, (ctx, w) => drawGlow(ctx, w / 2, w / 2, w / 2, GLOW.halo));
  }

  /** Moonlight ring (pulses) or, with `conflict`, the cool ring around lanterns that see each other. */
  ring(size: number, u: number, conflict = false): string {
    return this.canvas(`${conflict ? "cring" : "ring"}@${size}`, size, size, (ctx, w) =>
      drawRing(ctx, w / 2, w / 2, w / 2, Math.max(1.5, (conflict ? 2.4 : 1.8) * u), conflict ? PAL.conflict : PAL.moon));
  }

  firefly(size: number): string {
    return this.canvas(`firefly@${size}`, size, size, (ctx, w) => drawGlow(ctx, w / 2, w / 2, w / 2, GLOW.firefly));
  }

  star(size: number): string {
    return this.canvas(`star@${size}`, size, size, (ctx, w) => {
      drawGlow(ctx, w / 2, w / 2, w / 2, GLOW.star);
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillRect(w / 2 - w * 0.03, 0, w * 0.06, w);
      ctx.fillRect(0, w / 2 - w * 0.03, w, w * 0.06);
    });
  }

  smoke(size: number): string {
    return this.canvas(`smoke@${size}`, size, size, (ctx, w) => drawGlow(ctx, w / 2, w / 2, w / 2, GLOW.smoke));
  }

  windowGlow(size: number): string {
    return this.canvas(`winGlow@${size}`, size, size, (ctx, w) => drawGlow(ctx, w / 2, w / 2, w / 2, GLOW.window));
  }

  litWindow(w: number, h: number, round: boolean, glass?: "lantern"): string {
    if (glass === "lantern") {
      // a lantern-house window: round warm glass + its spill (render/village/lanternHouse.ts)
      const c = Math.round(w * 2.6);
      return this.canvas(`litWinL@${Math.round(w)}`, c, c, (ctx, a, b) => drawLanternGlass(ctx, a, b, w));
    }
    const cw = Math.round(w * 2.6);
    const ch = Math.round(h * 2.2 + w * 0.6);
    return this.canvas(`litWin${round ? "R" : ""}@${Math.round(w)}x${Math.round(h)}`, cw, ch, (ctx, a, b) => drawLitWindow(ctx, a, b, w, h, round));
  }

  /** The number 0–4 of a numbered stone in a cell of `cs` px, as a digit or dice pips; draw centred on the stone face. */
  number(cs: number, n: number, tone: NumTone, style: NumberStyle): string {
    const size = Math.round(cs * 0.8);
    return this.canvas(`num-${style}${n}${tone}${vis.sig}@${cs}`, size, size, (ctx, w) =>
      style === "dots" ? drawPips(ctx, w / 2, w / 2, cs, n, tone) : drawDigit(ctx, w / 2, w / 2, cs, n, tone));
  }

  /** y offset of the number face from the cell centre. */
  numberOffsetY(cs: number): number {
    return pipGeom(cs).oy;
  }

  stoneVeil(cs: number, u: number): string {
    const size = Math.round(cs * 1.08);
    return this.canvas(`veil@${cs}`, size, size, (ctx, w) => drawStoneVeil(ctx, w / 2, w / 2, cs, Math.max(1.5, 2 * u)));
  }

  stoneOutline(cs: number, u: number): string {
    const size = Math.round(cs * 1.08);
    return this.canvas(`stoneOut@${cs}`, size, size, (ctx, w) => drawStoneOutline(ctx, w / 2, w / 2, cs, Math.max(1.2, 1.5 * u)));
  }

  /** Stuck dark cell: dim crossed-out sparkle (round 4; not the hint's ghost, not a ring). */
  blockedMark(cs: number, u: number): string {
    const size = Math.round(cs * 0.86);
    return this.canvas(`blockedMark${vis.sig}@${cs}`, size, size, (ctx, w) => drawBlockedMark(ctx, w, Math.max(1.6, 1.9 * u)));
  }

  conflictX(size: number): string {
    return this.canvas(`conflictX2${vis.sig}@${size}`, size, size, (ctx, w) => drawConflictX(ctx, w));
  }

  /** "Too many" tag (minus + lantern), h px tall, 1.75 h wide. */
  overMark(h: number): string {
    return this.canvas(`overMark2@${h}`, Math.round(h * 1.75), h, (ctx, w, hh) => drawOverMark(ctx, w, hh));
  }

  /** Today's calendar tile (day of month + moon phase bucketed to 1/30). */
  /**
   * The HUD's "today" button (r6: 6/8 never found the daily behind the moon): today's calendar
   * tile; `done` adds a gold check badge on its corner (today's daily solved).
   */
  todayTile(w: number, day: number, p: number, done: boolean, u: number): string {
    const h = Math.round(w * 1.12);
    const b = Math.round((((p % 1) + 1) % 1) * 30) % 30;
    return this.canvas(`today${day}-${b}-${done ? 1 : 0}${vis.sig}@${w}`, w, h, (ctx, cw, ch) => {
      drawCalendarTile(ctx, cw, ch, day, b / 30, u);
      if (done) drawDoneBadge(ctx, cw - cw * 0.17, ch - ch * 0.2, cw * 0.2);
    });
  }

  calendar(w: number, day: number, p: number, u: number): string {
    const h = Math.round(w * 1.12);
    const b = Math.round((((p % 1) + 1) % 1) * 30) % 30;
    return this.canvas(`cal${day}-${b}${vis.sig}@${w}`, w, h, (ctx, cw, ch) => drawCalendarTile(ctx, cw, ch, day, b / 30, u));
  }

  /** Streak shield: the town's covered lantern (phase 2; v6 was an umbrella). */
  shield(size: number, lit: boolean): string {
    return this.canvas(`shieldKeep${lit ? 1 : 0}@${size}`, size, size, (ctx, w) => drawShield(ctx, w, lit));
  }

  takeBack(size: number): string {
    return this.canvas(`takeBack@${size}`, size, size, (ctx, w) => drawTakeBack(ctx, w));
  }

  streetIcon(size: number): string {
    return this.canvas(`street${vis.sig}@${size}`, size, size, (ctx, w) => drawStreetIcon(ctx, w));
  }

  farTower(w: number, h: number): string {
    return this.canvas(`farTower@${w}x${h}`, w, h, (ctx, cw, ch) => drawFarTower(ctx, cw, ch));
  }

  farHome(w: number, h: number): string {
    return this.canvas(`farHome@${w}x${h}`, w, h, (ctx, cw, ch) => drawFarHome(ctx, cw, ch));
  }

  /** Moon with phase p (bucketed to 1/30), with or without its sky glow. */
  moon(size: number, p: number, glow = true): string {
    const b = Math.round((((p % 1) + 1) % 1) * 30) % 30;
    return this.canvas(`moon${glow ? "G" : ""}${b}@${size}`, size, size, (ctx, w) => drawMoonPhase(ctx, w, b / 30, glow));
  }

  undoIcon(size: number): string {
    return this.canvas(`undo${vis.sig}@${size}`, size, size, (ctx, w) => drawUndoIcon(ctx, w));
  }

  /** THE house button (daily way home, result sheet, town). */
  homeButton(size: number): string {
    return this.canvas(`homeBtn${vis.sig}@${size}`, size, size, (ctx, w) => drawHomeButton(ctx, w));
  }

  /** Wordless "30-minute ad break" chip: moon + pause. */
  breakChip(size: number): string {
    return this.canvas(`breakChip${vis.sig}@${size}`, size, size, (ctx, w) => drawBreakChip(ctx, w));
  }

  /** ✨ "no hints" mark (same meaning as in the share text). */
  sparkles(size: number): string {
    return this.canvas(`sparkles@${size}`, size, size, (ctx, w) => drawSparkles(ctx, w));
  }

  glyph(kind: "watch" | "flame" | "share", size: number): string {
    return this.canvas(`glyph-${kind}@${size}`, size, size, (ctx, w) => {
      if (kind === "watch") drawStopwatch(ctx, w);
      else if (kind === "flame") drawStreakFlame(ctx, w, true);
      else drawShareGlyph(ctx, w, PAL.moon);
    });
  }

  finger(h: number): string {
    return this.canvas(`finger@${h}`, h * 0.8, h, (ctx, _w, hh) => drawFinger(ctx, hh));
  }

  ripple(size: number, u: number): string {
    return this.canvas(`ripple@${size}`, size, size, (ctx, w) => drawTapRipple(ctx, w, Math.max(2, 2.4 * u)));
  }

  chevron(size: number): string {
    return this.canvas(`chevron@${size}`, size, size, (ctx, w) => drawChevron(ctx, w));
  }

  gear(size: number): string {
    return this.canvas(`gear${vis.sig}@${size}`, size, size, (ctx, w) => drawGear(ctx, w));
  }

  ghost(h: number): string {
    return this.canvas(`ghost@${h}`, h * 0.8, h, (ctx, _w, hh) => drawGhostLantern(ctx, hh));
  }

  coolHalo(size: number): string {
    // normal blend (lanterns stand on bright lit tiles, where an additive glow would vanish):
    // a soft cool band around the lantern, clear in the middle
    // phase 2 (audit P1-7): a dark navy band on both sides of the cool band keeps it ≥ 3:1 on lit floor
    return this.canvas(`coolHalo2@${size}`, size, size, (ctx, w) =>
      drawGlow(ctx, w / 2, w / 2, w / 2, [
        [0, "rgba(10,14,36,0)"], [0.38, "rgba(10,14,36,0)"], [0.44, "rgba(10,14,36,0.75)"], [0.52, "rgba(96,140,196,0.95)"],
        [0.64, "rgba(190,220,248,0.95)"], [0.72, "rgba(10,14,36,0.75)"], [0.84, "rgba(10,14,36,0.3)"], [1, "rgba(10,14,36,0)"],
      ]));
  }

  /** Coral rim (lanterns that see each other / touch a number with too many): same shape as coolHalo. */
  coralHalo(size: number): string {
    return this.canvas(`coralHalo@${size}`, size, size, (ctx, w) =>
      drawGlow(ctx, w / 2, w / 2, w / 2, [
        [0, "rgba(242,144,122,0)"], [0.4, "rgba(242,144,122,0)"], [0.56, "rgba(214,98,74,0.9)"],
        [0.7, "rgba(255,194,176,0.8)"], [0.86, "rgba(255,194,176,0.3)"], [1, "rgba(255,194,176,0)"],
      ]));
  }

  /** Ring in an arbitrary colour (hint anchors: warm on a stone, moonlight on a dark cell). */
  ringColor(size: number, u: number, color: string): string {
    return this.canvas(`ring${color}@${size}`, size, size, (ctx, w) => drawRing(ctx, w / 2, w / 2, w / 2, Math.max(2, 2.6 * u), color));
  }

  hintIcon(size: number, mode: "ask" | "lift", dots = 0, attn = false): string {
    return this.canvas(`hint-${mode}${dots}${attn ? "a" : ""}${vis.sig}@${size}`, size, size, (ctx, w) => drawHintIcon(ctx, w, mode, dots, attn));
  }

  trackIcon(size: number, to: "deduce" | "gentle"): string {
    return this.canvas(`track-${to}${vis.sig}@${size}`, size, size, (ctx, w) => drawTrackIcon(ctx, w, to));
  }

  // ---- v12 Wick (src/render/wick.ts, decision A4): each baked on first use — never on the boot path

  /** Wick's body + face, size × size (ground contact at 50 %, 92 %). blink is quantised to open / half / shut. */
  wick(size: number, expr: WickExpr, blink = 0, arms: "up" | "wave" | null = null): string {
    const b = blink >= 0.75 ? 2 : blink >= 0.3 ? 1 : 0;
    return this.canvas(`wick:${expr}:${b}:${arms ?? "-"}@${size}`, size, size, (ctx, w) => drawWickBody(ctx, w, { expr, blink: b / 2, arms }));
  }

  /** Wick's floating flame (origin = its base: flameBox(size).ox / oy). */
  wickFlame(size: number): string {
    const b = flameBox(size);
    return this.canvas(`wickFlame@${size}`, b.w, b.h, (ctx) => drawWickFlame(ctx, size));
  }

  /** Wick's soft ground shadow, w px wide. */
  wickShadow(w: number): string {
    const h = Math.max(2, Math.round(w * 0.16));
    return this.canvas(`wickShadow@${w}`, w, h, (ctx) => drawWickShadow(ctx, w, h));
  }

  /** A board lantern's face (with its cream underlay), w × w; look −1 / 0 / 1. */
  lanternFace(w: number, expr: FaceExpr, look = 0): string {
    return this.canvas(`lface:${expr}:${look}@${w}`, w, w, (ctx) => drawLanternFace(ctx, w, expr, look));
  }
}
