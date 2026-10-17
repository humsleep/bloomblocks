// v11 first-yard tutorial: the yards are judged by the rules' own toggle / isComplete only
// (src/game/tutorialYards.ts) — every yard can be finished, and the "wrong" moves the script
// refuses are really dead ends.
import { describe, expect, it } from "vitest";
import { analyzeBoard, index, lanternsPips } from "../src/game/pipsApi.ts";
import { solvable, yard, YARDS } from "../src/game/tutorialYards.ts";

const put = (s: ReturnType<typeof yard>["state"], c: number) => lanternsPips.apply(s, { x: c & 7, y: c >> 3 })!;

describe("tutorial yards", () => {
  it("are smaller than the generator's boards and all finishable from the start", () => {
    for (const [k, rows] of Object.entries(YARDS)) {
      const y = yard(rows);
      expect(y.level.w * y.level.h, k).toBeLessThanOrEqual(9);
      expect(solvable(y.level, y.state), k).toBe(true);
    }
  });

  it("T1: one lantern anywhere lights the whole row", () => {
    const y = yard(YARDS.t1);
    expect(lanternsPips.isComplete(put(y.state, index(2, 0)))).toBe(true);
  });

  it("T2: the stone stops L's light (1,2 stays dark); (2,2) then (0,1) finishes it", () => {
    const y = yard(YARDS.t2);
    expect(analyzeBoard(y.level, y.state).lit[index(2, 1)]).toBe(0);
    const s = put(put(y.state, index(2, 2)), index(1, 0));
    expect(lanternsPips.isComplete(s)).toBe(true);
  });

  it("T3: a lantern at (3,0) sees L; the two dark tiles with the stone between are fine", () => {
    const y = yard(YARDS.t3);
    const extra = put(y.state, index(3, 0));
    expect(analyzeBoard(y.level, extra).conflicts.length).toBe(1);
    const back = put(extra, index(3, 0));
    const done = put(put(back, index(1, 1)), index(3, 1));
    expect(analyzeBoard(y.level, done).conflicts).toEqual([]);
    expect(lanternsPips.isComplete(done)).toBe(true);
  });

  it("T4: the 2's left side (or right side) keeps it finishable, its bottom side does not; then (2,2) or (0,2)", () => {
    const y = yard(YARDS.t4);
    expect(solvable(y.level, put(y.state, index(0, 1)))).toBe(true);
    expect(solvable(y.level, put(y.state, index(2, 1)))).toBe(true);
    expect(solvable(y.level, put(y.state, index(1, 2)))).toBe(false);
    expect(lanternsPips.isComplete(put(put(y.state, index(0, 1)), index(2, 2)))).toBe(true);
  });

  it("T5: next to the 0 breaks it; the far tile finishes it", () => {
    const y = yard(YARDS.t5);
    const near = put(y.state, index(1, 0));
    expect(analyzeBoard(y.level, near).stones[0]!.status).toBe("over");
    expect(lanternsPips.isComplete(put(y.state, index(2, 0)))).toBe(true);
  });
});
