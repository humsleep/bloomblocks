// Daily freeze (decision A9): once shipped, no date's daily may ever change — old app builds,
// new builds and the web daily must all show the SAME board for #n, or shared results stop
// meaning anything. fixtures/lanterns-pips/daily-freeze.json pins levelForDaily for every day
// from DAILY_EPOCH on; tests/lanterns-pips/dailyFreeze.test.ts fails on any difference.
// The file is APPEND-ONLY: `npm run fixtures` never touches it; scripts/dailyFreeze.ts only
// extends it (or, deliberately, re-cuts the FUTURE — docs/lanterns-pips.md "데일리 고정").
import { fnv1a32 } from "../core/hash.ts";
import { DAILY_EPOCH, levelForDaily, levelRows } from "../games/lanterns-pips/index.ts";
import { DAILY_GENERATOR_VERSION } from "../games/lanterns-pips/tracks.ts";

export const FREEZE_FILE = "fixtures/lanterns-pips/daily-freeze.json";
/** Minimum number of pinned days (the CI floor; the file may hold more). */
export const FREEZE_MIN_DAYS = 400;

export interface FrozenDaily {
  /** daily number (#1 = DAILY_EPOCH) */
  n: number;
  date: string;
  /** the board as levelRows() joined by "/" — "." floor, "#" plain stone, "0".."4" numbered stone */
  rows: string;
  /** FNV-1a 32 (core/hash.ts) of the ASCII bytes of `rows`, 8 hex digits — for ports that only compare hashes */
  fnv: string;
}

export interface DailyFreeze {
  about: string;
  epoch: string;
  /** DAILY_GENERATOR_VERSION when each entry was pinned is not recorded per entry; this is the version at the last write */
  generatorVersion: number;
  days: number;
  /** FNV-1a 32 over all `rows` joined by "\n" (quick whole-file comparison) */
  fnvAll: string;
  dailies: FrozenDaily[];
}

const hex8 = (n: number): string => n.toString(16).padStart(8, "0");
const ascii = (s: string): Uint8Array => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);

/** UTC date arithmetic only (test / script side; never in rules code). */
export function dateAfterEpoch(k: number): string {
  const [y, m, d] = DAILY_EPOCH.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d) + k * 86_400_000).toISOString().slice(0, 10);
}

export function frozenDaily(k: number): FrozenDaily {
  const date = dateAfterEpoch(k);
  const rows = levelRows(levelForDaily(date)).join("/");
  return { n: k + 1, date, rows, fnv: hex8(fnv1a32(ascii(rows))) };
}

export function wrapFreeze(dailies: FrozenDaily[]): DailyFreeze {
  return {
    about:
      "Daily freeze (A9): levelForDaily for every pinned date. APPEND-ONLY — never regenerate. A generator change must leave every entry here unchanged; see docs/lanterns-pips.md (데일리 고정).",
    epoch: DAILY_EPOCH,
    generatorVersion: DAILY_GENERATOR_VERSION,
    days: dailies.length,
    fnvAll: hex8(fnv1a32(ascii(dailies.map((d) => d.rows).join("\n")))),
    dailies,
  };
}
