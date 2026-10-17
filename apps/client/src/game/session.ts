// Play session for Lanterns-P ("pips", gameId GAME_ID.lanternsPips = 5): two
// tracks (gentle = the house scene, deduce = the second entrance), each with its
// own level counter, level cache and interruption-safe journal, plus today's
// daily in a slot of its own. All rules come through ./pipsApi.ts.
//
// Persistence (Library/lanternly/), all pips files are prefixed so the old
// lanterns saves (progress.json / journal.log / level.json) are simply ignored
// — a player coming from the lanterns build starts fresh on the gentle track:
//   pips-progress.json        {v:3, game:"pips", track, gentle:{level,cleared,hints}, deduce:{…}, daily?}   temp + rename
//   pips-<track>-level.json   {v:1, seedKey, rows}  cache of the generated level (pure speed-up)
//   pips-<track>-journal.log  "PPJ1 <levelIdHex> <seedKey>" then "<moveHex2><stateHashHex8>" per move
//   runs/p5-<levelIdHex>.bin  run.bin (docs/runlog-format.md, gameId 5, mode free) at level end, temp + rename
//   pips-daily-level.json / pips-daily-journal.log   today's daily (same formats; the seed key
//                             carries the date, so a new day starts a fresh journal by itself)
//   runs/p5-daily-<date>.bin  run.bin (mode daily) of the FIRST completed daily of that date
//                             (practice replays never overwrite it; a completion replayed on
//                             launch writes it when the kill came before it landed)
// Undo pops the last move and rewrites the journal (temp + rename), so the run
// log never contains undone moves.
//
// Each move is appended BEFORE any animation starts. On launch the journal is
// replayed with the core's verifyRun (longest verifying prefix wins). A failed
// append is repaired at once by rewriting the whole journal from memory (and a
// slot whose last journal write failed is rewritten, not appended to, until a
// full write lands) — one transient write error never loses the later moves.
//
// The daily never shares a slot with a track: the daily run lives in its own
// field, so leaving it always lands on the home track (prog.track), also after a
// kill + relaunch into the daily.
//
// Level generation never runs on the main thread while the player is on a board
// with a worker available: the next level of a track is generated in the worker as
// soon as the current one is loaded (nextLevelReady / nextLevelStatus tell the
// scene whether it has arrived; there is no time cap — a late worker just means the
// scene waits). Without any Worker (node tests) advance() generates on demand.

import { u32Hex } from "@core/bytes.ts";
import { stateHash } from "@core/game.ts";
import { deriveSeed } from "@core/rng.ts";
import { encodeRun, FORMAT_VERSION, MODE, type Run, verifyRun } from "@core/runlog.ts";
import { levelRows, parseLevel } from "@games/lanterns-pips/level.ts";
import {
  analyzeBoard, type BoardAnalysis, dailyParams, hasBit, type Hint, hintFor, index, isFinale, lanternsPips as G, levelForDaily, levelForTrack, type PipsLevel,
  type PipsMove, type PipsState, type Track,
} from "./pipsApi.ts";
import { levelIdFor, seedKeyFor } from "./levelIds.ts";
import { appendText, bytesToBase64, enqueue, flush, readAtomic, readAtomicText, readText, writeAtomic } from "../save/store.ts";
import { rememberKeepsake } from "../save/keepsakes.ts";
import { syncSignal } from "../sync/signal.ts";

export type { Track };
export const TRACKS: readonly Track[] = ["gentle", "deduce"];

const PROGRESS = "pips-progress.json";
type Slot = Track | "daily";
const levelFile = (t: Slot): string => `pips-${t}-level.json`;
const journalFile = (t: Slot): string => `pips-${t}-journal.log`;

// ---------------------------------------------------------------- clock (injectable)

/**
 * The app's wall clock and monotonic clock. Everything that asks "what day is it"
 * (session, daily, the scene through localDateISO) or measures active time (DailyClock)
 * reads it, so tests can move days without replacing Date (testing/bridge.ts).
 */
export const clock = {
  now: (): Date => new Date(),
  mono: (): number => performance.now(),
  /** One-shot timer (the worker watchdog); returns its cancel function. */
  after: (ms: number, f: () => void): (() => void) => {
    const id = setTimeout(f, ms);
    return () => clearTimeout(id);
  },
};
const realClock = { ...clock };

/** Override the clock (tests / DEV bridge); `resetClock()` puts the real one back. */
export function setClock(c: Partial<typeof clock>): void {
  if (c.now) clock.now = c.now;
  if (c.mono) clock.mono = c.mono;
  if (c.after) clock.after = c.after;
}
export function resetClock(): void {
  clock.now = realClock.now;
  clock.mono = realClock.mono;
  clock.after = realClock.after;
}

