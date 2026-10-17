// Daily reminder planning (pure; tests/notify.test.ts). BENCHMARK-UX (d):
//   · at most ONE reminder per local day; today's is cancelled once today's daily is done
//   · time = median of recent counted finish times − 30 min, clamped 09:00–21:30
//     (fewer than 2 finishes → 19:30)
//   · back-off: 3 ignored in a row → every other day, 7 → weekly (Sunday), 14 → stop silently
//     (no "we'll stop now" message, ever). A tapped reminder, or today's daily played, resets it.
//   · planned 7 days ahead and re-planned on every foreground / daily finish (a local schedule
//     simply runs out when the app is not opened: a natural fade-out)

export const MIN_MINUTE = 9 * 60;
export const MAX_MINUTE = 21 * 60 + 30;
export const DEFAULT_MINUTE = 19 * 60 + 30;
export const LEAD_MIN = 30;
export const HORIZON_DAYS = 7;
/** recent finishes kept for the median */
export const KEEP_FINISHES = 14;

export type Cadence = "daily" | "alternate" | "weekly" | "stop";

export function cadenceFor(ignored: number): Cadence {
  if (ignored >= 14) return "stop";
  if (ignored >= 7) return "weekly";
  if (ignored >= 3) return "alternate";
  return "daily";
}

/** Reminder minute of the day from recent finish minutes (local). */
export function reminderMinute(finishMinutes: readonly number[]): number {
  const xs = finishMinutes.filter((m) => Number.isFinite(m) && m >= 0 && m < 1440).slice(-KEEP_FINISHES).sort((a, b) => a - b);
  if (xs.length < 2) return DEFAULT_MINUTE;
  const mid = xs.length >> 1;
  const med = xs.length % 2 ? xs[mid]! : (xs[mid - 1]! + xs[mid]!) / 2;
  const m = Math.round(med) - LEAD_MIN;
  return Math.min(MAX_MINUTE, Math.max(MIN_MINUTE, m));
}

const dayNum = (iso: string): number => Math.round(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86_400_000);
const isoOf = (d: number): string => new Date(d * 86_400_000).toISOString().slice(0, 10);
/** 0 = Sunday */
const weekday = (d: number): number => (((d + 4) % 7) + 7) % 7;

export interface Planned {
  /** local date of the reminder */
  date: string;
  /** local minute of the day */
  minute: number;
  /** stable per date: re-planning replaces, never duplicates */
  id: number;
}

/** Notification id of a date (one per day by construction). */
export function idFor(date: string): number {
  return 70_000 + (dayNum(date) % 20_000);
}

/**
 * The next reminders. `nowMinute` = local minute of `today` right now (today's slot is skipped
 * once it is too close / past, or when today's daily is done).
 */
export function planReminders(o: { today: string; nowMinute: number; todayDone: boolean; minute: number; ignored: number }): Planned[] {
  const cad = cadenceFor(o.ignored);
  if (cad === "stop") return [];
  const t = dayNum(o.today);
  const out: Planned[] = [];
  for (let i = 0; i < HORIZON_DAYS; i++) {
    const d = t + i;
    if (i === 0 && (o.todayDone || o.nowMinute >= o.minute - 1)) continue;
    if (cad === "alternate" && d % 2 !== 0) continue;
    if (cad === "weekly" && weekday(d) !== 0) continue;
    const date = isoOf(d);
    out.push({ date, minute: o.minute, id: idFor(date) });
  }
  return out;
}

/**
 * Reminders that have fired since the last look: each one either worked (tapped, or that day's
 * daily got played) → the ignore count resets, or was ignored → +1. Returns the new count and
 * the reminders still in the future.
 */
export function reconcile(o: {
  fired: readonly Planned[];
  tapped: ReadonlySet<string>;
  played: ReadonlySet<string>;
  ignored: number;
}): number {
  let n = o.ignored;
  for (const p of [...o.fired].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    if (o.tapped.has(p.date) || o.played.has(p.date)) n = 0;
    else n++;
  }
  return n;
}
