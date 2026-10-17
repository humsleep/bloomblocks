// Depth pre-check (no personas) for rule variants N / P / E on free-play levels.
//
// Bots, all "first try" = one pass, no undo, no restart:
//   random     tap a uniformly random still-dark cell until every cell is lit
//              (never a conflict); success = the board is complete
//              (N/E: within budget; P: every number matched).
//   heuristic  the one-line rule: take the hardest-to-light dark cell (fewest
//              positions that could light it; ties random) and put a lantern on
//              one of those positions; repeat until all lit; success = complete.
//              "Which position" is ambiguous in the rule text, so three readings
//              run and the BEST one counts (conservative toward failing):
//                gain  the position lighting the most dark cells,
//                tight the position that is itself hardest to light (fewest
//                      alternatives = lights the fewest dark cells),
//                lcv   least-constraining: removes the fewest candidate positions
//                      from the other dark cells,
//                self  the hardest-to-light cell itself (if it may hold one;
//                      else as gain).
//              (ties random).
//   heuristic+ (P only) the same family, but never on a cell that would push a
//              visible number over its count. The P verdict uses the best of
//              heuristic and heuristic+, so P is not credited for a bot that
//              simply ignores the numbers.
//   t1+heur    (P only, informational) apply the obvious number rule (T1) whenever
//              it fires, else one heuristic+ "gain" placement; one pass. Shows how
//              far "just read the numbers" gets without T2/T3.
// Variants: N, P (round-1 pips stream), E, PG / PD (pips gentle / deduce tracks).
//   human      the human-like bot time (N/E: games/lanterns/human.ts +
//              TIME_MODEL; P: games/lanterns-pips/deduce.ts + PIPS_TIME).
// Pre-registered rule: heuristic first-try success ≥ 70% on levels 11–30 →
// the variant FAILS for depth.

import { Rng } from "../core/rng.ts";
import { TIME_MODEL, traceSeconds } from "../games/lanterns/generator.ts";
import { humanSolve } from "../games/lanterns/human.ts";
import { type Rays, buildRays, low32, pop32 } from "../games/lanterns/solver.ts";
import { allLit, applyDeduction, broken, emptyBoard, findT1, pipsHumanSolve, pipsTraceSeconds, place } from "../games/lanterns-pips/deduce.ts";
import { type PipsModel, buildModel } from "../games/lanterns-pips/solver.ts";
import { percentile } from "../sim/stats.ts";
import { type Variant, type VariantLevel, isPips, variantLevel } from "../tools/variantLevels.ts";

export const DEPTH_FAIL_PERCENT = 70;
export const GIVE_UP = 300;

function bits(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let t = lo >>> 0; t !== 0; t = (t & (t - 1)) >>> 0) out.push(low32(t));
  for (let t = hi >>> 0; t !== 0; t = (t & (t - 1)) >>> 0) out.push(low32(t) + 32);
  return out;
}

/** Clue check for a P level: every numbered stone exact. */
function cluesOk(m: PipsModel, pLo: number, pHi: number): boolean {
  for (let k = 0; k < m.clueCell.length; k++) {
    const p = pop32((m.adjLo[k]! & pLo) >>> 0) + pop32((m.adjHi[k]! & pHi) >>> 0);
    if (p !== m.clueVal[k]) return false;
  }
  return true;
}

/** Would a lantern on q push an adjacent number over its count? */
function overfills(m: PipsModel, pLo: number, pHi: number, q: number): boolean {
  for (let k = 0; k < m.clueCell.length; k++) {
    const inAdj = q < 32 ? (m.adjLo[k]! >>> q) & 1 : (m.adjHi[k]! >>> (q - 32)) & 1;
    if (inAdj === 0) continue;
    const p = pop32((m.adjLo[k]! & pLo) >>> 0) + pop32((m.adjHi[k]! & pHi) >>> 0);
    if (p + 1 > m.clueVal[k]!) return true;
  }
  return false;
}

