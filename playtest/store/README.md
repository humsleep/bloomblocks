# App Store screenshots and the App Review ATT video (2026-10-18)

Everything here comes from the **real app** (guideline 2.3.3). The web bundle is the production `vite build --mode m1`, with no test bridge (`__test`, `__e2e`) and no DEV hooks. It goes into a Debug simulator build. States are reached by writing the app's own save files and Preferences, as `apps/client/scripts/sim-shots.ts` does. Ads never show: no regular board is completed. The review prompt and the reminder ask are also kept out of the shots, through the seeded `rating` and `notify` prefs.

## One command

```sh
playtest/store/make-store.sh en                 # en-US, 6.9" (1320×2868), build + capture + compose
playtest/store/make-store.sh all --size 6.9     # all 10 locales of captions.json
playtest/store/make-store.sh en --compose-only  # re-frame existing raw captures (caption edits)
```

- **Output.** `docs/store/screenshots/<locale>/01.png` … `08.png`, plus `contact.png`. Raw captures go to `apps/client/build/store-raw/<size>/<lang>/` (git-ignored build dir).
- **Simulator.** The default is a simulator named "DW Store <size>". It is created from `sizes.json` if it does not exist. Its status bar is overridden to 9:41, full battery, Wi-Fi and no carrier.
- **Taps.** Four states need taps: the village, the letter, the cottage (via the gift) and the settings. The script runs them with `idb ui tap` when [idb](https://fbidb.io) is installed. Otherwise it pauses and prints the point to tap in pt.
  - Install idb only with the owner's OK. It is a download.
  - The 6.9" points are calibrated in `sizes.json`. Another size needs one pass to calibrate them: take a screenshot and read the HUD and button centres.
- **Locale.** It is passed as `-AppleLanguages` / `-AppleLocale`. The app reads `Locale.preferredLanguages` through its native plugin.

Files:

| File | Role |
|---|---|
| `store-shots.ts` | `seed <state>`: writes the coherent world and launches. `grab <name>`: simctl screenshot |
| `make-store.sh` | Build → install → status bar → per-locale capture → compose |
| `compose.mjs` | Frames and captions (Fredoka 600/700 from @fontsource; CJK falls back to Hiragino Maru Gothic, Apple SD Gothic Neo and PingFang). Also builds the contact sheet. Uses Playwright Chromium |
| `captions.json` | The 8 captions per locale, with the claims check in its header |
| `sizes.json` | Canvas size, simulator model, tap points and board crop per device class |
| `trim-idle.swift` | Cuts idle waits out of a screen recording. Writes a half-size H.264 MP4 |

### The world the shots show

The street is at house 12 (gentle track). Six dailies were counted before today (streak 6 → 7 on the postcard shot). Before them comes an older run of 14 dailies, broken by a 5-day gap. That makes 20 lit days, so all 7 residents have moved in (`seed` throws if not), and there are enough jar gifts for a furnished cottage. Every mail is opened except Pip's move-in letter (the letter and gift shots). Today's village notices, the market notice and the current season are already seen, so the village screen is clean.

Time of day and season come from the device clock and region. A capture at 21:00–05:00 gives the night band; an en-US capture in October gives autumn.

## The 8 shots (en-US draft) and what will change

| # | Shot | Caption (en) | After the full village lands |
|---|---|---|---|
| 1 | Solving, lantern faces | A tiny friend in every lantern | Same |
| 2 | Rules, 3 real board crops | Place lanterns. Light every tile. | Same |
| 3 | Postcard, streak, shields | Collect a postcard every day | Same (maybe the room postcard as a 2nd card) |
| 4 | Village, 7 residents, autumn night, market stall | Friends move into your village / Seven lantern friends move in as you play | Re-captured 2026-10-18 on the full build (en-US) |
| 5 | Furnished cottage + drawer (no dialogue card over it, P1-1) | Decorate your cottage | Re-captured 2026-10-18 on the full build (en-US) |
| 6 | Pip's letter | Letters and little gifts | Re-captured 2026-10-18 on the full build (en-US). Kept as a letter: requests are not shown, so the caption does not name them |
| 7 | Today's puzzle, in progress | A new puzzle every day | Same |
| 8 | Settings (dot numbers, sound, faces) | Calm, offline, your way | Same. Maybe swap for a seasonal night scene if it converts better (PPO) |

Claims check: every caption describes something the build shows. There is no "Wick shows the way" style claim (DECISIONS: rejected). The postcard shows the time, so the shots say "No rush", not "No timer". If market or seasons ship, add them to captions only for the shots that show them.

## App Review ATT video (`docs/store/review/att-flow.mp4`)

Recorded 2026-10-18 on the iPhone 17 Pro Max simulator, iOS 26.5, with the system language set to English (otherwise the ATT alert follows the simulator's system language).

1. Uninstall the app and install it fresh (the ATT status resets). Override the status bar.
2. `xcrun simctl io <udid> recordVideo --codec=h264 --force raw.mp4` (stop it with `kill -INT <its PID>`).
3. Launch. The tutorial starts by itself.
   - Tap step 1 (220,654) and step 2 (283,730), then (218,603).
   - Tap "Skip" (41,94).
4. Solve house 1 (5×5). The answer is (2,0) (0,1) (4,1) (2,2) (1,3) (3,3) (2,4). The pt centres are x 59/139/220/303/383 and y 545/625/706/786/867.
5. Tap "Next house" (218,468). Google's message appears. Tap "Continue" (218,547). The ATT alert appears.
6. `swift playtest/store/trim-idle.swift raw.mp4 docs/store/review/att-flow.mp4`. This cut the 298 s of scripted waiting down to 36.6 s. Only the stretches where nothing on screen changed are removed.

Outside the EEA, UMP showed no GDPR form, only Google's IDFA explainer. It says "Tap Allow on the next screen", which is a 5.1.1(iv) risk; see `docs/app-store-connect-pack.md` §4.
