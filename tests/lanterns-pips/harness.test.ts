// Round-2 blind codes in the CLI harness (tools/play.ts) for the pips tracks.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as P from "../../games/lanterns-pips/index.ts";
import { CODES2_FILE, CODES_FILE, RULE_TEXT, type Variant, loadCodes, resolveVariant } from "../../tools/variantLevels.ts";
import { idx } from "./trackSuite.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const tsx = join(root, "node_modules", ".bin", "tsx");
const play = (...args: string[]): string => execFileSync(tsx, [join(root, "tools", "play.ts"), ...args], { cwd: root, encoding: "utf8" });
const name = (i: number): string => `${"ABCDEFGH"[i & 7]}${(i >> 3) + 1}`;
const RULE = "Light every cell. Lanterns can't see each other. A number on a rock = lanterns touching it.";

const codeFor = (v: Variant): string => {
  const hit = Object.entries(loadCodes(CODES2_FILE)).find(([, x]) => x === v);
  if (!hit) throw new Error(`no round-2 code for ${v}`);
  return hit[0];
};

describe("round-2 codes (playtest/variants2.json)", () => {
  it("Stuck line names the stuck cells and the one lantern to take back (the read-out's culprit)", { timeout: 60_000 }, () => {
    // Deduce levels under the PD code: find one or two lanterns (no conflict) that leave a dark
    // cell stuck; the line must read `Stuck: <cells> — take back <culprit>`.
    let g = P.generatedForTrack("deduce", 1);
    const with_ = (cells: number[]): P.PipsState => ({ ...P.initialState(g.level), lanterns: cells.reduce((b, c) => P.withBit(b, c, true), P.EMPTY) });
    let moves: number[] = [];
    let n = 0;
    while (moves.length === 0 && n < 20) {
      g = P.generatedForTrack("deduce", ++n);
      const floor = idx(P.floorMask(g.level));
      for (let i = 0; i < floor.length && moves.length === 0; i++) {
        for (let j = i; j < floor.length && moves.length === 0; j++) {
          const cells = i === j ? [floor[i]!] : [floor[i]!, floor[j]!];
          const a = P.analyzeBoard(g.level, with_(cells));
          if (a.conflicts.length === 0 && a.blocked.length > 0) moves = cells;
        }
      }
    }
    expect(moves.length).toBeGreaterThan(0);
    const file = join(mkdtempSync(join(tmpdir(), "lanternly-")), "s.json");
    play("new", "--variant", codeFor("PD"), "--index", String(n), "--out", file);
    let out = "";
    for (const c of moves) out = play("move", "-s", file, "-c", name(c));
    const st = with_(moves);
    const a = P.analyzeBoard(g.level, st, moves);
    expect(a.blocked.length).toBeGreaterThan(0);
    expect(a.culprit).not.toBeNull();
    const line = /\nStuck: (.*)\n/.exec(out)![1]!;
    expect(line).toContain(` — take back ${name(a.culprit!)}`);
    if (a.blocked.every((b) => b.culprits.includes(a.culprit!))) {
      expect(line).toBe(`${a.blocked.map((b) => name(b.cell)).join(", ")} — take back ${name(a.culprit!)}`);
    }
    // Every stuck cell is named once.
    for (const b of a.blocked) expect(line.split(name(b.cell)).length - 1).toBe(1);
  });

  const sessionDir = mkdtempSync(join(tmpdir(), "lanternly-"));
  const sessionWith = (rows: string[], lanterns: string[]): string => {
    const file = join(sessionDir, `${rows.join("")}-${lanterns.join("")}.json`.replace(/[#.]/g, "x"));
    const now = new Date().toISOString();
    writeFileSync(file, JSON.stringify({
      format: "lanternly-play-session/1", mode: "free", variant: codeFor("PG"), index: 1, date: null, seedKey: null, levelId: 1, tag: "x",
      level: { w: rows[0]!.length, h: rows.length, budget: null, rows }, lanterns, history: lanterns, complete: false, createdAt: now, completedAt: null, actions: [],
    }));
    return file;
  };
  const show = (rows: string[], lanterns: string[]): string => play("show", "-s", sessionWith(rows, lanterns));

  it("round-3 J-15 / W-4 states: the Stuck line names only the wrong lantern to take back", { timeout: 60_000 }, () => {
    expect(show(["......", "...#2.", "0.2#..", "1....#", "......", "1...#."], ["C2", "C4", "A5", "E1"])).toContain("Stuck: B3 — take back E1\n");
    expect(show(["..#1..", ".0#...", ".....#", "#.....", "...1#.", "..01.."], ["E6", "D4", "E1", "F5", "F2", "A1", "C3", "A5"]))
      .toContain("Stuck: B6 — take back A5\n");
  });

  it("round-4 J-16 / J-12 states: one culprit instead of five lanterns + three rocks; the ⊘ number gets its own line", { timeout: 60_000 }, () => {
    const j16 = show(["......0", ".......", "..0...1", ".......", "...2...", "..3#.#.", "...#1#0"], ["E6", "C5", "C7", "B6", "D4", "F3", "A1"]);
    expect(j16).toContain("\nStuck: C2, G2 — take back A1\n");
    expect(j16).not.toContain("light from");
    expect(j16).not.toContain("Stuck number:");
    const j12 = show(["......", "...3..", ".#....", "3..2..", "..1...", "....0#"], ["A3", "A5", "B4", "D1", "C2", "E2"]);
    expect(j12).toContain("\nStuck: none\nStuck number: D4 (2) — take back E2\n");
    expect(j12).toMatch(/D4 2⊘/);
    // Too many: the 2 at D4 with D3 E4 D5 → the wrong one (D5).
    expect(show(["......", "...3..", ".#....", "3..2..", "..1...", "....0#"], ["A3", "A5", "B4", "D3", "E4", "D5"])).toContain("Stuck number: D4 (2) — take back D5\n");
    // No wrong lantern to blame (a board with no solution): the short cause.
    expect(show([".0...", "0....", ".....", ".....", "....."], [])).toContain("\nStuck: A1 (rocks B1 A2)\n");
  });

  it("messages print first (above the board and legend): hints, notes, ILLEGAL", { timeout: 60_000 }, () => {
    const file = sessionWith(["......0", ".......", "..0...1", ".......", "...2...", "..3#.#.", "...#1#0"], ["E6", "C5", "C7", "B6", "D4", "F3", "A1"]);
    const h = play("hint", "-s", file);
    expect(h.split("\n")[0]).toBe("Take back the lantern at A1 (1 of 1)");
    expect(h.indexOf("Take back")).toBeLessThan(h.indexOf("Legend:"));
    const m = play("move", "-s", file, "-c", "A1");
    expect(m.split("\n")[0]).toBe("Removed the lantern at A1.");
    const ill = play("move", "-s", file, "-c", "D6");
    expect(ill.split("\n")[0]).toBe("ILLEGAL: D6 is a stone");
    const p = play("hint", "-s", file);
    expect(p.split("\n")[0]).toMatch(/^Hint: put a lantern at [A-G][1-7] — /);
  });

  it("daily: `new --mode daily --date … --variant <code>` plays the numbered-stone daily", { timeout: 60_000 }, () => {
    const dir = mkdtempSync(join(tmpdir(), "lanternly-"));
    const file = join(dir, "d.json");
    const out = play("new", "--mode", "daily", "--date", "2026-10-14", "--variant", codeFor("PG"), "--out", file);
    const lv = P.levelForDaily("2026-10-14");
    expect(out).toContain(`Duskwick ${codeFor("PG")} — daily 2026-10-14 · ${lv.w}×${lv.h}\n`);
    expect(out).toContain(RULE);
    const board = out.split("\n").filter((l) => /^ [1-8]  /.test(l)).map((l) => l.slice(4).replace(/ /g, "").replace(/·/g, "."));
    expect(board).toEqual(P.levelRows(lv));
    const f = JSON.parse(readFileSync(file, "utf8"));
    expect(f.mode).toBe("daily");
    expect(f.date).toBe("2026-10-14");
    expect(f.seedKey).toBeNull();
    expect(JSON.stringify(f)).not.toMatch(/pips|gentle|deduce|"PG"|"PD"/);
    // Same level for every numbered-stone code; plays to completion.
    const out2 = play("new", "--mode", "daily", "--date", "2026-10-14", "--variant", codeFor("PD"), "--out", join(dir, "e.json"));
    expect(out2.split("\n").filter((l) => /^ [1-8]  /.test(l))).toEqual(out.split("\n").filter((l) => /^ [1-8]  /.test(l)));
    let last = "";
    for (const c of idx(P.generatedForDaily("2026-10-14").meta.solution)) last = play("move", "-s", file, "-c", name(c));
    expect(last).toContain("COMPLETE");
    const refuse = (...args: string[]): string => {
      try {
        play(...args);
      } catch (e) {
        return String((e as { stderr?: string }).stderr ?? e);
      }
      return "";
    };
    expect(refuse("new", "--mode", "daily", "--date", "2026-10-14", "--variant", "N")).toContain("numbered-stone codes only");
    expect(refuse("new", "--mode", "daily", "--date", "2026-10-14", "--variant", "P", "--track", "gentle")).toContain("--track does not apply");
  });

  it("two fresh single-letter codes: one gentle, one deduce; none reused from round 1", () => {
    const codes = loadCodes(CODES2_FILE);
    expect(Object.values(codes).sort()).toEqual(["PD", "PG"]);
    const old = Object.keys(loadCodes(CODES_FILE));
    for (const k of Object.keys(codes)) {
      expect(k).toMatch(/^[A-Z]$/);
      expect([...old, "V", "C", "S", "N", "P", "E"]).not.toContain(k);
      expect(resolveVariant(k)).toBe(codes[k]);
    }
    expect(RULE_TEXT.PG).toBe(RULE);
    expect(RULE_TEXT.PD).toBe(RULE);
  });

  it("PLAYTEST.md documents the new read-out but does not reveal the code mapping", () => {
    const doc = readFileSync(join(root, "tools", "PLAYTEST.md"), "utf8");
    expect(doc).toContain(RULE);
    expect(doc).toContain("Stuck: B3 — take back A1");
    expect(doc).toContain("Stuck: C2, G2 — take back A1");
    expect(doc).toContain("Stuck number: D4 (2) — take back F2");
    expect(doc).toContain("Stuck: B3 (light from E1; rocks A3 C3)");
    expect(doc).toContain("Take back the lantern at B2 (1 of 3)");
    expect(doc).toContain("--mode daily --date");
    expect(doc).not.toMatch(/gentle|deduce|variants2|"PG"|"PD"|Numbers matched/i);
  });

  it("dead end (round 7): nothing blocked yet, but forced moves leave a cell unlightable → a normal `Stuck: <cell> — take back <culprit>` line", { timeout: 60_000 }, () => {
    // Gentle levels under the PG code: a correct lantern + one wrong one, no conflict, nothing blocked, a dead end at a cell.
    let found: { n: number; moves: number[]; a: P.BoardAnalysis } | null = null;
    for (let n = 1; n <= 20 && found === null; n++) {
      const g = P.generatedForTrack("gentle", n);
      const sol = idx(g.meta.solution);
      const others = idx(P.floorMask(g.level)).filter((i) => !sol.includes(i));
      for (const w of others) {
        for (const r of [-1, ...sol]) {
          const moves = r < 0 ? [w] : [r, w];
          const a = P.analyzeBoard(g.level, { ...P.initialState(g.level), lanterns: moves.reduce((b, c) => P.withBit(b, c, true), P.EMPTY) }, moves);
          if (a.conflicts.length === 0 && a.blocked.length === 0 && a.stuckStones.length === 0 && a.deadEnd?.kind === "cell" && a.culprit === w) {
            found = { n, moves, a };
            break;
          }
        }
        if (found !== null) break;
      }
    }
    expect(found, "no gentle 1–20 state with a dead end").not.toBeNull();
    const { n, moves, a } = found!;
    const file = join(mkdtempSync(join(tmpdir(), "lanternly-")), "d.json");
    play("new", "--variant", codeFor("PG"), "--index", String(n), "--out", file);
    let out = "";
    for (const c of moves) out = play("move", "-s", file, "-c", name(c));
    expect(out).toContain(`\nStuck: ${name(a.deadEnd!.at)} — take back ${name(a.culprit!)}\n`);
    const f = JSON.parse(readFileSync(file, "utf8"));
    expect(f.actions[f.actions.length - 1].dead).toBe(1);
  });

  it("gentle code: stone statuses + stuck cells, progressive neutral removal hint, completes", { timeout: 60_000 }, () => {
    const code = codeFor("PG");
    const file = join(mkdtempSync(join(tmpdir(), "lanternly-")), "g.json");
    const out = play("new", "--variant", code, "--index", "2", "--out", file);
    const g = P.generatedForTrack("gentle", 2);
    expect(out).toContain(RULE);
    expect(out).toContain(`Duskwick ${code} — free level 2 · ${g.level.w}×${g.level.h}\n`);
    expect(out).toMatch(/\nNumbers: ([A-F][1-6] [0-4][✓↑✗⊘] *)+\n/);
    expect(out).toContain("Stuck: none");
    expect(out).not.toContain("Dead cells");
    expect(out).not.toContain("Numbers matched");
    const sol = idx(g.meta.solution);
    const wrong = idx(P.floorMask(g.level)).filter((i) => !sol.includes(i)).slice(-2);
    for (const c of wrong) play("move", "-s", file, "-c", name(c));
    const taken: string[] = [];
    for (let left = wrong.length; left >= 1; left--) {
      const h = play("hint", "-s", file);
      const m = /Take back the lantern at ([A-F][1-6]) \(1 of (\d)\)/.exec(h);
      expect(m, h).not.toBeNull();
      expect(Number(m![2])).toBe(left);
      expect(wrong.map(name)).toContain(m![1]);
      expect(h).not.toMatch(/optimal|not in this one|solution/i);
      taken.push(m![1]!);
      play("move", "-s", file, "-c", m![1]!);
    }
    expect(taken.sort()).toEqual(wrong.map(name).sort());
    expect(play("hint", "-s", file)).toMatch(/Hint: put a lantern at [A-F][1-6] — /);
    let last = "";
    for (const c of sol) last = play("move", "-s", file, "-c", name(c));
    expect(last).toContain("COMPLETE");
    const f = JSON.parse(readFileSync(file, "utf8"));
    expect(f.variant).toBe(code);
    expect(f.seedKey).toBeNull();
    expect(JSON.stringify(f)).not.toMatch(/pips|gentle|deduce|"PG"|"PD"|numbersMatched/);
    const hint = f.actions.find((a: { cmd: string }) => a.cmd === "hint");
    expect(hint.stones).toBeDefined();
    expect(typeof hint.dead).toBe("number");
  });

  it("deduce code and --variant P --track deduce give the same level; --track is refused for codes", { timeout: 60_000 }, () => {
    const dir = mkdtempSync(join(tmpdir(), "lanternly-"));
    const a = play("new", "--variant", codeFor("PD"), "--index", "9", "--out", join(dir, "a.json"));
    const b = play("new", "--variant", "P", "--track", "deduce", "--index", "9", "--out", join(dir, "b.json"));
    const board = (s: string): string => s.split("\n").filter((l) => /^ [1-8]  /.test(l)).join("\n");
    expect(board(a)).toBe(board(b));
    const rows = board(a).split("\n").map((l) => l.slice(4).replace(/ /g, "").replace(/·/g, "."));
    expect(rows).toEqual(P.levelRows(P.levelForTrack("deduce", 9)));
    let msg = "";
    try {
      play("new", "--variant", codeFor("PG"), "--track", "deduce", "--index", "1");
    } catch (e) {
      msg = String((e as { stderr?: string }).stderr ?? e);
    }
    expect(msg).toContain("--track works with --variant P only");
  });
});
