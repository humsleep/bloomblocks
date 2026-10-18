// Core play loop through real canvas taps: guide, a full level → finale → next level,
// conflict, over-full, stuck culprit, hints (remove / place), undo, reload → resume.
// Gentle 1 (5×5, generated deterministically) is
//   . . . . .        cells (y*8+x): row 0 = 0..4, row 1 = 8..12, …
//   . . 2 . .        2 at 10, 1 at 16, # at 20, 4 at 26
//   1 . . . #
//   . . 4 . .
//   . . . . .
// Every test asserts its preconditions on the live level instead of trusting this map.
import { ALL_GUIDES, type App, expect, test } from "./fixtures.ts";

const at = (x: number, y: number): number => y * 8 + x;

async function gentle1(app: App, prefs: Record<string, string> = { guide: ALL_GUIDES }): Promise<void> {
  await app.seed({ prefs });
  await app.open();
  expect(await app.eval(() => [window.__e2e.session!["track"], window.__e2e.session!["levelNumber"]])).toEqual(["gentle", 1]);
}

/** Visible rig state of the lantern on `cell` (BoardView internals). */
function rigOf(app: App, cell: number): Promise<{ conflict: boolean; blame: boolean; overAdj: boolean } | null> {
  return app.page.evaluate((c) => {
    const r = (window.__e2e.scene!["board"]["rigs"] as Array<Record<string, unknown>>).find((x) => x["cell"] === c && x["mode"] !== 0);
    return r ? { conflict: !!r["conflict"], blame: !!r["blame"], overAdj: !!r["overAdj"] } : null;
  }, cell);
}

/** The tutorial's state (step 1–5, 6 = end card; the cell its hand shows; the band's words). */
function tut(app: App): Promise<{ step: number; target: number; band: string; lanterns: number } | null> {
  return app.page.evaluate(() => {
    const t = window.__e2e.scene!["tut"];
    return t ? { step: t.step as number, target: t.target as number, band: t.bandText as string, lanterns: (t["state"]["lanterns"]["lo"] as number) >>> 0 } : null;
  });
}
async function tapTut(app: App, cell: number): Promise<void> {
  const p = await app.page.evaluate((c) => {
    const q = window.__e2e.scene!["tut"].cellPoint(c) as { x: number; y: number };
    return window.__e2e.toClient(q.x, q.y);
  }, cell);
  await app.page.mouse.click(p.x, p.y);
}
/** Wait for the tutorial to ask for a tap on `cell` (its hand / frame is on it), then tap it. */
async function tutStep(app: App, cell: number): Promise<void> {
  await expect.poll(async () => (await tut(app))?.target, { timeout: 20_000 }).toBe(cell);
  await tapTut(app, cell);
}

