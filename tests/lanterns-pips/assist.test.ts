// analyzeBoard and hintFor on hand-made boards.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { FORCED_ROUNDS, grade, realT2 } from "../../games/lanterns-pips/deduce.ts";
import { countSolutions } from "../../games/lanterns-pips/solver.ts";
import { hintTrace } from "../../games/lanterns-pips/hint.ts";
import * as P from "../../games/lanterns-pips/index.ts";
import { isolatedSingles, trickSignature } from "../../games/lanterns-pips/tricks.ts";
import { bbOf, hintLoop, idx } from "./trackSuite.ts";

const cellName = (i: number): string => `${"ABCDEFGH"[i & 7]}${(i >> 3) + 1}`;
const cell = (name: string): number => P.index("ABCDEFGH".indexOf(name[0]!), Number(name.slice(1)) - 1);
const state = (level: P.PipsLevel, cells: readonly string[]): P.PipsState => ({ ...P.initialState(level), lanterns: bbOf(cells.map(cell)) });
/** q is on p's row/column runs (p lights q), p itself included. */
const sees = (level: P.PipsLevel, p: number, q: number): boolean => {
  const s = { ...P.initialState(level), lanterns: bbOf([p]) };
  return P.analyzeBoard(level, s).lit[q] === 1;
};

// B4 = 1 (floor sides A4, C4), B5 = 1 (floor sides A5, C5); A4/A5 can only be lit from A4/A5.
const PEN = P.parseLevel([
  ".....",
  ".....",
  "##...",
  ".1...",
  ".1...",
]);

