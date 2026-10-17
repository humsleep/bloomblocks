// v7 (phase 2, agent U): default out playtest/shots/v7; "done" guide = 255 (incl. the moon bit
// 128); new shots 00-first-launch, 04b-conflict, 12-moon-guide; --prefix names files (pm-, se-).
// cd apps/client && npx tsx scripts/sim-shots.ts [--out <dir, relative to scripts/; default playtest/shots/v6>] [--only 03-stuck-one-culprit] [--stage] [--wait 4] [--device booted]
// v6 (round 5: one culprit, stuck numbers, minus-lantern over tag, tower travel, take-back hint,
// calendar tile + shield intro, 0 lesson, share-time setting). 06 and 11 need a tap after --stage
// (hint button / gear).
// v5 (round 4: goal card, coral conflict ✕, culprit thread, daily + streak).
// v4 (pips rules, two tracks, first-run guide). Each state is written as the app's own
// save files (pips-progress.json + pips-<track>-journal.log, src/game/session.ts) into the
// simulator's data container and restored through verifyRun on launch. The guide state
// (Preferences "guide", UserDefaults CapacitorStorage.guide) is reset for the onboarding
// shots and set to "all shown" (15) for the others.
//   --stage   only write the saves and launch (for shots that need a tap first:
//             06-hint-remove taps the hint button, 10-share-sheet the share button on 09,
//             then `xcrun simctl io <dev> screenshot`)
//   burst shots (onboarding demos loop): frames go to <out>/_burst/, frame --pick is kept (check it).
// Build + install first: npm run build:m1 && npm run ios:sync && xcodebuild … (scripts/sim-run.sh)
// && xcrun simctl install <dev> <App.app>.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { u32Hex } from "../../../core/bytes.ts";
import { stateHash } from "../../../core/game.ts";
import { levelIdFor, seedKeyFor } from "../src/game/levelIds.ts";
import {
  analyzeBoard, blockedCells, culpritOf, dailyParams, hasBit, lanternsPips as G, levelForDaily, levelForTrack, type PipsLevel, type PipsState, solutionOf,
  type Track,
} from "../src/game/pipsApi.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const { values: a } = parseArgs({
  options: {
    out: { type: "string", default: "../../../playtest/shots/v7" },
    prefix: { type: "string", default: "" },
    only: { type: "string" },
    stage: { type: "boolean", default: false },
    wait: { type: "string", default: "4" },
    burst: { type: "string", default: "12" },
    pick: { type: "string", default: "4" },
    device: { type: "string", default: "booted" },
  },
});
const dev = a.device!;
const bundle = (JSON.parse(readFileSync(join(HERE, "../app.identity.json"), "utf8")) as { bundleId: string }).bundleId;
const sh = (cmd: string, args: string[]): string => execFileSync(cmd, args, { encoding: "utf8" }).trim();
const container = sh("xcrun", ["simctl", "get_app_container", dev, bundle, "data"]);
const dir = join(container, "Library", "lanternly");
const outDir = resolve(HERE, a.out!);
mkdirSync(outDir, { recursive: true });

const cellsOf = (lo: number, hi: number): number[] => {
  const out: number[] = [];
  for (let i = 0; i < 64; i++) if (((i < 32 ? lo >>> i : hi >>> (i - 32)) & 1) === 1) out.push(i);
  return out;
};
const solCells = (l: PipsLevel): number[] => {
  const s = solutionOf(l);
  if (!s) throw new Error("no solution");
  return cellsOf(s.lo, s.hi);
};
function play(l: PipsLevel, cells: readonly number[]): PipsState | null {
  let s = G.init("", l);
  for (const c of cells) {
    const n = G.apply(s, { x: c & 7, y: c >> 3 });
    if (!n) return null;
    s = n;
  }
  return s;
}
const isFloor = (l: PipsLevel, i: number): boolean => (i & 7) < l.w && i >> 3 < l.h && !hasBit(l.stones, i);

