// Brute-force reference for Lanterns-P tests (not a test file itself).
import * as P from "../../games/lanterns-pips/index.ts";

/** Brute force: every conflict-free lantern set (placed only on unlit cells) that completes. */
export function bruteSolutions(level: P.PipsLevel, cap = 1000): P.BB[] {
  const floor = P.cellsOf(P.floorMask(level)).map((c) => P.index(c.x, c.y));
  const out: P.BB[] = [];
  const rec = (k: number, s: P.PipsState): void => {
    if (out.length >= cap) return;
    if (k === floor.length) {
      if (P.isComplete(s)) out.push(s.lanterns);
      return;
    }
    rec(k + 1, s);
    const i = floor[k]!;
    if (P.popcount(P.analyze(s).conflicts) === 0 && !P.hasBit(P.analyze(s).lit, i)) {
      const t = { ...s, lanterns: P.withBit(s.lanterns, i, true) };
      if (P.popcount(P.analyze(t).over) === 0) rec(k + 1, t);
    }
  };
  rec(0, P.initialState(level));
  return out;
}
