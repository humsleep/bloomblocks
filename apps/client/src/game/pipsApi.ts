// The ONE module the client imports the pips rules API through. Everything
// else in src/ imports from here, never from @games/lanterns-pips directly.
//
// Contract (games/lanterns-pips/index.ts): levelForTrack · analyzeBoard · hintFor.
// Adapted deviations from the brief's contract:
//   - hintFor(level, state, lastMoveCell?, recent?) takes an optional toggle
//     history (oldest first) for its "most recently touched stone" tie-break;
//     a 'place' hint may carry ruledOut (T3) — not drawn (one anchor is enough).
//   - the seed key of a track level lives in tracks.ts (trackSeedKey, which
//     includes TRACK_GENERATOR_VERSION); index.ts does not re-export it.
//   - analyzeBoard marks a 0-stone "ok" from the first frame; the scene shows
//     it neutral until its neighbourhood is lit (LanternsScene.stoneView).
// Round-3 contract additions, normalised here so the scene only sees one shape:
//   - BoardAnalysis.blocked → blockedCells(): round 4 adds {lanterns, causes}
//     per entry; when the rules give them they are used, otherwise the same
//     read-out is computed here (lanterns lighting the cell's candidates).
//     Threads to stones only when 'stone' is a cause; lanterns when 'light' is.
//     blocked[].lanterns can include CORRECT lanterns; since round 5 the rules name the
//     one to blame themselves (BoardAnalysis.culprit) — culpritOf(a) reads it.
//   - DAILY_EPOCH / APP_NAME / dailyNumber / shareText / moonPhase from the rules
//     (moonPhase is 0..7 there; moonPhase() here maps it to [0, 1) for the sprite).
//     shareText drops "#n" while dailyNumber ≤ 0 (pre-launch, epoch 2026-11-01).
//   - Hint removeWrong {cells:[one], remaining}: documented deviation — `remaining`
//     counts the wrong lanterns in total, THIS one included. stepHint() turns it
//     into `remaining` = wrong lanterns left after this one (the beads on the button).
//   - startCells(level) (the visible opening lanterns) picks the first-run digit lesson.
// Round-5 contract (rules round 5): BoardAnalysis.culprit (ONE wrong lantern or null),
//   stuckStones [{stone, reason 'cannotReach'|'over', lanterns}], blocked[].culprits,
//   shareText(level, r, {showTime}). analyzeBoard takes the toggle history (session passes it).
//   The scene blames ONLY analysis.culprit (else blocked[].culprits[0]); with neither, the
//   stuck cells / stuck numbers get their marker and no thread at all.
import {
  analyzeBoard, APP_NAME, type BoardAnalysis, DAILY_EPOCH, type DailyResult, dailyLink, dailyNumber, hasBit, type Hint, hintFor, index, lanternsPips, levelForDaily,
  levelForTrack, moonPhase as moonPhase8, NO_CLUE, type PipsLevel, type PipsMove, type PipsState, type ShareOptions, shareText as rulesShareText, solutionOf,
  type StoneStatus, type StuckStone, type Track,
} from "@games/lanterns-pips/index.ts";

export {
  analyzeBoard, APP_NAME, type BoardAnalysis, DAILY_EPOCH, type DailyResult, dailyLink, dailyNumber, hasBit, type Hint, hintFor, index, lanternsPips, levelForDaily,
  levelForTrack, NO_CLUE, type PipsLevel, type PipsMove, type PipsState, type ShareOptions, solutionOf, type StoneStatus, type StuckStone, type Track,
};
export { dailyParams, isFinale, trackParams, trackSeedKey } from "@games/lanterns-pips/tracks.ts";
export { startCells } from "@games/lanterns-pips/generator.ts";

// ---------------------------------------------------------------- round-4 contract (daily / share)

/** Days since 1970-01-01 of an ISO date (UTC arithmetic, no time zone). */
export function isoDay(dateISO: string): number {
  const [y, m, d] = dateISO.split("-").map(Number) as [number, number, number];
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}
export function isoFromDay(day: number): string {
  return new Date(day * 86400000).toISOString().slice(0, 10);
}

