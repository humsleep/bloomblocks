// pipsApi.ts (the client's only door to the rules) + levelIds.ts.
import { analyzeBoard as rulesAnalyze, APP_NAME, type PipsLevel, shareText as rulesShareText } from "@games/lanterns-pips/index.ts";
import { MOON_PHASES, moonPhase as moonPhase8 } from "@games/lanterns-pips/share.ts";
import { describe, expect, it } from "vitest";
import { levelIdFor, seedKeyFor } from "../src/game/levelIds.ts";
import {
  analyzeBoard, blockedCells, type BoardAnalysis, cannotReach, culpritOf, dailyNumber, floorNeighbours, hasBit, type Hint, index, isoDay, isoFromDay,
  lanternsPips as G, levelForDaily, levelForTrack, mmss, moonPhase, NO_CLUE, type PipsState, raysOf, seeingPair, shareText, solutionOf, stepHint,
  trackSeedKey,
} from "../src/game/pipsApi.ts";
import { cellsOf, floorCells, prng } from "./helpers.ts";

describe("levelIds", () => {
  it("seed keys are the rules' track keys", () => {
    for (const t of ["gentle", "deduce"] as const) for (const n of [1, 2, 10, 20, 99]) expect(seedKeyFor(t, n)).toBe(trackSeedKey(t, n));
  });
  it("gentle n → n, deduce n → 0x01000000 | n; distinct per track", () => {
    expect(levelIdFor("gentle", 1)).toBe(1);
    expect(levelIdFor("gentle", 0xabcd)).toBe(0xabcd);
    expect(levelIdFor("deduce", 1)).toBe(0x01000001);
    const ids = new Set<number>();
    for (let n = 1; n <= 2000; n++) {
      ids.add(levelIdFor("gentle", n));
      ids.add(levelIdFor("deduce", n));
    }
    expect(ids.size).toBe(4000);
    expect(levelIdFor("deduce", 5) >>> 0).toBe(levelIdFor("deduce", 5));
  });
  it("finale levels carry their own seed-key version", () => {
    expect(seedKeyFor("gentle", 10)).not.toBe(seedKeyFor("gentle", 9).replace(/:9$/, ":10"));
  });
});

describe("dates, clock text, moon", () => {
  it("isoDay / isoFromDay round-trip over 3 years", () => {
    const d0 = isoDay("2026-01-01");
    for (let d = d0; d < d0 + 1100; d++) expect(isoDay(isoFromDay(d))).toBe(d);
  });
  it.each([
    [0, "0:00"],
    [59.4, "0:59"],
    [59.6, "1:00"],
    [161, "2:41"],
    [3600, "60:00"],
    [-3, "0:00"],
  ])("mmss(%s) = %s", (s, want) => expect(mmss(s)).toBe(want));
  it("moonPhase is the rules' 8-step phase mapped to [0, 1)", () => {
    for (let d = isoDay("2026-10-01"); d < isoDay("2026-12-01"); d++) {
      const iso = isoFromDay(d);
      const p = moonPhase(iso);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(1);
      expect(p * 8).toBe(moonPhase8(iso));
    }
  });
});

describe("share text wiring", () => {
  const level = levelForDaily("2026-10-14");
  const r = { dateISO: "2026-11-14", seconds: 161, hints: 0, undos: 0, streak: 7 };
  it("after the epoch: identical to the rules' text, showTime toggles ⏱", () => {
    expect(dailyNumber("2026-11-14")).toBe(14);
    expect(shareText(level, r)).toBe(rulesShareText(level, r, { showTime: true }));
    expect(shareText(level, r, { showTime: false })).toBe(rulesShareText(level, r, { showTime: false }));
    expect(shareText(level, r)).toContain("⏱ 2:41");
    expect(shareText(level, r, { showTime: false })).not.toContain("⏱");
  });
  it("before the epoch (dailyNumber ≤ 0) the '#n' is dropped and nothing else changes", () => {
    for (const date of ["2026-10-31", "2026-10-14", "2025-01-01"]) {
      const t = shareText(level, { ...r, dateISO: date });
      expect(dailyNumber(date)).toBeLessThanOrEqual(0);
      expect(t).not.toContain("#");
      // R2 (A5): the link line points at the dailies' home (no number before the epoch)
      expect(t).toBe(`${APP_NAME} ${MOON_PHASES[moonPhase8(date)]}\n✨ ⏱ 2:41 🔥7\nhttps://humsleep.github.io/apps/duskwick/?ct=share`);
    }
  });
  it("hint glyphs: ✨ without hints (undos don't matter), 💡n with hints", () => {
    expect(shareText(level, { ...r, hints: 3, undos: 2 }).split("\n")[1]).toBe("💡3 ⏱ 2:41 🔥7");
    expect(shareText(level, { ...r, hints: 0, undos: 2 }).split("\n")[1]).toBe("✨ ⏱ 2:41 🔥7");
  });
  it("never contains letters outside APP_NAME and the link line, and never board data", () => {
    const rnd = prng(7);
    for (let k = 0; k < 300; k++) {
      const d = isoFromDay(isoDay("2026-01-01") + Math.floor(rnd() * 900));
      const t = shareText(level, {
        dateISO: d, seconds: rnd() * 40000 - 100, hints: Math.floor(rnd() * 2000) - 5, undos: Math.floor(rnd() * 5), streak: Math.floor(rnd() * 200000) - 3,
      }, { showTime: rnd() < 0.5 });
      const lines = t.split("\n");
      expect(lines.at(-1)).toMatch(/^https:\/\/humsleep\.github\.io\/apps\/duskwick\/\d*\?ct=share$/);
      expect(lines.slice(0, -1).join("\n").replace(APP_NAME, "")).not.toMatch(/[A-Za-z]/);
      expect(lines.length).toBeLessThanOrEqual(4);
    }
  });
});

