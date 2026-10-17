// Phase 5 (BENCHMARK-UX #3 #4 #7 #2 #10): pure progress rules for the flow layer — no DOM, no
// Phaser, no Capacitor (unit-tested in tests/progress.test.ts).
//   alley       the "this alley" strip: the current block of 10 levels (finale = the 10th)
//   milestone   gentle 5 / 15 / 25 … light a street lamp, 10 / 20 / 30 … a landmark: a short trip
//               to the street shows it lighting up before the next board
//   streak      daily milestones 3 · 7 · 30 · 100 · 365; every 7th day earns the ad-free hour
//   month       the result sheet's strip of this month's days: done · covered by a shield · missed
//   tower       first session diet: the tower opens after gentle 8 AND in a later session

export const ALLEY = 10;

export interface AlleyCell {
  n: number;
  state: "done" | "current" | "ahead";
  /** the alley's finale level (its landmark) */
  finale: boolean;
  /** a street lamp is earned here (5, 15, 25 …) */
  lamp: boolean;
}

/** The block of ten that `level` (1-based, the level being played) belongs to. */
export function alleyOf(level: number): { start: number; cells: AlleyCell[] } {
  const n0 = Math.max(1, Math.floor(level));
  const start = Math.floor((n0 - 1) / ALLEY) * ALLEY + 1;
  const cells: AlleyCell[] = [];
  for (let n = start; n < start + ALLEY; n++) {
    cells.push({ n, state: n < n0 ? "done" : n === n0 ? "current" : "ahead", finale: n % ALLEY === 0, lamp: n % 5 === 0 && n % ALLEY !== 0 });
  }
  return { start, cells };
}

export type Milestone = "lamp" | "landmark";

/** What solving gentle level `n` adds to the street (layout.ts: lampEvery 5, landmarkEvery 10). */
export function milestoneOf(n: number): Milestone | null {
  if (n <= 0) return null;
  if (n % 10 === 0) return "landmark";
  if (n % 5 === 0) return "lamp";
  return null;
}

/** Street visit length (ms): full trip, and the still cut under Reduce Motion. */
export const VISIT_MS = 2500;
export const VISIT_REDUCED_MS = 1200;

export const STREAK_MILESTONES = [3, 7, 30, 100, 365] as const;

/** The milestone this counted streak day reaches (0 = none). */
export function streakMilestone(streak: number): number {
  return (STREAK_MILESTONES as readonly number[]).includes(streak) ? streak : 0;
}

/** The ads policy's 7-day gift (src/ads/policy.ts streakGiftEvery): 1 h without interstitials. */
export const GIFT_EVERY = 7;
export function giftEarned(streak: number): boolean {
  return streak > 0 && streak % GIFT_EVERY === 0;
}

// ---------------------------------------------------------------- month strip

export type DayMark = "done" | "shield" | "missed" | "future";
export interface MonthDay {
  day: number;
  mark: DayMark;
  today: boolean;
}

const SHIELDS = 2;
const dayNum = (iso: string): number => Math.round(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86_400_000);
const isoOf = (d: number): string => new Date(d * 86_400_000).toISOString().slice(0, 10);
const monthKey = (d: number): string => isoOf(d).slice(0, 7);

/**
 * This month's days as the streak rules see them (daily.ts cover(): two shields per calendar month
 * cover missed days while the streak goes on). `dates` = the counted completion dates (the log).
 * A gap that the shields could not cover broke the streak: those days are "missed". Days missed since
 * the last completion up to yesterday are "shield" while they can still be covered (liveStreak).
 */
export function monthStrip(dates: Iterable<string>, today: string): { ym: string; days: MonthDay[] } {
  const sorted = [...new Set(dates)].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const t = dayNum(today);
  const done = new Set<number>();
  const shield = new Set<number>();
  const used: Record<string, number> = {};
  let last: number | null = null;
  const cover = (from: number, to: number): number[] | null => {
    const spend: Record<string, number> = {};
    const out: number[] = [];
    for (let d = from; d < to; d++) {
      const k = monthKey(d);
      if ((used[k] ?? 0) + (spend[k] ?? 0) >= SHIELDS) return null;
      spend[k] = (spend[k] ?? 0) + 1;
      out.push(d);
    }
    return out;
  };
  for (const iso of sorted) {
    const d = dayNum(iso);
    if (d > t) break;
    if (last !== null && d > last + 1) {
      const c = cover(last + 1, d);
      if (c) for (const x of c) {
        shield.add(x);
        used[monthKey(x)] = (used[monthKey(x)] ?? 0) + 1;
      }
    }
    done.add(d);
    last = d;
  }
  // pending: missed days since the last completion, still covered while the streak is alive
  if (last !== null && !done.has(t) && t > last + 1) {
    const c = cover(last + 1, t);
    if (c) for (const x of c) shield.add(x);
  }
  const ym = today.slice(0, 7);
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5, 7));
  const len = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const first = dayNum(`${ym}-01`);
  const days: MonthDay[] = [];
  for (let i = 0; i < len; i++) {
    const d = first + i;
    const mark: DayMark = d > t ? "future" : done.has(d) ? "done" : shield.has(d) ? "shield" : d === t ? "future" : "missed";
    days.push({ day: i + 1, mark, today: d === t });
  }
  return { ym, days };
}

/** The local date after `iso` (the "tomorrow" tile). */
export function nextDay(iso: string): string {
  return isoOf(dayNum(iso) + 1);
}

// ---------------------------------------------------------------- first session

/** Gentle levels cleared before the tower may open (BENCHMARK-UX #10: was 5). */
export const TOWER_AFTER = 8;

/**
 * The tower opens after gentle 8, and never in the very first session (at most four new things
 * there: tap, numbers, conflict, today's puzzle). A player who already went there keeps it open.
 */
export function towerOpen(o: { cleared: number; session: number; visited: boolean }): boolean {
  if (o.visited) return true;
  return o.cleared >= TOWER_AFTER && o.session >= 2;
}
