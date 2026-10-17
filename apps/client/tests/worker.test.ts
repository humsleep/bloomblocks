// PERF-1 (client side): the next level is generated in the worker as soon as the current one
// loads; a slow worker never makes the session generate on the main thread (no time cap —
// the scene waits on nextLevelReady); a crashed worker is restarted; only with no worker at
// all does the main thread generate, and then in a task of its own.
// Main-thread generation is counted by wrapping pipsApi's generators (the fake worker
// generates through @games directly, so it is not counted).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedKeyFor } from "../src/game/levelIds.ts";
import { levelForTrack } from "@games/lanterns-pips/tracks.ts"; // expectations: not counted as main-thread generation
import { isFinale, solutionOf } from "../src/game/pipsApi.ts";
import {
  firstPaintDone, levelWorkerConfig, levelWorkerStarted, markFirstPaint, resetClock, type Session, Session as SessionClass, setBeforeFirstPaint, setClock,
  setLevelWorker,
} from "../src/game/session.ts";
import { FakeLevelWorker } from "./fakes/levelWorker.ts";
import { cellsOf, readFile, resetDevice, settle, writeFile } from "./helpers.ts";

const mainGen = vi.hoisted(() => ({ calls: [] as string[] }));
vi.mock("../src/game/pipsApi.ts", async (importOriginal) => {
  const m = await importOriginal<typeof import("../src/game/pipsApi.ts")>();
  return {
    ...m,
    levelForTrack: (t: Parameters<typeof m.levelForTrack>[0], n: number) => {
      mainGen.calls.push(`${t}:${n}`);
      return m.levelForTrack(t, n);
    },
    levelForDaily: (d: string) => {
      mainGen.calls.push(`daily:${d}`);
      return m.levelForDaily(d);
    },
  };
});

const TODAY = "2026-10-14";
/** Let promise chains (worker reply → session) run. */
const ticks = async (n = 20): Promise<void> => {
  for (let i = 0; i < n; i++) await Promise.resolve();
};
const solve = (s: Session): void => {
  for (const c of cellsOf(solutionOf(s.level)!)) s.tap(c & 7, c >> 3);
};

async function launch(): Promise<Session> {
  const s = await SessionClass.restore();
  await settle();
  return s;
}

