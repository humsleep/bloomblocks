/**
 * Cue synthesizers. Each renders into `b.out` (the cue's own voice node) starting
 * at t0 and returns how long it rings (s). Pure WebAudio graph building: no
 * sample data is allocated per cue (noise comes from the shared buffer).
 */
import { biquad, clamp, EPS, envelope, noiseBurst, rand, tone, type Bus } from "./dsp.ts";
import { clampPitch, noteFreq } from "./scale.ts";
import type { CueName, CueOpts } from "./types.ts";

export type Synth = (b: Bus, t0: number, o: CueOpts) => number;
export type VoiceCue = Exclude<CueName, "nearComplete">;

/** Soft UI tick: D6 sine blip + a 4 kHz grain of noise. */
const tap: Synth = (b, t0) => {
  tone(b, "sine", noteFreq(7, 1), t0, 0.002, 0.11, 0.06);
  noiseBurst(b, t0, 0.01).connect(biquad(b.ctx, "bandpass", 4000, 1.2)).connect(envelope(b.ctx, b.out, t0, 0.001, 0.05, 0.008));
  return 0.1;
};

/** Wooden "tok" on the lantern's note + a small match-breath; brighter with more newly lit cells. */
const place: Synth = (b, t0, o) => {
  const { ctx } = b;
  const f = noteFreq(clampPitch(o.pitchIndex, 4));
  const bright = clamp((o.litCount ?? 1) / 10, 0, 1);

  // Body: sine with a 12 ms downward pitch blip (the "tok") and a fast decay.
  const body = ctx.createOscillator();
  body.frequency.setValueAtTime(f * 1.35, t0);
  body.frequency.exponentialRampToValueAtTime(f, t0 + 0.012);
  body.connect(envelope(ctx, b.out, t0, 0.002, 0.34, 0.11));
  body.start(t0);
  body.stop(t0 + 0.14);
  tone(b, "sine", f * 2.76, t0, 0.001, 0.08, 0.04); // wood bar's 2nd mode
  // Contact click.
  noiseBurst(b, t0, 0.012).connect(biquad(ctx, "bandpass", 2400, 0.9)).connect(envelope(ctx, b.out, t0, 0.0008, 0.12, 0.01));
  // Glow: octave triangle behind a lowpass that opens with litCount.
  const lp = biquad(ctx, "lowpass", 1200 + 3800 * bright, 0.5, b.out);
  tone(b, "triangle", f * 2, t0 + 0.008, 0.012, 0.025 + 0.05 * bright, 0.38, lp);
  // Match-breath: band-passed noise swell just after the tok.
  const tb = t0 + 0.025;
  noiseBurst(b, tb, 0.32, rand(0.9, 1.1))
    .connect(biquad(ctx, "bandpass", 1600 + 1400 * bright, 0.8))
    .connect(envelope(ctx, b.out, tb, 0.045, 0.045, 0.26));
  return 0.45;
};

/** Glass chimes climbing the scale, one per newly lit cell, 40 ms apart. */
const spread: Synth = (b, t0, o) => {
  const n = clamp(Math.round(o.litCount ?? 0), 0, 10);
  const start = clampPitch(o.pitchIndex, 4) + 5; // an octave above the lantern's own note
  for (let i = 0; i < n; i++) {
    let idx = start + i;
    while (idx > 19) idx -= 5; // keep below ~3.5 kHz
    const f = noteFreq(idx);
    const t = t0 + 0.04 * (i + 1);
    const g = 0.02 * (1 - i * 0.04);
    tone(b, "sine", f, t, 0.002, g, 0.55);
    tone(b, "sine", f * 2.76, t, 0.001, g * 0.3, 0.15); // inharmonic glass partial
  }
  return n ? 0.04 * (n + 1) + 0.6 : 0;
};

/** Low descending tone (−6 dB vs place) + a tiny blown-out puff. */
const remove: Synth = (b, t0, o) => {
  const { ctx } = b;
  const f = noteFreq(clampPitch(o.pitchIndex, 4), -1);
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(f, t0);
  osc.frequency.exponentialRampToValueAtTime(f * 0.75, t0 + 0.22);
  osc.connect(biquad(ctx, "lowpass", 900, 0.6)).connect(envelope(ctx, b.out, t0, 0.006, 0.085, 0.3));
  osc.start(t0);
  osc.stop(t0 + 0.34);
  noiseBurst(b, t0, 0.14).connect(biquad(ctx, "bandpass", 700, 0.7)).connect(envelope(ctx, b.out, t0, 0.01, 0.01, 0.12));
  return 0.36;
};

/**
 * Muted short tok (E3). With opts.sequence = [a, b] (two conflicting lanterns):
 * plus a soft minor-second pair in the 196–392 Hz register (beats at ~11–23 Hz, sine only, slow attack).
 */
