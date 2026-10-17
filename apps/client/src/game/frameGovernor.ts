// Activity-based frame governor (playtest/perf/idle-governor.md).
//
// Phaser's TimeStep calls Game.step (update + a full CANVAS repaint) on every vsync. A calm
// puzzle spends most of its life with the player just looking, and a full-screen repaint at
// 60 fps there kept an iPhone 14 Pro at ~45 % of a core (WebContent + GPU) and "Serious" thermals.
//
// The governor takes over the loop's scheduling (Phaser's own rAF is put to sleep once, after the
// first presented frame) and drives the same TimeStep:
//   full rate (every vsync)   input in the last GRACE_MS, a Phaser tween running, keepAwake(),
//                             or real motion: the "motion signature" of every running scene
//                             (cameras + the transform / alpha / visibility / text of each
//                             display object NOT marked ambient()) changed in the last GRACE_MS.
//                             TimeStep.step(time) per vsync — Phaser's own delta smoothing.
//   ambient (AMBIENT_FPS)     otherwise: only ambient() objects change (flicker, stars,
//                             fireflies, smoke…), which read the same at 20 fps. A timer, then one
//                             rAF per step (no idle vsync callbacks in between); the step gets the
//                             real elapsed time as its delta, so play time and Phaser timers stay exact.
//   asleep (no frames)        document hidden, app in background, a full-screen ad is up.
// Errors fail safe: an object that moves every frame but is not marked ambient keeps the game
// at full rate (no visual loss, just no saving) — `movers()` lists such objects in DEV.
//
// Input wakes it in the capture phase on window (before Phaser's listeners): the next vsync is a
// full step, as before. The scenes' clocks are first brought to "one frame ago" (where they would
// be at 60 fps), so an animation that tap starts (t0 = scene.time.now) is not cut short.
import type PhaserTypes from "phaser";

export const AMBIENT_FPS = 20;
/** Full rate lasts this long after the last input / motion / keepAwake(). */
export const GRACE_MS = 1500;
/** A step is due when this much of the ambient interval passed (vsync jitter: 3 × 16.6 ms ≥ 46). */
const DUE_SLACK_MS = 4;

const ambientSet = new WeakSet<object>();

/** Mark a display object (and, for a container, its subtree) as ambient: its changes never force full rate. */
export function ambient<T extends object>(o: T): T {
  ambientSet.add(o);
  return o;
}

export type GovMode = "full" | "ambient" | "asleep";
export interface GovState {
  mode: GovMode;
  /** Game steps (= canvas repaints) in the last second. */
  fps: number;
  /** Why the governor runs at full rate right now ("input", "motion", "tween", "awake", "forced", "boot"). */
  why: string[];
  sleeping: string[];
  forced: boolean | null;
  installed: boolean;
}

type Step = (time: number, delta: number) => void;
interface LoopLike {
  callback: Step;
  sleep(): void;
  wake(seamless?: boolean): void;
  step(time: number): void;
  running: boolean;
  now: number;
  time: number;
  lastTime: number;
  rawDelta: number;
  delta: number;
  frame: number;
}
interface SceneLike {
  sys: {
    settings: { visible: boolean; status: number };
    cameras?: { cameras: Array<{ scrollX: number; scrollY: number; zoom: number; alpha: number; x: number; y: number; width: number; height: number; visible: boolean }> };
    displayList?: { list: unknown[] };
    tweens?: { getTweens?(): unknown[] };
    time?: { now: number };
  };
}
export interface GameLike {
  loop: LoopLike;
  scene: { scenes: SceneLike[] };
  events?: { once?(e: string, f: () => void): unknown };
}

/** Phaser.Scenes.RUNNING */
const RUNNING = 5;

const now = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());

// a 32-bit running hash of small integers
const mix = (h: number, v: number): number => Math.imul(h ^ (v | 0), 0x01000193) >>> 0;
function mixStr(h: number, s: string): number {
  h = mix(h, s.length);
  for (let i = 0; i < s.length; i++) h = mix(h, s.charCodeAt(i));
  return h;
}

interface Obj {
  visible?: boolean;
  alpha?: number;
  x?: number;
  y?: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
  type?: string;
  list?: unknown[];
  text?: string;
  texture?: { key?: string };
  frame?: { name?: string | number };
  commandBuffer?: unknown[];
}

