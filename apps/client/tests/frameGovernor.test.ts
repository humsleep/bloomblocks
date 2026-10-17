// Idle frame governor (src/game/frameGovernor.ts, playtest/perf/idle-governor.md): full rate around
// input / motion, 20 fps when only ambient() objects change, no frames while asleep; deltas stay exact.
import { describe, expect, it } from "vitest";
import { ambient, FrameGovernor, type GameLike, type Scheduler } from "../src/game/frameGovernor.ts";

/** A virtual 60 Hz display: rAF callbacks fire on vsync boundaries, timers at their due time. */
function fakeDisplay(): Scheduler & { t: number; run(ms: number): void } {
  let id = 0;
  const rafs = new Map<number, (t: number) => void>();
  const timers = new Map<number, { at: number; f: () => void }>();
  const VS = 1000 / 60;
  const d = {
    t: 0,
    now: () => d.t,
    raf: (f: (t: number) => void) => {
      rafs.set(++id, f);
      return id;
    },
    caf: (i: number) => void rafs.delete(i),
    setTimeout: (f: () => void, ms: number) => {
      timers.set(++id, { at: d.t + ms, f });
      return id;
    },
    clearTimeout: (i: number) => void timers.delete(i),
    run(ms: number) {
      const end = d.t + ms;
      while (d.t < end) {
        const next = Math.min(end, (Math.floor(d.t / VS + 1e-9) + 1) * VS);
        // timers due before the next vsync
        for (;;) {
          const due = [...timers.entries()].filter(([, x]) => x.at <= next).sort((a, b) => a[1].at - b[1].at)[0];
          if (!due) break;
          timers.delete(due[0]);
          d.t = Math.max(d.t, due[1].at);
          due[1].f();
        }
        d.t = next;
        if (Math.abs(next / VS - Math.round(next / VS)) < 1e-6) {
          const fs = [...rafs.values()];
          rafs.clear();
          for (const f of fs) f(d.t);
        }
      }
    },
  };
  return d;
}

function fakeGame(): { game: GameLike; steps: Array<{ t: number; d: number }>; obj: { x: number; y: number; alpha: number; visible: boolean }; amb: { x: number; visible: boolean; alpha: number }; clock: { now: number } } {
  const steps: Array<{ t: number; d: number }> = [];
  const obj = { x: 10, y: 10, alpha: 1, visible: true };
  const amb = ambient({ x: 0, visible: true, alpha: 1 });
  const clock = { now: 0 };
  const loop = {
    running: true,
    now: 0,
    time: 0,
    lastTime: 0,
    rawDelta: 0,
    delta: 0,
    frame: 0,
    callback: (t: number, d: number) => {
      clock.now = t;
      steps.push({ t, d });
      amb.x += 1; // ambient flicker changes every step
    },
    sleep() {
      loop.running = false;
    },
    wake() {
      loop.running = true;
    },
    // Phaser's TimeStep.step without smoothing (enough here)
    step(t: number) {
      const d = Math.max(0, t - loop.lastTime);
      loop.lastTime = t;
      loop.frame++;
      loop.callback(t, d);
    },
  };
  const scene = { sys: { settings: { visible: true, status: 5 }, displayList: { list: [obj, amb] }, time: clock } };
  return { game: { loop, scene: { scenes: [scene] } }, steps, obj, amb, clock };
}

const rate = (steps: Array<{ t: number }>, from: number, to: number): number => steps.filter((s) => s.t > from && s.t <= to).length / ((to - from) / 1000);

