// R4 rankings: the daily result sheet's trophy pill signs in to Game Center (web fake here), sends the totals
// and opens today's board; the daily's own result is then sent only once rankings are on.
import { ALL_GUIDES, expect, test } from "./fixtures.ts";

const progress = (n: number): string =>
  JSON.stringify({ v: 3, game: "pips", track: "gentle", gentle: { level: n, cleared: n - 1, hints: 0 }, deduce: { level: 1, cleared: 0, hints: 0 } });

test("the result sheet's trophy opens today's board (Game Center fake) and sends the totals", async ({ app }) => {
  await app.seed({ now: "2026-10-14T10:00:00", files: { "pips-progress.json": progress(6) }, prefs: { guide: ALL_GUIDES, dailyIntro: "0" } });
  await app.open();
  await app.waitIdle();
  await app.tapButton("todayBtn");
  await expect.poll(() => app.eval(() => window.__e2e.scene!["ask"].kind)).toBe("dailyIntro");
  await app.tapPoint(await app.eval(() => window.__e2e.askPoint("yes")));
  await app.waitIdle();
  await app.solve();
  await expect.poll(() => app.eval(() => !!window.__e2e.scene!["card"]?.isOpen), { timeout: 20_000 }).toBe(true);
  await app.page.waitForTimeout(500);
  // rankings are off: the daily was not sent anywhere
  expect(await app.page.evaluate(() => (globalThis as unknown as { __gameCenterFake?: { scores: unknown[] } }).__gameCenterFake?.scores.length ?? 0)).toBe(0);
  if (process.env["SHOTS_DIR"]) await app.page.screenshot({ path: `${process.env["SHOTS_DIR"]}/result-rank.png` });
  const p = await app.eval(() => {
    const c = window.__e2e.scene!["card"];
    const b = c["rankBox"] as { x: number; y: number; w: number; h: number };
    const q = window.__e2e.toClient(c.cx + b.x + b.w / 2, c.cy + b.y + b.h / 2);
    return { x: q.x, y: q.y, text: c["rankTxt"].text as string };
  });
  expect(p.text).toContain("순위");
  await app.tapPoint(p);
  await expect.poll(() => app.page.evaluate(() => (globalThis as unknown as { __gameCenterFake?: { shown: string[] } }).__gameCenterFake?.shown ?? [])).toEqual(["duskwick.daily.time"]);
  const ids = await app.page.evaluate(() => (globalThis as unknown as { __gameCenterFake: { scores: { id: string }[] } }).__gameCenterFake.scores.map((x) => x.id));
  expect(ids).toEqual(["duskwick.streak.best", "duskwick.puzzles.solved"]);
  expect(await app.pref("gameCenter")).toBe("on");
});
