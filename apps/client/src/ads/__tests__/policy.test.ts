import { describe, expect, it } from "vitest";
import * as P from "../policy.ts";

const T0 = new Date(2026, 9, 14, 9, 0, 0).getTime(); // local 09:00, far from midnight
const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const unit = (playSeconds = 90, track = "gentle"): P.UnitResult => ({ track, daily: false, playSeconds });
const daily = (dailyStreak: number): P.UnitResult => ({ track: "daily", daily: true, playSeconds: 120, dailyStreak });
const ON = { banner: true };

/** Plays units back to back from a session that started 1 h earlier (resume-quiet long over). */
function sim(opts: { start?: P.AdState; units: number; play?: number; gapMs?: number; t0?: number; rules?: P.Rules; session?: P.AdSession }) {
  let now = opts.t0 ?? T0;
  const r = opts.rules ?? P.RULES;
  let state = opts.start ?? P.initialState(now - 3 * DAY, 0.9);
  let session = opts.session ?? P.newSession(now - 3 * MIN);
  const shownAt: number[] = [];
  const verdicts: P.Verdict[] = [];
  for (let i = 0; i < opts.units; i++) {
    const u = unit(opts.play ?? 90);
    now += opts.gapMs ?? (opts.play ?? 90) * 1000;
    ({ state, session } = P.recordUnit(state, session, u, now, r));
    const v = P.interstitialVerdict(state, session, u, now, r);
    verdicts.push(v);
    if (v === "show") {
      ({ state, session } = P.recordInterstitial(state, session, now, r));
      shownAt.push(i + 1);
    }
  }
  return { state, session, shownAt, verdicts, now };
}

