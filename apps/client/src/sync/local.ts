// This device's side of the sync: build its snapshot from the local saves, and apply a merge plan
// back onto them (files / Preferences / the live session). Local files stay the source of truth;
// nothing here ever lowers or removes local progress.
import { Preferences } from "@capacitor/preferences";
import { u32Hex } from "@core/bytes.ts";
import { type DailyLog, liveStreak, loadDaily, loadLog, loadStreak, logSettled, mergeIntoLog, saveDaily, saveStreak } from "../game/daily.ts";
import { markGuide, type NumberStyle, setNumberStyle, setShareTime } from "../game/feedback.ts";
import { levelIdFor, seedKeyFor } from "../game/levelIds.ts";
import { clock, localDateISO, type Session, type Track } from "../game/session.ts";
import { flush, readAtomicText } from "../save/store.ts";
import { adoptSyncedV, loadSyncedV } from "../village/store.ts";
import { type JournalRec, type Plan, type SettingKey, SETTING_KEYS, type Snapshot, type SyncState, TRACK_LIST } from "./model.ts";

/** Preferences "sync": this device's id and when its settings / journals last changed. */
export interface Meta {
  v: 1;
  dev: string;
  st: Partial<Record<SettingKey, { v: string; at: number }>>;
  j: Partial<Record<Track, { n: number; l: string; at: number }>>;
  /**
   * Local-only guide override: lesson bits this device asked to see again ("show the guide again").
   * Other devices' copies of these bits are not merged in until this device sets them itself.
   */
  gr?: number;
  /** the local lesson bits last seen (a bit turning on here clears its `gr` override) */
  gl?: number;
}
const META_KEY = "sync";

export async function loadMeta(): Promise<Meta | null> {
  try {
    const r = await Preferences.get({ key: META_KEY });
    const m = r.value ? (JSON.parse(r.value) as Partial<Meta>) : null;
    if (!m || m.v !== 1 || typeof m.dev !== "string" || !/^[a-z0-9]{8,32}$/.test(m.dev)) return null;
    return { v: 1, dev: m.dev, st: m.st ?? {}, j: m.j ?? {}, ...(m.gr ? { gr: m.gr | 0, gl: (m.gl ?? 0) | 0 } : {}) };
  } catch {
    return null;
  }
}
export function saveMeta(m: Meta): Promise<void> {
  return Preferences.set({ key: META_KEY, value: JSON.stringify(m) }).catch(() => undefined);
}

/** A random device id (16 base-36 chars); never derived from anything about the device or person. */
export function newDeviceId(): string {
  const b = new Uint8Array(16);
  globalThis.crypto.getRandomValues(b);
  return [...b].map((x) => (x % 36).toString(36)).join("");
}

async function pref(key: string): Promise<string | null> {
  try {
    return (await Preferences.get({ key })).value;
  } catch {
    return null;
  }
}

/** The current setting values ("digits" / "dots", "1" / "0") and whether the player ever chose one. */
async function settingValues(): Promise<Record<SettingKey, { v: string; explicit: boolean }>> {
  const [numbers, shareTime] = await Promise.all([pref("numbers"), pref("shareTime")]);
  return {
    numbers: { v: numbers === "dots" ? "dots" : "digits", explicit: numbers !== null },
    shareTime: { v: shareTime === "0" ? "0" : "1", explicit: shareTime !== null },
  };
}

/** The journal's move lines for level n of a track (joined), "" when there are none. */
async function journalLines(t: Track, n: number): Promise<string> {
  const text = await readAtomicText(`pips-${t}-journal.log`);
  if (!text) return "";
  const lines = text.split("\n");
  if (lines.shift() !== `PPJ1 ${u32Hex(levelIdFor(t, n))} ${seedKeyFor(t, n)}`) return "";
  let out = "";
  for (const l of lines) {
    if (!/^[0-9a-f]{10}$/.test(l)) break;
    out += l;
  }
  return out.length <= 4000 ? out : "";
}

/**
 * This device's snapshot. Change times of settings and journals are stamped here (a value that
 * differs from the last stamped one changed "now"); an untouched default carries time 0, so a
 * fresh install never outvotes a choice made elsewhere. `known` = journals of the last merge (an
 * adopted journal keeps its original time).
 */
