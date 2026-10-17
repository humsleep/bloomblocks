// Wordless first-run guide: a ghost finger that shows, never tells.
//   goal      (gentle 1, first)  a card over the courtyard: a tiny 3×3 yard, the finger
//                         sets four lanterns, every tile lights, the "4" turns gold and
//                         the house's windows all glow = "this is winning"
//   tap       (gentle 1)  finger taps a cell → a ghost lantern + its light spreading
//   digit     (gentle 2)  finger places the lanterns a numbered rock needs → they light the
//                         floor like real lanterns → the finger points AT the rock as its digit
//                         turns gold. Round 5: then the 0 — the finger tries a lantern next to a
//                         0 rock → the 0 turns coral "too many", shakes, a coral ✕ pops → the
//                         finger takes it back and moves away (testers: "it never taught 0")
//   conflict  (gentle 3)  finger places a lantern, then a second one inside its light → both
//                         get a coral rim, a coral ✕ pops between them and they shake ("not
//                         allowed") → finger takes the second one back → the ✕ disappears
//   remove    (gentle 1–3, any time two real lanterns see each other and the player
//                         pauses) finger taps one of them
//   track     (after the tower's first-unlock look, until the player taps it) finger taps the
//                         far tower on the ridge (round 5: the track entrance is a place)
//   moon      (phase 2: once, after gentle 3, while today's daily is unplayed) finger taps the moon
// Phase 2: the demo lanterns are the REAL lantern + flame + halo (v6's white ghost ring read as
// "not a lantern", 5/8); the moonlit ghost stays the hint's own look. Every finger ends on the
// cell it means and fades out as it leaves (it never comes to rest on another cell).
// Every demo loops until the player plays (the scene calls stop()); nothing here
// touches the session. Display objects live in world space at DEPTH.guide and
// read cell centres through `cellAt` each frame, so they follow the board.
import type PhaserTypes from "phaser";
import Phaser from "../phaser.ts";
import { drawFloorTile, drawNumberedRock, drawPanel, rrectPath } from "../render/draw.ts";
import { PAL } from "../render/palette.ts";
import { rng } from "../render/rng.ts";
import type { TextureBank } from "../render/textures.ts";
import type { BoardView } from "./BoardView.ts";
import { clamp01, easeInOutCubic, easeOutBack, easeOutCubic, lerp, motion } from "./motion.ts";

type Image = PhaserTypes.GameObjects.Image;

export type Demo =
  | { kind: "goal" }
  | { kind: "tap"; cell: number }
  | { kind: "digit"; stone: number; cells: readonly number[]; zero?: { stone: number; cell: number } }
  | { kind: "conflict"; a: number; b: number }
  | { kind: "remove"; cell: number }
  | { kind: "track"; x: number; y: number }
  | { kind: "moon"; x: number; y: number };

const GUIDE_DEPTH = 11;
/** finger rotations tried in order (rad, + = clockwise): straight down, then down-right, down-left, right, left */
export const HAND_ANGLES = [0, -0.75, 0.75, -1.35, 1.35];
/** …and hand above the tip (only when the tip is not on a digit itself) */
const HAND_ANGLES_UP = [-2.2, 2.2, Math.PI];
const NOT_YET = 1e15;

export class Guide {
  private finger: Image;
  private ripple: Image;
  /** demo lanterns: real body + flame (additive) + warm halo (additive) */
  private ghosts: Image[] = [];
  private gFlames: Image[] = [];
  private gHalos: Image[] = [];
  private line: PhaserTypes.GameObjects.Graphics;
  private demo: Demo | null = null;
  private t0 = 0;
  private loop = -1;
  private fired = 0;
  private rippleT0 = -1e9;
  // NOT_YET = "not started in this loop" (a start time in the far future keeps it hidden)
  private ghostT0 = new Float64Array(5).fill(NOT_YET);
  private ghostOut = new Float64Array(5).fill(-1e9);
  /** the 0-rock part of the digit lesson: its coral ✕ in / out */
  private zxT0 = NOT_YET;
  private zxOut = -1e9;
  private lineT0 = NOT_YET;
  private lineOut = -1e9;
  private cs = 1;
  private u = 1;
  /** loops played since start (the scene stops one-shot demos after a few) */
  loops = 0;
  // conflict lesson: coral ✕ + coral rims behind the two ghosts, shake time
  private xImg: Image;
  private rims: Image[] = [];
  private shakeT0 = NOT_YET;
  // goal card: panel + baked 3×3 yard + its lit tiles, lanterns, flames and the digit
  private card: PhaserTypes.GameObjects.Container;
  private cardPanel: Image;
  private cardYard: Image;
  private cardLit: Image[] = [];
  private cardLan: Image[] = [];
  private cardFlame: Image[] = [];
  private cardDigit: Image;
  private cardGold: Image;
  private mcs = 1;
  private goalOn = false;
  /** the scene lights / restores the house windows for the goal card */
  onGoalWindows: ((on: boolean) => void) | null = null;

