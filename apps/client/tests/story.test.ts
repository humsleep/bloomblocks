// R4 B storybook: which pages open when, the read bits, and that every locale has the whole text.
import { describe, expect, it } from "vitest";
import { LANGS } from "../src/a11y/strings.ts";
import { RESIDENTS } from "../src/village/catalog.ts";
import type { ResidentState } from "../src/village/model.ts";
import { CHAPTERS, pageBit, setBit, STORY, storyState, unreadPages } from "../src/village/story.ts";

const rs = (o: Partial<Record<string, { movedIn: boolean; friendship: number; points?: number }>>): ResidentState[] =>
  RESIDENTS.map((r) => ({ r, movedIn: o[r.id]?.movedIn ?? false, moveInDay: null, friendship: o[r.id]?.friendship ?? 0, points: o[r.id]?.points ?? 0 }));
const idx = (id: string): number => RESIDENTS.find((r) => r.id === id)!.index;

describe("storybook pages", () => {
  it("nothing opens before anyone moved in; page 1 with the move", () => {
    expect(unreadPages(storyState(rs({}), [], []))).toBe(0);
    const s = storyState(rs({ momo: { movedIn: true, friendship: 0, points: 1 } }), [], []);
    expect(s[0]!.map((p) => p.open)).toEqual([true, false, false]);
    expect(s[0]![1]!.hint).toEqual({ kind: "friend", n: 4 });
    expect(s[0]![2]!.hint).toEqual({ kind: "later" }); // only the next page says how
    expect(unreadPages(s)).toBe(1);
  });
  it("page 2 at friendship 2, page 3 once the set was completed (a cz bit — never closes)", () => {
    const r = rs({ momo: { movedIn: true, friendship: 2, points: 5 } });
    expect(storyState(r, [], [])[0]![2]!.hint).toEqual({ kind: "set" });
    expect(storyState(r, [setBit(idx("momo"))], [])[0]!.every((p) => p.open)).toBe(true);
  });
  it("read bits mark pages read; unread counts only open ones", () => {
    const r = rs({ momo: { movedIn: true, friendship: 2, points: 5 } });
    const s = storyState(r, [], [pageBit(0, 0)]);
    expect(s[0]!.map((p) => p.read)).toEqual([true, false, false]);
    expect(unreadPages(s)).toBe(1);
  });
  it("Wick's chapter: after 3 other chapters, all 6, then his own set", () => {
    const all = Object.fromEntries(RESIDENTS.map((r) => [r.id, { movedIn: true, friendship: 3, points: 9 }]));
    const sets = (ids: string[]): number[] => ids.map((id) => setBit(idx(id)));
    const wick = (cz: number[]): boolean[] => storyState(rs(all), cz, [])[6]!.map((p) => p.open);
    expect(wick(sets(["momo", "sage"]))).toEqual([false, false, false]);
    expect(wick(sets(["momo", "sage", "luna"]))).toEqual([true, false, false]);
    expect(wick(sets(["momo", "sage", "luna", "pip", "kuri", "yuki"]))).toEqual([true, true, false]);
    expect(wick(sets(["momo", "sage", "luna", "pip", "kuri", "yuki", "wick"]))).toEqual([true, true, true]);
  });
});

describe("story text", () => {
  it("every locale has 7 titles and 21 pages, and the same UI placeholders as English", () => {
    const ph = (s: string): string[] => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const l of LANGS) {
      const t = STORY[l];
      for (const who of CHAPTERS) {
        expect(t.title[who].length, `${l} ${who}`).toBeGreaterThan(0);
        expect(t.pages[who]).toHaveLength(3);
        for (const p of t.pages[who]) expect(p.length, `${l} ${who}`).toBeGreaterThan(10);
      }
      for (const [k, v] of Object.entries(t.ui)) expect(ph(v), `${l}.${k}`).toEqual(ph(STORY.en.ui[k as keyof typeof t.ui]));
    }
  });
});
