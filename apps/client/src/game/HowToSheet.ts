// v11 "How to play" sheet (NOVICE-TEST §5-B) — R2: called "Rules" everywhere (title, HUD caption, settings
// row) — opened by the Rules disc beside Settings on every play screen (house, tower, daily) and by the
// settings' "Rules" row. A bottom sheet (≤ 85 %
// of the screen) with a grabber, a ✕ close button (44 pt), four cards — each a tiny animated yard
// (2.5–4 s loop; Reduce Motion: its last frame, still) + one bold line + one second line (ink on
// paper, ≥ 17 pt × Dynamic Type) — and "Replay tutorial" (52 pt). The cards scroll when they do
// not fit (big text, small phones): drag; the list is clipped by a geometry mask.
// Lazy chunk: loaded on the first "?" tap. The scene pauses the daily's clock while it is open.
import type PhaserTypes from "phaser";
import { drawFloorTile, drawLitTile, drawNumberedRock, drawPanel, drawRock, rrectPath } from "../render/draw.ts";
import { PAL, UI } from "../render/palette.ts";
import { rng } from "../render/rng.ts";
import type { TextureBank } from "../render/textures.ts";
import { vis } from "../render/vis.ts";
import { getNumberStyle } from "./feedback.ts";
import { clamp01, easeOutBack, easeOutCubic, motion } from "./motion.ts";
import { makeText, primaryButton, styleText } from "./uiText.ts";
import { ambient } from "./frameGovernor.ts";

type GO = PhaserTypes.GameObjects.GameObject;
type Image = PhaserTypes.GameObjects.Image;
type Text = PhaserTypes.GameObjects.Text;
type Container = PhaserTypes.GameObjects.Container;

export interface HowToHost {
  readonly scene: PhaserTypes.Scene;
  readonly bank: TextureBank;
  readonly u: number;
  /** draw these with the fixed UI camera */
  ui(objs: readonly GO[]): void;
  t(key: string): string;
  /** safe-area bottom inset (pt) */
  safeBottom(): number;
}

export type HowToHit = "close" | "replay" | "inside" | "outside" | "drag";

const DEPTH = 22;

/** A tiny yard for a card: baked dark + lit flagstones and stones; live lanterns, light, marks. */
class MiniYard {
  readonly root: Container;
  private lit = new Map<number, Image>();
  private lan = new Map<number, Image>();
  private fl = new Map<number, Image>();
  private nums = new Map<number, { ink: Image; warm: Image }>();
  private extra: Image[] = [];
  readonly w: number;
  readonly h: number;
  private readonly pad: number;

