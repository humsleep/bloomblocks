// src/village/wrap.ts + textLayout.ts — gate G3 in node with a pessimistic glyph-width model
// (the e2e village spec repeats it with the real fonts in Chromium / WebKit): every dialogue line,
// letter and tag of all 10 locales fits on the 375 pt SE card, no orphan line, kinsoku kept.
import { describe, expect, it } from "vitest";
import en from "../src/village/lines/en.json";
import ko from "../src/village/lines/ko.json";
import { LANGS, type Lang } from "../src/a11y/strings.ts";
import { DRAWER_TABS, ITEMS, RESIDENTS } from "../src/village/catalog.ts";
import { fitCardName, fitCardSource, fitDialogue, fitLetter, fitPill, fitTab, fitTag, letterTrackingEm, PILL_W, SE_WIDTH, splitSignature, trackedMeasure } from "../src/village/textLayout.ts";
import { drawerWords, G3_LINES, localeLines } from "../src/village/g3data.ts";
import { ITEM_NAMES, RESIDENT_NAMES, TAB_NAMES, UI } from "../src/village/strings.ts";
import { balanced, fitText, greedy, isOrphan, NO_END, NO_START, units, wordsWhole } from "../src/village/wrap.ts";
import { drawerTitle, vt } from "../src/village/text.ts";

