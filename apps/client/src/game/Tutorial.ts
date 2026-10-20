// v11 interactive tutorial "first yard" (playtest/NOVICE-TEST.md §5-A), before gentle 1.
// Five tiny hand-made yards, one rule each; every step waits for the player's OWN tap:
//   T1 1×5  place a lantern → its light fills the row
//   T2 3×3  a stone blocks the light; light every tile to win (the last dark tile is the player's pick)
//   T3 2×4  two lanterns may not shine on each other (the guide places the extra one, the player
//           takes it back); a stone between two lanterns is fine
//   T4 3×3  a number counts the lanterns right beside it (up / down / left / right, not corners)
//   T5 1×3  0 = no lantern beside it
//   end     "You're ready. Light up the town!" · "No guessing needed, ever." · [Start]
// A wrong tap is not applied: the yard shakes, the band's second line says why (2.5 s), the hand
// shows the tap again; after two wrong taps the guide makes the move. 6 s without input → the hand
// comes back. Skippable from the first yard (experienced players; the "?" pulses after a skip).
// Rules: the yards are smaller than the generator's 5×5 minimum, so they are built here as plain
// PipsLevel values (no validateLevel) and judged ONLY with the rules' own toggle (lanternsPips.apply),
// isComplete and analyzeBoard — the rules code is untouched. The session is never touched either:
// no journal, no progress, no ads unit (consentAfterUnits counts completed TRACK boards only).
// Loaded lazily (its own chunk) after the first frame, only when it runs.
import type PhaserTypes from "phaser";
import { rrectPath } from "../render/draw.ts";
import { UI } from "../render/palette.ts";
import type { TextureBank } from "../render/textures.ts";
import { vis } from "../render/vis.ts";
import type { CellInfo } from "../a11y/index.ts";
import { BoardView, type FlightEnds } from "./BoardView.ts";
import { cue, getNumberStyle, haptic, pitchIndexForCell } from "./feedback.ts";
import { ambient } from "./frameGovernor.ts";
import { type GuideActor, HandPointer } from "./guideActor.ts";
import { WickGuide } from "./WickActor.ts";
import { type BandLines, BigWord, LineBand } from "./LineBand.ts";
import { clamp01, easeOutCubic, motion } from "./motion.ts";
import { analyzeBoard, hasBit, index, lanternsPips, NO_CLUE, type PipsLevel, type PipsState, type StoneStatus } from "./pipsApi.ts";
import { solvable, yard, YARDS } from "./tutorialYards.ts";
import { makeText, primaryButton, secondaryPill, styleText } from "./uiText.ts";

type GO = PhaserTypes.GameObjects.GameObject;
type Image = PhaserTypes.GameObjects.Image;
type Text = PhaserTypes.GameObjects.Text;
type Graphics = PhaserTypes.GameObjects.Graphics;

export interface TutorialHost {
  readonly scene: PhaserTypes.Scene;
  readonly bank: TextureBank;
  /** canvas px per pt */
  readonly u: number;
  /** the free area (canvas px): from `top` (just under the house) to `bottom` (above the home indicator) */
  area(): { W: number; H: number; top: number; bottom: number; side: number; safeTop: number };
  /** draw these with the fixed UI camera */
  ui(objs: readonly GO[]): void;
  /** light k of the house's windows (0 = none, a large k = all) */
  windows(k: number): void;
  t(key: string, vars?: Record<string, string | number>): string;
  /** VoiceOver: speak a shown line */
  say(text: string): void;
  /** the tutorial is over (its objects are already gone) */
  finished(how: "done" | "skipped"): void;
  /** v12 (Wick, A4): lantern faces on — Wick is the guide (else the hand) and the yards' lanterns have faces */
  readonly faces?: boolean;
}

export interface TutorialA11y {
  controls: { id: string; label: string; x: number; y: number; w: number; h: number; act: () => void }[];
  board: { rows: number; cols: number; x: number; y: number; w: number; h: number; info: (r: number, c: number) => CellInfo; activate: (r: number, c: number) => void } | null;
  /** changes whenever a label / the board changes (the scene skips unchanged sets) */
  sig: string;
}

const CANCEL = Symbol("tutorial cancelled");
const IDLE_MS = 6000;
const WRONG_MS = 2500;
/** before the hand first shows in a step (ms); 0.5 s less after the guide had to help */
const LEAD_MS = 700;

interface Want {
  /** the cell the hand shows (and the guide takes after two wrong taps) */
  target: number;
  /** cells kept bright (the rest of the yard dims 40 %); default [target] */
  bright?: readonly number[];
  /** dashed outlines (T4: the four sides of the 2) */
  marks?: readonly number[];
  /** the hand shows the tap right away (else only after 6 s of nothing) */
  hand: boolean;
  /** null = right; else the key of the line that says why not */
  judge: (cell: number) => string | null;
  wrong: number;
  resolve: (cell: number) => void;
}

const bbHas = (bb: { lo: number; hi: number }, i: number): boolean => hasBit(bb, i);

