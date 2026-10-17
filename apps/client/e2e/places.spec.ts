// Places and settings: the deduce tower (travel there and back), the town street
// (open / close), the settings sheet (sound, number style, time in share) persisting.
import { ALL_GUIDES, expect, test } from "./fixtures.ts";

const progress = (gentleLevel: number): string =>
  JSON.stringify({ v: 3, game: "pips", track: "gentle", gentle: { level: gentleLevel, cleared: gentleLevel - 1, hints: 0 }, deduce: { level: 1, cleared: 0, hints: 0 } });

test.describe("tower (deduce track)", () => {
  test("locked before gentle 8, and in the first session even after it: a tap only knocks", async ({ app }) => {
    await app.seed({ prefs: { guide: "23" } }); // goal/tap/digit/conflict done; track + tower not yet
    await app.open();
    const far = await app.eval(() => window.__e2e.farPoint());
    expect(far.kind).toBe("tower");
    await app.tapPoint(far);
    await app.page.waitForTimeout(800); // asserting that nothing starts: there is no event to wait on
    expect(await app.eval(() => [window.__e2e.session!["track"], !!window.__e2e.scene!["travel"]])).toEqual(["gentle", false]);
  });

  test("phase 5 first-session diet: gentle 9 in the first session — no tower look, no knock-through", async ({ app }) => {
    await app.seed({ files: { "pips-progress.json": progress(9) }, prefs: { guide: "23" } });
    await app.open();
    await app.page.waitForTimeout(2500); // the look would have started after ~1.2 s of quiet
    expect(await app.eval(() => window.__e2e.scene!["travel"]?.kind ?? null)).toBeNull();
    await app.tapPoint(await app.eval(() => window.__e2e.farPoint()));
    await app.page.waitForTimeout(600);
    expect(await app.eval(() => window.__e2e.session!["track"])).toBe("gentle");
  });

  test("gentle 6: tap the tower → travel → deduce 1; tap home on the hill → back to gentle 6 with its board", async ({ app }) => {
    await app.seed({ files: { "pips-progress.json": progress(6) }, prefs: { guide: ALL_GUIDES } });
    await app.open();
    const sol = await app.solution();
    await app.play([sol[0]!]);
    const far = await app.eval(() => window.__e2e.farPoint());
    expect(far.kind).toBe("tower");
    await app.tapPoint(far);
    await expect.poll(() => app.eval(() => !!window.__e2e.scene!["travel"])).toBe(true);
    await app.waitIdle();
    expect(await app.eval(() => [window.__e2e.session!["track"], window.__e2e.session!["levelNumber"], window.__e2e.session!["level"].w])).toEqual(["deduce", 1, 6]);
    await expect.poll(() => app.progress()).toMatchObject({ track: "deduce" });
    // the camera is back to normal and input works on the deduce board
    expect(await app.eval(() => window.__e2e.scene!["cameras"].main.zoom)).toBe(1);
    const dsol = await app.solution();
    await app.play([dsol[0]!]);
    const home = await app.eval(() => window.__e2e.farPoint());
    expect(home.kind).toBe("home");
    await app.tapPoint(home);
    await expect.poll(() => app.eval(() => window.__e2e.session!["track"])).toBe("gentle");
    await app.waitIdle();
    expect(await app.eval(() => window.__e2e.session!["levelNumber"])).toBe(6);
    expect(await app.lanterns()).toEqual([sol[0]]);
    await expect.poll(() => app.progress()).toMatchObject({ track: "gentle" });
    // relaunch: deduce kept its own board
    await app.reload();
    await app.tapPoint(await app.eval(() => window.__e2e.farPoint()));
    await expect.poll(() => app.eval(() => window.__e2e.session!["track"])).toBe("deduce");
    await app.waitIdle();
    expect(await app.lanterns()).toEqual([dsol[0]]);
  });

  test("first unlock (gentle 8 done, a later session): the camera looks over to the tower once, then the finger points at it", async ({ app }) => {
    await app.seed({ files: { "pips-progress.json": progress(9) }, prefs: { guide: "23", sessions: "1" } });
    await app.open();
    await expect.poll(() => app.eval(() => window.__e2e.scene!["travel"]?.kind ?? null), { timeout: 15_000 }).toBe("reveal");
    await expect.poll(() => app.pref("guide").then((g) => (Number(g) & 64) !== 0)).toBe(true);
    await expect.poll(() => app.eval(() => window.__e2e.scene!["guide"].active?.kind ?? null), { timeout: 15_000 }).toBe("track");
  });
});

