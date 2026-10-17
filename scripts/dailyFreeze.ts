// npm run fixtures:daily -- [--extend <days>] [--recut <YYYY-MM-DD> --i-know]
//   (no flag)   create fixtures/lanterns-pips/daily-freeze.json if missing (FREEZE_MIN_DAYS days), else
//               report the first difference (exit 1) — never rewrites an existing entry
//   --extend N  append days until the file holds N days; existing entries must still match
//   --recut D   DELIBERATE generator change: re-pin entries ON/AFTER D (D must be ≥ today + 30 days, so
//               every shipped app build and the web daily can be updated before the first changed day).
//               Entries before D must still match. Read docs/lanterns-pips.md "데일리 고정" first.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type DailyFreeze, FREEZE_FILE, FREEZE_MIN_DAYS, frozenDaily, wrapFreeze } from "./dailyFreezeLib.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const path = join(root, FREEZE_FILE);
const arg = (k: string): string | undefined => {
  const i = process.argv.indexOf(k);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const write = (f: DailyFreeze): void => writeFileSync(path, JSON.stringify(f, null, 1) + "\n");

if (!existsSync(path)) {
  write(wrapFreeze(Array.from({ length: FREEZE_MIN_DAYS }, (_, k) => frozenDaily(k))));
  console.log(`wrote ${FREEZE_FILE} (${FREEZE_MIN_DAYS} days)`);
  process.exit(0);
}
const file = JSON.parse(readFileSync(path, "utf8")) as DailyFreeze;
const recut = arg("--recut");
if (recut) {
  const min = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(recut) || recut < min || !process.argv.includes("--i-know")) {
    console.error(`--recut needs a date ≥ ${min} and --i-know (shipped builds must update before the first changed day)`);
    process.exit(1);
  }
}
const out = file.dailies.map((d, k) => {
  const now = frozenDaily(k);
  if (now.rows === d.rows && now.date === d.date) return d;
  if (recut && d.date >= recut) return now;
  console.error(`daily ${d.date} (#${d.n}) changed:\n  frozen ${d.rows}\n  now    ${now.rows}`);
  process.exit(1);
});
const want = Number(arg("--extend") ?? out.length);
for (let k = out.length; k < want; k++) out.push(frozenDaily(k));
if (want === file.dailies.length && !recut) {
  console.log(`${FREEZE_FILE}: ${out.length} days, all match`);
  process.exit(0);
}
write(wrapFreeze(out));
console.log(`${FREEZE_FILE}: ${out.length} days${recut ? ` (re-cut from ${recut})` : ""}`);
