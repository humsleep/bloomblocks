// run.bin: save file and replay log. Byte layout: docs/runlog-format.md.
// Used by the client (save every move), the Workers verifier and the bots.

import { bytesEqual, concatBytes, readU16LE, readU32LE, writeU16LE, writeU32LE } from "./bytes.ts";
import { type Game, stateHash } from "./game.ts";
import { crc32 } from "./hash.ts";
import { deriveSeed, type SeedInput } from "./rng.ts";

export const FORMAT_VERSION = 1;
export const HEADER_SIZE = 32;
export const TRAILER_SIZE = 4;
export const MAX_MOVES = 0xffff;
export const MODE = { free: 0, daily: 1, bud: 2 } as const;

export interface RunHeader {
  formatVersion: number;
  gameId: number;
  mode: number;
  flags: number;
  /** The derived 128-bit seed actually used (16 bytes). */
  seed: Uint8Array;
  levelId: number;
  moveCount: number;
  /** FNV-1a 32 of stateBytes after the last move (or the initial state if no moves). */
  stateHash: number;
}

export interface Run {
  header: RunHeader;
  /** Encoded moves, each exactly game.moveWidth bytes. */
  moves: Uint8Array[];
}

export class RunError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.code = code;
  }
}

const u8ok = (v: number): boolean => Number.isInteger(v) && v >= 0 && v <= 0xff;
const u32ok = (v: number): boolean => Number.isInteger(v) && v >= 0 && v <= 0xffffffff;
/** levelId >= this is reserved for test fixtures and is never valid in a daily submission. */
export const TEST_LEVEL_MIN = 0xf0000000;

/**
 * Serialize a Run. Throws RunError on anything decodeRun would reject:
 * moveCount, seed length, formatVersion, gameId, mode <= 2, flags = 0, levelId u32
 * (no wrapping), and every move exactly `moveWidth` bytes (pass game.moveWidth;
 * if omitted, all moves must share one width of 1 or 2).
 */
export function encodeRun(run: Run, moveWidth?: number): Uint8Array {
  const h = run.header;
  if (h.moveCount !== run.moves.length) throw new RunError("count", "moveCount != moves.length");
  if (h.moveCount > MAX_MOVES) throw new RunError("count", `too many moves (max ${MAX_MOVES})`);
  if (h.seed.length !== 16) throw new RunError("seed", "seed must be 16 bytes");
  if (h.formatVersion !== FORMAT_VERSION) throw new RunError("version", `can only encode formatVersion ${FORMAT_VERSION}`);
  if (!u8ok(h.gameId)) throw new RunError("field", "gameId out of range");
  if (!Number.isInteger(h.mode) || h.mode < 0 || h.mode > MODE.bud) throw new RunError("mode", `unknown mode ${h.mode}`);
  if (h.flags !== 0) throw new RunError("flags", "flags must be 0 in formatVersion 1");
  if (!u32ok(h.levelId)) throw new RunError("field", `levelId ${h.levelId} is not a u32`);
  if (!Number.isInteger(h.stateHash)) throw new RunError("field", "stateHash is not an integer");
  const w = moveWidth ?? run.moves[0]?.length ?? 1;
  if (w !== 1 && w !== 2) throw new RunError("move", `move width ${w} is not 1 or 2`);
  for (const m of run.moves) if (m.length !== w) throw new RunError("move", `move is ${m.length} bytes, expected ${w}`);
  const head = new Uint8Array(HEADER_SIZE);
  head.set([0x50, 0x4c, h.formatVersion, h.gameId, h.mode, h.flags]); // "PL" + u8 fields
  head.set(h.seed, 6);
  writeU32LE(head, 22, h.levelId);
  writeU16LE(head, 26, h.moveCount);
  writeU32LE(head, 28, h.stateHash >>> 0); // a hash: int32 and u32 views are the same bits
  return seal(concatBytes([head, ...run.moves]));
}

/** Append the CRC-32 trailer to `body`. Exported for tools that build test vectors. */
export function seal(body: Uint8Array): Uint8Array {
  const out = new Uint8Array(body.length + TRAILER_SIZE);
  out.set(body);
  writeU32LE(out, body.length, crc32(body));
  return out;
}

