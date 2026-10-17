// Small wordless settings sheet (gear, top left). Three rows of two choices:
//   sound   [speaker] [speaker crossed]
//   numbers [rock with a digit] [rock with dice pips]
//   share   [share box + stopwatch] [share box + stopwatch crossed]   (round 5: time in the
//           daily's share text on/off, default on)
//   haptics [phone buzzing] [phone, struck]                      (phase 2, audit P1-13)
//   guide   [finger in a replay arrow] — one wide button: show the first-run guide again
// Top right of the panel, not a button: a small cloud for the iCloud mirror (phase 4) — solid =
// synced, three dots under it = pending, struck through = off (local only). Spoken via a11y.
// The chosen segment has a warm rim and a lifted fill. Tap outside (or the
// gear again) closes it. ≥ 44 pt targets.
// Phase 5 (v2, BENCHMARK-UX #6): every row carries a short localized caption (settings are the one
// place with words; a11y strings, 7 languages, Dynamic Type), plus
//   reminder [bell] [bell struck]                — the daily reminder (src/notify), hidden when the
//                                                  native plugin is missing
//   guide | start over [finger replay] [board in a circling arrow] — start over asks once (AskCard)
//   privacy choices [shield with a keyhole]       — only when UMP says the entry point is required
//                                                  (EEA / UK); opens the consent form (agent N)
//   | privacy policy [page with lines]             — always (App Review 5.1.1(i): the policy must be
//                                                  reachable in the app); opens src/legal.ts's URL in
//                                                  Safari, never inside the game's WebView
import type PhaserTypes from "phaser";
import { drawDigit, drawHaptic, drawNumberedRock, drawPanel, drawPips, drawSegment, drawShareGlyph, drawSpeaker, drawStopwatch } from "../render/draw.ts";
import { drawRulesDisc } from "./hudArt.ts";
import { uiFont } from "./uiText.ts";
import { vis } from "../render/vis.ts";
import { PAL } from "../render/palette.ts";
import { rng } from "../render/rng.ts";
import type { NumberStyle, TextureBank } from "../render/textures.ts";
import { clamp01, easeOutCubic, motion } from "./motion.ts";
import type { SyncStatus } from "../sync/signal.ts";
import { drawBell, drawPolicy, drawPrivacy, drawRestart } from "./hudArt.ts";
import { drawFramedLantern } from "../render/lantern.ts";
import { drawLanternFace } from "../render/wick.ts";

type Image = PhaserTypes.GameObjects.Image;
export type SheetHit =
  | "soundOn" | "soundOff" | "digits" | "dots" | "timeOn" | "timeOff" | "hapticsOn" | "hapticsOff" | "replay"
  | "restart" | "notifyOn" | "notifyOff" | "privacy" | "policy" | "facesOn" | "facesOff" | "close" | "inside" | "outside";
/** What the v2 rows show (apart from `sel`, whose shape the e2e tests pin). */
export interface SheetMore {
  /** reminder on / off; null = reminders unavailable (row hidden) */
  notify: boolean | null;
  /** the privacy options entry point is required (UMP) */
  privacy: boolean;
  /** the board has moves to take back */
  canRestart: boolean;
  /** caption text for a key (a11y.t) */
  t: (key: string) => string;
  /** v12 (Wick, A4): lantern faces on / off (default on) */
  faces?: boolean;
}
export interface SheetSel {
  muted: boolean;
  numbers: NumberStyle;
  shareTime: boolean;
}

