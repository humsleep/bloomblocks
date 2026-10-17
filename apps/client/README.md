# apps/client — iOS-first shell (W1)

Vite + TypeScript + Phaser 3.90 (custom core build, Canvas only) + Capacitor 8 (iOS only).
Rules come straight from `../../core` and `../../games` via the `@core` / `@games`
aliases (vite.config.ts, tsconfig.json); the repo root package.json is untouched.

## Identity (one place)
`app.identity.json` → bundleId `com.humsleep.duskwick`, appName **Duskwick**, teamId.
`npm run ios:sync` regenerates `ios/identity.xcconfig` (Xcode reads `APP_BUNDLE_ID` /
`APP_DISPLAY_NAME` / `APP_TEAM_ID` from it); `capacitor.config.ts` and the scripts read the JSON.
Internal names (`Library/lanternly/`, `lanternly.perf`) stay unchanged on purpose.
Build numbers: `ios/version.xcconfig` (`APP_MARKETING_VERSION`, `APP_BUILD_NUMBER` = CFBundleVersion),
bumped by `npm run ios:bump` (git-free counter; `--marketing 1.1` to change the version).

## Build configurations
| Config | Probe (PERF_PROBE) | Use |
| --- | --- | --- |
| Debug | yes | simulator dev (`ios:sim`) |
| Measure | yes | Release settings + ColdStartProbe: `ios:device:*`, `measure:ios`, `measure-sim.sh` |
| Release | **no** | App Store archive (`npm run ios:archive`, checked by `scripts/check-no-probe.sh`) |

## Native extras
- `A11yPrefs` app-local plugin (`ios/App/App/A11yPrefs.swift`): `get()` + `'change'` with
  contentSizeCategory, fontScale, boldText, increaseContrast, reduceMotion, voiceOver, language.
- `CloudKV` app-local plugin (`ios/App/App/CloudKV.swift`, JS `src/native/cloudkv.ts`): iCloud
  key-value store for the silent progress mirror — see **iCloud sync (CloudKV)** below.
- `PrivacyInfo.xcprivacy`: the app's own code only — UserDefaults CA92.1 (Preferences), FileTimestamp
  C617.1 (Filesystem), no collected data, `NSPrivacyTracking=false`. Ad data is declared by the SDKs'
  own manifests; see **App Privacy** below.
- Localizations en, ko, ja, de, fr, es (+ es-419 ATT text only), pt-BR, it, zh-Hans, zh-Hant (v12, docs/i18n-glossary.md; `CFBundleLocalizations` + `*.lproj/InfoPlist.strings`:
  display name + ATT text) — also makes WKWebView's `navigator.language` follow the device.
- Art: `npm run art` → app icon (Any opaque / Dark / Tinted, from `docs/icon/duskwick-icon*.svg`)
  and the dusk launch image (from `src/render/palette.ts`) into `resources/` + the asset catalog.
- SKAdNetwork: `npm run ios:skan` refreshes `SKAdNetworkItems` from Google, AppLovin, Unity,
  Mintegral published lists (`ios/skadnetwork-sources.json`).

## Ads (`src/ads/`)
`ads` facade (index.ts) + pure policy (policy.ts, tests in `src/ads/__tests__`, `npm run test:ads`)
+ providers: NullAds (web/e2e) and AdMobAds (iOS, dynamic import after the first move).
`@capacitor-community/admob` **8.2.1** pinned (→ Google Mobile Ads 13.11.0, UMP 3.1.x via SPM).
Test IDs only (`src/ads/config.ts`, Info.plist `GADApplicationIdentifier` = Google sample app) — `ios:archive` refuses them without `--allow-test-ads`.
Counters persist in Preferences `ads.state.v1`.
Bidding adapters (NOT added yet; pin these when switching them on, then re-measure cold start):
AppLovin adapter 13.6.4.0 (AppLovin SDK 13.6.4), Unity adapter 4.21.0.0 (Unity Ads 4.21.0, built with GMA 13.11.0),
Mintegral adapter 8.1.7.0 (Mintegral SDK 8.1.7) — googleads-mobile-ios-mediation CHANGELOGs, checked 2026-10-14;
all require GMA 13.x, compatible with the plugin's exact 13.11.0.

