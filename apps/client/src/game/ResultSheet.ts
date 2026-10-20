// The daily's result as a BOTTOM SHEET (phase 2, audit P1-11; replaces the old centred card,
// which covered the solved board): the scene shrinks the lit board into the space above it, so
// the player keeps looking at what they just solved.
//
//   ┌──────────────────────────────┐
//   │            ─────             │  grabber
//   │  [cal]   ⏱ 2:41  ✨          │  ✨ only when no hint was used (the share text's ✨)
//   │  [   ]   🔥 5  ◒ ◒           │  ◒ = this month's shields: the town's kept lantern — a lantern with a moon-blue bookmark ribbon (dim = used)
//   │     (share)   (home)   (moon‖)  │  moon‖ = 30-minute ad-break chip, only when offered
//   └──────────────────────────────┘
// Short screens (iPhone SE, < 720 pt): one stats row — [cal] ⏱ 2:41 ✨ · 🔥 5 ◒◒ — and tighter
// padding, so the solved board above keeps ≥ 200 pt (the two-line block comes back when the row
// does not fit, e.g. at the largest text sizes).
// Each concept appears once: the shields only beside the streak. What a shield does is shown
// wordlessly in a small bubble above them — lit · unlit · lit days, a kept lantern (ribbon) lifts off the
// shield and settles on the unlit day (the town's kept lantern) — once, the first time the
// sheet shows shields (Preferences "shieldIntro"), then the bubble fades away completely; a tap on
// the shields replays it (Reduce Motion: two still frames). Glyphs are drawn; the only text is digits. The e2e bridge reads `isOpen`, `streak.text`, `cx`/`cy` and
// `shareBtn`/`homeBtn` (positions relative to (cx, cy)) — keep those names.
// v11 (NOVICE-TEST C14 / C15 / D3): words on every number — labelled rows "Time … 0:11 ✨",
// "n-day streak … 🔥 n", "n shields left … ◒◒" beside today's tile, "This month" over the strip —
// and the primary button is now "Continue" (lantern gold, ink words); Share is the secondary one.
// Phase 5 (v2, BENCHMARK-UX #2 #7), round 2 decluttered — one calm hierarchy:
//   top row   today's tile (#n under it; tomorrow's page peeks dim behind its corner) · ⏱ time ✨ ·
//             🔥 streak ◒◒ — every digit in the Duskwick numerals (bank.numerals)
//   strip     this month's days, small and quiet (lit · covered by a shield · missed; today ringed)
//   buttons   share · home (closing it ends the evening: the scene's quiet night beat)
// A milestone day (3 · 7 · 30 · 100 · 365) / the 7-day gift (moon-with-pause + hourglass = one
// hour without ads) is a short MOMENT in the sky over the house (blooms in, ~2.5 s, fades), not a row.
// R2 (decision A5, docs/team/DECISIONS.md) — the POSTCARD: the top block is now a cream postcard
// (src/game/postcard.ts): today's house lit (the daily's own house, never the board), a perforated
// stamp with Wick, the postmark "#n · date", "✨ No hints" on the picture when true, and the
// placement-order strip (order only, no positions). The stat rows sit on the card's right column as
// Phaser objects, EACH FACT ONCE (Reality P1-14): "Time … 0:11", "Streak … 3", "Shields … ◒◒" —
// no glyph repeating a label, no number inside a label. Primary "Continue", secondary "Share"
// (the share image is the same postcard, baked only when Share is tapped).
import { shieldsPerMonthNow } from "./shieldCount.ts";
import type PhaserTypes from "phaser";
import { Preferences } from "@capacitor/preferences";
import { drawLantern, drawPanel, rrectPath } from "../render/draw.ts";
import { PAL, rgba, UI } from "../render/palette.ts";
import type { TextureBank } from "../render/textures.ts";
import { vis } from "../render/vis.ts";
import { clamp01, easeOutBack, easeOutCubic, motion } from "./motion.ts";
import { type DailyResult, dailyLink, dailyNumber, mmss } from "./pipsApi.ts";
import { drawGiftChip, drawMilestoneLantern, drawMonthDay } from "./hudArt.ts";
import type { MonthDay } from "./progress.ts";
import { a11y } from "../a11y/index.ts";
import { makeText, primaryButton, styleText, uiFont } from "./uiText.ts";
import { drawSheetCard, postcardSpec, type PostcardSpec, type PostcardWords, sheetCardGeo } from "./postcard.ts";
import type { ShareCard } from "./daily.ts";

