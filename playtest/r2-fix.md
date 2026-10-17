# R2 fix — A1 (Reality defects + HUD grammar), A2 (rating prompt), A7 (first daily offer)

Owner: Frontend Developer agent. Ownership limits: no edits to `src/game/ResultSheet.ts` or the share code (A5 engineer
is editing it at the same time — `LanternsScene.ts` and `strings.ts` are shared, so every edit there is a small exact
replacement). Repo is not git: backup of the starting sources in the session scratchpad `orig/`.

## 0. Baseline (before) — done
- Before build: `vite build --mode e2e --outDir <scratch>/web-before` (sources as of the start, incl. the A5 engineer's
  work in progress at that moment).
- New driver `playtest/r2-fix/shots.mjs`: novice path with the iPhone insets injected (15: 59/34, SE: 20/0), en + ko,
  23 shots per config + a layout check per shot (`layout.json`; rules in the script header).
- `playtest/shots/v13/before/`: 92 shots. Hits per config: en15 16 · ko15 16 · enSE 17 · koSE 17.
  - next×grid: "Next house →" over rows 4–5 (all four configs) — P1-1 confirmed.
  - word×stone: "Solved!" over the 2 (gentle 1) and over two numbers on the daily — P1-1 confirmed.
  - band×plate / band×house: every error / hint / lesson line covers the plate and the door (SE: the whole house) — P1-3.
  - Visual: the board drops ~25 pt on solve and its frame reaches the home-indicator zone (845 pt > 818 pt) — the
    cause is the finale's 6 % camera push toward the heart window (the board is drawn by the main camera), not a y
    change, so the box check missed it; seen in `ko15-13/14`. P1-1 confirmed.
  - The plate turns to "2" at +1.2 s while board 1 is still there (`*-13/14`) — P1-2 confirmed.
  - Tutorial T4: the coral dot leads the goal line, the error is the second line (`*-04`, `*-05`) — P1-4; "Too many!"
    while the 2 wears the gold "done" ring (`*-05`) — P1-5. Wick (the v12 guide) rests half-faded beside the target,
    not in the air (P1-6 no longer reproduces with faces on; the hand is the faces-off fallback).
  - Hint "remove": coral return curl on the button and on the lantern (= the undo shape) — P1-7.
  - Names: HUD "Rules"/"규칙" vs sheet title "How to play"/"게임 방법" vs settings row "게임 방법" — P1-8.
  - P2: gear without a disc, "?" outline disc with its caption to the right, paper "today" tile, dark-outline "Skip"
    pill, "〈⌂" chip — #9 / #10 / #20; How-to card ④ big empty square, ③'s ✓ over the frame, scrollbar on the card
    edge — #12; ko "0은 없음." — #13; the first-daily card: centred modal with a drag handle, no title — #17.

## 1. Strings — done
- One name for the rules sheet in all 10 locales: `how.title`, `howTo` (→ settings row `cap.replay`, VoiceOver
  `replayGuide`) and the HUD caption `cap.how` = Rules · 규칙 · ルール · Regeln · Règles · Reglas · Regras · Regole ·
  规则 · 規則 (zh had 玩法, ja 遊び方, en "How to").
