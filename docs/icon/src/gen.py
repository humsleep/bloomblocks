#!/usr/bin/env python3
"""Duskwick app icon candidates A/B/C x any/dark/tinted -> SVG (stdlib only).

Colours are the game's PAL tokens (apps/client/src/render/palette.ts). The lantern
is a vector port of drawLantern() in apps/client/src/render/draw.ts (same
proportions: body rx .35h / ry .32h, centre at (.4h, .56h), wood caps, wire
handle), minus the thin koi tassel (a tassel is what pushes a round lantern
toward "New Year decoration"; at icon sizes it would be < 24 px anyway).

Usage: python3 gen.py <out_dir>
"""
import math
import os
import sys

PAL = dict(
    skyNight="#141A33", skyDusk="#2B2350", skyHorizon="#C97B84", skyGlow="#E8A08A",
    moon="#F4EBD0", hillFar="#5B4470", hillMid="#3A2D58", hillNear="#231F40",
    ground="#171A31", groundDeep="#0F1124", wall="#2A2240", wallRim="#D88BA6",
    roof="#1B1630", windowDark="#3B3560", windowFrame="#140F24", windowLit="#FFC864",
    windowLitCore="#FFF4D6", grout="#11142A", rim="#2E3354", floor="#232946",
    floorHi="#2B3254", floorLo="#1E2340", paleHi="#E2E5F0", pale="#B4BAD2",
    paleLo="#737A9A", litCore="#F2C46D", litEdge="#B9814A", flame="#FFC864",
    wick="#FFF4D6", koi="#F08A5D", wood="#4A3328", woodHi="#6E4C38",
)
W = 1024
C = 512


def f(x):
    return f"{x:.1f}".rstrip("0").rstrip(".")


def gray(v):
    """0..1 -> #RRGGBB neutral gray."""
    n = max(0, min(255, round(v * 255)))
    return f"#{n:02X}{n:02X}{n:02X}"


class Svg:
    def __init__(self, uid):
        self.uid = uid
        self.defs = []
        self.body = []
        self.n = 0

    def id(self, name):
        self.n += 1
        return f"{self.uid}-{name}{self.n}"

    def lin(self, x1, y1, x2, y2, stops):
        i = self.id("lg")
        s = "".join(f'<stop offset="{f(o)}" stop-color="{c}"{"" if a == 1 else f" stop-opacity={chr(34)}{f(a)}{chr(34)}"}/>' for o, c, a in stops)
        self.defs.append(f'<linearGradient id="{i}" gradientUnits="userSpaceOnUse" x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}">{s}</linearGradient>')
        return f"url(#{i})"

    def rad(self, cx, cy, r, stops, fx=None, fy=None, tf=None):
        i = self.id("rg")
        s = "".join(f'<stop offset="{f(o)}" stop-color="{c}"{"" if a == 1 else f" stop-opacity={chr(34)}{f(a)}{chr(34)}"}/>' for o, c, a in stops)
        foc = "" if fx is None else f' fx="{f(fx)}" fy="{f(fy)}"'
        t = "" if tf is None else f' gradientTransform="{tf}"'
        self.defs.append(f'<radialGradient id="{i}" gradientUnits="userSpaceOnUse" cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}"{foc}{t}>{s}</radialGradient>')
        return f"url(#{i})"

    def blur(self, sd):
        i = self.id("bl")
        self.defs.append(f'<filter id="{i}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="{f(sd)}"/></filter>')
        return f"url(#{i})"

    def clip(self, inner):
        i = self.id("cp")
        self.defs.append(f'<clipPath id="{i}">{inner}</clipPath>')
        return f"url(#{i})"

    def mask(self, inner):
        i = self.id("mk")
        self.defs.append(f'<mask id="{i}" maskUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{W}">{inner}</mask>')
        return f"url(#{i})"

    def add(self, s):
        self.body.append(s)

    def out(self, title):
        return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{W}" viewBox="0 0 {W} {W}">\n'
                f'<title>{title}</title>\n<defs>\n' + "\n".join(self.defs) + "\n</defs>\n" + "\n".join(self.body) + "\n</svg>\n")


# ---------------------------------------------------------------- shared parts

def sky(s, horizon_y=1024, glow_cy=1024, glow_r=560):
    s.add(f'<rect width="{W}" height="{W}" fill="{s.lin(0, 0, 0, horizon_y, [(0, PAL["skyNight"], 1), (0.45, PAL["skyDusk"], 1), (0.78, PAL["hillFar"], 1), (1, PAL["skyHorizon"], 1)])}"/>')
    s.add(f'<rect width="{W}" height="{W}" fill="{s.rad(C, glow_cy, glow_r, [(0, PAL["skyGlow"], 0.38), (1, PAL["skyGlow"], 0)])}"/>')


