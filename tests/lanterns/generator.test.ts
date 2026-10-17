import { describe, expect, it } from "vitest";
import { Rng } from "../../core/rng.ts";
import { FIXTURE_LEVELS, fixtureLevel } from "../../games/lanterns/fixtureLevel.ts";
import {
  type GeneratedLevel, generate, largestOpenRect, levelForDaily, levelForIndex, minLanternsFloor, openRoomLimit,
  paramsForDaily, paramsForIndex, parseDate, sizeForIndex, udiv, weekday,
} from "../../games/lanterns/generator.ts";
import { humanSolve } from "../../games/lanterns/human.ts";
import * as L from "../../games/lanterns/index.ts";
import { buildRays, solve } from "../../games/lanterns/solver.ts";

/** Brute force over all floor subsets: minimum lantern count and number of minimum solutions. */
function bruteForce(level: Pick<L.LanternsLevel, "w" | "h" | "stones">): { min: number; count: number } {
  const floor = L.cellsOf(L.floorMask(level));
  let min = Infinity;
  let count = 0;
  const base: L.LanternsState = { ...level, budget: 255, lanterns: L.EMPTY };
  const rec = (k: number, s: L.LanternsState, n: number): void => {
    if (n > min || L.popcount(L.conflictingLanterns(s)) > 0) return;
    if (k === floor.length) {
      if (!L.isComplete(s)) return;
      if (n < min) [min, count] = [n, 0];
      if (n === min) count++;
      return;
    }
    rec(k + 1, s, n);
    rec(k + 1, { ...s, lanterns: L.withBit(s.lanterns, L.index(floor[k]!.x, floor[k]!.y), true) }, n + 1);
  };
  rec(0, base, 0);
  return { min, count };
}

function randomBoard(rng: Rng, w: number, h: number, stones: number): L.LanternsLevel {
  let b = L.EMPTY;
  for (let k = 0; k < stones; k++) b = L.withBit(b, L.index(rng.nextInt(w), rng.nextInt(h)), true);
  return { w, h, budget: 0, stones: b };
}

function play(level: L.LanternsLevel, moves: readonly L.LanternsMove[]): L.LanternsState {
  let s = L.initialState(level);
  for (const m of moves) {
    const n = L.toggle(s, m);
    if (!n) throw new Error(`illegal ${m.x},${m.y}`);
    s = n;
  }
  return s;
}

function floorConnected(level: L.LanternsLevel): boolean {
  const floor = L.cellsOf(L.floorMask(level));
  const key = (x: number, y: number): number => L.index(x, y);
  const isFloor = new Set(floor.map((c) => key(c.x, c.y)));
  const seen = new Set<number>([key(floor[0]!.x, floor[0]!.y)]);
  const stack = [floor[0]!];
  while (stack.length) {
    const { x, y } = stack.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const k = key(x + dx, y + dy);
      if (x + dx < 0 || y + dy < 0 || x + dx >= level.w || y + dy >= level.h || !isFloor.has(k) || seen.has(k)) continue;
      seen.add(k);
      stack.push({ x: x + dx, y: y + dy });
    }
  }
  return seen.size === floor.length;
}

/** Every invariant a shipped level must satisfy (docs/lanterns-generator.md). */
function checkLevel(g: GeneratedLevel, slack: number): void {
  const { level, meta } = g;
  expect(level.budget).toBe(meta.minLanterns + slack);
  // The stored solution completes with exactly minLanterns lanterns.
  const sol = L.cellsOf(meta.solution);
  expect(sol.length).toBe(meta.minLanterns);
  const done = play({ ...level, budget: meta.minLanterns }, sol);
  expect(L.isComplete(done)).toBe(true);
  // ...and nothing smaller exists.
  expect(solve(level, { maxTotal: meta.minLanterns - 1 }).min).toBe(-1);
  // Filters.
  expect(floorConnected(level)).toBe(true);
  const r = buildRays(level);
  for (const c of L.cellsOf(L.floorMask(level))) expect(L.popcount({ lo: r.lo[L.index(c.x, c.y)]!, hi: r.hi[L.index(c.x, c.y)]! })).toBeGreaterThan(1);
  expect(largestOpenRect(level)).toBeLessThanOrEqual(openRoomLimit(level.w, level.h));
  expect(meta.minLanterns).toBeGreaterThanOrEqual(minLanternsFloor(level.w, level.h));
  expect(meta.forcedPermille).toBeLessThan(1000);
  expect(meta.solutions).toBeGreaterThanOrEqual(1);
}

