// Wick on screen (decision A4, docs/team/r1-visual.md §5): the hero on the stepping stone and the
// tutorial guide. Loaded lazily after the first frame (its own chunk). Every look is a baked
// texture (TextureBank.wick / wickFlame / wickShadow / halo); motion is only the transform of
// those images. All images are ambient(): the idle breathe and blinks read the same at the frame
// governor's 20 fps — a hop / shiver / guide hop asks for full rate with governor.keepAwake().
import type PhaserTypes from "phaser";
import Phaser from "../phaser.ts";
import type { TextureBank } from "../render/textures.ts";
import {
  BLINK_MS, flameBox, HOP_MS, REST, WICK_FLAME, WICK_GROUND, wickBlink, wickBreathe, wickHop, wickWorry, WORRY_MS, type WickExpr, type WickPose,
} from "../render/wick.ts";
import { ambient, governor } from "./frameGovernor.ts";
import type { GuideActor, Pt, TapDemo } from "./guideActor.ts";
import { clamp01, easeInOutCubic, easeOutCubic, lerp, motion } from "./motion.ts";

type Image = PhaserTypes.GameObjects.Image;
const DEG = Math.PI / 180;
/** Visual height of Wick above the ground, as a fraction of the box (flame tip ≈ y 13 of 92). */
export const WICK_TALL = 0.8;

/** The four images of one Wick, posed from a ground point. */
export class WickSprite {
  readonly shadow: Image;
  readonly glow: Image;
  readonly flame: Image;
  readonly body: Image;
  private size = 0;
  private bodyKey = "";

  constructor(
    scene: PhaserTypes.Scene,
    private readonly bank: TextureBank,
    depth: number,
  ) {
    const s = scene;
    this.shadow = ambient(s.add.image(0, 0, "__DEFAULT").setDepth(depth).setVisible(false));
    this.glow = ambient(s.add.image(0, 0, "__DEFAULT").setDepth(depth).setBlendMode(Phaser.BlendModes.ADD).setVisible(false));
    this.body = ambient(s.add.image(0, 0, "__DEFAULT").setOrigin(WICK_GROUND.x / 100, WICK_GROUND.y / 100).setDepth(depth + 0.01).setVisible(false));
    this.flame = ambient(s.add.image(0, 0, "__DEFAULT").setDepth(depth + 0.02).setVisible(false));
  }

  get objects(): Image[] {
    return [this.shadow, this.glow, this.body, this.flame];
  }

  /** Box size in canvas px (bakes the shared textures for it on first use). */
  setSize(px: number): void {
    const size = Math.max(16, Math.round(px));
    if (size === this.size) return;
    this.size = size;
    this.bodyKey = "";
    const fb = flameBox(size);
    this.flame.setTexture(this.bank.wickFlame(size)).setOrigin(fb.ox, fb.oy);
    this.shadow.setTexture(this.bank.wickShadow(Math.round(size * 0.58)));
    this.glow.setTexture(this.bank.halo(Math.round(size * 1.15)));
  }

  get px(): number {
    return this.size;
  }

  /**
   * Pose Wick standing on (gx, gy) (canvas px). glowA: the halo's strength (0 = none).
   */
  draw(gx: number, gy: number, pose: WickPose, expr: WickExpr, blink: number, arms: "up" | "wave" | null, alpha: number, glowA = 0.55, scale = 1): void {
    const S = this.size;
    if (S === 0 || alpha <= 0.01) {
      this.hide();
      return;
    }
    const k = (S / 100) * scale;
    const key = this.bank.wick(S, expr, blink, arms);
    if (key !== this.bodyKey) {
      this.bodyKey = key;
      this.body.setTexture(key);
    }
    const x = gx + pose.dx * k;
    const y = gy + pose.dy * k;
    const rot = pose.rot * DEG;
    this.body.setVisible(true).setPosition(x, y).setScale(pose.sx * scale, pose.sy * scale).setRotation(rot).setAlpha(alpha);
    // the flame's base, relative to the ground point, through the body's scale + tilt
    const fx = (WICK_FLAME.x - WICK_GROUND.x) * k * pose.sx;
    const fy = (WICK_FLAME.y - WICK_GROUND.y) * k * pose.sy;
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    this.flame
      .setVisible(true)
      .setPosition(x + fx * c - fy * s, y + fx * s + fy * c)
      .setRotation(rot + (WICK_FLAME.tiltDeg + pose.flameRot) * DEG)
      .setScale(WICK_FLAME.scale * pose.flameS * scale)
      .setAlpha(alpha);
    const lift = Math.max(0.55, 1 + pose.dy / 40);
    this.shadow.setVisible(true).setPosition(gx, gy + 1.2 * k).setScale(pose.sx * lift * scale, lift * scale).setAlpha(alpha * lift);
    this.glow.setVisible(glowA > 0).setPosition(x, y - 26 * k * pose.sy).setScale(scale).setAlpha(alpha * glowA);
  }

