// App Store release gates, run by scripts/archive-ios.sh BEFORE anything is bumped or built.
//   node scripts/release-gates.mjs                   → exit 1 on any problem
//   node scripts/release-gates.mjs --allow-test-ads  → test-ad problems become a loud warning
//                                                      (internal TestFlight only); hard problems still fail
// Gates:
//   ads   (test-ad, waivable)  src/ads/config.ts still has Google's sample publisher
//                              (ca-app-pub-3940256099942544) or `testing` is not `false`;
//                              Info.plist GADApplicationIdentifier is the sample app ID.
//   ads   (hard)               malformed IDs, or config.ts appId != Info.plist GADApplicationIdentifier
//                              (the SDK must be initialised with the same app the units belong to).
//   probe (hard)               a Release build configuration (pbxproj or an xcconfig) defines
//                              PERF_PROBE, i.e. ColdStartProbe would be compiled into the archive.
//                              The built binary itself is checked by scripts/check-no-probe.sh.
//   store (hard)               App Review / App Store Connect hygiene (docs/app-review-preflight.md):
//                              ITSAppUsesNonExemptEncryption=false; NSUserTrackingUsageDescription in
//                              Info.plist + every CFBundleLocalizations InfoPlist.strings (en == plist),
//                              CFBundleDisplayName == app.identity.json appName in every language; launch
//                              storyboard present; no UIBackgroundModes; Google's SKAdNetwork id present;
//                              entitlements = iCloud KVS + Associated Domains (exactly applinks:humsleep.github.io,
//                              no aps-environment); the duskwick:// URL scheme; privacy manifest valid
//                              (tracking=true needs domains) with CA92.1 + C617.1; opaque 1024 icon in EVERY
//                              app icon set (the primary AppIcon and the PPO alternates, e.g. AppIconWick), each
//                              alternate named in ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES of every config;
//                              sane version / build number; https privacy-policy + support URLs (src/legal.ts) on the owner's site scheme
//                              (/apps/duskwick/…), the share-link base (share.ts) and the AASA copy in docs/web.
//   locales (hard)             every UI language in src/a11y/strings.ts LANGS ships as an iOS localization:
//                              in Info.plist CFBundleLocalizations, in the Xcode project's knownRegions, and as
//                              an <lang>.lproj/InfoPlist.strings child of the InfoPlist.strings variant group
//                              (otherwise the file is not copied into the bundle); no localization without UI
//                              strings (a regional variant such as es-419 is fine when its language ships).
// Read-only: never edits src/ or ios/.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
const allowTestAds = process.argv.includes("--allow-test-ads");

const SAMPLE_PUB = "ca-app-pub-3940256099942544"; // https://developers.google.com/admob/ios/test-ads
const APP_ID_RE = /^ca-app-pub-\d{16}~\d{10}$/;
const UNIT_RE = /^ca-app-pub-\d{16}\/\d{10}$/;

const testAd = []; // waivable with --allow-test-ads
const hard = []; // never waivable

// ---- ads: src/ads/config.ts (comments stripped so prose can't satisfy or trip a gate) ----
const cfgSrc = read("src/ads/config.ts")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:"'])\/\/.*$/gm, "$1");
const block = (cfgSrc.match(/ADMOB_IOS\s*=\s*\{([\s\S]*?)\}/) ?? [])[1];
const cfg = {};
if (!block) hard.push("src/ads/config.ts: could not find the ADMOB_IOS object");
else {
  for (const [, k, v] of block.matchAll(/(\w+)\s*:\s*"([^"]*)"/g)) cfg[k] = v;
  cfg.testing = (block.match(/\btesting\s*:\s*(true|false)\b/) ?? [])[1];
}
// live at launch (config B) → must be real for the App Store; flagged-off placements are only
// format-checked (never requested while their flag is OFF)
const units = ["interstitial", "rewardedBreak"];
const flagged = ["rewardedKeepsake", "rewardedArchive", "bannerTrack"];
if (block) {
  if (!APP_ID_RE.test(cfg.appId ?? "")) hard.push(`config.ts appId "${cfg.appId}" is not ca-app-pub-<16 digits>~<10 digits>`);
  for (const u of [...units, ...flagged])
    if (!UNIT_RE.test(cfg[u] ?? "")) hard.push(`config.ts ${u} "${cfg[u]}" is not ca-app-pub-<16 digits>/<10 digits>`);
  const sample = ["appId", ...units].filter((k) => (cfg[k] ?? "").startsWith(SAMPLE_PUB + "~") || (cfg[k] ?? "").startsWith(SAMPLE_PUB + "/"));
  if (sample.length) testAd.push(`src/ads/config.ts uses Google's sample IDs for: ${sample.join(", ")}`);
  if (cfg.testing !== "false") testAd.push(`src/ads/config.ts testing is ${cfg.testing ?? "missing"} (must be false for the App Store)`);
}