/** Today in the device's local time zone, YYYY-MM-DD. */
export function localDateISO(d: Date = clock.now()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const MAGIC = "PPJ1";

interface TrackProgress {
  /** 1-based level number on this track. */
  level: number;
  cleared: number;
  /** Hints asked on this track (unlimited for now; counted for the monetization decision). */
  hints: number;
}

interface Progress {
  v: 3;
  game: "pips";
  track: Track;
  gentle: TrackProgress;
  deduce: TrackProgress;
  /** set while the player is on that date's daily (launch resumes into it the same day) */
  daily?: string;
}

export interface LevelInfo {
  track: Track;
  n: number;
  seedKey: string;
  levelId: number;
  level: PipsLevel;
  /** YYYY-MM-DD for the daily, null on a track */
  daily: string | null;
}

export type TapResult = "placed" | "removed" | "illegal" | "complete" | "locked";

/** Where the next level of the current track stands (U renders a waiting state on "generating"). */
/** "failed": the last attempt threw (worker and main thread) — retryNext() / fallbackToSolved(). */
export type NextLevelStatus = "ready" | "generating" | "idle" | "failed";

// ---------------------------------------------------------------- level worker (injectable)
//
// One module worker generates levels for every track and the daily. Rules:
//   - it is created only after the first frame is painted (markFirstPaint(), or the fallback
//     watcher: a canvas in the page + two animation frames), so the cold-start path never pays
//     for it; prefetches asked earlier wait for that moment. A level needed before the first
//     paint (launch onto a finale / today's daily without a cache) is generated on the main
//     thread in a task of its own — nothing is animating yet.
//   - watchdog: while requests are outstanding, the worker must reply within
//     levelWorkerConfig.timeoutMs of its last reply (R's worst case is ≤ 1.5 s on desktop;
//     12 s leaves ×8 for an old phone). A silent worker is terminated and restarted like a
//     crashed one; after WORKER_RESTARTS restarts the main thread generates, in its own task.

/** The part of a Worker the session uses (a fake in tests: setLevelWorker). */
export interface LevelWorker {
  postMessage(msg: unknown): void;
  addEventListener(type: "message" | "error", f: (e: { data?: unknown; message?: string }) => void): void;
  terminate?(): void;
}
export type LevelWorkerFactory = () => LevelWorker;

/**
 * Main-thread generator of track levels (tests swap it to make generation fail; the worker runs
 * the real one — tests make the worker fail through setLevelWorker).
 */
export const levelGen = { track: (t: Track, n: number): PipsLevel => levelForTrack(t, n) };

/** Tunables (tests may change them). */
export const levelWorkerConfig = {
  /** no reply for this long while requests are outstanding → the worker is considered hung */
  timeoutMs: 12_000,
  /** first-paint fallback: open the gate after this long even without a painted canvas */
  firstPaintMaxMs: 4_000,
};

type GenReq = { track: Track; n: number } | { daily: string };
interface GenReply {
  track?: Track;
  n?: number;
  daily?: string;
  level?: PipsLevel;
  error?: string;
}
interface Pending {
  req: GenReq;
  key: string;
  p: Promise<PipsLevel>;
  resolve(l: PipsLevel): void;
  reject(e: unknown): void;
  /** may wait for the first paint (a prefetch); false = needed now (a load) */
  deferrable: boolean;
  /** waiting for the first paint, not sent anywhere yet */
  held: boolean;
}

const defaultFactory: LevelWorkerFactory | null =
  typeof Worker === "undefined" ? null : () => new Worker(new URL("./nextLevel.worker.ts", import.meta.url), { type: "module" }) as unknown as LevelWorker;
/** A crashed / hung worker is restarted this many times; after that the main thread generates (in its own task). */
const WORKER_RESTARTS = 2;
let factory: LevelWorkerFactory | null = defaultFactory;
let worker: LevelWorker | null = null;
let workerCrashes = 0;
let cancelWatchdog: (() => void) | null = null;
const pending = new Map<string, Pending>();

/** No requestAnimationFrame (node, tests): nothing to protect, the gate starts open. */
let painted = typeof requestAnimationFrame === "undefined";
let paintWatch = false;

const keyOf = (r: { track?: Track; n?: number; daily?: string }): string => (r.daily ? `daily:${r.daily}` : `${r.track}:${r.n}`);

/**
 * The first frame of the board is on screen: the level worker may be created now (held
 * prefetches go out). Idempotent. Called by the fallback watcher; the scene may call it
 * right after its first render (docs/phase2-plan.md, Requests to U).
 */
export function markFirstPaint(): void {
  if (painted) return;
  painted = true;
  for (const p of pending.values()) if (p.held) dispatch(p);
}

/** Tests: close the first-paint gate again (true) or open it (false). */
export function setBeforeFirstPaint(before: boolean): void {
  painted = !before;
  paintWatch = false;
  if (!before) for (const p of pending.values()) if (p.held) dispatch(p);
}

/** Has the first frame been painted (the worker may exist)? */
export function firstPaintDone(): boolean {
  return painted;
}

/**
 * Fallback for markFirstPaint without a scene hook: wait for the game canvas to exist, then two
 * animation frames (the frame that drew it has been presented); at most firstPaintMaxMs.
 */
function watchFirstPaint(): void {
  if (painted || paintWatch) return;
  paintWatch = true;
  const raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame : null;
  const hasCanvas = (): boolean => typeof document === "undefined" || document.querySelector("canvas") !== null;
  const cancel = clock.after(levelWorkerConfig.firstPaintMaxMs, markFirstPaint);
  if (!raf) return;
  const tick = (): void => {
    if (painted) return cancel();
    if (hasCanvas()) raf(() => raf(() => {
      cancel();
      markFirstPaint();
    }));
    else raf(tick);
  };
  raf(tick);
}

/**
 * Replace the level worker: a factory (tests: a fake / slow worker), null (no worker:
 * main-thread generation, like node), or "default" (the real module worker).
 * Requests in flight move to the new one, unless `dropPending` (unit tests: a clean slate;
 * the dropped requests never settle).
 */
export function setLevelWorker(f: LevelWorkerFactory | null | "default", opts: { dropPending?: boolean } = {}): void {
  stopWatchdog();
  worker?.terminate?.();
  worker = null;
  workerCrashes = 0;
  factory = f === "default" ? defaultFactory : f;
  if (opts.dropPending) pending.clear();
  for (const p of pending.values()) if (!p.held) dispatch(p);
}

/** A worker is (or can be) running: next levels are generated off the main thread. */
export function hasLevelWorker(): boolean {
  return factory !== null && workerCrashes <= WORKER_RESTARTS;
}

/** The worker exists right now (created lazily, after the first paint). */
export function levelWorkerStarted(): boolean {
  return worker !== null;
}

function levelWorker(): LevelWorker | null {
  if (worker) return worker;
  if (!hasLevelWorker()) return null;
  try {
    const w = factory!();
    w.addEventListener("message", (e) => onWorkerMessage(w, e.data as GenReply));
    w.addEventListener("error", (e) => onWorkerFailed(w, e.message ?? "error event"));
    worker = w;
  } catch (e) {
    console.warn("[session] no level worker", e);
    workerCrashes = WORKER_RESTARTS + 1;
    return null;
  }
  return worker;
}

function stopWatchdog(): void {
  cancelWatchdog?.();
  cancelWatchdog = null;
}

/** (Re)start the "reply within timeoutMs" deadline while the worker has outstanding requests. */
function armWatchdog(w: LevelWorker, fresh: boolean): void {
  if (cancelWatchdog && !fresh) return; // the deadline runs from the last reply, not the last post
  stopWatchdog();
  let outstanding = false;
  for (const p of pending.values()) if (!p.held) outstanding = true;
  if (!outstanding || w !== worker) return;
  const ms = levelWorkerConfig.timeoutMs;
  cancelWatchdog = clock.after(ms, () => {
    cancelWatchdog = null;
    onWorkerFailed(w, `no reply in ${ms} ms`);
  });
}

function onWorkerMessage(w: LevelWorker, d: GenReply): void {
  const p = pending.get(keyOf(d));
  if (p) pending.delete(p.key);
  if (w === worker) armWatchdog(w, true); // any reply is progress: a fresh deadline for the rest
  if (!p) return;
  if (d.level && !d.error) p.resolve(d.level);
  else p.reject(new Error(d.error ?? "worker sent no level"));
}

/** Crashed (error event) or hung (watchdog): terminate, count, re-post everything on a fresh worker / the main thread. */
function onWorkerFailed(w: LevelWorker, message: string): void {
  if (w !== worker) return;
  stopWatchdog();
  workerCrashes++;
  console.warn(`[session] level worker failed (${workerCrashes}/${WORKER_RESTARTS + 1})`, message);
  w.terminate?.();
  worker = null;
  for (const p of pending.values()) if (!p.held) dispatch(p);
}

function generateHere(req: GenReq): PipsLevel {
  return "daily" in req ? levelForDaily(req.daily) : levelGen.track(req.track, req.n);
}

/** Main thread, but on a task of its own (never inside the caller's frame). */
function generateInTask(p: Pending): void {
  setTimeout(() => {
    if (pending.get(p.key) !== p) return;
    pending.delete(p.key);
    try {
      p.resolve(generateHere(p.req));
    } catch (e) {
      p.reject(e);
    }
  }, 0);
}

function dispatch(p: Pending): void {
  if (!painted && factory !== null) {
    if (p.deferrable) {
      // before the first paint: no worker yet; the prefetch goes out once the board is on screen
      p.held = true;
      watchFirstPaint();
      return;
    }
    p.held = false;
    generateInTask(p); // needed for the launch itself: nothing animates yet
    return;
  }
  p.held = false;
  const w = levelWorker();
  if (w) {
    w.postMessage(p.req);
    armWatchdog(w, false);
    return;
  }
  generateInTask(p);
}

/** A level generated off the main thread when possible (one request per level at a time). */
function generateOffThread(req: GenReq, deferrable: boolean): Promise<PipsLevel> {
  const key = keyOf(req as { track?: Track; n?: number; daily?: string });
  const have = pending.get(key);
  if (have) {
    if (!deferrable && have.held) {
      have.deferrable = false;
      dispatch(have);
    }
    return have.p;
  }
  let resolve!: (l: PipsLevel) => void;
  let reject!: (e: unknown) => void;
  const p = new Promise<PipsLevel>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  const entry: Pending = { req, key, p, resolve, reject, deferrable, held: false };
  pending.set(key, entry);
  dispatch(entry);
  return p;
}

// ---------------------------------------------------------------- journal writes

/** Slots whose last full journal write failed: their next move rewrites the whole journal. */
const journalDirty = new Set<Slot>();

async function writeJournal(slot: Slot, text: string): Promise<void> {
  try {
    await writeAtomic(journalFile(slot), text);
    journalDirty.delete(slot);
  } catch (e) {
    journalDirty.add(slot);
    throw e;
  }
}

const hex2 = (n: number): string => n.toString(16).padStart(2, "0");

function journalHeader(info: { levelId: number; seedKey: string }): string {
  return `${MAGIC} ${u32Hex(info.levelId)} ${info.seedKey}\n`;
}

function trackInfo(track: Track, n: number, level: PipsLevel): LevelInfo {
  return { track, n, seedKey: seedKeyFor(track, n), levelId: levelIdFor(track, n), level, daily: null };
}

function generateInfo(track: Track, n: number): LevelInfo {
  return trackInfo(track, n, levelGen.track(track, n));
}

function dailyInfo(dateISO: string, level?: PipsLevel): LevelInfo {
  const p = dailyParams(dateISO);
  return { track: "gentle", n: 0, seedKey: p.seedKey, levelId: p.levelId >>> 0, level: level ?? levelForDaily(dateISO), daily: dateISO };
}

function fromCache(track: Track, n: number, text: string | null): LevelInfo | null {
  if (!text) return null;
  try {
    const c = JSON.parse(text) as { v?: number; seedKey?: string; rows?: unknown };
    if (c.v !== 1 || c.seedKey !== seedKeyFor(track, n) || !Array.isArray(c.rows)) return null;
    return trackInfo(track, n, parseLevel(c.rows as string[]));
  } catch {
    return null; // corrupt cache → regenerate
  }
}

function dailyFromCache(dateISO: string, text: string | null): LevelInfo | null {
  if (!text) return null;
  try {
    const c = JSON.parse(text) as { v?: number; seedKey?: string; rows?: unknown };
    if (c.v !== 1 || c.seedKey !== dailyParams(dateISO).seedKey || !Array.isArray(c.rows)) return null;
    return dailyInfo(dateISO, parseLevel(c.rows as string[]));
  } catch {
    return null;
  }
}

const slotOf = (info: LevelInfo): Slot => (info.daily ? "daily" : info.track);

function writeCache(info: LevelInfo): void {
  const text = JSON.stringify({ v: 1, seedKey: info.seedKey, rows: levelRows(info.level) });
  enqueue("level-cache", () => writeAtomic(levelFile(slotOf(info)), text));
}

function parseProgress(text: string | null): Progress {
  const fresh = (): TrackProgress => ({ level: 1, cleared: 0, hints: 0 });
  const prog: Progress = { v: 3, game: "pips", track: "gentle", gentle: fresh(), deduce: fresh() };
  if (!text) return prog;
  try {
    const p = JSON.parse(text) as Partial<Progress>;
    if (p.v !== 3 || p.game !== "pips") return prog;
    const okInt = (x: unknown): x is number => Number.isInteger(x) && (x as number) >= 0;
    for (const t of TRACKS) {
      const q = p[t];
      if (q && okInt(q.level) && q.level >= 1 && okInt(q.cleared)) prog[t] = { level: q.level, cleared: q.cleared, hints: okInt(q.hints) ? q.hints : 0 };
    }
    if (p.track === "deduce") prog.track = "deduce";
    if (typeof p.daily === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.daily)) prog.daily = p.daily;
  } catch {
    /* corrupt progress → start at gentle 1 */
  }
  return prog;
}