describe("ads policy B: interstitial pacing", () => {
  it("5-unit grace, then 2 units AND 240 s of play", () => {
    const r = sim({ units: 12, play: 130 });
    expect(r.verdicts.slice(0, 5)).toEqual(["grace", "grace", "grace", "grace", "grace"]);
    expect(r.shownAt[0]).toBe(6);
    // 2 units = 260 s ≥ 240 → every 2nd unit (until the session cap)
    expect(r.shownAt.slice(0, 2)).toEqual([6, 8]);
  });

  it("two short units are not enough: needs >= 240 s of real play", () => {
    const r = sim({ units: 14, play: 90 }); // 90 s units: 2 units = 180 s < 240
    expect(r.shownAt[0]).toBe(6);
    expect(r.verdicts[6]).toBe("pacing-units"); // unit 7
    expect(r.verdicts[7]).toBe("pacing-play"); // unit 8: 2 units, 180 s
    expect(r.shownAt[1]).toBe(9); // 3 units, 270 s
  });

  it("<= 2 per session, 3 once the session is >= 10 min old", () => {
    const short = sim({ units: 20, play: 250, gapMs: 15_000, session: P.newSession(T0 - 2.5 * MIN) }); // fast clock: < 10 min
    expect(short.shownAt.length).toBe(2);
    expect(short.verdicts.at(-1)).toBe("session-cap");
    const long = sim({ units: 30, play: 250 }); // 250 s per unit → the session passes 10 min
    expect(long.shownAt.length).toBe(3);
    expect(long.verdicts.at(-1)).toBe("session-cap");
  });

  it("<= 10 per local day across sessions", () => {
    let now = T0;
    let state = P.initialState(now - 3 * DAY, 0.9);
    let shown = 0;
    for (let s = 0; s < 12; s++) {
      let session = P.newSession(now);
      now += 3 * MIN; // past resume-quiet
      for (let i = 0; i < 12; i++) {
        now += 250_000;
        const u = unit(250);
        ({ state, session } = P.recordUnit(state, session, u, now));
        if (P.interstitialVerdict(state, session, u, now) === "show") {
          ({ state, session } = P.recordInterstitial(state, session, now));
          shown++;
        }
      }
      now += 31 * MIN;
      if (P.dayKey(now) !== P.dayKey(T0)) break;
    }
    expect(shown).toBe(10);
    expect(state.dayInterstitials).toBe(10);
  });

  it("day counters roll over at local midnight", () => {
    const s = { ...P.initialState(T0, 0.5), dayInterstitials: 10, dayBreakOffered: true };
    const next = P.rollDay(s, T0 + DAY);
    expect(next.dayInterstitials).toBe(0);
    expect(next.dayBreakOffered).toBe(false);
  });

  it("120 s quiet after the app came to the foreground (cold launch and resume >= 30 s)", () => {
    const st = { ...P.initialState(T0 - 3 * DAY, 0.9), units: 40, unitsSinceAd: 4, playSinceAd: 900 };
    const cold = P.newSession(T0);
    expect(P.interstitialVerdict(st, cold, unit(), T0 + 119_000)).toBe("resume-quiet");
    expect(P.interstitialVerdict(st, cold, unit(), T0 + 121_000)).toBe("show");
    const back = P.onResume(cold, 45_000, T0 + 10 * MIN);
    expect(P.interstitialVerdict(st, back, unit(), T0 + 11 * MIN)).toBe("resume-quiet");
    expect(P.interstitialVerdict(st, back, unit(), T0 + 12 * MIN + 1000)).toBe("show");
    // a glance at the notification shade (< 30 s) does not restart the window
    const glance = P.onResume(cold, 10_000, T0 + 10 * MIN);
    expect(P.interstitialVerdict(st, glance, unit(), T0 + 10 * MIN + 5000)).toBe("show");
  });

  it("90 s cooldown after another full-screen ad / consent form", () => {
    const st = P.recordFullscreen({ ...P.initialState(T0 - 3 * DAY, 0.9), units: 40, unitsSinceAd: 4, playSinceAd: 900 }, T0);
    const ses = P.newSession(T0 - 10 * MIN);
    expect(P.interstitialVerdict(st, ses, unit(), T0 + 89_000)).toBe("cooldown");
    expect(P.interstitialVerdict(st, ses, unit(), T0 + 91_000)).toBe("show");
  });

  it("never in the daily, never at the break right after a daily; daily units do not count", () => {
    let state = { ...P.initialState(T0 - 3 * DAY, 0.9), units: 40, unitsSinceAd: 4, playSinceAd: 900 };
    let session = P.newSession(T0 - 10 * MIN);
    for (let i = 0; i < 5; i++) {
      const u = daily(i + 1);
      ({ state, session } = P.recordUnit(state, session, u, T0 + i * MIN));
      expect(P.interstitialVerdict(state, session, u, T0 + i * MIN)).toBe("daily");
      // the between-boards slot after it (caller passes daily: false by mistake) is still closed
      expect(P.interstitialVerdict(state, session, { daily: false }, T0 + i * MIN)).toBe("daily");
    }
    expect(state.units).toBe(40);
    expect(state.unitsSinceAd).toBe(4);
    ({ state, session } = P.recordUnit(state, session, unit(), T0 + 10 * MIN));
    expect(P.interstitialVerdict(state, session, unit(), T0 + 10 * MIN)).toBe("show");
  });

  it("pacing survives an app restart (state is persisted, session is not)", () => {
    const r = sim({ units: 7, play: 130 }); // ad at 6, one unit since
    const revived = P.reviveState(JSON.parse(JSON.stringify(r.state)), r.now, 0.5);
    expect(revived.unitsSinceAd).toBe(1);
    expect(revived.playSinceAd).toBe(130);
    expect(revived.lastFullscreenAt).toBe(r.state.lastFullscreenAt);
  });

  it("a long background gap starts a new session; a short one does not", () => {
    const s = { ...P.newSession(T0), interstitials: 2 };
    expect(P.onResume(s, 5 * MIN, T0 + 5 * MIN).interstitials).toBe(2);
    expect(P.onResume(s, 31 * MIN, T0 + 31 * MIN).interstitials).toBe(0);
  });
});

