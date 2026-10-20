// `ads` — the only ad API game code uses (contracts: docs/phase2-plan.md "Ads" + "Phase 5").
// Launch config B (docs/ads-plan.md): one interstitial slot between boards, a rewarded 30-min
// break behind a confirm card, no app-open, banner behind an OFF flag.
//   ads.init()                  once, after the first confirmed move (never at cold start)
//   ads.onUnitComplete(u)       on the result moment of EVERY completed unit (incl. daily, with
//                               dailyStreak). Records pacing only — never shows anything.
//   ads.beforeNextBoard(ctx)    THE interstitial slot: call after the finale's old board has left
//                               and before the next track board enters; hold the board until it
//                               resolves (true = an ad was shown). May run the one-time consent UI
//                               instead (from the 1st completed non-daily unit on; interstitials
//                               keep the 5-unit grace). Never in / after the daily, never
//                               once ctx.stillAtBreak() is false. Resolves at once when ads are
//                               not initialised yet (it never waits on SDK init or on an ad load).
//                               ctx may carry the unit itself (track, playSeconds, …) → recorded here.
//   ads.offerBreak()            true → show the moon-with-pause chip (after beforeNextBoard resolved)
//   ads.breakConfirm(lang?)     confirm-card copy { title, text, yes, no, unavailable } or null
//   ads.giftActiveUntil()       7-day gift: ms epoch while active, else 0
//   ads.watchBreak()            after the confirm card's "watch" (./breakCard.ts): rewarded ad;
//                               true → 30 min without interstitials / banner
//   ads.declineBreak()          card "not now" / chip timed out
//   ads.breakActiveUntil()      ms epoch while a break is active, else 0
//   ads.privacyOptionsRequired() / ads.showPrivacyOptions()   settings row (UMP, EEA/UK/CH)
//   ads.setMuted(m)             game mute → ad SDK (also read from Preferences "muted" at init)
//   ads.setScreen(s)            where the player is; the banner (flag OFF) only ever shows on "track"
//   ads.onBannerHeight(cb)      px to reserve at the bottom while a banner is visible (B+)
//   ads.onFullscreen(cb)        true while a full-screen ad is on screen → pause game audio / loop
// This module stays tiny and import-safe for the cold-start path: the AdMob provider is a
// dynamic import inside init(), and @capacitor/preferences / @capacitor/app are already
// loaded by main.ts.
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import type { AdsProvider } from "./AdsProvider.ts";
import { breakCardText } from "./breakCard.ts";
import type { RewardPlacement } from "./config.ts";
import { NullAds } from "./NullAds.ts";
import * as P from "./policy.ts";
import { fetchRemoteConfig, loadCachedConfig } from "./remote.ts";

export type { AdsProvider, RewardPlacement };
export type { AdScreen } from "./policy.ts";
export interface UnitInfo extends P.UnitResult {
  /** @deprecated ignored since Phase 5 (onUnitComplete no longer shows anything) */
  stillAtBreak?: () => boolean;
}
/**
 * ctx of beforeNextBoard. With the unit fields (track + playSeconds) the unit is recorded here
 * (U's phase-5 flow: no separate onUnitComplete for track units) — pass them in ONE of the two
 * calls, never both.
 */
export interface BoardBreak extends Partial<P.UnitResult> {
  /** the unit that just ended was the daily (or the next board is entered from the daily): never an ad */
  daily?: boolean;
  /** the player tapped to skip the finale (lastInputAt then carries that tap) */
  tapped?: boolean;
  /** Date.now() of the player's last tap (e.g. the tap that skipped the finale) */
  lastInputAt?: number;
  /** re-checked right before any consent UI / interstitial; false = the player has moved on */
  stillAtBreak?: () => boolean;
}

/** One ad flow never holds the queue longer than this (a provider promise that never settles). */
export const SERIAL_MAX_MS = 180_000;
/** No modal starts sooner than this after the player's last tap (accidental-click guard). */
export const MIN_AFTER_INPUT_MS = 400;

const KEY = "ads.state.v1";
/** ≈ app launch: ./index.ts is a static import of main.ts (cold launch opens the resume-quiet window) */
const bootAt = Date.now();

