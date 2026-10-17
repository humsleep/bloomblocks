// v11 guidance band (NOVICE-TEST §5-A / §5-C): a cream paper strip with ink words — one bold line
// (18 pt) and an optional second line (≥ 17 pt), both × Dynamic Type (≤ 1.6), ink on paper 11.7:1.
// The first-yard tutorial uses it for its steps; on the board it carries the ONE short line that
// says why something went wrong (one at a time). Anchored by its bottom centre (it grows upward),
// it fades and rises in (Reduce Motion: fades only) and can hide itself after `holdMs`.
// Text only changes on show() (no per-frame text work); the frame step moves / fades three objects.
import type PhaserTypes from "phaser";
import { rrectPath } from "../render/draw.ts";
import { PAL, UI, rgba } from "../render/palette.ts";
import type { TextureBank } from "../render/textures.ts";
import { vis } from "../render/vis.ts";
import { clamp01, easeOutCubic, motion } from "./motion.ts";
import { makeText, styleText } from "./uiText.ts";

type Image = PhaserTypes.GameObjects.Image;
type Text = PhaserTypes.GameObjects.Text;

export interface BandLines {
  main: string;
  sub?: string;
  /** "warn": a small coral mark leads the line (an error); "info" (default): plain */
  tone?: "info" | "warn";
  /** R2 (Reality P1-4): which line the coral mark leads — the one that says what went wrong (default main) */
  warnLine?: "main" | "sub";
}

export class LineBand {
  private panel: Image;
  private main: Text;
  private sub: Text;
  private mark: Image;
  private open = false;
  private t0 = -1e9;
  private hideAt = Infinity;
  private u = 1;
  private W = 0;
  private cx = 0;
  private by = 0;
  private w = 0;
  private h = 0;
  private lines: BandLines | null = null;
  /** bumps on every show (the scene re-announces / republishes on change) */
  gen = 0;

  constructor(
    private readonly scene: PhaserTypes.Scene,
    private readonly bank: TextureBank,
    depth: number,
  ) {
    const s = scene;
    this.panel = s.add.image(0, 0, "__DEFAULT").setOrigin(0.5, 1).setDepth(depth).setVisible(false);
    this.mark = s.add.image(0, 0, "__DEFAULT").setDepth(depth).setVisible(false);
    this.main = makeText(s, depth);
    this.sub = makeText(s, depth);
  }

  get objects(): PhaserTypes.GameObjects.GameObject[] {
    return [this.panel, this.mark, this.main, this.sub];
  }

  /** R2: the board's band lives in the slot between the HUD row and the board — never taller than this (px) */
  private maxH = 0;

  /** Screen width (the band is at most W − 32 pt wide); `maxH` (R2, the board's slot): the band fits in it. */
  layout(W: number, u: number, maxH = 0): void {
    this.W = W;
    this.u = u;
    this.maxH = maxH;
    if (this.lines && this.open) this.build(this.lines);
  }

  /** Bottom centre of the band (canvas px). */
  anchor(cx: number, bottomY: number): void {
    this.cx = cx;
    this.by = bottomY;
  }

  get isOpen(): boolean {
    return this.open;
  }

  /** What it says now ("" when closed): VoiceOver / tests. */
  get text(): string {
    if (!this.open || !this.lines) return "";
    return this.lines.sub ? `${this.lines.main} ${this.lines.sub}` : this.lines.main;
  }

  get current(): BandLines | null {
    return this.open ? this.lines : null;
  }

  /** The band's rect at rest (canvas px). */
  rect(): { x: number; y: number; w: number; h: number } {
    return { x: this.cx - this.w / 2, y: this.by - this.h, w: this.w, h: this.h };
  }

  /** Height the band would take for these lines (for layouts that leave room above the board). */
  measure(lines: BandLines): number {
    this.build(lines);
    return this.h;
  }

