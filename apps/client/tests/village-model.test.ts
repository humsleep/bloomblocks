// src/village/model.ts + catalog.ts + vstate.ts: the village rules (derived from progress, nothing
// goes down), the mail and letter rhythm, the cottage slots, and the synced `v` bit sets / rooms.
import { describe, expect, it } from "vitest";
import { ALL_PIECES, GIFT_SEQ, ITEMS, pieceBit, pieceOfBit, REQUESTS, RESIDENTS, STARTER } from "../src/village/catalog.ts";
import {
  autoSlot, cards, dayOf, decodeRoom, deliver, drops, emptyRoom, encodeRoom, eve, FLOOR_SLOTS, friendLevel, isoOfDay, jarProgress, jarsFilled, litDays, mails,
  MAILBOX_MAX, mailIdJar, overflow, owned, place, placedBits, reachable, removeAt, residents, roomOf, SLOTS, type VillageInput,
  activeRequests, fulfilled, itemOfBit, MARKET_ORDER, marketOffers, marketState, nextAsk, roomCategories, THANKS_BASE, visitors,
} from "../src/village/model.ts";
import { coversV, decodeBits, decodeV, emptyV, encodeBits, encodeV, mergeV, roomStamp, type VState } from "../src/village/vstate.ts";
import { prng } from "./helpers.ts";

const T0 = "2026-11-01";
const D = dayOf(T0);
const iso = (k: number): string => isoOfDay(D + k);
const inp = (over: Partial<VillageInput> & { pd?: number[]; ch?: number[]; lr?: number[] } = {}): VillageInput => {
  const v: VState = { ...emptyV(), ...(over.v ?? {}) };
  if (over.pd) v.pd = over.pd.map((k) => D + k);
  if (over.ch) v.ch = over.ch.map((k) => D + k);
  if (over.lr) v.lr = over.lr;
  return { cleared: over.cleared ?? { gentle: 0, deduce: 0 }, dailyDates: over.dailyDates ?? [], v, today: over.today ?? iso(0) };
};
const bit = (item: string, cw: string): number => pieceBit({ item: item as never, cw: cw as never });

describe("catalog", () => {
  it("24 items × 2–3 colourways (full village), stable indices, every piece reachable", () => {
    expect(ITEMS).toHaveLength(24);
    ITEMS.forEach((x, i) => expect(x.index).toBe(i));
    for (const x of ITEMS) expect(x.colorways.length >= 2 && x.colorways.length <= 3).toBe(true);
    expect(ALL_PIECES.length).toBe(ITEMS.reduce((n, x) => n + x.colorways.length, 0));
    expect(reachable()).toBe(true);
    for (const p of ALL_PIECES) expect(pieceOfBit(pieceBit(p))).toEqual(p);
    expect(pieceOfBit(255)).toBeNull();
    // the jar never repeats a piece before the catalog is through, and never sends a move-in gift
    expect(new Set(GIFT_SEQ.map(pieceBit)).size).toBe(GIFT_SEQ.length);
    // every piece comes exactly one way: a newcomer's move-in gift, the starter cottage, or a jar
    const ways = [...RESIDENTS.filter((r) => !r.host).map((r) => pieceBit(r.signature)), ...STARTER.map(pieceBit), ...GIFT_SEQ.map(pieceBit)];
    expect(new Set(ways).size).toBe(ways.length);
    expect(ways.length).toBe(ALL_PIECES.length);
    // Wick's lantern is part of the starter cottage
    expect(STARTER.map(pieceBit)).toContain(pieceBit(RESIDENTS[0]!.signature));
  });
  it("names: en + ko for every item, unique; the chair is named after its drawing (Reality v2)", () => {
    const en = ITEMS.map((x) => x.name.en);
    expect(new Set(en).size).toBe(24);
    for (const x of ITEMS) expect(x.name.ko.length).toBeGreaterThan(0);
    expect(en).toContain("Arched chair");
    expect(en).not.toContain("Round chair");
  });
  it("roster: Wick + Momo on day 0, then Sage 2, Luna 4, Pip 7, Kuri 10, Yuki 14 (owner, round 3)", () => {
    expect(RESIDENTS.map((r) => [r.id, r.moveIn])).toEqual([["wick", 0], ["momo", 0], ["sage", 2], ["luna", 4], ["pip", 7], ["kuri", 10], ["yuki", 14]]);
  });
});