export class Tutorial {
  private tb: BoardView | null = null;
  private level: PipsLevel = yard(YARDS.t1).level;
  private state: PipsState = yard(YARDS.t1).state;
  private band: LineBand;
  private big: BigWord;
  private actor: GuideActor;
  private overlay: Graphics | null = null;
  private hi: Image | null = null;
  private flash: Graphics | null = null;
  private dots: Graphics;
  private skipBg: Image;
  private skipTxt: Text;
  private skipBox = { x: 0, y: 0, w: 0, h: 0 };
  private card: { dim: Image; panel: Image; title: Text; sub: Text; btn: Image; btnTxt: Text };
  private cardOpen = false;
  private cardT0 = -1e9;
  private cardBox = { x: 0, y: 0, w: 0, h: 0, bx: 0, by: 0, bw: 0, bh: 0 };
  private cardDone: (() => void) | null = null;
  private now = 0;
  private timers: { at: number; fn: () => void }[] = [];
  private rejecters = new Set<(e: unknown) => void>();
  private want: Want | null = null;
  private lastInput = 0;
  private lead = LEAD_MS;
  private stepNo = 0;
  private windowsLit = 0;
  private cancelled = false;
  private over = false;
  private geo = { cs: 60, bcx: 0, bcy: 0, top: 0, bottom: 0 };
  private boardA = 0;
  private boardFadeT0 = -1e9;
  private boardFadeTo = 1;
  private shakeT0 = -1e9;
  private flashT0 = -1e9;
  private flashCell = -1;
  private base: BandLines = { main: "" };
  private baseGen = 0;
  private sig = 0;
  /** what happened (tests / logs) */
  readonly log: string[] = [];

  constructor(private readonly host: TutorialHost) {
    const s = host.scene;
    const D = 12;
    this.band = new LineBand(s, host.bank, D);
    this.big = new BigWord(s, D);
    this.actor = host.faces ? new WickGuide(s, host.bank, D) : new HandPointer(s, host.bank, D);
    this.dots = s.add.graphics().setDepth(D);
    this.skipBg = s.add.image(0, 0, "__DEFAULT").setDepth(D).setVisible(false);
    this.skipTxt = makeText(s, D).setOrigin(0.5, 0.5);
    this.card = {
      dim: s.add.image(0, 0, "__DEFAULT").setOrigin(0, 0).setDepth(35).setVisible(false),
      panel: s.add.image(0, 0, "__DEFAULT").setOrigin(0.5, 0).setDepth(35).setVisible(false),
      title: makeText(s, 35),
      sub: makeText(s, 35),
      // ambient(): the Start button's slow breathe (the governor's 20 fps reads the same)
      btn: ambient(s.add.image(0, 0, "__DEFAULT").setDepth(35).setVisible(false)),
      btnTxt: ambient(makeText(s, 35).setOrigin(0.5, 0.5)),
    };
    const c = this.card;
    host.ui([...this.band.objects, ...this.big.objects, this.skipBg, this.skipTxt, c.dim, c.panel, c.title, c.sub, c.btn, c.btnTxt]);
  }

  get active(): boolean {
    return !this.over;
  }

  /** "Tap where the hand points" — or where Wick waits (v12, faces on). */
  private get followKey(): string {
    return this.host.faces ? "tut.followWick" : "tut.follow";
  }

  /** Which step is on (1–5, 6 = the end card): tests / logs. */
  get step(): number {
    return this.stepNo;
  }

  /** The band's words now (tests). */
  get bandText(): string {
    return this.band.text;
  }

  /** Canvas-px centre of a yard cell (tests / shots). */
  cellPoint(cell: number): { x: number; y: number } {
    const tb = this.tb;
    if (!tb) return { x: 0, y: 0 };
    return { x: tb.root.x + tb.cx(cell), y: tb.root.y + tb.cy(cell) };
  }

  /** The cell the hand shows now (-1: none). */
  get target(): number {
    return this.want?.target ?? -1;
  }

  get cardButton(): { x: number; y: number } | null {
    if (!this.cardOpen) return null;
    const b = this.cardBox;
    return { x: b.x + b.bx + b.bw / 2, y: b.y + b.by + b.bh / 2 };
  }

  get skipPoint(): { x: number; y: number } | null {
    if (!this.skipBg.visible) return null;
    const b = this.skipBox;
    return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  }

  // ---------------------------------------------------------------- the script

  start(now: number): void {
    this.now = now;
    this.lastInput = now;
    void this.run();
  }