function hashObj(h: number, o: Obj, deep = true): number {
  if (ambientSet.has(o)) return h;
  const a = o.alpha ?? 1;
  if (!o.visible || a < 1 / 256) return mix(h, 7);
  h = mix(h, Math.round(a * 128));
  h = mix(h, Math.round((o.x ?? 0) * 2));
  h = mix(h, Math.round((o.y ?? 0) * 2));
  h = mix(h, Math.round((o.scaleX ?? 1) * 512));
  h = mix(h, Math.round((o.scaleY ?? 1) * 512));
  h = mix(h, Math.round((o.rotation ?? 0) * 512));
  if (o.type === "Text" && typeof o.text === "string") h = mixStr(h, o.text);
  else if (o.type === "Graphics" && o.commandBuffer) h = mix(h, o.commandBuffer.length);
  if (deep && o.list) for (const c of o.list) h = hashObj(h, c as Obj);
  return h;
}

export interface Scheduler {
  now(): number;
  raf(f: (t: number) => void): number;
  caf(id: number): void;
  setTimeout(f: () => void, ms: number): number;
  clearTimeout(id: number): void;
}

const browserScheduler = (): Scheduler => ({
  now: () => performance.now(),
  raf: (f) => requestAnimationFrame(f),
  caf: (id) => cancelAnimationFrame(id),
  setTimeout: (f, ms) => setTimeout(f, ms) as unknown as number,
  clearTimeout: (id) => clearTimeout(id),
});

/** One vsync at 60 Hz. */
const FRAME_MS = 1000 / 60;
/** An ambient step's delta is the real gap, capped (a throttled timer must not jump the clocks). */
const MAX_AMBIENT_DELTA = 250;

export class FrameGovernor {
  private game: GameLike | null = null;
  private loop: LoopLike | null = null;
  private sch: Scheduler | null = null;
  private rafId = 0;
  private timerId = 0;
  private lastStep = -1e9;
  private inputUntil = 0;
  private motionUntil = 0;
  private awakeUntil = 0;
  private sig = -1;
  private stepFull = true;
  /** the previous step was ambient / the loop slept: the next full step takes the real delta (manual) or Phaser's capped one */
  private prevAmbient = false;
  private afterSleep = false;
  private forced: boolean | null = null;
  private readonly sleeping = new Set<string>();
  private readonly steps: number[] = [];
  private interval: number;
  private detach: Array<() => void> = [];

  constructor(readonly ambientFps = AMBIENT_FPS, readonly graceMs = GRACE_MS) {
    this.interval = 1000 / ambientFps;
  }

  /** Take over the running loop. Call after the first presented frame (the cold-start path stays untouched). */
  install(game: GameLike | PhaserTypes.Game, opts: { listen?: boolean; scheduler?: Scheduler } = {}): void {
    if (this.game) return;
    const g = game as unknown as GameLike;
    this.game = g;
    this.loop = g.loop;
    this.sch = opts.scheduler ?? browserScheduler();
    this.inputUntil = this.sch.now() + this.graceMs; // the first moments after boot: full rate
    g.loop.sleep(); // Phaser's own rAF off: from here the governor calls TimeStep.step
    g.events?.once?.("destroy", () => this.uninstall(false));
    if (opts.listen !== false && typeof window !== "undefined") this.listen();
    if (this.sleeping.size === 0) this.request();
  }

  /** Give the loop back to Phaser's own rAF (`restore` false: the game is going away). */
  uninstall(restore = true): void {
    if (!this.game || !this.sch) return;
    this.cancel();
    for (const f of this.detach) f();
    this.detach = [];
    const loop = this.loop;
    this.game = null;
    this.loop = null;
    if (restore && loop && this.sleeping.size === 0) loop.wake();
  }

  private listen(): void {
    // capture phase on window: runs before Phaser's own canvas / window listeners see the event
    const onInput = (): void => {
      // a touch that reaches the WebView means no full-screen ad covers it (a lost "ad closed" must not freeze the game)
      if (this.sleeping.has("ad")) this.resume("ad");
      this.wake();
    };
    const opt: AddEventListenerOptions = { capture: true, passive: true };
    for (const t of ["pointerdown", "pointermove", "pointerup", "pointercancel", "touchstart", "touchmove", "touchend", "mousedown", "mouseup", "wheel", "keydown", "click"]) {
      window.addEventListener(t, onInput, opt);
      this.detach.push(() => window.removeEventListener(t, onInput, opt));
    }
    if (typeof document !== "undefined") {
      const onVis = (): void => (document.hidden ? this.sleep("hidden") : this.resume("hidden"));
      document.addEventListener("visibilitychange", onVis);
      this.detach.push(() => document.removeEventListener("visibilitychange", onVis));
      if (document.hidden) this.sleep("hidden");
    }
  }

