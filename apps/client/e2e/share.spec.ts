// R2 (decision A5): the postcard result sheet, the share text with its link, the share IMAGE
// (pixel test: no board in it — two different boards with the same story bake byte-identical
// pixels), and deep links routed through the fake @capacitor/app (appUrlOpen / getLaunchUrl).
import { ALL_GUIDES, type App, expect, test } from "./fixtures.ts";

const TODAY = "2026-11-14"; // daily #14
const progress = (n: number): string =>
  JSON.stringify({ v: 3, game: "pips", track: "gentle", gentle: { level: n, cleared: n - 1, hints: 0 }, deduce: { level: 1, cleared: 0, hints: 0 } });

async function openToday(app: App): Promise<void> {
  await app.waitIdle();
  await app.tapButton("todayBtn");
  await expect.poll(() => app.eval(() => window.__e2e.session!["daily"])).toBe(TODAY);
  await app.waitIdle();
}

/** A wrong lantern placed and taken back, then the solution in order (the strip: keep… fixed … keep). */
async function playStory(app: App): Promise<void> {
  const sol = await app.solution();
  const floor = await app.eval(() => {
    const lv = window.__e2e.session!["level"] as { w: number; h: number; stones: { lo: number; hi: number } };
    const out: number[] = [];
    for (let r = 0; r < lv.h; r++)
      for (let c = 0; c < lv.w; c++) {
        const i = r * 8 + c;
        if ((((i < 32 ? lv.stones.lo >>> i : lv.stones.hi >>> (i - 32)) & 1) as number) === 0) out.push(i);
      }
    return out;
  });
  const wrong = floor.find((c) => !sol.includes(c))!;
  await app.play([sol[0]!, wrong, wrong]);
  await app.solve();
  await expect.poll(() => app.eval(() => !!window.__e2e.scene!["card"]?.isOpen), { timeout: 20_000 }).toBe(true);
}

async function linkListener(app: App): Promise<void> {
  await expect.poll(() => app.eval(() => window.__e2e.fakes.listeners.get("appUrlOpen")?.length ?? 0), { timeout: 15_000 }).toBeGreaterThan(0);
}