  constructor(
    private readonly scene: PhaserTypes.Scene,
    private readonly bank: TextureBank,
    private readonly board: BoardView,
  ) {
    const s = scene;
    this.line = s.add.graphics().setDepth(GUIDE_DEPTH).setVisible(false);
    this.card = s.add.container(0, 0).setDepth(GUIDE_DEPTH).setVisible(false);
    this.cardPanel = s.add.image(0, 0, "__DEFAULT");
    this.cardYard = s.add.image(0, 0, "__DEFAULT");
    this.card.add([this.cardPanel, this.cardYard]);
    for (let k = 0; k < 8; k++) this.cardLit.push(s.add.image(0, 0, "__DEFAULT").setVisible(false));
    this.card.add(this.cardLit);
    this.cardDigit = s.add.image(0, 0, "__DEFAULT");
    this.cardGold = s.add.image(0, 0, "__DEFAULT").setVisible(false);
    this.card.add([this.cardDigit, this.cardGold]);
    for (let k = 0; k < 4; k++) {
      this.cardLan.push(s.add.image(0, 0, "__DEFAULT").setOrigin(0.5, 0.56).setVisible(false));
      this.cardFlame.push(s.add.image(0, 0, "__DEFAULT").setBlendMode(1).setVisible(false));
    }
    this.card.add(this.cardLan);
    this.card.add(this.cardFlame);
    for (let k = 0; k < 2; k++) this.rims.push(s.add.image(0, 0, "__DEFAULT").setDepth(GUIDE_DEPTH).setVisible(false));
    this.xImg = s.add.image(0, 0, "__DEFAULT").setDepth(GUIDE_DEPTH).setVisible(false);
    for (let k = 0; k < 5; k++) {
      this.gHalos.push(s.add.image(0, 0, "__DEFAULT").setBlendMode(Phaser.BlendModes.ADD).setDepth(GUIDE_DEPTH).setVisible(false));
      this.ghosts.push(s.add.image(0, 0, "__DEFAULT").setOrigin(0.5, 0.56).setDepth(GUIDE_DEPTH).setVisible(false));
      this.gFlames.push(s.add.image(0, 0, "__DEFAULT").setBlendMode(Phaser.BlendModes.ADD).setDepth(GUIDE_DEPTH).setVisible(false));
    }
    this.ripple = s.add.image(0, 0, "__DEFAULT").setDepth(GUIDE_DEPTH).setVisible(false);
    this.finger = s.add.image(0, 0, "__DEFAULT").setOrigin(0.36, 0.05).setDepth(GUIDE_DEPTH + 1).setVisible(false);
  }

  /** New board geometry (cell size px, dpr). */
  layout(cs: number, u: number): void {
    this.cs = cs;
    this.u = u;
    const fh = Math.round(Math.min(Math.max(cs * 1.05, 58 * u), 86 * u));
    this.finger.setTexture(this.bank.finger(fh));
    this.ripple.setTexture(this.bank.ripple(Math.round(Math.max(cs * 0.8, 40 * u)), u));
    // the real lantern (same textures as BoardView's rigs), not the hint's moonlit ghost
    const lk = this.bank.lantern(this.board.lanternH, 1);
    const fk = this.bank.flame(Math.round(cs * 0.6), false);
    const hk = this.bank.halo(Math.round(cs * 2.8));
    for (let k = 0; k < this.ghosts.length; k++) {
      this.ghosts[k]!.setTexture(lk);
      this.gFlames[k]!.setTexture(fk);
      this.gHalos[k]!.setTexture(hk);
    }
    const rk = this.bank.coralHalo(Math.round(cs * 1.4));
    for (const r of this.rims) r.setTexture(rk);
    this.xImg.setTexture(this.bank.conflictX(Math.round(cs * 0.8)));
    this.layoutCard();
  }

