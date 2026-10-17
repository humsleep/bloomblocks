// App Store screenshots from the REAL app (App Review 2.3.3): seeds the app's own save files and
// Preferences in a simulator, launches it in one language, and grabs the screen with simctl.
// No test bridge, no DEV hooks: the web bundle is the production `vite build --mode m1`
// (see README.md in this folder for the build + install steps and the tap list).
//
//   cd apps/client
//   npx tsx ../../playtest/store/store-shots.ts seed <state> --lang ko [--device <udid>]
//   npx tsx ../../playtest/store/store-shots.ts grab <name> --lang ko [--device <udid>]
//
// states (one coherent world: gentle house 12, a 6-day streak, 20 lit days → all 7 residents moved in,
// a furnished cottage, one unread letter (Pip's), today's village notices already seen):
//   world          street board idle (village / cottage / letter / settings shots start here)
//   board-mid      a solve in progress (about half the answer, no conflict)
//   rule-light     one lantern lighting its row and column
//   rule-conflict  two lanterns that see each other
//   rule-number    a numbered stone with exactly its lanterns (gold ring)
//   daily-mid      today's daily, a few lanterns in
//   daily-done     today's daily with its full answer → finale → postcard (+ streak)
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { u32Hex } from "../../core/bytes.ts";
import { stateHash } from "../../core/game.ts";
import { levelIdFor, seedKeyFor } from "../../apps/client/src/game/levelIds.ts";
import { analyzeBoard, dailyParams, hasBit, lanternsPips as G, levelForDaily, levelForTrack, type PipsLevel, type PipsState, solutionOf } from "../../apps/client/src/game/pipsApi.ts";
import { autoSlot, COTTAGE, dayOf, encodeRoom, mails, owned, place, placedBits, residents, starterRoom, type VillageInput } from "../../apps/client/src/village/model.ts";
import { emptyV } from "../../apps/client/src/village/vstate.ts";
import { hemisphereOf, regionOf, seasonOf } from "../../apps/client/src/village/picker.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const { values: a, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    lang: { type: "string", default: "en" },
    device: { type: "string", default: "E2C93361-2D67-45FD-8CA3-06F5BE2C9F18" },
    out: { type: "string", default: join(HERE, "../../apps/client/build/store-raw/6.9") },
  },
});
const [cmd, arg] = positionals;
const dev = a.device!;
const BUNDLE = "com.humsleep.duskwick";
const sh = (c: string, args: string[]): string => execFileSync(c, args, { encoding: "utf8" }).trim();

/** App language → simulator launch arguments (AppleLanguages + AppleLocale). */
const LOCALES: Record<string, [string, string]> = {
  en: ["en-US", "en_US"], ko: ["ko-KR", "ko_KR"], ja: ["ja-JP", "ja_JP"], de: ["de-DE", "de_DE"], fr: ["fr-FR", "fr_FR"],
  es: ["es-ES", "es_ES"], "pt-BR": ["pt-BR", "pt_BR"], it: ["it-IT", "it_IT"], "zh-Hans": ["zh-Hans", "zh_CN"], "zh-Hant": ["zh-Hant", "zh_TW"],
};

const iso = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const shift = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};
const today = iso(new Date());

// ---------------------------------------------------------------- board helpers
const cellsOf = (lo: number, hi: number): number[] => {
  const out: number[] = [];
  for (let i = 0; i < 64; i++) if (((i < 32 ? lo >>> i : hi >>> (i - 32)) & 1) === 1) out.push(i);
  return out;
};
const sol = (l: PipsLevel): number[] => {
  const s = solutionOf(l);
  if (!s) throw new Error("no solution");
  return cellsOf(s.lo, s.hi);
};
const isFloor = (l: PipsLevel, i: number): boolean => (i & 7) < l.w && i >> 3 < l.h && !hasBit(l.stones, i);
function play(l: PipsLevel, cells: readonly number[]): PipsState | null {
  let s = G.init("", l);
  for (const c of cells) {
    const n = G.apply(s, { x: c & 7, y: c >> 3 });
    if (!n) return null;
    s = n;
  }
  return s;
}
const nbrs = (l: PipsLevel, i: number): number[] => [i - 8, i - 1, i + 1, i + 8].filter((j) => j >= 0 && j < 64 && Math.abs((j & 7) - (i & 7)) <= 1 && isFloor(l, j));

