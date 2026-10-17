// v11 tutorial guide actor (NOVICE-TEST §5-A): whatever points at the board and shows the tap.
// Today a hand pointer (the old ghost finger + ripple); the mascot "Wick" (BENCHMARK-CUTE §3, not
// approved yet) can later implement the same interface — the tutorial only talks to GuideActor.
import type PhaserTypes from "phaser";
import type { TextureBank } from "../render/textures.ts";
import { clamp01, easeInOutCubic, easeOutCubic, lerp, motion } from "./motion.ts";

export interface Pt {
  x: number;
  y: number;
}

export interface TapDemo {
  /** ms before the actor starts moving in (default 0) */
  delay?: number;
  /** one demonstration, then it leaves (default: loops until hide()) */
  once?: boolean;
  /** called at the press moment (once: the actor "does" the tap — e.g. places the lantern) */
  onPress?: () => void;
}

export interface GuideActor {
  /** cell size and dpr (canvas px) */
  layout(cs: number, u: number): void;
  /** Point at p (world px) and show a tap there (loops unless `once`). Replaces any running demo. */
  tap(p: Pt, now: number, o?: TapDemo): void;
  /** Leave quietly (fade out). */
  hide(now: number): void;
  /** A demonstration is running (or fading in). */
  readonly active: boolean;
  update(now: number): void;
  destroy(): void;
}

const PERIOD = 2600;

/** The hand pointer: moves in from below-right, presses (ripple), lifts off, fades; loops. */
export class HandPointer implements GuideActor {
  private finger: PhaserTypes.GameObjects.Image;
  private ripple: PhaserTypes.GameObjects.Image;
  private p: Pt | null = null;
  private t0 = 0;
  private o: TapDemo = {};
  private pressedLoop = -1;
  private cs = 60;
  private u = 1;
  private outT0 = -1;

  constructor(
    scene: PhaserTypes.Scene,
    private readonly bank: TextureBank,
    depth: number,
  ) {
    this.ripple = scene.add.image(0, 0, "__DEFAULT").setDepth(depth).setVisible(false);
    this.finger = scene.add.image(0, 0, "__DEFAULT").setOrigin(0.36, 0.05).setDepth(depth + 0.1).setVisible(false);
  }

  layout(cs: number, u: number): void {
    this.cs = cs;
    this.u = u;
    this.finger.setTexture(this.bank.finger(Math.round(Math.min(Math.max(cs * 1.05, 58 * u), 86 * u))));
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
      if (this.finger.visible) this.finger.setVisible(false);
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
    const rest = { x: p.x + cs * 0.75, y: p.y + cs * 1.05 };
    const away = { x: p.x + cs * 0.28, y: p.y + cs * 0.42 };
    let x = rest.x;
    let y = rest.y;
    if (t >= 250 && t < 750) {
      const k = easeInOutCubic(clamp01((t - 250) / 500));
      x = lerp(rest.x, p.x, k);
      y = lerp(rest.y, p.y, k);
    } else if (t >= 750 && t < 1500) {
      x = p.x;
      y = p.y;
    } else if (t >= 1500) {
      const k = easeInOutCubic(clamp01((t - 1500) / 400));
      x = lerp(p.x, away.x, k);
      y = lerp(p.y, away.y, k);
    }
    if (t >= 750 && this.pressedLoop !== loop) {
      this.pressedLoop = loop;
      this.rippleT0 = now;
      this.ripple.setPosition(p.x, p.y);
      this.o.onPress?.();
    }
    let a = t < 0 ? 0 : Math.min(clamp01(t / 250), 1 - clamp01((t - 1500) / 400));
    if (this.outT0 >= 0) {
      const k = clamp01((now - this.outT0) / 200);
      a *= 1 - k;
      if (k >= 1) {
        this.p = null;
        this.finger.setVisible(false);
        this.ripple.setVisible(false);
        return;
      }
    }
    const press = t >= 750 && t < 910 && !motion.reduced ? 0.9 : 1;
    this.finger.setVisible(a > 0.01).setPosition(x, y).setAlpha(a * 0.95).setScale(press);
    const rt = (now - this.rippleT0) / 520;
    if (rt >= 0 && rt < 1) this.ripple.setVisible(true).setAlpha((1 - rt) * 0.9).setScale(0.4 + 0.8 * easeOutCubic(rt));
    else if (this.ripple.visible) this.ripple.setVisible(false);
    void this.u;
  }
  private rippleT0 = -1e9;

  destroy(): void {
    this.finger.destroy();
    this.ripple.destroy();
  }
}
