// The village's local save: Preferences "village" = { sv: the synced VState, loc: device-only
// state }. Never on the cold-start path: the session reaches it with a dynamic import after a
// board is solved (noteLitDay), the sync engine (itself lazy) reads / merges `sv`, and the village
// chunk reads both when it opens. Writes are serialized; a synced change tells the sync engine.
import { Preferences } from "@capacitor/preferences";
import { syncSignal } from "../sync/signal.ts";
import type { ResidentId } from "./catalog.ts";
import { dayOf, type MailMeta } from "./model.ts";
import { BIT_KEYS, emptyV, mergeV, normBits, ROOM_RE, sameV, type VState } from "./vstate.ts";

const KEY = "village";

/** Device-only village state (never synced; losing it on reinstall is harmless). */
export interface LocalVillage {
  /** delivered mail as first shown (letter / tag, sender, day) */
  mail: Record<string, MailMeta>;
  /** the day of this device's last letter (≤ 1 letter a day) */
  ld: number | null;
  /** per resident: the last shown line ids (no-repeat window) */
  seen: Partial<Record<ResidentId, string[]>>;
  /** once-only things already done: "host:firstVillageVisit", "friend:momo:3", "move_in:sage" … */
  once: string[];
  /** last village visit (day) and visits so far */
  lastVisit: number | null;
  visits: number;
  /** per resident: lines shown today ("talk index" for the seed) and the day they count for */
  talk: { day: number; n: Partial<Record<ResidentId, number>>; pz?: ResidentId[] };
  /** pieces revealed but not looked at in the cottage yet (the drawer's amber "new" dot) */
  fresh: number[];
  /** Wick's welcome-back letter (a gap of ≥ 7 days): the day it came, opened */
  ret: { d: number; read: boolean } | null;
  /** the season of the last visit (Wick says when it turned) */
  season?: string;
  /** request id → the day it was asked ("again" only on a later day) */
  askDay?: Record<string, number>;
}

export interface VillageSave {
  sv: VState;
  loc: LocalVillage;
}

export const emptyLocal = (): LocalVillage => ({ mail: {}, ld: null, seen: {}, once: [], lastVisit: null, visits: 0, talk: { day: 0, n: {} }, fresh: [], ret: null });

function parse(text: string | null): VillageSave {
  const out: VillageSave = { sv: emptyV(), loc: emptyLocal() };
  if (!text) return out;
  try {
    const o = JSON.parse(text) as { sv?: Partial<VState>; loc?: Partial<LocalVillage> };
    if (o.sv && typeof o.sv === "object") {
      for (const k of BIT_KEYS) out.sv[k] = normBits(Array.isArray(o.sv[k]) ? (o.sv[k] as number[]) : []);
      for (const [id, r] of Object.entries(o.sv.r ?? {})) {
        if (r && typeof r.s === "string" && ROOM_RE.test(r.s) && Number.isInteger(r.n) && Number.isFinite(r.at) && typeof r.dev === "string") out.sv.r[id] = { s: r.s, n: r.n, at: r.at, dev: r.dev };
      }
    }
    if (o.loc && typeof o.loc === "object") out.loc = { ...emptyLocal(), ...o.loc };
  } catch {
    // a corrupt save starts over locally; the synced part comes back from iCloud
  }
  return out;
}

let cache: Promise<VillageSave> | null = null;
/** the resolved save (same object the writes update), null until read */
let current: VillageSave | null = null;
let chain: Promise<unknown> = Promise.resolve();
const listeners = new Set<(s: VillageSave) => void>();

const read = (): Promise<VillageSave> =>
  Preferences.get({ key: KEY }).then(
    (r) => (current = parse(r.value)),
    () => (current = parse(null)),
  );

export function loadVillage(): Promise<VillageSave> {
  cache ??= read();
  return chain.then(() => cache!);
}

/** The save if it is in memory and no write is pending, else null (the warm, synchronous open). */
export function peekVillage(): VillageSave | null {
  return pending === 0 ? current : null;
}
let pending = 0;

/** Change the save (serialized). A change to the synced part schedules an iCloud write. */
export function updateVillage(fn: (s: VillageSave) => void): Promise<VillageSave> {
  pending++;
  const job = chain.then(async () => {
    const s = await (cache ??= read());
    const before = JSON.stringify(s.sv);
    fn(s);
    await Preferences.set({ key: KEY, value: JSON.stringify(s) }).catch(() => undefined);
    if (JSON.stringify(s.sv) !== before) syncSignal.dirty("village");
    for (const l of listeners) l(s);
    return s;
  });
  chain = job.catch(() => undefined).finally(() => pending--);
  return job;
}

/** The open village redraws when the save changes (a merge from another device). */
export function onVillageChange(f: (s: VillageSave) => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

/** A board was solved today (session.finishLevel): the day counts as lit. */
export function noteLitDay(todayISO: string): Promise<void> {
  const d = dayOf(todayISO);
  return loadVillage().then((s) => {
    if (s.sv.pd.includes(d)) return;
    return updateVillage((x) => {
      x.sv.pd = normBits([...x.sv.pd, d]);
    }).then(() => undefined);
  });
}

/** For the sync snapshot. */
export function loadSyncedV(): Promise<VState> {
  return loadVillage().then((s) => s.sv);
}

/** A merge landed: OR / LWW it into the local copy (local edits since the merge are kept). */
export function adoptSyncedV(merged: VState, now = Date.now()): Promise<void> {
  return loadVillage().then((s) => {
    const next = mergeV([s.sv, merged], now);
    if (sameV(next, s.sv)) return;
    return updateVillage((x) => {
      x.sv = mergeV([x.sv, merged], now);
    }).then(() => undefined);
  });
}

/** Tests: forget the cached save (the fake Preferences keeps the stored one). */
export function resetVillageCache(): void {
  cache = null;
  current = null;
  pending = 0;
  chain = Promise.resolve();
  listeners.clear();
}