- New (block `R2FIX` at the end of `a11y/strings.ts`): `cap.settings` (the gear disc's caption), `daily.title`
  ("Today's puzzle", glossary term), `daily.offerYes` (the A7 card's button). ko #13: `how.c4s` "대각선은 세지 않아요.
  0이면 하나도 없어요.", `tut.t4corner` "대각선은 세지 않아요." (one way to say the corner rule, no noun ending);
  ko settings caption "공유에 시간" → "공유에 시간 표시" (#16).
- Glossary `docs/i18n-glossary.md`: "How to play" row → "Rules"; new rows "Today's puzzle (card title)", "play".

## 2. Layout: the message slot (P1-1, P1-2, P1-3) + one resting HUD — done
- `LanternsScene.layout()`: a slot between the HUD row and the board (`geo.slotH` = a two-line band, 54 pt × text
  size ≤ 1.25; the captions sit at its top). The error / hint / lesson line (`LineBand`, slim mode: same ≥ 17 pt
  type, less paper, words shrink ≥ 0.8 before it would grow), "Solved!" (30 pt) and "Next house →" (primary pill,
  44–56 pt) all appear IN the slot — never over the house, the plate or a board row. While the slot shows something
  the row's captions step aside (the discs stay: "tap Hint again" still has its Hint).
- Finale: no camera push (`camera: false`; the 6 % push toward the heart window pulled the board ~25 pt down into
  the home-indicator zone) and no plate flip (`nextNumber` dropped: the new house arrives with its own plate).
- "Next house →" waits until "Solved!" has had its moment in the slot (a tap hurries both).
- HUD rest: while the board is solved / switching, every HUD disc and caption eases to ONE opacity (0.4) instead of
  0.3 / 0.35 / 0.72 / 1 mixes; undo's own "nothing to undo" dim stays for normal play only.
- `LineBand`: the coral mark leads the line that is the error (`warnLine`), only that line makes room for it (the
  other stays centred) — P1-4; the paper's bottom now sits exactly on the anchor (its 6 pt shadow hung below).
- Wick: the band is below him now — `fitWick` no longer shrinks him for it; he ducks only if a band ever overlaps
  his box (kept as the safe fallback). Box check: wick × band / plate / captions (shots).

## 3. HUD grammar (#9 #10 #11 #20, P1-7) — done
- `drawHudDisc` = the spec disc (fill rgba(30,26,61,.72), 1.5 pt cream rim 35 %); `drawHudDiscEmph` = amber 2 pt rim.
- Top row: Settings (gear in the disc) · Rules ("?" in the disc) · Back (daily: chevron + house in the disc), 40 pt
  discs, captions UNDER them, pitch from the caption widths. The alley strip runs in that row right of the discs;
  the moon moved under the row at the right edge (the bough stays where it was); the far tower is capped under the
  row (`Scenery`); stars / fireflies keep (r + 8 pt) off every disc.
- Row: Town · Today (calendar glyph + day, amber emphasis while unplayed, check badge when done — the paper tile and
  its breathing halo are gone) · Wick · Undo · Hint (plain disc; "remove" state = emphasis + lantern + coral minus
  badge, the same badge the wrong lantern wears on the board — never undo's curl).
- Pills: `secondaryPill()` (outline cream 40 %): tutorial Skip, cards' "Not now"; cards' "yes" = the primary pill.
  Centred cards (AskCard, Settings) have no drag handle; cards can carry a title (daily cards: "Today's puzzle").
- Settings row "Rules" shows the same "?" disc (was a finger-in-a-loop icon).

## 4. Tutorial / Rules sheet — done
- T4 "Too many!": the 2 shows "over" (coral) while the line explains it (`Tutorial.previewOver`) — P1-5.
- Rules sheet: one inset width on every card, card ④ shows the 2-yard and the 0-yard side by side (no empty
  square), card ③'s ✓ sits on the stone's cell corner inside the yard — #12.

## 5. A7 first-daily offer — done
- `DAILY_AFTER` 5 → 3: the Today disc appears after gentle 3. At the first quiet moment on gentle 4 (no move yet,
  nothing else up, today's daily unplayed) one card: title "Today's puzzle", what it is (the welcome card's two
  lines), [Play] opens today's daily, [Not now] closes it. Shown once (Preferences `dailyOffer`); it also marks the
  welcome card seen. The one-time "today" pointer now waits one more board AND for the card; its caption steps aside
  while the finger shows (#18). Consent (consentAfterUnits) and the ad grace are untouched.

## 6. A2 rating ask — done (code + unit tests)
- `ios/App/App/ReviewPrompt.swift` (`AppStore.requestReview(in:)`, iOS 17 target; registered in MainViewController,
  added to the Xcode project), JS `src/native/review.ts` (web: records `globalThis.__reviewFake`).
- Policy `src/game/rating.ts` (pure `ratingVerdict` + session marks + Preferences `rating`): three happy moments
  (counted ✨ daily after its sheet closes and no reminder question follows · 5th / 10th house once the next board is
  in and no break chip · the 7th counted day); never in session 1, never after a hint / dead end (stuck read-out or
  the early "wrong spot" line) / any full-screen ad (`adsApi.onFullscreen`) / another prompt (consent / ATT via the
  `duskwick:prompt` event from `AdMobAds.gatherConsent`, the notifications switch, our question cards) in the same
  session, once per session, ≥ 60 days apart, ≤ 3 per 365 days. No custom pre-prompt.
- `tests/rating.test.ts`: 13 tests (every rule, the moments, parsing, the runtime with the Preferences fake).

## 7. After the A5 postcard landed — the SE milestone / gift moment (coordinator note) — done
- The postcard sheet's milestone / gift moment floats in the sky (SE: y 58 pt + its size); it met the top row's "Back"
  caption (before: `moment×cap.back` in all four configs, e.g. koSE 90×29 px). Fix in the HUD (ResultSheet.ts not
  touched): while the daily's sheet is up (it owns the screen; taps go to it anyway) the top row (Settings · Rules ·
  Back + captions) steps aside with the bottom row (`1 − cardK`). e2e `r2.spec` "postcard's milestone / gift moment
  vs the top HUD row (iPhone SE)" — verified it FAILS without the fix (`["cap.back"]`) and passes with it.
- LineBand / HUD with the new sheet: shots `*-24-daily-result`, `*-25-day7-milestone-gift` — no hits.

## 8. Tests, shots, cold start — done
- New e2e `e2e/r2.spec.ts` (9): message slot (Solved / Next not on a row, no camera zoom, plate keeps 1, one HUD
  opacity), error line not on plate / house / board, rating (first session none · house5 once then none · hint keeps it
  away · ✨ daily after the sheet closes), the A7 offer (not before gentle 3 · once · Not now · never again · Play opens
  the daily, no second welcome card), the SE moment. Updated: novice (captions incl. Settings, "규칙", card ④ copy,
  today after gentle 3), flow (settings captions), daily (today disc emphasis keys), fixtures (`dailyOffer: "1"`).
- Unit: `tests/rating.test.ts` (13), `tests/uiText.test.ts` + slot-band fit / offer button / title fit (fr, it rule line
  shortened so a lesson fits one line each: "Les lanternes ne s'éclairent pas entre elles." / "Le lanterne non si
  illuminano a vicenda.").
- Shots `playtest/shots/v13/{before,after}/` (en15 / ko15 393×852 insets 59/34 · enSE / koSE 375×667 insets 20/0,
  25 shots each + layout.json; driver `playtest/r2-fix/shots.mjs`): rule hits before 18 / 17 / 18 / 18 → after 0 / 0 / 0 / 0.
  (Script bug fixed on the way: `askPoint` is already a client point — tapping it through `toClient` again missed the
  card on SE.)
- Cold start, Chromium CPU ×4, interleaved A = start-of-task build / B = now (n = 10 each, Mac loaded, load avg ≈ 7):
  returning player interactive median 783 → 762 ms (−21; an earlier run +10), first run 608 → 613 (+5; earlier −2);
  first tap → render 15.0 → 14.8 ms. Within the +20 ms budget. (The first A/B run had the offer card up in B, so its
  tap number was not comparable; the repeat seeds `dailyOffer` for both.)
- Idle governor (`scripts/idle-movers.mjs`): board, mid-game, hint, settings, daily, result → ambient 20 fps, no movers.
- Swift: `xcodebuild … -sdk iphonesimulator` Debug builds with ReviewPrompt.swift (symbol in App.debug.dylib).
  The system sheet itself was not seen on a device / simulator.

## 9. Quiet `npm run verify` (repo root) — EXIT 0, first try, no reruns
- typecheck (root + core + client + tests) ✓ · root vitest 252/252 · client vitest 429/429 · fuzz 10 (2 skipped, as
  before) · e2e chromium + webkit 180 passed / 0 failed / 0 flaky / 26 skipped (shots, as before) · build:m1 ✓.
- Release gates (`node scripts/release-gates.mjs --allow-test-ads`): OK.