  /** The goal card covers the courtyard; its 3×3 yard is centred on it. */
  private layoutCard(): void {
    const u = this.u;
    const bw = this.board.boardW + 16 * u;
    const bh = this.board.boardH + 16 * u;
    const mcs = Math.round(Math.min((bw * 0.62) / 3, 84 * u));
    this.mcs = mcs;
    const gap = Math.max(2, Math.round(3 * u));
    this.cardPanel.setTexture(this.bank.canvas(`goalPanel@${Math.round(bw)}x${Math.round(bh)}`, bw, bh, (ctx, w, h) => {
      drawPanel(ctx, w, h, 18 * u, u);
      ctx.fillStyle = "rgba(10,12,30,0.35)";
      ctx.fillRect(0, 0, w, h);
    }));
    const ys = mcs * 3 + 16 * u;
    this.cardYard.setTexture(this.bank.canvas(`goalYard@${mcs}`, ys, ys, (ctx) => {
      const r = rng(0x60a1);
      const p = 8 * u;
      rrectPath(ctx, p - gap, p - gap, mcs * 3 + gap * 2, mcs * 3 + gap * 2, 10 * u);
      ctx.fillStyle = PAL.grout;
      ctx.fill();
      for (let i = 0; i < 9; i++) {
        const x = i % 3;
        const y = Math.floor(i / 3);
        if (i === 4) continue;
        drawFloorTile(ctx, p + x * mcs + gap / 2, p + y * mcs + gap / 2, mcs - gap, mcs * 0.14, r);
      }
      drawNumberedRock(ctx, p + mcs * 1.5, p + mcs * 1.5, mcs, rng(0x4));
    }));
    const lit = this.bank.lit(mcs, gap);
    GOAL_FLOOR.forEach((c, k) => this.cardLit[k]!.setTexture(lit).setPosition(this.mx(c), this.my(c)));
    const lh = Math.round(mcs * 0.8);
    for (let k = 0; k < 4; k++) {
      this.cardLan[k]!.setTexture(this.bank.lantern(lh, 1));
      this.cardFlame[k]!.setTexture(this.bank.flame(Math.round(mcs * 0.6), false));
    }
    const oy = this.bank.numberOffsetY(mcs);
    this.cardDigit.setTexture(this.bank.number(mcs, 4, "ink", "digits")).setPosition(0, oy);
    this.cardGold.setTexture(this.bank.number(mcs, 4, "warm", "digits")).setPosition(0, oy);
  }

  private mx(c: number): number {
    return ((c % 3) - 1) * this.mcs;
  }
  private my(c: number): number {
    return (Math.floor(c / 3) - 1) * this.mcs;
  }

  get active(): Demo | null {
    return this.demo;
  }

  start(d: Demo, now: number): void {
    this.stop();
    this.demo = d;
    this.t0 = now;
    this.loop = -1;
    this.loops = 0;
    this.fired = 0;
  }

  stop(): void {
    if (!this.demo) return;
    const d = this.demo;
    this.demo = null;
    this.finger.setVisible(false);
    this.ripple.setVisible(false);
    for (let k = 0; k < this.ghosts.length; k++) {
      this.ghosts[k]!.setVisible(false);
      this.gFlames[k]!.setVisible(false);
      this.gHalos[k]!.setVisible(false);
    }
    this.line.clear().setVisible(false);
    this.xImg.setVisible(false);
    for (const r of this.rims) r.setVisible(false);
    this.card.setVisible(false);
    if (this.goalOn) {
      this.goalOn = false;
      this.onGoalWindows?.(false);
    }
    if (d.kind === "tap" || d.kind === "digit" || d.kind === "conflict") this.board.clearPreviews();
  }

  private world(i: number): { x: number; y: number } {
    const r = this.board.root;
    return { x: r.x + this.board.cx(i) * r.scaleX, y: r.y + this.board.cy(i) * r.scaleY };
  }

  private period(d: Demo): number {
    switch (d.kind) {
      case "goal":
        return 5600;
      case "tap":
        return 2800;
      case "digit":
        return 250 + 700 * d.cells.length + (d.zero ? 3500 : 2450);
      case "conflict":
        return 3900;
      case "remove":
        return 2000;
      case "track":
      case "moon":
        return 2000;
    }
  }