test.describe("tower numbering (r6: 1 / 3 / 16 did not agree)", () => {
  test("one number for the tower everywhere: the deduce level to play — far plate = courtyard plate; the far home shows the gentle level", async ({ app }) => {
    const prog = JSON.stringify({ v: 3, game: "pips", track: "gentle", gentle: { level: 6, cleared: 5, hints: 0 }, deduce: { level: 4, cleared: 3, hints: 0 } });
    await app.seed({ files: { "pips-progress.json": prog }, prefs: { guide: ALL_GUIDES } });
    await app.open();
    await app.waitIdle();
    expect(await app.eval(() => (((f) => String(f.mode === "gentle" ? f.towerLevel : f.homeLevel))(window.__e2e.scene!["scenery"]["far"])))).toBe("4");
    expect(await app.eval(() => String(window.__e2e.scene!["scenery"]["plateN"]))).toBe("6");
    await app.tapPoint(await app.eval(() => window.__e2e.farPoint()));
    await expect.poll(() => app.eval(() => window.__e2e.session!["track"]), { timeout: 15_000 }).toBe("deduce");
    await app.waitIdle();
    expect(await app.eval(() => String(window.__e2e.scene!["scenery"]["plateN"]))).toBe("4");
    expect(await app.eval(() => (((f) => String(f.mode === "gentle" ? f.towerLevel : f.homeLevel))(window.__e2e.scene!["scenery"]["far"])))).toBe("6");
  });
});

test.describe("town street", () => {
  test("alley strip → the town opens over the scene (input off) → home closes it, input back (R2: the left disc opens the village)", async ({ app }) => {
    await app.seed({ files: { "pips-progress.json": progress(9) }, prefs: { guide: ALL_GUIDES } });
    await app.open();
    expect(await app.eval(() => window.__e2e.scene!["leftBtn"].visible)).toBe(true);
    await app.waitIdle();
    await app.tapButton("alley");
    await expect.poll(() => app.eval(() => window.__e2e.scene!["townOpen"])).toBe(true);
    await expect.poll(() => app.eval(() => !!window.__e2e.townHomePoint()), { timeout: 15_000 }).toBe(true);
    expect(await app.eval(() => window.__e2e.scene!["input"].enabled)).toBe(false);
    // taps on the street never reach the board
    const moves = await app.eval(() => window.__e2e.session!["moves"].length);
    await app.page.mouse.click(195, 700);
    await app.page.waitForTimeout(400); // the town's open slide; then close with home
    await app.tapPoint((await app.eval(() => window.__e2e.townHomePoint()))!);
    await expect.poll(() => app.eval(() => window.__e2e.scene!["townOpen"]), { timeout: 15_000 }).toBe(false);
    await expect.poll(() => app.eval(() => window.__e2e.town ?? null)).toBeNull();
    expect(await app.eval(() => window.__e2e.scene!["input"].enabled)).toBe(true);
    expect(await app.eval(() => window.__e2e.session!["moves"].length)).toBe(moves);
    // the board takes taps again
    await app.play([(await app.solution())[0]!]);
    // and the town opens a second time
    await app.tapButton("alley");
    await expect.poll(() => app.eval(() => !!window.__e2e.townHomePoint()), { timeout: 15_000 }).toBe(true);
  });

  test("a house tapped the moment the street is up shows its keepsake board (first tap counts)", async ({ app }) => {
    await app.seed({ files: { "pips-progress.json": progress(9) }, prefs: { guide: ALL_GUIDES } });
    await app.open();
    await app.tapButton("alley");
    // no settle wait: tap as soon as the street has houses to tap
    await expect.poll(() => app.eval(() => window.__e2e.townHousePoints().length), { timeout: 15_000, intervals: [16] }).toBeGreaterThan(0);
    const houses = await app.eval(() => window.__e2e.townHousePoints());
    const h = houses[houses.length - 1]!;
    await app.tapPoint(h);
    await expect.poll(() => app.eval(() => window.__e2e.townKeepsake()?.asked ?? 0), { timeout: 2_000 }).toBe(h.n);
    await expect.poll(() => app.eval(() => window.__e2e.townKeepsake()?.shown ?? 0), { timeout: 15_000 }).toBe(h.n);
  });

  test("keepsake: a house solved in this build shows its board at once; an older one gets a breathing placeholder, never a blank", async ({ app }) => {
    await app.seed({ files: { "pips-progress.json": progress(4) }, prefs: { guide: ALL_GUIDES } });
    await app.open();
    await app.solve(); // gentle 4 → its board goes into the keepsake file
    await expect.poll(() => app.eval(() => window.__e2e.session!["levelNumber"]), { timeout: 30_000 }).toBe(5);
    await app.waitIdle();
    expect(JSON.parse((await app.file("pips-gentle-solved.json"))!).rows["4"]).toBeTruthy();
    await app.tapButton("alley");
    await expect.poll(() => app.eval(() => window.__e2e.town?.["phase"] ?? null), { timeout: 15_000 }).toBe("open");
    const houses = await app.eval(() => window.__e2e.townHousePoints());
    const h4 = houses.find((h) => h.n === 4)!;
    expect(h4).toBeTruthy();
    // the card is up on the tap itself: no worker round trip, no placeholder
    await app.page.mouse.click(h4.x, h4.y);
    const shownAt = await app.eval(() => window.__e2e.townKeepsake());
    expect(shownAt).toEqual({ asked: 4, shown: 4, placeholder: false });
    // an older house (solved before the keepsake file): placeholder at once if its board is not in yet
    const h3 = houses.find((h) => h.n === 3);
    if (h3) {
      await app.page.mouse.click(h3.x, h3.y);
      const k = await app.eval(() => window.__e2e.townKeepsake()!);
      expect(k.asked).toBe(3);
      expect(k.shown === 3 || k.placeholder).toBe(true);
      await expect.poll(() => app.eval(() => window.__e2e.townKeepsake()?.shown ?? 0), { timeout: 15_000 }).toBe(3);
      // and it is remembered for next time
      await expect.poll(async () => !!JSON.parse((await app.file("pips-gentle-solved.json")) ?? "{}").rows?.["3"]).toBe(true);
    }
  });
});

