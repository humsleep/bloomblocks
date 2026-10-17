/**
 * Ad SDK abstraction. Game code never talks to this directly — it uses `ads` from
 * ./index.ts, which applies the pacing policy (./policy.ts) and calls a provider:
 * NullAds (web / e2e / dev) or AdMobAds (iOS, dynamically imported — never on the
 * cold-start path, never shown over the board mid-play).
 */
import type { RewardPlacement } from "./config.ts";

export type { RewardPlacement };

export interface AdsProvider {
  readonly name: string;
  /** SDK bootstrap without any UI: consent-info refresh, and SDK init + preload when ads may already be requested. Never throws. */
  init(): Promise<void>;
  /**
   * Consent UI, only between boards: UMP form if required, then ATT (when UMP did not already ask
   * and consent allows it). Idempotent per launch. true when some UI was actually shown. Never throws.
   */
  gatherConsent(): Promise<boolean>;
  /** An interstitial is loaded (show would not be a no-fill). Never waits. */
  isInterstitialReady(): boolean;
  /** true when an interstitial was actually shown (false on no-fill / not ready / error). Resolves after dismiss. */
  showInterstitial(): Promise<boolean>;
  /** Rewarded ad for a placement. true only if watched to the end. Resolves after dismiss. */
  showRewarded(placement: RewardPlacement): Promise<boolean>;
  isRewardedReady(placement: RewardPlacement): boolean;
  /** Warm the rewarded slot (e.g. when the break offer may come up soon). */
  prepareRewarded(placement: RewardPlacement): void;
  /** true once the ATT prompt was answered (or is not applicable). */
  attAnswered(): boolean;
  /** UMP: the app must offer a "privacy options" entry point (EEA/UK/CH users). */
  privacyOptionsRequired(): boolean;
  /** Shows the UMP privacy options form, then refreshes consent. Never throws. */
  showPrivacyOptions(): Promise<void>;
  /** Game mute → SDK (video ads start muted / muted-ineligible ads are not requested). */
  setMuted(muted: boolean): void;
  /** Banner (B+, behind FLAGS.banner): show = create or resume; hide keeps it for a cheap resume. */
  showBanner(): Promise<void>;
  hideBanner(): Promise<void>;
  /** Banner height in CSS px (0 while hidden) — for the board layout. */
  onBannerHeight(cb: (px: number) => void): void;
}