type Policy = "random" | "heuristic";
export const PICKS = ["gain", "tight", "lcv", "self"] as const;
export type Pick = (typeof PICKS)[number];

/**
 * One first-try pass. Returns { lanterns, lit-all } as words; the caller judges success.
 * `allowed(q, pLo, pHi)` filters positions (heuristic+).
 */
function onePass(r: Rays, rng: Rng, policy: Policy, allowed: ((q: number, pLo: number, pHi: number) => boolean) | null, pick: Pick = "gain"): { pLo: number; pHi: number; allLit: boolean } {
  let pLo = 0;
  let pHi = 0;
  let dLo = r.floorLo;
  let dHi = r.floorHi;
  for (let guard = 0; guard < 64 && (dLo | dHi) !== 0; guard++) {
    let q = -1;
    if (policy === "random") {
      const dark = bits(dLo, dHi);
      q = dark[rng.nextInt(dark.length)]!;
    } else {
      // Hardest-to-light dark cell: fewest positions (dark cells of its runs) that could light it.
      let bestN = 99;
      let bestCands: number[] = [];
      const ties: number[][] = [];
      const cellOf: number[] = [];
      for (const c of bits(dLo, dHi)) {
        let cands = bits((r.lo[c]! & dLo) >>> 0, (r.hi[c]! & dHi) >>> 0);
        if (allowed) cands = cands.filter((x) => allowed(x, pLo, pHi));
        if (cands.length === 0) continue;
        if (cands.length < bestN) {
          bestN = cands.length;
          bestCands = cands;
          ties.length = 0;
          cellOf.length = 0;
          ties.push(cands);
          cellOf.push(c);
        } else if (cands.length === bestN) {
          ties.push(cands);
          cellOf.push(c);
        }
      }
      if (ties.length === 0) break; // nothing allowed lights the rest: the pass ends unfinished
      const ti = rng.nextInt(ties.length);
      bestCands = ties[ti]!;
      if (pick === "self" && cellOf[ti]! >= 0 && bestCands.includes(cellOf[ti]!)) {
        q = cellOf[ti]!;
        if (q < 32) pLo = (pLo | (1 << q)) >>> 0;
        else pHi = (pHi | (1 << (q - 32))) >>> 0;
        dLo = (dLo & ~r.lo[q]!) >>> 0;
        dHi = (dHi & ~r.hi[q]!) >>> 0;
        continue;
      }
      // Score each position (higher = preferred; ties random).
      const score = (x: number): number => {
        const gain = pop32((r.lo[x]! & dLo) >>> 0) + pop32((r.hi[x]! & dHi) >>> 0);
        if (pick === "gain" || pick === "self") return gain;
        if (pick === "tight") return -gain;
        // lcv: candidate positions taken away from dark cells that x leaves dark.
        let lost = 0;
        const xLo = r.lo[x]!;
        const xHi = r.hi[x]!;
        for (const d of bits((dLo & ~xLo) >>> 0, (dHi & ~xHi) >>> 0)) {
          lost += pop32((r.lo[d]! & xLo & dLo) >>> 0) + pop32((r.hi[d]! & xHi & dHi) >>> 0);
        }
        return -lost;
      };
      let g1 = -1000;
      const top: number[] = [];
      for (const x of bestCands) {
        const g = score(x);
        if (g > g1) {
          g1 = g;
          top.length = 0;
          top.push(x);
        } else if (g === g1) top.push(x);
      }
      q = top[rng.nextInt(top.length)]!;
    }
    if (q < 32) pLo = (pLo | (1 << q)) >>> 0;
    else pHi = (pHi | (1 << (q - 32))) >>> 0;
    dLo = (dLo & ~r.lo[q]!) >>> 0;
    dHi = (dHi & ~r.hi[q]!) >>> 0;
  }
  return { pLo, pHi, allLit: (dLo | dHi) === 0 };
}

