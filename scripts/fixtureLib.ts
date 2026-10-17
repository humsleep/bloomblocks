// Golden fixture builders, shared by `npm run fixtures` (writes) and
// tests/fixtures.test.ts (re-derives and compares byte-for-byte).
// A C# port must reproduce every output field from the input fields.

import { fromHex, toHex, u32Hex } from "../core/bytes.ts";
import { stateHash } from "../core/game.ts";
import { Rng, deriveSeed } from "../core/rng.ts";
import { HEADER_SIZE, MODE, type Run, encodeRun, recordRun, seal } from "../core/runlog.ts";
import { FIXTURE_LEVELS, fixtureLevel, fixtureSolution } from "../games/lanterns/fixtureLevel.ts";
import * as L from "../games/lanterns/index.ts";

/** 2: per-move analysis (`perMove`), wide8, lit-conflict / over-budget cases, reject vectors. */
export const FIXTURE_VERSION = 2;

/** Inputs: everything a port needs. */
export interface LanternsFixtureInput {
  name: string;
  levelId: number;
  level: { rows: string[]; budget: number };
  mode: number;
  flags: number;
  seedKey: string;
  /** Encoded moves, 1 byte each, concatenated. */
  moves: string;
}

/** Rule outputs after one move. Bitboards are u32 hex words (cell i = y*8+x; lo = 0..31, hi = 32..63). */
export interface LanternsMoveAnalysis {
  /** Lit cells, lantern cells included. */
  lit: { lo: string; hi: string };
  /** Number of lanterns that see at least one other lantern. */
  conflicts: number;
  lanternsUsed: number;
  complete: boolean;
}

/** Inputs + expected outputs. */
export interface LanternsFixture extends LanternsFixtureInput {
  fixtureVersion: number;
  game: "lanterns";
  gameId: number;
  seed: string;
  initialStateBytes: string;
  initialStateHash: string;
  perMoveHashes: string[];
  perMoveStateBytes: string[];
  /** perMove[i] is the analysis after move i. */
  perMove: LanternsMoveAnalysis[];
  final: { stateHash: string; complete: boolean; lanternsUsed: number; conflicts: number; lit: number };
  runBin: string;
}

function analysisOf(s: L.LanternsState): LanternsMoveAnalysis {
  const a = L.analyze(s);
  return {
    lit: { lo: u32Hex(a.lit.lo), hi: u32Hex(a.lit.hi) },
    conflicts: L.popcount(a.conflicts),
    lanternsUsed: a.used,
    complete: L.isComplete(s),
  };
}

export function buildLanternsFixture(input: LanternsFixtureInput): LanternsFixture {
  const g = L.lanterns;
  const level = L.parseLevel(input.level.rows, input.level.budget);
  const moveBytes = fromHex(input.moves);
  const moves = [...moveBytes].map((b) => {
    const m = g.decodeMove(Uint8Array.of(b));
    if (!m) throw new Error(`${input.name}: malformed move ${b}`);
    return m;
  });
  const init = g.init(input.seedKey, level);
  const rec = recordRun(g, {
    seed: input.seedKey, params: level, moves, mode: input.mode, levelId: input.levelId, flags: input.flags,
  });
  const states: string[] = [];
  const perMove: LanternsMoveAnalysis[] = [];
  let s = init;
  for (const m of moves) {
    s = g.apply(s, m)!;
    states.push(toHex(g.stateBytes(s)));
    perMove.push(analysisOf(s));
  }
  const a = L.analyze(rec.state);
  return {
    fixtureVersion: FIXTURE_VERSION,
    game: "lanterns",
    gameId: g.id,
    name: input.name,
    levelId: input.levelId,
    level: input.level,
    mode: input.mode,
    flags: input.flags,
    seedKey: input.seedKey,
    moves: input.moves,
    seed: toHex(deriveSeed(input.seedKey)),
    initialStateBytes: toHex(g.stateBytes(init)),
    initialStateHash: u32Hex(stateHash(g, init)),
    perMoveHashes: rec.perMoveHashes.map(u32Hex),
    perMoveStateBytes: states,
    perMove,
    final: {
      stateHash: u32Hex(rec.run.header.stateHash),
      complete: g.isComplete(rec.state),
      lanternsUsed: a.used,
      conflicts: L.popcount(a.conflicts),
      lit: L.popcount(a.lit),
    },
    runBin: toHex(encodeRun(rec.run, g.moveWidth)),
  };
}

