// R2 (decision A5): the spoiler-free postcard. It must not be possible to learn ONE lantern
// position or cell of the day's board from it: the spec has no board field, the strip keeps only
// the order story, and two different boards / move cells with the same story draw the SAME calls
// (pixel identity in a real canvas: e2e/share.spec.ts).
import { beforeAll, describe, expect, it, vi } from "vitest";
import { levelForDaily, levelForTrack, moveCells, solutionOf, lanternsPips, type DailyResult } from "../src/game/pipsApi.ts";
import { cellsOf as bbCells } from "./helpers.ts";
import { drawSharePostcard, drawSheetCard, placementStrip, postcardSpec, type PostcardWords, sheetCardGeo, SHARE_H, SHARE_W } from "../src/game/postcard.ts";

/** A 2D context that records every call and assignment (no pixels). */
function recorder(): { ctx: CanvasRenderingContext2D; ops: string[] } {
  const ops: string[] = [];
  const grad = { addColorStop: (o: number, c: string) => ops.push(`stop(${o},${c})`) };
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(t, k: string) {
      if (k in t) return t[k];
      if (k === "createRadialGradient" || k === "createLinearGradient") return (...a: number[]) => (ops.push(`${k}(${a.map((v) => v.toFixed(2)).join(",")})`), grad);
      if (k === "measureText") return (s: string) => ({ width: s.length * 7 });
      if (k === "createImageData") return (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) });
      if (k === "createPattern") return () => null;
      return (...a: unknown[]) => {
        ops.push(`${k}(${a.map((v) => (typeof v === "number" ? v.toFixed(2) : String(v))).join(",")})`);
      };
    },
    set(t, k: string, v) {
      t[k] = v;
      ops.push(`${k}=${String(v)}`);
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, ops };
}

// the house's grain draws from an offscreen noise tile: a recording canvas stands in for it
beforeAll(() => {
  vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => recorder().ctx }) });
});

const words: PostcardWords = { time: "Time", streak: "Streak", noHints: "No hints", order: "Lanterns, in order", yourTurn: "Your turn!", date: "Nov 14", link: "humsleep.github.io/duskwick/14", font: "system-ui" };
const r: DailyResult = { dateISO: "2026-11-14", seconds: 247, hints: 1, undos: 2, streak: 14 };

describe("placementStrip: the order story, never a position", () => {
  it("keep / fixed / hint in the order of play", () => {
    // place 10, place 11, take 10 back, hint, place 12, place 10 again
    expect(placementStrip([10, 11, 10, 12, 10], [3])).toEqual(["fixed", "keep", "hint", "keep", "keep"]);
    expect(placementStrip([], [0, 0])).toEqual(["hint", "hint"]);
    expect(placementStrip([5, 6], [99, -3])).toEqual(["hint", "keep", "keep", "hint"]);
  });

  it("any relabelling of the cells gives the same strip (the values are only compared)", () => {
    const cells = [3, 9, 3, 14, 20, 9, 9, 27, 3];
    const perm = new Map<number, number>();
    let k = 40;
    for (const c of cells) if (!perm.has(c)) perm.set(c, k--);
    expect(placementStrip(cells.map((c) => perm.get(c)!), [2, 5])).toEqual(placementStrip(cells, [2, 5]));
  });
});

describe("postcardSpec: no board in, no board out", () => {
  it("has no field that could hold the level, a cell or a position", () => {
    const spec = postcardSpec(r, [1, 2, 3], [1]);
    expect(Object.keys(spec).sort()).toEqual(["dateISO", "hints", "houseKey", "moon8", "n", "streak", "strip", "time"]);
    expect(spec.houseKey).toBe("lanterns-pips:daily:g3:2026-11-14"); // the date's seed key: the house, not the board
    expect(spec.n).toBe(14);
    expect(spec.time).toBe("4:07");
    expect(postcardSpec(r, [1], [], false).time).toBe("");
    // the strip carries chips only
    expect(spec.strip.every((c) => c === "keep" || c === "fixed" || c === "hint")).toBe(true);
  });

  it("two different boards with the same story draw exactly the same postcard (sheet card and share image)", () => {
    const today = levelForDaily("2026-11-14");
    const other = levelForTrack("gentle", 9);
    const solA = bbCells(solutionOf(today)!);
    const solB = bbCells(solutionOf(other)!).slice(0, solA.length);
    for (let c = 0; solB.length < solA.length; c++) if (!solB.includes(c) && c !== 7) solB.push(c);
    const wrongA = [...Array(64).keys()].find((c) => !solA.includes(c))!;
    const wrongB = [...Array(64).keys()].reverse().find((c) => !solB.includes(c))!;
    // the same story on both boards: a wrong lantern taken back, then the solution in order
    const story = (sol: number[], wrong: number): number[] => [wrong, ...sol.slice(0, 2), wrong, ...sol.slice(2)];
    const enc = (cells: number[]) => cells.map((c) => lanternsPips.encodeMove({ x: c & 7, y: c >> 3 }));
    const a = postcardSpec(r, moveCells(enc(story(solA, wrongA))), [2]);
    const b = postcardSpec(r, moveCells(enc(story(solB, wrongB))), [2]);
    expect(a).toEqual(b);
    const u = 2;
    const geo = sheetCardGeo(343 * u, 90 * u, u, false);
    const draw = (spec: typeof a) => {
      const s1 = recorder();
      drawSheetCard(s1.ctx, geo, spec, words, u);
      const s2 = recorder();
      drawSharePostcard(s2.ctx, spec, words, SHARE_W, SHARE_H);
      return [s1.ops, s2.ops] as const;
    };
    const [sa, sha] = draw(a);
    const [sb, shb] = draw(b);
    expect(sa).toEqual(sb);
    expect(sha).toEqual(shb);
    expect(sha.length).toBeGreaterThan(200);
    // and the words never name a cell (A1–H8) nor print board rows
    const text = sha.filter((o) => o.startsWith("fillText(")).join("\n");
    expect(text).not.toMatch(/\b[A-H][1-8]\b|[#.L]{3}/);
    // #n once: on the postmark (the title is the name only)
    expect(text).toContain("fillText(Duskwick,");
    expect(text.match(/fillText\(#14,/g)).toHaveLength(1);
    expect(text).toContain("humsleep.github.io/duskwick/14");
  });
});
