/** Small synthesis primitives. Context-agnostic (work on AudioContext and OfflineAudioContext). */

export const EPS = 1e-4; // -80 dB: end point of exponential decays

export const dB = (d: number): number => 10 ** (d / 20);
export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const rand = (lo: number, hi: number): number => lo + Math.random() * (hi - lo);
/** Log-uniform random value (for frequencies). */
export const randLog = (lo: number, hi: number): number => lo * (hi / lo) ** Math.random();

/** Where a cue renders: its own voice gain node plus the shared pre-generated noise. */
export interface Bus {
  ctx: BaseAudioContext;
  out: AudioNode;
  noise: AudioBuffer;
}

export function biquad(ctx: BaseAudioContext, type: BiquadFilterType, freq: number, q = 0.707, dest?: AudioNode): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  if (dest) f.connect(dest);
  return f;
}

/** Gain node: 0 → linear attack to `peak` → exponential decay to silence. Connected to `dest`. */
export function envelope(ctx: BaseAudioContext, dest: AudioNode, t0: number, attack: number, peak: number, decay: number): GainNode {
  const g = ctx.createGain();
  const p = g.gain;
  const end = t0 + attack + decay;
  p.setValueAtTime(0, t0);
  p.linearRampToValueAtTime(Math.max(peak, 2 * EPS), t0 + attack);
  p.exponentialRampToValueAtTime(EPS, end);
  p.setValueAtTime(0, end);
  g.connect(dest);
  return g;
}

/** One enveloped oscillator, self-stopping. */
export function tone(
  b: Bus,
  type: OscillatorType,
  freq: number,
  t0: number,
  attack: number,
  peak: number,
  decay: number,
  dest: AudioNode = b.out,
): OscillatorNode {
  const o = b.ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  o.connect(envelope(b.ctx, dest, t0, attack, peak, decay));
  o.start(t0);
  o.stop(t0 + attack + decay + 0.02);
  return o;
}

/** A slice of the shared white-noise buffer from a random offset (every burst differs; no allocation of sample data). */
export function noiseBurst(b: Bus, t0: number, dur: number, rate = 1): AudioBufferSourceNode {
  const s = b.ctx.createBufferSource();
  s.buffer = b.noise;
  s.playbackRate.value = rate;
  const span = dur * rate;
  s.start(t0, Math.random() * Math.max(0, b.noise.duration - span - 0.01), span);
  return s;
}

/** Freeze a param at time t so a new ramp can start from wherever it currently is. */
export function hold(p: AudioParam, t: number): void {
  if (typeof p.cancelAndHoldAtTime === "function") {
    p.cancelAndHoldAtTime(t);
  } else {
    const v = p.value;
    p.cancelScheduledValues(t);
    p.setValueAtTime(v, t);
  }
}

/**
 * Pre-generated mono noise, made once per context. Deterministic (xorshift) and
 * loop-seamless: the overhang is cross-faded into the head so `loop = true` never clicks.
 */
export function makeNoise(ctx: BaseAudioContext, seconds: number, color: "white" | "brown", seed: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * seconds);
  const fade = Math.floor(sr * 0.05);
  const raw = new Float32Array(n + fade);
  let s = seed | 0 || 1;
  let br = 0;
  for (let i = 0; i < raw.length; i++) {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    const w = ((s >>> 0) / 4294967296) * 2 - 1;
    if (color === "white") raw[i] = w;
    else {
      br = (br + 0.02 * w) / 1.02; // leaky integrator → brown (−6 dB/oct), no DC drift
      raw[i] = br;
    }
  }
  const buf = ctx.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < n; i++) {
    let v = raw[i] ?? 0;
    if (i < fade) {
      const x = i / fade;
      v = v * Math.sqrt(x) + (raw[n + i] ?? 0) * Math.sqrt(1 - x);
    }
    d[i] = v;
    peak = Math.max(peak, Math.abs(v));
  }
  const k = peak > 0 ? 0.9 / peak : 1;
  for (let i = 0; i < n; i++) d[i] = (d[i] ?? 0) * k;
  return buf;
}
