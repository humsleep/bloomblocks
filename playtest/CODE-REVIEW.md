# Code review — Duskwick client (snapshot 2026-10-13 ~15:35 KST)

Scope: files newer than CLAUDE.md under apps/client/src, games/lanterns-pips, apps/client/ios/App/App (+ imports that matter).
Read-only review. Files were still being edited during the review (session.ts 15:34, TownScene.ts 15:31, daily.ts 15:29); findings re-checked against the latest versions.
The UI/town/a11y leak pass (TownScene, ResultSheet, SettingsSheet, Guide, a11y DOM, TextureBank, BoardView rebuild) was delegated but **had not reported when this file was written**. It is not covered here.

Checks that ran:
- client vitest: 235/235 pass.
- `tsc --noEmit`: clean.
- games tests (lanterns-pips + purity): 110/110 pass.
- `vite build --mode m1` into a scratch outDir: the test bridge, `__test`, setClock and dev/shot are absent from the bundle. Only the inert methods `devJump` and `devOpenSettings` remain.
- Scratch reproductions are in the session scratchpad (`vt/journal.scratch.ts`).

---

## P0 / P1

### 1. P1 (data loss; narrow window): a journal recovered from `.tmp` loses every later move
- Where: save/store.ts:41-43 (`readAtomicText` falls back to `.tmp`), session.ts `replayJournal` (~l.587) and `appendLine`.
- How the window opens: on iOS, `Filesystem.rename` is "delete destination, then move" (verified in IONFilesystemLib `shouldPerformDualPathOperation` → `deleteFile`, then `moveItem`). A kill between those two steps leaves only `pips-<slot>-journal.log.tmp`.
- What happens next:
  1. On relaunch the moves are restored from `.tmp`.
  2. Because the text is complete, there is no rewrite.
  3. The next move goes through `appendText`, which creates a **headerless** final file (`"0c330b5b03\n"`).
  4. On the following launch the header doesn't match ("journal for another level → fresh"), so every move on the board is lost.
- Reproduced in scratch: 3 moves → 0.
- Fix: `readAtomicText` reports which file it read. When the data came from `.tmp`, `replayJournal` always calls `rewriteJournal()`, or `appendLine` treats the slot as dirty (`journalDirty.add(slot)`).

### 2. P1: a rewarded "ad break" closed early hangs the ads queue for the rest of the session
- Where: ads/AdMobAds.ts:117. The native `showRewardVideoAd` resolves **only** inside `userDidEarnRewardHandler`. A dismiss without reward, or `didFailToPresent`, never resolves or rejects the call (node_modules/@capacitor-community/admob/ios/.../AdRewardExecutor.swift).
- Scenario:
  1. The player taps the moon/pause chip.
  2. They close the rewarded ad before the reward.
  3. `provider.showRewarded()` never settles, so the `serial()` `busy` chain (ads/index.ts:80) is blocked forever.
  4. Every later `ads.onUnitComplete` never resolves: no interstitials, no counter persistence, and no break chip until relaunch.
- Not a crash: the UI uses `void`.
- Fix: in AdMobAds, race the show call against the `onRewardedVideoAdDismissed` and `FailedToShow` listeners (resolve false). Add a timeout guard to `serial()`.

### 3. P1: the 30-min break is almost never actually offered; showInterstitial resolves before the ad closes
- Where: ads/AdMobAds.ts:87 says "resolves after dismiss". The native `showInterstitial` calls `call.resolve` right after `present` (AdInterstitialExecutor.swift).
- Consequence:
  1. In LanternsScene.ts:1590-1592, after the 2nd interstitial, `breakT0` is set while the ad is still on screen.
  2. Phaser's `time` is wall-clock after resume (TimeStep.resetDelta → performance.now).
  3. So if the ad lasts 8 s or more, `stepControls` (l.1708) drops the chip and calls `declineBreak()` on the first frame back.
  4. `dayBreakOffered` was already persisted as true, so the day's single offer is consumed without the player seeing it. This violates v3 §2-4 "두 번째 전면 직후 하루 1회 제안".
- Fix: resolve `showInterstitial` on the `interstitialAdDismissed` / `FailedToShow` events. Alternatively, start the chip timer on dismiss.

### 4. P1: an interstitial can appear mid-board or during the daily (no staleness check)
- Where: ads/index.ts:92-106 (`await ads.init()` → `gatherConsent()` → `showInterstitial()`); LanternsScene.endFinale l.1590.
- Scenario:
  1. On the first result moment of a launch, `init` or `gatherConsent` is slow. For example, on a flaky network `requestConsentInfo` waits on a timeout, and `gatherConsent` calls it again when the first attempt failed.
  2. Meanwhile the next level is played, or the player taps the moon into the daily.
  3. Then the ATT prompt and/or a preloaded interstitial show over the live board or the daily.
