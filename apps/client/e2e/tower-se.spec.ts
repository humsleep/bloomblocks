// Lead decision (G1 #25 follow-up): the deduce tower is the track's door — on the smallest phone (iPhone SE)
// it is drawn under the top row's captions (never touching them) and it is tappable; no invisible tap target.
import { ALL_GUIDES, expect, test } from "./fixtures.ts";

const progress = (lv: number): string =>
  JSON.stringify({ v: 3, game: "pips", track: "gentle", gentle: { level: lv, cleared: lv - 1, hints: 0 }, deduce: { level: 1, cleared: 0, hints: 0 } });

test.describe("deduce tower entry on iPhone SE", () => {
  test.use({ viewport: { width: 375, height: 667 } });
  test("visible, clear of the captions, and a tap travels to deduce 1", async ({ app }) => {
    await app.seed({ files: { "pips-progress.json": progress(9) }, prefs: { guide: ALL_GUIDES } });
    await app.open();
    await app.waitIdle();
    const t = await app.eval(() => {
      const sc = window.__e2e.scene!["scenery"] as { farTower: { visible: boolean; x: number; y: number }; towerH: number; towerHidden: boolean };
      const top = (window.__e2e.scene!["topRowBottom"] as () => number).call(window.__e2e.scene);
      return { visible: sc.farTower.visible, hidden: sc.towerHidden, towerTop: sc.farTower.y - sc.towerH, captions: top, h: sc.towerH };
    });
    expect(t.visible && !t.hidden).toBe(true);
    expect(t.h).toBeGreaterThan(0);
    expect(t.towerTop).toBeGreaterThanOrEqual(t.captions);
    const far = await app.eval(() => window.__e2e.farPoint());
    expect(far.kind).toBe("tower");
    await app.tapPoint(far);
    await expect.poll(() => app.eval(() => window.__e2e.session!["track"]), { timeout: 15_000 }).toBe("deduce");
  });
});
