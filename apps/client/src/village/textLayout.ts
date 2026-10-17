// Text boxes of the village (pt), shared by the scene and the G3 overflow tests.
// The narrowest supported phone is 375 pt (iPhone SE); boxes scale with the screen width.
import type { Lang } from "../a11y/strings.ts";
import { type Fit, fitText } from "./wrap.ts";

export const SE_WIDTH = 375;
/** Dialogue card: 16 pt from the screen edges, 18 pt inside; 1–3 lines, height follows. */
export const CARD = { margin: 14, pad: 16, nameH: 26, lineH: 1.3, maxLines: 3, sizes: [18, 17, 16, 15] as const, portrait: 46, portraitGap: 10 };
/** Letter paper: 22 pt from the edges, 24 pt inside; greeting + 1–2 body lines + signature. */
export const LETTER = { margin: 22, pad: 24, lineH: 1.5, maxLines: 9, sizes: [18, 17, 16] as const };
/** Gift tag under the revealed gift: up to 2 lines. */
export const TAG = { width: 260, maxLines: 2, sizes: [16, 15, 14] as const };
/** Drawer card name: 2 lines in a card a quarter of the drawer wide. */
export const CARD_NAME = { maxLines: 2, sizes: [13, 12, 11, 10, 9.5] as const };
/** a locked card's "how to get it" line under the name (G8): 2 lines, 11 → 9.5 pt */
export const CARD_SOURCE = { maxLines: 2, sizes: [11, 10, 9.5] as const };
/** drawer tab chips: 5 across, one line preferred */
export const TAB = { sizes: [13, 12, 11, 10] as const };
export const drawerTabW = (screenW: number): number => (screenW - 32 - 8 * 4) / 5 - 8;
/** Buttons (pills): one line. Widths (pt, inside padding excluded): the gift's two, the letter's, the drawer's two actions. */
export const PILL_W = { gift: 256, letter: 236, action: (screenW: number): number => (screenW - 32 - 8) / 2 - 16 };
export const PILL = { maxLines: 1, sizes: [17, 16, 15, 14, 13, 12] as const };

/** text column of the dialogue card: right of the speaker's portrait (Reality G1 #1) */
export const cardTextW = (screenW: number): number => Math.min(screenW, 560) - 2 * (CARD.margin + CARD.pad) - CARD.portrait - CARD.portraitGap;
/** the paper (screen minus margins); text sits between the kit's ruled-line margins (9 % / 91 %) */
export const letterPaperW = (screenW: number): number => Math.min(screenW, 520) - 2 * LETTER.margin;
export const letterTextW = (screenW: number): number => letterPaperW(screenW) * 0.82;
/** Gaegu Regular (the Korean handwriting face): 1.03 × (Reality G1 #5) */
export const letterScale = (lang: string): number => (lang === "ko" ? 1.03 : 1);
/**
 * Letter tracking (em): Gaegu's side bearings are wide — −0.04 em (≈ −1 px) was invisible (G1 re-review 2 #4),
 * so Korean letters are set at −0.10 em. Drawn with canvas letterSpacing, or glyph by glyph where it is
 * unsupported (letterText.ts), and measured the same way (fitLetter).
 */
export const letterTrackingEm = (lang: string): number => (lang === "ko" ? -0.1 : 0);
export const letterTracking = (lang: string): string => `${letterTrackingEm(lang)}em`;
export const drawerCardW = (screenW: number): number => (Math.min(screenW, 600) - 16 * 2 - 8 * 3) / 4 - 4;

export type MeasureAt = (size: number) => (s: string) => number;

/** sizes × Dynamic Type (iOS body scale, capped 1.6) */
const scaled = (sizes: readonly number[], scale: number): number[] => sizes.map((s) => Math.round(s * Math.max(1, Math.min(1.6, scale)) * 10) / 10);