/** Journal lines ("<move><hash>\n") of a move list replayed from the level's start. */
function linesFor(info: LevelInfo, moves: readonly Uint8Array[]): string[] {
  let s = G.init(info.seedKey, info.level);
  return moves.map((m) => {
    s = G.apply(s, G.decodeMove(m)!)!;
    return `${hex2(m[0]!)}${u32Hex(stateHash(G, s))}\n`;
  });
}

interface LoadOpts {
  /** a cache miss is generated in the worker (switch / leave-daily: an animation is running) */
  offThread?: boolean;
}

/** One track's (or the daily's) current level: state, journal, run.bin. */
class TrackRun {
  info: LevelInfo;
  state: PipsState;
  moves: Uint8Array[] = [];
  complete = false;
  restoredLastMove: PipsMove | null = null;
  lastMoveCell = -1;
  /** toggled cells of this level, oldest first (hint tie-break) */
  recent: number[] = [];
  restoreInfo = "fresh";
  /** daily only: called once when the level is completed live (a replayed completion: the scene replays the finale) */
  onComplete: (() => void) | null = null;
  private analysisCache: BoardAnalysis | null = null;
  /**
   * Journal lines of `moves`, one per move. Only ever pushed to; undo / reset replace the
   * array, so an append job can rebuild "the journal up to its move" from (array, length).
   */
  private lines: string[] = [];
  private nextInfo: LevelInfo | null = null;
  /** generation of level n+1 in flight (or done) */
  private nextP: Promise<void> | null = null;

