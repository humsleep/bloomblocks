#!/usr/bin/env python3
"""Write src/compare.html (rendered to compare.png by render.mjs --html)."""
import os
HERE = os.path.dirname(os.path.abspath(__file__))
P = "../png"
CANDS = [("A", "A · light spreads (refined)"), ("B", "B · window + lantern"), ("C3", "C3 · courtyard + framed lantern")]
SIZES = [180, 120, 87, 58, 40]

GLOSSY = """<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="gb{k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{bg1}"/><stop offset="1" stop-color="{bg2}"/></linearGradient>
<linearGradient id="gl{k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
<rect width="100" height="100" fill="url(#gb{k})"/>
{blocks}</svg>"""

def glossy(k, bg1, bg2, cells):
    b = ""
    for (x, y, c) in cells:
        b += f'<rect x="{x}" y="{y}" width="20" height="20" rx="4" fill="{c}" stroke="rgba(0,0,0,.25)" stroke-width="1.2"/><rect x="{x+2}" y="{y+2}" width="16" height="9" rx="3" fill="url(#gl{k})"/>'
    return GLOSSY.format(k=k, bg1=bg1, bg2=bg2, blocks=b)

def wood(k):
    cells = [(20, 20), (42, 20), (42, 42), (64, 42), (20, 64), (42, 64)]
    b = ""
    for (x, y) in cells:
        b += f'<rect x="{x}" y="{y}" width="20" height="20" rx="3" fill="#C8894E" stroke="#7A4A22" stroke-width="1.5"/><path d="M{x+3} {y+7} q8 -3 14 0 M{x+3} {y+13} q8 3 14 0" stroke="#9C6232" stroke-width="1" fill="none"/>'
    return f"""<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#E9CFA3"/>
<path d="M0 18 q50 -6 100 0 M0 50 q50 6 100 0 M0 82 q50 -5 100 0" stroke="#D2AF7A" stroke-width="2" fill="none"/>{b}</svg>"""

G1 = glossy(1, "#3D7BFF", "#1F3FBF", [(18, 30, "#FF4D5E"), (40, 30, "#FF4D5E"), (40, 52, "#FFC83D"), (62, 52, "#FFC83D"), (18, 52, "#3DDC84"), (18, 74, "#3DDC84"), (62, 30, "#B45CFF")])
G2 = glossy(2, "#FF8A3D", "#E0462B", [(30, 20, "#3DD5FF"), (30, 42, "#3DD5FF"), (52, 42, "#7CFF5C"), (52, 64, "#FFF04D"), (30, 64, "#FF4DA6"), (8, 64, "#4D6BFF")])
WD = wood(1)

def icon(src, s, extra=""):
    return f'<div class="ic" style="width:{s}px;height:{s}px;{extra}"><img src="{src}" width="{s}" height="{s}"></div>'

def svgicon(svg, s):
    return f'<div class="ic" style="width:{s}px;height:{s}px">{svg}</div>'

css = """
body{margin:0;background:#ECEAF0;font:14px -apple-system,Helvetica,sans-serif;color:#222;width:1900px}
h1{font-size:22px;margin:20px 28px 4px} h2{font-size:17px;margin:22px 28px 8px}
.row{display:flex;align-items:flex-end;gap:22px;padding:10px 28px}
.lab{width:210px;font-weight:600;align-self:center}
.ic{border-radius:22.4%;overflow:hidden;flex:none;position:relative}
.ic img,.ic svg{display:block;width:100%;height:100%}
.cap{font-size:11px;color:#666;text-align:center;margin-top:4px}
.cell{display:flex;flex-direction:column;align-items:center}
.zoom img{image-rendering:pixelated}
.dk{background:linear-gradient(#2C2C30,#0E0E10)}
.tn{background:#0B0B0C;isolation:isolate}
.tn img{filter:grayscale(1)}
.tn::after{content:"";position:absolute;inset:0;background:var(--t);mix-blend-mode:multiply}
.wall{margin:8px 28px;border-radius:28px;padding:26px 30px;display:flex;flex-direction:column;gap:18px}
.wl{background:linear-gradient(135deg,#F6D9E4,#CFE3F7 55%,#E8F0D8)}
.wd{background:linear-gradient(135deg,#1A1F3A,#0A0B12 60%,#2A1530)}
.hs{display:flex;gap:54px;align-items:flex-start}
.app{display:flex;flex-direction:column;align-items:center;width:120px}
.app span{font-size:12px;margin-top:6px}
.wl .app span{color:#222}.wd .app span{color:#eee}
.note{font-size:12px;color:#555;margin:0 28px}
.wtitle{font-size:12px;font-weight:600;opacity:.7}
"""

