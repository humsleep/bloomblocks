// Solved boards of the gentle track — the town's keepsake cards (tap a lit house → the board
// the player solved there). The session remembers each gentle level the moment it is solved,
// so the card shows at once instead of waiting for the generator (a late gentle level can take
// seconds to generate). Houses solved before this file existed are generated once by the town
// (in a worker) and remembered here too.
//
//   pips-gentle-solved.json   {v:1, rows: {"<n>": ["<row>", …]}}   temp + rename (pure speed-up:
//                             the generator is deterministic, a lost file only costs time)
// ≈ 80 bytes per house; the whole street fits in a few tens of KB.
import { levelRows, parseLevel } from "@games/lanterns-pips/level.ts";
import type { PipsLevel } from "../game/pipsApi.ts";
import { enqueue, readAtomicText, writeAtomic } from "./store.ts";

export const KEEPSAKES_FILE = "pips-gentle-solved.json";

const rows = new Map<number, string[]>();
const parsed = new Map<number, PipsLevel>();
let loaded: Promise<void> | null = null;
let dirty = false;

function parseFile(text: string | null): void {
  if (!text) return;
  try {
    const f = JSON.parse(text) as { v?: number; rows?: Record<string, unknown> };
    if (f.v !== 1 || !f.rows || typeof f.rows !== "object") return;
    for (const [k, r] of Object.entries(f.rows)) {
      const n = Number(k);
      if (!Number.isInteger(n) || n < 1 || rows.has(n) || !Array.isArray(r) || !r.every((x) => typeof x === "string")) continue;
      rows.set(n, r as string[]);
    }
  } catch {
    /* corrupt → start over (the generator can always rebuild a board) */
  }
}

/** Read the file once (later calls share the same promise). Never rejects. */
export function loadKeepsakes(): Promise<void> {
  loaded ??= readAtomicText(KEEPSAKES_FILE).then(parseFile, () => undefined);
  return loaded;
}

/** The solved board of gentle level `n`, when it is known (memory only: call loadKeepsakes first). */
export function keepsakeLevel(n: number): PipsLevel | null {
  const hit = parsed.get(n);
  if (hit) return hit;
  const r = rows.get(n);
  if (!r) return null;
  try {
    const lv = parseLevel(r);
    parsed.set(n, lv);
    return lv;
  } catch {
    rows.delete(n);
    return null;
  }
}

/** Remember gentle level `n` (solved, or generated for the town) and save the file in the background. */
export function rememberKeepsake(n: number, level: PipsLevel): void {
  if (!Number.isInteger(n) || n < 1) return;
  parsed.set(n, level);
  if (rows.has(n)) return;
  rows.set(n, levelRows(level));
  if (dirty) return; // one write already queued: it will carry this one too
  dirty = true;
  enqueue("keepsakes", async () => {
    await loadKeepsakes(); // merge with what is on disk before the first write
    dirty = false;
    const out: Record<string, string[]> = {};
    for (const n2 of [...rows.keys()].sort((a, b) => a - b)) out[String(n2)] = rows.get(n2)!;
    await writeAtomic(KEEPSAKES_FILE, JSON.stringify({ v: 1, rows: out }));
  });
}

/** Tests: forget everything in memory (the file stays). */
export function resetKeepsakes(): void {
  rows.clear();
  parsed.clear();
  loaded = null;
  dirty = false;
}
