// Daily lantern (lazy-loaded: nothing here is on the cold-start path).
//
//   entrance   the moon in the sky (Scenery) opens today's daily (device-local date)
//   clock      no timer on screen; active play time is counted in the background
//              (paused while the app is in the background or the player is elsewhere)
//   result     first completion of the date: the bottom sheet in ResultSheet.ts (calendar
//              tile, ⏱ m:ss, 🔥 streak + the month's shields); share (system share sheet,
//              @capacitor/share; the "show time in share" setting) lives here
//   streak     consecutive days with a completed daily. Each calendar month has two
//              automatic shields that cover a missed day (shift workers). Only a
//              completion on the daily's own local date counts (finish by midnight);
//              replays of a completed daily are practice and change nothing.
//
// Preferences: "daily" = DailyState of the current date, "streak" = StreakState (a cache: the
// streak can always be recomputed from the completion log with the same rules, see streakFromDates).
// Library/lanternly/pips-daily-log.json = the persistent completion log (phase 4, iCloud sync):
//   {v:1, days: {"YYYY-MM-DD": {at, ms, hints, undos}}}   temp + rename
// One record per COUNTED completion (finished on its own local date; the clock going backwards is
// ignored, exactly like countCompletion), so recomputing the streak from the log's dates gives the
// stored StreakState. Players from before the log: migrateLog() recovers the dates from the
// runs/p5-daily-<date>.bin files (only those written on their own local date: the rest were
// after-midnight practice), the streak's last date and the current DailyState.
import { Preferences } from "@capacitor/preferences";
import { type DailyResult, isoDay, isoFromDay, type PipsLevel, shareText } from "./pipsApi.ts";
import { clock, localDateISO } from "./session.ts";
import { enqueue, listDir, mtimeOf, readAtomicText, writeAtomic } from "../save/store.ts";
import { syncSignal } from "../sync/signal.ts";

export const SHIELDS_PER_MONTH = 2;

export interface DailyState {
  date: string;
  /** active play ms before the first completion */
  ms: number;
  hints: number;
  /** R2 (A5): how many moves had been made when each hint was used (the postcard's strip) */
  hintAt?: number[];
  undos: number;
  /** the counted (first) completion of this date */
  result: DailyResult | null;
}

export interface StreakState {
  v: 1;
  /** date of the last counted completion */
  last: string | null;
  streak: number;
  best: number;
  /** shields used per month "YYYY-MM" */
  shields: Record<string, number>;
}

const freshDaily = (date: string): DailyState => ({ date, ms: 0, hints: 0, undos: 0, result: null });
const freshStreak = (): StreakState => ({ v: 1, last: null, streak: 0, best: 0, shields: {} });

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const r = await Preferences.get({ key });
    return r.value ? (JSON.parse(r.value) as T) : null;
  } catch {
    return null;
  }
}
function writeJson(key: string, v: unknown): void {
  void Preferences.set({ key, value: JSON.stringify(v) }).catch(() => undefined);
}

export async function loadDaily(date: string): Promise<DailyState> {
  const d = await readJson<DailyState>("daily");
  if (!d || d.date !== date || typeof d.ms !== "number") return freshDaily(date);
  const hintAt = Array.isArray(d.hintAt) ? d.hintAt.filter((k) => Number.isInteger(k) && k >= 0).slice(0, 999) : [];
  return { date, ms: Math.max(0, d.ms), hints: d.hints | 0, hintAt, undos: d.undos | 0, result: d.result ?? null };
}
export function saveDaily(d: DailyState): void {
  writeJson("daily", d);
}

export async function loadStreak(): Promise<StreakState> {
  const s = await readJson<StreakState>("streak");
  if (!s || s.v !== 1) return freshStreak();
  return { v: 1, last: s.last ?? null, streak: s.streak | 0, best: s.best | 0, shields: s.shields ?? {} };
}

const monthOf = (day: number): string => isoFromDay(day).slice(0, 7);

/** The calendar month before "YYYY-MM" (Jan → Dec of the year before). */
export function prevMonth(ym: string): string {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5, 7));
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/**
 * Missed days between the last counted completion and `day` (exclusive), each
 * covered by a shield of its own month while that month has one left.
 * Returns the shields that would be spent, or null when the streak breaks.
 */
function cover(s: StreakState, day: number): Record<string, number> | null {
  if (!s.last) return null;
  const from = isoDay(s.last) + 1;
  const spend: Record<string, number> = {};
  for (let m = from; m < day; m++) {
    const k = monthOf(m);
    const used = (s.shields[k] ?? 0) + (spend[k] ?? 0);
    if (used >= SHIELDS_PER_MONTH) return null;
    spend[k] = (spend[k] ?? 0) + 1;
  }
  return spend;
}

