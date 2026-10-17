// Line breaking for the village's shown words (dialogue card, letters, tags, drawer names) —
// gate G3: never overflow, no orphans, Japanese / Chinese kinsoku. Pure: the caller passes a
// measure function (canvas measureText in the app, a width model in unit tests).
//   Latin / Hangul   break at spaces (Korean keeps words whole, as Korean typesetting does);
//                    a word wider than the line is cut between characters (last resort)
//   CJK              a break is allowed between any two characters, except
//                    before a closing / small-kana / prolonged-sound mark (行頭禁則) and
//                    after an opening bracket (行末禁則); Latin runs inside stay whole
//   balance          the greedy line count at the narrowest width that keeps it, so the last
//                    line is never a lone word / character
//   fit              the largest size from `sizes` whose lines fit maxLines × maxW; if none does,
//                    the smallest size with the overflow cut and "…" (fits: false — tests fail on it)
import type { Lang } from "../a11y/strings.ts";

/** may not start a line */
export const NO_START = new Set([..."、。，．・：；？！!?,.:;)）]］｝〕〉》」』】〙〗〟’”»ゝゞーァィゥェォッャュョヮヵヶぁぃぅぇぉっゃゅょゎ々〻…‥〜～%％‐゠–"]);
/** may not end a line */
export const NO_END = new Set([..."(（[［｛〔〈《「『【〘〖〝‘“«"]);
const CJK_RE = /[⺀-⿟　-〿぀-ヿ㄀-ㄯㆠ-ㇿ㐀-䶿一-鿿豈-﫿︰-﹏＀-￯]/;
export const isCJKChar = (ch: string): boolean => CJK_RE.test(ch);
const KATAKANA = /^[\u30A1-\u30FA\u30FC]$/;

const HIRA_SHORT = /^[\u3041-\u309F]{1,2}$/;
const PUNCT_SEG = /^[\s\p{P}\p{S}]+$/u;
type Segmenter = { segment(t: string): Iterable<{ segment: string; index: number }> };
const segmenters = new Map<string, Segmenter | null>();
function segmenterFor(lang: string): Segmenter | null {
  if (!segmenters.has(lang)) {
    const I = (globalThis as { Intl?: { Segmenter?: new (l: string, o: { granularity: string }) => Segmenter } }).Intl;
    segmenters.set(lang, I?.Segmenter ? new I.Segmenter(lang, { granularity: "word" }) : null);
  }
  return segmenters.get(lang)!;
}

/**
 * Japanese / Chinese: where a line may break — between phrases, never inside a word (Reality G1 re-review 2:
 * "小 / さなベッド", "びんをた / めると", "ぎゅっ / と"). Intl.Segmenter words (iOS 14.5+), then a short
 * hiragana tail (particles, okurigana, auxiliaries: を, と, です, した …) joins the word before it, and a
 * doubled character (桃桃) stays together; a phrase stops growing at 10 characters. null = no segmenter
 * (the per-character rules apply: katakana words and kinsoku still hold).
 */
export function phraseBreaks(text: string, lang0: string): Set<number> | null {
  // "<lang>:fine" = the segmenter's words without joining (a phrase wider than the whole line)
  const fine = lang0.endsWith(":fine");
  const lang = fine ? lang0.slice(0, -5) : lang0;
  if (lang !== "ja" && lang !== "zh-Hans" && lang !== "zh-Hant") return null;
  const seg = segmenterFor(lang);
  if (!seg) return null;
  const out = new Set<number>();
  let prev = "";
  let len = 0;
  for (const { segment, index } of seg.segment(text)) {
    const n = [...segment].length;
    const join =
      !fine && index > 0 && prev !== "" && !PUNCT_SEG.test(prev) && len + n <= 10 &&
      (HIRA_SHORT.test(segment) || (n === 1 && segment === [...prev].at(-1)));
    if (join) {
      prev += segment;
      len += n;
    } else {
      if (index > 0) out.add(index);
      prev = segment;
      len = n;
    }
  }
  return out;
}

/**
 * Break units: concatenating them gives the text back; a line may break only between two units.
 * A unit keeps its trailing space (dropped at a line end). `lang` (ja / zh) breaks CJK text by phrase.
 */