describe("ads policy B: remote config can never break the floors", () => {
  it("unitsBetween stays >= 2 whatever the remote says", () => {
    for (const bad of [0, 1, -5, 1.9, Number.NaN, "1", null, Infinity]) {
      expect(P.resolveRules({ unitsBetween: bad }).unitsBetween).toBeGreaterThanOrEqual(2);
    }
    // even a hand-built rules object below the floor cannot make "every unit"
    const r = sim({ units: 10, play: 300, rules: { ...P.RULES, unitsBetween: 1, playSecondsBetween: 0, perSession: 9, perDay: 99 } });
    for (let i = 1; i < r.shownAt.length; i++) expect(r.shownAt[i]! - r.shownAt[i - 1]!).toBeGreaterThanOrEqual(2);
  });

  it("consent from the 1st non-daily unit (floor 1), independent of the interstitial grace", () => {
    const s0 = P.initialState(T0, 0.9);
    expect(P.consentAllowed(s0)).toBe(false); // board 1 is never interrupted
    let state = s0;
    let session = P.newSession(T0 - 10 * MIN);
    ({ state, session } = P.recordUnit(state, session, { track: "gentle", daily: true, playSeconds: 90 }, T0, P.RULES));
    expect(P.consentAllowed(state)).toBe(false); // the daily does not count
    ({ state, session } = P.recordUnit(state, session, { track: "gentle", daily: false, playSeconds: 600 }, T0 + MIN, P.RULES));
    expect(P.consentAllowed(state)).toBe(true);
    expect(P.interstitialVerdict(state, session, { daily: false }, T0 + 10 * MIN, P.RULES)).toBe("grace");
    // the consent form starts the full-screen cooldown
    const after = P.recordFullscreen({ ...state, units: 9, unitsSinceAd: 9, playSinceAd: 9999 }, T0 + 10 * MIN);
    expect(P.interstitialVerdict(after, session, { daily: false }, T0 + 10 * MIN + 30_000, P.RULES)).toBe("cooldown");
    // a remote value cannot move consent before the first unit
    expect(P.resolveRules({ consentAfterUnits: 0 }).consentAfterUnits).toBe(1);
    expect(P.consentAllowed(s0, { ...P.RULES, consentAfterUnits: 0 })).toBe(false);
  });

  it("clamps every number into its range and ignores junk", () => {
    const r = P.resolveRules({ playSecondsBetween: 5, perDay: 500, perSession: 9, perSessionLong: -1, graceUnits: 0, resumeQuietMs: "x", breakMs: 1 });
    expect(r.playSecondsBetween).toBe(180);
    expect(r.perDay).toBe(10);
    expect(r.perSession).toBe(3);
    expect(r.perSessionLong).toBe(3); // never below perSession
    expect(r.graceUnits).toBe(5);
    expect(r.resumeQuietMs).toBe(P.RULES.resumeQuietMs);
    expect(r.breakMs).toBe(30 * MIN); // the confirm card's promise is not remote-tunable
    expect(P.resolveRules("garbage")).toEqual(P.RULES);
    expect(P.resolveRules(undefined)).toEqual(P.RULES);
  });

  it("flags take booleans only and default OFF", () => {
    expect(P.resolveFlags({ banner: "yes", rewardKeepsake: 1 })).toEqual(P.FLAGS);
    expect(P.resolveFlags({ banner: true }).banner).toBe(true);
    expect(P.FLAGS).toEqual({ banner: false, rewardKeepsake: false, rewardArchive: false });
    expect("appOpen" in P.FLAGS).toBe(false);
  });
});

describe("ads policy B: 30-min break (rewarded)", () => {
  it("offered once per day, right after the day's 2nd interstitial, only on that moment", () => {
    const r = sim({ units: 8, play: 130 }); // ads at 6 and 8
    expect(r.state.dayInterstitials).toBe(2);
    expect(P.shouldOfferBreak(r.state, r.session, r.now)).toBe(true);
    const next = P.recordUnit(r.state, r.session, unit(), r.now + 90_000);
    expect(P.shouldOfferBreak(next.state, next.session, r.now + 90_000)).toBe(false);
    let { state, session } = P.recordInterstitial(next.state, P.newSession(r.now), r.now + 100_000);
    ({ state, session } = P.recordInterstitial(state, session, r.now + 200_000));
    expect(P.shouldOfferBreak(state, session, r.now + 200_000)).toBe(false);
  });

  it("watching grants 30 min without interstitials (and starts the 90 s cooldown after)", () => {
    const r = sim({ units: 8, play: 130 });
    const g = P.grantBreak(r.state, r.session, r.now);
    expect(g.state.lastFullscreenAt).toBe(r.now);
    expect(P.breakActive(g.state, r.now + 29 * MIN)).toBe(true);
    let { state, session } = g;
    let now = r.now;
    for (let i = 0; i < 6; i++) {
      now += 4 * MIN;
      const u = unit(240);
      ({ state, session } = P.recordUnit(state, session, u, now));
      expect(P.interstitialVerdict(state, session, u, now)).toBe("break");
    }
    now = r.now + 31 * MIN;
    const u = unit(240);
    ({ state, session } = P.recordUnit(state, session, u, now));
    expect(P.interstitialVerdict(state, P.newSession(now - 3 * MIN), u, now)).toBe("show");
  });

  it("a clock moved backwards cannot extend a stored break or cooldown", () => {
    const s = { ...P.initialState(T0, 0.5), breakUntil: T0 + 10 * DAY, lastFullscreenAt: T0 + 10 * DAY };
    const v = P.reviveState(s, T0, 0.5);
    expect(v.breakUntil).toBe(T0 + 30 * MIN);
    expect(v.lastFullscreenAt).toBe(T0);
  });
});