// ---- ads: test vs real is decided by the NATIVE build kind, never by the web MODE (the archive
// is built with --mode m1 too, so a MODE check would serve test ads forever) ----
const stripC = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/.*$/gm, "$1");
const adsSrc = stripC(read("src/ads/AdMobAds.ts"));
if (/import\.meta\.env/.test(adsSrc)) hard.push("src/ads/AdMobAds.ts reads import.meta.env (web MODE must not decide test vs real ads)");
if (!/isReleaseBuild\(\)/.test(adsSrc)) hard.push("src/ads/AdMobAds.ts does not resolve the native build kind (isReleaseBuild)");
const audioSwift = stripC(read("ios/App/App/AdAudio.swift"));
if (!/func buildKind/.test(audioSwift) || !/#if[^\n]*PERF_PROBE[\s\S]*?\["release": false\][\s\S]*?#else[\s\S]*?\["release": true\]/.test(audioSwift))
  hard.push("ios/App/App/AdAudio.swift buildKind must report release=false under PERF_PROBE and release=true otherwise");

// ---- ads: Info.plist GADApplicationIdentifier ----
let plistAppId = "";
try {
  plistAppId = execFileSync("plutil", ["-extract", "GADApplicationIdentifier", "raw", "-o", "-", "ios/App/App/Info.plist"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
} catch {
  hard.push("ios/App/App/Info.plist has no GADApplicationIdentifier");
}
if (plistAppId) {
  if (!APP_ID_RE.test(plistAppId)) hard.push(`Info.plist GADApplicationIdentifier "${plistAppId}" is malformed`);
  if (plistAppId.startsWith(SAMPLE_PUB)) testAd.push(`Info.plist GADApplicationIdentifier is Google's sample app ID (${plistAppId})`);
  if (cfg.appId && cfg.appId !== plistAppId)
    hard.push(`config.ts appId (${cfg.appId}) != Info.plist GADApplicationIdentifier (${plistAppId})`);
}

// ---- probe: no Release configuration may define PERF_PROBE ----
const pbx = read("ios/App/App.xcodeproj/project.pbxproj");
const releaseBlocks = [...pbx.matchAll(/isa = XCBuildConfiguration;([\s\S]*?)\n\s*name = (\w+);/g)].filter((m) => m[2] === "Release");
if (releaseBlocks.length === 0) hard.push("project.pbxproj: no Release build configuration found");
if (releaseBlocks.some((m) => /PERF_PROBE/.test(m[1]))) hard.push("project.pbxproj: a Release configuration defines PERF_PROBE");
for (const f of readdirSync(new URL("ios/", root)).filter((f) => f.endsWith(".xcconfig")))
  if (/^[^/]*PERF_PROBE/m.test(read(`ios/${f}`))) hard.push(`ios/${f} defines PERF_PROBE (applies to Release too)`);

// ---- store (hard): App Review / App Store Connect hygiene (docs/app-review-preflight.md) ----
const plistJson = (p) => JSON.parse(execFileSync("plutil", ["-convert", "json", "-o", "-", p], { cwd: root, encoding: "utf8" }));
const tryPlist = (p, what) => {
  try {
    return plistJson(p);
  } catch {
    hard.push(`${p}: missing or not a valid ${what}`);
    return null;
  }
};
const identity = JSON.parse(read("app.identity.json"));
const info = tryPlist("ios/App/App/Info.plist", "plist");
let storeChecks = 0;
if (info) {
  storeChecks++;
  // export compliance: HTTPS-only / no own crypto → exempt; answered in the binary, so ASC never asks per build
  if (info.ITSAppUsesNonExemptEncryption !== false) hard.push("Info.plist ITSAppUsesNonExemptEncryption must be <false/> (export compliance)");
  // 5.1.2 ATT: the purpose string, in the base plist and every shipped language
  const att = (info.NSUserTrackingUsageDescription ?? "").trim();
  if (att.length < 20) hard.push("Info.plist NSUserTrackingUsageDescription is missing or too short (ATT purpose string)");
  const langs = Array.isArray(info.CFBundleLocalizations) ? info.CFBundleLocalizations : [];
  if (langs.length === 0) hard.push("Info.plist CFBundleLocalizations is empty");
  for (const l of langs) {
    const st = tryPlist(`ios/App/App/${l}.lproj/InfoPlist.strings`, "strings file");
    if (!st) continue;
    if ((st.NSUserTrackingUsageDescription ?? "").trim().length < 10) hard.push(`${l}.lproj/InfoPlist.strings has no NSUserTrackingUsageDescription`);
    if (st.CFBundleDisplayName !== identity.appName) hard.push(`${l}.lproj/InfoPlist.strings CFBundleDisplayName "${st.CFBundleDisplayName}" != "${identity.appName}" (2.3 metadata)`);
    if (l === "en" && st.NSUserTrackingUsageDescription !== info.NSUserTrackingUsageDescription)
      hard.push("en.lproj NSUserTrackingUsageDescription differs from Info.plist (en is the source; keep them identical)");
  }
  // launch screen (mandatory with the iOS 27 SDK) + no background modes we do not use
  const sb = info.UILaunchStoryboardName;
  if (!sb) hard.push("Info.plist UILaunchStoryboardName is missing");
  else
    try {
      read(`ios/App/App/Base.lproj/${sb}.storyboard`);
    } catch {
      hard.push(`launch storyboard ios/App/App/Base.lproj/${sb}.storyboard not found`);
    }
  if (info.UIBackgroundModes) hard.push(`Info.plist UIBackgroundModes ${JSON.stringify(info.UIBackgroundModes)}: the app uses none (local notifications need none)`);
  // SKAdNetwork: Google's own id must be there (AdMob attribution); refresh with `npm run ios:skan`
  const skan = (info.SKAdNetworkItems ?? []).map((d) => String(d?.SKAdNetworkIdentifier ?? "").toLowerCase());
  if (!skan.includes("cstr6suwn9.skadnetwork")) hard.push("Info.plist SKAdNetworkItems lacks Google's cstr6suwn9.skadnetwork (run npm run ios:skan)");
}
// locales: the JS UI languages, CFBundleLocalizations, knownRegions and the bundled InfoPlist.strings agree
{
  const stringsSrc = read("src/a11y/strings.ts");
  const langsDecl = (stringsSrc.match(/export const LANGS\s*=\s*\[([^\]]*)\]/) ?? [])[1];
  const uiLangs = langsDecl ? [...langsDecl.matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];
  if (uiLangs.length === 0) hard.push("src/a11y/strings.ts: could not read the LANGS list");
  const plistLangs = info && Array.isArray(info.CFBundleLocalizations) ? info.CFBundleLocalizations : [];
  const regions = [...((pbx.match(/knownRegions = \(([\s\S]*?)\);/) ?? [])[1] ?? "").matchAll(/"?([A-Za-z0-9-]+)"?,/g)].map((m) => m[1]);
  const group = (pbx.match(/\/\* InfoPlist\.strings \*\/ = \{\s*isa = PBXVariantGroup;\s*children = \(([\s\S]*?)\);/) ?? [])[1] ?? "";
  const bundled = [...group.matchAll(/\/\* ([A-Za-z0-9-]+) \*\//g)].map((m) => m[1]);
  if (!group) hard.push("project.pbxproj: no InfoPlist.strings variant group");
  for (const l of uiLangs) {
    if (!plistLangs.includes(l)) hard.push(`Info.plist CFBundleLocalizations lacks "${l}" (a UI language in src/a11y/strings.ts LANGS)`);
  }
  const shipsLang = (l) => uiLangs.includes(l) || uiLangs.includes(l.split("-")[0]) || (/^zh-Han[st]/.test(l) && uiLangs.includes(l.slice(0, 7)));
  for (const l of plistLangs) {
    if (!shipsLang(l)) hard.push(`Info.plist CFBundleLocalizations has "${l}" but the game has no UI strings for it`);
    if (!regions.includes(l)) hard.push(`project.pbxproj knownRegions lacks "${l}" (CFBundleLocalizations has it)`);
    if (!bundled.includes(l)) hard.push(`project.pbxproj: ${l}.lproj/InfoPlist.strings is not in the InfoPlist.strings variant group (it would not be bundled)`);
  }
  storeChecks++;
}
// entitlements: iCloud key-value store + Associated Domains (Universal Links of the share link, R2 / A5).
// No push: local notifications need no aps-environment.
const APPLINKS = ["applinks:humsleep.github.io"];
const ent = tryPlist("ios/App/App/App.entitlements", "entitlements plist");
if (ent) {
  storeChecks++;
  const ALLOWED_ENT = new Set(["com.apple.developer.ubiquity-kvstore-identifier", "com.apple.developer.associated-domains"]);
  for (const k of Object.keys(ent)) if (!ALLOWED_ENT.has(k)) hard.push(`App.entitlements has "${k}" — an unused capability (only iCloud KVS and Associated Domains are used)`);
  if (!ent["com.apple.developer.ubiquity-kvstore-identifier"]) hard.push("App.entitlements lacks com.apple.developer.ubiquity-kvstore-identifier (iCloud sync)");
  const ad = ent["com.apple.developer.associated-domains"];
  if (JSON.stringify(ad) !== JSON.stringify(APPLINKS))
    hard.push(`App.entitlements associated-domains is ${JSON.stringify(ad)}; expected ${JSON.stringify(APPLINKS)} (docs/web/README.md)`);
}
// deep links: the custom URL scheme duskwick:// (src/game/deepLink.ts)
if (info) {
  const schemes = (info.CFBundleURLTypes ?? []).flatMap((t) => t?.CFBundleURLSchemes ?? []);
  if (!schemes.includes("duskwick")) hard.push("Info.plist CFBundleURLTypes lacks the duskwick URL scheme (deep links)");
  if (schemes.some((s) => s !== "duskwick")) hard.push(`Info.plist CFBundleURLTypes has an unexpected scheme: ${schemes.join(", ")}`);
  storeChecks++;
}
// privacy manifest: valid, self-consistent (TN3181), the app's own required-reason APIs declared
const pm = tryPlist("ios/App/App/PrivacyInfo.xcprivacy", "privacy manifest");
if (pm) {
  storeChecks++;
  const domains = pm.NSPrivacyTrackingDomains ?? [];
  if (pm.NSPrivacyTracking === true && domains.length === 0) hard.push("PrivacyInfo.xcprivacy: NSPrivacyTracking=true needs a non-empty NSPrivacyTrackingDomains (TN3181, ITMS-91064)");
  const reasons = Object.fromEntries((pm.NSPrivacyAccessedAPITypes ?? []).map((a) => [a.NSPrivacyAccessedAPIType, a.NSPrivacyAccessedAPITypeReasons ?? []]));
  for (const [cat, why, user] of [
    ["NSPrivacyAccessedAPICategoryUserDefaults", "CA92.1", "@capacitor/preferences"],
    ["NSPrivacyAccessedAPICategoryFileTimestamp", "C617.1", "@capacitor/filesystem stat"],
  ])
    if (!(reasons[cat] ?? []).includes(why)) hard.push(`PrivacyInfo.xcprivacy: ${cat} ${why} missing (used by ${user})`);
}
// app icons: the App Store (Any appearance) 1024 icon of EVERY icon set must be opaque — the primary AppIcon
// and the alternates App Store Connect's Product Page Optimization tests (r1-aso §3.5); each alternate set
// must be compiled in (ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES in every App build configuration)
try {
  const sets = readdirSync(new URL("ios/App/App/Assets.xcassets/", root)).filter((d) => d.endsWith(".appiconset")).map((d) => d.slice(0, -".appiconset".length));
  if (!sets.includes("AppIcon")) hard.push("Assets.xcassets has no AppIcon.appiconset");
  for (const set of sets) {
    const dir = `ios/App/App/Assets.xcassets/${set}.appiconset`;
    const icon = JSON.parse(read(`${dir}/Contents.json`));
    const any = (icon.images ?? []).find((i) => i.size === "1024x1024" && !i.appearances && i.filename);
    if (!any) {
      hard.push(`${set}.appiconset has no 1024x1024 icon for the Any appearance`);
      continue;
    }
    const out = execFileSync("sips", ["-g", "hasAlpha", "-g", "pixelWidth", "-g", "pixelHeight", `${dir}/${any.filename}`], { cwd: root, encoding: "utf8" });
    if (!/hasAlpha: no/.test(out)) hard.push(`${set} icon ${any.filename} has an alpha channel (App Store icons must be opaque; npm run art / docs/icon/src/build.sh)`);
    if (!/pixelWidth: 1024/.test(out) || !/pixelHeight: 1024/.test(out)) hard.push(`${set} icon ${any.filename} is not 1024×1024`);
    storeChecks++;
  }
  const appCfgs = [...pbx.matchAll(/buildSettings = \{([^}]*ASSETCATALOG_COMPILER_APPICON_NAME[^}]*)\}/g)].map((m) => m[1]);
  if (appCfgs.length === 0) hard.push("project.pbxproj: no build configuration sets ASSETCATALOG_COMPILER_APPICON_NAME");
  for (const cfg of appCfgs) {
    // the primary set is whichever ASSETCATALOG_COMPILER_APPICON_NAME names (Wick since 1.0 build 3); every other set is an alternate
    const primary = (cfg.match(/ASSETCATALOG_COMPILER_APPICON_NAME = "?([^";]*)"?;/) ?? [])[1] ?? "";
    if (!sets.includes(primary)) hard.push(`project.pbxproj: primary app icon "${primary}" has no ${primary}.appiconset`);
    const alternates = sets.filter((x) => x !== primary);
    const names = ((cfg.match(/ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES = "?([^";]*)"?;/) ?? [])[1] ?? "").split(/\s+/).filter(Boolean);
    for (const a of alternates) if (!names.includes(a)) hard.push(`project.pbxproj: ${a}.appiconset is not in ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES of every App configuration (PPO needs it in the binary)`);
    for (const n of names) if (!sets.includes(n)) hard.push(`project.pbxproj: alternate app icon "${n}" has no ${n}.appiconset`);
  }
} catch (e) {
  hard.push(`app icon check failed: ${e.message}`);
}
// version: CFBundleShortVersionString x.y[.z], CFBundleVersion a positive integer (ios/version.xcconfig)
{
  const v = read("ios/version.xcconfig");
  const mv = (v.match(/^APP_MARKETING_VERSION\s*=\s*(\S+)/m) ?? [])[1] ?? "";
  const bn = (v.match(/^APP_BUILD_NUMBER\s*=\s*(\S+)/m) ?? [])[1] ?? "";
  if (!/^\d+\.\d+(\.\d+)?$/.test(mv)) hard.push(`ios/version.xcconfig APP_MARKETING_VERSION "${mv}" is not x.y or x.y.z`);
  if (!/^[1-9]\d*$/.test(bn)) hard.push(`ios/version.xcconfig APP_BUILD_NUMBER "${bn}" is not a positive integer`);
  storeChecks++;
}
// 5.1.1(i): the in-app privacy policy link (src/legal.ts) — format only; publishing the page is the developer's step
{
  const legal = read("src/legal.ts").replace(/(^|[^:"'])\/\/.*$/gm, "$1");
  for (const k of ["PRIVACY_POLICY_URL", "SUPPORT_URL"]) {
    const url = (legal.match(new RegExp(`${k}\\s*=\\s*"([^"]*)"`)) ?? [])[1] ?? "";
    if (!/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}\/\S*$/i.test(url) || /example\.|placeholder|todo/i.test(url)) hard.push(`src/legal.ts ${k} "${url}" is not a real https URL`);
  }
  // the owner's site scheme (humsleep/apps repo: /apps/<app-id>/ and /apps/<app-id>/privacy/; docs/web/README.md)
  const SITE = "https://humsleep.github.io/apps/duskwick/";
  const urlOf = (k) => (legal.match(new RegExp(`${k}\\s*=\\s*"([^"]*)"`)) ?? [])[1];
  if (urlOf("PRIVACY_POLICY_URL") !== `${SITE}privacy/`) hard.push(`src/legal.ts PRIVACY_POLICY_URL must be ${SITE}privacy/`);
  if (urlOf("SUPPORT_URL") !== SITE) hard.push(`src/legal.ts SUPPORT_URL must be ${SITE}`);
  const share = readFileSync(new URL("../../games/lanterns-pips/share.ts", root), "utf8");
  if ((share.match(/DAILY_URL_BASE\s*=\s*"([^"]*)"/) ?? [])[1] !== SITE) hard.push(`games/lanterns-pips/share.ts DAILY_URL_BASE must be ${SITE} (share link, Universal Links)`);
  // Universal Links: the AASA copy (published at /.well-known/ of the user site) must name this app and the three paths
  const aasa = JSON.parse(readFileSync(new URL("../../docs/web/apple-app-site-association", root), "utf8"));
  const det = aasa?.applinks?.details?.[0];
  const paths = (det?.components ?? []).filter((c) => !c.exclude).map((c) => c["/"]);
  if (JSON.stringify(det?.appIDs) !== JSON.stringify([`${identity.teamId}.${identity.bundleId}`])) hard.push(`docs/web/apple-app-site-association appIDs != ["${identity.teamId}.${identity.bundleId}"]`);
  if (JSON.stringify(paths) !== JSON.stringify(["/apps/duskwick", "/apps/duskwick/", "/apps/duskwick/*"])) hard.push(`docs/web/apple-app-site-association paths are ${JSON.stringify(paths)}`);
  storeChecks++;
}

// ---- report ----
const line = "!".repeat(78);
for (const p of hard) console.error(`FAIL  ${p}`);
if (testAd.length && !allowTestAds) {
  for (const p of testAd) console.error(`FAIL  ${p}`);
  console.error("      → App Store builds need YOUR AdMob IDs (AdMob console → Apps → Duskwick → App settings / Ad units):");
  console.error("          1. src/ads/config.ts: appId (ca-app-pub-…~…), interstitial + rewardedBreak (ca-app-pub-…/…),");
  console.error("             the 3 flagged-off units may stay any well-formed id; then set testing: false");
  console.error("          2. ios/App/App/Info.plist GADApplicationIdentifier = the same appId");
  console.error("          3. npm run ios:release-check   (steps: docs/app-review-preflight.md, \"실제 AdMob ID 넣기\")");
  console.error("        or pass --allow-test-ads for an INTERNAL TestFlight build that must never reach review.");
} else if (testAd.length) {
  console.error(line);
  console.error("!!  WARNING: --allow-test-ads — this archive serves GOOGLE TEST ADS and earns nothing.");
  for (const p of testAd) console.error(`!!    ${p}`);
  console.error("!!  Internal TestFlight only. Do NOT submit this build for App Store review.");
  console.error(line);
}
const failed = hard.length > 0 || (testAd.length > 0 && !allowTestAds);
console.log(
  failed
    ? `release gates: FAILED (${hard.length} hard, ${allowTestAds ? 0 : testAd.length} test-ad)`
    : `release gates: OK${testAd.length ? " (test ads ALLOWED)" : ""} — ${releaseBlocks.length} Release configs without PERF_PROBE, ${storeChecks} store checks`,
);
process.exit(failed ? 1 : 0);