  private async run(): Promise<void> {
    const t = (k: string): string => this.host.t(k);
    try {
      // T1 — place a lantern; its light fills the row
      await this.showYard(1, YARDS.t1);
      this.say({ main: t("tut.t1") });
      await this.tap({ target: index(2, 0), hand: true, judge: (c) => (this.isLantern(c) ? this.followKey : null) });
      this.say({ main: t("tut.t1"), sub: t("tut.t1ok") });
      await this.wait(900);
      await this.celebrate(index(2, 0));

      // T2 — stones block the light; light every tile to win
      await this.showYard(2, YARDS.t2);
      this.say({ main: t("tut.t2a") });
      this.tb?.pulse(index(1, 1), this.now);
      await this.wait(1800);
      this.say({ main: t("tut.t2b"), sub: t("tut.t2a") });
      const lit = (c: number): string | null => (this.isLantern(c) || this.isLit(c) ? "tut.lit" : this.keepsSolvable(c) ? null : "tut.lit");
      let last = await this.tap({ target: index(2, 2), hand: true, judge: lit });
      while (!this.complete()) {
        const dark = this.darkCells();
        this.say({ main: t(dark.length === 1 ? "tut.t2c" : "tut.t2b") });
        last = await this.tap({ target: dark[0]!, bright: dark, hand: false, judge: lit });
      }
      await this.celebrate(last);

      // T3 — lanterns may not shine on each other; a stone between them is fine
      await this.showYard(3, YARDS.t3);
      this.say({ main: t("tut.t3a") });
      await this.wait(500);
      // the guide places the extra lantern (it sees the one already there: ✕)
      await this.guideTap(index(3, 0));
      await this.wait(1500);
      this.say({ main: t("tut.t3b"), sub: t("tut.t3a") });
      await this.tap({ target: index(3, 0), hand: true, judge: (c) => (c === index(3, 0) ? null : "tut.t3wrong") });
      this.say({ main: t("tut.t3c") });
      while (!this.complete()) {
        const dark = this.darkCells();
        last = await this.tap({ target: dark[0]!, bright: dark, hand: true, judge: lit });
      }
      this.say({ main: t("tut.t3c"), sub: t("tut.t3ok") });
      await this.wait(700);
      await this.celebrate(last);

      // T4 — a number counts the lanterns right beside it (not corners)
      await this.showYard(4, YARDS.t4);
      const two = index(1, 1);
      const sides = [index(1, 0), index(0, 1), index(2, 1), index(1, 2)];
      const corners = [index(0, 0), index(2, 0), index(0, 2), index(2, 2)];
      this.say({ main: t("tut.t4a") });
      this.marks = sides;
      this.drawOverlay();
      await this.wait(1200);
      this.say({ main: t("tut.t4a"), sub: t("tut.t4b") });
      await this.tap({
        target: index(0, 1), bright: [index(0, 1), index(2, 1), two, index(1, 0)], marks: sides, hand: true,
        judge: (c) => (corners.includes(c) ? "tut.t4corner" : c === index(0, 1) || c === index(2, 1) ? null : this.followKey),
      });
      this.marks = [];
      this.say({ main: t("tut.t4ok") });
      await this.wait(1300);
      this.say({ main: t("tut.t4c") });
      while (!this.complete()) {
        const dark = this.darkCells();
        const ok = dark.find((c) => !sides.includes(c) && this.keepsSolvable(c)) ?? dark[0]!;
        last = await this.tap({ target: ok, bright: dark, hand: false, judge: (c) => (sides.includes(c) ? "tut.t4over" : lit(c)) });
      }
      await this.celebrate(last);

      // T5 — 0 means no lantern beside it
      await this.showYard(5, YARDS.t5);
      this.say({ main: t("tut.t5a") });
      last = await this.tap({ target: index(2, 0), hand: true, judge: (c) => (c === index(1, 0) ? "tut.t5wrong" : this.isLantern(c) ? this.followKey : null) });
      await this.celebrate(last);

      // the end card
      this.stepNo = 6;
      this.log.push("end");
      this.fadeBoard(0);
      this.host.windows(99);
      await this.endCard();
      this.finish("done");
    } catch (e) {
      if (e !== CANCEL) {
        console.warn("[tutorial] failed", e);
        this.finish("skipped");
      }
    }
  }

  // ---------------------------------------------------------------- steps

  private async showYard(n: number, rows: readonly string[]): Promise<void> {
    if (this.tb) {
      this.fadeBoard(0);
      await this.wait(motion.reduced ? 0 : 220);
    }
    this.stepNo = n;
    this.log.push(`T${n}`);
    const y = yard(rows);
    this.level = y.level;
    this.state = y.state;
    const old = this.tb;
    const s = this.host.scene;
    const tb = new BoardView(s, this.host.bank);
    tb.root.setDepth(7);
    tb.setFaces(!!this.host.faces);
    this.tb = tb;
    this.overlay = s.add.graphics();
    this.flash = s.add.graphics();
    this.hi = ambient(s.add.image(0, 0, "__DEFAULT").setVisible(false));
    this.layoutYard();
    tb.root.add([this.overlay, this.hi, this.flash]);
    old?.destroy();
    this.want = null;
    this.marks = [];
    this.drawOverlay();
    this.boardA = 0;
    this.fadeBoard(1);
    this.updateSkip();
    this.drawDots();
    this.sig++;
  }

