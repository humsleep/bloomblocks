// Ad pacing policy — launch config B (docs/ads-plan.md §6, §9-1; docs/phase2-plan.md "Phase 5").
// PURE: no I/O, no Date.now(), no Capacitor — every function takes `now` (ms since epoch) and
// returns new state. index.ts persists AdState through @capacitor/preferences and feeds it real time.
//
// Interstitial — ONE slot: between the finale's exit and the next track board's entry
// (ads.beforeNextBoard). Never over a board, never in / right after the daily.
//   · daily units never show one and never count toward pacing or the install grace
//   · 5-unit grace after install (no interstitial until the 6th completed non-daily unit)
//   · ≥ 2 completed units AND ≥ 240 s of real play since the last interstitial
//   · none for 120 s after the app came back (cold launch, or ≥ 30 s in the background)
//   · none for 90 s after any other full-screen ad / consent form
//   · ≤ 2 per session (3 once the session is ≥ 10 min old), ≤ 10 per local day
//   · none while a 30-min ad break (rewarded) or the 7-day streak gift (1 h) is active
// Rewarded "30-min ad break": offered at most once per local day, right after the day's 2nd
//   interstitial, behind a confirm card (./breakCard.ts). Watching it ends interstitials and the
//   banner for 30 min.
// 7-day daily streak gift: every 7th consecutive daily day → 1 h without interstitials.
// Banner (B+, FLAGS.banner OFF at launch): track boards only, behind a 50 % install holdout.
// App-open: removed (r6: Yuki / Sophie; most launches are "open to play the daily").
// Consent (UMP form where required, then ATT): once, at the between-boards moment after the FIRST
//   completed non-daily unit (consentAfterUnits; App Review must be able to find the ATT prompt).
//   Never at cold launch, never mid-board, never in / after the daily. Separate from the interstitial
//   grace: a shown consent form starts the 90 s full-screen cooldown, and no interstitial can come
//   before the 6th completed non-daily unit whatever the consent timing.
//
// Remote config (./remote.ts, GitHub Pages JSON, applied in ads.init()): resolveRules()/resolveFlags()
// clamp every value, so a broken remote value can never make "an ad after every unit" or "an ad in
// the daily" possible.

export const FLAGS = {
  /** B+: anchored adaptive banner on track boards. Remote-config only, after the CA/AU/NZ verdict. */
  banner: false,
  /** rewarded "keepsake frame" in the town (cosmetic meta, not built yet) */
  rewardKeepsake: false,
  /** rewarded "replay an old daily" (archive, not built yet) */
  rewardArchive: false,
  /** R4 cozy evening: cozy level 5 → a village visit grants 30 min without interstitials, once a day */
  cozyEvening: true,
};
export type Flags = typeof FLAGS;

export const RULES = {
  graceUnits: 5,
  /** the one-time consent UI may run from the between-boards moment after this many non-daily units (floor 1) */
  consentAfterUnits: 1,
  /** HARD FLOOR 2: resolveRules never lets this drop below 2 ("every unit" is impossible in code) */
  unitsBetween: 2,
  playSecondsBetween: 240,
  perSession: 2,
  perSessionLong: 3,
  longSessionMs: 10 * 60_000,
  perDay: 10,
  /** no interstitial this long after the app came to the foreground (cold launch or resume) */
  resumeQuietMs: 120_000,
  /** a resume counts only after this long in the background (a notification shade glance does not) */
  resumeQuietMinBgMs: 30_000,
  /** no interstitial this long after another full-screen ad (rewarded included) or a consent form */
  afterFullscreenMs: 90_000,
  /** the promise on the confirm card — not remote-configurable */
  breakMs: 30 * 60_000,
  breakAfterNthInterstitial: 2,
  streakGiftEvery: 7,
  streakGiftMs: 60 * 60_000,
  /** a new session starts when the app comes back after this long in the background */
  sessionGapMs: 30 * 60_000,
  /** B+: share of installs that never get the banner (control group), fixed at install */
  bannerHoldout: 0.5,
};
export type Rules = typeof RULES;