const hexMoves = (ms: readonly L.LanternsMove[]): string => toHex(Uint8Array.from(ms.map((m) => L.index(m.x, m.y))));

const byName = (name: string) => {
  const f = FIXTURE_LEVELS.find((l) => l.name === name);
  if (!f) throw new Error(`no fixture level ${name}`);
  return f;
};

/** The canonical set of fixture inputs. Uses Rng, so it also pins nextInt. */
export function lanternsFixtureInputs(): LanternsFixtureInput[] {
  const out: LanternsFixtureInput[] = [];
  for (const f of FIXTURE_LEVELS) {
    const level = fixtureLevel(f);
    const floor = L.cellsOf(L.floorMask(level));
    const base = { levelId: f.levelId, level: { rows: [...f.rows], budget: f.budget }, flags: 0 };
    const solution = fixtureSolution(f);

    out.push({ ...base, name: `${f.name}-solution`, mode: MODE.free, seedKey: `lanterns:free:${f.name}`, moves: hexMoves(solution) });

    const rng = Rng.from(`lanterns:fixture-moves:${f.name}`);
    const wander = Array.from({ length: 12 }, () => floor[rng.nextInt(floor.length)]!);
    let s = L.initialState(level);
    for (const m of wander) s = L.toggle(s, m)!;
    const clear = L.cellsOf(s.lanterns);
    out.push({
      ...base, name: `${f.name}-wander-then-solve`, mode: MODE.daily, seedKey: "lanterns:daily:2026-10-12",
      moves: hexMoves([...wander, ...clear, ...rng.shuffle([...solution])]),
    });

    out.push({ ...base, name: `${f.name}-abandoned`, mode: MODE.bud, seedKey: `lanterns:bud:${f.name}`, moves: hexMoves(wander.slice(0, 5)) });
  }

  // Every floor cell lit and within budget, but (4,2) sees the solution's (1,2)
  // across row 2: must NOT be complete. The conflicting lantern goes first so no
  // prefix completes (moves after completion are illegal).
  const pocket = byName("pocket5");
  out.push({
    levelId: pocket.levelId, level: { rows: [...pocket.rows], budget: 5 }, flags: 0,
    name: "pocket5-lit-conflict", mode: MODE.free, seedKey: "lanterns:free:pocket5-lit-conflict",
    moves: hexMoves([{ x: 4, y: 2 }, ...fixtureSolution(pocket)]),
  });
  // Every floor cell lit, no conflicts, but 5 lanterns on budget 4: must NOT be complete.
  const cross = byName("cross5");
  out.push({
    levelId: cross.levelId, level: { rows: [...cross.rows], budget: 4 }, flags: 0,
    name: "cross5-lit-over-budget", mode: MODE.free, seedKey: "lanterns:free:cross5-lit-over-budget",
    moves: hexMoves(fixtureSolution(cross)),
  });
  return out;
}

/** A run.bin that every port must reject with `expectedCode` (verifyRun against `level`). */
export interface LanternsRejectFixture {
  fixtureVersion: number;
  game: "lanterns";
  gameId: number;
  name: string;
  description: string;
  level: { rows: string[]; budget: number };
  runBin: string;
  expectedCode: string;
}

/** Recompute the CRC after patching header/body bytes so only the intended defect remains. */
const reseal = (bin: Uint8Array): Uint8Array => seal(bin.subarray(0, bin.length - 4));
const patched = (bin: Uint8Array, at: number, value: number): Uint8Array => {
  const c = bin.slice();
  c[at] = value;
  return reseal(c);
};

