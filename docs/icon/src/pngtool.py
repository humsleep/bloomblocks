#!/usr/bin/env python3
"""Tiny stdlib PNG tool. `info f.png` -> size, colour type, min alpha.
`opaque in.png out.png` -> drop alpha (asserts alpha is 255 everywhere) and write RGB PNG."""
import struct, sys, zlib

def read(path):
    data = open(path, "rb").read()
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    pos, idat, hdr = 8, b"", None
    while pos < len(data):
        n, = struct.unpack(">I", data[pos:pos + 4]); t = data[pos + 4:pos + 8]; body = data[pos + 8:pos + 8 + n]
        if t == b"IHDR": hdr = struct.unpack(">IIBBBBB", body)
        elif t == b"IDAT": idat += body
        pos += 12 + n
    w, h, depth, ctype, _, _, inter = hdr
    assert depth == 8 and inter == 0 and ctype in (2, 6), hdr
    bpp = 4 if ctype == 6 else 3
    raw = zlib.decompress(idat); stride = w * bpp
    out = bytearray(); prev = bytearray(stride); i = 0
    for _ in range(h):
        ft = raw[i]; i += 1
        line = bytearray(raw[i:i + stride]); i += stride
        for x in range(stride):
            a = line[x - bpp] if x >= bpp else 0; b = prev[x]; c = prev[x - bpp] if x >= bpp else 0
            if ft == 1: line[x] = (line[x] + a) & 255
            elif ft == 2: line[x] = (line[x] + b) & 255
            elif ft == 3: line[x] = (line[x] + ((a + b) >> 1)) & 255
            elif ft == 4:
                p = a + b - c; pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        out += line; prev = line
    return w, h, ctype, bytes(out)

def write_rgb(path, w, h, rgb):
    raw = b"".join(b"\x00" + rgb[y * w * 3:(y + 1) * w * 3] for y in range(h))
    def chunk(t, b): return struct.pack(">I", len(b)) + t + b + struct.pack(">I", zlib.crc32(t + b) & 0xffffffff)
    open(path, "wb").write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))

if __name__ == "__main__":
    cmd, src = sys.argv[1], sys.argv[2]
    w, h, ctype, px = read(src)
    if cmd == "info":
        amin = min(px[3::4]) if ctype == 6 else 255
        print(f"{src}: {w}x{h} ctype={ctype} minAlpha={amin}")
    elif cmd == "opaque":
        if ctype == 6:
            assert min(px[3::4]) == 255, "image has transparent pixels"
            rgb = bytearray(w * h * 3); rgb[0::3] = px[0::4]; rgb[1::3] = px[1::4]; rgb[2::3] = px[2::4]
        else:
            rgb = px
        write_rgb(sys.argv[3], w, h, bytes(rgb))
