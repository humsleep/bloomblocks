// v11 shown words (playtest/ux-v11.md): one place for the guidance text style — Phaser Text in the
// rounded UI face, ink on paper, sized in canvas px from a point size × Dynamic Type (capped), with a
// wrap that also breaks CJK lines (Phaser's own wrap only breaks at spaces; Japanese has none).
import type PhaserTypes from "phaser";
import { a11y } from "../a11y/index.ts";
import type { Lang } from "../a11y/strings.ts";
import { DIGIT_FONT, rrectPath } from "../render/draw.ts";
import type { TextureBank } from "../render/textures.ts";
import { UI } from "../render/palette.ts";
import { vis } from "../render/vis.ts";

type Text = PhaserTypes.GameObjects.Text;

/** Dynamic Type factor for guidance text: iOS body scale, capped at 1.6 (NOVICE-TEST D10). */
export function textScale(cap = 1.6): number {
  return Math.max(1, Math.min(cap, vis.p.fontScale));
}

/** Guidance text never goes below 17 pt (D10); captions never below 13 pt. */
export const MIN_GUIDE_PT = 17;
export const MIN_CAPTION_PT = 13;

/**
 * v12: the CJK face for the shown words, by language. The rounded UI face has no Han / kana
 * glyphs, so they fall through the family list; naming the right face BEFORE system-ui keeps
 * Taiwan / Hong Kong text in PingFang TC (centred 。，), Simplified in PingFang SC and Japanese in
 * Hiragino, whatever the device's own fallback order is. Latin, digits and Hangul are unchanged.
 */
const CJK_FACE: Partial<Record<Lang, string>> = {
  ja: '"Hiragino Sans", "Hiragino Kaku Gothic ProN"',
  "zh-Hans": '"PingFang SC", "Heiti SC"',
  "zh-Hant": '"PingFang TC", "Heiti TC"',
};

/** The font-family list for guidance text / captions in a language (default: the spoken one). */
export function uiFont(lang: Lang = a11y.lang()): string {
  const face = CJK_FACE[lang];
  return face ? DIGIT_FONT.replace("system-ui", `${face}, system-ui`) : DIGIT_FONT;
}

const CJK = /[　-〿぀-ヿ㐀-鿿豈-﫿＀-￯]/;
/** may not start a line (Japanese / Chinese kinsoku, the common ones) */
const NO_START = /^[、。，．！？!?：；:;）」』〉》】〕ー・…～）]/;

/**
 * Greedy wrap to `maxW` px. Latin / Hangul break at spaces; CJK may break between any two
 * characters (not before closing punctuation). A word longer than a line stays whole (the
 * caller scales the text down to fit then).
 */
export function wrapText(measure: (s: string) => number, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    // tokens: a run of non-space non-CJK chars (+ its trailing space), or one CJK char
    const tokens: string[] = [];
    let cur = "";
    for (const ch of para) {
      if (CJK.test(ch)) {
        if (cur) tokens.push(cur);
        cur = "";
        if (tokens.length > 0 && NO_START.test(ch)) tokens[tokens.length - 1] += ch;
        else tokens.push(ch);
      } else if (ch === " ") {
        tokens.push(cur + " ");
        cur = "";
      } else if (NO_START.test(ch) && !cur && tokens.length > 0) tokens[tokens.length - 1] += ch;
      else cur += ch;
    }
    if (cur) tokens.push(cur);
    let line = "";
    for (const t of tokens) {
      const next = line + t;
      if (line && measure(next.trimEnd()) > maxW) {
        out.push(line.trimEnd());
        line = t.trimStart();
      } else line = next;
    }
    out.push(line.trimEnd());
  }
  return out;
}

/**
 * Balanced wrap: the greedy line count, at the narrowest width that keeps it — "Lanterns can't
 * shine / on each other." instead of a lone "other." on the second line.
 */
