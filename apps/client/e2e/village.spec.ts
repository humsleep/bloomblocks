// R2 village V1 (src/village): open from the left disc → Wick's first-visit line → mailbox →
// Momo's move-in letter → its gift → "put it in my cottage" → the room shows it (and keeps it
// after a relaunch). Gates: G9 (VoiceOver labels for every village control, DOM), G8 (drawer
// cards named after the real items, locked ones say where they come from), G3 (real fonts:
// every line of all 10 locales fits the SE card).
import { ALL_GUIDES, type App, expect, test } from "./fixtures.ts";

const progress = (gentleLevel: number): string =>
  JSON.stringify({ v: 3, game: "pips", track: "gentle", gentle: { level: gentleLevel, cleared: gentleLevel - 1, hints: 0 }, deduce: { level: 1, cleared: 0, hints: 0 } });

type View = { screen: string; card: { who: string; lines: string[]; id: string } | null; unread: number; drawer: { slot: number; cards: string[]; drawn: Array<{ id: string; name: string[]; src: string[] }> } | null; room: (string | null)[]; owned: string[]; residents: string[]; openMs: number };
const view = (app: App): Promise<View | null> => app.eval(() => (window.__e2e.village?.["view"] as View | undefined) ?? null);
const labels = (app: App): Promise<string[]> => app.page.evaluate(() => [...document.querySelectorAll(".a11y-root button")].map((b) => b.getAttribute("aria-label") ?? ""));

async function tapHit(app: App, id: string): Promise<void> {
  const pt = (): Promise<{ x: number; y: number } | null> => app.page.evaluate((i) => window.__e2e.villagePoint(i), id);
  await expect.poll(async () => !!(await pt()), { timeout: 10_000 }).toBe(true);
  await app.tapPoint((await pt())!);
}

async function openVillage(app: App): Promise<void> {
  await app.waitIdle();
  await app.tapButton("leftBtn");
  await expect.poll(() => view(app).then((v) => v?.screen ?? null), { timeout: 15_000 }).toBe("village");
  await app.page.waitForTimeout(350); // the open fade
}

