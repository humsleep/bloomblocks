import { describe, expect, it } from "vitest";
import { toHex } from "../../core/bytes.ts";
import { stateHash } from "../../core/game.ts";
import { crc32 } from "../../core/hash.ts";
import { deriveSeed } from "../../core/rng.ts";
import {
  HEADER_SIZE, MAX_MOVES, MODE, type Run, RunError, TEST_LEVEL_MIN, appendMove, decodeHeader, decodeRun, encodeRun,
  recordRun, replay, seal, verifyRun, verifySubmission,
} from "../../core/runlog.ts";
import { FIXTURE_LEVELS, fixtureLevel, fixtureSolution } from "../../games/lanterns/fixtureLevel.ts";
import { lanterns } from "../../games/lanterns/index.ts";

const f = FIXTURE_LEVELS[0]!;
const level = fixtureLevel(f);
const key = "lanterns:free:1";

function record(moves = fixtureSolution(f)) {
  return recordRun(lanterns, { seed: key, params: level, moves, mode: MODE.free, levelId: f.levelId });
}

describe("run.bin", () => {
  it("has the documented layout", () => {
    const { run } = record();
    const bin = encodeRun(run);
    expect(bin.length).toBe(HEADER_SIZE + 4 + 4);
    expect([...bin.slice(0, 6)]).toEqual([0x50, 0x4c, 1, 1, 0, 0]);
    expect(toHex(bin.slice(6, 22))).toBe(toHex(deriveSeed(key)));
    expect(toHex(bin.slice(22, 26))).toBe("010000f0"); // levelId 0xF0000001 LE
    expect([...bin.slice(26, 28)]).toEqual([4, 0]);
    const crc = crc32(bin.subarray(0, bin.length - 4));
    expect(bin[bin.length - 4]).toBe(crc & 0xff);
  });

  it("round-trips and verifies", () => {
    const { run, state } = record();
    const bin = encodeRun(run);
    const back = decodeRun(bin, 1);
    expect(back).toEqual(run);
    expect(encodeRun(back)).toEqual(bin);
    const v = verifyRun(lanterns, bin, level);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.complete).toBe(true);
      expect(v.perMoveHashes.length).toBe(4);
      expect(stateHash(lanterns, v.state)).toBe(stateHash(lanterns, state));
    }
  });

  it("replay works from the stored 16-byte seed without the key", () => {
    const { run, perMoveHashes } = record();
    expect(replay(lanterns, decodeRun(encodeRun(run), 1), level).perMoveHashes).toEqual(perMoveHashes);
  });

  it("empty run hashes the initial state", () => {
    const { run } = record([]);
    expect(run.header.stateHash).toBe(stateHash(lanterns, lanterns.init(key, level)));
    expect(verifyRun(lanterns, encodeRun(run), level).ok).toBe(true);
  });

  it("rejects corruption: CRC, magic, version, length, mode", () => {
    const bin = encodeRun(record().run);
    const flip = (i: number): Uint8Array => { const c = bin.slice(); c[i]! ^= 1; return c; };
    expect(verifyRun(lanterns, flip(HEADER_SIZE), level)).toMatchObject({ ok: false, code: "crc" });
    expect(verifyRun(lanterns, flip(0), level)).toMatchObject({ ok: false, code: "magic" });
    expect(verifyRun(lanterns, flip(2), level)).toMatchObject({ ok: false, code: "version" });
    expect(verifyRun(lanterns, bin.slice(0, -1), level)).toMatchObject({ ok: false, code: "length" });
    const badMode = bin.slice(); badMode[4] = 9;
    expect(() => decodeHeader(badMode)).toThrow(RunError);
  });

  it("rejects nonzero flags in formatVersion 1 (CRC recomputed)", () => {
    const bin = encodeRun(record().run);
    const c = bin.slice(); c[5] = 1;
    expect(verifyRun(lanterns, seal(c.subarray(0, c.length - 4)), level)).toMatchObject({ ok: false, code: "flags" });
  });

  it("rejects a header stateHash that does not match the replay, even with a recomputed CRC (integrity, not anti-forgery)", () => {
    const { run } = record();
    const forged = encodeRun({ ...run, header: { ...run.header, stateHash: run.header.stateHash ^ 1 } });
    expect(verifyRun(lanterns, forged, level)).toMatchObject({ ok: false, code: "hash" });
  });

  it("rejects illegal and malformed moves with a valid CRC", () => {
    const { run } = record();
    const stone = encodeRun({ ...run, moves: [...run.moves.slice(0, 3), Uint8Array.of(1)] }); // (1,0) is stone
    expect(verifyRun(lanterns, stone, level)).toMatchObject({ ok: false, code: "illegal" });
    const spare = encodeRun({ ...run, moves: [...run.moves.slice(0, 3), Uint8Array.of(0x80)] });
    expect(verifyRun(lanterns, spare, level)).toMatchObject({ ok: false, code: "move" });
  });

  it("rejects a run for another game", () => {
    const { run } = record();
    const other = encodeRun({ ...run, header: { ...run.header, gameId: 2 } });
    expect(verifyRun(lanterns, other, level)).toMatchObject({ ok: false, code: "game" });
  });

  it("encodeRun validates its input", () => {
    const { run } = record();
    const code = (r: Run, w?: number): string | undefined => {
      try { encodeRun(r, w); return undefined; } catch (e) { return (e as RunError).code; }
    };
    const hdr = (h: Partial<Run["header"]>): Run => ({ ...run, header: { ...run.header, ...h } });
    expect(code({ ...run, moves: run.moves.slice(1) })).toBe("count");
    expect(code(hdr({ seed: new Uint8Array(8) }))).toBe("seed");
    expect(code(hdr({ mode: 3 }))).toBe("mode");
    expect(code(hdr({ mode: -1 }))).toBe("mode");
    expect(code(hdr({ formatVersion: 2 }))).toBe("version");
    expect(code(hdr({ flags: 1 }))).toBe("flags");
    expect(code(hdr({ levelId: 0x100000000 }))).toBe("field"); // used to wrap to 0
    expect(code(hdr({ levelId: -1 }))).toBe("field"); // used to wrap to 0xFFFFFFFF
    expect(code(hdr({ levelId: 1.5 }))).toBe("field");
    expect(code(hdr({ gameId: 256 }))).toBe("field");
    expect(code({ ...run, moves: [...run.moves.slice(0, 3), Uint8Array.of(1, 2)] })).toBe("move");
    expect(code(run, 2)).toBe("move");
    expect(code(hdr({ levelId: 0xffffffff }), 1)).toBeUndefined();
  });

  it("recordRun and appendMove refuse more than MAX_MOVES moves", () => {
    const toggles = Array.from({ length: MAX_MOVES + 1 }, () => ({ x: 0, y: 0 }));
    expect(() => record(toggles)).toThrow(/count/);
    // appendMove at the cap: build a MAX_MOVES run cheaply (header/moves only).
    const { run } = record([]);
    const full: Run = { header: { ...run.header, moveCount: MAX_MOVES }, moves: Array.from({ length: MAX_MOVES }, () => Uint8Array.of(0)) };
    expect(() => appendMove(lanterns, full, lanterns.init(key, level), { x: 0, y: 0 })).toThrow(/count/);
  });

  it("appendMove builds the same run.bin as recordRun, one move at a time", () => {
    const moves = fixtureSolution(f);
    let { run } = record([]);
    let state = lanterns.init(key, level);
    for (const m of moves) ({ run, state } = appendMove(lanterns, run, state, m));
    expect(encodeRun(run, 1)).toEqual(encodeRun(record().run, 1));
    // the level is complete: any further move is illegal (post-completion policy)
    expect(() => appendMove(lanterns, run, state, { x: 0, y: 0 })).toThrow(/illegal/);
    expect(() => appendMove(lanterns, run, state, { x: 1, y: 0 })).toThrow(/illegal/); // stone
  });
});

