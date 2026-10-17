import type { Game } from "../core/game.ts";
import type { Rng } from "../core/rng.ts";

/** A bot. Must be deterministic given (state, rng). null = give up. */
export interface Policy<S, M> {
  readonly name: string;
  choose(state: S, rng: Rng): M | null;
}

/** Human time model: estimated seconds = fixedSeconds + actions × secondsPerAction. */
export interface TimeModel {
  secondsPerAction: number;
  fixedSeconds: number;
}

export interface SimLevel<P> {
  levelId: number;
  name: string;
  params: P;
}

export interface SimGameDef<S, M, P> {
  name: string;
  game: Game<S, M, P>;
  levels: readonly SimLevel<P>[];
  policies: Record<string, Policy<S, M>>;
}

export interface GameResult {
  index: number;
  levelId: number;
  completed: boolean;
  actions: number;
  seconds: number;
}

export interface ChunkJob {
  game: string;
  policy: string;
  start: number;
  count: number;
  maxActions: number;
  time: TimeModel;
}
