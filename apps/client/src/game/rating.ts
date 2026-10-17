// R2 (decision A2, docs/team/r1-aso.md §4.1): WHEN the game hands iOS its rating sheet. Pure policy
// (ratingVerdict, unit-tested) + a tiny session / persistence wrapper (`rating`). The sheet itself is
// Apple's (src/native/review.ts → AppStore.requestReview); there is no custom "do you like it?" first
// (App Review 5.6.1).
//
// Ask ONLY at three happy moments:
//   · "dailySparkle" — a counted daily finished with ✨ (no hints), once its result sheet is closed
//   · "house5" / "house10" — the 5th / 10th house's finale (the street visit), once the next board is in
//   · "days7" — the 7th counted day in total (cumulative, not a streak), same moment as dailySparkle
// Never: in the first session; in a session that had a hint, a dead end, an ad (interstitial or
// rewarded), or another prompt (ATT / consent / notifications / our own cards); twice in a session;
// sooner than 60 days after our last ask; more than 3 times in 365 days (Apple's cap, kept ourselves
// too). The system may still show nothing — we count our ASKS, not shows.
import { Preferences } from "@capacitor/preferences";
import { sessionCount } from "./feedback.ts";

export type HappyMoment = "dailySparkle" | "house5" | "house10" | "days7";
const MOMENTS: ReadonlySet<string> = new Set<HappyMoment>(["dailySparkle", "house5", "house10", "days7"]);

export const RATING_RULES = {
  /** sessions before the first possible ask (session numbers start at 1) */
  minSession: 2,
  /** days between two of our asks */
  gapDays: 60,
  /** asks in any 365 days */
  maxPerYear: 3,
} as const;

const DAY = 86_400_000;

/** Persisted (Preferences "rating"): when we asked (epoch ms, oldest first). */
export interface RatingState {
  v: 1;
  asks: number[];
}

/** What happened in THIS session (reset when a new session starts). */
export interface SessionMarks {
  session: number;
  hint: boolean;
  deadEnd: boolean;
  ad: boolean;
  prompt: boolean;
  asked: boolean;
}

export type Verdict = "ask" | "not-a-moment" | "first-session" | "asked" | "hint" | "dead-end" | "ad" | "prompt" | "spacing" | "yearly-cap";

export const emptyRating = (): RatingState => ({ v: 1, asks: [] });

/** The whole rule set, in order of the first reason that says no. Pure. */
export function ratingVerdict(st: RatingState, moment: string, m: SessionMarks, now: number): Verdict {
  if (!MOMENTS.has(moment)) return "not-a-moment";
  if (m.session < RATING_RULES.minSession) return "first-session";
  if (m.asked) return "asked";
  if (m.hint) return "hint";
  if (m.deadEnd) return "dead-end";
  if (m.ad) return "ad";
  if (m.prompt) return "prompt";
  const last = st.asks.length ? st.asks[st.asks.length - 1]! : -Infinity;
  if (now - last < RATING_RULES.gapDays * DAY) return "spacing";
  if (st.asks.filter((t) => now - t < 365 * DAY).length >= RATING_RULES.maxPerYear) return "yearly-cap";
  return "ask";
}

/** The daily's moment: the 7th counted day wins; else a counted ✨ daily; else none. */
export function dailyMoment(o: { counted: boolean; hints: number; countedDays: number }): HappyMoment | null {
  if (!o.counted) return null;
  if (o.countedDays === 7) return "days7";
  return o.hints === 0 ? "dailySparkle" : null;
}

/** The house finale's moment (gentle 5 / 10 only). */
export function houseMoment(n: number): HappyMoment | null {
  return n === 5 ? "house5" : n === 10 ? "house10" : null;
}

/** Parse the stored state (anything odd → empty; asks sorted, finite, in the past or now). */
export function parseRating(raw: string | null | undefined, now: number): RatingState {
  try {
    const o = JSON.parse(raw ?? "") as Partial<RatingState>;
    const asks = Array.isArray(o.asks) ? o.asks.filter((t): t is number => typeof t === "number" && Number.isFinite(t) && t <= now + DAY).sort((a, b) => a - b) : [];
    return { v: 1, asks: asks.slice(-12) };
  } catch {
    return emptyRating();
  }
}

// ---------------------------------------------------------------- the session's marks + persistence

const marks: SessionMarks = { session: 0, hint: false, deadEnd: false, ad: false, prompt: false, asked: false };

function fresh(): SessionMarks {
  const n = sessionCount();
  if (marks.session !== n) Object.assign(marks, { session: n, hint: false, deadEnd: false, ad: false, prompt: false, asked: false });
  return marks;
}

let busy = false;

// the ads layer's consent / ATT flow says when it showed a prompt (src/ads/AdMobAds.ts gatherConsent)
globalThis.addEventListener?.("duskwick:prompt", () => {
  fresh().prompt = true;
});

export const rating = {
  noteHint(): void {
    fresh().hint = true;
  },
  noteDeadEnd(): void {
    fresh().deadEnd = true;
  },
  noteAd(): void {
    fresh().ad = true;
  },
  notePrompt(): void {
    fresh().prompt = true;
  },
  /** tests / logs */
  get marks(): Readonly<SessionMarks> {
    return { ...fresh() };
  },
  /** A happy moment happened: ask iOS for its sheet when every rule allows. Never rejects. */
  async moment(moment: HappyMoment | null, now = Date.now()): Promise<Verdict> {
    if (!moment) return "not-a-moment";
    const m = fresh();
    if (busy) return "asked";
    busy = true;
    try {
      let st = emptyRating();
      try {
        st = parseRating((await Preferences.get({ key: "rating" })).value, now);
      } catch {
        /* unreadable: the empty state (session / spacing rules still hold within the session) */
      }
      const v = ratingVerdict(st, moment, m, now);
      console.info(`[rating] ${moment}: ${v}`);
      if (v !== "ask") return v;
      m.asked = true;
      st.asks.push(now);
      await Preferences.set({ key: "rating", value: JSON.stringify(st) }).catch(() => undefined);
      const { requestReview } = await import("../native/review.ts");
      await requestReview(moment);
      return v;
    } finally {
      busy = false;
    }
  },
};