export function mmss(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Moon phase in [0, 1) for the sky sprite, from the rules' 8-step phase (0 new, 4 full). */
export function moonPhase(dateISO: string): number {
  return moonPhase8(dateISO) / 8;
}

/**
 * The rules' share text (opts.showTime = the "show time in share" setting, default on).
 * Before DAILY_EPOCH (pre-launch testing) the daily number is ≤ 0; the "#n" is dropped then.
 */
export function shareText(level: PipsLevel, r: DailyResult, opts?: ShareOptions): string {
  const t = rulesShareText(level, r, opts ?? { showTime: true });
  const n = dailyNumber(r.dateISO);
  return n > 0 ? t : t.replace(` #${n}`, "");
}

/** The ONE lantern to blame when stuck: the rules' culprit, else the first blocked cell's culprit; -1 = none. */
export function culpritOf(a: BoardAnalysis): number {
  if (a.culprit !== null && a.culprit !== undefined) return a.culprit;
  for (const b of a.blocked) if (b.culprits.length > 0) return b.culprits[0]!;
  return -1;
}

/** Numbered stones that can no longer come right because they cannot reach their count (the ⊘ numbers). */
export function cannotReach(a: BoardAnalysis): StuckStone[] {
  return (a.stuckStones ?? []).filter((s) => s.reason === "cannotReach");
}

/** A dark floor cell no legal lantern can light any more, and everything that blocks it. */
export interface BlockedCell {
  cell: number;
  by: "light" | "stone";
  /** every kind of blocker present among the cell's candidates */
  causes: ReadonlyArray<"light" | "stone">;
  /** full numbered stones to thread to ('stone' in causes), nearest first */
  stones: number[];
  /** the player's lanterns whose light covers a candidate ('light' in causes), nearest thread first (may include correct ones) */
  lanterns: number[];
  /** per lanterns[k]: the candidate cell that lantern's light covers (the thread bends there) */
  via: number[];
  /** the rules' wrong lanterns involved (round 5) */
  culprits: number[];
}

/** removeWrong is one lantern at a time; `remaining` = wrong lanterns left after this one. */
export type StepHint =
  | { kind: "removeWrong"; cell: number; remaining: number }
  | { kind: "place"; cell: number; anchor: number }
  | { kind: "none" };

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Floor cells seen from i along its row/column runs (stopping at stones / the edge), i excluded. */
function runOf(level: PipsLevel, i: number): number[] {
  const out: number[] = [];
  for (const [dx, dy] of DIRS) {
    let x = (i & 7) + dx;
    let y = (i >> 3) + dy;
    while (x >= 0 && y >= 0 && x < level.w && y < level.h) {
      const j = index(x, y);
      if (hasBit(level.stones, j)) break;
      out.push(j);
      x += dx;
      y += dy;
    }
  }
  return out;
}

function neighboursOf(level: PipsLevel, i: number): number[] {
  const out: number[] = [];
  for (const [dx, dy] of DIRS) {
    const x = (i & 7) + dx;
    const y = (i >> 3) + dy;
    if (x >= 0 && y >= 0 && x < level.w && y < level.h) out.push(index(x, y));
  }
  return out;
}

const manhattan = (a: number, b: number): number => Math.abs((a & 7) - (b & 7)) + Math.abs((a >> 3) - (b >> 3));

/** Rules entry, round-4 shape when the rules provide it (lanterns + causes), round-3 shape otherwise. */
type RulesBlocked = BoardAnalysis["blocked"][number] & { lanterns?: number[]; causes?: Array<"light" | "stone">; culprits?: number[] };

/**
 * Blocked dark cells with their blockers. Round 3 only ever reported the stone
 * (every blocked cell touches a full number), but the real cause is usually the
 * player's own light covering the other cells that could have lit it — so the
 * lanterns lighting the cell's candidates are listed whenever 'light' is a cause.
 */
export function blockedCells(level: PipsLevel, state: PipsState, a: BoardAnalysis): BlockedCell[] {
  const full = new Set(a.stones.filter((s) => s.have >= s.need).map((s) => s.cell));
  const out: BlockedCell[] = [];
  for (const raw of a.blocked as RulesBlocked[]) {
    const c = raw.cell;
    const cands = [c, ...runOf(level, c)].filter((q) => !hasBit(state.lanterns, q));
    // local read-out (also the fallback when the rules give no causes / lanterns)
    const litCands = cands.filter((q) => a.lit[q] === 1);
    const lightLanterns = new Set<number>();
    for (const q of litCands) for (const l of [q, ...runOf(level, q)]) if (hasBit(state.lanterns, l)) lightLanterns.add(l);
    const stoneCands = cands.filter((q) => a.lit[q] !== 1 && neighboursOf(level, q).some((s) => full.has(s)));
    const causes: Array<"light" | "stone"> = raw.causes
      ? [...raw.causes]
      : [...(lightLanterns.size > 0 ? ["light" as const] : []), ...(stoneCands.length > 0 || raw.by === "stone" ? ["stone" as const] : [])];
    if (causes.length === 0) causes.push(raw.by);
    // lanterns: the rules' list if given, else ours; each with the candidate its light covers (nearest to c)
    const lan = causes.includes("light") ? (raw.lanterns ? [...raw.lanterns] : [...lightLanterns]) : [];
    const withVia = lan.map((l) => {
      const ray = new Set([l, ...runOf(level, l)]);
      const qs = cands.filter((q) => ray.has(q)).sort((x, y) => manhattan(x, c) - manhattan(y, c));
      const q = qs[0] ?? l;
      return { l, q, d: manhattan(c, q) + manhattan(q, l) };
    }).sort((x, y) => x.d - y.d);
    // stones: thread to the full stones touching the cell itself, or the nearest one
    let stones: number[] = [];
    if (causes.includes("stone")) {
      const all = new Set<number>(raw.stones);
      if (all.size === 0) for (const q of stoneCands) for (const s of neighboursOf(level, q)) if (full.has(s)) all.add(s);
      const near = [...all].filter((st) => manhattan(st, c) === 1);
      stones = (near.length > 0 ? near : [...all].sort((x, y) => manhattan(x, c) - manhattan(y, c)).slice(0, 1))
        .sort((x, y) => manhattan(x, c) - manhattan(y, c)).slice(0, 3);
    }
    out.push({ cell: c, by: raw.by, causes, stones, lanterns: withVia.map((v) => v.l), via: withVia.map((v) => v.q), culprits: raw.culprits ? [...raw.culprits] : [] });
  }
  return out;
}

/** The rules' hint in the scene's one-lantern-at-a-time shape. */
export function stepHint(h: Hint): StepHint {
  if (h.kind === "removeWrong") {
    const cells = h.cells;
    if (cells.length === 0) return { kind: "none" };
    return { kind: "removeWrong", cell: cells[0]!, remaining: Math.max(0, h.remaining - 1) };
  }
  if (h.kind === "place") return { kind: "place", cell: h.cell, anchor: h.anchor };
  return { kind: "none" };
}

/** Floor cells a lantern on `cell` lights (itself included). */
export function raysOf(level: PipsLevel, cell: number): number[] {
  return [cell, ...runOf(level, cell)];
}

/**
 * Two floor cells that see each other (same run, no stone between), for the conflict lesson.
 * Never next to a 0 rock (a lantern there breaks the 0 — round 4: a tester caught it), and
 * preferably next to no numbered rock at all (so the only "not allowed" shown is the pair).
 */
export function seeingPair(level: PipsLevel, avoid: readonly number[] = []): [number, number] | null {
  const nextToNumber = (i: number): 0 | 1 | 2 => {
    let r: 0 | 1 | 2 = 0;
    for (const j of neighboursOf(level, i)) {
      if (!hasBit(level.stones, j) || level.clues[j] === NO_CLUE) continue;
      if (level.clues[j] === 0) return 2;
      r = 1;
    }
    return r;
  };
  let best: [number, number] | null = null;
  let bestD = 99;
  for (let i = 0; i < 64; i++) {
    if ((i & 7) >= level.w || i >> 3 >= level.h || hasBit(level.stones, i) || avoid.includes(i)) continue;
    const ni = nextToNumber(i);
    if (ni === 2) continue;
    for (const j of runOf(level, i)) {
      if (j <= i || avoid.includes(j)) continue;
      const nj = nextToNumber(j);
      if (nj === 2) continue;
      const d = Math.abs((j & 7) - (i & 7)) + Math.abs((j >> 3) - (i >> 3));
      // two or three cells apart reads best: clearly separate, clearly in line; away from numbers
      const score = Math.abs(d - 2.5) + (ni + nj) * 2;
      if (score < bestD) {
        bestD = score;
        best = [i, j];
      }
    }
  }
  return best;
}

/** Floor cells next to `stone` (for the 0-rock lesson). */
export function floorNeighbours(level: PipsLevel, stone: number): number[] {
  return neighboursOf(level, stone).filter((j) => !hasBit(level.stones, j));
}

/** R2 (A5): the toggled cell of every move, in order (the postcard's strip compares them, then drops them). */
export function moveCells(moves: readonly Uint8Array[]): number[] {
  return moves.map((m) => {
    const d = lanternsPips.decodeMove(m);
    return d ? index(d.x, d.y) : -1;
  });
}
