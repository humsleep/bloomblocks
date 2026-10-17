// Dialogue line picker (docs/team/r2-village-narrative.md §3.2; selection rules in
// docs/team/r2-village-lines.en.json "selection"). Pure and deterministic: the same day, resident
// and talk index give the same line, so re-opening the village never re-rolls.
//   tap 1     the highest-priority active trigger
//   tap 2     the next active trigger after that one ("greet" first → then chat / season …)
//   tap 3     tap.again; after that the resident only smiles (null)
//   repeats   per resident, the last min(6, |pool| − 1) shown ids are left out (ring of 8, local)
//   once      move_in (each line once, in order), friend.level (each level once), host events
//   puzzle    only the first 2 residents talked to today get a puzzle line (7 cheering is too much)
// Time bands and hemisphere seasons are implemented here for 1.1; the 1.0 scene passes the dusk
// band and no season (owner's 4-week scope), and the shipped line set only has dusk greetings.
import type { ResidentId } from "./catalog.ts";

export type TimeBand = "dawn" | "day" | "dusk" | "night";
export type Season = "spring" | "summer" | "autumn" | "winter";
export type Hemisphere = "north" | "south";

export interface Line {
  id: string;
  r: ResidentId;
  t: string;
  c?: { time?: TimeBand; season?: Season; minLevel?: number; level?: number; requires?: string[]; event?: string; category?: string };
  /** English text; {cp} = the resident's catchphrase */
  x: string;
}

export const PRIORITY = ["move_in", "friend.level", "return", "event.first_snow", "request.visit", "puzzle.hard", "puzzle.solved", "request.ask", "request.again", "greet", "season", "chat"] as const;
export const NO_REPEAT_MAX = 6;
export const SEEN_KEEP = 8;
export const MAX_TAPS = 3;
export const PUZZLE_TALKERS = 2;

/** Device-local hour → band: dawn 05–09 · day 09–17 · dusk 17–21 · night 21–05. */
export function timeBandOf(hour: number): TimeBand {
  return hour >= 5 && hour < 9 ? "dawn" : hour >= 9 && hour < 17 ? "day" : hour >= 17 && hour < 21 ? "dusk" : "night";
}

/** Southern hemisphere regions (device region; Settings override in 1.1). */
const SOUTH = new Set(["AU", "NZ", "BR", "AR", "CL", "UY", "PY", "BO", "PE", "ZA", "LS", "SZ", "NA", "BW", "ZW", "MZ", "MG", "MU", "RE", "FJ", "NC", "PF", "WS", "TO"]);
export function hemisphereOf(region: string | null | undefined): Hemisphere {
  return region && SOUTH.has(region.toUpperCase()) ? "south" : "north";
}
/** The region of a BCP-47 tag ("en-NZ" → "NZ", "zh-Hant-TW" → "TW"), or null. */
export function regionOf(tag: string | null | undefined): string | null {
  const parts = (tag ?? "").replace(/_/g, "-").split("-");
  for (const p of parts.slice(1)) if (/^[A-Za-z]{2}$/.test(p)) return p.toUpperCase();
  return null;
}
/** Meteorological seasons: north Mar–May spring …; south shifted by six months. month = 1..12. */
export function seasonOf(month: number, h: Hemisphere): Season {
  const m = h === "south" ? ((month + 5) % 12) + 1 : month;
  return m >= 3 && m <= 5 ? "spring" : m >= 6 && m <= 8 ? "summer" : m >= 9 && m <= 11 ? "autumn" : "winter";
}

export interface PickCtx {
  day: number;
  time: TimeBand;
  season: Season | null;
  movedIn: ReadonlySet<ResidentId>;
  friendship: number;
  solvedToday: boolean;
  hardToday: boolean;
  /** first visit after ≥ 3 days away */
  returning: boolean;
  /** residents who already had a puzzle line today (this one excluded) */
  puzzleTalkers: number;
  /** this resident's puzzle line today was already said */
  puzzleSaid: boolean;
  /** 0-based tap on this resident during this visit */
  tap: number;
  /** the trigger used by the previous tap of this visit (tap 2 goes past it) */
  after?: string;
  /** lines this resident said today before (seed) */
  talkToday: number;
  /** this resident's recently shown ids, oldest first */
  seen: readonly string[];
  /** consumed once-only keys */
  once: ReadonlySet<string>;
  /** the request this resident would open now (model.nextAsk) */
  ask?: { cat: string } | null;
  /** this resident's open request, and whether it may be said again (not asked today) */
  open?: { cat: string; again: boolean } | null;
  /** the first snow (Dec 1 north / Jun 1 south) has come and not been seen this year */
  firstSnow?: boolean;
}

export interface Pick {
  line: Line;
  trigger: string;
  /** once-only key to remember (move_in / friend.level / return) */
  consume?: string;
}

