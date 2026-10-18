// AdMob provider (iOS). Loaded ONLY through `import("./AdMobAds.ts")` from ./index.ts after
// the first confirmed move — never on the cold-start path. Pacing lives in ./policy.ts; this
// file only talks to @capacitor-community/admob (pinned 8.2.1 → Google Mobile Ads 13.11.0,
// UMP 3.1.x via SPM).
//
// Consent order (Google: UMP first; ATT after, waiting for its answer before loading ads):
//   init()            (first move)        requestConsentInfo — network only, no UI. If ads may already
//                                         be requested (returning user / consent not required) →
//                                         initialize + preload the interstitial.
//   gatherConsent()   (between boards after the 1st completed non-daily unit — policy.consentAllowed;
//                     never cold start, never mid-play, never the daily)
//                     UMP consent form if REQUIRED (EEA/UK/CH; it also runs the IDFA explainer + ATT
//                     when that message is configured in the AdMob account), then — only if consent
//                     allows ads and ATT is still undetermined — the system ATT prompt.
//                     Then initialize + preload.
// Audio (docs/ads-plan.md §9-4): before initialize, the app-local AdAudio plugin keeps the
// AVAudioSession at .ambient and tells GMA the app manages the session (so an ad cannot switch
// it to .playback and play through the silent switch); the game's mute goes to
// isApplicationMuted. High-engagement ads are an AdMob console setting (src/ads/README.md).
import {
  AdMob,
  AdmobConsentStatus,
  BannerAdPluginEvents,
  BannerAdPosition,
  BannerAdSize,
  InterstitialAdPluginEvents,
  MaxAdContentRating,
  RewardAdPluginEvents,
  type AdmobConsentInfo,
} from "@capacitor-community/admob";
import { configureAdAudio, isReleaseBuild } from "../native/adAudio.ts";
import type { AdsProvider } from "./AdsProvider.ts";
import { ADMOB_IOS, REWARDED_UNIT, type RewardPlacement } from "./config.ts";

/** Real ads ONLY for a native Release build (App Store / TestFlight) with config.testing === false.
 *  Unknown (null), web, Debug / Measure / simulator, or a failed native call → test ads. The web
 *  bundle is the same in every configuration (vite --mode m1), so MODE cannot tell them apart. */
export const adsAreTest = (testing: boolean, release: boolean | null): boolean => testing || release !== true;

type Slot = "idle" | "loading" | "ready";

/** Longest an ad may stay on screen before its show() settles anyway (never a stuck ads queue). */
export const SHOW_TIMEOUT_MS = 150_000;

type Handle = { remove(): Promise<void> | void };

/** pt between the banner and the bottom safe area [PLACEHOLDER] (1 pt = 1 CSS px in the WebView) */
export const BANNER_MARGIN_PT = 6;

/**
 * Show a full-screen ad and settle only when it is GONE. The native calls do not: the plugin's
 * showInterstitial resolves right after present, and showRewardVideoAd resolves only when the
 * reward is earned (a dismiss without reward or a failed present never settles it). So the
 * outcome comes from the Dismissed / FailedToShow events, with a timeout as the last resort.
 *   earned()  the value to resolve with on dismiss / timeout
 */
async function untilClosed(
  ev: { dismissed: string; failed: string; extra?: [string, () => void][] },
  show: () => Promise<unknown>,
  earned: () => boolean,
): Promise<boolean> {
  const handles: Handle[] = [];
  const on = async (name: string, f: () => void): Promise<void> => {
    try {
      const h = await (AdMob.addListener as unknown as (n: string, cb: () => void) => Promise<Handle>)(name, f);
      handles.push(h);
    } catch {
      /* listener unavailable: the timeout still settles the show */
    }
  };
  let settle!: (v: boolean) => void;
  const done = new Promise<boolean>((res) => (settle = res));
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.all([
    on(ev.dismissed, () => settle(earned())),
    on(ev.failed, () => settle(false)),
    ...(ev.extra ?? []).map(([n, f]) => on(n, f)),
  ]);
  timer = setTimeout(() => {
    console.warn("[ads] show did not close in time");
    settle(earned());
  }, SHOW_TIMEOUT_MS);
  show().catch((e: unknown) => {
    console.warn("[ads] show failed", e);
    settle(false);
  });
  try {
    return await done;
  } finally {
    clearTimeout(timer);
    for (const h of handles) void Promise.resolve(h.remove()).catch(() => undefined);
  }
}

