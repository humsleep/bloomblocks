import { describe, expect, it } from "vitest";
import { stateHash } from "../../core/game.ts";
import { FIXTURE_LEVELS, fixtureLevel, fixtureSolution } from "../../games/lanterns/fixtureLevel.ts";
import * as L from "../../games/lanterns/index.ts";

const { lanterns } = L;
const pocket = FIXTURE_LEVELS[0]!;

function play(level: L.LanternsLevel, moves: readonly L.LanternsMove[]): L.LanternsState {
  let s = lanterns.init("test", level);
  for (const m of moves) {
    const n = lanterns.apply(s, m);
    if (!n) throw new Error(`illegal ${m.x},${m.y}`);
    s = n;
  }
  return s;
}

/** Brute force: minimal lantern count and number of minimal solutions. */
function bruteForce(level: L.LanternsLevel): { min: number; count: number } {
  const floor = L.cellsOf(L.floorMask(level));
  let min = Infinity, count = 0;
  const rec = (k: number, s: L.LanternsState, n: number): void => {
    if (n > level.budget || L.popcount(L.conflictingLanterns(s)) > 0) return;
    if (k === floor.length) {
      if (!L.isComplete(s)) return;
      if (n < min) [min, count] = [n, 0];
      if (n === min) count++;
      return;
    }
    rec(k + 1, s, n);
    // place directly (not via toggle: toggle refuses moves once the level is complete)
    rec(k + 1, { ...s, lanterns: L.withBit(s.lanterns, L.index(floor[k]!.x, floor[k]!.y), true) }, n + 1);
  };
  rec(0, L.initialState(level), 0);
  return { min, count };
}

