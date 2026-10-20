// Review fixes (P1-2 / P1-3 / P1-4): AdMob shows settle when the ad is GONE (dismiss / failed
// present / timeout), the ads queue never hangs, and nothing modal starts once the result moment
// has passed or in the daily. The AdMob plugin and the Capacitor plugins are fakes.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Cb = () => void;
const listeners = new Map<string, Set<Cb>>();
const emit = (name: string): void => {
  for (const f of [...(listeners.get(name) ?? [])]) f();
};
const native = {
  showInterstitial: vi.fn<() => Promise<void>>(),
  showRewardVideoAd: vi.fn<() => Promise<{ type: string; amount: number }>>(),
};

vi.mock("@capacitor-community/admob", () => ({
  AdMob: {
    addListener: async (name: string, f: Cb) => {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name)!.add(f);
      return { remove: async () => void listeners.get(name)?.delete(f) };
    },
    requestConsentInfo: async () => ({ status: "NOT_REQUIRED", isConsentFormAvailable: false, canRequestAds: true }),
    trackingAuthorizationStatus: async () => ({ status: "authorized" }),
    initialize: async () => undefined,
    prepareInterstitial: async () => undefined,
    prepareRewardVideoAd: async () => undefined,
    showInterstitial: () => native.showInterstitial(),
    showRewardVideoAd: () => native.showRewardVideoAd(),
    setApplicationMuted: async () => undefined,
    showPrivacyOptionsForm: async () => undefined,
  },
  AdmobConsentStatus: { REQUIRED: "REQUIRED", OBTAINED: "OBTAINED", NOT_REQUIRED: "NOT_REQUIRED" },
  BannerAdPosition: { BOTTOM_CENTER: "BOTTOM_CENTER" },
  BannerAdPluginEvents: { SizeChanged: "bannerAdSizeChanged" },
  BannerAdSize: { ADAPTIVE_BANNER: "ADAPTIVE_BANNER" },
  MaxAdContentRating: { ParentalGuidance: "ParentalGuidance" },
  InterstitialAdPluginEvents: { Dismissed: "interstitialAdDismissed", FailedToShow: "interstitialAdFailedToShow" },
  RewardAdPluginEvents: { Dismissed: "onRewardedVideoAdDismissed", FailedToShow: "onRewardedVideoAdFailedToShow", Rewarded: "onRewardedVideoAdReward" },
}));

const tick = async (n = 6): Promise<void> => {
  for (let i = 0; i < n; i++) await Promise.resolve();
};