  show(lines: BandLines, now: number, holdMs = 0): void {
    const same = this.open && this.lines && this.lines.main === lines.main && this.lines.sub === lines.sub;
    this.lines = lines;
    this.build(lines);
    if (!same) {
      // a new line while one shows: swap in place (a short re-fade, no slide)
      this.t0 = this.open ? now - 120 : now;
      this.gen++;
    }
    this.open = true;
    this.hideAt = holdMs > 0 ? now + holdMs : Infinity;
  }

  hide(now: number): void {
    if (!this.open) return;
    this.open = false;
    this.t0 = now;
    this.hideAt = Infinity;
  }

  private build(lines: BandLines): void {
    const u = this.u;
    // R2: in the board's slot (maxH set) the band is slimmer — the same type sizes (≥ 17 pt, D10),
    // less paper around them; it shrinks its words (≥ 0.8) rather than grow over the HUD row
    const slim = this.maxH > 0;
    const maxW = Math.max(160 * u, Math.min(this.W - (slim ? 16 : 24) * u, 420 * u));
    const padX = (slim ? 12 : 16) * u;
    const padY = (slim ? 5 : 11) * u;
    const warn = lines.tone === "warn";
    const markW = warn ? 18 * u : 0;
    const warnSub = warn && lines.warnLine === "sub" && !!lines.sub;
    const inner = maxW - padX * 2 - markW;
    const m = styleText(this.main, lines.main, { pt: 18, u, weight: vis.p.boldText ? "800" : "700", wrap: inner });
    let sw = 0;
    let sh = 0;
    if (lines.sub) {
      const s = styleText(this.sub, lines.sub, { pt: 17, u, weight: vis.p.boldText ? "700" : "600", wrap: inner, color: UI.ink });
      sw = s.w;
      sh = s.h;
    }
    if (!lines.sub) this.sub.setText("");
    let gap = lines.sub ? (slim ? 1 : 4) * u : 0;
    let mh = m.h;
    let mw = m.w;
    if (slim && padY * 2 + mh + gap + sh > this.maxH) {
      const k = Math.max(0.8, (this.maxH - padY * 2 - gap) / (mh + sh));
      this.main.setScale(this.main.scaleX * k);
      this.sub.setScale(this.sub.scaleX * k);
      mh *= k;
      mw *= k;
      sh *= k;
      sw *= k;
      gap *= k;
    }
    // the mark leads ONE line (the error); only that line makes room for it, the other stays centred
    const markMain = warn && !warnSub ? markW : 0;
    const markSub = warnSub ? markW : 0;
    this.w = Math.round(Math.max(mw + markMain, sw + markSub) + padX * 2);
    this.h = Math.round(padY * 2 + mh + gap + sh);
    const w = this.w;
    const h = this.h;
    const hc = vis.p.increaseContrast;
    this.panel.setTexture(this.bank.canvas(`band${hc ? "C" : ""}@${w}x${h}`, w, h + Math.round(6 * u), (ctx) => {
      // soft drop shadow, the paper, a thin inner edge
      ctx.fillStyle = "rgba(6,7,20,0.35)";
      rrectPath(ctx, 0, 4 * u, w, h, 16 * u);
      ctx.fill();
      ctx.fillStyle = UI.paper;
      rrectPath(ctx, 0, 0, w, h, 16 * u);
      ctx.fill();
      ctx.strokeStyle = hc ? UI.ink : UI.paperEdge;
      ctx.lineWidth = Math.max(1, (hc ? 2 : 1.4) * u);
      rrectPath(ctx, 2.5 * u, 2.5 * u, w - 5 * u, h - 5 * u, 13.5 * u);
      ctx.stroke();
    }));
    if (warn) {
      const ms = Math.round(12 * u);
      this.mark.setTexture(this.bank.canvas(`bandMark@${ms}`, ms, ms, (ctx, s) => {
        ctx.fillStyle = PAL.coralDeep;
        ctx.beginPath();
        ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = rgba(PAL.coral, 1);
        ctx.beginPath();
        ctx.arc(s / 2, s / 2, s * 0.32, 0, Math.PI * 2);
        ctx.fill();
      }));
    }
    this.markW = markW;
    this.markOnSub = warnSub;
    this.mainH = mh;
    this.gapH = gap;
    this.padY = padY;
  }
  private markOnSub = false;
  private markW = 0;
  private mainH = 0;
  private gapH = 0;
  private padY = 0;