  hide(): void {
    for (const im of this.objects) if (im.visible) im.setVisible(false);
  }

  destroy(): void {
    for (const im of this.objects) im.destroy();
  }
}

export type HeroCue = "place" | "remove" | "conflict" | "calm" | "hint" | "solve" | "board";

/**
 * The hero: Wick on the bottom stepping stone between the house and the courtyard. Breathes and
 * blinks; worries while two lanterns see each other; looks at the board on a hint; hops on a
 * solve; dozes when nothing happens for a while (or at night).
 */
export class WickHero {
  private sprite: WickSprite;
  private gx = 0;
  private gy = 0;
  private hopH = 14;
  private shown = false;
  private alpha = 0;
  private fadeT0 = -1e9;
  private worried = false;
  private worryT0 = -1e9;
  private hopT0 = -1e9;
  private happyUntil = -1e9;
  private solved = false;
  private curiousUntil = -1e9;
  private blinkT0 = -1e9;
  private nextBlink = 0;
  private doze = false;
  /** under the error band: Wick ducks to this scale so his flame stays below the band's edge */
  private duckK = 1;
  private duck = false;
  private scaleNow = 1;
  private lastT = 0;
  /** what Wick shows now (tests / shots) */
  expr: WickExpr = "idle";

  constructor(scene: PhaserTypes.Scene, bank: TextureBank, depth: number) {
    this.sprite = new WickSprite(scene, bank, depth);
  }

  get objects(): Image[] {
    return this.sprite.objects;
  }

  /** Stand on (gx, gy), box size px, hop height (box units); duckK = his scale while the error band is up. */
  place(gx: number, gy: number, size: number, hopUnits: number, duckK = 1): void {
    this.gx = gx;
    this.gy = gy;
    this.hopH = Math.max(0, Math.min(14, hopUnits));
    this.duckK = Math.min(1, Math.max(0.4, duckK));
    this.sprite.setSize(size);
  }

  /** The error band is up (Wick ducks under it) or not. */
  setDuck(on: boolean): void {
    this.duck = on;
  }

  /** Where Wick stands and how tall he is now (canvas px): tests / overlap checks. */
  get box(): { x: number; y: number; w: number; h: number; ground: number } {
    const S = this.sprite.px * this.scaleNow;
    return { x: this.gx - S * 0.37, y: this.gy - S * WICK_TALL, w: S * 0.74, h: S * WICK_TALL, ground: this.gy };
  }

  get visible(): boolean {
    return this.shown;
  }

  show(on: boolean, now: number): void {
    if (on === this.shown) return;
    this.shown = on;
    this.fadeT0 = now;
  }

  setDoze(on: boolean): void {
    this.doze = on;
  }

  cue(c: HeroCue, now: number): void {
    if (c === "conflict") {
      if (!this.worried) this.worryT0 = now;
      this.worried = true;
      if (!motion.reduced) governor.keepAwake(WORRY_MS);
    } else if (c === "calm") this.worried = false;
    else if (c === "place") this.happyUntil = Math.max(this.happyUntil, now + 650);
    else if (c === "hint") this.curiousUntil = now + 2400;
    else if (c === "solve") {
      this.worried = false;
      this.solved = true;
      this.hopT0 = now;
      if (!motion.reduced) governor.keepAwake(HOP_MS + 40);
    } else if (c === "board") {
      this.solved = false;
      this.worried = false;
      this.happyUntil = -1e9;
      this.curiousUntil = -1e9;
    }
  }

