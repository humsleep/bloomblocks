// DEV ONLY (Node, not bundled): stage the iOS simulator app with fake progress for
// lit-street screenshots, using the app's own save files (read-only formats of
// src/game/session.ts + daily.ts) — the same approach as scripts/sim-shots.ts.
//   cd apps/client && npx tsx src/town/dev/town-shots.ts --houses 30 [--deduce 14] [--streak 9] [--covered 1] [--device booted]
// Then open the street in the app (left button on the hill) and take the shot:
//   xcrun simctl io booted screenshot ../../playtest/shots/v6/town-30.png
// Refuses to run while scripts/sim-shots.ts is running (it wipes the same save folder).
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const HERE = dirname(fileURLToPath(import.meta.url));
const { values: a } = parseArgs({
  options: {
    houses: { type: "string", default: "12" },
    deduce: { type: "string", default: "0" },
    streak: { type: "string", default: "0" },
    covered: { type: "string", default: "0" },
    device: { type: "string", default: "booted" },
  },
});
const dev = a.device!;
const sh = (cmd: string, args: string[]): string => execFileSync(cmd, args, { encoding: "utf8" }).trim();
try {
  sh("pgrep", ["-f", "scripts/sim-shots.ts"]);
  console.error("sim-shots.ts is running on the simulator — try again when it is done");
  process.exit(2);
} catch {
  /* not running */
}
const bundle = (JSON.parse(readFileSync(join(HERE, "../../../app.identity.json"), "utf8")) as { bundleId: string }).bundleId;
const container = sh("xcrun", ["simctl", "get_app_container", dev, bundle, "data"]);
const dir = join(container, "Library", "lanternly");
const plist = join(container, "Library", "Preferences", bundle);

const n = Number(a.houses);
const d = Number(a.deduce);
const streak = Number(a.streak);
const covered = Number(a.covered);
const iso = (t: Date): string => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
const today = new Date();
const yesterday = new Date(Date.now() - 86400000);

try {
  sh("xcrun", ["simctl", "terminate", dev, bundle]);
} catch {
  /* not running */
}
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
writeFileSync(
  join(dir, "pips-progress.json"),
  JSON.stringify({ v: 3, game: "pips", track: "gentle", gentle: { level: n + 1, cleared: n, hints: 0 }, deduce: { level: d + 1, cleared: d, hints: 0 } }),
);
const prefs = (args: string[]): void => {
  try {
    execFileSync("xcrun", ["simctl", "spawn", dev, "defaults", ...args], { stdio: "ignore" });
  } catch {
    /* nothing to delete */
  }
};
prefs(["write", plist, "CapacitorStorage.guide", "-string", "127"]);
prefs(["delete", plist, "CapacitorStorage.daily"]);
if (streak > 0) {
  const st = { v: 1, last: iso(yesterday), streak, best: streak, shields: { [iso(today).slice(0, 7)]: Math.min(2, covered) } };
  prefs(["write", plist, "CapacitorStorage.streak", "-string", JSON.stringify(st)]);
} else prefs(["delete", plist, "CapacitorStorage.streak"]);
sh("xcrun", ["simctl", "launch", dev, bundle]);
console.log(`staged: ${n} houses, deduce ${d}, streak ${streak} (+${covered} covered), today waiting`);
