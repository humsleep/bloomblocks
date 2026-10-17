// iCloud mirror (phase 4, docs/phase2-plan.md "Phase 4 — iCloud sync"). Loaded with a dynamic
// import after the first paint (LanternsScene.decorate): zero cold-start cost, never blocks launch.
//
//   write   this device's snapshot → key d.<deviceId> (model.ts encodeSnapshot, < 64 KB), on
//           background (pause) and, debounced, at level end / daily completion — never per move
//   read    every d.* key (CloudKV.getAll) → mergeStates with the local snapshot → a plan applied to
//           the local saves only at a safe moment (home / level boundary); mid-level on that
//           track → local wins and the rest waits for the next boundary
//   fresh   install (no "sync" Preferences yet): wait for 'initialSync' (or 20 s) before the first
//           merge — an empty remote is never a reset (the merge only ever adds)
//   events  'server' → re-read + merge · 'account' → forget the old account's keys (local kept),
//           re-read, write ours into the new one · 'quota' → halve the budget, rewrite
//   off     no plugin (web / Android, UNIMPLEMENTED) → silently local-only. getAll().available =
//           false (no iCloud identity) is "unknown": KVS may still work with iCloud Drive off, so
//           reads / writes continue and only the icon says "off"
import { clock, localDateISO } from "../game/session.ts";
import { applyPlan, buildLocal, loadMeta, type Meta, newDeviceId, saveMeta, type SyncHost } from "./local.ts";
import {
  byteLength, decodeSnapshot, DEFAULT_BUDGET, encodeSnapshot, KEY_PREFIX, MIN_BUDGET, mergeStates, planEmpty, planFor, type Snapshot, type SyncState, TRACK_LIST,
} from "./model.ts";
import { coversV } from "../village/vstate.ts";
import { type CloudKVChange, type CloudKVPlugin, isUnimplemented, resolveCloudKV } from "./plugin.ts";
import { type SyncReason, syncSignal, type SyncStatus } from "./signal.ts";

export type { SyncHost };

/** Tunables (tests shorten them). */
export const syncConfig = {
  /** fresh install: longest wait for 'initialSync' before the first merge */
  initialWaitMs: 20_000,
  /** other devices' keys silent this long (and fully carried by ours) are removed */
  pruneAfterMs: 180 * 86_400_000,
  /** level end / daily completion → write after this quiet time */
  debounceMs: 1_500,
  /** a merge waiting for a safe moment looks again this often */
  safePollMs: 1_000,
};

export interface StartOptions {
  /** the CloudKV to use (tests: a fake); default: resolveCloudKV() */
  kv?: CloudKVPlugin | null;
  /** listen to @capacitor/app 'pause' (default true) */
  appEvents?: boolean;
}

/** The first-run lessons "show the guide again" brings back: goal card, tap, digit, conflict. */
const REPLAY_LESSONS = 16 | 1 | 2 | 4;
/** Skipped for a returning player restored onto a fresh install (v11: the first-yard tutorial too). */
const RESTORE_LESSONS = REPLAY_LESSONS | 256;

/** Nothing played on this state yet (a fresh install). */
function blank(x: SyncState): boolean {
  return TRACK_LIST.every((t) => x.p[t].level === 1 && x.p[t].cleared === 0) && Object.keys(x.d).length === 0 && x.j.length === 0 && x.s.best === 0;
}

/** `mine` carries everything `r` has that matters for restoring: dates, progress, best streak. */
function covers(mine: SyncState, r: SyncState): boolean {
  return (
    Object.keys(r.d).every((d) => d in mine.d) && TRACK_LIST.every((t) => mine.p[t].level >= r.p[t].level && mine.p[t].cleared >= r.p[t].cleared) &&
    mine.s.best >= r.s.best && coversV(mine.v, r.v)
  );
}

async function localGuide(): Promise<number> {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    return Number((await Preferences.get({ key: "guide" })).value ?? "0") & 0xffff;
  } catch {
    return 0;
  }
}

