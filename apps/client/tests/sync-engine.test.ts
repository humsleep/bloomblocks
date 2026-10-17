// The sync engine on a fake device + fake iCloud (tests/fakes/cloudkv.ts): migration of the old
// saves into the completion log, reinstall (local empty + remote snapshot → full restore after
// 'initialSync', or the 20 s fallback), an empty remote is never a reset, mid-level → local wins,
// account change, quota, iCloud unavailable, and "never per move" writes.
// Each launch() re-imports the app modules (module state = a process); the fake device's files
// and preferences live in tests/fakes/backend.ts, so resetDevice() = uninstall.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cellsOf, fakeBackend, readFile, resetDevice, settle, writeFile } from "./helpers.ts";
import { lanternlyPath } from "./fakes/filesystem.ts";
import { FakeCloud, type FakeCloudKV } from "./fakes/cloudkv.ts";
import { solutionOf } from "../src/game/pipsApi.ts";

type Mods = {
  session: typeof import("../src/game/session.ts");
  sync: typeof import("../src/sync/index.ts");
  daily: typeof import("../src/game/daily.ts");
  feedback: typeof import("../src/game/feedback.ts");
  signal: typeof import("../src/sync/signal.ts");
};
type Dev = Mods & { s: import("../src/game/session.ts").Session; safe: { on: boolean; idle: boolean }; refresh: ReturnType<typeof vi.fn<(changes: { numbers?: string; restore?: boolean }) => void>>; swaps: number };

const TODAY = "2026-10-14";
const progress = (g: number, d = 1): string =>
  JSON.stringify({ v: 3, game: "pips", track: "gentle", gentle: { level: g, cleared: g - 1, hints: 2 }, deduce: { level: d, cleared: d - 1, hints: 0 } });

/** Launch the app on the current fake device (fresh module state, like a cold start). */
async function launch(): Promise<Dev> {
  vi.resetModules();
  const m: Mods = {
    session: await import("../src/game/session.ts"),
    sync: await import("../src/sync/index.ts"),
    daily: await import("../src/game/daily.ts"),
    feedback: await import("../src/game/feedback.ts"),
    signal: await import("../src/sync/signal.ts"),
  };
  m.session.setLevelWorker(null);
  await m.feedback.loadGuide();
  await m.feedback.loadNumberStyle();
  Object.assign(m.sync.syncConfig, { initialWaitMs: 60_000, debounceMs: 5, safePollMs: 10 });
  const s = await m.session.Session.restore();
  await settle();
  return { ...m, s, safe: { on: true, idle: true }, refresh: vi.fn<(changes: { numbers?: string; restore?: boolean }) => void>(), swaps: 0 };
}

function host(d: Dev): Parameters<Mods["sync"]["startSync"]>[0] {
  return {
    session: d.s,
    // on = a quiet moment; idle = nothing animating (a first-run lesson may be up: a restore goes ahead)
    safe: (restore) => d.safe.on || (restore && d.safe.idle),
    swap: async (task) => {
      d.swaps++;
      await task();
    },
    refresh: d.refresh,
  };
}

/** Engines started in this test (an "uninstall" stops them: their process is gone). */
const engines: Array<{ stop(): void }> = [];
/** Uninstall: the app's process ends (its engine stops listening), its files and preferences go. */
function wipe(cloud?: FakeCloud): void {
  for (const e of engines.splice(0)) e.stop();
  if (cloud) for (const d of cloud.devices) d.listeners = [];
  if (cloud) cloud.devices = [];
  resetDevice();
}

async function startOn(d: Dev, kv: FakeCloudKV, opts: { initial?: boolean } = {}): Promise<InstanceType<Mods["sync"]["SyncEngine"]>> {
  const p = d.sync.startSync(host(d), { kv, appEvents: false });
  if (opts.initial !== false) setTimeout(() => kv.initialSync(), 5);
  const e = (await p)!;
  engines.push(e);
  await e.idle();
  await settle();
  return e;
}

const pref = (k: string): string | null => fakeBackend.prefs.get(k) ?? null;
const sol = (d: Dev): number[] => cellsOf(solutionOf(d.s.level)!);
const until = async (f: () => boolean, ms = 3000): Promise<void> => {
  const t0 = performance.now();
  while (!f()) {
    if (performance.now() - t0 > ms) throw new Error("timed out");
    await new Promise((r) => setTimeout(r, 5));
  }
};

