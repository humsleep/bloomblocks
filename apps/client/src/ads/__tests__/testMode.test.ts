// Test vs real ads is decided by the NATIVE build kind (AdAudio.buildKind), never by the web MODE
// (the App Store archive is built with --mode m1 too). Fail-safe: anything but release=true → test.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("adsAreTest decision table", () => {
  it.each([
    // testing, release, → test ads?
    [false, true, false], // the only real-ads case: native Release + config.testing false
    [true, true, true], // config forces test
    [false, false, true], // Debug / Measure / simulator
    [true, false, true],
    [false, null, true], // unknown / native error / web
    [true, null, true],
  ] as const)("testing=%s release=%s → test=%s", async (testing, release, test) => {
    const { adsAreTest } = await import("../AdMobAds.ts");
    expect(adsAreTest(testing, release)).toBe(test);
  });
});

describe("isReleaseBuild (native bridge)", () => {
  const plat = { v: "ios" };
  const bk = vi.fn<() => Promise<{ release: boolean }>>();
  beforeEach(() => {
    vi.resetModules();
    plat.v = "ios";
    bk.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.doMock("@capacitor/core", () => ({
      Capacitor: { getPlatform: () => plat.v },
      registerPlugin: () => ({ buildKind: bk, configure: async () => ({}) }),
    }));
  });
  afterEach(() => {
    vi.doUnmock("@capacitor/core");
    vi.restoreAllMocks();
  });

  it("native release=true → true; release=false → false", async () => {
    const { isReleaseBuild } = await import("../../native/adAudio.ts");
    bk.mockResolvedValueOnce({ release: true });
    expect(await isReleaseBuild()).toBe(true);
    bk.mockResolvedValueOnce({ release: false });
    expect(await isReleaseBuild()).toBe(false);
  });
  it("native error (e.g. older shell) → false, logged", async () => {
    const { isReleaseBuild } = await import("../../native/adAudio.ts");
    bk.mockRejectedValueOnce(new Error("not implemented"));
    expect(await isReleaseBuild()).toBe(false);
    expect(console.warn).toHaveBeenCalled();
  });
  it("web → false without touching native", async () => {
    plat.v = "web";
    const { isReleaseBuild } = await import("../../native/adAudio.ts");
    expect(await isReleaseBuild()).toBe(false);
    expect(bk).not.toHaveBeenCalled();
  });
});

describe("AdMobAds: no ad request before the build kind is known", () => {
  const calls: string[] = [];
  let resolveKind!: (v: boolean) => void;
  let kind: Promise<boolean>;
  const req = { interstitial: [] as boolean[], init: [] as boolean[], reward: [] as boolean[], banner: [] as boolean[] };

  beforeEach(() => {
    vi.resetModules();
    calls.length = 0;
    req.interstitial = [];
    req.init = [];
    req.reward = [];
    req.banner = [];
    kind = new Promise<boolean>((r) => (resolveKind = r));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.doMock("../../native/adAudio.ts", () => ({
      configureAdAudio: async () => true,
      isReleaseBuild: () => {
        calls.push("kind");
        return kind;
      },
    }));
    vi.doMock("@capacitor-community/admob", () => ({
      AdMob: {
        addListener: async () => ({ remove: async () => undefined }),
        requestConsentInfo: async () => ({ status: "NOT_REQUIRED", isConsentFormAvailable: false, canRequestAds: true }),
        trackingAuthorizationStatus: async () => ({ status: "authorized" }),
        initialize: async (o: { initializeForTesting: boolean }) => void req.init.push(o.initializeForTesting),
        prepareInterstitial: async (o: { isTesting: boolean }) => void req.interstitial.push(o.isTesting),
        prepareRewardVideoAd: async (o: { isTesting: boolean }) => void req.reward.push(o.isTesting),
        showBanner: async (o: { isTesting: boolean }) => void req.banner.push(o.isTesting),
        setApplicationMuted: async () => undefined,
      },
      AdmobConsentStatus: { REQUIRED: "REQUIRED", OBTAINED: "OBTAINED", NOT_REQUIRED: "NOT_REQUIRED" },
      BannerAdPosition: {},
      BannerAdPluginEvents: {},
      BannerAdSize: {},
      MaxAdContentRating: { ParentalGuidance: "ParentalGuidance" },
      InterstitialAdPluginEvents: {},
      RewardAdPluginEvents: {},
    }));
  });
  afterEach(() => {
    vi.doUnmock("../../native/adAudio.ts");
    vi.doUnmock("@capacitor-community/admob");
    vi.restoreAllMocks();
  });

  const flush = async (): Promise<void> => {
    for (let i = 0; i < 30; i++) await Promise.resolve();
  };

  it("holds initialize / interstitial / rewarded / banner until resolved, then uses the answer", async () => {
    const { AdMobAds } = await import("../AdMobAds.ts");
    const a = new AdMobAds();
    const initDone = a.init();
    await flush();
    expect(calls).toEqual(["kind"]);
    // callers poke the provider while the kind is pending: nothing may reach the SDK
    a.prepareRewarded();
    await a.showBanner();
    a.isInterstitialReady();
    await flush();
    expect(req).toEqual({ interstitial: [], init: [], reward: [], banner: [] });

    resolveKind(true);
    await initDone;
    await flush();
    expect(req.init).toEqual([false]); // real ads: release && testing false
    expect(req.interstitial).toEqual([false]);
    a.prepareRewarded();
    await a.showBanner();
    expect(req.reward).toEqual([false]);
    expect(req.banner).toEqual([false]);
  });

  it("release=false (Debug / Measure / simulator) → every request is a test request", async () => {
    resolveKind(false);
    const { AdMobAds } = await import("../AdMobAds.ts");
    const a = new AdMobAds();
    await a.init();
    await flush();
    a.prepareRewarded();
    await a.showBanner();
    expect([...req.init, ...req.interstitial, ...req.reward, ...req.banner]).toEqual([true, true, true, true]);
  });
});