  private fRot = 0;

  /**
   * Rotation for the finger whose tip is at (x, y): straight (hand below the tip) unless the hand
   * would lie over a numbered rock other than the one it points at; then the first side-on angle
   * whose hand is clear (never upward: that would cover the digit the tip points at).
   */
  private handAngle(x: number, y: number): number {
    const tip = this.board.cellAtWorld(x, y);
    const cs = this.cs;
    // the hand may point down from above only when the tip is not itself on a digit
    const up = this.board.isNumber(tip) ? [] : HAND_ANGLES_UP;
    let best = 0;
    let bestHits = 1e9;
    // keep the current angle while it is clear (no flip-flop while the finger moves)
    for (const a of [this.fRot, ...HAND_ANGLES, ...up]) {
      const dx = -Math.sin(a);
      const dy = Math.cos(a);
      let hits = 0;
      for (const k of [0.55, 0.95, 1.3]) {
        const c = this.board.cellAtWorld(x + dx * k * cs, y + dy * k * cs);
        if (c !== tip && this.board.isNumber(c)) hits++;
      }
      if (hits === 0) return a;
      if (hits < bestHits) {
        best = a;
        bestHits = hits;
      }
    }
    return best;
  }

  /** Fire `bit` once per loop when the loop time passes `at`. */
  private once(bit: number, t: number, at: number): boolean {
    if (t < at || this.fired & bit) return false;
    this.fired |= bit;
    return true;
  }

  private press(x: number, y: number, now: number): void {
    this.rippleT0 = now;
    this.ripple.setPosition(x, y);
  }

