/**
 * Dusk-hill-town ambience, built from randomized grains so it never loops audibly:
 *   level 1: light wind  — 2 looped brown-noise voices, band-pass + gain wander on random 2–6 s gusts
 *   level 2: + crickets  — 3 "bugs" (fixed pitch/pan/rhythm each), 3–5-pulse chirps, random rests
 *   level 3: + water     — low-passed brown-noise stream + sparse random bubble grains (Poisson)
 * plus the near-complete pad (a warm D add9 drone) that swells in on demand.
 *
 * Grains are scheduled by `tick(now, horizon)` — the runtime calls it every 200 ms
 * with a 600 ms lookahead; the DEV meter calls it once for a whole offline render.
 */
import { biquad, dB, EPS, hold, makeNoise, rand, randLog } from "./dsp.ts";
import type { Graph } from "./graph.ts";
import type { AmbientLevel } from "./types.ts";

const LAYER_FADE = 2.5;
const WIND_LEVEL = 0.16;
const CRICKET_LEVEL = 0.5;
const WATER_LEVEL = 0.085;
const PAD_LEVEL = 0.011; // per oscillator (8 of them)
const SWELL = dB(3);
const PAD_AUTO_RELEASE_MS = 24_000;

interface Layer {
  setOn(on: boolean, t: number): void;
  schedule(from: number, to: number): void;
}

function fadeTo(p: AudioParam, t: number, v: number, secs: number): void {
  hold(p, t);
  p.linearRampToValueAtTime(v, t + secs);
}

class Wind implements Layer {
  private readonly out: GainNode;
  private voices: { src: AudioBufferSourceNode; bp: BiquadFilterNode; g: GainNode; next: number }[] = [];
  private on = false;

  constructor(private readonly ctx: BaseAudioContext, dest: AudioNode, private readonly brown: () => AudioBuffer) {
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(dest);
  }

  setOn(on: boolean, t: number): void {
    if (on === this.on) return;
    this.on = on;
    if (on) {
      for (const side of [-0.55, 0.55]) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.brown();
        src.loop = true;
        src.playbackRate.value = rand(0.9, 1.1);
        const bp = biquad(this.ctx, "bandpass", randLog(300, 700), 0.6);
        const g = this.ctx.createGain();
        g.gain.value = 0.5;
        const pan = this.ctx.createStereoPanner();
        pan.pan.value = side;
        src.connect(bp).connect(g).connect(pan).connect(this.out);
        src.start(t, rand(0, 3));
        this.voices.push({ src, bp, g, next: t });
      }
      fadeTo(this.out.gain, t, WIND_LEVEL, LAYER_FADE);
    } else {
      fadeTo(this.out.gain, t, 0, LAYER_FADE);
      for (const v of this.voices) v.src.stop(t + LAYER_FADE + 0.05);
      this.voices = [];
    }
  }

  schedule(from: number, to: number): void {
    for (const v of this.voices) {
      while (v.next < to) {
        const at = Math.max(v.next, from);
        v.bp.frequency.setTargetAtTime(randLog(260, 900), at, rand(1, 3));
        v.g.gain.setTargetAtTime(rand(0.2, 1), at, rand(1.2, 3.5));
        v.src.playbackRate.setTargetAtTime(rand(0.85, 1.15), at, 2);
        v.next = at + rand(2, 6);
      }
    }
  }
}

interface Bug {
  f: number;
  amp: number;
  pulses: number;
  len: number;
  gap: number;
  pan: StereoPannerNode;
  next: number;
}

class Crickets implements Layer {
  private readonly out: GainNode;
  private readonly bugs: Bug[];
  private on = false;

  constructor(private readonly ctx: BaseAudioContext, dest: AudioNode) {
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(dest);
    this.bugs = [
      [4300, -0.6, 0.012, 3],
      [4750, 0.45, 0.009, 4],
      [5100, 0.1, 0.006, 5],
    ].map(([f, p, amp, pulses]) => {
      const pan = ctx.createStereoPanner();
      pan.pan.value = p ?? 0;
      pan.connect(this.out);
      return { f: f ?? 4500, amp: amp ?? 0.008, pulses: pulses ?? 3, len: rand(0.012, 0.018), gap: rand(0.026, 0.038), pan, next: 0 };
    });
  }

  setOn(on: boolean, t: number): void {
    if (on === this.on) return;
    this.on = on;
    fadeTo(this.out.gain, t, on ? CRICKET_LEVEL : 0, on ? LAYER_FADE + 1 : LAYER_FADE);
    if (on) for (const b of this.bugs) b.next = t + rand(0.3, 3);
  }

  schedule(from: number, to: number): void {
    if (!this.on) return;
    for (const b of this.bugs) {
      while (b.next < to) {
        const at = Math.max(b.next, from);
        this.chirp(b, at);
        b.next = at + rand(0.5, 1.4) + (Math.random() < 0.12 ? rand(3, 9) : 0);
      }
    }
  }

  private chirp(b: Bug, t: number): void {
    const o = this.ctx.createOscillator();
    o.frequency.value = b.f * rand(0.994, 1.006);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    const amp = b.amp * rand(0.6, 1);
    for (let k = 0; k < b.pulses; k++) {
      const tk = t + k * (b.len + b.gap);
      g.gain.setValueAtTime(0, tk);
      g.gain.linearRampToValueAtTime(amp, tk + 0.003);
      g.gain.linearRampToValueAtTime(0, tk + b.len);
    }
    o.connect(g).connect(b.pan);
    o.start(t);
    o.stop(t + b.pulses * (b.len + b.gap));
  }
}