test.describe("first run (v11 first-yard tutorial)", () => {
  test("cold launch → T1–T5 by the player's own taps (a wrong tap is blocked, two wrong → the guide does it) → gentle 1; nothing is counted", async ({ app }) => {
    await gentle1(app, {});
    // the tutorial owns the screen: the real board waits hidden, the band speaks Korean (ko-KR)
    await expect.poll(async () => (await tut(app))?.step, { timeout: 20_000 }).toBe(1);
    expect((await tut(app))!.band).toBe("칸을 눌러 등불을 놓아요.");
    expect(await app.eval(() => window.__e2e.scene!["board"].root.alpha)).toBe(0);
    await tutStep(app, at(2, 0));
    // T2: a lit tile is refused (not applied) and explained; then the player's own two lanterns
    await expect.poll(async () => (await tut(app))?.target, { timeout: 20_000 }).toBe(at(2, 2));
    const before = (await tut(app))!.lanterns;
    await tapTut(app, at(0, 0));
    await expect.poll(async () => (await tut(app))!.band).toContain("이미 밝은 칸이에요.");
    expect((await tut(app))!.lanterns).toBe(before);
    await tapTut(app, at(2, 2));
    await tutStep(app, at(1, 0));
    // T3: the guide places the extra lantern; the player takes it back, then lights the two dark tiles
    await tutStep(app, at(3, 0));
    await tutStep(app, at(1, 1));
    await tutStep(app, at(3, 1));
    // T4: the number
    await expect.poll(async () => (await tut(app))?.step, { timeout: 20_000 }).toBe(4);
    await tutStep(app, at(0, 1));
    await tutStep(app, at(2, 2));
    // T5: the 0 — two wrong taps next to it, then the guide makes the move
    await expect.poll(async () => (await tut(app))?.target, { timeout: 20_000 }).toBe(at(2, 0));
    await tapTut(app, at(1, 0));
    await expect.poll(async () => (await tut(app))!.band).toContain("0 옆은 비워 둬요.");
    await tapTut(app, at(1, 0));
    await expect.poll(async () => (await tut(app))?.step, { timeout: 20_000 }).toBe(6);
    // the end card → Start
    const b = await app.page.evaluate(() => {
      const q = window.__e2e.scene!["tut"].cardButton as { x: number; y: number };
      return window.__e2e.toClient(q.x, q.y);
    });
    await app.page.mouse.click(b.x, b.y);
    await expect.poll(() => app.eval(() => window.__e2e.scene!["tut"])).toBeNull();
    // learned for good (tutorial + the old goal card / tap lesson bits); gentle 1 untouched; no ads unit
    expect(Number(await app.pref("guide")) & (256 | 16 | 1)).toBe(256 | 16 | 1);
    expect(await app.eval(() => [window.__e2e.session!["levelNumber"], window.__e2e.session!["moves"].length])).toEqual([1, 0]);
    expect(await app.journalMoves("gentle")).toEqual([]);
    const ads = await app.pref("ads.state.v1");
    expect(ads === null ? 0 : (JSON.parse(ads) as { units: number }).units).toBe(0);
    await expect.poll(() => app.eval(() => window.__e2e.scene!["board"].root.alpha)).toBe(1);
    expect(await app.eval(() => window.__e2e.scene!["flowLog"].includes("tutorial-done"))).toBe(true);
    // a relaunch does not show it again
    await app.reload();
    await app.page.waitForTimeout(1500);
    expect(await tut(app)).toBeNull();
  });

  test("an existing player (progress > 0) never gets the tutorial by itself", async ({ app }) => {
    const prog = JSON.stringify({ v: 3, game: "pips", track: "gentle", gentle: { level: 2, cleared: 1, hints: 0 }, deduce: { level: 1, cleared: 0, hints: 0 } });
    await app.seed({ files: { "pips-progress.json": prog } });
    await app.open();
    await app.page.waitForTimeout(1500);
    expect(await tut(app)).toBeNull();
    expect(await app.eval(() => window.__e2e.scene!["board"].root.alpha)).toBe(1);
  });
});