test.describe("postcard + share (A5)", () => {
  test("the postcard sheet: each fact once, #n on the postmark; Share sends the text with the link AND the postcard image", async ({ app }) => {
    await app.seed({ now: `${TODAY}T10:00:00`, files: { "pips-progress.json": progress(9) }, prefs: { guide: ALL_GUIDES } });
    await app.open();
    await openToday(app);
    await playStory(app);
    const card = await app.eval(() => {
      const c = window.__e2e.scene!["card"];
      return { labels: [c["lblTime"].text, c["lblStreak"].text, c["lblShield"].text, c["homeTxt"].text], num: c["numText"], spec: c["spec"], streak: c["streakText"] };
    });
    // ko-KR: labels without numbers (the values say them, once)
    expect(card.labels).toEqual(["시간", "연속 기록", "보호막", "계속"]);
    expect(card.num).toBe("#14");
    expect(Object.keys(card.spec).sort()).toEqual(["dateISO", "hints", "houseKey", "moon8", "n", "streak", "strip", "time"]);
    expect(card.spec.houseKey).toMatch(/^lanterns-pips:daily:g\d+:2026-11-14$/);
    // the story: first lantern kept, the wrong one taken back ("fixed"), the rest kept
    expect(card.spec.strip[0]).toBe("keep");
    expect(card.spec.strip[1]).toBe("fixed");
    expect(card.spec.strip.filter((c: string) => c === "fixed")).toHaveLength(1);
    // VoiceOver reaches the postcard itself
    await expect.poll(() => app.page.evaluate(() => [...document.querySelectorAll(".a11y-root button, .a11y-root [aria-label]")].some((b) => (b.getAttribute("aria-label") ?? "").startsWith("엽서")))).toBe(true);
    // share
    const n0 = await app.eval(() => window.__e2e.fakes.shares.length);
    await app.tapPoint(await app.eval(() => window.__e2e.cardPoint("share")));
    await expect.poll(() => app.eval(() => window.__e2e.fakes.shares.length)).toBe(n0 + 1);
    const sh = await app.eval(() => window.__e2e.fakes.shares.at(-1)!);
    expect(sh.text).toMatch(/^Duskwick #14 \S+\n✨ ⏱ \d+:\d\d 🔥1\nhttps:\/\/humsleep\.github\.io\/apps\/duskwick\/14\?ct=share$/u);
    expect(sh.files).toHaveLength(1);
    expect(sh.files![0]).toMatch(/^fake:\/\/CACHE\/share\/duskwick-14\.png$/);
    // the attached PNG is the 1080×1350 postcard
    const size = await app.page.evaluate(async (uri) => {
      const b64 = window.__e2e.fakes.files.get(uri.replace(/^fake:\/\//, ""))!.data;
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      return [img.naturalWidth, img.naturalHeight];
    }, sh.files![0]!);
    expect(size).toEqual([1080, 1350]);
  });

  test("pixel test: no lantern position or cell of today's board can be read from the postcard", async ({ app }) => {
    await app.seed({ now: `${TODAY}T10:00:00`, files: { "pips-progress.json": progress(9) }, prefs: { guide: ALL_GUIDES } });
    await app.open();
    await openToday(app);
    await playStory(app);
    await app.tapPoint(await app.eval(() => window.__e2e.cardPoint("share")));
    await expect.poll(() => app.eval(() => window.__e2e.fakes.shares.length)).toBe(1);
    const res = await app.page.evaluate(async () => {
      const pc = await window.__e2e.postcard();
      const api = await window.__e2e.api();
      const s = window.__e2e.scene!;
      const r = s["ds"]["result"];
      const hintAt = s["ds"]["hintAt"] ?? [];
      const cells: number[] = api.moveCells(window.__e2e.session!["moves"]);
      // ANOTHER board: every cell relabelled by a random bijection of 0..63 (positions all different)
      const perm = [...Array(64).keys()];
      for (let i = 63; i > 0; i--) {
        const j = (i * 7919 + 13) % (i + 1);
        [perm[i], perm[j]] = [perm[j]!, perm[i]!];
      }
      const other = cells.map((c) => perm[c]!);
      const moved = cells.some((c, i) => c !== other[i]);
      const words = { time: "Time", streak: "Streak", noHints: "No hints", order: "Lanterns, in order", yourTurn: "Your turn!", date: "Nov 14", link: "humsleep.github.io/apps/duskwick/14", font: "system-ui" };
      const bake = (spec: ReturnType<typeof pc.postcardSpec>): Uint8ClampedArray => {
        const c = document.createElement("canvas");
        c.width = pc.SHARE_W;
        c.height = pc.SHARE_H;
        const ctx = c.getContext("2d")!;
        pc.drawSharePostcard(ctx, spec, words);
        return ctx.getImageData(0, 0, c.width, c.height).data;
      };
      const bakeSheet = (spec: ReturnType<typeof pc.postcardSpec>): Uint8ClampedArray => {
        const g = pc.sheetCardGeo(686, 180, 2, false);
        const c = document.createElement("canvas");
        c.width = g.w;
        c.height = g.h;
        const ctx = c.getContext("2d")!;
        pc.drawSheetCard(ctx, g, spec, words, 2);
        return ctx.getImageData(0, 0, c.width, c.height).data;
      };
      const same = (a: Uint8ClampedArray, b: Uint8ClampedArray): boolean => a.length === b.length && a.every((v, i) => v === b[i]);
      const A = pc.postcardSpec(r, cells, hintAt);
      const B = pc.postcardSpec(r, other, hintAt);
      // control: a DIFFERENT story must change the pixels (the comparison is not blind)
      const C = pc.postcardSpec(r, [...cells, cells[0]!, cells[0]!], hintAt);
      // the real attached image = the spec's bake (the image carries nothing else)
      const real = window.__e2e.fakes.files.get(window.__e2e.fakes.shares[0]!.files![0]!.replace(/^fake:\/\//, ""))!.data;
      const realSpec = pc.postcardSpec(r, cells, hintAt, true);
      return {
        moved,
        shareSame: same(bake(A), bake(B)),
        sheetSame: same(bakeSheet(A), bakeSheet(B)),
        controlDiffers: !same(bake(A), bake(C)),
        // decoded pixels (WebKit's PNG bytes may differ between encodes): ≤ 0.1 % of pixels off by more than 2 levels
        realOff: await (async () => {
          const again = pc.bakeSharePng(realSpec, (await window.__e2e.resultSheet()).postcardWords(r.dateISO))!;
          const px = async (b64: string): Promise<Uint8ClampedArray> => {
            const img = new Image();
            img.src = `data:image/png;base64,${b64}`;
            await img.decode();
            const c = document.createElement("canvas");
            c.width = img.naturalWidth;
            c.height = img.naturalHeight;
            const ctx = c.getContext("2d")!;
            ctx.drawImage(img, 0, 0);
            return ctx.getImageData(0, 0, c.width, c.height).data;
          };
          const [a, b] = [await px(real), await px(again)];
          if (a.length !== b.length) return 1;
          let off = 0;
          for (let i = 0; i < a.length; i += 4) if (Math.max(Math.abs(a[i]! - b[i]!), Math.abs(a[i + 1]! - b[i + 1]!), Math.abs(a[i + 2]! - b[i + 2]!)) > 2) off++;
          return off / (a.length / 4);
        })(),
        keys: Object.keys(A).sort().join(","),
      };
    });
    expect(res!.moved).toBe(true);
    expect(res!.shareSame).toBe(true);
    expect(res!.sheetSame).toBe(true);
    expect(res!.controlDiffers).toBe(true);
    expect(res!.realOff).toBeLessThanOrEqual(0.001);
    expect(res!.keys).toBe("dateISO,hints,houseKey,moon8,n,streak,strip,time");
  });
});

test.describe("deep links (A5)", () => {
  test("a link opens today's daily — today's #n, a past #n and a future #n alike (1.0 has no archive)", async ({ app }) => {
    await app.seed({ now: `${TODAY}T10:00:00`, files: { "pips-progress.json": progress(9) }, prefs: { guide: ALL_GUIDES } });
    await app.open();
    await app.waitIdle();
    await linkListener(app);
    for (const url of ["https://humsleep.github.io/apps/duskwick/14?ct=share", "duskwick://daily/3", "duskwick://daily/99"]) {
      await app.page.evaluate((u) => window.__e2e.fakes.fire("appUrlOpen", { url: u }), url);
      await expect.poll(() => app.eval(() => window.__e2e.session!["daily"]), { timeout: 15_000 }).toBe(TODAY);
      await app.waitIdle();
      // back to the track for the next link
      await app.tapButton("backChip");
      await expect.poll(() => app.eval(() => window.__e2e.session!["daily"]), { timeout: 10_000 }).toBeNull();
      await app.waitIdle();
      await app.page.waitForTimeout(2100); // the 2 s duplicate guard is per URL; different URLs anyway
    }
    // not ours: nothing happens
    await app.page.evaluate(() => window.__e2e.fakes.fire("appUrlOpen", { url: "https://example.com/duskwick/14" }));
    await app.page.waitForTimeout(800);
    expect(await app.eval(() => window.__e2e.session!["daily"])).toBeNull();
  });

  test("cold start from a link (getLaunchUrl) opens today's daily after the first frame", async ({ app }) => {
    await app.seed({ now: `${TODAY}T10:00:00`, files: { "pips-progress.json": progress(9) }, prefs: { guide: ALL_GUIDES } });
    await app.page.addInitScript(() => window.localStorage.setItem("__fake:launchUrl", "duskwick://daily/14"));
    await app.open();
    await expect.poll(() => app.eval(() => window.__e2e.session!["daily"]), { timeout: 20_000 }).toBe(TODAY);
  });

  test("a solved day: the link shows the lit board and its postcard (no replay)", async ({ app }) => {
    await app.seed({ now: `${TODAY}T10:00:00`, files: { "pips-progress.json": progress(9) }, prefs: { guide: ALL_GUIDES } });
    await app.open();
    await openToday(app);
    await playStory(app);
    await app.tapPoint(await app.eval(() => window.__e2e.cardPoint("home")));
    await expect.poll(() => app.eval(() => window.__e2e.session!["daily"]), { timeout: 10_000 }).toBeNull();
    await app.waitIdle();
    await linkListener(app);
    await app.page.evaluate(() => window.__e2e.fakes.fire("appUrlOpen", { url: "duskwick://today" }));
    await expect.poll(() => app.eval(() => window.__e2e.session!["daily"]), { timeout: 15_000 }).toBe(TODAY);
    await expect.poll(() => app.eval(() => !!window.__e2e.scene!["card"]?.isOpen), { timeout: 20_000 }).toBe(true);
    expect(await app.eval(() => window.__e2e.session!["complete"])).toBe(true);
  });

  test("a brand-new player is not pulled out of the first lessons", async ({ app }) => {
    await app.seed({ now: `${TODAY}T10:00:00` });
    await app.open();
    await linkListener(app);
    await app.page.evaluate(() => window.__e2e.fakes.fire("appUrlOpen", { url: "https://humsleep.github.io/apps/duskwick/14" }));
    await app.page.waitForTimeout(3000);
    expect(await app.eval(() => window.__e2e.session!["daily"])).toBeNull();
  });
});