beforeEach(() => {
  listeners.clear();
  native.showInterstitial.mockReset();
  native.showRewardVideoAd.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function readyAdMob() {
  const { AdMobAds } = await import("../AdMobAds.ts");
  const a = new AdMobAds();
  await a.init();
  await tick();
  return a;
}

describe("AdMobAds: shows settle when the ad is gone (review P1-2, P1-3)", () => {
  it("interstitial: the native call resolves on present, the show waits for the dismiss", async () => {
    const a = await readyAdMob();
    native.showInterstitial.mockResolvedValue(undefined); // plugin: resolves right after present
    let done: boolean | null = null;
    void a.showInterstitial().then((v) => (done = v));
    await tick(20);
    expect(native.showInterstitial).toHaveBeenCalledOnce();
    expect(done).toBeNull(); // still on screen
    emit("interstitialAdDismissed");
    await tick(20);
    expect(done).toBe(true);
  });

  it("interstitial: a failed present settles false", async () => {
    const a = await readyAdMob();
    native.showInterstitial.mockReturnValue(new Promise(() => undefined));
    const p = a.showInterstitial();
    await tick(20);
    emit("interstitialAdFailedToShow");
    expect(await p).toBe(false);
  });

  it("rewarded dismissed before the reward settles false (the native call never settles)", async () => {
    const a = await readyAdMob();
    a.prepareRewarded();
    await tick();
    expect(a.isRewardedReady()).toBe(true);
    native.showRewardVideoAd.mockReturnValue(new Promise(() => undefined));
    const p = a.showRewarded();
    await tick(20);
    emit("onRewardedVideoAdDismissed");
    expect(await p).toBe(false);
  });

  it("rewarded watched to the end: true, settled on the dismiss after the reward", async () => {
    const a = await readyAdMob();
    a.prepareRewarded();
    await tick();
    native.showRewardVideoAd.mockReturnValue(new Promise(() => undefined));
    let done: boolean | null = null;
    void a.showRewarded().then((v) => (done = v));
    await tick(20);
    emit("onRewardedVideoAdReward");
    await tick(20);
    expect(done).toBeNull();
    emit("onRewardedVideoAdDismissed");
    await tick(20);
    expect(done).toBe(true);
  });

  it("a show whose events never come settles after the timeout", async () => {
    vi.useFakeTimers();
    const { SHOW_TIMEOUT_MS } = await import("../AdMobAds.ts");
    const a = await readyAdMob();
    native.showInterstitial.mockResolvedValue(undefined);
    let done: boolean | null = null;
    void a.showInterstitial().then((v) => (done = v));
    await vi.advanceTimersByTimeAsync(SHOW_TIMEOUT_MS + 10);
    expect(done).toBe(true);
  });
});

// ---------------------------------------------------------------- the facade

const fake = {
  gatherConsent: vi.fn(async () => false),
  showInterstitial: vi.fn(async () => true),
  showRewarded: vi.fn<() => Promise<boolean>>(async () => true),
  showBanner: vi.fn(async () => undefined),
  hideBanner: vi.fn(async () => undefined),
  showPrivacyOptions: vi.fn(async () => undefined),
  setMuted: vi.fn(),
  privacyRequired: false,
};

const MIN = 60_000;

/** Facade with a fake provider. The clock starts 3 min after "launch" (resume-quiet over). */
async function facade(
  stateOver: Record<string, unknown> = {},
  prefs: Record<string, string> = {},
  remoteFetch: () => Promise<Response> = async () => {
    throw new TypeError("offline"); // ./remote.ts: tests never touch the network
  },
) {
  vi.stubGlobal("fetch", vi.fn(remoteFetch));
  vi.useFakeTimers({ toFake: ["Date"] });
  const t0 = new Date(2026, 9, 16, 10, 0, 0).getTime();
  vi.setSystemTime(t0);
  vi.resetModules();
  vi.doMock("@capacitor/core", () => ({ Capacitor: { getPlatform: () => "ios" } }));
  vi.doMock("@capacitor/app", () => ({ App: { addListener: async () => ({ remove: async () => undefined }) } }));
  const P = await import("../policy.ts");
  // well past the grace period, pacing met: the next unit makes the verdict "show"
  const st = { ...P.initialState(t0 - 5 * 86400_000, 0.9), units: 40, unitsSinceAd: 5, playSinceAd: 900, day: P.dayKey(t0), ...stateOver };
  const store: Record<string, string> = { "ads.state.v1": JSON.stringify(st), ...prefs };
  vi.doMock("@capacitor/preferences", () => ({
    Preferences: { get: async ({ key }: { key: string }) => ({ value: store[key] ?? null }), set: async () => undefined },
  }));
  vi.doMock("../AdMobAds.ts", () => ({
    AdMobAds: class {
      readonly name = "fake";
      init = async () => undefined;
      gatherConsent = fake.gatherConsent;
      isInterstitialReady = () => true;
      showInterstitial = fake.showInterstitial;
      showRewarded = fake.showRewarded;
      isRewardedReady = () => true;
      prepareRewarded = () => undefined;
      attAnswered = () => true;
      privacyOptionsRequired = () => fake.privacyRequired;
      showPrivacyOptions = fake.showPrivacyOptions;
      setMuted = fake.setMuted;
      showBanner = fake.showBanner;
      hideBanner = fake.hideBanner;
      onBannerHeight = () => undefined;
    },
  }));
  const m = await import("../index.ts"); // "launch"
  await m.ads.init();
  vi.setSystemTime(t0 + 3 * MIN);
  return { ...m, t0 };
}

const trackUnit = { track: "gentle", daily: false, playSeconds: 200 } as const;

describe("ads facade B: one slot between boards", () => {
  beforeEach(() => {
    for (const f of Object.values(fake)) if (typeof f === "function") f.mockClear();
    fake.gatherConsent.mockImplementation(async () => false);
    fake.showRewarded.mockReset();
    fake.privacyRequired = false;
  });
  afterEach(() => {
    vi.doUnmock("@capacitor/core");
    vi.doUnmock("@capacitor/app");
    vi.doUnmock("@capacitor/preferences");
    vi.doUnmock("../AdMobAds.ts");
  });

  it("onUnitComplete only records; the interstitial comes from beforeNextBoard", async () => {
    const { ads } = await facade();
    await ads.onUnitComplete(trackUnit);
    expect(fake.showInterstitial).not.toHaveBeenCalled();
    expect(fake.gatherConsent).not.toHaveBeenCalled();
    expect(await ads.beforeNextBoard({ stillAtBreak: () => true })).toBe(true);
    expect(fake.gatherConsent).toHaveBeenCalledOnce();
    expect(fake.showInterstitial).toHaveBeenCalledOnce();
    // pacing reset: the next break shows nothing
    await ads.onUnitComplete(trackUnit);
    expect(await ads.beforeNextBoard()).toBe(false);
  });

  it("never after the daily, even if the caller forgets daily: true", async () => {
    const { ads } = await facade();
    await ads.onUnitComplete({ track: "gentle", daily: true, playSeconds: 90, dailyStreak: 3 });
    expect(await ads.beforeNextBoard()).toBe(false);
    expect(await ads.beforeNextBoard({ daily: true })).toBe(false);
    expect(fake.gatherConsent).not.toHaveBeenCalled();
    expect(fake.showInterstitial).not.toHaveBeenCalled();
    expect(ads.offerBreak()).toBe(false);
  });

  it("the player moved on: no consent UI, no interstitial", async () => {
    const { ads } = await facade();
    await ads.onUnitComplete(trackUnit);
    expect(await ads.beforeNextBoard({ stillAtBreak: () => false })).toBe(false);
    expect(fake.gatherConsent).not.toHaveBeenCalled();
    expect(fake.showInterstitial).not.toHaveBeenCalled();
  });

  it("a consent form that was shown blocks the interstitial right after it (cooldown)", async () => {
    const { ads } = await facade();
    fake.gatherConsent.mockImplementationOnce(async () => true);
    await ads.onUnitComplete(trackUnit);
    expect(await ads.beforeNextBoard()).toBe(false);
    expect(fake.showInterstitial).not.toHaveBeenCalled();
  });

  it("cold launch: 120 s quiet even with pacing met", async () => {
    const { ads, t0 } = await facade();
    vi.setSystemTime(t0 + 60_000);
    await ads.onUnitComplete(trackUnit);
    expect(await ads.beforeNextBoard()).toBe(false);
    vi.setSystemTime(t0 + 121_000);
    expect(await ads.beforeNextBoard()).toBe(true);
  });

  it("consent after the 1st track unit (not before, not after the daily); no interstitial inside the 5-unit grace", async () => {
    const { ads, t0 } = await facade({ units: 0, unitsSinceAd: 0, playSinceAd: 0 });
    // a daily first: neither consent nor an ad
    await ads.onUnitComplete({ track: "gentle", daily: true, playSeconds: 90, dailyStreak: 1 });
    await ads.beforeNextBoard({ daily: true });
    expect(fake.gatherConsent).not.toHaveBeenCalled();
    // the first track board → consent at its between-boards moment (the form was shown)
    fake.gatherConsent.mockImplementationOnce(async () => true);
    expect(await ads.beforeNextBoard({ ...trackUnit, playSeconds: 300 })).toBe(false);
    expect(fake.gatherConsent).toHaveBeenCalledOnce();
    // units 2..5: long play, well past the 90 s cooldown — still the grace, never an interstitial
    for (let k = 2; k <= 5; k++) {
      vi.setSystemTime(t0 + k * 10 * MIN);
      expect(await ads.beforeNextBoard({ ...trackUnit, playSeconds: 300 })).toBe(false);
    }
    expect(fake.showInterstitial).not.toHaveBeenCalled();
    // unit 6: the grace is over
    vi.setSystemTime(t0 + 60 * MIN);
    expect(await ads.beforeNextBoard({ ...trackUnit, playSeconds: 300 })).toBe(true);
    expect(fake.showInterstitial).toHaveBeenCalledOnce();
  });

  it("before the first completed track unit: no consent UI", async () => {
    const { ads } = await facade({ units: 0, unitsSinceAd: 0, playSinceAd: 0 });
    expect(await ads.beforeNextBoard()).toBe(false);
    expect(fake.gatherConsent).not.toHaveBeenCalled();
  });

  it("waits out the 400 ms accidental-click guard after the last tap", async () => {
    const { ads, MIN_AFTER_INPUT_MS } = await facade();
    vi.useFakeTimers({ now: Date.now() });
    await ads.onUnitComplete(trackUnit);
    const t = Date.now();
    let shown: boolean | null = null;
    void ads.beforeNextBoard({ lastInputAt: t - 100 }).then((v) => (shown = v));
    await vi.advanceTimersByTimeAsync(MIN_AFTER_INPUT_MS - 150);
    expect(fake.showInterstitial).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    expect(shown).toBe(true);
  });

  it("full-screen listeners bracket the ad; the break flow and the 2nd ad of the day", async () => {
    const { ads } = await facade({ dayInterstitials: 1 });
    const seen: boolean[] = [];
    ads.onFullscreen((o) => seen.push(o));
    await ads.onUnitComplete(trackUnit);
    await ads.beforeNextBoard();
    expect(seen).toEqual([true, false]);
    expect(ads.offerBreak()).toBe(true);
    fake.showRewarded.mockResolvedValue(true);
    expect(await ads.watchBreak()).toBe(true);
    expect(ads.breakActiveUntil()).toBeGreaterThan(Date.now() + 29 * MIN);
    expect(seen).toEqual([true, false, true, false]);
  });

  it("a flow that never settles releases the queue after SERIAL_MAX_MS", async () => {
    const m = await facade({ dayInterstitials: 1 });
    const { ads, SERIAL_MAX_MS } = m;
    await ads.onUnitComplete(trackUnit);
    await ads.beforeNextBoard();
    expect(ads.offerBreak()).toBe(true);
    vi.useFakeTimers();
    fake.showRewarded.mockReturnValue(new Promise(() => undefined));
    void ads.watchBreak();
    let next = false;
    void ads.onUnitComplete(trackUnit).then(() => (next = true));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(next).toBe(false);
    await vi.advanceTimersByTimeAsync(SERIAL_MAX_MS);
    expect(next).toBe(true);
  });

  it("U's flow: the unit rides on beforeNextBoard's ctx and is recorded there", async () => {
    const { ads } = await facade({ unitsSinceAd: 1, playSinceAd: 100 });
    expect(await ads.beforeNextBoard({ ...trackUnit, tapped: true, lastInputAt: 0, stillAtBreak: () => true })).toBe(true);
    // daily ctx: recorded as daily, never an ad
    expect(await ads.beforeNextBoard({ track: "gentle", daily: true, playSeconds: 90 })).toBe(false);
  });

  it("breakConfirm: localized copy only while the break may be offered; gift until", async () => {
    const { ads } = await facade({ dayInterstitials: 1 });
    expect(ads.breakConfirm("ko")).toBeNull();
    await ads.onUnitComplete(trackUnit);
    await ads.beforeNextBoard();
    expect(ads.breakConfirm("ko-KR")).toMatchObject({ yes: "광고 보기", no: "다음에" });
    expect(ads.breakConfirm(["fr-CA"])?.text).toContain("30 minutes");
    ads.declineBreak();
    expect(ads.breakConfirm("en")).toBeNull();
    expect(ads.giftActiveUntil()).toBe(0);
    await ads.onUnitComplete({ track: "gentle", daily: true, playSeconds: 90, dailyStreak: 7, dailyDate: "2026-10-16" });
    expect(ads.giftActiveUntil()).toBeGreaterThan(Date.now() + 59 * MIN);
  });

  it("mute: saved setting at init, then every toggle reaches the provider", async () => {
    const { ads } = await facade({}, { muted: "1" });
    expect(fake.setMuted).toHaveBeenCalledWith(true);
    ads.setMuted(false);
    expect(fake.setMuted).toHaveBeenLastCalledWith(false);
  });

  it("privacy options: entry point only when UMP requires it; the form runs through the provider", async () => {
    const { ads } = await facade();
    expect(ads.privacyOptionsRequired()).toBe(false);
    fake.privacyRequired = true;
    expect(ads.privacyOptionsRequired()).toBe(true);
    await ads.showPrivacyOptions();
    expect(fake.showPrivacyOptions).toHaveBeenCalledOnce();
  });
});

describe("ads facade B: banner state machine (flag ON via remote config)", () => {
  afterEach(() => {
    vi.doUnmock("@capacitor/core");
    vi.doUnmock("@capacitor/app");
    vi.doUnmock("@capacitor/preferences");
    vi.doUnmock("../AdMobAds.ts");
  });

  it("track only, never re-requested while visible, hidden for the daily, back after a break", async () => {
    fake.showBanner.mockClear();
    fake.hideBanner.mockClear();
    const { ads } = await facade({ bannerHoldout: false, dayInterstitials: 1 });
    ads.applyRemoteConfig({ flags: { banner: true } });
    expect(fake.showBanner).not.toHaveBeenCalled(); // screen "none"
    ads.setScreen("track");
    ads.setScreen("settings");
    ads.setScreen("track");
    expect(fake.showBanner).toHaveBeenCalledTimes(2);
    expect(fake.hideBanner).toHaveBeenCalledTimes(1);
    ads.applyRemoteConfig({ flags: { banner: true } }); // same state: no re-request
    expect(fake.showBanner).toHaveBeenCalledTimes(2);
    ads.setScreen("daily");
    expect(fake.hideBanner).toHaveBeenCalledTimes(2);
    // a break hides it and a timer restores it when the break ends
    ads.setScreen("track");
    await ads.onUnitComplete(trackUnit);
    await ads.beforeNextBoard();
    fake.showRewarded.mockResolvedValue(true);
    vi.useFakeTimers({ now: Date.now() });
    await ads.watchBreak();
    expect(fake.hideBanner).toHaveBeenCalledTimes(3);
    const before = fake.showBanner.mock.calls.length;
    await vi.advanceTimersByTimeAsync(30 * MIN + 1000);
    expect(fake.showBanner.mock.calls.length).toBe(before + 1);
  });

  it("holdout installs never get it", async () => {
    fake.showBanner.mockClear();
    const { ads } = await facade({ bannerHoldout: true });
    ads.applyRemoteConfig({ flags: { banner: true } });
    ads.setScreen("track");
    expect(fake.showBanner).not.toHaveBeenCalled();
  });
});

describe("ads facade B: remote config (GitHub Pages JSON, ./remote.ts)", () => {
  beforeEach(() => {
    for (const f of Object.values(fake)) if (typeof f === "function") f.mockClear();
    fake.gatherConsent.mockImplementation(async () => false);
  });
  afterEach(() => {
    vi.doUnmock("@capacitor/core");
    vi.doUnmock("@capacitor/app");
    vi.doUnmock("@capacitor/preferences");
    vi.doUnmock("../AdMobAds.ts");
  });
  const cache = (cfg: unknown): Record<string, string> => ({ "ads.remote.v1": JSON.stringify(cfg) });

  it("offline with no cache: built-in defaults (banner stays OFF)", async () => {
    const { ads } = await facade({ bannerHoldout: false });
    ads.setScreen("track");
    expect(fake.showBanner).not.toHaveBeenCalled();
  });

  it("the copy cached on an earlier launch is applied on the next launch, even offline", async () => {
    const { ads } = await facade({ bannerHoldout: false }, cache({ flags: { banner: true } }));
    ads.setScreen("track");
    expect(fake.showBanner).toHaveBeenCalledTimes(1);
  });

  it("a fresh fetch applies once it lands", async () => {
    const ok = async (): Promise<Response> => new Response(JSON.stringify({ flags: { banner: true } }));
    const { ads } = await facade({ bannerHoldout: false }, {}, ok);
    await tick();
    ads.setScreen("track");
    expect(fake.showBanner).toHaveBeenCalledTimes(1);
  });

  it("out-of-range remote rules are clamped: grace and pacing floors hold, the daily never shows", async () => {
    const wild = { rules: { graceUnits: 0, unitsBetween: 0, playSecondsBetween: 0, resumeQuietMs: 0, afterFullscreenMs: 0 } };
    const { ads } = await facade({ units: 4 }, cache(wild)); // pacing met: only the grace floor blocks
    expect(await ads.beforeNextBoard({ ...trackUnit, playSeconds: 1 })).toBe(false); // unit 5 ≤ grace 5
    expect(fake.showInterstitial).not.toHaveBeenCalled();
    expect(await ads.beforeNextBoard({ track: "daily", daily: true, playSeconds: 900, dailyStreak: 1 })).toBe(false);
    expect(fake.showInterstitial).not.toHaveBeenCalled();
  });
});