  constructor(
    scene: PhaserTypes.Scene,
    bank: TextureBank,
    private readonly rows: readonly string[],
    private readonly mcs: number,
    u: number,
    key: string,
  ) {
    const cols = rows[0]!.length;
    const n = rows.length;
    const gap = Math.max(2, Math.round(2 * u));
    const p = Math.round(5 * u);
    this.pad = p;
    this.w = cols * mcs + p * 2;
    this.h = n * mcs + p * 2;
    const W = this.w;
    const H = this.h;
    const yardKey = (lit: boolean): string => bank.canvas(`howYard-${key}-${lit ? 1 : 0}@${mcs}`, W, H, (ctx) => {
      const r = rng(0x51 + key.length);
      rrectPath(ctx, 0, 0, W, H, 8 * u);
      ctx.fillStyle = PAL.grout;
      ctx.fill();
      rows.forEach((row, y) => {
        for (let x = 0; x < cols; x++) {
          const c = row[x]!;
          const cx = p + x * mcs + mcs / 2;
          const cy = p + y * mcs + mcs / 2;
          if (c === "#") drawRock(ctx, cx, cy, mcs * 0.4, r);
          else if (c >= "0" && c <= "4") drawNumberedRock(ctx, cx, cy, mcs, r);
          else if (lit) drawLitTile(ctx, cx, cy, mcs - gap, mcs * 0.14, 0);
          else drawFloorTile(ctx, p + x * mcs + gap / 2, p + y * mcs + gap / 2, mcs - gap, mcs * 0.14, r);
        }
      });
    });
    // ambient(): the cards' looping demos run at the frame governor's 20 fps while the sheet sits open
    // (playtest/perf/idle-governor.md) — a slow, illustrative loop, not a response to a tap
    this.root = ambient(scene.add.container(0, 0));
    const base = scene.add.image(0, 0, yardKey(false)).setOrigin(0, 0);
    this.root.add(base);
    const litKey = yardKey(true);
    const tex = scene.textures.get(litKey);
    const lh = Math.round(mcs * 0.86);
    rows.forEach((row, y) => {
      for (let x = 0; x < cols; x++) {
        const c = row[x]!;
        const i = y * 8 + x;
        const frame = `c${i}`;
        if (c === "." || c === "L") {
          if (!tex.has(frame)) tex.add(frame, 0, p + x * mcs, p + y * mcs, mcs, mcs);
          const im = ambient(scene.add.image(p + x * mcs, p + y * mcs, litKey, frame).setOrigin(0, 0).setAlpha(0));
          this.lit.set(i, im);
          this.root.add(im);
        } else if (c >= "0" && c <= "4") {
          const v = c.charCodeAt(0) - 48;
          const oy = bank.numberOffsetY(mcs);
          const ink = ambient(scene.add.image(this.cx(i), this.cy(i) + oy, bank.number(mcs, v, "ink", getNumberStyle())));
          const warm = ambient(scene.add.image(this.cx(i), this.cy(i) + oy, bank.number(mcs, v, "warm", getNumberStyle())).setAlpha(0));
          this.nums.set(i, { ink, warm });
          this.root.add([ink, warm]);
        }
      }
    });
    rows.forEach((row, y) => {
      for (let x = 0; x < cols; x++) {
        const c = row[x]!;
        if (c !== "." && c !== "L") continue;
        const i = y * 8 + x;
        const f = ambient(scene.add.image(this.cx(i), this.cy(i) - mcs * 0.02, bank.flame(Math.round(mcs * 0.62), false)).setBlendMode(1).setAlpha(0));
        const b = ambient(scene.add.image(this.cx(i), this.cy(i), bank.lantern(lh, 1)).setOrigin(0.5, 0.56).setAlpha(0));
        this.lan.set(i, b);
        this.fl.set(i, f);
        this.root.add([b, f]);
      }
    });
  }

  cx(i: number): number {
    return this.pad + (i & 7) * this.mcs + this.mcs / 2;
  }
  cy(i: number): number {
    return this.pad + (i >> 3) * this.mcs + this.mcs / 2;
  }

  /** an extra sprite on the yard (✕, a stone that appears, a check), local px */
  add(im: Image): Image {
    ambient(im);
    this.extra.push(im);
    this.root.add(im);
    return im;
  }

  setLit(i: number, a: number): void {
    this.lit.get(i)?.setAlpha(a);
  }

  /** a lantern: `a` its presence (0..1), `drop` 0 = landed … 1 = just above */
  setLantern(i: number, a: number, drop = 0): void {
    const b = this.lan.get(i);
    const f = this.fl.get(i);
    if (!b || !f) return;
    const y = this.cy(i) - drop * this.mcs * 0.6;
    b.setAlpha(a).setY(y).setScale(0.8 + 0.2 * a);
    f.setAlpha(a * 0.9).setY(y - this.mcs * 0.02).setScale(1, 1.15);
  }

  setWarm(i: number, k: number): void {
    const n = this.nums.get(i);
    if (!n) return;
    n.warm.setAlpha(k);
    n.ink.setAlpha(1 - k);
  }
}

interface Card {
  box: Container;
  bg: Image;
  yards: MiniYard[];
  main: Text;
  sub: Text;
  y: number;
  h: number;
  /** pose the card's yards at loop time t (ms); reduced = a still, final frame */
  pose: (t: number, reduced: boolean) => void;
  period: number;
  text: string;
}