  update(now: number, hostAlpha: number): void {
    // duck under the band / stand up again: 180 ms (a move: keep full rate meanwhile)
    const target = this.duck ? this.duckK : 1;
    const dt = Math.min(100, Math.max(0, now - this.lastT));
    this.lastT = now;
    if (this.scaleNow !== target) {
      const step = (dt / 180) * (1 - this.duckK);
      this.scaleNow = motion.reduced || step <= 0 ? target : this.scaleNow < target ? Math.min(target, this.scaleNow + step) : Math.max(target, this.scaleNow - step);
      governor.keepAwake(120);
    }
    const k = clamp01((now - this.fadeT0) / 220);
    this.alpha = this.shown ? (motion.reduced ? 1 : k) : motion.reduced ? 0 : 1 - k;
    const a = this.alpha * hostAlpha;
    if (a <= 0.01) {
      this.sprite.hide();
      return;
    }
    const reduced = motion.reduced;
    let pose: WickPose = reduced ? { ...REST } : wickBreathe(now, this.doze && !this.worried && !this.solved);
    let expr: WickExpr = "idle";
    let arms: "up" | "wave" | null = null;
    let blink = 0;
    const hopE = now - this.hopT0;
    if (hopE >= 0 && hopE < HOP_MS && !reduced) {
      const h = wickHop(hopE, this.hopH);
      pose = { ...h, flameRot: pose.flameRot };
      expr = "cheer";
      arms = "up";
    } else if (this.worried) {
      expr = "worried";
      if (!reduced) {
        const w = wickWorry(now - this.worryT0);
        pose = { ...w, sy: w.sy * pose.sy, sx: w.sx * pose.sx };
      }
    } else if (this.solved || now < this.happyUntil) expr = "happy";
    else if (now < this.curiousUntil) expr = "curious";
    else if (this.doze) expr = "sleepy";
    else {
      if (now >= this.nextBlink) {
        this.blinkT0 = now;
        this.nextBlink = now + 2800 + Math.random() * 2700;
      }
      blink = reduced ? 0 : wickBlink(now - this.blinkT0);
      if (now - this.blinkT0 > BLINK_MS) blink = 0;
    }
    this.expr = expr;
    this.sprite.draw(this.gx, this.gy, pose, expr, blink, arms, a, 0.55, this.scaleNow);
  }

  destroy(): void {
    this.sprite.destroy();
  }
}

const PERIOD = 2600;

/**
 * The tutorial guide as Wick (GuideActor): he hops onto the cell, stamps (the tap, with a ripple),
 * hops back off beside it and waits there; loops until hide(). The hand (HandPointer) stays the
 * fallback when lantern faces are off.
 */
export class WickGuide implements GuideActor {
  private sprite: WickSprite;
  private ripple: Image;
  private p: Pt | null = null;
  private t0 = 0;
  private o: TapDemo = {};
  private pressedLoop = -1;
  private cs = 60;
  private outT0 = -1;
  private rippleT0 = -1e9;

  constructor(
    private readonly scene: PhaserTypes.Scene,
    private readonly bank: TextureBank,
    depth: number,
  ) {
    this.ripple = scene.add.image(0, 0, "__DEFAULT").setDepth(depth).setVisible(false);
    this.sprite = new WickSprite(scene, bank, depth + 0.1);
  }

  /** its display objects (the host draws them with the scene's world camera) */
  get objects(): Image[] {
    return [this.ripple, ...this.sprite.objects];
  }

  layout(cs: number, u: number): void {
    this.cs = cs;
    this.sprite.setSize(Math.round(Math.min(Math.max(cs * 1.0, 56 * u), 84 * u)));
    this.ripple.setTexture(this.bank.ripple(Math.round(Math.max(cs * 0.8, 40 * u)), u));
  }

