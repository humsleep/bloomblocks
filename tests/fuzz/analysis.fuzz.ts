// analyzeBoard invariants on random states of every corpus level:
//   lit / litCount / litBy / conflicts / stones are consistent with the rules;
//   blocked cells are dark floor cells with no legal lantern spot; culprits are placed wrong lanterns
//   (and, on a unique board, a blocked cell always has one — the header's claim);
//   stuckStones ⇔ stones 'over' / 'blocked'; their lanterns are placed;
//   culprit (if any) is a placed lantern that is not in the solution — so taking it back always
//   lowers the number of wrong lanterns (round 7 property); a forced dead end (deadEnd) only
//   happens with a wrong lantern placed, and then a culprit is named.
import { describe, expect, it } from "vitest";
import { adjacentLanterns, analyze, analyzeBoard, hasBit, isComplete, lanternsPips as G, NO_CLUE, type PipsState, TRACKS } from "../../games/lanterns-pips/index.ts";
import { corpus, floor, prng } from "./corpus.ts";

describe.each(TRACKS)("%s: analyzeBoard invariants", (track) => {
  it("hold on random states (with toggle history)", () => {
    const rnd = prng(track === "gentle" ? 0x91 : 0x92);
    const blockedWithoutCulprit: string[] = [];
    let blockedSeen = 0;
    let culprits = 0;
    let deadEnds = 0;
    for (const item of corpus(track)) {
      const { level, solution } = item;
      const fl = floor(level);
      for (let rep = 0; rep < 4; rep++) {
        let s: PipsState = G.init(item.label, level);
        const recent: number[] = [];
        // mostly-correct boards with a few wrong lanterns get stuck the way players do
        const pRight = rnd() * 0.9;
        const pWrong = rnd() * 0.25;
        for (const c of fl) if (rnd() < (hasBit(solution, c) ? pRight : pWrong)) {
          s = G.apply(s, { x: c & 7, y: c >> 3 }) ?? s;
          recent.push(c);
        }
        const a = analyzeBoard(level, s, recent);
        const ra = analyze(s);
        const lantern = (c: number): boolean => hasBit(s.lanterns, c);
        // light
        let lit = 0;
        for (const c of fl) {
          expect(a.lit[c]).toBe(hasBit(ra.lit, c) ? 1 : 0);
          lit += a.lit[c]!;
          if (lantern(c)) expect(a.litBy[c]).toBeGreaterThanOrEqual(1);
        }
        expect(a.litCount).toBe(lit);
        expect(a.floorCount).toBe(fl.length);
        expect(a.complete).toBe(isComplete(s));
        for (const [p, q] of a.conflicts) {
          expect(p).toBeLessThan(q);
          expect(lantern(p) && lantern(q)).toBe(true);
          expect(hasBit(ra.conflicts, p) && hasBit(ra.conflicts, q)).toBe(true);
        }
        // numbers
        for (const st of a.stones) {
          expect(level.clues[st.cell]).toBe(st.need);
          expect(st.have).toBe(adjacentLanterns(s, st.cell));
          if (st.status === "over") expect(st.have).toBeGreaterThan(st.need);
          if (st.status === "ok") expect(st.have).toBe(st.need);
          if (st.status === "under" || st.status === "blocked") expect(st.have).toBeLessThan(st.need);
        }
        expect(a.stones.length).toBe(level.clues.filter((c) => c !== NO_CLUE).length);
        // blocked cells
        expect(a.deadCells).toEqual(a.blocked.map((b) => b.cell));
        for (const b of a.blocked) {
          blockedSeen++;
          expect(fl).toContain(b.cell);
          expect(a.lit[b.cell], `${item.label}: blocked cell ${b.cell} is lit`).toBe(0);
          expect(lantern(b.cell)).toBe(false);
          expect(b.by).toBe(b.lanterns.length > 0 ? "light" : "stone");
          for (const l of b.lanterns) expect(lantern(l)).toBe(true);
          for (const st of b.stones) expect(level.clues[st]).not.toBe(NO_CLUE);
          for (const c of b.culprits) {
            expect(lantern(c)).toBe(true);
            expect(hasBit(solution, c), `${item.label}: culprit ${c} is a solution lantern`).toBe(false);
          }
          if (b.culprits.length === 0) blockedWithoutCulprit.push(`${item.label} cell ${b.cell} lanterns ${[...fl.filter(lantern)].join(",")}`);
        }
        // stuck numbers
        const stuck = new Map(a.stuckStones.map((x) => [x.stone, x]));
        for (const st of a.stones) {
          const want = st.status === "over" ? "over" : st.status === "blocked" ? "cannotReach" : null;
          expect(stuck.get(st.cell)?.reason ?? null, `${item.label}: stone ${st.cell} ${st.status}`).toBe(want);
        }
        for (const x of a.stuckStones) {
          for (const l of x.lanterns) expect(lantern(l)).toBe(true);
          if (x.reason === "over") expect(x.lanterns.length).toBeGreaterThan(0);
        }
        // the one culprit
        if (a.culprit !== null) {
          culprits++;
          expect(lantern(a.culprit), `${item.label}: culprit is not placed`).toBe(true);
          expect(hasBit(solution, a.culprit), `${item.label}: culprit is a solution lantern`).toBe(false);
          const named = new Set([...a.blocked.flatMap((b) => b.culprits), ...a.stuckStones.flatMap((x) => x.lanterns)]);
          expect(named.has(a.culprit) || a.deadEnd !== null).toBe(true);
          const wrongNow = fl.filter((c) => lantern(c) && !hasBit(solution, c)).length;
          const after = fl.filter((c) => c !== a.culprit && lantern(c) && !hasBit(solution, c)).length;
          expect(after, `${item.label}: taking back the culprit must lower the wrong count`).toBe(wrongNow - 1);
        } else {
          // no culprit ⇒ no wrong lantern is involved anywhere, and no dead end was found
          for (const b of a.blocked) expect(b.culprits).toEqual([]);
          expect(a.deadEnd).toBeNull();
        }
        const anyWrong = fl.some((c) => lantern(c) && !hasBit(solution, c));
        if (a.deadEnd !== null) {
          deadEnds++;
          expect(anyWrong, `${item.label}: dead end without a wrong lantern`).toBe(true);
          expect(a.blocked).toEqual([]);
          expect(a.stuckStones).toEqual([]);
        }
        if (!anyWrong) expect(a.deadEnd).toBeNull();
      }
    }
    expect(blockedSeen, "the corpus must actually produce blocked cells").toBeGreaterThan(50);
    expect(culprits).toBeGreaterThan(50);
    expect(deadEnds, "the corpus must also produce forced dead ends").toBeGreaterThan(5);
    expect(blockedWithoutCulprit, "analysis.ts: 'for a board with a unique solution [culprits] is never empty'").toEqual([]);
  });
});
