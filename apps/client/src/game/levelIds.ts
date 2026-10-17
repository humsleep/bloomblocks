// Client-side identity of a track level: the seed key written into run.bin and
// the journal header, and the u32 level id. No platform imports (the Node
// screenshot script uses it too).
import { type Track, trackSeedKey } from "./pipsApi.ts";

export function seedKeyFor(track: Track, n: number): string {
  return trackSeedKey(track, n);
}

/** gentle n → n, deduce n → 0x01000000 | n (distinct run.bin names / ids per track). */
export function levelIdFor(track: Track, n: number): number {
  return ((track === "deduce" ? 0x01000000 : 0) | n) >>> 0;
}
