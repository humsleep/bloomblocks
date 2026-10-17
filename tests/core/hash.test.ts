import * as zlib from "node:zlib";
import { describe, expect, it } from "vitest";
import { utf8 } from "../../core/bytes.ts";
import { crc32, fnv1a32 } from "../../core/hash.ts";

describe("fnv1a32", () => {
  it("matches the published FNV-1a 32 test vectors", () => {
    expect(fnv1a32(utf8(""))).toBe(0x811c9dc5);
    expect(fnv1a32(utf8("a"))).toBe(0xe40c292c);
    expect(fnv1a32(utf8("b"))).toBe(0xe70c2de5);
    expect(fnv1a32(utf8("foobar"))).toBe(0xbf9cf968);
  });
});

describe("crc32", () => {
  it("matches the CRC-32/IEEE check value and known strings", () => {
    expect(crc32(utf8("123456789"))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array(0))).toBe(0);
    expect(crc32(utf8("The quick brown fox jumps over the lazy dog"))).toBe(0x414fa339);
  });

  it("agrees with zlib.crc32", () => {
    for (let n = 0; n < 300; n += 7) {
      const b = Uint8Array.from({ length: n }, (_, i) => (i * 131 + 7) & 0xff);
      expect(crc32(b)).toBe(zlib.crc32(b));
    }
  });
});