/** Pure step of the streak rules: `date` counted after `s` (a repeat or an earlier date changes nothing). */
export function stepStreak(s: StreakState, date: string): StreakState {
  if (s.last === date) return s;
  const day = isoDay(date);
  if (s.last && isoDay(s.last) > day) return s; // clock went backwards: ignore
  const spend = cover(s, day);
  const next: StreakState = { ...s, shields: { ...s.shields } };
  if (spend) {
    for (const [k, n] of Object.entries(spend)) next.shields[k] = (next.shields[k] ?? 0) + n;
    next.streak = s.streak + 1;
  } else next.streak = 1;
  next.best = Math.max(next.best, next.streak);
  next.last = date;
  // keep the shield book small (this month and the two calendar months before are enough;
  // not day−31 / day−62, which skips last month on the 1st after a 30-day month)
  const m0 = monthOf(day);
  const m1 = prevMonth(m0);
  const keep = new Set([m0, m1, prevMonth(m1)]);
  for (const k of Object.keys(next.shields)) if (!keep.has(k)) delete next.shields[k];
  return next;
}

/** Count a completion of `date` (call once per date; a repeat date changes nothing). */
export function countCompletion(s: StreakState, date: string): StreakState {
  const next = stepStreak(s, date);
  if (next !== s) writeJson("streak", next);
  return next;
}

/** Store a streak (sync: the merged one). */
export function saveStreak(s: StreakState): void {
  writeJson("streak", s);
}

/** The streak recomputed from a set of counted dates with the same rules (cover(), shields, best). */
export function streakFromDates(dates: Iterable<string>): StreakState {
  return [...new Set(dates)].sort().reduce(stepStreak, freshStreak());
}

// ---------------------------------------------------------------- completion log

/** One counted completion. `at` = wall-clock ms (whole seconds), 0 = unknown (recovered without a time). */
export interface DayRec {
  at: number;
  ms: number;
  hints: number;
  undos: number;
}
export type DailyLog = Record<string, DayRec>;
export const LOG_FILE = "pips-daily-log.json";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const nat = (x: unknown): number => (Number.isFinite(x) && (x as number) > 0 ? Math.floor(x as number) : 0);

/** The record kept when a date has two: the earliest known `at` (unknown loses), then the smaller ms, hints, undos. */
export function betterRec(a: DayRec, b: DayRec): DayRec {
  const ka = [a.at > 0 ? a.at : Infinity, a.ms, a.hints, a.undos];
  const kb = [b.at > 0 ? b.at : Infinity, b.ms, b.hints, b.undos];
  for (let i = 0; i < 4; i++) if (ka[i] !== kb[i]) return ka[i]! < kb[i]! ? a : b;
  return a;
}

export function cleanRec(r: Partial<DayRec> | null | undefined): DayRec {
  return { at: Math.floor(nat(r?.at) / 1000) * 1000, ms: nat(r?.ms), hints: nat(r?.hints), undos: nat(r?.undos) };
}

function parseLog(text: string | null): DailyLog | null {
  if (!text) return null;
  try {
    const f = JSON.parse(text) as { v?: number; days?: Record<string, Partial<DayRec>> };
    if (f.v !== 1 || !f.days || typeof f.days !== "object") return null;
    const out: DailyLog = {};
    for (const [d, r] of Object.entries(f.days)) if (DATE_RE.test(d)) out[d] = cleanRec(r);
    return out;
  } catch {
    return null;
  }
}

let logP: Promise<DailyLog> | null = null;
/** the loaded log (the same object mergeIntoLog updates), null until read */
let logV: DailyLog | null = null;

/** The completion log (read once; a missing file is migrated from the old saves). Never rejects. */
export function loadLog(): Promise<DailyLog> {
  logP ??= readAtomicText(LOG_FILE)
    .then(
      (t) => parseLog(t) ?? migrateLog(),
      () => migrateLog(),
    )
    .then((l) => (logV = l));
  return logP;
}

/** The log if it is already in memory (the village opens without a task hop), else null. */
export function logNow(): DailyLog | null {
  return logV;
}

/** Tests: forget the in-memory log (the file stays). */
export function resetLogCache(): void {
  logP = null;
  logV = null;
}

function writeLog(log: DailyLog): void {
  const days: DailyLog = {};
  for (const d of Object.keys(log).sort()) days[d] = log[d]!;
  const text = JSON.stringify({ v: 1, days });
  enqueue("daily-log", () => writeAtomic(LOG_FILE, text));
}

/** Union `add` into the log (same date: betterRec). Returns the dates that changed. */
export async function mergeIntoLog(add: DailyLog): Promise<string[]> {
  const log = await loadLog();
  const changed: string[] = [];
  for (const [d, r] of Object.entries(add)) {
    if (!DATE_RE.test(d)) continue;
    const have = log[d];
    const next = have ? betterRec(have, r) : r;
    if (next !== have) {
      log[d] = { ...next };
      changed.push(d);
    }
  }
  if (changed.length) writeLog(log);
  return changed;
}

/**
 * The first players' saves → the log: run.bin files of dailies written on their own local date
 * (the file time; a file without one counts), the streak's last counted date, and the current
 * DailyState's numbers for its date.
 */
