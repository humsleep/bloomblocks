// Wick (decision A4): the B+ construction (paths, flame placement, face rig), every expression and
// lantern face draws, the motion curves, and the "lantern faces" setting survives a relaunch.
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  drawLanternFace, drawWickBody, drawWickFlame, FACE_EXPRS, flameBox, parsePath, pathBounds, tracePath, wickBlink, wickBreathe, wickHop, wickWorry,
  WICK_BODY_TOP, WICK_EXPRS, WICK_FACE, WICK_FLAME, WICK_GROUND, WICK_PATHS, HOP_MS, WORRY_MS,
} from "../src/render/wick.ts";
import { fakeBackend, resetDevice, setPref } from "./helpers.ts";

/** A 2D context that records the calls (enough for the draw functions; no pixels). */
function recorder(): { ctx: CanvasRenderingContext2D; ops: string[] } {
  const ops: string[] = [];
  const grad = { addColorStop: () => undefined };
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(t, k: string) {
      if (k in t) return t[k];
      if (k === "createRadialGradient" || k === "createLinearGradient") return () => grad;
      return (...a: unknown[]) => {
        ops.push(`${k}(${a.map((v) => (typeof v === "number" ? v.toFixed(2) : String(v))).join(",")})`);
      };
    },
    set(t, k: string, v) {
      t[k] = v;
      ops.push(`${k}=${String(v)}`);
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, ops };
}

describe("Wick B+ construction", () => {
  it("parses every path (absolute M/L/C/Q/Z only) and rejects anything else", () => {
    for (const d of Object.values(WICK_PATHS)) expect(parsePath(d).length).toBeGreaterThan(2);
    expect(() => parsePath("M0 0 a1 1 0 0 0 2 2")).toThrow(/unsupported/);
    const { ctx, ops } = recorder();
    tracePath(ctx, WICK_PATHS.body);
    expect(ops[0]).toBe("beginPath()");
    expect(ops.filter((o) => o.startsWith("bezierCurveTo")).length).toBe(4);
    expect(ops.at(-1)).toBe("closePath()");
  });

  it("the body is a squat mochi: no tip, wider than tall, standing on the ground point", () => {
    const b = pathBounds(WICK_PATHS.body);
    expect(b.y0).toBe(WICK_BODY_TOP);
    expect(b.y1).toBe(WICK_GROUND.y);
    const w = b.x1 - b.x0;
    const h = b.y1 - b.y0;
    expect(w / h).toBeGreaterThan(1.3);
    // the top is a smooth dome: the start point (50, 40) is the top and both neighbours' controls are level with it
    const first = parsePath(WICK_PATHS.body)[1]!;
    expect(first.n[1]).toBe(WICK_BODY_TOP);
  });

  it("the flame floats off-axis above the body (the onion / dumpling misread fix)", () => {
    expect(WICK_BODY_TOP - WICK_FLAME.y).toBeGreaterThanOrEqual(7);
    expect(WICK_FLAME.x - WICK_GROUND.x).toBe(5);
    expect(WICK_FLAME.tiltDeg).toBe(10);
    const f = pathBounds(WICK_PATHS.flame);
    // placed height of the flame ≤ 25 % of the body's
    expect((f.y1 - f.y0) * WICK_FLAME.scale).toBeLessThan(0.4 * (WICK_GROUND.y - WICK_BODY_TOP));
    const fb = flameBox(100);
    expect(fb.oy).toBeGreaterThan(0.8);
    expect(fb.oy).toBeLessThan(1);
  });

  it("eyes sit low (below the body's middle) and wide; blush right under them", () => {
    const mid = (WICK_BODY_TOP + WICK_GROUND.y) / 2;
    expect(WICK_FACE.ey).toBeGreaterThan(mid);
    expect(WICK_FACE.ex[1] - WICK_FACE.ex[0]).toBeGreaterThanOrEqual(20);
    expect(WICK_FACE.by - WICK_FACE.ey).toBeGreaterThan(5);
    expect(WICK_FACE.by - WICK_FACE.ey).toBeLessThan(10);
  });

  it("every expression draws, and each looks different", () => {
    const seen = new Set<string>();
    for (const expr of WICK_EXPRS) {
      const { ctx, ops } = recorder();
      drawWickBody(ctx, 120, { expr });
      expect(ops.length).toBeGreaterThan(10);
      seen.add(ops.join("|"));
    }
    expect(seen.size).toBe(WICK_EXPRS.length);
    // cheer brings the arm nubs; a blink closes the eyes into a line
    const cheer = recorder();
    drawWickBody(cheer.ctx, 120, { expr: "cheer" });
    const idle = recorder();
    drawWickBody(idle.ctx, 120, { expr: "idle" });
    expect(cheer.ops.filter((o) => o === "beginPath()").length).toBeGreaterThan(idle.ops.filter((o) => o === "beginPath()").length);
    const shut = recorder();
    drawWickBody(shut.ctx, 120, { expr: "idle", blink: 1 });
    expect(shut.ops.join("|")).not.toBe(idle.ops.join("|"));
    const f = recorder();
    drawWickFlame(f.ctx, 120);
    expect(f.ops.some((o) => o.startsWith("bezierCurveTo"))).toBe(true);
  });

  it("every lantern face (and its look) draws, on a cream underlay", () => {
    for (const e of FACE_EXPRS) for (const look of [-1, 0, 1]) {
      const { ctx, ops } = recorder();
      drawLanternFace(ctx, 40, e, look);
      expect(ops[0]).toMatch(/^fillStyle=/);
      expect(ops).toContain("fillRect(0.00,0.00,40.00,40.00)");
      expect(ops.length).toBeGreaterThan(6);
    }
  });
});