  constructor(info: LevelInfo, private readonly prog: Progress, private readonly save: () => void) {
    this.info = info;
    this.state = G.init(info.seedKey, info.level);
  }

  get track(): Track {
    return this.info.track;
  }

  private get slot(): Slot {
    return slotOf(this.info);
  }

  /** Today's daily: cache + journal (a journal of another date is ignored by its header). */
  static async loadDaily(dateISO: string, prog: Progress, save: () => void): Promise<TrackRun> {
    const [cacheText, jr] = await Promise.all([readAtomicText(levelFile("daily")), readAtomic(journalFile("daily"))]);
    const journal = jr.text;
    let info = dailyFromCache(dateISO, cacheText);
    const cached = info !== null;
    if (!info) info = dailyInfo(dateISO, await generateOffThread({ daily: dateISO }, false));
    const r = new TrackRun(info, prog, save);
    if (!cached) writeCache(info);
    if (journal) r.replayJournal(journal, jr.fromTmp);
    else r.resetJournal();
    return r;
  }

  static async load(
    track: Track, prog: Progress, save: () => void, pre?: { cache: string | null; journal: { text: string | null; fromTmp: boolean } }, opts: LoadOpts = {},
  ): Promise<TrackRun> {
    const [cacheText, jr] = pre
      ? [pre.cache, pre.journal]
      : await Promise.all([readAtomicText(levelFile(track)), readAtomic(journalFile(track))]);
    const journal = jr.text;
    const n = prog[track].level;
    let info = fromCache(track, n, cacheText);
    const cached = info !== null;
    if (!info) {
      // launch: a plain level is quicker here than a worker spin-up; a finale (seconds) or a
      // level needed mid-animation goes to the worker
      const off = hasLevelWorker() && (opts.offThread === true || isFinale(track, n));
      info = off ? trackInfo(track, n, await generateOffThread({ track, n }, false)) : generateInfo(track, n);
    }
    const r = new TrackRun(info, prog, save);
    if (!cached) writeCache(info);
    if (journal) r.replayJournal(journal, jr.fromTmp);
    else r.resetJournal();
    r.restoreInfo += cached ? " (level from cache)" : " (level generated)";
    r.prefetchNext();
    return r;
  }

  analysis(): BoardAnalysis {
    // recent: the rules' culprit tie-break prefers the latest toggle (round 5)
    return (this.analysisCache ??= analyzeBoard(this.info.level, this.state, this.recent));
  }

  private setState(s: PipsState): void {
    this.state = s;
    this.analysisCache = null;
  }