describe("lanterns solver", () => {
  it("matches brute force (minimum and number of minimum solutions) on fixtures and 60 random boards", () => {
    const boards: L.LanternsLevel[] = FIXTURE_LEVELS.filter((f) => f.rows.length <= 6).map(fixtureLevel);
    const rng = Rng.from("test:solver:random");
    for (let k = 0; k < 60; k++) boards.push(randomBoard(rng, 5 + rng.nextInt(2), 5, 3 + rng.nextInt(6)));
    for (const b of boards) {
      const bf = bruteForce(b);
      const s = solve(b, { countCap: 1000 });
      expect(s.min).toBe(bf.min);
      expect(s.count).toBe(bf.count);
      expect(L.isComplete(play({ ...b, budget: s.min }, L.cellsOf(s.solution)))).toBe(true);
    }
  });

  it("extends fixed lanterns and respects maxTotal", () => {
    const f = FIXTURE_LEVELS[0]!; // pocket5, min 4
    const level = fixtureLevel(f);
    expect(solve(level).min).toBe(4);
    expect(solve(level, { maxTotal: 3 }).min).toBe(-1);
    // (0,0) is in some optimal solution? Either way the extension is legal and complete.
    const fixed = L.withBit(L.EMPTY, L.index(0, 0), true);
    const ext = solve(level, { fixed, firstOnly: true });
    expect(L.hasBit(ext.solution, L.index(0, 0))).toBe(true);
    expect(L.isComplete(play({ ...level, budget: ext.min }, L.cellsOf(ext.solution)))).toBe(true);
  });
});

describe("lanterns generator", () => {
  it("is deterministic: same seed → same level and metadata; different seeds differ", () => {
    for (const n of [1, 6, 15]) expect(levelForIndex(n)).toEqual(levelForIndex(n));
    expect(levelForDaily("2026-10-17")).toEqual(levelForDaily("2026-10-17"));
    const a = levelForIndex(20).level.stones;
    const b = levelForIndex(21).level.stones;
    expect(L.bbEqual(a, b)).toBe(false);
  });

  it("pins the generated level for a few seeds (cross-port canary)", () => {
    // If this changes, the generator output changed: bump GENERATOR_VERSION
    // (seed keys carry it) so saved runs/dailies keep replaying.
    const pin = (n: number): string => {
      const g = levelForIndex(n);
      return `${L.levelRows(g.level).join("/")} b${g.level.budget}`;
    };
    expect([pin(1), pin(6), pin(15)]).toMatchSnapshot();
  });

  it("every curve level 1..40 and 14 dailies satisfy the filters and are solvable with exactly minLanterns", () => {
    for (let n = 1; n <= 40; n++) {
      const g = levelForIndex(n);
      expect(g.level.w).toBe(sizeForIndex(n));
      expect(g.levelId).toBe(n);
      checkLevel(g, paramsForIndex(n).slack);
    }
    for (let d = 10; d < 24; d++) {
      const date = `2026-10-${d}`;
      const g = levelForDaily(date);
      expect(g.levelId).toBe(20261000 + d);
      checkLevel(g, 0);
    }
  });

  it("curve shape: 5×5 → 6×6 → 7×7, breathers after hard levels, 8×8 only on weekend dailies", () => {
    expect([1, 5, 6, 14, 15, 30].map(sizeForIndex)).toEqual([5, 5, 6, 6, 7, 7]);
    const tags = Array.from({ length: 15 }, (_, k) => paramsForIndex(k + 1).tag);
    tags.forEach((t, k) => {
      if (t === "hard") expect(tags[k + 1]).toBe("easy");
    });
    expect(paramsForIndex(1).slack).toBe(1);
    expect(paramsForDaily("2026-10-13").w).toBe(7); // Tuesday
    expect(paramsForDaily("2026-10-17").w).toBe(8); // Saturday
    expect(paramsForDaily("2026-10-18").w).toBe(8); // Sunday
    for (let n = 1; n <= 200; n++) expect(paramsForIndex(n).w).toBeLessThanOrEqual(7);
  });

  it("the human-like bot only plays legal toggles and its trace replays to a complete board", () => {
    for (const n of [3, 8, 17]) {
      const g = levelForIndex(n);
      const t = humanSolve(g.level, { rng: Rng.from(`test:bot:${n}`) });
      expect(t.completed).toBe(true);
      const s = play(g.level, t.moves);
      expect(L.isComplete(s)).toBe(true);
      expect(t.placements - t.removals).toBe(L.lanternsUsed(s));
    }
  });

  it("generate() honours explicit parameters (8×8, mirror symmetry)", () => {
    const g = generate({
      seedKey: "test:gen:8x8", levelId: 7, w: 8, h: 8, densityMin: 20, densityMax: 24, symmetry: "mirror",
      slack: 1, target: { lo: 0, hi: 1000 }, maxAttempts: 4, tag: "t",
    });
    checkLevel(g, 1);
    const rows = L.levelRows(g.level);
    for (const row of rows) expect(row.replace(/\./g, " ")).toBe([...row.replace(/\./g, " ")].reverse().join(""));
  });

  it("integer helpers", () => {
    expect([udiv(0, 7), udiv(99, 100), udiv(150, 100), udiv(2025, 4), udiv(0x7fffffff, 3)]).toEqual([0, 0, 1, 506, 715827882]);
    expect(weekday(2026, 10, 13)).toBe(2); // Tuesday
    expect(weekday(2000, 1, 1)).toBe(6); // Saturday
    expect(weekday(2024, 2, 29)).toBe(4); // Thursday
    expect(() => parseDate("2026-02-29")).toThrow();
    expect(() => parseDate("2026-10-1")).toThrow();
    expect(parseDate("2028-02-29")).toEqual({ y: 2028, m: 2, d: 29 });
  });
});