- Fix: capture a "result moment" token (unit id, start time) and pass a `stillAtBreak()` callback from the scene. If the player has made moves since, opened the daily, or more than ~2 s have passed, skip the show.

### 5. P1 (release gate): the iOS bundle is stale
- `ios/App/App/public` and `dist` were built 15:26. src changed afterwards: TownScene, daily, a11yLayer, textures, strings.
- Rebuild (`build:m1` + `ios:sync`) right before any device test or archive.

### 6. P1 (release gate, intentional for now): Google sample AdMob IDs and `testing: true`
- Where: Info.plist `GADApplicationIdentifier` and ads/config.ts.
- This matches phase2 ("test IDs only"), but nothing blocks a Release archive that still uses them.
- Fix: add a check in `scripts/check-no-probe.sh` / archive that fails on `3940256099942544`.

## P2

7. **Privacy manifest is inconsistent.** PrivacyInfo.xcprivacy:5-17 has `NSPrivacyTracking=false` with empty domains, yet declares DeviceID with `Tracking=true`, and the app requests ATT. Either set tracking true and list domains, or drop the entries that GMA's own manifest already declares.
8. **A finale level is generated on the main thread at cold start when its cache is missing.**
   - Where: session.ts `TrackRun.load` with `isFinale` → `generateOffThread(...,false)` → `dispatch` → `generateInTask` while `!painted` (l.335-345).
   - Scenario: the app is killed during the finale hold, before `pips-gentle-level.json` received n+1. The next launch blocks the first paint for the whole generation.
   - R now measures finales at ≤ 268 ms on Node (gentle 10–120) and 502 ms worst case up to n=3000, so on a device this is likely 1–3 s rather than 20 s.
   - The comment "a finale goes to the worker" is not true at launch.
9. **Finale hold can loop forever if generation fails.**
   - Where: LanternsScene.ts:1521-1537 and session `startNext`.
   - If `levelForTrack` throws, `nextP` resolves without `nextInfo`. The hold then re-arms every frame, and the scene is locked: finale guards block every button.
   - On relaunch, `Session.restore` rejects, so the screen stays blank.
   - The rules only throw for n ≥ 2^31 (tracks.ts:177/193 `udiv` ignores bit 31; `n=2147483650` gives a TypeError). Defensive fix: fall back to the previous level or surface an error, and fix the range check.
10. **`playSeconds` includes background time.** LanternsScene.ts:1442 uses `time.now - levelT0`, which is wall-clock, and `levelT0` also resets on every `layout()`. The policy says "real play" seconds, so the 150 s pacing can be met by idle or background time.
11. **The consent UI (UMP form / ATT) can open on the daily result sheet,** because `gatherConsent` runs for daily units too. It is not an ad, but it is a modal over the daily.
12. **The streak gift can be granted twice.** A daily finished after midnight is not counted, yet `dailyStreak` = `liveStreak` (still a multiple of 7) is passed. `giftDay` is the new day, so a second 1-h gift is granted (LanternsScene.ts:793, policy.ts:143).
13. **The break offer is consumed even when the rewarded ad isn't loaded.**
    - Where: policy.ts:183 sets `dayBreakOffered` at the 2nd interstitial; ads/index.ts:108 calls `prepareRewarded()` only after the decision.
    - After a relaunch, if the first unit triggers the 2nd interstitial, `offerBreak()` is false (not ready) and the day's offer is gone.
14. **A double moon tap before the daily chunk loads starts two switches.** In `onMoon` (l.747), `this.switching` is only set inside `.then`. It can also race with `onFar` travel. Set a pending flag synchronously.
15. **A daily completion is never counted if the app is killed between the completing move and the Preferences write and relaunched after midnight,** because the daily isn't restored the next day. Rare.
16. **Remaining minor items:**
    - Localized `CFBundleDisplayName` in every lproj overrides `$(APP_DISPLAY_NAME)`.
    - `@UIApplicationMain` is deprecated.
    - An unused Main.storyboard is still bundled.
    - Leftover `-D COCOAPODS` flag in Debug.
    - Launch storyboard colour #0f1124 vs #0f1222.
    - Share text from the rules function shows `#-18` before the epoch; the client wrapper strips it.
    - NaN hints render ✨.