/** Parse the header only (to route by gameId before picking a Game). Does not check length or CRC. */
export function decodeHeader(bytes: Uint8Array): RunHeader {
  if (bytes.length < HEADER_SIZE + TRAILER_SIZE) throw new RunError("length", "too short");
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4c) throw new RunError("magic", "not a run.bin");
  if (bytes[2] !== FORMAT_VERSION) throw new RunError("version", `unsupported formatVersion ${bytes[2]}`);
  const mode = bytes[4]!;
  if (mode > MODE.bud) throw new RunError("mode", `unknown mode ${mode}`);
  if (bytes[5] !== 0) throw new RunError("flags", `flags must be 0 in formatVersion 1, got ${bytes[5]}`);
  return {
    formatVersion: bytes[2]!, gameId: bytes[3]!, mode, flags: bytes[5]!, seed: bytes.slice(6, 22),
    levelId: readU32LE(bytes, 22), moveCount: readU16LE(bytes, 26), stateHash: readU32LE(bytes, 28),
  };
}

/** Full decode: magic, version, mode, exact length and CRC are validated. */
export function decodeRun(bytes: Uint8Array, moveWidth: number): Run {
  const header = decodeHeader(bytes);
  const expected = HEADER_SIZE + header.moveCount * moveWidth + TRAILER_SIZE;
  if (bytes.length !== expected) throw new RunError("length", `expected ${expected} bytes, got ${bytes.length}`);
  const crcAt = bytes.length - TRAILER_SIZE;
  if (crc32(bytes.subarray(0, crcAt)) !== readU32LE(bytes, crcAt)) throw new RunError("crc", "CRC-32 mismatch");
  const moves: Uint8Array[] = [];
  for (let i = 0; i < header.moveCount; i++) {
    const o = HEADER_SIZE + i * moveWidth;
    moves.push(bytes.slice(o, o + moveWidth));
  }
  return { header, moves };
}

export interface ReplayResult<S> {
  state: S;
  /** stateHash after each move; perMoveHashes[i] is after move i. */
  perMoveHashes: number[];
}

/** Re-run every move from the header seed. Throws RunError on a bad or illegal move. */
export function replay<S, M, P>(game: Game<S, M, P>, run: Run, params: P): ReplayResult<S> {
  if (run.header.gameId !== game.id) throw new RunError("game", `run is for game ${run.header.gameId}`);
  let state = game.init(run.header.seed, params);
  const perMoveHashes: number[] = [];
  run.moves.forEach((bytes, i) => {
    if (bytes.length !== game.moveWidth) throw new RunError("move", `move ${i} has wrong width`);
    const move = game.decodeMove(bytes);
    if (move === null) throw new RunError("move", `move ${i} is malformed`);
    const next = game.apply(state, move);
    if (next === null) throw new RunError("illegal", `move ${i} is illegal`);
    state = next;
    perMoveHashes.push(stateHash(game, state));
  });
  return { state, perMoveHashes };
}

function finalHash<S, M, P>(game: Game<S, M, P>, r: ReplayResult<S>): number {
  const n = r.perMoveHashes.length;
  return n > 0 ? r.perMoveHashes[n - 1]! : stateHash(game, r.state);
}

export type VerifyResult<S> =
  | ({ ok: true; run: Run; complete: boolean } & ReplayResult<S>)
  | { ok: false; code: string; error: string };

function verifyDecoded<S, M, P>(game: Game<S, M, P>, run: Run, params: P): VerifyResult<S> {
  const r = replay(game, run, params);
  if (finalHash(game, r) !== run.header.stateHash) return { ok: false, code: "hash", error: "stateHash mismatch" };
  return { ok: true, run, complete: game.isComplete(r.state), ...r };
}

function fail(e: unknown): { ok: false; code: string; error: string } {
  if (e instanceof RunError) return { ok: false, code: e.code, error: e.message };
  return { ok: false, code: "exception", error: String(e) };
}

/**
 * INTEGRITY ONLY (local save/resume check, bots, fixtures): decode + replay +
 * compare the recomputed final hash to the header. CRC-32 and stateHash detect
 * corruption, not forgery: anyone can recompute them. It does not compare the
 * header's mode/levelId/seed with anything, so a server must use
 * verifySubmission instead. Never throws on bad input.
 */
export function verifyRun<S, M, P>(game: Game<S, M, P>, bytes: Uint8Array, params: P): VerifyResult<S> {
  try {
    return verifyDecoded(game, decodeRun(bytes, game.moveWidth), params);
  } catch (e) {
    return fail(e);
  }
}