test.describe("village", () => {
  test("open → first-visit line → mailbox letter → gift → put it in my cottage → the room shows it; kept after a relaunch", async ({ app }) => {
    await app.seed({ files: { "pips-progress.json": progress(9) }, prefs: { guide: ALL_GUIDES } });
    await app.open();
    await openVillage(app);
    expect(await app.eval(() => window.__e2e.scene!["townOpen"])).toBe(true);
    expect(await app.eval(() => window.__e2e.scene!["input"].enabled)).toBe(false);
    let v = (await view(app))!;
    expect(v.residents).toEqual(["wick", "momo"]);
    expect(v.card?.id).toBe("wick.host.01");
    expect(v.unread).toBe(3); // Momo's move-in letter + 2 jars (8 boards); Wick's lantern is already in the cottage
    // the second first-visit line on a tap of the card
    await tapHit(app, "card");
    await expect.poll(() => view(app).then((x) => x?.card?.id)).toBe("wick.host.02");
    // talk to Momo: her move-in line, in Korean (the e2e locale)
    await tapHit(app, "res-momo");
    await expect.poll(() => view(app).then((x) => x?.card?.id)).toBe("momo.move_in.01");
    v = (await view(app))!;
    expect(v.card!.lines.join("")).toContain("모모예요");
    // mailbox → Momo's letter (the day's one letter)
    await tapHit(app, "mailbox");
    await expect.poll(() => view(app).then((x) => x?.screen)).toBe("letter");
    await expect.poll(async () => (await labels(app)).some((l) => l.startsWith("모모의 편지"))).toBe(true);
    await tapHit(app, "letter-gift");
    await expect.poll(() => view(app).then((x) => x?.screen)).toBe("gift");
    expect((await view(app))!.owned).toContain("cushion:rose");
    await expect.poll(() => labels(app)).toEqual(expect.arrayContaining(["내 오두막에 놓기", "나중에"]));
    await tapHit(app, "gift-put");
    await expect.poll(() => view(app).then((x) => x?.screen)).toBe("room");
    v = (await view(app))!;
    expect(v.room[12]).toBe("cushion:rose"); // front row, middle
    await expect.poll(async () => (await labels(app)).some((l) => l.startsWith("앞줄 가운데: 꽃잎 방석"))).toBe(true);
    // the cottage came furnished: Wick's lantern, the pot, the tea table, the rug (Reality G1 #14)
    expect(v.room[1]).toBe("paperLantern:cream");
    expect(v.room[7]).toBe("teaTable:cream");
    // the next mail is a tagged gift (one letter a day)
    await tapHit(app, "room-back");
    await expect.poll(() => view(app).then((x) => x?.screen)).toBe("village");
    await tapHit(app, "mailbox");
    await expect.poll(() => view(app).then((x) => x?.screen)).toBe("gift");
    await tapHit(app, "gift-later");
    await expect.poll(() => view(app).then((x) => x?.unread)).toBe(1);
    // close: input back to the board
    await tapHit(app, "back");
    await expect.poll(() => app.eval(() => window.__e2e.scene!["townOpen"]), { timeout: 10_000 }).toBe(false);
    expect(await app.eval(() => window.__e2e.scene!["input"].enabled)).toBe(true);
    expect(await app.eval(() => !!window.__e2e.village)).toBe(false);
    // relaunch: the cushion is still there, the opened mail stays opened
    await app.reload();
    await openVillage(app);
    v = (await view(app))!;
    expect(v.unread).toBe(1);
    await tapHit(app, "cottage");
    await expect.poll(() => view(app).then((x) => x?.room[12] ?? null)).toBe("cushion:rose");
  });

  test("G8 + G9: the drawer names the real items, locked cards say where they come from; every control has a label", async ({ app }) => {
    await app.seed({ files: { "pips-progress.json": progress(4) }, prefs: { guide: ALL_GUIDES } });
    await app.open();
    await openVillage(app);
    await expect.poll(async () => (await labels(app)).includes("말 걸기: 모모")).toBe(true);
    const ls = await labels(app);
    for (const l of ["퍼즐로 돌아가기", "말 걸기: 윅", "말 걸기: 모모", "내 오두막에 들어가기"]) expect(ls).toContain(l);
    expect(ls.some((l) => l.startsWith("우편함"))).toBe(true);
    expect(ls.some((l) => l.startsWith("빈 집"))).toBe(true);
    expect(ls.some((l) => l.startsWith("등불 병"))).toBe(true);
    expect(ls.some((l) => l.startsWith("윅: "))).toBe(true); // the dialogue card: "name: line"
    await tapHit(app, "cottage");
    await expect.poll(() => view(app).then((x) => x?.screen)).toBe("room");
    // 18 slots + the rug; the starter cottage fills 3 slots and the rug
    await expect.poll(async () => (await labels(app)).filter((l) => /, 비어 있음$/.test(l)).length).toBe(15);
    expect((await labels(app)).some((l) => l.startsWith("러그 자리: 둥근 러그"))).toBe(true);
    await tapHit(app, "slot-12");
    await expect.poll(() => view(app).then((x) => x?.drawer?.slot ?? null)).toBe(12);
    const d = (await view(app))!.drawer!;
    expect(d.cards).not.toContain("wallClock"); // floor slot: no wall pieces
    await expect.poll(async () => (await labels(app)).includes("닫기")).toBe(true);
    const dl = await labels(app);
    expect(dl).toContain("닫기");
    // every floor card has its real name; a locked one says where it comes from (G8)
    for (const name of ["종이 등불", "아치 의자", "꽃잎 방석", "찻상", "작은 침대", "작은 화분", "꽃병", "책장", "둥근 러그", "찻주전자"]) {
      expect(dl.some((l) => l.includes(name)), name).toBe(true);
    }
    expect(dl.some((l) => l.startsWith("꽃잎 방석, 장미색: 아직 없어요. 이사 선물: 모모"))).toBe(true);
    expect(dl.some((l) => l.includes("등불 병 선물로 와요"))).toBe(true);
    // …and the card DRAWS it, not only VoiceOver (Reality G1 #19): locked cards carry their source line
    const drawn = (await view(app))!.drawer!.drawn;
    expect(drawn.find((c) => c.id === "cushion")!.src.join(" ")).toBe("모모에게서");
    // "등불 병" is one word: a no-break space keeps it on one line (G1 re-review 2 #7)
    expect(drawn.find((c) => c.id === "archChair")!.src.join(" ")).toBe("등불\u00a0병을 채우면");
    expect(drawn.find((c) => c.id === "teaTable")!.src).toEqual([]); // owned (starter): colour dots instead
    // owned cards come first
    const firstLocked = drawn.findIndex((c) => c.src.length > 0);
    expect(drawn.slice(firstLocked).every((c) => c.src.length > 0)).toBe(true);
    // the wall: only wall pieces
    await tapHit(app, "drawer-close");
    await tapHit(app, "slot-16");
    await expect.poll(() => view(app).then((x) => x?.drawer?.cards ?? null)).toEqual(["wallClock", "frame", "stringLights", "hangingPlant", "wreath"]);
    // nothing in the layer is unlabeled
    expect((await labels(app)).every((l) => l.length > 0)).toBe(true);
  });

  // full village (round 3): market, requests, visitors, the room postcard
  const DAY = Math.floor(Date.UTC(2026, 9, 14) / 86_400_000); // 2026-10-14 (the seeded local date)
  const villageSave = (sv: Record<string, unknown>, loc: Record<string, unknown> = {}): string =>
    JSON.stringify({ sv: { pd: [DAY], ch: [], lr: [], u: [], mk: [], q: [], w: [], r: {}, ...sv }, loc: { visits: 3, lastVisit: DAY - 1, season: "autumn", ...loc } });

  test("market: one stall, three pieces today (no prices), pick one → the reveal → it is owned; the stall closes for today", async ({ app }) => {
    await app.seed({ now: "2026-10-14T19:00:00", files: { "pips-progress.json": progress(9) }, prefs: { guide: ALL_GUIDES, village: villageSave({}) } });
    await app.open();
    await openVillage(app);
    await expect.poll(async () => (await labels(app)).includes("장터")).toBe(true);
    await tapHit(app, "stall");
    await expect.poll(() => view(app).then((x) => x?.screen)).toBe("market");
    // the VoiceOver layer is rebuilt a frame after the screen switches
    await expect.poll(async () => (await labels(app)).filter((l) => l.startsWith("고르기: ") || l.includes(": 이미 가지고 있어요")).length).toBe(3);
    const before = (await view(app))!.owned.length;
    const i = (await labels(app)).filter((l) => l.startsWith("고르기: ") || l.includes("이미 가지고")).findIndex((l) => l.startsWith("고르기: "));
    await tapHit(app, `offer-${i}`);
    await expect.poll(() => view(app).then((x) => x?.screen)).toBe("gift");
    expect((await view(app))!.owned.length).toBe(before + 1);
    await tapHit(app, "gift-later");
    await expect.poll(async () => (await labels(app)).includes("장터, 내일 또 와요")).toBe(true);
    // synced: today's day in v.mk, the piece in v.u
    const saved = JSON.parse((await app.eval(() => window.__e2e.fakes.prefs.get("village") ?? "{}")) as string) as { sv: { mk: number[]; u: number[] } };
    expect(saved.sv.mk).toContain(DAY);
    expect(saved.sv.u.length).toBe(1);
  });

  test("requests: Momo's open request shows a bubble; a seat in the cottage fulfils it → Momo visits (her line), a thank-you letter waits; the room postcard shares", async ({ app }) => {
    // Momo asked for something to sit on (request id 2 → bit 4); her move-in letter (mail 1) is opened: the cushion is owned
    await app.seed({ now: "2026-10-14T19:00:00", files: { "pips-progress.json": progress(9) }, prefs: { guide: ALL_GUIDES, village: villageSave({ q: [4], lr: [1] }) } });
    await app.open();
    await openVillage(app);
    await expect.poll(async () => (await labels(app)).includes("모모의 부탁: 앉을 자리")).toBe(true);
    await tapHit(app, "cottage");
    await expect.poll(() => view(app).then((x) => x?.screen)).toBe("room");
    await tapHit(app, "slot-12");
    await expect.poll(() => view(app).then((x) => x?.drawer?.slot ?? null)).toBe(12);
    await tapHit(app, "card-cushion");
    await expect.poll(() => view(app).then((x) => x?.room[12] ?? null)).toBe("cushion:rose");
    // fulfilled: Momo comes over and says her visit line
    await expect.poll(() => view(app).then((x) => x?.card?.id ?? null)).toBe("momo.request.visit.01");
    await expect.poll(async () => (await labels(app)).includes("놀러 온 이웃: 모모")).toBe(true);
    const saved = JSON.parse((await app.eval(() => window.__e2e.fakes.prefs.get("village") ?? "{}")) as string) as { sv: { q: number[] } };
    expect(saved.sv.q).toEqual([4, 5]);
    // the room postcard: image + text with the link (ct=room), spoiler-free
    await tapHit(app, "postcard");
    await expect.poll(() => app.eval(() => window.__e2e.fakes.shares.length)).toBe(1);
    const sh = await app.eval(() => window.__e2e.fakes.shares[0]!);
    expect(sh.text).toContain("ct=room");
    expect(sh.files?.[0]).toMatch(/duskwick-room-2026-10-14\.png$/);
    // the thank-you letter waits in the mailbox
    await tapHit(app, "room-back");
    await expect.poll(async () => (await labels(app)).includes("우편함, 새 우편 있음")).toBe(true);
  });

  test("time and season: the village opens in the hour's light and the hemisphere's season (picker, art environment)", async ({ app }) => {
    await app.seed({ now: "2026-10-14T06:30:00", files: { "pips-progress.json": progress(9) }, prefs: { guide: ALL_GUIDES, village: villageSave({}) } });
    await app.open();
    await openVillage(app);
    const env = await app.eval(() => window.__e2e.village!["env"] as { time: string; season: string; hemisphere: string });
    expect(env).toMatchObject({ time: "dawn", season: "autumn", hemisphere: "north" });
  });

  test("R3 P1-1: the room's dialogue card never covers the open drawer; it shows again when the drawer closes", async ({ app }) => {
    await app.seed({ files: { "pips-progress.json": progress(4) }, prefs: { guide: ALL_GUIDES } });
    await app.open();
    await openVillage(app);
    await tapHit(app, "cottage");
    // first cottage visit: Wick's "This is your room…" card
    await expect.poll(() => view(app).then((x) => x?.card?.id ?? null)).toBe("wick.host.07");
    expect(await app.eval(() => window.__e2e.village!["cardImg"].visible as boolean)).toBe(true);
    await tapHit(app, "slot-13");
    await expect.poll(() => view(app).then((x) => x?.drawer?.slot ?? null)).toBe(13);
    expect(await app.eval(() => window.__e2e.village!["cardImg"].visible as boolean)).toBe(false);
    expect((await labels(app)).some((l) => l.startsWith("윅: "))).toBe(false);
    await tapHit(app, "drawer-close");
    await expect.poll(() => view(app).then((x) => x?.drawer ?? null)).toBeNull();
  });

  test("Korean letter tracking: −0.10 em drawn the same with canvas letterSpacing and with the glyph-by-glyph fallback (iOS without letterSpacing)", async ({ app }) => {
    await app.open();
    const r = await app.page.evaluate(async () => {
      const m = await window.__e2e.villageScene();
      const ink = (track: number, fallback: boolean): number => {
        (globalThis as { __noCanvasLetterSpacing?: boolean }).__noCanvasLetterSpacing = fallback;
        const c = document.createElement("canvas");
        c.width = 600;
        c.height = 60;
        const g = c.getContext("2d")!;
        g.font = "500 24px sans-serif";
        g.fillStyle = "#000";
        g.textBaseline = "alphabetic";
        m.drawTracked(g, "저, 안녕하세요, 이웃님", 10, 40, track, "left");
        const d = g.getImageData(0, 0, 600, 60).data;
        let right = 0;
        for (let x = 0; x < 600; x++) for (let y = 0; y < 60; y++) if (d[(y * 600 + x) * 4 + 3]! > 40) right = Math.max(right, x);
        (globalThis as { __noCanvasLetterSpacing?: boolean }).__noCanvasLetterSpacing = false;
        return right;
      };
      return { plain: ink(0, false), native: ink(-2.4, false), fallback: ink(-2.4, true), supported: m.canvasTracking() };
    });
    // 12 graphemes × −2.4 px ≈ −26 px narrower, whichever way it is drawn (±2 px)
    expect(r.plain - r.fallback).toBeGreaterThan(20);
    if (r.supported) expect(Math.abs(r.native - r.fallback)).toBeLessThanOrEqual(3);
  });

  test("step 16: the backdrop's draw steps give the same picture sliced as in one go (other kit draws and RNG use in between change nothing)", async ({ app }) => {
    await app.open();
    const r = await app.page.evaluate(async () => {
      const [kit, shade] = await window.__e2e.villageKit();
      const W = 393;
      const H = 852;
      const paint = (time: "dawn" | "day" | "dusk" | "night", season: "spring" | "winter" | "autumn", sliced: boolean): Uint8ClampedArray => {
        const c = document.createElement("canvas");
        c.width = W * 2;
        c.height = H * 2;
        const g = c.getContext("2d")!;
        g.setTransform(2, 0, 0, 2, 0, 0);
        const steps = kit.villageArt.drawVillageBackdropSteps(g, { x: 0, y: 0, w: W, h: H }, { time, season });
        for (const step of steps) {
          step();
          if (sliced) {
            // what can run between two idle slices: the RNG moved, another kit drawing on another canvas
            shade.reseed(12345);
            shade.rnd();
            const o = document.createElement("canvas").getContext("2d")!;
            kit.villageArt.drawLanternHouse(o, { resident: "wick", lit: true, eve: false, seed: 3 }, { x: 0, y: 0, w: 60, h: 80 });
          }
        }
        return g.getImageData(0, 0, W * 2, H * 2).data;
      };
      const out: Array<{ time: string; steps: number; diff: number; noise: number }> = [];
      for (const [time, season] of [["dusk", "autumn"], ["night", "winter"], ["day", "spring"], ["dawn", "autumn"]] as const) {
        const a = paint(time, season, false);
        const a2 = paint(time, season, false); // the browser's own run-to-run noise (WebKit's blends are not bit-stable)
        const b = paint(time, season, true);
        let diff = 0;
        let noise = 0;
        for (let i = 0; i < a.length; i++) {
          if (a[i] !== b[i]) diff++;
          if (a[i] !== a2[i]) noise++;
        }
        out.push({ time, steps: kit.villageArt.drawVillageBackdropSteps(document.createElement("canvas").getContext("2d")!, { x: 0, y: 0, w: W, h: H }).length, diff, noise });
      }
      return out;
    });
    for (const x of r) {
      expect(x.steps, x.time).toBeGreaterThanOrEqual(8);
      expect(x.diff, `${x.time}: sliced ≠ one go (noise ${x.noise})`).toBeLessThanOrEqual(x.noise);
    }
  });

  test("G3: every village line of all 10 locales fits the 375 pt card with this browser's fonts", async ({ app }) => {
    await app.open();
    const r = await app.page.evaluate(async () => (await window.__e2e.villageG3()).runG3());
    expect(r.failures).toEqual([]);
    expect(r.checked).toBeGreaterThan(1000);
    expect(r.maxLines).toBeLessThanOrEqual(3);
  });
});
