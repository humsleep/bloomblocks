// Lanterns variant P ("pips") as a core Game. gameId = GAME_ID.lanternsPips.
// Move encoding is the same as lanterns (1 byte = stride-8 cell index,
// bits 6-7 must be 0).

import { GAME_ID, type Game } from "../../core/game.ts";
import type { SeedInput } from "../../core/rng.ts";
import { decodeMove, encodeMove } from "../lanterns/index.ts";
import * as R from "./rules.ts";

export * from "./rules.ts";
export { levelRows, parseLanterns, parseLevel } from "./level.ts";
// UI contract (apps/client codes against these): tracks + daily, board read-out, hints.
export { type Beat, type Track, TRACKS, generatedForDaily, generatedForTrack, levelForDaily, levelForTrack } from "./tracks.ts";
export { type BlockedCell, type BoardAnalysis, type StoneInfo, type StoneStatus, type StuckReason, type StuckStone, analyzeBoard } from "./analysis.ts";
export { type Hint, type HintReason, hintFor, solutionOf } from "./hint.ts";
// Daily number + spoiler-free share text (round 4).
export { APP_NAME, DAILY_EPOCH, DAILY_URL_BASE, type DailyResult, SHARE_CT, type ShareOptions, dailyLink, dailyNumber, moonPhase, shareText } from "./share.ts";

export const lanternsPips: Game<R.PipsState, R.PipsMove, R.PipsLevel> = {
  id: GAME_ID.lanternsPips,
  moveWidth: 1,
  init: (_seed: SeedInput, level: R.PipsLevel) => R.initialState(level),
  apply: R.toggle,
  isComplete: R.isComplete,
  encodeMove,
  decodeMove,
  stateBytes: R.stateBytes,
};