export class AdMobAds implements AdsProvider {
  readonly name = "admob";
  private consent: AdmobConsentInfo | null = null;
  private consentAsked = false;
  private sdkStarted: Promise<void> | null = null;
  private inter: Slot = "idle";
  private reward: Slot = "idle";
  /** the placement the loaded / loading rewarded ad belongs to (the plugin holds one rewarded ad) */
  private rewardFor: RewardPlacement = "break";
  private muted = false;
  /** native build kind; null until resolved in start() — no ad request is made while null */
  private release: boolean | null = null;
  private banner: "none" | "shown" | "hidden" = "none";
  private bannerPx = 0;
  private bannerCb: ((px: number) => void) | null = null;
  private att: "authorized" | "denied" | "notDetermined" | "restricted" = "notDetermined";
  /** non-personalized ads only (no consent info / consent not obtained where required) */
  private npa = false;

  async init(): Promise<void> {
    try {
      this.consent = await AdMob.requestConsentInfo();
    } catch (e) {
      // e.g. offline, or UMP not configured for this app ID yet (test app ID): stay non-personalized.
      console.warn("[ads] consent info unavailable", e);
      this.consent = null;
    }
    this.att = await this.readAtt();
    if (this.canRequestAds() && this.consent?.status !== AdmobConsentStatus.REQUIRED) await this.start();
  }

  async gatherConsent(): Promise<boolean> {
    if (this.consentAsked) return false;
    this.consentAsked = true;
    let shown = false;
    try {
      if (!this.consent) this.consent = await AdMob.requestConsentInfo().catch(() => null);
      if (this.consent?.status === AdmobConsentStatus.REQUIRED && this.consent.isConsentFormAvailable) {
        shown = true;
        const r = await AdMob.showConsentForm();
        this.consent = { ...this.consent, ...r };
      }
      this.att = await this.readAtt();
      const consentOk =
        this.consent === null ||
        this.consent.status === AdmobConsentStatus.OBTAINED ||
        this.consent.status === AdmobConsentStatus.NOT_REQUIRED;
      if (this.att === "notDetermined" && consentOk && this.canRequestAds()) {
        shown = true;
        await AdMob.requestTrackingAuthorization();
        this.att = await this.readAtt();
      }
    } catch (e) {
      console.warn("[ads] consent flow failed", e);
    }
    if (this.canRequestAds()) await this.start();
    // R2 (A2): a system / consent prompt showed in this session — the rating ask stays away (src/game/rating.ts)
    if (shown) globalThis.dispatchEvent?.(new Event("duskwick:prompt"));
    return shown;
  }

  privacyOptionsRequired(): boolean {
    // enum not re-exported by the plugin's index: compare with its string value
    return (this.consent?.privacyOptionsRequirementStatus as string | undefined) === "REQUIRED";
  }

