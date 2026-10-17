// v12 (playtest/i18n-v12.md): the new languages end to end — the device locale picks the language
// (it-IT → it, zh-TW / zh-HK → zh-Hant, zh-SG → zh-Hans), the first-run tutorial band, HUD captions,
// the "?" sheet, settings captions, the first daily's card and result sheet speak it, the CJK face
// is named in the canvas font, and VoiceOver's root carries the language.
import { STRINGS, type Lang } from "../src/a11y/strings.ts";
import { ALL_GUIDES, type App, expect, test } from "./fixtures.ts";

const at = (x: number, y: number): number => y * 8 + x;
const progress = (n: number): string =>
  JSON.stringify({ v: 3, game: "pips", track: "gentle", gentle: { level: n, cleared: n - 1, hints: 0 }, deduce: { level: 1, cleared: 0, hints: 0 } });

async function tapScene(app: App, pick: () => { x: number; y: number } | null): Promise<void> {
  const p = await app.page.evaluate(pick);
  if (!p) throw new Error("no such point");
  const c = await app.page.evaluate((q) => window.__e2e.toClient(q.x, q.y), p);
  await app.page.mouse.click(c.x, c.y);
}
const tutBand = (app: App): Promise<string | null> => app.eval(() => (window.__e2e.scene!["tut"]?.bandText as string | undefined) ?? null);
async function tapTut(app: App, cell: number): Promise<void> {
  const p = await app.page.evaluate((c) => {
    const q = window.__e2e.scene!["tut"].cellPoint(c) as { x: number; y: number };
    return window.__e2e.toClient(q.x, q.y);
  }, cell);
  await app.page.mouse.click(p.x, p.y);
}

const CASES: { locale: string; lang: Lang; face: string | null }[] = [
  { locale: "it-IT", lang: "it", face: null },
  { locale: "zh-TW", lang: "zh-Hant", face: "PingFang TC" },
  { locale: "zh-HK", lang: "zh-Hant", face: "PingFang TC" },
  { locale: "zh-SG", lang: "zh-Hans", face: "PingFang SC" },
];

for (const { locale, lang, face } of CASES) {
  const S = STRINGS[lang];
  test.describe(`${locale} → ${lang}`, () => {
    test.use({ locale });

    test("first run: the tutorial band speaks the language (a refused tap explains why); VoiceOver root has the lang", async ({ app }) => {
      await app.seed({});
      await app.open();
      await expect.poll(() => tutBand(app), { timeout: 20_000 }).toBe(S["tut.t1"]);
      expect(await app.page.evaluate(() => document.querySelector(".a11y-root")?.getAttribute("lang"))).toBe(lang);
      await tapTut(app, at(2, 0));
      await expect.poll(() => tutBand(app), { timeout: 20_000 }).toContain(S["tut.t2a"]!);
      await expect.poll(() => app.eval(() => window.__e2e.scene!["tut"]?.target as number), { timeout: 20_000 }).toBe(at(2, 2));
      await tapTut(app, at(0, 0)); // already lit → refused, the reason on the band's second line
      await expect.poll(() => tutBand(app)).toContain(S["tut.lit"]!);
    });

    test("HUD captions, the '?' sheet and the settings captions; the canvas font names the CJK face", async ({ app }) => {
      await app.seed({ files: { "pips-progress.json": progress(6) }, prefs: { guide: ALL_GUIDES } });
      await app.open();
      await app.waitIdle();
      await expect.poll(() => app.eval(() => window.__e2e.scene!["howBtn"].visible)).toBe(true);
      const caps = await app.eval(() => (window.__e2e.scene!["caps"] as Array<{ key: string; t: { text: string; style: { fontFamily: string } } }>).map((c) => [c.key, c.t.text, c.t.style.fontFamily]));
      for (const [key, text, family] of caps) {
        expect(text, key).toBe(S[key!]);
        if (face) expect(family, key).toContain(face);
        else expect(family, key).not.toContain("PingFang");
      }
      await tapScene(app, () => ({ x: window.__e2e.scene!["howBtn"].x, y: window.__e2e.scene!["howBtn"].y }));
      await expect.poll(() => app.eval(() => !!window.__e2e.scene!["howTo"]?.isOpen)).toBe(true);
      expect(await app.eval(() => window.__e2e.scene!["howTo"].texts)).toEqual([1, 2, 3, 4].map((k) => `${S[`how.c${k}`]} ${S[`how.c${k}s`]}`));
      await tapScene(app, () => window.__e2e.scene!["howTo"].point("close"));
      await expect.poll(() => app.eval(() => !!window.__e2e.scene!["howTo"]?.isOpen)).toBe(false);
      await app.tapButton("gearIcon");
      await expect.poll(() => app.eval(() => window.__e2e.scene!["sheet"].isOpen)).toBe(true);
      await expect
        .poll(() => app.eval(() => (window.__e2e.scene!["sheet"]["caps"] as { visible: boolean; text: string }[]).filter((c) => c.visible).map((c) => c.text)))
        .toEqual(["cap.sound", "cap.numbers", "cap.shareTime", "cap.haptics", "cap.faces", "cap.notify", "howTo", "cap.restart", "cap.policy"].map((k) => S[k]));
      await expect.poll(() => app.page.evaluate(() => [...document.querySelectorAll(".a11y-root button")].map((b) => b.getAttribute("aria-label")))).toContain(S["close"]);
    });

    test("first daily: the welcome card and the result sheet's labels", async ({ app }) => {
      await app.seed({ now: "2026-10-14T10:00:00", files: { "pips-progress.json": progress(6) }, prefs: { guide: ALL_GUIDES, dailyIntro: "0" } });
      await app.open();
      await app.waitIdle();
      await app.tapButton("todayBtn");
      await expect.poll(() => app.eval(() => window.__e2e.scene!["ask"].kind)).toBe("dailyIntro");
      expect(await app.eval(() => window.__e2e.scene!["ask"]["spec"].text as string)).toBe(`${S["daily.intro"]}\n${S["daily.intro2"]}`);
      await app.tapPoint(await app.eval(() => window.__e2e.askPoint("yes")));
      await app.waitIdle();
      await app.solve();
      await expect.poll(() => app.eval(() => !!window.__e2e.scene!["card"]?.isOpen), { timeout: 20_000 }).toBe(true);
      const card = await app.eval(() => {
        const c = window.__e2e.scene!["card"];
        return [c["lblTime"].text, c["lblStreak"].text, c["lblShield"].text, c["homeTxt"].text];
      });
      // R2 (A5): each fact once — the labels carry no numbers (the values do)
      expect(card).toEqual([S["res.time"], S["res.streakLbl"], S["res.shieldsLbl"], S["res.continue"]]);
    });
  });
}
