// src/sync/model.ts: the merge (commutative, idempotent, monotonic — progress, dates and the
// streak shown today never go down), same daily on two devices → one record (earliest wins),
// clock skew, the wire form (round trip, size budget, trimming order), and random two- / three-
// device histories with offline periods and skewed clocks that must converge.
import { describe, expect, it } from "vitest";
import { betterRec, cleanRec, type DayRec, liveStreak, stepStreak, type StreakState, streakFromDates } from "../src/game/daily.ts";
import { isoDay, isoFromDay, type Track } from "../src/game/pipsApi.ts";
import {
  byteLength, decodeSnapshot, emptyState, encodeSnapshot, type JournalRec, MAX_BYTES, mergeStates, mergeStreak, planEmpty, planFor, type Snapshot, type SyncState,
  TRACK_LIST,
} from "../src/sync/model.ts";
import { prng } from "./helpers.ts";

const DAY = 86_400_000;
const D0 = isoDay("2026-10-01");
const dateOf = (k: number): string => isoFromDay(D0 + k);
/** ms of local noon on day k (the model only needs a consistent "now" per date) */
const noon = (k: number): number => Date.UTC(2026, 9, 1 + k, 12);
const todayOf = (now: number): string => isoFromDay(D0 + Math.floor((now - Date.UTC(2026, 9, 1)) / DAY));

function snap(dev: string, over: Partial<SyncState> = {}, at = noon(0)): Snapshot {
  return { ...emptyState(), dev, at, ...over };
}
const rec = (at: number, ms = 60_000, hints = 0, undos = 0): DayRec => cleanRec({ at, ms, hints, undos });
/** a device's streak + log after counting these days (in order, like recordCompletion) */
function played(days: number[], ms = 60_000): Pick<SyncState, "s" | "d"> {
  let s: StreakState = { v: 1, last: null, streak: 0, best: 0, shields: {} };
  const d: Record<string, DayRec> = {};
  for (const k of days) {
    const date = dateOf(k);
    const next = stepStreak(s, date);
    if (next === s && s.last !== date) continue;
    s = next;
    d[date] = d[date] ? betterRec(d[date]!, rec(noon(k), ms)) : rec(noon(k), ms);
  }
  return { s, d };
}
const norm = (x: SyncState): unknown => JSON.parse(JSON.stringify({ ...x, d: Object.fromEntries(Object.entries(x.d).sort()) }));