describe("lit days, drops, jar", () => {
  it("lit days = board days ∪ daily days (≤ today), at least 1 for a pre-village player", () => {
    expect(litDays(inp())).toBe(0);
    expect(litDays(inp({ cleared: { gentle: 3, deduce: 0 } }))).toBe(1);
    expect(litDays(inp({ pd: [-3, -1, 0], dailyDates: [iso(-1), iso(-2)] }))).toBe(4);
    // tomorrow (a skewed clock elsewhere) does not count yet
    expect(litDays(inp({ pd: [0, 1], dailyDates: [iso(2)] }))).toBe(1);
  });
  it("drops: 1 per board, 3 per daily; jars fill every 3 (first 3) then every 6", () => {
    expect(drops(inp({ cleared: { gentle: 4, deduce: 2 }, dailyDates: [iso(0), iso(-1), iso(-1)] }))).toBe(12);
    expect([0, 2, 3, 8, 9, 14, 15, 21].map(jarsFilled)).toEqual([0, 0, 1, 2, 3, 3, 4, 5]);
    expect(jarProgress(4)).toEqual({ have: 1, size: 3 });
    expect(jarProgress(10)).toEqual({ have: 1, size: 6 });
    for (let d = 1; d < 200; d++) expect(jarsFilled(d)).toBeGreaterThanOrEqual(jarsFilled(d - 1));
  });
});

describe("residents and friendship", () => {
  it("move-ins by cumulative lit days; the next one is the eve silhouette", () => {
    const at = (n: number): string[] => residents(inp({ pd: Array.from({ length: n }, (_, i) => -i) })).filter((x) => x.movedIn).map((x) => x.r.id);
    expect(at(0)).toEqual(["wick", "momo"]);
    expect(at(1)).toEqual(["wick", "momo"]);
    expect(at(2)).toEqual(["wick", "momo", "sage"]);
    expect(at(4)).toEqual(["wick", "momo", "sage", "luna"]);
    expect(at(7)).toEqual(["wick", "momo", "sage", "luna", "pip"]);
    expect(at(10)).toContain("kuri");
    expect(at(13)).not.toContain("yuki");
    expect(at(14)).toEqual(["wick", "momo", "sage", "luna", "pip", "kuri", "yuki"]);
    expect(eve(inp({ pd: [0] }))?.id).toBe("sage");
    expect(eve(inp({ pd: [0, -1] }))).toBeNull(); // Luna needs 4
    expect(eve(inp({ pd: [0, -1, -2] }))?.id).toBe("luna");
  });
  it("friendship counts talk days since the move-in; levels 0/2/5/9/14/21", () => {
    expect([0, 1, 2, 4, 5, 9, 13, 14, 21, 99].map(friendLevel)).toEqual([0, 0, 1, 1, 2, 3, 3, 4, 5, 5]);
    // Sage moved in on the 2nd lit day (k = 1): talk days before that do not count for Sage
    const x = residents(inp({ pd: [0, 1], ch: [-5, 0, 1], today: iso(1) }));
    expect(x.find((r) => r.r.id === "wick")!.points).toBe(3);
    expect(x.find((r) => r.r.id === "sage")!.points).toBe(1);
  });
  it("no punishment: after a 30-day gap nothing went down", () => {
    const base = { cleared: { gentle: 30, deduce: 5 }, dailyDates: [iso(0), iso(1)], pd: [0, 1, 2, 3, 4, 5, 6, 7, 8], ch: [0, 1, 2, 3, 4, 5], lr: [0, 1, 2, 3, 4, 16, 17, 18] };
    const a = inp({ ...base, today: iso(8) });
    const b = inp({ ...base, today: iso(38) });
    expect(litDays(b)).toBe(litDays(a));
    expect(residents(b).map((r) => [r.movedIn, r.friendship])).toEqual(residents(a).map((r) => [r.movedIn, r.friendship]));
    expect([...owned(b)].sort()).toEqual([...owned(a)].sort());
    expect(drops(b)).toBe(drops(a));
  });
});