/** Stone A satisfied by its answer lanterns, stone B given one lantern too many: one ok, one over, no conflict. */
function midState(l: PipsLevel): number[] {
  const sol = solCells(l);
  const nb = (i: number): number[] => [i - 8, i - 1, i + 1, i + 8].filter((j) => j >= 0 && j < 64 && Math.abs((j & 7) - (i & 7)) <= 1 && isFloor(l, j));
  const numbered = cellsOf(l.stones.lo, l.stones.hi).filter((i) => l.clues[i]! >= 1 && l.clues[i]! <= 4);
  let fallback: number[] | undefined;
  for (const A of numbered) {
    for (const B of numbered) {
      if (A === B) continue;
      const base = [...new Set([...nb(A), ...nb(B)].filter((j) => sol.includes(j)))];
      for (const q of nb(B)) {
        if (sol.includes(q) || nb(A).includes(q)) continue;
        const st = play(l, [...base, q]);
        if (!st) continue;
        const an = analyzeBoard(l, st);
        const sa = an.stones.find((x) => x.cell === A);
        const sb = an.stones.find((x) => x.cell === B);
        if (an.conflicts.length === 0 && sa?.status === "ok" && sb?.status === "over") {
          // round 5: prefer a board where nothing else is stuck (the over tag alone)
          const quiet = an.blocked.length === 0 && an.stuckStones.every((x) => x.reason === "over");
          if (quiet) return [...base, q];
          fallback ??= [...base, q];
        }
      }
    }
  }
  if (fallback) return fallback;
  throw new Error("no mid state");
}

/** midState with nothing else stuck (throws otherwise, so the next level is tried). */
function quietMidState(l: PipsLevel): number[] {
  const cells = midState(l);
  const st = play(l, cells)!;
  const an = analyzeBoard(l, st, cells);
  if (an.blocked.length > 0 || an.stuckStones.some((x) => x.reason !== "over")) throw new Error("not quiet");
  return cells;
}

/** Two lanterns that are not in the answer (plus a correct one). */
function wrongState(l: PipsLevel): number[] {
  const sol = solCells(l);
  const extra: number[] = [];
  for (let q = 0; q < 64 && extra.length < 2; q++) {
    if (!isFloor(l, q) || sol.includes(q)) continue;
    const st = play(l, [sol[0]!, ...extra, q]);
    if (st && analyzeBoard(l, st).conflicts.length === 0) extra.push(q);
  }
  return [sol[0]!, ...extra];
}

/**
 * The round-2 stall: every number satisfied, no conflicts, but dark cells that
 * nothing can light any more, at least one of them blocked by a full stone.
 */
function stuckStoneState(l: PipsLevel): number[] {
  const sol = solCells(l);
  const floor: number[] = [];
  for (let i = 0; i < 64; i++) if (isFloor(l, i)) floor.push(i);
  const ok = (cells: number[]): boolean => {
    const st = play(l, cells);
    if (!st) return false;
    const an = analyzeBoard(l, st);
    if (an.complete || an.conflicts.length > 0 || !an.stones.every((x) => x.status === "ok")) return false;
    const dark = an.floorCount - an.litCount;
    const bl = blockedCells(l, st, an);
    return dark > 0 && bl.length === dark && dark <= 3 && bl.some((b) => b.by === "stone");
  };
  for (const drop of sol) {
    const base = sol.filter((c) => c !== drop);
    for (const w of floor) {
      if (sol.includes(w)) continue;
      if (ok([...base, w])) return [...base, w];
    }
  }
  for (const w of floor) {
    if (sol.includes(w)) continue;
    for (const w2 of floor) {
      if (w2 <= w || sol.includes(w2)) continue;
      for (let k = 0; k < sol.length; k++) {
        const cells = [...sol.filter((_, j) => j !== k), w, w2];
        if (ok(cells)) return cells;
      }
    }
  }
  throw new Error("no stuck-stone state");
}

/**
 * Round-4 stall: a dark cell nobody can light, caused by the player's own light,
 * with the rules' most culpable wrong lantern among the lanterns lighting its candidates.
 */