  update(now: number): void {
    if (this.open && now >= this.hideAt) this.hide(now);
    const t = motion.reduced ? 1 : clamp01((now - this.t0) / (this.open ? 220 : 180));
    const v = this.open ? easeOutCubic(t) : 1 - t;
    const on = v > 0.001 && !!this.lines;
    this.panel.setVisible(on);
    this.main.setVisible(on);
    this.sub.setVisible(on && !!this.lines?.sub);
    this.mark.setVisible(on && this.lines?.tone === "warn");
    if (!on) return;
    const dy = motion.reduced ? 0 : (1 - v) * 10 * this.u;
    const top = this.by - this.h + dy;
    const onSub = this.markOnSub;
    const mx = this.cx + (onSub ? 0 : this.markW / 2);
    const sx = this.cx + (onSub ? this.markW / 2 : 0);
    const subY = top + this.padY + this.mainH + this.gapH;
    // the panel texture is the paper (h) + its 6 pt drop shadow under it: the PAPER's bottom sits on the anchor
    this.panel.setPosition(this.cx, this.by + dy + 6 * this.u).setAlpha(v);
    this.main.setPosition(mx, top + this.padY).setAlpha(v);
    this.sub.setPosition(sx, subY).setAlpha(v);
    if (this.markW) {
      const t = onSub ? this.sub : this.main;
      const lineH = Math.min(onSub ? this.sub.displayHeight : this.mainH, 26 * this.u);
      this.mark.setPosition((onSub ? sx : mx) - t.displayWidth / 2 - 11 * this.u, (onSub ? subY : top + this.padY) + lineH / 2).setAlpha(v);
    }
  }
}

/** The big one-word moment ("Solved!", "Nice!"): ink-rimmed cream letters that pop over the board. */
export class BigWord {
  private t: Text;
  private t0 = -1e9;
  private dur = 0;
  private u = 1;

  constructor(scene: PhaserTypes.Scene, depth: number) {
    this.t = makeText(scene, depth).setOrigin(0.5, 0.5);
  }

  get objects(): PhaserTypes.GameObjects.GameObject[] {
    return [this.t];
  }

  get shown(): boolean {
    return this.t.visible;
  }

  get word(): string {
    return this.t.visible ? this.t.text : "";
  }

  /** `pt` (R2): the scene shows it in the slot over the board (≈ 30 pt), the tutorial keeps 40 pt. */
  show(word: string, x: number, y: number, u: number, now: number, ms: number, pt = 40): void {
    this.u = u;
    styleText(this.t, word, { pt, u, weight: "800", color: UI.paper, cap: 1.3 });
    this.t.setStroke(UI.ink, Math.round(Math.max(4, pt * 0.175) * u)).setShadow(0, Math.round(3 * u), "rgba(6,7,20,0.55)", Math.round(8 * u), true, true);
    this.t.setPosition(x, y);
    this.t0 = now;
    this.dur = ms;
  }

  hide(): void {
    this.t0 = -1e9;
    this.t.setVisible(false);
  }

  update(now: number): void {
    const e = now - this.t0;
    if (e < 0 || e > this.dur) {
      if (this.t.visible) this.t.setVisible(false);
      return;
    }
    const k = clamp01(e / 240);
    const out = clamp01((e - (this.dur - 260)) / 260);
    const pop = motion.reduced ? 1 : 0.7 + 0.3 * easeOutCubic(k) + 0.06 * Math.sin(Math.PI * k);
    this.t.setVisible(true).setAlpha(Math.min(1, k * 1.6) * (1 - out)).setScale(pop);
    void this.u;
  }
}