let provider: AdsProvider | null = null;
let state: P.AdState | null = null;
let session: P.AdSession | null = null;
let rules: P.Rules = P.resolveRules();
let flags: P.Flags = P.resolveFlags();
let initP: Promise<void> | null = null;
let loadP: Promise<void> | null = null;
let ready = false;
let busy: Promise<unknown> = Promise.resolve();
let backgroundAt = 0;
let muted: boolean | null = null;
let screen: P.AdScreen = "none";
let bannerOn = false;
let bannerTimer: ReturnType<typeof setTimeout> | undefined;
let bannerHeightCb: ((px: number) => void) | null = null;
const fullscreenCbs = new Set<(open: boolean) => void>();

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function pickProvider(): Promise<AdsProvider> {
  if (Capacitor.getPlatform() === "ios") {
    try {
      const { AdMobAds } = await import("./AdMobAds.ts");
      return new AdMobAds();
    } catch (e) {
      console.warn("[ads] AdMob provider unavailable, using null", e);
    }
  }
  return new NullAds();
}

function persist(): void {
  if (!state) return;
  const value = JSON.stringify(state);
  void Preferences.set({ key: KEY, value }).catch(() => undefined);
}

async function loadState(): Promise<void> {
  const now = Date.now();
  let raw: unknown = null;
  try {
    const { value } = await Preferences.get({ key: KEY });
    raw = value ? JSON.parse(value) : null;
  } catch {
    raw = null;
  }
  state = P.rollDay(P.reviveState(raw, now, Math.random(), rules), now);
  session = P.newSession(bootAt);
  persist();
}

async function doInit(): Promise<void> {
  // remote config: last good copy first (bannerHoldout is drawn from rules in loadState), then a
  // fresh fetch in the background that applies whenever it lands. iOS only: web / e2e stay offline
  const cached = await loadCachedConfig();
  if (cached) ads.applyRemoteConfig(cached);
  if (Capacitor.getPlatform() === "ios") void fetchRemoteConfig().then((c) => c && ads.applyRemoteConfig(c));
  loadP = loadState();
  await loadP;
  void App.addListener("appStateChange", ({ isActive }) => {
    const t = Date.now();
    if (!isActive) {
      backgroundAt = t;
      return;
    }
    if (!session || !backgroundAt) return;
    const away = t - backgroundAt;
    backgroundAt = 0;
    session = P.onResume(session, away, t, rules);
    syncBanner(); // timers do not run in the background
  }).catch(() => undefined);
  if (muted === null) {
    try {
      muted = (await Preferences.get({ key: "muted" })).value === "1"; // feedback.ts's setting
    } catch {
      muted = false;
    }
  }
  const p = await pickProvider();
  p.setMuted(muted);
  if (bannerHeightCb) p.onBannerHeight(bannerHeightCb);
  await p.init();
  provider = p;
  ready = true;
  syncBanner();
}

/**
 * Serialises ad flows so two moments can never stack two ads. A flow that never settles
 * (e.g. a native show that never resolves) releases the queue after SERIAL_MAX_MS.
 */
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = busy.then(fn, fn);
  let t: ReturnType<typeof setTimeout> | undefined;
  const cap = new Promise<void>((res) => {
    t = setTimeout(() => {
      console.warn("[ads] flow timed out; releasing the queue");
      res();
    }, SERIAL_MAX_MS);
  });
  busy = Promise.race([run.then(() => undefined, () => undefined), cap]).finally(() => clearTimeout(t));
  return run;
}

function fullscreen(open: boolean): void {
  for (const cb of [...fullscreenCbs]) {
    try {
      cb(open);
    } catch {
      /* a UI listener never breaks the ad flow */
    }
  }
}

/**
 * Banner state machine (fixes ads-plan §9-2): only asks the provider on a real change (no
 * re-request of a visible banner), never outside "track" (so never after / in the daily), and
 * re-checks itself when a break / gift ends (the banner comes back after the break).
 */