function stuckLightState(l: PipsLevel): number[] {
  const sol = solCells(l);
  const floor: number[] = [];
  for (let i = 0; i < 64; i++) if (isFloor(l, i)) floor.push(i);
  let best: { cells: number[]; score: number } | null = null;
  const tryIt = (cells: number[]): void => {
    const st = play(l, cells);
    if (!st) return;
    const an = analyzeBoard(l, st);
    if (an.complete || an.conflicts.length > 0 || an.stones.some((x) => x.status === "over")) return;
    const ar = analyzeBoard(l, st, cells);
    const bl = blockedCells(l, st, ar);
    if (bl.length === 0) return;
    const c = culpritOf(ar);
    if (c < 0 || !bl.some((b) => b.causes.includes("light") && b.lanterns.includes(c))) return;
    const dark = an.floorCount - an.litCount;
    // round 5: prefer boards where v5 would have listed many lanterns (several involved, one blamed)
    const involved = new Set<number>();
    for (const b of bl) for (const x of b.lanterns) involved.add(x);
    const score = dark + (an.stones.every((x) => x.status === "ok") ? 0 : 3) - Math.min(3, involved.size);
    if (!best || score < best.score) best = { cells, score };
  };
  for (const w of floor) {
    if (sol.includes(w)) continue;
    for (let k = 0; k < sol.length; k++) tryIt([...sol.filter((_, j) => j !== k), w]);
    for (let k = 0; k < sol.length; k++) for (let k2 = k + 1; k2 < sol.length; k2++) tryIt([...sol.filter((_, j) => j !== k && j !== k2), w]);
  }
  if (!best) throw new Error("no stuck-light state");
  return (best as { cells: number[] }).cells;
}

/**
 * Round 5: a number that can no longer reach its count (cannotReach) with the rules' culprit
 * among its lanterns; no conflicts, nothing over, as few stuck cells as possible.
 */
function stuckNumberState(l: PipsLevel): number[] {
  const sol = solCells(l);
  const floor: number[] = [];
  for (let i = 0; i < 64; i++) if (isFloor(l, i)) floor.push(i);
  let best: { cells: number[]; score: number } | null = null;
  const tryIt = (cells: number[]): void => {
    const st = play(l, cells);
    if (!st) return;
    const an = analyzeBoard(l, st, cells);
    if (an.complete || an.conflicts.length > 0 || an.stones.some((x) => x.status === "over")) return;
    const c = culpritOf(an);
    const sn = an.stuckStones.filter((x) => x.reason === "cannotReach");
    if (c < 0 || !sn.some((x) => x.lanterns.includes(c))) return;
    const score = an.blocked.length * 2 + sn.length + (an.floorCount - an.litCount) * 0.1;
    if (!best || score < best.score) best = { cells, score };
  };
  for (const w of floor) {
    if (sol.includes(w)) continue;
    for (let k = 0; k < sol.length; k++) tryIt([...sol.filter((_, j) => j !== k), w]);
    for (let k = 0; k < sol.length; k++) for (let k2 = k + 1; k2 < sol.length; k2++) tryIt([...sol.filter((_, j) => j !== k && j !== k2), w]);
  }
  if (!best) throw new Error("no stuck-number state");
  return (best as { cells: number[] }).cells;
}

/** Half the answer, preferring levels with a 0-rock (shows every digit look at once). */
function halfState(l: PipsLevel): number[] {
  if (!l.clues.some((c) => c === 0)) throw new Error("no zero rock");
  const sol = solCells(l);
  return sol.slice(0, Math.ceil(sol.length / 2));
}

interface Shot {
  name: string;
  track: Track;
  level: number | null;
  moves: (l: PipsLevel) => number[];
  burst?: boolean;
  stage?: boolean;
  /** Preferences "guide" bits ("fresh" = none, "done" = all) */
  guide?: "fresh" | "done" | number;
  /** daily shots: the moves on today's daily, plus Preferences "daily" / "streak" */
  daily?: { moves: (l: PipsLevel) => number[]; ms?: number; streak?: unknown };
  wait?: number;
  /** progress of the other track / this track's cleared count (tower shots) */
  cleared?: number;
  /** keep Preferences "shieldIntro" unset (the result card's one-time shield intro) */
  shieldIntro?: boolean;
  /** extra Preferences to write */
  prefs?: Record<string, string>;
}

