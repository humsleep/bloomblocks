// What gate G3 measures per locale: every dialogue / letter / tag line and the drawer's words.
// Test / e2e only (tests/village-wrap.test.ts, g3check.ts): the eager glob pulls every locale's lines.
import type { Lang } from "../a11y/strings.ts";
import { DRAWER_TABS, ITEMS, RESIDENTS } from "./catalog.ts";
import type { Line } from "./picker.ts";
import { ITEM_NAMES } from "./strings.ts";
import { residentName, tabName, vt } from "./text.ts";

type EnFile = { cp: Record<string, string>; lines: Line[] };
type LocFile = { cp: Record<string, string>; text: Record<string, string> };
const FILES = import.meta.glob<EnFile | LocFile>("./lines/*.json", { eager: true, import: "default" });

export const G3_LINES: readonly Line[] = (FILES["./lines/en.json"] as EnFile).lines;

/** The locale's own lines in G3_LINES order (empty when it has no file). */
export function localeLines(lang: Lang): string[] {
  const en = FILES["./lines/en.json"] as EnFile;
  if (lang === "en") return en.lines.map((l) => l.x.replaceAll("{cp}", en.cp[l.r] ?? ""));
  const f = FILES[`./lines/${lang}.json`] as LocFile | undefined;
  return f ? G3_LINES.map((l) => (f.text[l.id] ?? "").replaceAll("{cp}", f.cp[l.r] ?? "")) : [];
}

/** The drawer's words in a locale: item names, tabs, the "how to get it" lines, the buttons. */
export function drawerWords(lang: Lang): { names: string[]; tabs: string[]; sources: string[]; pills: string[] } {
  return {
    names: ITEMS.map((x) => ITEM_NAMES[lang][x.id]),
    tabs: DRAWER_TABS.map((t) => tabName(lang, t.id)),
    sources: [...RESIDENTS.map((r) => vt(lang, "srcResident", { name: residentName(lang, r.id) })), vt(lang, "srcJar")],
    pills: (["putIn", "later", "openGift", "takeOut", "turn"] as const).map((k) => vt(lang, k)),
  };
}
