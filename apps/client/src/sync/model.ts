// Pure sync model (no platform calls): a device's snapshot, its compact wire form, and the merge.
//
// Every device writes ONLY its own key `d.<deviceId>` (iCloud key-value store) and reads all
// `d.*` keys. Nothing is ever overwritten with remote state: readers merge, and the merge is a
// set function (commutative, idempotent) that never loses progress:
//   progress per track   max(level), max(cleared), max(hints)
//   daily log            union of dates; same date → earliest known `at` (tie: smaller ms, hints, undos)
//   streak               recomputed from the union of dates ≤ today with the existing rules
//                        (daily.ts stepStreak / cover()), and — so that merging never lowers the
//                        streak shown today — each device's own StreakState extended by the union's
//                        later dates competes with it; the highest live streak wins; best = max
//   journal              per track, only for the merged level: the newest (updatedAt, deviceId)
//                        candidates (verifyRun decides on adoption; local wins while it is on it)
//   settings             numbers / shareTime: last writer wins by (at, deviceId)
//   guide, shieldIntro   bits OR'd
//   village (v)          bit sets OR'd, rooms last writer wins per room by a Lamport counter
//                        (src/village/vstate.ts: clock-rollback safe); never trimmed (≈ 1 KB, ≤ 2 KB)
// muted / haptics / ads state are device-local and never leave the device. Keepsakes are not
// synced (the town regenerates them deterministically up to the merged progress).
// Timestamps from the future (clock skew) are clamped to `now`; dates after `today` stay in the
// log but count for the streak only once they have arrived.
import { betterRec, cleanRec, type DailyLog, type DayRec, liveStreak, stepStreak, type StreakState, streakFromDates } from "../game/daily.ts";
import { isoDay, isoFromDay, type Track } from "../game/pipsApi.ts";
import { decodeV, emptyV, encodeV, mergeV, sameV, type VState, type VWire } from "../village/vstate.ts";

export const TRACK_LIST: readonly Track[] = ["gentle", "deduce"];
export type SettingKey = "numbers" | "shareTime";
export const SETTING_KEYS: readonly SettingKey[] = ["numbers", "shareTime"];
/** Hard cap per key (the native plugin refuses more); a quota event halves the budget. */
export const MAX_BYTES = 64 * 1024;
/** Budget a snapshot is trimmed to (oldest journal first, then the oldest days' details). */
export const DEFAULT_BUDGET = 60 * 1024;
export const MIN_BUDGET = 256;
export const KEY_PREFIX = "d.";
/** Journal candidates kept per track in a merged state. */
const JOURNAL_KEEP = 3;
/** at values in the log are stored as seconds since 2026-01-01T00:00:00Z (base 36). */
const EPOCH_S = 1_767_225_600;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LINES_RE = /^(?:[0-9a-f]{10}){1,400}$/;

export interface TrackP {
  level: number;
  cleared: number;
  hints: number;
}
/** An in-progress journal: `l` = the journal's move lines ("<move hex2><stateHash hex8>") joined. */
export interface JournalRec {
  t: Track;
  n: number;
  l: string;
  at: number;
  dev: string;
}
export interface Setting {
  v: string;
  at: number;
  dev: string;
}
export interface SyncState {
  p: Record<Track, TrackP>;
  s: StreakState;
  d: DailyLog;
  j: JournalRec[];
  st: Partial<Record<SettingKey, Setting>>;
  g: number;
  si: boolean;
  /** the village (src/village/vstate.ts) */
  v: VState;
}
export interface Snapshot extends SyncState {
  dev: string;
  /** when this device wrote it (ms) */
  at: number;
}

const freshStreak = (): StreakState => ({ v: 1, last: null, streak: 0, best: 0, shields: {} });

export function emptyState(): SyncState {
  return { p: { gentle: { level: 1, cleared: 0, hints: 0 }, deduce: { level: 1, cleared: 0, hints: 0 } }, s: freshStreak(), d: {}, j: [], st: {}, g: 0, si: false, v: emptyV() };
}

const int = (x: unknown, min = 0): number => (Number.isInteger(x) && (x as number) >= min ? (x as number) : min);
const sortKeys = <T>(o: Record<string, T>): Record<string, T> => {
  const out: Record<string, T> = {};
  for (const k of Object.keys(o).sort()) out[k] = o[k]!;
  return out;
};
const cmp = (a: string | number, b: string | number): number => (a < b ? -1 : a > b ? 1 : 0);

// ---------------------------------------------------------------- merge