const today = ((d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`)(new Date());
const dayShift = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Two lanterns that see each other (a solution lantern + a floor cell in its light). */
function conflictState(l: PipsLevel): number[] {
  const sol = solCells(l);
  for (const a0 of sol) {
    for (let q = 0; q < 64; q++) {
      if (!isFloor(l, q) || q === a0) continue;
      const sameRow = q >> 3 === a0 >> 3;
      const sameCol = (q & 7) === (a0 & 7);
      if (!sameRow && !sameCol) continue;
      const st = play(l, [a0, q]);
      if (st && analyzeBoard(l, st).conflicts.length === 1) return [...sol.slice(0, 2).filter((c) => c !== a0 && c !== q), a0, q];
    }
  }
  throw new Error("no conflict state");
}

const SHOTS: Shot[] = [
  { name: "00-first-launch", track: "gentle", level: 1, moves: () => [], burst: true, guide: "fresh", wait: 2.4 },
  { name: "00b-tap-lesson", track: "gentle", level: 1, moves: () => [], burst: true, guide: 16, wait: 1.6 },
  { name: "04b-conflict", track: "gentle", level: 4, moves: conflictState, wait: 3 },
  { name: "12-moon-guide", track: "gentle", level: 4, moves: () => [], burst: true, guide: 127, wait: 3.6 },
  { name: "01-guide-numbers-zero", track: "gentle", level: 2, moves: () => [], burst: true, guide: 17, wait: 5.2 },
  { name: "02-guide-conflict", track: "gentle", level: 3, moves: () => [], burst: true, guide: 19, wait: 2.6 },
  { name: "03-stuck-one-culprit", track: "gentle", level: 4, moves: stuckLightState, wait: 5 },
  { name: "04-stuck-number", track: "gentle", level: 4, moves: stuckNumberState, wait: 5 },
  { name: "05-overfull", track: "gentle", level: 4, moves: quietMidState },
  { name: "06-hint-remove-why", track: "gentle", level: 4, moves: quietMidState, stage: true },
  // gentle 6 just reached (5 cleared): the camera looks over to the tower while it lights up
  { name: "07-tower-reveal", track: "gentle", level: 6, moves: () => [], burst: true, guide: 1 | 2 | 4 | 16 | 32 | 128, wait: 2.6 },
  { name: "08-deduce-tower-courtyard", track: "deduce", level: 3, moves: (l) => solCells(l).slice(0, 3) },
  { name: "09-daily-start-today", track: "gentle", level: 7, moves: () => [], daily: { moves: () => [], ms: 0 } },
  {
    name: "10-daily-result-shields", track: "gentle", level: 7, moves: () => [], burst: true, wait: 4.6, shieldIntro: true,
    daily: { moves: (l) => solCells(l), ms: 161000, streak: { v: 1, last: dayShift(-2), streak: 4, best: 4, shields: { [today.slice(0, 7)]: 0 } } },
  },
  { name: "11-settings", track: "gentle", level: 6, moves: (l) => solCells(l).slice(0, 2), stage: true },
  { name: "solve", track: "gentle", level: 4, moves: () => [], stage: true },
  // SE layout checks (audit P1-14): a big deduce board and a late gentle level (house 31)
  { name: "13-deduce-8x8", track: "deduce", level: 24, moves: (l) => { if (l.w < 8) throw new Error("small"); return solCells(l).slice(0, 3); }, stage: true },
  { name: "14-main-30", track: "gentle", level: 30, moves: () => [], stage: true },
];

function setGuide(mode: "fresh" | "done" | number, daily?: Shot["daily"], shot?: Shot): void {
  // the app's own preferences plist (Capacitor Preferences → UserDefaults "CapacitorStorage.<key>"),
  // written through the simulator's cfprefsd so the app sees it on launch; numbers back to digits
  const plist = join(container, "Library", "Preferences", bundle);
  const run = (args: string[]): void => {
    try {
      execFileSync("xcrun", ["simctl", "spawn", dev, "defaults", ...args], { stdio: "ignore" });
    } catch {
      /* nothing to delete */
    }
  };
  run(["delete", plist, "CapacitorStorage.numbers"]);
  if (mode === "fresh") run(["delete", plist, "CapacitorStorage.guide"]);
  else run(["write", plist, "CapacitorStorage.guide", "-string", String(mode === "done" ? 255 : mode)]);
  // the result card's shield intro: shown once; only the shield shot sees it
  if (shot?.shieldIntro) run(["delete", plist, "CapacitorStorage.shieldIntro"]);
  else run(["write", plist, "CapacitorStorage.shieldIntro", "-string", "1"]);
  run(["delete", plist, "CapacitorStorage.shareTime"]);
  run(["delete", plist, "CapacitorStorage.daily"]);
  run(["delete", plist, "CapacitorStorage.streak"]);
  if (daily) {
    run(["write", plist, "CapacitorStorage.daily", "-string", JSON.stringify({ date: today, ms: daily.ms ?? 0, hints: 0, undos: 0, result: null })]);
    if (daily.streak) run(["write", plist, "CapacitorStorage.streak", "-string", JSON.stringify(daily.streak)]);
  }
}

function writeSave(track: Track, n: number, moves: number[]): void {
  const l = levelForTrack(track, n);
  let s = G.init("", l);
  let journal = `PPJ1 ${u32Hex(levelIdFor(track, n))} ${seedKeyFor(track, n)}\n`;
  for (const c of moves) {
    const next = G.apply(s, { x: c & 7, y: c >> 3 });
    if (!next) throw new Error(`illegal shot move ${c}`);
    s = next;
    journal += `${c.toString(16).padStart(2, "0")}${u32Hex(stateHash(G, s))}\n`;
  }
  const fresh = { level: 1, cleared: 0, hints: 0 };
  // a coherent world (r6: testers compared plates across shots): the tower is only reachable
  // after gentle 5, so a deduce shot stands on a street of 6 houses
  const home = track === "deduce" ? { level: 7, cleared: 6, hints: 0 } : fresh;
  const prog = { v: 3, game: "pips", track, gentle: home, deduce: fresh, [track]: { level: n, cleared: n - 1, hints: 0 } };
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "pips-progress.json"), JSON.stringify(prog));
  writeFileSync(join(dir, `pips-${track}-journal.log`), journal);
}

/** Today's daily: progress points into it, journal with `moves`. */
function writeDaily(moves: (l: PipsLevel) => number[]): void {
  const l = levelForDaily(today);
  const p = dailyParams(today);
  let s = G.init("", l);
  let journal = `PPJ1 ${u32Hex(p.levelId >>> 0)} ${p.seedKey}\n`;
  for (const c of moves(l)) {
    s = G.apply(s, { x: c & 7, y: c >> 3 })!;
    journal += `${c.toString(16).padStart(2, "0")}${u32Hex(stateHash(G, s))}\n`;
  }
  const prog = JSON.parse(readFileSync(join(dir, "pips-progress.json"), "utf8")) as Record<string, unknown>;
  prog.daily = today;
  writeFileSync(join(dir, "pips-progress.json"), JSON.stringify(prog));
  writeFileSync(join(dir, "pips-daily-journal.log"), journal);
}

const sleep = (s: number): void => void execFileSync("sleep", [String(s)]);

for (const shot of SHOTS) {
  if (a.only ? shot.name !== a.only : shot.stage) continue;
  try {
    sh("xcrun", ["simctl", "terminate", dev, bundle]);
  } catch {
    /* not running */
  }
  rmSync(dir, { recursive: true, force: true });
  setGuide(shot.guide ?? "done", shot.daily, shot);
  if (shot.level !== null) {
    // the first level from shot.level on where the wanted state exists
    for (let n = shot.level; ; n++) {
      const l = levelForTrack(shot.track, n);
      let moves: number[];
      try {
        moves = shot.moves(l);
      } catch (e) {
        if (n > shot.level + 20) throw e;
        continue;
      }
      writeSave(shot.track, n, moves);
      if (shot.daily) writeDaily(shot.daily.moves);
      console.log(`${shot.name}: ${shot.track} level ${n} ${l.w}x${l.h}, ${moves.length} lanterns${shot.daily ? ` + daily ${today}` : ""}`);
      break;
    }
  }
  sh("xcrun", ["simctl", "launch", dev, bundle]);
  if (shot.stage || a.stage) {
    console.log(`staged ${shot.name}`);
    continue;
  }
  const file = join(outDir, `${a.prefix}${shot.name}.png`);
  if (shot.burst) {
    const bdir = join(outDir, "_burst");
    mkdirSync(bdir, { recursive: true });
    sleep(shot.wait ?? 1);
    const n = Number(a.burst);
    for (let k = 0; k < n; k++) {
      sh("xcrun", ["simctl", "io", dev, "screenshot", join(bdir, `${a.prefix}${shot.name}-${String(k).padStart(2, "0")}.png`)]);
      sleep(0.05);
    }
    copyFileSync(join(bdir, `${a.prefix}${shot.name}-${String(Number(a.pick)).padStart(2, "0")}.png`), file);
  } else {
    sleep(shot.wait ?? Number(a.wait));
    sh("xcrun", ["simctl", "io", dev, "screenshot", file]);
  }
  console.log(file);
}
