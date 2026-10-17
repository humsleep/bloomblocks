// Phase 5 screenshots → playtest/shots/v10/ (web build, Capacitor fakes). Opt-in:
//   SHOTS_V10=1 npx playwright test --project=chromium e2e/shots.spec.ts
import { fileURLToPath } from "node:url";
import { ALL_GUIDES, type App, expect, test } from "./fixtures.ts";

const OUT = fileURLToPath(new URL("../../../playtest/shots/v10/", import.meta.url));
test.skip(!process.env["SHOTS_V10"], "screenshots only on request (SHOTS_V10=1)");

const progress = (gentleLevel: number, track = "gentle"): string =>
  JSON.stringify({ v: 3, game: "pips", track, gentle: { level: gentleLevel, cleared: gentleLevel - 1, hints: 0 }, deduce: { level: 3, cleared: 2, hints: 0 } });
const log = (dates: string[]): string => JSON.stringify({ v: 1, days: Object.fromEntries(dates.map((d) => [d, { at: 0, ms: 90_000, hints: 0, undos: 0 }])) });
const streak = (last: string, n: number): string => JSON.stringify({ v: 1, last, streak: n, best: n, shields: {} });
const shot = (app: App, name: string): Promise<Buffer> => app.page.screenshot({ path: `${OUT}${name}.png` });

async function openDaily(app: App): Promise<void> {
  await app.waitIdle();
  await app.tapPoint(await app.eval(() => window.__e2e.moonPoint()));
  await expect.poll(() => app.eval(() => !!window.__e2e.session!["daily"])).toBe(true);
  await app.waitIdle();
}
async function solveDaily(app: App): Promise<void> {
  await app.solve();
  await expect.poll(() => app.eval(() => !!window.__e2e.scene!["card"]?.isOpen), { timeout: 20_000 }).toBe(true);
  await app.page.waitForTimeout(1000);
}

for (const size of [{ tag: "pm", w: 390, h: 844 }, { tag: "se", w: 375, h: 667 }]) {
  test.describe(size.tag, () => {
    test.use({ viewport: { width: size.w, height: size.h } });

    test("alley strip + tower floors + daily HUD", async ({ app }) => {
      await app.seed({ now: "2026-10-14T19:00:00", files: { "pips-progress.json": progress(14) }, prefs: { guide: ALL_GUIDES } });
      await app.open();
      await app.waitIdle();
      await app.page.waitForTimeout(600);
      await shot(app, `${size.tag}-01-alley-strip-gentle-14`);
      await openDaily(app);
      await app.page.waitForTimeout(400);
      await shot(app, `${size.tag}-13-daily-hud-back-chip`);
      await app.tapButton("backChip");
      await expect.poll(() => app.eval(() => window.__e2e.session!["daily"])).toBeNull();
      await app.waitIdle();
      await app.tapPoint(await app.eval(() => window.__e2e.farPoint()));
      await expect.poll(() => app.eval(() => window.__e2e.session!["track"]), { timeout: 15_000 }).toBe("deduce");
      await app.waitIdle();
      await app.page.waitForTimeout(600);
      await shot(app, `${size.tag}-02-tower-floors`);
    });

    test("milestone visits", async ({ app }) => {
      test.skip(size.tag === "se");
      await app.seed({ files: { "pips-progress.json": progress(10) }, prefs: { guide: ALL_GUIDES } });
      await app.open();
      await app.solve();
      await expect.poll(() => app.eval(() => window.__e2e.town?.["visit"]?.lit ?? false), { timeout: 20_000 }).toBe(true);
      await app.page.waitForTimeout(450);
      await shot(app, `${size.tag}-04-visit-landmark-10`);
      await expect.poll(() => app.eval(() => window.__e2e.session!["levelNumber"]), { timeout: 20_000 }).toBe(11);
      await app.waitIdle();
      await app.page.waitForTimeout(500);
      await shot(app, `${size.tag}-05-next-alley-gentle-11`);
    });

    test("lamp visit", async ({ app }) => {
      test.skip(size.tag === "se");
      await app.seed({ files: { "pips-progress.json": progress(5) }, prefs: { guide: ALL_GUIDES } });
      await app.open();
      await app.solve();
      await expect.poll(() => app.eval(() => window.__e2e.town?.["visit"]?.lit ?? false), { timeout: 20_000 }).toBe(true);
      await app.page.waitForTimeout(450);
      await shot(app, `${size.tag}-03-visit-lamp-5`);
    });

    test("result v2: day 3 milestone + month strip + reminder ask", async ({ app }) => {
      await app.seed({
        now: "2026-10-14T20:00:00",
        files: { "pips-daily-log.json": log(["2026-10-07", "2026-10-11", "2026-10-13"]) },
        prefs: { guide: ALL_GUIDES, streak: streak("2026-10-13", 2), shieldIntro: "1" },
      });
      await app.open();
      await openDaily(app);
      await solveDaily(app);
      await shot(app, `${size.tag}-06-result-v2-day3`);
      await app.page.waitForTimeout(2600);
      await shot(app, `${size.tag}-06b-result-v2-day3-settled`);
      await app.tapPoint(await app.eval(() => window.__e2e.cardPoint("home")));
      await expect.poll(() => app.eval(() => window.__e2e.scene!["ask"].kind), { timeout: 12_000 }).toBe("notify");
      await app.page.waitForTimeout(400);
      await shot(app, `${size.tag}-07-reminder-soft-ask`);
    });

    test("result v2: day 7 gift + night beat", async ({ app }) => {
      const days = ["2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13"];
      await app.seed({
        now: "2026-10-14T21:00:00",
        files: { "pips-daily-log.json": log(days) },
        prefs: { guide: ALL_GUIDES, streak: streak("2026-10-13", 6), shieldIntro: "1", notify: JSON.stringify({ v: 1, on: false, asked: "later", ignored: 0, planned: [], tapped: [] }) },
      });
      await app.open();
      await openDaily(app);
      await solveDaily(app);
      await shot(app, `${size.tag}-08-result-v2-day7-gift`);
      await app.tapPoint(await app.eval(() => window.__e2e.cardPoint("home")));
      await app.page.waitForTimeout(1500);
      await shot(app, `${size.tag}-09-night-beat`);
    });

    test("settings v2 ko + start over + break confirm", async ({ app }) => {
      await app.seed({ prefs: { guide: ALL_GUIDES } });
      await app.open();
      const sol = await app.solution();
      await app.play(sol.slice(0, 2));
      await app.tapButton("gearIcon");
      await app.page.waitForTimeout(500);
      await shot(app, `${size.tag}-10-settings-v2-ko`);
      await app.tapPoint(await app.page.evaluate(() => window.__e2e.sheetPoint(9)));
      await app.page.waitForTimeout(500);
      await shot(app, `${size.tag}-11-start-over-ask`);
      await app.tapPoint(await app.eval(() => window.__e2e.askPoint("no")));
      await app.page.waitForTimeout(300);
      await app.eval(() => window.__e2e.scene!["confirmBreak"]({ text: "짧은 영상 하나를 보면 30분 동안 광고 없이 플레이해요.", yes: "보기", no: "나중에", unavailable: "" }));
      await app.page.waitForTimeout(500);
      await shot(app, `${size.tag}-12-break-confirm`);
    });
  });
}

test.describe("en", () => {
  test.use({ locale: "en-US" });
  test("settings v2 en", async ({ app }) => {
    await app.seed({ prefs: { guide: ALL_GUIDES } });
    await app.open();
    await app.tapButton("gearIcon");
    await app.page.waitForTimeout(500);
    await shot(app, "pm-10b-settings-v2-en");
  });
});