/** What v2 adds to a result (all optional: a relaunch onto a solved daily may not know them yet). */
export interface SheetExtras {
  month?: MonthDay[];
  /** a streak milestone reached today (0 = none) */
  milestone?: number;
  /** the 7-day gift was earned today */
  gift?: boolean;
  /** R2: the move story for the postcard's strip — toggled cells in order (compared only, then dropped) */
  cells?: number[];
  /** R2: moves made before each hint */
  hintAt?: number[];
}

/** The postcard's words in the UI language (labels, the postmark date, the link line). */
export function postcardWords(dateISO: string): PostcardWords {
  const t = (k: string): string => a11y.t(k);
  const [y, m, d] = dateISO.split("-").map(Number) as [number, number, number];
  let date = dateISO.slice(5);
  try {
    date = new Intl.DateTimeFormat(a11y.lang(), { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
  } catch {
    /* keep MM-DD */
  }
  const link = dailyLink(dailyNumber(dateISO)).replace(/^https:\/\//, "").replace(/\?.*$/, "");
  return { time: t("res.time"), streak: t("res.streakLbl"), noHints: t("res.noHints"), order: t("res.order"), yourTurn: t("card.yourTurn"), date, link, font: uiFont() };
}

type Image = PhaserTypes.GameObjects.Image;
type Text = PhaserTypes.GameObjects.Text;
export type SheetHit2 = "share" | "home" | "break" | "shields" | "inside" | "outside";
type CtlId = "share" | "home" | "break" | "shields" | "postcard" | "month" | "milestone" | "gift";

/** Below this height (pt) the sheet goes compact (one stats row, tighter padding). */
const COMPACT_H = 720;
/** the shield bubble: in, the kept lantern flies (500–1200), hold, fade out (ms) */
export const SHIELD_DEMO_MS = 3200;
/** the milestone / gift moment above the sheet (ms) */
export const MOMENT_MS = 2900;

export class ResultSheet {
  readonly root: PhaserTypes.GameObjects.Container;
  private panel: Image;
  /** R2: the postcard (paper, today's house, stamp, postmark, strip), baked per day / layout */
  private cardImg: Image;
  private time: Image;
  private streak: Image;
  /** what the time / streak show (tests read `streakText`) */
  timeText = "";
  streakText = "";
  /** "#n" (empty before DAILY_EPOCH) — the postmark's number, the same as the share text's */
  numText = "";
  /** the postcard's spec (tests: the e2e pixel test reads it; it never holds the board) */
  spec: PostcardSpec | null = null;
  /** the milestone / gift moment (scene time it started; -1 = none this time) */
  private momentT0 = -1e9;
  private momentFor = "";
  private dailyN = 0;
  private result: DailyResult | null = null;
  private shields: Image[] = [];
  private shareBtn: Image;
  private shareGlyph: Image;
  /** v2: the month strip, the milestone lantern, the gift chip */
  private monthImg: Image;
  private mileImg: Image;
  private mileTxt: Image;
  private giftImg: Image;
  private extras: SheetExtras = {};
  private homeBtn: Image;
  private breakBtn: Image;
  private open = false;
  private t0 = -1e9;
  private W = 0;
  private H = 0;
  private sb = 0;
  private u = 1;
  /** rest position of the root (sheet top centre), canvas px */
  private cx = 0;
  private cy = 0;
  private h = 0;
  private breakOn = false;
  /** what the stats show (kept for a relayout) */
  private shieldsLeft = 2;
  /** the shield slots this month shows (2, or 3 from cozy level 3) */
  private get row(): Image[] {
    return this.shields.slice(0, shieldsPerMonthNow());
  }
  private dateISO = "";
  /** the postcard's box in root coordinates (VoiceOver) */
  private cardBox = { x: 0, y: 0, w: 0, h: 0 };
  // the shield explanation bubble (lit · unlit → covered · lit)
  private demo: PhaserTypes.GameObjects.Container;
  private demoBg: Image;
  private demoDays: Image[] = [];
  private demoFly: Image;
  private demoT0 = -1e9;
  private demoKeys = { lit: "__DEFAULT", dark: "__DEFAULT", covered: "__DEFAULT" };
  private introSeen: boolean | null = null;

  constructor(
    private readonly scene: PhaserTypes.Scene,
    private readonly bank: TextureBank,
    depth: number,
  ) {
    const s = scene;
    this.root = s.add.container(0, 0).setDepth(depth).setVisible(false);
    this.panel = s.add.image(0, 0, "__DEFAULT").setOrigin(0.5, 0);
    this.cardImg = s.add.image(0, 0, "__DEFAULT").setOrigin(0, 0);
    this.time = s.add.image(0, 0, "__DEFAULT").setOrigin(0, 0.5);
    this.streak = s.add.image(0, 0, "__DEFAULT").setOrigin(0, 0.5);
    // R4: a third shield slot, shown from cozy level 3 (shieldCount.ts)
    for (let k = 0; k < 3; k++) this.shields.push(s.add.image(0, 0, "__DEFAULT"));
    // v11: Share is the secondary button now (no breathe); Continue is the primary
    this.shareBtn = s.add.image(0, 0, "__DEFAULT");
    this.shareGlyph = s.add.image(0, 0, "__DEFAULT");
    this.monthImg = s.add.image(0, 0, "__DEFAULT");
    this.mileImg = s.add.image(0, 0, "__DEFAULT").setVisible(false);
    this.mileTxt = s.add.image(0, 0, "__DEFAULT").setOrigin(0, 0.5).setVisible(false);
    this.giftImg = s.add.image(0, 0, "__DEFAULT").setVisible(false);
    this.homeBtn = s.add.image(0, 0, "__DEFAULT");
    this.breakBtn = s.add.image(0, 0, "__DEFAULT").setVisible(false);
    // v11: the words (labels, button text); text objects live in the sheet's container
    const mk = (): Text => makeText(s, depth).setVisible(true);
    this.lblTime = mk();
    this.lblStreak = mk();
    this.lblShield = mk();
    this.lblMonth = mk();
    this.shareTxt = mk();
    this.homeTxt = mk();
    this.demo = s.add.container(0, 0).setVisible(false);
    this.demoBg = s.add.image(0, 0, "__DEFAULT");
    for (let k = 0; k < 3; k++) this.demoDays.push(s.add.image(0, 0, "__DEFAULT"));
    this.demo.add([this.demoBg, ...this.demoDays]);
    this.demoFly = s.add.image(0, 0, "__DEFAULT").setVisible(false);
    this.root.add([
      this.panel, this.cardImg, this.monthImg, this.mileImg, this.mileTxt, this.giftImg, this.time, this.streak, ...this.shields,
      this.shareBtn, this.shareGlyph, this.homeBtn, this.breakBtn, this.demo, this.demoFly,
      this.lblTime, this.lblStreak, this.lblShield, this.lblMonth, this.shareTxt, this.homeTxt,
    ]);
    // (the sheet can open before this answer — e.g. a relaunch straight onto a solved daily:
    // then the bubble starts as soon as the answer is in)
    const seen = (v: boolean): void => {
      this.introSeen = v;
      if (!v && this.open) this.startIntro(this.scene.time.now + 300);
    };
    void Preferences.get({ key: "shieldIntro" }).then(
      (r) => seen(r.value === "1"),
      () => seen(false),
    );
  }

  /** The first explanation of the shields (once ever). */
  private startIntro(at: number): void {
    if (this.introSeen !== false) return;
    this.introSeen = true;
    this.demoT0 = at;
    void Preferences.set({ key: "shieldIntro", value: "1" }).catch(() => undefined);
  }

  get isOpen(): boolean {
    return this.open;
  }

  /** Top of the sheet at rest (canvas px): the scene fits the board above it. */
  get top(): number {
    return this.cy;
  }

  /** Bottom sheet across the full width (its panel runs under the home indicator). */
  layout(W: number, H: number, u: number, safeBottom: number): void {
    this.W = W;
    this.H = H;
    this.u = u;
    this.sb = Math.max(safeBottom * u, 12 * u);
    this.place();
  }

  private place(): void {
    const { W, H, u } = this;
    const compact = H / u < COMPACT_H;
    const fk = Math.min(vis.p.fontScale, 1.3);
    const fs = Math.round((compact ? 24 : 27) * u * fk);
    const cap = Math.round(fs * 0.72);
    const cream = "#F4EBD0";
    const ink = UI.ink;
    const t = (k: string, v?: Record<string, string | number>): string => a11y.t(k, v);
    // R2: the values in ink on the postcard's paper (≥ 10:1)
    this.time.setTexture(this.timeText ? this.bank.numerals(this.timeText, cap, ink) : "__DEFAULT");
    this.streak.setTexture(this.streakText ? this.bank.numerals(this.streakText, cap, ink) : "__DEFAULT");
    const shS = Math.round((compact ? 28 : 32) * u);
    const shPitch = (compact ? 28 : 32) * u;
    for (let k = 0; k < this.shields.length; k++) this.shields[k]!.setTexture(this.bank.shield(shS, k < this.shieldsLeft));
    this.shields.forEach((sh, k) => sh.setVisible(k < this.row.length));
    // each fact once (Reality P1-14): the label names it, the value says it — no number in a label
    const lpt = compact ? 15 : 16;
    const lw = vis.p.boldText ? "700" : "600";
    styleText(this.lblTime, t("res.time"), { pt: lpt, u, weight: lw, color: ink, cap: 1.3 });
    styleText(this.lblStreak, t("res.streakLbl"), { pt: lpt, u, weight: lw, color: ink, cap: 1.3 });
    styleText(this.lblShield, t("res.shieldsLbl"), { pt: lpt, u, weight: lw, color: ink, cap: 1.3 });
    styleText(this.lblMonth, t("res.month"), { pt: compact ? 15 : 16, u, weight: lw, color: cream, cap: 1.3 });
    for (const l of [this.lblTime, this.lblStreak, this.lblShield, this.lblMonth]) l.setOrigin(0, 0.5);
    const grab = (compact ? 16 : 22) * u;
    const gap = (compact ? 10 : 14) * u;
    const bs = Math.round((compact ? 52 : 56) * u);
    const pad = (compact ? 10 : 16) * u;
    const rowH = Math.round(Math.max((compact ? 26 : 30) * u, this.lblStreak.displayHeight + 6 * u, cap + 6 * u));
    const numOn = this.dailyN > 0;
    this.numText = numOn ? `#${this.dailyN}` : "";
    // the postcard
    const cw = Math.round(W - 32 * u);
    const geo = sheetCardGeo(cw, rowH * 3, u, compact);
    const cardX = -cw / 2;
    const cardY = grab;
    this.cardBox = { x: cardX, y: cardY, w: cw, h: geo.h };
    if (this.result) {
      const spec = postcardSpec(this.result, this.extras.cells ?? [], this.extras.hintAt ?? [], true);
      this.spec = spec;
      const words = postcardWords(this.dateISO);
      const sig = `${spec.dateISO}:${spec.hints}:${spec.strip.map((c) => c[0]).join("")}:${a11y.lang()}`;
      this.cardImg
        .setTexture(this.bank.canvas(`postcard:${sig}@${cw}x${geo.h}x${Math.round(u * 100)}${vis.sig}`, cw, geo.h, (ctx) => drawSheetCard(ctx, geo, spec, words, u)))
        .setPosition(cardX, cardY)
        .setVisible(true);
    } else this.cardImg.setVisible(false);
    const month = this.extras.month ?? [];
    const dotS = Math.round(Math.min(11 * u, (W - 48 * u) / Math.max(28, month.length)));
    const monthLblH = this.lblMonth.displayHeight;
    const monthH = month.length ? monthLblH + 4 * u + dotS + (compact ? 6 : 10) * u : 0;
    const h = Math.round(grab + geo.h + gap * 0.8 + monthH + gap + bs + pad + this.sb);
    this.h = h;
    this.cx = Math.round(W / 2);
    this.cy = Math.round(H - h);
    const pw = Math.round(W + 4 * u);
    this.panel.setTexture(this.bank.canvas(`resultSheet@${pw}x${h}${vis.sig}`, pw, h + 30 * u, (ctx, cw2, ch) => {
      drawPanel(ctx, cw2, ch, 26 * u, u);
      if (vis.p.increaseContrast) {
        ctx.strokeStyle = rgba(PAL.moon, 0.8);
        ctx.lineWidth = 1.6 * u;
        rrectPath(ctx, 0.8 * u, 0.8 * u, cw2 - 1.6 * u, ch - 5 * u, 26 * u);
        ctx.stroke();
      }
    })).setPosition(0, 0);
    // the rows on the card's right column: label left, value right
    const rowsX = cardX + geo.rows.x;
    const right = cardX + geo.rows.x + geo.rows.w;
    const rowY = (k: number): number => cardY + geo.rows.y + rowH * k + rowH / 2;
    this.lblTime.setPosition(rowsX, rowY(0));
    this.lblStreak.setPosition(rowsX, rowY(1));
    this.lblShield.setPosition(rowsX, rowY(2));
    this.time.setPosition(right - this.time.width, rowY(0));
    this.streak.setPosition(right - this.streak.width, rowY(1));
    this.row.forEach((sh, k) => sh.setPosition(right - shS * 0.45 - (this.row.length - 1 - k) * shPitch, rowY(2) - 2 * u));
    // a label too long for its row (largest text sizes) is scaled down rather than overlapping the value
    const fit = (l: Text, valueW: number): void => {
      const room = geo.rows.w - valueW - 8 * u;
      l.setScale(l.width > room ? Math.max(0.6, room / l.width) : 1);
    };
    fit(this.lblTime, this.time.width);
    fit(this.lblStreak, this.streak.width);
    fit(this.lblShield, shS * 0.45 + shPitch * (this.row.length - 1) + shS * 0.5);
    // month strip: "This month" + one quiet baked row of dots under the card
    const my0 = cardY + geo.h + gap * 0.8;
    if (month.length) {
      const hc = vis.p.increaseContrast;
      const msig = month.map((d) => d.mark[0]! + (d.today ? "!" : "")).join("");
      const mw = dotS * month.length;
      this.lblMonth.setPosition(-mw / 2, my0 + monthLblH / 2).setVisible(true);
      this.monthImg.setTexture(this.bank.canvas(`month-${msig}${hc ? "h" : ""}@${dotS}`, mw, dotS, (ctx) => {
        month.forEach((d, i) => {
          ctx.save();
          ctx.translate(i * dotS, 0);
          drawMonthDay(ctx, dotS, d.mark, d.today, hc);
          ctx.restore();
        });
      })).setPosition(0, my0 + monthLblH + 4 * u + dotS / 2).setAlpha(hc ? 1 : 0.8).setVisible(true);
    } else {
      this.monthImg.setVisible(false);
      this.lblMonth.setVisible(false);
    }
    // the milestone / gift moment floats ABOVE the sheet (over the board's lower edge), briefly
    const mile = this.extras.milestone ?? 0;
    const gift = !!this.extras.gift;
    // SE (< 700 pt): no free sky over the house — 0.8× and up between the gear row and the roof
    const ms = Math.round((H / u < 700 ? 46 : compact ? 58 : 70) * u);
    if (mile) {
      this.mileImg.setTexture(this.bank.canvas(`milestone-${mile}${vis.sig}@${ms}`, Math.round(ms * 1.9), ms, (ctx, _w, hh) => {
        drawMilestoneLantern(ctx, hh, mile);
      }));
    }
    if (gift) this.giftImg.setTexture(this.bank.canvas(`gift@${ms}`, Math.round(ms * 1.6), Math.round(ms * 0.8), (ctx, w, hh) => drawGiftChip(ctx, w, hh)));
    this.mileNum = mile ? this.bank.numerals(String(mile), Math.round(ms * 0.36), cream) : "";
    const mileW = mile ? ms * 1.9 : 0;
    const giftW = gift ? ms * 1.6 : 0;
    const cwm = mileW + giftW + (mile && gift ? 16 * u : 0);
    // up in the sky over the house (the daily has no alley strip there), never over the solved board
    const my = Math.round((H / u < 700 ? 58 * u + ms / 2 : Math.max(60 * u + ms / 2, H * 0.16)) - this.cy);
    this.mileImg.setPosition(-cwm / 2 + mileW / 2, my);
    this.mileTxt.setTexture(this.mileNum || "__DEFAULT").setPosition(-cwm / 2 + ms * 0.98, my + ms * 0.04);
    this.giftImg.setPosition(cwm / 2 - giftW / 2, my);
    this.placeDemo(shS);
    // buttons (v11 C15 / D3): [Share] secondary (outline) · [Continue] primary (lantern gold, ink words)
    const yb = h - this.sb - pad - bs / 2;
    const brk = this.breakOn ? 56 * u : 0;
    const row = W - 40 * u - brk;
    const shareW = Math.round(row * 0.38);
    const contW = Math.round(row - shareW - 12 * u);
    const x0 = -W / 2 + 20 * u + brk;
    this.shareBox = { x: x0, y: yb - bs / 2, w: shareW, h: bs };
    this.homeBox = { x: x0 + shareW + 12 * u, y: yb - bs / 2, w: contW, h: bs };
    this.shareBtn.setTexture(this.bank.canvas(`sheetShare2${vis.sig}@${shareW}x${bs}`, shareW, bs, (ctx, w, hh) => {
      ctx.fillStyle = "rgba(244,235,208,0.08)";
      rrectPath(ctx, 1.5 * u, 1.5 * u, w - 3 * u, hh - 3 * u, hh / 2);
      ctx.fill();
      ctx.strokeStyle = vis.p.increaseContrast ? PAL.moon : rgba(PAL.moon, 0.7);
      ctx.lineWidth = 1.8 * u;
      rrectPath(ctx, 1.5 * u, 1.5 * u, w - 3 * u, hh - 3 * u, hh / 2);
      ctx.stroke();
    })).setPosition(x0 + shareW / 2, yb);
    styleText(this.shareTxt, t("share"), { pt: 17, u, weight: "700", color: cream, cap: 1.3 });
    const gsz = Math.round(bs * 0.4);
    const sw = gsz + 6 * u + this.shareTxt.displayWidth;
    this.shareGlyph.setTexture(this.bank.glyph("share", gsz)).setPosition(x0 + shareW / 2 - sw / 2 + gsz / 2, yb - 1 * u);
    this.shareTxt.setOrigin(0, 0.5).setPosition(x0 + shareW / 2 - sw / 2 + gsz + 6 * u, yb);
    if (sw > shareW - 16 * u) {
      // narrow: the glyph alone
      this.shareTxt.setVisible(false);
      this.shareGlyph.setX(x0 + shareW / 2);
    } else this.shareTxt.setVisible(true);
    this.homeBtn.setTexture(primaryButton(this.bank, contW, bs, u)).setPosition(this.homeBox.x + contW / 2, yb + 2 * u);
    styleText(this.homeTxt, t("res.continue"), { pt: 19, u, weight: "800", cap: 1.3 });
    this.homeTxt.setOrigin(0.5, 0.5).setPosition(this.homeBox.x + contW / 2, yb);
    this.breakBtn.setTexture(this.bank.breakChip(Math.round(48 * u))).setPosition(-W / 2 + 20 * u + 24 * u, yb);
    this.root.setPosition(this.cx, this.open ? this.cy : H);
  }

  /** The share postcard of this result (R2): the same spec, the time only when the setting allows. */
  shareCard(showTime: boolean): ShareCard | null {
    if (!this.result) return null;
    return { spec: postcardSpec(this.result, this.extras.cells ?? [], this.extras.hintAt ?? [], showTime), words: postcardWords(this.dateISO) };
  }
  private shareBox = { x: 0, y: 0, w: 0, h: 0 };
  private homeBox = { x: 0, y: 0, w: 0, h: 0 };
  private lblTime!: Text;
  private lblStreak!: Text;
  private lblShield!: Text;
  private lblMonth!: Text;
  private shareTxt!: Text;
  private homeTxt!: Text;
  private mileNum = "";

  /**
   * The bubble sits beside the shields when the row has room on their right (the stacked layout
   * on larger phones), else just above the sheet's top edge over them (it may briefly cover the
   * board's bottom edge — 3 s, once). The flying kept lantern links it to the icons.
   */
  private placeDemo(shS: number): void {
    const u = this.u;
    const ds = Math.round(30 * u);
    const pitch = 36 * u;
    const bw = Math.round(pitch * 3 + 14 * u);
    const bh = Math.round(ds + 18 * u);
    this.demoBg.setTexture(this.bank.canvas(`shieldTip${vis.sig}@${bw}x${bh}`, bw, bh, (ctx, w) => {
      ctx.fillStyle = "rgba(14,16,40,0.94)";
      rrectPath(ctx, 1, 1, w - 2, bh - 2, bh / 2);
      ctx.fill();
      ctx.strokeStyle = rgba(PAL.moon, vis.p.increaseContrast ? 0.8 : 0.35);
      ctx.lineWidth = 1.2 * u;
      rrectPath(ctx, 1, 1, w - 2, bh - 2, bh / 2);
      ctx.stroke();
    })).setOrigin(0.5, 0);
    this.demoKeys = {
      lit: this.bank.canvas(`dayLan1@${ds}`, ds, ds, (ctx, w) => {
        ctx.translate(w / 2 - w * 0.36, w * 0.1);
        drawLantern(ctx, w * 0.8, 1);
      }),
      dark: this.bank.canvas(`dayLan0@${ds}`, ds, ds, (ctx, w) => {
        ctx.globalAlpha = 0.55;
        ctx.translate(w / 2 - w * 0.36, w * 0.1);
        drawLantern(ctx, w * 0.8, 0);
      }),
      covered: this.bank.shield(ds, true),
    };
    this.demoDays.forEach((d, k) => d.setTexture(k === 1 ? this.demoKeys.dark : this.demoKeys.lit).setPosition((k - 1) * pitch, bh / 2));
    this.demoFly.setTexture(this.bank.shield(shS, true));
    const s0 = this.row[0]!;
    const s1 = this.row[this.row.length - 1]!;
    const right = s1.x + shS * 0.5 + 10 * u;
    if (right + bw <= this.W / 2 - 8 * u) this.demo.setPosition(right + bw / 2, s1.y - bh / 2);
    else {
      const cx = (s0.x + s1.x) / 2;
      const half = this.W / 2 - 8 * u - bw / 2;
      this.demo.setPosition(Math.max(-half, Math.min(half, cx)), -bh - 8 * u);
    }
  }

  /** Replay the shield explanation (a tap on the shields). */
  replayShields(now: number): void {
    if (!this.open) return;
    this.demoT0 = now;
  }

  /** Tests: the bubble is on screen. */
  get shieldDemoOn(): boolean {
    return this.demo.visible;
  }

  /**
   * The bubble: three days (lit · unlit · lit) fade in; a kept lantern lifts off the first
   * shield, arcs over and settles on the unlit day (it becomes covered); hold; everything fades
   * out and the shield is back in its slot. Reduce Motion: two still frames, no flight.
   */
  private stepDemo(now: number): void {
    const t = now - this.demoT0;
    const src = this.shields[0]!;
    if (t < 0 || t > SHIELD_DEMO_MS || !this.open) {
      if (this.demo.visible) this.demo.setVisible(false);
      if (this.demoFly.visible) this.demoFly.setVisible(false);
      if (!src.visible) src.setVisible(true);
      return;
    }
    const reduced = motion.reduced;
    const a = reduced ? 1 : clamp01(t / 250) * (1 - clamp01((t - (SHIELD_DEMO_MS - 500)) / 500));
    this.demo.setVisible(true).setAlpha(a);
    const dst = this.demoDays[1]!;
    const dx = this.demo.x + dst.x;
    const dy = this.demo.y + dst.y;
    let landed: boolean;
    if (reduced) {
      landed = t > 1100;
      this.demoFly.setVisible(false);
    } else {
      const fly = easeOutCubic(clamp01((t - 500) / 700));
      landed = fly >= 0.98;
      const flying = fly > 0.02 && !landed;
      const arc = Math.sin(Math.PI * fly) * 24 * this.u;
      src.setVisible(fly <= 0.02 || t > SHIELD_DEMO_MS - 500);
      this.demoFly
        .setVisible(flying)
        .setPosition(src.x + (dx - src.x) * fly, src.y + (dy - src.y) * fly - arc)
        .setScale(1 - 0.25 * fly + 0.12 * Math.sin(Math.PI * fly));
    }
    dst.setTexture(landed ? this.demoKeys.covered : this.demoKeys.dark);
  }

  show(r: DailyResult, shields: number, now: number, offerBreak = false, extras: SheetExtras = this.extras): void {
    this.extras = extras;
    this.result = r;
    this.dateISO = r.dateISO;
    this.dailyN = Math.max(0, dailyNumber(r.dateISO));
    this.timeText = mmss(r.seconds);
    this.streakText = String(r.streak);
    this.shieldsLeft = shields;
    this.place();
    this.breakOn = offerBreak;
    this.breakBtn.setVisible(offerBreak);
    this.open = true;
    this.t0 = now;
    // the first time shields are on screen: explain them once (the sheet slides up first)
    this.startIntro(now + 450);
    // a milestone / the gift: one short moment, once per day's result
    if ((extras.milestone || extras.gift) && this.momentFor !== r.dateISO) {
      this.momentFor = r.dateISO;
      this.momentT0 = now + 420;
    }
  }

  /** The milestone / gift moment is on screen (tests). */
  get momentOn(): boolean {
    return this.mileImg.visible || this.giftImg.visible;
  }

  hide(now: number): void {
    if (!this.open) return;
    this.open = false;
    this.t0 = now;
  }

  /** The ads policy offers the 30-minute break on this result moment: the chip appears. */
  showBreak(): void {
    if (!this.open) return;
    this.breakOn = true;
    this.breakBtn.setVisible(true);
    this.place();
  }

  get breakOffered(): boolean {
    return this.breakOn;
  }

  /** Canvas-px centre of a button (tests / VoiceOver). */
  buttonCenter(which: "share" | "home" | "break"): { x: number; y: number } {
    if (which === "break") return { x: this.cx + this.breakBtn.x, y: this.cy + this.breakBtn.y };
    const r = which === "share" ? this.shareBox : this.homeBox;
    return { x: this.cx + r.x + r.w / 2, y: this.cy + r.y + r.h / 2 };
  }

  /** The break chip was used (or no longer offered). */
  hideBreak(): void {
    this.breakOn = false;
    this.breakBtn.setVisible(false);
    if (this.open) this.place();
  }

  hit(px: number, py: number): SheetHit2 {
    if (!this.open) return "outside";
    const x = px - this.cx;
    const y = py - this.cy;
    const r = 34 * this.u;
    const near = (b: Image): boolean => Math.hypot(x - b.x, y - b.y) <= r;
    const inBox = (b: { x: number; y: number; w: number; h: number }): boolean => x >= b.x - 4 * this.u && x <= b.x + b.w + 4 * this.u && y >= b.y - 6 * this.u && y <= b.y + b.h + 6 * this.u;
    if (inBox(this.shareBox)) return "share";
    if (inBox(this.homeBox)) return "home";
    if (this.breakOn && near(this.breakBtn)) return "break";
    if (this.row.some((sh) => Math.hypot(x - sh.x, y - sh.y) <= 26 * this.u)) return "shields";
    return y >= 0 ? "inside" : "outside";
  }

  /** Control rects in canvas px (VoiceOver layer). */
  controls(): { id: CtlId; x: number; y: number; w: number; h: number; vars?: Record<string, number> }[] {
    if (!this.open) return [];
    const r = 32 * this.u;
    type C = { id: CtlId; x: number; y: number; w: number; h: number; vars?: Record<string, number> };
    const at = (id: C["id"], b: Image): C => ({ id, x: this.cx + b.x - r, y: this.cy + b.y - r, w: 2 * r, h: 2 * r });
    const box2 = (id: C["id"], b: { x: number; y: number; w: number; h: number }): C => ({ id, x: this.cx + b.x, y: this.cy + b.y, w: b.w, h: b.h });
    const out = [box2("share", this.shareBox), box2("home", this.homeBox)];
    if (this.breakOn) out.push(at("break", this.breakBtn));
    // VoiceOver: "Shields: n left this month, one per missed day"; activating replays the bubble
    const s0 = this.row[0]!;
    const s1 = this.row[this.row.length - 1]!;
    const hr = 22 * this.u;
    out.push({ id: "shields", x: this.cx + s0.x - hr, y: this.cy + s0.y - hr, w: s1.x - s0.x + 2 * hr, h: 2 * hr, vars: { n: this.shieldsLeft } });
    const box = (id: CtlId, b: Image, vars?: Record<string, number>): C => ({
      id, x: this.cx + b.x - b.displayWidth / 2, y: this.cy + b.y - b.displayHeight / 2, w: b.displayWidth, h: b.displayHeight, ...(vars ? { vars } : {}),
    });
    // the postcard itself: "Postcard: today's house, lit, and Wick's stamp"
    out.push({ id: "postcard", x: this.cx + this.cardBox.x, y: this.cy + this.cardBox.y, w: this.cardBox.w, h: this.cardBox.h });
    const m = this.extras.month ?? [];
    if (m.length) out.push(box("month", this.monthImg, { done: m.filter((d) => d.mark === "done").length, shield: m.filter((d) => d.mark === "shield").length }));
    if (this.mileImg.visible) out.push(box("milestone", this.mileImg, { n: this.extras.milestone ?? 0 }));
    if (this.giftImg.visible) out.push(box("gift", this.giftImg));
    return out;
  }

  update(now: number): void {
    const t = motion.reduced ? 1 : clamp01((now - this.t0) / (this.open ? 360 : 220));
    const v = this.open ? easeOutCubic(t) : 1 - t;
    const vis_ = v > 0.001;
    this.root.setVisible(vis_);
    if (!vis_) return;
    this.root.setAlpha(Math.min(1, v * 1.4)).setPosition(this.cx, this.cy + (1 - v) * (this.h + 20 * this.u));
    // the milestone / gift moment: blooms in above the sheet, holds, fades (Reduce Motion: fades only)
    const mt = now - this.momentT0;
    const mOn = this.open && mt >= 0 && mt < MOMENT_MS;
    const mile = !!this.extras.milestone && mOn;
    const gift = !!this.extras.gift && mOn;
    this.mileImg.setVisible(mile);
    this.mileTxt.setVisible(mile && this.mileNum !== "");
    this.giftImg.setVisible(gift);
    if (mOn) {
      const k = clamp01(mt / 520);
      const out = clamp01((mt - (MOMENT_MS - 500)) / 500);
      const a = Math.min(1, k * 1.5) * (1 - out);
      const sc = motion.reduced ? 1 : Math.max(0.01, easeOutBack(k));
      this.mileImg.setScale(sc).setAlpha(a);
      this.mileTxt.setAlpha(a);
      this.giftImg.setAlpha(Math.min(a, clamp01((mt - 300) / 400)));
    }
    this.stepDemo(now);
  }
}