  // ------------------------------------------------------------------ scheduling

  private cancel(): void {
    if (!this.sch) return;
    if (this.rafId) this.sch.caf(this.rafId);
    if (this.timerId) this.sch.clearTimeout(this.timerId);
    this.rafId = 0;
    this.timerId = 0;
  }

  /** Next vsync (no-op if one is already requested). */
  private request(): void {
    if (!this.sch || !this.game || this.rafId || this.sleeping.size > 0) return;
    if (this.timerId) {
      this.sch.clearTimeout(this.timerId);
      this.timerId = 0;
    }
    this.rafId = this.sch.raf(this.tick);
  }

  /** After a step: the next vsync at full rate, else a timer that lands one vsync before the next ambient step. */
  private schedule(): void {
    if (!this.sch || this.sleeping.size > 0) return;
    const t = this.sch.now();
    if (this.wantsFull(t)) {
      this.request();
      return;
    }
    const wait = this.lastStep + this.interval - t - FRAME_MS;
    if (wait <= 0) {
      this.request();
      return;
    }
    if (this.timerId || this.rafId) return;
    this.timerId = this.sch.setTimeout(() => {
      this.timerId = 0;
      this.request();
    }, wait);
  }

  private readonly tick = (time: number): void => {
    this.rafId = 0;
    const loop = this.loop;
    if (!loop || !loop.callback || this.sleeping.size > 0) return;
    const full = this.wantsFull(time);
    if (!full && time - this.lastStep < this.interval - DUE_SLACK_MS) {
      this.schedule(); // early (timer jitter): wait for the next vsync / timer
      return;
    }
    this.step(loop, time, full);
    this.schedule();
  };

  private step(loop: LoopLike, time: number, full: boolean): void {
    this.stepFull = full;
    if (full && !this.prevAmbient) {
      // Phaser's own step: delta smoothing, the cap after a sleep / focus change
      loop.step(time);
    } else {
      // an ambient step (or the first full one after it): the real gap since the last step
      const raw = Math.max(0, time - loop.lastTime);
      const delta = this.afterSleep ? Math.min(raw, FRAME_MS) : Math.min(raw, MAX_AMBIENT_DELTA);
      loop.now = time;
      loop.rawDelta = raw;
      loop.time += raw;
      loop.delta = delta;
      loop.lastTime = time;
      loop.frame++;
      loop.callback(time, delta);
    }
    this.afterSleep = false;
    this.prevAmbient = !full;
    this.lastStep = time;
    this.steps.push(time);
    if (this.steps.length > 240) this.steps.splice(0, this.steps.length - 240);
    const s = this.signature();
    if (s !== this.sig) {
      // the first signature is a baseline, not motion
      if (this.sig !== -1) this.motionUntil = time + this.graceMs;
      this.sig = s;
    }
  }

  // ------------------------------------------------------------------ public

  /** Input (or anything about to change the screen): full rate from the next vsync and for `holdMs`. */
  wake(holdMs = this.graceMs): void {
    if (!this.sch) {
      this.inputUntil = Math.max(this.inputUntil, now() + holdMs);
      return;
    }
    const t = this.sch.now();
    const wasFull = this.wantsFull(t);
    this.inputUntil = Math.max(this.inputUntil, t + holdMs);
    if (wasFull || !this.game) return;
    // at the ambient rate the scenes' clocks lag up to one interval: bring them to where they
    // would be at 60 fps (one vsync ago), so an animation this input starts is not cut short
    const c = t - FRAME_MS;
    for (const s of this.game.scene.scenes) if (s.sys.time && s.sys.settings.status === RUNNING && s.sys.time.now < c) s.sys.time.now = c;
    this.request();
  }

  /** Something animates that the motion signature cannot see (canvas re-bakes, easing state…): full rate a while longer. */
  keepAwake(holdMs = this.graceMs): void {
    const t = this.sch ? this.sch.now() : now();
    const was = this.wantsFull(t);
    this.awakeUntil = Math.max(this.awakeUntil, t + holdMs);
    if (!was) this.request();
  }

  /** No frames at all while any reason holds: "hidden", "app", "ad". */
  sleep(reason: string): void {
    this.sleeping.add(reason);
    this.cancel();
  }

