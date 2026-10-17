// xoshiro128** 1.1 (Blackman & Vigna), seeded from SHA-256 of a UTF-8 key.
//
// Seed derivation (canonical, must match every port):
//   seed16 = sha256(utf8(seedKey))[0..16)
//   s[i]   = little-endian u32 of seed16[4i..4i+4), i = 0..3
// An all-zero state is invalid for xoshiro and is rejected.

import { utf8 } from "./bytes.ts";
import { sha256 } from "./sha256.ts";

/** A seed key string ("lanterns:daily:2026-10-12") or an already-derived 16-byte seed. */
export type SeedInput = string | Uint8Array;

export function deriveSeed(input: SeedInput): Uint8Array {
  if (typeof input === "string") return sha256(utf8(input)).slice(0, 16);
  if (input.length !== 16) throw new RangeError("seed must be 16 bytes");
  return input.slice();
}

const rotl = (x: number, k: number): number => ((x << k) | (x >>> (32 - k))) >>> 0;

export class Rng {
  private s0: number;
  private s1: number;
  private s2: number;
  private s3: number;

  /** From 4 raw state words (reference-implementation seeding). */
  constructor(s0: number, s1: number, s2: number, s3: number) {
    this.s0 = s0 >>> 0;
    this.s1 = s1 >>> 0;
    this.s2 = s2 >>> 0;
    this.s3 = s3 >>> 0;
    if ((this.s0 | this.s1 | this.s2 | this.s3) === 0) throw new RangeError("xoshiro state must not be all zero");
  }

  static from(input: SeedInput): Rng {
    const b = deriveSeed(input);
    const w = (i: number): number => (b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16) | (b[i + 3]! << 24)) >>> 0;
    return new Rng(w(0), w(4), w(8), w(12));
  }

  /** Snapshot of the 4 state words, for save/restore. */
  state(): [number, number, number, number] {
    return [this.s0, this.s1, this.s2, this.s3];
  }

  clone(): Rng {
    return new Rng(this.s0, this.s1, this.s2, this.s3);
  }

  nextU32(): number {
    const result = Math.imul(rotl(Math.imul(this.s1, 5) >>> 0, 7), 9) >>> 0;
    const t = (this.s1 << 9) >>> 0;
    this.s2 = (this.s2 ^ this.s0) >>> 0;
    this.s3 = (this.s3 ^ this.s1) >>> 0;
    this.s1 = (this.s1 ^ this.s2) >>> 0;
    this.s0 = (this.s0 ^ this.s3) >>> 0;
    this.s2 = (this.s2 ^ t) >>> 0;
    this.s3 = rotl(this.s3, 11);
    return result;
  }

  /**
   * Uniform integer in [0, n), 1 <= n <= 0xFFFFFFFF, without modulo bias.
   * Canonical algorithm (ports must match draw-for-draw):
   *   threshold = (2^32 - n) mod n      // == 2^32 mod n
   *   loop { x = nextU32(); if (x >= threshold) return x mod n }
   */
  nextInt(n: number): number {
    if (!Number.isInteger(n) || n < 1 || n > 0xffffffff) throw new RangeError("nextInt: n out of range");
    const threshold = ((0x100000000 - n) >>> 0) % n;
    for (;;) {
      const x = this.nextU32();
      if (x >= threshold) return x % n;
    }
  }

  /** In-place Fisher-Yates: for i = len-1 down to 1, swap(i, nextInt(i + 1)). Returns arr. */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.nextInt(i + 1);
      const tmp = arr[i]!;
      arr[i] = arr[j]!;
      arr[j] = tmp;
    }
    return arr;
  }
}