## App Privacy (manifest + App Store Connect), checked 2026-10-14
**Who declares what.** Xcode merges every bundle's `PrivacyInfo.xcprivacy` into the privacy report, and
third-party SDK collection is the app's responsibility to disclose. Bundled manifests (GMA 13.11.0 from
`build/dd-native/SourcePackages/artifacts/.../GoogleMobileAds.framework/PrivacyInfo.xcprivacy`, UMP 3.1.x):
- GMA: DeviceID linked **tracking=true**; CoarseLocation, AdvertisingData, ProductInteraction linked,
  not tracking; PerformanceData, OtherDiagnosticData, CrashData not linked (purposes 3rd-party ads,
  developer ads, analytics; crash = analytics). **No `NSPrivacyTracking` key, no tracking domains.**
- UMP: CoarseLocation, PerformanceData, ProductInteraction — not linked, not tracking, app functionality.
- `@capacitor-community/admob` 8.2.1 ships no manifest (its Swift only calls GMA/UMP/ATT); Capacitor's is empty.

**App-level decision: `NSPrivacyTracking=false`, no `NSPrivacyTrackingDomains` key, no collected data.**
The app's own code makes no network requests (no analytics, saves stay on device); every ad-related
entry, including DeviceID-for-tracking, is already in GMA's manifest, so the old app-level copy
(DeviceID tracking=true under `NSPrivacyTracking=false`) was both redundant and self-contradictory.
Why not `true`: Apple requires a non-empty domain list with `true` — TN3181 lists "`NSPrivacyTracking`
true + empty `NSPrivacyTrackingDomains`" as an invalid manifest (ITMS-91064). GMA lists no tracking
domains to duplicate, and listing Google's ad-serving hosts ourselves would make iOS fail *every* request
to them when ATT is not granted ("network requests to these domains fail") — i.e. no ads at all, even
non-personalized ones, for most users. Same TN3181: an app that connects to no tracking domains removes
`NSPrivacyTrackingDomains` (and may keep `NSPrivacyTracking=false`). Revisit if a mediation SDK with
dedicated tracking domains is added — its own manifest must then declare them (pin a version that has one).
ATT is still requested (Info.plist `NSUserTrackingUsageDescription`), so the **App Store label must say
the app tracks** — the manifest does not fill in App Store Connect for you.

**App Store Connect → App Privacy answers** (Data collection: *Yes*; union of GMA + UMP):
| Data type | Purposes | Linked to user | Used for tracking |
| --- | --- | --- | --- |
| Identifiers › Device ID | Third-Party Advertising, Developer's Advertising or Marketing, Analytics | Yes | **Yes** |
| Location › Coarse Location | Third-Party Advertising, Developer's Advertising or Marketing, Analytics, App Functionality | Yes | No |
| Usage Data › Product Interaction | Third-Party Advertising, Developer's Advertising or Marketing, Analytics, App Functionality | Yes | No |
| Usage Data › Advertising Data | Third-Party Advertising, Developer's Advertising or Marketing, Analytics | Yes | No |
| Diagnostics › Performance Data | Third-Party Advertising, Developer's Advertising or Marketing, Analytics, App Functionality | No | No |
| Diagnostics › Other Diagnostic Data | Third-Party Advertising, Developer's Advertising or Marketing, Analytics | No | No |
| Diagnostics › Crash Data | Analytics | No | No |
Everything else (contact info, health, financial, user content, browsing/search history, purchases, …): not
collected. Re-check after every GMA/UMP bump or mediation adapter (Xcode Organizer → archive → Generate
Privacy Report) — Google: "You are responsible for checking the privacy manifest and ensuring that your
application's data disclosures are up to date."

Sources: Apple, Privacy manifest files — https://developer.apple.com/documentation/bundleresources/privacy-manifest-files ;
Apple TN3181 Debugging an invalid privacy manifest — https://developer.apple.com/documentation/technotes/tn3181-debugging-invalid-privacy-manifest ;
Apple, App privacy details (tracking definition, third-party partners, Device ID) — https://developer.apple.com/app-store/app-privacy-details/ ;
Google, AdMob iOS data disclosure — https://developers.google.com/admob/ios/privacy/data-disclosure ;
Apple Developer Forums 749099 / 844980 (no official ruling on duplicating SDK domains; DTS: manifest + matching questionnaire suffice).