test.describe("town street: lifecycle (code review)", () => {
  const openTown = async (app: import("./fixtures.ts").App): Promise<void> => {
    await app.tapButton("alley");
    await expect.poll(() => app.eval(() => window.__e2e.town?.["phase"] ?? null), { timeout: 15_000 }).toBe("open");
  };
  const closeTown = async (app: import("./fixtures.ts").App): Promise<void> => {
    await app.tapPoint((await app.eval(() => window.__e2e.townHomePoint()))!);
    await expect.poll(() => app.eval(() => window.__e2e.scene!["townOpen"]), { timeout: 15_000 }).toBe(false);
    await expect.poll(() => app.eval(() => !!window.__e2e.town)).toBe(false);
  };

  test("[P1-5] ten opens / closes leave no resize listener and no street scene behind", async ({ app }) => {
    await app.seed({ files: { "pips-progress.json": progress(9) }, prefs: { guide: ALL_GUIDES } });
    await app.open();
    const count = (): Promise<number> => app.eval(() => window.__e2e.game!["scale"].listenerCount("resize") as number);
    const before = await count();
    let whileOpen = -1;
    for (let i = 0; i < 10; i++) {
      await openTown(app);
      const n = await count();
      if (whileOpen < 0) whileOpen = n;
      expect(n).toBe(whileOpen); // was +1 per open (a dead street scene each)
      await closeTown(app);
    }
    expect(await count()).toBe(before);
    expect(await app.eval(() => Object.keys(window.__e2e.game!["scene"].keys).filter((k) => k === "town"))).toEqual([]);
  });

  test("[P1-6] a street that fails to build gives the board its input back and opens fine next time", async ({ app }) => {
    await app.seed({ files: { "pips-progress.json": progress(9) }, prefs: { guide: ALL_GUIDES } });
    await app.open();
    // the backdrop canvas has no 2D context once (iOS canvas memory pressure)
    await app.eval(() => {
      const tm = window.__e2e.game!["textures"];
      const orig = tm.createCanvas.bind(tm);
      let armed = true;
      tm.createCanvas = (key: string, w: number, h: number) => {
        const t = orig(key, w, h);
        if (armed && key === "town-backdrop" && t) {
          armed = false;
          t.getContext = () => null;
        }
        return t;
      };
    });
    await app.tapButton("alley");
    await expect.poll(() => app.log.some((l) => l.includes("[town] failed to build the street"))).toBe(true);
    await expect.poll(() => app.eval(() => window.__e2e.scene!["townOpen"])).toBe(false);
    await expect.poll(() => app.eval(() => !!window.__e2e.town)).toBe(false);
    expect(await app.eval(() => window.__e2e.scene!["input"].enabled)).toBe(true);
    // expected: the warning of the injected failure
    app.errors.splice(0, app.errors.length, ...app.errors.filter((e) => !e.includes("[town] failed to build the street")));
    await app.play([(await app.solution())[0]!]);
    await openTown(app);
    await closeTown(app);
  });

  test("[P1-7] VoiceOver: the open street publishes close + one control per lit house; close closes it", async ({ app }) => {
    await app.seed({ files: { "pips-progress.json": progress(9) }, prefs: { guide: ALL_GUIDES } });
    await app.open();
    await openTown(app);
    const labels = (): Promise<string[]> =>
      app.page.evaluate(() => [...document.querySelectorAll(".a11y-root button")].map((b) => b.getAttribute("aria-label") ?? ""));
    await expect.poll(async () => (await labels()).includes("닫기"), { timeout: 5_000 }).toBe(true);
    expect((await labels()).filter((l) => /^\d+번 집/.test(l)).length).toBeGreaterThan(0);
    // a house control opens its keepsake card
    await app.page.evaluate(() => {
      const b = [...document.querySelectorAll<HTMLButtonElement>(".a11y-root button")].find((x) => /^\d+번 집/.test(x.getAttribute("aria-label") ?? ""));
      b!.click();
    });
    await expect.poll(() => app.eval(() => window.__e2e.townKeepsake()?.asked ?? 0)).toBeGreaterThan(0);
    await app.page.evaluate(() => [...document.querySelectorAll<HTMLButtonElement>(".a11y-root button")].find((x) => x.getAttribute("aria-label") === "닫기")!.click());
    await expect.poll(() => app.eval(() => window.__e2e.scene!["townOpen"]), { timeout: 15_000 }).toBe(false);
    await expect.poll(async () => (await labels()).some((l) => /^\d+번 집/.test(l))).toBe(false);
  });

  test("[P2] a pull-down drag released while the street is already closing does not reopen it", async ({ app }) => {
    await app.seed({ files: { "pips-progress.json": progress(9) }, prefs: { guide: ALL_GUIDES } });
    await app.open();
    await openTown(app);
    await app.page.mouse.move(195, 420);
    await app.page.mouse.down();
    await app.page.mouse.move(195, 440, { steps: 2 });
    await app.page.mouse.move(195, 470, { steps: 3 }); // a vertical pull (sheet 50 pt down, not enough to close)
    await app.eval(() => window.__e2e.town!["close"]()); // e.g. a resize closes it mid-drag
    await app.page.mouse.up();
    await expect.poll(() => app.eval(() => window.__e2e.scene!["townOpen"]), { timeout: 15_000 }).toBe(false);
    expect(await app.eval(() => !!window.__e2e.town)).toBe(false);
  });
});

