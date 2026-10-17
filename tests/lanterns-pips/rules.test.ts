import { describe, expect, it } from "vitest";
import { GAME_ID } from "../../core/game.ts";
import { MODE, encodeRun, recordRun, verifyRun } from "../../core/runlog.ts";
import * as P from "../../games/lanterns-pips/index.ts";
import { countSolutions } from "../../games/lanterns-pips/solver.ts";
import { bruteSolutions } from "./brute.ts";

const { lanternsPips } = P;

// 5×5 level with a unique solution (pipsLevelForIndex(1); checked below by brute force).
const ROWS = [
  "..#0.",
  "1....",
  ".....",
  "....0",
  ".12..",
];

function play(level: P.PipsLevel, moves: readonly P.PipsMove[]): P.PipsState {
  let s = lanternsPips.init("test", level);
  for (const m of moves) {
    const n = lanternsPips.apply(s, m);
    if (!n) throw new Error(`illegal ${m.x},${m.y}`);
    s = n;
  }
  return s;
}

describe("lanterns-pips rules", () => {
  const level = P.parseLevel(ROWS);

  it("has its own gameId and the lanterns move encoding", () => {
    expect(lanternsPips.id).toBe(GAME_ID.lanternsPips);
    expect(lanternsPips.id).not.toBe(GAME_ID.lanterns);
    expect([...lanternsPips.encodeMove({ x: 3, y: 2 })]).toEqual([19]);
    expect(lanternsPips.decodeMove(Uint8Array.of(0x40))).toBeNull();
  });

  it("parses digits as numbered stones and round-trips the text", () => {
    expect(level.clues[P.index(0, 1)]).toBe(1);
    expect(level.clues[P.index(2, 4)]).toBe(2);
    expect(level.clues[P.index(3, 0)]).toBe(0);
    expect(level.clues[P.index(2, 0)]).toBe(P.NO_CLUE);
    expect(P.hasBit(level.stones, P.index(3, 0))).toBe(true);
    expect(P.levelRows(level)).toEqual(ROWS);
    expect(() => P.parseLevel(["5....", ".....", ".....", ".....", "....."])).toThrow();
    expect(() => P.parseLevel(["4....", ".....", ".....", ".....", "....."])).toThrow(); // corner stone has 2 neighbours
  });

  it("brute force and the exact counter agree: exactly one solution, and it completes", () => {
    const sols = bruteSolutions(level);
    expect(sols.length).toBe(1);
    const res = countSolutions(level, 10);
    expect(res.count).toBe(1);
    expect(P.bbEqual(res.solution, sols[0]!)).toBe(true);
    const s = play(level, P.cellsOf(sols[0]!));
    expect(lanternsPips.isComplete(s)).toBe(true);
  });

  it("all lit and no conflict but a number off → not complete", () => {
    const sol = countSolutions(level).solution;
    // Drop the number check by testing a level without numbers but the same stones: a different full lighting.
    const plain = P.parseLevel(ROWS.map((r) => r.replace(/[0-4]/g, "#")));
    const others = bruteSolutions(plain, 50).filter((b) => !P.bbEqual(b, sol));
    expect(others.length).toBeGreaterThan(0);
    const s = play(level, P.cellsOf(others[0]!));
    const a = P.analyze(s);
    expect(P.popcount(a.conflicts)).toBe(0);
    expect(P.bbEqual(P.darkCells(s), P.EMPTY)).toBe(true);
    expect(P.popcount(a.unmatched)).toBeGreaterThan(0);
    expect(lanternsPips.isComplete(s)).toBe(false);
  });

  it("toggle: stone/off-board illegal, never mutates, no moves after completion", () => {
    const s0 = lanternsPips.init("t", level);
    const before = lanternsPips.stateBytes(s0);
    expect(lanternsPips.apply(s0, { x: 3, y: 0 })).toBeNull(); // numbered stone
    expect(lanternsPips.apply(s0, { x: 2, y: 0 })).toBeNull(); // plain stone
    expect(lanternsPips.apply(s0, { x: 5, y: 0 })).toBeNull();
    const s1 = lanternsPips.apply(s0, { x: 0, y: 0 })!;
    expect(P.hasBit(s1.lanterns, 0)).toBe(true);
    expect(lanternsPips.stateBytes(s0)).toEqual(before);
    const done = play(level, P.cellsOf(countSolutions(level).solution));
    expect(lanternsPips.apply(done, { x: 0, y: 0 })).toBeNull();
  });

  it("stateBytes: 60 bytes, encodes numbers, changes with lanterns", () => {
    const s = lanternsPips.init("t", level);
    const b = lanternsPips.stateBytes(s);
    expect(b.length).toBe(60);
    expect(b[2]).toBe(5); // numbered stones
    expect(b[28]! & 0xf).toBe(0xf); // cell 0: floor
    expect(b[29]! & 0xf).toBe(0xf); // cell 2: plain stone
    expect(b[29]! >> 4).toBe(0); // cell 3: '0'
    expect(b[32]! & 0xf).toBe(1); // cell 8 (A2): '1'
    const t = lanternsPips.apply(s, { x: 0, y: 0 })!;
    expect(lanternsPips.stateBytes(t)).not.toEqual(b);
  });

  it("run.bin round-trip with gameId 5", () => {
    const moves = P.cellsOf(countSolutions(level).solution);
    const { run } = recordRun(lanternsPips, { seed: "lanterns-pips:test", params: level, moves, mode: MODE.free, levelId: 0xf0000001 });
    const bin = encodeRun(run);
    expect(bin[3]).toBe(GAME_ID.lanternsPips);
    const v = verifyRun(lanternsPips, bin, level);
    expect(v.ok && v.complete).toBe(true);
  });
});