// option index k (stable: e2e sheetPoint(k)): 0–7 pairs, 8 replay, 9 restart, 10/11 reminder, 12 privacy,
// 13 privacy policy, 14/15 lantern faces (v12)
const OPTS: readonly SheetHit[] = ["soundOn", "soundOff", "digits", "dots", "timeOn", "timeOff", "hapticsOn", "hapticsOff", "replay", "restart", "notifyOn", "notifyOff", "privacy", "policy", "facesOn", "facesOff"];
/** visual rows: [options, caption keys (one per column, or one for the row)] */
type Row = { opts: number[]; caps: string[]; id: string };
const ALL_ROWS: readonly Row[] = [
  { id: "sound", opts: [0, 1], caps: ["cap.sound"] },
  { id: "numbers", opts: [2, 3], caps: ["cap.numbers"] },
  { id: "time", opts: [4, 5], caps: ["cap.shareTime"] },
  { id: "haptics", opts: [6, 7], caps: ["cap.haptics"] },
  // v12 (Wick, A4): the faces on the board's lanterns (and Wick himself)
  { id: "faces", opts: [14, 15], caps: ["cap.faces"] },
  { id: "notify", opts: [10, 11], caps: ["cap.notify"] },
  { id: "guide", opts: [8, 9], caps: ["cap.replay", "cap.restart"] },
  // privacy choices (UMP, EEA / UK only) | privacy policy (always): alone, the policy spans the row
  { id: "privacy", opts: [12, 13], caps: ["cap.privacy", "cap.policy"] },
];
const POLICY_ONLY: Row = { id: "privacy", opts: [13], caps: ["cap.policy"] };
const SHEET_DEPTH = 20;
const N_CAPS = 10;

export class SettingsSheet {
  private dim: Image;
  private panel: Image;
  private segs: Image[] = [];
  private cloudImg: Image;
  /** v11 (NOVICE-TEST C23 / D9): a real ✕ close button, top right (44 pt) */
  private closeImg: Image;
  private cloud: SyncStatus = "off";
  private open = false;
  private t0 = -1e9;
  private x0 = 0;
  private y0 = 0;
  private pw = 0;
  private ph = 0;
  private segW = 0;
  private segH = 0;
  private u = 1;
  private sel: SheetSel = { muted: false, numbers: "digits", shareTime: true };
  /** haptics on (kept apart from `sel`, whose shape the e2e tests pin) */
  private hap = true;
  private more: SheetMore = { notify: null, privacy: false, canRestart: true, t: (k) => k };
  private caps: PhaserTypes.GameObjects.Text[] = [];
  private rows: Row[] = [];
  private capH = 0;
  private W = 0;
  private H = 0;
  private sb = 0;

  constructor(
    private readonly scene: PhaserTypes.Scene,
    private readonly bank: TextureBank,
  ) {
    const s = scene;
    this.dim = s.add.image(0, 0, "__DEFAULT").setOrigin(0, 0).setDepth(SHEET_DEPTH).setVisible(false);
    this.panel = s.add.image(0, 0, "__DEFAULT").setOrigin(0, 0).setDepth(SHEET_DEPTH).setVisible(false);
    for (let k = 0; k < OPTS.length; k++) this.segs.push(s.add.image(0, 0, "__DEFAULT").setOrigin(0, 0).setDepth(SHEET_DEPTH).setVisible(false));
    this.cloudImg = s.add.image(0, 0, "__DEFAULT").setOrigin(0, 0).setDepth(SHEET_DEPTH).setVisible(false);
    this.closeImg = s.add.image(0, 0, "__DEFAULT").setOrigin(0, 0).setDepth(SHEET_DEPTH).setVisible(false);
    for (let i = 0; i < N_CAPS; i++) {
      this.caps.push(s.add.text(0, 0, "", { fontFamily: uiFont(), color: "#F4EBD0" }).setOrigin(0, 1).setDepth(SHEET_DEPTH).setVisible(false));
    }
  }

  /** Its display objects (the scene draws them with its fixed UI camera). */
  get objects(): PhaserTypes.GameObjects.GameObject[] {
    return [this.dim, this.panel, ...this.segs, this.cloudImg, this.closeImg, ...this.caps];
  }

  /** The iCloud mirror's state (the small cloud, top right). */
  setCloud(st: SyncStatus): void {
    if (st === this.cloud && this.cloudImg.texture.key !== "__DEFAULT") return;
    this.cloud = st;
    if (this.pw) this.cloudImg.setTexture(this.cloudTexture());
  }

  get cloudState(): SyncStatus {
    return this.cloud;
  }

  private cloudPos(): { x: number; y: number; w: number; h: number } {
    const u = this.u;
    const w = Math.round(30 * u);
    const h = Math.round(22 * u);
    // left of the close button
    return { x: this.pw - Math.round(18 * u) - w - Math.round(46 * u), y: Math.round(4 * u), w, h };
  }

  /** the ✕ (panel px): a 44 pt square in the top-right corner */
  private closePos(): { x: number; y: number; w: number; h: number } {
    const s = Math.round(44 * this.u);
    return { x: this.pw - s - Math.round(4 * this.u), y: Math.round(2 * this.u), w: s, h: s };
  }