## Verified OK
- **Ads policy numbers match v3 §2-4:** 2 units AND 150 s, 2 per session (3 after 10 min), 12 per day, 5-unit grace, daily = 0, break after the 2nd interstitial once per day, 7-day gift = 1 h.
- **Ads never crash or block the game when the plugin fails or is missing:** every native call is caught, the provider falls back to NullAds, and adsHooks wraps every call.
- **Ads chunk stays off cold start:** AdMob is a dynamic import after the first move.
- **Determinism:** no Math.random, Date or floats in games/. All generator loops are bounded. No throws for gentle/deduce 1–120 or for dailies in 2026–2027.
- **Scenery boot crash:** `moonHalo` / `heartGlow` are now created in the constructor.
- **Swift threading:** A11yPrefs hops to main and removes its observers in deinit. ColdStartProbe is excluded from Release (PERF_PROBE). `isInspectable` is off in Release. No `server.url`.
- **Privacy:** no PII in logs.
- **Streak and shields:** month, year and leap-day boundaries are covered by the existing tests.

## Part 2 — UI / town / a11y lifecycle

Static findings for town / sheets / a11y / textures / board are in `playtest/CODE-REVIEW-ui.md` and are not repeated here. This part adds runtime numbers and the remaining modules (audio/*, feedback, motion, adsHooks, LanternsScene timers).

How it was measured:
- The e2e bundle was built from the src snapshot of about 15:40 (TownScene.ts 15:38). It was built into a scratch outDir, so `dist` and `build/e2e-web` were not touched.
- Headless Chromium, 390×844 @2x, seeded at gentle 9.
- GC was forced before every sample.
- `TownScene` instances were counted with CDP `Runtime.queryObjects`.
- Scripts are in the session scratchpad: `leak.cjs` and `a11yprobe.cjs`.

| run | JS heap | textures | scale `resize` listeners | live TownScene | DOM nodes | game/scene/input listeners |
|---|---|---|---|---|---|---|
| baseline | 26.3 MB | 100 | 3 | – | 79 | 14 / 45 / 2 |
| town open/close ×1 → ×10 → ×30 | 27.8 → 28.6 → 29.4 | 100 (flat) | **4 → 13 → 33** | **1 → 10 → 30** | 79 (after the HUD fade) | flat |
| settings ×30 | +1.2, flat after ×10 | 100 | 3 | – | flat | flat |
| daily result sheet ×30 (solve → sheet → home; replays) | +7 on the 1st, then +1 → plateau ~34.6 | 151 (flat after the 1st) | 3 | – | flat | flat |
| 20 levels (gentle 9→29) | 33 → 41, slope flattening | 148 → 209 | 3 | – | 102 | flat |

### P1 (confirmed, unbounded but small): the town resize-listener leak is real — TownScene.ts:231-232
- Each open adds exactly one `scale` `resize` listener and keeps one dead `TownScene` alive. After 30 opens there were 33 listeners and 30 instances.
- The retained cost is about 50 KB of JS heap per open.
- The retained scenes keep no canvases: `textures.remove` → `CanvasPool.remove` resizes the canvases to 1×1, and the texture count went back to 100.
- A resize after 30 opens ran 30 stale `close()` calls. Each returned early on `phase === "closed"`, with no errors.
- The fix is in CODE-REVIEW-ui.md: listen for `destroy`, or call `scale.off` in `finish()`.

### Refuted / bounded (numbers above)
- **TextureBank growth over levels is bounded.**
  - Each level adds `board:<seed>@cs` and `house:<hash>` and removes the previous pair (+2/−2).
  - The extra growth is about 1 new `litWin@WxH` per level while new window sizes appear, plus number glyphs for each new cell size.
  - Total canvas area stayed at 8.0 → 8.7 Mpx over 20 levels.
- **A11y DOM does not accumulate.**
  - It drops to 18 nodes while the town or a sheet covers the HUD and returns to 79 within about 300 ms of the HUD fade-in.
  - The live-region timer is single.
  - (The a11y layer builds its 30 buttons even when VoiceOver is off. That is cheap and only noted.)
- **Settings and result sheets have no growth** in listeners, timers, tweens, display list (109) or textures. The sheet and its textures are created once.

### Checked clean (static)
- **audio/\***
  - `initAudio` is idempotent (`armed`), so the gesture, visibility and Capacitor listeners are added once.
  - Cue voices are disconnected lazily in `admit()`. At most 12 (MAX_VOICES) stay connected.
  - Ambient grains are stopped one-shots.
  - The pad's oscillators, LFO included, are stopped on release.
  - The scheduler `setInterval` exists only while audible and the ambient level is above 0, and is cleared on mute or background.
- **feedback/motion/adsHooks:** no listeners or retained state, apart from one 45 ms haptic `setTimeout`.
- **LanternsScene `setTimeout`s (l.354, 662, 923, 1383, 1394):** they only play a cue or haptic, or `refreshMoon`, which is idempotent. After a level switch they only make a sound with a stale pitch, and nothing touches destroyed objects.
- **Scene and `game.events` listeners:** registered once in `create()` of the single long-lived scene.
- **Tweens / time events:** none in use (0 throughout the runs).