beforeEach(() => {
  resetDevice();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${TODAY}T10:00:00`));
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});
afterEach(async () => {
  for (const e of engines.splice(0)) e.stop();
  await settle();
  vi.useRealTimers();
});

describe("completion log migration (players from before phase 4)", () => {
  it("random histories: the dates recovered from run.bin files + DailyState recompute exactly the stored streak", async () => {
    let seed = 7;
    const rnd = (): number => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
    for (let trial = 0; trial < 8; trial++) {
      resetDevice();
      const d = await launch();
      let st = await d.daily.loadStreak();
      const counted: string[] = [];
      for (let k = 0; k < 90; k++) {
        const date = new Date(2026, 6, 1 + k);
        const iso = d.session.localDateISO(date);
        const r = rnd();
        if (r < 0.65) {
          // the old build: counted on its own date, run.bin written that evening
          st = d.daily.countCompletion(st, iso);
          counted.push(iso);
          writeFile(`runs/p5-daily-${iso}.bin`, "AA==");
          fakeBackend.files.get(lanternlyPath(`runs/p5-daily-${iso}.bin`))!.mtime = new Date(2026, 6, 1 + k, 20, 15).getTime();
        } else if (r < 0.8) {
          // finished after midnight: practice — the file exists, the streak never counted it
          writeFile(`runs/p5-daily-${iso}.bin`, "AA==");
          fakeBackend.files.get(lanternlyPath(`runs/p5-daily-${iso}.bin`))!.mtime = new Date(2026, 6, 2 + k, 0, 20).getTime();
        }
      }
      const last = counted.at(-1)!;
      fakeBackend.prefs.set("daily", JSON.stringify({ date: last, ms: 75_400, hints: 2, undos: 1, result: { dateISO: last, seconds: 75, hints: 2, undos: 1, streak: st.streak } }));
      await settle();
      const e = await launch();
      const log = await e.daily.loadLog();
      expect(Object.keys(log).sort()).toEqual(counted);
      expect(e.daily.streakFromDates(Object.keys(log))).toEqual(await e.daily.loadStreak());
      expect(log[last]).toEqual({ at: new Date(`${last}T20:15:00`).getTime(), ms: 75_400, hints: 2, undos: 1 });
      await settle();
      expect(JSON.parse(readFile("pips-daily-log.json")!).v).toBe(1);
    }
  });

  it("a streak whose run files are gone still keeps its last date", async () => {
    fakeBackend.prefs.set("streak", JSON.stringify({ v: 1, last: "2026-10-13", streak: 4, best: 9, shields: {} }));
    const d = await launch();
    expect(Object.keys(await d.daily.loadLog())).toEqual(["2026-10-13"]);
  });

  it("recordCompletion logs a counted completion once (earliest kept) and tells the mirror", async () => {
    const d = await launch();
    const why: string[] = [];
    d.signal.syncSignal.listener = (w) => why.push(w);
    let st = d.daily.recordCompletion(await d.daily.loadStreak(), TODAY, { ms: 61_000, hints: 1, undos: 0 });
    vi.setSystemTime(new Date(`${TODAY}T11:00:00`));
    st = d.daily.recordCompletion(st, TODAY, { ms: 5_000, hints: 0, undos: 0 });
    st = d.daily.recordCompletion(st, "2026-10-12", { ms: 1, hints: 0, undos: 0 }); // clock went back: ignored
    await d.daily.logSettled();
    expect(await d.daily.loadLog()).toEqual({ [TODAY]: { at: new Date(`${TODAY}T10:00:00`).getTime(), ms: 61_000, hints: 1, undos: 0 } });
    expect(st).toMatchObject({ last: TODAY, streak: 1 });
    expect(why).toEqual(["daily", "daily"]);
  });
});

describe("engine", () => {
  async function deviceA(cloud: FakeCloud): Promise<{ d: Dev; e: Awaited<ReturnType<typeof startOn>> }> {
    writeFile("pips-progress.json", progress(5, 2));
    fakeBackend.prefs.set("guide", "255");
    fakeBackend.prefs.set("numbers", "dots");
    fakeBackend.prefs.set("streak", JSON.stringify({ v: 1, last: null, streak: 0, best: 7, shields: {} }));
    const d = await launch();
    let st = await d.daily.loadStreak();
    for (const day of ["2026-10-12", "2026-10-13", TODAY]) {
      vi.setSystemTime(new Date(`${day}T09:00:00`));
      st = d.daily.recordCompletion(st, day, { ms: 90_000, hints: 0, undos: 0 });
    }
    await d.daily.logSettled();
    const cells = sol(d).slice(0, 2);
    for (const c of cells) d.s.tap(c & 7, c >> 3);
    const e = await startOn(d, cloud.device());
    return { d, e };
  }

  it("never writes per move: a level end writes (debounced), pause writes", async () => {
    const cloud = new FakeCloud();
    writeFile("pips-progress.json", progress(2));
    const d = await launch();
    const kv = cloud.device();
    const e = await startOn(d, kv);
    const writes = (): number => cloud.writes.length;
    const w0 = writes();
    expect(w0).toBe(1); // the first snapshot
    const cells = sol(d);
    for (const c of cells.slice(0, -1)) d.s.tap(c & 7, c >> 3);
    await settle();
    await new Promise((r) => setTimeout(r, 30));
    expect(writes()).toBe(w0); // moves alone: nothing
    d.s.tap(cells.at(-1)! & 7, cells.at(-1)! >> 3); // level end → dirty("level")
    await until(() => writes() === w0 + 1);
    d.s.advance();
    d.s.tap(sol(d)[0]! & 7, sol(d)[0]! >> 3);
    await e.onPause();
    expect(writes()).toBe(w0 + 2);
    const snap = JSON.parse(cloud.values.get(e.key)!);
    expect(snap.p.slice(0, 2)).toEqual([3, 2]);
    expect(snap.j).toHaveLength(1); // the in-progress journal of gentle 3
  });

  it("reinstall: local empty + remote snapshot → full restore after 'initialSync' (progress, journal, streak, best, settings)", async () => {
    const cloud = new FakeCloud();
    const { d: a, e: ea } = await deviceA(cloud);
    await ea.onPause();
    const aStreak = JSON.parse(pref("streak")!);
    expect(aStreak).toMatchObject({ last: TODAY, streak: 3, best: 7 });
    const moves = a.s.moves.map((m: Uint8Array) => m[0]);
    // uninstall → reinstall: no files, no preferences, a new device id
    wipe(cloud);
    vi.setSystemTime(new Date(`${TODAY}T18:00:00`));
    const b = await launch();
    expect(b.s.levelOf("gentle")).toBe(1);
    const kv = cloud.device();
    kv.delivered = false; // iCloud has not delivered the account's store yet
    const p = b.sync.startSync(host(b), { kv, appEvents: false });
    await new Promise((r) => setTimeout(r, 40));
    // waiting for the initial sync: nothing merged, nothing written yet
    expect(b.s.levelOf("gentle")).toBe(1);
    expect(cloud.writes.filter((w) => w.key !== `d.${ea.deviceId}`)).toEqual([]);
    expect(b.signal.syncSignal.status).toBe("pending");
    kv.initialSync();
    const eb = (await p)!;
    engines.push(eb);
    await eb.idle();
    await settle();
    expect(eb.deviceId).not.toBe(ea.deviceId);
    expect([b.s.track, b.s.levelOf("gentle"), b.s.cleared("gentle"), b.s.levelOf("deduce"), b.s.cleared("deduce")]).toEqual(["gentle", 5, 4, 2, 1]);
    expect(b.s.levelNumber).toBe(5);
    expect(b.s.moves.map((m: Uint8Array) => m[0])).toEqual(moves); // the in-progress board, verified move by move
    expect(b.swaps).toBe(1);
    expect(JSON.parse(pref("streak")!)).toEqual(aStreak);
    expect(Object.keys(await b.daily.loadLog())).toEqual(["2026-10-12", "2026-10-13", TODAY]);
    expect((await b.daily.loadDaily(TODAY)).result).toMatchObject({ dateISO: TODAY, seconds: 90, streak: 3 });
    expect(pref("numbers")).toBe("dots");
    expect(b.feedback.getNumberStyle()).toBe("dots");
    expect(pref("guide")).toBe("511"); // v11: a restore skips the first-yard tutorial (256) as well
    expect(b.refresh).toHaveBeenCalledWith({ numbers: "dots", restore: true });
    expect(b.signal.syncSignal.status).toBe("synced");
    // files agree: a relaunch restores the same board without iCloud
    const c = await launch();
    expect([c.s.levelNumber, c.s.moves.length]).toEqual([5, 2]);
  });

  it("fresh install without an 'initialSync' event: merges after the timeout (20 s in the app)", async () => {
    const cloud = new FakeCloud();
    const { e: ea } = await deviceA(cloud);
    await ea.onPause();
    wipe(cloud);
    const b = await launch();
    b.sync.syncConfig.initialWaitMs = 60;
    const kv = cloud.device();
    const eb = (await b.sync.startSync(host(b), { kv, appEvents: false }))!;
    engines.push(eb);
    await eb.idle();
    await settle();
    expect(b.s.levelOf("gentle")).toBe(5);
  });

  it("an empty remote is never a reset: a device with progress joins an empty iCloud", async () => {
    writeFile("pips-progress.json", progress(9, 4));
    fakeBackend.prefs.set("streak", JSON.stringify({ v: 1, last: TODAY, streak: 6, best: 6, shields: {} }));
    const d = await launch();
    const cloud = new FakeCloud();
    const e = await startOn(d, cloud.device());
    expect([d.s.levelOf("gentle"), d.s.levelOf("deduce")]).toEqual([9, 4]);
    expect(JSON.parse(pref("streak")!)).toMatchObject({ streak: 6, best: 6 });
    expect(JSON.parse(cloud.values.get(e.key)!).p).toEqual([9, 8, 2, 4, 3, 0]);
  });

  it("mid-level on that track → local wins and waits for the level boundary; a 'server' change arrives live", async () => {
    const cloud = new FakeCloud();
    writeFile("pips-progress.json", progress(2));
    const d = await launch();
    const cells = sol(d);
    d.s.tap(cells[0]! & 7, cells[0]! >> 3);
    const e = await startOn(d, cloud.device());
    // another device publishes gentle 6
    const other = cloud.device();
    await other.set({ key: "d.zzzzzzzzzz", value: JSON.stringify({ v: 1, dev: "zzzzzzzzzz", at: Date.now(), p: [6, 5, 0, 3, 2, 0], s: ["", 0, 0, {}], d: null, j: [], st: {}, g: 0, si: 0 }) });
    await new Promise((r) => setTimeout(r, 30));
    await e.idle();
    expect(e.remoteKeys).toEqual(["d.zzzzzzzzzz"]);
    expect([d.s.levelOf("gentle"), d.s.moves.length]).toEqual([2, 1]); // the board in play is untouched
    expect(d.s.levelOf("deduce")).toBe(3); // the other track moved at once
    // the player finishes the level: the boundary applies the rest
    for (const c of cells.slice(1)) d.s.tap(c & 7, c >> 3);
    await until(() => d.s.levelOf("gentle") === 6);
    expect(d.swaps).toBe(1);
  });

  it("not a safe moment (a sheet / animation): the merge waits, then lands", async () => {
    const cloud = new FakeCloud();
    const { e: ea } = await deviceA(cloud);
    await ea.onPause();
    wipe(cloud);
    const b = await launch();
    b.safe.on = false;
    b.safe.idle = false; // an animation: not even a restore goes now
    const e = await startOn(b, cloud.device());
    await new Promise((r) => setTimeout(r, 40));
    expect(b.s.levelOf("gentle")).toBe(1);
    expect(b.signal.syncSignal.status).toBe("pending");
    b.safe.idle = true;
    await until(() => b.s.levelOf("gentle") === 5);
    await e.idle();
  });

  it("account change: the old account's keys are dropped (not merged later), local kept, our key goes to the new account", async () => {
    const accountA = new FakeCloud();
    accountA.values.set("d.olddevice1", JSON.stringify({ v: 1, dev: "olddevice1", at: Date.now(), p: [9, 8, 0, 1, 0, 0], s: [TODAY, 20, 20, {}], d: { o: TODAY, b: "AQ==", r: "" }, j: [], st: { numbers: ["dots", Date.now()] }, g: 0, si: 0 }));
    writeFile("pips-progress.json", progress(2));
    const d = await launch();
    const cells = sol(d);
    d.s.tap(cells[0]! & 7, cells[0]! >> 3); // mid-level: gentle 9 must wait
    const kv = accountA.device();
    const e = await startOn(d, kv);
    expect(d.s.levelOf("gentle")).toBe(2);
    // signed into account B (empty)
    const accountB = new FakeCloud();
    kv.switchAccount(accountB);
    await new Promise((r) => setTimeout(r, 20));
    await e.idle();
    expect(e.remoteKeys).toEqual([]);
    // a level boundary now: nothing from account A comes in
    d.s.undo();
    d.signal.syncSignal.dirty("level");
    await new Promise((r) => setTimeout(r, 40));
    await e.idle();
    await settle();
    expect(d.s.levelOf("gentle")).toBe(2);
    // what was already merged from account A stays (local is the device's own state)
    expect(pref("numbers")).toBe("dots");
    expect([...accountB.values.keys()]).toEqual([e.key]);
    expect(JSON.parse(accountB.values.get(e.key)!).p[0]).toBe(2);
  });

  it("quota: a refused write shrinks the snapshot (oldest journal first) and is retried", async () => {
    const cloud = new FakeCloud();
    const { d, e } = await deviceA(cloud);
    const full = cloud.values.get(e.key)!;
    expect(JSON.parse(full).j).toHaveLength(1);
    cloud.quotaBytes = full.length - 10;
    e.onChange({ reason: "quota", keys: [] });
    d.s.tap(sol(d)[2]! & 7, sol(d)[2]! >> 3);
    await e.onPause();
    await until(() => cloud.values.get(e.key) !== full);
    await e.idle();
    const now = JSON.parse(cloud.values.get(e.key)!);
    expect(now.j).toHaveLength(0);
    expect(cloud.values.get(e.key)!.length).toBeLessThanOrEqual(full.length - 10);
    expect(now.s).toEqual(JSON.parse(full).s);
  });

  it("iCloud unavailable (signed out): local only, icon off, nothing changes locally; no plugin → off", async () => {
    writeFile("pips-progress.json", progress(3));
    const d = await launch();
    const cloud = new FakeCloud();
    const kv = cloud.device();
    kv.available = false;
    await startOn(d, kv);
    expect(d.signal.syncSignal.status).toBe("off");
    expect(d.s.levelOf("gentle")).toBe(3);
    expect(cloud.values.size).toBe(0);
    d.sync.resetSync();
    expect(await d.sync.startSync(host(d), { kv: null })).toBeNull();
    expect(d.signal.syncSignal.status).toBe("off");
  });

  it("a plugin without an implementation (web) turns the mirror off silently", async () => {
    const d = await launch();
    const unimpl = Object.assign(new Error("CloudKV plugin is not implemented on web"), { code: "UNIMPLEMENTED" });
    const kv = { getAll: () => Promise.reject(unimpl), set: () => Promise.reject(unimpl), remove: () => Promise.reject(unimpl), synchronize: () => Promise.reject(unimpl), addListener: () => Promise.reject(unimpl), removeAllListeners: () => Promise.resolve() };
    const e = await d.sync.startSync(host(d), { kv: kv as never, appEvents: false });
    expect(e).not.toBeNull();
    expect(d.signal.syncSignal.status).toBe("off");
  });

  it("returning player: a restore lands at once even over a first-run lesson, the lessons are marked learned", async () => {
    const cloud = new FakeCloud();
    const { e: ea } = await deviceA(cloud);
    fakeBackend.prefs.set("guide", "0"); // A never recorded its lessons (an older build)
    await ea.onPause();
    wipe(cloud);
    const b = await launch();
    b.safe.on = false; // the goal card is up (not a quiet moment for an ordinary merge)
    const kv = cloud.device();
    // iCloud already holds A's key: no waiting for 'initialSync' (the 60 s fallback would time the test out)
    const eb = (await b.sync.startSync(host(b), { kv, appEvents: false }))!;
    engines.push(eb);
    await eb.idle();
    await settle();
    expect(b.s.levelOf("gentle")).toBe(5);
    expect(Number(pref("guide")) & 23).toBe(23); // goal, tap, digit, conflict: never taught again
    expect(b.refresh).toHaveBeenCalledWith(expect.objectContaining({ restore: true }));
    expect(b.signal.syncSignal.initial).toBe("done");
  });

  it("first-run hold: 'pending' only while iCloud is there and its first delivery is due; no plugin → done", async () => {
    const d = await launch();
    d.signal.syncSignal.holdUntil = performance.now() + 1500;
    expect(d.signal.syncSignal.holdGuide()).toBe(true); // engine not known yet
    const kv = new FakeCloud().device();
    const p = d.sync.startSync(host(d), { kv, appEvents: false });
    await until(() => d.signal.syncSignal.initial === "pending");
    expect(d.signal.syncSignal.holdGuide()).toBe(true);
    kv.initialSync();
    await p;
    expect(d.signal.syncSignal.initial).toBe("done");
    expect(d.signal.syncSignal.holdGuide()).toBe(false);
    const e = await launch();
    e.signal.syncSignal.holdUntil = performance.now() + 1500;
    expect(await e.sync.startSync(host(e), { kv: null })).toBeNull();
    expect(e.signal.syncSignal.holdGuide()).toBe(false);
    // the hold never outlasts its 1.5 s
    const f = await launch();
    f.signal.syncSignal.holdUntil = performance.now() - 1;
    expect(f.signal.syncSignal.holdGuide()).toBe(false);
  });

  it("'show the guide again' is not undone by other devices' lesson bits (local override until relearned here)", async () => {
    const cloud = new FakeCloud();
    cloud.values.set("d.otherdevice1", JSON.stringify({ v: 1, dev: "otherdevice1", at: Date.now(), p: [2, 1, 0, 1, 0, 0], s: ["", 0, 0, {}], d: null, j: [], st: {}, g: 255, si: 0 }));
    writeFile("pips-progress.json", progress(2));
    fakeBackend.prefs.set("guide", "255");
    const d = await launch();
    const e = await startOn(d, cloud.device());
    d.feedback.replayGuide();
    d.signal.syncSignal.guideReplayed();
    await e.idle();
    expect(pref("guide")).toBe(String(255 & ~23));
    // another device writes again: its bits come in, the replayed ones do not
    const other = cloud.device();
    await other.set({ key: "d.otherdevice1", value: JSON.stringify({ v: 1, dev: "otherdevice1", at: Date.now(), p: [3, 2, 0, 1, 0, 0], s: ["", 0, 0, {}], d: null, j: [], st: {}, g: 255 | 256, si: 0 }) });
    await until(() => d.s.levelOf("gentle") === 3);
    await e.idle();
    await settle();
    expect(Number(pref("guide")) & 23).toBe(0);
    expect(Number(pref("guide")) & 256).toBe(256);
    // the goal card is seen again here → that bit is this device's own again; the rest stay overridden
    d.feedback.markGuide(16);
    await settle();
    await e.onPause();
    e.onChange({ reason: "server", keys: [] });
    await e.idle();
    await settle();
    expect(Number(pref("guide")) & 23).toBe(16);
  });

  it("30 reinstalls, 40 days apart: old device keys are pruned once carried (bounded key count), no date lost", async () => {
    const cloud = new FakeCloud();
    const all: string[] = [];
    let maxKeys = 0;
    for (let i = 0; i < 30; i++) {
      wipe(cloud);
      const day = new Date(2026, 0, 1 + i * 40, 9);
      vi.setSystemTime(day);
      const d = await launch();
      const e = await startOn(d, cloud.device()); // fresh: the previous installs' keys are merged at once
      let st = await d.daily.loadStreak();
      for (const k of [0, 1]) {
        const at = new Date(2026, 0, 1 + i * 40 + k, 9);
        vi.setSystemTime(at);
        const iso = d.session.localDateISO(at);
        st = d.daily.recordCompletion(st, iso, { ms: 50_000, hints: 0, undos: 0 });
        all.push(iso);
      }
      await d.daily.logSettled();
      await e.onPause();
      await e.idle();
      maxKeys = Math.max(maxKeys, cloud.values.size);
    }
    expect(maxKeys).toBeLessThanOrEqual(6); // ≤ 180 days of devices (+ the new one)
    expect(cloud.values.size).toBeLessThanOrEqual(6);
    // a last reinstall restores every date ever played
    wipe(cloud);
    vi.setSystemTime(new Date(2026, 0, 1 + 30 * 40, 9));
    const z = await launch();
    await startOn(z, cloud.device());
    expect(Object.keys(await z.daily.loadLog()).sort()).toEqual([...new Set(all)].sort());
  });
});