## iCloud sync (CloudKV), checked 2026-10-15
**Native side.** `CloudKV.swift` wraps `NSUbiquitousKeyValueStore.default` (contract: docs/phase2-plan.md
"Phase 4"). `getAll()` → `{available, values}` (`available` = `FileManager.ubiquityIdentityToken != nil`),
`set`/`remove` write to the in-memory store and schedule one coalesced `synchronize()` ~1 s later (also on
resign-active), `synchronize()` → `{ok}`, event `'change'` `{reason, keys}` from
`didChangeExternallyNotification` (Server→`server`, InitialSync→`initialSync`, QuotaViolation→`quota`,
AccountChange→`account`) plus `NSUbiquityIdentityDidChange` → `account` with `keys: []` (re-read with
`getAll`). Cold start: `load()` is empty; observers + the first `synchronize()` start on the first JS call.
Events before the first listener are retained (`retainUntilConsumed`). Native rejects keys outside 1–64
UTF-8 bytes (`BAD_KEY`; an over-long key would raise an ObjC exception) and values > 64 KB (`TOO_LARGE`).
Caveat for the TS side: Apple documents `ubiquityIdentityToken` under iCloud Drive; with iCloud signed in
but iCloud Drive off it may be nil while KVS still syncs — so treat `available=false` as "unknown", keep
writing (writes stay local and upload when an account appears), never as "delete remote".

**Entitlement / signing.** `ios/App/App/App.entitlements` (`com.apple.developer.ubiquity-kvstore-identifier`
= `$(TeamIdentifierPrefix)$(CFBundleIdentifier)` → `68BP5NY48R.com.humsleep.duskwick`), set as
`CODE_SIGN_ENTITLEMENTS` for Debug, Measure and Release. Automatic signing provisioned it without any
manual step (`xcodebuild … -configuration Release -destination generic/platform=iOS -allowProvisioningUpdates`
→ "iOS Team Provisioning Profile: com.humsleep.duskwick" now carries iCloud / KVS). The App Store
distribution profile is made the same way at archive/export time. If a later build ever fails with
"Provisioning profile doesn't support the iCloud capability": Xcode → target App → Signing & Capabilities →
make sure team 68BP5NY48R is selected and "iCloud" shows *Key-value storage* checked (no containers needed),
then rebuild. The simulator cannot be signed into iCloud by us, so sync itself is only testable on devices.

**Manual device test (developer).** Two devices (or one device + reinstall) signed into the same Apple
Account with iCloud on: Settings › [name] › iCloud › Saved to iCloud › See All › Duskwick must be on (it
appears after the first sync).
1. Device A: install (`npm run ios:device:m1` or TestFlight), clear 3 levels, background the app (forces upload).
2. Device B: fresh install, launch, wait ≤ 20 s on the first board → progress from A appears (merge, not overwrite).
3. Delete the app on A, reinstall, launch offline → local progress only; go online → progress returns.
4. Play on both while one is in airplane mode; reconnect → union of progress / daily log, nothing lost.
5. Sign out of iCloud (or switch account) on B → `'change'` reason `account`; old-account keys ignored.
Upload is throttled by iCloud ("several times per minute"), so allow ~1 min between steps.

