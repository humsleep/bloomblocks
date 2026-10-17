// Lanterns as a core Game. Move encoding (1 byte):
//   bit 0-2 = x, bit 3-5 = y, bit 6-7 = 0 (spare; nonzero decodes as null)
// which equals the stride-8 cell index.

import { GAME_ID, type Game } from "../../core/game.ts";
import type { SeedInput } from "../../core/rng.ts";
import * as R from "./rules.ts";

export * from "./rules.ts";
export { levelRows, parseLanterns, parseLevel } from "./level.ts";

export function encodeMove(m: R.LanternsMove): Uint8Array {
  const ok = (v: number): boolean => Number.isInteger(v) && v >= 0 && v < 8;
  if (!ok(m.x) || !ok(m.y)) throw new RangeError(`move (${m.x},${m.y}) not encodable`);
  return Uint8Array.of(R.index(m.x, m.y));
}

export function decodeMove(bytes: Uint8Array): R.LanternsMove | null {
  if (bytes.length !== 1) return null;
  const b = bytes[0]!;
  if (b & 0xc0) return null;
  return { x: b & 7, y: (b >> 3) & 7 };
}

export const lanterns: Game<R.LanternsState, R.LanternsMove, R.LanternsLevel> = {
  id: GAME_ID.lanterns,
  moveWidth: 1,
  // Rules-only: the level is given in params, so the seed is not consumed here.
  // Levels come from games/lanterns/generator.ts (generate(params) seeds its own Rng from params.seedKey).
  init: (_seed: SeedInput, level: R.LanternsLevel) => R.initialState(level),
  apply: R.toggle,
  isComplete: R.isComplete,
  encodeMove,
  decodeMove,
  stateBytes: R.stateBytes,
};
