// R4 rankings (Game Center, opt-in): the result sheet's trophy signs in and opens today's board; once on,
// scores are sent quietly after each daily. Puzzle play never shows a clock (the calm promise stays).
//   daily time   only a hint-free daily, and only while its date is today in UTC — a Game Center recurring
//                leaderboard runs on UTC days, so everyone on one day's board solved the same puzzle
//   best streak  the longest daily streak (classic, high is better)
//   solved       boards solved on the street and the tower (classic, high is better)
// App Store Connect setup (owner): docs/gamecenter.md — the ids below must match.
import { Preferences } from "@capacitor/preferences";
import { gcAuthenticate, gcShow, gcSubmit } from "../native/gamecenter.ts";

export const BOARDS = {
  dailyTime: "duskwick.daily.time",
  bestStreak: "duskwick.streak.best",
  solved: "duskwick.puzzles.solved",
} as const;

/** Is this daily result fair for today's time board? (pure; tested) */
export function dailyCounts(dateISO: string, hints: number, nowUtcISO: string): boolean {
  return hints === 0 && dateISO === nowUtcISO.slice(0, 10);
}
/** "Elapsed time, to the hundredth of a second" boards take hundredths. */
export const timeScore = (seconds: number): number => Math.max(1, Math.round(seconds)) * 100;

let on: boolean | null = null;
async function isOn(): Promise<boolean> {
  if (on !== null) return on;
  try {
    on = (await Preferences.get({ key: "gameCenter" })).value === "on";
  } catch {
    on = false;
  }
  return on;
}

/** After the first frame: a player who turned rankings on is signed in again quietly (Apple's welcome banner). */
export async function resumeRankings(): Promise<void> {
  if (await isOn()) void gcAuthenticate();
}

/** The trophy: sign in (first time: Apple's sheet), remember it, send what we have, open today's board. */
export async function openRankings(totals: { bestStreak: number; solved: number }): Promise<boolean> {
  const ok = await gcAuthenticate();
  if (!ok) return false;
  on = true;
  void Preferences.set({ key: "gameCenter", value: "on" });
  await sendTotals(totals);
  return gcShow(BOARDS.dailyTime);
}

/** After a daily result (only when rankings are on). */
export async function sendDaily(r: { dateISO: string; seconds: number; hints: number; dailyN: number }, totals: { bestStreak: number; solved: number }): Promise<void> {
  if (!(await isOn())) return;
  if (dailyCounts(r.dateISO, r.hints, new Date().toISOString())) await gcSubmit(BOARDS.dailyTime, timeScore(r.seconds), r.dailyN);
  await sendTotals(totals);
}

async function sendTotals(t: { bestStreak: number; solved: number }): Promise<void> {
  if (t.bestStreak > 0) await gcSubmit(BOARDS.bestStreak, t.bestStreak);
  if (t.solved > 0) await gcSubmit(BOARDS.solved, t.solved);
}
