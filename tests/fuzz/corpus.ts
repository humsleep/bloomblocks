// Level corpus for the fuzz lane. Per track: the real track levels 1..REAL (the exact boards
// players get) plus "track-shaped" boards up to FUZZ_LEVELS: generatePips with the track's own
// size / density / tier cap / requireT3 for level n, a fuzz seed key and one scored attempt
// (no band/trick/opening search, so ~5 ms each instead of up to seconds). Every board still
// passes the generator's exact uniqueness gate.
import { generatePips, type PipsGenParams } from "../../games/lanterns-pips/generator.ts";
import { countSolutions } from "../../games/lanterns-pips/solver.ts";
import { levelForTrack, type Track, trackParams } from "../../games/lanterns-pips/tracks.ts";
import type { BB, PipsLevel } from "../../games/lanterns-pips/rules.ts";

export const LEVELS = Number(process.env["FUZZ_LEVELS"] ?? 500);
/** Consecutive dailies (round 6: 800, the daily acceptance window). */
export const DAYS = Number(process.env["FUZZ_DAYS"] ?? 800);
/** Real track levels in the corpus (gentle finales 10/20 included: they are the slowest). */
export const REAL = Math.min(LEVELS, Number(process.env["FUZZ_REAL"] ?? 12));

export interface Item {
  readonly label: string;
  readonly level: PipsLevel;
  readonly solution: BB;
}

function shaped(track: Track, n: number): PipsLevel {
  const { trick: _t, opening: _o, t2: _t2, isolatedMax: _i, tailMax: _tm, ...p } = trackParams(track, n) as unknown as PipsGenParams & Record<string, unknown>;
  for (let k = 0; ; k++) {
    try {
      return generatePips({ ...(p as PipsGenParams), maxAttempts: 1, seedKey: `fuzz:${track}:${n}:${k}` }).level;
    } catch (e) {
      if (k > 20) throw e;
    }
  }
}

const memo = new Map<Track, Item[]>();

export function corpus(track: Track): Item[] {
  const hit = memo.get(track);
  if (hit) return hit;
  const out: Item[] = [];
  for (let n = 1; n <= LEVELS; n++) {
    const level = n <= REAL ? levelForTrack(track, n) : shaped(track, n);
    const r = countSolutions(level, 2, 2_000_000);
    if (r.count !== 1 || !r.solution) throw new Error(`${track} ${n}: ${r.count} solutions`);
    out.push({ label: `${track} ${n <= REAL ? "level" : "shaped"} ${n}`, level, solution: r.solution });
  }
  memo.set(track, out);
  return out;
}

export function cells(bb: BB): number[] {
  const o: number[] = [];
  for (let i = 0; i < 64; i++) if (((i < 32 ? bb.lo >>> i : bb.hi >>> (i - 32)) & 1) === 1) o.push(i);
  return o;
}

export function floor(l: PipsLevel): number[] {
  const o: number[] = [];
  for (let y = 0; y < l.h; y++) for (let x = 0; x < l.w; x++) {
    const i = y * 8 + x;
    if (((i < 32 ? l.stones.lo >>> i : l.stones.hi >>> (i - 32)) & 1) === 0) o.push(i);
  }
  return o;
}

/** Deterministic PRNG (mulberry32) — the fuzz lane is reproducible from its seed. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function deepFreeze<T>(o: T): T {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as object)) deepFreeze(v);
  }
  return o;
}
