// v11 (playtest/NOVICE-TEST.md §5, playtest/ux-v11.md): the "?" How-to-play sheet, the settings'
// close button, HUD captions, the solved moment + "Next house →" on gentle 1–3, the daily's first
// welcome card and its labelled result sheet. ko-KR (the e2e locale): the shown words are checked.
import { ALL_GUIDES, type App, expect, test } from "./fixtures.ts";

const progress = (n: number): string =>
  JSON.stringify({ v: 3, game: "pips", track: "gentle", gentle: { level: n, cleared: n - 1, hints: 0 }, deduce: { level: 1, cleared: 0, hints: 0 } });

async function tapScene(app: App, pick: () => { x: number; y: number } | null): Promise<void> {
  const p = await app.page.evaluate(pick);
  if (!p) throw new Error("no such point");
  const c = await app.page.evaluate((q) => window.__e2e.toClient(q.x, q.y), p);
  await app.page.mouse.click(c.x, c.y);
}

const howOpen = (app: App): Promise<boolean> => app.eval(() => !!window.__e2e.scene!["howTo"]?.isOpen);

test.describe("v11 How to play", () => {
  test("'?' beside the gear opens the sheet: four cards in Korean, ✕ closes; Replay tutorial plays it again (Skip shows at once) and the board comes back untouched", async ({ app }) => {
    await app.seed({ files: { "pips-progress.json": progress(6) }, prefs: { guide: ALL_GUIDES } });
    await app.open();
    await app.waitIdle();
    const sol = await app.solution();
    await app.play([sol[0]!]);
    // the button + its caption, and VoiceOver's label
    await expect.poll(() => app.eval(() => window.__e2e.scene!["howBtn"].visible)).toBe(true);
    expect(await app.eval(() => (window.__e2e.scene!["caps"] as Array<{ key: string; t: { text: string } }>).map((c) => [c.key, c.t.text]))).toEqual([
      ["cap.town", "마을"], ["cap.today", "오늘"], ["cap.undo", "되돌리기"], ["cap.hint", "힌트"], ["cap.settings", "설정"], ["cap.how", "규칙"], ["cap.back", "돌아가기"],
    ]);
    await expect.poll(() => app.page.evaluate(() => [...document.querySelectorAll(".a11y-root button")].some((b) => b.getAttribute("aria-label") === "규칙"))).toBe(true);
    await tapScene(app, () => ({ x: window.__e2e.scene!["howBtn"].x, y: window.__e2e.scene!["howBtn"].y }));
    await expect.poll(() => howOpen(app)).toBe(true);
    expect(await app.eval(() => window.__e2e.scene!["howTo"].texts)).toEqual([
      "칸을 눌러 등불을 놓아요. 빛은 돌 앞까지 퍼져요.",
      "모든 칸을 밝혀요. 등불을 다시 누르면 빠져요.",
      "등불끼리 서로 비추면 안 돼요. 사이에 돌이 있으면 괜찮아요.",
      "숫자 = 바로 옆 등불 개수. 대각선은 세지 않아요. 0이면 하나도 없어요.",
    ]);
    // a tap on the board behind it does nothing; ✕ closes
    expect(await app.eval(() => window.__e2e.scene!["isIdle"]())).toBe(false);
    await tapScene(app, () => window.__e2e.scene!["howTo"].point("close"));
    await expect.poll(() => howOpen(app)).toBe(false);
    // Replay tutorial (from the sheet; scrolled into view)
    await tapScene(app, () => ({ x: window.__e2e.scene!["howBtn"].x, y: window.__e2e.scene!["howBtn"].y }));
    await expect.poll(() => howOpen(app)).toBe(true);
    await app.eval(() => window.__e2e.scene!["howTo"].revealReplay());
    await app.page.waitForTimeout(100);
    await tapScene(app, () => window.__e2e.scene!["howTo"].point("replay"));
    await expect.poll(() => app.eval(() => window.__e2e.scene!["tut"]?.step ?? 0), { timeout: 15_000 }).toBe(1);
    await expect.poll(() => app.eval(() => window.__e2e.scene!["tut"]?.skipPoint ?? null)).not.toBeNull();
    await tapScene(app, () => window.__e2e.scene!["tut"].skipPoint);
    await expect.poll(() => app.eval(() => window.__e2e.scene!["tut"])).toBeNull();
    // the board as it was: gentle 6, the one lantern
    expect(await app.eval(() => window.__e2e.session!["levelNumber"])).toBe(6);
    expect(await app.lanterns()).toEqual([sol[0]]);
  });

  test("the daily's clock rests while the sheet is open; settings has a ✕ and its 'How to play' row opens the same sheet", async ({ app }) => {
    await app.seed({ now: "2026-10-14T10:00:00", files: { "pips-progress.json": progress(6) }, prefs: { guide: ALL_GUIDES } });
    await app.open();
    await app.waitIdle();
    await app.tapButton("todayBtn");
    await expect.poll(() => app.eval(() => window.__e2e.session!["daily"])).toBe("2026-10-14");
    await app.waitIdle();
    await expect.poll(() => app.eval(() => !!window.__e2e.scene!["clock"]?.running)).toBe(true);
    await tapScene(app, () => ({ x: window.__e2e.scene!["howBtn"].x, y: window.__e2e.scene!["howBtn"].y }));
    await expect.poll(() => howOpen(app)).toBe(true);
    expect(await app.eval(() => window.__e2e.scene!["clock"].running)).toBe(false);
    const ms0 = await app.eval(() => window.__e2e.scene!["clock"].peek() as number);
    await app.page.waitForTimeout(700);
    expect(await app.eval(() => window.__e2e.scene!["clock"].peek() as number)).toBe(ms0);
    await tapScene(app, () => window.__e2e.scene!["howTo"].point("close"));
    await expect.poll(() => app.eval(() => window.__e2e.scene!["clock"].running)).toBe(true);
    // settings: the ✕, then the "Rules" row (R2: one name — caption "규칙")
    await app.tapButton("gearIcon");
    await expect.poll(() => app.eval(() => window.__e2e.scene!["sheet"].isOpen)).toBe(true);
    await tapScene(app, () => {
      const b = window.__e2e.scene!["sheet"].closeBox();
      return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    });
    await expect.poll(() => app.eval(() => window.__e2e.scene!["sheet"].isOpen)).toBe(false);
    await app.tapButton("gearIcon");
    await expect.poll(() => app.eval(() => window.__e2e.scene!["sheet"].isOpen)).toBe(true);
    await expect
      .poll(() => app.eval(() => (window.__e2e.scene!["sheet"]["caps"] as { visible: boolean; text: string }[]).some((c) => c.visible && c.text === "규칙")))
      .toBe(true);
    await app.tapPoint(await app.page.evaluate(() => window.__e2e.sheetPoint(8)));
    await expect.poll(() => howOpen(app)).toBe(true);
  });
});