export function lanternsRejectFixtures(): LanternsRejectFixture[] {
  const g = L.lanterns;
  const f = byName("pocket5");
  const level = fixtureLevel(f);
  const solution = fixtureSolution(f); // (4,0) (1,2) (2,3) (0,4)
  const rec = recordRun(g, { seed: "lanterns:free:pocket5", params: level, moves: solution, mode: MODE.free, levelId: f.levelId });
  const good = encodeRun(rec.run, g.moveWidth);
  // Hand-built runs bypass apply() so that the header hash is exactly what a
  // rule-breaking implementation would compute: such a port would accept them.
  const forged = (moves: Uint8Array, lanterns: L.BB): Uint8Array => {
    const state = { ...L.initialState(level), lanterns };
    const run: Run = {
      header: { ...rec.run.header, moveCount: moves.length, stateHash: stateHash(g, state) },
      moves: [...moves].map((b) => Uint8Array.of(b)),
    };
    return encodeRun(run, g.moveWidth);
  };
  const bits = (cells: readonly number[]): L.BB => cells.reduce((b, i) => L.withBit(b, i, true), L.EMPTY);
  const sol = solution.map((m) => L.index(m.x, m.y));

  const spare = good.slice();
  spare[HEADER_SIZE] = spare[HEADER_SIZE]! | 0x80; // (4,0) with bit 7 set
  const badCrc = good.slice();
  badCrc[good.length - 1] = badCrc[good.length - 1]! ^ 0xff;
  const vectors: [string, string, Uint8Array, string][] = [
    ["bad-crc", "valid run with the last CRC byte flipped", badCrc, "crc"],
    ["bad-magic", "magic 'QL' instead of 'PL' (CRC recomputed)", patched(good, 0, 0x51), "magic"],
    ["unknown-version", "formatVersion 2 (CRC recomputed)", patched(good, 2, 2), "version"],
    ["mode-3", "mode 3 (> bud) (CRC recomputed)", patched(good, 4, 3), "mode"],
    ["flags-nonzero", "flags = 1 in formatVersion 1 (CRC recomputed)", patched(good, 5, 1), "flags"],
    ["wrong-game", "gameId 2 replayed as lanterns (CRC recomputed)", patched(good, 3, 2), "game"],
    ["hash-mismatch", "stateHash low byte flipped (CRC recomputed)", patched(good, 28, good[28]! ^ 1), "hash"],
    ["count-mismatch", "moveCount 5 but 4 move bytes (CRC recomputed)", patched(good, 26, 5), "length"],
    ["truncated", "valid run with the last 2 bytes cut off", good.slice(0, -2), "length"],
    ["truncated-header", "only the first 20 bytes", good.slice(0, 20), "length"],
    ["trailing-bytes", "valid run followed by one 0x00 byte", Uint8Array.of(...good, 0), "length"],
    ["spare-bits", "first move byte 0x84 = (4,0) with spare bit 7 set; hash matches (4,0)", reseal(spare), "move"],
    ["move-on-stone", "3 solution moves then (1,0), a stone; hash as if a lantern were placed there",
      forged(Uint8Array.of(sol[0]!, sol[1]!, sol[2]!, 1), bits([sol[0]!, sol[1]!, sol[2]!, 1])), "illegal"],
    ["move-after-complete", "the 4-move solution, then (4,0) again; hash as if the toggle were allowed",
      forged(Uint8Array.of(...sol, sol[0]!), bits(sol.slice(1))), "illegal"],
  ];
  return vectors.map(([name, description, bin, expectedCode]) => ({
    fixtureVersion: FIXTURE_VERSION, game: "lanterns", gameId: g.id, name, description,
    level: { rows: [...f.rows], budget: f.budget }, runBin: toHex(bin), expectedCode,
  }));
}

/** RNG golden values (fixtures/core/rng.json) so ports can check seeding, nextInt and shuffle in isolation. */
export function rngFixture(): object {
  const keys = ["", "lanterns:daily:2026-10-12", "lanterns:free:1", "등불:정원"];
  return {
    fixtureVersion: FIXTURE_VERSION,
    algorithm: "xoshiro128** 1.1; seed = sha256(utf8(key))[0..16), state words little-endian",
    cases: keys.map((key) => {
      const r = Rng.from(key);
      return {
        key,
        seed: toHex(deriveSeed(key)),
        state: r.state().map(u32Hex),
        nextU32: Array.from({ length: 8 }, () => r.nextU32()),
        nextInt: [1, 2, 3, 7, 36, 64, 1000, 3000000000].map((n) => ({ n, values: Array.from({ length: 6 }, () => r.nextInt(n)) })),
        shuffle10: r.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
      };
    }),
  };
}