describe("lanterns rules", () => {
  it("hand-made 5x5 level is solvable within budget (brute force) and the stored solution completes", () => {
    const level = fixtureLevel(pocket);
    expect(bruteForce(level)).toEqual({ min: 4, count: 4 });
    const s = play(level, fixtureSolution(pocket));
    expect(L.lanternsUsed(s)).toBe(4);
    expect(L.popcount(L.conflictingLanterns(s))).toBe(0);
    expect(L.bbEqual(L.litCells(s), L.floorMask(s))).toBe(true);
    expect(lanterns.isComplete(s)).toBe(true);
  });

  it("every fixture solution completes", () => {
    for (const f of FIXTURE_LEVELS) expect(lanterns.isComplete(play(fixtureLevel(f), fixtureSolution(f)))).toBe(true);
  });

  it("toggle on stone or off-board is illegal (null) and does not mutate", () => {
    const s = lanterns.init("test", fixtureLevel(pocket));
    const before = lanterns.stateBytes(s);
    expect(lanterns.apply(s, { x: 1, y: 0 })).toBeNull(); // '#'
    expect(lanterns.apply(s, { x: 5, y: 0 })).toBeNull(); // off a 5-wide board
    expect(lanterns.apply(s, { x: -1, y: 0 })).toBeNull();
    const placed = lanterns.apply(s, { x: 0, y: 0 })!;
    expect(L.lanternsUsed(placed)).toBe(1);
    expect(lanterns.stateBytes(s)).toEqual(before);
    expect(L.lanternsUsed(s)).toBe(0);
  });

  it("toggle twice removes the lantern and restores the hash", () => {
    const s = lanterns.init("test", fixtureLevel(pocket));
    const twice = lanterns.apply(lanterns.apply(s, { x: 2, y: 2 })!, { x: 2, y: 2 })!;
    expect(stateHash(lanterns, twice)).toBe(stateHash(lanterns, s));
  });

  it("light stops at stones and edges, passes over lanterns", () => {
    // pocket5:  .#... / ...#. / ..... / .#... / ...#.
    const s = play(fixtureLevel(pocket), [{ x: 0, y: 1 }]);
    const lit = L.cellsOf(L.litCells(s)).map((c) => `${c.x},${c.y}`);
    expect(lit).toEqual(["0,0", "0,1", "1,1", "2,1", "0,2", "0,3", "0,4"]); // row stops at (3,1) stone
  });

  it("detects conflicts only between lanterns that see each other", () => {
    const level = fixtureLevel(pocket);
    const seeing = play(level, [{ x: 0, y: 2 }, { x: 4, y: 2 }]); // empty row 2
    expect(L.cellsOf(L.conflictingLanterns(seeing))).toEqual([{ x: 0, y: 2 }, { x: 4, y: 2 }]);
    const blocked = play(level, [{ x: 1, y: 2 }, { x: 1, y: 4 }]); // stone at (1,3) between
    expect(L.popcount(L.conflictingLanterns(blocked))).toBe(0);
    const three = play(level, [{ x: 0, y: 2 }, { x: 4, y: 2 }, { x: 2, y: 4 }]);
    expect(L.popcount(L.conflictingLanterns(three))).toBe(2);
    expect(lanterns.isComplete(seeing)).toBe(false);
  });

  it("all lit + no conflicts but over budget is not complete", () => {
    const f = FIXTURE_LEVELS[1]!; // cross5, minimal solution uses 5
    const level = { ...fixtureLevel(f), budget: 4 };
    const s = play(level, fixtureSolution(f));
    expect(L.popcount(L.darkCells(s))).toBe(0);
    expect(lanterns.isComplete(s)).toBe(false);
  });

  it("placing beyond budget is legal", () => {
    const level = { ...fixtureLevel(pocket), budget: 0 };
    expect(lanterns.apply(lanterns.init("t", level), { x: 0, y: 0 })).not.toBeNull();
  });

  it("move encoding: x in bits 0-2, y in bits 3-5, spare bits must be 0", () => {
    expect(lanterns.encodeMove({ x: 3, y: 5 })).toEqual(Uint8Array.of(0b101011));
    expect(lanterns.decodeMove(Uint8Array.of(0b101011))).toEqual({ x: 3, y: 5 });
    expect(lanterns.decodeMove(Uint8Array.of(0x40))).toBeNull();
    expect(lanterns.decodeMove(Uint8Array.of(1, 2))).toBeNull();
    expect(() => lanterns.encodeMove({ x: 8, y: 0 })).toThrow(RangeError);
    for (let b = 0; b < 64; b++) expect(lanterns.encodeMove(lanterns.decodeMove(Uint8Array.of(b))!)[0]).toBe(b);
  });

  it("stateBytes layout is 20 bytes: w h budget 0 | stones lo hi | lanterns lo hi (LE)", () => {
    const s = play(fixtureLevel(pocket), [{ x: 4, y: 4 }]); // index 36 -> hi bit 4
    const b = lanterns.stateBytes(s);
    expect(b.length).toBe(20);
    expect([...b.slice(0, 4)]).toEqual([5, 5, 4, 0]);
    expect([...b.slice(16, 20)]).toEqual([0x10, 0, 0, 0]);
  });

  it("rejects malformed levels", () => {
    expect(() => L.parseLevel(["....", "....", "....", "....", "...."], 1)).toThrow(RangeError); // 4 wide
    expect(() => L.parseLevel([".........", ...Array(4).fill(".........")], 1)).toThrow(RangeError);
    expect(() => L.parseLevel(["....", "....."], 1)).toThrow(RangeError);
    expect(() => L.initialState({ w: 5, h: 5, budget: 1, stones: { lo: 1 << 5, hi: 0 } })).toThrow(RangeError);
  });

  it("rejects bitboard words that are not u32 integers", () => {
    const lvl = (lo: number, hi: number): L.LanternsLevel => ({ w: 8, h: 8, budget: 1, stones: { lo, hi } });
    expect(() => L.validateLevel(lvl(-1, 0))).toThrow(RangeError);
    expect(() => L.validateLevel(lvl(0, -0x80000000))).toThrow(RangeError); // int32 view of bit 31
    expect(() => L.validateLevel(lvl(0x100000000, 0))).toThrow(RangeError); // would wrap to 0
    expect(() => L.validateLevel(lvl(0, 0x100000001))).toThrow(RangeError);
    expect(() => L.validateLevel(lvl(0.5, 0))).toThrow(RangeError);
    expect(() => L.validateLevel(lvl(Number.NaN, 0))).toThrow(RangeError);
    expect(() => L.validateLevel(lvl(0xffffffff, 0x80000000))).not.toThrow();
  });

  it("8x8 boards use the hi word for rows 4-7", () => {
    const level = L.parseLevel(Array(8).fill("........"), 1);
    const s = play(level, [{ x: 7, y: 7 }]);
    expect(s.lanterns).toEqual({ lo: 0, hi: 0x80000000 });
    expect(L.popcount(L.litCells(s))).toBe(15);
  });
});

