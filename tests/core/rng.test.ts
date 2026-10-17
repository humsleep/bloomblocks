import { describe, expect, it } from "vitest";
import { toHex } from "../../core/bytes.ts";
import { Rng, deriveSeed } from "../../core/rng.ts";

const take = (r: Rng, n: number): number[] => Array.from({ length: n }, () => r.nextU32());

describe("xoshiro128**", () => {
  // Outputs of the reference C implementation (prng.di.unimi.it/xoshiro128starstar.c),
  // compiled and run with s = {1, 2, 3, 4}.
  it("matches the reference implementation for s = {1,2,3,4}", () => {
    expect(take(new Rng(1, 2, 3, 4), 10)).toEqual([
      11520, 0, 5927040, 70819200, 2031721883, 1637235492, 1287239034, 3734860849, 3729100597, 4258142804,
    ]);
  });

  it("matches the reference implementation for a high-bit seed", () => {
    expect(take(new Rng(0x9e3779b9, 0x243f6a88, 0xb7e15162, 0xdeadbeef), 10)).toEqual([
      2463954730, 5524658, 74256371, 1905451993, 3123413897, 314453775, 1263677054, 1531511215, 693760292, 1307612896,
    ]);
  });

  it("rejects the all-zero state", () => {
    expect(() => new Rng(0, 0, 0, 0)).toThrow(RangeError);
  });

  it("clone/state snapshot continues identically", () => {
    const a = Rng.from("x");
    a.nextU32();
    const b = a.clone();
    expect(take(a, 5)).toEqual(take(b, 5));
    expect(new Rng(...a.state()).nextU32()).toBe(a.clone().nextU32());
  });
});

describe("seed derivation", () => {
  it("seed = first 16 bytes of sha256(utf8(key)), words little-endian", () => {
    // sha256("abc") = ba7816bf 8f01cfea 414140de 5dae2223 ...
    expect(toHex(deriveSeed("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223");
    const r = Rng.from("abc");
    expect(r.state()).toEqual([0xbf1678ba, 0xeacf018f, 0xde404141, 0x2322ae5d]);
  });

  it("key string and derived bytes produce the same stream", () => {
    const key = "lanterns:daily:2026-10-12";
    expect(take(Rng.from(key), 8)).toEqual(take(Rng.from(deriveSeed(key)), 8));
  });

  it("rejects seed bytes that are not 16 long", () => {
    expect(() => deriveSeed(new Uint8Array(15))).toThrow(RangeError);
  });
});

describe("nextInt", () => {
  it("follows the canonical threshold algorithm draw-for-draw", () => {
    const n = 3_000_000_000; // threshold = 2^32 mod n = 1294967296: many draws rejected
    const a = new Rng(1, 2, 3, 4);
    const b = new Rng(1, 2, 3, 4);
    const threshold = 2 ** 32 % n;
    for (let k = 0; k < 50; k++) {
      let x = b.nextU32();
      while (x < threshold) x = b.nextU32();
      expect(a.nextInt(n)).toBe(x % n);
    }
  });

  it("stays in range and is roughly uniform", () => {
    const r = Rng.from("uniform");
    const counts = new Array<number>(6).fill(0);
    for (let i = 0; i < 60_000; i++) counts[r.nextInt(6)]!++;
    for (const c of counts) expect(Math.abs(c - 10_000)).toBeLessThan(400);
    expect(r.nextInt(1)).toBe(0);
  });

  it("rejects bad bounds", () => {
    const r = Rng.from("x");
    for (const n of [0, -1, 1.5, 2 ** 32]) expect(() => r.nextInt(n)).toThrow(RangeError);
  });
});

describe("shuffle", () => {
  it("is a deterministic permutation", () => {
    const a = Rng.from("shuffle").shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const b = Rng.from("shuffle").shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(a).toEqual(b);
    expect([...a].sort((x, y) => x - y)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("uses Fisher-Yates from the end with nextInt(i + 1)", () => {
    const r = new Rng(1, 2, 3, 4);
    const ref = new Rng(1, 2, 3, 4);
    const arr = ["a", "b", "c", "d"];
    const exp = [...arr];
    for (let i = exp.length - 1; i > 0; i--) {
      const j = ref.nextInt(i + 1);
      [exp[i], exp[j]] = [exp[j]!, exp[i]!];
    }
    expect(r.shuffle(arr)).toEqual(exp);
  });
});
