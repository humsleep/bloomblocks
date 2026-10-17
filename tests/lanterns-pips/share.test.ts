// dailyNumber / shareText (round 4): deterministic, spoiler-free, no English words.
// R2 (A5): a third line, the daily's link with ct=share — the ONLY place besides APP_NAME with letters.
import { describe, expect, it } from "vitest";
import * as P from "../../games/lanterns-pips/index.ts";
import { MOON_PHASES, clockText } from "../../games/lanterns-pips/share.ts";

const L = (n: number): string => `https://humsleep.github.io/duskwick/${n}?ct=share`;

const START = Date.UTC(2026, 10, 1); // 2026-11-01 (test-side date math only)
const dateAt = (k: number): string => new Date(START + k * 86_400_000).toISOString().slice(0, 10);
const level6 = P.parseLevel(["..#1..", ".0#...", ".....#", "#.....", "...1#.", "..01.."]);

describe("dailyNumber", () => {
  it("DAILY_EPOCH is #1 and the number counts days (across months, years and a leap day)", () => {
    expect(P.DAILY_EPOCH).toBe("2026-11-01");
    expect(P.dailyNumber("2026-11-01")).toBe(1);
    expect(P.dailyNumber("2026-11-02")).toBe(2);
    expect(P.dailyNumber("2026-12-01")).toBe(31);
    expect(P.dailyNumber("2027-01-01")).toBe(62);
    expect(P.dailyNumber("2028-03-01")).toBe(P.dailyNumber("2028-02-28") + 2); // 2028 is a leap year
    expect(P.dailyNumber("2026-10-31")).toBe(0);
    expect(P.dailyNumber("2026-10-14")).toBe(-17);
    for (let k = 0; k < 1500; k += 7) expect(P.dailyNumber(dateAt(k))).toBe(k + 1);
    expect(() => P.dailyNumber("2026-13-01")).toThrow();
    expect(() => P.dailyNumber("20261101")).toThrow();
  });

  it("moon phase matches known new and full moons", () => {
    expect(MOON_PHASES[P.moonPhase("2024-01-11")]).toBe("🌑");
    expect(MOON_PHASES[P.moonPhase("2024-04-08")]).toBe("🌑"); // total solar eclipse
    expect(MOON_PHASES[P.moonPhase("2024-01-25")]).toBe("🌕");
    expect(MOON_PHASES[P.moonPhase("2026-11-24")]).toBe("🌕");
    // Phases advance through all 8 over a lunation.
    const seen = new Set<number>();
    for (let k = 0; k < 30; k++) seen.add(P.moonPhase(dateAt(k)));
    expect(seen.size).toBe(8);
  });
});

