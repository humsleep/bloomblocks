// Ad unit configuration. TEST IDS ONLY (Google's published iOS demo units, safe in dev builds;
// they never earn and never risk the account). Replacing them needs the developer's own AdMob
// account: create the app + one unit per placement there, put the real IDs here AND set
// GADApplicationIdentifier in ios/App/App/Info.plist (currently Google's sample app ID).
// Source: https://developers.google.com/admob/ios/test-ads (demo ad units, checked 2026-10-16).
// One unit per placement → separate reports / floors per placement once the real IDs exist.
// Keep this object FLAT with string literals: scripts/release-gates.mjs parses it.
export const ADMOB_IOS = {
  /** Google's sample iOS app ID — must match Info.plist GADApplicationIdentifier */
  appId: "ca-app-pub-3940256099942544~1458002511",
  /** the single between-boards slot (ads.beforeNextBoard) */
  interstitial: "ca-app-pub-3940256099942544/4411468910",
  /** rewarded: 30-min ad break (the only rewarded placement at launch) */
  rewardedBreak: "ca-app-pub-3940256099942544/1712485313",
  /** rewarded: town keepsake frame (FLAGS.rewardKeepsake OFF, not built) */
  rewardedKeepsake: "ca-app-pub-3940256099942544/1712485313",
  /** rewarded: replay an old daily (FLAGS.rewardArchive OFF, not built) */
  rewardedArchive: "ca-app-pub-3940256099942544/1712485313",
  /** B+ only (FLAGS.banner OFF): anchored adaptive banner on track boards */
  bannerTrack: "ca-app-pub-3940256099942544/2435281174",
  /** true while the IDs above are Google's demo units */
  testing: true,
} as const;
// Not used (rejected in docs/ads-plan.md): app-open .../5575463023, rewarded interstitial
// .../6978759866, native .../3986624511, native video .../2521693316, fixed banner .../2934735716.

export type RewardPlacement = "break" | "keepsake" | "archive";

export const REWARDED_UNIT: Readonly<Record<RewardPlacement, string>> = {
  break: ADMOB_IOS.rewardedBreak,
  keepsake: ADMOB_IOS.rewardedKeepsake,
  archive: ADMOB_IOS.rewardedArchive,
};
