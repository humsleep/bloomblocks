// R4 rankings: which daily results go on today's time board, the score unit, and the opt-in flow (web fake).
import { beforeEach, describe, expect, it } from "vitest";
import { BOARDS, dailyCounts, openRankings, sendDaily, timeScore } from "../src/game/ranking.ts";
import type { GameCenterFake } from "../src/native/gamecenter.ts";

const fake = (): GameCenterFake => (globalThis as unknown as { __gameCenterFake: GameCenterFake }).__gameCenterFake;

describe("today's time board", () => {
  it("only hint-free results whose date is today in UTC", () => {
    expect(dailyCounts("2026-10-20", 0, "2026-10-20T13:00:00.000Z")).toBe(true);
    expect(dailyCounts("2026-10-20", 1, "2026-10-20T13:00:00.000Z")).toBe(false);
    expect(dailyCounts("2026-10-21", 0, "2026-10-20T16:00:00.000Z")).toBe(false); // Seoul morning, UTC still yesterday
  });
  it("time in hundredths of a second", () => {
    expect(timeScore(184)).toBe(18400);
    expect(timeScore(0)).toBe(100);
  });
});

describe("opt-in flow (web fake)", () => {
  beforeEach(() => {
    (globalThis as unknown as { __gameCenterFake?: GameCenterFake }).__gameCenterFake = { signedIn: false, scores: [], shown: [] };
  });
  it("the trophy signs in, sends the totals and opens today's board", async () => {
    expect(await openRankings({ bestStreak: 7, solved: 42 })).toBe(true);
    expect(fake().shown).toEqual([BOARDS.dailyTime]);
    expect(fake().scores.map((x) => [x.id, x.score])).toEqual([[BOARDS.bestStreak, 7], [BOARDS.solved, 42]]);
  });
  it("after that, a daily result is sent quietly", async () => {
    await openRankings({ bestStreak: 1, solved: 1 });
    fake().scores = [];
    const today = new Date().toISOString().slice(0, 10);
    await sendDaily({ dateISO: today, seconds: 95, hints: 0, dailyN: 12 }, { bestStreak: 2, solved: 3 });
    expect(fake().scores[0]).toEqual({ id: BOARDS.dailyTime, score: 9500, context: 12 });
  });
});