/** P only: T1 when available, else the number-respecting gain heuristic. First try, no undo. */
function t1HeuristicPass(m: PipsModel, rng: Rng): boolean {
  const r = m.r;
  const b = emptyBoard();
  for (let guard = 0; guard < 128; guard++) {
    if (broken(m, b)) return false;
    if (allLit(m, b)) return cluesOk(m, b.pLo, b.pHi);
    const d1 = findT1(m, b);
    if (d1.length > 0) {
      applyDeduction(m, b, d1[rng.nextInt(d1.length)]!);
      continue;
    }
    const aLo = (r.floorLo & ~b.lLo & ~b.mLo) >>> 0;
    const aHi = (r.floorHi & ~b.lHi & ~b.mHi) >>> 0;
    const dLo = (r.floorLo & ~b.lLo) >>> 0;
    const dHi = (r.floorHi & ~b.lHi) >>> 0;
    let bestN = 99;
    const ties: number[][] = [];
    for (const c of bits(dLo, dHi)) {
      const cands = bits((r.lo[c]! & aLo) >>> 0, (r.hi[c]! & aHi) >>> 0).filter((q) => !overfills(m, b.pLo, b.pHi, q));
      if (cands.length === 0) continue;
      if (cands.length < bestN) {
        bestN = cands.length;
        ties.length = 0;
      }
      if (cands.length === bestN) ties.push(cands);
    }
    if (ties.length === 0) return false;
    const cands = ties[rng.nextInt(ties.length)]!;
    let g1 = -1;
    const top: number[] = [];
    for (const x of cands) {
      const g = pop32((r.lo[x]! & dLo) >>> 0) + pop32((r.hi[x]! & dHi) >>> 0);
      if (g > g1) {
        g1 = g;
        top.length = 0;
      }
      if (g === g1) top.push(x);
    }
    place(m, b, top[rng.nextInt(top.length)]!);
  }
  return false;
}

export interface LevelDepth {
  n: number;
  size: string;
  tag: string;
  /** First-try success, ‰ of runs. */
  random: number;
  /** Heuristic first-try success per reading (‰). */
  heuristic: Record<Pick, number>;
  /** P only: number-respecting heuristic per reading (‰); N/E: same as heuristic. */
  heuristicPlus: Record<Pick, number>;
  /** P only: T1 + heuristic first-try success (‰); -1 for N/E. */
  t1Heur: number;
  /** Human-like bot: median / p90 estimated seconds, completion %. */
  humanMedian: number;
  humanP90: number;
  humanDone: number;
  /** N/E: budget − minimum; P: number of numbered stones. */
  extra: number;
}

const zeroPicks = (): Record<Pick, number> => ({ gain: 0, tight: 0, lcv: 0, self: 0 });