export class HowToSheet {
  private dim: Image;
  private panel: Image;
  private title: Text;
  private closeBtn: Image;
  private list: Container;
  private mask: PhaserTypes.GameObjects.Graphics;
  private bar: Image;
  private cards: Card[] = [];
  private replayBtn: Image;
  private replayTxt: Text;
  private open = false;
  private t0 = -1e9;
  private W = 0;
  private H = 0;
  private u = 1;
  private x0 = 0;
  private y0 = 0;
  private pw = 0;
  private ph = 0;
  /** the scrolling viewport (canvas px, relative to the panel top) and the content height */
  private vTop = 0;
  private vH = 0;
  private contentH = 0;
  private scroll = 0;
  private drag: { y0: number; s0: number; moved: boolean } | null = null;
  private replayBox = { x: 0, y: 0, w: 0, h: 0 };
  private closeBox = { x: 0, y: 0, w: 0, h: 0 };
  private animT0 = 0;

  constructor(private readonly host: HowToHost) {
    const s = host.scene;
    this.dim = s.add.image(0, 0, "__DEFAULT").setOrigin(0, 0).setDepth(DEPTH).setVisible(false);
    this.panel = s.add.image(0, 0, "__DEFAULT").setOrigin(0, 0).setDepth(DEPTH).setVisible(false);
    this.title = makeText(s, DEPTH).setOrigin(0, 0.5);
    this.closeBtn = s.add.image(0, 0, "__DEFAULT").setDepth(DEPTH).setVisible(false);
    this.list = s.add.container(0, 0).setDepth(DEPTH).setVisible(false);
    this.mask = s.add.graphics().setVisible(false);
    this.list.setMask(this.list.createGeometryMask(this.mask));
    this.bar = s.add.image(0, 0, "__DEFAULT").setOrigin(0.5, 0).setDepth(DEPTH).setVisible(false);
    this.replayBtn = s.add.image(0, 0, "__DEFAULT");
    this.replayTxt = makeText(s, DEPTH).setOrigin(0.5, 0.5);
    host.ui([this.dim, this.panel, this.title, this.closeBtn, this.list, this.mask, this.bar]);
  }

  get isOpen(): boolean {
    return this.open;
  }

  /** what the cards say (tests / VoiceOver) */
  get texts(): string[] {
    return this.cards.map((c) => c.text);
  }

  layout(W: number, H: number, u: number): void {
    this.W = W;
    this.H = H;
    this.u = u;
    this.build();
  }

