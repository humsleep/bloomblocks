// Village art kit (src/render/village, v14): the lantern-house spec of the puzzle screen, the drawings'
// data against the catalog (G8), fit / no-clip (Reality #9), the room's 18 slots, the village plots
// (no overlaps / tangents), the letter lines (≤ 1 blank, #8) — and every drawing runs (recording context).
import { readFileSync, statSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import GLYPHS from "../src/render/village/letterGlyphs.json";
import { LETTER_FACES } from "../src/render/village/fonts.ts";
import { ITEMS as CATALOG } from "../src/village/catalog.ts";
import { FURNITURE_IDS, furnitureScale, ITEMS, drawFurnitureAt, type ItemId } from "../src/render/village/furniture.ts";
import { lanternHouseFor, LH_EXTENT, LH_SMALL, LH_UNITS, LANTERN_THEMES, drawLanternHouseSpec } from "../src/render/village/lanternHouse.ts";
import { roomGeometry, FLOOR_COLS } from "../src/render/village/room.ts";
import { villageLayout, PLOTS } from "../src/render/village/nature.ts";
import { letterHeight, letterLines } from "../src/render/village/letter.ts";
import { portraitLayout, residentFit, residentHead } from "../src/render/village/residents.ts";
import { RESIDENT_IDS } from "../src/render/village/lanternHouse.ts";

/** A 2D context that records the calls (no pixels) + the few DOM bits the kit touches (Path2D, a canvas for the noise tile). */
function recorder(): { ctx: CanvasRenderingContext2D; ops: string[] } {
  const ops: string[] = [];
  const grad = { addColorStop: () => undefined };
  const t: Record<string, unknown> = {};
  const ctx = new Proxy(t, {
    get(o, k: string) {
      if (k in o) return o[k];
      if (k === "createRadialGradient" || k === "createLinearGradient") return () => grad;
      if (k === "createPattern") return () => ({ setTransform: () => undefined });
      if (k === "getTransform") return () => ({ a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 });
      if (k === "createImageData") return (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) });
      return (...a: unknown[]) => {
        ops.push(`${k}(${a.length})`);
      };
    },
    set(o, k: string, v) {
      o[k] = v;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, ops };
}

beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  g.Path2D ??= class {
    moveTo(): void {}
    lineTo(): void {}
    arc(): void {}
    ellipse(): void {}
    rect(): void {}
    roundRect(): void {}
    quadraticCurveTo(): void {}
    bezierCurveTo(): void {}
    closePath(): void {}
  };
  g.DOMMatrix ??= class {
    constructor(public m: number[] = []) {}
  };
  g.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => recorder().ctx }) };
});

describe("the puzzle screen's lantern-house (HouseSpec kind 'lantern')", () => {
  it("heart = the lid skylight, 2–4 progress windows lit in a shuffled order, a known theme, deterministic", () => {
    for (let n = 1; n <= 40; n++) {
      const h = lanternHouseFor(`g-${n}`, n);
      expect(h.kind).toBe("lantern");
      expect(h.windows[0]!.round && h.windows[0]!.y < -0.9).toBe(true);
      expect(h.windows.length).toBeGreaterThanOrEqual(3);
      expect(h.windows.length).toBeLessThanOrEqual(5);
      expect([...h.order].sort()).toEqual(h.windows.slice(1).map((_, i) => i + 1));
      expect(h.windows.every((w) => w.glass === "lantern")).toBe(true);
      expect(LANTERN_THEMES[h.theme as keyof typeof LANTERN_THEMES]).toBeTruthy();
      expect(h.chimney).toBeNull();
      expect(lanternHouseFor(`g-${n}`, n)).toEqual(h);
    }
  });
  it("small lower windows only when they clear the number plate (no plate over a window)", () => {
    const clear = (LH_SMALL[1]!.x - LH_SMALL[1]!.r * 1.25) / LH_UNITS;
    for (let n = 3; n <= 40; n++) {
      expect(lanternHouseFor(`p-${n}`, n, clear + 0.01).windows.length).toBe(3);
      const roomy = lanternHouseFor(`p-${n}`, n, 0.1);
      for (const w of roomy.windows.slice(3)) expect(Math.abs(w.x) - w.w / 2).toBeGreaterThan(0.1);
    }
  });
  it("extent covers the drawing (texture sizing) and the spec draws", () => {
    const h = lanternHouseFor("x", 5);
    expect(h.left + h.right).toBeCloseTo((LH_EXTENT.left + LH_EXTENT.right) / LH_UNITS);
    const { ctx, ops } = recorder();
    drawLanternHouseSpec(ctx, h, 100, 200, 150, 3);
    expect(ops.length).toBeGreaterThan(100);
  });
});