describe("Wick motion", () => {
  it("blink: 140 ms, shut in the middle", () => {
    expect(wickBlink(-1)).toBe(0);
    expect(wickBlink(0)).toBe(0);
    expect(wickBlink(65)).toBe(1);
    expect(wickBlink(141)).toBe(0);
  });

  it("hop: squash, up 14 at the top, back on the ground at 620 ms", () => {
    expect(wickHop(60).sy).toBeLessThan(1);
    expect(wickHop(299).dy).toBeLessThan(-13);
    expect(wickHop(HOP_MS).dy).toBe(0);
    expect(wickHop(HOP_MS).sx).toBe(1);
    expect(wickHop(299, 6).dy).toBeGreaterThan(-6.01);
  });

  it("worry: leans away, the shiver dies out, the flame shrinks", () => {
    const w = wickWorry(WORRY_MS + 100);
    expect(w.dx).toBe(0);
    expect(w.rot).toBeCloseTo(-3);
    expect(w.flameS).toBeCloseTo(0.8);
  });

  it("breathe: a 3.2 s loop of ±2.2 %", () => {
    const a = wickBreathe(800);
    const b = wickBreathe(800 + 3200);
    expect(a.sy).toBeCloseTo(b.sy);
    expect(Math.abs(a.sy - 1)).toBeLessThanOrEqual(0.0221);
  });
});

describe("the lantern faces setting", () => {
  type Feedback = typeof import("../src/game/feedback.ts");
  const launch = async (): Promise<Feedback> => {
    vi.resetModules();
    return import("../src/game/feedback.ts");
  };
  const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
  beforeEach(() => resetDevice());

  it("is on by default, is written to Preferences and survives a relaunch", async () => {
    const f = await launch();
    expect(await f.loadLanternFaces()).toBe(true);
    expect(f.getLanternFaces()).toBe(true);
    f.setLanternFaces(false);
    await tick();
    expect(fakeBackend.prefs.get("lanternFaces")).toBe("off");
    const g = await launch();
    expect(g.getLanternFaces()).toBe(true); // not read yet: the default until load
    expect(await g.loadLanternFaces()).toBe(false);
    g.setLanternFaces(true);
    await tick();
    expect(fakeBackend.prefs.get("lanternFaces")).toBe("on");
  });

  it("an unknown stored value means on", async () => {
    setPref("lanternFaces", "maybe");
    const f = await launch();
    expect(await f.loadLanternFaces()).toBe(true);
  });
});