def moon(s, cx, cy, r):
    m = s.mask(f'<rect width="{W}" height="{W}" fill="#fff"/><circle cx="{f(cx - r * 0.42)}" cy="{f(cy - r * 0.26)}" r="{f(r * 0.9)}" fill="#000"/>')
    s.add(f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r * 2.2)}" fill="{s.rad(cx, cy, r * 2.2, [(0, PAL["moon"], 0.16), (1, PAL["moon"], 0)])}"/>')
    s.add(f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" fill="{PAL["moon"]}" mask="{m}"/>')


def halo(s, cx, cy, r, k=1.0, cream=False):
    c = ("#FFE9B4", "#FFD98C", "#FFC870", "#FFC060") if cream else ("#FFCE78", "#FFBE64", "#FFAA50", "#FFA046")
    s.add(f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" fill="{s.rad(cx, cy, r, [(0, c[0], 0.50 * k), (0.35, c[1], 0.22 * k), (0.7, c[2], 0.07 * k), (1, c[3], 0)])}"/>')


def lantern(s, bx, by, h, mode="any", shadow=True):
    """drawLantern(ctx, h, glow=1) with the body centre at (bx, by)."""
    rx, ry = 0.35 * h, 0.32 * h
    oy = by - 0.56 * h
    tint = mode == "tinted"
    wood = gray(0.50) if tint else PAL["wood"]
    woodHi = gray(0.62) if tint else PAL["woodHi"]
    if shadow:
        s.add(f'<ellipse cx="{f(bx)}" cy="{f(by + ry + 0.055 * h)}" rx="{f(0.33 * h)}" ry="{f(0.06 * h)}" fill="{"#000000" if tint else PAL["groundDeep"]}" opacity="{0.35 if tint else 0.5}"/>')
    # wire handle: arc centre (bx, oy+.15h) r .1h, canvas angles 1.05pi..1.95pi (thickened: decoration only)
    hc, hr = oy + 0.15 * h, 0.1 * h
    a0, a1 = math.pi * 1.05, math.pi * 1.95
    p0 = (bx + hr * math.cos(a0), hc + hr * math.sin(a0))
    p1 = (bx + hr * math.cos(a1), hc + hr * math.sin(a1))
    s.add(f'<path d="M{f(p0[0])} {f(p0[1])} A{f(hr)} {f(hr)} 0 0 1 {f(p1[0])} {f(p1[1])}" fill="none" stroke="{wood}" stroke-width="{f(0.055 * h)}" stroke-linecap="round"/>')
    ell = f'<ellipse cx="{f(bx)}" cy="{f(by)}" rx="{f(rx)}" ry="{f(ry)}"/>'
    if tint:
        s.add(f'<ellipse cx="{f(bx)}" cy="{f(by)}" rx="{f(rx)}" ry="{f(ry)}" fill="{s.rad(bx, by - ry * 0.15, rx * 1.08, [(0, "#FFFFFF", 1), (0.6, "#F4F4F4", 1), (1, "#C8C8C8", 1)])}" stroke="#141414" stroke-width="{f(0.04 * h)}"/>')
    else:
        body = s.rad(bx, by - ry * 0.15, rx * 1.08, [(0, "#FFF0C2", 1), (0.35, PAL["flame"], 1), (0.75, "#E89A4E", 1), (1, "#B5683A", 1)])
        s.add(f'<ellipse cx="{f(bx)}" cy="{f(by)}" rx="{f(rx)}" ry="{f(ry)}" fill="{body}"/>')
        cp = s.clip(ell)
        g = [f'<g clip-path="{cp}">']
        # flame sprite (white-hot core, as in game)
        g.append(f'<circle cx="{f(bx)}" cy="{f(by)}" r="{f(0.36 * h)}" fill="{s.rad(bx, by, 0.36 * h, [(0, "#FFFAE8", 1), (0.22, "#FFF4D6", 0.95), (0.5, "#FFD27A", 0.6), (0.8, "#FFB050", 0.15), (1, "#FF963C", 0)])}"/>')
        # ribs (faint, like the game)
        rc = "#783A18"
        for k in (2,):
            g.append(f'<ellipse cx="{f(bx)}" cy="{f(by)}" rx="{f(rx * k / 3)}" ry="{f(ry)}" fill="none" stroke="{rc}" stroke-opacity="0.2" stroke-width="{f(0.02 * h)}"/>')
        g.append(f'<line x1="{f(bx)}" y1="{f(by - ry)}" x2="{f(bx)}" y2="{f(by + ry)}" stroke="{rc}" stroke-opacity="0.16" stroke-width="{f(0.02 * h)}"/>')
        sh = s.lin(bx - rx, 0, bx + rx, 0, [(0, "#3C190A", 0.32), (0.35, "#3C190A", 0), (0.7, "#3C190A", 0), (1, "#3C190A", 0.38)])
        g.append(f'<rect x="{f(bx - rx)}" y="{f(by - ry)}" width="{f(2 * rx)}" height="{f(2 * ry)}" fill="{sh}"/>')
        g.append("</g>")
        s.add("".join(g))
        # outline a bit heavier than in-game so the lantern separates from lit tiles at 40-58 px
        s.add(f'<ellipse cx="{f(bx)}" cy="{f(by)}" rx="{f(rx)}" ry="{f(ry)}" fill="none" stroke="#46200C" stroke-opacity="0.6" stroke-width="{f(0.028 * h)}"/>')
    # caps
    for (y, w, hh) in ((by - ry - 0.06 * h, 0.36 * h, 0.09 * h), (by + ry - 0.025 * h, 0.28 * h, 0.075 * h)):
        cg = s.lin(0, y, 0, y + hh, [(0, woodHi, 1), (1, wood, 1)])
        s.add(f'<rect x="{f(bx - w / 2)}" y="{f(y)}" width="{f(w)}" height="{f(hh)}" rx="{f(hh * 0.35)}" fill="{cg}"/>')


def lantern2(s, bx, base, h, style, mode="any"):
    """Icon lantern v2 (no ribs, taller than wide, cream-gold glow, heavy dark cap + base).
    style: "paper" = tall paper lantern (closest to the game's drawLantern),
           "frame" = the same paper body held in a dark wooden frame (side posts),
           "lamp"  = glass lamp: square glowing pane, posts, small hipped roof, ring handle.
    `base` = ground contact y. Total height ~0.93h."""
    tint = mode == "tinted"
    wood = gray(0.42) if tint else "#3E2A22"
    woodHi = gray(0.55) if tint else PAL["woodHi"]
    s.add(f'<ellipse cx="{f(bx)}" cy="{f(base - 0.01 * h)}" rx="{f(0.36 * h)}" ry="{f(0.055 * h)}" fill="{"#000000" if tint else PAL["groundDeep"]}" opacity="0.5"/>')
    def cap(x0, y0, w, hh, trap=0.0):
        g = s.lin(0, y0, 0, y0 + hh, [(0, woodHi, 1), (1, wood, 1)])
        if trap:
            d = rquad([(x0 + trap, y0), (x0 + w - trap, y0), (x0 + w, y0 + hh), (x0, y0 + hh)], hh * 0.3)
            s.add(f'<path d="{d}" fill="{g}"/>')
        else:
            s.add(f'<rect x="{f(x0)}" y="{f(y0)}" width="{f(w)}" height="{f(hh)}" rx="{f(hh * 0.3)}" fill="{g}"/>')
    def glow_fill(cx, cy, r):
        if tint:
            return s.rad(cx, cy, r, [(0, "#FFFFFF", 1), (0.7, "#F2F2F2", 1), (1, "#D6D6D6", 1)])
        return s.rad(cx, cy, r, [(0, "#FFFCF0", 1), (0.3, PAL["wick"], 1), (0.62, "#FFDD94", 1), (0.88, PAL["flame"], 1), (1, "#E8B05A", 1)])
    if style in ("paper", "frame"):
        bw, btop, bbot = 0.60 * h, base - 0.69 * h, base - 0.07 * h
        bh = bbot - btop
        cy = (btop + bbot) / 2
        # handle (bail)
        r = 0.17 * h
        hy = base - 0.755 * h
        s.add(f'<path d="M{f(bx - r)} {f(hy)} A{f(r)} {f(r)} 0 0 1 {f(bx + r)} {f(hy)}" fill="none" stroke="{wood}" stroke-width="{f(0.05 * h)}" stroke-linecap="round"/>')
        body = f'<rect x="{f(bx - bw / 2)}" y="{f(btop)}" width="{f(bw)}" height="{f(bh)}" rx="{f(0.27 * h)}" ry="{f(0.2 * h)}"/>'
        s.add(body.replace("/>", f' fill="{glow_fill(bx, cy - 0.03 * h, 0.4 * h)}"/>'))
        if not tint:
            cp = s.clip(body)
            sh = s.lin(bx - bw / 2, 0, bx + bw / 2, 0, [(0, "#7A4A1C", 0.22), (0.28, "#7A4A1C", 0), (0.72, "#7A4A1C", 0), (1, "#7A4A1C", 0.28)])
            s.add(f'<rect clip-path="{cp}" x="{f(bx - bw / 2)}" y="{f(btop)}" width="{f(bw)}" height="{f(bh)}" fill="{sh}"/>')
        s.add(body.replace("/>", f' fill="none" stroke="{"#141414" if tint else "#5A3A1C"}" stroke-opacity="{1 if tint else 0.5}" stroke-width="{f(0.035 * h if tint else 0.02 * h)}"/>'))
        if style == "frame":
            pw = 0.05 * h
            for sx in (-1, 1):
                x = bx + sx * (bw / 2 + 0.005 * h) - pw / 2
                s.add(f'<rect x="{f(x)}" y="{f(base - 0.72 * h)}" width="{f(pw)}" height="{f(0.66 * h)}" rx="{f(pw / 2)}" fill="{wood}"/>')
            cap(bx - 0.36 * h, base - 0.79 * h, 0.72 * h, 0.11 * h, trap=0.08 * h)
            cap(bx - 0.35 * h, base - 0.10 * h, 0.70 * h, 0.10 * h)
        else:
            cap(bx - 0.28 * h, base - 0.79 * h, 0.56 * h, 0.12 * h, trap=0.05 * h)
            cap(bx - 0.25 * h, base - 0.10 * h, 0.50 * h, 0.10 * h)
    else:  # lamp
        pw_, ph_ = 0.52 * h, 0.50 * h
        ptop = base - 0.10 * h - ph_
        cy = ptop + ph_ / 2
        r = 0.1 * h
        s.add(f'<circle cx="{f(bx)}" cy="{f(base - 0.84 * h)}" r="{f(r)}" fill="none" stroke="{wood}" stroke-width="{f(0.045 * h)}"/>')
        s.add(f'<rect x="{f(bx - pw_ / 2)}" y="{f(ptop)}" width="{f(pw_)}" height="{f(ph_)}" rx="{f(0.04 * h)}" fill="{glow_fill(bx, cy - 0.03 * h, 0.36 * h)}"/>')
        post = 0.065 * h
        for sx in (-1, 1):
            s.add(f'<rect x="{f(bx + sx * pw_ / 2 - post / 2)}" y="{f(ptop - 0.01 * h)}" width="{f(post)}" height="{f(ph_ + 0.02 * h)}" rx="{f(post * 0.4)}" fill="{wood}"/>')
        cap(bx - 0.36 * h, ptop - 0.15 * h, 0.72 * h, 0.15 * h, trap=0.2 * h)
        cap(bx - 0.34 * h, base - 0.11 * h, 0.68 * h, 0.11 * h)


def rock(s, cx, cy, r, mode="any", squash=0.84, seed=(1.0, 0.9, 0.95, 0.88, 1.0, 0.92, 0.97, 0.86, 0.94)):
    """Pale numbered rock silhouette (no digits): blob, cast shadow, top light, outline."""
    n = len(seed)
    pts = []
    for k in range(n):
        a = 0.35 + k / n * math.tau
        rr = r * seed[k]
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr * squash))

    def blob(dx=0.0, dy=0.0):
        mid = [((pts[i][0] + pts[(i + 1) % n][0]) / 2 + dx, (pts[i][1] + pts[(i + 1) % n][1]) / 2 + dy) for i in range(n)]
        d = f"M{f(mid[-1][0])} {f(mid[-1][1])}"
        for i in range(n):
            d += f" Q{f(pts[i][0] + dx)} {f(pts[i][1] + dy)} {f(mid[i][0])} {f(mid[i][1])}"
        return d + "Z"

    tint = mode == "tinted"
    ink, hi = ("#000000", "#FFFFFF") if tint else ("#0A0A1C", "#FFFCF0")
    s.add(f'<path d="{blob(r * 0.05, r * 0.2)}" fill="{"#000000" if tint else "#04050E"}" opacity="{0.55 if not tint else 0.6}"/>')
    if tint:
        body = s.lin(cx - r * 0.5, cy - r * 0.85, cx + r * 0.35, cy + r * 0.9, [(0, gray(0.62), 1), (0.45, gray(0.5), 1), (1, gray(0.34), 1)])
    else:
        body = s.lin(cx - r * 0.5, cy - r * 0.85, cx + r * 0.35, cy + r * 0.9, [(0, PAL["paleHi"], 1), (0.45, PAL["pale"], 1), (1, PAL["paleLo"], 1)])
    s.add(f'<path d="{blob()}" fill="{body}"/>')
    cp = s.clip(f'<path d="{blob()}"/>')
    s.add(f'<g clip-path="{cp}"><rect x="{f(cx - r * 1.2)}" y="{f(cy + r * 0.15)}" width="{f(r * 2.4)}" height="{f(r)}" fill="{s.lin(0, cy + r * 0.15, 0, cy + r, [(0, ink, 0), (1, ink, 0.45)])}"/>'
          f'<circle cx="{f(cx - r * 0.3)}" cy="{f(cy - r * 0.35)}" r="{f(r * 0.75)}" fill="{s.rad(cx - r * 0.3, cy - r * 0.35, r * 0.75, [(0, hi, 0.35), (1, hi, 0)])}"/></g>')
    s.add(f'<path d="{blob()}" fill="none" stroke="{"#000000" if tint else "#060612"}" stroke-opacity="0.7" stroke-width="{f(max(6, r * 0.07))}"/>')


