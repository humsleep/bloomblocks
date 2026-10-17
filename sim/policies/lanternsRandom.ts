// Trivial lanterns bots (lower bounds, not solvers).
//  random      — toggle a uniformly random floor cell.
//  random-dark — fix a random conflict, else drop a random lantern if over
//                budget, else light a random still-dark cell.

import type { Rng } from "../../core/rng.ts";
import * as L from "../../games/lanterns/index.ts";
import type { Policy } from "../types.ts";

const pick = <T>(xs: readonly T[], rng: Rng): T | null => (xs.length ? xs[rng.nextInt(xs.length)]! : null);

export const randomToggle: Policy<L.LanternsState, L.LanternsMove> = {
  name: "random",
  choose: (s, rng) => pick(L.cellsOf(L.floorMask(s)), rng),
};

export const randomDark: Policy<L.LanternsState, L.LanternsMove> = {
  name: "random-dark",
  choose(s, rng) {
    const a = L.analyze(s);
    if (L.popcount(a.conflicts) > 0) return pick(L.cellsOf(a.conflicts), rng);
    if (a.used > s.budget) return pick(L.cellsOf(s.lanterns), rng);
    return pick(L.cellsOf(L.darkCells(s)), rng);
  },
};