describe("merge rules", () => {
  it("progress per track = max of level / cleared / hints", () => {
    const a = snap("a", { p: { gentle: { level: 12, cleared: 11, hints: 3 }, deduce: { level: 2, cleared: 1, hints: 9 } } });
    const b = snap("b", { p: { gentle: { level: 9, cleared: 8, hints: 5 }, deduce: { level: 4, cleared: 3, hints: 0 } } });
    expect(mergeStates([a, b], dateOf(0), noon(0)).p).toEqual({ gentle: { level: 12, cleared: 11, hints: 5 }, deduce: { level: 4, cleared: 3, hints: 9 } });
  });

  it("the same daily solved on two devices → one record, the earliest wins (tie: the smaller time played)", () => {
    const a = snap("a", { d: { [dateOf(3)]: rec(noon(3) + 5_000, 90_000, 1) } });
    const b = snap("b", { d: { [dateOf(3)]: rec(noon(3), 300_000) } });
    const m = mergeStates([a, b], dateOf(3), noon(3) + DAY / 4);
    expect(Object.keys(m.d)).toEqual([dateOf(3)]);
    expect(m.d[dateOf(3)]).toEqual(rec(noon(3), 300_000));
    const c = snap("c", { d: { [dateOf(3)]: rec(noon(3), 120_000) } });
    expect(mergeStates([a, b, c], dateOf(3), noon(4)).d[dateOf(3)]).toEqual(rec(noon(3), 120_000));
    // a record recovered without a time (migration) loses to any timed one
    const old = snap("o", { d: { [dateOf(3)]: cleanRec(null) } });
    expect(mergeStates([old, a], dateOf(3), noon(4)).d[dateOf(3)]).toEqual(a.d[dateOf(3)]);
  });

  it("days 1–3 on A, 4–5 on B → streak 5 on both (recomputed from the union of dates)", () => {
    const a = snap("a", played([1, 2, 3]));
    const b = snap("b", played([4, 5]));
    for (const xs of [[a, b], [b, a]]) {
      const m = mergeStates(xs, dateOf(5), noon(5));
      expect(m.s).toMatchObject({ last: dateOf(5), streak: 5, best: 5 });
      expect(liveStreak(m.s, dateOf(5))).toBe(5);
    }
  });

  it("shields are spent by the union's missed days only", () => {
    // A played 1, 2; B played 5 (3 and 4 missed: both October shields)
    const m = mergeStates([snap("a", played([1, 2])), snap("b", played([5]))], dateOf(5), noon(5));
    expect(m.s).toMatchObject({ streak: 3, shields: { "2026-10": 2 } });
    expect(m.s).toEqual(streakFromDates([dateOf(1), dateOf(2), dateOf(5)]));
  });

  it("monotonic even where the greedy shield rule is not: filling a gap never lowers the streak shown", () => {
    // device A alone: 1, [2 3 4 missed → break], 5, [6 7 covered], 8 → streak 2 on day 8
    const a = snap("a", played([1, 5, 8]));
    expect(liveStreak(a.s, dateOf(8))).toBe(2);
    // device B played day 3: the union 1, 3, 5, 8 recomputed spends both shields on 2 and 4 → 1
    const b = snap("b", played([3]));
    expect(streakFromDates([1, 3, 5, 8].map(dateOf)).streak).toBe(1);
    const m = mergeStates([a, b], dateOf(8), noon(8));
    expect(liveStreak(m.s, dateOf(8))).toBe(2); // A's own run competes and wins
    expect(Object.keys(m.d)).toEqual([1, 3, 5, 8].map(dateOf));
  });

  it("best = max; a streak state is never lost to an empty remote (an empty remote is not a reset)", () => {
    const a = snap("a", { ...played([1, 2, 3]), s: { ...played([1, 2, 3]).s, best: 40 } });
    const empty = snap("fresh");
    const m = mergeStates([empty, a], dateOf(3), noon(3));
    expect(m.s).toMatchObject({ streak: 3, best: 40 });
    expect(m.p).toEqual(a.p);
    expect(planEmpty(planFor(a, m))).toBe(true);
  });

  it("clock skew: future timestamps clamp to now; a future date counts once it has arrived", () => {
    const ahead = snap("x", { d: { [dateOf(9)]: rec(noon(9)) }, st: { numbers: { v: "dots", at: noon(9), dev: "x" } } }, noon(9));
    const here = snap("y", { ...played([6, 7]), st: { numbers: { v: "digits", at: noon(7) - 1, dev: "y" } } });
    const m = mergeStates([ahead, here], dateOf(7), noon(7));
    expect(m.d[dateOf(9)]!.at).toBe(noon(7));
    expect(m.st.numbers).toEqual({ v: "dots", at: noon(7), dev: "x" });
    expect(m.s).toMatchObject({ last: dateOf(7), streak: 2 }); // day 9 is still in the future here
    expect(mergeStates([ahead, here], dateOf(9), noon(9)).s).toMatchObject({ last: dateOf(9), streak: 3, shields: { "2026-10": 1 } });
  });

  it("settings: last writer wins by (time, device); guide and shield-intro bits are OR'd", () => {
    const a = snap("a", { st: { numbers: { v: "dots", at: 5, dev: "a" }, shareTime: { v: "0", at: 9, dev: "a" } }, g: 1 | 16, si: false });
    const b = snap("b", { st: { numbers: { v: "digits", at: 7, dev: "b" }, shareTime: { v: "1", at: 9, dev: "b" } }, g: 128, si: true });
    const m = mergeStates([a, b], dateOf(0), noon(0));
    expect(m.st).toEqual({ numbers: { v: "digits", at: 7, dev: "b" }, shareTime: { v: "1", at: 9, dev: "b" } });
    expect(m.g).toBe(1 | 16 | 128);
    expect(m.si).toBe(true);
    const plan = planFor(a, m);
    expect(plan.settings).toEqual({ numbers: m.st.numbers, shareTime: m.st.shareTime });
    expect(plan.guide).toBe(128);
    expect(plan.shieldIntro).toBe(true);
  });

  it("journals: only for the merged level, newest (time, device) first; a solved level's journal is dropped", () => {
    const j = (dev: string, n: number, at: number, l = "0a12345678"): JournalRec => ({ t: "gentle", n, l, at, dev });
    const a = snap("a", { p: { ...emptyState().p, gentle: { level: 5, cleared: 4, hints: 0 } }, j: [j("a", 5, 100)] });
    const b = snap("b", { p: { ...emptyState().p, gentle: { level: 5, cleared: 4, hints: 0 } }, j: [j("b", 5, 200, "0b9abcdef00c12345678")] });
    const m = mergeStates([a, b], dateOf(0), noon(0));
    expect(m.j.map((r) => r.dev)).toEqual(["b", "a"]);
    expect(planFor(a, m).journals.gentle?.map((r) => r.dev)).toEqual(["b"]);
    expect(planFor(b, m).journals.gentle).toBeUndefined(); // b's own is the newest: local wins
    const c = snap("c", { p: { ...emptyState().p, gentle: { level: 6, cleared: 5, hints: 0 } } });
    expect(mergeStates([a, b, c], dateOf(0), noon(0)).j).toEqual([]);
  });
});