  update(now: number): void {
    const d = this.demo;
    if (!d) return;
    const per = this.period(d);
    const e = now - this.t0;
    const loop = Math.floor(e / per);
    const t = e - loop * per;
    if (loop !== this.loop) {
      this.loop = loop;
      this.loops = loop;
      this.fired = 0;
      for (let k = 0; k < 5; k++) {
        this.ghostT0[k] = NOT_YET;
        this.ghostOut[k] = -1e9;
      }
      this.zxT0 = NOT_YET;
      this.zxOut = -1e9;
      this.lineT0 = NOT_YET;
      this.lineOut = -1e9;
      this.shakeT0 = NOT_YET;
      if (d.kind === "digit") {
        this.board.previewStone(d.stone, 0);
        if (d.zero) this.board.previewOver(d.zero.stone, 0, now);
      }
    }
    const cs = this.cs;
    const rest = (p: { x: number; y: number }): { x: number; y: number } => ({ x: p.x + cs * 0.75, y: p.y + cs * 1.05 });
    /** a short lift-off from a point: the finger fades out on the way (it never lands elsewhere) */
    const leave = (p: { x: number; y: number }): { x: number; y: number } => ({ x: p.x + cs * 0.28, y: p.y + cs * 0.42 });
    // finger path: list of [time, point, pressed]
    let fx = 0;
    let fy = 0;
    let fa = 1;
    let fs = 1;
    const moveTo = (from: { x: number; y: number }, to: { x: number; y: number }, ta: number, tb: number): boolean => {
      if (t < ta || t > tb) return false;
      const k = easeInOutCubic(clamp01((t - ta) / (tb - ta)));
      fx = lerp(from.x, to.x, k);
      fy = lerp(from.y, to.y, k);
      return true;
    };
    const fadeEdges = (inEnd: number, outStart: number, outEnd: number): number =>
      Math.min(clamp01(t / inEnd), 1 - clamp01((t - outStart) / (outEnd - outStart)));
    const pressScale = (at: number): number => (t >= at && t < at + 160 ? 0.9 : 1);

    if (d.kind === "goal") {
      this.updateGoal(t, per, now);
      return;
    }
    if (d.kind === "tap" || d.kind === "remove") {
      const p = this.world(d.cell);
      const r = rest(p);
      fx = r.x;
      fy = r.y;
      moveTo(r, p, 250, 750);
      if (t > 750 && t < 1500) {
        fx = p.x;
        fy = p.y;
      }
      const away = leave(p);
      moveTo(p, away, 1500, 1900);
      if (t >= 1900) {
        fx = away.x;
        fy = away.y;
      }
      fs = pressScale(750);
      fa = fadeEdges(250, 1500, 1900);
      if (this.once(1, t, 750)) {
        this.press(p.x, p.y, now);
        if (d.kind === "tap") {
          this.ghostT0[0] = now;
          this.board.previewLight(d.cell, true, now);
        }
      }
      if (d.kind === "tap" && this.once(2, t, per - 600)) {
        this.ghostOut[0] = now;
        this.board.previewLight(d.cell, false, now);
      }
      if (d.kind === "tap") this.placeGhost(0, p, now);
    } else if (d.kind === "digit") {
      const n = d.cells.length;
      const pts = d.cells.map((c) => this.world(c));
      const s = this.world(d.stone);
      let prev = rest(pts[0]!);
      fx = prev.x;
      fy = prev.y;
      for (let k = 0; k < n; k++) {
        const ta = 250 + 700 * k;
        const p = pts[k]!;
        moveTo(prev, p, ta, ta + 400);
        if (t > ta + 400 && t <= ta + 700) {
          fx = p.x;
          fy = p.y;
        }
        if (t >= ta + 400 && t < ta + 560) fs = 0.9;
        if (this.once(1 << k, t, ta + 400)) {
          this.press(p.x, p.y, now);
          this.ghostT0[k] = now;
          // placed lanterns light the floor exactly like real ones
          this.board.previewLight(d.cells[k]!, true, now);
        }
        prev = p;
      }
      const tl = 250 + 700 * n;
      // the finger ends ON the rock (tip just under its digit) while the digit turns gold:
      // v5's finger rested beside it and pointed at nothing
      const at = { x: s.x + cs * 0.12, y: s.y + cs * 0.24 };
      moveTo(prev, at, tl, tl + 400);
      if (t > tl + 400) {
        fx = at.x;
        fy = at.y;
      }
      const gold = clamp01((t - (tl + 150)) / 250) * (1 - clamp01((t - (per - 550)) / 300));
      this.board.previewStone(d.stone, gold);
      if (d.zero) {
        // the 0: a lantern next to it is one too many
        const z0 = tl + 1200;
        const zc = this.world(d.zero.cell);
        const zs = this.world(d.zero.stone);
        const away = leave(zc);
        moveTo(at, zc, z0, z0 + 400);
        if (t > z0 + 400 && t <= z0 + 1300) {
          fx = zc.x;
          fy = zc.y;
        }
        moveTo(zc, away, z0 + 1450, z0 + 1850);
        if (t > z0 + 1850) {
          fx = away.x;
          fy = away.y;
        }
        if ((t >= z0 + 400 && t < z0 + 560) || (t >= z0 + 1300 && t < z0 + 1460)) fs = 0.9;
        if (this.once(32, t, z0 + 400)) {
          this.press(zc.x, zc.y, now);
          this.ghostT0[4] = now;
        }
        if (this.once(64, t, z0 + 560)) {
          this.board.previewOver(d.zero.stone, 1, now, true);
          this.zxT0 = now;
        }
        if (this.once(128, t, z0 + 1300)) {
          this.press(zc.x, zc.y, now);
          this.ghostOut[4] = now;
          this.zxOut = now;
          this.board.previewOver(d.zero.stone, 0, now);
        }
        this.placeGhost(4, zc, now, true);
        // coral ✕ between the tried lantern and the 0 rock ("not allowed here")
        const tin = (now - this.zxT0) / 220;
        const tout = this.zxOut > this.zxT0 ? (now - this.zxOut) / 260 : -1;
        if (tin >= 0 && tout < 1) {
          const v = clamp01(tin) * (tout >= 0 ? 1 - tout : 1);
          const pop = motion.reduced ? 1 : easeOutBack(clamp01(tin));
          // nearer the tried cell than the rock: the ✕ never covers the 0
          this.xImg.setVisible(true).setPosition(zs.x + (zc.x - zs.x) * 0.68, zs.y + (zc.y - zs.y) * 0.68).setAlpha(v).setScale(0.5 + 0.5 * pop);
        } else if (this.xImg.visible) this.xImg.setVisible(false);
      }
      // (late fade-out + quick finger fade-in: the board is never bare for more than ~0.25 s
      // between loops — r6 testers saw a "bare board" frame of the lesson)
      if (this.once(16, t, per - 400)) {
        for (let k = 0; k < n; k++) {
          this.ghostOut[k] = now;
          this.board.previewLight(d.cells[k]!, false, now);
        }
      }
      // without the 0 part the finger stays on the rock while it glows, then leaves fading
      if (!d.zero) {
        const away = leave(at);
        moveTo(at, away, per - 600, per - 250);
        if (t > per - 250) {
          fx = away.x;
          fy = away.y;
        }
        fa = fadeEdges(120, per - 600, per - 250);
      } else fa = fadeEdges(120, tl + 1200 + 1450, tl + 1200 + 1850);
      for (let k = 0; k < n; k++) this.placeGhost(k, pts[k]!, now);
    } else if (d.kind === "conflict") {
      const a = this.world(d.a);
      const b = this.world(d.b);
      const r = rest(a);
      fx = r.x;
      fy = r.y;
      moveTo(r, a, 250, 650);
      if (t > 650 && t <= 1050) {
        fx = a.x;
        fy = a.y;
      }
      moveTo(a, b, 1050, 1450);
      if (t > 1450 && t <= 2250) {
        fx = b.x;
        fy = b.y;
      }
      // pull back a little so the flicker is seen, then come back to take b away
      const bOff = { x: b.x + cs * 0.5, y: b.y + cs * 0.7 };
      moveTo(b, bOff, 1650, 1950);
      if (t > 1950 && t <= 2350) {
        fx = bOff.x;
        fy = bOff.y;
      }
      moveTo(bOff, b, 2350, 2700);
      if (t > 2700 && t <= 3000) {
        fx = b.x;
        fy = b.y;
      }
      const end = leave(b);
      moveTo(b, end, 3000, 3350);
      if (t > 3350) {
        fx = end.x;
        fy = end.y;
      }
      if (t >= 650 && t < 810) fs = 0.9;
      if (t >= 1450 && t < 1610) fs = 0.9;
      if (t >= 2700 && t < 2860) fs = 0.9;
      if (this.once(1, t, 650)) {
        this.press(a.x, a.y, now);
        this.ghostT0[0] = now;
        this.board.previewLight(d.a, true, now);
      }
      if (this.once(2, t, 1450)) {
        this.press(b.x, b.y, now);
        this.ghostT0[1] = now;
        this.lineT0 = now + 120;
        this.shakeT0 = now + 160;
      }
      if (this.once(4, t, 2700)) {
        this.press(b.x, b.y, now);
        this.ghostOut[1] = now;
        this.lineOut = now;
      }
      if (this.once(8, t, per - 500)) {
        this.ghostOut[0] = now;
        this.board.previewLight(d.a, false, now);
      }
      fa = fadeEdges(250, 3000, 3350);
      const st = now - this.shakeT0;
      const shake = st >= 0 && st < 520 && !motion.reduced ? Math.sin(st / 26) * cs * 0.07 * (1 - st / 520) : 0;
      const as = { x: a.x + shake, y: a.y };
      const bs = { x: b.x - shake, y: b.y };
      this.placeGhost(0, as, now);
      this.placeGhost(1, bs, now, true);
      this.drawCross(as, bs, now);
    } else {
      const p = { x: d.x, y: d.y };
      const r = { x: p.x + 30 * this.u, y: p.y + 46 * this.u };
      fx = r.x;
      fy = r.y;
      moveTo(r, p, 200, 600);
      if (t > 600 && t <= 1300) {
        fx = p.x;
        fy = p.y;
      }
      const off = { x: p.x + 14 * this.u, y: p.y + 22 * this.u };
      moveTo(p, off, 1300, 1650);
      if (t > 1650) {
        fx = off.x;
        fy = off.y;
      }
      if ((t >= 600 && t < 760) || (t >= 960 && t < 1120)) fs = 0.9;
      if (this.once(1, t, 600)) this.press(p.x, p.y, now);
      if (this.once(2, t, 960)) this.press(p.x, p.y, now);
      fa = fadeEdges(200, 1300, 1650);
    }
    const reduced = motion.reduced;
    // the hand turns aside when it would lie over a digit (reality check: on the number lesson the
    // hand pressing a cell covered the top half of the "2" right below it)
    // (snapped, not eased: an in-between angle could sweep the hand across the digit)
    this.fRot = this.handAngle(fx, fy);
    this.finger.setVisible(fa > 0.01).setPosition(fx, fy).setAlpha(fa * 0.95).setScale(reduced ? 1 : fs).setRotation(this.fRot);
    const rt = (now - this.rippleT0) / 520;
    if (rt >= 0 && rt < 1) this.ripple.setVisible(true).setAlpha((1 - rt) * 0.9).setScale(0.4 + 0.8 * easeOutCubic(rt));
    else if (this.ripple.visible) this.ripple.setVisible(false);
  }

