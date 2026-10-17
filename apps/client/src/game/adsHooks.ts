// The UI's side of the ads contract (docs/phase2-plan.md "Ads" + "Phase 5"; agent N owns this
// file and src/ads). Launch config B: ONE interstitial slot between boards, nothing in the daily.
// UI flow (track unit):
//   result moment (finale starts)          adsApi.onUnitComplete(unit)            records only
//   old board out → [hold] → new board in  await adsApi.beforeNextBoard({ lastInputAt, stillAtBreak })
//   new board in                           adsApi.offerBreak() → moon-with-pause chip (8 s)
//   chip tap                               confirm card (src/ads/breakCard.ts) → watch: adsApi.watchBreak()
//                                          / not now or chip timeout: adsApi.declineBreak()
// Daily unit: onUnitComplete({ daily: true, … }) only. Never beforeNextBoard / chip in the daily path.
// Every call is wrapped: an ad problem never reaches the game.
import { ads, type AdScreen, type BoardBreak } from "../ads/index.ts";

export type { AdScreen, BoardBreak };
export { BREAK_CARD, breakCardText, type BreakCardText } from "../ads/breakCard.ts";

export interface UnitInfo {
  track: "gentle" | "deduce";
  daily: boolean;
  playSeconds: number;
  /** daily units: consecutive days after this completion */
  dailyStreak?: number;
  /** daily units: the daily's date, and whether the completion counted (not after its midnight) */
  dailyDate?: string;
  counted?: boolean;
  /** @deprecated ignored (pass it to beforeNextBoard instead) */
  stillAtBreak?: () => boolean;
}

let inited = false;

const guard = <T>(f: () => T, fallback: T): T => {
  try {
    return f();
  } catch (e) {
    console.warn("[ads]", e);
    return fallback;
  }
};

export const adsApi = {
  /** Once, after the first confirmed move (never on the cold-start path). */
  init(): void {
    if (inited) return;
    inited = true;
    setTimeout(() => void ads.init().catch((e: unknown) => console.warn("[ads] init", e)), 0);
  },
  /** Result moment of a finished unit (track or daily). Records pacing; shows nothing. */
  async onUnitComplete(u: UnitInfo): Promise<void> {
    if (!inited) return;
    try {
      await ads.onUnitComplete(u);
    } catch (e) {
      console.warn("[ads] unit complete", e);
    }
  },
  /**
   * The interstitial slot: after the finale's old board left, before the next TRACK board enters.
   * Hold the entry until it resolves (true = an ad was shown). Resolves at once when nothing is due.
   */
  async beforeNextBoard(ctx: BoardBreak = {}): Promise<boolean> {
    if (!inited) return false;
    try {
      return await ads.beforeNextBoard(ctx);
    } catch (e) {
      console.warn("[ads] before next board", e);
      return false;
    }
  },
  offerBreak(): boolean {
    return inited && guard(() => ads.offerBreak(), false);
  },
  async watchBreak(): Promise<boolean> {
    try {
      return await ads.watchBreak();
    } catch (e) {
      console.warn("[ads] break", e);
      return false;
    }
  },
  declineBreak(): void {
    guard(() => ads.declineBreak(), undefined);
  },
  breakActiveUntil(): number {
    return guard(() => ads.breakActiveUntil(), 0);
  },
  breakConfirm(lang?: string | readonly string[]): ReturnType<typeof ads.breakConfirm> {
    return inited ? guard(() => ads.breakConfirm(lang), null) : null;
  },
  giftActiveUntil(): number {
    return guard(() => ads.giftActiveUntil(), 0);
  },
  /** Settings: show the "privacy options" row only when true (EEA/UK/CH users; known after init). */
  privacyOptionsRequired(): boolean {
    return guard(() => ads.privacyOptionsRequired(), false);
  },
  async showPrivacyOptions(): Promise<void> {
    try {
      await ads.showPrivacyOptions();
    } catch (e) {
      console.warn("[ads] privacy options", e);
    }
  },
  /** Call on every mute toggle (the saved Preferences "muted" is read at init). */
  setMuted(muted: boolean): void {
    guard(() => ads.setMuted(muted), undefined);
  },
  /** Where the player is now; the banner (flag OFF at launch) only ever shows on "track". */
  setScreen(screen: AdScreen): void {
    guard(() => ads.setScreen(screen), undefined);
  },
  /** CSS px to keep free at the bottom (0 while no banner). B+ only. */
  onBannerHeight(cb: (px: number) => void): void {
    guard(() => ads.onBannerHeight(cb), undefined);
  },
  /** true while a full-screen ad is up: suspend game audio (and optionally the render loop). */
  onFullscreen(cb: (open: boolean) => void): () => void {
    return guard(() => ads.onFullscreen(cb), () => undefined);
  },
};