describe("mail", () => {
  it("day 0: Momo's move-in letter (Wick's lantern is already in the cottage); jars add gifts with stable ids; opened = owned", () => {
    const m0 = mails(inp());
    expect(m0.map((m) => [m.id, m.kind, m.sender])).toEqual([[1, "moveIn", "momo"]]);
    const m = mails(inp({ cleared: { gentle: 6, deduce: 0 }, lr: [1, mailIdJar(2)] }));
    expect(m.map((x) => x.id)).toEqual([1, 64, 65]);
    const own = owned(inp({ cleared: { gentle: 6, deduce: 0 }, lr: [1, mailIdJar(2)] }));
    expect(own).toEqual(new Set([...STARTER.map(pieceBit), bit("cushion", "rose"), pieceBit(GIFT_SEQ[1]!)]));
    // the starter pieces are owned from the first visit, nothing opened
    expect(owned(inp())).toEqual(new Set(STARTER.map(pieceBit)));
    // only residents with gift lines send jar gifts, round robin
    expect(mails(inp({ cleared: { gentle: 9, deduce: 0 }, pd: [0, -1] })).filter((x) => x.kind === "jar").map((x) => x.sender)).toEqual(["wick", "momo", "sage"]);
  });
  it("≤ 1 letter a day: the rest of that day's mail are tagged gifts; tomorrow's first is a letter", () => {
    const all = mails(inp({ cleared: { gentle: 6, deduce: 0 } }));
    const d0 = deliver(all, {}, D, null);
    // Momo's move-in letter first, both jars tagged
    expect(Object.entries(d0.known).filter(([, v]) => v.k === "letter").map(([k]) => k)).toEqual(["1"]);
    expect(d0.known["64"]!.k).toBe("tag");
    expect(d0.letterDay).toBe(D);
    // delivered mail keeps its kind; new mail tomorrow → a letter
    const more = mails(inp({ cleared: { gentle: 9, deduce: 0 } }));
    const d1 = deliver(more, d0.known, D + 1, d0.letterDay);
    expect(d1.known["66"]!.k).toBe("letter");
    expect(d1.known["65"]!.k).toBe("tag");
    // same day again: nothing new → unchanged
    expect(deliver(more, d1.known, D + 1, d1.letterDay)).toEqual(d1);
  });
  it("mailbox overflow files the oldest unread beyond 10", () => {
    const all = mails(inp({ cleared: { gentle: 9 + 6 * 20, deduce: 0 } }));
    const f = overflow(all);
    expect(all.filter((m) => !m.read).length - f.length).toBe(MAILBOX_MAX);
    expect(f[0]).toBe(1); // a newcomer's move-in letter is the oldest in delivery order
  });
});