test.describe("v11 solved moment", () => {
  test("gentle 1: 'Solved!' shows, the finale waits for 'Next house →' (a stray tap only hurries it), then gentle 2", async ({ app }) => {
    await app.seed({ prefs: { guide: ALL_GUIDES } });
    await app.open();
    await app.waitIdle();
    await app.solve();
    await expect.poll(() => app.eval(() => window.__e2e.scene!["bigWord"].word as string)).toBe("완성!");
    // a tap that is not the button: the finale jumps to the wait, nothing moves on
    await app.tapPoint({ x: 30, y: 300 });
    await expect.poll(() => app.eval(() => window.__e2e.scene!["nextPoint"] !== null)).toBe(true);
    await app.page.waitForTimeout(1500);
    expect(await app.eval(() => window.__e2e.session!["levelNumber"])).toBe(1);
    expect(await app.eval(() => !!window.__e2e.scene!["finale"])).toBe(true);
    await app.tapNext();
    await expect.poll(() => app.eval(() => window.__e2e.session!["levelNumber"]), { timeout: 20_000 }).toBe(2);
    await app.waitIdle();
  });

  test("gentle 4 moves on by itself as before (and still says 'Solved!')", async ({ app }) => {
    await app.seed({ files: { "pips-progress.json": progress(4) }, prefs: { guide: ALL_GUIDES } });
    await app.open();
    await app.waitIdle();
    await app.solve();
    await expect.poll(() => app.eval(() => window.__e2e.scene!["bigWord"].word as string)).toBe("완성!");
    await expect.poll(() => app.eval(() => window.__e2e.session!["levelNumber"]), { timeout: 20_000 }).toBe(5);
    expect(await app.eval(() => window.__e2e.scene!["nextPoint"])).toBeNull();
  });
});

test.describe("v11 daily", () => {
  test("the today button waits until gentle 3 is solved (R2 A7: was 5)", async ({ app }) => {
    await app.seed({ now: "2026-10-14T10:00:00", files: { "pips-progress.json": progress(3) }, prefs: { guide: "23" } });
    await app.open();
    await app.waitIdle();
    await app.page.waitForTimeout(400);
    expect(await app.eval(() => window.__e2e.scene!["todayBtn"].visible)).toBe(false);
  });

  test("first daily: a welcome card (clock waits), then the labelled result sheet with Continue as the main button", async ({ app }) => {
    await app.seed({ now: "2026-10-14T10:00:00", files: { "pips-progress.json": progress(6) }, prefs: { guide: ALL_GUIDES, dailyIntro: "0" } });
    await app.open();
    await app.waitIdle();
    await app.tapButton("todayBtn");
    await expect.poll(() => app.eval(() => window.__e2e.scene!["ask"].kind)).toBe("dailyIntro");
    expect(await app.eval(() => window.__e2e.scene!["ask"]["spec"].text as string)).toBe("매일 새 퍼즐 하나.\n내일 오면 연속 기록이 이어져요.");
    expect(await app.eval(() => !!window.__e2e.scene!["clock"]?.running)).toBe(false);
    await app.tapPoint(await app.eval(() => window.__e2e.askPoint("yes")));
    await expect.poll(() => app.eval(() => window.__e2e.scene!["clock"].running)).toBe(true);
    expect(await app.pref("dailyIntro")).toBe("1");
    await app.waitIdle();
    await app.solve();
    await expect.poll(() => app.eval(() => !!window.__e2e.scene!["card"]?.isOpen), { timeout: 20_000 }).toBe(true);
    const card = await app.eval(() => {
      const c = window.__e2e.scene!["card"];
      return [c["lblTime"].text, c["lblStreak"].text, c["lblShield"].text, c["homeTxt"].text, c["shareTxt"].text];
    });
    expect(card).toEqual(["시간", "연속 기록", "보호막", "계속", "공유"]);
    // VoiceOver: the main button says "Continue"
    await expect.poll(() => app.page.evaluate(() => [...document.querySelectorAll(".a11y-root button")].some((b) => b.getAttribute("aria-label") === "계속"))).toBe(true);
    await app.tapPoint(await app.eval(() => window.__e2e.cardPoint("home")));
    await expect.poll(() => app.eval(() => window.__e2e.session!["daily"])).toBeNull();
  });
});