/** 1–3 lines at the default text size; large Dynamic Type sizes may take up to 5 (the card grows). */
export const cardMaxLines = (scale: number): number => (scale > 1.2 ? 5 : CARD.maxLines);
export function fitDialogue(text: string, screenW: number, scale: number, measureAt: MeasureAt, lang?: string): Fit {
  return fitText(text, { maxW: cardTextW(screenW), maxLines: cardMaxLines(scale), sizes: scaled(CARD.sizes, scale), measureAt, ...(lang ? { lang } : {}) });
}
export function fitLetter(text: string, screenW: number, scale: number, measureAt: MeasureAt, lang = "en"): Fit {
  // the line width includes the letter's tracking (ko), as drawn
  const em = letterTrackingEm(lang);
  const at: MeasureAt = em ? (size) => trackedMeasure(measureAt(size), em * size) : measureAt;
  return fitText(text, { maxW: letterTextW(screenW), maxLines: LETTER.maxLines, sizes: scaled(LETTER.sizes, scale).map((x) => Math.round(x * letterScale(lang) * 10) / 10), measureAt: at, lang });
}
export function fitTag(text: string, scale: number, measureAt: MeasureAt, lang?: string): Fit {
  // large Dynamic Type: the tag may take a third line (as the dialogue card grows)
  return fitText(text, { maxW: TAG.width, maxLines: scale > 1.2 ? 3 : TAG.maxLines, sizes: scaled(TAG.sizes, scale), measureAt, ...(lang ? { lang } : {}) });
}
export function fitCardSource(text: string, screenW: number, measureAt: MeasureAt, lang?: string): Fit {
  return fitText(text, { maxW: drawerCardW(screenW) - 18, maxLines: CARD_SOURCE.maxLines, sizes: CARD_SOURCE.sizes, measureAt, ...(lang ? { lang } : {}) });
}
export function fitTab(text: string, screenW: number, measureAt: MeasureAt, maxLines = 2, lang?: string): Fit {
  return fitText(text, { maxW: drawerTabW(screenW), maxLines, sizes: TAB.sizes, measureAt, ...(lang ? { lang } : {}) });
}

export function fitCardName(text: string, screenW: number, measureAt: MeasureAt, lang?: string): Fit {
  return fitText(text, { maxW: drawerCardW(screenW), maxLines: CARD_NAME.maxLines, sizes: CARD_NAME.sizes, measureAt, ...(lang ? { lang } : {}) });
}
export function fitPill(text: string, width: number, scale: number, measureAt: MeasureAt, lang?: string): Fit {
  return fitText(text, { maxW: width, maxLines: PILL.maxLines, sizes: scaled(PILL.sizes, Math.min(scale, 1.3)), measureAt, ...(lang ? { lang } : {}) });
}

/** A measure that adds `trackPx` between graphemes (what letterSpacing / the per-glyph fallback draws). */
export function trackedMeasure(m: (s: string) => number, trackPx: number): (s: string) => number {
  return (s) => {
    const n = [...s].length;
    return m(s) + (n > 1 ? trackPx * (n - 1) : 0);
  };
}

/**
 * A letter's signature ("— Momo", "– Momo", "—— 桃桃") always goes on its own right-aligned last line
 * (Reality G1 re-review 2 #5: the German "– Momo" stuck to the body). The dash must stand alone
 * (spaces around it, or a full-width dash), so a hyphenated word is never taken for one.
 */
export function splitSignature(text: string): { body: string; signature: string } {
  const lines = text.split("\n");
  const last = lines.at(-1) ?? "";
  // the LAST dash token on the last line: "—"/"——" (may touch the text before it), "–"/"-" (spaces on both sides)
  const em = /(——?)\s*(\S[^—\n]*)$/u.exec(last);
  const en = /(^|\s)([–-]\s+)(\S[^—–]*)$/u.exec(last);
  const m = em ?? en;
  if (!m) return { body: text, signature: "" };
  const cut = m === em ? m.index : m.index + m[1]!.length;
  const sig = last.slice(cut).trim();
  const head = last.slice(0, cut).replace(/\s+$/, "");
  const body = [...lines.slice(0, -1), ...(head ? [head] : [])].join("\n");
  return { body, signature: sig };
}

/** Card height (pt) for a fit: name tag above + lines + padding. */
export const cardHeight = (f: Fit): number => Math.max(CARD.pad * 2 + CARD.portrait, CARD.pad * 2 + Math.ceil(f.lines.length * f.size * CARD.lineH));