describe("cottage room", () => {
  const own = new Set(ITEMS.flatMap((x) => x.colorways.map((cw) => bit(x.id, cw))));
  it("the cottage before its first edit: Wick's lantern, the pot, the tea table, the rug — front row free", () => {
    const r = roomOf(undefined);
    expect(r.slots[1]?.bit).toBe(bit("paperLantern", "cream"));
    expect(r.slots[7]?.bit).toBe(bit("teaTable", "cream"));
    expect(r.rug?.bit).toBe(bit("roundRug", "rose"));
    expect([10, 11, 12, 13, 14].every((k) => r.slots[k] === null)).toBe(true);
    expect(autoSlot(r, bit("cushion", "rose"))).toBe(12);
    expect(roomOf(encodeRoom(emptyRoom()))).toEqual(emptyRoom()); // an edited room stays as edited
  });
  it("18 slots, round trip through the 40-char code (flip, rug, wallpaper, floor)", () => {
    expect(SLOTS).toBe(18);
    let r = emptyRoom();
    r = place(r, 12, bit("archChair", "sage"), true)!;
    r = place(r, 15, bit("wallClock", "cream"))!;
    r = place(r, 0, bit("smallBed", "rose"))!;
    r = place(r, 0, bit("roundRug", "rose"))!; // rugs go to the rug layer
    r.wallpaper = 2;
    const s = encodeRoom(r);
    expect(s).toMatch(/^[0-9a-z]{40}$/);
    expect(decodeRoom(s)).toEqual(r);
    expect(placedBits(r).size).toBe(4);
  });
  it("rules: wall items on the wall, the bed takes two floor slots in a row, a piece goes in once", () => {
    const r0 = emptyRoom();
    expect(place(r0, 3, bit("wallClock", "cream"))).toBeNull();
    expect(place(r0, 16, bit("teapot", "rose"))).toBeNull();
    expect(place(r0, 4, bit("smallBed", "cream"))).toBeNull(); // no room to its right
    const bed = place(r0, 3, bit("smallBed", "cream"))!;
    expect(place(bed, 4, bit("teapot", "rose"))!.slots[3]).toBeNull(); // placing on its half replaces it
    const moved = place(bed, 8, bit("smallBed", "cream"))!; // same piece elsewhere: moves
    expect(moved.slots[3]).toBeNull();
    expect(moved.slots[8]?.bit).toBe(bit("smallBed", "cream"));
    expect(removeAt(moved, 9).slots[8]).toBeNull(); // tap the bed's right half → removes the bed
    // a decoded room with overlaps / wrong layers / duplicates is cleaned
    const bad = emptyRoom();
    bad.slots[3] = { bit: bit("smallBed", "cream"), flip: false };
    bad.slots[4] = { bit: bit("teapot", "rose"), flip: false };
    bad.slots[16] = { bit: bit("teapot", "rose"), flip: false };
    bad.slots[0] = { bit: bit("wallClock", "cream"), flip: false };
    const clean = decodeRoom(encodeRoom(bad));
    expect(clean.slots.filter(Boolean).length).toBe(1);
  });
  it("auto slot: front middle first, then outward; full → -1", () => {
    let r = emptyRoom();
    expect(autoSlot(r, bit("teapot", "rose"))).toBe(12);
    const floor = ITEMS.filter((x) => x.layer === "floor" && x.span === 1).flatMap((x) => x.colorways.map((cw) => bit(x.id, cw)));
    for (const b of floor.slice(0, FLOOR_SLOTS)) r = place(r, autoSlot(r, b), b)!;
    expect(autoSlot(r, floor[FLOOR_SLOTS]!)).toBe(-1);
    expect(autoSlot(r, bit("frame", "rose"))).toBe(16);
  });
  it("catalog cards: owned / placed / locked with the real source", () => {
    const r = place(emptyRoom(), 12, bit("cushion", "rose"))!;
    const cs = cards(new Set([bit("cushion", "rose")]), r);
    const cushion = cs.find((c) => c.item.id === "cushion")!;
    expect(cushion.cws[0]).toMatchObject({ cw: "rose", owned: true, placed: true, source: { kind: "resident", id: "momo" } });
    expect(cushion.cws[1]).toMatchObject({ cw: "cream", owned: false, source: { kind: "jar" } });
    expect(cs.find((c) => c.item.id === "teaTable")!.unlocked).toBe(false);
    expect(cards(own, r).every((c) => c.unlocked)).toBe(true);
  });
});

