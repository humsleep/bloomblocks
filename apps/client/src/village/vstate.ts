// The village's synced state: the compact `v` field of each device's iCloud KVS snapshot
// (docs/team/r2-village-design.md §3.1). Pure — no platform calls, no clock reads.
//
//   pd  days a board was lit (day numbers)      bits, OR
//   ch  days the player talked to a resident     bits, OR   (friendship)
//   lr  mail opened (mail ids, model.ts mailId)  bits, OR   (an opened gift is owned)
//   u   pieces from the market (catalog bits)    bits, OR
//   mk  days a market piece was picked (≤ 1 a day)  bits, OR
//   q   requests: bit 2·id asked, 2·id+1 done (catalog REQUESTS, 14)  bits, OR
//   w   watering days (1.1)                      bits, OR   (reserved)
//   cz  R4 rewards reached: 1–5 cozy levels,     bits, OR   (a reward never goes away)
//       10 + resident index = its lantern (friendship 3)
//   r   rooms: id → {s, n, at, dev}              last writer wins PER ROOM by (n, at, dev, s)
//
// Clock-rollback safety: a room edit carries a Lamport counter `n` = (highest n this device has
// seen for that room) + 1, and `at` = max(wall clock, last seen at + 1) (roomStamp). An edit made
// after seeing another one always wins, whatever the wall clocks say; `at` only orders truly
// concurrent edits (same n). Future `at`s are clamped to the merging device's `now` (as the
// settings are), which can only change the order of concurrent edits.
// Nothing is derived-and-stored: lit days, drops, jars, residents and friendship come from these
// bits plus the existing progress (model.ts).

export type Bits = number[];

/** A room record names its device by the first 8 chars of the id (a tie-break only; saves bytes). */
export const roomDev = (dev: string): string => dev.slice(0, 8);

export interface RoomRec {
  /** layout (model.ts encodeRoom): 40 base-36 chars */
  s: string;
  /** Lamport counter */
  n: number;
  /** wall clock of the edit (ms), monotonic per room on the editing device */
  at: number;
  dev: string;
}

export interface VState {
  pd: Bits;
  ch: Bits;
  lr: Bits;
  u: Bits;
  mk: Bits;
  q: Bits;
  w: Bits;
  cz: Bits;
  r: Record<string, RoomRec>;
}

export const BIT_KEYS = ["pd", "ch", "lr", "u", "mk", "q", "w", "cz"] as const;
export type BitKey = (typeof BIT_KEYS)[number];
/** rooms per device record (1.0 uses room 0, the cottage; 1.1 adds one per resident) */
export const MAX_ROOMS = 8;
const MAX_BITS = 40_000;
export const ROOM_RE = /^[0-9a-z]{40}$/;

export function emptyV(): VState {
  return { pd: [], ch: [], lr: [], u: [], mk: [], q: [], w: [], cz: [], r: {} };
}

export function isEmptyV(v: VState): boolean {
  return BIT_KEYS.every((k) => v[k].length === 0) && Object.keys(v.r).length === 0;
}

/** Sorted, unique, non-negative integers. */
export function normBits(xs: Iterable<number>): Bits {
  const s = new Set<number>();
  for (const x of xs) if (Number.isInteger(x) && x >= 0) s.add(x);
  return [...s].sort((a, b) => a - b);
}

export function unionBits(a: Bits, b: Bits): Bits {
  if (!b.length) return a.slice();
  if (!a.length) return b.slice();
  return normBits([...a, ...b]);
}

const cmp = (a: string | number, b: string | number): number => (a < b ? -1 : a > b ? 1 : 0);
export const cmpRoom = (a: RoomRec, b: RoomRec): number => cmp(a.n, b.n) || cmp(a.at, b.at) || cmp(a.dev, b.dev) || cmp(a.s, b.s);

/** Merge (commutative, idempotent for a fixed `now`). */
export function mergeV(xs: readonly (VState | undefined)[], now: number): VState {
  const out = emptyV();
  for (const x of xs) {
    if (!x) continue;
    for (const k of BIT_KEYS) out[k] = unionBits(out[k], x[k]);
    for (const [id, r] of Object.entries(x.r)) {
      const c = r.at > now ? { ...r, at: now } : r;
      const have = out.r[id];
      if (!have || cmpRoom(c, have) > 0) out.r[id] = { ...c };
    }
  }
  const r: Record<string, RoomRec> = {};
  for (const id of Object.keys(out.r).sort()) r[id] = out.r[id]!;
  out.r = r;
  return out;
}