def rquad(pts, r):
    """Quad (or polygon) with rounded corners of radius r (quadratic corners)."""
    n = len(pts)
    segs = []
    for i in range(n):
        p0, p1, p2 = pts[i - 1], pts[i], pts[(i + 1) % n]
        d0 = math.dist(p0, p1)
        d2 = math.dist(p1, p2)
        a = (p1[0] + (p0[0] - p1[0]) * r / d0, p1[1] + (p0[1] - p1[1]) * r / d0)
        b = (p1[0] + (p2[0] - p1[0]) * r / d2, p1[1] + (p2[1] - p1[1]) * r / d2)
        segs.append((a, p1, b))
    d = f"M{f(segs[0][0][0])} {f(segs[0][0][1])}"
    for a, p, b in segs:
        d += f" L{f(a[0])} {f(a[1])} Q{f(p[0])} {f(p[1])} {f(b[0])} {f(b[1])}"
    return d + "Z"


# ---------------------------------------------------------------- A: refined light-spread

def cand_a(mode):
    s = Svg(f"a{mode[0]}")
    tint, dark = mode == "tinted", mode == "dark"
    gx, gy = 512, 520          # grid centre
    pitch, tile, r = 124, 110, 24
    if mode == "any":
        sky(s)
        moon(s, 820, 196, 50)
        # low hills, partly swallowed by the courtyard's darkness
        s.add(f'<path d="M0 860 C 200 820, 360 812, 520 836 C 690 860, 850 818, 1024 846 L1024 1024 L0 1024Z" fill="{PAL["hillMid"]}"/>')
        s.add(f'<path d="M0 930 C 240 896, 420 900, 560 916 C 720 934, 880 904, 1024 922 L1024 1024 L0 1024Z" fill="{PAL["hillNear"]}"/>')
    # darkness pool the courtyard sits in (no tray, no rim)
    if not tint:
        s.add(f'<circle cx="{gx}" cy="{gy}" r="460" fill="{s.rad(gx, gy, 460, [(0, PAL["groundDeep"], 0.92 if not dark else 0.7), (0.55, PAL["groundDeep"], 0.7 if not dark else 0.45), (1, PAL["groundDeep"], 0)])}"/>')
    # unlit flagstones dissolve into the dusk with distance
    for i in range(-2, 3):
        for j in range(-2, 3):
            if i == 0 or j == 0:
                continue
            dist = math.hypot(i, j)
            op = {1.41: 0.95, 2.24: 0.74, 2.83: 0.4}[round(dist, 2)]
            x, y = gx + i * pitch - tile / 2, gy + j * pitch - tile / 2
            if tint:
                fill = gray(0.22)
            else:
                fill = s.lin(x, y, x + tile * 0.4, y + tile, [(0, PAL["floorHi"] if not dark else "#323A60", 1), (1, PAL["floorLo"] if not dark else "#262C4C", 1)])
            s.add(f'<rect x="{f(x)}" y="{f(y)}" width="{tile}" height="{tile}" rx="{r}" fill="{fill}" opacity="{op}"/>')
    # light beams travelling along the row and the column (soft, fading)
    reach = 2 * pitch + tile / 2 + 30
    if not tint:
        bl = s.blur(16)
        for horiz in (True, False):
            if horiz:
                g = s.lin(gx - reach, 0, gx + reach, 0, [(0, "#FFC864", 0), (0.25, "#FFC864", 0.35), (0.5, "#FFE6A8", 0.9), (0.75, "#FFC864", 0.35), (1, "#FFC864", 0)])
                s.add(f'<rect x="{f(gx - reach)}" y="{f(gy - tile / 2 - 10)}" width="{f(2 * reach)}" height="{f(tile + 20)}" fill="{g}" filter="{bl}"/>')
            else:
                g = s.lin(0, gy - reach, 0, gy + reach, [(0, "#FFC864", 0), (0.25, "#FFC864", 0.35), (0.5, "#FFE6A8", 0.9), (0.75, "#FFC864", 0.35), (1, "#FFC864", 0)])
                s.add(f'<rect x="{f(gx - tile / 2 - 10)}" y="{f(gy - reach)}" width="{f(tile + 20)}" height="{f(2 * reach)}" fill="{g}" filter="{bl}"/>')
    # lit flagstones: one radial falloff shared by the whole row + column
    R = 2 * pitch + tile / 2
    if tint:
        lit = s.rad(gx, gy, R, [(0, gray(1.0), 1), (0.3, gray(0.86), 1), (0.6, gray(0.66), 1), (1, gray(0.38), 1)])
    else:
        lit = s.rad(gx, gy, R, [(0, "#FFF4D6", 1), (0.22, "#FFE3A0", 1), (0.42, PAL["litCore"], 1), (0.66, "#D9A35E", 1), (0.86, PAL["litEdge"], 1), (1, "#8A6458", 1)])
    for k in range(-2, 3):
        for (i, j) in ((k, 0), (0, k)) if k else ((0, 0),):
            x, y = gx + i * pitch - tile / 2, gy + j * pitch - tile / 2
            op = 1 if abs(k) < 2 else 0.82
            s.add(f'<rect x="{f(x)}" y="{f(y)}" width="{tile}" height="{tile}" rx="{r}" fill="{lit}" opacity="{op}"/>')
            if not tint:
                s.add(f'<rect x="{f(x + 10)}" y="{f(y + 4)}" width="{tile - 20}" height="6" rx="3" fill="#FFF4D6" opacity="{0.3 if abs(k) < 2 else 0.15}"/>')
    if not tint:
        halo(s, gx, gy - 10, 300 if not dark else 340, 1.0)
    lantern(s, gx, gy - 14, 270, mode)
    return s.out(f"Duskwick icon A ({mode})")