export class SyncEngine {
  status: SyncStatus = "pending";
  /** remote snapshots by key (never this device's own key) */
  private remote = new Map<string, Snapshot>();
  private budget = DEFAULT_BUDGET;
  /** last written text without its time (skip identical writes) */
  private lastKey = "";
  private lastMerged: SyncState | null = null;
  private chain: Promise<unknown> = Promise.resolve();
  private available = false;
  private started = false;
  private initialDone: (() => void) | null = null;
  private cancelDebounce: (() => void) | null = null;
  private cancelPoll: (() => void) | null = null;
  /** writes that failed (quota, transient) since the last success */
  private failures = 0;
  /** size of the last snapshot text (bytes) */
  private lastBytes = 0;

  /** Quota / too large: aim below both half the budget and three quarters of the last text. */
  private shrink(): void {
    this.budget = Math.max(MIN_BUDGET, Math.min(Math.floor(this.budget / 2), Math.floor((this.lastBytes * 3) / 4) || this.budget));
  }

  constructor(
    private readonly kv: CloudKVPlugin,
    private readonly host: SyncHost,
    private readonly meta: Meta,
    readonly fresh: boolean,
  ) {}

  get deviceId(): string {
    return this.meta.dev;
  }
  get key(): string {
    return `${KEY_PREFIX}${this.meta.dev}`;
  }
  /** remote device keys currently merged (tests / diagnostics) */
  get remoteKeys(): string[] {
    return [...this.remote.keys()].sort();
  }

  /**
   * getAll().available (iCloud identity token). Apple ties it to iCloud Drive: with Drive off the
   * key-value store may still sync, so false only means "unknown" — reads / writes go on (harmless
   * when iCloud is really off) and the icon says "off".
   */
  private icloud = true;

  private setStatus(s: SyncStatus): void {
    const shown = s !== "off" && !this.icloud ? "off" : s;
    this.status = shown;
    syncSignal.setStatus(shown);
  }

  /** Serialize every pull / merge / write (never two at once). */
  private run<T>(job: () => Promise<T>): Promise<T | undefined> {
    const next = this.chain.then(job).catch((e: unknown) => {
      this.fail(e);
      return undefined;
    });
    this.chain = next;
    return next;
  }

  private fail(e: unknown): void {
    if (isUnimplemented(e)) {
      this.available = false;
      this.setStatus("off");
      return;
    }
    console.info("[sync] failed (kept local)", e);
    if (this.status !== "off") this.setStatus("pending");
  }

  async start(): Promise<void> {
    this.setStatus("pending");
    let initial: Promise<void> = Promise.resolve();
    if (this.fresh) {
      initial = new Promise<void>((resolve) => {
        const cancel = clock.after(syncConfig.initialWaitMs, () => {
          this.initialDone = null;
          resolve();
        });
        this.initialDone = () => {
          cancel();
          this.initialDone = null;
          resolve();
        };
      });
    }
    // events retained by the plugin are delivered on attach: listen before waiting
    await this.kv.addListener("change", (e) => this.onChange(e));
    if (this.fresh) {
      // what iCloud already holds: other devices' keys there → merge now (merge-only, so an early
      // look is safe); none → wait for the initial sync (a first-run lesson may wait with it, ≤ 1.5 s)
      const probe = await this.kv.getAll();
      const keys = Object.keys(probe.values ?? {}).filter((k) => k.startsWith(KEY_PREFIX) && k !== this.key);
      if (keys.length) this.initialDone?.();
      else if (probe.available) syncSignal.initial = "pending";
    }
    await initial;
    this.started = true;
    await this.run(async () => {
      if (await this.pull()) await this.mergeApply();
    });
    // the first merge has landed (or had nothing to bring): a held first-run lesson may start
    syncSignal.initial = "done";
    await this.run(() => this.write());
  }

  /** Read every d.* key (also while iCloud reports itself unavailable: see `icloud`). false = no plugin. */
  private async pull(): Promise<boolean> {
    const r = await this.kv.getAll();
    this.icloud = r.available === true;
    this.available = true;
    this.remote.clear();
    for (const [k, v] of Object.entries(r.values ?? {})) {
      if (!k.startsWith(KEY_PREFIX) || k === this.key || typeof v !== "string") continue;
      const snap = decodeSnapshot(v);
      if (snap && `${KEY_PREFIX}${snap.dev}` === k) this.remote.set(k, snap);
    }
    return true;
  }

