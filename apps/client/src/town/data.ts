// What the street shows, read (never written) from the same saves the play
// session uses:
//   Library/lanternly/pips-progress.json   {v:3, game:"pips", gentle:{level,cleared}, deduce:{…}}  (src/game/session.ts)
//   Preferences "streak"                    {v:1, last, streak, best, shields{"YYYY-MM": n}}      (src/game/daily.ts)
// Houses = gentle levels before the current one (level − 1): those are exactly the
// seed keys the player lit, in order. Tower windows = deduce level − 1.
import { Preferences } from "@capacitor/preferences";
import { readAtomicText } from "../save/store.ts";
import type { FestivalLantern } from "./layout.ts";
import { clock, localDateISO } from "../game/session.ts";

export interface TownData {
  gentle: number;
  deduce: number;
  /** oldest → newest; the last one is today's ("waiting" while today's daily is not done) */
  festival: FestivalLantern[];
  today: string;
}

/** Shields per calendar month (mirror of daily.ts SHIELDS_PER_MONTH — read-only copy, see docs/town.md). */
const SHIELDS_PER_MONTH = 2;

/** Today on the session's injectable wall clock (L: tests move it with window.__test.clock). */
export function localISO(d: Date = clock.now()): string {
  return localDateISO(d);
}
const dayOf = (iso: string): number => {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
};
const monthOf = (day: number): string => new Date(day * 86400000).toISOString().slice(0, 7);

export interface StreakLike {
  last: string | null;
  streak: number;
  shields: Record<string, number>;
}

/**
 * Lanterns on the festival string, oldest → newest.
 *  lit      a counted daily completion of the live streak
 *  covered  a missed day a shield covered (the store keeps per-month counts, not dates:
 *           past covered days are spread evenly between the lit ones; days missed since
 *           the last completion, still coverable, are exact and sit at the newest end)
 *  waiting  today, while today's daily is not done (an empty paper lantern)
 * A streak that can no longer be covered shows nothing but today's waiting lantern.
 */
export function festivalFor(s: StreakLike | null, today: string): FestivalLantern[] {
  const out: FestivalLantern[] = [];
  const tday = dayOf(today);
  const doneToday = s?.last === today;
  if (s && s.last && s.streak > 0) {
    const lday = dayOf(s.last);
    // missed days since the last completion (before today), each needs a shield of its month
    const spend: Record<string, number> = {};
    let alive = true;
    let pending = 0;
    for (let d = lday + 1; d < tday; d++) {
      const k = monthOf(d);
      if ((s.shields[k] ?? 0) + (spend[k] ?? 0) >= SHIELDS_PER_MONTH) {
        alive = false;
        break;
      }
      spend[k] = (spend[k] ?? 0) + 1;
      pending++;
    }
    if (alive) {
      const used = Object.values(s.shields).reduce((a, b) => a + (Number.isFinite(b) ? Math.max(0, b) : 0), 0);
      const hist = Math.min(used, s.streak - 1);
      let placed = 0;
      for (let i = 0; i < s.streak; i++) {
        out.push("lit");
        // covered day after lit i when the even spread says so
        while (placed < hist && Math.floor(((placed + 1) * s.streak) / (hist + 1)) === i + 1) {
          out.push("covered");
          placed++;
        }
      }
      for (let k = 0; k < pending; k++) out.push("covered");
    }
  }
  if (!doneToday) out.push("waiting");
  return out;
}

interface ProgressLike {
  v?: number;
  game?: string;
  gentle?: { level?: number };
  deduce?: { level?: number };
}

function clearedOf(p: ProgressLike | null, t: "gentle" | "deduce"): number {
  const lv = p?.[t]?.level;
  return Number.isInteger(lv) && (lv as number) >= 1 ? (lv as number) - 1 : 0;
}

let devData: TownData | null = null;

/** DEV only: force what the street shows (null = back to the real saves). */
export function devFakeTown(d: { gentle: number; deduce?: number; streak?: number; covered?: number; doneToday?: boolean } | null): void {
  if (!import.meta.env.DEV) return;
  if (!d) {
    devData = null;
    return;
  }
  const today = localISO();
  const streak = Math.max(0, d.streak ?? 0);
  const covered = Math.max(0, d.covered ?? 0);
  const month = today.slice(0, 7);
  const s: StreakLike = { last: d.doneToday ? today : localISO(new Date(clock.now().getTime() - 86400000)), streak, shields: { [month]: Math.min(covered, SHIELDS_PER_MONTH) } };
  devData = { gentle: Math.max(0, d.gentle), deduce: Math.max(0, d.deduce ?? 0), festival: festivalFor(streak > 0 ? s : null, today), today };
}

function devFromQuery(): void {
  if (!import.meta.env.DEV || devData) return;
  // ?town=<houses>[&deduce=<n>][&streak=<days>][&covered=<n>][&done=1]
  const q = new URLSearchParams(location.search);
  const t = q.get("town");
  if (t === null || !/^\d+$/.test(t)) return;
  const num = (k: string): number => Number(q.get(k) ?? "0") || 0;
  devFakeTown({ gentle: Number(t), deduce: num("deduce"), streak: num("streak"), covered: num("covered"), doneToday: q.get("done") === "1" });
}

export async function loadTownData(): Promise<TownData> {
  if (import.meta.env.DEV) {
    devFromQuery();
    if (devData) return devData;
  }
  const [progText, streakText] = await Promise.all([
    readAtomicText("pips-progress.json").catch(() => null),
    Preferences.get({ key: "streak" }).then((r) => r.value, () => null),
  ]);
  let prog: ProgressLike | null = null;
  try {
    const p = progText ? (JSON.parse(progText) as ProgressLike) : null;
    if (p && p.v === 3 && p.game === "pips") prog = p;
  } catch {
    /* corrupt → empty street */
  }
  let streak: StreakLike | null = null;
  try {
    const s = streakText ? (JSON.parse(streakText) as Partial<StreakLike> & { v?: number }) : null;
    if (s && s.v === 1) streak = { last: typeof s.last === "string" ? s.last : null, streak: (s.streak ?? 0) | 0, shields: s.shields ?? {} };
  } catch {
    /* ignore */
  }
  const today = localISO();
  return { gentle: clearedOf(prog, "gentle"), deduce: clearedOf(prog, "deduce"), festival: festivalFor(streak, today), today };
}
