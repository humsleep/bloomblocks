// Randomised session runs: any mix of taps / undos / hint removals / track switches,
// killed at a random point, relaunches into exactly the live state (journal = truth).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lanternsPips as G } from "../src/game/pipsApi.ts";
import { Session, setLevelWorker } from "../src/game/session.ts";
import { FakeLevelWorker } from "./fakes/levelWorker.ts";
import { floorCells, prng, resetDevice, settle } from "./helpers.ts";

beforeEach(() => {
  resetDevice();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-14T10:00:00"));
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});
afterEach(() => vi.useRealTimers());

async function randomRuns(seed: number, runs: number, withWorker: boolean): Promise<void> {
  const rnd = prng(seed);
  for (let run = 0; run < runs; run++) {
    resetDevice();
    const s = await Session.restore();
    const steps = 5 + Math.floor(rnd() * 40);
    for (let k = 0; k < steps; k++) {
      const r = rnd();
      if (s.complete) {
        if (withWorker) await s.nextLevelReady;
        s.advance();
        continue;
      }
      if (r < 0.7) {
        const cells = floorCells(s.level);
        const c = cells[Math.floor(rnd() * cells.length)]!;
        expect(["placed", "removed", "complete"]).toContain(s.tap(c & 7, c >> 3));
      } else if (r < 0.82) s.undo();
      else if (r < 0.9) {
        const h = s.hint();
        if (h.kind === "removeWrong") s.removeMany(h.cells);
        else if (h.kind === "place") s.tap(h.cell & 7, h.cell >> 3);
      } else if (r < 0.95) await s.switchTrack();
      else {
        // play the level out with hints (always reaches completion)
        for (let g = 0; g < 80 && !s.complete; g++) {
          const h = s.hint();
          if (h.kind === "removeWrong") s.removeMany(h.cells);
          else if (h.kind === "place") s.tap(h.cell & 7, h.cell >> 3);
        }
        expect(s.complete).toBe(true);
      }
    }
    await settle();
    const live = { track: s.track, n: s.levelNumber, bytes: G.stateBytes(s.state), moves: s.moves.map((m) => m[0]), complete: s.complete };
    const r = await Session.restore();
    await settle();
    if (live.complete) {
      // killed during the finale once every level-end write landed: the next level, fresh
      expect({ track: r.track, n: r.levelNumber, moves: r.moves.length, complete: r.complete }).toEqual({ track: live.track, n: live.n + 1, moves: 0, complete: false });
    } else {
      expect({ track: r.track, n: r.levelNumber, bytes: G.stateBytes(r.state), moves: r.moves.map((m) => m[0]), complete: r.complete }).toEqual(live);
    }
  }
}

describe("random play → kill → relaunch", () => {
  it("restores the exact state, track, level and move list (60 runs)", async () => {
    await randomRuns(20261014, 60, false);
  });

  it("the same with the level worker pregenerating in the background (30 runs)", async () => {
    FakeLevelWorker.reset();
    FakeLevelWorker.auto = true;
    setLevelWorker(() => new FakeLevelWorker(), { dropPending: true });
    try {
      await randomRuns(20261015, 30, true);
      expect(FakeLevelWorker.requests().length).toBeGreaterThan(30);
    } finally {
      setLevelWorker("default", { dropPending: true });
      FakeLevelWorker.reset();
    }
  });
});