class Water implements Layer {
  private readonly out: GainNode;
  private readonly bubbleBus: BiquadFilterNode;
  private readonly sides: StereoPannerNode[];
  private stream: { src: AudioBufferSourceNode; g: GainNode } | null = null;
  private nextSwell = 0;
  private nextBubble = 0;
  private on = false;

  constructor(private readonly ctx: BaseAudioContext, dest: AudioNode, private readonly brown: () => AudioBuffer) {
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(dest);
    this.sides = [-0.5, 0.35].map((p) => {
      const pan = ctx.createStereoPanner();
      pan.pan.value = p;
      pan.connect(this.out);
      return pan;
    });
    this.bubbleBus = biquad(ctx, "lowpass", 1800, 0.5);
    for (const s of this.sides) this.bubbleBus.connect(s);
  }

  setOn(on: boolean, t: number): void {
    if (on === this.on) return;
    this.on = on;
    if (on) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.brown();
      src.loop = true;
      src.playbackRate.value = 1.25;
      const g = this.ctx.createGain();
      g.gain.value = 0.7;
      src.connect(biquad(this.ctx, "lowpass", 800, 0.5)).connect(biquad(this.ctx, "highpass", 140, 0.5)).connect(g).connect(this.out);
      src.start(t, rand(0, 3));
      this.stream = { src, g };
      this.nextSwell = t;
      this.nextBubble = t + rand(0.5, 1.5);
      fadeTo(this.out.gain, t, WATER_LEVEL, LAYER_FADE + 1);
    } else {
      fadeTo(this.out.gain, t, 0, LAYER_FADE);
      this.stream?.src.stop(t + LAYER_FADE + 0.05);
      this.stream = null;
    }
  }

  schedule(from: number, to: number): void {
    if (!this.on || !this.stream) return;
    while (this.nextSwell < to) {
      const at = Math.max(this.nextSwell, from);
      this.stream.g.gain.setTargetAtTime(rand(0.5, 1), at, rand(1.5, 3));
      this.nextSwell = at + rand(3, 7);
    }
    while (this.nextBubble < to) {
      const at = Math.max(this.nextBubble, from);
      this.bubble(at);
      this.nextBubble = at + 0.04 - Math.log(1 - Math.random()) * 0.16; // Poisson-ish spacing, mean ~0.2 s
    }
  }

  private bubble(t: number): void {
    const f0 = randLog(320, 900);
    const d = rand(0.025, 0.06);
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * rand(1.4, 1.9), t + d);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(rand(0.04, 0.12), t + 0.003);
    g.gain.exponentialRampToValueAtTime(EPS, t + d + 0.03);
    o.connect(g).connect(this.bubbleBus);
    o.start(t);
    o.stop(t + d + 0.04);
  }
}

interface Pad {
  oscs: OscillatorNode[];
  g: GainNode;
}

export class Ambient {
  private readonly layers: Layer[];
  private brownBuf: AudioBuffer | null = null;
  private level: AmbientLevel = 0;
  private until = 0;
  private pad: Pad | null = null;
  private padTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly g: Graph) {
    // Brown noise (3.1 s, ~150k samples) is only generated when a layer first needs it.
    const brown = (): AudioBuffer => (this.brownBuf ??= makeNoise(g.ctx, 3.1, "brown", 0x5eed));
    this.layers = [new Wind(g.ctx, g.amb, brown), new Crickets(g.ctx, g.amb), new Water(g.ctx, g.amb, brown)];
  }

  /** True while grains need scheduling (the runtime only runs its timer then). */
  get needsTicks(): boolean {
    return this.level > 0;
  }

  setLevel(level: AmbientLevel, t: number): void {
    this.level = level;
    this.layers.forEach((l, i) => l.setOn(level > i, t));
  }

  tick(now: number, horizon: number): void {
    const from = Math.max(this.until, now);
    if (horizon <= from) return;
    for (const l of this.layers) l.schedule(from, horizon);
    this.until = horizon;
  }

  /** nearComplete: pad fades in and the ambient bus rises +3 dB, both over 800 ms. Idempotent. */
  swell(t: number): void {
    if (!this.pad) {
      const { ctx } = this.g;
      const lp = biquad(ctx, "lowpass", 1000, 0.5);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const depth = ctx.createGain();
      depth.gain.value = 300;
      lfo.connect(depth).connect(lp.frequency);
      const g = ctx.createGain();
      g.gain.value = 0;
      lp.connect(g).connect(this.g.pad);
      const oscs = [lfo];
      for (const f of [146.83, 220, 329.63, 369.99]) {
        for (const cents of [-5, 5]) {
          const o = ctx.createOscillator();
          o.frequency.value = f * 2 ** (cents / 1200);
          o.connect(lp);
          oscs.push(o);
        }
      }
      for (const o of oscs) o.start(t);
      this.pad = { oscs, g };
    }
    fadeTo(this.pad.g.gain, t, 1 * PAD_LEVEL, 0.8);
    fadeTo(this.g.amb.gain, t, SWELL, 0.8);
    if (this.padTimer) clearTimeout(this.padTimer);
    // Don't drone forever if the player sits one lantern short.
    this.padTimer = setTimeout(() => this.release(this.g.ctx.currentTime, 4), PAD_AUTO_RELEASE_MS);
  }

  /** Pad out + ambient back to its base level (complete / nextLevel / remove). */
  release(t: number, fade: number): void {
    if (this.padTimer) clearTimeout(this.padTimer);
    this.padTimer = null;
    const pad = this.pad;
    if (!pad) return;
    this.pad = null;
    fadeTo(pad.g.gain, t, 0, fade);
    fadeTo(this.g.amb.gain, t, 1, fade);
    for (const o of pad.oscs) o.stop(t + fade + 0.05);
  }
}