**What survives (Apple sources).** KVS lives in the user's iCloud account, not in the app container, so
deleting and reinstalling the app on the same Apple Account restores it after the initial sync (Apple DTS
lists KVS among the Apple-Account-based ways to keep state across reinstalls; Apple never states an
expiry). It is lost or unavailable when: iCloud is off for the app / no Apple Account (writes stay local
only: "the changes remain only on the current device"); the user deletes the app's data in Settings ›
[name] › iCloud › Manage Account Storage › Duskwick › Delete Data from iCloud ("you won't be able to
recover the data"); the account changes ("the system removes any previous iCloud data and replaces it with
data from the new account"). Hence local files stay the source of truth.
Limits: 1 MB total per app per user, max 1024 keys, max 1 MB per value, key ≤ 128 UTF-16 chars (current
doc; the older iCloud Design Guide says 64 UTF-8 bytes — the plugin uses the stricter one); exceeding the
quota fails the write and posts `QuotaViolationChange`. Values are stored unencrypted on disk — no
personal or sensitive data (Apple). Upload timing is up to iCloud.

**Privacy.** No `PrivacyInfo.xcprivacy` change: `NSUbiquitousKeyValueStore` is not a required-reason API
(the User defaults category covers `NSUserDefaults`). No App Privacy (nutrition label) change: Apple defines
"collect" as transmitting data off device so that *you* or your partners can access it; KVS data goes to
the user's own iCloud account, the developer has no access ("You are not responsible for disclosing data
collected by Apple"). Keep it that way: the `d.<deviceId>` id must be a random app-generated id (not
IDFA/IDFV), and nothing in the blob may be sent to our own or third-party servers.
Sources: https://developer.apple.com/documentation/foundation/nsubiquitouskeyvaluestore ;
…/nsubiquitouskeyvaluestore/synchronize() ; …/nsubiquitouskeyvaluestoreaccountchange ;
https://developer.apple.com/documentation/foundation/filemanager/ubiquityidentitytoken ;
https://developer.apple.com/library/archive/documentation/General/Conceptual/iCloudDesignGuide/Chapters/DesigningForKey-ValueDataIniCloud.html ;
https://developer.apple.com/forums/thread/730924 (DTS) ; https://support.apple.com/108922 (Manage iCloud storage) ;
https://developer.apple.com/app-store/app-privacy-details/ .