describe("wire form", () => {
  const full = (dev: string, years: number, journals = 2): Snapshot => {
    const days: number[] = [];
    for (let k = -365 * years; k <= 0; k++) days.push(k);
    const s = snap(dev, {
      ...played(days, 123_456),
      p: { gentle: { level: 1825, cleared: 1824, hints: 999 }, deduce: { level: 900, cleared: 899, hints: 77 } },
      j: TRACK_LIST.slice(0, journals).map((t: Track, i) => ({ t, n: t === "gentle" ? 1825 : 900, l: "0a12345678".repeat(40 + i), at: noon(0) - i, dev })),
      st: { numbers: { v: "dots", at: noon(-3), dev }, shareTime: { v: "0", at: noon(-9), dev } },
      g: 255,
      si: true,
    });
    for (const d of Object.keys(s.d)) s.d[d] = rec(isoDay(d) * DAY + 3_600_000, 61_000 + (isoDay(d) % 97) * 1000, isoDay(d) % 3, isoDay(d) % 5);
    return s;
  };

  it("round trip: decode(encode(x)) = x", () => {
    for (const x of [full("aaaaaaaa1", 1), snap("bbbbbbbb2"), snap("c0000000c", played([1, 2, 9, 30]))]) {
      const back = decodeSnapshot(encodeSnapshot(x))!;
      expect(norm(back)).toEqual(norm(x));
    }
  });

  it("typical size (three months, both journals) < 10 KB", () => {
    const days = Array.from({ length: 90 }, (_, i) => i);
    const s = snap("dev0000001", { ...played(days), j: [{ t: "gentle", n: 40, l: "0a12345678".repeat(30), at: 1, dev: "dev0000001" }, { t: "deduce", n: 12, l: "1b12345678".repeat(30), at: 2, dev: "dev0000001" }] });
    expect(byteLength(encodeSnapshot(s))).toBeLessThan(10 * 1024);
  });

  it("5 devices × 5 years: every key < 64 KB, nothing lost but trimmed details, the merge restores everything", () => {
    const devs = ["d1aaaaaa", "d2bbbbbb", "d3cccccc", "d4dddddd", "d5eeeeee"].map((d) => full(d, 5));
    const texts = devs.map((d) => encodeSnapshot(d));
    for (const t of texts) expect(byteLength(t)).toBeLessThan(MAX_BYTES);
    const back = texts.map((t) => decodeSnapshot(t)!);
    const m = mergeStates(back, dateOf(0), noon(0));
    expect(Object.keys(m.d)).toEqual(Object.keys(devs[0]!.d).sort());
    expect(m.s).toEqual(mergeStates(devs, dateOf(0), noon(0)).s);
    expect(m.s.streak).toBe(365 * 5 + 1);
    // the merged state written as one device's key also fits
    expect(byteLength(encodeSnapshot({ ...m, dev: "merged00", at: noon(0) }))).toBeLessThan(MAX_BYTES);
  });

  it("over budget: the oldest journal goes first, then the oldest days' details — never a date", () => {
    const x = full("trimdev01", 5);
    expect(byteLength(encodeSnapshot(x))).toBeGreaterThan(24 * 1024);
    const t1 = encodeSnapshot(x, 20 * 1024);
    expect(byteLength(t1)).toBeLessThanOrEqual(20 * 1024);
    const b1 = decodeSnapshot(t1)!;
    expect(Object.keys(b1.d)).toEqual(Object.keys(x.d).sort());
    expect(b1.j.length).toBe(0);
    const newest = Object.keys(x.d).sort().at(-1)!;
    expect(b1.d[newest]).toEqual(x.d[newest]); // recent details kept
    const oldest = Object.keys(x.d).sort()[0]!;
    expect(b1.d[oldest]).toEqual(cleanRec(null));
    // a light trim drops only the older journal
    const big = encodeSnapshot(x);
    const t2 = encodeSnapshot(x, byteLength(big) - 50);
    expect(decodeSnapshot(t2)!.j.map((r) => r.t)).toEqual(["gentle"]);
    expect(byteLength(encodeSnapshot(x, 4 * 1024))).toBeLessThan(4 * 1024);
  });

  it("garbage never throws", () => {
    for (const t of ["", "{", "null", "[]", JSON.stringify({ v: 2 }), JSON.stringify({ v: 1, dev: "x", p: [1] }), JSON.stringify({ v: 1, dev: "x", p: [1, 0, 0, 1, 0, 0], d: { o: "x", b: "!!" } })]) {
      expect(() => decodeSnapshot(t)).not.toThrow();
    }
    expect(decodeSnapshot(JSON.stringify({ v: 1, dev: "x", at: 1, p: [3, 2, 0, 1, 0, 0], d: { o: "2026-10-01", b: "%%%", r: "" } }))).toBeNull();
  });
});