describe("v: bit sets, rooms, merge", () => {
  it("bit codec: runs and scattered members round trip; junk decodes to nothing", () => {
    const rnd = prng(7);
    for (let t = 0; t < 200; t++) {
      const n = Math.floor(rnd() * 60);
      const base = Math.floor(rnd() * 25_000);
      const xs = [...new Set(Array.from({ length: n }, () => base + Math.floor(rnd() * 400)))].sort((a, b) => a - b);
      expect(decodeBits(encodeBits(xs))).toEqual(xs);
    }
    expect(encodeBits([])).toBe("");
    for (const junk of [null, 3, "x", "1.2.%%", "zzzzzzzzz.1."]) expect(decodeBits(junk)).toEqual([]);
    // a year of days in a row costs a few bytes
    expect(encodeBits(Array.from({ length: 365 }, (_, i) => D + i)).length).toBeLessThan(12);
  });
  it("merge: OR of the bits, per-room LWW, commutative and idempotent", () => {
    const a: VState = { ...emptyV(), pd: [1, 2], lr: [0], r: { "0": { s: "0".repeat(40), n: 1, at: 100, dev: "aaaaaaaa" } } };
    const b: VState = { ...emptyV(), pd: [2, 3], u: [5], r: { "0": { s: "1".repeat(40), n: 2, at: 50, dev: "bbbbbbbb" }, "1": { s: "2".repeat(40), n: 1, at: 10, dev: "bbbbbbbb" } } };
    const ab = mergeV([a, b], 1000);
    expect(ab).toEqual(mergeV([b, a], 1000));
    expect(mergeV([ab, ab, a], 1000)).toEqual(ab);
    expect(ab.pd).toEqual([1, 2, 3]);
    expect(ab.r["0"]!.dev).toBe("bbbbbbbb"); // higher n wins although its clock was earlier
    expect(coversV(ab, a) && coversV(ab, b)).toBe(true);
    expect(coversV(a, ab)).toBe(false);
  });
  it("G7 clock regression: an edit after seeing another always wins, even with the clock set back", () => {
    // A edits at t = 10 000, B adopts it, then B's clock jumps back a day and B edits
    const A = { s: "a".repeat(40), ...roomStamp(undefined, 10_000), dev: "aaaaaaaa" };
    const seenByB = mergeV([{ ...emptyV(), r: { "0": A } }], 20_000).r["0"];
    const B = { s: "b".repeat(40), ...roomStamp(seenByB, 10_000 - 86_400_000), dev: "bbbbbbbb" };
    expect(B.at).toBeGreaterThan(A.at);
    const m = mergeV([{ ...emptyV(), r: { "0": A } }, { ...emptyV(), r: { "0": B } }], 20_000);
    expect(m.r["0"]!.s).toBe(B.s);
    // a device whose clock is a year ahead does not win forever: the next causal edit beats it
    const F = { s: "f".repeat(40), ...roomStamp(undefined, 10_000 + 365 * 86_400_000), dev: "ffffffff" };
    const seen = mergeV([{ ...emptyV(), r: { "0": F } }], 20_000).r["0"]; // clamped to now
    expect(seen!.at).toBe(20_000);
    const G = { s: "g".repeat(40), ...roomStamp(seen, 20_000), dev: "aaaaaaaa" };
    expect(mergeV([{ ...emptyV(), r: { "0": F } }, { ...emptyV(), r: { "0": G } }], 20_001).r["0"]!.s).toBe(G.s);
  });
  it("G7 fuzz: random devices with skewed / regressing clocks converge to the last causal edit", () => {
    const rnd = prng(42);
    for (let t = 0; t < 300; t++) {
      const devs = ["aaaaaaaa", "bbbbbbbb", "cccccccc"].map((dev) => ({ dev, skew: Math.floor((rnd() - 0.5) * 4e8), v: emptyV() }));
      let wall = 1_000_000_000;
      let last = "";
      for (let step = 0; step < 20; step++) {
        wall += Math.floor(rnd() * 3e6);
        const d = devs[Math.floor(rnd() * 3)]!;
        if (rnd() < 0.15) d.skew -= Math.floor(rnd() * 2e8); // the clock is set back
        // sync first (it saw everything so far), then edit: this edit must be the winner
        d.v = mergeV(devs.map((x) => x.v), wall);
        const s = Math.floor(rnd() * 36 ** 6).toString(36).padStart(40, "0");
        d.v.r["0"] = { s, ...roomStamp(d.v.r["0"], wall + d.skew), dev: d.dev };
        last = s;
        expect(mergeV(devs.map((x) => x.v), wall).r["0"]!.s).toBe(last);
      }
    }
  });
  it("wire: round trip; another device's room keeps its dev; junk is dropped", () => {
    const v: VState = { ...emptyV(), pd: [D, D + 1, D + 5], ch: [D], lr: [0, 1, 16, 18], u: [3], r: { "0": { s: encodeRoom(emptyRoom()), n: 3, at: 1_790_000_000_000, dev: "otherdev" } } };
    const w = encodeV(v, "mydevice1");
    expect(decodeV(JSON.parse(JSON.stringify(w)), "mydevice1")).toEqual(v);
    expect(encodeV(emptyV(), "x")).toBeNull();
    expect(decodeV({ pd: 5, r: [["0", "short", "1", "1"], ["x", "0".repeat(40), "1", "1"], 7] }, "d")).toEqual(emptyV());
  });
});

