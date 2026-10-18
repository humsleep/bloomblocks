# App Store screenshots, store text and the App Review ATT video

Everything here comes from the **real app** (guideline 2.3.3). The web bundle is the production `vite build --mode m1` (no test bridge: no `__test`, `__e2e`, no DEV hooks), put into a Debug simulator build. The shots reach their states by writing the app's own save files and Preferences (as `apps/client/scripts/sim-shots.ts` does), not by a test hook. No regular board is completed in a shot, so no ad is ever shown. The review prompt and the reminder ask are kept out through the seeded `rating` and `notify` prefs.

## One command

```sh
playtest/store/make-store.sh all --size 6.9                 # build + capture + compose, 10 locales
playtest/store/make-store.sh en                              # one locale
playtest/store/make-store.sh all --phase auto                # 6 shots per locale, no taps
playtest/store/make-store.sh all --phase taps                # settings (1 tap)
playtest/store/make-store.sh all --phase village             # village, letter, cottage (4 taps)
playtest/store/make-store.sh all --compose-only              # re-frame existing raw captures (caption edits)
python3 playtest/store/build-metadata.py                     # name / subtitle / keywords / promo / description → docs/store/metadata.md
```

- **Output.** `docs/store/screenshots/<locale>/01.png … 08.png` plus `contact.png` (en-US, ko, ja, de, fr, es, pt-BR, it, zh-Hans, zh-Hant). Raw captures go to `apps/client/build/store-raw/<size>/<lang>/` (git-ignored). The 80 PNGs are about 200 MB; they are build output, so keeping them out of git and regenerating is an option.
- **Size.** `--size` picks a `sizes.json` entry (canvas size, simulator model, tap points, board crop). Only 6.9" (1320×2868) is calibrated. ASC accepts this size alone: 6.5" is only required when 6.9" is missing [Apple screenshot specifications].
- **Simulator.** The default is a simulator named "DW Store <size>", created if missing. The status bar is overridden to 9:41, full battery, Wi-Fi, no carrier.
- **Taps.** Four states need taps (settings, village, letter, cottage). The script uses `idb ui tap` when idb is installed (installing it is a download: ask the owner). Otherwise it prints each point and waits for Enter. The 2026-10-18 set was tapped with the Claude simulator tool at the same points.
- **The clock matters.** The village and the room follow the device clock (dawn 05–09, day 09–17, dusk 17–21, night 21–05) and the device region (pt-BR → southern hemisphere, so spring). **Run the `village` phase between 17:00 and 21:00** for the dusk look; the 2026-10-18 set was captured at 17:00–17:12 KST, early autumn evening. Time zones cannot be faked: `SIMCTL_CHILD_TZ` does not reach the WebContent process.
- **Locale.** It is passed as `-AppleLanguages` / `-AppleLocale` (the app reads `Locale.preferredLanguages` through its native plugin). The system language of the simulator itself stays English.

| File | Role |
|---|---|
| `store-shots.ts` | `seed <state>`: writes the world and launches. `grab <name>`: simctl screenshot. Throws if fewer than 7 residents moved in |
| `make-store.sh` | Build → install → status bar → per-locale capture (by phase) → compose |
| `compose.mjs` | Frames and captions (Fredoka 600/700 from @fontsource; CJK uses Apple SD Gothic Neo, Hiragino, PingFang). Korean keeps words whole, Japanese breaks only at phrase boundaries. Builds the contact sheet. Uses Playwright Chromium |
| `captions.json` | The 8 captions per locale (from the i18n QA pass), with the claims check in its header |
| `sizes.json` | Canvas size, simulator model, tap points and board crop per device class |
| `build-metadata.py` | Source and checker of the store text (limits, banned words, price words, "no ads" claims) |
| `trim-idle.swift` | Cuts idle waits from a screen recording; writes a half-size H.264 MP4 |
| `NOTES.md` | What was done on 2026-10-18, known issues, decisions |

### The world the shots show

The street is at house 12 (gentle track). Six dailies were counted before today (streak 6 → 7 on the postcard shot), after an older run of 14 dailies broken by a 5-day gap. That makes 20 lit days, so all 7 residents have moved in. Every mail is opened except Pip's move-in letter. Today's village notices, the market notice, the first-cottage line and the current season are already seen, so no dialogue card covers the screens.

## The 8 shots

| # | State | Caption (en) | Notes |
|---|---|---|---|
| 1 | Solving, lantern faces | A tiny friend in every lantern | |
| 2 | Rules, 3 real board crops | Place lanterns. Light every tile. | crops of the three rule boards |
| 3 | Daily result postcard, streak, shields | Collect a postcard every day | |
| 4 | Village, 7 residents, market stall, dusk | Friends move into your village | shows the full village; the caption says "as you play", not "on day one" |
| 5 | Furnished cottage (drawer closed) | Decorate your cottage | drawer closed so the room is not pushed under the status bar |
| 6 | Pip's letter | Letters and little gifts | |
| 7 | Today's puzzle in progress | A new puzzle every day | |
| 8 | Settings (dot numbers, sound, faces) | Calm, offline, your way | |

Claims check (Reality final G1): the captions do not claim visiting neighbors sitting, trade/shop/purchase/multiplayer, weather, "no ads", seven residents on day one, other games or anything not in the build. "No rush" replaces "no timer" because the postcard shows the time.

## App Review ATT video (`docs/store/review/att-flow.mp4`, 28.8 s)

Recorded 2026-10-18 on the iPhone 17 Pro Max simulator (iOS 26.5, system language English), after uninstalling and reinstalling the app (fresh app data and ATT state). The simulator itself had been erased the evening before.

1. Uninstall and install the app. Override the status bar.
2. `xcrun simctl io <udid> recordVideo --codec=h264 --force raw.mp4` in the background; stop it with `kill -INT <its PID>`.
3. `xcrun simctl launch <udid> com.humsleep.duskwick`. The tutorial starts by itself.
   - Tap step 1 (220,654), step 2 (283,730), step 3 (218,603).
   - Tap "Skip" (41,94).
4. Solve house 1 (5×5). Answer cells (x,y): (2,0) (0,1) (4,1) (2,2) (1,3) (3,3) (2,4). The tile centres in pt are x 59/139/220/303/383 and y 545/625/706/786/867.
5. Tap "Next house" (218,468). Google's message appears (about 3 s). Tap "Continue" (218,547). The ATT alert appears (about 3 s). Stop recording.
6. `swift playtest/store/trim-idle.swift raw.mp4 docs/store/review/att-flow.mp4`: 117 s of recording became 28.8 s. Only stretches where nothing on screen changes were cut.

Outside the EEA, UMP showed no GDPR form, only Google's IDFA explainer ("Tap Allow on the next screen"): a 5.1.1(iv) risk, see `docs/app-store-connect-pack.md` §4.
