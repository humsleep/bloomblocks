// Settings persistence (Preferences: muted, numbers, shareTime, haptics on/off) and the
// first-run guide bits. Each "relaunch" re-imports feedback.ts fresh (module state reset)
// against the same fake device.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBackend, resetDevice, setPref } from "./helpers.ts";

type Feedback = typeof import("../src/game/feedback.ts");
const launch = async (): Promise<Feedback> => {
  vi.resetModules();
  return import("../src/game/feedback.ts");
};
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

beforeEach(() => resetDevice());

describe("settings", () => {
  it("defaults on a fresh device: sound on, digits, time in share on", async () => {
    const f = await launch();
    f.startAudio();
    expect(await f.loadNumberStyle()).toBe("digits");
    expect(await f.loadShareTime()).toBe(true);
    await tick();
    expect(f.isMuted()).toBe(false);
  });

  it("every toggle is written to Preferences and survives a relaunch", async () => {
    const f = await launch();
    expect(f.toggleMuted()).toBe(true);
    f.setNumberStyle("dots");
    f.setShareTime(false);
    await tick();
    expect(Object.fromEntries(fakeBackend.prefs)).toMatchObject({ muted: "1", numbers: "dots", shareTime: "0" });
    const g = await launch();
    g.startAudio();
    expect(await g.loadNumberStyle()).toBe("dots");
    expect(g.getNumberStyle()).toBe("dots");
    expect(await g.loadShareTime()).toBe(false);
    expect(g.getShareTime()).toBe(false);
    await tick();
    expect(g.isMuted()).toBe(true);
    // and back
    expect(g.toggleMuted()).toBe(false);
    g.setNumberStyle("digits");
    g.setShareTime(true);
    await tick();
    expect(Object.fromEntries(fakeBackend.prefs)).toMatchObject({ muted: "0", numbers: "digits", shareTime: "1" });
  });

  it("unknown stored values fall back to the defaults", async () => {
    setPref("numbers", "roman");
    setPref("shareTime", "maybe");
    const f = await launch();
    expect(await f.loadNumberStyle()).toBe("digits");
    expect(await f.loadShareTime()).toBe(true);
  });

  it("haptics follow the haptics switch", async () => {
    const f = await launch();
    f.haptic.place();
    f.haptic.completeHit();
    f.haptic.success();
    await tick();
    expect(fakeBackend.haptics).toEqual(["impact:LIGHT", "impact:MEDIUM", "notification:SUCCESS"]);
    f.setHapticsEnabled(false);
    f.haptic.place();
    f.haptic.remove();
    f.haptic.invalid();
    await new Promise((r) => setTimeout(r, 60));
    expect(fakeBackend.haptics).toHaveLength(3);
  });

  it("ambient bed by level", async () => {
    const f = await launch();
    expect(() => [1, 4, 5, 14, 15, 200].forEach((n) => f.ambientForLevel(n))).not.toThrow();
  });
});

describe("guide bits", () => {
  it("bits: goal 16, tap 1, digit 2, conflict 4, track 8, peek 32, tower 64, moon 128, v11 tutorial 256", async () => {
    const f = await launch();
    expect(f.GUIDE).toEqual({ tap: 1, digit: 2, conflict: 4, track: 8, goal: 16, peek: 32, tower: 64, moon: 128, tutorial: 256 });
  });

  it("markGuide sets a bit once, persists it, and a relaunch reads it back", async () => {
    const f = await launch();
    expect(await f.loadGuide()).toBe(0);
    f.markGuide(f.GUIDE.goal);
    f.markGuide(f.GUIDE.tap);
    f.markGuide(f.GUIDE.tap);
    await tick();
    expect(fakeBackend.prefs.get("guide")).toBe("17");
    const g = await launch();
    expect(await g.loadGuide()).toBe(17);
    expect(g.guideDone(g.GUIDE.goal)).toBe(true);
    expect(g.guideDone(g.GUIDE.tap)).toBe(true);
    expect(g.guideDone(g.GUIDE.digit)).toBe(false);
  });

  it("garbage in the guide pref means 'nothing seen yet'", async () => {
    setPref("guide", "abc");
    const f = await launch();
    expect(await f.loadGuide()).toBe(0);
    expect(f.guideDone(f.GUIDE.goal)).toBe(false);
  });

  it("all lessons done = 511 (e2e ALL_GUIDES = 255 skips the v11 tutorial too: it carries the goal bit)", async () => {
    const f = await launch();
    for (const b of Object.values(f.GUIDE)) f.markGuide(b);
    await tick();
    expect(fakeBackend.prefs.get("guide")).toBe("511");
  });
});
