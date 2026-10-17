#!/usr/bin/env python3
"""Subset the village letter fonts per locale (Reality G2) — WOFF2, renamed to neutral family names.

Run with fontTools + brotli (a venv outside the repo is fine), python -I, every path as an argument:

  python -I apps/client/scripts/subset-letter-fonts.py \
      --font latin=<PatrickHand-Regular.ttf> --font ko=<Gaegu-Bold.ttf> --font ja=<KleeOne-SemiBold.ttf> \
      --font zh-Hans=<LXGWWenKai-Regular.ttf> --font zh-Hant=<LXGWWenKaiTC-Regular.ttf> \
      --text ko=apps/client/src/village/lines/ko.json --text ko=apps/client/src/village/text.ts ... \
      --out apps/client/public/fonts --manifest apps/client/src/render/village/letterGlyphs.json

Each locale's subset = the characters of its --text files + a small base set (ASCII, punctuation; kana for ja).
Re-run whenever a locale's village lines change (tests/village-art.test.ts checks the manifest covers them).
The subsets are Modified Versions under the SIL OFL 1.1: the family / full / PostScript names are replaced by
"DuskwickHand <TAG>" (LXGW WenKai declares Reserved Font Names); copyright, version and licence records are kept.
"""
import argparse
import json
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

TAG = {"latin": "Latin", "ko": "KR", "ja": "JP", "zh-Hans": "SC", "zh-Hant": "TC"}


def rng(a, b):
    return {chr(c) for c in range(a, b + 1)}


ASCII = rng(0x20, 0x7E)
PUNCT = set("‘’“”…—–·•°×%€£¥₩")
LATIN = ASCII | PUNCT | rng(0xA0, 0xFF) | rng(0x100, 0x17F)
CJK_PUNCT = rng(0x3000, 0x303F) | rng(0xFF01, 0xFF5E) | set("…—～·“”‘’")
BASE = {
    "latin": LATIN,
    "ko": ASCII | PUNCT | CJK_PUNCT,
    "ja": ASCII | PUNCT | CJK_PUNCT | rng(0x3041, 0x3096) | rng(0x309B, 0x309E) | rng(0x30A1, 0x30FA) | rng(0x30FC, 0x30FE),
    "zh-Hans": ASCII | PUNCT | CJK_PUNCT,
    "zh-Hant": ASCII | PUNCT | CJK_PUNCT,
}


def shown_text(path):
    """A village line file (.json): only the strings players see (text / cp / lines[].x), not translator notes."""
    with open(path, encoding="utf-8") as f:
        d = json.load(f)
    parts = list((d.get("text") or {}).values()) + [str(v) for v in (d.get("cp") or {}).values()] + [l.get("x", "") for l in d.get("lines") or []]
    return "\n".join(parts)


def chars_of(path):
    if path.endswith(".json"):
        s = shown_text(path)
    else:
        with open(path, encoding="utf-8") as f:
            s = f.read()
    # only the characters themselves matter; the base set already has ASCII, so keep the non-ASCII ones
    return {c for c in s if ord(c) >= 0xA0 and not c.isspace()}


def rename(font, tag):
    family = f"DuskwickHand {tag}"
    ps = f"DuskwickHand-{tag}"
    name = font["name"]
    version = name.getDebugName(5) or "Version 1.0"
    keep = {0, 5, 13, 14}
    name.names = [n for n in name.names if n.nameID in keep]
    for nid, val in ((1, family), (2, "Regular"), (3, f"{ps};{version}"), (4, family), (6, ps)):
        name.setName(val, nid, 3, 1, 0x409)
        name.setName(val, nid, 1, 0, 0)
    return family


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--font", action="append", default=[], help="locale=path")
    ap.add_argument("--text", action="append", default=[], help="locale=path (repeatable)")
    ap.add_argument("--out", required=True)
    ap.add_argument("--manifest", required=True)
    a = ap.parse_args(argv)
    fonts = dict(x.split("=", 1) for x in a.font)
    texts = {}
    for x in a.text:
        loc, p = x.split("=", 1)
        texts.setdefault(loc, set()).update(chars_of(p))
    os.makedirs(a.out, exist_ok=True)
    manifest = {}
    for loc, src in fonts.items():
        if loc not in TAG:
            sys.exit(f"unknown locale {loc}")
        want = BASE[loc] | texts.get(loc, set())
        font = TTFont(src)
        cmap = font.getBestCmap()
        have = {c for c in want if ord(c) in cmap}
        missing = sorted(c for c in texts.get(loc, set()) if ord(c) not in cmap)
        opts = subset.Options()
        opts.flavor = "woff2"
        opts.layout_features = ["kern", "liga", "calt", "locl", "ccmp", "mark", "mkmk", "palt", "vpal"]
        opts.name_IDs = ["*"]
        opts.name_languages = ["*"]
        opts.hinting = False
        opts.notdef_outline = True
        sub = subset.Subsetter(opts)
        sub.populate(unicodes=[ord(c) for c in have])
        sub.subset(font)
        family = rename(font, TAG[loc])
        out = os.path.join(a.out, f"letter-{loc}.woff2")
        font.flavor = "woff2"
        font.save(out)
        size = os.path.getsize(out)
        manifest[loc] = {"file": f"fonts/letter-{loc}.woff2", "family": family, "bytes": size, "chars": "".join(sorted(c for c in have if ord(c) >= 0xA0)), "missing": "".join(missing)}
        print(f"{loc:8s} {family:20s} {len(have):5d} glyphs  {size / 1024:7.1f} KB  missing {len(missing)}")
    with open(a.manifest, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
        f.write("\n")


if __name__ == "__main__":
    main(sys.argv[1:])
