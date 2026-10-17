/**
 * DEV: renders cues through the real mixer graph in an OfflineAudioContext and
 * measures sample peak (dBFS) and BS.1770 loudness (K-weighted, 48 kHz):
 * max momentary (400 ms) and gated integrated LUFS.
 */
import { Ambient } from "../ambient.ts";
import { buildGraph, type Graph } from "../graph.ts";
import { SYNTHS, type VoiceCue } from "../synth.ts";
import type { AmbientLevel, CueOpts } from "../types.ts";

const SR = 48000;

export interface Stats {
  label: string;
  peakDb: number;
  maxMomentary: number;
  integrated: number;
}

type Build = (ctx: OfflineAudioContext, g: Graph) => void;

async function render(secs: number, build: Build): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * secs), SR);
  build(ctx, buildGraph(ctx));
  return ctx.startRendering();
}

function kWeight(x: Float32Array): Float64Array {
  // BS.1770-4 pre-filter (high shelf) + RLB high-pass, 48 kHz coefficients.
  const stages: [number[], number[]][] = [
    [[1.53512485958697, -2.69169618940638, 1.19839281085285], [-1.69065929318241, 0.73248077421585]],
    [[1.0, -2.0, 1.0], [-1.99004745483398, 0.99007225036621]],
  ];
  let cur = Float64Array.from(x);
  for (const [b, a] of stages) {
    const [b0 = 0, b1 = 0, b2 = 0] = b;
    const [a1 = 0, a2 = 0] = a;
    const out = new Float64Array(cur.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < cur.length; i++) {
      const xi = cur[i] ?? 0;
      const y = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = xi; y2 = y1; y1 = y;
      out[i] = y;
    }
    cur = out;
  }
  return cur;
}

export function analyse(label: string, buf: AudioBuffer, fromSec = 0): Stats {
  let peak = 0;
  const chans: Float64Array[] = [];
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i] ?? 0));
    chans.push(kWeight(d));
  }
  const win = Math.round(0.4 * SR);
  const hop = Math.round(0.1 * SR);
  const blocks: number[] = [];
  for (let s = Math.round(fromSec * SR); s + win <= buf.length; s += hop) {
    let z = 0;
    for (const ch of chans) {
      let acc = 0;
      for (let i = s; i < s + win; i++) acc += (ch[i] ?? 0) ** 2;
      z += acc / win;
    }
    blocks.push(z);
  }
  const lufs = (z: number): number => -0.691 + 10 * Math.log10(z || 1e-12);
  const maxMomentary = blocks.length ? Math.max(...blocks.map(lufs)) : -Infinity;
  const abs = blocks.filter((z) => lufs(z) > -70);
  const mean = (zs: number[]): number => zs.reduce((a, b) => a + b, 0) / Math.max(1, zs.length);
  const rel = lufs(mean(abs)) - 10;
  const gated = abs.filter((z) => lufs(z) > rel);
  return { label, peakDb: 20 * Math.log10(peak || 1e-9), maxMomentary, integrated: gated.length ? lufs(mean(gated)) : -Infinity };
}

function cue(ctx: OfflineAudioContext, g: Graph, name: VoiceCue, t: number, opts: CueOpts = {}): void {
  const out = ctx.createGain();
  out.connect(g.sfx);
  SYNTHS[name]({ ctx, out, noise: g.noise }, t, opts);
}

const CASES: { label: string; secs: number; from?: number; build: Build }[] = [
  { label: "tap", secs: 0.6, build: (c, g) => cue(c, g, "tap", 0.05) },
  { label: "stoneTap", secs: 0.6, build: (c, g) => cue(c, g, "stoneTap", 0.05) },
  { label: "place p2 lit1", secs: 0.8, build: (c, g) => cue(c, g, "place", 0.05, { pitchIndex: 2, litCount: 1 }) },
  { label: "place p14 lit10", secs: 0.8, build: (c, g) => cue(c, g, "place", 0.05, { pitchIndex: 14, litCount: 10 }) },
  { label: "spread lit10", secs: 1.3, build: (c, g) => cue(c, g, "spread", 0.05, { pitchIndex: 7, litCount: 10 }) },
  { label: "place+spread p7 lit8", secs: 1.3, build: (c, g) => (cue(c, g, "place", 0.05, { pitchIndex: 7, litCount: 8 }), cue(c, g, "spread", 0.05, { pitchIndex: 7, litCount: 8 })) },
  { label: "remove p2", secs: 0.8, build: (c, g) => cue(c, g, "remove", 0.05, { pitchIndex: 2 }) },
  { label: "invalid", secs: 0.6, build: (c, g) => cue(c, g, "invalid", 0.05) },
  { label: "invalid conflict", secs: 1.5, build: (c, g) => cue(c, g, "invalid", 0.05, { sequence: [4, 9] }) },
  { label: "complete 7", secs: 4, build: (c, g) => cue(c, g, "complete", 0.05, { sequence: [2, 5, 3, 7, 9, 6, 10] }) },
  { label: "complete 16", secs: 4.2, build: (c, g) => cue(c, g, "complete", 0.05, { sequence: Array.from({ length: 16 }, (_, i) => (i * 3) % 15) }) },
  { label: "nextLevel", secs: 1.6, build: (c, g) => cue(c, g, "nextLevel", 0.05) },
  { label: "nearComplete pad", secs: 3, from: 1, build: (_c, g) => new Ambient(g).swell(0.05) },
  ...([1, 2, 3] as AmbientLevel[]).map((lv) => ({
    label: `ambient ${lv}`,
    secs: 16,
    from: 4,
    build: (_c: OfflineAudioContext, g: Graph) => {
      const a = new Ambient(g);
      a.setLevel(lv, 0);
      a.tick(0, 16);
    },
  })),
  {
    label: "cascade 12×(place+spread) /50ms, no limiter",
    secs: 1.8,
    build: (c, g) => {
      for (let i = 0; i < 12; i++) {
        cue(c, g, "place", 0.05 + i * 0.05, { pitchIndex: i, litCount: 10 });
        cue(c, g, "spread", 0.05 + i * 0.05, { pitchIndex: i, litCount: 10 });
      }
    },
  },
  {
    label: "ref: 1 kHz sine 0.25 (−12 dBFS) through chain",
    secs: 1,
    from: 0.2,
    build: (c, g) => {
      const o = c.createOscillator();
      o.frequency.value = 1000;
      const k = c.createGain();
      k.gain.value = 0.25;
      o.connect(k).connect(g.sfx);
      o.start(0);
    },
  },
];

export async function measureAll(): Promise<Stats[]> {
  const out: Stats[] = [];
  for (const c of CASES) out.push(analyse(c.label, await render(c.secs, c.build), c.from ?? 0));
  return out;
}
