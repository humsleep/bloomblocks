// Text <-> level. Row strings: '#' stone, '0'..'4' numbered stone, '.' floor,
// 'L' floor + lantern (solution overlay only; parses as '.').

import { type BB, EMPTY, NO_CLUE, type PipsLevel, type PipsMove, hasBit, index, validateLevel, withBit } from "./rules.ts";

export function parseLevel(rows: readonly string[]): PipsLevel {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  let stones: BB = EMPTY;
  const clues: number[] = new Array<number>(64).fill(NO_CLUE);
  rows.forEach((row, y) => {
    if (row.length !== w) throw new RangeError(`row ${y} has width ${row.length}, expected ${w}`);
    for (let x = 0; x < w; x++) {
      const c = row[x]!;
      const i = index(x, y);
      if (c === "#") stones = withBit(stones, i, true);
      else if (c >= "0" && c <= "4") {
        stones = withBit(stones, i, true);
        clues[i] = c.charCodeAt(0) - 48;
      } else if (c !== "." && c !== "L") throw new RangeError(`bad cell '${c}' at ${x},${y}`);
    }
  });
  const level = { w, h, stones, clues };
  validateLevel(level);
  return level;
}

/** Lantern positions marked 'L' in the rows, row-major. */
export function parseLanterns(rows: readonly string[]): PipsMove[] {
  const out: PipsMove[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === "L") out.push({ x, y });
  });
  return out;
}

export function levelRows(level: PipsLevel, lanterns: BB = EMPTY): string[] {
  const rows: string[] = [];
  for (let y = 0; y < level.h; y++) {
    let r = "";
    for (let x = 0; x < level.w; x++) {
      const i = index(x, y);
      const c = level.clues[i]!;
      r += hasBit(level.stones, i) ? (c === NO_CLUE ? "#" : String.fromCharCode(48 + c)) : hasBit(lanterns, i) ? "L" : ".";
    }
    rows.push(r);
  }
  return rows;
}