// ---------------------------------------------------------------- G3 test strings

/**
 * The strings G3 renders for a locale: its own lines when the locale file exists, else the English
 * fallback; Latin locales also get pseudo-localized English (+40 %), CJK locales kinsoku-heavy
 * stand-ins at the narrative's 30-character limit until their real lines land.
 */
export function g3Strings(lang: Lang, own: readonly string[], en: readonly string[]): string[] {
  if (own.length) return [...own]; // the locale's real lines
  // no file for this locale (yet): its English fallback, and stand-ins at realistic lengths / scripts
  if (lang === "ja") return [...en, ...JA_PROBES];
  if (lang === "zh-Hans") return [...en, ...ZHS_PROBES];
  if (lang === "zh-Hant") return [...en, ...ZHT_PROBES];
  if (lang === "de" || lang === "fr" || lang === "es" || lang === "pt-BR" || lang === "it") return [...en, ...en.map(pseudo)];
  return [...en];
}

const ACC: Record<string, string> = { a: "ä", e: "é", i: "î", o: "ö", u: "ü", A: "Å", E: "É", O: "Ö", U: "Ü", c: "ç", n: "ñ" };
/** +40 % per word (German compounds / French elisions), accented. */
export function pseudo(s: string): string {
  return s
    .split("\n")
    .map((p) => p.split(" ").map((w) => {
      const core = [...w].map((c) => ACC[c] ?? c).join("");
      const extra = Math.ceil([...w].length * 0.4);
      return core + "ẍ".repeat(extra);
    }).join(" "))
    .join("\n");
}

export const JA_PROBES = [
  "「ちょっと待ってね。」ランタンがゆっくり灯りましたよ。ぽっ！",
  "あなたが灯した明かりのそばに、だれかの家ができますよ。",
  "えっと…こんにちは。モモです。ここの練習、しましたよ。ひゃっ。",
  "ふぁ〜…まだ起きてるんですか？コケももう寝てますよ。",
  "きらっ！上を見て。もっと上。そこ、そこですよ、ほら。",
  "やったー！ぴょん！ぴょん！できるって思ってたよ！",
  "ねえ、聞いてもいい？あなたが来てくれるのが、うれしいです。",
];
export const ZHS_PROBES = [
  "欢迎。这是我们的小镇。现在还很小，不过会慢慢变大的。",
  "你点亮的每一盏灯旁边，都会有人住进新家。啵。",
  "嗯……你好。我是桃桃。这一段我练习过了。呀！",
  "哈啊～……你还没睡吗？连青苔都已经睡着了哦。",
  "闪闪！往上看。再往上一点。就在那里，看到了吗？",
  "「等一下。」灯笼慢慢地亮起来了，真好看呀！",
];
export const ZHT_PROBES = [
  "歡迎。這是我們的小鎮。現在還很小，不過會慢慢變大的。",
  "你點亮的每一盞燈旁邊，都會有人住進新家。啵。",
  "嗯……你好。我是桃桃。這一段我練習過了。呀！",
  "哈啊～……你還沒睡嗎？連青苔都已經睡著了喔。",
  "閃閃！往上看。再往上一點。就在那裡，看到了嗎？",
  "「等一下。」燈籠慢慢地亮起來了，真好看呀！",
];

/** Japanese-like pseudo text: kana / kanji at about half the Latin length, full-width punctuation. */
const KANA = "らんたんのあかりがともりましたよ。ゆっくりおやすみなさい、またあした灯をともしましょう";
export function pseudoJa(s: string): string {
  return s
    .split("\n")
    .map((p) => {
      let out = "";
      let k = 0;
      for (const w of p.split(" ")) {
        const n = Math.max(1, Math.ceil(w.replace(/[^\p{L}]/gu, "").length * 0.55));
        for (let i = 0; i < n; i++) out += KANA[(k++ * 7) % KANA.length];
        const end = /[.!?,…]$/.exec(w)?.[0];
        if (end) out += ({ ".": "。", "!": "！", "?": "？", ",": "、", "…": "…" } as Record<string, string>)[end]!;
      }
      return out;
    })
    .join("\n");
}