/** Streak order on `today`: live streak, then streak, last date, best, shield book. */
function cmpStreak(a: StreakState, b: StreakState, today: string): number {
  return (
    cmp(liveStreak(a, today), liveStreak(b, today)) || cmp(a.streak, b.streak) || cmp(a.last ?? "", b.last ?? "") || cmp(a.best, b.best) ||
    cmp(JSON.stringify(sortKeys(a.shields)), JSON.stringify(sortKeys(b.shields)))
  );
}

/**
 * The merged streak: the union's dates (≤ today) recomputed with the rules, against every device's
 * own state extended by the union's later dates; the highest live streak on `today` wins (so a merge
 * never lowers it — the greedy shield rule alone is not monotonic in its dates); best = max.
 */
export function mergeStreak(cands: readonly StreakState[], dates: Iterable<string>, today: string): StreakState {
  const ds = [...new Set(dates)].filter((d) => DATE_RE.test(d) && d <= today).sort();
  const ext = (c: StreakState): StreakState => {
    let s = c;
    for (const d of ds) if (!s.last || d > s.last) s = stepStreak(s, d);
    return s;
  };
  const ok = cands.filter((c) => !c.last || c.last <= today);
  const pool = [streakFromDates(ds), ...ok.map(ext)];
  let top = pool[0]!;
  for (const p of pool) if (cmpStreak(p, top, today) > 0) top = p;
  const best = Math.max(...pool.map((p) => p.best), ...ok.map((c) => c.best));
  return { v: 1, last: top.last, streak: top.streak, best, shields: sortKeys(top.shields) };
}

const cmpSetting = (a: Setting, b: Setting): number => cmp(a.at, b.at) || cmp(a.dev, b.dev) || cmp(a.v, b.v);
const cmpJournal = (a: JournalRec, b: JournalRec): number => cmp(a.at, b.at) || cmp(a.dev, b.dev) || cmp(a.l.length, b.l.length) || cmp(a.l, b.l);

/** Merge states (snapshots or earlier merges). Commutative and idempotent for a fixed `today` / `now`. */
export function mergeStates(xs: readonly SyncState[], today: string, now: number): SyncState {
  const out = emptyState();
  const clampAt = (t: number): number => Math.min(t, now);
  const nowSec = Math.floor(now / 1000) * 1000; // the log keeps whole seconds
  const days: DailyLog = {};
  for (const x of xs) {
    for (const t of TRACK_LIST) {
      const a = out.p[t];
      const b = x.p[t];
      out.p[t] = { level: Math.max(a.level, b.level), cleared: Math.max(a.cleared, b.cleared), hints: Math.max(a.hints, b.hints) };
    }
    for (const [d, r] of Object.entries(x.d)) {
      if (!DATE_RE.test(d)) continue;
      const c: DayRec = { ...r, at: Math.min(r.at, nowSec) };
      const have = days[d];
      days[d] = have ? betterRec(have, c) : c;
    }
    for (const k of SETTING_KEYS) {
      const v = x.st[k];
      if (!v) continue;
      const c = { ...v, at: clampAt(v.at) };
      const have = out.st[k];
      if (!have || cmpSetting(c, have) > 0) out.st[k] = c;
    }
    out.g |= x.g;
    out.si ||= x.si;
  }
  out.d = sortKeys(days);
  const seen = new Map<string, JournalRec>();
  for (const x of xs) {
    for (const r of x.j) {
      if (r.n !== out.p[r.t].level) continue; // that level was solved somewhere: obsolete
      const c = { ...r, at: clampAt(r.at) };
      seen.set(`${c.t}|${c.dev}|${c.at}|${c.l}`, c);
    }
  }
  const all = [...seen.values()];
  out.j = TRACK_LIST.flatMap((t) => all.filter((r) => r.t === t).sort((a, b) => -cmpJournal(a, b)).slice(0, JOURNAL_KEEP));
  out.s = mergeStreak(xs.map((x) => x.s), Object.keys(out.d), today);
  out.v = mergeV(xs.map((x) => x.v), now);
  return out;
}

// ---------------------------------------------------------------- what to apply locally

export interface Plan {
  /** log records to union into the local log (new dates or better records) */
  log: DailyLog;
  /** the merged streak, when it differs from the local one */
  streak: StreakState | null;
  /** tracks whose merged progress is ahead of this device */
  progress: Partial<Record<Track, TrackP>>;
  /** per track: remote journal candidates for the merged level, best first (newer than the local one) */
  journals: Partial<Record<Track, JournalRec[]>>;
  /** settings whose winner is another device's value */
  settings: Partial<Record<SettingKey, Setting>>;
  /** guide bits to add */
  guide: number;
  shieldIntro: boolean;
  /** the merged village state, when it differs from the local one (merged into the local store) */
  v: VState | null;
}