/** Half the answer, no conflict, at least one numbered stone exactly satisfied. */
function midMoves(l: PipsLevel): number[] {
  const s = sol(l);
  return s.slice(0, Math.max(2, Math.ceil(s.length / 2)));
}
/** One answer lantern with a long row + column of light (the most lit cells). */
function lightMoves(l: PipsLevel): number[] {
  let best = -1;
  let pick = sol(l)[0]!;
  for (const c of sol(l)) {
    const an = analyzeBoard(l, play(l, [c])!);
    if (an.litCount > best) [best, pick] = [an.litCount, c];
  }
  return [pick];
}
/** Two lanterns in one row / column with nothing between them. */
function conflictMoves(l: PipsLevel): number[] {
  for (const a0 of sol(l)) {
    for (let q = 0; q < 64; q++) {
      if (!isFloor(l, q) || q === a0 || (q >> 3 !== a0 >> 3 && (q & 7) !== (a0 & 7))) continue;
      const st = play(l, [a0, q]);
      if (st && analyzeBoard(l, st).conflicts.length === 1) return [a0, q];
    }
  }
  throw new Error("no conflict state");
}
/** The highest numbered stone (≥2) with exactly its answer lanterns around it, nothing else. */
function numberMoves(l: PipsLevel): number[] {
  const s = sol(l);
  const stones = cellsOf(l.stones.lo, l.stones.hi).filter((i) => (l.clues[i] ?? -1) >= 2 && l.clues[i]! <= 4).sort((x, y) => l.clues[y]! - l.clues[x]!);
  for (const st of stones) {
    const mine = nbrs(l, st).filter((j) => s.includes(j));
    if (mine.length !== l.clues[st]) continue;
    const ps = play(l, mine);
    if (ps && analyzeBoard(l, ps).conflicts.length === 0) return mine;
  }
  throw new Error("no satisfiable number");
}

// ---------------------------------------------------------------- the world
const HOUSE = 12; // the street's current house (gentle level)
const PAST_DAILIES = [-6, -5, -4, -3, -2, -1].map(shift);
// an earlier run of dailies, broken by a 5-day gap (the streak stays 6): 20 lit days → all 7 residents
// (Yuki moves in at 14) and enough lantern drops for a furnished cottage
const OLD_DAILIES = Array.from({ length: 14 }, (_, i) => shift(-25 + i));
const ALL_DAILIES = [...OLD_DAILIES, ...PAST_DAILIES];

function journal(header: string, l: PipsLevel, moves: readonly number[]): string {
  let s = G.init("", l);
  let j = header;
  for (const c of moves) {
    const n = G.apply(s, { x: c & 7, y: c >> 3 });
    if (!n) throw new Error(`illegal move ${c}`);
    s = n;
    j += `${c.toString(16).padStart(2, "0")}${u32Hex(stateHash(G, s))}\n`;
  }
  return j;
}

function villageSave(): string {
  const v = emptyV();
  v.pd = ALL_DAILIES.map(dayOf).sort((x, y) => x - y);
  const inp: VillageInput = { cleared: { gentle: HOUSE - 1, deduce: 0 }, dailyDates: ALL_DAILIES, v, today };
  // every mail opened except the move-in letter from Pip: one unread letter waits
  const all = mails(inp);
  const keep = all.find((m) => m.kind === "moveIn" && m.sender === "pip") ?? all[all.length - 1]!;
  v.lr = all.filter((m) => m.id !== keep.id).map((m) => m.id).sort((x, y) => x - y);
  // the cottage: the starter room plus every owned piece in its preferred slot
  let room = starterRoom();
  const own = owned({ ...inp, v });
  const used = placedBits(room);
  for (const bit of own) {
    if (used.has(bit)) continue;
    const slot = autoSlot(room, bit);
    if (slot < 0) continue;
    const next = place(room, slot, bit);
    if (next) {
      room = next;
      used.add(bit);
    }
  }
  room.wallpaper = 1;
  const moved = residents({ ...inp, v }).filter((r) => r.movedIn).length;
  if (moved !== 7) throw new Error(`world: ${moved} residents moved in, want 7`); // the 04 shot shows all of them
  v.r[COTTAGE] = { s: encodeRoom(room), n: 1, at: Date.now() - 3_600_000, dev: "store000" };
  const loc = { mail: {}, ld: null, seen: {}, once: ["host:firstVillageVisit", ...["sage", "luna", "pip", "kuri", "yuki"].map((r) => `host:movedIn:${r}`), ...["mail", "eve", "market"].map((k) => `host:${k}:${dayOf(today)}`)], season: seasonOf(new Date().getMonth() + 1, hemisphereOf(regionOf(LOCALES[a.lang!]?.[0]))), lastVisit: dayOf(shift(-1)), visits: 6, talk: { day: 0, n: {} }, fresh: [], ret: null };
  return JSON.stringify({ sv: v, loc });
}