export function levelDepth(v: VariantLevel, n: number, runs: number, humanRuns: number): LevelDepth {
  const level = v.level;
  const r = buildRays(level);
  let random = 0;
  let t1h = 0;
  const heur = zeroPicks();
  const heurPlus = zeroPicks();
  const human: number[] = [];
  let humanDone = 0;
  const key = `depth:${v.variant}:${n}`;
  if (v.variant === "P" || v.variant === "PG" || v.variant === "PD") {
    const m = buildModel(v.level);
    const okP = (x: { pLo: number; pHi: number; allLit: boolean }): boolean => x.allLit && cluesOk(m, x.pLo, x.pHi);
    const legal = (q: number, a: number, b: number): boolean => !overfills(m, a, b, q);
    for (let k = 0; k < runs; k++) {
      if (okP(onePass(r, Rng.from(`${key}:random:${k}`), "random", null))) random++;
      if (t1HeuristicPass(m, Rng.from(`${key}:t1heur:${k}`))) t1h++;
      for (const pk of PICKS) {
        if (okP(onePass(r, Rng.from(`${key}:heur:${pk}:${k}`), "heuristic", null, pk))) heur[pk]++;
        if (okP(onePass(r, Rng.from(`${key}:heur+:${pk}:${k}`), "heuristic", legal, pk))) heurPlus[pk]++;
      }
    }
    for (let k = 0; k < humanRuns; k++) {
      const t = pipsHumanSolve(v.level, { rng: Rng.from(`${key}:human:${k}`), record: false }, m);
      if (t.completed) humanDone++;
      human.push(t.completed ? Math.min(pipsTraceSeconds(t), GIVE_UP) : GIVE_UP);
    }
    let clues = 0;
    for (let i = 0; i < 64; i++) if (v.level.clues[i] !== 255) clues++;
    return finish(n, v, random, heur, heurPlus, runs, human, humanDone, clues, t1h);
  }
  const budget = v.level.budget;
  const okN = (x: { pLo: number; pHi: number; allLit: boolean }): boolean => x.allLit && pop32(x.pLo) + pop32(x.pHi) <= budget;
  for (let k = 0; k < runs; k++) {
    if (okN(onePass(r, Rng.from(`${key}:random:${k}`), "random", null))) random++;
    for (const pk of PICKS) if (okN(onePass(r, Rng.from(`${key}:heur:${pk}:${k}`), "heuristic", null, pk))) heur[pk]++;
  }
  for (let k = 0; k < humanRuns; k++) {
    const t = humanSolve(v.level, { rng: Rng.from(`${key}:human:${k}`), lookahead: true, maxActions: 400, record: false }, r);
    if (t.completed) humanDone++;
    human.push(t.completed ? Math.min(traceSeconds(t, TIME_MODEL), GIVE_UP) : GIVE_UP);
  }
  return finish(n, v, random, heur, { ...heur }, runs, human, humanDone, budget - v.minLanterns, -1);
}

function finish(
  n: number, v: VariantLevel, random: number, heur: Record<Pick, number>, heurPlus: Record<Pick, number>, runs: number,
  human: number[], done: number, extra: number, t1h: number,
): LevelDepth {
  human.sort((a, b) => a - b);
  const pm = (x: number): number => Math.round((1000 * x) / runs);
  const pms = (h: Record<Pick, number>): Record<Pick, number> => ({ gain: pm(h.gain), tight: pm(h.tight), lcv: pm(h.lcv), self: pm(h.self) });
  return {
    n, size: `${v.level.w}x${v.level.h}`, tag: v.tag, random: pm(random), heuristic: pms(heur), heuristicPlus: pms(heurPlus), t1Heur: t1h < 0 ? -1 : pm(t1h),
    humanMedian: percentile(human, 50)!, humanP90: percentile(human, 90)!, humanDone: Math.round((100 * done) / human.length), extra,
  };
}

export interface Span {
  /** Mean first-try success (%) over levels from..to / lateFrom..to (one decimal). */
  all: number;
  late: number;
}

export interface VariantDepth {
  variant: Variant;
  levels: LevelDepth[];
  random: Span;
  /** P only (else all = late = -1). */
  t1Heur: Span;
  heuristic: Record<Pick, Span>;
  heuristicPlus: Record<Pick, Span>;
  /** Verdict input: best reading of heuristic / heuristic+ on 11–30 (%). */
  verdictHeuristicLate: number;
  verdictReading: string;
  human: { medianOfMedians: number; p90OfMedians: number; done: number };
  failsDepth: boolean;
  seconds: number;
}

const meanPct = (ls: LevelDepth[], f: (l: LevelDepth) => number): number =>
  ls.length === 0 ? 0 : Math.round(ls.reduce((s, l) => s + f(l), 0) / ls.length) / 10;

