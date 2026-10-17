// TEST ONLY. Hand-made levels for unit tests, golden fixtures and the sim
// smoke test. The real seeded generator is a later task.
// levelId >= 0xF0000000 is reserved for test fixtures.

import { parseLanterns, parseLevel } from "./level.ts";
import type { LanternsLevel, LanternsMove } from "./rules.ts";

export interface FixtureLevel {
  readonly levelId: number;
  readonly name: string;
  /** '#' stone, '.' floor. */
  readonly rows: readonly string[];
  readonly budget: number;
  /** One known solution ('L' = lantern), verified by brute force in tests. */
  readonly solution: readonly string[];
}

export const FIXTURE_LEVELS: readonly FixtureLevel[] = [
  {
    levelId: 0xf0000001,
    name: "pocket5",
    rows: [".#...", "...#.", ".....", ".#...", "...#."],
    budget: 4,
    solution: [".#..L", "...#.", ".L...", ".#L..", "L..#."],
  },
  {
    levelId: 0xf0000002,
    name: "cross5",
    rows: ["..#..", ".....", "#...#", ".....", "..#.."],
    budget: 5,
    solution: ["..#.L", "L....", "#...#", "..L..", ".L#L."],
  },
  {
    levelId: 0xf0000003,
    name: "garden6",
    rows: ["..#...", "......", ".#..#.", "......", "...#..", "#....."],
    budget: 6,
    solution: ["..#..L", ".L....", ".#..#.", "...L..", "L..#L.", "#.L..."],
  },
  {
    levelId: 0xf0000004,
    name: "garden7",
    rows: ["...#...", ".......", ".#...#.", "...#...", ".#...#.", ".......", "...#..."],
    budget: 8,
    solution: ["...#..L", ".L.....", ".#..L#.", "..L#.L.", ".#...#.", "...L...", "L..#.L."],
  },
  {
    // 8 wide: the solution uses (7,3) = cell 31 and (7,7) = cell 63, the sign
    // bits of the lo/hi words (catches signed-int ports, e.g. C# `int`).
    levelId: 0xf0000005,
    name: "wide8",
    rows: ["..#.....", "......#.", ".#......", "........", "...#..#.", "........", ".#...#.#", "........"],
    budget: 8,
    solution: ["..#L....", ".L....#.", ".#...L..", ".......L", "L..#..#.", "......L.", ".#..L#.#", ".......L"],
  },
];

export function fixtureLevel(f: FixtureLevel): LanternsLevel {
  return parseLevel(f.rows, f.budget);
}

export function fixtureSolution(f: FixtureLevel): LanternsMove[] {
  return parseLanterns(f.solution);
}

export function fixtureById(levelId: number): FixtureLevel | undefined {
  return FIXTURE_LEVELS.find((f) => f.levelId === levelId);
}