describe("requests (v.q: 2·id asked, 2·id+1 done)", () => {
  const room = (bits: number[]): ReturnType<typeof emptyRoom> => {
    let r = emptyRoom();
    for (const b of bits) r = place(r, autoSlot(r, b), b)!;
    return r;
  };
  it("one open per resident, ≤ 2 open in all, a category the cottage lacks first", () => {
    const base = inp({ pd: [0, -1, -2, -3] }); // Wick, Momo, Sage, Luna live here
    const w = nextAsk(base, "wick")!;
    expect(w.cat).toBe("lighting");
    // the cottage already has a light → Wick asks for a table first? no: it has the tea table too → the first one
    const withLight = nextAsk(base, "wick", roomCategories(room([bit("paperLantern", "cream")])))!;
    expect(withLight.cat).toBe("table");
    const v1 = { ...base, v: { ...base.v, q: [2 * w.id] } };
    expect(nextAsk(v1, "wick")).toBeNull(); // Wick's is open
    const m = nextAsk(v1, "momo")!;
    const v2 = { ...v1, v: { ...v1.v, q: [2 * w.id, 2 * m.id] } };
    expect(activeRequests(v2.v)).toHaveLength(2);
    expect(nextAsk(v2, "sage")).toBeNull(); // two open: Sage waits
    expect(nextAsk(inp(), "sage")).toBeNull(); // not moved in
  });
  it("a matching piece in the cottage fulfils it; the resident visits; a thank-you letter + piece; friendship +2", () => {
    const base = inp({ pd: [0, -1, -2] });
    const q = REQUESTS.find((r) => r.r === "momo" && r.cat === "seating")!;
    const v = { ...base.v, q: [2 * q.id] };
    const r = room([bit("archChair", "cream")]);
    expect(fulfilled(v, r).map((x) => x.id)).toEqual([q.id]);
    const done = { ...base, v: { ...v, q: [2 * q.id, 2 * q.id + 1] } };
    expect(activeRequests(done.v)).toEqual([]);
    expect(visitors(done.v, r)).toEqual([{ r: "momo", cat: "seating" }]);
    expect(visitors(done.v, emptyRoom())).toEqual([]); // the chair went away: Momo goes home
    const thanks = mails(done).find((m) => m.kind === "thanks")!;
    expect(thanks.id).toBe(THANKS_BASE + q.id);
    expect(itemOfBit(pieceBit(thanks.piece))!.cat).toBe("seating");
    const before = residents(base).find((x) => x.r.id === "momo")!.points;
    expect(residents(done).find((x) => x.r.id === "momo")!.points).toBe(before + 2);
  });
  it("14 requests (7 residents × 2 liked categories), ids stable", () => {
    expect(REQUESTS).toHaveLength(14);
    REQUESTS.forEach((q, i) => expect(q.id).toBe(i));
  });
});

describe("market (v.mk days, v.u pieces)", () => {
  it("three pieces a day, the same on every device, every piece comes around, no starter piece", () => {
    expect(marketOffers(D)).toEqual(marketOffers(D));
    expect(new Set(marketOffers(D).map(pieceBit)).size).toBe(3);
    const seen = new Set<number>();
    for (let d = 0; d < MARKET_ORDER.length; d++) for (const p of marketOffers(D + d)) seen.add(pieceBit(p));
    expect(seen.size).toBe(MARKET_ORDER.length);
    for (const s0 of STARTER) expect(seen.has(pieceBit(s0))).toBe(false);
  });
  it("locked until a board is lit today, open, done after today's pick; the pick is owned", () => {
    expect(marketState(inp())).toBe("locked");
    expect(marketState(inp({ pd: [0] }))).toBe("open");
    const p = marketOffers(D)[0]!;
    const after = inp({ pd: [0], v: { ...emptyV(), mk: [D], u: [pieceBit(p)] } as VState });
    after.v.pd = [D];
    expect(marketState(after)).toBe("done");
    expect(owned(after).has(pieceBit(p))).toBe(true);
    expect(marketState({ ...after, today: iso(1) })).toBe("locked"); // a new day
  });
});
