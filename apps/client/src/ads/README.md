# src/ads — launch config B (owner: N)

Decision: docs/ads-plan.md (config **B**), docs/phase2-plan.md "Phase 5". Test ad units only (`config.ts`).

## API for the UI (via `src/game/adsHooks.ts` → `adsApi`)

| Call | When | Notes |
| --- | --- | --- |
| `init()` | after the first confirmed move | unchanged |
| `onUnitComplete(u)` | result moment of every unit (track and daily) | records only; never shows anything |
| `beforeNextBoard({ …unit?, tapped, lastInputAt, stillAtBreak })` → `Promise<boolean>` | old board has left, next **track** board not yet in; hold the entry until it resolves | the only interstitial slot; may run the one-time consent UI (UMP → ATT) instead. Never in or after the daily, never once `stillAtBreak()` is false, waits out 400 ms after `lastInputAt`, resolves at once while the SDK is still initialising. With the unit fields (`track`, `playSeconds`, …) in ctx it records the unit too. Pass the unit to exactly one of the two calls |
| `offerBreak()` | after `beforeNextBoard` resolved and the new board is in | true → show the moon-with-pause chip (8 s) |
| chip tap → confirm card | `breakConfirm(lang?)` → `{ title, text, yes, no, unavailable } \| null`, or the raw table `breakCardText(lang)` / `BREAK_CARD` (7 languages) | AdMob needs a clear opt-in and reward disclosure. null = do not offer |
| `giftActiveUntil()` | result sheet gift chip | ms epoch while the 7-day gift (1 h, no interstitials) runs, else 0 |
| `watchBreak()` / `declineBreak()` | card "watch" / card "not now" or chip timeout | `watchBreak()` false → show `unavailable` briefly, or just close |
| `privacyOptionsRequired()` / `showPrivacyOptions()` | settings row (show it only when required: EEA/UK/CH) | known after `init()`; false before that |
| `setMuted(m)` | every mute toggle | the saved Preferences `"muted"` is read at init |
| `setScreen(s)` | `"track" \| "daily" \| "town" \| "settings" \| "result" \| "guide"` | the banner (flag OFF) only ever shows on `"track"` |
| `onFullscreen(cb)` | once | `true` while an ad is up: suspend game audio (`AudioContext.suspend`); `false` resume |
| `onBannerHeight(cb)` | B+ only | px to keep free above the bottom safe area |

## Policy (policy.ts)

Between-boards interstitial when: not the daily (or the break right after one) · units > 5 (grace) · ≥ 2 units **and** ≥ 240 s of real play since the last one · ≥ 120 s since the app came to the foreground (a cold launch, or a resume after ≥ 30 s away) · ≥ 90 s since another full-screen ad or consent form · ≤ 2 per session (3 if the session is ≥ 10 min old) · ≤ 10 per local day · no 30-min break or 7-day gift running. App-open is removed. Rewarded comes in 3 placements (`break` live, `keepsake` and `archive` behind OFF flags). Banner (B+): `FLAGS.banner` OFF; track boards only, 50 % install holdout, not on install day, not during the grace / a break / the gift, only after ATT was answered.
Remote config: `src/ads/remote.ts` reads `https://humsleep.github.io/apps/duskwick/config.json` (owner guide `docs/web/remote-config.md`). In `ads.init()` (after the first move, never at cold start): the last good copy from Preferences `ads.remote.v1` is applied first, then a background fetch (5 s timeout, iOS only) applies and caches a fresh copy; any failure keeps the cached copy or the built-in defaults. `ads.applyRemoteConfig()` → `resolveRules()`/`resolveFlags()` clamp every value (`unitsBetween` ≥ 2, `perDay` ≤ 10, `playSecondsBetween` 180–900, `graceUnits` ≥ 5). `breakMs` stays fixed at 30 min, the length promised on the card.
Banner fixes: (1) no banner after or in the daily (screen-gated; `onUnitComplete` no longer touches it), (2) the provider is only called when the wanted visibility actually changes (create once, then `hideBanner`/`resumeBanner`), (3) a timer re-checks when a break or gift ends, and so does every resume and every `setScreen`.

## Audio (ios/App/App/AdAudio.swift, AppDelegate.swift)

- At launch, on a utility queue: `AVAudioSession` category `.ambient`. The silent switch then mutes the game, and the player's music keeps playing.
- Before `AdMob.initialize`, and on every mute change: `MobileAds.shared.audioVideoManager.isAudioSessionApplicationManaged = true` (GMA can no longer switch the session to `.soloAmbient` for an unmuted ad), plus `isApplicationMuted = <game mute>`. GMA is touched only here, after the first move.
- The web layer already sets `navigator.audioSession.type = "ambient"` (src/audio/cues.ts).
- **High-engagement ads cannot be turned off from the SDK** (GMA 13 has no API for it). Turn it off in the AdMob console: Apps → Duskwick → App settings → "High-engagement ads" OFF. Also add a per-unit frequency cap there (interstitial ≤ 10/user/day) and block the sensitive categories.