# ---------------------------------------------------------------- B: lit window + lantern on the sill

def cand_b(mode):
    s = Svg(f"b{mode[0]}")
    tint, dark = mode == "tinted", mode == "dark"
    wx, wy, ww, wh = 268, 286, 320, 336   # window outer frame
    sill_y, sill_h = wy + wh - 6, 44
    if mode == "any":
        s.add(f'<rect width="{W}" height="{W}" fill="{s.lin(0, 0, 0, W, [(0, "#30264A", 1), (0.6, PAL["wall"], 1), (1, "#1E1832", 1)])}"/>')
        # dusk sky glimpsed above the eave, roof edge
        s.add(f'<path d="M0 0 H1024 V118 L0 176Z" fill="{s.lin(0, 0, 0, 180, [(0, PAL["skyDusk"], 1), (1, PAL["hillFar"], 1)])}"/>')
        s.add(f'<path d="M0 176 L1024 118 L1024 172 L0 232Z" fill="{PAL["roof"]}"/>')
        s.add(f'<path d="M0 176 L1024 118 L1024 132 L0 190Z" fill="{PAL["wallRim"]}" opacity="0.55"/>')
        # siding boards (wide, soft)
        for k in range(6):
            y = 260 + k * 140
            s.add(f'<rect x="0" y="{y}" width="{W}" height="12" fill="#1B1630" opacity="0.35"/>')
    # window glow on the wall
    if not tint:
        cx, cy = wx + ww / 2, wy + wh / 2
        s.add(f'<circle cx="{f(cx)}" cy="{f(cy)}" r="380" fill="{s.rad(cx, cy, 380, [(0, "#FFD682", 0.5 if not dark else 0.4), (0.4, "#FFBE64", 0.2), (1, "#FFAA50", 0)])}"/>')
    # frame + four lit panes
    frame = gray(0.12) if tint else PAL["windowFrame"]
    s.add(f'<rect x="{wx}" y="{wy}" width="{ww}" height="{wh}" rx="26" fill="{frame}"/>')
    if not tint:
        s.add(f'<path d="M{wx + 4} {wy + wh - 30} V{wy + 26} Q{wx + 4} {wy + 4} {wx + 26} {wy + 4} H{wx + ww - 30}" fill="none" stroke="{PAL["wallRim"]}" stroke-opacity="0.6" stroke-width="10" stroke-linecap="round"/>')
    t, m = 28, 30
    pw, ph = (ww - 2 * t - m) / 2, (wh - 2 * t - m) / 2
    if tint:
        pane = s.rad(wx + ww / 2, wy + wh / 2, ww * 0.75, [(0, gray(0.95), 1), (1, gray(0.7), 1)])
    else:
        pane = s.rad(wx + ww / 2, wy + wh * 0.48, ww * 0.72, [(0, PAL["windowLitCore"], 1), (0.45, "#FFDD94", 1), (0.8, PAL["windowLit"], 1), (1, "#E9A94E", 1)])
    for i in range(2):
        for j in range(2):
            x = wx + t + i * (pw + m)
            y = wy + t + j * (ph + m)
            s.add(f'<rect x="{f(x)}" y="{f(y)}" width="{f(pw)}" height="{f(ph)}" rx="10" fill="{pane}"/>')
    # sill
    sx0, sx1 = wx - 40, 800
    if tint:
        s.add(f'<rect x="{sx0}" y="{sill_y}" width="{sx1 - sx0}" height="{sill_h}" rx="12" fill="{gray(0.32)}"/>')
    else:
        s.add(f'<rect x="{sx0}" y="{sill_y + 10}" width="{sx1 - sx0}" height="{sill_h}" rx="12" fill="#0B0A18" opacity="0.5"/>')
        s.add(f'<rect x="{sx0}" y="{sill_y}" width="{sx1 - sx0}" height="{sill_h}" rx="12" fill="{s.lin(0, sill_y, 0, sill_y + sill_h, [(0, PAL["hillFar"], 1), (0.3, PAL["hillMid"], 1), (1, "#2A2042", 1)])}"/>')
        s.add(f'<rect x="{sx0 + 6}" y="{sill_y}" width="{sx1 - sx0 - 12}" height="{sill_h}" rx="12" fill="{s.rad(690, sill_y, 200, [(0, "#FFC864", 0.55), (1, "#FFC864", 0)], tf=f"translate(690 {sill_y}) scale(1 0.35) translate(-690 {-sill_y})")}"/>')
    h = 250
    bx = 690
    by = sill_y - (0.32 + 0.05) * h + 4
    if not tint:
        halo(s, bx, by, 260, 0.9)
    lantern(s, bx, by, h, mode, shadow=False)
    return s.out(f"Duskwick icon B ({mode})")


