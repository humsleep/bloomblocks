// src/testing/bridge.ts (window.__test, DEV / e2e only). The production bundles must not
// contain it — checked by building m1 into a scratch dir and grepping:
//   npx vite build --mode m1 --outDir <tmp> && grep -rl "__test\|attachSession" <tmp>   → nothing
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attach, attachSession, bridge, slowWorker } from "../src/testing/bridge.ts";
import { localDateISO, resetClock, Session, setLevelWorker } from "../src/game/session.ts";
import { FakeLevelWorker } from "./fakes/levelWorker.ts";
import { resetDevice, settle } from "./helpers.ts";

beforeEach(() => {
  resetDevice();
  FakeLevelWorker.reset();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});
afterEach(async () => {
  await settle();
  resetClock();
  setLevelWorker("default", { dropPending: true });
  vi.useRealTimers();
});

describe("window.__test", () => {
  it("is one object on globalThis; attach / attachSession fill it", async () => {
    const b = bridge();
    expect((globalThis as { __test?: unknown }).__test).toBe(b);
    const s = await Session.restore();
    attachSession(s);
    attach({ game: "g", scene: "s" });
    expect(bridge()).toMatchObject({ session: s, game: "g", scene: "s" });
    attach({ scene: "t" });
    expect(bridge()).toMatchObject({ game: "g", scene: "t" });
  });

  it("clock.set moves the app's date (localDateISO, the daily) without touching Date", () => {
    const b = bridge();
    b.clock.set("2027-01-01T00:00:10");
    expect(localDateISO()).toBe("2027-01-01");
    expect(b.clock.today()).toBe("2027-01-01");
    expect(new Date().getFullYear()).not.toBe(2027);
    b.clock.set(null);
    expect(localDateISO()).toBe(localDateISO(new Date()));
  });

  it("slowWorker delays every reply by the given time", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    setLevelWorker(slowWorker(() => new FakeLevelWorker(), 5000), { dropPending: true });
    const s = await Session.restore();
    expect(FakeLevelWorker.requests()).toEqual(["gentle:2"]);
    FakeLevelWorker.current.respond();
    await vi.advanceTimersByTimeAsync(4900);
    expect(s.nextReady).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    expect(s.nextReady).toBe(true);
  });

  it("worker.none / available", () => {
    const b = bridge();
    setLevelWorker(() => new FakeLevelWorker());
    expect(b.worker.available()).toBe(true);
    b.worker.none();
    expect(b.worker.available()).toBe(false);
  });
});
