// shareText never contains letters outside APP_NAME and the last (link) line (R2, A5), never more than 4 lines, and nothing
// that depends on the board — for any date and any (even garbage) result numbers; the client
// wrapper (pipsApi.shareText, "#n" dropped before the epoch) keeps the same guarantees.
import { describe, expect, it } from "vitest";
import { APP_NAME, dailyLink, dailyNumber, levelForDaily, levelForTrack, shareText } from "../../games/lanterns-pips/index.ts";
import { prng } from "./corpus.ts";

const weird = [0, -1, 1.5, 59.999, 1e9, -1e9, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 2 ** 31, 35999, 36000];

describe("shareText", () => {
  it("only APP_NAME + link-line letters, ≤ 4 lines, board-independent (5,000 random results)", () => {
    const rnd = prng(0xa1);
    const boards = [levelForDaily("2026-10-14"), levelForTrack("gentle", 1), levelForTrack("deduce", 1)];
    const pick = (): number => (rnd() < 0.3 ? weird[Math.floor(rnd() * weird.length)]! : Math.floor(rnd() * 5000) - 50);
    for (let k = 0; k < 5000; k++) {
      const day = Date.UTC(2025, 0, 1) + Math.floor(rnd() * 3000) * 86_400_000;
      const r = { dateISO: new Date(day).toISOString().slice(0, 10), seconds: pick(), hints: pick(), undos: pick(), streak: pick() };
      const opts = { showTime: rnd() < 0.5 };
      const texts = boards.map((b) => shareText(b, r, opts));
      expect(new Set(texts).size, "share text depends on the board").toBe(1);
      const t = texts[0]!;
      expect(t.startsWith(APP_NAME)).toBe(true);
      const lines = t.split("\n");
      expect(lines.at(-1)).toBe(dailyLink(dailyNumber(r.dateISO)));
      expect(lines.slice(0, -1).join("\n").replace(APP_NAME, ""), t).not.toMatch(/[A-Za-z]/);
      expect(t.split("\n").length).toBeLessThanOrEqual(4);
      expect(t).not.toMatch(/NaN|Infinity|undefined|null/);
      if (!opts.showTime) expect(t).not.toContain("⏱");
      expect(t).toContain(`#${dailyNumber(r.dateISO)}`);
    }
  });
});
