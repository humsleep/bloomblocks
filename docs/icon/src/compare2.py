#!/usr/bin/env python3
"""Lantern revision sheet: old C1 vs C2/C3/C4 next to pumpkin / fanous / block stand-ins -> src/compare-lantern.html"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from compare import G1, WD, css, icon, svgicon  # noqa: E402  (compare.py also writes compare.html; harmless)
HERE = os.path.dirname(os.path.abspath(__file__))
P = "../png"
CANDS = [("C1", "C1 · previous (round ribbed)"), ("C2", "C2 · tall paper lantern"), ("C3", "C3 · paper lantern in wood frame"), ("C4", "C4 · glass lamp, roof + ring")]

PUMPKIN = """<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="pk" cx="50" cy="58" r="34" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFB347"/><stop offset=".7" stop-color="#F07A1E"/><stop offset="1" stop-color="#B8500E"/></radialGradient>
<linearGradient id="pb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2A1846"/><stop offset="1" stop-color="#4A2266"/></linearGradient></defs>
<rect width="100" height="100" fill="url(#pb)"/><circle cx="76" cy="22" r="9" fill="#F4EBD0"/><circle cx="72" cy="19" r="8" fill="#2F1A4C"/>
<ellipse cx="50" cy="60" rx="32" ry="26" fill="url(#pk)"/><path d="M50 34 v52 M36 36 q-8 24 0 48 M64 36 q8 24 0 48" stroke="#B8500E" stroke-width="2.4" fill="none"/>
<rect x="46" y="26" width="8" height="11" rx="2" fill="#4E7A2E"/></svg>"""
JACK = """<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#141026"/>
<circle cx="50" cy="58" r="40" fill="#FF9A2E" opacity=".25"/><ellipse cx="50" cy="58" rx="30" ry="25" fill="#F28A22"/><path d="M50 34 v48 M37 36 q-7 22 0 44 M63 36 q7 22 0 44" stroke="#C0601A" stroke-width="2" fill="none"/>
<rect x="46" y="25" width="7" height="11" rx="2" fill="#3E5A26"/><path d="M36 52 l6 -8 6 8z M52 52 l6 -8 6 8z" fill="#FFE27A"/><path d="M36 64 q14 10 28 0 l-4 6 q-10 5 -20 0z" fill="#FFE27A"/></svg>"""
FANOUS = """<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#0E2A3A"/>
<circle cx="50" cy="56" r="34" fill="#FFC864" opacity=".22"/><circle cx="50" cy="12" r="5" fill="none" stroke="#C9A04A" stroke-width="2.5"/>
<path d="M50 17 L64 32 H36Z" fill="#C9A04A"/><path d="M36 32 H64 L68 70 H32Z" fill="#FFD27A" stroke="#9C7430" stroke-width="3"/><path d="M50 32 V70" stroke="#9C7430" stroke-width="2"/>
<path d="M32 70 H68 L60 80 H40Z" fill="#C9A04A"/><circle cx="80" cy="22" r="8" fill="#F4EBD0"/><circle cx="76" cy="19" r="7" fill="#0E2A3A"/></svg>"""

h = [f"<!doctype html><html><head><meta charset=utf-8><style>{css} body{{width:1700px}}</style></head><body>"]
h.append("<h1>Duskwick lantern revision: C1 (old) vs C2 / C3 / C4</h1><div class=note>1024 render → sips downscale; preview mask only. ×3 = nearest-neighbour enlargement of the real 58/40 px pixels.</div>")
h.append("<h2>1. Small sizes</h2>")
for k, name in CANDS:
    cells = [f'<div class=lab>{name}</div>']
    for s in (120, 87, 58, 40):
        cells.append(f'<div class=cell>{icon(f"{P}/{k}-any-{s}.png", s)}<div class=cap>{s}</div></div>')
    for s in (58, 40):
        cells.append(f'<div class="cell zoom">{icon(f"{P}/{k}-any-{s}.png", s * 3)}<div class=cap>{s} ×3</div></div>')
    for s in (58, 40):
        cells.append(f'<div class=cell><div class="ic dk" style="width:{s}px;height:{s}px"><img src="{P}/{k}-dark-{s}.png"></div><div class=cap>dark {s}</div></div>')
    for s in (58, 40):
        cells.append(f'<div class=cell><div class="ic tn" style="width:{s}px;height:{s}px;--t:#F5B04A"><img src="{P}/{k}-tinted-{s}.png"></div><div class=cap>tinted {s}</div></div>')
    h.append('<div class=row>' + "".join(cells) + "</div>")
h.append("<h2>2. Home screen next to pumpkin / Ramadan-lantern / block-puzzle stand-ins</h2>")
for wall, cls, variant in (("Light wallpaper · Any", "wl", "any"), ("Dark wallpaper · Any", "wd", "any"), ("Dark wallpaper · Dark variant", "wd", "dark")):
    h.append(f'<div class="wall {cls}"><div class=wtitle style="color:{"#222" if cls == "wl" else "#ddd"}">{wall}</div>')
    for k, name in CANDS:
        dk = " dk" if variant == "dark" else ""
        apps = [f'<div class=app>{svgicon(PUMPKIN, 120)}<span>Pumpkin Match</span></div>',
                f'<div class=app>{svgicon(G1, 120)}<span>Block Blast</span></div>',
                f'<div class=app><div class="ic{dk}" style="width:120px;height:120px"><img src="{P}/{k}-{variant}-120.png"></div><span>Duskwick {k}</span></div>',
                f'<div class=app>{svgicon(FANOUS, 120)}<span>Ramadan Glow</span></div>',
                f'<div class=app>{svgicon(JACK, 120)}<span>Spooky Night</span></div>']
        small = (f'<div style="display:flex;gap:14px;align-items:center;margin-left:30px">{svgicon(PUMPKIN, 58)}<div class="ic{dk}" style="width:58px;height:58px"><img src="{P}/{k}-{variant}-58.png"></div>'
                 f'{svgicon(FANOUS, 58)}{svgicon(JACK, 40)}<div class="ic{dk}" style="width:40px;height:40px"><img src="{P}/{k}-{variant}-40.png"></div>{svgicon(WD, 40)}</div>')
        h.append('<div class=hs style="gap:40px">' + "".join(apps) + small + "</div>")
    h.append("</div>")
h.append("<div style='height:24px'></div></body></html>")
open(os.path.join(HERE, "compare-lantern.html"), "w").write("\n".join(h))
print("ok")