# ---------------------------------------------------------------- C: angled courtyard, rock, far town

def cand_c(mode, style="round", name="C"):
    v2 = style != "round"
    s = Svg(f"{name.lower()}{mode[0]}")
    tint, dark = mode == "tinted", mode == "dark"
    # perspective: world (u across, v depth; v=-1.5 front edge .. +1.5 back edge)
    yf, yb, hw_front, ratio = (812, 440, 262, 1.28) if v2 else (786, 412, 262, 1.28)
    dy = 26 if v2 else 0   # v2: whole scene a little lower (lower third was empty)
    A, B = (1 + ratio) / 2, (ratio - 1) / 3
    K = (yf - yb) / (1 - 1 / ratio)
    hy = yf - K
    Wf = hw_front / 1.5

    def P(u, v):
        d = A + B * v
        return (C + Wf * u / d, hy + K / d)

    gap = 0.07

    def cell(col, row, inset=gap / 2):   # row 0 = back
        u0, u1 = col - 1.5 + inset, col - 0.5 - inset
        v1, v0 = 1.5 - row - inset, 0.5 - row + inset
        return [P(u0, v1), P(u1, v1), P(u1, v0), P(u0, v0)]

    def ctr(col, row):
        return P(col - 1.0, 1.0 - row)

    if mode == "any":
        sky(s, horizon_y=470, glow_cy=380, glow_r=520)
        if not v2:
            moon(s, 816, 150, 40)
        # far hill + town
        s.add(f'<g transform="translate(0 {dy})">')
        s.add(f'<path d="M0 318 C 160 280, 330 270, 470 284 C 640 300, 820 254, 1024 280 L1024 1024 L0 1024Z" fill="{PAL["hillFar"]}"/>')
        town = [(150, 300, 70, True), (250, 290, 56, False), (690, 286, 74, True), (840, 272, 60, False)]
        for (x, base, w, litw) in town:
            hh = w * 0.75
            col = "#46385F"
            s.add(f'<path d="M{x - w / 2} {base} V{base - hh} L{x} {base - hh - w * 0.5} L{x + w / 2} {base - hh} V{base}Z" fill="{col}"/>')
            if litw:
                s.add(f'<circle cx="{x}" cy="{base - hh * 0.5}" r="{w * 0.75}" fill="{s.rad(x, base - hh * 0.5, w * 0.75, [(0, "#FFD682", 0.45), (1, "#FFAA50", 0)])}"/>')
                s.add(f'<rect x="{x - 13}" y="{base - hh * 0.5 - 13}" width="26" height="26" rx="4" fill="{PAL["windowLit"]}"/>')
        # the game's tower on the far ridge, beacon lit
        tx, tb = 330, 288
        s.add(f'<path d="M{tx - 26} {tb} L{tx - 18} {tb - 150} H{tx + 18} L{tx + 26} {tb}Z" fill="#46385F"/>')
        s.add(f'<circle cx="{tx}" cy="{tb - 168}" r="64" fill="{s.rad(tx, tb - 168, 64, [(0, "#FFE6A8", 0.6), (1, "#FFAA50", 0)])}"/>')
        s.add(f'<rect x="{tx - 16}" y="{tb - 182}" width="32" height="30" rx="4" fill="{PAL["windowLitCore"]}"/>')
        s.add(f'<path d="M{tx - 28} {tb - 182} L{tx} {tb - 214} L{tx + 28} {tb - 182}Z" fill="{PAL["roof"]}"/>')
        # nearer hill + ground the courtyard sits on
        s.add(f'<path d="M0 380 C 200 352, 380 346, 540 362 C 700 378, 860 346, 1024 362 L1024 1024 L0 1024Z" fill="{PAL["hillMid"]}"/>')
        s.add(f'<path d="M0 414 C 240 396, 420 394, 560 404 C 720 416, 880 396, 1024 406 L1024 1024 L0 1024Z" fill="{s.lin(0, 400, 0, 1024, [(0, PAL["hillNear"], 1), (1, PAL["groundDeep"], 1)])}"/>')
        s.add('</g>')
        if v2:
            # the column's light keeps going a little past the courtyard lip, toward the viewer
            gx0 = P(-0.6, -1.5)[0]; gx1 = P(0.6, -1.5)[0]
            spill = [(gx0, yf + 30), (gx1, yf + 30), (gx1 + 70, 1024), (gx0 - 70, 1024)]
            s.add(f'<path d="{rquad(spill, 20)}" fill="{s.lin(0, yf + 30, 0, 1010, [(0, "#FFB850", 0.30), (0.6, "#FFB850", 0.08), (1, "#FFB850", 0)])}" filter="{s.blur(22)}"/>')
            # foreground bushes framing the lower corners (in-game bush shapes: round clumps)
            for (cx, cy, rr) in ((30, 1000, 140), (180, 1060, 110), (-30, 880, 100), (1000, 990, 140), (850, 1060, 110), (1060, 870, 100)):
                s.add(f'<circle cx="{cx}" cy="{cy}" r="{rr}" fill="#120F22"/>')
    # courtyard slab (grout) with a front lip: a place in the scene, not a frame
    slab = [P(-1.56, 1.56), P(1.56, 1.56), P(1.56, -1.56), P(-1.56, -1.56)]
    lip = 22
    if tint:
        s.add(f'<path d="{rquad([(x, y + lip) for x, y in slab], 22)}" fill="{gray(0.08)}"/>')
        s.add(f'<path d="{rquad(slab, 22)}" fill="{gray(0.14)}"/>')
    else:
        s.add(f'<path d="{rquad([(x, y + lip + 18) for x, y in slab], 30)}" fill="#05060F" opacity="0.45"/>')
        s.add(f'<path d="{rquad([(x, y + lip) for x, y in slab], 22)}" fill="#0B0D1E"/>')
        s.add(f'<path d="{rquad(slab, 22)}" fill="{PAL["grout"]}"/>')
    # lantern on the back-centre tile, numbered rock right beside it.
    # Its light runs left along the back row, is stopped by the rock on the right,
    # and pours down the column toward the viewer, fading as it travels.
    lan, rk = (1, 0), (2, 0)
    lit_cells = [(0, 0), (1, 0), (1, 1), (1, 2)]
    lcx, lcy = ctr(*lan)
    sq = 0.62
    tf = f"translate({f(lcx)} {f(lcy)}) scale(1 {sq}) translate({f(-lcx)} {f(-lcy)})"
    R = 560
    if tint:
        lit = s.rad(lcx, lcy, R, [(0, gray(1.0), 1), (0.45, gray(0.8), 1), (1, gray(0.5), 1)], tf=tf)
    else:
        lit = s.rad(lcx, lcy, R, [(0, "#FFF4D6", 1), (0.2, "#FFE3A0", 1), (0.42, PAL["litCore"], 1), (0.7, "#D9A35E", 1), (1, "#9A6A4E", 1)], tf=tf)
    for row in range(3):
        for col in range(3):
            q = cell(col, row)
            r = 16
            edge = gray(0.1) if tint else ("#6E4A30" if (col, row) in lit_cells else "#151932")
            s.add(f'<path d="{rquad([(x, y + 12) for x, y in q], r)}" fill="{edge}"/>')
            if (col, row) in lit_cells:
                s.add(f'<path d="{rquad(q, r)}" fill="{lit}"/>')
            else:
                if tint:
                    fill = gray(0.24)
                else:
                    x0, y0 = q[0]
                    fill = s.lin(x0, y0, x0 + 60, q[3][1], [(0, PAL["floorHi"] if not dark else "#343C62", 1), (1, PAL["floorLo"] if not dark else "#262C4C", 1)])
                s.add(f'<path d="{rquad(q, r)}" fill="{fill}"/>')
    # beam glow over the lit column and the lit part of the back row
    if not tint:
        bl = s.blur(18)
        colq = [cell(1, 0, 0)[0], cell(1, 0, 0)[1], cell(1, 2, 0)[2], cell(1, 2, 0)[3]]
        g2 = s.lin(0, colq[0][1], 0, colq[2][1], [(0, "#FFE6A8", 0.55), (1, "#FFD682", 0.08)])
        s.add(f'<path d="{rquad(colq, 30)}" fill="{g2}" filter="{bl}"/>')
        rowq = [cell(0, 0, 0)[0], cell(1, 0, 0)[1], cell(1, 0, 0)[2], cell(0, 0, 0)[3]]
        g1 = s.lin(rowq[0][0], 0, rowq[1][0], 0, [(0, "#FFD682", 0.1), (1, "#FFE6A8", 0.5)])
        s.add(f'<path d="{rquad(rowq, 30)}" fill="{g1}" filter="{bl}"/>')
    if not tint:
        halo(s, lcx, lcy - 60, 300 if not dark else 340, 0.95, cream=v2)
    rx_, ry_ = ctr(*rk)
    rock(s, rx_ + 2, ry_ - 16, 66, mode)
    if v2:
        lantern2(s, lcx, lcy + 30, 272, style, mode)
    else:
        h = 256
        lantern(s, lcx, lcy - 0.37 * h + 26, h, mode)
    return s.out(f"Duskwick icon {name} ({mode})")


def main():
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    cands = (("A", cand_a), ("B", cand_b),
             ("C2", lambda m: cand_c(m, "paper", "C2")),
             ("C3", lambda m: cand_c(m, "frame", "C3")),
             ("C4", lambda m: cand_c(m, "lamp", "C4")))
    for name, fn in cands:
        for mode in ("any", "dark", "tinted"):
            with open(os.path.join(out, f"{name}-{mode}.svg"), "w") as fh:
                fh.write(fn(mode))
    print("ok")


if __name__ == "__main__":
    main()
