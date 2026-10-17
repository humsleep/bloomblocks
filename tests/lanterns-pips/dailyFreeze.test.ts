// Daily freeze (A9): every pinned date's daily is byte-identical to the frozen board.
// A failure here means a generator / rules change altered a past or future daily. Do NOT
// regenerate the file — see docs/lanterns-pips.md "데일리 고정" (scripts/dailyFreeze.ts).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DAILY_EPOCH } from "../../games/lanterns-pips/index.ts";
import { type DailyFreeze, FREEZE_FILE, FREEZE_MIN_DAYS, dateAfterEpoch, frozenDaily, wrapFreeze } from "../../scripts/dailyFreezeLib.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const file = JSON.parse(readFileSync(join(root, FREEZE_FILE), "utf8")) as DailyFreeze;

describe("daily freeze (A9)", () => {
  it(`pins at least ${FREEZE_MIN_DAYS} contiguous days from DAILY_EPOCH`, () => {
    expect(file.epoch).toBe(DAILY_EPOCH);
    expect(file.dailies.length).toBeGreaterThanOrEqual(FREEZE_MIN_DAYS);
    expect(file.days).toBe(file.dailies.length);
    file.dailies.forEach((d, k) => {
      expect(d.n).toBe(k + 1);
      expect(d.date).toBe(dateAfterEpoch(k));
    });
    // the header (fnvAll) agrees with the entries — a hand edit of one row is caught too
    expect(wrapFreeze(file.dailies).fnvAll).toBe(file.fnvAll);
  });

  it("levelForDaily reproduces every frozen board byte-for-byte", { timeout: 120_000 }, () => {
    const changed: string[] = [];
    file.dailies.forEach((d, k) => {
      const now = frozenDaily(k);
      if (now.rows !== d.rows || now.fnv !== d.fnv) changed.push(`${d.date} #${d.n}\n  frozen ${d.rows}\n  now    ${now.rows}`);
    });
    expect(changed, `${changed.length} frozen dailies changed (first: ${changed[0] ?? ""})`).toEqual([]);
  });
});