describe("furniture (G8: the drawings match the catalog)", () => {
  it("the catalog's ids in its order (round 3: the kit draws 24; the catalog grows to them), same colourways and spans", () => {
    expect(FURNITURE_IDS.length).toBe(24);
    expect(FURNITURE_IDS.slice(0, CATALOG.length)).toEqual(CATALOG.map((x) => x.id));
    for (const c of CATALOG) {
      expect(ITEMS[c.id].colorways).toEqual(c.colorways);
      if (c.layer === "floor") expect(ITEMS[c.id].span).toBe(c.span);
    }
  });
  it("never crosses its box (catalog cards, room slots): Reality #9", () => {
    for (const id of FURNITURE_IDS) {
      const it = ITEMS[id];
      for (const [w, h] of [[52, 54], [56, 84], [70, 105], [140, 105]] as const) {
        for (const mode of ["room", "card"] as const) {
          // cards never cross their art box; the room's pieces may overhang their slot by ≤ 1.6 × (depth overlap)
          const s = furnitureScale(id, w * it.span, h, mode);
          const k = mode === "card" ? 1 : 1.6;
          expect((it.x1 - it.x0) * s).toBeLessThanOrEqual(w * it.span * k + 1e-6);
          expect(-it.top * s).toBeLessThanOrEqual(h * k + 1e-6);
        }
      }
    }
  });
  it("one room scale: the bed is ≥ 2 × the chair's width, a teapot stays smaller than the bookshelf", () => {
    const s = (id: ItemId, span = 1): number => furnitureScale(id, 70 * span, 105);
    const w = (id: ItemId, span = 1): number => (ITEMS[id].x1 - ITEMS[id].x0) * s(id, span);
    expect(w("smallBed", 2) / w("archChair")).toBeGreaterThanOrEqual(2);
    expect(-ITEMS.teapot.top * s("teapot")).toBeLessThan(-ITEMS.bookshelf.top * s("bookshelf") * 0.5);
  });
  it("every item × colourway draws, and the locked pass draws the same item (no glows) — G8", () => {
    for (const id of FURNITURE_IDS) {
      for (const cw of ITEMS[id].colorways) {
        const a = recorder();
        drawFurnitureAt(a.ctx, id, cw, 50, 100, 1.5);
        const b = recorder();
        drawFurnitureAt(b.ctx, id, cw, 50, 100, 1.5, true);
        expect(a.ops.length).toBeGreaterThan(10);
        expect(b.ops.length).toBeGreaterThan(5);
        expect(b.ops.length).toBeLessThanOrEqual(a.ops.length);
      }
    }
  });
});

describe("the cottage room: 18 slots", () => {
  it("15 floor (3 rows × 5, back rows smaller) + 3 wall slots, inside the room box, no overlaps in a row", () => {
    const at = { x: 10, y: 50, w: 410, h: 440 };
    const R = roomGeometry(at);
    expect(R.slots.length).toBe(18);
    for (const b of R.slots) {
      expect(b.x).toBeGreaterThanOrEqual(at.x);
      expect(b.x + b.w).toBeLessThanOrEqual(at.x + at.w);
      expect(b.y).toBeGreaterThanOrEqual(at.y);
    }
    for (let r = 0; r < 3; r++)
      for (let c = 1; c < FLOOR_COLS; c++) expect(R.slots[r * 5 + c]!.x).toBeGreaterThanOrEqual(R.slots[r * 5 + c - 1]!.x + R.slots[r * 5 + c - 1]!.w - 0.01);
    expect(R.slots[0]!.w).toBeLessThan(R.slots[10]!.w);
    // the wall slots stay clear of the window
    for (const b of R.slots.slice(15)) expect(b.x + b.w).toBeLessThan(R.window.x - R.window.r);
  });
});