test.describe("a full level", () => {
  test("solve gentle 1 with taps → finale → gentle 2 (digit lesson), run.bin + progress saved", async ({ app }) => {
    await gentle1(app, { guide: "29" }); // goal + tap + conflict done: the digit lesson is still due on gentle 2
    const sol = await app.solution();
    expect(sol.length).toBeGreaterThan(3);
    await app.play(sol.slice(0, -1));
    expect(await app.eval(() => window.__e2e.scene!["finale"])).toBeNull();
    await app.play(sol.slice(-1));
    expect(await app.eval(() => window.__e2e.session!["complete"])).toBe(true);
    expect(await app.eval(() => window.__e2e.scene!["finale"] !== null)).toBe(true);
    // v11: gentle 1–3 wait for "Next house →" (novice.spec), then the next house comes in
    await app.tapNext();
    await expect.poll(() => app.eval(() => window.__e2e.session!["levelNumber"])).toBe(2);
    await app.waitIdle();
    expect(await app.lanterns()).toEqual([]);
    await expect.poll(() => app.progress()).toMatchObject({ gentle: { level: 2, cleared: 1 } });
    expect(await app.file("runs/p5-00000001.bin")).not.toBeNull();
    const verified = await app.eval(async () => {
      const rl = await window.__e2e.runlog();
      const api = await window.__e2e.api();
      const raw = window.__e2e.fakes.files.get("LIBRARY/lanternly/runs/p5-00000001.bin")!;
      const bytes = Uint8Array.from(atob(raw.data), (c) => c.charCodeAt(0));
      const v = rl.verifyRun(api.lanternsPips, bytes, api.levelForTrack("gentle", 1));
      return v.ok && v.complete;
    });
    expect(verified).toBe(true);
    await expect.poll(() => app.file("pips-gentle-journal.log")).toMatch(/^PPJ1 00000002 /);
    // gentle 2 teaches the digit rock
    await expect.poll(() => app.eval(() => window.__e2e.scene!["guide"].active?.kind ?? null), { timeout: 20_000 }).toBe("digit");
  });

  // The tower's first-unlock look (guide 29: track bit on, tower not seen) starts by itself after a
  // quiet moment. It used to start 1.2 s after the scene was CREATED — on WebKit often right when
  // the board became playable — and swallow the first taps (no input while the camera moves).
  test("the tower's first-unlock look never eats a tap: a touch during it hands the board back and counts", async ({ app }) => {
    await gentle1(app, { guide: "29" });
    await expect.poll(() => app.eval(() => window.__e2e.scene!["travel"]?.kind ?? null), { timeout: 10_000, intervals: [20] }).toBe("reveal");
    const sol = await app.solution();
    await app.tapCell(sol[0]!);
    await expect.poll(() => app.eval(() => window.__e2e.session!["moves"].length)).toBe(1);
    expect(await app.eval(() => [window.__e2e.scene!["travel"], window.__e2e.scene!.cameras.main.zoom])).toEqual([null, 1]);
    expect(await app.lanterns()).toEqual([sol[0]]);
  });

  test("a tap during the finale skips straight to the next level", async ({ app }) => {
    // gentle 4 (1–3 wait for "Next house →" since v11)
    const prog = JSON.stringify({ v: 3, game: "pips", track: "gentle", gentle: { level: 4, cleared: 3, hints: 0 }, deduce: { level: 1, cleared: 0, hints: 0 } });
    await app.seed({ files: { "pips-progress.json": prog }, prefs: { guide: ALL_GUIDES } });
    await app.open();
    await app.solve();
    await expect.poll(() => app.eval(() => window.__e2e.session!["nextReady"]), { timeout: 20_000 }).toBe(true);
    await app.tapCell(at(0, 0));
    await expect.poll(() => app.eval(() => window.__e2e.session!["levelNumber"])).toBe(5);
    expect(await app.eval(() => window.__e2e.scene!["finale"])).toBeNull();
    // the skip tap is not a move on the new level
    expect(await app.eval(() => window.__e2e.session!["moves"].length)).toBe(0);
  });
});

test.describe("next level generation (PERF-1)", () => {
  test("launch pregenerates the next level in the worker; a late worker holds the finale, then the level comes in", async ({ app }) => {
    test.setTimeout(120_000);
    await gentle1(app);
    // generation of gentle 2 started when gentle 1 loaded
    await expect.poll(() => app.eval(() => window.__e2e.session!["nextLevelStatus"]), { timeout: 20_000 }).toBe("ready");
    // from here on the worker answers 6 s late (window.__test.worker.slow)
    await app.eval(() => window.__e2e.app!.worker.slow(6000));
    await app.solve();
    await app.tapNext();
    await expect.poll(() => app.eval(() => window.__e2e.session!["levelNumber"]), { timeout: 20_000 }).toBe(2);
    await app.waitIdle();
    // gentle 3 was requested the moment gentle 2 loaded; solve 2 before the slow worker answers
    await app.solve();
    await app.tapNext();
    const held = await app.eval(() => ({ n: window.__e2e.session!["levelNumber"] as number, status: window.__e2e.session!["nextLevelStatus"] as string }));
    expect(held.n).toBe(2);
    if (held.status === "generating") {
      // the finale holds its "board away" beat; nothing is generated on the main thread meanwhile
      await expect.poll(() => app.eval(() => window.__e2e.scene!["finale"]?.hold ?? null), { timeout: 10_000 }).toBe(true);
      expect(await app.eval(() => window.__e2e.session!["levelNumber"])).toBe(2);
    }
    await expect.poll(() => app.eval(() => window.__e2e.session!["levelNumber"]), { timeout: 30_000 }).toBe(3);
    await app.waitIdle();
    expect(app.log.filter((l) => l.includes("generated on the main thread"))).toEqual([]);
    await app.eval(() => window.__e2e.app!.worker.reset());
  });
});

