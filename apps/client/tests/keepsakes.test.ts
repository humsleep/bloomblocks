// Town keepsake cards: the session remembers each solved gentle board, so a tap on its house
// shows it at once (no generator wait); the file survives a relaunch and merges with memory.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { levelForTrack, solutionOf } from "../src/game/pipsApi.ts";
import { resetClock, Session } from "../src/game/session.ts";
import { KEEPSAKES_FILE, keepsakeLevel, loadKeepsakes, rememberKeepsake, resetKeepsakes } from "../src/save/keepsakes.ts";
import { cellsOf, readFile, resetDevice, settle, writeFile } from "./helpers.ts";

beforeEach(() => {
  resetDevice();
  resetKeepsakes();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-14T10:00:00"));
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(async () => {
  await settle();
  vi.useRealTimers();
  resetClock();
});

describe("keepsake boards", () => {
  it("solving a gentle level remembers its board (memory at once, file after the queue)", async () => {
    const s = await Session.restore();
    await settle();
    expect(keepsakeLevel(1)).toBeNull();
    for (const c of cellsOf(solutionOf(s.level)!)) s.tap(c & 7, c >> 3);
    expect(s.complete).toBe(true);
    expect(keepsakeLevel(1)).toEqual(levelForTrack("gentle", 1));
    await settle();
    const f = JSON.parse(readFile(KEEPSAKES_FILE)!) as { v: number; rows: Record<string, string[]> };
    expect(f.v).toBe(1);
    expect(Object.keys(f.rows)).toEqual(["1"]);
    // relaunch: read back from the file
    resetKeepsakes();
    expect(keepsakeLevel(1)).toBeNull();
    await loadKeepsakes();
    expect(keepsakeLevel(1)).toEqual(levelForTrack("gentle", 1));
  });

  it("the deduce track and the daily leave the street's boards alone", async () => {
    writeFile("pips-progress.json", JSON.stringify({ v: 3, game: "pips", track: "deduce", gentle: { level: 3, cleared: 2, hints: 0 }, deduce: { level: 1, cleared: 0, hints: 0 } }));
    const s = await Session.restore();
    await settle();
    expect(s.track).toBe("deduce");
    for (const c of cellsOf(solutionOf(s.level)!)) s.tap(c & 7, c >> 3);
    expect(s.complete).toBe(true);
    await settle();
    expect(readFile(KEEPSAKES_FILE)).toBeNull();
  });

  it("merges with the file on disk, keeps houses sorted, survives a corrupt file", async () => {
    writeFile(KEEPSAKES_FILE, JSON.stringify({ v: 1, rows: { "3": ["bogus"], "2": 7 } }));
    rememberKeepsake(5, levelForTrack("gentle", 5));
    rememberKeepsake(4, levelForTrack("gentle", 4));
    await settle();
    const f = JSON.parse(readFile(KEEPSAKES_FILE)!) as { rows: Record<string, string[]> };
    expect(Object.keys(f.rows)).toEqual(["3", "4", "5"]); // "2" (not rows) dropped, "3" kept until read
    expect(keepsakeLevel(3)).toBeNull(); // unparsable rows → generated again later, never a crash
    expect(keepsakeLevel(5)).toEqual(levelForTrack("gentle", 5));
    writeFile(KEEPSAKES_FILE, "{not json");
    resetKeepsakes();
    await loadKeepsakes();
    expect(keepsakeLevel(4)).toBeNull();
  });
});