h = [f"<!doctype html><html><head><meta charset=utf-8><style>{css}</style></head><body>"]
h.append("<h1>Duskwick app icon: candidates A / B / C</h1><div class=note>All PNGs: 1024 render (Chromium) → sips downscale. Masked with an approximate iOS corner radius for preview only (the source art is full-bleed). Right side: 40 and 58 px enlarged 3× with nearest-neighbour so the actual pixels can be judged.</div>")
h.append("<h2>1. All sizes · Any / Dark / Tinted</h2>")
for k, name in CANDS:
    cells = [f'<div class=lab>{name}</div>']
    cells.append(f'<div class=cell>{icon(f"{P}/{k}-any-1024.png", 256)}<div class=cap>1024 (shown 256)</div></div>')
    for s in SIZES:
        cells.append(f'<div class=cell>{icon(f"{P}/{k}-any-{s}.png", s)}<div class=cap>{s}</div></div>')
    for s in (58, 40):
        cells.append(f'<div class="cell zoom">{icon(f"{P}/{k}-any-{s}.png", s * 3)}<div class=cap>{s} px ×3</div></div>')
    h.append('<div class=row>' + "".join(cells) + "</div>")
    cells = ['<div class=lab style="font-weight:400;color:#555">Dark · Tinted (amber / blue tint sim)</div>']
    for s in (180, 120, 58, 40):
        cells.append(f'<div class=cell>{icon(f"{P}/{k}-dark-{s}.png", s, "").replace("class=\"ic\"", "class=\"ic dk\"")}<div class=cap>dark {s}</div></div>')
    for s, t in ((120, "#F5B04A"), (58, "#F5B04A"), (120, "#6FA8FF"), (40, "#6FA8FF")):
        cells.append(f'<div class=cell><div class="ic tn" style="width:{s}px;height:{s}px;--t:{t}"><img src="{P}/{k}-tinted-{s}.png" width={s} height={s}></div><div class=cap>tinted {s}</div></div>')
    h.append('<div class=row>' + "".join(cells) + "</div>")

h.append("<h2>2. Home-screen row next to typical block-puzzle icons (120 px = 60 pt @2x)</h2>")
for wall, cls, variant in (("Light wallpaper · Any", "wl", "any"), ("Dark wallpaper · Any", "wd", "any"), ("Dark wallpaper · Dark variant (iOS dark mode)", "wd", "dark")):
    h.append(f'<div class="wall {cls}"><div class=wtitle style="color:{"#222" if cls=="wl" else "#ddd"}">{wall}</div>')
    for k, name in CANDS:
        dk = " dk" if variant == "dark" else ""
        apps = [f'<div class=app>{svgicon(G1, 120)}<span>Block Blast</span></div>',
                f'<div class=app>{svgicon(WD, 120)}<span>Wood Puzzle</span></div>',
                f'<div class=app><div class="ic{dk}" style="width:120px;height:120px"><img src="{P}/{k}-{variant}-120.png"></div><span>Duskwick {k}</span></div>',
                f'<div class=app>{svgicon(G2, 120)}<span>Brick Match</span></div>']
        small = f'<div style="display:flex;gap:14px;align-items:center;margin-left:40px">{svgicon(G1, 58)}<div class="ic{dk}" style="width:58px;height:58px"><img src="{P}/{k}-{variant}-58.png"></div>{svgicon(WD, 40)}<div class="ic{dk}" style="width:40px;height:40px"><img src="{P}/{k}-{variant}-40.png"></div>{svgicon(G2, 40)}</div>'
        h.append('<div class=hs>' + "".join(apps) + small + "</div>")
    h.append("</div>")
h.append("<div style='height:24px'></div></body></html>")
open(os.path.join(HERE, "compare.html"), "w").write("\n".join(h))
print("ok")