test.describe("feedback", () => {
  test("conflict: two lanterns that see each other get the ✕ (v11: no rims); undo clears it and rewrites the journal", async ({ app }) => {
    await gentle1(app);
    const [a, b] = [at(0, 0), at(4, 0)]; // row 0 has no stone
    await app.play([a, b]);
    const an = await app.eval(() => window.__e2e.session!["analysis"]().conflicts);
    expect(an).toEqual([[a, b]]);
    await expect.poll(() => rigOf(app, b)).toMatchObject({ conflict: true });
    expect(await app.eval(() => window.__e2e.scene!["board"].partnerOf(4))).toBe(a);
    // undo (curved arrow) takes the second one back
    await app.tapButton("undoBtn");
    await expect.poll(() => app.lanterns()).toEqual([a]);
    expect(await app.eval(() => window.__e2e.session!["analysis"]().conflicts)).toEqual([]);
    await expect.poll(() => rigOf(app, a)).toMatchObject({ conflict: false });
    await expect.poll(() => app.journalMoves("gentle")).toHaveLength(1);
    // undo until empty, then the button does nothing
    await app.tapButton("undoBtn");
    await expect.poll(() => app.lanterns()).toEqual([]);
    await app.tapButton("undoBtn");
    await expect.poll(() => app.journalMoves("gentle")).toHaveLength(0);
  });

  test("over-full number: too many lanterns on its sides → 'over'; the number itself is the one mark + one line", async ({ app }) => {
    await gentle1(app);
    const stone = at(0, 2);
    expect(await app.eval(() => window.__e2e.session!["level"].clues[16])).toBe(1);
    await app.play([at(0, 1), at(0, 3)]); // both sides of the 1 (they cannot see each other: the rock is between)
    const st = await app.eval(() => window.__e2e.session!["analysis"]().stones.find((s: { cell: number }) => s.cell === 16));
    expect(st).toMatchObject({ cell: stone, need: 1, have: 2, status: "over" });
    await expect.poll(() => app.eval(() => [...window.__e2e.scene!["overStoneSet"]])).toEqual([stone]);
    await expect.poll(() => rigOf(app, at(0, 1))).toMatchObject({ overAdj: true });
    expect(await app.eval(() => window.__e2e.session!["analysis"]().conflicts)).toEqual([]);
    // v11 (C6): no coral rim on the lanterns and no "−lantern" tag — the coral number + the line (ko-KR)
    expect(await app.eval(() => (window.__e2e.scene!["board"]["rigs"] as Array<Record<string, any>>).filter((r) => r["mode"] !== 0 && r["cool"].visible).length)).toBe(0); // eslint-disable-line @typescript-eslint/no-explicit-any
    await expect.poll(() => app.eval(() => window.__e2e.scene!["bandText"] as string), { timeout: 10_000 }).toBe("1 숫자 옆에 등불이 너무 많아요.");
    expect(await app.eval(() => (window.__e2e.scene!["board"]["overMk"] as Array<{ visible: boolean }>).some((m) => m.visible))).toBe(false);
  });

  test("stuck on gentle 1: no marks yet (v11 C3), one line says a lantern is misplaced; the hint removes exactly that lantern", async ({ app }) => {
    await gentle1(app);
    const wrong = at(1, 0); // lights column 1 → the 4 can no longer get its left side
    expect(await app.solution()).not.toContain(wrong);
    await app.play([wrong]);
    const a = await app.eval(() => {
      const x = window.__e2e.session!["analysis"]();
      return { culprit: x.culprit, stuck: x.stuckStones.map((s: { stone: number; reason: string }) => [s.stone, s.reason]) };
    });
    expect(a).toEqual({ culprit: wrong, stuck: [[at(2, 3), "cannotReach"]] });
    // after the pause: the line, and no stuck read-out on the first three boards
    await expect.poll(() => app.eval(() => window.__e2e.scene!["bandText"] as string), { timeout: 10_000 }).toBe("등불 하나가 자리를 잘못 잡았어요. 힌트를 누르면 알려 줘요.");
    expect(await app.eval(() => window.__e2e.scene!["blockedShown"])).toBe(false);
    expect(await app.eval(() => (Array.from(window.__e2e.scene!["board"]["blkOn"]) as number[]).reduce((x, y) => x + y, 0))).toBe(0);
    // hint → remove that one (highlight first, second tap takes it back)
    await app.tapButton("hintBtn");
    await expect.poll(() => app.eval(() => window.__e2e.scene!["hintState"])).toEqual({ kind: "remove", cell: wrong, remaining: 0 });
    await expect.poll(() => app.eval(() => window.__e2e.scene!["bandText"] as string)).toBe("이 등불을 빼 보세요. 힌트를 한 번 더 누르면 빠져요.");
    await app.tapButton("hintBtn");
    await expect.poll(() => app.lanterns()).toEqual([]);
    expect(await app.journalMoves("gentle")).toHaveLength(2);
    await expect.poll(() => app.progress()).toMatchObject({ gentle: { hints: 1 } });
  });

  test("place hint: a moonlit ghost on a solution cell; tapping it places the lantern", async ({ app }) => {
    await gentle1(app);
    await app.tapButton("hintBtn");
    await expect.poll(() => app.eval(() => window.__e2e.scene!["hintState"].kind)).toBe("ghost");
    const ghost = await app.eval(() => window.__e2e.scene!["board"].ghostAt as number);
    expect(await app.solution()).toContain(ghost);
    await app.play([ghost]);
    expect(await app.eval(() => window.__e2e.scene!["hintState"].kind)).toBe("idle");
    expect(await app.eval(() => window.__e2e.session!["analysis"]().conflicts)).toEqual([]);
    // hints all the way to the end never produce a conflict and finish the level
    for (let k = 0; k < 12 && !(await app.eval(() => window.__e2e.session!["complete"])); k++) {
      await app.tapButton("hintBtn");
      await expect.poll(() => app.eval(() => window.__e2e.scene!["board"].ghostAt as number)).toBeGreaterThanOrEqual(0);
      await app.play([await app.eval(() => window.__e2e.scene!["board"].ghostAt as number)]);
      expect(await app.eval(() => window.__e2e.session!["analysis"]().conflicts)).toEqual([]);
    }
    await app.tapNext();
    await expect.poll(() => app.eval(() => window.__e2e.session!["levelNumber"]), { timeout: 20_000 }).toBe(2);
  });
});