export async function migrateLog(): Promise<DailyLog> {
  const log: DailyLog = {};
  for (const name of await listDir("runs")) {
    const m = /^p5-daily-(\d{4}-\d{2}-\d{2})\.bin$/.exec(name);
    if (!m) continue;
    const date = m[1]!;
    const t = await mtimeOf(`runs/${name}`);
    if (t !== null && localDateISO(new Date(t)) !== date) continue; // finished after midnight: practice
    log[date] = cleanRec({ at: t ?? 0 });
  }
  const st = await loadStreak();
  if (st.last && DATE_RE.test(st.last)) log[st.last] ??= cleanRec(null);
  const d = await readJson<DailyState>("daily");
  const r = d && typeof d.date === "string" ? log[d.date] : undefined;
  if (d?.result && r) Object.assign(r, cleanRec({ at: r.at, ms: d.ms, hints: d.hints, undos: d.undos }));
  writeLog(log);
  return log;
}

/**
 * A completion of `date` finished on that local date: logged (when the streak rules accept it)
 * and counted. The sync mirror is told (debounced write).
 */
export function recordCompletion(s: StreakState, date: string, rec: Omit<DayRec, "at">): StreakState {
  const next = countCompletion(s, date);
  if (next !== s || s.last === date) {
    const r = cleanRec({ ...rec, at: clock.now().getTime() });
    logWrites = logWrites.then(() => mergeIntoLog({ [date]: r })).then(() => syncSignal.dirty("daily"), () => undefined);
  }
  return next;
}
let logWrites: Promise<unknown> = Promise.resolve();
/** Resolves once every recordCompletion so far is in the log (tests, the sync snapshot). */
export function logSettled(): Promise<void> {
  return logWrites.then(() => undefined);
}

/** Streak as shown on `today`: alive while the missed days can still be covered by shields. */
export function liveStreak(s: StreakState, today: string): number {
  if (!s.last || s.streak === 0) return 0;
  const day = isoDay(today);
  if (isoDay(s.last) >= day - 1) return s.streak;
  return cover(s, day) ? s.streak : 0;
}

/** Shields left this month on `today` (pending covers for already-missed days included). */
export function shieldsLeft(s: StreakState, today: string): number {
  const day = isoDay(today);
  const k = monthOf(day);
  const pending = s.last ? (cover(s, day)?.[k] ?? 0) : 0;
  return Math.max(0, SHIELDS_PER_MONTH - (s.shields[k] ?? 0) - pending);
}

/** Active-time clock: runs only while started and not paused. */
export class DailyClock {
  private t0 = -1;
  constructor(public ms: number) {}
  get running(): boolean {
    return this.t0 >= 0;
  }
  start(): void {
    if (this.t0 < 0) this.t0 = clock.mono();
  }
  stop(): number {
    if (this.t0 >= 0) {
      this.ms += clock.mono() - this.t0;
      this.t0 = -1;
    }
    return this.ms;
  }
  peek(): number {
    return this.ms + (this.t0 >= 0 ? clock.mono() - this.t0 : 0);
  }
}

/** The postcard image to attach (R2, A5): the spec + words; baked only when Share is tapped. */
export interface ShareCard {
  spec: import("./postcard.ts").PostcardSpec;
  words: import("./postcard.ts").PostcardWords;
}

/** Bake the postcard and write it to Caches → its file URI for the share sheet; null on any failure (text-only share). */
async function postcardFile(card: ShareCard): Promise<string | null> {
  try {
    const { bakeSharePng } = await import("./postcard.ts");
    const b64 = bakeSharePng(card.spec, card.words);
    if (!b64) return null;
    const { Directory, Filesystem } = await import("@capacitor/filesystem");
    const n = card.spec.n >= 1 ? card.spec.n : card.spec.dateISO;
    const r = await Filesystem.writeFile({ path: `share/duskwick-${n}.png`, data: b64, directory: Directory.Cache, recursive: true });
    return r.uri;
  } catch (e) {
    console.warn("[share] postcard image skipped", e);
    return null;
  }
}

/**
 * System share sheet: the rules' text (with the daily's link) + the postcard image when given.
 * Falls back to text only (image bake / write failed), then to the Web Share API / console in a browser.
 */
export async function shareResult(level: PipsLevel, r: DailyResult, showTime = true, card?: ShareCard): Promise<void> {
  const text = shareText(level, r, { showTime });
  const file = card ? await postcardFile(card) : null;
  try {
    const { Share } = await import("@capacitor/share");
    await Share.share({ text, dialogTitle: " ", ...(file ? { files: [file] } : {}) });
  } catch (e) {
    // the player closed the sheet: done (never open a second, web share sheet)
    if (/cancel/i.test(e instanceof Error ? e.message : String(e))) return;
    const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
    if (nav.share) await nav.share({ text }).catch(() => undefined);
    else console.info("[share]", text, e);
  }
}