function syncBanner(): void {
  clearTimeout(bannerTimer);
  bannerTimer = undefined;
  if (!provider || !state) return;
  const now = Date.now();
  const want = P.bannerAllowed(state, now, provider.attAnswered(), screen, flags, rules);
  const ends = flags.banner ? P.bannerBlockEndsAt(state, now) : 0;
  if (ends) bannerTimer = setTimeout(syncBanner, ends - now + 250);
  if (want === bannerOn) return;
  bannerOn = want;
  void (want ? provider.showBanner() : provider.hideBanner()).catch(() => undefined);
}

const safe = (f?: () => boolean): (() => boolean) => () => {
  try {
    return f ? f() : true;
  } catch {
    return false;
  }
};

export const ads = {
  init(): Promise<void> {
    initP ??= doInit().catch((e: unknown) => console.warn("[ads] init failed", e));
    return initP;
  },

  /** Records the unit (pacing / streak gift). Shows nothing. */
  onUnitComplete(u: UnitInfo): Promise<void> {
    void ads.init();
    return serial(async () => {
      await loadP;
      if (!state || !session) return;
      const { stillAtBreak: _s, ...unit } = u;
      void _s;
      ({ state, session } = P.recordUnit(state, session, unit, Date.now(), rules));
      persist();
      if (import.meta.env?.DEV) console.info(`[ads] unit ${u.daily ? "daily" : u.track} recorded`, state);
    });
  },

  /** The single interstitial slot (see the header). true when an interstitial was shown. */
  beforeNextBoard(ctx: BoardBreak = {}): Promise<boolean> {
    const still = safe(ctx.stillAtBreak);
    const unit = toUnit(ctx);
    if (unit) void ads.init();
    return serial(async () => {
      if (unit) {
        await loadP;
        if (state && session) {
          ({ state, session } = P.recordUnit(state, session, unit, Date.now(), rules));
          persist();
        }
      }
      // never wait on SDK init: a slow first init simply means no ad this time
      if (!ready || !provider || !state || !session) return false;
      if (ctx.daily || session.lastUnitDaily || !still()) return false;
      const consent = P.consentAllowed(state, rules);
      let verdict = P.interstitialVerdict(state, session, { daily: false }, Date.now(), rules);
      const willShow = verdict === "show" && provider.isInterstitialReady();
      if (!consent && !willShow) return logVerdict(verdict);
      // accidental-click guard: no modal right under the finger that skipped the finale
      const gap = ctx.lastInputAt ? MIN_AFTER_INPUT_MS - (Date.now() - ctx.lastInputAt) : 0;
      if (gap > 0) await wait(Math.min(gap, MIN_AFTER_INPUT_MS));
      if (!still()) return false;
      // from the between-boards moment after the 1st non-daily unit (P.consentAllowed), once per launch:
      // UMP form where required, then ATT. A shown form starts the 90 s cooldown; the 5-unit
      // interstitial grace is separate, so no interstitial can follow it before unit 6
      if (consent && (await provider.gatherConsent())) {
        state = P.recordFullscreen(state, Date.now()); // no interstitial right after a consent form
        persist();
      }
      verdict = P.interstitialVerdict(state, session, { daily: false }, Date.now(), rules);
      let shown = false;
      if (verdict === "show" && still() && provider.isInterstitialReady()) {
        fullscreen(true);
        try {
          shown = await provider.showInterstitial();
        } finally {
          fullscreen(false);
        }
        if (shown) {
          ({ state, session } = P.recordInterstitial(state, session, Date.now(), rules));
          persist();
        }
      }
      // warm the rewarded slot ahead of the day's break offer (after the 1st interstitial)
      if (state.dayInterstitials >= 1 && (!state.dayBreakOffered || session.breakOfferOpen)) provider.prepareRewarded("break");
      logVerdict(verdict);
      return shown;
    });
  },

  offerBreak(): boolean {
    if (!provider || !state || !session) return false;
    return P.shouldOfferBreak(state, session, Date.now()) && provider.isRewardedReady("break");
  },

  watchBreak(): Promise<boolean> {
    return serial(async () => {
      if (!ads.offerBreak() || !provider || !state || !session) return false;
      fullscreen(true);
      let ok = false;
      try {
        ok = await provider.showRewarded("break");
      } finally {
        fullscreen(false);
      }
      const now = Date.now();
      if (ok) ({ state, session } = P.grantBreak(state, session, now, rules));
      else {
        state = P.recordFullscreen(state, now);
        session = P.closeBreakOffer(session);
      }
      persist();
      syncBanner(); // hides it for the break; the timer brings it back after
      return ok;
    });
  },

  /**
   * Confirm-card copy for U's AskCard, or null when the break must not be offered now.
   * `lang`: BCP-47 tag(s), e.g. the a11y layer's language (default: navigator.languages).
   */
  breakConfirm(lang?: string | readonly string[]): { title: string; text: string; yes: string; no: string; unavailable: string } | null {
    if (!ads.offerBreak()) return null;
    const t = lang === undefined ? breakCardText() : breakCardText(lang);
    return { title: t.title, text: t.body, yes: t.watch, no: t.notNow, unavailable: t.unavailable };
  },

  /** R4 cozy evening (cozy level 5, the village calls it on a visit): true when it started now. */
  cozyEvening(): boolean {
    if (!state || !flags.cozyEvening) return false;
    const next = P.cozyEvening(state, Date.now());
    if (!next) return false;
    state = next;
    persist();
    syncBanner();
    return true;
  },

  /** 7-day streak gift (1 h without interstitials): ms epoch while active, else 0. */
  giftActiveUntil(): number {
    return state && P.giftActive(state, Date.now()) ? state.giftUntil : 0;
  },

  declineBreak(): void {
    if (session) session = P.closeBreakOffer(session);
  },

  breakActiveUntil(): number {
    return state && P.breakActive(state, Date.now()) ? state.breakUntil : 0;
  },

  /** Settings row: show "Privacy options" only when true (UMP says the entry point is required). */
  privacyOptionsRequired(): boolean {
    try {
      return ready && !!provider?.privacyOptionsRequired();
    } catch {
      return false;
    }
  },

  /** Opens Google's UMP privacy options form; resolves when it is closed. Never rejects. */
  showPrivacyOptions(): Promise<void> {
    return serial(async () => {
      if (!ready || !provider) return;
      await provider.showPrivacyOptions().catch(() => undefined);
      if (state) {
        state = P.recordFullscreen(state, Date.now());
        persist();
      }
      syncBanner();
    });
  },

  /** Game mute → ad SDK. Call on every toggle (the saved value is read at init). */
  setMuted(m: boolean): void {
    muted = m;
    provider?.setMuted(m);
  },

  setScreen(s: P.AdScreen): void {
    if (s === screen) return;
    screen = s;
    syncBanner();
  },

  onBannerHeight(cb: (px: number) => void): void {
    bannerHeightCb = cb;
    provider?.onBannerHeight(cb);
  },

  onFullscreen(cb: (open: boolean) => void): () => void {
    fullscreenCbs.add(cb);
    return () => void fullscreenCbs.delete(cb);
  },

  /** Remote config (./remote.ts, applied by init): anything broken is clamped / ignored (policy.ts). */
  applyRemoteConfig(raw: { rules?: unknown; flags?: unknown } | null | undefined): void {
    rules = P.resolveRules(raw?.rules);
    flags = P.resolveFlags(raw?.flags);
    syncBanner();
  },
};

function toUnit(c: BoardBreak): P.UnitResult | null {
  if (typeof c.playSeconds !== "number" || typeof c.track !== "string") return null;
  const u: P.UnitResult = { track: c.track, daily: c.daily === true, playSeconds: c.playSeconds };
  if (c.dailyStreak !== undefined) u.dailyStreak = c.dailyStreak;
  if (c.dailyDate !== undefined) u.dailyDate = c.dailyDate;
  if (c.counted !== undefined) u.counted = c.counted;
  return u;
}

function logVerdict(v: P.Verdict): false {
  if (import.meta.env?.DEV) console.info(`[ads] between boards → ${v}`, state);
  return false;
}

/** @deprecated main.ts (W1) still calls createAds().init(); use `ads` directly. */
export function createAds(): { init(): Promise<void> } {
  return ads;
}