/** [min, max] for every remotely tunable rule; anything outside is clamped, anything not a number is ignored. */
const RANGES: Partial<Record<keyof Rules, readonly [number, number]>> = {
  graceUnits: [5, 50],
  consentAfterUnits: [1, 50],
  unitsBetween: [2, 20],
  playSecondsBetween: [180, 900],
  perSession: [0, 3],
  perSessionLong: [0, 4],
  longSessionMs: [5 * 60_000, 60 * 60_000],
  perDay: [0, 10],
  resumeQuietMs: [60_000, 10 * 60_000],
  resumeQuietMinBgMs: [10_000, 10 * 60_000],
  afterFullscreenMs: [60_000, 10 * 60_000],
  breakAfterNthInterstitial: [1, 5],
  sessionGapMs: [5 * 60_000, 4 * 60 * 60_000],
  bannerHoldout: [0, 1],
};
const INTEGER: ReadonlySet<keyof Rules> = new Set(["graceUnits", "consentAfterUnits", "unitsBetween", "perSession", "perSessionLong", "perDay", "breakAfterNthInterstitial"]);

/** Defaults overlaid with a (possibly broken) remote object, clamped. Never throws. */
export function resolveRules(remote?: unknown): Rules {
  const r: Rules = { ...RULES };
  const src = remote && typeof remote === "object" ? (remote as Record<string, unknown>) : {};
  for (const k of Object.keys(RANGES) as (keyof Rules)[]) {
    const v = src[k];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const [lo, hi] = RANGES[k]!;
    const x = Math.min(hi, Math.max(lo, INTEGER.has(k) ? Math.floor(v) : v));
    r[k] = x;
  }
  r.unitsBetween = Math.max(2, r.unitsBetween); // belt and braces
  r.perSessionLong = Math.max(r.perSession, r.perSessionLong);
  return r;
}

/** Only booleans are taken; a missing / malformed flag stays at its (OFF) default. */
export function resolveFlags(remote?: unknown): Flags {
  const f: Flags = { ...FLAGS };
  const src = remote && typeof remote === "object" ? (remote as Record<string, unknown>) : {};
  for (const k of Object.keys(FLAGS) as (keyof Flags)[]) if (typeof src[k] === "boolean") f[k] = src[k] as boolean;
  return f;
}

/** Persisted (Preferences key ads.state.v1). Plain JSON. */
export interface AdState {
  v: 1;
  installAt: number;
  /** lifetime completed non-daily units */
  units: number;
  /** pacing since the last interstitial (survives app restarts) */
  unitsSinceAd: number;
  playSinceAd: number;
  /** local day the day* counters belong to (YYYY-MM-DD) */
  day: string;
  dayInterstitials: number;
  dayBreakOffered: boolean;
  /** day key of the last streak gift granted (one gift per day at most) */
  giftDay: string;
  /** day key of the last cozy evening (R4: once a day) */
  cozyDay: string;
  breakUntil: number;
  giftUntil: number;
  /** end of the last full-screen ad / consent form (afterFullscreenMs) */
  lastFullscreenAt: number;
  /** B+ banner holdout bucket, fixed at install (older states get one on first revive) */
  bannerHoldout: boolean;
}

/** In-memory, per app session. */
export interface AdSession {
  startedAt: number;
  /** last time the app came to the foreground (cold launch, or a resume after ≥ resumeQuietMinBgMs) */
  foregroundAt: number;
  interstitials: number;
  /** the "30-min break" chip may be shown on the current result moment */
  breakOfferOpen: boolean;
  /** the most recently recorded unit was a daily → the next break is not an ad slot */
  lastUnitDaily: boolean;
}

export interface UnitResult {
  track: string;
  daily: boolean;
  /** real play time of this unit, seconds (excludes time in background / menus) */
  playSeconds: number;
  /** consecutive daily days after this daily completion (daily units only) */
  dailyStreak?: number;
  /** daily units: the daily's own date ("YYYY-MM-DD") — the gift is granted at most once per daily date */
  dailyDate?: string;
  /** daily units: false when the completion did not count for the streak (finished after local midnight) */
  counted?: boolean;
}

/** Where the player is — the banner may only ever show on "track". */
export type AdScreen = "track" | "daily" | "town" | "settings" | "result" | "guide" | "none";