export function planFor(local: Snapshot, merged: SyncState): Plan {
  const log: DailyLog = {};
  for (const [d, r] of Object.entries(merged.d)) {
    const have = local.d[d];
    if (!have || (betterRec(have, r) !== have && JSON.stringify(have) !== JSON.stringify(r))) log[d] = r;
  }
  const ls = local.s;
  const ms = merged.s;
  const streak = ls.last === ms.last && ls.streak === ms.streak && ls.best === ms.best && JSON.stringify(sortKeys(ls.shields)) === JSON.stringify(ms.shields) ? null : ms;
  const progress: Plan["progress"] = {};
  const journals: Plan["journals"] = {};
  for (const t of TRACK_LIST) {
    const a = local.p[t];
    const b = merged.p[t];
    if (b.level > a.level || b.cleared > a.cleared || b.hints > a.hints) progress[t] = b;
    const mine = local.j.find((r) => r.t === t && r.n === b.level);
    const cands = merged.j.filter((r) => r.t === t && r.n === b.level && r.dev !== local.dev && (!mine || cmpJournal(r, mine) > 0) && r.l !== mine?.l);
    if (cands.length) journals[t] = cands;
  }
  const settings: Plan["settings"] = {};
  for (const k of SETTING_KEYS) {
    const w = merged.st[k];
    if (w && w.dev !== local.dev && w.v !== local.st[k]?.v) settings[k] = w;
  }
  return { log, streak, progress, journals, settings, guide: merged.g & ~local.g, shieldIntro: merged.si && !local.si, v: sameV(local.v ?? emptyV(), merged.v) ? null : merged.v };
}

export function planEmpty(p: Plan): boolean {
  return (
    Object.keys(p.log).length === 0 && !p.streak && Object.keys(p.progress).length === 0 && Object.keys(p.journals).length === 0 &&
    Object.keys(p.settings).length === 0 && p.guide === 0 && !p.shieldIntro && !p.v
  );
}

// ---------------------------------------------------------------- wire form

interface Wire {
  v: 1;
  dev: string;
  at: number;
  /** [gentle level, cleared, hints, deduce level, cleared, hints] */
  p: number[];
  /** [last or "", streak, best, shields] */
  s: [string, number, number, Record<string, number>];
  /** o = first date, b = base64 bit per day from o, r = "dayOff.atSec.ms.hints.undos" (base 36, comma separated) */
  d: { o: string; b: string; r: string } | null;
  /** [track 0/1, n, lines, at] */
  j: Array<[number, number, string, number]>;
  st: Partial<Record<SettingKey, [string, number]>>;
  g: number;
  si: 0 | 1;
  /** the village (vstate.ts encodeV). Not "v": that key is the wire version older builds check. */
  vl?: VWire;
}

const b36 = (n: number): string => n.toString(36);

function wireOf(s: Snapshot, journals: readonly JournalRec[], dates: readonly string[], detailFrom: number): Wire {
  let d: Wire["d"] = null;
  if (dates.length) {
    const o = dates[0]!;
    const d0 = isoDay(o);
    const bytes = new Uint8Array(((isoDay(dates.at(-1)!) - d0) >> 3) + 1);
    for (const x of dates) {
      const k = isoDay(x) - d0;
      bytes[k >> 3] = bytes[k >> 3]! | (1 << (k & 7));
    }
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    const r: string[] = [];
    for (let i = detailFrom; i < dates.length; i++) {
      const x = dates[i]!;
      const rec = s.d[x]!;
      if (rec.at <= 0 && !rec.ms && !rec.hints && !rec.undos) continue;
      r.push([b36(isoDay(x) - d0), rec.at > 0 ? b36(Math.floor(rec.at / 1000) - EPOCH_S) : "", b36(rec.ms), b36(rec.hints), b36(rec.undos)].join("."));
    }
    d = { o, b: btoa(bin), r: r.join(",") };
  }
  const st: Wire["st"] = {};
  for (const k of SETTING_KEYS) {
    const v = s.st[k];
    if (v) st[k] = [v.v, v.at];
  }
  return {
    v: 1,
    dev: s.dev,
    at: s.at,
    p: TRACK_LIST.flatMap((t) => [s.p[t].level, s.p[t].cleared, s.p[t].hints]),
    s: [s.s.last ?? "", s.s.streak, s.s.best, sortKeys(s.s.shields)],
    d,
    j: journals.map((r) => [r.t === "deduce" ? 1 : 0, r.n, r.l, r.at]),
    st,
    g: s.g,
    si: s.si ? 1 : 0,
    ...(() => {
      const vl = encodeV(s.v ?? emptyV(), s.dev);
      return vl ? { vl } : {};
    })(),
  };
}

