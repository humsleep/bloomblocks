/**
 * Lazily loaded audio runtime (its own chunk: nothing here is parsed at cold
 * start). Owns the mixer graph, the voice limiter and the ambient scheduler for
 * the one AudioContext that cues.ts creates on the first user gesture.
 */
import { Ambient } from "./ambient.ts";
import { hold } from "./dsp.ts";
import { buildGraph, type Graph } from "./graph.ts";
import { PRIORITY, SYNTHS } from "./synth.ts";
import type { AmbientLevel, CueName, CueOpts } from "./types.ts";

/** Max simultaneous cue voices (ambient and pad are separate and not counted). */
export const MAX_VOICES = 12;
const LOOKAHEAD = 0.6; // s of ambient grains scheduled ahead
const TICK_MS = 200;
const LEAD = 0.008; // schedule slightly ahead of currentTime so attacks are never truncated

interface Live {
  out: GainNode;
  end: number;
  prio: number;
  born: number;
}

export class Runtime {
  readonly graph: Graph;
  readonly ambient: Ambient;
  private live: Live[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private active = true;

  constructor(readonly ctx: AudioContext) {
    this.graph = buildGraph(ctx);
    this.ambient = new Ambient(this.graph);
  }

  play(name: CueName, opts: CueOpts): void {
    const now = this.ctx.currentTime;
    if (name === "nearComplete") {
      this.ambient.swell(now);
      return;
    }
    if (name === "complete") this.ambient.release(now, 1.6);
    else if (name === "nextLevel" || name === "remove") this.ambient.release(now, 0.7);

    const prio = PRIORITY[name];
    if (!this.admit(prio, now)) return;
    const out = this.ctx.createGain();
    out.connect(this.graph.sfx);
    const t0 = now + LEAD;
    const len = SYNTHS[name]({ ctx: this.ctx, out, noise: this.graph.noise }, t0, opts);
    this.live.push({ out, end: t0 + len, prio, born: now });
  }

  /** Voice limiter: drop finished voices; when full, steal the least important (then oldest) or refuse. */
  private admit(prio: number, now: number): boolean {
    this.live = this.live.filter((v) => {
      if (v.end > now) return true;
      v.out.disconnect();
      return false;
    });
    if (this.live.length < MAX_VOICES) return true;
    let victim: Live | undefined;
    for (const v of this.live) {
      if (!victim || v.prio > victim.prio || (v.prio === victim.prio && v.born < victim.born)) victim = v;
    }
    if (!victim || victim.prio < prio) return false; // everything playing matters more than this cue
    const g = victim.out.gain;
    g.setValueAtTime(1, now);
    g.linearRampToValueAtTime(0, now + 0.025); // 25 ms fade: no click
    const out = victim.out;
    setTimeout(() => out.disconnect(), 80);
    this.live.splice(this.live.indexOf(victim), 1);
    return true;
  }

  get voiceCount(): number {
    const now = this.ctx.currentTime;
    return this.live.filter((v) => v.end > now).length;
  }

  setAmbient(level: AmbientLevel): void {
    this.ambient.setLevel(level, this.ctx.currentTime);
    this.syncTimer();
  }

  /** Fade the post-limiter fader (mute / background) and run the ambient scheduler only while audible. */
  setActive(on: boolean): void {
    this.active = on;
    const t = this.ctx.currentTime;
    const p = this.graph.fader.gain;
    hold(p, t);
    p.linearRampToValueAtTime(on ? 1 : 0, t + (on ? 0.3 : 0.04));
    this.syncTimer();
  }

  private syncTimer(): void {
    const want = this.active && this.ambient.needsTicks;
    if (want && !this.timer) {
      this.tick();
      this.timer = setInterval(() => this.tick(), TICK_MS);
    } else if (!want && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private tick(): void {
    if (this.ctx.state !== "running") return; // frozen clock: nothing new to schedule
    const now = this.ctx.currentTime;
    this.ambient.tick(now, now + LOOKAHEAD);
  }
}

export function createRuntime(ctx: AudioContext): Runtime {
  return new Runtime(ctx);
}