export function wrapBalanced(measure: (s: string) => number, text: string, maxW: number): string[] {
  const first = wrapText(measure, text, maxW);
  if (first.length < 2) return first;
  let lo = maxW / first.length;
  let hi = maxW;
  let best = first;
  for (let k = 0; k < 8; k++) {
    const mid = (lo + hi) / 2;
    const t = wrapText(measure, text, mid);
    if (t.length <= first.length && t.every((l) => measure(l) <= mid + 0.5)) {
      best = t;
      hi = mid;
    } else lo = mid;
  }
  return best;
}

export interface TextOpts {
  /** point size before Dynamic Type */
  pt: number;
  /** canvas px per pt */
  u: number;
  color?: string;
  weight?: string;
  align?: "left" | "center" | "right";
  /** wrap width in canvas px (0 = no wrap) */
  wrap?: number;
  /** Dynamic Type cap */
  cap?: number;
}

/** A guidance Text object (origin centre-top unless the caller changes it). */
export function makeText(scene: PhaserTypes.Scene, depth: number): Text {
  return scene.add.text(0, 0, "", { fontFamily: uiFont(), color: UI.ink, align: "center" }).setOrigin(0.5, 0).setDepth(depth).setVisible(false);
}

/** Restyle and set the text (wrapping CJK too). Returns the text's natural size in px. */
export function styleText(t: Text, text: string, o: TextOpts): { w: number; h: number } {
  const fs = Math.round(o.pt * o.u * textScale(o.cap));
  t.setFontFamily(uiFont()).setFontSize(fs).setFontStyle(o.weight ?? vis.weight).setColor(o.color ?? UI.ink).setAlign(o.align ?? "center").setLineSpacing(Math.round(fs * 0.12));
  if (o.wrap && o.wrap > 0) {
    const w = o.wrap;
    t.setWordWrapCallback((s: string, obj: Text) => {
      const ctx = obj.context;
      return wrapBalanced((x) => ctx.measureText(x).width, s, w);
    });
  } else t.setWordWrapCallback(null as unknown as () => string[]);
  t.setScale(1).setText(text);
  // a single unbreakable word wider than the line: shrink it (never below the floor size)
  if (o.wrap && t.width > o.wrap) t.setScale(Math.max(0.8, o.wrap / t.width));
  return { w: t.displayWidth, h: t.displayHeight };
}

/** The primary button: a lantern-gold pill with a darker lip (BENCHMARK-CUTE §3.3), ink label on it. */
export function primaryButton(bank: TextureBank, w: number, h: number, u: number): string {
  return bank.canvas(`btnPrimary${vis.sig}@${Math.round(w)}x${Math.round(h)}`, Math.round(w), Math.round(h + 4 * u), (ctx, cw) => {
    const r = h / 2;
    ctx.fillStyle = UI.primaryLip;
    rrectPath(ctx, 0, 4 * u, cw, h, r);
    ctx.fill();
    ctx.fillStyle = UI.primary;
    rrectPath(ctx, 0, 0, cw, h, r);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    rrectPath(ctx, 6 * u, 3 * u, cw - 12 * u, h * 0.3, h * 0.15);
    ctx.fill();
    if (vis.p.increaseContrast) {
      ctx.strokeStyle = UI.ink;
      ctx.lineWidth = 2 * u;
      rrectPath(ctx, 1 * u, 1 * u, cw - 2 * u, h - 2 * u, r);
      ctx.stroke();
    }
  });
}

/**
 * R2 HUD grammar: the secondary button — an outlined pill (cream 40 %, 1.5 pt), no fill; its label is
 * cream (UI.caption). Skip, Later / Not now, Share. One primary (lantern gold) per screen at most.
 */
export function secondaryPill(bank: TextureBank, w: number, h: number, u: number): string {
  const hc = vis.p.increaseContrast;
  return bank.canvas(`btnSecondary${vis.sig}@${Math.round(w)}x${Math.round(h)}`, Math.round(w), Math.round(h), (ctx, cw, ch) => {
    const lw = Math.max(1, (hc ? 2 : 1.5) * u);
    ctx.strokeStyle = hc ? UI.caption : "rgba(244,235,208,0.4)";
    ctx.lineWidth = lw;
    rrectPath(ctx, lw / 2, lw / 2, cw - lw, ch - lw, (ch - lw) / 2);
    ctx.stroke();
  });
}
