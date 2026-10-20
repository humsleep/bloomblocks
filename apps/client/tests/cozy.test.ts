// R4 rewards (docs/team/r4-village-story-rewards.md §3): the cottage's cozy score / level, what each reward
// needs, and the third streak shield (cozy level 3). The ads side (cozy evening) is in src/ads/__tests__/policy.test.ts.
import { afterEach, describe, expect, it } from "vitest";
import { pieceBit, SETS } from "../src/village/catalog.ts";
import { COZY_AT, cozyLevel, cozyScore, emptyRoom, place, setsDone, starterRoom } from "../src/village/model.ts";
import { cozyBit, cozyReached, friendBit, SKINS, skinUnlocked, themeUnlocked } from "../src/game/cosmetics.ts";
import { liveStreak, shieldsLeft, type StreakState } from "../src/game/daily.ts";
import { setShieldsPerMonth, shieldsPerMonthNow } from "../src/game/shieldCount.ts";

describe("cozy score and level", () => {
  it("the starter room (4 pieces, three of them cream) is still level 0", () => {
    const r = starterRoom();
    expect(cozyScore(r)).toBe(4 + 1);
    expect(cozyLevel(cozyScore(r))).toBe(0);
  });
  it("a completed resident set counts its 3 pieces + 3; the same item twice counts once", () => {
    let r = emptyRoom();
    const momo = SETS.find((x) => x.r === "momo")!;
    momo.items.forEach((item, i) => (r = place(r, i, pieceBit({ item, cw: item === "teaTable" ? "cream" : "rose" }))!));
    expect(setsDone(r).map((x) => x.r)).toEqual(["momo"]);
    expect(cozyScore(r)).toBe(3 + 3); // no colour match: 1 cream + 2 rose
    r = place(r, 5, pieceBit({ item: "teaTable", cw: "sage" }))!;
    expect(cozyScore(r)).toBe(6);
  });
  it("three pieces of one colourway add 1", () => {
    let r = emptyRoom();
    (["archChair", "bookshelf", "frame"] as const).forEach((item, i) => (r = place(r, i === 2 ? 15 : i, pieceBit({ item, cw: "cream" }))!));
    expect(cozyScore(r)).toBe(3 + 1);
  });
  it("levels follow COZY_AT", () => {
    expect(COZY_AT.map(cozyLevel)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(cozyLevel(COZY_AT[3]! - 1)).toBe(2);
    expect(cozyLevel(99)).toBe(5);
  });
  it("every set names three different catalog items, one set per resident", () => {
    for (const x of SETS) expect(new Set(x.items).size).toBe(3);
    expect(new Set(SETS.map((x) => x.r)).size).toBe(7);
  });
});

describe("what unlocks a reward", () => {
  it("Wick and the stone board always; others by cozy level and / or friendship", () => {
    expect(skinUnlocked("wick", [])).toBe(true);
    expect(themeUnlocked("stone", [])).toBe(true);
    expect(skinUnlocked("momo", [cozyBit(1)])).toBe(true);
    expect(skinUnlocked("momo", [friendBit(SKINS.indexOf("momo"))])).toBe(true);
    expect(skinUnlocked("luna", [cozyBit(1), cozyBit(2), cozyBit(3)])).toBe(false);
    expect(skinUnlocked("pip", [1, 2, 3, 4, 5])).toBe(false); // friendship only
    expect(skinUnlocked("pip", [friendBit(4)])).toBe(true);
    expect(themeUnlocked("garden", [cozyBit(2)])).toBe(true);
    expect(themeUnlocked("snow", [cozyBit(2)])).toBe(false);
    expect(cozyReached([cozyBit(1), cozyBit(3), friendBit(2)])).toBe(3);
  });
});

describe("third streak shield (cozy level 3)", () => {
  afterEach(() => setShieldsPerMonth(2));
  const s: StreakState = { v: 1, last: "2026-10-13", streak: 2, best: 2, shields: {} };
  it("2 shields by default: 3 missed days break the streak", () => {
    expect(shieldsPerMonthNow()).toBe(2);
    expect(liveStreak(s, "2026-10-17")).toBe(0);
  });
  it("3 shields: the same 3 missed days are covered", () => {
    setShieldsPerMonth(3);
    expect(liveStreak(s, "2026-10-17")).toBe(2);
    expect(shieldsLeft(s, "2026-10-14")).toBe(3);
  });
  it("anything but 3 means the base 2", () => {
    setShieldsPerMonth(7);
    expect(shieldsPerMonthNow()).toBe(2);
  });
});
