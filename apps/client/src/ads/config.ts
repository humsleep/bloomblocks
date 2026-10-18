// Ad unit configuration. The app ID and the two units live at launch (interstitial + rewarded break)
// are the developer's real AdMob IDs (publisher pub-4073994600346533, entered 2026-10-19; keep
// GADApplicationIdentifier in ios/App/App/Info.plist identical). Only a native Release build
// (AdAudio.buildKind().release, i.e. not Debug / Measure / simulator / web) requests real ads
// (AdMobAds.adsAreTest), so a dev or measurement install on a real iPhone can never produce
// invalid traffic. The web bundle MODE is NOT used: the archive builds with --mode m1 too. The three flagged-off
// units below stay Google's demo units: they are never requested while their flag is OFF.
// Demo units source: https://developers.google.com/admob/ios/test-ads (checked 2026-10-16).
// One unit per placement → separate reports / floors per placement once the real IDs exist.
// Keep this object FLAT with string literals: scripts/release-gates.mjs parses it.
export const ADMOB_IOS = {
  /** Duskwick iOS app — must match Info.plist GADApplicationIdentifier */
  appId: "ca-app-pub-4073994600346533~6623811101",
  /** the single between-boards slot (ads.beforeNextBoard) — Duskwick_Interstitial */
  interstitial: "ca-app-pub-4073994600346533/9278069612",
  /** rewarded: 30-min ad break (the only rewarded placement at launch) — Duskwick_Rewarded_Break */
  rewardedBreak: "ca-app-pub-4073994600346533/4090901120",
  /** rewarded: town keepsake frame (FLAGS.rewardKeepsake OFF, not built) */
  rewardedKeepsake: "ca-app-pub-3940256099942544/1712485313",
  /** rewarded: replay an old daily (FLAGS.rewardArchive OFF, not built) */
  rewardedArchive: "ca-app-pub-3940256099942544/1712485313",
  /** B+ only (FLAGS.banner OFF): anchored adaptive banner on track boards */
  bannerTrack: "ca-app-pub-3940256099942544/2435281174",
  /** true forces test ads in EVERY build (use only for an internal build that must never earn) */
  testing: false,
} as const;
// Not used (rejected in docs/ads-plan.md): app-open .../5575463023, rewarded interstitial
// .../6978759866, native .../3986624511, native video .../2521693316, fixed banner .../2934735716.

export type RewardPlacement = "break" | "keepsake" | "archive";

export const REWARDED_UNIT: Readonly<Record<RewardPlacement, string>> = {
  break: ADMOB_IOS.rewardedBreak,
  keepsake: ADMOB_IOS.rewardedKeepsake,
  archive: ADMOB_IOS.rewardedArchive,
};
