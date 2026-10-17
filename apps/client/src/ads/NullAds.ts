import type { AdsProvider } from "./AdsProvider.ts";

/**
 * No-ads provider (web, e2e, dev). Interstitials are no-ops that report "shown" so the
 * pacing policy runs exactly as on iOS; rewarded resolves true after a short fake delay
 * so the reward path stays testable.
 */
export class NullAds implements AdsProvider {
  readonly name = "null";
  constructor(private readonly fakeDelayMs = 900) {}

  async init(): Promise<void> {
    console.info("[ads] null provider");
  }
  async gatherConsent(): Promise<boolean> {
    return false;
  }
  isInterstitialReady(): boolean {
    return true;
  }
  async showInterstitial(): Promise<boolean> {
    console.info("[ads] (null) interstitial");
    return true;
  }
  async showRewarded(): Promise<boolean> {
    await wait(this.fakeDelayMs);
    return true;
  }
  isRewardedReady(): boolean {
    return true;
  }
  prepareRewarded(): void {}
  attAnswered(): boolean {
    return true;
  }
  privacyOptionsRequired(): boolean {
    return false;
  }
  async showPrivacyOptions(): Promise<void> {}
  setMuted(): void {}
  async showBanner(): Promise<void> {}
  async hideBanner(): Promise<void> {}
  onBannerHeight(): void {}
}

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
