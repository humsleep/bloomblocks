// Golden fixtures: the current code must reproduce every byte. If this fails
// after a rules/format change, read CLAUDE.md before running `npm run fixtures`.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { fromHex } from "../core/bytes.ts";
import { verifyRun } from "../core/runlog.ts";
import { lanterns, parseLevel } from "../games/lanterns/index.ts";
import {
  type LanternsFixture, type LanternsRejectFixture, buildLanternsFixture, lanternsFixtureInputs,
  lanternsRejectFixtures, rngFixture,
} from "../scripts/fixtureLib.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "fixtures", "lanterns");
const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
const load = (f: string): LanternsFixture => JSON.parse(readFileSync(join(dir, f), "utf8")) as LanternsFixture;

describe("golden fixtures: lanterns", () => {
  it("fixture set matches the canonical input list", () => {
    expect(files).toEqual(lanternsFixtureInputs().map((i) => `${i.name}.json`).sort());
  });

  it.each(files)("%s reproduces byte-for-byte", (file) => {
    const fx = load(file);
    const rebuilt = buildLanternsFixture({
      name: fx.name, levelId: fx.levelId, level: fx.level, mode: fx.mode, flags: fx.flags, seedKey: fx.seedKey, moves: fx.moves,
    });
    expect(rebuilt).toEqual(fx);
  });

  it.each(files)("%s run.bin verifies from bytes alone", (file) => {
    const fx = load(file);
    const v = verifyRun(lanterns, fromHex(fx.runBin), parseLevel(fx.level.rows, fx.level.budget));
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.complete).toBe(fx.final.complete);
  });

  it("inputs are deterministic (generated input list matches files)", () => {
    for (const input of lanternsFixtureInputs()) {
      const fx = load(`${input.name}.json`);
      expect({ ...input }).toEqual({
        name: fx.name, levelId: fx.levelId, level: fx.level, mode: fx.mode, flags: fx.flags, seedKey: fx.seedKey, moves: fx.moves,
      });
    }
  });
});

const rejectDir = join(dir, "reject");
const rejectFiles = readdirSync(rejectDir).filter((f) => f.endsWith(".json")).sort();
const loadReject = (f: string): LanternsRejectFixture => JSON.parse(readFileSync(join(rejectDir, f), "utf8")) as LanternsRejectFixture;

describe("golden fixtures: lanterns reject vectors", () => {
  it("reject set matches the generator byte-for-byte", () => {
    const built = lanternsRejectFixtures();
    expect(rejectFiles).toEqual(built.map((r) => `${r.name}.json`).sort());
    for (const r of built) expect(loadReject(`${r.name}.json`)).toEqual(r);
  });

  it.each(rejectFiles)("%s is rejected with the expected code", (file) => {
    const r = loadReject(file);
    const v = verifyRun(lanterns, fromHex(r.runBin), parseLevel(r.level.rows, r.level.budget));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe(r.expectedCode);
  });
});

describe("golden fixtures: rule cases", () => {
  it("lit-conflict and lit-over-budget light every floor cell but are never complete", () => {
    for (const name of ["pocket5-lit-conflict", "cross5-lit-over-budget"]) {
      const fx = load(`${name}.json`);
      expect(fx.final.lit).toBe(21); // 25 cells - 4 stones, all lit
      expect(fx.final.complete).toBe(false);
      expect(fx.perMove.every((p) => !p.complete)).toBe(true);
    }
    expect(load("pocket5-lit-conflict.json").final).toMatchObject({ lanternsUsed: 5, conflicts: 3 });
    expect(load("cross5-lit-over-budget.json").final).toMatchObject({ lanternsUsed: 5, conflicts: 0 });
  });

  it("wide8-solution exercises cells 31 and 63 (sign bits of lo/hi)", () => {
    const fx = load("wide8-solution.json");
    expect(fx.moves).toContain("1f");
    expect(fx.moves.endsWith("3f")).toBe(true);
    const last = fx.perMoveStateBytes.at(-1)!;
    expect(last.slice(30, 32)).toBe("80"); // lanterns.lo byte 3, bit 7 = cell 31
    expect(last.slice(38, 40)).toBe("80"); // lanterns.hi byte 3, bit 7 = cell 63
    expect(fx.final.complete).toBe(true);
  });
});

describe("golden fixtures: core rng", () => {
  it("fixtures/core/rng.json reproduces", () => {
    const fx: unknown = JSON.parse(readFileSync(join(root, "fixtures", "core", "rng.json"), "utf8"));
    expect(rngFixture()).toEqual(fx);
  });
});