  /** The close button's rect in canvas px (VoiceOver / tests). */
  closeBox(): { x: number; y: number; w: number; h: number } {
    const c = this.closePos();
    return { x: this.x0 + c.x, y: this.y0 + c.y, w: c.w, h: c.h };
  }

  /** The cloud's rect in canvas px (VoiceOver: a status, read with the sheet). */
  cloudBox(): { x: number; y: number; w: number; h: number } {
    const c = this.cloudPos();
    return { x: this.x0 + c.x, y: this.y0 + c.y, w: c.w, h: c.h };
  }

  private cloudTexture(): string {
    const { w, h } = this.cloudPos();
    const u = this.u;
    const st = this.cloud;
    return this.bank.canvas(`sheet-cloud-${st}${vis.sig}@${w}x${h}`, w, h, (ctx) => {
      const col = st === "synced" ? PAL.moon : vis.p.increaseContrast ? PAL.moon : "rgba(244,235,208,0.62)";
      const cy = h * 0.42;
      ctx.beginPath();
      ctx.arc(w * 0.34, cy + h * 0.06, h * 0.22, Math.PI * 0.5, Math.PI * 1.5);
      ctx.arc(w * 0.5, cy - h * 0.06, h * 0.27, Math.PI * 1.05, Math.PI * 1.95);
      ctx.arc(w * 0.68, cy + h * 0.04, h * 0.2, Math.PI * 1.4, Math.PI * 0.5);
      ctx.closePath();
      ctx.lineWidth = Math.max(1.2, 1.6 * u);
      ctx.strokeStyle = col;
      if (st === "synced") {
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.85;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.stroke();
      if (st === "pending") {
        ctx.fillStyle = col;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(w * (0.38 + i * 0.12), h * 0.86, Math.max(1, 1.4 * u), 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (st === "off") {
        ctx.lineCap = "round";
        for (const [c, lw] of [["rgba(8,10,26,0.9)", 4 * u], [col, 1.8 * u]] as const) {
          ctx.strokeStyle = c;
          ctx.lineWidth = lw;
          ctx.beginPath();
          ctx.moveTo(w * 0.22, h * 0.86);
          ctx.lineTo(w * 0.8, h * 0.08);
          ctx.stroke();
        }
        ctx.lineCap = "butt";
      }
    });
  }

  get isOpen(): boolean {
    return this.open;
  }

  layout(W: number, H: number, u: number, safeBottom: number): void {
    this.u = u;
    this.W = W;
    this.H = H;
    this.sb = safeBottom;
    this.rows = ALL_ROWS.filter((r) => r.id !== "notify" || this.more.notify !== null).map((r) => (r.id === "privacy" && !this.more.privacy ? POLICY_ONLY : r));
    const n = this.rows.length;
    const pw = Math.round(Math.min(W - 24 * u, 360 * u));
    const pad = 16 * u;
    const gap = 12 * u;
    const fk = Math.min(vis.p.fontScale, 1.35);
    const capFs = Math.round(13 * u * fk);
    this.capH = Math.round(capFs * 1.3 + 4 * u);
    for (const c of this.caps) c.setFontSize(capFs).setFontStyle(vis.weight);
    this.segW = Math.round((pw - pad * 2 - gap) / 2);
    // segments shrink (to 44 pt) before the sheet outgrows the screen
    const room = H - Math.max(safeBottom * u, 12 * u) - 8 * u - 40 * u - 28 * u - pad - 4 * u - n * this.capH - (n - 1) * 10 * u;
    this.segH = Math.round(Math.max(44 * u, Math.min(54 * u, room / n)));
    const ph = Math.round(28 * u + (this.capH + this.segH) * n + 10 * u * (n - 1) + pad + 4 * u);
    this.pw = pw;
    this.ph = ph;
    this.x0 = Math.round((W - pw) / 2);
    this.y0 = Math.round(H - Math.max(safeBottom * u, 12 * u) - 8 * u - ph);
    this.dim.setTexture(this.bank.canvas("dim", 4, 4, (ctx) => {
      ctx.fillStyle = "rgba(6,7,20,0.62)";
      ctx.fillRect(0, 0, 4, 4);
    })).setScale(W / 4, H / 4);
    this.panel.setTexture(this.bank.canvas(`sheet@${pw}x${ph}`, pw, ph, (ctx, w, h) => drawPanel(ctx, w, h, 22 * u, u, false)));
    const cs = this.closePos().w;
    this.closeImg.setTexture(this.bank.canvas(`sheetClose${vis.sig}@${cs}`, cs, cs, (ctx, w) => {
      ctx.fillStyle = vis.p.increaseContrast ? "rgba(244,235,208,0.3)" : "rgba(244,235,208,0.14)";
      ctx.beginPath();
      ctx.arc(w / 2, w / 2, w * 0.36, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = PAL.moon;
      ctx.lineWidth = Math.max(2, w * 0.055);
      ctx.lineCap = "round";
      const r = w * 0.14;
      ctx.beginPath();
      ctx.moveTo(w / 2 - r, w / 2 - r);
      ctx.lineTo(w / 2 + r, w / 2 + r);
      ctx.moveTo(w / 2 + r, w / 2 - r);
      ctx.lineTo(w / 2 - r, w / 2 + r);
      ctx.stroke();
    }));
    this.refresh();
  }

  private rowOf(k: number): number {
    return this.rows.findIndex((r) => r.opts.includes(k));
  }

  private segWidth(k: number): number {
    const r = this.rows[this.rowOf(k)];
    return r && r.opts.length === 1 ? this.segW * 2 + 12 * this.u : this.segW;
  }

  /** Is option k on the sheet right now (the reminder / privacy rows come and go)? */
  shown(k: number): boolean {
    return this.rowOf(k) >= 0;
  }

  private segPos(k: number): { x: number; y: number } {
    const pad = 16 * this.u;
    const gap = 12 * this.u;
    const ri = Math.max(0, this.rowOf(k));
    const col = Math.max(0, this.rows[ri]?.opts.indexOf(k) ?? 0);
    return { x: pad + col * (this.segW + gap), y: 28 * this.u + ri * (this.capH + this.segH + 10 * this.u) + this.capH };
  }

  private segTexture(opt: SheetHit, selected: boolean): string {
    const w = this.segWidth(OPTS.indexOf(opt));
    const h = this.segH;
    const u = this.u;
    const extra = opt === "restart" && !this.more.canRestart ? "-dim" : "";
    return this.bank.canvas(`seg-${opt}${extra}-${selected ? 1 : 0}${vis.sig}@${w}x${h}`, w, h, (ctx) => {
      drawSegment(ctx, w, h, 14 * u, u, selected);
      const col = selected || vis.p.increaseContrast ? PAL.moon : "rgba(244,235,208,0.7)";
      if (opt === "facesOn" || opt === "facesOff") {
        // a small board lantern, with (on) or without (off) its face
        const lh = h * 0.86;
        ctx.save();
        ctx.globalAlpha = selected || vis.p.increaseContrast ? 1 : 0.72;
        ctx.translate(w / 2 - lh * 0.4, h / 2 - lh * 0.52);
        drawFramedLantern(ctx, lh, opt === "facesOn" ? 1 : 0.55);
        if (opt === "facesOn") {
          const fw = Math.round(lh * 0.55);
          ctx.translate(lh * 0.4 - fw / 2, lh * 0.56 - fw / 2);
          drawLanternFace(ctx, fw, "idle");
        }
        ctx.restore();
      } else if (opt === "notifyOn" || opt === "notifyOff") {
        const s = h * 0.62;
        drawBell(ctx, w / 2 - s / 2, h / 2 - s / 2, s, col, opt === "notifyOff");
      } else if (opt === "restart") {
        const dim = !this.more.canRestart;
        ctx.globalAlpha = dim ? 0.4 : 1;
        drawRestart(ctx, w, h * 0.86, PAL.moon);
        ctx.globalAlpha = 1;
      } else if (opt === "privacy") {
        drawPrivacy(ctx, w, h * 0.78, PAL.moon);
      } else if (opt === "policy") {
        drawPolicy(ctx, w, h * 0.78, PAL.moon);
      } else if (opt === "hapticsOn" || opt === "hapticsOff") {
        const ih = h * 0.56;
        ctx.save();
        ctx.translate(0, h / 2 - ih / 2);
        drawHaptic(ctx, w, ih, opt === "hapticsOff", col);
        ctx.restore();
      } else if (opt === "replay") {
        // R2 (A1): the row opens the Rules sheet — the same "?" disc as the HUD's Rules button
        const ih = Math.round(h * 0.72);
        ctx.save();
        ctx.translate(w / 2 - ih / 2, h / 2 - ih / 2);
        drawRulesDisc(ctx, ih, vis.p.boldText);
        ctx.restore();
      } else if (opt === "soundOn" || opt === "soundOff") {
        ctx.save();
        const ih = 26 * u;
        ctx.translate(0, h / 2 - ih / 2);
        drawSpeaker(ctx, w, ih, opt === "soundOff", col);
        ctx.restore();
      } else if (opt === "timeOn" || opt === "timeOff") {
        // the share box with a stopwatch beside it; off = the stopwatch struck through
        const gs = h * 0.62;
        ctx.save();
        ctx.translate(w / 2 - gs * 1.02, h / 2 - gs / 2);
        drawShareGlyph(ctx, gs, col);
        ctx.restore();
        ctx.save();
        ctx.translate(w / 2 + gs * 0.06, h / 2 - gs / 2);
        drawStopwatch(ctx, gs, col);
        ctx.restore();
        if (opt === "timeOff") {
          ctx.lineCap = "round";
          for (const [c, lw] of [["rgba(8,10,26,0.9)", 6 * u], [col, 3 * u]] as const) {
            ctx.strokeStyle = c;
            ctx.lineWidth = lw;
            ctx.beginPath();
            ctx.moveTo(w / 2 + gs * 0.06, h / 2 + gs * 0.46);
            ctx.lineTo(w / 2 + gs * 1.06, h / 2 - gs * 0.46);
            ctx.stroke();
          }
          ctx.lineCap = "butt";
        }
      } else {
        const cs = h * 0.92;
        drawNumberedRock(ctx, w / 2, h / 2 + 1 * u, cs, rng(0x2a17));
        if (opt === "digits") drawDigit(ctx, w / 2, h / 2 - cs * 0.025, cs, 3, "ink");
        else drawPips(ctx, w / 2, h / 2 - cs * 0.025, cs, 3, "ink");
      }
    });
  }

  private refresh(): void {
    const chosen: Record<SheetHit, boolean> = {
      soundOn: !this.sel.muted, soundOff: this.sel.muted, digits: this.sel.numbers === "digits", dots: this.sel.numbers === "dots",
      timeOn: this.sel.shareTime, timeOff: !this.sel.shareTime, hapticsOn: this.hap, hapticsOff: !this.hap, replay: false, inside: false, outside: false,
      restart: false, notifyOn: this.more.notify === true, notifyOff: this.more.notify === false, privacy: false, policy: false, close: false,
      facesOn: this.more.faces !== false, facesOff: this.more.faces === false,
    };
    OPTS.forEach((o, k) => this.segs[k]!.setTexture(this.shown(k) ? this.segTexture(o, chosen[o]) : "__DEFAULT"));
    this.cloudImg.setTexture(this.cloudTexture());
    // captions: one per row (left), or one per column (guide | start over)
    let ci = 0;
    for (const r of this.rows) {
      r.caps.forEach((key, j) => {
        const c = this.caps[ci++];
        if (!c) return;
        const k = r.opts[j] ?? r.opts[0]!;
        const p = this.segPos(k);
        c.setFontFamily(uiFont()).setText(this.more.t(key)).setData("pos", { x: p.x + 4 * this.u, y: p.y - 3 * this.u }).setData("on", true);
        const maxW = (r.caps.length > 1 ? this.segW : this.segW * 2) - 8 * this.u;
        c.setScale(c.width > maxW ? maxW / c.width : 1);
      });
    }
    for (; ci < this.caps.length; ci++) this.caps[ci]!.setData("on", false);
  }

  show(sel: SheetSel, now: number, haptics = this.hap, more: SheetMore = this.more): void {
    this.sel = { ...sel };
    this.hap = haptics;
    const relayout = (more.notify === null) !== (this.more.notify === null) || more.privacy !== this.more.privacy || this.rows.length === 0;
    this.more = more;
    if (relayout && this.W) this.layout(this.W, this.H, this.u, this.sb);
    else this.refresh();
    this.open = true;
    this.t0 = now;
  }

  hide(now: number): void {
    if (!this.open) return;
    this.open = false;
    this.t0 = now;
  }

  select(sel: SheetSel, haptics = this.hap, more?: Partial<SheetMore>): void {
    this.sel = { ...sel };
    this.hap = haptics;
    if (more) this.more = { ...this.more, ...more };
    this.refresh();
  }

  /** The reminder switch moved (the permission answer arrives later than the tap). */
  get notifyState(): boolean | null {
    return this.more.notify;
  }

  hit(px: number, py: number): SheetHit {
    const x = px - this.x0;
    const y = py - this.y0;
    const c = this.closePos();
    if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) return "close";
    if (x < 0 || y < 0 || x > this.pw || y > this.ph) return "outside";
    for (let k = 0; k < OPTS.length; k++) {
      if (!this.shown(k)) continue;
      const p = this.segPos(k);
      if (x >= p.x && x <= p.x + this.segWidth(k) && y >= p.y && y <= p.y + this.segH) return OPTS[k]!;
    }
    return "inside";
  }

  /** Canvas-px centre of option k (0 soundOn … 5 timeOff, 6 hapticsOn, 7 hapticsOff, 8 replay, 9 restart, 10 notifyOn, 11 notifyOff, 12 privacy, 13 policy, 14 facesOn, 15 facesOff) at rest. */
  segmentCenter(k: number): { x: number; y: number } {
    const p = this.segPos(k);
    return { x: this.x0 + p.x + this.segWidth(k) / 2, y: this.y0 + p.y + this.segH / 2 };
  }

  /** Option rects in canvas px (for the VoiceOver layer), with whether each is the chosen one. */
  controls(): { opt: SheetHit; x: number; y: number; w: number; h: number; selected: boolean }[] {
    const chosen = (o: SheetHit): boolean =>
      o === "soundOn" ? !this.sel.muted : o === "soundOff" ? this.sel.muted : o === "digits" ? this.sel.numbers === "digits" : o === "dots" ? this.sel.numbers === "dots"
        : o === "timeOn" ? this.sel.shareTime : o === "timeOff" ? !this.sel.shareTime : o === "hapticsOn" ? this.hap : o === "hapticsOff" ? !this.hap
        : o === "notifyOn" ? this.more.notify === true : o === "notifyOff" ? this.more.notify === false
        : o === "facesOn" ? this.more.faces !== false : o === "facesOff" ? this.more.faces === false : false;
    return OPTS.flatMap((o, k) => {
      if (!this.shown(k)) return [];
      const p = this.segPos(k);
      return [{ opt: o, x: this.x0 + p.x, y: this.y0 + p.y, w: this.segWidth(k), h: this.segH, selected: chosen(o) }];
    });
  }

  update(now: number): void {
    const t = motion.reduced ? 1 : clamp01((now - this.t0) / (this.open ? 240 : 160));
    const v = this.open ? easeOutCubic(t) : 1 - t;
    const capA = vis.p.increaseContrast ? 1 : 0.86;
    const shown = v > 0.001;
    this.dim.setVisible(shown).setAlpha(v);
    const dy = (1 - v) * (this.ph + 30 * this.u);
    this.panel.setVisible(shown).setPosition(this.x0, this.y0 + dy);
    for (let k = 0; k < OPTS.length; k++) {
      const p = this.segPos(k);
      this.segs[k]!.setVisible(shown && this.shown(k)).setPosition(this.x0 + p.x, this.y0 + p.y + dy);
    }
    for (const c of this.caps) {
      const on = shown && c.getData("on") === true;
      c.setVisible(on);
      if (!on) continue;
      const p = c.getData("pos") as { x: number; y: number };
      c.setPosition(this.x0 + p.x, this.y0 + p.y + dy).setAlpha(capA * v);
    }
    const c = this.cloudPos();
    this.cloudImg.setVisible(shown).setPosition(this.x0 + c.x, this.y0 + c.y + dy);
    const cl = this.closePos();
    this.closeImg.setVisible(shown).setPosition(this.x0 + cl.x, this.y0 + cl.y + dy);
  }
}

export const SHEET_OPTS = OPTS;
