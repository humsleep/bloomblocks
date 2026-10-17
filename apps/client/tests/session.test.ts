// Session: journal append / restore, corrupted-journal recovery, version-key
// invalidation, level cache, level end (run.bin + progress), undo, tracks, daily.
import { deriveSeed } from "@core/rng.ts";
import { MODE, verifyRun, verifySubmission } from "@core/runlog.ts";
import { levelRows } from "@games/lanterns-pips/level.ts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { levelIdFor, seedKeyFor } from "../src/game/levelIds.ts";
import { dailyParams, lanternsPips as G, levelForDaily, levelForTrack, solutionOf } from "../src/game/pipsApi.ts";
import { levelGen, localDateISO, resetClock, Session, setClock } from "../src/game/session.ts";
import {
  cellsOf, fakeBackend, fileExists, floorCells, journalFor, lanternCells, readBinary, readFile, resetDevice, settle, writeFile,
} from "./helpers.ts";

const TODAY = "2026-10-14";

async function fresh(): Promise<Session> {
  const s = await Session.restore();
  await settle();
  return s;
}

const tapCell = (s: Session, c: number): ReturnType<Session["tap"]> => s.tap(c & 7, c >> 3);

function solutionCells(s: Session): number[] {
  return cellsOf(solutionOf(s.level)!);
}

/** A wrong (non-solution) floor cell that can be toggled. */
function wrongCell(s: Session): number {
  const sol = new Set(solutionCells(s));
  return floorCells(s.level).find((c) => !sol.has(c))!;
}

function journalLines(slot: string): string[] {
  return (readFile(`pips-${slot}-journal.log`) ?? "").split("\n");
}

