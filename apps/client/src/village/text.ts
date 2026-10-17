// Village words: the dialogue lines (lazy JSON per locale) and the village's own UI / VoiceOver
// strings. English + Korean now; the other 8 locales fall back to English until the localization
// pass after the art is final (TODO table: docs/team/village-l10n-todo.md). NOTE gate G3: an
// English fallback is NOT shippable for those locales' village — the l10n pass must land first.
import type { Lang } from "../a11y/strings.ts";
import type { ItemId, ResidentId } from "./catalog.ts";
import { ITEM_NAMES, type Key, RESIDENT_NAMES, TAB_NAMES, UI } from "./strings.ts";
import { pseudoJa, pseudo as pseudoLatin } from "./textLayout.ts";
import type { Line } from "./picker.ts";

/** Every locale has its village text (en / ko final, the other 8 narrative drafts — native review before release). */
export const VILLAGE_LANGS: readonly Lang[] = ["en", "ko", "ja", "de", "fr", "es", "pt-BR", "it", "zh-Hans", "zh-Hant"];
export const villageLang = (l: Lang): Lang => (VILLAGE_LANGS.includes(l) ? l : "en");

export interface LineSet {
  lang: Lang;
  lines: Line[];
  /** the shown text of a line in this locale ({cp} filled in, letters keep "\n") */
  text(l: Line): string;
  cp: Record<string, string>;
}

interface EnFile { cp: Record<string, string>; lines: Line[] }
interface LocFile { cp: Record<string, string>; text: Record<string, string> }

/** one lazy chunk per locale's lines */
const FILES = import.meta.glob<{ default: EnFile | LocFile }>("./lines/*.json");
const cache = new Map<string, Promise<LineSet>>();

/** The line set for a language (dynamic import: the JSON is its own chunk). */
export function loadLines(lang: Lang): Promise<LineSet> {
  const v = villageLang(lang);
  let p = cache.get(v);
  if (!p) {
    p = (async () => {
      const en = (await FILES["./lines/en.json"]!()).default as EnFile;
      const loc = v !== "en" && FILES[`./lines/${v}.json`] ? ((await FILES[`./lines/${v}.json`]!()).default as LocFile) : null;
      const cp = loc?.cp ?? en.cp;
      return {
        lang: v,
        // only the lines this locale has (a missing one is never shown in English, narrative §4)
        lines: loc ? en.lines.filter((l) => loc.text[l.id]) : en.lines,
        cp,
        // a line the locale lacks is never shown in English (narrative §4): the picker skips empty text
        text: (l: Line) => ps(v, (loc ? (loc.text[l.id] ?? "") : l.x).replaceAll("{cp}", cp[l.r] ?? "")),
      };
    })();
    p.catch(() => cache.delete(v));
    cache.set(v, p);
  }
  return p;
}

/** A village string in `lang`. */
export function vt(lang: Lang, key: Key, vars?: Record<string, string | number>): string {
  const s = UI[villageLang(lang)][key] ?? UI.en[key];
  return ps(lang, vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s);
}

export function residentName(lang: Lang, id: ResidentId): string {
  return RESIDENT_NAMES[villageLang(lang)][id];
}
export function itemName(lang: Lang, id: ItemId): string {
  return ps(lang, ITEM_NAMES[villageLang(lang)][id]);
}
export function tabName(lang: Lang, id: string): string {
  return ps(lang, TAB_NAMES[villageLang(lang)][id] ?? TAB_NAMES.en[id] ?? id);
}

/** The drawer's title (Reality G1 #21: plain words, not "Middle row, middle"). */
const DRAWER_TITLE: Record<Lang, string> = {
  en: "Furniture for this spot", ko: "여기에 놓을 가구", ja: "ここに置く家具", de: "Möbel für diesen Platz", fr: "Un meuble pour cet endroit",
  es: "Muebles para este lugar", "pt-BR": "Móveis para este lugar", it: "Mobili per questo posto", "zh-Hans": "放在这里的家具", "zh-Hant": "放在這裡的家具",
};
export function drawerTitle(lang: Lang): string {
  return DRAWER_TITLE[lang] ?? DRAWER_TITLE.en;
}

// ---------------------------------------------------------------- pseudo-locale (e2e captures only)

/**
 * Reality G1 re-review asks for de / fr / ja captures before their translations exist: in the e2e
 * build only, `globalThis.__villagePseudo = true` turns the English fallback of those locales into
 * a pseudo-localization — Latin +40 % with accents, Japanese as kana / kanji at about half the
 * length with full-width punctuation — so the layout meets realistic lengths and scripts.
 */
function pseudoOn(lang: Lang): boolean {
  return import.meta.env.MODE === "e2e" && lang !== "en" && lang !== "ko" && !!(globalThis as { __villagePseudo?: boolean }).__villagePseudo;
}
function ps(lang: Lang, s: string): string {
  if (!pseudoOn(lang)) return s;
  return lang === "ja" || lang === "zh-Hans" || lang === "zh-Hant" ? pseudoJa(s) : pseudoLatin(s);
}
