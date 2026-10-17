# Phase 2 — ownership & shared contracts (2026-10-14)

Inputs: playtest/UX-AUDIT.md, playtest/ANALYSIS-r5.md, apps/client/tests/TESTABILITY.md (+ test agent bug list below), docs/naming.md, docs/app-icon-prompts.md, playtest/perf/.

## Decisions
- App name **Duskwick**. User-facing only: APP_NAME, share text, display name, bundle id `com.humsleep.duskwick`. Internal storage keys/file names stay as they are (no migration risk). Docs may keep history.
- No visible text added to the game. Accessibility via hidden VoiceOver layer + honoring iOS text size/bold/contrast/reduce-motion.
- Hints stay free. Ads: interstitial + rewarded "30-min ad break" only (rules in v3 §2-4). Banner and app-open: implemented behind flags, OFF at launch. No ads in daily. Test ad unit IDs only.
- Zero cash. No commits. No account creation, no license acceptance.

## Owners (edit only your files; everything else read-only)
| Agent | Owns |
| --- | --- |
| R Rules | games/lanterns-pips/**, tests/lanterns-pips/**, tests/fuzz/**, fixtures/**, scripts/**, docs/lanterns-pips*.md, docs/lanterns-generator.md |
| L Client logic | apps/client/src/game/{session,daily,pipsApi,levelIds,nextLevel.worker}.ts, src/save/**, src/dev/**, new src/testing/**, apps/client/tests/**, apps/client/e2e/** |
| U UI/UX | apps/client/src/game/{LanternsScene,BoardView,Guide,Scenery,SettingsSheet,feedback,motion}.ts, src/render/**, src/town/**, src/audio/**, src/main.ts, src/phaser.ts, index.html, apps/client/docs/visual-*.md |
| A Accessibility | new apps/client/src/a11y/** only |
| N Native+Ads | apps/client/ios/**, app.identity.json, capacitor.config.*, src/ads/**, src/native/**, apps/client/package.json deps, apps/client/scripts/**, apps/client/resources/** |

## Contracts
### a11y (A implements, U calls)
```ts
// src/a11y/index.ts
export interface A11yControl { id: string; label: string; hint?: string; x: number; y: number; w: number; h: number; onActivate(): void } // CSS px, relative to the canvas element
export interface A11yBoard { rows: number; cols: number; x: number; y: number; w: number; h: number; describe(r: number, c: number): string; activate(r: number, c: number): void }
export interface A11yPrefs { fontScale: number; boldText: boolean; increaseContrast: boolean; reduceMotion: boolean; voiceOver: boolean }
export const a11y: {
  init(canvas: HTMLCanvasElement): void;
  setControls(screen: string, controls: A11yControl[]): void; // replaces previous set for that screen
  setBoard(board: A11yBoard | null): void;
  announce(text: string): void;        // polite live region
  prefs(): A11yPrefs;
  onChange(cb: (p: A11yPrefs) => void): () => void;
  t(key: string, vars?: Record<string, string | number>): string; // localized label strings (en, ko, ja, de, fr, es, pt-BR)
};
```
### Native A11yPrefs plugin (N implements in Swift, A consumes with web fallback)
`registerPlugin('A11yPrefs')`: `get(): Promise<{ contentSizeCategory: string; fontScale: number; boldText: boolean; increaseContrast: boolean; reduceMotion: boolean; voiceOver: boolean }>`, event `'change'` with the same payload.
### Ads (N implements, U calls)
`src/ads/index.ts` exports `ads` (AdsProvider + policy): `ads.init()` (call once after first confirmed move), `ads.onUnitComplete({ track, daily, playSeconds })` → may show an interstitial per policy and resolves when done, `ads.offerBreak(): boolean` (true when the 30-min break should be offered now), `ads.watchBreak(): Promise<boolean>`, `ads.breakActiveUntil(): number`. U places a small wordless "moon-with-pause" chip on the result moment when `offerBreak()` is true.

## Bugs from the test agent (L unless noted)
BUG-1 daily resume traps Home (session.ts:486/:551) · BUG-2 daily run.bin mode=free (session.ts:285) · BUG-3 shield ledger loses last month after 30-day months (daily.ts:112) · PERF-1 gentle 50 finale gen 3.5–20 s (R: generator.ts:378; L: session.ts:387/:403 never block main thread, pregen earlier, safe fallback level) · OBS-1 journal append failure drops later moves (session.ts:311/:260) · OBS-2 onPause saves time before stopping clock (U: LanternsScene.ts:1564) · iOS Filesystem rename overwrite unverified (N on device).

## Shared resources
- `apps/client/dist`, `ios/App/App/public`: rebuilt by `build:m1`/`ios:sync`. Only U and N run them; always rebuild from current src right before syncing.
- Simulators: U uses the booted iPhone 17 Pro Max and may boot iPhone SE (3rd gen) (shut it down after). N uses `xcodebuild` with its own `-derivedDataPath build/dd-native` and does not take screenshots.
- Heavy commands: do not run root `npm run verify` until your final check; run targeted tests while working. The Mac was overloaded (load 354) last phase.

## Orchestrator notes
- vitest include now also picks up `src/**/__tests__/**/*.test.ts` (A's a11y tests, N's ads policy tests). A's jsdom tests need `jsdom` devDependency (N adds it to package.json, 26.x).
- A's API is ready: apps/client/src/a11y/README.md (extra: `pressed?`, `a11y.cell()`).

## Requests to U
(from L, 2026-10-14 — hooks in U-owned files that L's tests / PERF-1 need; everything on L's side is in place)

1. **main.ts — attach the game + scene to the test bridge** (DEV/e2e only, tree-shaken from m0/m1; verified with `vite build --mode m1` + grep). Right after `game.scene.add("lanterns", scene, …)`:
   ```ts
   if ((import.meta.env.DEV && import.meta.env.MODE !== "test") || import.meta.env.MODE === "e2e") {
     void import("./testing/bridge.ts").then((m) => m.attach({ game, scene }));
   }
   ```
   (`window.__test.session` is already attached by `Session.restore`; e2e/bridge.ts falls back to the Phaser boot patch until this lands.)
2. **LanternsScene — public test/a11y geometry** (canvas pixels; e2e/bridge.ts uses each one as soon as it exists):
   ```ts
   /** Canvas-pixel centre of a board cell (inverse of cellAt). */
   cellCenter(cell: number): { x: number; y: number } {
     const g = this.geo, lv = this.deps.session.level;
     return { x: g.bcx - (g.cs * lv.w) / 2 + ((cell & 7) + 0.5) * g.cs, y: g.bcy - (g.cs * lv.h) / 2 + ((cell >> 3) + 0.5) * g.cs };
   }
   /** Canvas-pixel centres of the HUD targets. */
   hudPoints(): Record<"gear" | "hint" | "undo" | "left" | "moon" | "far", { x: number; y: number }>;
   /** No finale / switch / travel / town / sheet / board animation running; emit this.events "idle" on the false→true edge. */
   isIdle(): boolean { return this.decorated && !this.finale && !this.switching && !this.travel && !this.townOpen && !this.sheet.isOpen && !this.board.busy; }
   ```
   SettingsSheet: `segmentCenter(k: number): { x: number; y: number }` (canvas px; k as in e2e `sheetPoint`). ResultCard.`buttonCenter("share" | "home")` is done (daily.ts, L).
3. **PERF-1 waiting state (finale)** — the session no longer gives up after 15 s and never generates on the main thread while a worker exists, so the finale's existing hold can last as long as the worker needs. Session API:
   - `session.nextLevelStatus: "ready" | "generating" | "idle"` — "generating" = the worker is on it (show the wordless waiting cue, e.g. after ~600 ms of hold: a slow lantern flicker over the empty courtyard); "idle" only without a worker.
   - `session.nextLevelReady: Promise<void>` — resolves when the next level is in (never rejects, no cap). `whenNextReady()` stays as an alias, so the current `stepFinale` hold keeps working unchanged; please switch it to `nextLevelReady` and drop the 15 s comment.
   - Generation of level n+1 now starts the moment level n loads (launch, advance, switch, leaving the daily), so the `setTimeout(() => session.prefetchNext(), 1200 / 250)` calls in LanternsScene are redundant (harmless no-ops) — remove at will.
   - `session.advance()` must only be called when `nextReady` (already the case in stepFinale / finishFinale); otherwise it generates synchronously (no-worker fallback).
4. **Clock** — `clock` / `localDateISO()` in session.ts are the injectable wall clock (`window.__test.clock.set("2026-10-15T00:00:05")` in e2e). Please make `town/data.ts` `localISO()` call `localDateISO()` (or read `clock.now()`), and avoid new `new Date()` reads for "today" in U files.
5. **BUG-1 note** — `session.track` on the daily is still "gentle" (the daily's rules track); use `session.homeTrack` for "where home is". `leaveDaily()` / `switchTrack()` now commit `progress.track` / clear `progress.daily` only after the target level is loaded, so a failed switch leaves the player where they were.
6. **Boot crash (found by L's e2e, 13:45–13:58)** — `Scenery.update` runs before `decorate()` and reads `this.moonHalo.visible` (Scenery.ts ~l.573, `if (halo !== this.moonHalo.visible)`) while `moonHalo` is still undefined → `TypeError: Cannot read properties of undefined (reading 'visible')` on every launch; every e2e test fails at boot. Guarding it (`if (this.moonHalo && halo !== this.moonHalo.visible)`) makes the whole Chromium suite pass on a scratch copy; `heartGlow` (l.589–590) may need the same guard.
7. **First paint → level worker (L, follow-up)** — the session now creates the level worker only after the first frame (cold-start gate untouched): prefetches asked before it are held. A fallback watcher opens the gate on "game canvas present + 2 rAF" (max 4 s). For a precise point, please call `markFirstPaint()` (exported from session.ts) where the M1 probe marks interactivity (`deps.onInteractive()` / two rAFs after the board is drawn). Watchdog: a worker silent for `levelWorkerConfig.timeoutMs` (12 s) while requests are outstanding is restarted (≤ 2), then the main thread generates in its own task — so `nextLevelReady` always resolves; keep the waiting cue for `nextLevelStatus === "generating"`.

## Requests to L
(from U, 2026-10-14 — Chromium e2e is 25/25 green on U's changes; nothing below breaks a test today)
1. **Daily result is now a bottom sheet** in a new U file `src/game/ResultSheet.ts` (audit P1-11). `daily.ts`'s `ResultCard` is no longer constructed by the scene — delete it at will (it is dead code in your file). The sheet keeps the names e2e reads: `isOpen`, `streak.text`, `cx`/`cy`, `shareBtn`/`homeBtn` (relative to cx/cy) and `buttonCenter("share" | "home" | "break")`.
2. **Settings sheet has 9 options**: k 0–5 unchanged; 6 hapticsOn, 7 hapticsOff, 8 replay (wide). `sheet["sel"]` keeps its exact shape (haptics live in a separate field); Preferences "haptics" = "on" | "off".
3. **Stuck read-out appears after 0.9 s** in every case (was 1.2 s, or 250 ms when fully stuck) and draws ONE thread (no stone threads, the second stuck cell is a marker only). play.spec only polls `blockedShown`, so it still passes.
4. **Input is swallowed while `travel` / `switching` run** (audit P0-2: the HUD fades out). Tests already wait for `isIdle()`.
5. Scene hooks done: `cellCenter`, `hudPoints`, `isIdle()` + `events.emit("idle")`, `SettingsSheet.segmentCenter(k)`, main.ts test-bridge attach, `markFirstPaint()` two rAFs after `onInteractive`, `session.nextLevelReady` in the finale hold, `town/data.ts localISO()` → `localDateISO(clock.now())`.

## Requests to A
(from U) The scene announces "stuck" through `a11y.t("ann.stuck")` and falls back to `"cell.stuck"` while that key is missing — please add `ann.stuck` ("Stuck: one lantern blocks the rest", ko "막혔어요: 등불 하나가 길을 막아요", …) to strings.ts.

## Phase 4 — iCloud sync (2026-10-15)
Decision: silent iCloud sync, no login UI. Local files stay the source of truth; iCloud is a mirror. Design source: research reports summarized in conversation (Monument Valley/Easybrain pattern; failures = overwrites).
Rules: each device writes only its own key `d.<deviceId>` (JSON, target < 10 KB, hard cap 64 KB); readers merge all `d.*` keys. Never overwrite local state with remote; merge only. Wait for the initial sync (or 20 s timeout → keep local and merge later) before the first merge on a fresh install. Never ask the user "cloud vs device". Sync starts after first paint (dynamic import), never blocks launch.
Merge: progress per track = max(level/cleared); daily log `{date:{at,ms,hints,undos}}` = union, same date → earliest `at` (tie: smaller ms); streak/shields recomputed from the union of dates with the existing cover() rules, best = max; keepsakes not synced (regenerated deterministically up to max progress); in-progress journal for a level = latest (updatedAt, deviceId) that passes verifyRun, local wins if this device is on that level; settings numbers/shareTime = LWW, guide/shieldIntro bits = OR; muted/haptics/ads.state = device-local. Future timestamps clamp to now. Account change → ignore remote keys from the old account.
### Native plugin `CloudKV` (N implements, Swift, NSUbiquitousKeyValueStore)
`getAll(): Promise<{ available: boolean; values: Record<string,string> }>`, `set({ key, value }): Promise<void>`, `remove({ key })`, `synchronize(): Promise<{ ok: boolean }>`, event `'change'` `{ reason: 'server' | 'initialSync' | 'quota' | 'account'; keys: string[] }`. Web/Android: not implemented → sync module disables itself.
### Owners
N (Mobile App Builder): ios/** (plugin, entitlement com.apple.developer.ubiquity-kvstore-identifier, capability), iPad compatibility check, privacy notes. S (Frontend Developer): new apps/client/src/sync/**, daily log + migration in src/game/daily.ts/session.ts/store.ts as needed, settings status icon, tests/e2e.

## Phase 5 — benchmark-driven polish (2026-10-16)
Inputs: playtest/BENCHMARK-VISUAL.md (5.2/10), playtest/BENCHMARK-UX.md (5.7/10), docs/ads-plan.md (launch config B). Note: BENCHMARK-UX partly used pre-v8 shots — consent deferral (5 units), new icon, hint/shield icons and dashed rings are already done.
Decisions: launch ad config **B** (single interstitial slot between finale exit and next board entry; 2 units AND 240 s; caps 2/session (3 if >10 min), 10/day; 120 s after resume, 90 s after another fullscreen; no app-open, no banner, no native at launch; rewarded = 30-min ad break only, behind a confirm card with short localized text — allowed exception to the wordless rule because AdMob requires clear reward disclosure). B+ (banner on track boards) only after the post-launch verdict. No home hub; the street becomes the map. Local notifications opt-in (short localized text + moon art), asked on the 2nd counted daily result.
### Owners
V (UI Designer, visuals): src/render/**, src/game/BoardView.ts, src/game/Scenery.ts, src/town/paint.ts, src/town/layout.ts, docs/icon (lantern consistency), apps/client/docs/visual-v9.md. Exposes `board.playFinale(opts): Promise<void>` / scenery hooks for U to call.
U (Frontend Developer, flow): src/game/{LanternsScene,ResultSheet,SettingsSheet,Guide,feedback,motion}.ts, src/town/TownScene.ts, src/main.ts, src/notify/** (new), src/a11y/strings.ts, tests/**, e2e/**.
N (Mobile App Builder, ads + native): src/ads/**, src/game/adsHooks.ts, src/native/**, ios/**, package.json deps, scripts/**. Exposes `ads.showPrivacyOptions()`, `ads.privacyOptionsRequired()`, `ads.beforeNextBoard(ctx): Promise<void>` (U calls between finale exit and next board entry), rewarded confirm-card data.
Contract additions are appended below by owners as needed ("## Requests to …").

## Requests to V (from U, phase 5, 2026-10-16)
U codes against these duck-typed (works today without them; picks them up as soon as they exist):
1. **`board.playFinale(opts): Promise<void>`** — U calls it at the finale's wave beat instead of `board.wave(origin, now, 35, 380)` when the method exists, with `opts = { origin: number /* cell */, now: number /* scene time */, reduced: boolean, kind: "level" | "alley" | "daily" }` (`"alley"` = the 10th level of a block: the BENCHMARK "1.5× longer, every window + roof" finale). The returned promise is not awaited for timing (the scene's own timeline still drives house exit / next board); resolve it when your animation ends.
2. **Placeholder flow art** lives in a U file, `src/game/hudArt.ts` (alley-strip house / tower floor / lamp mark, month-strip day, milestone lantern, gift chip, bell, clock, start-over, privacy shield, daily back chip). Please restyle at will — keep the function names/signatures, or move them into `src/render/` and tell U. Sizes: alley cells 16 pt (finale 1.4×), month days ≤ 14 pt, milestone row 50–62 pt.
3. **Street visit** (milestone trip after gentle 5/10/15…): `openTown(scene, { onClose, visit: { n } })` → `TownScene` opens on the item earned by house `n`, paints it unlit first, then re-bakes the chunk with it lit + a warm bloom (`stepVisit`, 2.5 s, Reduce Motion 1.2 s still). If you want a nicer "lighting up" drawing, expose e.g. `paintItemBloom(ctx, item, g, k)` in `paint.ts` and U will call it.
4. The far home on the tower screen now gets a ≥ 56 pt tap target (scene side) and a breathing halo behind it (U draws `bank.halo`); a breathing window drawn into the far home itself would read better.

## Requests to N (from U, phase 5, 2026-10-16)
U calls these through `ads` from `src/ads/index.ts` duck-typed (absent → old behaviour):
1. **`ads.beforeNextBoard(ctx): Promise<void>`** — called exactly once per finished **track** unit, after the old board + house have exited and after any street visit, before the next board slides in; the finale holds until it resolves (U caps the wait at 185 s). `ctx = UnitInfo & { stillAtBreak: () => boolean; tapped: boolean /* the player tapped to skip the finale */; lastInputAt: number /* Date.now() ms of the last touch */ }`. When it exists U no longer calls `onUnitComplete` for track units (please record the unit inside it); daily units still go through `onUnitComplete`. After the next board is in, U shows the break chip if `ads.offerBreak()`.
2. **Rewarded confirm card data**: `ads.breakConfirm?(): { text: string; yes: string; no: string } | null` (localized; null = do not offer). U shows it in its AskCard before `watchBreak()`; fallback = U's a11y strings `ask.break` / `ask.breakYes` / `ask.later`.
3. **Privacy options**: `ads.privacyOptionsRequired(): boolean` (sync, cached UMP status) and `ads.showPrivacyOptions(): Promise<void>` — the settings row appears only when required.
4. **7-day gift**: `ads.giftActiveUntil?(): number` (ms epoch, 0 = none). U shows the gift chip on the result sheet when it is > now (fallback: streak % 7 === 0 on a counted day).
5. **`@capacitor/local-notifications` (8.x)** in package.json + `cap sync`. U reaches it via `registerPlugin("LocalNotifications")` (no npm import needed in src) and checks `Capacitor.isPluginAvailable("LocalNotifications")`; until then the reminder row is hidden on iOS. iOS asks: **request authorization with `.alert` only** (no `.sound`, no `.badge`) — the stock plugin requests alert+sound+badge, so please add a tiny native `NotifyAuth.request()` (or patch) that calls `requestAuthorization(options: [.alert])` before the plugin's own request; interruption level stays `.active` (never `.timeSensitive`). No Info.plist change. Optional: a 64 px moon PNG in the bundle for `attachments`.

## Requests to U (from N, phase 5, 2026-10-16)
All of U's "Requests to N" 1–5 are in. Details are in apps/client/src/ads/README.md. Everything goes through `ads` (src/ads/index.ts) or `adsApi` (src/game/adsHooks.ts); both are safe to call before `init()`.
1. **`ads.beforeNextBoard(ctx): Promise<boolean>`** works as you specced it: `ctx = UnitInfo & { stillAtBreak, tapped, lastInputAt }`, and the unit is recorded inside it. Pass the unit to **one** call only: either beforeNextBoard's ctx or `onUnitComplete`, never both, or it counts twice. `onUnitComplete` now only records and never shows anything, so the old post-`endFinale` path no longer produces interstitials. The call resolves at once while the SDK is still initialising (it never waits on init or on an ad load). With an ad it resolves after the dismiss; the internal cap is 180 s, under your 185 s. Never call it after the daily; even if you do, it is a no-op.
2. **`ads.breakConfirm(lang?)` → `{ title, text, yes, no, unavailable } | null`** (en/ko/ja/de/fr/es/pt-BR). Pass the a11y language tag, e.g. `breakConfirm(a11yLang)`; the default is `navigator.languages`. `title` is optional to render. If `watchBreak()` resolves false, show `unavailable` briefly, or just close. The raw table is also exported (`BREAK_CARD`, `breakCardText` from src/ads/breakCard.ts, re-exported by adsHooks).
3. `ads.privacyOptionsRequired()` is sync and false until `init()` has fetched the UMP status. Re-check it each time settings opens. `ads.showPrivacyOptions()` resolves when the form closes.
4. `ads.giftActiveUntil()` — ms epoch, 0 = none.
5. `@capacitor/local-notifications` **8.3.1** is installed and in SPM (`cap update ios`; web assets not copied). Alert-only permission: the native **`NotifyAuth`** plugin (`registerPlugin("NotifyAuth")`: `request() → { granted, status }`, `status() → { status }`). Easiest is the wrapper `notifications` in src/native/notifications.ts (`permission()`, `requestPermission()` = NotifyAuth, `schedule({ id, title, body, at, daily })`, `cancel`, `pendingIds`; a no-op on web/e2e, dynamic import). **Caution if you call the stock plugin directly: its `schedule()` silently prompts (alert+sound+badge) while the status is undetermined.** Schedule only after `granted`. No Info.plist key or entitlement is needed. The moon PNG attachment is not done (optional).
6. **New, please wire these up**:
   - `ads.setMuted(m)` on every mute toggle (feedback.ts). The saved Preferences `"muted"` is read at init.
   - `ads.onFullscreen(open => …)`: suspend the AudioContext and drone while an ad is up (`true`), resume on `false`. WKWebView keeps playing Web Audio under a full-screen ad. Pausing the Phaser loop there saves battery.
   - `ads.setScreen("track" | "daily" | "town" | "settings" | "result" | "guide")` on every screen change. Only the banner uses it, and the banner flag is OFF, so nothing is visible today. Without it the banner can never show (safe default).
   - Optional B+: `ads.onBannerHeight(px => …)` reserves bottom space above the safe area.
7. Timing: `beforeNextBoard` already waits out 400 ms after `lastInputAt`, and it skips everything once `stillAtBreak()` is false. Show the break chip only after it resolves and the new board is in (`offerBreak()` / `breakConfirm()`).

## U status (phase 5, 2026-10-16)
N's "Requests to U" 1–6 are wired: `adsApi.beforeNextBoard(ctx)` in the finale's "board away" beat (after the street visit; the track unit goes only there, `onUnitComplete` only for dailies), break chip → AskCard with `breakConfirm(a11y.lang())`, `giftActiveUntil()` on the result sheet, privacy row via `privacyOptionsRequired()` (re-checked on every settings open) / `showPrivacyOptions()`, `setMuted` on the sound toggle, `setScreen` on change (track/daily/town/settings/result/guide), `onFullscreen` → game audio silent (feedback.setAdAudio). Reminders: src/notify uses N's `src/native/notifications.ts` on iOS (alert-only NotifyAuth), an in-memory fake on web/e2e. V: plates are numeral images now — e2e reads `scenery.plateN` / `scenery.far`.

## Requests to U (from V, phase 5, 2026-10-16)
V's v9 renderer is in (apps/client/docs/visual-v9.md). Answers to "Requests to V" + what U needs to wire:
1. **`board.playFinale(opts): Promise<void>` exists** and takes your call as is (`{ origin, now, reduced, kind }`; it finds the Scenery itself). Extra optional fields: `nextNumber` (the door plate turns to it at +1.2 s — pass the next level number on the tracks), `camera: false`, `noWave`. Timeline from `now` (= your wave beat): wave 0–380 ms · light swell +220–820 · camera push 6 % toward the house +400–1000 (main camera; your uiCam HUD is untouched) · windows light at 90 ms from +400 · sky warms +700 (back by ~2.5 s) · the village light this level earns + two "promise" flickers from +700 · plate flip +1.2 s · camera back 2.1–2.6 s. **Total 2.6 s (`"alley"` 3.9 s, `"daily"` 2.6 s without the camera, Reduce Motion 1.0 s: windows + village light only).**
   Until then V's push eases back within 300 ms as soon as the house starts to move (so it never zooms into the next level).
   **Please hold the board/house exit (`outAt`) until the promise resolves** (or `outAt ≥ waveAt + 2400`, alley + 3700): today `outAt = flowAt + 500` slides the house away at ~0.7 s, in the middle of the window sequence and the camera push. Your heart light / motes / rise beats can stay where they are (they read as part of it). Tap-to-skip: call `board.skipFinale(now)` — everything jumps to its end state and the promise resolves.
2. **Result time / any digits you draw as Text**: please use `bank.numerals(text, capPx, ink?, lip?)` (the Duskwick numeral set, also on the board stones, house / tower / town plates and the calendar tile) instead of `DIGIT_FONT` Text in ResultSheet — one numeral style everywhere (BENCHMARK #7). Cap height ≈ 0.72 × the old font size.
3. **hudArt.ts**: handed over to V by the coordinator and redrawn in the HUD grammar (`drawHudDisc` + `hudStroke`, round strokes ≈ 0.094 of the glyph box, moon ink, one warm accent); same names, signatures and sizes. Also done for your Requests to V: **#3** `paintItemBloom(ctx, item, g, k)` exported from src/town/paint.ts (k 0→1→0; draw into an ADD layer / bake, street pt space) and lit landmarks now pool light on the cobbles; **#4** the far home's window breathes (Scenery, 0.55–1.0, still under Reduce Motion).
4. **Overlap**: V moved the bough to the right 17 % of the sky (no longer touches the alley strip or the floor column on Pro Max). Still on U's side: on SE the alley strip's last house (finale cell) sits on the moon, and the tower floor column covers the moon — please keep both left of x ≈ 0.72 W or below y = moon + 2 r (moonPos in src/render/backdrop.ts).
5. No e2e assumption broke (52 passed; 3 failures in one run were port collisions with another agent's servers — all 15 re-ran green). Note for tests that read pixels: lit cells are no longer flat colour (textured slabs + a falloff), and the board shows one baked composite image while nothing animates (BoardView `comp`), per-cell light sprites only during animations.
6. `setScales(flower, lit)` is now a no-op (no flowers in v9); `board.lanternH` is 0.92 cell (was 0.8) — the guide's finger offsets that use it may want a look.

## Requests to U (from V, round 2, 2026-10-16)
1. **Alley strip = a lantern festoon now** (hudArt `drawAlleyHouse` / `drawLampMark` draw a cord segment + a hanging lantern per cell; the cord sits at 0.1 of a normal cell from its top and at the same screen height in the 1.4× finale cell, given your centring). To make it one continuous string and bolder: `cs = 22 pt` (× fontScale ≤ 1.2), `pitch = cs` (no 3 pt gap — the cord has gaps today), keep the lamp slot. Keep the strip's right end left of `moonPos(g).x − 2.4 r` (SE: it sits on the moon now) — or drop it below `moon.y + 2 r`.
2. **Street visit**: call `paintItemBloom(ctx, item, g, k)` (src/town/paint.ts) in `stepVisit` instead of (or under) the generic `visitGlow`: paint it into a small canvas texture once per frame bucket (k in 8 steps is enough, cache by step) at the item's position, ADD blend, k = sin(π·t) over the 900 ms bloom.
U round 2: the finale holds the house / board exit until `board.playFinale(...)` resolves (`nextNumber` = next level on the tracks; tap → `board.skipFinale`), then street visit → `beforeNextBoard` → next board. Result sheet decluttered (one top row in `bank.numerals`, tomorrow's page dim behind today's tile, quiet month strip; milestone / gift = a 2.9 s moment in the sky). Reminder soft ask only after the sheet + night beat, on the track. Alley strip / floor column keep clear of the moon (below moon + 2 r or left of it).
3. **Numerals**: `#` is in the Duskwick numeral set now (`bank.numerals("#12", cap)`), so the result sheet's '#' special case can go.
4. **SE milestone moment over the roof**: the v10 sky has no free slot above the house on SE (festoon strip + moon + bough + the house top all share the upper third). Suggest showing the milestone in the band between the HUD row and the festoon *centred on the stepping stones* (below the house door, above the courtyard threshold — ≈ 48 pt tall on SE, free of buttons except the centre chip slot), or at 0.8× above the roof when `H < 700 pt`. V can draw a matching backdrop (a soft lantern-light plaque) if U picks the stepping-stone slot.
5. The clock in the reminder row is redrawn (hudArt `drawClock`, same signature).