  /** `fromTmp`: the text came from the stranded .tmp (see store.readAtomic) — always rewritten. */
  private replayJournal(text: string, fromTmp = false): void {
    const lines = text.split("\n");
    lines.pop(); // only newline-terminated lines count
    const head = lines.shift();
    if (head !== journalHeader(this.info).trimEnd()) {
      this.restoreInfo = "journal for another level → fresh";
      this.resetJournal();
      return;
    }
    const moves: Uint8Array[] = [];
    const hashes: number[] = [];
    for (const line of lines) {
      if (!/^[0-9a-f]{10}$/.test(line)) break;
      moves.push(Uint8Array.of(parseInt(line.slice(0, 2), 16)));
      hashes.push(parseInt(line.slice(2), 16) >>> 0);
    }
    for (let k = moves.length; k >= 0; k--) {
      const bytes = this.runBytes(moves.slice(0, k), k > 0 ? hashes[k - 1]! : stateHash(G, this.state));
      const v = verifyRun(G, bytes, this.info.level);
      if (!v.ok) continue;
      this.setState(v.state);
      this.moves = v.run.moves;
      this.lines = linesFor(this.info, this.moves);
      this.complete = v.complete;
      const last = k > 0 ? G.decodeMove(this.moves[k - 1]!) : null;
      this.restoredLastMove = last;
      this.lastMoveCell = last ? index(last.x, last.y) : -1;
      this.recent = this.moves.map((m) => m[0]!);
      this.restoreInfo = `restored ${k}/${moves.length} moves`;
      // a journal read from the .tmp is rewritten under its own name before any append (an
      // append would start a headerless final file and the next launch would lose every move)
      if (fromTmp || k !== lines.length || !text.endsWith("\n")) this.rewriteJournal();
      if (this.complete) {
        if (this.info.daily) this.writeDailyRun(); // killed before the daily's run.bin landed
        else this.finishLevel();
      }
      return;
    }
    this.restoreInfo = "journal unusable → fresh";
    this.resetJournal();
  }

  /** run.bin bytes of `moves`; mode daily for the daily (server verifySubmission expects it), free on a track. */
  private runBytes(moves: Uint8Array[], finalHash: number): Uint8Array {
    const run: Run = {
      header: {
        formatVersion: FORMAT_VERSION,
        gameId: G.id,
        mode: this.info.daily ? MODE.daily : MODE.free,
        flags: 0,
        seed: deriveSeed(this.info.seedKey),
        levelId: this.info.levelId,
        moveCount: moves.length,
        stateHash: finalHash,
      },
      moves,
    };
    return encodeRun(run, G.moveWidth);
  }

  tap(x: number, y: number): TapResult {
    if (this.complete) return "locked";
    const move: PipsMove = { x, y };
    const next = G.apply(this.state, move);
    if (next === null) return "illegal";
    const i = index(x, y);
    const placed = hasBit(next.lanterns, i);
    const enc = G.encodeMove(move);
    this.setState(next);
    this.moves.push(enc);
    this.restoredLastMove = null;
    this.lastMoveCell = i;
    this.recent.push(i);
    this.appendLine(`${hex2(enc[0]!)}${u32Hex(stateHash(G, next))}\n`);
    if (G.isComplete(next)) {
      this.complete = true;
      this.finishLevel();
      return "complete";
    }
    return placed ? "placed" : "removed";
  }

  /**
   * Journal one move. A failed append (or a slot whose last full write failed) rewrites the
   * whole journal up to this move from memory, so later appends land on a consistent file.
   */
  private appendLine(line: string): void {
    this.lines.push(line);
    const lines = this.lines;
    const k = lines.length;
    const slot = this.slot;
    const head = journalHeader(this.info);
    enqueue("append", async () => {
      if (!journalDirty.has(slot)) {
        try {
          await appendText(journalFile(slot), line);
          return;
        } catch (e) {
          console.warn("[session] journal append failed; rewriting the journal from memory", e);
        }
      }
      await writeJournal(slot, head + lines.slice(0, k).join(""));
    });
  }

  /** The daily's run.bin: only the first completion of the date is kept (practice never overwrites it). */
  private writeDailyRun(): void {
    const name = `runs/p5-daily-${this.info.daily}.bin`;
    const data = bytesToBase64(this.runBytes(this.moves.slice(), stateHash(G, this.state)));
    enqueue("finish-daily", async () => {
      if ((await readText(name)) === null) await writeAtomic(name, data, true);
    });
  }

  /** Level end: run.bin → progress → fresh journal for the next level (same order as before). */
  private finishLevel(): void {
    const bytes = this.runBytes(this.moves.slice(), stateHash(G, this.state));
    const v = verifyRun(G, bytes, this.info.level);
    if (!v.ok || !v.complete) console.warn("[session] run.bin failed self-verify", v);
    if (this.info.daily) {
      // the daily keeps its (complete) journal and the date's first run.bin
      this.writeDailyRun();
      this.onComplete?.();
      return;
    }
    const t = this.track;
    const n = this.info.n + 1;
    // the town's keepsake card for this house shows at once (no generator wait)
    if (t === "gentle") rememberKeepsake(this.info.n, this.info.level);
    // progress.json points at this level until here; advancing it is idempotent on a replayed completion
    if (this.prog[t].level <= this.info.n) {
      this.prog[t].level = n;
      this.prog[t].cleared += 1;
    }
    const levelId = this.info.levelId;
    enqueue("finish-run", () => writeAtomic(`runs/p5-${u32Hex(levelId)}.bin`, bytesToBase64(bytes), true));
    this.save();
    const head = journalHeader({ levelId: levelIdFor(t, n), seedKey: seedKeyFor(t, n) });
    enqueue("finish-journal", () => writeJournal(t, head));
    if (this.nextInfo?.n === n) writeCache(this.nextInfo);
    else this.prefetchNext();
    syncSignal.dirty("level");
    // the village counts this day as lit (lazy chunk: nothing on the cold-start path)
    const today = localDateISO();
    void import("../village/store.ts").then((m) => m.noteLitDay(today)).catch(() => undefined);
  }