test.describe("relaunch", () => {
  test("reload mid-level resumes the same board, journal and last move", async ({ app }) => {
    await gentle1(app);
    const sol = await app.solution();
    const cells = [sol[0]!, at(0, 0), sol[1]!];
    await app.play(cells);
    await expect.poll(() => app.journalMoves("gentle")).toHaveLength(3);
    const before = await app.lanterns();
    await app.reload();
    expect(await app.lanterns()).toEqual(before);
    expect(await app.eval(() => window.__e2e.session!["restoreInfo"])).toBe("restored 3/3 moves (level from cache)");
    expect(await app.eval(() => window.__e2e.session!["lastMoveCell"])).toBe(cells[2]);
    // the board shows exactly those lanterns
    const shown = await app.eval(() =>
      (window.__e2e.scene!["board"]["rigs"] as Array<Record<string, unknown>>).filter((r) => r["mode"] !== 0).map((r) => r["cell"] as number).sort((a, b) => a - b),
    );
    expect(shown).toEqual(before);
    // and play goes on
    await app.play([sol[2]!]);
    await expect.poll(() => app.journalMoves("gentle")).toHaveLength(4);
  });

  test("reload during the finale lands on the next level once the level end was saved", async ({ app }) => {
    await gentle1(app);
    await app.solve();
    await expect.poll(() => app.progress()).toMatchObject({ gentle: { level: 2 } });
    await app.reload();
    expect(await app.eval(() => [window.__e2e.session!["levelNumber"], window.__e2e.session!["moves"].length])).toEqual([2, 0]);
  });
});