### Device checks (the simulator has no silent switch; do these on an iPhone)

1. Silent switch ON → the game is silent, **and an interstitial video is silent**. This is the main risk: GMA should respect `.ambient` once the app manages the session. If an ad is audible, report it.
2. Silent switch OFF → game cues and the ambient drone play (Web Audio in WKWebView under `.ambient`). Play Music.app first: it keeps playing and mixes with the game.
3. Game muted (settings) → the interstitial video starts muted (`isApplicationMuted`).
4. After an ad closes → the game audio is back (needs U's `onFullscreen` resume), and the category is still `ambient` (`[ads] audio {category: …}` in the DEV log on every configure).
5. Background → foreground → no ad for 120 s. Consent form → no ad right after it.
6. Fresh install → **no notification prompt and no ATT prompt at launch**. ATT (after the UMP form in the EEA/UK) comes at the between-boards moment after the first completed non-daily puzzle — never at launch, never mid-board.
7. EEA (UMP debug geography, or a real EEA SIM / VPN): the settings row appears, and the privacy options form opens and closes.

## Local notifications (src/native/notifications.ts, for U's src/notify/**)

`@capacitor/local-notifications` **8.3.1** (exact pin; peer `@capacitor/core >= 8`; released 2026-08-19). Added to SPM via `npx cap update ios`, so web assets were not copied.
- iOS needs **no Info.plist key and no entitlement** for local notifications. `aps-environment` is only for remote push.
- The prompt is **alert only**: the app-local `NotifyAuth` plugin (ios/App/App/NotifyAuth.swift) calls `requestAuthorization([.alert])`. iOS prompts once per install, so the stock plugin's later alert+sound+badge requests neither prompt again nor add sound or badge. Leave `sound` unset and `interruptionLevel` at its default (`.active`).
- No prompt at launch: the plugin's native `load()` only installs its delegate, and the JS module is a dynamic import on first use. **Caution**: the plugin's own `schedule()` prompts silently while permission is undetermined. The wrapper's `schedule()` therefore refuses unless permission is already `granted`. The only prompt is `notifications.requestPermission()`, called from the player's opt-in tap.
- Web / e2e: every call is a no-op (`"unsupported"`), so no fake is needed.

## Mediation (research only; adding it needs the AdMob account)

GMA is pinned to **13.11.0** (`@capacitor-community/admob` 8.2.1, exact) and UMP 3.1.x. All four current adapters require GMA `~> 13.3` (podspec), so they resolve against 13.11.0. Every one of them is also published as an SPM package; add them to App.xcodeproj as package dependencies, never into CapApp-SPM (that file is CLI-managed).

| Network | Adapter | Partner SDK (exact) | Built with GMA | Released | SPM repo / tag |
| --- | --- | --- | --- | --- | --- |
| AppLovin | 13.6.4.0 | AppLovinSDK 13.6.4 | 13.8.0 | 2025-09-01 | github.com/googleads/googleads-mobile-ios-mediation-applovin `13.6.400` |
| Unity Ads | 4.21.0.0 | UnityAds 4.21.0 | 13.11.0 | 2025-10-06 | …-mediation-unity `4.21.000` |
| Mintegral | 8.1.7.0 | MintegralAdSDK 8.1.7 | 13.8.0 | 2025-08-26 | …-mediation-mintegral `8.1.700` |
| Liftoff Monetize | 7.7.8.0 | VungleAds 7.7.8 | 13.11.0 | 2025-10-06 | …-mediation-liftoffmonetize `7.7.800` |

Notes: these were the newest adapters on the changelogs as of this research, and none of them needs more than GMA 13.11. Re-check the changelogs before adding. The partner SDKs are pinned with `exact`, so an adapter and its partner SDK move together. Adapters need iOS 13+, and the app needs 17. AppLovin's SDK key goes in the AdMob mapping, not in Info.plist. Unity: set `testMode` before GMA init. Mintegral: `setDoNotTrackStatus` before GMA init. Liftoff ≥ 7.4.1 reads UMP consent on its own. Add each partner's SKAdNetwork IDs with `npm run ios:skan`; the lists were not pulled yet.
**Cold start**: adapters and partner SDKs initialise inside `MobileAds.start`, which this app runs only after the first move, so their init cost stays off the launch path. Two things still land on every launch: dyld and binary size (static xcframeworks), and any `+load` or static initialisers inside partner binaries. Download sizes for reference (these are not app-size impact): AppLovin about 5.7 MB, Unity about 12.9 MB, Vungle about 5.6 MB, Mintegral core about 13.3 MB (8 binaries). No vendor publishes launch-time numbers. After adding them: run `npm run measure:ios -- m1 20` and compare against the current baseline, and compare the App Store Connect size report with and without the adapters. Add one network at a time if the gate gets tight.
Sources: googleads-mobile-ios-mediation `adapters/*/CHANGELOG.md`, CocoaPods trunk podspecs, developers.google.com/admob/ios/mediation/{applovin,unity,mintegral,liftoff-monetize}.