describe("hint / analysis adapters", () => {
  const level = levelForTrack("gentle", 3);
  const sol = cellsOf(solutionOf(level)!);
  const wrong = floorCells(level).filter((c) => !sol.includes(c));
  const withLanterns = (cells: readonly number[], lv: PipsLevel = level): PipsState => {
    let s = G.init("t", lv);
    for (const c of cells) s = G.apply(s, { x: c & 7, y: c >> 3 }) ?? s;
    return s;
  };

  it("stepHint: removeWrong → one cell + remaining AFTER it; place → cell/anchor; none", () => {
    const h: Hint = { kind: "removeWrong", cells: [12], remaining: 3 };
    expect(stepHint(h)).toEqual({ kind: "removeWrong", cell: 12, remaining: 2 });
    expect(stepHint({ kind: "removeWrong", cells: [12], remaining: 1 })).toEqual({ kind: "removeWrong", cell: 12, remaining: 0 });
    expect(stepHint({ kind: "removeWrong", cells: [], remaining: 1 })).toEqual({ kind: "none" });
    expect(stepHint({ kind: "place", cell: 9, reason: "stone", anchor: 10 })).toEqual({ kind: "place", cell: 9, anchor: 10 });
    expect(stepHint({ kind: "none" })).toEqual({ kind: "none" });
  });

  it("culpritOf: the rules' culprit, else the first blocked culprit, else -1", () => {
    const base: BoardAnalysis = rulesAnalyze(level, G.init("t", level));
    expect(culpritOf(base)).toBe(-1);
    expect(culpritOf({ ...base, culprit: 17 })).toBe(17);
    expect(culpritOf({ ...base, culprit: null, blocked: [{ cell: 1, by: "light", stones: [], lanterns: [3], causes: ["light"], culprits: [3, 4] }] })).toBe(3);
  });

  it("random states: blockedCells / cannotReach agree with the rules read-out", () => {
    const rnd = prng(42);
    for (let k = 0; k < 120; k++) {
      const cells = floorCells(level).filter(() => rnd() < 0.25);
      const s = withLanterns(cells);
      const a = analyzeBoard(level, s, cells);
      const list = blockedCells(level, s, a);
      expect(list.map((b) => b.cell)).toEqual(a.blocked.map((b) => b.cell));
      for (const b of list) {
        expect(a.lit[b.cell]).toBe(0);
        expect(b.lanterns.length).toBe(b.via.length);
        for (const l of b.lanterns) expect(hasBit(s.lanterns, l)).toBe(true);
        for (const st of b.stones) expect(level.clues[st]).not.toBe(NO_CLUE);
        if (b.causes.includes("light")) expect(b.lanterns.length).toBeGreaterThan(0);
      }
      for (const st of cannotReach(a)) expect(a.stones.find((x) => x.cell === st.stone)?.status).toBe("blocked");
      const c = culpritOf(a);
      if (c >= 0) {
        expect(hasBit(s.lanterns, c)).toBe(true);
        expect(sol).not.toContain(c);
      }
    }
  });

  it("raysOf: a lantern lights its own cell and its runs up to stones / edges", () => {
    for (const c of floorCells(level)) {
      const r = raysOf(level, c);
      expect(r[0]).toBe(c);
      const s = withLanterns([c]);
      const lit = analyzeBoard(level, s).lit;
      expect(r.slice().sort((x, y) => x - y)).toEqual(cellsOf({ lo: 0, hi: 0 }).concat(floorCells(level).filter((q) => lit[q] === 1)));
    }
  });

  it("seeingPair: two floor cells in one run, never next to a 0 rock", () => {
    for (const n of [1, 2, 3, 4, 5, 6]) {
      const lv = levelForTrack("gentle", n);
      const p = seeingPair(lv);
      if (!p) continue;
      const [a, b] = p;
      expect(raysOf(lv, a)).toContain(b);
      for (const c of p) for (const j of [c - 8, c + 8, c - 1, c + 1]) {
        if (j < 0 || j > 63 || !hasBit(lv.stones, j)) continue;
        if (Math.abs((j & 7) - (c & 7)) + Math.abs((j >> 3) - (c >> 3)) !== 1) continue;
        expect(lv.clues[j]).not.toBe(0);
      }
      const s = withLanterns(p, lv);
      expect(analyzeBoard(lv, s).conflicts).toEqual([[Math.min(a, b), Math.max(a, b)]]);
    }
  });

  it("floorNeighbours: floor cells orthogonally next to a stone", () => {
    for (const st of cellsOf(level.stones)) {
      for (const c of floorNeighbours(level, st)) {
        expect(hasBit(level.stones, c)).toBe(false);
        expect(Math.abs((c & 7) - (st & 7)) + Math.abs((c >> 3) - (st >> 3))).toBe(1);
      }
    }
    expect(index(3, 2)).toBe(19);
    expect(wrong.length).toBeGreaterThan(0);
  });
});