describe("FrameGovernor", () => {
  it("drops to the ambient rate when only ambient objects change, and a tap wakes it on the next vsync", () => {
    const d = fakeDisplay();
    const { game, steps, clock } = fakeGame();
    const gov = new FrameGovernor(20, 1500);
    gov.install(game, { listen: false, scheduler: d });
    d.run(1000);
    expect(rate(steps, 0, 1000)).toBeGreaterThan(55); // boot grace: full rate
    d.run(3000); // 4 s
    expect(gov.state().mode).toBe("ambient");
    expect(rate(steps, 2000, 4000)).toBeGreaterThanOrEqual(19);
    expect(rate(steps, 2000, 4000)).toBeLessThanOrEqual(21);
    // a tap between ambient steps: the next vsync is a step, the scene clock is caught up first
    d.run(10);
    const before = steps.length;
    const tapAt = d.t;
    gov.wake();
    expect(clock.now).toBeGreaterThanOrEqual(tapAt - 1000 / 60 - 1e-6);
    d.run(1000 / 60 + 0.01);
    expect(steps.length).toBe(before + 1);
    expect(steps.at(-1)!.t - tapAt).toBeLessThanOrEqual(1000 / 60 + 0.01);
    expect(gov.state().mode).toBe("full");
    d.run(1000);
    expect(rate(steps, tapAt + 100, tapAt + 1000)).toBeGreaterThan(55);
    d.run(2000);
    expect(gov.state().mode).toBe("ambient");
  });

  it("real motion (a non-ambient object moving) keeps full rate; it settles back afterwards", () => {
    const d = fakeDisplay();
    const { game, steps, obj } = fakeGame();
    const gov = new FrameGovernor(20, 1500);
    gov.install(game, { listen: false, scheduler: d });
    d.run(3000);
    expect(gov.state().mode).toBe("ambient");
    // something starts moving on its own (no input): caught at the next ambient step
    const t0 = d.t;
    const moveUntil = t0 + 1000;
    const origCb = game.loop.callback;
    game.loop.callback = (t, dt) => {
      if (t < moveUntil) obj.x += 3;
      origCb(t, dt);
    };
    d.run(1000);
    expect(rate(steps, t0 + 100, t0 + 1000)).toBeGreaterThan(55);
    d.run(3000);
    expect(gov.state().mode).toBe("ambient");
  });

  it("deltas add up to the elapsed time across full / ambient / wake", () => {
    const d = fakeDisplay();
    const { game, steps } = fakeGame();
    const gov = new FrameGovernor(20, 1500);
    gov.install(game, { listen: false, scheduler: d });
    d.run(4000);
    gov.wake();
    d.run(2500);
    gov.keepAwake(300);
    d.run(3500);
    const sum = steps.reduce((a, s) => a + s.d, 0);
    expect(Math.abs(sum - steps.at(-1)!.t)).toBeLessThan(1000 / 60 + 1);
  });

  it("asleep: no frames at all; resume counts the gap as one capped frame", () => {
    const d = fakeDisplay();
    const { game, steps } = fakeGame();
    const gov = new FrameGovernor(20, 1500);
    gov.install(game, { listen: false, scheduler: d });
    d.run(3000);
    gov.sleep("ad");
    gov.sleep("app");
    const n = steps.length;
    d.run(5000);
    expect(steps.length).toBe(n);
    expect(gov.state().mode).toBe("asleep");
    gov.resume("ad");
    d.run(500);
    expect(steps.length).toBe(n); // still "app"
    gov.resume("app");
    d.run(1000 / 60 + 0.01);
    expect(steps.length).toBe(n + 1);
    expect(steps.at(-1)!.d).toBeLessThanOrEqual(1000 / 60 + 1e-6);
    expect(gov.state().mode).toBe("full");
  });

  it("force(true) pins full rate (tests), force(null) returns to normal", () => {
    const d = fakeDisplay();
    const { game, steps } = fakeGame();
    const gov = new FrameGovernor(20, 1500);
    gov.install(game, { listen: false, scheduler: d });
    gov.force(true);
    d.run(5000);
    expect(rate(steps, 3000, 5000)).toBeGreaterThan(55);
    gov.force(null);
    d.run(3000);
    expect(gov.state().mode).toBe("ambient");
  });
});