  async showPrivacyOptions(): Promise<void> {
    try {
      await AdMob.showPrivacyOptionsForm();
    } catch (e) {
      console.warn("[ads] privacy options form failed", e);
    }
    // the choice may have changed what we may request (canRequestAds / personalisation)
    try {
      this.consent = await AdMob.requestConsentInfo();
    } catch {
      /* keep the last known info */
    }
    if (this.canRequestAds()) await this.start();
    else void this.hideBanner();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.sdkStarted) void this.applyAudio();
  }

  attAnswered(): boolean {
    return this.att !== "notDetermined";
  }

  isInterstitialReady(): boolean {
    if (this.inter !== "ready") this.loadInterstitial();
    return this.inter === "ready" && this.canRequestAds();
  }

  async showInterstitial(): Promise<boolean> {
    if (!this.live() || !this.canRequestAds()) return false;
    if (this.inter !== "ready") {
      this.loadInterstitial();
      return false; // no waiting on the result moment: a no-fill simply means no ad this time
    }
    this.inter = "idle";
    try {
      // settles when the ad is dismissed (true) or failed to present (false) — not on present
      return await untilClosed(
        { dismissed: InterstitialAdPluginEvents.Dismissed, failed: InterstitialAdPluginEvents.FailedToShow },
        () => AdMob.showInterstitial(),
        () => true,
      );
    } finally {
      this.loadInterstitial();
    }
  }

  isRewardedReady(placement: RewardPlacement = "break"): boolean {
    return this.reward === "ready" && this.rewardFor === placement;
  }

  prepareRewarded(placement: RewardPlacement = "break"): void {
    if (!this.live() || !this.canRequestAds()) return;
    // one rewarded ad at a time in the plugin: a different placement replaces an idle / ready one
    if (this.reward === "loading" || (this.reward === "ready" && this.rewardFor === placement)) return;
    this.reward = "loading";
    this.rewardFor = placement;
    AdMob.prepareRewardVideoAd({ adId: REWARDED_UNIT[placement], isTesting: this.testMode(), npa: this.npa }).then(
      () => {
        if (this.rewardFor === placement) this.reward = "ready";
      },
      (e: unknown) => {
        console.warn("[ads] rewarded load failed", e);
        this.reward = "idle";
      },
    );
  }

  async showRewarded(placement: RewardPlacement = "break"): Promise<boolean> {
    if (!this.isRewardedReady(placement)) return false;
    this.reward = "idle";
    let got = false;
    // the native call resolves only on reward: a dismiss before it (or a failed present) is
    // read from the events, so the ads queue is never left waiting
    return untilClosed(
      { dismissed: RewardAdPluginEvents.Dismissed, failed: RewardAdPluginEvents.FailedToShow, extra: [[RewardAdPluginEvents.Rewarded, () => (got = true)]] },
      () =>
        AdMob.showRewardVideoAd().then((item) => {
          if (item && item.amount >= 0) got = true;
        }),
      () => got,
    );
  }

  /** Create once, then resume / hide (index.ts only calls on a real visibility change). */
  async showBanner(): Promise<void> {
    if (!this.live() || !this.canRequestAds() || this.banner === "shown") return;
    if (this.banner === "hidden") {
      this.banner = "shown";
      await AdMob.resumeBanner().catch((e: unknown) => console.warn("[ads] banner resume failed", e));
      return;
    }
    this.banner = "shown";
    void (AdMob.addListener as unknown as (n: string, cb: (s: { height: number }) => void) => Promise<Handle>)(
      BannerAdPluginEvents.SizeChanged,
      // the banner sits over the WebView above the bottom safe area: reserve height + margin
      (s) => this.setBannerPx(this.banner === "shown" && s?.height > 0 ? s.height + BANNER_MARGIN_PT : 0),
    ).catch(() => undefined);
    await AdMob.showBanner({
      adId: ADMOB_IOS.bannerTrack,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: BANNER_MARGIN_PT,
      isTesting: this.testMode(),
      npa: this.npa,
    }).catch((e: unknown) => {
      console.warn("[ads] banner failed", e);
      this.banner = "none";
    });
  }

  async hideBanner(): Promise<void> {
    if (this.banner !== "shown") return;
    this.banner = "hidden";
    this.setBannerPx(0);
    await AdMob.hideBanner().catch(() => undefined);
  }

  onBannerHeight(cb: (px: number) => void): void {
    this.bannerCb = cb;
    cb(this.bannerPx);
  }

  private setBannerPx(px: number): void {
    if (px === this.bannerPx) return;
    this.bannerPx = px;
    this.bannerCb?.(px);
  }

  // ---------------------------------------------------------------------------

  private testMode = (): boolean => adsAreTest(ADMOB_IOS.testing, this.release);

  /** SDK started AND the build kind is known (sdkStarted is set while it is still resolving) */
  private live(): boolean {
    return !!this.sdkStarted && this.release !== null;
  }

  private canRequestAds(): boolean {
    // No consent info (offline / misconfigured) → still allow, but non-personalized only.
    return this.consent ? this.consent.canRequestAds : true;
  }

  private start(): Promise<void> {
    // Personalisation is governed by UMP (TCF string) and ATT on Google's side; we only force
    // non-personalized requests when we have no consent information at all.
    this.npa = !this.consent;
    this.sdkStarted ??= (this.release === null ? isReleaseBuild().then((r) => void (this.release = r)) : Promise.resolve())
      .then(() => this.applyAudio())
      .then(() =>
        AdMob.initialize({
          initializeForTesting: this.testMode(),
          maxAdContentRating: MaxAdContentRating.ParentalGuidance,
        }),
      )
      .then(() => this.loadInterstitial())
      .catch((e: unknown) => {
        console.warn("[ads] initialize failed", e);
        this.sdkStarted = null;
      });
    return this.sdkStarted;
  }

  /** Audio session + mute → SDK. Never rejects. */
  private async applyAudio(): Promise<void> {
    if (await configureAdAudio(this.muted)) return;
    // no app-local plugin (older native shell): at least pass the mute through the plugin
    try {
      await AdMob.setApplicationMuted({ muted: this.muted });
    } catch {
      /* web / missing method */
    }
  }

  private loadInterstitial(): void {
    if (!this.live() || this.inter !== "idle" || !this.canRequestAds()) return;
    this.inter = "loading";
    AdMob.prepareInterstitial({ adId: ADMOB_IOS.interstitial, isTesting: this.testMode(), npa: this.npa }).then(
      () => (this.inter = "ready"),
      (e: unknown) => {
        console.warn("[ads] interstitial load failed", e);
        this.inter = "idle";
      },
    );
  }

  private async readAtt(): Promise<AdMobAds["att"]> {
    try {
      return (await AdMob.trackingAuthorizationStatus()).status;
    } catch {
      return "notDetermined";
    }
  }
}