// Hand-written expectations: none of these derive the expected value from
// isComplete / conflictingLanterns / analyze, so a broken rule cannot agree with itself.
describe("lanterns rules: independent expectations", () => {
  const open8 = (): L.LanternsLevel => L.parseLevel(Array(8).fill("........"), 64);
  const at = (level: L.LanternsLevel, cells: readonly [number, number][]): L.LanternsState =>
    play(level, cells.map(([x, y]) => ({ x, y })));

  it("lit includes the lantern cell; light stops at stones and edges (literal bitboards)", () => {
    // empty 8x8, lantern at (7,3) = cell 31: row 3 (cells 24..31) + column 7 (7,15,23,31,39,47,55,63)
    expect(L.litCells(at(open8(), [[7, 3]]))).toEqual({ lo: 0xff808080, hi: 0x80808080 });
    // lantern at (7,7) = cell 63: row 7 (56..63) + column 7
    expect(L.litCells(at(open8(), [[7, 7]]))).toEqual({ lo: 0x80808080, hi: 0xff808080 });
    // pocket5 ".#... / ...#. / ..... / .#... / ...#.", lantern (0,0): (1,0) stone blocks the row
    expect(L.litCells(at(fixtureLevel(pocket), [[0, 0]]))).toEqual({ lo: 0x01010101, hi: 0x00000001 });
  });

  it("conflict counts are literal: pairs that see each other, light passes over lanterns", () => {
    expect(L.popcount(L.conflictingLanterns(at(open8(), [[7, 3], [7, 7]])))).toBe(2);
    expect(L.popcount(L.conflictingLanterns(at(open8(), [[0, 0], [7, 0], [3, 0]])))).toBe(3); // row of 3
    expect(L.popcount(L.conflictingLanterns(at(open8(), [[0, 0], [1, 1]])))).toBe(0); // diagonal
    const stoneBetween = L.parseLevel(["........", "........", "........", "........", "........", "........", ".......#", "........"], 8);
    expect(L.popcount(L.conflictingLanterns(at(stoneBetween, [[7, 3], [7, 7]])))).toBe(0);
    expect(L.analyze(at(open8(), [[7, 3], [7, 7]])).conflicts).toEqual({ lo: 0x80000000, hi: 0x80000000 });
  });

  it("all floor lit + within budget + a conflict is NOT complete", () => {
    // pocket5 solution (4,0) (1,2) (2,3) (0,4) plus (4,2), which sees (1,2) and (4,0); budget 5
    const level = { ...fixtureLevel(pocket), budget: 5 };
    const s = at(level, [[4, 2], [4, 0], [1, 2], [2, 3], [0, 4]]);
    expect(L.darkCells(s)).toEqual({ lo: 0, hi: 0 });
    expect(L.lanternsUsed(s)).toBe(5);
    expect(lanterns.isComplete(s)).toBe(false);
  });

  it("all floor lit + no conflict + over budget is NOT complete; at budget it is", () => {
    const cross = FIXTURE_LEVELS[1]!; // "..#.L", "L....", "#...#", "..L..", ".L#L." — 5 lanterns
    const cells: [number, number][] = [[4, 0], [0, 1], [2, 3], [1, 4], [3, 4]];
    expect(lanterns.isComplete(at({ ...fixtureLevel(cross), budget: 4 }, cells))).toBe(false);
    expect(lanterns.isComplete(at({ ...fixtureLevel(cross), budget: 5 }, cells))).toBe(true);
  });

  it("a dark floor cell means NOT complete", () => {
    expect(lanterns.isComplete(at(fixtureLevel(pocket), [[4, 0], [1, 2], [2, 3]]))).toBe(false); // (0,4) row dark
  });

  it("8-wide solution on cells 31 and 63 completes", () => {
    const wide = FIXTURE_LEVELS.find((l) => l.name === "wide8")!;
    const cells: [number, number][] = [[3, 0], [1, 1], [5, 2], [7, 3], [0, 4], [6, 5], [4, 6], [7, 7]];
    const s = at(fixtureLevel(wide), cells);
    expect(s.lanterns).toEqual({ lo: 0x80200208, hi: 0x80104001 }); // bits 3,9,21,31 | 0,14,20,31
    expect(lanterns.isComplete(s)).toBe(true);
  });

  it("toggling a stone is illegal in every position", () => {
    const level = fixtureLevel(pocket);
    for (const [x, y] of [[1, 0], [3, 1], [1, 3], [3, 4]] as const) {
      expect(lanterns.apply(lanterns.init("t", level), { x, y })).toBeNull();
      expect(lanterns.apply(at(level, [[0, 0]]), { x, y })).toBeNull();
    }
  });

  it("no move is legal once the level is complete (no solve -> off -> on)", () => {
    const s = at(fixtureLevel(pocket), [[4, 0], [1, 2], [2, 3], [0, 4]]);
    for (let i = 0; i < 64; i++) expect(lanterns.apply(s, { x: i & 7, y: i >> 3 })).toBeNull();
  });

  it("decodeMove accepts exactly the bytes 0..63; any spare bit makes it null", () => {
    for (let b = 0; b < 256; b++) {
      const m = lanterns.decodeMove(Uint8Array.of(b));
      if (b < 64) expect(m).toEqual({ x: b % 8, y: (b - (b % 8)) / 8 });
      else expect(m).toBeNull();
    }
  });
});
