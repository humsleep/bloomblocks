// Local daily reminders (opt-in). Lazy chunk: the scene imports it only around the daily.
//
//   ask      once, on the 2nd counted daily result: a soft card first (the scene's AskCard), the
//            system prompt only after "yes". "Not now" / a system "no" → never asked again from the
//            result sheet; the settings row can still turn it on.
//   plan     ./plan.ts — ≤ 1 per day, median finish − 30 min (09:00–21:30), back-off 3 / 7 / 14.
//   content  body only (./texts.ts), localized, no sound, no badge, default interruption level
//            (never time-sensitive), no marketing ever (App Review 4.5.4). Computed on device only.
//
// Backend: on iOS agent N's wrapper src/native/notifications.ts (@capacitor/local-notifications
// 8.3.1 behind a dynamic import; the ONE prompt is NotifyAuth, alert only — no sound, no badge;
// it never schedules without permission), else an in-memory web fake (browser / e2e:
// window.__notifyFake).
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import type { Lang } from "../a11y/strings.ts";
import { HORIZON_DAYS, idFor, KEEP_FINISHES, type Planned, planReminders, reconcile, reminderMinute } from "./plan.ts";
import { reminderBody } from "./texts.ts";

export type PermState = "granted" | "denied" | "prompt";

/** The subset of @capacitor/local-notifications 8 we use. */
export interface NotifyBackend {
  checkPermissions(): Promise<{ display: string }>;
  requestPermissions(): Promise<{ display: string }>;
  schedule(o: { notifications: Array<{ id: number; body: string; title: string; schedule: { at: Date; allowWhileIdle?: boolean }; extra?: Record<string, string> }> }): Promise<unknown>;
  cancel(o: { notifications: Array<{ id: number }> }): Promise<void>;
  getPending(): Promise<{ notifications: Array<{ id: number }> }>;
  addListener?(ev: "localNotificationActionPerformed", cb: (a: { notification: { id: number; extra?: Record<string, string> } }) => void): Promise<{ remove: () => Promise<void> }>;
}

export interface NotifyPrefs {
  v: 1;
  /** the player wants reminders (system permission may still be missing) */
  on: boolean;
  /** the soft ask: never shown / answered */
  asked: "never" | "yes" | "later" | "denied";
  ignored: number;
  /** reminders scheduled and not yet reconciled */
  planned: Planned[];
  /** dates whose reminder was tapped */
  tapped: string[];
  /** the soft ask is due (its reminder minute): set by a counted daily, cleared by the answer; survives a quit */
  pend?: number | undefined;
}

const KEY = "notify";
const fresh = (): NotifyPrefs => ({ v: 1, on: false, asked: "never", ignored: 0, planned: [], tapped: [] });

// ---------------------------------------------------------------- web fake

export interface FakeNotify extends NotifyBackend {
  /** what the "system prompt" answers */
  answer: "granted" | "denied";
  perm: PermState;
  pending: Array<{ id: number; body: string; at: number; extra?: Record<string, string> }>;
  prompts: number;
  tap(id: number): void;
}

/** Tests: a fresh web fake installed as the backend. */
export function freshWebFake(): FakeNotify {
  const f = webFake();
  (globalThis as unknown as { __notifyFake?: FakeNotify }).__notifyFake = f;
  setNotifyBackend(f);
  return f;
}

function webFake(): FakeNotify {
  const listeners: Array<(a: { notification: { id: number; extra?: Record<string, string> } }) => void> = [];
  const f: FakeNotify = {
    answer: "granted",
    perm: "prompt",
    pending: [],
    prompts: 0,
    async checkPermissions() {
      return { display: f.perm };
    },
    async requestPermissions() {
      if (f.perm === "prompt") {
        f.prompts++;
        f.perm = f.answer;
      }
      return { display: f.perm };
    },
    async schedule(o) {
      for (const n of o.notifications) {
        f.pending = f.pending.filter((p) => p.id !== n.id);
        f.pending.push({ id: n.id, body: n.body, at: n.schedule.at.getTime(), ...(n.extra ? { extra: n.extra } : {}) });
      }
      f.pending.sort((a, b) => a.at - b.at);
      return undefined;
    },
    async cancel(o) {
      const ids = new Set(o.notifications.map((n) => n.id));
      f.pending = f.pending.filter((p) => !ids.has(p.id));
    },
    async getPending() {
      return { notifications: f.pending.map((p) => ({ id: p.id })) };
    },
    async addListener(_ev, cb) {
      listeners.push(cb);
      return { remove: async () => undefined };
    },
    tap(id: number) {
      const p = f.pending.find((x) => x.id === id);
      for (const cb of listeners) cb({ notification: { id, ...(p?.extra ? { extra: p.extra } : {}) } });
    },
  };
  return f;
}

