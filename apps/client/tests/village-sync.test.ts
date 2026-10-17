// The village inside the iCloud snapshot (src/sync/model.ts `v` ↔ wire `vl`): gate G7 — the
// largest state fits in 2 KB, it is never trimmed, the merge is OR / per-room LWW and safe against
// a clock set back; older snapshots (no `vl`) still decode.
import { describe, expect, it } from "vitest";
import { ITEMS } from "../src/village/catalog.ts";
import { dayOf, emptyRoom, encodeRoom, place } from "../src/village/model.ts";
import { emptyV, encodeV, roomStamp, type VState } from "../src/village/vstate.ts";
import { byteLength, decodeSnapshot, emptyState, encodeSnapshot, mergeStates, planEmpty, planFor, type Snapshot } from "../src/sync/model.ts";

const D = dayOf("2026-11-01");
const NOW = Date.UTC(2027, 10, 1, 12);
const snap = (dev: string, v: VState, at = NOW): Snapshot => ({ ...emptyState(), dev, at, v });

/** Every room full (18 slots + rug), every bit set that 1.0–1.2 can set in a year. */
function maxV(): VState {
  let room = emptyRoom();
  const floor = ITEMS.filter((x) => x.layer === "floor" && x.span === 1).flatMap((x) => x.colorways.map((cw) => x.index * 4 + ["cream", "sage", "rose"].indexOf(cw)));
  for (let s = 0; s < 15; s++) room = place(room, s, floor[s]!)!;
  room = place(room, 15, 9 * 4)!;
  room = place(room, 16, 9 * 4 + 1)!;
  room = place(room, 17, 10 * 4)!;
  room = place(room, 0, 8 * 4 + 1)!;
  room.wallpaper = 2;
  room.floor = 2;
  const s = encodeRoom(room);
  // scattered days are the worst case for the run-length bit sets: every other day for two years
  const days = Array.from({ length: 365 }, (_, i) => D + 2 * i);
  const r: VState["r"] = {};
  for (let i = 0; i < 8; i++) r[String(i)] = { s, n: 9999, at: NOW, dev: `othrdev${i}` };
  return { pd: days, ch: days, mk: days, q: days, w: days, lr: Array.from({ length: 2000 }, (_, i) => 2 * i), u: Array.from({ length: 256 }, (_, i) => i), r };
}

describe("G7: village state in the KVS record", () => {
  it("the largest state serializes to ≤ 2 KB", () => {
    const v = maxV();
    const bytes = byteLength(JSON.stringify(encodeV(v, "mydevice1")));
    expect(bytes).toBeLessThanOrEqual(2048);
    // what a real heavy year looks like (days in a row, mail read in order, one room): far below
    const real: VState = { ...emptyV(), pd: Array.from({ length: 365 }, (_, i) => D + i), ch: Array.from({ length: 300 }, (_, i) => D + i), lr: Array.from({ length: 600 }, (_, i) => i), r: { "0": v.r["0"]! } };
    expect(byteLength(JSON.stringify(encodeV(real, "mydevice1")))).toBeLessThan(200);
  });

  it("round trip through the snapshot; `v` is kept when the budget forces trimming", () => {
    const v = maxV();
    const s = snap("mydevice1", v);
    const back = decodeSnapshot(encodeSnapshot(s))!;
    expect(back.v).toEqual(v);
    // a tiny budget trims journals / day details, never the village
    const tiny = decodeSnapshot(encodeSnapshot(s, 300))!;
    expect(tiny.v).toEqual(v);
    // the wire version key is untouched (older builds check w.v === 1)
    expect(JSON.parse(encodeSnapshot(s)).v).toBe(1);
  });

  it("an older snapshot (no vl) decodes with an empty village; an empty village adds no bytes", () => {
    const old = encodeSnapshot(snap("olddevice1", emptyV()));
    expect(old).not.toContain("vl");
    expect(decodeSnapshot(old)!.v).toEqual(emptyV());
  });

  it("mergeStates: bits OR'd, rooms by Lamport counter; the plan carries the village only when it changed", () => {
    const room = (ch: string, n: number, at: number, dev: string) => ({ s: ch.repeat(40), n, at, dev });
    const a = snap("devicea1", { ...emptyV(), pd: [D], lr: [0, 1], r: { "0": room("a", 1, NOW - 1000, "devicea1") } });
    const b = snap("deviceb1", { ...emptyV(), pd: [D + 1], ch: [D + 1], r: { "0": room("b", 2, NOW - 5000, "deviceb1") } });
    const m = mergeStates([a, b], "2027-11-01", NOW);
    expect(m.v.pd).toEqual([D, D + 1]);
    expect(m.v.lr).toEqual([0, 1]);
    expect(m.v.r["0"]!.s).toBe("b".repeat(40)); // b saw a's edit (n 2 > 1) although its clock is earlier
    expect(mergeStates([b, a], "2027-11-01", NOW)).toEqual(m);
    expect(planFor(a, m).v).toEqual(m.v);
    const same = mergeStates([a], "2027-11-01", NOW);
    const p = planFor(a, same);
    expect(p.v).toBeNull();
    expect(planEmpty(p)).toBe(true);
  });

  it("clock regression end to end: B adopts A's room, B's clock goes back a week, B's next edit still wins", () => {
    const a = snap("devicea1", { ...emptyV(), r: { "0": { s: "a".repeat(40), ...roomStamp(undefined, NOW), dev: "devicea1" } } });
    const seen = mergeStates([a], "2027-11-01", NOW).v.r["0"];
    const back = NOW - 7 * 86_400_000;
    const b = snap("deviceb1", { ...emptyV(), r: { "0": { s: "b".repeat(40), ...roomStamp(seen, back), dev: "deviceb1" } } }, back);
    for (const order of [[a, b], [b, a]]) {
      const text = order.map((x) => encodeSnapshot(x)).map((t) => decodeSnapshot(t)!);
      expect(mergeStates(text, "2027-11-01", NOW).v.r["0"]!.s).toBe("b".repeat(40));
    }
  });
});