/** em widths: generous for Latin (SF Pro Rounded semibold is ≈ 0.53 em per lowercase letter) */
function emOf(ch: string): number {
  if (/[ᄀ-ᇿ가-힯㄰-㆏]/.test(ch)) return 0.95;
  if (/[⺀-鿿豈-﫿＀-￯　-〿]/.test(ch)) return 1;
  if (ch === " ") return 0.28;
  if (/[iljI.,'’!|:;]/.test(ch)) return 0.3;
  if (/[mwMW]/.test(ch)) return 0.86;
  if (/[A-Z0-9]/.test(ch)) return 0.68;
  return 0.58;
}
const measureAt = (size: number) => (s: string): number => [...s].reduce((w, c) => w + emOf(c) * size, 0);
const m17 = measureAt(17);

const LINES = en.lines as Array<{ id: string; t: string; x: string; r: string }>;
const enText = (l: (typeof LINES)[number]): string => l.x.replaceAll("{cp}", (en.cp as Record<string, string>)[l.r]!);
const koText = (l: (typeof LINES)[number]): string => (ko.text as Record<string, string>)[l.id]!;
const own = (lang: Lang): string[] => (lang === "en" ? LINES.map(enText) : lang === "ko" ? LINES.map(koText) : []);
const isLetter = (t: string): boolean => t.startsWith("letter.");

describe("break units and kinsoku", () => {
  it("Latin breaks at spaces only; the text comes back whole", () => {
    expect(units("Hi! Oh, that was loud. Hi.")).toEqual(["Hi! ", "Oh, ", "that ", "was ", "loud. ", "Hi."]);
    for (const l of LINES) expect(units(enText(l)).join("")).toBe(enText(l));
  });
  it("Korean keeps words whole", () => {
    expect(units("안녕하세요! 앗, 너무 컸다.")).toEqual(["안녕하세요! ", "앗, ", "너무 ", "컸다."]);
  });
  it("Japanese: closing marks, small kana and ー never start a line; 「 never ends one", () => {
    const u = units("「ちょっと待ってね。」ランタン");
    expect(u.join("")).toBe("「ちょっと待ってね。」ランタン");
    for (const x of u) {
      expect(NO_START.has([...x][0]!) && x !== u[0]).toBe(false);
      expect(NO_END.has([...x].at(-1)!)).toBe(false);
    }
    expect(u[0]).toBe("「ちょっ"); // small kana stay with the char before; 「 with the one after
    expect(u.some((x) => x.startsWith("っ") || x.startsWith("ょ") || x.startsWith("ー") || x.startsWith("。"))).toBe(false);
  });
  it("Japanese: a katakana word (a name) is never split: モモ, ウィック", () => {
    expect(units("こんにちは。モモです。ウィックより")).toEqual(expect.arrayContaining(["モモ", "ウィック"]));
    for (const w of [70, 80, 90, 100, 110]) for (const l of greedy(measureAt(17), "あっ、こんにちは。モモです。あいさつ、練習しました。", w)) expect(l.startsWith("モです")).toBe(false);
  });
  it("Chinese: ，。！？…… stay on the line before", () => {
    const lines = greedy(measureAt(17), "嗯……你好。我是桃桃。这一段我练习过了。呀！", 120);
    for (const l of lines.slice(1)) expect(NO_START.has([...l][0]!)).toBe(false);
  });
  it("a Latin word is never broken inside (G1 #18): it stays whole, fitText shrinks it; cutting is only the last resort", () => {
    const lines = greedy(m17, "Arched chair", 60);
    expect(lines).toEqual(["Arched", "chair"]);
    expect(balanced(m17, "Arched chair", 60)).toEqual(["Arched", "chair"]);
    // too wide for the line at 17: stays whole (overflowing) until the caller shrinks
    expect(greedy(m17, "Supercalifragilistic", 100)).toEqual(["Supercalifragilistic"]);
    const cut = greedy(m17, "Supercalifragilistic", 100, true);
    for (const l of cut) expect(m17(l)).toBeLessThanOrEqual(100);
    const f = fitText("Flower vase", { maxW: 50, maxLines: 2, sizes: [13, 12, 11], measureAt });
    expect(f.fits).toBe(true);
    expect(wordsWhole("Flower vase", f.lines)).toBe(true);
  });
  it("balanced: no lone last word", () => {
    const t = "Every lantern in place. Like a constellation!";
    const g = greedy(m17, t, 300);
    const b = balanced(m17, t, 300);
    expect(b.length).toBe(g.length);
    expect(isOrphan(b, t)).toBe(false);
  });
});

describe("G1 re-review 2: Japanese phrases, Korean letter tracking, letter signatures", () => {
  const m = measureAt(17);
  it("ja: never inside a phrase — 小さな|ベッド, びんを|ためると, ぎゅっと|していた (Intl.Segmenter + particles)", () => {
    expect(units("小さなベッド", "ja")).toEqual(["小さな", "ベッド"]);
    expect(units("びんをためると", "ja")).toEqual(["びんを", "ためると"]);
    expect(units("こわいとき、いつもぎゅっとしていたクッションです。", "ja")).toContain("ぎゅっとしていた");
    // at every width, no line ends / starts inside those words
    const bad = [/小$/, /^さな/, /びんをた$/, /^めると/, /ぎゅっ$/, /^としていた/];
    for (const t of ["小さなベッド", "びんをためると", "こわいとき、いつもぎゅっとしていたクッションです。"]) {
      for (let w = 40; w <= 260; w += 6) {
        const lines = greedy(m, t, w, false, "ja");
        for (const l of lines) for (const b of bad) expect(b.test(l), `${w}: ${JSON.stringify(lines)}`).toBe(false);
      }
    }
    // the drawer name and the "how to get it" line at the real card width
    expect(fitCardName("小さなベッド", SE_WIDTH, measureAt, "ja").lines).toEqual(["小さな", "ベッド"]);
    expect(fitCardSource("びんをためると", SE_WIDTH, measureAt, "ja").lines.join("|")).not.toMatch(/た\|め/);
    // kinsoku still holds inside phrase breaking
    for (const l of greedy(m, "あっ、こんにちは。モモです。あいさつ、練習しました。ひゃっ。", 90, false, "ja").slice(1)) expect(NO_START.has([...l][0]!)).toBe(false);
  });
  it("zh: a doubled name stays together (桃桃)", () => {
    for (let w = 40; w <= 200; w += 8) for (const l of greedy(m, "我是桃桃。我偷偷練習了這一段。呀！", w, false, "zh-Hant")) expect(/桃$/.test(l) && !/桃桃$/.test(l)).toBe(false);
  });
  it("ko letters: −0.10 em tracking, measured as drawn", () => {
    expect(letterTrackingEm("ko")).toBeLessThanOrEqual(-0.1);
    const t = trackedMeasure(m, -0.1 * 17);
    expect(t("안녕하세요")).toBeCloseTo(m("안녕하세요") - 4 * 1.7, 5);
    expect(letterTrackingEm("en")).toBe(0);
  });
  it("every letter of every locale has its signature split off (own right-aligned line), incl. de '– Momo'", () => {
    expect(splitSignature("Ähm, hallo,\nJetzt gehört es dir. – Momo")).toEqual({ body: "Ähm, hallo,\nJetzt gehört es dir.", signature: "– Momo" });
    expect(splitSignature("你好，\n现在送给你。—— 桃桃").signature).toBe("—— 桃桃");
    expect(splitSignature("Bem-vindo").signature).toBe("");
    for (const lang of LANGS) {
      localeLines(lang).forEach((s, i) => {
        const l = G3_LINES[i]!;
        if (!l.t.startsWith("letter.")) return;
        const sp = splitSignature(s);
        expect(sp.signature, `${lang} ${l.id}: ${s}`).toContain(RESIDENT_NAMES[lang][l.r as "wick"]);
        expect(sp.body).not.toContain(sp.signature);
      });
    }
  });
});

describe("G3: every village string × 10 locales fits the SE card, no orphans, no broken words", () => {
  for (const lang of LANGS) {
    it(`${lang}: its own lines — dialogue 1–3 lines at 1×, letters, tags, at Dynamic Type 1× and 1.6×`, () => {
      const lines = localeLines(lang);
      expect(lines.length).toBe(G3_LINES.length);
      const cjk = lang === "ja" || lang === "zh-Hans" || lang === "zh-Hant";
      lines.forEach((s, i) => {
        const t = G3_LINES[i]!.t;
        expect(s, `${lang} ${G3_LINES[i]!.id}`).toBeTruthy();
        for (const scale of [1, 1.6]) {
          const f = t.startsWith("letter.") ? fitLetter(s, SE_WIDTH, scale, measureAt, lang) : t === "gift.tag" ? fitTag(s, scale, measureAt, lang) : fitDialogue(s, SE_WIDTH, scale, measureAt, lang);
          expect(f.fits, `${lang} @${scale} ${JSON.stringify(f.lines)}`).toBe(true);
          if (!cjk) expect(wordsWhole(s, f.lines), `${lang} ${JSON.stringify(f.lines)}`).toBe(true);
          if (scale === 1 && !t.startsWith("letter.") && t !== "gift.tag") {
            expect(f.lines.length).toBeLessThanOrEqual(3);
            expect(f.size, `${lang} "${s}" shrank`).toBeGreaterThanOrEqual(17);
            expect(isOrphan(f.lines, s), `${lang} orphan ${JSON.stringify(f.lines)}`).toBe(false);
          }
        }
      });
    });
    it(`${lang}: drawer names never break inside a word (G1 #18), tabs one line, "how to get it" lines, buttons fit (SE)`, () => {
      const d = drawerWords(lang);
      const cjk = lang === "ja" || lang === "zh-Hans" || lang === "zh-Hant";
      for (const n of d.names) {
        const f = fitCardName(n, SE_WIDTH, measureAt, lang);
        expect(f.fits, `${lang} name ${n}`).toBe(true);
        if (!cjk) expect(wordsWhole(n, f.lines), `${lang} ${JSON.stringify(f.lines)}`).toBe(true);
      }
      for (const t of d.tabs) expect(fitTab(t, SE_WIDTH, measureAt, 1, lang).fits, `${lang} tab ${t}`).toBe(true);
      for (const x of d.sources) {
        const f = fitCardSource(x, SE_WIDTH, measureAt, lang);
        expect(f.fits, `${lang} source ${x}`).toBe(true);
        if (!cjk) expect(wordsWhole(x, f.lines), `${lang} ${JSON.stringify(f.lines)}`).toBe(true);
      }
      const widths = [PILL_W.gift, PILL_W.gift, PILL_W.letter, PILL_W.action(SE_WIDTH), PILL_W.action(SE_WIDTH)];
      d.pills.forEach((x, i) => expect(fitPill(x, widths[i]!, 1.3, measureAt, lang).fits, `${lang} pill ${x}`).toBe(true));
      expect(fitPill(drawerTitle(lang), SE_WIDTH - 32 - 56, 1, measureAt).fits).toBe(true);
    });
  }
  it("item / tab / resident names: every locale has all of them; en and ko match the catalog", () => {
    for (const lang of LANGS) {
      for (const x of ITEMS) expect(ITEM_NAMES[lang][x.id], `${lang} ${x.id}`).toBeTruthy();
      for (const t of DRAWER_TABS) expect(TAB_NAMES[lang][t.id], `${lang} ${t.id}`).toBeTruthy();
      for (const r of RESIDENTS) expect(RESIDENT_NAMES[lang][r.id]).toBeTruthy();
      for (const k of Object.keys(UI.en)) expect(UI[lang][k as keyof typeof UI.en], `${lang} ${k}`).toBeTruthy();
    }
    for (const x of ITEMS) {
      expect(ITEM_NAMES.en[x.id]).toBe(x.name.en);
      expect(ITEM_NAMES.ko[x.id]).toBe(x.name.ko);
    }
  });
});