  /** Start generating level n+1 in the worker (no-op on the daily, when started, or without a worker). */
  prefetchNext(): void {
    if (this.info.daily || this.nextP || !hasLevelWorker()) return;
    void this.startNext();
  }

  private startNext(): Promise<void> {
    if (this.nextP) return this.nextP;
    const t = this.track;
    const n = this.info.n + 1;
    const t0 = clock.mono();
    this.nextP = generateOffThread({ track: t, n }, true)
      .catch((e: unknown) => {
        console.warn(`[session] ${t} ${n}: worker gave no level; generating on the main thread`, e);
        return levelGen.track(t, n);
      })
      .then((level) => {
        this.nextInfo = trackInfo(t, n, level);
        this.nextFailed = 0;
        if (this.complete) writeCache(this.nextInfo);
        console.info(`[session] ${t} ${n} ready in ${Math.round(clock.mono() - t0)} ms`);
      })
      .catch((e: unknown) => {
        // never an endless "generating": the status says failed, the next attempt starts fresh
        this.nextFailed++;
        this.nextP = null;
        console.warn(`[session] ${t} ${n} could not be generated (attempt ${this.nextFailed})`, e);
      });
    return this.nextP;
  }

  /** Failed attempts at the next level since the last success. */
  nextFailed = 0;

  /** The next level is already generated (advance() will not generate on the main thread). */
  get nextReady(): boolean {
    return this.info.daily !== null || this.nextInfo?.n === this.info.n + 1;
  }

  get nextStatus(): NextLevelStatus {
    return this.nextReady ? "ready" : this.nextP ? "generating" : this.nextFailed > 0 ? "failed" : "idle";
  }

  /**
   * Resolves once the next level is generated (starting it if needed). No time cap: the
   * worker may be slow on an old phone and the scene holds its "board away" beat meanwhile.
   * Without a worker it is generated on the main thread in a task of its own.
   */
  whenNextReady(): Promise<void> {
    if (this.nextReady) return Promise.resolve();
    return this.startNext();
  }

  /**
   * The next level cannot be generated (retries failed): the level just solved comes back as a
   * fresh board, with progress rolled back to it — progress, cache and journal agree, so a
   * relaunch loads it from the cache (never the failing generator, never a blank screen).
   */
  fallbackToSolved(): TrackRun {
    const t = this.track;
    const n = this.info.n;
    if (this.prog[t].level === n + 1) {
      this.prog[t].level = n;
      this.prog[t].cleared = Math.max(0, this.prog[t].cleared - 1);
      this.save();
    }
    writeCache(this.info);
    const r = new TrackRun(this.info, this.prog, this.save);
    r.restoreInfo = "fallback: the next level could not be generated";
    r.resetJournal();
    console.warn(`[session] ${t} ${n + 1} unavailable: replaying ${t} ${n}`);
    return r;
  }

  /** Next level of this track (in memory; disk already advanced in finishLevel). */
  advance(): TrackRun {
    const n = this.info.n + 1;
    let info = this.nextInfo?.n === n ? this.nextInfo : null;
    if (!info) {
      // only without a worker (node / no Worker support): the scene waits for nextReady otherwise
      const t0 = clock.mono();
      info = generateInfo(this.track, n);
      writeCache(info);
      console.info(`[session] ${this.track} ${n} generated on the main thread in ${Math.round(clock.mono() - t0)} ms`);
    }
    const r = new TrackRun(info, this.prog, this.save);
    r.restoreInfo = "advanced";
    r.prefetchNext();
    return r;
  }

  /** Removals as one player action (hint "lift this one"); each is its own journaled move. */
  removeMany(cells: readonly number[]): number[] {
    const done: number[] = [];
    for (const c of cells) {
      if (!hasBit(this.state.lanterns, c)) continue;
      if (this.tap(c & 7, c >> 3) === "removed") done.push(c);
    }
    return done;
  }

  hint(): Hint {
    if (this.complete) return { kind: "none" };
    if (!this.info.daily) {
      const p = this.prog[this.track];
      p.hints++;
      this.save();
    }
    return hintFor(this.info.level, this.state, this.lastMoveCell >= 0 ? this.lastMoveCell : undefined, this.recent);
  }

  resetJournal(): void {
    this.moves = [];
    this.lines = [];
    const head = journalHeader(this.info);
    const slot = this.slot;
    enqueue("reset", () => writeJournal(slot, head));
  }

  /** Fresh board on the same level (daily practice replay). */
  restart(): void {
    this.setState(G.init(this.info.seedKey, this.info.level));
    this.complete = false;
    this.restoredLastMove = null;
    this.lastMoveCell = -1;
    this.recent = [];
    this.resetJournal();
  }

  /**
   * Undo the last toggle: drop it from the move list, rebuild the state from the
   * remaining moves and rewrite the journal. Returns the toggled cell, or -1.
   */
  undo(): number {
    if (this.complete || this.moves.length === 0) return -1;
    const last = this.moves.pop()!;
    this.lines = this.lines.slice(0, -1);
    let s = G.init(this.info.seedKey, this.info.level);
    for (const m of this.moves) s = G.apply(s, G.decodeMove(m)!)!;
    this.setState(s);
    this.recent.pop();
    const prev = this.moves[this.moves.length - 1];
    const pm = prev ? G.decodeMove(prev) : null;
    this.lastMoveCell = pm ? index(pm.x, pm.y) : -1;
    this.restoredLastMove = null;
    this.rewriteJournal();
    const m = G.decodeMove(last)!;
    return index(m.x, m.y);
  }