/**
 * JSON text of a snapshot within `budget` bytes: over it, the oldest journal goes first, then the
 * details (time, hints, undos) of the oldest days — their dates always stay (the streak needs them).
 */
export function encodeSnapshot(s: Snapshot, budget = DEFAULT_BUDGET): string {
  const cap = Math.min(budget, MAX_BYTES);
  const oldestFirst = [...s.j].sort(cmpJournal);
  let journals = s.j;
  const dates = Object.keys(s.d).filter((d) => DATE_RE.test(d)).sort();
  let detailFrom = 0;
  for (;;) {
    const text = JSON.stringify(wireOf(s, journals, dates, detailFrom));
    if (byteLength(text) <= cap) return text;
    if (journals.length) {
      const drop = oldestFirst.shift();
      journals = journals.filter((r) => r !== drop);
    }
    else if (detailFrom < dates.length) detailFrom = Math.min(dates.length, detailFrom + Math.max(1, Math.ceil((dates.length - detailFrom) / 8)));
    else return text; // dates only: cannot shrink further (≈ 46 bytes per year of play)
  }
}

export function byteLength(text: string): number {
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : c >= 0xd800 && c < 0xdc00 ? (i++, 4) : 3;
  }
  return n;
}

/** A snapshot from its wire text; null when it is not one (another app version, corrupt). Never throws. */
export function decodeSnapshot(text: string): Snapshot | null {
  try {
    const w = JSON.parse(text) as Partial<Wire>;
    if (w.v !== 1 || typeof w.dev !== "string" || !w.dev || !Array.isArray(w.p) || w.p.length !== 6) return null;
    const out: Snapshot = { ...emptyState(), dev: w.dev, at: int(w.at) };
    TRACK_LIST.forEach((t, i) => {
      out.p[t] = { level: int(w.p![i * 3], 1), cleared: int(w.p![i * 3 + 1]), hints: int(w.p![i * 3 + 2]) };
    });
    if (Array.isArray(w.s)) {
      const [last, streak, best, shields] = w.s;
      const sh: Record<string, number> = {};
      if (shields && typeof shields === "object") for (const [k, v] of Object.entries(shields)) if (/^\d{4}-\d{2}$/.test(k)) sh[k] = Math.min(2, int(v));
      out.s = { v: 1, last: typeof last === "string" && DATE_RE.test(last) ? last : null, streak: int(streak), best: int(best), shields: sh };
    }
    if (w.d && typeof w.d.o === "string" && DATE_RE.test(w.d.o) && typeof w.d.b === "string") {
      const d0 = isoDay(w.d.o);
      const bin = atob(w.d.b);
      for (let i = 0; i < bin.length * 8 && i < 40_000; i++) if ((bin.charCodeAt(i >> 3) >> (i & 7)) & 1) out.d[isoFromDay(d0 + i)] = cleanRec(null);
      for (const e of typeof w.d.r === "string" && w.d.r ? w.d.r.split(",") : []) {
        const [off, at, ms, h, u] = e.split(".");
        const date = isoFromDay(d0 + parseInt(off ?? "", 36));
        if (!out.d[date]) continue;
        const sec = at ? parseInt(at, 36) : NaN;
        out.d[date] = cleanRec({ at: Number.isFinite(sec) ? (sec + EPOCH_S) * 1000 : 0, ms: parseInt(ms ?? "", 36), hints: parseInt(h ?? "", 36), undos: parseInt(u ?? "", 36) });
      }
    }
    if (Array.isArray(w.j)) {
      for (const r of w.j) {
        if (!Array.isArray(r) || r.length !== 4) continue;
        const [ti, n, l, at] = r;
        if ((ti !== 0 && ti !== 1) || !Number.isInteger(n) || n < 1 || typeof l !== "string" || !LINES_RE.test(l)) continue;
        out.j.push({ t: ti === 1 ? "deduce" : "gentle", n, l, at: int(at), dev: w.dev });
      }
    }
    if (w.st && typeof w.st === "object") {
      for (const k of SETTING_KEYS) {
        const v = w.st[k];
        if (Array.isArray(v) && typeof v[0] === "string") out.st[k] = { v: v[0], at: int(v[1]), dev: w.dev };
      }
    }
    out.g = int(w.g) & 0xffff;
    out.si = w.si === 1;
    out.v = decodeV(w.vl, w.dev);
    return out;
  } catch {
    return null;
  }
}
