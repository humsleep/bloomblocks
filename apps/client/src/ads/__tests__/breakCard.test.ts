import { describe, expect, it } from "vitest";
import { BREAK_CARD, BREAK_CARD_LANGS, breakCardText } from "../breakCard.ts";

describe("rewarded break confirm card", () => {
  it("every shipped language, every string present, short, and says 30", () => {
    expect(BREAK_CARD_LANGS).toEqual(["en", "ko", "ja", "de", "fr", "es", "pt-BR", "it", "zh-Hans", "zh-Hant"]);
    for (const l of BREAK_CARD_LANGS) {
      const t = BREAK_CARD[l];
      for (const v of Object.values(t)) expect(v.trim().length).toBeGreaterThan(0);
      expect(t.title.length).toBeLessThanOrEqual(28);
      expect(t.body.length).toBeLessThanOrEqual(80);
      expect(t.watch.length).toBeLessThanOrEqual(18);
      expect(t.notNow.length).toBeLessThanOrEqual(14);
      expect(t.body).toContain("30"); // the reward is disclosed (AdMob rewarded policy)
    }
  });

  it("picks by BCP-47 tag with English fallback", () => {
    expect(breakCardText("ko-KR")).toBe(BREAK_CARD.ko);
    expect(breakCardText("pt-PT")).toBe(BREAK_CARD["pt-BR"]);
    expect(breakCardText(["xx", "de_AT"])).toBe(BREAK_CARD.de);
    expect(breakCardText(["zh-Hans"])).toBe(BREAK_CARD["zh-Hans"]);
    expect(breakCardText("zh-Hant-HK")).toBe(BREAK_CARD["zh-Hant"]);
    expect(breakCardText("zh-TW")).toBe(BREAK_CARD["zh-Hant"]);
    expect(breakCardText("zh-SG")).toBe(BREAK_CARD["zh-Hans"]);
    expect(breakCardText("it-CH")).toBe(BREAK_CARD.it);
    expect(breakCardText(["nl", "th"])).toBe(BREAK_CARD.en);
    expect(breakCardText([])).toBe(BREAK_CARD.en);
  });
});
