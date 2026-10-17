import { expect, test } from "./fixtures.ts";

test.describe("boot", () => {
  test("plain `vite` dev server boots the real shell (real @capacitor web plugins, no errors)", async ({ app, page }) => {
    // the bug this guards: Vite pre-bundled phaser-core without the feature-flag transform,
    // so the WebGL debug branch required `phaser3spectorjs` and the page died on load
    await page.goto("http://localhost:5199/");
    await expect(page.locator("#app canvas")).toHaveCount(1, { timeout: 30_000 });
    await expect.poll(() => app.log.some((l) => l.includes("[boot] level 1")), { timeout: 30_000 }).toBe(true);
    await expect.poll(() => app.log.some((l) => l.includes("[boot] decorate")), { timeout: 30_000 }).toBe(true);
  });

  test("e2e build: cold launch on an empty device lands on gentle 1 with a fresh save", async ({ app }) => {
    await app.seed();
    await app.open();
    const s = await app.eval(() => {
      const s = window.__e2e.session!;
      return { track: s["track"], n: s["levelNumber"], daily: s["daily"], moves: s["moves"].length, info: s["restoreInfo"] };
    });
    expect(s).toEqual({ track: "gentle", n: 1, daily: null, moves: 0, info: "fresh (level generated)" });
    // progress written on first launch, journal header + level cache in place
    await expect.poll(() => app.progress()).toMatchObject({ v: 3, game: "pips", track: "gentle", gentle: { level: 1, cleared: 0 } });
    await expect.poll(() => app.file("pips-gentle-journal.log")).toMatch(/^PPJ1 00000001 lanterns-pips:gentle:g\d+:1\n$/);
    await expect.poll(() => app.file("pips-gentle-level.json")).toContain('"seedKey":"lanterns-pips:gentle:');
  });
});

// playtest/perf/idle-governor.md: nothing moves → 20 fps (only ambient flicker); a tap → full rate
// from the next vsync, and the tap's own animation is drawn right away.
test.describe("idle frame governor", () => {
  test("idle drops the canvas to the ambient rate; a tap wakes it to full rate at once", async ({ app }) => {
    const prog = JSON.stringify({ v: 3, game: "pips", track: "gentle", gentle: { level: 14, cleared: 13, hints: 0 }, deduce: { level: 3, cleared: 2, hints: 0 } });
    await app.seed({ now: "2026-10-14T10:00:00", files: { "pips-progress.json": prog }, prefs: { guide: "255" } });
    await app.open();
    await app.waitIdle();
    const gov = () => app.eval(() => window.__e2e.app!.governor.state());
    await expect.poll(async () => (await gov()).installed).toBe(true);
    await expect.poll(async () => (await gov()).mode, { timeout: 15_000 }).toBe("ambient");
    // the display's own rate (Playwright's WebKit runs rAF at ~30 Hz, Chromium at 60)
    const vsync = await app.eval(
      () =>
        new Promise<number>((res) => {
          let n = 0;
          const t = performance.now();
          const f = (): void => {
            n++;
            if (performance.now() - t < 1000) requestAnimationFrame(f);
            else res(n);
          };
          requestAnimationFrame(f);
        }),
    );
    // count real canvas repaints over one second of idle
    const idleRenders = await app.eval(async () => {
      const g = window.__e2e.game!;
      let n = 0;
      const f = (): void => void n++;
      g["events"].on("postrender", f);
      await new Promise((r) => setTimeout(r, 1000));
      g["events"].off("postrender", f);
      return n;
    });
    // 20 fps (15 at a 30 Hz display): well under the display's rate, still alive
    expect(idleRenders).toBeGreaterThanOrEqual(10);
    expect(idleRenders).toBeLessThanOrEqual(Math.min(26, vsync * 0.75));
    // a real tap on an empty cell: a render follows within ~2 vsyncs of the pointerdown
    const sol = await app.solution();
    await app.eval(() => {
      const g = window.__e2e.game!;
      const w = window as unknown as { __tapR: { down: number; render: number } };
      w.__tapR = { down: 0, render: 0 };
      window.addEventListener("pointerdown", () => (w.__tapR.down = performance.now()), { capture: true, once: true });
      g["events"].on("postrender", () => {
        if (w.__tapR.down && !w.__tapR.render) w.__tapR.render = performance.now();
      });
    });
    await app.tapCell(sol[0]!);
    expect((await gov()).mode).toBe("full");
    await expect.poll(() => app.eval(() => (window as unknown as { __tapR: { render: number } }).__tapR.render > 0)).toBe(true);
    const lat = await app.eval(() => {
      const r = (window as unknown as { __tapR: { down: number; render: number } }).__tapR;
      return r.render - r.down;
    });
    // pointerdown → next canvas render within ~2 vsyncs (was up to 50 ms + a vsync at the ambient rate)
    expect(lat).toBeLessThan(Math.max(50, 2.5 * (1000 / vsync)));
    // full rate for the whole last second (the grace after a tap is 1.5 s)
    await app.page.waitForTimeout(1100);
    expect((await gov()).fps).toBeGreaterThanOrEqual(vsync * 0.8);
  });
});
