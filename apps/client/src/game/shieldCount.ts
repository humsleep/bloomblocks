// Streak shields per calendar month: 2, or 3 once the cottage reached cozy level 3 (R4, game/cosmetics.ts).
// A tiny pure module so the streak rules (daily.ts, sync/model.ts, town/data.ts) read one value without
// importing any platform code; cosmetics.ts sets it when the village's unlock bits are known.
export const BASE_SHIELDS = 2;
let perMonth = BASE_SHIELDS;
export const shieldsPerMonthNow = (): number => perMonth;
export function setShieldsPerMonth(n: number): void {
  perMonth = n === 3 ? 3 : BASE_SHIELDS;
}
