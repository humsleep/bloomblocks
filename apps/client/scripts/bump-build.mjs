// Bumps CFBundleVersion for an archive / TestFlight build. Git-free: the counter
// IS ios/version.xcconfig (APP_BUILD_NUMBER, a plain integer that only goes up).
// App Store Connect rejects a build number it has already seen for the same
// marketing version, so run this once per uploaded archive (scripts/archive-ios.sh does).
//   node scripts/bump-build.mjs                → APP_BUILD_NUMBER + 1
//   node scripts/bump-build.mjs --marketing 1.1 → also sets CFBundleShortVersionString
//   node scripts/bump-build.mjs --print        → prints "1.0 (7)" without changing anything
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const file = new URL("../ios/version.xcconfig", import.meta.url);
const src = existsSync(file) ? readFileSync(file, "utf8") : "";
const get = (k, d) => (src.match(new RegExp(`^${k}\\s*=\\s*(\\S+)`, "m")) ?? [])[1] ?? d;
let marketing = get("APP_MARKETING_VERSION", "1.0");
let build = Number(get("APP_BUILD_NUMBER", "0"));
if (!Number.isInteger(build) || build < 0) throw new Error(`bad APP_BUILD_NUMBER in ${file.pathname}`);
const args = process.argv.slice(2);
if (args.includes("--print")) {
  console.log(`${marketing} (${build})`);
  process.exit(0);
}
const mi = args.indexOf("--marketing");
if (mi >= 0) {
  marketing = args[mi + 1];
  if (!/^\d+(\.\d+){0,2}$/.test(marketing ?? "")) throw new Error("--marketing needs 1, 1.2 or 1.2.3");
}
build += 1;
writeFileSync(
  file,
  `// Written by scripts/bump-build.mjs. APP_BUILD_NUMBER = CFBundleVersion, APP_MARKETING_VERSION = CFBundleShortVersionString.\nAPP_MARKETING_VERSION = ${marketing}\nAPP_BUILD_NUMBER = ${build}\n`,
);
console.log(`version ${marketing} (${build})`);
