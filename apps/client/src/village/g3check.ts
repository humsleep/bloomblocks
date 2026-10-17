// Gate G3 with the real fonts (e2e only: imported by e2e/bridge.ts, never by the app): every village
// line of every locale (its own translation) wrapped on the 375 pt card / letter / tag, and the
// drawer's words, with canvas measureText in the page's font stacks (letters: the handwriting face).
// Returns the failures: overflow, > 3 lines, shrunk below 17 pt, orphan, a Latin word broken inside.
import { LANGS } from "../a11y/strings.ts";
import { loadArt } from "./art.ts";
import { drawerWords, G3_LINES, localeLines } from "./g3data.ts";
import { fitCardName, fitCardSource, fitDialogue, fitLetter, fitPill, fitTab, fitTag, PILL_W, SE_WIDTH } from "./textLayout.ts";
import { isOrphan, villageFont, wordsWhole } from "./wrap.ts";

export async function runG3(scales: readonly number[] = [1, 1.6]): Promise<{ checked: number; failures: string[]; maxLines: number; perLang: Record<string, number> }> {
  const art = await loadArt();
  const g = document.createElement("canvas").getContext("2d")!;
  const failures: string[] = [];
  const perLang: Record<string, number> = {};
  let checked = 0;
  let maxLines = 0;
  for (const lang of LANGS) {
    const measureAt = (size: number) => (s: string): number => {
      g.font = villageFont(lang, size);
      return g.measureText(s).width;
    };
    const hand = art.loadVillageFont ? await art.loadVillageFont(lang, "letter").catch(() => null) : null;
    const letterAt = hand
      ? (size: number) => (s: string): number => {
          g.font = `500 ${size}px ${hand}`;
          return g.measureText(s).width;
        }
      : measureAt;
    const cjk = lang === "ja" || lang === "zh-Hans" || lang === "zh-Hant";
    const lines = localeLines(lang);
    if (lines.length !== G3_LINES.length) failures.push(`${lang}: ${lines.length} lines (want ${G3_LINES.length})`);
    lines.forEach((s, i) => {
      const t = G3_LINES[i]!.t;
      if (!s) failures.push(`${lang} empty ${G3_LINES[i]!.id}`);
      for (const scale of scales) {
        checked++;
        const f = t.startsWith("letter.") ? fitLetter(s, SE_WIDTH, scale, letterAt, lang) : t === "gift.tag" ? fitTag(s, scale, measureAt, lang) : fitDialogue(s, SE_WIDTH, scale, measureAt, lang);
        if (!f.fits) failures.push(`${lang} @${scale} overflow ${G3_LINES[i]!.id}: ${JSON.stringify(f.lines)}`);
        if (!cjk && !wordsWhole(s, f.lines)) failures.push(`${lang} @${scale} word broken ${G3_LINES[i]!.id}: ${JSON.stringify(f.lines)}`);
        if (scale === 1 && !t.startsWith("letter.") && t !== "gift.tag") {
          if (f.lines.length > 3) failures.push(`${lang} >3 lines ${G3_LINES[i]!.id}`);
          if (f.size < 17) failures.push(`${lang} shrank to ${f.size} ${G3_LINES[i]!.id}`);
          if (isOrphan(f.lines, s)) failures.push(`${lang} orphan ${G3_LINES[i]!.id}: ${JSON.stringify(f.lines)}`);
          maxLines = Math.max(maxLines, f.lines.length);
        }
      }
    });
    const d = drawerWords(lang);
    for (const nm of d.names) {
      checked++;
      const f = fitCardName(nm, SE_WIDTH, measureAt, lang);
      if (!f.fits || (!cjk && !wordsWhole(nm, f.lines))) failures.push(`${lang} drawer name ${JSON.stringify(f.lines)}`);
    }
    for (const t of d.tabs) {
      checked++;
      if (!fitTab(t, SE_WIDTH, measureAt, 1, lang).fits) failures.push(`${lang} tab ${t}`);
    }
    for (const x of d.sources) {
      checked++;
      const f = fitCardSource(x, SE_WIDTH, measureAt, lang);
      if (!f.fits || (!cjk && !wordsWhole(x, f.lines))) failures.push(`${lang} source ${JSON.stringify(f.lines)}`);
    }
    const widths = [PILL_W.gift, PILL_W.gift, PILL_W.letter, PILL_W.action(SE_WIDTH), PILL_W.action(SE_WIDTH)];
    d.pills.forEach((x, i) => {
      checked++;
      if (!fitPill(x, widths[i]!, 1.3, measureAt, lang).fits) failures.push(`${lang} pill ${x}`);
    });
    perLang[lang] = checked;
  }
  return { checked, failures, maxLines, perLang };
}
