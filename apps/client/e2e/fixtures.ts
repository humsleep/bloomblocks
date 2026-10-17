// Shared E2E fixture: a fresh "device" per test (new browser context = empty fake
// Filesystem/Preferences), a controllable wall clock, and a console guard that fails the
// test on any uncaught error, console.error, or a warning that means a save / switch failed.
import { type ConsoleMessage, expect, type Page, test as base } from "@playwright/test";
import type { E2EBridge } from "./bridge.ts";

declare global {
  interface Window {
    __e2e: E2EBridge;
  }
}

/** Warnings that are real failures (the app logs instead of throwing on these paths). */
const BAD_WARN = /\[store\] .* failed|self-verify|switch failed|\[town\] failed|\[village\] failed|level worker failed|daily restore failed/;

export interface Seed {
  /** Local wall-clock time the page should see, e.g. "2026-10-14T10:00:00" (context time zone). */
  now?: string;
  /** Files under Library/lanternly/ (name → utf8 text). */
  files?: Record<string, string>;
  /** Preferences key → value. */
  prefs?: Record<string, string>;
}

/** Every guide bit (goal, tap, digit, conflict, track, peek, tower, moon): no first-run lessons. */
export const ALL_GUIDES = "255";

export class App {
  readonly log: string[] = [];
  readonly errors: string[] = [];

  constructor(readonly page: Page) {
    page.on("pageerror", (e) => this.errors.push(`pageerror: ${e.message}\n${e.stack ?? ""}`));
    page.on("console", (m: ConsoleMessage) => {
      const line = `[${m.type()}] ${m.text()}`;
      this.log.push(line);
      if (m.type() === "error") this.errors.push(line);
      else if (m.type() === "warning" && BAD_WARN.test(m.text())) this.errors.push(line);
    });
  }

  /** Install the device seed + clock before the first navigation (runs before any app script). */
  async seed(s: Seed = {}): Promise<void> {
    await this.page.addInitScript((seed: Seed) => {
      const ls = window.localStorage;
      if (!ls.getItem("__e2e:seeded")) {
        ls.setItem("__e2e:seeded", "1");
        const files: Record<string, { data: string; enc: string }> = {};
        for (const [k, v] of Object.entries(seed.files ?? {})) files[`LIBRARY/lanternly/${k}`] = { data: v, enc: "utf8" };
        // v11: the first daily's welcome card is its own test (novice.spec): elsewhere it was already seen.
        // R2 (A7): so is the first-daily offer after gentle 3 (its own tests: novice.spec "A7")
        ls.setItem("__fake:device", JSON.stringify({ files, prefs: { dailyIntro: "1", dailyOffer: "1", ...(seed.prefs ?? {}) }, shares: [] }));
        if (seed.now) ls.setItem("__e2e:now", seed.now);
      }
      // wall clock: a ticking Date shifted to the requested local time (timers untouched)
      const target = ls.getItem("__e2e:now");
      if (target) {
        const Real = Date;
        const offset = new Real(target).getTime() - Real.now();
        class ShiftedDate extends Real {
          constructor(...a: unknown[]) {
            if (a.length === 0) super(Real.now() + offset);
            else super(...(a as [number]));
          }
          static override now(): number {
            return Real.now() + offset;
          }
        }
        (globalThis as unknown as { Date: DateConstructor }).Date = ShiftedDate as unknown as DateConstructor;
      }
    }, s);
  }

  /** Set the wall clock for the next (re)load. */
  async setNow(localISO: string): Promise<void> {
    await this.page.evaluate((t) => window.localStorage.setItem("__e2e:now", t), localISO);
  }

  async open(): Promise<void> {
    await this.page.goto("/");
    await this.waitReady();
  }

  async reload(): Promise<void> {
    await this.page.reload();
    await this.waitReady();
  }

  async waitReady(): Promise<void> {
    await expect.poll(() => this.page.evaluate(() => !!window.__e2e?.ready()), { timeout: 30_000 }).toBe(true);
  }

  async waitIdle(): Promise<void> {
    await expect.poll(() => this.page.evaluate(() => window.__e2e.idle()), { timeout: 30_000 }).toBe(true);
  }

  eval<T>(fn: () => T | Promise<T>): Promise<T> {
    return this.page.evaluate(fn);
  }

  async tapCell(cell: number): Promise<void> {
    const p = await this.page.evaluate((c) => window.__e2e.cellPoint(c), cell);
    await this.page.mouse.click(p.x, p.y);
  }

  async tapButton(name: "hintBtn" | "undoBtn" | "leftBtn" | "gearIcon" | "todayBtn" | "backChip" | "alley"): Promise<void> {
    const p = await this.page.evaluate((n) => window.__e2e.objPoint(n), name);
    await this.page.mouse.click(p.x, p.y);
  }

  async tapPoint(p: { x: number; y: number }): Promise<void> {
    await this.page.mouse.click(p.x, p.y);
  }

  lanterns(): Promise<number[]> {
    return this.page.evaluate(() => window.__e2e.lanterns());
  }

  solution(): Promise<number[]> {
    return this.page.evaluate(() => window.__e2e.solution());
  }

  file(name: string): Promise<string | null> {
    return this.page.evaluate((n) => window.__e2e.file(n), name);
  }

  pref(key: string): Promise<string | null> {
    return this.page.evaluate((k) => window.__e2e.pref(k), key);
  }

  /** Journal move lines (after the PPJ1 header) of a slot once the write queue settled. */
  async journalMoves(slot: "gentle" | "deduce" | "daily"): Promise<string[]> {
    const t = (await this.file(`pips-${slot}-journal.log`)) ?? "";
    return t.split("\n").slice(1).filter((l) => l.length > 0);
  }

  progress(): Promise<Record<string, any>> { // eslint-disable-line @typescript-eslint/no-explicit-any
    return this.file("pips-progress.json").then((t) => (t ? JSON.parse(t) : null));
  }

  /** Tap cells one by one, waiting for each move to be applied (the session journals synchronously). */
  async play(cells: readonly number[]): Promise<void> {
    for (const c of cells) {
      const before = await this.page.evaluate(() => window.__e2e.session!["moves"].length as number);
      await this.tapCell(c);
      await expect.poll(() => this.page.evaluate(() => window.__e2e.session!["moves"].length as number)).toBe(before + 1);
    }
  }

  /** v11: gentle 1–3 wait for "Next house →" after the finale — tap it once it is up. */
  async tapNext(): Promise<void> {
    await expect.poll(() => this.page.evaluate(() => !!window.__e2e.scene?.["nextPoint"]), { timeout: 20_000 }).toBe(true);
    const p = await this.page.evaluate(() => {
      const q = window.__e2e.scene!["nextPoint"] as { x: number; y: number };
      return window.__e2e.toClient(q.x, q.y);
    });
    await this.page.mouse.click(p.x, p.y);
  }

  /** Solve the current level with real taps. */
  async solve(): Promise<void> {
    const sol = await this.solution();
    const have = new Set(await this.lanterns());
    await this.play(sol.filter((c) => !have.has(c)));
  }
}

export const test = base.extend<{ app: App }>({
  app: async ({ page }, use, testInfo) => {
    const app = new App(page);
    await use(app);
    await testInfo.attach("console.log", { body: app.log.join("\n"), contentType: "text/plain" });
    expect(app.errors, "uncaught errors / console.error / failed-save warnings").toEqual([]);
  },
});

export { expect };