// ---------------------------------------------------------------- property / fuzz

interface SimDev {
  id: string;
  skew: number;
  state: Snapshot;
  /** days offline (no reads, no writes) */
  offline: boolean;
}

/** One device applies a merge the way local.ts does (merged progress / log / streak / settings; its own identity). */
function adopt(d: SimDev, m: SyncState, now: number): void {
  const st: Snapshot["st"] = {};
  for (const [k, v] of Object.entries(m.st)) st[k as keyof Snapshot["st"]] = { ...v!, dev: v!.dev };
  d.state = { ...d.state, p: structuredClone(m.p), s: structuredClone(m.s), d: structuredClone(m.d), st, g: m.g, si: m.si, j: d.state.j.filter((r) => r.n === m.p[r.t].level), at: now };
}

function checkMerge(xs: SyncState[], today: string, now: number, rnd: () => number): SyncState {
  const m = mergeStates(xs, today, now);
  // commutative
  const shuffled = [...xs].sort(() => rnd() - 0.5);
  expect(norm(mergeStates(shuffled, today, now))).toEqual(norm(m));
  // idempotent (and absorbing its inputs)
  expect(norm(mergeStates([m], today, now))).toEqual(norm(m));
  expect(norm(mergeStates([m, m], today, now))).toEqual(norm(m));
  expect(norm(mergeStates([...xs, m], today, now))).toEqual(norm(m));
  // monotonic: nothing an input had is lost, the streak shown today never goes down
  for (const x of xs) {
    for (const t of TRACK_LIST) {
      expect(m.p[t].level).toBeGreaterThanOrEqual(x.p[t].level);
      expect(m.p[t].cleared).toBeGreaterThanOrEqual(x.p[t].cleared);
    }
    for (const d of Object.keys(x.d)) expect(m.d[d]).toBeDefined();
    if (!x.s.last || x.s.last <= today) {
      expect(liveStreak(m.s, today)).toBeGreaterThanOrEqual(liveStreak(x.s, today));
      expect(m.s.best).toBeGreaterThanOrEqual(x.s.best);
    }
  }
  // one record per date: the earliest (clamped) time any input had
  for (const [d, r] of Object.entries(m.d)) {
    const ats = xs.map((x) => x.d[d]?.at).filter((a): a is number => a !== undefined && a > 0).map((a) => Math.min(a, Math.floor(now / 1000) * 1000));
    if (ats.length) expect(r.at).toBe(Math.min(...ats));
  }
  return m;
}