export function units(text: string, lang?: string): string[] {
  const breaks = lang ? phraseBreaks(text, lang) : null;
  let pos = 0;
  const out: string[] = [];
  let cur = "";
  const flush = (): void => {
    if (cur) out.push(cur);
    cur = "";
  };
  let glue = false; // the previous char may not end a line: the next one stays with it
  for (const ch of text) {
    const at = pos;
    pos += ch.length;
    if (ch === " " || ch === "\u3000") {
      // a (full-width) space ends its unit and disappears at a line end
      if (!cur && out.length) out[out.length - 1] += ch;
      else cur += ch;
      flush();
      glue = false;
      continue;
    }
    if (NO_START.has(ch)) {
      // stays with whatever came before it — except an ellipsis after a space, which leads the next word ("… That's")
      const leads = (ch === "…" || ch === "‥") && /\s$/.test(out.at(-1) ?? "");
      if (cur) cur += ch;
      else if (out.length && !leads) out[out.length - 1] += ch;
      else cur = ch;
      glue = NO_END.has(ch);
      continue;
    }
    const cjk = isCJKChar(ch);
    const last = cur !== "" ? [...cur].at(-1)! : "";
    const prevCJK = last !== "" && isCJKChar(last);
    // a katakana word (a name: モモ, ウィック) stays whole, like a Latin word (up to 10 chars)
    const kanaRun = KATAKANA.test(ch) && KATAKANA.test(last) && [...cur].length < 10;
    // a break chance around every CJK char — or, with a segmenter, only between phrases
    if (!glue && !kanaRun && cur && (cjk || prevCJK) && (!breaks || breaks.has(at))) flush();
    cur += ch;
    glue = NO_END.has(ch);
  }
  flush();
  return out;
}

/**
 * Greedy lines of one paragraph at width maxW. A Latin / Hangul word is NEVER broken inside
 * (Reality G1 #18: "Arche / d chair"): a word wider than the line stays whole and overflows, so the
 * caller shrinks the text instead. `cut` (the very last resort of fitText only) splits it.
 */
export function greedy(measure: (s: string) => number, text: string, maxW: number, cut = false, lang?: string): string[] {
  const us = units(text, lang);
  const lines: string[] = [];
  let line = "";
  for (const u of us) {
    const next = line + u;
    if (line && measure(next.trimEnd()) > maxW) {
      lines.push(line.trimEnd());
      line = u;
    } else line = next;
    // last resort only: a unit wider than the whole line cut between characters
    while (cut && measure(line.trimEnd()) > maxW && [...line.trimEnd()].length > 1) {
      const cs = [...line.trimEnd()];
      let k = cs.length - 1;
      while (k > 1 && measure(cs.slice(0, k).join("")) > maxW) k--;
      // keep kinsoku: do not start the rest with a no-start char
      while (k > 1 && NO_START.has(cs[k]!)) k--;
      lines.push(cs.slice(0, k).join(""));
      line = cs.slice(k).join("") + (line.endsWith(" ") ? " " : "");
    }
  }
  if (line.trim() || !lines.length) lines.push(line.trimEnd());
  return lines;
}

/** Balanced: the greedy count at the narrowest width keeping it (no lone last word / character). */
export function balanced(measure: (s: string) => number, text: string, maxW: number, lang?: string): string[] {
  const first = greedy(measure, text, maxW, false, lang);
  if (first.length < 2) return first;
  let lo = maxW / first.length;
  let hi = maxW;
  let best = first;
  for (let i = 0; i < 10; i++) {
    const mid = (lo + hi) / 2;
    const t = greedy(measure, text, mid, false, lang);
    if (t.length <= first.length && t.every((l) => measure(l) <= mid + 0.01)) {
      best = t;
      hi = mid;
    } else lo = mid;
  }
  return best;
}

/** Greedy from the end: the last line is full, the first one takes the rest (orphan escape). */
export function greedyFromEnd(measure: (s: string) => number, text: string, maxW: number, lang?: string): string[] {
  const us = units(text, lang);
  const lines: string[] = [];
  let line = "";
  for (let i = us.length - 1; i >= 0; i--) {
    const u = us[i]!;
    const next = u + line;
    if (line && measure(next.trimEnd()) > maxW) {
      lines.unshift(line.trimEnd());
      line = u;
    } else line = next;
  }
  if (line.trim() || !lines.length) lines.unshift(line.trimEnd());
  return lines;
}