beforeEach(() => {
  resetDevice();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${TODAY}T10:00:00`));
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(async () => {
  await settle();
  vi.useRealTimers();
});

describe("fresh launch", () => {
  it("starts gentle 1 and writes progress, level cache and an empty journal", async () => {
    const s = await fresh();
    expect(s.track).toBe("gentle");
    expect(s.levelNumber).toBe(1);
    expect(s.seedKey).toBe(seedKeyFor("gentle", 1));
    expect(s.daily).toBeNull();
    expect(s.moves).toHaveLength(0);
    expect(s.restoreInfo).toBe("fresh (level generated)");
    expect(JSON.parse(readFile("pips-progress.json")!)).toEqual({
      v: 3, game: "pips", track: "gentle", gentle: { level: 1, cleared: 0, hints: 0 }, deduce: { level: 1, cleared: 0, hints: 0 },
    });
    expect(readFile("pips-gentle-journal.log")).toBe(`PPJ1 00000001 ${seedKeyFor("gentle", 1)}\n`);
    const cache = JSON.parse(readFile("pips-gentle-level.json")!);
    expect(cache).toEqual({ v: 1, seedKey: seedKeyFor("gentle", 1), rows: levelRows(levelForTrack("gentle", 1)) });
    // atomic writes leave no temp files behind
    expect([...fakeBackend.files.keys()].filter((k) => k.endsWith(".tmp"))).toEqual([]);
  });
});

describe("journal append / restore", () => {
  it("appends one '<move hex2><stateHash hex8>' line per tap, before anything else", async () => {
    const s = await fresh();
    const [a, b] = solutionCells(s);
    expect(tapCell(s, a!)).toBe("placed");
    expect(tapCell(s, b!)).toBe("placed");
    expect(tapCell(s, b!)).toBe("removed");
    await settle();
    const lines = journalLines("gentle");
    expect(lines.slice(1, 4).every((l) => /^[0-9a-f]{10}$/.test(l))).toBe(true);
    expect(readFile("pips-gentle-journal.log")).toBe(journalFor(1, s.seedKey, s.level, [a!, b!, b!]));
  });

  it("relaunch replays the journal to the same state, last move and toggle history", async () => {
    const s = await fresh();
    const sol = solutionCells(s);
    const w = wrongCell(s);
    for (const c of [sol[0]!, w, sol[1]!]) tapCell(s, c);
    await settle();
    const r = await fresh();
    expect(r.restoreInfo).toBe("restored 3/3 moves (level from cache)");
    expect(G.stateBytes(r.state)).toEqual(G.stateBytes(s.state));
    expect(r.recentCells).toEqual([sol[0], w, sol[1]]);
    expect(r.lastMoveCell).toBe(sol[1]);
    expect(r.restoredLastMove).toEqual({ x: sol[1]! & 7, y: sol[1]! >> 3 });
    // and play continues on the restored journal
    tapCell(r, w);
    await settle();
    expect(readFile("pips-gentle-journal.log")).toBe(journalFor(1, s.seedKey, s.level, [sol[0]!, w, sol[1]!, w]));
  });

  it("drops a torn last line (killed mid-append) and rewrites the journal", async () => {
    const s = await fresh();
    const sol = solutionCells(s);
    tapCell(s, sol[0]!);
    tapCell(s, sol[1]!);
    await settle();
    writeFile("pips-gentle-journal.log", `${readFile("pips-gentle-journal.log")}${sol[2]!.toString(16).padStart(2, "0")}3f`);
    const r = await fresh();
    expect(r.restoreInfo).toBe("restored 2/2 moves (level from cache)");
    expect(lanternCells(r.state)).toEqual([sol[0], sol[1]].sort((x, y) => x! - y!));
    expect(readFile("pips-gentle-journal.log")).toBe(journalFor(1, s.seedKey, s.level, [sol[0]!, sol[1]!]));
  });

  it("keeps the longest verifying prefix when a middle line is corrupted", async () => {
    const s = await fresh();
    const sol = solutionCells(s);
    for (const c of sol.slice(0, 4)) tapCell(s, c);
    await settle();
    const lines = journalLines("gentle");
    // flip the move byte of line 2 to another floor cell: replay diverges from the recorded hashes
    const other = floorCells(s.level).find((c) => !sol.slice(0, 4).includes(c))!;
    lines[2] = other.toString(16).padStart(2, "0") + lines[2]!.slice(2);
    writeFile("pips-gentle-journal.log", lines.join("\n"));
    const r = await fresh();
    expect(r.restoreInfo).toBe("restored 1/4 moves (level from cache)");
    expect(lanternCells(r.state)).toEqual([sol[0]]);
    expect(readFile("pips-gentle-journal.log")).toBe(journalFor(1, s.seedKey, s.level, [sol[0]!]));
  });

  it("stops at a garbage line and never throws on binary junk", async () => {
    const s = await fresh();
    const sol = solutionCells(s);
    tapCell(s, sol[0]!);
    await settle();
    writeFile("pips-gentle-journal.log", `${readFile("pips-gentle-journal.log")}\u0000ÿ zz\n${"ab".repeat(5)}\n`);
    const r = await fresh();
    expect(r.restoreInfo).toBe("restored 1/1 moves (level from cache)");
    expect(lanternCells(r.state)).toEqual([sol[0]]);
  });

  it("an illegal move in the journal (a stone cell) is cut off", async () => {
    const s = await fresh();
    const sol = solutionCells(s);
    tapCell(s, sol[0]!);
    await settle();
    const stone = cellsOf(s.level.stones)[0]!;
    writeFile("pips-gentle-journal.log", `${readFile("pips-gentle-journal.log")}${stone.toString(16).padStart(2, "0")}00000000\n`);
    const r = await fresh();
    expect(r.restoreInfo).toBe("restored 1/2 moves (level from cache)");
  });

  it("a journal for another level (header) starts the level fresh", async () => {
    const s = await fresh();
    tapCell(s, solutionCells(s)[0]!);
    await settle();
    writeFile("pips-gentle-journal.log", journalFor(levelIdFor("gentle", 7), seedKeyFor("gentle", 7), levelForTrack("gentle", 7), []));
    const r = await fresh();
    expect(r.restoreInfo).toBe("journal for another level → fresh (level from cache)");
    expect(r.moves).toHaveLength(0);
    expect(readFile("pips-gentle-journal.log")).toBe(`PPJ1 00000001 ${seedKeyFor("gentle", 1)}\n`);
  });

  it("an empty journal file (header lost) is replaced by a fresh one", async () => {
    await fresh();
    writeFile("pips-gentle-journal.log", "");
    const r = await fresh();
    expect(r.moves).toHaveLength(0);
    expect(readFile("pips-gentle-journal.log")).toBe(`PPJ1 00000001 ${seedKeyFor("gentle", 1)}\n`);
  });

  it("a journal killed between temp write and rename is read from the .tmp file", async () => {
    const s = await fresh();
    const sol = solutionCells(s);
    tapCell(s, sol[0]!);
    tapCell(s, sol[1]!);
    await settle();
    const text = readFile("pips-gentle-journal.log")!;
    fakeBackend.files.delete("LIBRARY/lanternly/pips-gentle-journal.log");
    writeFile("pips-gentle-journal.log.tmp", text);
    const r = await fresh();
    expect(r.moves).toHaveLength(2);
  });

  it("[review P1-1] a journal recovered from .tmp is rewritten before the next append: later moves survive two more launches", async () => {
    const s = await fresh();
    const sol = solutionCells(s);
    for (const c of sol.slice(0, 3)) tapCell(s, c);
    await settle();
    // iOS rename = delete target, then move: killed in between → only the .tmp is left
    const text = readFile("pips-gentle-journal.log")!;
    fakeBackend.files.delete("LIBRARY/lanternly/pips-gentle-journal.log");
    writeFile("pips-gentle-journal.log.tmp", text);
    const r = await fresh();
    expect(r.moves).toHaveLength(3);
    // the final file carries the header again before any append
    expect(readFile("pips-gentle-journal.log")!.startsWith("PPJ1 ")).toBe(true);
    tapCell(r, sol[3]!);
    await settle();
    expect(readFile("pips-gentle-journal.log")!.split("\n")[0]).toMatch(/^PPJ1 /);
    const r2 = await fresh();
    expect(r2.moves).toHaveLength(4);
    const r3 = await fresh();
    expect(r3.moves).toHaveLength(4);
  });
});

describe("version-key invalidation and the level cache", () => {
  it("a cache with another seed key (generator bumped) is regenerated and rewritten", async () => {
    await fresh();
    const stale = seedKeyFor("gentle", 1).replace(/:g(\d+):/, (_m, v: string) => `:g${Number(v) - 1}:`);
    writeFile("pips-gentle-level.json", JSON.stringify({ v: 1, seedKey: stale, rows: ["#####", "#...#", "#...#", "#...#", "#####"] }));
    writeFile("pips-gentle-journal.log", journalFor(1, stale, levelForTrack("gentle", 1), []));
    const r = await fresh();
    expect(r.restoreInfo).toBe("journal for another level → fresh (level generated)");
    expect(r.level).toEqual(levelForTrack("gentle", 1));
    expect(JSON.parse(readFile("pips-gentle-level.json")!).seedKey).toBe(seedKeyFor("gentle", 1));
  });

  it("a valid cache is used as is (launch never regenerates)", async () => {
    await fresh();
    // same seed key, different (valid) rows: the session must trust the cache
    const rows = levelRows(levelForTrack("gentle", 2));
    writeFile("pips-gentle-level.json", JSON.stringify({ v: 1, seedKey: seedKeyFor("gentle", 1), rows }));
    const r = await fresh();
    expect(r.restoreInfo).toMatch(/\(level from cache\)$/);
    expect(levelRows(r.level)).toEqual(rows);
  });

  it.each([
    ["not JSON", "{"],
    ["wrong version", JSON.stringify({ v: 2, seedKey: "x", rows: [] })],
    ["rows not an array", JSON.stringify({ v: 1, seedKey: "lanterns-pips:gentle:g4:1", rows: "....." })],
    ["invalid level rows", JSON.stringify({ v: 1, seedKey: "lanterns-pips:gentle:g4:1", rows: ["..x..", "....."] })],
  ])("a corrupted level cache (%s) is regenerated", async (_name, text) => {
    await fresh();
    writeFile("pips-gentle-level.json", text.replace("lanterns-pips:gentle:g4:1", seedKeyFor("gentle", 1)));
    const r = await fresh();
    expect(r.level).toEqual(levelForTrack("gentle", 1));
    expect(r.restoreInfo).toMatch(/\(level generated\)$/);
  });

  it.each([
    ["not JSON", "{{"],
    ["old progress version", JSON.stringify({ v: 2, game: "pips", track: "deduce", gentle: { level: 9, cleared: 8 } })],
    ["another game's progress", JSON.stringify({ v: 3, game: "lanterns", gentle: { level: 9, cleared: 8 } })],
    ["negative / fractional fields", JSON.stringify({ v: 3, game: "pips", track: "gentle", gentle: { level: -1, cleared: 1.5 }, deduce: { level: 0, cleared: 0 } })],
  ])("corrupted progress (%s) falls back to gentle 1", async (_name, text) => {
    writeFile("pips-progress.json", text);
    const r = await fresh();
    expect(r.track).toBe("gentle");
    expect(r.levelNumber).toBe(1);
  });

  it("pre-pips lanterns saves are ignored", async () => {
    writeFile("progress.json", JSON.stringify({ v: 1, level: 12 }));
    writeFile("journal.log", "LJ1 garbage\n");
    const r = await fresh();
    expect(r.levelNumber).toBe(1);
    expect(readFile("progress.json")).not.toBeNull();
  });
});

describe("level end", () => {
  it("writes a verifying run.bin, advances progress, and resets the journal for the next level", async () => {
    const s = await fresh();
    const sol = solutionCells(s);
    const res = sol.map((c) => tapCell(s, c));
    expect(res.at(-1)).toBe("complete");
    expect(res.slice(0, -1).every((r) => r === "placed")).toBe(true);
    expect(s.complete).toBe(true);
    expect(tapCell(s, sol[0]!)).toBe("locked");
    expect(s.undo()).toBe(-1);
    expect(s.hint()).toEqual({ kind: "none" });
    await settle();
    const bin = readBinary("runs/p5-00000001.bin")!;
    expect(bin).not.toBeNull();
    const v = verifyRun(G, bin, s.level);
    expect(v.ok && v.complete).toBe(true);
    if (v.ok) expect(v.run.header.levelId).toBe(1);
    expect(JSON.parse(readFile("pips-progress.json")!).gentle).toEqual({ level: 2, cleared: 1, hints: 0 });
    expect(readFile("pips-gentle-journal.log")).toBe(`PPJ1 00000002 ${seedKeyFor("gentle", 2)}\n`);
    expect(s.nextReady).toBe(false); // no worker in node: advance() generates on demand
    s.advance();
    expect(s.levelNumber).toBe(2);
    expect(s.complete).toBe(false);
    expect(s.level).toEqual(levelForTrack("gentle", 2));
    await settle();
    expect(JSON.parse(readFile("pips-gentle-level.json")!).seedKey).toBe(seedKeyFor("gentle", 2));
  });

  it("[review P2] next level cannot be generated: status 'failed' (not an endless wait), retry, then the solved level comes back consistently", async () => {
    const real = levelGen.track;
    levelGen.track = (t, n) => {
      if (n >= 2) throw new Error("boom");
      return real(t, n);
    };
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const s = await fresh();
      for (const c of solutionCells(s)) tapCell(s, c);
      expect(s.complete).toBe(true);
      await s.nextLevelReady; // resolves (never hangs) …
      expect(s.nextLevelStatus).toBe("failed"); // … and says so
      s.retryNext();
      expect(s.nextLevelStatus).toBe("generating");
      await s.nextLevelReady;
      expect(s.nextLevelStatus).toBe("failed");
      s.fallbackToSolved();
      expect(s.levelNumber).toBe(1);
      expect(s.complete).toBe(false);
      expect(s.moves).toHaveLength(0);
      await settle();
      expect(JSON.parse(readFile("pips-progress.json")!).gentle).toEqual({ level: 1, cleared: 0, hints: 0 });
      // relaunch: level 1 from the cache, the failing generator is never needed
      const r = await fresh();
      expect(r.levelNumber).toBe(1);
      expect(r.restoreInfo).toContain("level from cache");
    } finally {
      levelGen.track = real;
    }
  });

  it("killed after the last move but before level end was saved: relaunch finishes the level once", async () => {
    const s = await fresh();
    const sol = solutionCells(s);
    // the device only got the journal (progress still says level 1)
    writeFile("pips-gentle-journal.log", journalFor(1, s.seedKey, s.level, sol));
    const r = await fresh();
    expect(r.complete).toBe(true);
    expect(r.levelNumber).toBe(1);
    expect(r.restoredLastMove).not.toBeNull();
    expect(JSON.parse(readFile("pips-progress.json")!).gentle).toMatchObject({ level: 2, cleared: 1 });
    // a second relaunch on the advanced progress is gentle 2 (cleared not double-counted)
    const r2 = await fresh();
    expect(r2.levelNumber).toBe(2);
    expect(JSON.parse(readFile("pips-progress.json")!).gentle).toMatchObject({ level: 2, cleared: 1 });
  });
});

describe("undo", () => {
  it("pops the last toggle, rebuilds state and rewrites the journal without it", async () => {
    const s = await fresh();
    const sol = solutionCells(s);
    const w = wrongCell(s);
    tapCell(s, sol[0]!);
    tapCell(s, w);
    tapCell(s, sol[1]!);
    expect(s.undo()).toBe(sol[1]);
    expect(s.lastMoveCell).toBe(w);
    expect(s.recentCells).toEqual([sol[0], w]);
    expect(lanternCells(s.state)).toEqual([sol[0]!, w].sort((x, y) => x - y));
    await settle();
    expect(readFile("pips-gentle-journal.log")).toBe(journalFor(1, s.seedKey, s.level, [sol[0]!, w]));
    expect(s.undo()).toBe(w);
    expect(s.undo()).toBe(sol[0]);
    expect(s.undo()).toBe(-1);
    expect(s.lastMoveCell).toBe(-1);
    await settle();
    const r = await fresh();
    expect(r.moves).toHaveLength(0);
  });

  it("undo of a removal puts the lantern back", async () => {
    const s = await fresh();
    const c = solutionCells(s)[0]!;
    tapCell(s, c);
    tapCell(s, c);
    expect(lanternCells(s.state)).toEqual([]);
    expect(s.undo()).toBe(c);
    expect(lanternCells(s.state)).toEqual([c]);
  });
});

describe("hints", () => {
  it("counts hints per track in progress; removeWrong points at a placed wrong lantern", async () => {
    const s = await fresh();
    const w = wrongCell(s);
    tapCell(s, w);
    const h = s.hint();
    expect(h).toMatchObject({ kind: "removeWrong", cells: [w], remaining: 1 });
    expect(s.hintsUsed()).toBe(1);
    expect(s.removeMany([w, w, 63])).toEqual([w]);
    const p = s.hint();
    expect(p.kind).toBe("place");
    if (p.kind === "place") expect(solutionCells(s)).toContain(p.cell);
    await settle();
    expect(JSON.parse(readFile("pips-progress.json")!).gentle.hints).toBe(2);
  });
});

describe("tracks", () => {
  it("switches gentle ↔ deduce with separate journals, ids and progress", async () => {
    const s = await fresh();
    const g0 = solutionCells(s)[0]!;
    tapCell(s, g0);
    await s.switchTrack();
    await settle();
    expect(s.track).toBe("deduce");
    expect(s.levelNumber).toBe(1);
    expect(s.seedKey).toBe(seedKeyFor("deduce", 1));
    expect(JSON.parse(readFile("pips-progress.json")!).track).toBe("deduce");
    expect(readFile("pips-deduce-journal.log")).toBe(`PPJ1 01000001 ${seedKeyFor("deduce", 1)}\n`);
    const d0 = solutionCells(s)[0]!;
    tapCell(s, d0);
    await s.switchTrack();
    expect(s.track).toBe("gentle");
    expect(lanternCells(s.state)).toEqual([g0]);
    await settle();
    // relaunch lands on the track the player was on
    const r = await fresh();
    expect(r.track).toBe("gentle");
    await r.switchTrack();
    expect(lanternCells(r.state)).toEqual([d0]);
  });

  it("deduce run.bin names use the 0x01000000 id space", async () => {
    const s = await fresh();
    await s.switchTrack();
    for (const c of solutionCells(s)) tapCell(s, c);
    await settle();
    expect(readBinary("runs/p5-01000001.bin")).not.toBeNull();
    expect(JSON.parse(readFile("pips-progress.json")!).deduce).toMatchObject({ level: 2, cleared: 1 });
  });
});

describe("daily", () => {
  it("opens today's daily with its own files; completion calls the hook once and keeps a run.bin", async () => {
    const s = await fresh();
    const done = vi.fn();
    s.onDailyComplete = done;
    await s.openDaily(TODAY, false);
    await settle();
    expect(s.daily).toBe(TODAY);
    expect(s.seedKey).toBe(dailyParams(TODAY).seedKey);
    expect(s.level).toEqual(levelForDaily(TODAY));
    expect(JSON.parse(readFile("pips-progress.json")!).daily).toBe(TODAY);
    expect(readFile("pips-daily-journal.log")).toMatch(/^PPJ1 [0-9a-f]{8} lanterns-pips:daily:g\d+:2026-10-14\n$/);
    const before = s.hintsUsed("gentle");
    s.hint(); // daily hints are not counted on the track
    expect(s.hintsUsed("gentle")).toBe(before);
    for (const c of solutionCells(s)) tapCell(s, c);
    expect(done).toHaveBeenCalledTimes(1);
    await settle();
    expect(verifyRun(G, readBinary(`runs/p5-daily-${TODAY}.bin`)!, s.level)).toMatchObject({ ok: true, complete: true });
    // the track progress is untouched by a daily
    expect(JSON.parse(readFile("pips-progress.json")!).gentle).toMatchObject({ level: 1, cleared: 0 });
  });

  it("relaunch the same day resumes the (complete) daily; the next day goes back to the track", async () => {
    const s = await fresh();
    await s.openDaily(TODAY, false);
    for (const c of solutionCells(s)) tapCell(s, c);
    await settle();
    const r = await fresh();
    expect(r.daily).toBe(TODAY);
    expect(r.complete).toBe(true);
    vi.setSystemTime(new Date("2026-10-15T08:00:00"));
    const n = await fresh();
    expect(n.daily).toBeNull();
    expect(n.track).toBe("gentle");
    expect(JSON.parse(readFile("pips-progress.json")!).daily).toBeUndefined();
  });

  it("a completed daily reopened as practice starts over with a fresh journal", async () => {
    const s = await fresh();
    await s.openDaily(TODAY, false);
    for (const c of solutionCells(s)) tapCell(s, c);
    await s.leaveDaily();
    await s.openDaily(TODAY, true);
    expect(s.complete).toBe(false);
    expect(s.moves).toHaveLength(0);
    await settle();
    expect(readFile("pips-daily-journal.log")!.split("\n")).toHaveLength(2);
  });

  it("leaving the daily returns to the track run in memory (moves intact)", async () => {
    const s = await fresh();
    const c = solutionCells(s)[0]!;
    tapCell(s, c);
    await s.openDaily(TODAY, false);
    await s.leaveDaily();
    expect(s.daily).toBeNull();
    expect(lanternCells(s.state)).toEqual([c]);
    expect(JSON.parse((await settle(), readFile("pips-progress.json"))!).daily).toBeUndefined();
  });

  // BUG-1 (fixed): the daily used to be filed under runs["gentle"], so after a relaunch into
  // today's daily, home (leaveDaily) "returned" to the daily itself while progress.daily was gone.
  it("[BUG-1] after a relaunch into today's daily, home (leaveDaily) returns to the track", async () => {
    const s = await fresh();
    await s.openDaily(TODAY, false);
    tapCell(s, solutionCells(s)[0]!);
    await settle();
    const r = await fresh(); // app killed on the daily, relaunched the same day
    expect(r.daily).toBe(TODAY);
    await r.leaveDaily();
    expect(r.daily).toBeNull();
    expect(r.track).toBe("gentle");
    expect(r.seedKey).toBe(seedKeyFor("gentle", 1));
    await settle();
    expect(JSON.parse(readFile("pips-progress.json")!).daily).toBeUndefined();
    // and a relaunch now lands on the track too
    const r2 = await fresh();
    expect(r2.daily).toBeNull();
    expect(r2.seedKey).toBe(seedKeyFor("gentle", 1));
  });

  it("[BUG-1] relaunch into the daily → home lands on the home track (deduce) with its moves", async () => {
    const s = await fresh();
    await s.switchTrack();
    const d0 = solutionCells(s)[0]!;
    tapCell(s, d0);
    await s.openDaily(TODAY, false);
    tapCell(s, solutionCells(s)[0]!);
    await settle();
    const r = await fresh();
    expect(r.daily).toBe(TODAY);
    expect(r.homeTrack).toBe("deduce");
    await r.leaveDaily();
    expect([r.daily, r.track, r.levelNumber]).toEqual([null, "deduce", 1]);
    expect(lanternCells(r.state)).toEqual([d0]);
    // the daily stays as it was (its own slot): reopening it shows the same move
    await r.openDaily(TODAY, false);
    expect(r.moves).toHaveLength(1);
    await r.leaveDaily();
    expect(r.track).toBe("deduce");
  });

  it("[BUG-1] relaunch into the daily → the track button (switchTrack) also leaves to the home track", async () => {
    const s = await fresh();
    const g0 = solutionCells(s)[0]!;
    tapCell(s, g0);
    await s.openDaily(TODAY, false);
    await settle();
    const r = await fresh();
    expect(r.daily).toBe(TODAY);
    await r.switchTrack();
    expect([r.daily, r.track]).toEqual([null, "gentle"]);
    expect(lanternCells(r.state)).toEqual([g0]);
    // a second switch is a real track switch now
    await r.switchTrack();
    expect([r.daily, r.track]).toEqual([null, "deduce"]);
  });

  it("[BUG-1] daily moves never leak into the track journal (and vice versa) across leave / reopen / relaunch", async () => {
    const s = await fresh();
    const g = solutionCells(s);
    tapCell(s, g[0]!);
    await s.openDaily(TODAY, false);
    const d = solutionCells(s);
    tapCell(s, d[0]!);
    await s.leaveDaily();
    tapCell(s, g[1]!);
    await s.openDaily(TODAY, false); // same date: the run in memory, not a re-read
    expect(lanternCells(s.state)).toEqual([d[0]]);
    tapCell(s, d[1]!);
    await settle();
    expect(readFile("pips-gentle-journal.log")).toBe(journalFor(1, seedKeyFor("gentle", 1), levelForTrack("gentle", 1), [g[0]!, g[1]!]));
    expect(readFile("pips-daily-journal.log")).toBe(journalFor(dailyParams(TODAY).levelId, dailyParams(TODAY).seedKey, levelForDaily(TODAY), [d[0]!, d[1]!]));
    const r = await fresh();
    expect(r.moves).toHaveLength(2);
    await r.leaveDaily();
    expect(lanternCells(r.state)).toEqual([g[0]!, g[1]!].sort((a, b) => a - b));
  });

  it("[BUG-1] midnight on the daily: home still returns to the track; the next day's daily is a new run", async () => {
    const s = await fresh();
    await s.openDaily(TODAY, false);
    tapCell(s, solutionCells(s)[0]!);
    vi.setSystemTime(new Date("2026-10-15T00:00:30"));
    expect(s.daily).toBe(TODAY); // the open daily stays the 14th until the player leaves
    await s.leaveDaily();
    expect(s.daily).toBeNull();
    await s.openDaily("2026-10-15", false);
    expect(s.daily).toBe("2026-10-15");
    expect(s.moves).toHaveLength(0);
    expect(s.seedKey).toBe(dailyParams("2026-10-15").seedKey);
    await settle();
    // killed now and relaunched the same (new) day → the 15th's daily; home → the track
    const r = await fresh();
    expect(r.daily).toBe("2026-10-15");
    await r.leaveDaily();
    expect([r.daily, r.track]).toEqual([null, "gentle"]);
  });

  it("[BUG-1] killed on yesterday's daily: relaunch goes to the track and clears progress.daily", async () => {
    const s = await fresh();
    await s.openDaily(TODAY, false);
    await settle();
    vi.setSystemTime(new Date("2026-10-15T07:00:00"));
    const r = await fresh();
    expect([r.daily, r.track]).toEqual([null, "gentle"]);
    await r.leaveDaily(); // no-op off the daily
    expect(r.track).toBe("gentle");
    expect(JSON.parse(readFile("pips-progress.json")!).daily).toBeUndefined();
  });

  it("the injectable clock decides the daily resume (no Date replacement needed)", async () => {
    vi.useRealTimers();
    try {
      setClock({ now: () => new Date(2026, 9, 14, 12, 0, 0) });
      expect(localDateISO()).toBe(TODAY);
      const s = await fresh();
      await s.openDaily(TODAY, false);
      await settle();
      expect((await fresh()).daily).toBe(TODAY);
      setClock({ now: () => new Date(2026, 9, 15, 0, 0, 1) });
      expect(localDateISO()).toBe("2026-10-15");
      expect((await fresh()).daily).toBeNull();
    } finally {
      resetClock();
    }
  });

  // BUG-2 (fixed): the daily run.bin was written with mode free; the server's verifySubmission
  // for a daily (MODE.daily) rejected every one of them (expect-mode).
  it("[BUG-2] the daily run.bin header uses the daily mode and passes the core verifySubmission", async () => {
    const s = await fresh();
    await s.openDaily(TODAY, false);
    for (const c of solutionCells(s)) tapCell(s, c);
    await settle();
    const bin = readBinary(`runs/p5-daily-${TODAY}.bin`)!;
    const v = verifyRun(G, bin, s.level);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.run.header.mode).toBe(MODE.daily);
    // what a server derives on its own from the date (never from the file)
    const p = dailyParams(TODAY);
    const expected = { gameId: G.id, mode: MODE.daily, levelId: p.levelId >>> 0, seed: deriveSeed(p.seedKey) };
    expect(verifySubmission(G, bin, levelForDaily(TODAY), expected)).toMatchObject({ ok: true, complete: true });
    // a track run.bin stays mode free (and is rejected as a daily submission)
    await s.leaveDaily();
    for (const c of solutionCells(s)) tapCell(s, c);
    await settle();
    const track = readBinary("runs/p5-00000001.bin")!;
    const tv = verifyRun(G, track, levelForTrack("gentle", 1));
    expect(tv.ok && tv.run.header.mode).toBe(MODE.free);
    expect(verifySubmission(G, track, levelForTrack("gentle", 1), { gameId: G.id, mode: MODE.daily, levelId: 1, seed: deriveSeed(seedKeyFor("gentle", 1)) })).toMatchObject({ ok: false, code: "expect-mode" });
  });

  it("the daily's run.bin is the first completion: a practice replay never overwrites it", async () => {
    const s = await fresh();
    await s.openDaily(TODAY, false);
    const sol = solutionCells(s);
    const w = wrongCell(s);
    tapCell(s, w);
    tapCell(s, w);
    for (const c of sol) tapCell(s, c);
    await settle();
    const first = readBinary(`runs/p5-daily-${TODAY}.bin`)!;
    await s.leaveDaily();
    await s.openDaily(TODAY, true);
    for (const c of sol) tapCell(s, c);
    await settle();
    expect(readBinary(`runs/p5-daily-${TODAY}.bin`)).toEqual(first);
  });

  it("killed after the daily's last move but before its run.bin landed: relaunch writes it", async () => {
    const s = await fresh();
    await s.openDaily(TODAY, false);
    const sol = solutionCells(s);
    await settle();
    const p = dailyParams(TODAY);
    writeFile("pips-daily-journal.log", journalFor(p.levelId, p.seedKey, levelForDaily(TODAY), sol));
    expect(readBinary(`runs/p5-daily-${TODAY}.bin`)).toBeNull();
    const r = await fresh();
    expect([r.daily, r.complete]).toEqual([TODAY, true]);
    await settle();
    const bin = readBinary(`runs/p5-daily-${TODAY}.bin`)!;
    expect(verifySubmission(G, bin, levelForDaily(TODAY), { gameId: G.id, mode: MODE.daily, levelId: p.levelId, seed: deriveSeed(p.seedKey) })).toMatchObject({ ok: true, complete: true });
  });

  it("localDateISO is the device-local calendar date", () => {
    expect(localDateISO(new Date(2026, 9, 14, 23, 59, 59))).toBe("2026-10-14");
    expect(localDateISO(new Date(2026, 9, 15, 0, 0, 0))).toBe("2026-10-15");
    expect(localDateISO(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("dev jump", () => {
  it("jumps to level n with an empty board and consistent progress", async () => {
    const s = await fresh();
    s.devJump(4);
    await settle();
    expect(s.levelNumber).toBe(4);
    expect(JSON.parse(readFile("pips-progress.json")!).gentle).toMatchObject({ level: 4, cleared: 3 });
    expect(readFile("pips-gentle-journal.log")).toBe(`PPJ1 00000004 ${seedKeyFor("gentle", 4)}\n`);
  });
});

describe("storage failures never break play", () => {
  // OBS-1 (fixed): one failed append used to drop every later move of the level on relaunch
  // (their hashes include the lost move). A failed append now rewrites the journal from memory.
  it("[OBS-1] a failed append is repaired at once: relaunch restores every move", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const s = await fresh();
    const sol = solutionCells(s);
    tapCell(s, sol[0]!);
    await settle(); // the first append has landed; the next one fails
    fakeBackend.failNext("appendFile");
    tapCell(s, sol[1]!);
    tapCell(s, sol[2]!);
    await settle();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("journal append failed"), expect.any(Error));
    expect(readFile("pips-gentle-journal.log")).toBe(journalFor(1, s.seedKey, s.level, sol.slice(0, 3)));
    const r = await fresh();
    expect(r.restoreInfo).toBe("restored 3/3 moves (level from cache)");
    expect(lanternCells(r.state)).toEqual(sol.slice(0, 3).sort((a, b) => a - b));
  });

  it("[OBS-1] a torn append (half a line written, then an error) is repaired too", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const s = await fresh();
    const sol = solutionCells(s);
    tapCell(s, sol[0]!);
    await settle();
    // the append writes a fragment and then throws
    const path = "LIBRARY/lanternly/pips-gentle-journal.log";
    const fs = await import("./fakes/filesystem.ts");
    const orig = fs.Filesystem.appendFile;
    vi.spyOn(fs.Filesystem, "appendFile").mockImplementationOnce(async (o) => {
      const f = fakeBackend.files.get(path)!;
      f.data += String(o.data).slice(0, 4);
      throw new Error("disk full mid-write");
    });
    tapCell(s, sol[1]!);
    tapCell(s, sol[2]!);
    await settle();
    expect(fs.Filesystem.appendFile).not.toBe(orig);
    expect(readFile("pips-gentle-journal.log")).toBe(journalFor(1, s.seedKey, s.level, sol.slice(0, 3)));
    const r = await fresh();
    expect(r.moves.map((m) => m[0])).toEqual(sol.slice(0, 3));
  });

  it("[OBS-1] append AND the repair write fail: the next move rewrites the journal (no line is lost)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const s = await fresh();
    const sol = solutionCells(s);
    const w = wrongCell(s);
    tapCell(s, sol[0]!);
    await settle();
    fakeBackend.failNext("appendFile");
    fakeBackend.failNext("writeFile");
    tapCell(s, sol[1]!); // lost on disk for now
    await settle();
    expect(readFile("pips-gentle-journal.log")).toBe(journalFor(1, s.seedKey, s.level, [sol[0]!]));
    const appendsBefore = fakeBackend.calls.filter((c) => c.op === "appendFile").length;
    tapCell(s, w); // the slot is dirty: a full rewrite, not an append onto the gap
    await settle();
    expect(fakeBackend.calls.filter((c) => c.op === "appendFile").length).toBe(appendsBefore);
    tapCell(s, w); // clean again: back to appends
    await settle();
    expect(fakeBackend.calls.filter((c) => c.op === "appendFile").length).toBe(appendsBefore + 1);
    const r = await fresh();
    expect(r.moves.map((m) => m[0])).toEqual([sol[0], sol[1], w, w]);
  });

  it("[OBS-1] a failed undo rewrite is repaired by the next move (the undone move does not come back)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const s = await fresh();
    const sol = solutionCells(s);
    tapCell(s, sol[0]!);
    tapCell(s, sol[1]!);
    await settle();
    fakeBackend.failNext("rename");
    s.undo();
    await settle();
    tapCell(s, sol[2]!);
    await settle();
    const r = await fresh();
    expect(r.moves.map((m) => m[0])).toEqual([sol[0], sol[2]]);
  });

  it("[OBS-1] a failed level-end journal reset is repaired by the next level's first move", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const s = await fresh();
    const sol = solutionCells(s);
    for (const c of sol.slice(0, -1)) tapCell(s, c);
    await settle();
    // level end: run.bin, progress, then the journal header of level 2 — only that one fails
    const fs = await import("./fakes/filesystem.ts");
    const rename = fs.Filesystem.rename.bind(fs.Filesystem);
    let failed = 0;
    vi.spyOn(fs.Filesystem, "rename").mockImplementation(async (o) => {
      if (o.to.endsWith("pips-gentle-journal.log") && failed++ === 0) throw new Error("injected rename failure");
      return rename(o);
    });
    tapCell(s, sol.at(-1)!);
    await settle();
    expect(failed).toBe(1);
    expect(readFile("pips-gentle-journal.log")!.startsWith("PPJ1 00000001 ")).toBe(true); // still level 1's journal
    expect(JSON.parse(readFile("pips-progress.json")!).gentle.level).toBe(2);
    s.advance();
    const c = solutionCells(s)[0]!;
    tapCell(s, c);
    await settle();
    expect(readFile("pips-gentle-journal.log")).toBe(journalFor(2, seedKeyFor("gentle", 2), levelForTrack("gentle", 2), [c]));
  });

  it("files exist for every slot after a full session", async () => {
    const s = await fresh();
    await s.switchTrack();
    await s.openDaily(TODAY, false);
    await settle();
    for (const f of ["pips-progress.json", "pips-gentle-level.json", "pips-deduce-level.json", "pips-daily-level.json", "pips-gentle-journal.log", "pips-deduce-journal.log", "pips-daily-journal.log"]) {
      expect(fileExists(f), f).toBe(true);
    }
  });
});