beforeEach(() => {
  resetDevice();
  FakeLevelWorker.reset();
  mainGen.calls.length = 0;
  setLevelWorker(() => new FakeLevelWorker(), { dropPending: true });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${TODAY}T10:00:00`));
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(async () => {
  await settle();
  setLevelWorker("default", { dropPending: true }); // node: no Worker → main thread, as the other suites expect
  vi.useRealTimers();
});

describe("pregeneration starts when a level loads", () => {
  it("launch posts the next level to the worker before any tap; status generating → ready", async () => {
    const s = await launch();
    expect(FakeLevelWorker.requests()).toEqual(["gentle:2"]);
    expect(s.nextReady).toBe(false);
    expect(s.nextLevelStatus).toBe("generating");
    FakeLevelWorker.current.respond();
    await ticks();
    expect(s.nextReady).toBe(true);
    expect(s.nextLevelStatus).toBe("ready");
    await s.nextLevelReady; // resolves at once now
    // the level arrived before completion: level end writes its cache, advance is instant
    solve(s);
    await settle();
    expect(JSON.parse(readFile("pips-gentle-level.json")!).seedKey).toBe(seedKeyFor("gentle", 2));
    s.advance();
    expect(s.levelNumber).toBe(2);
    // and level 3 is requested the moment level 2 is in
    expect(FakeLevelWorker.requests()).toEqual(["gentle:2", "gentle:3"]);
    expect(mainGen.calls).toEqual(["gentle:1"]); // only the cold-start level, on launch
  });

  it("prefetchNext / whenNextReady are idempotent (one request per level)", async () => {
    const s = await launch();
    s.prefetchNext();
    s.prefetchNext();
    void s.whenNextReady();
    void s.nextLevelReady;
    expect(FakeLevelWorker.requests()).toEqual(["gentle:2"]);
  });

  it("switching track (cache miss) generates the other track's level in the worker, then its next one", async () => {
    const s = await launch();
    let done = false;
    const sw = s.switchTrack().then(() => (done = true));
    await ticks();
    expect(done).toBe(false);
    expect(s.track).toBe("gentle"); // still on gentle while the worker works
    expect(FakeLevelWorker.requests()).toContain("deduce:1");
    FakeLevelWorker.current.respond("deduce:1");
    await sw;
    expect(s.track).toBe("deduce");
    expect(s.level).toEqual(levelForTrack("deduce", 1));
    expect(FakeLevelWorker.requests()).toContain("deduce:2");
    expect(mainGen.calls).toEqual(["gentle:1"]);
  });

  it("today's daily (cache miss) comes from the worker", async () => {
    const s = await launch();
    const open = s.openDaily(TODAY, false);
    await ticks();
    expect(FakeLevelWorker.requests()).toContain(`daily:${TODAY}`);
    FakeLevelWorker.current.respond(`daily:${TODAY}`);
    await open;
    expect(s.daily).toBe(TODAY);
    expect(mainGen.calls.filter((c) => c.startsWith("daily"))).toEqual([]);
    expect(s.nextReady).toBe(true); // nothing to wait for on the daily
  });

  it("relaunch onto a finale level with no cache: generated in the worker, not on the main thread", async () => {
    let n = 2;
    while (!isFinale("gentle", n)) n++;
    writeFile("pips-progress.json", JSON.stringify({ v: 3, game: "pips", track: "gentle", gentle: { level: n, cleared: n - 1, hints: 0 }, deduce: { level: 1, cleared: 0, hints: 0 } }));
    const p = SessionClass.restore();
    await vi.waitFor(() => expect(FakeLevelWorker.requests()).toContain(`gentle:${n}`));
    FakeLevelWorker.current.respond(`gentle:${n}`);
    const s = await p;
    expect(s.levelNumber).toBe(n);
    expect(mainGen.calls).toEqual([]);
  });
});

describe("a slow worker never moves generation onto the main thread", () => {
  it("a slow but alive worker (reply after 11 s, under the 12 s watchdog): the finale just waits, nothing generated here", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    vi.setSystemTime(new Date(`${TODAY}T10:00:00`));
    const s = await launch();
    solve(s);
    expect(s.complete).toBe(true);
    let ready = false;
    void s.nextLevelReady.then(() => (ready = true));
    await vi.advanceTimersByTimeAsync(11_000);
    expect(ready).toBe(false);
    expect(s.nextLevelStatus).toBe("generating");
    expect(FakeLevelWorker.all).toHaveLength(1); // not restarted
    expect(mainGen.calls).toEqual(["gentle:1"]);
    FakeLevelWorker.current.respond("gentle:2");
    await vi.advanceTimersByTimeAsync(0);
    expect(ready).toBe(true);
    await settle();
    expect(JSON.parse(readFile("pips-gentle-level.json")!).seedKey).toBe(seedKeyFor("gentle", 2)); // late level → cache
    s.advance();
    expect(s.level).toEqual(levelForTrack("gentle", 2));
    expect(mainGen.calls).toEqual(["gentle:1"]);
    await vi.advanceTimersByTimeAsync(60_000); // gentle 3 is outstanding now: its own deadline
    expect(FakeLevelWorker.all.length).toBeGreaterThan(1);
  });

  it("the deadline runs from the last reply: a worker that keeps answering is never killed", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    const s = await launch(); // gentle:2 outstanding
    const open = s.openDaily(TODAY, false); // + the daily (urgent, same worker)
    await vi.advanceTimersByTimeAsync(8_000);
    FakeLevelWorker.current.respond(`daily:${TODAY}`);
    await open;
    await vi.advanceTimersByTimeAsync(8_000); // 16 s after the first post, 8 s after the last reply
    FakeLevelWorker.current.respond("gentle:2");
    await vi.advanceTimersByTimeAsync(0);
    expect(FakeLevelWorker.all).toHaveLength(1);
    await s.leaveDaily();
    expect(s.nextReady).toBe(true);
  });
  it("a crashed worker is restarted and the request re-posted", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const s = await launch();
    const first = FakeLevelWorker.current;
    first.crash();
    expect(first.terminated).toBe(true);
    expect(FakeLevelWorker.all).toHaveLength(2);
    expect(FakeLevelWorker.current.posted.map((r) => `${r.track}:${r.n}`)).toEqual(["gentle:2"]);
    FakeLevelWorker.current.respond();
    await s.nextLevelReady;
    expect(s.nextReady).toBe(true);
    expect(mainGen.calls).toEqual(["gentle:1"]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("level worker failed"), "worker crashed");
  });

  it("a worker that keeps crashing: after the restarts the main thread generates — in a task of its own", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const s = await launch();
    for (let k = 0; k < 3; k++) FakeLevelWorker.current.crash();
    expect(FakeLevelWorker.all).toHaveLength(3); // 1 + 2 restarts
    expect(mainGen.calls).toEqual(["gentle:1"]); // not inside the crash handler's frame
    await s.nextLevelReady;
    expect(mainGen.calls).toEqual(["gentle:1", "gentle:2"]);
    expect(s.nextReady).toBe(true);
  });

  it("the generator failing in the worker falls back to the main thread once", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const s = await launch();
    FakeLevelWorker.current.respondError("gentle:2");
    await s.nextLevelReady;
    expect(s.nextReady).toBe(true);
    expect(mainGen.calls).toEqual(["gentle:1", "gentle:2"]);
  });

  it("no worker at all: whenNextReady resolves only once the level exists (never a hold loop)", async () => {
    setLevelWorker(null);
    const s = await launch();
    expect(s.nextLevelStatus).toBe("idle"); // lazy without a worker (node, tests)
    solve(s);
    const p = s.whenNextReady();
    expect(mainGen.calls).toEqual(["gentle:1"]); // not synchronously inside the call
    await p;
    expect(s.nextReady).toBe(true);
    expect(mainGen.calls).toEqual(["gentle:1", "gentle:2"]);
  });
});

describe("watchdog: a worker that never replies", () => {
  it("is terminated and restarted after 12 s (counts as a crash); after 2 restarts the main thread generates in its own task", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const s = await launch(); // the fake never answers unless told to
    let ready = false;
    void s.nextLevelReady.then(() => (ready = true));
    await vi.advanceTimersByTimeAsync(11_999);
    expect(FakeLevelWorker.all).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(FakeLevelWorker.all[0]!.terminated).toBe(true);
    expect(FakeLevelWorker.all).toHaveLength(2);
    expect(FakeLevelWorker.current.posted.map((r) => `${r.track}:${r.n}`)).toEqual(["gentle:2"]); // re-posted
    expect(warn).toHaveBeenCalledWith("[session] level worker failed (1/3)", "no reply in 12000 ms");
    await vi.advanceTimersByTimeAsync(12_000); // restart 2
    expect(FakeLevelWorker.all).toHaveLength(3);
    expect(mainGen.calls).toEqual(["gentle:1"]);
    await vi.advanceTimersByTimeAsync(12_000); // third silence: no more workers
    expect(FakeLevelWorker.all).toHaveLength(3);
    expect(FakeLevelWorker.all.every((w) => w.terminated)).toBe(true);
    expect(mainGen.calls).toEqual(["gentle:1"]); // not inside the watchdog's own callback…
    await vi.advanceTimersByTimeAsync(1); // …but in a task of its own (a 0 ms timeout set during a fake tick runs 1 ms later)
    expect(mainGen.calls).toEqual(["gentle:1", "gentle:2"]);
    expect(ready).toBe(true);
    expect(s.nextReady).toBe(true);
    // a level that arrives from a terminated worker later is ignored
    expect(() => FakeLevelWorker.all[0]!.respond()).not.toThrow();
  });

  it("the bound is levelWorkerConfig.timeoutMs on the injected clock (no real waiting, no fake timers)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const timers: Array<{ ms: number; f: () => void; live: boolean }> = [];
    setClock({
      after: (ms, f) => {
        const t = { ms, f: () => ((t.live = false), f()), live: true };
        timers.push(t);
        return () => (t.live = false);
      },
    });
    const prev = levelWorkerConfig.timeoutMs;
    levelWorkerConfig.timeoutMs = 3_000;
    try {
      await launch();
      const live = timers.filter((t) => t.live);
      expect(live.map((t) => t.ms)).toEqual([3_000]);
      live[0]!.f(); // the deadline passes
      expect(FakeLevelWorker.all).toHaveLength(2);
      FakeLevelWorker.current.respond(); // the fresh worker answers: its deadline is cancelled
      await ticks();
      expect(timers.filter((t) => t.live)).toEqual([]);
    } finally {
      levelWorkerConfig.timeoutMs = prev;
      resetClock();
    }
  });
});

describe("the worker is created after the first paint (cold start)", () => {
  afterEach(() => {
    setBeforeFirstPaint(false);
    vi.unstubAllGlobals();
  });

  it("launch before the first paint creates no worker; markFirstPaint() starts it with the held prefetch", async () => {
    setBeforeFirstPaint(true);
    const s = await launch();
    expect(levelWorkerStarted()).toBe(false);
    expect(FakeLevelWorker.all).toHaveLength(0);
    expect(s.nextLevelStatus).toBe("generating"); // asked for, waiting for the paint
    expect(mainGen.calls).toEqual(["gentle:1"]);
    markFirstPaint();
    expect(levelWorkerStarted()).toBe(true);
    expect(FakeLevelWorker.requests()).toEqual(["gentle:2"]);
    FakeLevelWorker.current.respond();
    await s.nextLevelReady;
    markFirstPaint(); // idempotent
    expect(FakeLevelWorker.all).toHaveLength(1);
  });

  it("a level needed for the launch itself (finale / daily, no cache) is made on the main thread, never waiting for a paint", async () => {
    setBeforeFirstPaint(true);
    let n = 2;
    while (!isFinale("gentle", n)) n++;
    writeFile("pips-progress.json", JSON.stringify({ v: 3, game: "pips", track: "gentle", gentle: { level: n, cleared: n - 1, hints: 0 }, deduce: { level: 1, cleared: 0, hints: 0 }, daily: TODAY }));
    const s = await launch(); // the daily of today, its level not cached
    expect(s.daily).toBe(TODAY);
    expect(FakeLevelWorker.all).toHaveLength(0);
    expect(mainGen.calls).toEqual([`daily:${TODAY}`]);
  });

  it("fallback watcher: the game canvas exists + two animation frames → the worker starts (not before)", async () => {
    const frames: Array<() => void> = [];
    let canvas: object | null = null;
    vi.stubGlobal("requestAnimationFrame", (f: () => void) => frames.push(f));
    vi.stubGlobal("document", { querySelector: () => canvas });
    const frame = (): void => {
      const run = frames.splice(0);
      for (const f of run) f();
    };
    setBeforeFirstPaint(true);
    await launch();
    frame();
    frame();
    frame(); // no canvas yet: still waiting
    expect(levelWorkerStarted()).toBe(false);
    canvas = {};
    frame(); // canvas seen
    frame(); // first frame after it
    expect(levelWorkerStarted()).toBe(false);
    frame(); // second: the board has been presented
    expect(firstPaintDone()).toBe(true);
    expect(levelWorkerStarted()).toBe(true);
    expect(FakeLevelWorker.requests()).toEqual(["gentle:2"]);
  });

  it("fallback watcher gives up waiting after firstPaintMaxMs", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.stubGlobal("requestAnimationFrame", () => 0); // frames never run (hidden page)
    setBeforeFirstPaint(true);
    await launch();
    await vi.advanceTimersByTimeAsync(levelWorkerConfig.firstPaintMaxMs - 1);
    expect(levelWorkerStarted()).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(levelWorkerStarted()).toBe(true);
  });
});