let backend: NotifyBackend | null = null;
/** Tests: inject a backend (null = pick again). */
export function setNotifyBackend(b: NotifyBackend | null): void {
  backend = b;
  listening = false;
}

/** iOS: N's wrapper behind the NotifyBackend shape. */
function nativeBackend(): NotifyBackend {
  const w = (): Promise<typeof import("../native/notifications.ts").notifications> => import("../native/notifications.ts").then((m) => m.notifications);
  return {
    async checkPermissions() {
      return { display: await (await w()).permission() };
    },
    async requestPermissions() {
      return { display: await (await w()).requestPermission() };
    },
    async schedule(o) {
      const n = await w();
      for (const x of o.notifications) await n.schedule({ id: x.id, title: x.title, body: x.body, at: x.schedule.at });
      return undefined;
    },
    async cancel(o) {
      await (await w()).cancel(o.notifications.map((x) => x.id));
    },
    async getPending() {
      return { notifications: (await (await w()).pendingIds()).map((id) => ({ id })) };
    },
    async addListener(ev, cb) {
      const m = await import("@capacitor/local-notifications");
      return m.LocalNotifications.addListener(ev, (a) => cb({ notification: { id: a.notification.id, ...(a.notification.extra ? { extra: a.notification.extra as Record<string, string> } : {}) } }));
    },
  };
}

function pick(): NotifyBackend {
  if (backend) return backend;
  if (Capacitor.getPlatform() === "ios") backend = nativeBackend();
  else {
    const g = globalThis as unknown as { __notifyFake?: FakeNotify };
    g.__notifyFake ??= webFake();
    backend = g.__notifyFake;
  }
  return backend;
}

/** Reminders exist on iOS (N's plugin) and on the web (the fake); elsewhere the UI hides them. */
export function notifyAvailable(): boolean {
  const p = Capacitor.getPlatform();
  return p === "ios" || p === "web";
}

// ---------------------------------------------------------------- state

let cache: NotifyPrefs | null = null;
async function load(): Promise<NotifyPrefs> {
  if (cache) return cache;
  try {
    const r = await Preferences.get({ key: KEY });
    const j = r.value ? (JSON.parse(r.value) as Partial<NotifyPrefs>) : null;
    cache = j && j.v === 1 ? { ...fresh(), ...j, planned: Array.isArray(j.planned) ? j.planned : [], tapped: Array.isArray(j.tapped) ? j.tapped.slice(-30) : [] } : fresh();
  } catch {
    cache = fresh();
  }
  return cache;
}
function save(p: NotifyPrefs): void {
  cache = p;
  void Preferences.set({ key: KEY, value: JSON.stringify(p) }).catch(() => undefined);
}
/** Tests: forget the in-memory copy. */
export function resetNotifyCache(): void {
  cache = null;
}

let listening = false;
function listen(): void {
  if (listening) return;
  listening = true;
  const b = pick();
  void b.addListener?.("localNotificationActionPerformed", (a) => {
    void load().then((p) => {
      // the date: from extra (web fake) or from our plan (id → date; the native wrapper has no extra)
      const date = a.notification.extra?.["date"] ?? p.planned.find((x) => x.id === a.notification.id)?.date;
      if (!date) return;
      save({ ...p, tapped: [...p.tapped.filter((d) => d !== date), date].slice(-30), ignored: 0 });
    });
  })?.catch(() => undefined);
}

export interface PlanCtx {
  today: string;
  /** local minute of the day right now */
  nowMinute: number;
  /** counted completion dates (the daily log) */
  played: readonly string[];
  todayDone: boolean;
  /** local finish minutes of recent counted dailies (oldest first) */
  finishMinutes: readonly number[];
  streak: number;
  lang: Lang;
  /** local wall-clock Date for (date, minute) */
  at: (date: string, minute: number) => Date;
}