  resume(reason: string): void {
    if (!this.sleeping.delete(reason) || this.sleeping.size > 0) return;
    // the long gap is not a delta (one capped frame, like Phaser's own resume)
    this.afterSleep = true;
    this.prevAmbient = true;
    this.inputUntil = Math.max(this.inputUntil, (this.sch ? this.sch.now() : now()) + this.graceMs);
    this.request();
  }

  /** Tests: true = always full rate, false = never full (ambient unless asleep), null = normal. */
  force(mode: boolean | null): void {
    this.forced = mode;
    this.request();
  }

  /** Is the current (or last) game step a full-rate one (not an ambient tick)? */
  get lastStepFull(): boolean {
    return this.stepFull;
  }

  private why(t: number): string[] {
    const w: string[] = [];
    if (this.forced === true) w.push("forced");
    if (this.forced === false) return w;
    if (t < this.inputUntil) w.push("input");
    if (t < this.motionUntil) w.push("motion");
    if (t < this.awakeUntil) w.push("awake");
    if (this.tweening()) w.push("tween");
    return w;
  }

  private wantsFull(t: number): boolean {
    if (this.forced !== null) return this.forced;
    return t < this.inputUntil || t < this.motionUntil || t < this.awakeUntil || this.tweening();
  }

  private tweening(): boolean {
    for (const s of this.game?.scene.scenes ?? []) {
      if (s.sys.settings.status !== RUNNING) continue;
      const tw = s.sys.tweens?.getTweens?.();
      if (tw && tw.length > 0) return true;
    }
    return false;
  }

  /** Hash of everything visible that is not ambient(), over every running, visible scene. */
  signature(): number {
    let h = 0x811c9dc5;
    for (const s of this.game?.scene.scenes ?? []) {
      const st = s.sys.settings;
      if (st.status !== RUNNING || !st.visible) continue;
      h = mix(h, 0x5ce);
      for (const c of s.sys.cameras?.cameras ?? []) {
        h = mix(h, c.visible ? 1 : 0);
        h = mix(h, Math.round(c.scrollX * 2));
        h = mix(h, Math.round(c.scrollY * 2));
        h = mix(h, Math.round(c.zoom * 1024));
        h = mix(h, Math.round(c.alpha * 128));
        h = mix(h, Math.round(c.x) ^ (Math.round(c.y) << 12) ^ (c.width << 2) ^ (c.height << 16));
      }
      for (const o of s.sys.displayList?.list ?? []) h = hashObj(h, o as Obj);
    }
    return h;
  }

  state(): GovState {
    const t = this.sch ? this.sch.now() : now();
    const fps = this.steps.filter((x) => x > t - 1000).length;
    const asleep = this.sleeping.size > 0;
    return {
      mode: asleep ? "asleep" : this.wantsFull(t) ? "full" : "ambient",
      fps,
      why: this.why(t),
      sleeping: [...this.sleeping],
      forced: this.forced,
      installed: this.game !== null,
    };
  }

  /**
   * DEV: display objects (not ambient) whose part of the signature changed since the previous
   * movers() call — what keeps the game at full rate while nothing should move. Call it twice,
   * a frame or more apart.
   */
  movers(): Array<{ path: string; type: string; key: string; x: number; y: number }> {
    const out: Array<{ path: string; type: string; key: string; x: number; y: number }> = [];
    const snap = new Map<object, number>();
    const prev = this.prevMovers;
    const walk = (list: unknown[], path: string): void => {
      list.forEach((c, i) => {
        const o = c as Obj;
        if (ambientSet.has(o)) return;
        const p = `${path}/${i}`;
        const h = hashObj(0, o, false);
        snap.set(o, h);
        if (prev && prev.has(o) && prev.get(o) !== h) {
          const fr = o.frame?.name;
          const key = `${o.texture?.key ?? ""}${fr !== undefined && fr !== "__BASE" ? `:${fr}` : ""}${o.type === "Text" ? ` "${o.text}"` : ""}`;
          out.push({ path: p, type: o.type ?? "?", key, x: Math.round(o.x ?? 0), y: Math.round(o.y ?? 0) });
        }
        if (o.list && o.visible) walk(o.list, p);
      });
    };
    this.game?.scene.scenes.forEach((s, si) => {
      if (s.sys.settings.status === RUNNING && s.sys.settings.visible) walk(s.sys.displayList?.list ?? [], `${si}`);
    });
    this.prevMovers = snap;
    return out;
  }
  private prevMovers: Map<object, number> | null = null;
}

/** The app's one governor (main.ts installs it after the first presented frame). */
export const governor = new FrameGovernor();