  private async local(): Promise<Snapshot> {
    const { snap, metaChanged } = await buildLocal(this.host.session, this.meta, this.lastMerged?.j ?? []);
    if (metaChanged) await saveMeta(this.meta);
    return snap;
  }

  /** Merge everything; apply now when safe, else look again shortly. */
  private async mergeApply(): Promise<void> {
    if (!this.available) return;
    this.stopPoll();
    const local = await this.local();
    const today = localDateISO();
    const now = clock.now().getTime();
    const merged = mergeStates([local, ...this.remote.values()], today, now);
    this.lastMerged = merged;
    const plan = planFor(local, merged);
    // "show the guide again" here: other devices' copies of those lesson bits do not cancel it
    plan.guide &= ~(this.meta.gr ?? 0);
    // a returning player on a fresh install (nothing played here yet): restore at once, lessons skipped
    const restore = blank(local) && !blank(merged);
    if (restore) plan.guide |= RESTORE_LESSONS & ~local.g;
    if (planEmpty(plan)) return;
    if (!this.host.safe(restore)) {
      this.setStatus("pending");
      this.poll(restore);
      return;
    }
    const later = await applyPlan(plan, merged, this.host, this.meta, restore);
    await saveMeta(this.meta);
    // mid-level on a track that moved elsewhere: the next level boundary (dirty "level") retries
    if (later.length) this.setStatus("pending");
    this.scheduleWrite(0);
  }

  private poll(restore = false): void {
    if (this.cancelPoll) return;
    this.cancelPoll = clock.after(syncConfig.safePollMs, () => {
      this.cancelPoll = null;
        if (this.host.safe(restore)) void this.run(() => this.mergeApply());
      else this.poll(restore);
    });
  }
  private stopPoll(): void {
    this.cancelPoll?.();
    this.cancelPoll = null;
  }

  private async write(): Promise<void> {
    if (!this.available) return;
    const snap = await this.local();
    const text = encodeSnapshot(snap, this.budget);
    this.lastBytes = byteLength(text);
    const key = encodeSnapshot({ ...snap, at: 0 }, this.budget);
    if (key === this.lastKey) {
      this.setStatus(this.cancelPoll ? "pending" : "synced");
      return;
    }
    try {
      await this.kv.set({ key: this.key, value: text });
      this.lastKey = key;
      this.failures = 0;
      await this.prune(snap);
      this.setStatus(this.cancelPoll ? "pending" : "synced");
    } catch (e) {
      if (isUnimplemented(e)) throw e;
      if (!this.icloud) return; // signed out: nothing to mirror to, nothing to shrink
      // too large / quota: shrink and try once more on the next write
      this.failures++;
      this.shrink();
      this.setStatus("pending");
      if (this.failures <= 3) this.scheduleWrite(syncConfig.debounceMs);
    }
  }

  /**
   * Keys of devices silent for PRUNE_AFTER_MS whose every date, level and best streak this device's
   * snapshot (just written) already carries are removed: every reinstall makes a new device id, and
   * the store holds at most 1024 keys. Never this device's own key; nothing is lost (the merged log
   * travels in each live device's own snapshot). A pruned device that comes back simply writes again.
   */
  private async prune(mine: Snapshot): Promise<void> {
    const now = clock.now().getTime();
    for (const [k, r] of [...this.remote]) {
      if (now - r.at < syncConfig.pruneAfterMs || !covers(mine, r)) continue;
      await this.kv.remove({ key: k });
      this.remote.delete(k);
      this.pruned++;
    }
  }
  /** keys this engine removed (tests / diagnostics) */
  pruned = 0;

  private scheduleWrite(ms: number): void {
    this.cancelDebounce?.();
    this.cancelDebounce = clock.after(ms, () => {
      this.cancelDebounce = null;
      void this.run(() => this.write());
    });
  }