export function dayKey(now: number): string {
  const d = new Date(now);
  const p = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function initialState(now: number, rand: number, r: Rules = RULES): AdState {
  return {
    v: 1,
    installAt: now,
    units: 0,
    unitsSinceAd: 0,
    playSinceAd: 0,
    day: dayKey(now),
    dayInterstitials: 0,
    dayBreakOffered: false,
    giftDay: "",
    cozyDay: "",
    breakUntil: 0,
    giftUntil: 0,
    lastFullscreenAt: 0,
    bannerHoldout: rand < r.bannerHoldout,
  };
}

/** Accepts whatever came out of storage; anything malformed falls back to a fresh state. */
export function reviveState(raw: unknown, now: number, rand: number, r: Rules = RULES): AdState {
  const s = raw as Partial<AdState> | null;
  if (!s || typeof s !== "object" || s.v !== 1) return initialState(now, rand, r);
  const num = (x: unknown, d: number): number => (typeof x === "number" && Number.isFinite(x) && x >= 0 ? x : d);
  return {
    v: 1,
    installAt: num(s.installAt, now),
    units: num(s.units, 0),
    unitsSinceAd: num(s.unitsSinceAd, 0),
    playSinceAd: num(s.playSinceAd, 0),
    day: typeof s.day === "string" ? s.day : dayKey(now),
    dayInterstitials: num(s.dayInterstitials, 0),
    dayBreakOffered: s.dayBreakOffered === true,
    giftDay: typeof s.giftDay === "string" ? s.giftDay : "",
    cozyDay: typeof s.cozyDay === "string" ? s.cozyDay : "",
    // clamp: a clock moved backwards must not grant a near-infinite break / cooldown
    breakUntil: Math.min(num(s.breakUntil, 0), now + RULES.breakMs),
    giftUntil: Math.min(num(s.giftUntil, 0), now + RULES.streakGiftMs),
    lastFullscreenAt: Math.min(num(s.lastFullscreenAt, 0), now),
    bannerHoldout: typeof s.bannerHoldout === "boolean" ? s.bannerHoldout : rand < r.bannerHoldout,
  };
}

/** `now` = the moment the app came to the foreground (module load time on a cold launch). */
export function newSession(now: number): AdSession {
  return { startedAt: now, foregroundAt: now, interstitials: 0, breakOfferOpen: false, lastUnitDaily: false };
}

/** Rolls the per-day counters over at local midnight. */
export function rollDay(s: AdState, now: number): AdState {
  const day = dayKey(now);
  return day === s.day ? s : { ...s, day, dayInterstitials: 0, dayBreakOffered: false };
}

export const breakActive = (s: AdState, now: number): boolean => now < s.breakUntil;
/** R4 cozy evening length (a promise shown to the player: not remote-tunable, like breakMs) */
export const COZY_EVENING_MS = 30 * 60_000;
/** The cozy evening (R4): the gift window for 30 min, at most once per local day; null when today's was used. */
export function cozyEvening(s: AdState, now: number): AdState | null {
  const day = dayKey(now);
  if (s.cozyDay === day) return null;
  return { ...s, cozyDay: day, giftUntil: Math.max(s.giftUntil, now + COZY_EVENING_MS) };
}
export const giftActive = (s: AdState, now: number): boolean => now < s.giftUntil;

/** Records a completed unit (call on the result moment, before deciding). */
export function recordUnit(st: AdState, ses: AdSession, u: UnitResult, now: number, r: Rules = RULES): { state: AdState; session: AdSession } {
  let s = rollDay(st, now);
  // the chip belongs to one result moment
  const session: AdSession = { ...ses, breakOfferOpen: false, lastUnitDaily: u.daily };
  if (u.daily) {
    const n = u.dailyStreak ?? 0;
    // idempotent per milestone: keyed by the daily's own date (a daily finished after midnight
    // reports the same streak again on the next local day — it must not grant a second gift)
    const key = u.dailyDate ?? s.day;
    if (u.counted !== false && n >= r.streakGiftEvery && n % r.streakGiftEvery === 0 && s.giftDay !== key) {
      s = { ...s, giftDay: key, giftUntil: Math.max(s.giftUntil, now + r.streakGiftMs) };
    }
    return { state: s, session };
  }
  const play = Number.isFinite(u.playSeconds) && u.playSeconds > 0 ? u.playSeconds : 0;
  s = { ...s, units: s.units + 1, unitsSinceAd: s.unitsSinceAd + 1, playSinceAd: s.playSinceAd + play };
  return { state: s, session };
}

export type Verdict =
  | "show"
  | "daily"
  | "grace"
  | "pacing-units"
  | "pacing-play"
  | "resume-quiet"
  | "cooldown"
  | "session-cap"
  | "day-cap"
  | "break"
  | "gift";

/**
 * May the one-time consent UI (UMP form / IDFA explainer / ATT) run now? From the between-boards
 * moment after the first completed non-daily unit (r.consentAfterUnits, never before one: board 1
 * and its lesson are never interrupted). Independent of the interstitial grace (interstitialVerdict
 * still says "grace" until unit 6). The caller adds "between boards, not the daily, still there".
 */
export function consentAllowed(s: AdState, r: Rules = RULES): boolean {
  return s.units >= Math.max(1, r.consentAfterUnits);
}

/** Should the between-boards slot show an interstitial now? (after recordUnit) */
export function interstitialVerdict(s: AdState, ses: AdSession, u: Pick<UnitResult, "daily">, now: number, r: Rules = RULES): Verdict {
  if (u.daily || ses.lastUnitDaily) return "daily";
  if (breakActive(s, now)) return "break";
  if (giftActive(s, now)) return "gift";
  if (s.units <= r.graceUnits) return "grace";
  if (s.unitsSinceAd < Math.max(2, r.unitsBetween)) return "pacing-units";
  if (s.playSinceAd < r.playSecondsBetween) return "pacing-play";
  if (now - ses.foregroundAt < r.resumeQuietMs) return "resume-quiet";
  if (now - s.lastFullscreenAt < r.afterFullscreenMs) return "cooldown";
  const cap = now - ses.startedAt >= r.longSessionMs ? r.perSessionLong : r.perSession;
  if (ses.interstitials >= cap) return "session-cap";
  if (rollDay(s, now).dayInterstitials >= r.perDay) return "day-cap";
  return "show";
}

/** An interstitial was actually shown (not a no-fill) and closed at `now`. Opens the day's break offer after the 2nd. */
export function recordInterstitial(st: AdState, ses: AdSession, now: number, r: Rules = RULES): { state: AdState; session: AdSession } {
  let s = rollDay(st, now);
  s = { ...s, unitsSinceAd: 0, playSinceAd: 0, dayInterstitials: s.dayInterstitials + 1, lastFullscreenAt: now };
  const session = { ...ses, interstitials: ses.interstitials + 1, breakOfferOpen: false };
  if (s.dayInterstitials === r.breakAfterNthInterstitial && !s.dayBreakOffered) {
    s = { ...s, dayBreakOffered: true };
    session.breakOfferOpen = true;
  }
  return { state: s, session };
}

/** Another full-screen thing (rewarded ad, UMP consent / privacy form) closed at `now`. */
export function recordFullscreen(s: AdState, now: number): AdState {
  return { ...s, lastFullscreenAt: Math.max(s.lastFullscreenAt, now) };
}

/** True while the "30-min break" chip should be visible on the current result moment. */
export function shouldOfferBreak(s: AdState, ses: AdSession, now: number): boolean {
  return ses.breakOfferOpen && !ses.lastUnitDaily && !breakActive(s, now);
}

/** The rewarded break was watched to the end (the ad closed at `now`). */
export function grantBreak(s: AdState, ses: AdSession, now: number, r: Rules = RULES): { state: AdState; session: AdSession } {
  return { state: { ...recordFullscreen(s, now), breakUntil: now + r.breakMs }, session: { ...ses, breakOfferOpen: false } };
}

/** The player declined / the ad failed: the chip goes away for today. */
export function closeBreakOffer(ses: AdSession): AdSession {
  return { ...ses, breakOfferOpen: false };
}

/** App came back to the foreground after `backgroundMs`: a long gap starts a new session, any real gap restarts the quiet window. */
export function onResume(ses: AdSession, backgroundMs: number, now: number, r: Rules = RULES): AdSession {
  if (backgroundMs >= r.sessionGapMs) return newSession(now);
  if (backgroundMs >= r.resumeQuietMinBgMs) return { ...ses, foregroundAt: now };
  return ses;
}

/**
 * Banner (B+, FLAGS.banner OFF at launch): track boards only; not in the holdout; not on install
 * day; not during the grace / a break / the streak gift; only once ATT was answered.
 */
export function bannerAllowed(
  s: AdState,
  now: number,
  attAnswered: boolean,
  screen: AdScreen,
  flags: Pick<Flags, "banner"> = FLAGS,
  r: Rules = RULES,
): boolean {
  if (!flags.banner || screen !== "track" || s.bannerHoldout || !attAnswered) return false;
  if (breakActive(s, now) || giftActive(s, now) || s.units <= r.graceUnits) return false;
  return dayKey(s.installAt) !== dayKey(now);
}

/** Next moment a time-based block on the banner ends (break / gift), or 0 — for the re-check timer. */
export function bannerBlockEndsAt(s: AdState, now: number): number {
  const t = Math.max(breakActive(s, now) ? s.breakUntil : 0, giftActive(s, now) ? s.giftUntil : 0);
  return t > now ? t : 0;
}
