// npx tsx tools/sim-shots.ts [--out playtest/shots] [--only 03-conflict]
// Screenshots of the installed client on the booted iOS simulator. The release
// bundle has no ?shot= hook, so each state is written as the app's own save
// files (progress.json + journal.log, apps/client/src/game/session.ts) into the
// simulator's data container; the app restores it through verifyRun on launch.
// Build + install first: cd apps/client && npm run build:m1 && npm run ios:sync &&
// xcodebuild … (see scripts/sim-run.sh) && xcrun simctl install booted <App.app>.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { u32Hex } from "../core/bytes.ts";
import { stateHash } from "../core/game.ts";
import { levelForIndex } from "../games/lanterns/generator.ts";
import * as L from "../games/lanterns/index.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const { values: a } = parseArgs({ options: { out: { type: "string", default: "playtest/shots" }, only: { type: "string" }, wait: { type: "string", default: "3" } } });
const bundle = (JSON.parse(readFileSync(join(ROOT, "apps/client/app.identity.json"), "utf8")) as { bundleId: string }).bundleId;
const sh = (cmd: string, args: string[]): string => execFileSync(cmd, args, { encoding: "utf8" }).trim();
const container = sh("xcrun", ["simctl", "get_app_container", "booted", bundle, "data"]);
const dir = join(container, "Library", "lanternly");
const outDir = resolve(ROOT, a.out!);
mkdirSync(outDir, { recursive: true });

type Cell = { x: number; y: number };
interface Shot { name: string; level: number | null; moves: (sol: Cell[], level: L.LanternsLevel) => Cell[] }

/** A floor neighbour of c (same segment → the two lanterns see each other). */
function neighbour(level: L.LanternsLevel, c: Cell): Cell {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const x = c.x + dx;
    const y = c.y + dy;
    if (x >= 0 && y >= 0 && x < level.w && y < level.h && !L.hasBit(level.stones, L.index(x, y))) return { x, y };
  }
  throw new Error("no neighbour");
}

const SHOTS: Shot[] = [
  { name: "01-first-launch", level: null, moves: () => [] }, // no save files at all
  { name: "02-mid", level: 1, moves: (s) => s.slice(0, 2) },
  { name: "03-conflict", level: 1, moves: (s, l) => [s[0]!, s[1]!, neighbour(l, s[1]!)] },
  { name: "04-one-left", level: 1, moves: (s) => s.slice(0, -1) },
  { name: "05-complete", level: 1, moves: (s) => s },
  { name: "06-level-6", level: 6, moves: () => [] },
  { name: "07-level-15", level: 15, moves: () => [] },
];

function writeSave(n: number, moves: Cell[]): void {
  const g = levelForIndex(n);
  let s = L.initialState(g.level);
  let journal = `PLJ1 ${u32Hex(g.levelId)} ${g.seedKey}\n`;
  for (const m of moves) {
    s = L.toggle(s, m)!;
    if (!s) throw new Error(`illegal shot move ${m.x},${m.y}`);
    journal += `${(m.y * 8 + m.x).toString(16).padStart(2, "0")}${u32Hex(stateHash(L.lanterns, s))}\n`;
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "progress.json"), JSON.stringify({ v: 2, level: n, cleared: n - 1 }));
  writeFileSync(join(dir, "journal.log"), journal);
}

for (const shot of SHOTS) {
  if (a.only && shot.name !== a.only) continue;
  try {
    sh("xcrun", ["simctl", "terminate", "booted", bundle]);
  } catch {
    /* not running */
  }
  rmSync(dir, { recursive: true, force: true });
  if (shot.level !== null) {
    const g = levelForIndex(shot.level);
    writeSave(shot.level, shot.moves(L.cellsOf(g.meta.solution), g.level));
  }
  sh("xcrun", ["simctl", "launch", "booted", bundle]);
  execFileSync("sleep", [a.wait!]);
  const file = join(outDir, `${shot.name}.png`);
  sh("xcrun", ["simctl", "io", "booted", "screenshot", file]);
  console.log(file);
}