  /** Geometry for the current yard (also on a relayout). */
  private layoutYard(): void {
    const tb = this.tb;
    if (!tb) return;
    const u = this.host.u;
    const A = this.host.area();
    const lv = this.level;
    const pad = Math.round(8 * u);
    const bandRoom = 104 * u;
    const dotsRoom = 34 * u;
    const cs = Math.floor(Math.min(64 * u, (A.W - A.side * 2 - pad * 2) / lv.w, (A.bottom - A.top - bandRoom - dotsRoom - pad * 2) / lv.h));
    const boardH = cs * lv.h + pad * 2;
    const stack = bandRoom + boardH + dotsRoom;
    // a little above the middle: near the house (the eye) and still in the thumb's reach
    const y0 = A.top + Math.max(0, (A.bottom - A.top - stack) * 0.38);
    const bcy = Math.round(y0 + bandRoom + boardH / 2);
    this.geo = { cs, bcx: Math.round(A.W / 2), bcy, top: bcy - boardH / 2, bottom: bcy + boardH / 2 };
    tb.build(lv, `tutorial-${this.stepNo}`, { cs, gap: Math.max(2, Math.round(3 * u)), pad, u }, getNumberStyle(), "track");
    tb.root.setPosition(this.geo.bcx, bcy);
    tb.sync(this.state, this.now, null);
    tb.setStones(this.stoneView(), this.now, false);
    this.actor.layout(cs, u);
    this.band.layout(A.W, u);
    this.band.anchor(this.geo.bcx, this.geo.top - 14 * u);
    const rk = Math.round(cs * 1.02);
    this.hi?.setTexture(this.host.bank.canvas(`tutRing@${rk}`, rk + Math.round(8 * u), rk + Math.round(8 * u), (ctx, w, h) => {
      const lw = 3.5 * u;
      ctx.strokeStyle = "rgba(20,12,4,0.7)";
      ctx.lineWidth = lw + 3 * u;
      rrectPath(ctx, lw, lw, w - lw * 2, h - lw * 2, 10 * u);
      ctx.stroke();
      ctx.strokeStyle = UI.okRing;
      ctx.lineWidth = lw;
      rrectPath(ctx, lw, lw, w - lw * 2, h - lw * 2, 10 * u);
      ctx.stroke();
    }));
    this.layoutSkip();
    this.drawDots();
    this.drawOverlay();
  }

  /** The scene's canvas changed size / text size: lay everything out again. */
  relayout(): void {
    this.layoutYard();
    if (this.cardOpen) this.layoutCard();
    this.sig++;
  }

  private say(lines: BandLines): void {
    this.base = lines;
    this.baseGen++;
    this.band.show(lines, this.now);
    this.host.say(lines.sub ? `${lines.main} ${lines.sub}` : lines.main);
    this.sig++;
  }