  get active(): boolean {
    return this.p !== null && this.outT0 < 0;
  }

  tap(p: Pt, now: number, o: TapDemo = {}): void {
    this.p = { ...p };
    this.o = o;
    this.t0 = now + (o.delay ?? 0);
    this.pressedLoop = -1;
    this.outT0 = -1;
  }

  hide(now: number): void {
    if (!this.p || this.outT0 >= 0) return;
    this.outT0 = now;
  }

  update(now: number): void {
    const p = this.p;
    if (!p) {
      this.sprite.hide();
      if (this.ripple.visible) this.ripple.setVisible(false);
      return;
    }
    const e = now - this.t0;
    const loop = Math.max(0, Math.floor(e / PERIOD));
    const t = e < 0 ? -1 : e - loop * PERIOD;
    if (this.o.once && loop >= 1) {
      this.p = null;
      return;
    }
    const cs = this.cs;
    const S = this.sprite.px;
    // he waits beside the cell (right, or left near the right edge), and stands on the cell's lower half
    const side = p.x + cs * 0.95 + S * 0.4 > this.scene.scale.width ? -1 : 1;
    const rest = { x: p.x + side * cs * 0.92, y: p.y + cs * 0.62 };
    const on = { x: p.x, y: p.y + cs * 0.36 };
    let x = rest.x;
    let y = rest.y;
    let hop = 0;
    let pose: WickPose = motion.reduced ? { ...REST } : wickBreathe(now);
    let expr: WickExpr = "idle";
    const reduced = motion.reduced;
    if (t >= 250 && t < 750) {
      const k = easeInOutCubic(clamp01((t - 250) / 500));
      x = lerp(rest.x, on.x, k);
      y = lerp(rest.y, on.y, k);
      hop = reduced ? 0 : Math.sin(Math.PI * k) * cs * 0.55;
      if (!reduced) pose = { ...REST, sx: 0.94, sy: 1.07 };
    } else if (t >= 750 && t < 1500) {
      x = on.x;
      y = on.y;
      expr = t >= 910 ? "happy" : "idle";
      if (t < 910 && !reduced) {
        const q = Math.sin(Math.PI * clamp01((t - 750) / 160));
        pose = { ...REST, sx: 1 + 0.14 * q, sy: 1 - 0.14 * q };
      }
    } else if (t >= 1500 && t < 1900) {
      const k = easeInOutCubic(clamp01((t - 1500) / 400));
      x = lerp(on.x, rest.x, k);
      y = lerp(on.y, rest.y, k);
      hop = reduced ? 0 : Math.sin(Math.PI * k) * cs * 0.45;
      expr = "happy";
    } else if (t >= 1900) expr = "happy";
    // hops are real motion: full rate meanwhile
    if (!reduced && t >= 230 && t < 1920) governor.keepAwake(120);
    if (t >= 750 && this.pressedLoop !== loop) {
      this.pressedLoop = loop;
      this.rippleT0 = now;
      this.ripple.setPosition(p.x, p.y);
      this.o.onPress?.();
    }
    // fades in once (the first loop); later loops start where the last one rested
    let a = e < 0 ? 0 : clamp01(e / 250);
    if (this.outT0 >= 0) {
      const k = clamp01((now - this.outT0) / 200);
      a *= 1 - k;
      if (k >= 1) {
        this.p = null;
        this.sprite.hide();
        this.ripple.setVisible(false);
        return;
      }
    }
    const k = S / 100;
    this.sprite.draw(x, y, { ...pose, dy: -hop / Math.max(k, 0.01) }, expr, 0, null, a, 0.35);
    const rt = (now - this.rippleT0) / 520;
    if (rt >= 0 && rt < 1) this.ripple.setVisible(true).setAlpha((1 - rt) * 0.9).setScale(0.4 + 0.8 * easeOutCubic(rt));
    else if (this.ripple.visible) this.ripple.setVisible(false);
  }

  destroy(): void {
    this.sprite.destroy();
    this.ripple.destroy();
  }
}
