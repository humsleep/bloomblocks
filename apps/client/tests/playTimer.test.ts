// Review P2: playSeconds for the ads pacing counted wall-clock time since the last layout
// (background time and menus included; a relayout reset it). PlayTimer counts foreground
// on-board frames only, each capped, per level.
import { describe, expect, it } from "vitest";
import { MAX_STEP_MS, PlayTimer } from "../src/game/playTimer.ts";

describe("PlayTimer (ads playSeconds)", () => {
  it("counts only active frames; the frame after a 10-minute background counts at most MAX_STEP_MS", () => {
    const t = new PlayTimer();
    for (let i = 0; i < 600; i++) t.tick("g1", 1000 / 60, true); // 10 s of play
    t.tick("g1", 600_000, true); // first frame back from the background (Phaser delta)
    expect(t.seconds()).toBe(Math.round((10_000 + MAX_STEP_MS) / 1000));
    for (let i = 0; i < 600; i++) t.tick("g1", 1000 / 60, false); // 10 s in the town / settings
    expect(t.seconds()).toBe(10);
  });

  it("a new level starts from 0; the same level (relayout) keeps its time", () => {
    const t = new PlayTimer();
    for (let i = 0; i < 300; i++) t.tick("g1", 20, true);
    expect(t.seconds()).toBe(6);
    t.tick("g1", 0, true);
    expect(t.seconds()).toBe(6);
    t.tick("g2", 20, true);
    expect(t.seconds()).toBe(0);
  });
});