export async function buildLocal(session: Session, meta: Meta, known: readonly JournalRec[] = []): Promise<{ snap: Snapshot; metaChanged: boolean }> {
  await logSettled();
  await flush();
  const now = clock.now().getTime();
  let metaChanged = false;
  const p = session.syncProgress();
  const [log, s, guide, si, sv, v] = await Promise.all([loadLog(), loadStreak(), pref("guide"), pref("shieldIntro"), settingValues(), loadSyncedV()]);
  const st: Snapshot["st"] = {};
  for (const k of SETTING_KEYS) {
    const cur = sv[k];
    const rec = meta.st[k];
    let at: number;
    if (rec && rec.v === cur.v) at = rec.at;
    else {
      at = rec ? now : cur.explicit ? 1 : 0;
      meta.st[k] = { v: cur.v, at };
      metaChanged = true;
    }
    st[k] = { v: cur.v, at, dev: meta.dev };
  }
  const j: JournalRec[] = [];
  for (const t of TRACK_LIST) {
    const n = p[t].level;
    const l = await journalLines(t, n);
    if (!l) continue;
    const rec = meta.j[t];
    let at: number;
    if (rec && rec.n === n && rec.l === l) at = rec.at;
    else {
      at = known.find((r) => r.t === t && r.n === n && r.l === l)?.at ?? now;
      meta.j[t] = { n, l, at };
      metaChanged = true;
    }
    j.push({ t, n, l, at, dev: meta.dev });
  }
  const g = Number(guide ?? "0") & 0xffff;
  if (meta.gr) {
    // a replayed lesson learned again here: its override ends
    const rising = g & ~(meta.gl ?? 0);
    const gr = meta.gr & ~rising;
    if (gr !== meta.gr || g !== meta.gl) {
      if (gr) {
        meta.gr = gr;
        meta.gl = g;
      } else {
        delete meta.gr;
        delete meta.gl;
      }
      metaChanged = true;
    }
  }
  const snap: Snapshot = {
    dev: meta.dev,
    at: now,
    p: { gentle: { ...p.gentle }, deduce: { ...p.deduce } },
    s,
    d: { ...log },
    j,
    st,
    g,
    si: si === "1",
    v,
  };
  return { snap, metaChanged };
}

/** What the scene does for the sync (LanternsScene.syncHost; a stub in unit tests). */
export interface SyncHost {
  session: Session;
  /**
   * a quiet moment: home screen or a level boundary, nothing animating, no sheet or guide up.
   * `restore` = a returning player's progress onto a fresh install: a first-run lesson does not hold it.
   */
  safe(restore: boolean): boolean;
  /** run `task` behind the board swap (it replaces the board on screen), resolves once swapped */
  swap(task: () => Promise<unknown>, restore: boolean): Promise<void>;
  /** merged data landed: plates, moon, town, number style; `restore`: the first-run lessons step aside */
  refresh(changes: { numbers?: NumberStyle; restore?: boolean }): void;
}

/** Apply a plan (only at a safe moment — the engine checks). Returns the tracks left for later (mid-level). */
export async function applyPlan(plan: Plan, merged: SyncState, host: SyncHost, meta: Meta, restore = false): Promise<Track[]> {
  const s = host.session;
  const today = localDateISO();
  // lesson bits first: the board swapped in below must not start a lesson the player learned elsewhere
  for (let b = 1; b <= 0x8000; b <<= 1) if (plan.guide & b) markGuide(b);
  if (Object.keys(plan.log).length) await mergeIntoLog(plan.log as DailyLog);
  if (plan.streak) saveStreak(plan.streak);
  // today's daily solved elsewhere → done here too (the moon rests), unless it is open on this device
  const rec = merged.d[today];
  if (rec && s.daily !== today) {
    const ds = await loadDaily(today);
    if (!ds.result) {
      ds.ms = rec.ms;
      ds.hints = rec.hints;
      ds.undos = rec.undos;
      ds.result = { dateISO: today, seconds: Math.max(1, Math.round(rec.ms / 1000)), hints: rec.hints, undos: rec.undos, streak: liveStreak(plan.streak ?? (await loadStreak()), today) };
      saveDaily(ds);
    }
  }
  const later: Track[] = [];
  for (const t of TRACK_LIST) {
    const p = plan.progress[t];
    const js = plan.journals[t] ?? [];
    if (!p && !js.length) continue;
    const target = p ?? s.syncProgress()[t];
    const lines = js.map((r) => r.l);
    if (s.syncBusy(t)) {
      later.push(t);
      continue;
    }
    const onScreen = s.syncOnScreen(t) && (target.level > s.levelOf(t) || lines.length > 0);
    let res: Awaited<ReturnType<Session["syncAdopt"]>> = "none";
    if (onScreen) {
      await host.swap(async () => (res = await s.syncAdopt(t, target, lines)), restore);
    } else res = await s.syncAdopt(t, target, lines);
    if (res === "busy") later.push(t);
  }
  const changes: { numbers?: NumberStyle } = {};
  for (const k of SETTING_KEYS) {
    const w = plan.settings[k];
    if (!w) continue;
    if (k === "numbers") {
      const v: NumberStyle = w.v === "dots" ? "dots" : "digits";
      setNumberStyle(v);
      changes.numbers = v;
    } else setShareTime(w.v !== "0");
    meta.st[k] = { v: w.v, at: w.at };
  }
  // the village: bits OR'd, rooms per-room LWW, into the local store (an open village redraws)
  if (plan.v) await adoptSyncedV(plan.v);
  if (plan.shieldIntro) await Preferences.set({ key: "shieldIntro", value: "1" }).catch(() => undefined);
  await flush();
  host.refresh(restore ? { ...changes, restore } : changes);
  return later;
}