  private placeGhost(k: number, p: { x: number; y: number }, now: number, lift = false): void {
    const g = this.ghosts[k]!;
    const fl = this.gFlames[k]!;
    const ha = this.gHalos[k]!;
    const tin = (now - this.ghostT0[k]!) / 220;
    const tout = this.ghostOut[k]! > this.ghostT0[k]! ? (now - this.ghostOut[k]!) / 300 : -1;
    if (tin < 0 || tout >= 1) {
      if (g.visible) {
        g.setVisible(false);
        fl.setVisible(false);
        ha.setVisible(false);
      }
      return;
    }
    const a = clamp01(tin) * (tout >= 0 ? 1 - tout : 1);
    const pop = motion.reduced ? 1 : easeOutBack(clamp01(tin));
    const up = lift && tout >= 0 ? easeOutCubic(clamp01(tout)) * this.cs * 0.5 : 0;
    const sc = 0.6 + 0.4 * pop;
    const y = p.y - this.cs * 0.03 - up;
    // same layering as a real lantern: halo, body, breathing flame
    const b = motion.reduced ? 0 : Math.sin((now / 1600) * Math.PI * 2 + k);
    ha.setVisible(true).setPosition(p.x, y + this.cs * 0.09).setAlpha(0.85 * a).setScale(sc);
    g.setVisible(true).setPosition(p.x, y).setAlpha(a).setScale(sc);
    fl.setVisible(true).setPosition(p.x, y - this.cs * 0.02 * sc).setAlpha(a * (0.88 + 0.12 * b)).setScale(sc * (1 + 0.06 * b), sc * 1.15 * (1 + 0.06 * b));
  }