test.describe("code review fixes", () => {
  test("[P2] the next level cannot be generated: the finale retries, then the solved level comes back (no endless hold)", async ({ app }) => {
    await gentle1(app);
    await app.eval(() => {
      window.__e2e.app!.worker.failFrom(2);
      // drop the level the launch already prefetched (it would hide the failure)
      const run = window.__e2e.session!["cur"];
      run["nextInfo"] = null;
      run["nextP"] = null;
    });
    await app.solve();
    await app.tapNext();
    await expect.poll(() => app.log.some((l) => l.includes("[finale] waiting for the worker's next level")), { timeout: 15_000 }).toBe(true);
    await expect.poll(() => app.log.filter((l) => l.includes("could not be generated")).length, { timeout: 15_000 }).toBeGreaterThanOrEqual(3);
    // not stuck: the finale ends on a fresh board of the same level
    await app.waitIdle();
    expect(await app.eval(() => [window.__e2e.session!["levelNumber"], window.__e2e.session!["complete"], window.__e2e.session!["moves"].length])).toEqual([1, false, 0]);
    await expect.poll(() => app.progress()).toMatchObject({ gentle: { level: 1, cleared: 0 } });
    // the warnings of the injected failure are expected
    app.errors.splice(0, app.errors.length, ...app.errors.filter((e) => !e.includes("cannot be generated")));
    // generation works again → the level plays through to gentle 2
    await app.eval(() => window.__e2e.app!.worker.failFrom(null));
    await app.solve();
    await app.tapNext();
    await expect.poll(() => app.eval(() => window.__e2e.session!["levelNumber"]), { timeout: 30_000 }).toBe(2);
  });

  test("[P2] two moon taps before the daily is loaded start ONE switch", async ({ app }) => {
    await gentle1(app);
    await app.eval(() => {
      const s = window.__e2e.session!;
      const orig = s["openDaily"].bind(s);
      (window as unknown as { __opens: number }).__opens = 0;
      s["openDaily"] = (...a: unknown[]) => {
        (window as unknown as { __opens: number }).__opens++;
        return orig(...a);
      };
      const sc = window.__e2e.scene!;
      sc["onMoon"]();
      sc["onMoon"]();
    });
    await expect.poll(() => app.eval(() => window.__e2e.session!["daily"]), { timeout: 20_000 }).not.toBeNull();
    await app.waitIdle();
    expect(await app.eval(() => (window as unknown as { __opens: number }).__opens)).toBe(1);
  });
});

test.describe("r6 guide fixes", () => {
  test("number lesson: the finger never lies over a digit, and the board is never bare for more than ~0.3 s between loops", async ({ app }) => {
    const prog = JSON.stringify({ v: 3, game: "pips", track: "gentle", gentle: { level: 2, cleared: 1, hints: 0 }, deduce: { level: 1, cleared: 0, hints: 0 } });
    await app.seed({ files: { "pips-progress.json": prog }, prefs: { guide: "17" } });
    await app.open();
    await expect.poll(() => app.eval(() => window.__e2e.scene!["guide"].active?.kind ?? null), { timeout: 20_000 }).toBe("digit");
    // sample every frame for two loops
    const r = await app.page.evaluate(async () => {
      const g = window.__e2e.scene!["guide"];
      const b = window.__e2e.scene!["board"];
      const per = g["period"](g.active);
      const t0 = performance.now();
      let covered = 0;
      let bare = 0;
      let longestBare = 0;
      let bareFrom = -1;
      let frames = 0;
      await new Promise<void>((done) => {
        const step = (): void => {
          const now = performance.now();
          frames++;
          const f = g["finger"];
          const fingerOn = f.visible && f.alpha > 0.3;
          const ghostOn = (g["ghosts"] as Array<{ visible: boolean; alpha: number }>).some((x) => x.visible && x.alpha > 0.3);
          if (fingerOn) {
            // the hand's footprint (as Guide.handAngle samples it) must not cover another numbered rock
            const tip = b.cellAtWorld(f.x, f.y);
            const cs = g["cs"];
            for (const k of [0.55, 0.95, 1.3]) {
              const c = b.cellAtWorld(f.x - Math.sin(f.rotation) * k * cs, f.y + Math.cos(f.rotation) * k * cs);
              if (c !== tip && b.isNumber(c)) covered++;
            }
          }
          if (!fingerOn && !ghostOn) {
            if (bareFrom < 0) bareFrom = now;
            bare++;
            longestBare = Math.max(longestBare, now - bareFrom);
          } else bareFrom = -1;
          if (now - t0 < per * 2 + 200) requestAnimationFrame(step);
          else done();
        };
        requestAnimationFrame(step);
      });
      return { covered, longestBare, frames, bare };
    });
    expect(r.frames).toBeGreaterThan(60);
    expect(r.covered).toBe(0);
    expect(r.longestBare).toBeLessThanOrEqual(320);
  });
});

