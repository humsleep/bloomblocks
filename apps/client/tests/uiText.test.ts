// v11 shown words: the wrap used by the guidance band / sheets (src/game/uiText.ts).
import { describe, expect, it } from "vitest";
import { wrapBalanced, wrapText } from "../src/game/uiText.ts";

/** 10 px per character (CJK too: the wrap only needs a monotone measure). */
const m = (s: string): number => [...s].length * 10;

describe("wrapText", () => {
  it("keeps a short line whole and breaks Latin text at spaces", () => {
    expect(wrapText(m, "Light the rest.", 400)).toEqual(["Light the rest."]);
    expect(wrapText(m, "Lanterns can't shine on each other.", 300)).toEqual(["Lanterns can't shine on each", "other."]);
  });

  it("breaks Japanese between characters, never before closing punctuation", () => {
    const lines = wrapText(m, "すべてのマスを照らせばクリア！", 80);
    expect(lines.join("")).toBe("すべてのマスを照らせばクリア！");
    expect(lines.every((l) => m(l) <= 80 || [...l].length === 1 || l.endsWith("！"))).toBe(true);
    expect(lines.some((l) => l.startsWith("！"))).toBe(false);
  });

  it("breaks Korean at spaces (words stay whole)", () => {
    expect(wrapText(m, "이미 밝은 칸이에요. 어두운 칸을 눌러요.", 120)).toEqual(["이미 밝은 칸이에요.", "어두운 칸을 눌러요."]);
  });
});

describe("wrapBalanced", () => {
  it("keeps the line count but evens the lines out (no lone last word)", () => {
    const lines = wrapBalanced(m, "Lanterns can't shine on each other.", 300);
    expect(lines).toHaveLength(2);
    expect(lines).toEqual(["Lanterns can't shine", "on each other."]);
  });

  it("leaves one-liners alone", () => {
    expect(wrapBalanced(m, "Nice!", 300)).toEqual(["Nice!"]);
  });
});

// v12 (playtest/i18n-v12.md): every shown string of every locale fits the layout slots of an
// iPhone SE (375 pt). The measure is a conservative per-character width model of the rounded UI
// face (bold) and PingFang / Hiragino (CJK = 1 em); playtest/i18n/fit.mjs checks the same slots
// with the real fonts in Chromium and WebKit.
import { LANGS, STRINGS } from "../src/a11y/strings.ts";
import { BREAK_CARD } from "../src/ads/breakCard.ts";
import { REMINDER_TEXTS } from "../src/notify/texts.ts";