const invalid: Synth = (b, t0, o) => {
  const { ctx } = b;
  const osc = ctx.createOscillator();
  osc.frequency.setValueAtTime(196, t0);
  osc.frequency.exponentialRampToValueAtTime(164.81, t0 + 0.01);
  osc.connect(biquad(ctx, "lowpass", 700, 0.5)).connect(envelope(ctx, b.out, t0, 0.002, 0.22, 0.055));
  osc.start(t0);
  osc.stop(t0 + 0.08);
  noiseBurst(b, t0, 0.008).connect(biquad(ctx, "lowpass", 1500)).connect(envelope(ctx, b.out, t0, 0.0008, 0.05, 0.006));

  const seq = o.sequence;
  if (!seq || seq.length < 2) return 0.1;
  let f1 = noteFreq(clampPitch(seq[0], 4));
  while (f1 >= 392) f1 /= 2;
  while (f1 < 196) f1 *= 2;
  const lp = biquad(ctx, "lowpass", 1400, 0.5, b.out);
  for (const f of [f1, f1 * 2 ** (1 / 12)]) {
    const s = ctx.createOscillator();
    s.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.018, t0 + 0.15);
    g.gain.setValueAtTime(0.018, t0 + 0.45);
    g.gain.exponentialRampToValueAtTime(EPS, t0 + 1.05);
    s.connect(g).connect(lp);
    s.start(t0);
    s.stop(t0 + 1.07);
  }
  return 1.1;
};

/** Leaf rustle: high band noise gated by 4–6 random micro-bursts within 140 ms. */
const stoneTap: Synth = (b, t0) => {
  const { ctx } = b;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  const hits = Array.from({ length: 4 + Math.floor(Math.random() * 3) }, () => t0 + Math.random() * 0.14).sort((x, y) => x - y);
  for (const t of hits) {
    g.gain.setTargetAtTime(rand(0.12, 0.26), t, 0.002);
    g.gain.setTargetAtTime(0, t + 0.006, 0.014);
  }
  noiseBurst(b, t0, 0.26, rand(0.85, 1.15))
    .connect(biquad(ctx, "highpass", 1400, 0.7))
    .connect(biquad(ctx, "bandpass", rand(2600, 4400), 0.7))
    .connect(g)
    .connect(b.out);
  return 0.32;
};

/**
 * Personal melody: each placed lantern's note in placement order (bell-ish
 * sine + octave), 50–130 ms apart, then a warm D(add9) chord, gently strummed.
 */
const complete: Synth = (b, t0, o) => {
  const { ctx } = b;
  const raw = o.sequence && o.sequence.length > 0 ? o.sequence : [0, 2, 4, 5, 7];
  const seq = evenSample(raw, 16).map((p) => clampPitch(p, 4));
  const n = seq.length;
  const step = clamp(0.75 / n, 0.05, 0.13);
  seq.forEach((p, i) => {
    const f = noteFreq(p);
    const t = t0 + i * step;
    const g = 0.055 * (0.8 + (0.2 * i) / Math.max(1, n - 1));
    tone(b, "sine", f, t, 0.003, g, 0.9);
    tone(b, "sine", f * 2, t, 0.002, g * 0.22, 0.3);
  });
  const tc = t0 + n * step + 0.06;
  const lp = biquad(ctx, "lowpass", 2400, 0.6, b.out);
  const chord = [146.83, 220, 293.66, 369.99, 440, 659.26]; // D3 A3 D4 F#4 A4 E5
  chord.forEach((f, k) => {
    const ts = tc + k * 0.014;
    for (const cents of [-4, 4]) {
      const s = ctx.createOscillator();
      s.type = k < 2 ? "sine" : "triangle";
      s.frequency.value = f * 2 ** (cents / 1200);
      s.connect(envelope(ctx, lp, ts, 0.09, 0.022, 2.4));
      s.start(ts);
      s.stop(ts + 2.52);
    }
  });
  return tc - t0 + 2.6;
};

/** Soft wind whoosh: band-passed noise sweeping 320→1500→520 Hz while panning left→right. */
const nextLevel: Synth = (b, t0) => {
  const { ctx } = b;
  const dur = 1.25;
  const bp = biquad(ctx, "bandpass", 320, 1.1);
  bp.frequency.setValueAtTime(320, t0);
  bp.frequency.exponentialRampToValueAtTime(1500, t0 + 0.55);
  bp.frequency.exponentialRampToValueAtTime(520, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(0.28, t0 + 0.5);
  g.gain.exponentialRampToValueAtTime(EPS, t0 + dur);
  const pan = ctx.createStereoPanner();
  pan.pan.setValueAtTime(-0.5, t0);
  pan.pan.linearRampToValueAtTime(0.5, t0 + dur);
  noiseBurst(b, t0, dur, 0.9).connect(bp).connect(g).connect(pan).connect(b.out);
  return dur + 0.05;
};

export const SYNTHS: Record<VoiceCue, Synth> = { tap, place, spread, remove, invalid, stoneTap, complete, nextLevel };

/** Voice-steal priority: lower = more important (stolen last). */
export const PRIORITY: Record<VoiceCue, 0 | 1 | 2> = {
  complete: 0,
  nextLevel: 0,
  place: 1,
  remove: 1,
  invalid: 1,
  spread: 2,
  tap: 2,
  stoneTap: 2,
};

function evenSample<T>(xs: readonly T[], max: number): T[] {
  if (xs.length <= max) return xs.slice();
  return Array.from({ length: max }, (_, i) => xs[Math.round((i * (xs.length - 1)) / (max - 1))] as T);
}