describe("analyzeBoard", () => {
  it("empty board: counts, nothing lit, numbered stones under, no dead cells", () => {
    const a = P.analyzeBoard(PEN, P.initialState(PEN));
    expect(a.floorCount).toBe(21);
    expect(a.litCount).toBe(0);
    expect(a.lit.length).toBe(64);
    expect([...a.lit].every((v) => v === 0)).toBe(true);
    expect(a.conflicts).toEqual([]);
    expect(a.stones).toEqual([
      { cell: cell("B4"), need: 1, have: 0, status: "under" },
      { cell: cell("B5"), need: 1, have: 0, status: "under" },
    ]);
    expect(a.deadCells).toEqual([]);
    expect(a.blocked).toEqual([]);
    expect(a.complete).toBe(false);
  });

  it("conflict pair, double-light counts, full stones make their other sides dead", () => {
    const a = P.analyzeBoard(PEN, state(PEN, ["C4", "C5"]));
    expect(a.conflicts).toEqual([[cell("C4"), cell("C5")]]);
    expect(a.litBy[cell("C4")]).toBe(2);
    expect(a.litBy[cell("C5")]).toBe(2);
    expect(a.litBy[cell("C1")]).toBe(2); // both light column C
    expect(a.litBy[cell("E4")]).toBe(1);
    expect(a.lit[cell("A4")]).toBe(0);
    expect(a.stones.map((x) => x.status)).toEqual(["ok", "ok"]);
    // A4 / A5: dark, and their only positions border a full number.
    expect(a.deadCells).toEqual([cell("A4"), cell("A5")]);
    // A4/A5 are their own (dark) spots, out by the full numbers; nothing in their runs is lit.
    expect(a.blocked).toEqual([
      { cell: cell("A4"), by: "stone", stones: [cell("B4"), cell("B5")], lanterns: [], causes: ["stone"], culprits: [cell("C4")] },
      { cell: cell("A5"), by: "stone", stones: [cell("B4"), cell("B5")], lanterns: [], causes: ["stone"], culprits: [cell("C4")] },
    ]);
    // PEN is not unique: "wrong" is measured against the first solution found (A4 … C5), so C5 is not blamed.
    expect(P.levelRows(PEN, P.solutionOf(PEN)!)).toEqual(["L....", ".L...", "##.L.", "L1..L", ".1L.."]);
    expect(a.culprit).toBe(cell("C4"));
  });

  it("regression: every number satisfied, one dark cell → it is blocked, by its full number (not 'none')", () => {
    // A1 can only be lit from A1 (B1 and A2 are stones); B1 = 1 is already satisfied by C1.
    const l = P.parseLevel([
      ".1...",
      "#....",
      ".....",
      ".....",
      ".....",
    ]);
    const a = P.analyzeBoard(l, state(l, ["C1", "B3", "D4", "E2", "A5"]));
    expect(a.conflicts).toEqual([]);
    expect(a.stones).toEqual([{ cell: cell("B1"), need: 1, have: 1, status: "ok" }]);
    expect(a.floorCount - a.litCount).toBe(1);
    expect(a.lit[cell("A1")]).toBe(0);
    // C1 fills the 1 at B1, and C1 is not in the answer: it is the culprit.
    expect(a.blocked).toEqual([{ cell: cell("A1"), by: "stone", stones: [cell("B1")], lanterns: [], causes: ["stone"], culprits: [cell("C1")] }]);
    expect(a.deadCells).toEqual([cell("A1")]);
    expect(a.complete).toBe(false);
  });

  it("blocked only by numbered stones: 0-numbers on the empty board; every excluding stone is listed", () => {
    // A1's only position is A1 itself; both its sides are 0-numbers.
    const l = P.parseLevel([
      ".0...",
      "0....",
      ".....",
      ".....",
      ".....",
    ]);
    const a = P.analyzeBoard(l, P.initialState(l));
    expect(a.litCount).toBe(0);
    // No lantern placed: nobody to blame (this board has no solution at all).
    expect(a.blocked).toEqual([{ cell: cell("A1"), by: "stone", stones: [cell("B1"), cell("A2")], lanterns: [], causes: ["stone"], culprits: [] }]);
    expect(a.culprit).toBeNull();
    expect(a.deadCells).toEqual([cell("A1")]);
    // Light alone never blocks a dark cell (it can always hold its own lantern): every blocked cell has a stone cause.
    const z = P.parseLevel([
      ".....",
      ".#...",
      ".....",
      "...#.",
      ".....",
    ]);
    const b = P.analyzeBoard(z, state(z, ["A1", "C3", "E5"]));
    expect(b.blocked).toEqual([]);
  });

  it("blocked/deadCells stay in sync and never list a lit cell (hint-loop states of generated levels)", () => {
    let light = 0;
    for (const [track, n] of [["gentle", 8], ["deduce", 9], ["deduce", 15]] as const) {
      const g = P.generatedForTrack(track, n);
      const sol = idx(g.meta.solution);
      const others = idx(P.floorMask(g.level)).filter((i) => !sol.includes(i));
      for (let k = 0; k < others.length; k++) {
        const st = state(g.level, [...sol.slice(0, k % sol.length).map((i) => cellName(i)), cellName(others[k]!)]);
        const a = P.analyzeBoard(g.level, st);
        expect(a.deadCells).toEqual(a.blocked.map((b) => b.cell));
        for (const b of a.blocked) {
          expect(a.lit[b.cell]).toBe(0);
          expect(b.stones.length).toBeGreaterThan(0);
          for (const x of b.stones) expect(a.stones.find((y) => y.cell === x)!.have).toBeGreaterThanOrEqual(g.level.clues[x]!);
          // Light causes: placed lanterns lighting a spot on the cell's runs; by/causes follow the lists.
          expect(b.causes).toEqual([...(b.lanterns.length > 0 ? ["light"] : []), "stone"]);
          expect(b.by).toBe(b.lanterns.length > 0 ? "light" : "stone");
          expect(b.lanterns).toEqual([...b.lanterns].sort((x, y) => x - y));
          for (const l of b.lanterns) {
            expect(P.hasBit(st.lanterns, l)).toBe(true);
            const spots = idx(P.floorMask(g.level)).filter((q) => sees(g.level, q, b.cell) && sees(g.level, l, q));
            expect(spots.length, `${cellName(l)} lights a spot of ${cellName(b.cell)}`).toBeGreaterThan(0);
          }
          if (b.lanterns.length > 0) light++;
        }
      }
    }
    expect(light, "some blocked cells have a light cause").toBeGreaterThan(0);
  });

  it("round-3 regression J-15: B3 between rocks A3 and C3, its spot B1 lit by the lantern at E1 → lanterns includes E1", () => {
    const l = P.parseLevel(["......", "...#2.", "0.2#..", "1....#", "......", "1...#."]);
    const a = P.analyzeBoard(l, state(l, ["C2", "C4", "A5", "E1"]));
    expect(a.conflicts).toEqual([]);
    const b3 = a.blocked.find((b) => b.cell === cell("B3"))!;
    expect(b3.lanterns).toContain(cell("E1"));
    // B2 (C2) and B5 (A5) are lit spots next to no full number; B4 also borders the full 1 at A4, so C4 is not listed.
    expect(b3.lanterns.map(cellName)).toEqual(["E1", "C2", "A5"]);
    expect(b3.stones.map(cellName)).toEqual(["A3", "C3", "A6"]);
    expect(b3.causes).toEqual(["light", "stone"]);
    expect(b3.by).toBe("light");
    // Taking E1 back frees B1, which unblocks B3.
    const after = P.analyzeBoard(l, state(l, ["C2", "C4", "A5"]));
    expect(after.deadCells).not.toContain(cell("B3"));
  });

  it("round-3 regression W-4: B6 next to the 0 at C6, its spots A6/B5 lit by the lantern at A5 → lanterns includes A5", () => {
    const l = P.parseLevel(["..#1..", ".0#...", ".....#", "#.....", "...1#.", "..01.."]);
    const a = P.analyzeBoard(l, state(l, ["E6", "D4", "E1", "F5", "F2", "A1", "C3", "A5"]));
    expect(a.conflicts).toEqual([]);
    expect(a.blocked.map((b) => cellName(b.cell))).toEqual(["B6"]);
    const b6 = a.blocked[0]!;
    expect(b6.lanterns).toContain(cell("A5"));
    expect(b6.lanterns.map(cellName)).toEqual(["D4", "A5"]);
    expect(b6.stones.map(cellName)).toEqual(["C6"]);
    expect(b6.causes).toEqual(["light", "stone"]);
    expect(b6.by).toBe("light");
    expect(P.analyzeBoard(l, state(l, ["E6", "D4", "E1", "F5", "F2", "A1", "C3"])).deadCells).toEqual([]);
  });

  it("light cause falls back to the lanterns lighting any lit spot when every lit spot also borders a full number", () => {
    // A1's spots: A1 (next to the full 1 at A2) and B1 (lit by B2, and next to the full 1 at C1).
    const l = P.parseLevel([
      "..1..",
      "1....",
      ".....",
      ".....",
      ".....",
    ]);
    const a = P.analyzeBoard(l, state(l, ["B2", "D1"]));
    expect(a.conflicts).toEqual([]);
    const a1 = a.blocked.find((b) => b.cell === cell("A1"))!;
    expect(a1).toEqual({ cell: cell("A1"), by: "light", stones: [cell("A2")], lanterns: [cell("B2")], causes: ["light", "stone"], culprits: a1.culprits });
    for (const c of a1.culprits) expect(P.hasBit(P.solutionOf(l)!, c)).toBe(false);
  });

  it("blocked: a number that still needs a lantern but has no free side left", () => {
    const a = P.analyzeBoard(PEN, state(PEN, ["A5", "E4"]));
    // A5 lights A4; E4 lights C4 → B4 has no free side.
    expect(a.stones).toEqual([
      { cell: cell("B4"), need: 1, have: 0, status: "blocked" },
      { cell: cell("B5"), need: 1, have: 1, status: "ok" },
    ]);
    expect(a.conflicts).toEqual([]);
  });

  it("0-stones: ok only with no adjacent lantern; over once one touches; 'ok' is not progress", () => {
    const z = P.parseLevel([
      "0....",
      ".....",
      "..2..",
      ".....",
      ".....",
    ]);
    const a0 = P.analyzeBoard(z, P.initialState(z));
    expect(a0.stones[0]).toEqual({ cell: 0, need: 0, have: 0, status: "ok" });
    expect(a0.litCount).toBe(0);
    const a1 = P.analyzeBoard(z, state(z, ["B1"]));
    expect(a1.stones[0]).toEqual({ cell: 0, need: 0, have: 1, status: "over" });
    // C3 = 2 with three lanterns around it → over.
    const a2 = P.analyzeBoard(z, state(z, ["C2", "B3", "D3"]));
    expect(a2.stones[1]).toEqual({ cell: cell("C3"), need: 2, have: 3, status: "over" });
  });

  it("complete flag on a solved generated level; lit = floor everywhere", () => {
    const g = P.generatedForTrack("gentle", 4);
    const a = P.analyzeBoard(g.level, { ...P.initialState(g.level), lanterns: g.meta.solution });
    expect(a.complete).toBe(true);
    expect(a.litCount).toBe(a.floorCount);
    expect(a.deadCells).toEqual([]);
    expect(a.conflicts).toEqual([]);
    expect(a.stones.every((x) => x.status === "ok")).toBe(true);
  });
});