function simulate(seed: number, nDev: number, days: number): void {
  const rnd = prng(seed);
  const devs: SimDev[] = Array.from({ length: nDev }, (_, i) => ({
    id: `dev${i}${seed.toString(36)}`,
    // skewed clocks: up to ±36 h on the later devices
    skew: i === 0 ? 0 : Math.round((rnd() - 0.5) * 3 * DAY),
    state: snap(`dev${i}${seed.toString(36)}`),
    offline: false,
  }));
  const cloud = new Map<string, Snapshot>();
  for (let day = 0; day < days; day++) {
    for (const d of devs) {
      if (rnd() < 0.15) d.offline = !d.offline; // offline stretches
      const now = noon(day) + d.skew + Math.round(rnd() * 6 * 3_600_000);
      const today = todayOf(now);
      // play
      if (rnd() < 0.6) {
        const s2 = stepStreak(d.state.s, today);
        if (s2 !== d.state.s) {
          d.state.s = s2;
          const r = rec(now, 30_000 + Math.floor(rnd() * 300) * 1000, rnd() < 0.2 ? 1 : 0);
          d.state.d[today] = d.state.d[today] ? betterRec(d.state.d[today]!, r) : r;
        }
      }
      if (rnd() < 0.5) {
        const t: Track = rnd() < 0.7 ? "gentle" : "deduce";
        const k = 1 + Math.floor(rnd() * 3);
        d.state.p[t] = { level: d.state.p[t].level + k, cleared: d.state.p[t].cleared + k, hints: d.state.p[t].hints + (rnd() < 0.3 ? 1 : 0) };
        d.state.j = d.state.j.filter((r) => r.t !== t);
        if (rnd() < 0.5) d.state.j.push({ t, n: d.state.p[t].level, l: "0c12345678".repeat(1 + Math.floor(rnd() * 5)), at: now, dev: d.id });
      }
      if (rnd() < 0.1) d.state.st.numbers = { v: rnd() < 0.5 ? "dots" : "digits", at: now, dev: d.id };
      if (rnd() < 0.05) d.state.g |= 1 << Math.floor(rnd() * 8);
      // sync
      if (d.offline) continue;
      cloud.set(d.id, decodeSnapshot(encodeSnapshot({ ...d.state, at: now }))!);
      const inputs = [d.state, ...[...cloud.values()].filter((x) => x.dev !== d.id)];
      const m = checkMerge(inputs, today, now, rnd);
      adopt(d, m, now);
    }
  }
  // everyone back online, clocks long past every skewed date: two rounds → one state
  const end = noon(days + 3);
  for (let round = 0; round < 2; round++) {
    for (const d of devs) {
      d.offline = false;
      cloud.set(d.id, decodeSnapshot(encodeSnapshot({ ...d.state, at: end }))!);
      const m = checkMerge([d.state, ...[...cloud.values()].filter((x) => x.dev !== d.id)], todayOf(end), end, rnd);
      adopt(d, m, end);
    }
  }
  const pick = (d: SimDev): unknown => norm({ ...emptyState(), p: d.state.p, s: d.state.s, d: d.state.d, st: Object.fromEntries(Object.entries(d.state.st).map(([k, v]) => [k, { v: v!.v, at: v!.at }])), g: d.state.g, si: d.state.si, j: [] });
  for (const d of devs.slice(1)) expect(pick(d)).toEqual(pick(devs[0]!));
  // and the converged streak is at least what the rules give the union of every device's dates
  const all = new Set(devs.flatMap((d) => Object.keys(d.state.d)));
  expect(liveStreak(devs[0]!.state.s, todayOf(end))).toBeGreaterThanOrEqual(liveStreak(streakFromDates(all), todayOf(end)));
}

describe("random multi-device histories (offline stretches, skewed clocks)", () => {
  for (let seed = 1; seed <= 12; seed++) it(`two devices, seed ${seed}`, () => simulate(seed, 2, 70));
  for (let seed = 101; seed <= 110; seed++) it(`three devices, seed ${seed}`, () => simulate(seed, 3, 70));

  it("mergeStreak over random date sets: monotonic in every candidate, recompute when nothing competes", () => {
    const rnd = prng(77);
    for (let i = 0; i < 300; i++) {
      const sets = Array.from({ length: 2 + Math.floor(rnd() * 2) }, () => [...Array(60).keys()].filter(() => rnd() < 0.55));
      const today = dateOf(60);
      const cands = sets.map((s) => played(s).s);
      const union = sets.flat().map(dateOf);
      const m = mergeStreak(cands, union, today);
      for (const c of cands) expect(liveStreak(m, today)).toBeGreaterThanOrEqual(liveStreak(c, today));
      expect(liveStreak(m, today)).toBeGreaterThanOrEqual(liveStreak(streakFromDates(union), today));
      expect(mergeStreak([], union, today)).toEqual(streakFromDates(union));
    }
  });
});