  /**
   * Sync: take over another device's in-progress journal for this level (move lines joined, as in
   * the journal file). Every move must verify (verifyRun); otherwise the board stays fresh and
   * false is returned.
   */
  adoptLines(joined: string): boolean {
    const lines = joined.match(/.{10}/g) ?? [];
    if (this.complete || this.moves.length > 0 || lines.length === 0 || lines.join("") !== joined) return false;
    this.replayJournal(journalHeader(this.info) + lines.map((l) => `${l}\n`).join(""));
    if (this.moves.length === lines.length) {
      this.rewriteJournal();
      this.restoreInfo = `adopted ${lines.length} moves (sync)`;
      return true;
    }
    if (this.complete) return true; // a complete journal finished the level (like a relaunch would)
    this.restart();
    return false;
  }

  private rewriteJournal(): void {
    const t = journalHeader(this.info) + this.lines.join("");
    const slot = this.slot;
    enqueue("rewrite", () => writeJournal(slot, t));
  }
}

/** Facade the scene talks to: the active run (a track's or the daily's) + both tracks' progress. */
export class Session {
  /** the tracks' runs in memory (never the daily) */
  private runs: Partial<Record<Track, TrackRun>> = {};
  /** the daily's run in memory (kept after leaving it: reopening the same date is instant) */
  private dailyRun: TrackRun | null = null;
  private cur: TrackRun;
  private readonly save: () => void;

  private constructor(private readonly prog: Progress, first: TrackRun) {
    this.save = Session.saver(prog);
    this.cur = first;
    this.keep(first);
  }

  private keep(r: TrackRun): void {
    if (r.info.daily) this.dailyRun = r;
    else this.runs[r.track] = r;
  }

  private static saver(prog: Progress): () => void {
    return () => {
      const text = JSON.stringify(prog);
      enqueue("progress", () => writeAtomic(PROGRESS, text));
    };
  }

  /** Launch path: progress and both tracks' cache + journal reads run in parallel. */
  static async restore(): Promise<Session> {
    journalDirty.clear();
    const [progText, gc, gj, dc, dj] = await Promise.all([
      readAtomicText(PROGRESS), readAtomicText(levelFile("gentle")), readAtomic(journalFile("gentle")), readAtomicText(levelFile("deduce")), readAtomic(journalFile("deduce")),
    ]);
    const prog = parseProgress(progText ?? null);
    const save = Session.saver(prog);
    let session: Session | null = null;
    // killed while on today's daily → straight back into it (yesterday's daily → the track)
    if (prog.daily && prog.daily === localDateISO()) {
      try {
        session = new Session(prog, await TrackRun.loadDaily(prog.daily, prog, save));
      } catch (e) {
        console.warn("[session] daily restore failed", e);
      }
    }
    if (!session) {
      if (prog.daily) {
        delete prog.daily;
        save();
      }
      const t = prog.track;
      const pre = t === "gentle" ? { cache: gc ?? null, journal: gj } : { cache: dc ?? null, journal: dj };
      const run = await TrackRun.load(t, prog, save, pre);
      if (!progText) save();
      session = new Session(prog, run);
    }
    if ((import.meta.env.DEV && import.meta.env.MODE !== "test") || import.meta.env.MODE === "e2e") {
      const s = session;
      void import("../testing/bridge.ts").then((b) => b.attachSession(s));
    }
    return session;
  }

  /** On the daily right now. */
  get daily(): string | null {
    return this.cur.info.daily;
  }

  /** Completion hook of the daily (live completion). */
  set onDailyComplete(f: (() => void) | null) {
    this.dailyHook = f;
    if (this.dailyRun) this.dailyRun.onComplete = f;
  }
  private dailyHook: (() => void) | null = null;

  /** Open a date's daily. A daily already completed starts over as practice when `practice`. */
  async openDaily(dateISO: string, practice: boolean): Promise<void> {
    const r = this.dailyRun?.info.daily === dateISO ? this.dailyRun : await TrackRun.loadDaily(dateISO, this.prog, this.save);
    if (r.complete && practice) r.restart();
    r.onComplete = this.dailyHook;
    this.dailyRun = r;
    this.cur = r;
    this.prog.daily = dateISO;
    this.save();
  }

  /** Back from the daily to the track the player was on (also after a relaunch into the daily). */
  async leaveDaily(): Promise<void> {
    if (!this.cur.info.daily) return;
    const t = this.prog.track;
    const run = this.runs[t] ?? (await TrackRun.load(t, this.prog, this.save, undefined, { offThread: true }));
    this.runs[t] = run;
    delete this.prog.daily;
    this.save();
    this.cur = run;
    run.prefetchNext();
  }

  /** The track the player is on (or returns to from the daily). */
  get homeTrack(): Track {
    return this.prog.track;
  }

  undo(): number {
    return this.cur.undo();
  }

  get track(): Track {
    return this.cur.track;
  }
  get levelNumber(): number {
    return this.cur.info.n;
  }
  get seedKey(): string {
    return this.cur.info.seedKey;
  }
  get level(): PipsLevel {
    return this.cur.info.level;
  }
  get state(): PipsState {
    return this.cur.state;
  }
  get complete(): boolean {
    return this.cur.complete;
  }
  get moves(): readonly Uint8Array[] {
    return this.cur.moves;
  }
  get restoredLastMove(): PipsMove | null {
    return this.cur.restoredLastMove;
  }
  get restoreInfo(): string {
    return this.cur.restoreInfo;
  }
  /** Toggled cells of this level, oldest first. */
  get recentCells(): readonly number[] {
    return this.cur.recent;
  }
  /** Cell of the latest toggle on this level, -1 if none. */
  get lastMoveCell(): number {
    return this.cur.lastMoveCell;
  }
  cleared(t: Track): number {
    return this.prog[t].cleared;
  }
  /** Current 1-based level number on a track (door plates of the far tower / home). */
  levelOf(t: Track): number {
    return this.prog[t].level;
  }
  hintsUsed(t: Track = this.track): number {
    return this.prog[t].hints;
  }

