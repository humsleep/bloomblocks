// Games available to the simulator. Each entry is type-erased behind runOne()
// so workers can look games up by name.

import { Rng } from "../core/rng.ts";
import { FIXTURE_LEVELS, fixtureLevel } from "../games/lanterns/fixtureLevel.ts";
import { lanterns } from "../games/lanterns/index.ts";
import { randomDark, randomToggle } from "./policies/lanternsRandom.ts";
import type { ChunkJob, GameResult, SimGameDef } from "./types.ts";

export interface SimEntry {
  name: string;
  levels: readonly { levelId: number; name: string }[];
  policies: readonly string[];
  runOne(index: number, job: ChunkJob): GameResult;
}

function define<S, M, P>(def: SimGameDef<S, M, P>): SimEntry {
  return {
    name: def.name,
    levels: def.levels.map(({ levelId, name }) => ({ levelId, name })),
    policies: Object.keys(def.policies),
    runOne(index, job) {
      const level = def.levels[index % def.levels.length]!;
      const policy = def.policies[job.policy];
      if (!policy) throw new Error(`unknown policy ${job.policy}`);
      const seedKey = `sim:${def.name}:${job.policy}:${index}`;
      const rng = Rng.from(seedKey);
      let state = def.game.init(seedKey, level.params);
      let actions = 0;
      while (!def.game.isComplete(state) && actions < job.maxActions) {
        const move = policy.choose(state, rng);
        if (move === null) break;
        const next = def.game.apply(state, move);
        if (next === null) throw new Error(`policy ${job.policy} chose an illegal move`);
        state = next;
        actions++;
      }
      const completed = def.game.isComplete(state);
      return {
        index, levelId: level.levelId, completed, actions,
        seconds: job.time.fixedSeconds + actions * job.time.secondsPerAction,
      };
    },
  };
}

export const SIM_GAMES: Record<string, SimEntry> = {
  lanterns: define({
    name: "lanterns",
    game: lanterns,
    // Fixture levels until the seeded generator exists.
    levels: FIXTURE_LEVELS.map((f) => ({ levelId: f.levelId, name: f.name, params: fixtureLevel(f) })),
    policies: { [randomDark.name]: randomDark, [randomToggle.name]: randomToggle },
  }),
};

export function runChunk(job: ChunkJob): GameResult[] {
  const entry = SIM_GAMES[job.game];
  if (!entry) throw new Error(`unknown game ${job.game}`);
  return Array.from({ length: job.count }, (_, k) => entry.runOne(job.start + k, job));
}
