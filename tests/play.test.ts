// Smoke test for the CLI playtest harness (tools/play.ts): a full game through
// the shell interface, including illegal input, undo, hint and completion.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { levelForIndex } from "../games/lanterns/generator.ts";
import { cellsOf } from "../games/lanterns/index.ts";
import { pipsLevelForIndex } from "../games/lanterns-pips/generator.ts";
import { levelRows } from "../games/lanterns-pips/level.ts";
import { RULE_TEXT, type Variant, loadCodes, variantLevel } from "../tools/variantLevels.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tsx = join(root, "node_modules", ".bin", "tsx");
const play = (...args: string[]): string =>
  execFileSync(tsx, [join(root, "tools", "play.ts"), ...args], { cwd: root, encoding: "utf8" });

describe("tools/play.ts", () => {
  it("plays a level end to end and logs every action with a timestamp", { timeout: 60_000 }, () => {
    const file = join(mkdtempSync(join(tmpdir(), "lanternly-")), "s.json");
    const out = play("new", "--mode", "free", "--index", "2", "--out", file);
    expect(out).toContain(`session: ${file}`);
    expect(out).toContain("    A B C D E");
    expect(play("move", "-s", file, "-c", "H8")).toContain("ILLEGAL: H8 is outside the board");
    const sol = cellsOf(levelForIndex(2).meta.solution).map((c) => `${"ABCDEFGH"[c.x]}${c.y + 1}`);
    play("move", "-s", file, "-c", sol[0]!);
    expect(play("undo", "-s", file)).toContain(`Undid the last toggle at ${sol[0]}`);
    expect(play("hint", "-s", file)).toMatch(/Hint: [A-E][1-5]/);
    let last = "";
    for (const c of sol) last = play("move", "-s", file, "-c", c);
    expect(last).toContain("COMPLETE");
    expect(play("move", "-s", file, "-c", sol[0]!)).toContain("ILLEGAL: the level is already complete");
    const f = JSON.parse(readFileSync(file, "utf8"));
    expect(f.complete).toBe(true);
    expect(f.actions.map((a: { cmd: string }) => a.cmd)).toEqual(["new", "move", "move", "undo", "hint", ...sol.map(() => "move"), "move"]);
    for (const a of f.actions) expect(Number.isNaN(Date.parse(a.t))).toBe(false);
  });

  const codeFor = (v: Variant): string => {
    const hit = Object.entries(loadCodes()).find(([, x]) => x === v);
    if (!hit) throw new Error(`no code for ${v} in playtest/variants.json`);
    return hit[0];
  };
  const cell = (c: { x: number; y: number }): string => `${"ABCDEFGH"[c.x]}${c.y + 1}`;

  it("playtest/variants.json maps three opaque codes to N, P and E", () => {
    const codes = loadCodes();
    expect(Object.values(codes).sort()).toEqual(["E", "N", "P"]);
    for (const k of Object.keys(codes)) expect(["N", "P", "E"]).not.toContain(k);
  });

  it("a P code plays to completion: digits on stones, minimal rule text, no seed key in the file", { timeout: 60_000 }, () => {
    const code = codeFor("P");
    const file = join(mkdtempSync(join(tmpdir(), "lanternly-")), "p.json");
    const out = play("new", "--variant", code, "--index", "3", "--out", file);
    expect(out).toContain(RULE_TEXT.P);
    expect(out).toContain(`Duskwick ${code} — free level 3 · 5×5\n`);
    expect(out).toContain("0-4 stone with a number (exactly that many lanterns touch this stone's sides)");
    const g = pipsLevelForIndex(3);
    const rows = out.split("\n").filter((l) => /^ [1-5]  /.test(l)).map((l) => l.slice(4).replace(/ /g, ""));
    expect(rows.map((r) => r.replace(/·/g, "."))).toEqual(levelRows(g.level));
    expect(play("hint", "-s", file)).toMatch(/Hint: put a lantern at [A-E][1-5]/);
    let last = "";
    for (const c of cellsOf(g.meta.solution)) last = play("move", "-s", file, "-c", cell(c));
    expect(last).toContain("COMPLETE — every floor cell is lit and every number matches.");
    const f = JSON.parse(readFileSync(file, "utf8"));
    expect(f.variant).toBe(code);
    expect(f.seedKey).toBeNull();
    expect(f.level.budget).toBeNull();
    expect(JSON.stringify(f)).not.toMatch(/pips|"P"/);
  });

  it("an E code has the N rule text and budget = minimum + 2; N codes keep the exact minimum", { timeout: 60_000 }, () => {
    const dir = mkdtempSync(join(tmpdir(), "lanternly-"));
    const e = play("new", "--variant", codeFor("E"), "--index", "12", "--out", join(dir, "e.json"));
    const n = play("new", "--variant", codeFor("N"), "--index", "12", "--out", join(dir, "n.json"));
    expect(e).toContain(RULE_TEXT.E);
    expect(n).toContain(RULE_TEXT.N);
    const ev = variantLevel("E", 12);
    if (ev.variant !== "E") throw new Error("unreachable");
    expect(ev.level.budget).toBe(ev.minLanterns + 2);
    expect(e).toContain(`budget ${ev.level.budget} lanterns`);
    expect(n).toContain(`budget ${levelForIndex(12).level.budget} lanterns`);
    expect(play("hint", "-s", join(dir, "e.json"))).toMatch(/Hint: [A-F][1-6]/);
  });

  it("rejects unknown codes without listing the variants", () => {
    let msg = "";
    try {
      play("new", "--variant", "Q9", "--index", "1");
    } catch (e) {
      msg = String((e as { stderr?: string }).stderr ?? e);
    }
    expect(msg).toContain("unknown variant code Q9");
    expect(msg).not.toMatch(/N\|P\|E/);
  });
});