describe("the village plots", () => {
  it("no two houses (drawn extent) overlap, the mailbox stands clear of the cottage", () => {
    const L = villageLayout({ x: 0, y: 0, w: 430, h: 932 });
    const ids = Object.keys(PLOTS) as (keyof typeof PLOTS)[];
    // the drawn lantern-house (staves ±67, lid ±68, handle top −167 units) inside its box
    const body = (id: (typeof ids)[number]): { x0: number; x1: number; y0: number; y1: number } => {
      const p = PLOTS[id];
      return { x0: p.x - 68 * p.s, x1: p.x + 68 * p.s, y0: p.y - 167 * p.s, y1: p.y };
    };
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const a = body(ids[i]!);
        const b = body(ids[j]!);
        const sep = a.x1 + 4 < b.x0 || b.x1 + 4 < a.x0 || a.y1 + 4 < b.y0 || b.y1 + 4 < a.y0;
        expect(sep, `${ids[i]} vs ${ids[j]}`).toBe(true);
      }
    const c = body("cottage");
    expect(L.mailbox.x + L.mailbox.w).toBeLessThan(c.x0);
  });
});

describe("letters and residents", () => {
  it("exactly n ruled lines, at most one blank line's worth of paper below them (#8)", () => {
    for (const n of [2, 3, 5, 7])
      for (const px of [14, 15, 17]) {
        const w = 360;
        const h = letterHeight(w, n, px);
        const L = letterLines({ x: 0, y: 0, w, h }, n, px);
        expect(L.baselines.length).toBe(n);
        expect(h - L.baselines.at(-1)!).toBeLessThan(L.pitch * 2);
      }
  });
  it("a resident fits its box and its head (the emote anchor) is inside it", () => {
    const at = { x: 20, y: 30, w: 60, h: 64 };
    const s = residentFit(at.w, at.h);
    expect(s * 0.76).toBeLessThanOrEqual(at.w + 1e-6);
    const h = residentHead(at, "momo");
    expect(h.x).toBeGreaterThan(at.x);
    expect(h.x).toBeLessThan(at.x + at.w);
    expect(h.y).toBeGreaterThan(at.y);
    expect(h.y).toBeLessThan(at.y + at.h);
  });
});

describe("G2: the letter fonts (subset per language, renamed, licensed)", () => {
  const root = new URL("../", import.meta.url);
  const text = (p: string): string => readFileSync(new URL(p, root), "utf8");
  it("every character of each language's village lines is in its subset (or a punctuation fallback)", () => {
    const L = "src/village/lines/";
    const files = [["latin", "en"], ["latin", "de"], ["latin", "fr"], ["latin", "es"], ["latin", "it"], ["latin", "pt-BR"], ["ko", "ko"], ["ja", "ja"], ["zh-Hans", "zh-Hans"], ["zh-Hant", "zh-Hant"]] as const;
    for (const [loc, f] of files) {
      const file = `${L}${f}.json`;
      const have = new Set([...GLYPHS[loc].chars]);
      const fallback = new Set([...GLYPHS[loc].missing]);
      // only what is set in the handwriting face: letters and gift tags (+ catchphrases); dialogue uses the UI face
      // (Frontend, full village: subsetting every line pushed zh-Hant to 165 KB, the letter lines alone are 76 KB)
      const d = JSON.parse(text(file)) as { text?: Record<string, string>; cp?: Record<string, unknown>; lines?: { id: string; t: string; x: string }[] };
      const hand = (id: string): boolean => /\.(letter\.|gift\.tag)/.test(id);
      const shown = [...Object.entries(d.text ?? {}).filter(([id]) => hand(id)).map(([, v]) => v), ...Object.values(d.cp ?? {}).map(String), ...(d.lines ?? []).filter((l) => hand(l.id)).map((l) => l.x)].join("\n");
      for (const ch of new Set([...shown])) {
        if (ch.codePointAt(0)! < 0xa0 || /\s/.test(ch) || have.has(ch)) continue;
        // not in the subset: only a symbol the face itself lacks may fall back to the stack's next face
        expect(fallback.has(ch) && !/[\p{L}\p{N}]/u.test(ch), `${loc} lacks ${ch} — rerun scripts/subset-letter-fonts.py`).toBe(true);
      }
    }
  });
  it("small files, neutral names (OFL Reserved Font Names), every language mapped, the notices shipped", () => {
    let total = 0;
    for (const [loc, g] of Object.entries(GLYPHS)) {
      const bytes = statSync(new URL(`public/${g.file}`, root)).size;
      expect(bytes, loc).toBe(g.bytes);
      // per language ≤ 200 KB (a player downloads only their own); all five ≤ 600 KB in the bundle
      expect(bytes, loc).toBeLessThan(200 * 1024);
      expect(g.family).toMatch(/^DuskwickHand (Latin|KR|JP|SC|TC)$/);
      total += bytes;
    }
    expect(total).toBeLessThan(600 * 1024);
    for (const l of ["en", "de", "fr", "es", "it", "pt-BR", "ko", "ja", "zh-Hans", "zh-Hant"] as const) expect(LETTER_FACES[l]?.file).toMatch(/^fonts\/letter-/);
    const lic = text("public/licenses.txt");
    for (const n of ["Patrick Hand", "Gaegu", "Klee One", "LXGW WenKai (", "LXGW WenKai TC"]) expect(lic).toContain(n);
    for (const f of ["PatrickHand", "Gaegu", "KleeOne", "LXGWWenKai", "LXGWWenKaiTC"]) expect(text(`public/fonts/OFL-${f}.txt`)).toContain("SIL OPEN FONT LICENSE Version 1.1");
  });
});