  /** A level ended / a daily was counted / a setting changed: write soon (debounced); a level boundary is also a safe moment to merge. */
  dirty(why: SyncReason): void {
    if (why === "guide") {
      void this.run(() => this.noteReplay());
      return;
    }
    if (!this.available || !this.started) return;
    this.setStatus("pending");
    if (why === "level" || why === "daily") void this.run(() => this.mergeApply());
    this.scheduleWrite(syncConfig.debounceMs);
  }

  /** "Show the guide again" on this device: a local-only override against other devices' lesson bits. */
  private async noteReplay(): Promise<void> {
    syncSignal.replayRequested = false;
    this.meta.gr = (this.meta.gr ?? 0) | REPLAY_LESSONS;
    this.meta.gl = await localGuide();
    await saveMeta(this.meta);
  }

  /** App to background: write now (the debounce would not survive suspension). */
  onPause(): Promise<void> {
    if (!this.available || !this.started) return Promise.resolve();
    this.cancelDebounce?.();
    this.cancelDebounce = null;
    return this.run(() => this.write()).then(() => undefined);
  }

  /** Back to foreground: iCloud may have news. */
  onResume(): Promise<void> {
    if (!this.started) return Promise.resolve();
    return this.run(async () => {
      if (await this.pull()) await this.mergeApply();
    }).then(() => undefined);
  }

  onChange(e: CloudKVChange): void {
    if (e.reason === "initialSync") this.initialDone?.();
    if (!this.started) return;
    if (e.reason === "account") {
      // another (or no) account: whatever came from the old one is not merged any more; local stays
      this.remote.clear();
      this.lastMerged = null;
      this.lastKey = "";
      this.budget = DEFAULT_BUDGET;
      void this.run(async () => {
        if (await this.pull()) await this.mergeApply();
      });
      void this.run(() => this.write());
      return;
    }
    if (e.reason === "quota") {
      this.shrink();
      this.lastKey = "";
      void this.run(() => this.write());
      return;
    }
    // server / initialSync
    void this.run(async () => {
      if (await this.pull()) await this.mergeApply();
    });
  }

  /** Resolves when every queued pull / merge / write has finished (tests). */
  idle(): Promise<void> {
    return this.chain.then(() => undefined);
  }

  stop(): void {
    this.cancelDebounce?.();
    this.stopPoll();
    this.started = false;
    syncSignal.listener = null;
  }
}

let engine: SyncEngine | null = null;

/** Start the mirror (once). Resolves with the engine, or null when there is no iCloud here. */
export async function startSync(host: SyncHost, opts: StartOptions = {}): Promise<SyncEngine | null> {
  if (engine) return engine;
  const kv = opts.kv !== undefined ? opts.kv : await resolveCloudKV();
  if (!kv) {
    syncSignal.initial = "done";
    syncSignal.setStatus("off");
    return null;
  }
  let meta = await loadMeta();
  const fresh = meta === null;
  if (!meta) {
    meta = { v: 1, dev: newDeviceId(), st: {}, j: {} };
    await saveMeta(meta);
  }
  const e = new SyncEngine(kv, host, meta, fresh);
  engine = e;
  syncSignal.listener = (why) => e.dirty(why);
  if (syncSignal.replayRequested) e.dirty("guide");
  if ((import.meta.env.DEV && import.meta.env.MODE !== "test") || import.meta.env.MODE === "e2e") Object.assign(globalThis, { __sync: e, __syncSignal: syncSignal });
  if (opts.appEvents !== false) {
    void import("@capacitor/app")
      .then(({ App }) => {
        void App.addListener("pause", () => void e.onPause());
        void App.addListener("resume", () => void e.onResume());
      })
      .catch(() => undefined);
  }
  try {
    await e.start();
  } catch (err) {
    if (!isUnimplemented(err)) console.info("[sync] start failed (local only)", err);
    syncSignal.initial = "done";
    syncSignal.setStatus("off");
  }
  return e;
}

/** Tests: forget the running engine. */
export function resetSync(): void {
  engine?.stop();
  engine = null;
  syncSignal.setStatus("off");
}
