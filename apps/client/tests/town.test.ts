// town/data.ts: what the street reads (never writes) from the play saves.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { countCompletion, type StreakState } from "../src/game/daily.ts";
import { festivalFor, loadTownData } from "../src/town/data.ts";
import { fakeBackend, resetDevice, setPref, writeFile } from "./helpers.ts";

beforeEach(() => {
  resetDevice();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-14T12:00:00"));
  // vitest runs with import.meta.env.DEV: data.ts reads the DEV ?town= override from location
  vi.stubGlobal("location", { search: "" });
});

describe("festival string", () => {
  it("empty / broken streak → only today's waiting lantern", () => {
    expect(festivalFor(null, "2026-10-14")).toEqual(["waiting"]);
    expect(festivalFor({ last: "2026-10-01", streak: 9, shields: {} }, "2026-10-14")).toEqual(["waiting"]);
  });
  it("done today → no waiting lantern; lit = streak", () => {
    expect(festivalFor({ last: "2026-10-14", streak: 3, shields: {} }, "2026-10-14")).toEqual(["lit", "lit", "lit"]);
  });
  it("days missed since the last completion are covered at the newest end", () => {
    expect(festivalFor({ last: "2026-10-12", streak: 2, shields: {} }, "2026-10-14")).toEqual(["lit", "lit", "covered", "waiting"]);
  });
  it("agrees with daily.ts on when a streak is alive", () => {
    let s: StreakState = { v: 1, last: null, streak: 0, best: 0, shields: {} };
    s = countCompletion(s, "2026-10-10");
    s = countCompletion(s, "2026-10-12");
    // Oct 13 missed too: Oct has 1 shield left → alive on the 14th, broken on the 15th
    expect(festivalFor(s, "2026-10-14").filter((x) => x === "lit")).toHaveLength(2);
    expect(festivalFor(s, "2026-10-15")).toEqual(["waiting"]);
  });
});

describe("loadTownData", () => {
  it("houses = gentle level − 1, tower = deduce level − 1, read-only", async () => {
    writeFile("pips-progress.json", JSON.stringify({ v: 3, game: "pips", track: "gentle", gentle: { level: 13, cleared: 12 }, deduce: { level: 4, cleared: 3 } }));
    setPref("streak", JSON.stringify({ v: 1, last: "2026-10-13", streak: 5, best: 5, shields: {} }));
    const before = JSON.stringify([...fakeBackend.files, ...fakeBackend.prefs]);
    const d = await loadTownData();
    expect(d).toMatchObject({ gentle: 12, deduce: 3, today: "2026-10-14" });
    expect(d.festival.filter((x) => x === "lit")).toHaveLength(5);
    expect(d.festival.at(-1)).toBe("waiting");
    expect(JSON.stringify([...fakeBackend.files, ...fakeBackend.prefs])).toBe(before);
  });
  it("corrupt / missing saves → an empty street", async () => {
    writeFile("pips-progress.json", "{");
    setPref("streak", "[");
    expect(await loadTownData()).toEqual({ gentle: 0, deduce: 0, festival: ["waiting"], today: "2026-10-14" });
  });
});
