/**
 * Mixer graph (one per context):
 *
 *   cue voices ─► sfx ─┐
 *   ambient layers ─► amb ─┼─► mix ─► compressor/limiter ─► trim ─► fader ─► destination
 *   near-complete pad ─► pad ─┘
 *
 * `fader` sits after the limiter so mute/background fades never make the
 * compressor pump. Same function builds the offline graph used by the DEV meter,
 * so measured levels are the shipped levels.
 */
import { dB, makeNoise } from "./dsp.ts";

export interface Graph {
  ctx: BaseAudioContext;
  sfx: GainNode;
  amb: GainNode;
  pad: GainNode;
  fader: GainNode;
  /** 2 s white noise shared by every noise-based cue (match breath, rustle, whoosh…). */
  noise: AudioBuffer;
}

/** Pre-limiter mix level (headroom for cascades). */
export const MIX_LEVEL = dB(-3);
/** Post-limiter trim: cancels most of the DynamicsCompressor's automatic makeup gain. */
export const TRIM = dB(-4);
/** Cue bus gain (calibrated with the DEV meter: place ≈ −21 LUFS momentary, complete ≈ −16, peaks ≤ −5 dBFS). */
export const SFX_LEVEL = dB(10);

export function buildGraph(ctx: BaseAudioContext): Graph {
  const mix = ctx.createGain();
  mix.gain.value = MIX_LEVEL;

  // Gentle glue + safety limiting in one node (each extra compressor adds its own makeup gain).
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 10;
  comp.ratio.value = 10;
  comp.attack.value = 0.002;
  comp.release.value = 0.18;

  const trim = ctx.createGain();
  trim.gain.value = TRIM;
  const fader = ctx.createGain();
  fader.gain.value = 1;
  mix.connect(comp).connect(trim).connect(fader).connect(ctx.destination);

  const bus = (): GainNode => {
    const g = ctx.createGain();
    g.connect(mix);
    return g;
  };
  const sfx = bus();
  sfx.gain.value = SFX_LEVEL;
  return { ctx, sfx, amb: bus(), pad: bus(), fader, noise: makeNoise(ctx, 2, "white", 0x1a7e) };
}
