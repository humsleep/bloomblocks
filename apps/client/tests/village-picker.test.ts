// src/village/picker.ts on the shipped 1.0 line set (src/village/lines/*.json, built by
// scripts/village-lines.mjs from the narrative): priorities, no repeats, once-only lines,
// time bands, hemisphere seasons, friendship gating; plus the line files themselves.
import { describe, expect, it } from "vitest";
import en from "../src/village/lines/en.json";
import ko from "../src/village/lines/ko.json";
import { RESIDENTS, type ResidentId } from "../src/village/catalog.ts";
import {
  firstSnowSeason, hemisphereOf, type Line, pickHost, pickLine, type PickCtx, pickVisit, pushSeen, regionOf, seasonOf, timeBandOf,
} from "../src/village/picker.ts";

const LINES = en.lines as Line[];
const ALL = new Set<ResidentId>(RESIDENTS.map((r) => r.id));
const ctx = (over: Partial<PickCtx> = {}): PickCtx => ({
  day: 20_400, time: "dusk", season: null, movedIn: ALL, friendship: 0, solvedToday: false, hardToday: false, returning: false,
  puzzleTalkers: 0, puzzleSaid: false, tap: 0, talkToday: 0, seen: [], once: new Set(), ...over,
});

describe("line files", () => {
  it("in step with the narrative's source (docs/team/r2-village-lines.en.json): regenerate with scripts/village-lines.mjs", async () => {
    const { readFileSync } = await import("node:fs");
    const src = JSON.parse(readFileSync(new URL("../../../docs/team/r2-village-lines.en.json", import.meta.url), "utf8")) as { lines: Array<{ id: string; text: string; trigger: string }> };
    const byId = new Map(src.lines.map((l) => [l.id, l]));
    for (const l of LINES) {
      expect(byId.get(l.id)?.text, l.id).toBe(l.x);
      expect(byId.get(l.id)?.trigger, l.id).toBe(l.t);
    }
  });
  it("1.0 = the full village: every 1.0 line of the 7 residents, Korean for every one, all triggers", () => {
    expect(LINES.length).toBeGreaterThanOrEqual(190);
    expect(new Set(LINES.map((l) => l.r))).toEqual(ALL);
    for (const l of LINES) expect((ko.text as Record<string, string>)[l.id], l.id).toBeTruthy();
    const ts = new Set(LINES.map((l) => l.t));
    for (const t of ["season", "request.ask", "request.again", "request.visit", "letter.thanks", "event.first_snow"]) expect(ts.has(t), t).toBe(true);
    expect(new Set(LINES.filter((l) => l.t === "greet" && l.c?.time).map((l) => l.c!.time))).toEqual(new Set(["dawn", "day", "dusk", "night"]));
    for (const ev of ["marketOpen", "marketPicked", "marketLocked", "seasonChanged", "postcardTaken"]) expect(pickHost(LINES, ev, new Set()), ev).not.toBeNull();
  });
  it("narrative lint: no guilt / pressure words, ≤ 2 catchphrases, length limits (en ≤ 60, ko ≤ 32 per letter line)", () => {
    const banned = /missed you|where were you|why didn't|hurry|last chance|don't forget|finally|you left/i;
    for (const l of LINES) {
      expect(banned.test(l.x), l.id).toBe(false);
      expect((l.x.match(/\{cp\}/g) ?? []).length).toBeLessThanOrEqual(2);
      for (const part of l.x.split("\n")) expect(part.replaceAll("{cp}", "Twinkle").length, l.id).toBeLessThanOrEqual(l.t === "gift.tag" ? 30 : 64);
      for (const part of (ko.text as Record<string, string>)[l.id]!.split("\n")) expect(part.length, l.id).toBeLessThanOrEqual(34);
    }
  });
  it('Korean: no "당신" (Reality G1 §3 — reads cold / confrontational; drop the subject or say 이웃님)', () => {
    for (const l of LINES) expect((ko.text as Record<string, string>)[l.id], l.id).not.toContain("당신");
  });
  it("every 1.0 gift sender has letter.gift and gift.tag lines; every resident a move-in letter", () => {
    for (const r of RESIDENTS) {
      expect(LINES.some((l) => l.r === r.id && l.t === "letter.move_in"), r.id).toBe(true);
      if (r.giftSender) for (const t of ["letter.gift", "gift.tag"]) expect(LINES.some((l) => l.r === r.id && l.t === t), `${r.id} ${t}`).toBe(true);
    }
  });
});

