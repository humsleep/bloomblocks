import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { toHex, utf8 } from "../../core/bytes.ts";
import { sha256 } from "../../core/sha256.ts";

const hex = (s: string): string => toHex(sha256(utf8(s)));

describe("sha256", () => {
  it("matches FIPS 180-2 / NIST test vectors", () => {
    expect(hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")).toBe(
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    );
    expect(
      hex("abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu"),
    ).toBe("cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1");
    expect(toHex(sha256(new Uint8Array(1_000_000).fill(0x61)))).toBe(
      "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0",
    );
  });

  it("agrees with node:crypto on every length 0..200 (padding boundaries)", () => {
    for (let n = 0; n <= 200; n++) {
      const msg = Uint8Array.from({ length: n }, (_, i) => (i * 31 + n) & 0xff);
      expect(toHex(sha256(msg))).toBe(createHash("sha256").update(msg).digest("hex"));
    }
  });
});

describe("utf8", () => {
  it("matches TextEncoder, including astral chars and lone surrogates", () => {
    const enc = new TextEncoder();
    for (const s of ["", "lanterns:daily:2026-10-12", "등불 정원", "é€𝄞🌸", "a\ud800b", "\udc00", "x\ud83c"]) {
      expect(toHex(utf8(s))).toBe(toHex(enc.encode(s)));
    }
  });
});