function seed(state: string): void {
  try {
    sh("xcrun", ["simctl", "terminate", dev, BUNDLE]);
  } catch {
    /* not running */
  }
  const container = sh("xcrun", ["simctl", "get_app_container", dev, BUNDLE, "data"]);
  const lib = join(container, "Library", "lanternly");
  rmSync(lib, { recursive: true, force: true });
  mkdirSync(lib, { recursive: true });
  const plist = join(container, "Library", "Preferences", BUNDLE);
  try {
    sh("xcrun", ["simctl", "spawn", dev, "defaults", "delete", plist]);
  } catch {
    /* fresh */
  }
  const pref = (k: string, v: string): void => void sh("xcrun", ["simctl", "spawn", dev, "defaults", "write", plist, `CapacitorStorage.${k}`, "-string", v]);
  const now = Date.now();
  pref("guide", "511");
  for (const k of ["dailyIntro", "dailyOffer", "shieldIntro"]) pref(k, "1");
  pref("sessions", "9");
  pref("rating", JSON.stringify({ v: 1, asks: [now - 86_400_000] })); // no review prompt in a shot
  pref("notify", JSON.stringify({ v: 1, on: false, asked: "denied", ignored: 0, planned: [], tapped: [] }));
  pref("village", villageSave());

  const daily = state.startsWith("daily");
  const streakLast = shift(-1);
  pref("streak", JSON.stringify({ v: 1, last: streakLast, streak: PAST_DAILIES.length, best: OLD_DAILIES.length, shields: {} }));
  writeFileSync(join(lib, "pips-daily-log.json"), JSON.stringify({ v: 1, days: Object.fromEntries(ALL_DAILIES.map((d, i) => [d, { at: Date.parse(`${d}T20:${10 + i}:00`), ms: 150_000 + (i % 7) * 21_000, hints: 0, undos: 0 }])) }));

  // the street board
  const tl = levelForTrack("gentle", HOUSE);
  const boardMoves: Record<string, (l: PipsLevel) => number[]> = {
    world: () => [], "board-mid": midMoves, "rule-light": lightMoves, "rule-conflict": conflictMoves, "rule-number": numberMoves,
  };
  const bm = daily ? [] : (boardMoves[state] ?? (() => { throw new Error(`unknown state ${state}`); }))(tl);
  writeFileSync(join(lib, "pips-gentle-journal.log"), journal(`PPJ1 ${u32Hex(levelIdFor("gentle", HOUSE))} ${seedKeyFor("gentle", HOUSE)}\n`, tl, bm));
  const prog: Record<string, unknown> = { v: 3, game: "pips", track: "gentle", gentle: { level: HOUSE, cleared: HOUSE - 1, hints: 0 }, deduce: { level: 1, cleared: 0, hints: 0 } };
  if (daily) {
    const dl = levelForDaily(today);
    const p = dailyParams(today);
    const dm = state === "daily-done" ? sol(dl) : sol(dl).slice(0, 3);
    writeFileSync(join(lib, "pips-daily-journal.log"), journal(`PPJ1 ${u32Hex(p.levelId >>> 0)} ${p.seedKey}\n`, dl, dm));
    prog.daily = today;
    pref("daily", JSON.stringify({ date: today, ms: state === "daily-done" ? 184_000 : 40_000, hints: 0, undos: 0, result: null }));
  }
  writeFileSync(join(lib, "pips-progress.json"), JSON.stringify(prog));
  const [lang, loc] = LOCALES[a.lang!] ?? (() => { throw new Error(`unknown lang ${a.lang}`); })();
  sh("xcrun", ["simctl", "launch", dev, BUNDLE, "-AppleLanguages", `(${lang})`, "-AppleLocale", loc]);
  console.log(`seeded ${state} (${a.lang}) house ${HOUSE} ${tl.w}x${tl.h}, ${bm.length} lanterns${daily ? ` + daily ${today}` : ""}`);
}

function grab(name: string): void {
  const dir = resolve(a.out!, a.lang!);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${name}.png`);
  sh("xcrun", ["simctl", "io", dev, "screenshot", "--type=png", file]);
  console.log(file);
}

if (cmd === "seed" && arg) seed(arg);
else if (cmd === "grab" && arg) grab(arg);
else {
  console.error("usage: store-shots.ts seed <state> | grab <name>  [--lang xx] [--device udid]");
  process.exit(2);
}