## iPad (iPhone-only app on iPad), checked 2026-10-15
`TARGETED_DEVICE_FAMILY = 1`, so App Review runs the iPhone build on iPad (guideline 2.4.1). iPad (A16),
iPadOS 26.5 simulator, Release-sim build: iPadOS 26 shows the app in a portrait iPhone-sized window
(window controls top-left, above the gear); first launch and a 6×6 board lay out correctly, no crash,
safe insets top=20 / bottom=25 (`playtest/shots/ipad/`). Cold launch in the simulator took > 4 s to first
paint (sim-shots' default wait is too short there). Not yet checked (needs taps/rotation by hand):
settings sheet, town, rotation. TN3192: `UIRequiresFullScreen` (we set YES) is deprecated since iPadOS 26
and only affects iPad apps before iOS 27; once we build with the iOS 27 SDK it no longer prevents resizing
on iPhone or iPad (scenes resize "discretely"), and a launch screen becomes mandatory (we have one). Plan:
remove `UIRequiresFullScreen` when moving to the iOS 27 SDK and make sure the web layout re-fits on
`resize` (the `--safe-*` vars injected at document start are not updated after a resize; `env()` is).
Source: https://developer.apple.com/documentation/technotes/tn3192-migrating-your-app-from-the-deprecated-uirequiresfullscreen-key

## Release gates (`npm run ios:archive`)
`scripts/archive-ios.sh` runs `scripts/release-gates.mjs` before bumping or building anything, then
`scripts/check-no-probe.sh` on the archived binary (a failing archive is renamed `*-REJECTED-probe`).
Fails on: Google sample publisher `ca-app-pub-3940256099942544` in `src/ads/config.ts` or Info.plist
`GADApplicationIdentifier`, `testing` not `false`, malformed IDs or config/plist app-ID mismatch, or
`PERF_PROBE` in a Release configuration. Store gates (hard, 2026-10-16, docs/app-review-preflight.md):
`ITSAppUsesNonExemptEncryption=false`, ATT purpose string in Info.plist + all 7 `InfoPlist.strings`
(en == plist), display name = Duskwick everywhere, launch storyboard, no `UIBackgroundModes`, Google's
SKAdNetwork id, entitlements = iCloud KVS + Associated Domains `applinks:humsleep.github.io` only (no `aps-environment`),
the `duskwick` URL scheme, privacy manifest valid with CA92.1 + C617.1, opaque 1024 icon in every app icon set
(AppIcon + the PPO alternate AppIconWick, which must be in ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES),
sane version/build, https URLs in `src/legal.ts`.
`check-no-probe.sh` also rejects a web bundle with the DEV / e2e test bridge (`__test`, `__e2e`).
Privacy policy / support URLs: `src/legal.ts` (one place; Settings sheet → privacy policy row opens it
in Safari). Third-party notices ship as `public/licenses.txt`.
```sh
npm run ios:release-check   # = ios:archive -- --check-only: gates only (+ probe check of newest Release App.app)
npm run ios:archive -- --allow-test-ads               # internal TestFlight: loud warning, archive named *-TESTADS
npm run ios:archive -- --marketing 1.1                # real App Store archive (needs real AdMob IDs)
```

## Commands
```sh
npm run build:m1          # real shell → dist/
npm run build:m0          # empty WebView floor page → dist/
npm run ios:sync          # identity + cap sync ios
npm run ios:sim -- m1     # Debug build → booted simulator, console streamed
npm run ios:device:m1     # Measure build (Release + probe, automatic signing) → install on the paired iPhone
npm run measure:ios -- m1 20   # 20 process-cold launches → n/median/p75/max
```
The phone must be unlocked (screen on) for install and the whole measurement run.

## Cold-start probe
`ios/App/App/ColdStartProbe.swift` (app-local plugin, registered in
`MainViewController.capacitorDidLoad`). start = kernel `p_starttime` (or
didFinishLaunching if `ActivePrewarm=1`); end = JS `mark()` — M0 on DOMContentLoaded,
M1 two rAFs after the board is drawn and input is live. Each launch appends a JSON
line to `Documents/perf.jsonl` and emits an os_signpost (`lanternly.perf`).

## Saves (Library/lanternly/)
Pips rules (gameId 5), two tracks — see `docs/visual-v3.md` (saves), `docs/visual-v4.md` (round-3 UI) and `docs/visual-v5.md` (round-4 UI, daily, streak, undo). Per track an append-per-move
`pips-<track>-journal.log` (header + `<move hex><stateHash hex>` lines) replayed through
`verifyRun` on launch (longest verifying prefix wins, torn tail dropped); level end writes
`runs/p5-<levelId>.bin` (run.bin, docs/runlog-format.md) and `pips-progress.json` via temp
file + rename. Levels come from `levelForTrack(track, n)`; `pips-<track>-level.json` caches
the current level so launch never regenerates. The pre-pips lanterns files are ignored.
`pips-daily-log.json` = the daily completion log `{v:1, days:{date:{at,ms,hints,undos}}}` (counted
completions only; the streak is recomputed from its dates — `daily.ts streakFromDates`; old saves are
migrated from `runs/p5-daily-<date>.bin` + the DailyState). Preferences holds settings, the streak
cache (`streak`), today's `daily`, and `sync` (random device id + change stamps).

## iCloud sync (`src/sync/`, phase 4)
Silent mirror on the iCloud key-value store (`CloudKV` plugin, `src/native/cloudkv.ts`), loaded after
the first paint. Each device writes only `d.<deviceId>` (< 64 KB; ≈ 8 KB per year of dailies) on
background and at level end / daily completion; readers merge every `d.*` key (`model.ts`: progress
max, log union with the earliest record per date, streak recomputed + monotonic, journal of the merged
level, settings LWW, guide bits OR with a local "show the guide again" override). Merges apply only at
a quiet moment; mid-level the device's own play wins. A fresh install waits for `initialSync` (or 20 s;
merges at once when the store already holds keys) and a returning player's restore skips the first-run
lessons. Keys of devices silent for 180 days whose data this device already carries are pruned.
Settings sheet: the small cloud (synced / pending / off). Tests: `tests/sync-*.test.ts`, `e2e/sync.spec.ts`.

## Dev
`npm run dev` then `?shot=empty|mid|almost|solve[&level=N][&track=deduce]` (DEV-only capture hook).
Simulator screenshots: `cd apps/client && npx tsx scripts/sim-shots.ts`
(writes save files into the app container, launches, `simctl io screenshot` → `playtest/shots/`).