  /** The two demo lanterns that see each other: coral rims behind both and a coral ✕ between them. */
  private drawCross(a: { x: number; y: number }, b: { x: number; y: number }, now: number): void {
    const tin = (now - this.lineT0) / 220;
    const tout = this.lineOut > this.lineT0 ? (now - this.lineOut) / 260 : -1;
    if (tin < 0 || tout >= 1) {
      if (this.xImg.visible) this.xImg.setVisible(false);
      for (const r of this.rims) if (r.visible) r.setVisible(false);
      return;
    }
    const v = clamp01(tin) * (tout >= 0 ? 1 - tout : 1);
    const pop = motion.reduced ? 1 : easeOutBack(clamp01(tin));
    this.xImg.setVisible(true).setPosition((a.x + b.x) / 2, (a.y + b.y) / 2).setAlpha(v).setScale(0.5 + 0.5 * pop);
    // v11 (C6): the ✕ alone marks the pair (the board shows no coral rims any more either)
    for (const r of this.rims) if (r.visible) r.setVisible(false);
  }

  // ---------------------------------------------------------------- goal card

  private updateGoal(t: number, per: number, now: number): void {
    const r = this.board.root;
    const u = this.u;
    const reduced = motion.reduced;
    const cin = clamp01(t / 300);
    const cout = 1 - clamp01((t - (per - 350)) / 300);
    this.card.setVisible(true).setPosition(r.x, r.y).setAlpha(Math.min(cin, cout));
    // four lanterns, one every 450 ms; each lights its own tile and its rays
    const at = (k: number): number => 500 + 450 * k;
    const lh = this.mcs * 0.8;
    void lh;
    for (let k = 0; k < 4; k++) {
      const c = GOAL_LANTERNS[k]!;
      const ta = at(k);
      const x = this.mx(c);
      const y = this.my(c) - this.mcs * 0.03;
      const lan = this.cardLan[k]!;
      const fl = this.cardFlame[k]!;
      if (t < ta) {
        lan.setVisible(false);
        fl.setVisible(false);
        continue;
      }
      const e = reduced ? 1 : easeOutBack(clamp01((t - ta) / 220));
      lan.setVisible(true).setPosition(x, y - (1 - clamp01((t - ta) / 160)) * this.mcs * 0.5).setScale(0.75 + 0.25 * e).setAlpha(1);
      fl.setVisible(true).setPosition(x, y - this.mcs * 0.02).setAlpha(0.9 * clamp01((t - ta) / 200)).setScale(1, 1.15);
      if (this.once(1 << k, t, ta)) {
        const w = { x: r.x + x, y: r.y + this.my(c) };
        this.press(w.x, w.y, now);
      }
    }
    for (let k = 0; k < GOAL_FLOOR.length; k++) {
      const c = GOAL_FLOOR[k]!;
      // lit by the earliest lantern that reaches it, spreading out from that lantern
      let on = 1e9;
      for (let q = 0; q < 4; q++) {
        const L = GOAL_LANTERNS[q]!;
        if (GOAL_RAYS[q]!.includes(c)) on = Math.min(on, at(q) + 40 * (Math.abs((c % 3) - (L % 3)) + Math.abs(Math.floor(c / 3) - Math.floor(L / 3))));
      }
      const v = clamp01((t - on) / 150);
      const wave = t > 2700 && !reduced ? 0.12 * Math.max(0, Math.sin(Math.PI * clamp01((t - 2700 - 60 * k) / 380))) : 0;
      this.cardLit[k]!.setVisible(v > 0.01).setAlpha(v).setScale(1 + wave);
    }
    // the number turns gold with the fourth lantern; then every window of the house glows
    const gold = clamp01((t - (at(3) + 200)) / 260);
    this.cardGold.setVisible(gold > 0.01).setAlpha(gold);
    this.cardDigit.setAlpha(1 - gold);
    if (this.once(32, t, at(3) + 500)) {
      this.goalOn = true;
      this.onGoalWindows?.(true);
    }
    if (this.once(64, t, per - 450)) {
      this.goalOn = false;
      this.onGoalWindows?.(false);
    }
    // finger: taps the four cells in turn, then rests below the yard
    const pts = GOAL_LANTERNS.map((c) => ({ x: r.x + this.mx(c), y: r.y + this.my(c) }));
    const rest = { x: r.x + this.mcs * 1.9, y: r.y + this.mcs * 2.2 };
    let fx = rest.x;
    let fy = rest.y;
    let prev = rest;
    for (let k = 0; k < 4; k++) {
      const ta = at(k);
      const p = pts[k]!;
      if (t >= ta - 330 && t < ta) {
        const e = easeInOutCubic(clamp01((t - (ta - 330)) / 300));
        fx = lerp(prev.x, p.x, e);
        fy = lerp(prev.y, p.y, e);
      } else if (t >= ta && t < ta + 120) {
        fx = p.x;
        fy = p.y;
      }
      prev = p;
    }
    const tl = at(3) + 120;
    if (t >= tl) {
      const e = easeInOutCubic(clamp01((t - tl) / 400));
      fx = lerp(prev.x, rest.x, e);
      fy = lerp(prev.y, rest.y, e);
    }
    const fa = Math.min(clamp01((t - 200) / 250), 1 - clamp01((t - (at(3) + 500)) / 300));
    let fs = 1;
    for (let k = 0; k < 4; k++) if (t >= at(k) && t < at(k) + 140) fs = 0.9;
    this.finger.setVisible(fa > 0.01).setPosition(fx, fy).setAlpha(fa * 0.95).setScale(reduced ? 1 : fs).setRotation(0);
    const rt = (now - this.rippleT0) / 520;
    if (rt >= 0 && rt < 1) this.ripple.setVisible(true).setAlpha((1 - rt) * 0.9).setScale(0.4 + 0.8 * easeOutCubic(rt));
    else if (this.ripple.visible) this.ripple.setVisible(false);
    void u;
  }
}

// goal yard (3×3, centre rock "4"): the four lanterns around it light all eight tiles
const GOAL_LANTERNS = [1, 3, 5, 7] as const;
const GOAL_FLOOR = [0, 1, 2, 3, 5, 6, 7, 8] as const;
const GOAL_RAYS: readonly (readonly number[])[] = [[1, 0, 2], [3, 0, 6], [5, 2, 8], [7, 6, 8]];