describe("ads policy B: 7-day daily streak gift", () => {
  it("every 7th consecutive daily → 1 h without interstitials, once per daily date", () => {
    const r = sim({ units: 6, play: 130 });
    let { state, session } = P.recordUnit(r.state, r.session, daily(6), r.now);
    expect(P.giftActive(state, r.now)).toBe(false);
    ({ state, session } = P.recordUnit(state, session, daily(7), r.now));
    expect(P.giftActive(state, r.now + 59 * MIN)).toBe(true);
    expect(P.giftActive(state, r.now + 61 * MIN)).toBe(false);
    const u = unit(300);
    ({ state, session } = P.recordUnit(state, session, u, r.now + 5 * MIN));
    ({ state, session } = P.recordUnit(state, session, u, r.now + 10 * MIN));
    expect(P.interstitialVerdict(state, session, u, r.now + 10 * MIN)).toBe("gift");
    const again = P.recordUnit({ ...state, giftUntil: 0 }, session, daily(14), r.now + 11 * MIN);
    expect(again.state.giftUntil).toBe(0);
    expect(P.recordUnit(state, session, daily(14), r.now + DAY).state.giftUntil).toBeGreaterThan(r.now + DAY);
  });

  it("a daily finished after midnight (not counted) never grants the gift a second time", () => {
    const r = sim({ units: 6, play: 130 });
    const d7 = { track: "daily", daily: true, playSeconds: 120, dailyStreak: 7, dailyDate: "2026-10-14" };
    let { state, session } = P.recordUnit(r.state, r.session, d7, r.now);
    expect(P.giftActive(state, r.now)).toBe(true);
    const later = r.now + 25 * 60 * MIN;
    ({ state, session } = P.recordUnit({ ...state, giftUntil: 0 }, session, { ...d7, counted: false }, later));
    expect(state.giftUntil).toBe(0);
    ({ state, session } = P.recordUnit(state, session, d7, later));
    expect(state.giftUntil).toBe(0);
    ({ state } = P.recordUnit(state, session, { ...d7, dailyStreak: 14, dailyDate: "2026-10-21" }, later));
    expect(P.giftActive(state, later)).toBe(true);
  });
});

describe("ads policy B: banner (B+, flag OFF)", () => {
  const vet = (rand = 0.9) => ({ ...P.initialState(T0 - 3 * DAY, rand), units: 20 });

  it("OFF by default everywhere", () => {
    expect(P.bannerAllowed(vet(), T0, true, "track")).toBe(false);
  });

  it("with the flag: track boards only — never daily / town / settings / result / guide", () => {
    expect(P.bannerAllowed(vet(), T0, true, "track", ON)).toBe(true);
    for (const s of ["daily", "town", "settings", "result", "guide", "none"] as const) expect(P.bannerAllowed(vet(), T0, true, s, ON)).toBe(false);
  });

  it("holdout (~50 %, fixed at install), install day, grace, ATT, break and gift all block it", () => {
    expect(P.initialState(T0, 0.4).bannerHoldout).toBe(true);
    expect(P.initialState(T0, 0.6).bannerHoldout).toBe(false);
    expect(P.bannerAllowed(vet(0.1), T0, true, "track", ON)).toBe(false);
    expect(P.bannerAllowed({ ...vet(), installAt: T0 - MIN }, T0, true, "track", ON)).toBe(false);
    expect(P.bannerAllowed({ ...vet(), units: 5 }, T0, true, "track", ON)).toBe(false);
    expect(P.bannerAllowed(vet(), T0, false, "track", ON)).toBe(false);
    const br = P.grantBreak(vet(), P.newSession(T0), T0).state;
    expect(P.bannerAllowed(br, T0 + MIN, true, "track", ON)).toBe(false);
    expect(P.bannerBlockEndsAt(br, T0 + MIN)).toBe(T0 + 30 * MIN);
    // after the break: allowed again (index.ts re-checks at bannerBlockEndsAt)
    expect(P.bannerAllowed(br, T0 + 30 * MIN + 1, true, "track", ON)).toBe(true);
    expect(P.bannerAllowed({ ...vet(), giftUntil: T0 + MIN }, T0, true, "track", ON)).toBe(false);
  });

  it("an old stored state gets a holdout bucket once; a stored one is kept", () => {
    const old = { ...P.initialState(T0, 0.9) } as Partial<P.AdState>;
    delete old.bannerHoldout;
    expect(P.reviveState(old, T0, 0.2).bannerHoldout).toBe(true);
    expect(P.reviveState({ ...old, bannerHoldout: false }, T0, 0.2).bannerHoldout).toBe(false);
  });
});

describe("ads policy B: storage", () => {
  it("garbage in storage falls back to a fresh install state", () => {
    expect(P.reviveState(null, T0, 0.5).units).toBe(0);
    expect(P.reviveState({ v: 2 }, T0, 0.5).installAt).toBe(T0);
    const s = P.reviveState({ v: 1, units: "x", unitsSinceAd: -3, day: 7 }, T0, 0.5);
    expect(s.units).toBe(0);
    expect(s.unitsSinceAd).toBe(0);
    expect(s.day).toBe(P.dayKey(T0));
  });
});
