// R2 (decision A2): the rating ask — when the game hands iOS its rating sheet. The pure verdict for
// every rule, the moment helpers, the stored state's parsing, and the runtime wrapper against the
// Preferences fake (persisted asks, one ask per session, the web call recorded on __reviewFake).
import { beforeEach, describe, expect, it } from "vitest";
import { dailyMoment, emptyRating, houseMoment, parseRating, rating, RATING_RULES, ratingVerdict, type SessionMarks } from "../src/game/rating.ts";
import { loadSessionCount, noteResume, SESSION_GAP_MS } from "../src/game/feedback.ts";
import { fakeBackend, resetDevice } from "./helpers.ts";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 17, 12);
const ok: SessionMarks = { session: 2, hint: false, deadEnd: false, ad: false, prompt: false, asked: false };

describe("ratingVerdict", () => {
  it("asks at each of the three happy moments when nothing says no", () => {
    for (const m of ["dailySparkle", "house5", "house10", "days7"]) expect(ratingVerdict(emptyRating(), m, ok, NOW)).toBe("ask");
  });
  it("never at any other moment (a level, a hint, a plain daily)", () => {
    for (const m of ["level", "house15", "daily", "", "result"]) expect(ratingVerdict(emptyRating(), m, ok, NOW)).toBe("not-a-moment");
  });
  it("never in the first session", () => {
    expect(ratingVerdict(emptyRating(), "dailySparkle", { ...ok, session: 1 }, NOW)).toBe("first-session");
    expect(RATING_RULES.minSession).toBe(2);
  });
  it("never after a hint, a dead end, an ad or another prompt in the same session", () => {
    expect(ratingVerdict(emptyRating(), "house5", { ...ok, hint: true }, NOW)).toBe("hint");
    expect(ratingVerdict(emptyRating(), "house5", { ...ok, deadEnd: true }, NOW)).toBe("dead-end");
    expect(ratingVerdict(emptyRating(), "house5", { ...ok, ad: true }, NOW)).toBe("ad");
    expect(ratingVerdict(emptyRating(), "house5", { ...ok, prompt: true }, NOW)).toBe("prompt");
  });
  it("at most once per session", () => {
    expect(ratingVerdict(emptyRating(), "house10", { ...ok, asked: true }, NOW)).toBe("asked");
  });
  it("≥ 60 days after our last ask", () => {
    expect(ratingVerdict({ v: 1, asks: [NOW - 59 * DAY] }, "dailySparkle", ok, NOW)).toBe("spacing");
    expect(ratingVerdict({ v: 1, asks: [NOW - 60 * DAY] }, "dailySparkle", ok, NOW)).toBe("ask");
  });
  it("≤ 3 asks in any 365 days (Apple's cap, kept ourselves)", () => {
    const three = { v: 1 as const, asks: [NOW - 300 * DAY, NOW - 200 * DAY, NOW - 100 * DAY] };
    expect(ratingVerdict(three, "days7", ok, NOW)).toBe("yearly-cap");
    // the oldest one leaves the window: a 4th ask is fine again
    expect(ratingVerdict(three, "days7", ok, NOW + 66 * DAY)).toBe("ask");
  });
});

describe("moments", () => {
  it("the daily: the 7th counted day wins, else a counted ✨ daily, else none", () => {
    expect(dailyMoment({ counted: true, hints: 0, countedDays: 3 })).toBe("dailySparkle");
    expect(dailyMoment({ counted: true, hints: 2, countedDays: 3 })).toBeNull();
    expect(dailyMoment({ counted: true, hints: 2, countedDays: 7 })).toBe("days7");
    expect(dailyMoment({ counted: true, hints: 0, countedDays: 8 })).toBe("dailySparkle");
    expect(dailyMoment({ counted: false, hints: 0, countedDays: 7 })).toBeNull();
  });
  it("the house finale: the 5th and the 10th only", () => {
    expect(houseMoment(5)).toBe("house5");
    expect(houseMoment(10)).toBe("house10");
    for (const n of [1, 3, 4, 6, 15, 20]) expect(houseMoment(n)).toBeNull();
  });
});

describe("stored state", () => {
  it("anything odd reads as empty; asks are sorted, finite, never in the future", () => {
    expect(parseRating(null, NOW)).toEqual(emptyRating());
    expect(parseRating("{nope", NOW)).toEqual(emptyRating());
    expect(parseRating(JSON.stringify({ v: 1, asks: [NOW, "x", NOW - DAY, null, NOW + 400 * DAY, Infinity] }), NOW).asks).toEqual([NOW - DAY, NOW]);
  });
});

describe("runtime (Preferences fake, web)", () => {
  beforeEach(async () => {
    resetDevice();
    (globalThis as { __reviewFake?: unknown }).__reviewFake = undefined;
  });
  const reviews = (): number => ((globalThis as { __reviewFake?: { requests: unknown[] } }).__reviewFake?.requests.length ?? 0);

  it("first session: no ask; second session: one ask, persisted, then none for the rest of it", async () => {
    await loadSessionCount();
    expect(await rating.moment("dailySparkle", NOW)).toBe("first-session");
    noteResume(SESSION_GAP_MS + 1);
    expect(await rating.moment("dailySparkle", NOW)).toBe("ask");
    expect(reviews()).toBe(1);
    expect(JSON.parse(fakeBackend.prefs.get("rating")!).asks).toEqual([NOW]);
    expect(await rating.moment("house5", NOW + 1000)).toBe("asked");
    expect(reviews()).toBe(1);
    // a later session within 60 days: spacing
    noteResume(SESSION_GAP_MS + 1);
    expect(await rating.moment("house10", NOW + 10 * DAY)).toBe("spacing");
  });

  it("a hint / an ad / a prompt / a dead end earlier in the session keeps it away; a new session forgets them", async () => {
    await loadSessionCount();
    noteResume(SESSION_GAP_MS + 1);
    rating.noteHint();
    expect(await rating.moment("house5", NOW)).toBe("hint");
    noteResume(SESSION_GAP_MS + 1);
    rating.noteAd();
    expect(await rating.moment("house5", NOW)).toBe("ad");
    noteResume(SESSION_GAP_MS + 1);
    rating.notePrompt(); // (in the app: the consent flow's "duskwick:prompt" event, or a question card)
    expect(await rating.moment("house5", NOW)).toBe("prompt");
    noteResume(SESSION_GAP_MS + 1);
    rating.noteDeadEnd();
    expect(await rating.moment("house5", NOW)).toBe("dead-end");
    noteResume(SESSION_GAP_MS + 1);
    expect(rating.marks).toMatchObject({ hint: false, ad: false, prompt: false, deadEnd: false, asked: false });
    expect(await rating.moment("house5", NOW)).toBe("ask");
    expect(reviews()).toBe(1);
  });

  it("no moment, no ask", async () => {
    await loadSessionCount();
    noteResume(SESSION_GAP_MS + 1);
    expect(await rating.moment(null, NOW)).toBe("not-a-moment");
    expect(reviews()).toBe(0);
  });
});