describe("dialogue portraits (G1 re-review 2 #2)", () => {
  it("every resident's eyes sit inside 80 % of the portrait circle's radius (framed by the face, not the feet)", () => {
    for (const id of RESIDENT_IDS) {
      for (const r of [20, 28, 36]) {
        const p = portraitLayout(id, r);
        const corners = [[p.eyes.x0, p.eyes.y0], [p.eyes.x1, p.eyes.y0], [p.eyes.x0, p.eyes.y1], [p.eyes.x1, p.eyes.y1]];
        for (const [x, y] of corners) expect(Math.hypot(x!, y!), `${id} r${r}`).toBeLessThanOrEqual(0.8 * r);
        // the body reads as a body: its width fills most of the frame
        expect(p.size).toBeGreaterThan(r);
      }
    }
  });
});

describe("round 3: the full village art", () => {
  it("seven residents, each with a house theme, a portrait that frames the face, a gift wrap", async () => {
    const { RESIDENTS } = await import("../src/render/village/residents.ts");
    expect(RESIDENT_IDS.length).toBe(7);
    for (const id of RESIDENT_IDS) {
      expect(RESIDENTS[id]).toBeTruthy();
      expect(LANTERN_THEMES[id]).toBeTruthy();
    }
  });
  it("eight plots that never overlap; every time × season backdrop + room shell draws", async () => {
    const { drawVillageBackdrop } = await import("../src/render/village/nature.ts");
    const { drawRoomShell } = await import("../src/render/village/room.ts");
    const { TIMES, SEASONS } = await import("../src/render/village/atmos.ts");
    expect(Object.keys(PLOTS).length).toBe(8);
    for (const time of TIMES)
      for (const season of SEASONS) {
        const a = recorder();
        drawVillageBackdrop(a.ctx, { x: 0, y: 0, w: 430, h: 932 }, { time, season });
        const b = recorder();
        drawRoomShell(b.ctx, { x: 0, y: 0, w: 400, h: 420 }, { wallpaper: 1, floor: 2, time, season });
        expect(a.ops.length).toBeGreaterThan(500);
        expect(b.ops.length).toBeGreaterThan(200);
      }
  });
  it("market stall gives 3 slots inside its box; every request category draws; the postcard keeps its boxes inside", async () => {
    const { drawMarketStall, drawRequestBubble, drawPostcardFrame, REQUEST_CATEGORIES } = await import("../src/render/village/extras.ts");
    const at = { x: 10, y: 20, w: 300, h: 280 };
    const st = drawMarketStall(recorder().ctx, at);
    expect(st.slots.length).toBe(3);
    for (const b of st.slots) {
      expect(b.x).toBeGreaterThanOrEqual(at.x);
      expect(b.x + b.w).toBeLessThanOrEqual(at.x + at.w);
    }
    for (const c of REQUEST_CATEGORIES) {
      const r = recorder();
      drawRequestBubble(r.ctx, 100, 100, 18, c);
      expect(r.ops.some((o) => o.startsWith("stroke("))).toBe(true);
    }
    const pc = drawPostcardFrame(recorder().ctx, 1080, 1350);
    for (const b of [pc.room, pc.caption, pc.stamp]) {
      expect(b.x).toBeGreaterThan(0);
      expect(b.y + b.h).toBeLessThan(1350);
    }
  });
});