  private build(): void {
    const { W, H, u } = this;
    const s = this.host.scene;
    const t = (k: string): string => this.host.t(k);
    const bank = this.host.bank;
    // tear down the old cards (a relayout: new text size / screen)
    for (const c of this.cards) c.box.destroy();
    this.cards = [];
    this.list.remove([this.replayBtn, this.replayTxt]);
    const sb = Math.max(this.host.safeBottom() * u, 12 * u);
    const pw = Math.round(Math.min(W, 520 * u));
    const maxH = Math.round(H * 0.85);
    const pad = 16 * u;
    const head = 60 * u;
    const inner = pw - pad * 2;
    // the four cards
    const mcs = Math.round(Math.min(30 * u, (inner - 32 * u) / 5));
    const specs = this.cardSpecs();
    // R2 (Reality #12): one inset size for every card (the widest card's yards side by side) — no mix of
    // wide strips and big squares, and card ④ shows its 2 and its 0 side by side (no empty square)
    const yardGap = 14 * u;
    const rowW = (rows: (readonly string[])[]): number => rows.reduce((a, r) => a + r[0]!.length * mcs + 10 * u, 0) + yardGap * (rows.length - 1);
    const insetW = Math.min(inner - 16 * u, Math.max(...specs.map((sp) => rowW(sp.rows))) + 16 * u);
    let y = 0;
    specs.forEach((sp, k) => {
      const box = s.add.container(0, 0);
      const yards = sp.rows.map((rows, j) => new MiniYard(s, bank, rows, mcs, u, `${k}-${j}`));
      for (const yd of yards) box.add(yd.root);
      const main = makeText(s, DEPTH).setVisible(true);
      const sub = makeText(s, DEPTH).setVisible(true);
      const textW = inner - 32 * u;
      const m = styleText(main, t(sp.main), { pt: 18, u, weight: vis.p.boldText ? "800" : "700", wrap: textW });
      const st = styleText(sub, t(sp.sub), { pt: 17, u, weight: vis.p.boldText ? "700" : "500", wrap: textW });
      const yh = Math.max(...yards.map((yd) => yd.h));
      const ch = Math.round(14 * u + yh + 12 * u + m.h + 4 * u + st.h + 16 * u);
      const bg = s.add.image(0, 0, bank.canvas(`howCard${vis.p.increaseContrast ? "C" : ""}@${Math.round(inner)}x${ch}`, Math.round(inner), ch, (ctx, w, h) => {
        ctx.fillStyle = UI.paper;
        rrectPath(ctx, 0, 0, w, h, 18 * u);
        ctx.fill();
        ctx.strokeStyle = vis.p.increaseContrast ? UI.ink : UI.paperEdge;
        ctx.lineWidth = 1.5 * u;
        rrectPath(ctx, 1.5 * u, 1.5 * u, w - 3 * u, h - 3 * u, 16.5 * u);
        ctx.stroke();
        // a night inset for the yard(s) — the same width on every card
        ctx.fillStyle = "#1B1F3C";
        rrectPath(ctx, (w - insetW) / 2, 8 * u, insetW, yh + 12 * u, 12 * u);
        ctx.fill();
      })).setOrigin(0, 0);
      box.addAt(bg, 0);
      // the card's yards side by side, centred in the inset
      const total = yards.reduce((a, yd) => a + yd.w, 0) + yardGap * (yards.length - 1);
      let yx = (inner - total) / 2;
      for (const yd of yards) {
        yd.root.setPosition(Math.round(yx), Math.round(14 * u + (yh - yd.h) / 2));
        yx += yd.w + yardGap;
      }
      main.setPosition(inner / 2, 14 * u + yh + 12 * u);
      sub.setPosition(inner / 2, 14 * u + yh + 12 * u + m.h + 4 * u);
      box.add([main, sub]);
      box.setPosition(0, y);
      this.list.add(box);
      const card: Card = { box, bg, yards, main, sub, y, h: ch, pose: (tt, r) => sp.pose(yards, tt, r, mcs, u, bank, s), period: sp.period, text: `${t(sp.main)} ${t(sp.sub)}` };
      sp.setup(yards, mcs, u, bank, s);
      this.cards.push(card);
      y += ch + 10 * u;
    });
    // Replay tutorial (full width, 52 pt)
    const bh = Math.round(52 * u);
    y += 4 * u;
    this.replayBtn.setTexture(primaryButton(bank, inner, bh, u)).setPosition(inner / 2, y + bh / 2);
    styleText(this.replayTxt, t("how.replay"), { pt: 18, u, weight: "800", cap: 1.4 });
    this.replayTxt.setPosition(inner / 2, y + bh / 2 - 2 * u).setVisible(true);
    if (this.replayTxt.displayWidth > inner - 24 * u) this.replayTxt.setScale((inner - 24 * u) / this.replayTxt.displayWidth);
    this.list.add([this.replayBtn, this.replayTxt]);
    this.replayBox = { x: 0, y, w: inner, h: bh };
    y += bh + 8 * u;
    this.contentH = y;
    // the sheet: as tall as its content, at most 85 % of the screen
    const ph = Math.round(Math.min(maxH, head + this.contentH + 8 * u + sb));
    this.pw = pw;
    this.ph = ph;
    this.x0 = Math.round((W - pw) / 2);
    this.y0 = Math.round(H - ph);
    this.vTop = head;
    this.vH = ph - head - sb;
    this.scroll = Math.min(this.scroll, this.maxScroll());
    this.dim.setTexture(bank.canvas("howDim", 4, 4, (ctx) => {
      ctx.fillStyle = "rgba(6,7,20,0.62)";
      ctx.fillRect(0, 0, 4, 4);
    })).setScale(W / 4, H / 4);
    this.panel.setTexture(bank.canvas(`howPanel${vis.sig}@${pw}x${ph}`, pw, ph + Math.round(30 * u), (ctx, w, h) => {
      drawPanel(ctx, w, h, 26 * u, u);
      if (vis.p.increaseContrast) {
        ctx.strokeStyle = PAL.moon;
        ctx.lineWidth = 1.6 * u;
        rrectPath(ctx, 0.8 * u, 0.8 * u, w - 1.6 * u, h - 5 * u, 26 * u);
        ctx.stroke();
      }
    }));
    styleText(this.title, t("how.title"), { pt: 22, u, weight: "800", color: UI.caption, cap: 1.4 });
    const cs = Math.round(44 * u);
    this.closeBtn.setTexture(bank.canvas(`howClose${vis.sig}@${cs}`, cs, cs, (ctx, w) => {
      ctx.fillStyle = "rgba(244,235,208,0.14)";
      ctx.beginPath();
      ctx.arc(w / 2, w / 2, w * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = PAL.moon;
      ctx.lineWidth = Math.max(2, w * 0.06);
      ctx.lineCap = "round";
      const r = w * 0.17;
      ctx.beginPath();
      ctx.moveTo(w / 2 - r, w / 2 - r);
      ctx.lineTo(w / 2 + r, w / 2 + r);
      ctx.moveTo(w / 2 + r, w / 2 - r);
      ctx.lineTo(w / 2 - r, w / 2 + r);
      ctx.stroke();
    }));
    this.closeBox = { x: pw - pad - cs + 6 * u, y: 10 * u, w: cs, h: cs };
    this.bar.setTexture(bank.canvas(`howBar@${Math.round(4 * u)}`, Math.round(4 * u), Math.round(40 * u), (ctx, w, h) => {
      ctx.fillStyle = "rgba(244,235,208,0.45)";
      rrectPath(ctx, 0, 0, w, h, w / 2);
      ctx.fill();
    }));
    this.markAll();
  }

  /** new objects (cards) are drawn by the UI camera like the rest */
  private markAll(): void {
    this.host.ui([this.list]);
  }

  private maxScroll(): number {
    return Math.max(0, this.contentH - this.vH);
  }

  show(now: number): void {
    this.open = true;
    this.t0 = now;
    this.animT0 = now;
    this.scroll = 0;
  }

  hide(now: number): void {
    if (!this.open) return;
    this.open = false;
    this.t0 = now;
    this.drag = null;
  }

  // ---------------------------------------------------------------- input (canvas px)

  down(px: number, py: number): void {
    if (!this.open) return;
    const y = py - this.y0;
    if (y >= this.vTop && y <= this.vTop + this.vH && px >= this.x0 && px <= this.x0 + this.pw) this.drag = { y0: py, s0: this.scroll, moved: false };
  }

  move(_px: number, py: number): void {
    const d = this.drag;
    if (!d) return;
    const dy = py - d.y0;
    if (Math.abs(dy) > 8 * this.u) d.moved = true;
    if (d.moved) this.scroll = Math.max(0, Math.min(this.maxScroll(), d.s0 - dy));
  }

  /** pointerup: what was tapped (a drag is not a tap) */
  up(px: number, py: number): HowToHit {
    const d = this.drag;
    this.drag = null;
    if (d?.moved) return "drag";
    if (!this.open) return "outside";
    const x = px - this.x0;
    const y = py - this.y0;
    if (y < 0) return "outside";
    const cb = this.closeBox;
    if (x >= cb.x - 4 * this.u && x <= cb.x + cb.w + 4 * this.u && y >= cb.y - 4 * this.u && y <= cb.y + cb.h + 4 * this.u) return "close";
    if (y >= this.vTop && y <= this.vTop + this.vH) {
      const lx = x - 16 * this.u;
      const ly = y - this.vTop + this.scroll;
      const r = this.replayBox;
      if (lx >= r.x && lx <= r.x + r.w && ly >= r.y - 4 * this.u && ly <= r.y + r.h + 4 * this.u) return "replay";
    }
    return "inside";
  }

  /** Scroll so the Replay button is in view (tests / VoiceOver). */
  revealReplay(): void {
    this.scroll = this.maxScroll();
  }

  /** Canvas-px centres (tests). */
  point(which: "close" | "replay"): { x: number; y: number } {
    if (which === "close") return { x: this.x0 + this.closeBox.x + this.closeBox.w / 2, y: this.y0 + this.closeBox.y + this.closeBox.h / 2 };
    const r = this.replayBox;
    return { x: this.x0 + 16 * this.u + r.x + r.w / 2, y: this.y0 + this.vTop - this.scroll + r.y + r.h / 2 };
  }

  /** VoiceOver: the title, every card's words, Replay, Close (canvas px). */
  controls(): { id: string; label: string; x: number; y: number; w: number; h: number; action: "close" | "replay" | null }[] {
    if (!this.open) return [];
    const u = this.u;
    const out: { id: string; label: string; x: number; y: number; w: number; h: number; action: "close" | "replay" | null }[] = [];
    out.push({ id: "how-title", label: this.host.t("how.title"), x: this.x0 + 16 * u, y: this.y0 + 10 * u, w: this.pw - 80 * u, h: 44 * u, action: null });
    const top = this.y0 + this.vTop - this.scroll;
    this.cards.forEach((c, k) => {
      const y = Math.max(this.y0 + this.vTop, top + c.y);
      const bottom = Math.min(this.y0 + this.vTop + this.vH, top + c.y + c.h);
      if (bottom > y) out.push({ id: `how-card${k}`, label: c.text, x: this.x0 + 16 * u, y, w: this.pw - 32 * u, h: bottom - y, action: null });
    });
    const r = this.point("replay");
    out.push({ id: "how-replay", label: this.host.t("how.replay"), x: r.x - this.replayBox.w / 2, y: r.y - this.replayBox.h / 2, w: this.replayBox.w, h: this.replayBox.h, action: "replay" });
    const c = this.point("close");
    out.push({ id: "how-close", label: this.host.t("close"), x: c.x - 22 * u, y: c.y - 22 * u, w: 44 * u, h: 44 * u, action: "close" });
    return out;
  }

  // ---------------------------------------------------------------- frame

  update(now: number): void {
    const t = motion.reduced ? 1 : clamp01((now - this.t0) / (this.open ? 280 : 180));
    const v = this.open ? easeOutCubic(t) : 1 - t;
    const on = v > 0.001;
    for (const o of [this.dim, this.panel, this.title, this.closeBtn, this.list]) (o as Image).setVisible(on);
    if (!on) {
      this.bar.setVisible(false);
      return;
    }
    const u = this.u;
    const dy = (1 - v) * (this.ph + 30 * u);
    const y0 = this.y0 + dy;
    this.dim.setAlpha(v);
    this.panel.setPosition(this.x0, y0);
    this.title.setPosition(this.x0 + 18 * u, y0 + 32 * u);
    this.closeBtn.setPosition(this.x0 + this.closeBox.x + this.closeBox.w / 2, y0 + this.closeBox.y + this.closeBox.h / 2);
    this.list.setPosition(this.x0 + 16 * u, y0 + this.vTop - this.scroll);
    this.mask.clear().fillStyle(0xffffff, 1).fillRect(this.x0, y0 + this.vTop, this.pw, this.vH);
    // a thin scroll bar while the list is longer than the sheet
    const ms = this.maxScroll();
    if (ms > 1) {
      const bh = Math.max(30 * u, (this.vH * this.vH) / this.contentH);
      const by = y0 + this.vTop + (this.vH - bh) * (this.scroll / ms);
      this.bar.setVisible(true).setPosition(this.x0 + this.pw - 6 * u, by).setScale(1, bh / (40 * u)).setAlpha(v);
    } else this.bar.setVisible(false);
    const reduced = motion.reduced;
    this.cards.forEach((c, k) => {
      const tt = (now - this.animT0 + k * 450) % c.period;
      c.pose(reduced ? c.period : tt, reduced);
    });
  }

  destroy(): void {
    for (const c of this.cards) c.box.destroy();
    for (const o of [this.dim, this.panel, this.title, this.closeBtn, this.list, this.mask, this.bar]) o.destroy();
  }

  // ---------------------------------------------------------------- the four cards

  private cardSpecs(): {
    rows: (readonly string[])[];
    main: string;
    sub: string;
    period: number;
    setup: (y: MiniYard[], mcs: number, u: number, bank: TextureBank, s: PhaserTypes.Scene) => void;
    pose: (y: MiniYard[], t: number, reduced: boolean, mcs: number, u: number, bank: TextureBank, s: PhaserTypes.Scene) => void;
  }[] {
    const extras = new Map<string, Image>();
    const fade = (t: number, a: number, d = 160): number => clamp01((t - a) / d);
    const drop = (t: number, a: number): number => 1 - easeOutCubic(clamp01((t - a) / 180));
    const x = (key: string): Image => extras.get(key)!;
    return [
      {
        // 1 — tap → a lantern → its light runs along the row and stops at the stone
        rows: [["...#."]],
        main: "how.c1", sub: "how.c1s", period: 3600,
        setup: (ys, mcs, _u, bank, s) => {
          const y = ys[0]!;
          extras.set("f1", y.add(s.add.image(y.cx(0) + mcs * 0.1, y.cy(0) + mcs * 0.15, bank.finger(Math.round(mcs * 1.3))).setOrigin(0.36, 0.05).setAlpha(0)));
        },
        pose: (ys, t, reduced) => {
          const y = ys[0]!;
          const on = reduced ? 1 : fade(t, 500) * (1 - fade(t, 3100, 300));
          y.setLantern(0, on, reduced ? 0 : drop(t, 500));
          for (let c = 0; c <= 2; c++) y.setLit(c, reduced ? 1 : fade(t, 540 + c * 90) * (1 - fade(t, 3100, 300)));
          const fa = reduced ? 0 : fade(t, 150, 200) * (1 - fade(t, 650, 250));
          x("f1").setAlpha(fa * 0.95).setScale(t > 460 && t < 600 ? 0.9 : 1);
        },
      },
      {
        // 2 — two lanterns light every tile; tapping one takes it back
        rows: [["...", ".#.", "..."]],
        main: "how.c2", sub: "how.c2s", period: 4200,
        setup: (ys, mcs, _u, bank, s) => {
          const y = ys[0]!;
          extras.set("f2", y.add(s.add.image(y.cx(18) + mcs * 0.1, y.cy(18) + mcs * 0.15, bank.finger(Math.round(mcs * 1.3))).setOrigin(0.36, 0.05).setAlpha(0)));
        },
        pose: (ys, t, reduced) => {
          const y = ys[0]!;
          const out = reduced ? 0 : fade(t, 2900, 260);
          const a1 = reduced ? 1 : fade(t, 400) * (1 - fade(t, 3900, 250));
          const a2 = reduced ? 1 : fade(t, 1000) * (1 - out);
          y.setLantern(0, a1, reduced ? 0 : drop(t, 400));
          y.setLantern(18, a2, reduced ? 0 : out > 0 ? -0.3 * out : drop(t, 1000));
          for (const c of [0, 1, 2, 8, 16]) y.setLit(c, reduced ? 1 : fade(t, 430 + (c % 8 + (c >> 3)) * 70) * (1 - fade(t, 3900, 250)));
          for (const c of [18, 17, 10]) y.setLit(c, c === 18 ? a2 : reduced ? 1 : fade(t, 1030 + ((18 - c) % 8 === 1 ? 70 : 70)) * (1 - out));
          const fa = reduced ? 0 : fade(t, 2350, 200) * (1 - fade(t, 3050, 250));
          x("f2").setAlpha(fa * 0.95).setScale(t > 2850 && t < 2990 ? 0.9 : 1);
        },
      },
      {
        // 3 — two lanterns in one row see each other (✕); a stone between them makes it fine (✓)
        rows: [["....."]],
        main: "how.c3", sub: "how.c3s", period: 4400,
        setup: (ys, mcs, u, bank, s) => {
          const y = ys[0]!;
          const rk = bank.canvas(`howRock@${mcs}`, mcs, mcs, (ctx, w) => drawRock(ctx, w / 2, w / 2, w * 0.4, rng(0x77)));
          extras.set("stone", y.add(s.add.image(y.cx(2), y.cy(2), rk).setAlpha(0)));
          extras.set("x", y.add(s.add.image(y.cx(2), y.cy(2), bank.conflictX(Math.round(mcs * 0.7))).setAlpha(0)));
          // R2 (Reality #12): the ✓ sits on the stone's cell corner, inside the yard (it hung over the frame)
          extras.set("ok", y.add(s.add.image(y.cx(2) + mcs * 0.28, y.cy(2) - mcs * 0.28, bank.canvas(`howOk@${mcs}`, Math.round(mcs * 0.5), Math.round(mcs * 0.5), (ctx, w) => {
            ctx.fillStyle = "#2E6B4A";
            ctx.beginPath();
            ctx.arc(w / 2, w / 2, w * 0.46, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#FFFFFF";
            ctx.lineWidth = w * 0.13;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.beginPath();
            ctx.moveTo(w * 0.28, w * 0.52);
            ctx.lineTo(w * 0.44, w * 0.68);
            ctx.lineTo(w * 0.73, w * 0.34);
            ctx.stroke();
          })).setAlpha(0)));
          void u;
        },
        pose: (ys, t, reduced) => {
          const y = ys[0]!;
          const end = reduced ? 0 : fade(t, 4000, 300);
          y.setLantern(0, reduced ? 1 : fade(t, 300) * (1 - end), reduced ? 0 : drop(t, 300));
          y.setLantern(4, reduced ? 1 : fade(t, 900) * (1 - end), reduced ? 0 : drop(t, 900));
          const stone = reduced ? 1 : fade(t, 2100, 300) * (1 - end);
          for (let c = 0; c < 5; c++) y.setLit(c, c === 2 ? (reduced ? 0 : fade(t, 420) * (1 - stone)) : reduced ? 1 : fade(t, 330 + c * 60) * (1 - end));
          const xa = reduced ? 0 : fade(t, 1050, 200) * (1 - fade(t, 2100, 250));
          x("x").setAlpha(xa).setScale(0.6 + 0.4 * (reduced ? 1 : easeOutBack(fade(t, 1050, 220))));
          x("stone").setAlpha(stone);
          x("ok").setAlpha(reduced ? 1 : fade(t, 2500, 200) * (1 - end));
        },
      },
      {
        // 4 — a 2 with two lanterns beside it is done (ring); a lantern next to a 0 is ✕
        rows: [["...", ".2.", "..."], ["0.."]],
        main: "how.c4", sub: "how.c4s", period: 5200,
        setup: (ys, mcs, _u, bank, s) => {
          const z = ys[1]!;
          extras.set("zx", z.add(s.add.image(z.cx(1), z.cy(1), bank.conflictX(Math.round(mcs * 0.7))).setAlpha(0)));
        },
        pose: (ys, t, reduced) => {
          const a = ys[0]!;
          const z = ys[1]!;
          // R2: both yards side by side, always there — part A (0–2.6 s): the 2 fills · part B (2.6–5.2 s):
          // a lantern next to the 0 gets ✕ (Reduce Motion: both final frames, still)
          const pa = reduced ? 1 : 1 - fade(t, 4900, 300);
          const pb = reduced ? 1 : fade(t, 2600, 250) * (1 - fade(t, 4900, 300));
          a.root.setAlpha(1);
          z.root.setAlpha(1);
          void pa;
          const endA = reduced ? 0 : fade(t, 4900, 300);
          a.setLantern(1, reduced ? 1 : fade(t, 300) * (1 - endA), reduced ? 0 : drop(t, 300));
          a.setLantern(8, reduced ? 1 : fade(t, 900) * (1 - endA), reduced ? 0 : drop(t, 900));
          for (const c of [0, 1, 2]) a.setLit(c, reduced ? 1 : fade(t, 330) * (1 - endA));
          for (const c of [8, 16]) a.setLit(c, reduced ? 1 : fade(t, 930) * (1 - endA));
          a.setWarm(9, reduced ? 1 : fade(t, 1150, 250) * (1 - endA));
          z.setLantern(1, reduced ? 1 : pb > 0 ? fade(t, 3000) * pb : 0, reduced ? 0 : drop(t, 3000));
          z.setLit(1, reduced ? 1 : pb > 0 ? fade(t, 3030) * pb : 0);
          z.setLit(2, reduced ? 1 : pb > 0 ? fade(t, 3080) * pb : 0);
          x("zx").setAlpha(reduced ? 1 : pb > 0 ? fade(t, 3300, 200) * pb : 0);
        },
      },
    ];
  }
}