/** What the server derived on its own (from its date/slot and secret), never read from the file. */
export interface SubmissionExpectation {
  gameId: number;
  mode: number;
  levelId: number;
  /** The 16-byte derived seed the server expects (deriveSeed(serverSeedKey)). */
  seed: Uint8Array;
}

/**
 * Server-side check of a submitted run.bin. Like verifyRun, but first rejects
 * any header field that differs from `expected` (codes `expect-game`,
 * `expect-mode`, `expect-level`, `expect-seed`) and daily runs on test
 * levelIds >= TEST_LEVEL_MIN (`test-level`). `params` must be derived by the
 * server from its own seed, never from the file. The format carries no player,
 * nonce or time, so replaying another player's run or a solver's run is not
 * detectable here (see docs/runlog-format.md). Never throws on bad input.
 */
export function verifySubmission<S, M, P>(
  game: Game<S, M, P>, bytes: Uint8Array, params: P, expected: SubmissionExpectation,
): VerifyResult<S> {
  try {
    if (expected.seed.length !== 16) throw new RunError("expected", "expected.seed must be 16 bytes");
    const run = decodeRun(bytes, game.moveWidth);
    const h = run.header;
    if (h.gameId !== expected.gameId || h.gameId !== game.id) throw new RunError("expect-game", `gameId ${h.gameId}`);
    if (h.mode !== expected.mode) throw new RunError("expect-mode", `mode ${h.mode}, expected ${expected.mode}`);
    if (h.levelId !== expected.levelId) throw new RunError("expect-level", `levelId ${h.levelId}, expected ${expected.levelId}`);
    if (!bytesEqual(h.seed, expected.seed)) throw new RunError("expect-seed", "seed differs from the expected seed");
    if (h.mode === MODE.daily && h.levelId >= TEST_LEVEL_MIN) throw new RunError("test-level", "daily run on a test levelId");
    return verifyDecoded(game, run, params);
  } catch (e) {
    return fail(e);
  }
}

export interface RecordOptions<M, P> {
  seed: SeedInput;
  params: P;
  moves: readonly M[];
  mode: number;
  levelId: number;
  /** Must be 0 (formatVersion 1). Kept for compatibility. */
  flags?: number;
}

function encodeMoveChecked<S, M, P>(game: Game<S, M, P>, m: M): Uint8Array {
  const b = game.encodeMove(m);
  if (b.length !== game.moveWidth) throw new RunError("move", `encodeMove returned ${b.length} bytes`);
  return b;
}

/**
 * Play `moves` from scratch and produce the matching Run (header hash filled in).
 * Throws RunError: `count` beyond MAX_MOVES, `illegal` (e.g. a move after
 * completion), or any header field encodeRun would reject.
 */
export function recordRun<S, M, P>(game: Game<S, M, P>, o: RecordOptions<M, P>): ReplayResult<S> & { run: Run } {
  if (o.moves.length > MAX_MOVES) throw new RunError("count", `cannot record ${o.moves.length} moves (max ${MAX_MOVES})`);
  const seed = deriveSeed(o.seed);
  const moves = o.moves.map((m) => encodeMoveChecked(game, m));
  const header: RunHeader = {
    formatVersion: FORMAT_VERSION, gameId: game.id, mode: o.mode, flags: o.flags ?? 0,
    seed, levelId: o.levelId, moveCount: moves.length, stateHash: 0,
  };
  const run: Run = { header, moves };
  const r = replay(game, run, o.params);
  header.stateHash = finalHash(game, r);
  encodeRun(run, game.moveWidth); // validate the header now, not at save time
  return { run, ...r };
}

/**
 * Per-move save path: apply `move` to `state` (the result of replaying `run`)
 * and return the extended Run. Does not mutate its inputs. Throws RunError
 * `count` at MAX_MOVES (the save would be unreadable) and `illegal` if apply()
 * returns null (including any move after completion).
 */
export function appendMove<S, M, P>(game: Game<S, M, P>, run: Run, state: S, move: M): { run: Run; state: S } {
  if (run.moves.length >= MAX_MOVES) throw new RunError("count", `run already has ${MAX_MOVES} moves`);
  const bytes = encodeMoveChecked(game, move);
  const next = game.apply(state, move);
  if (next === null) throw new RunError("illegal", `move ${run.moves.length} is illegal`);
  const moves = [...run.moves, bytes];
  return { run: { header: { ...run.header, moveCount: moves.length, stateHash: stateHash(game, next) }, moves }, state: next };
}