/** Balanced, and never a lone last word when the same line count allows another split. */
export function wrapLines(measure: (s: string) => number, text: string, maxW: number, lang?: string): string[] {
  const b = balanced(measure, text, maxW, lang);
  if (!isOrphan(b, text)) return b;
  const r = greedyFromEnd(measure, text, maxW, lang);
  return r.length <= b.length && r.every((l) => measure(l) <= maxW + 0.01) && !isOrphan(r, text) ? r : b;
}

/** All paragraphs ("\n" = a hard break, letters). */
export function wrapParas(measure: (s: string) => number, text: string, maxW: number, lang?: string): string[] {
  return text.split("\n").flatMap((p) => wrapLines(measure, p, maxW, lang));
}

/** The words of a Latin / Hangul text survive wrapping whole (no line holds part of a word). */
export function wordsWhole(text: string, lines: readonly string[]): boolean {
  const words = new Set(text.split(/[\s\n]+/).filter(Boolean));
  return lines.every((l) => l.split(/\s+/).filter(Boolean).every((w) => words.has(w) || [...w].some(isCJKChar)));
}

/** A lone last line: one unit (Latin word) or ≤ 2 visible CJK characters, after ≥ 2 lines. */
export function isOrphan(lines: readonly string[], text: string): boolean {
  if (lines.length < 2 || text.includes("\n")) return false;
  const last = lines.at(-1)!;
  const vis = [...last].filter((c) => !NO_START.has(c) && !NO_END.has(c) && c !== " ");
  if (vis.some(isCJKChar)) return vis.length <= 2 && units(last).length <= 2;
  return units(last).length <= 1 && last.length < 12;
}

export interface Fit {
  size: number;
  lines: string[];
  fits: boolean;
}

/**
 * The largest size from `sizes` (descending) whose wrapped lines fit maxLines × maxW.
 * `measureAt(size)` returns a measure for text at that size.
 */
export function fitText(text: string, o: { maxW: number; maxLines: number; sizes: readonly number[]; measureAt: (size: number) => (s: string) => number; lang?: string }): Fit {
  let last: Fit | null = null;
  // CJK: phrases first; if no size fits (a phrase wider than the line), the segmenter's finer words
  const passes = o.lang && /^(ja|zh)/.test(o.lang) ? [o.lang, `${o.lang}:fine`] : [o.lang];
  for (const lang of passes) {
    for (const size of o.sizes) {
      const m = o.measureAt(size);
      const lines = wrapParas(m, text, o.maxW, lang);
      const ok = lines.length <= o.maxLines && lines.every((l) => m(l) <= o.maxW + 0.5);
      if (ok) return { size, lines, fits: true };
      last ??= { size, lines, fits: false };
      if (lang === passes[0]) last = { size, lines, fits: false };
    }
  }
  // never overflow: cut (last resort) and end with an ellipsis (a test failure, not a crash)
  const size = last!.size;
  const m = o.measureAt(size);
  const lines = text.split("\n").flatMap((p) => greedy(m, p, o.maxW, true, o.lang)).slice(0, o.maxLines);
  let tail = lines[o.maxLines - 1] ?? "";
  while (tail && m(tail + "…") > o.maxW) tail = [...tail].slice(0, -1).join("");
  if (lines.length) lines[lines.length - 1] = tail + "…";
  return { size, lines, fits: false };
}

/** The canvas font for village text in a language: CJK faces before system-ui, semibold (Reality v2 #14). */
export function villageFont(lang: Lang, px: number, weight = 600): string {
  const cjk = lang === "ja" ? '"Hiragino Sans", "Hiragino Kaku Gothic ProN", ' : lang === "zh-Hans" ? '"PingFang SC", "Heiti SC", ' : lang === "zh-Hant" ? '"PingFang TC", "Heiti TC", ' : lang === "ko" ? '"Apple SD Gothic Neo", ' : "";
  return `${weight} ${px}px ui-rounded, "SF Pro Rounded", ${cjk}system-ui, -apple-system, sans-serif`;
}