describe("shareText", () => {
  const base: P.DailyResult = { dateISO: "2026-11-14", seconds: 247, hints: 2, undos: 3, streak: 14 };

  it("is deterministic and has the documented three-line shape (round 5: no 🟨 row; R2: link line)", () => {
    const t = P.shareText(level6, base);
    expect(P.shareText(level6, { ...base })).toBe(t);
    expect(t).toBe(`${P.APP_NAME} #14 🌒\n💡2 ⏱ 4:07 🔥14\n${L(14)}`);
    expect(t).toBe("Duskwick #14 🌒\n💡2 ⏱ 4:07 🔥14\nhttps://humsleep.github.io/duskwick/14?ct=share");
    // ✨ = no hint (undos don't matter).
    expect(P.shareText(level6, { ...base, hints: 0, undos: 0, seconds: 161, streak: 1, dateISO: "2026-11-01" })).toBe(`${P.APP_NAME} #1 🌗\n✨ ⏱ 2:41 🔥1\n${L(1)}`);
    expect(P.shareText(level6, { ...base, hints: 0, undos: 0 })).toBe(`Duskwick #14 🌒\n✨ ⏱ 4:07 🔥14\n${L(14)}`);
    // Undos alone still earn ✨ (undo is normal play).
    expect(P.shareText(level6, { ...base, hints: 0 })).toBe(`${P.APP_NAME} #14 🌒\n✨ ⏱ 4:07 🔥14\n${L(14)}`);
    // Hints and no undo: 💡n, no ✨.
    expect(P.shareText(level6, { ...base, undos: 0 })).toBe(`${P.APP_NAME} #14 🌒\n💡2 ⏱ 4:07 🔥14\n${L(14)}`);
    expect(P.shareText(level6, base)).not.toContain("🟨");
  });

  it("dailyLink: the daily's page with the campaign token; before the epoch the dailies' home", () => {
    expect(P.DAILY_URL_BASE).toBe("https://humsleep.github.io/duskwick/");
    expect(P.SHARE_CT).toBe("share");
    expect(P.dailyLink(14)).toBe(L(14));
    expect(P.dailyLink(400, "web_daily")).toBe("https://humsleep.github.io/duskwick/400?ct=web_daily");
    expect(P.dailyLink(0)).toBe("https://humsleep.github.io/duskwick/?ct=share");
    expect(P.dailyLink(-17)).toBe("https://humsleep.github.io/duskwick/?ct=share");
    expect(P.shareText(level6, { ...base, dateISO: "2026-10-14" }).split("\n")[2]).toBe("https://humsleep.github.io/duskwick/?ct=share");
  });

  it("ShareOptions.showTime: the ⏱ part only when on (default on)", () => {
    expect(P.shareText(level6, base, { showTime: true })).toBe(P.shareText(level6, base));
    expect(P.shareText(level6, base, { showTime: false })).toBe(`${P.APP_NAME} #14 🌒\n💡2 🔥14\n${L(14)}`);
    expect(P.shareText(level6, { ...base, hints: 0, undos: 0 }, { showTime: false })).toBe(`${P.APP_NAME} #14 🌒\n✨ 🔥14\n${L(14)}`);
    expect(P.shareText(level6, { ...base, hints: 0 }, { showTime: false })).toBe(`${P.APP_NAME} #14 🌒\n✨ 🔥14\n${L(14)}`);
  });

  it("no letters outside APP_NAME and the link line, at most 4 lines, nothing derived from the board", () => {
    expect(P.APP_NAME).toBe("Duskwick");
    const sol = P.solutionOf(level6)!;
    const wide = P.parseLevel(["..#1...", ".0#....", ".....#.", "#......", "...1#..", "..01...", "......."]);
    for (let k = 0; k < 400; k++) {
      const r: P.DailyResult = { dateISO: dateAt(k * 3), seconds: (k * 97) % 4000, hints: k % 4, undos: k % 3, streak: k };
      for (const showTime of [true, false]) {
        const t = P.shareText(level6, r, { showTime });
        const lines = t.split("\n");
        expect(lines.length).toBeLessThanOrEqual(4);
        expect(t.startsWith(`${P.APP_NAME} #`)).toBe(true);
        // the relaxation is ONLY the last line, and it is exactly the daily's link (nothing else may carry letters)
        const link = lines.at(-1)!;
        expect(link).toBe(P.dailyLink(P.dailyNumber(r.dateISO)));
        const body = lines.slice(0, -1).join("\n");
        const rest = body.slice(P.APP_NAME.length);
        expect(rest, t).not.toMatch(/[A-Za-z]/);
        expect(t.split(P.APP_NAME).length - 1).toBe(1);
        // No cell names, no board text, no lantern / number / board-row glyphs.
        expect(body).not.toMatch(/[A-H][1-8]|[#.L]{3}|🏮|🟨|[0-4]️⃣/);
        expect(link).toMatch(/^https:\/\/humsleep\.github\.io\/duskwick\/\d*\?ct=share$/);
        expect(t.includes(`⏱ ${clockText(r.seconds)}`)).toBe(showTime);
        expect(t.includes("⏱")).toBe(showTime);
        expect(t.includes("💡")).toBe(r.hints > 0);
        expect(t.includes("✨")).toBe(r.hints === 0);
        expect(t).toContain(`🔥${r.streak}`);
        // Nothing comes from the board: another board (even another width) gives the same text.
        expect(P.shareText(wide, r, { showTime })).toBe(t);
      }
    }
    expect(P.cellsOf(sol).length).toBeGreaterThan(0);
  });

  it("clock text: m:ss, clamps bad input", () => {
    expect(clockText(0)).toBe("0:00");
    expect(clockText(59)).toBe("0:59");
    expect(clockText(61)).toBe("1:01");
    expect(clockText(3600)).toBe("60:00");
    expect(clockText(-5)).toBe("0:00");
    expect(clockText(Number.NaN)).toBe("0:00");
    expect(clockText(90.9)).toBe("1:30");
    expect(P.shareText(level6, { ...base, hints: -1, streak: Number.POSITIVE_INFINITY })).toBe(`${P.APP_NAME} #14 🌒\n✨ ⏱ 4:07 🔥0\n${L(14)}`);
  });
});