describe("verifySubmission (server)", () => {
  const dailyKey = "lanterns:daily:2026-10-13";
  const dailyLevelId = 0x00000123; // a real (non-test) level id
  const expected = { gameId: lanterns.id, mode: MODE.daily, levelId: dailyLevelId, seed: deriveSeed(dailyKey) };
  const honest = (o: Partial<{ mode: number; levelId: number; seed: string }> = {}): Uint8Array =>
    encodeRun(recordRun(lanterns, {
      seed: o.seed ?? dailyKey, params: level, moves: fixtureSolution(f),
      mode: o.mode ?? MODE.daily, levelId: o.levelId ?? dailyLevelId,
    }).run, 1);
  /** Edit header bytes of a valid file and recompute the CRC, as a forger would. */
  const edit = (bin: Uint8Array, patch: (b: Uint8Array) => void): Uint8Array => {
    const c = bin.slice(); patch(c); return seal(c.subarray(0, c.length - 4));
  };

  it("accepts the honest daily run and returns the replay result", () => {
    const v = verifySubmission(lanterns, honest(), level, expected);
    expect(v).toMatchObject({ ok: true, complete: true });
    if (v.ok) expect(v.perMoveHashes.length).toBe(4);
  });

  it("verifyRun alone accepts every forgery below (it is an integrity check only)", () => {
    expect(verifyRun(lanterns, honest({ mode: MODE.free }), level).ok).toBe(true);
    expect(verifyRun(lanterns, edit(honest(), (b) => { b[22]! ^= 1; }), level).ok).toBe(true);
    expect(verifyRun(lanterns, edit(honest(), (b) => { b[6]! ^= 1; }), level).ok).toBe(true);
  });

  it("rejects a free-mode run submitted as the daily", () => {
    expect(verifySubmission(lanterns, honest({ mode: MODE.free }), level, expected)).toMatchObject({ ok: false, code: "expect-mode" });
    expect(verifySubmission(lanterns, edit(honest(), (b) => { b[4] = MODE.bud; }), level, expected))
      .toMatchObject({ ok: false, code: "expect-mode" });
  });

  it("rejects an edited levelId with a recomputed CRC", () => {
    expect(verifySubmission(lanterns, edit(honest(), (b) => { b[22]! ^= 1; }), level, expected))
      .toMatchObject({ ok: false, code: "expect-level" });
  });

  it("rejects an edited seed with a recomputed CRC (lanterns init ignores the seed, so replay alone cannot)", () => {
    expect(verifySubmission(lanterns, edit(honest(), (b) => { b[6]! ^= 1; }), level, expected))
      .toMatchObject({ ok: false, code: "expect-seed" });
    expect(verifySubmission(lanterns, honest({ seed: "lanterns:daily:2026-10-12" }), level, expected))
      .toMatchObject({ ok: false, code: "expect-seed" });
  });

  it("rejects a run for another game", () => {
    expect(verifySubmission(lanterns, edit(honest(), (b) => { b[3] = 2; }), level, expected))
      .toMatchObject({ ok: false, code: "expect-game" });
    expect(verifySubmission(lanterns, honest(), level, { ...expected, gameId: 2 }))
      .toMatchObject({ ok: false, code: "expect-game" });
  });

  it("rejects daily runs on test levelIds even if the expectation matches", () => {
    const bin = honest({ levelId: TEST_LEVEL_MIN });
    expect(verifySubmission(lanterns, bin, level, { ...expected, levelId: TEST_LEVEL_MIN }))
      .toMatchObject({ ok: false, code: "test-level" });
    const freeTest = honest({ mode: MODE.free, levelId: f.levelId });
    expect(verifySubmission(lanterns, freeTest, level, { ...expected, mode: MODE.free, levelId: f.levelId }).ok).toBe(true);
  });

  it("still runs every integrity check (CRC, hash, illegal moves)", () => {
    const bin = honest();
    const crc = bin.slice(); crc[HEADER_SIZE]! ^= 1;
    expect(verifySubmission(lanterns, crc, level, expected)).toMatchObject({ ok: false, code: "crc" });
    expect(verifySubmission(lanterns, edit(bin, (b) => { b[28]! ^= 1; }), level, expected)).toMatchObject({ ok: false, code: "hash" });
    expect(verifySubmission(lanterns, bin, level, { ...expected, seed: new Uint8Array(8) })).toMatchObject({ ok: false, code: "expected" });
  });
});
