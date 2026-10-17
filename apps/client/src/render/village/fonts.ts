// The village's fonts (Reality G2). UI: Fredoka 600 (bundled) + the system CJK faces at semibold. Letters:
// the owner-approved handwriting faces, subset per language and renamed (OFL Modified Versions) by
// scripts/subset-letter-fonts.py → public/fonts/letter-<loc>.woff2 + letterGlyphs.json (the manifest):
//   Latin = Patrick Hand · ko = Gaegu Regular (1.03 ×, −0.04 em) · ja = Klee One SemiBold · zh-Hans = LXGW WenKai · zh-Hant = LXGW WenKai TC.
// Loaded lazily from the village chunk only; any failure falls back to Fredoka / the system face.
import GLYPHS from "./letterGlyphs.json";

type Lang = "en" | "de" | "fr" | "es" | "it" | "pt-BR" | "ko" | "ja" | "zh-Hans" | "zh-Hant";

const FREDOKA = { family: "Duskwick Fredoka", file: "fonts/fredoka-latin-600-normal.woff2", weight: "600" };

type Face = { family: string; file: string; weight: string };
const face = (loc: keyof typeof GLYPHS): Face => ({ family: GLYPHS[loc].family, file: GLYPHS[loc].file, weight: "100 900" });
/** The handwriting face for each language's letters (one weight, declared for every weight: no faux bold). */
export const LETTER_FACES: Partial<Record<Lang, Face>> = {
  en: face("latin"),
  de: face("latin"),
  fr: face("latin"),
  es: face("latin"),
  it: face("latin"),
  "pt-BR": face("latin"),
  ko: face("ko"),
  ja: face("ja"),
  "zh-Hans": face("zh-Hans"),
  "zh-Hant": face("zh-Hant"),
};

/** System CJK faces that HAVE a semibold (so 600 renders semibold, not a thin regular — Reality #14). */
export function cjkStack(lang: string): string {
  return lang === "ja"
    ? '"Hiragino Sans", "Hiragino Kaku Gothic ProN", '
    : lang === "zh-Hans"
      ? '"PingFang SC", "Heiti SC", '
      : lang === "zh-Hant"
        ? '"PingFang TC", "Heiti TC", '
        : lang === "ko"
          ? '"Apple SD Gothic Neo", '
          : "";
}

const loaded = new Map<string, Promise<boolean>>();
function loadFace(face: Face): Promise<boolean> {
  let p = loaded.get(face.family);
  if (!p) {
    p = (async (): Promise<boolean> => {
      if (typeof FontFace === "undefined" || typeof document === "undefined" || !document.fonts) return false;
      const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
      const ff = new FontFace(face.family, `url(${base}${face.file}) format("woff2")`, { weight: face.weight, display: "swap" });
      await ff.load();
      document.fonts.add(ff);
      return true;
    })().catch(() => false);
    loaded.set(face.family, p);
  }
  return p;
}

/**
 * The font-family stack for village text in `lang` (UI and letters), after the face is loaded.
 * Latin: Fredoka (bundled); CJK: the system semibold faces; letters: the approved handwriting face if any.
 * Never rejects; falls back to the system rounded face if a file fails.
 */
export async function loadVillageFont(lang: string, purpose: "ui" | "letter" = "ui"): Promise<string> {
  const hand = purpose === "letter" ? LETTER_FACES[lang as Lang] : undefined;
  const okHand = hand ? await loadFace(hand) : false;
  const okFred = await loadFace(FREDOKA);
  const first = okHand && hand ? `"${hand.family}", ` : "";
  const fred = okFred ? `"${FREDOKA.family}", ` : "";
  return `${first}${fred}${cjkStack(lang)}ui-rounded, "SF Pro Rounded", system-ui, -apple-system, sans-serif`;
}

/** Canvas font string (weight 600 by default: Fredoka 600 and the CJK semibold faces match). */
export const villageCanvasFont = (stack: string, px: number, weight = 600): string => `${weight} ${Math.round(px)}px ${stack}`;