/** `mine` already holds everything `other` has (prune check: a silent device's key may go). */
export function coversV(mine: VState, other: VState): boolean {
  for (const k of BIT_KEYS) {
    const have = new Set(mine[k]);
    if (!other[k].every((x) => have.has(x))) return false;
  }
  return Object.entries(other.r).every(([id, r]) => {
    const m = mine.r[id];
    return !!m && cmpRoom(m, r) >= 0;
  });
}

export function sameV(a: VState, b: VState): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * The stamp for a new edit of a room this device last saw as `prev` (merged state), at wall time
 * `now`: always after `prev`, even when the clock went backwards.
 */
export function roomStamp(prev: RoomRec | undefined, now: number): { n: number; at: number } {
  return { n: (prev?.n ?? 0) + 1, at: Math.max(now, (prev?.at ?? 0) + 1) };
}

// ---------------------------------------------------------------- wire form

/**
 * A bit set as "o.run.bits": o = smallest member (base 36), run = members o, o+1, … in a row
 * (base 36), bits = base64 of the members after that run (bit i = o + run + i). Days played in a
 * row and mail opened in order cost a few bytes; scattered ones ≈ 1 bit each.
 */
export function encodeBits(xs: Bits): string {
  if (!xs.length) return "";
  const o = xs[0]!;
  let run = 1;
  while (run < xs.length && xs[run] === o + run) run++;
  const base = o + run;
  const rest = xs.slice(run);
  let bin = "";
  if (rest.length) {
    const bytes = new Uint8Array(((rest.at(-1)! - base) >> 3) + 1);
    for (const x of rest) bytes[(x - base) >> 3]! |= 1 << ((x - base) & 7);
    for (const b of bytes) bin += String.fromCharCode(b);
  }
  return `${o.toString(36)}.${run.toString(36)}.${rest.length ? btoa(bin).replace(/=+$/, "") : ""}`;
}

export function decodeBits(s: unknown): Bits {
  if (typeof s !== "string" || !s) return [];
  const m = /^([0-9a-z]{1,8})\.([0-9a-z]{1,6})\.([A-Za-z0-9+/]*)$/.exec(s);
  if (!m) return [];
  const o = parseInt(m[1]!, 36);
  const run = Math.min(parseInt(m[2]!, 36), MAX_BITS);
  const out: number[] = [];
  for (let i = 0; i < run; i++) out.push(o + i);
  const b64 = m[3]!;
  if (b64) {
    let bin: string;
    try {
      bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    } catch {
      return out;
    }
    const base = o + run;
    for (let i = 0; i < bin.length * 8 && out.length < MAX_BITS; i++) if ((bin.charCodeAt(i >> 3) >> (i & 7)) & 1) out.push(base + i);
  }
  return out;
}

/** v on the wire: bit sets as strings (absent when empty), rooms as [id, s, n, at] (+ dev when not the writer's). */
export type VWire = Partial<Record<BitKey, string>> & { r?: Array<[string, string, string, string] | [string, string, string, string, string]> };

export function encodeV(v: VState, writer: string): VWire | null {
  if (isEmptyV(v)) return null;
  const w: VWire = {};
  for (const k of BIT_KEYS) if (v[k].length) w[k] = encodeBits(v[k]);
  const rooms = Object.entries(v.r).slice(0, MAX_ROOMS);
  if (rooms.length) {
    w.r = rooms.map(([id, r]) => {
      const base: [string, string, string, string] = [id, r.s, r.n.toString(36), r.at.toString(36)];
      return r.dev === roomDev(writer) ? base : [...base, r.dev];
    });
  }
  return w;
}

export function decodeV(w: unknown, writer: string): VState {
  const v = emptyV();
  if (!w || typeof w !== "object") return v;
  const o = w as Record<string, unknown>;
  for (const k of BIT_KEYS) v[k] = normBits(decodeBits(o[k]));
  if (Array.isArray(o["r"])) {
    for (const e of o["r"].slice(0, MAX_ROOMS)) {
      if (!Array.isArray(e) || e.length < 4) continue;
      const [id, s, n, at, dev] = e as unknown[];
      if (typeof id !== "string" || !/^[0-9]{1,2}$/.test(id) || typeof s !== "string" || !ROOM_RE.test(s)) continue;
      const nn = typeof n === "string" ? parseInt(n, 36) : NaN;
      const aa = typeof at === "string" ? parseInt(at, 36) : NaN;
      if (!Number.isFinite(nn) || nn < 1 || !Number.isFinite(aa) || aa < 0) continue;
      const d = roomDev(typeof dev === "string" && /^[a-z0-9]{8,32}$/.test(dev) ? dev : writer);
      v.r[id] = { s, n: nn, at: aa, dev: d };
    }
  }
  return v;
}