const HANGUL = /[가-힯]/;
const FULL = /[　-〿぀-ヿ㐀-鿿豈-﫿＀-￯]/;
/** width in em of one character (bold rounded face; deliberately a little wide) */
function em(ch: string): number {
  if (FULL.test(ch)) return 1;
  if (HANGUL.test(ch)) return 0.92;
  if (ch === " ") return 0.26;
  if (/[iljtfrI.,:;'!|’`]/.test(ch)) return 0.32;
  if (/[mwMW]/.test(ch)) return 0.86;
  if (/[A-Z]/.test(ch)) return 0.68;
  if (/[0-9]/.test(ch)) return 0.6;
  if (ch === "→") return 1;
  return 0.57;
}
const width = (s: string, pt: number): number => [...s].reduce((a, c) => a + em(c), 0) * pt;
const fill = (s: string): string => s.replace(/\{n\}/g, "12").replace(/\{\w+\}/g, "3");
const NEW = new Set(["it", "zh-Hans", "zh-Hant"]);

const SE = 375;
const BAND = Math.min(SE - 24, 420) - 32 - 18;
const BAND_KEYS = /^(err\.|hint\.|tut\.(t1|t1ok|t2a|t2b|t2c|lit|t3a|t3b|t3c|t3ok|t3wrong|t4a|t4b|t4ok|t4c|t4corner|t4over|t5a|t5wrong|follow|nice)$)/;

describe("layout limits on an iPhone SE (every locale)", () => {
  it("band, tutorial and how-to lines wrap to at most two lines", () => {
    for (const l of LANGS) {
      const d = STRINGS[l];
      for (const [k, v] of Object.entries(d)) {
        const slot = BAND_KEYS.test(k) ? { pt: k.endsWith("Sub") ? 17 : 18, w: BAND } : /^how\.c[1-4]s?$/.test(k) ? { pt: 18, w: SE - 64 } : /^tut\.end2?$/.test(k) ? { pt: k === "tut.end" ? 22 : 18, w: SE - 84 } : null;
        if (!slot) continue;
        const lines = wrapText((s) => width(s, slot.pt), fill(v), slot.w);
        expect(lines.length, `${l}.${k}: ${lines.join(" / ")}`).toBeLessThanOrEqual(2);
      }
    }
  });

  it("HUD captions fit under their icon (new locales without shrinking, every locale drawn at ≥ 11 pt of 13)", () => {
    for (const l of LANGS) {
      for (const k of ["cap.town", "cap.today", "cap.undo", "cap.hint", "cap.how", "cap.back", "cap.settings"]) {
        const w = width(STRINGS[l][k]!, 13);
        // R2: the top row's captions (Settings / Rules / Back) get up to 84 pt (the row's pitch follows them)
        const max = k === "cap.settings" ? 84 : 76;
        expect(w, `${l}.${k} ${STRINGS[l][k]}`).toBeLessThanOrEqual(max / (NEW.has(l) ? 1 : 11 / 13));
      }
    }
  });

  it("R2: the board's slot band (slim, SE): a two-line message is one line of each, so it fits the slot (≤ 0.85 shrink)", () => {
    // LineBand slim: maxW = SE − 16, padX 12 each side, the coral mark 18 on the warned line
    const W = Math.min(SE - 16, 420) - 24 - 18;
    const pairs: [string, string][] = [["err.early", "err.earlySub"], ["hint.remove", "hint.removeSub"], ["tut.t4a", "how.c4s"], ["tut.t4a", "tut.t4b"], ["tut.t3a", "tut.t3ok"]];
    for (const l of LANGS) {
      for (const [m, sub] of pairs) {
        for (const [k, pt] of [[m, 18], [sub, 17]] as const) {
          const lines = wrapText((s) => width(s, pt * 0.85), fill(STRINGS[l][k]!), W);
          expect(lines.length, `${l}.${k}: ${lines.join(" / ")}`).toBe(1);
        }
      }
      for (const k of Object.keys(STRINGS[l]).filter((x) => /^err\.(conflict|over|zero|stuckNum|stuckCell|numbers|stone)$/.test(x))) {
        expect(wrapText((s) => width(s, 18), fill(STRINGS[l][k]!), W).length, `${l}.${k}`).toBeLessThanOrEqual(2);
      }
    }
  });

  it("R2: the first-daily offer's button and the cards' title fit", () => {
    for (const l of LANGS) {
      expect(width(STRINGS[l]["daily.offerYes"]!, 16), `${l}.daily.offerYes`).toBeLessThanOrEqual(122 / 0.85);
      expect(wrapText((s) => width(s, 20), STRINGS[l]["daily.title"]!, Math.min(SE - 40, 320) - 40).length, `${l}.daily.title`).toBe(1);
    }
  });

  it("buttons and card buttons keep their words readable (≥ 85 % scale)", () => {
    const btn: [string, number, number][] = [
      ["done.next", 20, Math.min(SE - 64, 300) - 24],
      ["tut.start", 21, Math.min(SE - 40, 340) - 68],
      ["res.continue", 19, Math.round((SE - 40) * 0.62 - 12) - 20],
      ["how.replay", 18, SE - 88],
      ["done.solved", 40, SE - 40],
      ["daily.ok", 16, 122], ["ask.yes", 16, 122], ["ask.later", 16, 122], ["ask.restartYes", 16, 122], ["ask.cancel", 16, 122], ["ask.breakYes", 16, 122],
    ];
    for (const l of LANGS) {
      for (const [k, pt, max] of btn) expect(width(STRINGS[l][k]!, pt), `${l}.${k} ${STRINGS[l][k]}`).toBeLessThanOrEqual(max / 0.85);
      for (const k of ["watch", "notNow"] as const) expect(width(BREAK_CARD[l][k], 16), `${l}.break.${k}`).toBeLessThanOrEqual(122 / 0.85);
    }
  });

  it("Chinese copy follows Apple style: a space between Han and digits / Latin, full-width punctuation", () => {
    for (const l of ["zh-Hans", "zh-Hant"] as const) {
      const all = [...Object.values(STRINGS[l]), ...Object.values(BREAK_CARD[l]), ...REMINDER_TEXTS[l].lines, REMINDER_TEXTS[l].streak];
      for (const s of all) {
        expect(s, s).not.toMatch(/[一-鿿][0-9A-Za-z{]|[0-9A-Za-z}][一-鿿]/);
        expect(s, s).not.toMatch(/[一-鿿][,.!?:;]|[,!?;] ?[一-鿿]/);
      }
    }
    // the two scripts stay apart: no Simplified-only forms in zh-Hant and vice versa (spot list)
    const hant = Object.values(STRINGS["zh-Hant"]).join("");
    const hans = Object.values(STRINGS["zh-Hans"]).join("");
    expect(hant).not.toMatch(/[灯笼这个点设时关闭开启护钟题说还动边数为让会网视频]/);
    expect(hans).not.toMatch(/[燈籠這個點設時關開護鐘題說還動邊數為讓會網視頻]/);
  });
});