test.describe("dead end read-out (round 7)", () => {
  test("Priya J-25: after taking A5 back nothing is stuck locally, yet the board is dead — the read-out points at the wrong C7", async ({ app }) => {
    const { seedKeyFor } = await import("../src/game/levelIds.ts");
    // playtest/sessions-r6/priya/J-25.json (7×7), served as gentle 25's cached level
    const rows = [".....3.", "##..#..", ".#.....", "..101..", ".1#..2.", "..1....", ".....#."];
    const prog = JSON.stringify({ v: 3, game: "pips", track: "gentle", gentle: { level: 25, cleared: 24, hints: 0 }, deduce: { level: 1, cleared: 0, hints: 0 } });
    await app.seed({
      files: { "pips-progress.json": prog, "pips-gentle-level.json": JSON.stringify({ v: 1, seedKey: seedKeyFor("gentle", 25), rows }) },
      prefs: { guide: ALL_GUIDES },
    });
    await app.open();
    const cell = (c: string): number => (Number(c.slice(1)) - 1) * 8 + (c.charCodeAt(0) - 65);
    expect(await app.eval(() => window.__e2e.session!["level"].w)).toBe(7);
    // her moves up to the point: … C3 D2 C7, then A5 placed and taken back
    await app.play(["E1", "G1", "F2", "E5", "F6", "C3", "D2", "C7", "A5", "A5"].map(cell));
    const a = await app.eval(() => {
      const x = window.__e2e.session!["analysis"]();
      return { culprit: x.culprit, dead: x.deadEnd, blocked: x.blocked.length, stuck: x.stuckStones.length };
    });
    expect(a.blocked + a.stuck).toBe(0);
    expect(a.dead).not.toBeNull();
    expect(a.culprit).toBe(cell("C7"));
    // the read-out: after the pause, ONE spot (the dead end) and ONE thread to C7
    await expect.poll(() => app.eval(() => window.__e2e.scene!["blockedShown"]), { timeout: 10_000 }).toBe(true);
    expect(
      await app.eval(() => {
        const b = window.__e2e.scene!["board"];
        const on = (Array.from(b["blkOn"]) as number[]).map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
        const blamed = (b["rigs"] as Array<Record<string, unknown>>).filter((r) => r["mode"] !== 0 && r["blame"]).map((r) => r["cell"]);
        return { on, threads: (b["threads"] as unknown[]).length, blamed };
      }),
    ).toEqual({ on: [a.dead!.at], threads: 1, blamed: [cell("C7")] });
    // v11: and its one line ("this tile" / "this number", ko-KR)
    await expect.poll(() => app.eval(() => window.__e2e.scene!["bandText"] as string)).toMatch(/^(이 칸은 이제 밝힐 수 없어요\.|이 숫자는 이제 \d개를 못 채워요\.)$/);
    // input cancels it
    await app.tapCell(cell("C7"));
    await expect.poll(() => app.eval(() => window.__e2e.scene!["blockedShown"])).toBe(false);
  });
});
