// From ANY reachable state (random lanterns, conflicts included), following hints always
// completes the level: removeWrong only names placed non-solution lanterns, place hints are
// solution cells that never conflict, and the walk is bounded.
import { describe, expect, it } from "vitest";
import { analyzeBoard, hasBit, hintFor, isComplete, lanternsPips as G, type PipsState, TRACKS } from "../../games/lanterns-pips/index.ts";
import { hintTrace } from "../../games/lanterns-pips/hint.ts";
import { corpus, floor, prng } from "./corpus.ts";

describe.each(TRACKS)("%s: hints from random states", (track) => {
  it("always reach completion without a conflict", () => {
    const rnd = prng(track === "gentle" ? 0x71 : 0x72);
    const tiers = [0, 0, 0, 0];
    for (const item of corpus(track)) {
      const { level, solution } = item;
      const fl = floor(level);
      let s: PipsState = G.init(item.label, level);
      const recent: number[] = [];
      const density = rnd() * 0.45;
      for (const c of fl) if (rnd() < density) {
        s = G.apply(s, { x: c & 7, y: c >> 3 }) ?? s;
        recent.push(c);
      }
      const wrong0 = fl.filter((c) => hasBit(s.lanterns, c) && !hasBit(solution, c)).length;
      let steps = 0;
      while (!isComplete(s)) {
        steps++;
        expect(steps, `${item.label}: hint walk too long`).toBeLessThanOrEqual(fl.length + wrong0 + 1);
        const last = recent.length ? recent[recent.length - 1] : undefined;
        const t = hintTrace(level, s, last, recent);
        const h = t.hint;
        expect(hintFor(level, s, last, recent)).toEqual(h);
        if (h.kind === "removeWrong") {
          expect(h.cells).toHaveLength(1);
          const c = h.cells[0]!;
          expect(hasBit(s.lanterns, c), `${item.label}: removeWrong names an empty cell`).toBe(true);
          expect(hasBit(solution, c), `${item.label}: removeWrong names a solution lantern`).toBe(false);
          expect(h.remaining).toBe(fl.filter((q) => hasBit(s.lanterns, q) && !hasBit(solution, q)).length);
          s = G.apply(s, { x: c & 7, y: c >> 3 })!;
          recent.push(c);
        } else {
          expect(h.kind, `${item.label}: 'none' before completion`).toBe("place");
          if (h.kind !== "place") break;
          expect(hasBit(solution, h.cell), `${item.label}: place hint off the solution`).toBe(true);
          expect(hasBit(s.lanterns, h.cell)).toBe(false);
          tiers[t.tier < 0 ? 0 : t.tier]!++;
          s = G.apply(s, { x: h.cell & 7, y: h.cell >> 3 })!;
          recent.push(h.cell);
          expect(analyzeBoard(level, s).conflicts, `${item.label}: hint placed into a conflict`).toEqual([]);
        }
      }
      expect(hintFor(level, s)).toEqual({ kind: "none" });
    }
    // the fallback tier (0: "no deduction found") should not happen on unique boards
    expect(tiers[0], `fallback hints (tier 0) — tiers 0/1/2/3 = ${tiers.join("/")}`).toBe(0);
  });
});