describe("hintFor", () => {
  it("removeWrong is progressive: exactly one lantern per hint, `remaining` counts down to the placement hint", () => {
    for (const [track, n] of [["gentle", 8], ["deduce", 15]] as const) {
      const g = P.generatedForTrack(track, n);
      const sol = idx(g.meta.solution);
      const wrong = idx(P.floorMask(g.level)).filter((i) => !sol.includes(i));
      // Wrong lanterns spread over the board (first, middle, last), plus correct ones.
      const picked = [wrong[0]!, wrong[wrong.length >> 1]!, wrong[wrong.length - 1]!];
      const recent = [...sol.slice(0, 2), ...picked];
      let s: P.PipsState = { ...P.initialState(g.level), lanterns: bbOf(recent) };
      const taken: number[] = [];
      for (let left = 3; left >= 1; left--) {
        const h = P.hintFor(g.level, s, recent[recent.length - 1], recent);
        expect(h.kind).toBe("removeWrong");
        if (h.kind !== "removeWrong") return;
        expect(h.cells.length).toBe(1);
        expect(h.remaining).toBe(left);
        expect(picked).toContain(h.cells[0]);
        expect(taken).not.toContain(h.cells[0]);
        taken.push(h.cells[0]!);
        s = { ...s, lanterns: P.withBit(s.lanterns, h.cells[0]!, false) };
        recent.push(h.cells[0]!);
      }
      expect(P.hintFor(g.level, s, recent[recent.length - 1], recent).kind).toBe("place");
    }
  });

  it("removeWrong picks the most culpable lantern (most blocked cells freed + stones un-overfilled or un-stuck), ties → most recent", () => {
    let checked = 0;
    let decided = 0;
    for (const [track, n] of [["gentle", 12], ["gentle", 20], ["deduce", 6], ["deduce", 15], ["deduce", 23]] as const) {
      const g = P.generatedForTrack(track, n);
      const sol = idx(g.meta.solution);
      const others = idx(P.floorMask(g.level)).filter((i) => !sol.includes(i));
      for (let k = 0; k + 2 < others.length; k += 3) {
        const wrong = [others[k]!, others[k + 1]!, others[k + 2]!];
        const recent = [wrong[1]!, ...sol.filter((_, j) => j % 2 === 0), wrong[2]!, wrong[0]!];
        const st = state(g.level, recent.map(cellName));
        const before = P.analyzeBoard(g.level, st);
        const score = (w: number): number => {
          const after = P.analyzeBoard(g.level, { ...st, lanterns: P.withBit(st.lanterns, w, false) });
          const over = (a: P.BoardAnalysis): number[] => a.stones.filter((x) => x.status === "over").map((x) => x.cell);
          const stuck = (a: P.BoardAnalysis): number[] => a.stones.filter((x) => x.status === "blocked").map((x) => x.cell);
          return before.deadCells.filter((c) => !after.deadCells.includes(c)).length + over(before).filter((c) => !over(after).includes(c)).length +
            stuck(before).filter((c) => !stuck(after).includes(c)).length;
        };
        const h = P.hintFor(g.level, st, recent[recent.length - 1], recent);
        if (h.kind !== "removeWrong") throw new Error("expected removeWrong");
        expect(h.remaining).toBe(3);
        const best = Math.max(...wrong.map(score));
        expect(score(h.cells[0]!)).toBe(best);
        const tied = wrong.filter((w) => score(w) === best);
        if (tied.length < wrong.length && !tied.includes(wrong[0]!)) decided++;
        // Most recently placed among the tied: latest position in the toggle history.
        expect(h.cells[0]).toBe(tied.reduce((a, b) => (recent.lastIndexOf(a) > recent.lastIndexOf(b) ? a : b)));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(20);
    // Culpability (not recency) decided some picks: the newest wrong lantern was not among the most culpable.
    expect(decided).toBeGreaterThan(0);
  });

  it("removeWrong tie-break follows the toggle history, not cell order", () => {
    const l = P.parseLevel([
      "2....",
      ".....",
      ".....",
      ".....",
      "....2",
    ]);
    // Unique solution B1 A2 C3 E4 D5; B3 and C2 are wrong: together they make the 2 at A1 stuck (B1 and A2
    // lit), and taking either one back alone does not free it — equally culpable.
    const st = state(l, ["B3", "C2"]);
    const a = P.analyzeBoard(l, st);
    expect(a.blocked).toEqual([]);
    expect(a.stones.some((x) => x.status === "over")).toBe(false);
    expect(a.stuckStones).toEqual([{ stone: cell("A1"), reason: "cannotReach", lanterns: [cell("C2"), cell("B3")] }]);
    expect(P.hintFor(l, st, cell("C2"), [cell("B3"), cell("C2")])).toEqual({ kind: "removeWrong", cells: [cell("C2")], remaining: 2 });
    expect(P.hintFor(l, st, cell("B3"), [cell("C2"), cell("B3")])).toEqual({ kind: "removeWrong", cells: [cell("B3")], remaining: 2 });
    // The read-out's culprit follows the same history.
    expect(P.analyzeBoard(l, st, [cell("B3"), cell("C2")]).culprit).toBe(cell("C2"));
    expect(P.analyzeBoard(l, st, [cell("C2"), cell("B3")]).culprit).toBe(cell("B3"));
  });

  it("removeWrong prefers the lantern that blocks a cell over a more recent harmless one", () => {
    // B1 = 1, A1 lit only from A1. Wrong C1 fills B1 (A1 blocked); wrong E3 is harmless and newer.
    const l = P.parseLevel([
      ".1...",
      "#....",
      ".....",
      ".....",
      ".....",
    ]);
    const sol = P.solutionOf(l)!;
    expect(P.hasBit(sol, cell("A1"))).toBe(true);
    expect(P.hasBit(sol, cell("C1")) || P.hasBit(sol, cell("E3"))).toBe(false);
    const st = state(l, ["C1", "E3"]);
    expect(P.analyzeBoard(l, st).deadCells).toEqual([cell("A1")]);
    expect(P.hintFor(l, st, cell("E3"), [cell("C1"), cell("E3")])).toEqual({ kind: "removeWrong", cells: [cell("C1")], remaining: 2 });
  });

  it("T1 'stone': prefers the forced cell nearest the last move, anchored on its number", () => {
    const l = P.parseLevel([
      "2....",
      ".....",
      ".....",
      ".....",
      "....2",
    ]);
    const e = P.initialState(l);
    expect(P.hintFor(l, e)).toEqual({ kind: "place", cell: cell("B1"), reason: "stone", anchor: cell("A1") });
    expect(P.hintFor(l, e, cell("D4"))).toEqual({ kind: "place", cell: cell("E4"), reason: "stone", anchor: cell("E5") });
    expect(P.hintFor(l, e, cell("A3"))).toEqual({ kind: "place", cell: cell("A2"), reason: "stone", anchor: cell("A1") });
  });

  it("tie-break: nearest to the most recently touched numbered stone", () => {
    const l = P.parseLevel([
      "2....",
      ".....",
      ".....",
      ".....",
      "....2",
    ]);
    // C3 is equally far from B1/A2 and E4/D5; the touched-stone history decides.
    const e = P.initialState(l);
    const nearE5 = P.hintFor(l, e, cell("C3"), [cell("D5"), cell("C3")]);
    expect(nearE5.kind === "place" && nearE5.anchor).toBe(cell("E5"));
    const nearA1 = P.hintFor(l, e, cell("C3"), [cell("B1"), cell("C3")]);
    expect(nearA1.kind === "place" && nearA1.anchor).toBe(cell("A1"));
  });

  it("T2 'onlyLight': a dark cell with a single possible position anchors the hint", () => {
    const l = P.parseLevel([
      ".#...",
      "##...",
      ".....",
      ".....",
      ".....",
    ]);
    expect(P.hintFor(l, P.initialState(l))).toEqual({ kind: "place", cell: 0, reason: "onlyLight", anchor: 0 });
  });

  it("T3 'contradiction' carries the ruled-out cells; the loop still completes", () => {
    let found = false;
    for (let n = 5; n <= 40 && !found; n++) {
      const g = P.generatedForTrack("deduce", n);
      let s = P.initialState(g.level);
      for (let step = 0; step < 64 && !P.isComplete(s); step++) {
        const t = hintTrace(g.level, s);
        if (t.hint.kind !== "place") break;
        if (t.hint.reason === "contradiction") {
          expect(t.tier).toBe(3);
          expect(t.hint.ruledOut!.length).toBeGreaterThan(0);
          expect(t.hint.ruledOut).not.toContain(t.hint.cell);
          found = true;
        }
        s = { ...s, lanterns: P.withBit(s.lanterns, t.hint.cell, true) };
      }
      expect(P.isComplete(s)).toBe(true);
    }
    expect(found).toBe(true);
  });

  it("none when complete; hint loop handles a conflicting start", () => {
    const g = P.generatedForTrack("gentle", 12);
    expect(P.hintFor(g.level, { ...P.initialState(g.level), lanterns: g.meta.solution })).toEqual({ kind: "none" });
    const sol = idx(g.meta.solution);
    const floor = idx(P.floorMask(g.level));
    // Two lanterns in one row run that see each other (at least one is wrong).
    const a = floor.find((i) => floor.includes(i + 1) && ((i + 1) & 7) !== 0 && !(sol.includes(i) && sol.includes(i + 1)))!;
    const r = hintLoop(g.level, g.meta.solution, [a, a + 1]);
    expect(r.error).toBeNull();
    // One removal hint per wrong lantern (progressive).
    expect(r.removeHints).toBe([a, a + 1].filter((i) => !sol.includes(i)).length);
  });
});

describe("analyzeBoard blame (round 5: one culprit, stuck numbers)", () => {
  // Round-4 boards (gentle g4 levels 16, 12 and the old finale 20), as the testers saw them.
  const J16 = ["......0", ".......", "..0...1", ".......", "...2...", "..3#.#.", "...#1#0"];
  const J12 = ["......", "...3..", ".#....", "3..2..", "..1...", "....0#"];
  const J20_R4 = ["#.2...1", ".......", ".#.##..", ".......", "..3#.#.", ".......", "#...#.#"];

  it("round-4 J-16: the old line listed five lanterns and three rocks; the culprit is the single wrong lantern A1", () => {
    const l = P.parseLevel(J16);
    expect(P.levelRows(P.levelForTrack("gentle", 16))).toEqual(J16);
    const moves = ["E6", "C5", "C7", "B6", "D4", "F3", "A1"];
    const a = P.analyzeBoard(l, state(l, moves), moves.map(cell));
    expect(a.blocked.map((b) => cellName(b.cell))).toEqual(["C2", "G2"]);
    // The full read-out is unchanged (every cause) ...
    expect(a.blocked[0]!.lanterns.map(cellName)).toEqual(["A1", "F3", "D4", "B6", "E6"]);
    expect(a.blocked[0]!.stones.map(cellName)).toEqual(["G1", "C3", "G3"]);
    // ... but only A1 is not in the answer.
    for (const b of a.blocked) expect(b.culprits.map(cellName)).toEqual(["A1"]);
    expect(a.stuckStones).toEqual([]);
    expect(a.culprit).toBe(cell("A1"));
    // The removal hint agrees.
    expect(P.hintFor(l, state(l, moves), cell("A1"), moves.map(cell))).toEqual({ kind: "removeWrong", cells: [cell("A1")], remaining: 1 });
  });

  it("round-4 J-12: the 2 at D4 went ⊘ with no Stuck line → a stuck number with its culprit (E2)", () => {
    const l = P.parseLevel(J12);
    expect(P.levelRows(P.levelForTrack("gentle", 12))).toEqual(J12);
    // Denise / Sophie: the 3 at D2 filled with D1 C2 E2; E2's light takes E4, the full 3 takes D3.
    const moves = ["A3", "A5", "B4", "D1", "C2", "E2"];
    const a = P.analyzeBoard(l, state(l, moves), moves.map(cell));
    expect(a.blocked).toEqual([]);
    expect(a.stones.find((x) => x.cell === cell("D4"))!.status).toBe("blocked");
    expect(a.stuckStones).toEqual([{ stone: cell("D4"), reason: "cannotReach", lanterns: [cell("E2")] }]);
    expect(a.culprit).toBe(cell("E2"));
    // Overfilled: D5 next to the 1 at C5 and the 2 at D4 (Lisa / priya) → 'over' with the wrong lantern only.
    const over = ["A3", "A5", "B4", "D3", "E4", "D5"];
    const b = P.analyzeBoard(l, state(l, over), over.map(cell));
    expect(b.stuckStones.find((x) => x.stone === cell("D4"))).toEqual({ stone: cell("D4"), reason: "over", lanterns: [cell("D5")] });
    expect(b.culprit).toBe(cell("D5"));
  });

  it("generated levels: culprits are wrong lanterns, never empty for a blocked cell; culprit is one of them; null when all lanterns are right", () => {
    let blockedSeen = 0;
    let stuckSeen = 0;
    for (const [track, n] of [["gentle", 8], ["gentle", 16], ["gentle", 30], ["deduce", 9], ["deduce", 15]] as const) {
      const g = P.generatedForTrack(track, n);
      const sol = idx(g.meta.solution);
      const others = idx(P.floorMask(g.level)).filter((i) => !sol.includes(i));
      for (let k = 0; k < others.length; k++) {
        const cells = [...sol.filter((_, j) => (j + k) % 3 !== 0), others[k]!, ...(k % 2 === 0 ? [others[(k * 7) % others.length]!] : [])];
        const st = state(g.level, cells.map(cellName));
        const a = P.analyzeBoard(g.level, st, cells);
        const placed = idx(st.lanterns);
        const wrong = placed.filter((i) => !sol.includes(i));
        const pool = new Set<number>();
        for (const b of a.blocked) {
          blockedSeen++;
          expect(b.culprits.length, `${track} ${n} ${cellName(b.cell)}`).toBeGreaterThan(0);
          for (const c of b.culprits) expect(wrong).toContain(c);
          expect(b.culprits).toEqual([...b.culprits].sort((x, y) => x - y));
          for (const c of b.culprits) pool.add(c);
        }
        expect(a.stuckStones.map((x) => x.stone)).toEqual(a.stones.filter((x) => x.status === "over" || x.status === "blocked").map((x) => x.cell));
        for (const x of a.stuckStones) {
          stuckSeen++;
          expect(x.reason).toBe(a.stones.find((y) => y.cell === x.stone)!.status === "over" ? "over" : "cannotReach");
          for (const c of x.lanterns) expect(placed).toContain(c);
          // In a unique board a stuck number always involves a wrong lantern, and the list keeps only those.
          expect(x.lanterns.length).toBeGreaterThan(0);
          for (const c of x.lanterns) expect(wrong).toContain(c);
          for (const c of x.lanterns) pool.add(c);
        }
        // Round 7: with nothing stuck locally a forced dead end may still name a (wrong) culprit.
        if (pool.size === 0 && a.deadEnd === null) expect(a.culprit).toBeNull();
        else if (pool.size === 0) expect(wrong).toContain(a.culprit);
        else expect([...pool]).toContain(a.culprit);
        // All lanterns right → nothing blocked or stuck, no culprit.
        const ok = P.analyzeBoard(g.level, state(g.level, sol.filter((_, j) => (j + k) % 2 === 0).map(cellName)));
        expect(ok.blocked).toEqual([]);
        expect(ok.stuckStones).toEqual([]);
        expect(ok.culprit).toBeNull();
      }
    }
    expect(blockedSeen).toBeGreaterThan(10);
    expect(stuckSeen).toBeGreaterThan(10);
  });

  it("isolated single cells: round-4 J-20 had five (A3 F3 E5 D7 F7 — 'each one forced tap')", () => {
    const l = P.parseLevel(J20_R4);
    expect(isolatedSingles(l).map(cellName).sort()).toEqual(["A3", "D7", "E5", "F3", "F7"]);
    // Every isolated single is a self-light step of the trick signature.
    expect(trickSignature(l).kinds.filter((k) => k === "self-light").length).toBe(5);
  });
});

// ---------------------------------------------------------------- round 7 (persona round 6)

const session = (name: string): { rows: string[]; history: string[] } => {
  const s = JSON.parse(readFileSync(new URL(`../../playtest/sessions-r6/priya/${name}.json`, import.meta.url), "utf8")) as { level: { rows: string[] }; history: string[] };
  return { rows: s.level.rows, history: s.history };
};

describe("realT2 (round 7): T2 steps that lean on a 0 rock do not count", () => {
  it("r6 boards: J-40 (the finale, six 0 rocks) has the most T2 steps but the fewest real ones — testers found it easier than J-33", () => {
    const j40 = P.parseLevel(session("J-40").rows);
    const j33 = P.parseLevel(session("J-33").rows);
    const g40 = grade(j40, 2);
    const g33 = grade(j33, 2);
    expect(j40.clues.filter((c) => c === 0).length).toBe(6);
    expect([g40.t2, realT2(g40)]).toEqual([8, 1]);
    expect([g33.t2, realT2(g33)]).toEqual([6, 3]);
    expect(realT2(g40)).toBeLessThan(realT2(g33));
  });

  it("no 0 rock ⇒ every T2 step is real; with 0 rocks realT2 ≤ t2 (gentle 1–60)", () => {
    for (let n = 1; n <= 60; n++) {
      const l = P.levelForTrack("gentle", n);
      const g = grade(l, 2);
      expect(g.t2zero, `gentle ${n}`).toBeGreaterThanOrEqual(0);
      expect(realT2(g), `gentle ${n}`).toBeLessThanOrEqual(g.t2);
      if (!l.clues.includes(0)) expect(g.t2zero, `gentle ${n}`).toBe(0);
    }
  });
});

describe("countSolutions with fixed lanterns (round 7)", () => {
  it("fixed solution lanterns keep the count; a wrong or conflicting lantern makes it 0", () => {
    const l = P.parseLevel(session("J-25").rows);
    const sol = P.solutionOf(l)!;
    expect(countSolutions(l, 2, 2_000_000, undefined, sol).count).toBe(1);
    expect(countSolutions(l, 2, 2_000_000, undefined, bbOf(["E1", "D2"].map(cell))).count).toBe(1);
    expect(countSolutions(l, 2, 2_000_000, undefined, bbOf(["C7"].map(cell))).count).toBe(0);
    expect(countSolutions(l, 2, 2_000_000, undefined, bbOf(["A1", "C1"].map(cell))).count).toBe(0); // see each other
  });
});

describe("dead end + culprit ranking (round 7: r6 Priya J-25)", () => {
  const { rows, history } = session("J-25");
  const l = P.parseLevel(rows);

  it("session replay: 'take back A5', then — nothing stuck locally — the dead end names C7 (before: none)", () => {
    expect(idx(P.solutionOf(l)!).map(cellName)).toEqual(["E1", "G1", "D2", "F2", "C3", "A4", "E5", "B6", "F6", "D7"]);
    const upTo = (k: number): string[] => {
      const on = new Set<string>();
      for (const c of history.slice(0, k)) if (on.has(c)) on.delete(c); else on.add(c);
      return [...on];
    };
    // After A5 (history[10]): B4 and B6 blocked; both C7 and A5 are wrong; A5 frees both cells.
    const s1 = upTo(11);
    const a1 = P.analyzeBoard(l, state(l, s1), history.slice(0, 11).map(cell));
    expect(a1.blocked.map((b) => cellName(b.cell))).toEqual(["B4", "B6"]);
    expect(a1.culprit).toBe(cell("A5"));
    expect(a1.deadEnd).toBeNull();
    // A5 taken back: no blocked cell, no stuck number — but C7 made the board unsolvable.
    const s2 = upTo(12);
    expect(s2).toContain("C7");
    const a2 = P.analyzeBoard(l, state(l, s2), history.slice(0, 12).map(cell));
    expect(a2.blocked).toEqual([]);
    expect(a2.stuckStones).toEqual([]);
    expect(a2.deadEnd).not.toBeNull();
    expect(a2.deadEnd!.rounds).toBeLessThanOrEqual(FORCED_ROUNDS);
    expect(a2.culprit).toBe(cell("C7"));
    expect(P.hintFor(l, state(l, s2), cell("A5"), history.slice(0, 12).map(cell))).toEqual({ kind: "removeWrong", cells: [cell("C7")], remaining: 1 });
    // C7 taken back: nothing to blame; the rest of the session completes.
    const a3 = P.analyzeBoard(l, state(l, upTo(14)));
    expect([a3.deadEnd, a3.culprit]).toEqual([null, null]);
    expect(P.isComplete(state(l, upTo(history.length)))).toBe(true);
  });

  it("ranking: a wrong lantern whose removal makes the board solvable again comes first", () => {
    // One wrong lantern among correct ones: whatever is blocked, the culprit is that lantern.
    const sol = idx(P.solutionOf(l)!);
    for (const w of idx(P.floorMask(l)).filter((i) => !sol.includes(i))) {
      const cells = [...sol.filter((_, j) => j % 2 === 0), w];
      const a = P.analyzeBoard(l, { ...P.initialState(l), lanterns: bbOf(cells) }, cells);
      if (a.culprit !== null) expect(cellName(a.culprit)).toBe(cellName(w));
    }
  });
});