describe("time and season", () => {
  it("bands: dawn 05–09 · day 09–17 · dusk 17–21 · night 21–05", () => {
    expect([4, 5, 8, 9, 16, 17, 20, 21, 0].map(timeBandOf)).toEqual(["night", "dawn", "dawn", "day", "day", "dusk", "dusk", "night", "night"]);
  });
  it("hemisphere from the device region; seasons flip in the south", () => {
    expect(hemisphereOf(regionOf("en-NZ"))).toBe("south");
    expect(hemisphereOf(regionOf("pt-BR"))).toBe("south");
    expect(hemisphereOf(regionOf("en-IE"))).toBe("north");
    expect(hemisphereOf(regionOf("zh-Hant-TW"))).toBe("north");
    expect(hemisphereOf(null)).toBe("north");
    expect([1, 4, 7, 10].map((m) => seasonOf(m, "north"))).toEqual(["winter", "spring", "summer", "autumn"]);
    expect([1, 4, 7, 10].map((m) => seasonOf(m, "south"))).toEqual(["summer", "autumn", "winter", "spring"]);
  });
});

describe("picker", () => {
  it("move-in lines first, once each, in order; then the rest", () => {
    const a = pickLine(LINES, "momo", ctx())!;
    expect(a.line.id).toBe("momo.move_in.01");
    const b = pickLine(LINES, "momo", ctx({ tap: 1, after: a.trigger, once: new Set([a.consume!]) }))!;
    expect(b.line.id).toBe("momo.move_in.02");
    const c = pickLine(LINES, "momo", ctx({ once: new Set([a.consume!, b.consume!]) }))!;
    expect(c.trigger).toBe("greet");
  });
  it("tap 2 moves past tap 1's trigger; tap 3 = tap.again; tap 4 = nothing (only a smile)", () => {
    const once = new Set(["move_in:wick.move_in.01", "move_in:wick.move_in.02"]);
    const t1 = pickLine(LINES, "wick", ctx({ once, solvedToday: true }))!;
    expect(t1.trigger).toBe("puzzle.solved");
    const t2 = pickLine(LINES, "wick", ctx({ once, solvedToday: true, tap: 1, after: t1.trigger }))!;
    expect(t2.trigger).toBe("greet");
    expect(pickLine(LINES, "wick", ctx({ once, tap: 2 }))!.trigger).toBe("tap.again");
    expect(pickLine(LINES, "wick", ctx({ once, tap: 3 }))).toBeNull();
    // after tap.again: a smile
    expect(pickLine(LINES, "luna", ctx({ tap: 3 }))).toBeNull();
  });
  it("puzzle lines: only for the first two residents talked to today", () => {
    const once = new Set(LINES.filter((l) => l.t === "move_in").map((l) => `move_in:${l.id}`));
    expect(pickLine(LINES, "sage", ctx({ once, solvedToday: true, puzzleTalkers: 1 }))!.trigger).toBe("puzzle.solved");
    expect(pickLine(LINES, "sage", ctx({ once, solvedToday: true, puzzleTalkers: 2 }))!.trigger).toBe("greet");
    expect(pickLine(LINES, "sage", ctx({ once, solvedToday: true, puzzleSaid: true }))!.trigger).toBe("greet");
  });
  it("deterministic: same day + talk index → same line; no repeat within the window", () => {
    const once = new Set(LINES.filter((l) => l.t === "move_in").map((l) => `move_in:${l.id}`));
    const x = ctx({ once, friendship: 3 });
    expect(pickLine(LINES, "wick", x)).toEqual(pickLine(LINES, "wick", x));
    // over many days, the same greeting never comes twice in a row
    let seen: string[] = [];
    for (let d = 0; d < 60; d++) {
      const p = pickLine(LINES, "wick", { ...x, day: 20_000 + d, seen, once: new Set([...once, "friend:wick.friend.level.01", "friend:wick.friend.level.02"]) })!;
      expect(seen.at(-1)).not.toBe(p.line.id);
      seen = pushSeen(seen, p.line.id);
      expect(seen.length).toBeLessThanOrEqual(8);
    }
  });
  it("friendship gates the level lines and the minLevel greeting", () => {
    const once = new Set(LINES.filter((l) => l.t === "move_in").map((l) => `move_in:${l.id}`));
    expect(pickLine(LINES, "sage", ctx({ once, friendship: 2 }))!.trigger).toBe("greet");
    const f3 = pickLine(LINES, "sage", ctx({ once, friendship: 3 }))!;
    expect(f3.trigger).toBe("friend.level");
    expect(f3.line.c?.level).toBe(3);
    const f5 = pickLine(LINES, "sage", ctx({ once: new Set([...once, f3.consume!]), friendship: 5 }))!;
    expect(f5.line.c?.level).toBe(5);
    // minLevel 2 greetings never show below level 2
    for (let d = 0; d < 40; d++) {
      const p = pickLine(LINES, "momo", ctx({ once, day: 20_000 + d, friendship: 1 }))!;
      expect(p.line.c?.minLevel ?? 0).toBeLessThanOrEqual(1);
    }
  });
  it("returning after a gap: the return line once that visit, never a guilt line", () => {
    const once = new Set(LINES.filter((l) => l.t === "move_in").map((l) => `move_in:${l.id}`));
    const p = pickLine(LINES, "momo", ctx({ once, returning: true }))!;
    expect(p.trigger).toBe("return");
    expect(pickLine(LINES, "momo", ctx({ once: new Set([...once, p.consume!]), returning: true }))!.trigger).not.toBe("return");
  });
  it("time-band greetings follow the band (1.1 data: a night-only line is never picked at dusk)", () => {
    const extra: Line[] = [...LINES, { id: "wick.greet.night", r: "wick", t: "greet", c: { time: "night" }, x: "Night." }];
    const once = new Set(LINES.filter((l) => l.t === "move_in").map((l) => `move_in:${l.id}`));
    for (let d = 0; d < 30; d++) expect(pickLine(extra, "wick", ctx({ once, day: d }))!.line.id).not.toBe("wick.greet.night");
    let night = 0;
    for (let d = 0; d < 30; d++) if (pickLine(extra, "wick", ctx({ once, day: d, time: "night" }))!.line.id === "wick.greet.night") night++;
    expect(night).toBeGreaterThan(0);
  });
  it("host: first-visit lines once each in order; news lines repeat", () => {
    const a = pickHost(LINES, "firstVillageVisit", new Set())!;
    const b = pickHost(LINES, "firstVillageVisit", new Set([a.consume!]))!;
    expect([a.line.id, b.line.id]).toEqual(["wick.host.01", "wick.host.02"]);
    expect(pickHost(LINES, "firstVillageVisit", new Set([a.consume!, b.consume!]))).toBeNull();
    expect(pickHost(LINES, "mailWaiting", new Set(["x"]))!.line.id).toBe("wick.host.03");
    expect(pickHost(LINES, "noSuchEvent", new Set())).toBeNull();
  });
  it("requests: ask for the open category, again only on a later day, never two at once", () => {
    const once = new Set(LINES.filter((l) => l.t === "move_in").map((l) => `move_in:${l.id}`));
    const a = pickLine(LINES, "sage", ctx({ once, ask: { cat: "rug" } }))!;
    expect(a.trigger).toBe("request.ask");
    expect(a.line.c?.category).toBe("rug");
    const again = pickLine(LINES, "sage", ctx({ once, open: { cat: "rug", again: true } }))!;
    expect(again.trigger).toBe("request.again");
    expect(pickLine(LINES, "sage", ctx({ once, open: { cat: "rug", again: false } }))!.trigger).not.toMatch(/^request/);
    expect(pickVisit(LINES, "sage")!.line.t).toBe("request.visit");
  });
  it("first snow: Yuki says it once a year; seasons pick their own lines", () => {
    const once = new Set(LINES.filter((l) => l.t === "move_in").map((l) => `move_in:${l.id}`));
    const p = pickLine(LINES, "yuki", ctx({ once, firstSnow: true }))!;
    expect(p.trigger).toBe("event.first_snow");
    expect(pickLine(LINES, "yuki", ctx({ once: new Set([...once, p.consume!]), firstSnow: true }))!.trigger).not.toBe("event.first_snow");
    expect(firstSnowSeason(12, "north")).toBe(true);
    expect(firstSnowSeason(6, "south")).toBe(true);
    // a season line only for its season
    for (let d = 0; d < 20; d++) {
      const x = pickLine(LINES, "kuri", ctx({ once, day: d, season: "autumn", tap: 1, after: "greet" }));
      if (x?.trigger === "season") expect(x.line.c?.season).toBe("autumn");
    }
  });
});