  /** Wait for a right tap (wrong ones are blocked and explained). Resolves with the cell. */
  private tap(w: Omit<Want, "wrong" | "resolve">): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      this.rejecters.add(reject);
      this.want = {
        ...w, wrong: 0,
        resolve: (c) => {
          this.rejecters.delete(reject);
          this.want = null;
          this.actor.hide(this.now);
          this.drawOverlay();
          resolve(c);
        },
      };
      this.drawOverlay();
      if (w.hand) this.showHand(this.lead);
      this.lastInput = this.now;
    });
  }

  /** The guide makes a move itself (T3's extra lantern; the third chance after two wrong taps). */
  private guideTap(cell: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.rejecters.add(reject);
      this.actor.tap(this.cellPoint(cell), this.now, {
        once: true,
        onPress: () => {
          this.rejecters.delete(reject);
          this.apply(cell);
          resolve();
        },
      });
    });
  }

  private showHand(delay: number): void {
    const w = this.want;
    if (!w || w.target < 0) return;
    this.actor.tap(this.cellPoint(w.target), this.now, { delay });
  }

  private wait(ms: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.rejecters.add(reject);
      this.timers.push({
        at: this.now + ms,
        fn: () => {
          this.rejecters.delete(reject);
          resolve();
        },
      });
    });
  }

  private async celebrate(origin: number): Promise<void> {
    const tb = this.tb;
    if (!tb) return;
    const now = this.now;
    if (!motion.reduced) tb.wave(origin, now, 35, 380);
    else tb.smile(now);
    this.windowsLit++;
    this.host.windows(this.windowsLit);
    this.big.show(this.host.t(this.stepNo === 2 ? "done.solved" : "tut.nice"), this.geo.bcx, this.geo.bcy, this.host.u, now, motion.reduced ? 900 : 1000);
    const order: number[] = [];
    for (let i = 0; i < 64; i++) if (bbHas(this.state.lanterns, i)) order.push(pitchIndexForCell(i & 7, i >> 3, this.level.h));
    cue("complete", { sequence: order.length ? order : [7] });
    haptic.success();
    this.log.push(`T${this.stepNo} done`);
    await this.wait(1150);
  }

  private endCard(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.rejecters.add(reject);
      this.cardOpen = true;
      this.cardT0 = this.now;
      this.layoutCard();
      const t = (k: string): string => this.host.t(k);
      this.band.hide(this.now);
      this.host.say(`${t("tut.end")} ${t("tut.end2")}`);
      this.cardDone = () => {
        this.rejecters.delete(reject);
        resolve();
      };
      this.sig++;
    });
  }

  private layoutCard(): void {
    const c = this.card;
    const u = this.host.u;
    const A = this.host.area();
    const t = (k: string): string => this.host.t(k);
    const pw = Math.round(Math.min(A.W - 40 * u, 340 * u));
    const pad = 22 * u;
    const inner = pw - pad * 2;
    const tt = styleText(c.title, t("tut.end"), { pt: 22, u, weight: "800", wrap: inner });
    const st = styleText(c.sub, t("tut.end2"), { pt: 18, u, weight: vis.p.boldText ? "700" : "600", wrap: inner, color: UI.ink });
    const bh = Math.round(64 * u);
    const ph = Math.round(pad + tt.h + 10 * u + st.h + 22 * u + bh + pad);
    const x = Math.round(A.W / 2);
    const y = Math.round(Math.max(A.top, (A.top + A.bottom) / 2 - ph / 2));
    this.cardBox = { x: x - pw / 2, y, w: pw, h: ph, bx: pad, by: ph - pad - bh, bw: inner, bh };
    const hc = vis.p.increaseContrast;
    c.dim.setTexture(this.host.bank.canvas("tutDim", 4, 4, (ctx) => {
      ctx.fillStyle = "rgba(6,7,20,0.45)";
      ctx.fillRect(0, 0, 4, 4);
    })).setScale(A.W / 4, A.H / 4);
    c.panel.setTexture(this.host.bank.canvas(`tutCard${hc ? "C" : ""}@${pw}x${ph}`, pw, ph + Math.round(6 * u), (ctx, w) => {
      ctx.fillStyle = "rgba(6,7,20,0.4)";
      rrectPath(ctx, 0, 6 * u, w, ph, 24 * u);
      ctx.fill();
      ctx.fillStyle = UI.paper;
      rrectPath(ctx, 0, 0, w, ph, 24 * u);
      ctx.fill();
      ctx.strokeStyle = hc ? UI.ink : UI.paperEdge;
      ctx.setLineDash([5 * u, 4 * u]);
      ctx.lineWidth = 2 * u;
      rrectPath(ctx, 7 * u, 7 * u, w - 14 * u, ph - 14 * u, 18 * u);
      ctx.stroke();
      ctx.setLineDash([]);
    }));
    c.btn.setTexture(primaryButton(this.host.bank, inner, bh, u));
    styleText(c.btnTxt, t("tut.start"), { pt: 21, u, weight: "800", cap: 1.4 });
    this.cardTitleH = tt.h;
  }
  private cardTitleH = 0;

  // ---------------------------------------------------------------- input

  /** pointerdown (canvas px) */
  down(_x: number, _y: number): void {
    this.lastInput = this.now;
    // the player is acting: the hand steps aside (it comes back after 6 s of nothing)
    if (this.want && this.actor.active) this.actor.hide(this.now);
  }

  /** pointerup (canvas px) */
  up(x: number, y: number): void {
    this.lastInput = this.now;
    if (this.cardOpen) {
      const b = this.cardBox;
      const pad = 6 * this.host.u;
      if (x >= b.x + b.bx - pad && x <= b.x + b.bx + b.bw + pad && y >= b.y + b.by - pad && y <= b.y + b.by + b.bh + pad) this.pressStart();
      return;
    }
    const sb = this.skipBox;
    if (this.skipBg.visible && x >= sb.x - 6 * this.host.u && x <= sb.x + sb.w + 6 * this.host.u && y >= sb.y - 6 * this.host.u && y <= sb.y + sb.h + 6 * this.host.u) {
      this.skip();
      return;
    }
    const cell = this.tb?.cellAtWorld(x, y) ?? -1;
    if (cell >= 0) this.tapCell(cell);
  }

  private pressStart(): void {
    if (!this.cardOpen) return;
    cue("tap");
    this.cardOpen = false;
    this.cardT0 = this.now;
    this.cardDone?.();
    this.cardDone = null;
  }

  skip(): void {
    if (this.over) return;
    cue("tap");
    this.log.push("skip");
    this.cancel();
    this.finish("skipped");
  }

  /** A tap on a yard cell (also VoiceOver's activation). */
  tapCell(cell: number): void {
    const w = this.want;
    if (!w || this.over) return;
    if (bbHas(this.level.stones, cell)) {
      // a stone: not a move — say where lanterns go (the scene's stone line), no penalty
      this.tb?.pulse(cell, this.now);
      cue("stoneTap", { pitchIndex: pitchIndexForCell(cell & 7, cell >> 3, this.level.h) });
      this.wrongLine("err.stone");
      return;
    }
    const why = w.judge(cell);
    if (why === null) {
      this.apply(cell);
      w.resolve(cell);
      return;
    }
    // blocked: the yard shakes, the line says why, the hand shows the tap again
    w.wrong++;
    this.log.push(`wrong ${cell} ${why}`);
    haptic.invalid();
    cue("stoneTap", { pitchIndex: pitchIndexForCell(cell & 7, cell >> 3, this.level.h) });
    this.shakeT0 = this.now;
    this.flashT0 = this.now;
    this.flashCell = cell;
    this.wrongLine(why);
    // R2 (Reality P1-5): "Too many!" must not stand next to a 2 wearing its gold "done" ring — while the
    // line says why, the board shows what that lantern WOULD do (its number turns "over", coral)
    this.previewOver(cell);
    if (w.wrong >= 2) {
      // third time: the guide makes the move (and shows the next hands a little sooner)
      this.lead = Math.max(100, LEAD_MS - 500);
      const target = w.target;
      this.want = null;
      this.actor.tap(this.cellPoint(target), this.now, {
        delay: 300,
        once: true,
        onPress: () => {
          this.apply(target);
          w.resolve(target);
        },
      });
      return;
    }
    this.showHand(450);
  }

  /** The band's second line explains a blocked tap for 2.5 s, then the step's words come back. */
  private wrongLine(key: string): void {
    const gen = this.baseGen;
    const base = this.base;
    const text = this.host.t(key);
    // R2 (P1-4): the coral mark leads the line that says what went wrong (the second one), not the goal
    this.band.show({ main: base.main, sub: text, tone: "warn", warnLine: "sub" }, this.now);
    this.host.say(text);
    this.sig++;
    this.timers.push({
      at: this.now + WRONG_MS,
      fn: () => {
        if (this.baseGen === gen && !this.over) {
          this.band.show(base, this.now);
          this.sig++;
        }
      },
    });
  }

  // ---------------------------------------------------------------- the yard's state (rules' toggle only)

  private apply(cell: number): void {
    const tb = this.tb;
    const next = lanternsPips.apply(this.state, { x: cell & 7, y: cell >> 3 });
    if (!next || !tb) return;
    const placed = bbHas(next.lanterns, cell);
    this.state = next;
    const cs = this.geo.cs;
    const ends: FlightEnds = placed
      ? { x: tb.cx(cell), y: tb.cy(cell) - cs * 1.0, scale: 0.75 }
      : { x: tb.cx(cell), y: tb.cy(cell) - cs * 0.9, scale: 0.85, fade: true };
    const res = tb.sync(next, this.now, { cell, placed, ends });
    tb.setStones(this.stoneView(), this.now, true);
    const p = pitchIndexForCell(cell & 7, cell >> 3, this.level.h);
    if (placed) {
      haptic.place();
      cue("place", { pitchIndex: p, litCount: res.newlyLit });
      cue("spread", { pitchIndex: p, litCount: res.newlyLit });
      if (res.invalid) setTimeout(() => cue("invalid", { sequence: [p] }), motion.reduced ? 0 : 140);
    } else {
      haptic.remove();
      cue("remove", { pitchIndex: p });
    }
    this.sig++;
  }

  /** The numbers a lantern on `cell` would push over show "over" until the wrong line goes (R2, P1-5). */
  private previewOver(cell: number): void {
    const tb = this.tb;
    const next = lanternsPips.apply(this.state, { x: cell & 7, y: cell >> 3 });
    if (!tb || !next || !bbHas(next.lanterns, cell)) return;
    const view = this.stoneView(next);
    if (!view.some((v) => v.status === "over")) return;
    tb.setStones(view, this.now, true);
    const gen = this.baseGen;
    const st = this.state;
    this.timers.push({
      at: this.now + WRONG_MS,
      fn: () => {
        if (this.baseGen === gen && !this.over && this.state === st) this.tb?.setStones(this.stoneView(), this.now, true);
      },
    });
  }

  private stoneView(state: PipsState = this.state): { cell: number; status: StoneStatus }[] {
    const a = analyzeBoard(this.level, state);
    const lv = this.level;
    return a.stones.map((st) => {
      if (st.need !== 0 || st.status !== "ok") return st;
      // a 0 shows "done" only once everything around it is lit (as on the real board)
      const around = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [(st.cell & 7) + dx!, (st.cell >> 3) + dy!] as const)
        .filter(([x, y]) => x >= 0 && y >= 0 && x < lv.w && y < lv.h);
      const done = around.every(([x, y]) => bbHas(lv.stones, index(x, y)) || a.lit[index(x, y)] === 1);
      return { cell: st.cell, status: done ? "ok" : "under" };
    });
  }

  private isLantern(c: number): boolean {
    return bbHas(this.state.lanterns, c);
  }

  private isLit(c: number): boolean {
    return analyzeBoard(this.level, this.state).lit[c] === 1;
  }

  private complete(): boolean {
    return lanternsPips.isComplete(this.state);
  }

  private darkCells(): number[] {
    const a = analyzeBoard(this.level, this.state);
    const out: number[] = [];
    for (let y = 0; y < this.level.h; y++) for (let x = 0; x < this.level.w; x++) {
      const i = index(x, y);
      if (!bbHas(this.level.stones, i) && a.lit[i] !== 1) out.push(i);
    }
    return out;
  }

  /** A lantern on `c` keeps the yard finishable (no conflict, no number over, still solvable). */
  private keepsSolvable(c: number): boolean {
    const next = lanternsPips.apply(this.state, { x: c & 7, y: c >> 3 });
    if (!next) return false;
    const a = analyzeBoard(this.level, next);
    if (a.conflicts.length > 0 || a.stones.some((st) => st.status === "over")) return false;
    return solvable(this.level, next);
  }

  // ---------------------------------------------------------------- drawing

  private marks: readonly number[] = [];

  /** Dim the yard 40 % except the cells that matter; a breathing gold frame on the target; dashed outlines. */
  private drawOverlay(): void {
    const g = this.overlay;
    const tb = this.tb;
    if (!g || !tb) return;
    g.clear();
    const w = this.want;
    const cs = this.geo.cs;
    const bright = new Set<number>(w ? (w.bright ?? [w.target]) : []);
    if (w && bright.size > 0) {
      g.fillStyle(0x060714, 0.4);
      for (let y = 0; y < this.level.h; y++) for (let x = 0; x < this.level.w; x++) {
        const i = index(x, y);
        if (bright.has(i)) continue;
        g.fillRect(tb.cx(i) - cs / 2, tb.cy(i) - cs / 2, cs, cs);
      }
    }
    const marks = w?.marks ?? this.marks;
    if (marks.length > 0) {
      const u = this.host.u;
      for (const i of marks) {
        const x0 = tb.cx(i) - cs / 2 + 4 * u;
        const y0 = tb.cy(i) - cs / 2 + 4 * u;
        const s = cs - 8 * u;
        for (const [lw, col, a] of [[5 * u, 0x140c04, 0.6], [2.5 * u, 0xffc864, 1]] as const) {
          g.lineStyle(lw, col, a);
          const dash = 7 * u;
          const gap = 5 * u;
          const edges: [number, number, number, number][] = [[x0, y0, 1, 0], [x0 + s, y0, 0, 1], [x0 + s, y0 + s, -1, 0], [x0, y0 + s, 0, -1]];
          for (const [ex, ey, dx, dy] of edges) {
            for (let d = 0; d < s; d += dash + gap) {
              const e = Math.min(s, d + dash);
              g.lineBetween(ex + dx * d, ey + dy * d, ex + dx * e, ey + dy * e);
            }
          }
        }
      }
    }
    const hi = this.hi;
    if (hi) {
      if (w && w.target >= 0 && (w.bright ?? [w.target]).length === 1) hi.setVisible(true).setPosition(tb.cx(w.target), tb.cy(w.target));
      else hi.setVisible(false);
    }
  }

  private drawDots(): void {
    const g = this.dots.clear();
    if (this.stepNo < 1 || this.stepNo > 5) return;
    const u = this.host.u;
    const y = this.geo.bottom + 20 * u;
    const pitch = 18 * u;
    for (let k = 0; k < 5; k++) {
      const x = this.geo.bcx + (k - 2) * pitch;
      const n = k + 1;
      if (n < this.stepNo) {
        g.fillStyle(0xf4ebd0, 0.9);
        g.fillCircle(x, y, 4.5 * u);
      } else if (n === this.stepNo) {
        g.fillStyle(0xffc864, 1);
        g.fillCircle(x, y, 6 * u);
      } else {
        g.lineStyle(1.6 * u, 0xf4ebd0, 0.6);
        g.strokeCircle(x, y, 4.5 * u);
      }
    }
  }

  private layoutSkip(): void {
    const u = this.host.u;
    const A = this.host.area();
    const sz = styleText(this.skipTxt, this.host.t("tut.skip"), { pt: 17, u, weight: "700", color: UI.caption, cap: 1.4 });
    const w = Math.round(Math.max(64 * u, sz.w + 28 * u));
    const h = Math.round(44 * u);
    // top left (the gear's corner — hidden during the tutorial; the moon sits top right)
    const x = Math.round(Math.max(A.side, 12 * u));
    const y = Math.round(A.safeTop + 8 * u);
    this.skipBox = { x, y, w, h };
    // R2 HUD grammar (Reality #20): Skip is a secondary pill — outline only, cream 40 %
    this.skipBg.setTexture(secondaryPill(this.host.bank, w, h, u)).setPosition(x + w / 2, y + h / 2);
    this.skipTxt.setPosition(x + w / 2, y + h / 2);
  }

  /** Skip: from the first yard, first run included — a player who knows the rules is never held in the lesson. */
  private updateSkip(): void {
    const on = !this.over && !this.cardOpen;
    this.skipBg.setVisible(on);
    this.skipTxt.setVisible(on);
  }

  private fadeBoard(to: number): void {
    this.boardFadeT0 = this.now;
    this.boardFadeTo = to;
    this.boardFrom = this.boardA;
  }
  private boardFrom = 0;

  update(now: number): void {
    this.now = now;
    if (this.over) return;
    // timers (a resolve may add more: run until none is due)
    for (let guard = 0; guard < 8; guard++) {
      const due = this.timers.filter((x) => x.at <= now);
      if (due.length === 0) break;
      this.timers = this.timers.filter((x) => x.at > now);
      for (const d of due) d.fn();
    }
    // 6 s without input: the hand shows the tap again
    const w = this.want;
    if (w && !this.actor.active && now - this.lastInput >= IDLE_MS) {
      this.lastInput = now;
      this.showHand(0);
    }
    const tb = this.tb;
    if (tb) {
      const k = motion.reduced ? 1 : clamp01((now - this.boardFadeT0) / (this.boardFadeTo > this.boardFrom ? 260 : 200));
      this.boardA = this.boardFrom + (this.boardFadeTo - this.boardFrom) * easeOutCubic(k);
      const st = now - this.shakeT0;
      const dx = st >= 0 && st < 360 && !motion.reduced ? Math.sin(st / 28) * 6 * this.host.u * (1 - st / 360) : 0;
      tb.root.setAlpha(this.boardA).setPosition(this.geo.bcx + dx, this.geo.bcy);
      tb.update(now);
      // the target's frame breathes (ambient: its slow breathe reads the same at 20 fps)
      if (this.hi?.visible) this.hi.setAlpha(motion.reduced ? 1 : 0.7 + 0.3 * Math.sin(now / 380));
      const f = this.flash;
      if (f) {
        const ft = (now - this.flashT0) / 420;
        f.clear();
        if (ft >= 0 && ft < 1 && this.flashCell >= 0) {
          const cs = this.geo.cs;
          f.fillStyle(0xf2907a, 0.45 * (1 - ft));
          f.fillRect(tb.cx(this.flashCell) - cs / 2, tb.cy(this.flashCell) - cs / 2, cs, cs);
        }
      }
    }
    this.dots.setAlpha(this.boardA);
    this.band.update(now);
    this.big.update(now);
    this.actor.update(now);
    this.updateSkip();
    this.stepCard(now);
  }

  private stepCard(now: number): void {
    const c = this.card;
    const t = motion.reduced ? 1 : clamp01((now - this.cardT0) / (this.cardOpen ? 300 : 200));
    const v = this.cardOpen ? easeOutCubic(t) : 1 - t;
    const on = v > 0.001 && this.stepNo === 6;
    for (const o of [c.dim, c.panel, c.title, c.sub, c.btn, c.btnTxt]) o.setVisible(on);
    if (!on) return;
    const b = this.cardBox;
    const u = this.host.u;
    const dy = motion.reduced ? 0 : (1 - v) * 18 * u;
    const pad = 22 * u;
    c.dim.setAlpha(v);
    c.panel.setAlpha(v).setPosition(b.x + b.w / 2, b.y + dy);
    c.title.setAlpha(v).setPosition(b.x + b.w / 2, b.y + pad + dy);
    c.sub.setAlpha(v).setPosition(b.x + b.w / 2, b.y + pad + this.cardTitleH + 10 * u + dy);
    const pulse = this.cardOpen && !motion.reduced ? 1 + 0.025 * Math.sin(now / 420) : 1;
    c.btn.setAlpha(v).setPosition(b.x + b.bx + b.bw / 2, b.y + b.by + b.bh / 2 + dy).setScale(pulse);
    c.btnTxt.setAlpha(v).setPosition(b.x + b.bx + b.bw / 2, b.y + b.by + b.bh / 2 - 2 * u + dy).setScale(pulse);
  }

  // ---------------------------------------------------------------- VoiceOver

  a11y(): TutorialA11y {
    const controls: TutorialA11y["controls"] = [];
    if (this.band.isOpen) {
      const r = this.band.rect();
      controls.push({ id: "tut-band", label: this.band.text, ...r, act: () => undefined });
    }
    if (this.skipBg.visible) {
      const b = this.skipBox;
      controls.push({ id: "tut-skip", label: this.host.t("tut.skip"), ...b, act: () => this.skip() });
    }
    if (this.cardOpen) {
      const b = this.cardBox;
      controls.push({ id: "tut-end", label: `${this.host.t("tut.end")} ${this.host.t("tut.end2")}`, x: b.x, y: b.y, w: b.w, h: b.by, act: () => undefined });
      controls.push({ id: "tut-start", label: this.host.t("tut.start"), x: b.x + b.bx, y: b.y + b.by, w: b.bw, h: b.bh, act: () => this.pressStart() });
    }
    const tb = this.tb;
    const board = tb && !this.cardOpen && this.boardA > 0.5
      ? {
        rows: this.level.h, cols: this.level.w, x: tb.root.x - tb.boardW / 2, y: tb.root.y - tb.boardH / 2, w: tb.boardW, h: tb.boardH,
        info: (r: number, c: number): CellInfo => this.cellInfo(r, c),
        activate: (r: number, c: number): void => this.tapCell(index(c, r)),
      }
      : null;
    return { controls, board, sig: `${this.sig}:${this.state.lanterns.lo}:${this.cardOpen ? 1 : 0}` };
  }

  private cellInfo(row: number, col: number): CellInfo {
    const i = index(col, row);
    const lv = this.level;
    if (bbHas(lv.stones, i)) {
      const n = lv.clues[i]!;
      if (n === NO_CLUE) return { row, col, kind: "rock", number: null };
      let around = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const x = col + dx;
        const y = row + dy;
        if (x >= 0 && y >= 0 && x < lv.w && y < lv.h && bbHas(this.state.lanterns, index(x, y))) around++;
      }
      return { row, col, kind: "rock", number: n, around };
    }
    if (bbHas(this.state.lanterns, i)) return { row, col, kind: "lantern", conflict: analyzeBoard(lv, this.state).conflicts.some(([p, q]) => p === i || q === i) };
    return { row, col, kind: "floor", lit: this.isLit(i) };
  }

  // ---------------------------------------------------------------- end

  /** Stop everything now (a restore landed, the scene goes away); the host decides what follows. */
  cancel(): void {
    if (this.cancelled) return;
    this.cancelled = true;
    for (const r of this.rejecters) r(CANCEL);
    this.rejecters.clear();
    this.timers = [];
  }

  private finish(how: "done" | "skipped"): void {
    if (this.over) return;
    this.over = true;
    this.cancel();
    this.log.push(how);
    this.destroy();
    this.host.finished(how);
  }

  /** Remove every object (the yard's textures too). */
  destroy(): void {
    this.over = true;
    this.tb?.destroy();
    this.tb = null;
    this.overlay = null;
    this.hi = null;
    this.flash = null;
    this.actor.destroy();
    for (const o of [...this.band.objects, ...this.big.objects, this.dots, this.skipBg, this.skipTxt, ...Object.values(this.card)]) o.destroy();
  }
}
