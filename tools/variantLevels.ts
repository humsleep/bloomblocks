// Rule variants for the blinded persona playtest (harness + depth pre-check).
//   N  current lanterns rules: no numbers, budget = exact minimum (levelForIndex).
//   E  "easy control": same rules and generator pipeline as N, but its own seed
//      stream and budget = minimum + 2 (deliberately too easy). No rules change:
//      only the level's budget field differs.
//   P  "pips": classic Akari, games/lanterns-pips (numbered stones, no budget),
//      round-1 free stream (pipsLevelForIndex).
//   PG pips gentle track, PD pips deduce track (games/lanterns-pips/tracks.ts);
//      `--variant P --track gentle|deduce` in the harness.
// Opaque codes for personas live in playtest/variants.json (round 1) and
// playtest/variants2.json (round 2) — never in PLAYTEST.md.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GENERATOR_VERSION, generate, levelForIndex, paramsForIndex } from "../games/lanterns/generator.ts";
import type { LanternsLevel } from "../games/lanterns/rules.ts";
import { pipsLevelForIndex } from "../games/lanterns-pips/generator.ts";
import type { PipsLevel } from "../games/lanterns-pips/rules.ts";
import { type Track, generatedForTrack } from "../games/lanterns-pips/tracks.ts";

export type Variant = "N" | "P" | "E" | "PG" | "PD";
export const VARIANTS: readonly Variant[] = ["N", "P", "E", "PG", "PD"];

/** Numbered-stone (pips) variants. */
export const isPips = (v: Variant): v is "P" | "PG" | "PD" => v === "P" || v === "PG" || v === "PD";

/** Pips variant for a track. */
export const trackVariant = (t: Track): "PG" | "PD" => (t === "gentle" ? "PG" : "PD");

/** Budget slack of the easy control. */
export const E_SLACK = 2;

export const RULE_TEXT: Readonly<Record<Variant, string>> = {
  N: "Light every cell. Lanterns can't see each other. Use at most the shown lanterns.",
  E: "Light every cell. Lanterns can't see each other. Use at most the shown lanterns.",
  P: "Light every cell. Lanterns can't see each other. A number on a rock = lanterns touching it.",
  PG: "Light every cell. Lanterns can't see each other. A number on a rock = lanterns touching it.",
  PD: "Light every cell. Lanterns can't see each other. A number on a rock = lanterns touching it.",
};

export type VariantLevel =
  | { variant: "N"; seedKey: string; levelId: number; tag: string; level: LanternsLevel; minLanterns: number }
  | { variant: "E"; seedKey: string; levelId: number; tag: string; level: LanternsLevel; minLanterns: number }
  | { variant: "P"; seedKey: string; levelId: number; tag: string; level: PipsLevel }
  | { variant: "PG"; seedKey: string; levelId: number; tag: string; level: PipsLevel }
  | { variant: "PD"; seedKey: string; levelId: number; tag: string; level: PipsLevel };

export function eSeedKey(n: number): string {
  return `lanterns:free-e:g${GENERATOR_VERSION}:${n}`;
}

/** Free-play level n of a variant. */
export function variantLevel(v: Variant, n: number): VariantLevel {
  if (v === "PG" || v === "PD") {
    const g = generatedForTrack(v === "PG" ? "gentle" : "deduce", n);
    const base = { seedKey: g.seedKey, levelId: g.levelId, tag: g.tag, level: g.level };
    return v === "PG" ? { variant: "PG", ...base } : { variant: "PD", ...base };
  }
  if (v === "P") {
    const g = pipsLevelForIndex(n);
    return { variant: "P", seedKey: g.seedKey, levelId: g.levelId, tag: g.tag, level: g.level };
  }
  if (v === "N") {
    const g = levelForIndex(n);
    return { variant: "N", seedKey: g.seedKey, levelId: g.levelId, tag: g.tag, level: g.level, minLanterns: g.meta.minLanterns };
  }
  // E: the N pipeline (tight band targeting) on its own seed, then two spare lanterns.
  const g = generate({ ...paramsForIndex(n), seedKey: eSeedKey(n), slack: 0 });
  return {
    variant: "E", seedKey: g.seedKey, levelId: g.levelId, tag: g.tag,
    level: { ...g.level, budget: g.meta.minLanterns + E_SLACK }, minLanterns: g.meta.minLanterns,
  };
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const CODES_FILE = join(ROOT, "playtest", "variants.json");
export const CODES2_FILE = join(ROOT, "playtest", "variants2.json");

/** Opaque code → variant of one codes file (default: round 1, playtest/variants.json). */
export function loadCodes(file = CODES_FILE): Record<string, Variant> {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return {};
  }
  const out: Record<string, Variant> = {};
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === "string" && (VARIANTS as readonly string[]).includes(v) && !(VARIANTS as readonly string[]).includes(k)) out[k] = v as Variant;
    }
  }
  return out;
}

/** Every known opaque code (round 1 + round 2). */
export function allCodes(): Record<string, Variant> {
  return { ...loadCodes(CODES_FILE), ...loadCodes(CODES2_FILE) };
}

/** Resolve "N" | "P" | "E" | "PG" | "PD" or an opaque code. null if unknown. */
export function resolveVariant(s: string, codes = allCodes()): Variant | null {
  const k = s.trim().toUpperCase();
  if ((VARIANTS as readonly string[]).includes(k)) return k as Variant;
  return codes[k] ?? null;
}