export const notify = {
  async prefs(): Promise<NotifyPrefs> {
    return { ...(await load()) };
  },

  /** Ask (soft card) on this counted result? Only the 2nd counted day or later, only once. */
  async shouldAsk(countedDays: number): Promise<boolean> {
    if (!notifyAvailable() || countedDays < 2) return false;
    const p = await load();
    if (p.asked !== "never" || p.on) return false;
    try {
      const perm = await pick().checkPermissions();
      if (perm.display === "denied") return false;
    } catch {
      return false;
    }
    return true;
  },

  /** A counted daily said "ask": the soft card waits for a quiet moment on the track (this run or the next). */
  async markAsk(minute: number): Promise<void> {
    save({ ...(await load()), pend: minute });
  },

  /** The waiting soft ask's reminder minute, or null (none waiting / no longer askable). */
  async pendingAsk(): Promise<number | null> {
    const p = await load();
    return p.pend !== undefined && (await this.shouldAsk(2)) ? p.pend : null;
  },

  /** "Not now" on the soft card: never asked again from the result sheet. */
  async later(): Promise<void> {
    const p = await load();
    save({ ...p, asked: p.asked === "never" ? "later" : p.asked, pend: undefined });
  },

  /** Turn reminders on: the system prompt (only if not answered yet). true = allowed. */
  async enable(): Promise<boolean> {
    const p = await load();
    let ok = false;
    try {
      const b = pick();
      const now = await b.checkPermissions();
      const r = now.display === "granted" ? now : await b.requestPermissions();
      ok = r.display === "granted";
    } catch (e) {
      console.warn("[notify] permission", e);
    }
    save({ ...p, on: ok, asked: ok ? "yes" : "denied", ignored: ok ? 0 : p.ignored, pend: undefined });
    listen();
    console.info(`[notify] ${ok ? "on" : "not allowed"}`);
    return ok;
  },

  async disable(): Promise<void> {
    const p = await load();
    await cancelAll(p.planned);
    save({ ...p, on: false, planned: [] });
    console.info("[notify] off");
  },

  /** Is it on (wanted AND allowed)? */
  async isOn(): Promise<boolean> {
    const p = await load();
    if (!p.on) return false;
    try {
      return (await pick().checkPermissions()).display === "granted";
    } catch {
      return false;
    }
  },

  /**
   * Re-plan the next 7 days (foreground, daily finished, turned on). Fired reminders are
   * reconciled first (the back-off); today's is dropped once today's daily is done.
   */
  async reschedule(c: PlanCtx): Promise<Planned[]> {
    const p = await load();
    listen();
    const fired = p.planned.filter((x) => x.date < c.today || (x.date === c.today && x.minute <= c.nowMinute));
    const ignored = reconcile({ fired, tapped: new Set(p.tapped), played: new Set(c.played), ignored: p.ignored });
    await cancelAll(p.planned);
    let planned: Planned[] = [];
    if (p.on && (await notify.isOn())) {
      const minute = reminderMinute(c.finishMinutes.slice(-KEEP_FINISHES));
      planned = planReminders({ today: c.today, nowMinute: c.nowMinute, todayDone: c.todayDone, minute, ignored });
      if (planned.length) {
        try {
          await pick().schedule({
            notifications: planned.map((x) => ({
              id: x.id,
              title: "",
              // the streak this day would continue (positive framing only; texts.ts uses it from 3 days on)
              body: reminderBody(c.lang, dayIndex(x.date), c.streak + dayIndex(x.date) - dayIndex(c.today) - (c.todayDone ? 1 : 0)),
              schedule: { at: c.at(x.date, x.minute), allowWhileIdle: false },
              extra: { date: x.date },
            })),
          });
        } catch (e) {
          console.warn("[notify] schedule", e);
          planned = [];
        }
      }
    }
    save({ ...p, ignored, planned });
    if (planned.length) console.info(`[notify] planned ${planned.map((x) => x.date.slice(5)).join(" ")} at ${Math.floor(planned[0]!.minute / 60)}:${String(planned[0]!.minute % 60).padStart(2, "0")} (ignored ${ignored})`);
    return planned;
  },

  /** Today's daily is done: drop today's reminder at once. */
  async cancelToday(today: string): Promise<void> {
    const p = await load();
    const t = p.planned.find((x) => x.date === today);
    if (!t) return;
    await cancelAll([t]);
    save({ ...p, planned: p.planned.filter((x) => x !== t) });
  },
};

const dayIndex = (iso: string): number => Math.round(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86_400_000);

async function cancelAll(list: readonly Planned[]): Promise<void> {
  const ids = new Set(list.map((x) => x.id));
  try {
    // also any stray ids of ours (a crash between schedule and save)
    const pend = await pick().getPending();
    for (const n of pend.notifications) if (n.id >= idFor("1970-01-01") && n.id < 90_000) ids.add(n.id);
  } catch {
    /* plugin missing: nothing scheduled */
  }
  if (ids.size === 0) return;
  try {
    await pick().cancel({ notifications: [...ids].map((id) => ({ id })) });
  } catch (e) {
    console.warn("[notify] cancel", e);
  }
}

export { HORIZON_DAYS };
