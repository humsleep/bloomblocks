// HUD captions (Settings · Rules · Back on the top row; Village · Today · Undo · Hint under the board) in all 10
// locales on an iPhone SE (375 pt) and a Pro Max (430 pt), Dynamic Type 1.0 and 1.3: every visible caption stays inside
// the screen, keeps ≥ 4 pt from its neighbours and is drawn at ≥ 11 pt (shrink-to-fit floor).
// SHOTS_HUD=1 also writes playtest/shots/hud-fit/ (SE, it / fr / pt-BR).
import { fileURLToPath } from "node:url";
import { ALL_GUIDES, expect, test } from "./fixtures.ts";

const OUT = fileURLToPath(new URL("../../../playtest/shots/hud-fit/", import.meta.url));
const progress = (n: number): string =>
  JSON.stringify({ v: 3, game: "pips", track: "gentle", gentle: { level: n, cleared: n - 1, hints: 0 }, deduce: { level: 1, cleared: 0, hints: 0 } });
const LOCALES = ["ko-KR", "en-US", "ja-JP", "de-DE", "fr-FR", "es-MX", "pt-BR", "it-IT", "zh-Hans-SG", "zh-Hant-TW"];
const CASES = [
  { tag: "se", w: 375, h: 667, dt: 1 },
  { tag: "se", w: 375, h: 667, dt: 1.3 },
  { tag: "max", w: 430, h: 932, dt: 1.3 },
];

type Cap = { key: string; text: string; l: number; r: number; t: number; pt: number };

for (const c of CASES) {
  for (const locale of LOCALES) {
    test.describe(`${c.tag} ${locale} DT ${c.dt}`, () => {
      test.use({ viewport: { width: c.w, height: c.h }, locale });
      test("every HUD caption is whole, apart and ≥ 11 pt", async ({ app }) => {
        // Dynamic Type for the web build: the a11y layer's size probe reads this
        await app.page.addInitScript((k) => {
          const st = document.createElement("style");
          st.textContent = `.a11y-probe{font-size:${17 * k}px !important}`;
          document.addEventListener("DOMContentLoaded", () => document.head.appendChild(st));
        }, c.dt);
        await app.seed({ now: "2026-10-14T10:00:00", files: { "pips-progress.json": progress(6) }, prefs: { guide: ALL_GUIDES } });
        await app.open();
        await app.waitIdle();
        const read = (): Promise<Cap[]> =>
          app.eval(() => {
            const s = window.__e2e.scene!;
            const u = s["u"] as number;
            return (s["caps"] as { key: string; t: { text: string; visible: boolean; alpha: number; x: number; y: number; displayWidth: number; scaleX: number; style: { fontSize: string } } }[])
              .filter((x) => x.t.visible && x.t.alpha > 0.05)
              .map((x) => ({ key: x.key, text: x.t.text, l: (x.t.x - x.t.displayWidth / 2) / u, r: (x.t.x + x.t.displayWidth / 2) / u, t: x.t.y / u, pt: (parseFloat(x.t.style.fontSize) * x.t.scaleX) / u }));
          });
        const check = (caps: Cap[], keys: string[], what: string): void => {
          expect(caps.map((x) => x.key).sort(), `${what}: visible captions`).toEqual([...keys].sort());
          for (const x of caps) {
            expect(x.l, `${what} ${x.key} "${x.text}" left edge`).toBeGreaterThanOrEqual(0);
            expect(x.r, `${what} ${x.key} "${x.text}" right edge`).toBeLessThanOrEqual(c.w);
            expect(x.pt, `${what} ${x.key} "${x.text}" size`).toBeGreaterThanOrEqual(10.9);
          }
          for (const a of caps) for (const b of caps) if (a.key < b.key && Math.abs(a.t - b.t) < 8) expect(Math.min(a.r, b.r) - Math.max(a.l, b.l) < -4 || a.r < b.l - 4 || b.r < a.l - 4, `${what} ${a.key} vs ${b.key}`).toBe(true);
        };
        const shoot = !!process.env["SHOTS_HUD"] && c.tag === "se" && /^(it|fr|pt)/.test(locale);
        const row = ["cap.town", "cap.today", "cap.undo", "cap.hint", "cap.settings", "cap.how"];
        await expect.poll(async () => (await read()).length).toBe(row.length);
        check(await read(), row, "puzzle");
        if (shoot) await app.page.screenshot({ path: `${OUT}${c.tag}-dt${c.dt}-${locale}.png` });
        // the daily adds Back (and its calendar disc replaces Today's caption)
        const daily = [...row.filter((k) => k !== "cap.today"), "cap.back"];
        await app.tapButton("todayBtn");
        await expect.poll(() => app.eval(() => window.__e2e.session!["daily"])).toBe("2026-10-14");
        await app.waitIdle();
        await expect.poll(async () => (await read()).length).toBe(daily.length);
        check(await read(), daily, "daily");
        if (shoot) await app.page.screenshot({ path: `${OUT}${c.tag}-dt${c.dt}-${locale}-daily.png` });
      });
    });
  }
}