  analysis(): BoardAnalysis {
    return this.cur.analysis();
  }
  tap(x: number, y: number): TapResult {
    return this.cur.tap(x, y);
  }
  removeMany(cells: readonly number[]): number[] {
    return this.cur.removeMany(cells);
  }
  hint(): Hint {
    return this.cur.hint();
  }
  /** Idempotent: generation of the next level already starts when a level loads. */
  prefetchNext(): void {
    this.cur.prefetchNext();
  }
  /** The next level is generated: advance() is instant (always true on the daily). */
  get nextReady(): boolean {
    return this.cur.nextReady;
  }
  /** "ready" | "generating" (worker busy: show a waiting state) | "idle" (nothing started: no worker). */
  get nextLevelStatus(): NextLevelStatus {
    return this.cur.nextStatus;
  }
  /** Resolves when the next level of the current track is generated (never rejects, no time cap). */
  get nextLevelReady(): Promise<void> {
    return this.cur.whenNextReady();
  }
  whenNextReady(): Promise<void> {
    return this.cur.whenNextReady();
  }
  advance(): void {
    if (this.cur.info.daily) return;
    this.cur = this.cur.advance();
    this.runs[this.cur.track] = this.cur;
  }
  /** After a failed next-level generation: start another attempt (no-op unless it failed). */
  retryNext(): void {
    if (this.cur.nextStatus === "failed") void this.cur.whenNextReady();
  }
  /** Retries exhausted: the solved level comes back as a fresh board (see TrackRun.fallbackToSolved). */
  fallbackToSolved(): void {
    if (this.cur.info.daily) return;
    this.cur = this.cur.fallbackToSolved();
    this.runs[this.cur.track] = this.cur;
  }

  /** One-tap switch between the gentle and deduce tracks. Resolves once the other track's level is ready. */
  async switchTrack(): Promise<void> {
    if (this.cur.info.daily) return this.leaveDaily();
    const to: Track = this.track === "gentle" ? "deduce" : "gentle";
    const run = this.runs[to] ?? (await TrackRun.load(to, this.prog, this.save, undefined, { offThread: true }));
    this.runs[to] = run;
    this.prog.track = to;
    this.save();
    this.cur = run;
    run.prefetchNext();
    // a level finished on that track while away was already advanced in memory by the scene
  }

  // ---------------------------------------------------------------- sync (src/sync)

  /** Both tracks' progress as it is in memory (copies). */
  syncProgress(): Record<Track, TrackProgress> {
    return { gentle: { ...this.prog.gentle }, deduce: { ...this.prog.deduce } };
  }

  /** This device is mid-level on track t right now (its board on screen, moves made, unsolved): local wins. */
  syncBusy(t: Track): boolean {
    return !this.cur.info.daily && this.cur.track === t && this.cur.moves.length > 0 && !this.cur.complete;
  }

  /** Adopting progress / a journal for track t would replace the board on screen. */
  syncOnScreen(t: Track): boolean {
    return !this.cur.info.daily && this.cur.track === t;
  }

  /**
   * Sync: merged progress for track t (only ever raised) and remote in-progress journals for its
   * level (best first; the first that fully verifies is taken — a track not on screen gets the
   * first one written, verified with the longest-prefix rule when it loads). Mid-level here → "busy"
   * (nothing changes: the device's own play wins; try again at the next level boundary).
   * "current" = the board on screen was replaced (the scene swaps it in).
   */
  async syncAdopt(t: Track, p: TrackProgress, journals: readonly string[]): Promise<"busy" | "none" | "stored" | "current"> {
    if (this.syncBusy(t)) return "busy";
    const q = this.prog[t];
    const up = p.level > q.level;
    const counts = p.cleared > q.cleared || p.hints > q.hints;
    if (p.level >= q.level) {
      q.cleared = Math.max(q.cleared, p.cleared);
      q.hints = Math.max(q.hints, p.hints);
    }
    if (up) q.level = p.level;
    const run = this.runs[t];
    const sameLevel = run?.info.n === q.level;
    // a journal is taken when this device has no moves on that level (or is not on it right now)
    const takeJournal = journals.length > 0 && (!sameLevel || !this.syncOnScreen(t) || run!.moves.length === 0);
    if (!up && !counts && !takeJournal) return "none";
    this.save();
    if (!up && !takeJournal) return "stored";
    if (this.syncOnScreen(t)) {
      const fresh = await TrackRun.load(t, this.prog, this.save, { cache: await readAtomicText(levelFile(t)), journal: { text: null, fromTmp: false } }, { offThread: true });
      for (const l of takeJournal ? journals : []) if (fresh.adoptLines(l)) break;
      this.runs[t] = fresh;
      this.cur = fresh;
      return "current";
    }
    delete this.runs[t];
    const n = q.level;
    const head = journalHeader({ levelId: levelIdFor(t, n), seedKey: seedKeyFor(t, n) });
    const first = takeJournal ? (journals[0]!.match(/.{10}/g) ?? []).map((l) => `${l}\n`).join("") : "";
    if (up || first) enqueue("sync-journal", () => writeJournal(t, head + first));
    await flush();
    return "stored";
  }

  /** DEV only (shot hook): jump to level n of the home track with an empty board (leaves the daily). */
  devJump(n: number): void {
    const t = this.prog.track;
    this.prog[t].level = n;
    this.prog[t].cleared = n - 1;
    delete this.prog.daily;
    this.save();
    const info = generateInfo(t, n);
    writeCache(info);
    const r = new TrackRun(info, this.prog, this.save);
    r.restoreInfo = `dev jump ${n}`;
    r.resetJournal();
    r.prefetchNext();
    this.cur = r;
    this.runs[t] = r;
  }
}
