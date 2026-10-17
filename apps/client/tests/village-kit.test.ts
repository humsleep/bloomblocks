// Gate G8 (data side): the art kit (src/render/village, UI Designer) draws exactly the catalog's
// items — same ids, colourways and floor span — so a drawer card's name always matches its drawing.
// Skipped while the kit is not in the tree (the scene then uses placeholders).
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ITEMS } from "../src/village/catalog.ts";
import { DRAWER_TABS } from "../src/village/catalog.ts";
import { fitText } from "../src/village/wrap.ts";

const KIT = fileURLToPath(new URL("../src/render/village/index.ts", import.meta.url));

describe.skipIf(!existsSync(KIT))("G8: kit ↔ catalog", () => {
  it("same item ids, colourways, spans", async () => {
    const kit = await import("../src/render/village/furniture.ts");
    const idx = await import("../src/render/village/index.ts");
    expect([...(idx.villageArt.furnitureIds ?? [])].sort()).toEqual(ITEMS.map((x) => x.id).sort());
    for (const x of ITEMS) {
      const a = (kit.ITEMS as Record<string, { colorways: readonly string[]; span: number }>)[x.id]!;
      expect(a, x.id).toBeTruthy();
      expect([...a.colorways], x.id).toEqual([...x.colorways]);
      expect(a.span, x.id).toBe(x.span);
    }
  });
});

describe("drawer tabs fit a fifth of an SE (2 lines, ≥ 10 pt)", () => {
  const measureAt = (size: number) => (s: string): number => [...s].reduce((w, c) => w + (/[가-힣]/.test(c) ? 0.95 : c === " " ? 0.28 : 0.58) * size, 0);
  const tabW = (375 - 32 - 8 * 4) / 5 - 8;
  for (const t of DRAWER_TABS) for (const lang of ["en", "ko"] as const) {
    it(`${lang} ${t.name[lang]}`, () => expect(fitText(t.name[lang], { maxW: tabW, maxLines: 2, sizes: [13, 12, 11, 10], measureAt }).fits).toBe(true));
  }
});