test.describe("settings", () => {
  test("sound off, dots, time-in-share off: saved to Preferences and restored after a relaunch", async ({ app }) => {
    await app.seed({ prefs: { guide: ALL_GUIDES } });
    await app.open();
    await app.tapButton("gearIcon");
    await expect.poll(() => app.eval(() => window.__e2e.scene!["sheet"].isOpen)).toBe(true);
    await app.page.waitForTimeout(300); // the sheet slides up (240 ms) before its segments are where hit() expects
    for (const k of [1, 3, 5]) await app.tapPoint(await app.page.evaluate((i) => window.__e2e.sheetPoint(i), k));
    await expect.poll(() => app.eval(() => window.__e2e.scene!["sheet"]["sel"])).toEqual({ muted: true, numbers: "dots", shareTime: false });
    await expect.poll(async () => [await app.pref("muted"), await app.pref("numbers"), await app.pref("shareTime")]).toEqual(["1", "dots", "0"]);
    // outside tap closes
    await app.page.mouse.click(195, 60);
    await expect.poll(() => app.eval(() => window.__e2e.scene!["sheet"].isOpen)).toBe(false);
    expect(await app.eval(() => window.__e2e.session!["moves"].length)).toBe(0);
    await app.reload();
    expect(await app.eval(() => window.__e2e.scene!["board"]["numStyle"])).toBe("dots");
    await app.tapButton("gearIcon");
    await expect.poll(() => app.eval(() => window.__e2e.scene!["sheet"]["sel"])).toEqual({ muted: true, numbers: "dots", shareTime: false });
    // and back on
    await app.page.waitForTimeout(300);
    for (const k of [0, 2, 4]) await app.tapPoint(await app.page.evaluate((i) => window.__e2e.sheetPoint(i), k));
    await expect.poll(async () => [await app.pref("muted"), await app.pref("numbers"), await app.pref("shareTime")]).toEqual(["0", "digits", "1"]);
  });
});
