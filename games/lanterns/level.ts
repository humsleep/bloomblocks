// Text <-> level conversion. Row strings use '#' for stone and '.' for floor
// (a solution overlay may use 'L' for a lantern on floor).

import { type BB, EMPTY, type LanternsLevel, type LanternsMove, hasBit, index, validateLevel, withBit } from "./rules.ts";

export function parseLevel(rows: readonly string[], budget: number): LanternsLevel {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  let stones: BB = EMPTY;
  rows.forEach((row, y) => {
    if (row.length !== w) throw new RangeError(`row ${y} has width ${row.length}, expected ${w}`);
    for (let x = 0; x < w; x++) {
      const c = row[x];
      if (c === "#") stones = withBit(stones, index(x, y), true);
      else if (c !== "." && c !== "L") throw new RangeError(`bad cell '${c}' at ${x},${y}`);
    }
  });
  const level = { w, h, budget, stones };
  validateLevel(level);
  return level;
}

/** Lantern positions marked 'L' in the rows, row-major. */
export function parseLanterns(rows: readonly string[]): LanternsMove[] {
  const out: LanternsMove[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === "L") out.push({ x, y });
  });
  return out;
}

export function levelRows(level: { w: number; h: number; stones: BB }, lanterns: BB = EMPTY): string[] {
  const rows: string[] = [];
  for (let y = 0; y < level.h; y++) {
    let r = "";
    for (let x = 0; x < level.w; x++) {
      const i = index(x, y);
      r += hasBit(level.stones, i) ? "#" : hasBit(lanterns, i) ? "L" : ".";
    }
    rows.push(r);
  }
  return rows;
}