export function variantDepth(v: Variant, from = 1, to = 30, runs = 200, humanRuns = 64, lateFrom = 11): VariantDepth {
  const t0 = performance.now();
  const levels: LevelDepth[] = [];
  for (let n = from; n <= to; n++) levels.push(levelDepth(variantLevel(v, n), n, runs, humanRuns));
  const late = levels.filter((l) => l.n >= lateFrom);
  const span = (f: (l: LevelDepth) => number): Span => ({ all: meanPct(levels, f), late: meanPct(late, f) });
  const heuristic = Object.fromEntries(PICKS.map((pk) => [pk, span((l) => l.heuristic[pk])])) as Record<Pick, Span>;
  const heuristicPlus = Object.fromEntries(PICKS.map((pk) => [pk, span((l) => l.heuristicPlus[pk])])) as Record<Pick, Span>;
  let verdictHeuristicLate = -1;
  let verdictReading = "";
  for (const pk of PICKS) {
    if (heuristic[pk].late > verdictHeuristicLate) [verdictHeuristicLate, verdictReading] = [heuristic[pk].late, pk];
    if (isPips(v) && heuristicPlus[pk].late > verdictHeuristicLate) [verdictHeuristicLate, verdictReading] = [heuristicPlus[pk].late, `${pk}+`];
  }
  const meds = levels.map((l) => l.humanMedian).sort((a, b) => a - b);
  return {
    variant: v, levels, random: span((l) => l.random), t1Heur: isPips(v) ? span((l) => l.t1Heur) : { all: -1, late: -1 }, heuristic, heuristicPlus, verdictHeuristicLate, verdictReading,
    human: { medianOfMedians: percentile(meds, 50)!, p90OfMedians: percentile(meds, 90)!, done: Math.round(levels.reduce((s, l) => s + l.humanDone, 0) / levels.length) },
    failsDepth: verdictHeuristicLate >= DEPTH_FAIL_PERCENT,
    seconds: Math.round((performance.now() - t0) / 1000),
  };
}

export function formatDepth(rs: readonly VariantDepth[], perLevel: boolean): string {
  const out: string[] = [];
  const h = (x: Record<Pick, Span>, w: "all" | "late"): string => PICKS.map((pk) => `${x[pk][w]}`).join(" / ");
  out.push("| variant | random first-try 1–30 / 11–30 | heuristic gain/tight/lcv/self 1–30 | heuristic gain/tight/lcv/self 11–30 | heuristic+ (numbers respected) 11–30 | T1+heuristic 1–30 / 11–30 | human-like median of level medians (p90) | verdict: best heuristic on 11–30 ≥ 70% → FAIL |");
  out.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const r of rs) {
    const hp = isPips(r.variant) ? `${h(r.heuristicPlus, "late")} %` : "–";
    const th = isPips(r.variant) ? `${r.t1Heur.all}% / ${r.t1Heur.late}%` : "–";
    out.push(`| ${r.variant} | ${r.random.all}% / ${r.random.late}% | ${h(r.heuristic, "all")} % | ${h(r.heuristic, "late")} % | ${hp} | ${th} | ${r.human.medianOfMedians} s (${r.human.p90OfMedians} s), done ${r.human.done}% | ${r.failsDepth ? "FAIL" : "pass"} (${r.verdictHeuristicLate}%, ${r.verdictReading}) |`);
  }
  if (perLevel) {
    for (const r of rs) {
      out.push("", `${r.variant}: n size tag | random‰ | heur‰ ${PICKS.join(" ")} | heur+‰ ${PICKS.join(" ")} | t1+heur‰ | human median/p90 s done% | ${isPips(r.variant) ? "clues" : "spare"}`);
      for (const l of r.levels) {
        const f = (x: Record<Pick, number>): string => PICKS.map((pk) => String(x[pk]).padStart(4)).join(" ");
        out.push(`  ${String(l.n).padStart(2)} ${l.size} ${l.tag.padEnd(5)} | ${String(l.random).padStart(4)} | ${f(l.heuristic)} | ${f(l.heuristicPlus)} | ${String(l.t1Heur).padStart(4)} | ${l.humanMedian}/${l.humanP90} ${l.humanDone}% | ${l.extra}`);
      }
    }
  }
  return out.join("\n");
}
