// Daily number and the spoiler-free share text (pure, integer-only; no
// platform APIs — the UI hands the text to the system share sheet).
//
// shareText rules: no English words (only APP_NAME and the link line may contain
// letters), only emoji, digits and symbols; nothing derived from the board (no
// lantern position, no number cell, not even the width); at most 4 lines (3 today).
// Round 5: the 🟨 row is gone (8/8 testers: the same for everyone, meaningless).
// R2 (decision A5): a third line, the link to that daily with the campaign token
// ct=share (App Store Connect / web referrer attribution; no personal data).
//
//   Duskwick #14 🌒           APP_NAME, daily number, moon phase of the date
//   ✨ ⏱ 4:07 🔥14            ✨ = solved without a hint (undos are normal play and
//                             don't count); 💡n = n hints (hints > 0); ⏱ m:ss
//                             only with opts.showTime (default true); 🔥streak
//   https://humsleep.github.io/duskwick/14?ct=share   dailyLink(n); before the epoch (n ≤ 0) no number

import { parseDate, udiv } from "../lanterns/generator.ts";
import type { PipsLevel } from "./rules.ts";
import { dayNumber } from "./tracks.ts";

/** App name (round 6: Duskwick, docs/naming.md); the only letters a share text may contain. */
export const APP_NAME = "Duskwick";

/** Daily #1. */
export const DAILY_EPOCH = "2026-11-01";

export interface DailyResult {
  dateISO: string;
  seconds: number;
  hints: number;
  undos: number;
  streak: number;
}

function dayOf(dateISO: string): number {
  const { y, m, d } = parseDate(dateISO);
  return dayNumber(y, m, d);
}

/** Daily number: DAILY_EPOCH is #1, the next day #2, …; days before the epoch give 0, −1, … */
export function dailyNumber(dateISO: string): number {
  return dayOf(dateISO) - dayOf(DAILY_EPOCH) + 1;
}

/** Synodic month in 1/10000 day, and a reference new moon (2000-01-06 18:14 UTC) in 1/10000 day since 2000-01-01. */
export const SYNODIC_E4 = 295306;
export const NEW_MOON_E4 = 57597;
export const MOON_PHASES = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"] as const;

/** Moon phase 0..7 (0 new, 2 first quarter, 4 full, 6 last quarter) at noon UTC of the date (mean lunation, ±1 phase near boundaries). */
export function moonPhase(dateISO: string): number {
  const t = dayOf(dateISO) * 10000 + 5000;
  const age = (t + SYNODIC_E4 - NEW_MOON_E4) % SYNODIC_E4;
  return udiv(age * 8 + (SYNODIC_E4 >>> 1), SYNODIC_E4) % 8;
}

/** A non-negative integer count: non-finite or negative → 0, fractions truncated, capped at max. */
function count(n: number, max: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n > max ? max : n | 0;
}

/** m:ss (minutes unbounded up to 599). */
export function clockText(seconds: number): string {
  const s = count(seconds, 35999);
  const m = udiv(s, 60);
  const ss = s - m * 60;
  return `${m}:${ss < 10 ? "0" : ""}${ss}`;
}

/** The web home of the dailies (GitHub Pages user site; Universal Links open the app). */
export const DAILY_URL_BASE = "https://humsleep.github.io/duskwick/";
/** Campaign token of the in-app share (r1-growth §2-4: one ct per channel). */
export const SHARE_CT = "share";

/** Link to daily #n with a campaign token; n ≤ 0 (before the epoch) links the dailies' home. */
export function dailyLink(n: number, ct: string = SHARE_CT): string {
  return `${DAILY_URL_BASE}${n >= 1 ? n | 0 : ""}?ct=${ct}`;
}

export interface ShareOptions {
  /** Include `⏱ m:ss` (a player setting; default true). */
  showTime: boolean;
}

export const DEFAULT_SHARE_OPTIONS: Readonly<ShareOptions> = { showTime: true };

/** The share text for a finished daily (see header). `level` is accepted for compatibility; nothing is read from it. */
export function shareText(_level: PipsLevel, r: DailyResult, opts?: ShareOptions): string {
  const showTime = opts?.showTime ?? DEFAULT_SHARE_OPTIONS.showTime;
  const hints = count(r.hints, 999);
  const streak = count(r.streak, 99999);
  const n = dailyNumber(r.dateISO);
  const head = `${APP_NAME} #${n} ${MOON_PHASES[moonPhase(r.dateISO)]}`;
  const help = hints === 0 ? ["✨"] : [`💡${hints}`];
  const stats = [...help, ...(showTime ? [`⏱ ${clockText(r.seconds)}`] : []), `🔥${streak}`].join(" ");
  return [head, stats, dailyLink(n)].join("\n");
}