/** FNV-1a of the parts (32-bit). */
export function seedOf(...parts: (string | number)[]): number {
  let h = 0x811c9dc5;
  for (const ch of parts.join("|")) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const onceKey = (l: Line): string | undefined =>
  l.t === "move_in" ? `move_in:${l.id}` : l.t === "friend.level" ? `friend:${l.id}` : l.t === "return" ? `return:${l.r}` : undefined;

function condOk(l: Line, x: PickCtx): boolean {
  const c = l.c;
  if (!c) return true;
  if (c.time && c.time !== x.time) return false;
  if (c.season && c.season !== x.season) return false;
  if (c.minLevel !== undefined && x.friendship < c.minLevel) return false;
  if (c.level !== undefined && x.friendship < c.level) return false;
  if (c.requires && !c.requires.every((r) => x.movedIn.has(r as ResidentId))) return false;
  if (c.category && c.category !== (x.ask?.cat ?? x.open?.cat)) return false;
  if (c.event) return false; // host events go through pickHost
  return true;
}

function active(t: string, x: PickCtx): boolean {
  switch (t) {
    case "move_in":
    case "friend.level":
    case "greet":
    case "chat":
      return true; // their pools decide (once-only filtering, conditions)
    case "return":
      return x.returning && x.tap === 0;
    case "puzzle.hard":
      return x.hardToday && !x.puzzleSaid && x.puzzleTalkers < PUZZLE_TALKERS;
    case "puzzle.solved":
      return x.solvedToday && !x.puzzleSaid && x.puzzleTalkers < PUZZLE_TALKERS;
    case "season":
      return x.season !== null;
    case "request.ask":
      return !!x.ask && x.tap === 0;
    case "request.again":
      return !!x.open?.again && x.tap === 0;
    case "event.first_snow":
      return !!x.firstSnow;
    default:
      return false; // request.visit: in the cottage (pickVisit)
  }
}

function choose(pool: readonly Line[], x: PickCtx, r: ResidentId, salt: string): Line {
  const keep = Math.min(NO_REPEAT_MAX, Math.max(0, pool.length - 1));
  const recent = new Set(x.seen.slice(-keep));
  const fresh = keep > 0 ? pool.filter((l) => !recent.has(l.id)) : pool.slice();
  const from = fresh.length ? fresh : pool;
  return from[seedOf(x.day, r, x.talkToday, salt) % from.length]!;
}

/** The next line for resident `r`, or null (the resident only smiles). */
export function pickLine(lines: readonly Line[], r: ResidentId, x: PickCtx): Pick | null {
  if (x.tap >= MAX_TAPS) return null;
  const mine = lines.filter((l) => l.r === r);
  if (x.tap === MAX_TAPS - 1) {
    const pool = mine.filter((l) => l.t === "tap.again" && condOk(l, x));
    return pool.length ? { line: choose(pool, x, r, "tap"), trigger: "tap.again" } : null;
  }
  // tap 2 goes past tap 1's trigger — except a move-in, whose lines come one per tap, in order
  const at = x.after ? PRIORITY.indexOf(x.after as (typeof PRIORITY)[number]) : -1;
  const start = at < 0 ? 0 : x.after === "move_in" ? at : at + 1;
  for (const t of PRIORITY.slice(Math.max(0, start))) {
    if (!active(t, x)) continue;
    const pool = mine.filter((l) => l.t === t && condOk(l, x));
    if (t === "move_in" || t === "friend.level") {
      // once each, in order
      const next = pool.find((l) => !x.once.has(onceKey(l)!));
      if (!next) continue;
      return { line: next, trigger: t, consume: onceKey(next)! };
    }
    if (t === "return" && x.once.has(`return:${r}:${x.day}`)) continue;
    if (t === "event.first_snow") {
      const l = pool.find((p) => !x.once.has(`snow:${p.id}:${Math.floor(x.day / 365)}`));
      if (l) return { line: l, trigger: t, consume: `snow:${l.id}:${Math.floor(x.day / 365)}` };
      continue;
    }
    if (!pool.length) continue;
    const line = choose(pool, x, r, t);
    return { line, trigger: t, ...(t === "return" ? { consume: `return:${r}:${x.day}` } : {}) };
  }
  return null;
}

/** Wick's host line for one piece of news (once each event; firstVillageVisit has two, in order). */
export function pickHost(lines: readonly Line[], event: string, once: ReadonlySet<string>): Pick | null {
  const pool = lines.filter((l) => l.r === "wick" && l.t === "host" && l.c?.event === event);
  const firstOnly = event === "firstVillageVisit" || event === "firstCabinVisit";
  const next = firstOnly ? pool.find((l) => !once.has(`host:${l.id}`)) : pool[0];
  return next ? { line: next, trigger: "host", ...(firstOnly ? { consume: `host:${next.id}` } : {}) } : null;
}

/** The line ring after showing `id` (oldest dropped beyond SEEN_KEEP). */
export function pushSeen(seen: readonly string[], id: string): string[] {
  return [...seen.filter((s) => s !== id), id].slice(-SEEN_KEEP);
}

/** Letter / tag lines for a mail. */
export function letterLine(lines: readonly Line[], r: ResidentId, kind: "letter.move_in" | "letter.gift" | "letter.return" | "gift.tag", seed: number): Line | null {
  const pool = lines.filter((l) => l.r === r && l.t === kind);
  return pool.length ? pool[seed % pool.length]! : null;
}

/** A visitor in the cottage (a fulfilled request): its request.visit line. */
export function pickVisit(lines: readonly Line[], r: ResidentId): Pick | null {
  const l = lines.find((x) => x.r === r && x.t === "request.visit");
  return l ? { line: l, trigger: "request.visit" } : null;
}

/** Days from 1 Dec (north) / 1 Jun (south) until the end of that winter's first month count as "first snow" (1.0 approximation). */
export function firstSnowSeason(month: number, h: Hemisphere): boolean {
  return h === "south" ? month === 6 : month === 12;
}
