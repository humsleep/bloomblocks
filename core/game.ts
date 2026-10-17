// Engine-agnostic game contract. Every prototype implements this; runlog.ts
// and the bot simulator only ever talk to games through it.
//
// Rules for implementers:
// - Integer arithmetic only. No Math.random, no Date, no floats in state.
// - apply() never mutates its input; it returns a new state or null (illegal).
// - stateBytes() is the canonical serialization hashed into run.bin; changing
//   it is a format change (regenerate fixtures deliberately, see CLAUDE.md).

import { fnv1a32 } from "./hash.ts";
import type { SeedInput } from "./rng.ts";

/** Registered game ids (u8). Never reuse a number. */
export const GAME_ID = {
  lanterns: 1, // B1 등불 정원
  seedlock: 2, // A1 화단 라운드
  doorfall: 3, // A2 문 심기
  hueblend: 4, // C1 물감 섞기
  lanternsPips: 5, // B1 변형 P(숫자 돌, 플레이테스트 실험용)
} as const;

export interface Game<State, Move, Params = unknown> {
  /** u8, see GAME_ID. */
  readonly id: number;
  /** Encoded move width in bytes (1 or 2), fixed per game. */
  readonly moveWidth: 1 | 2;
  /**
   * Build the initial state. `seed` may be a seed key string or the derived
   * 16-byte seed (see deriveSeed); both must yield the same state.
   * `params` carries the level definition (or generator inputs).
   */
  init(seed: SeedInput, params: Params): State;
  /** New state, or null if the move is illegal. Must not mutate `state`. */
  apply(state: State, move: Move): State | null;
  isComplete(state: State): boolean;
  encodeMove(move: Move): Uint8Array;
  /** null if the bytes are not a well-formed move encoding. */
  decodeMove(bytes: Uint8Array): Move | null;
  /** Canonical serialization used for hashing. */
  stateBytes(state: State): Uint8Array;
  score?(state: State): number;
}

/** FNV-1a 32 of the canonical state bytes. */
export function stateHash<S, M, P>(game: Game<S, M, P>, state: S): number {
  return fnv1a32(game.stateBytes(state));
}
