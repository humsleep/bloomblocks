# Phase 2 UI/UX, v7 (2026-10-14)

From `playtest/UX-AUDIT.md` (6.5/10). Shots in `playtest/shots/v7/`: `pm-*` iPhone 17 Pro Max, `se-*` iPhone SE (3rd gen),
`pm-a11y-*` largest text (AX XXXL) + Bold Text + Increase Contrast, `pm-rm-*` Reduce Motion, `cvd-*` Machado 2009
(protan · deutan · tritan · grey, severity 1, linear RGB), `web-*` Chromium dev build. Bursts in `_burst/`.
Capture: `cd apps/client && npx tsx scripts/sim-shots.ts --device <udid> --prefix pm-` (default out is now v7,
"all guides shown" = 255 incl. the new moon bit). Still wordless: digits only; VoiceOver labels are spoken, never shown.

## Rule: nothing over a digit (P0-1)
- Remove hint: the coral arrow stops at the rock's edge (r × 1.05); the coral ring around the rock pulses. While
  the arrow aims at a rock, its "too many" tag steps back to 25 % (`pm-06-hint-remove-why`).
- "Too many" tag: 0.3 cell tall, above-right of the digit's box (`pm-05-overfull` vs audit `zoom-v6-06-vs-05-digit`).
- Stuck mark on a number: further out on the shoulder (0.4, -0.4) at 0.5×; threads that start or end on a rock are
  cut at its edge (`pm-03`, `pm-04`). Guide's 0-lesson ✕ sits at 68 % toward the tried cell.

## Camera moves (P0-2)
`travel` / `switching` / town: the HUD (gear, street/home, undo, hint, calendar) fades to 0 over 150 ms and input is
swallowed; it fades back after (`_burst/pm-07-tower-reveal-00..11`: no button over the house while zoomed).

## Guide (P0-3, P0-4)
- Demo lanterns are the real lantern + flame + halo (the moonlit ghost stays the hint's own look) (`pm-00b-tap-lesson`).
- Every finger ends on the cell / rock / tower / moon it means and fades out while lifting off — it never comes to
  rest on another cell.
- Daily discovery (guide bit 128): once, after gentle 3 is cleared and today's daily is unplayed, the finger taps
  the moon (two loops; a moon tap also marks it) (`pm-12-moon-guide`). Reduce Motion: a still halo ring around the
  waiting moon instead of the breathing (`pm-rm-12-moon-guide`). No demos while VoiceOver runs.

## VoiceOver (P0-5) — agent A's `src/a11y`
`src/game/a11yLayer.ts`: `a11y.init(canvas)` after the first frame; ≤ 4 Hz refresh that only pushes changed sets.
Screens: `hud` (settings, street/home, undo, hint, moon = daily/dailyDone, far = tower/house, ad break), `sheet`
(9 options with `pressed`, + close), `card` (share, home, ad break, + close), board grid via `a11y.cell()`
(row/col, lit/dark, lantern/conflict, rock n + needs/over/stuck). Modal sheets clear the HUD; travel / town /
finale set the board to null. Announcements: placed / removed / conflict / undone / hint (+ the cell) / solved /
level n / stuck (`ann.stuck` requested from A; falls back to `cell.stuck`).

## Preferences (P1-6) — `src/render/vis.ts`
Single source for fontScale / boldText / increaseContrast / reduceMotion / voiceOver (A's native values once
attached; matchMedia + a `-apple-system-body` probe before). `motion.reduced` reads it. Texture keys carry
`vis.sig`, so a change re-bakes via one relayout.
- House plate `clamp(20k, 20, 34)` pt, far plates `max(14, 11k)`, town plates `clamp(14k, 14, 24)`, result digits
  `30·min(k, 1.3)`; bold → weight 800 for board digits, plates, calendar, result.
- Increase Contrast: opaque HUD discs + solid rims, gear at 100 %, opaque threads (no breathing), solid stuck marks,
  no glow behind the ✕, sheet segments full-strength (`pm-a11y-03`, `pm-a11y-05` vs audit `pm-09-a11y-compare`).

## Readability (P1-7, P1-8)
- Stuck thread: navy underlay (α 0.8, ≈ 3× the line width) under the 0.037-cell moonlight line → line/underlay
  ≈ 10:1, underlay/lit floor ≈ 7.8:1 (was ≈ 1.3:1). The culprit's cool rim got the same navy bands (`cvd-pm03-stuck`).
- Conflict ✕: 0.8 cell, near-black outline 0.2 s; the two lanterns burn darker. Protan / deutan / grey all keep
  the ✕ by shape (`cvd-pm04b-conflict` vs audit `cvd-pm04-conflict`).

## Stuck timing (P1-9)
0.9 s of no input in every case (input cancels), ONE thread (nearest stuck cell, else the nearest ⊘ number), a
second stuck cell gets its marker only, never two threads to the same lantern.

## No empty stage (P1-10)
While the finale holds for the worker (`session.nextLevelReady`), the next house's silhouette drifts in from the
right and a warm light breathes where the board will appear; the real house continues from the silhouette's spot
(`web-13-finale-hold-*`, slow worker 8 s). Reduce Motion: the still glow only.

## Daily result = bottom sheet (P1-11, P1-12)
`src/game/ResultSheet.ts` replaces the centred card: the solved board shrinks into the space between the house and
the sheet (`pm-10-daily-result-shields`, `se-10-…`). Layout: calendar tile · ⏱ m:ss ✨ (✨ = no hint, same as the
share text) · 🔥 streak + shields. The intro row (lit · unlit · lit day; a covered lantern settles on the unlit one)
exists only on the showing that plays it — no empty gap otherwise. Shields are the town's covered lantern
(`drawLanternHood`, shared with the street). One house button everywhere (`drawHomeButton`: daily way home,
sheet, town).

## Settings (P1-13)
Row 4 haptics on / off (phone with buzz arcs / struck; Preferences "haptics"), row 5 replay guide (finger in a
replay arrow: goal card, then the tap lesson on this board) (`pm-11-settings`).

## iPhone SE (P1-14)
Tower 0.8× under 700 pt; front-layer bushes move inward or are dropped unless ≥ 30 pt from every HUD button;
8×8 keeps ≥ 6 pt outside the frame (`se-13-deduce-8x8`, `se-14-main-30` vs audit `se-05`, `se-06`).

## Town (P2-15)
Street 1.3× (S = 1.3 · clamp(0.27 W, 90, 132)); the far ridge moved down (yb − 1.6 S) so no flat band is left
(`pm-town-30` vs v6 `town-30`). Tap a lit house → its solved board as a keepsake card above the roof (worker-
generated, 4.2 s, tap skips) (`pm-town-keepsake`). Idle life: moths around lamps in view (4 sprites), roof cats'
tails swish every ~5 s (still under Reduce Motion), no per-frame allocation.

## Ads hooks (src/game/adsHooks.ts → N's `ads`)
`ads.init()` after the first confirmed move; `onUnitComplete({track, daily, playSeconds})` at the end of the
finale (next level on screen) and `{…, daily: true, dailyStreak}` at the daily's result; the moon-with-pause chip
(`drawBreakChip`) in the HUD centre slot for 8 s after a unit (or on the result sheet) when `offerBreak()`;
`watchBreak()` on tap, `declineBreak()` when the moment passes.

## Launch, name
`<title>` Duskwick; on iOS (`html.native`) html/body are transparent so N's launch image stays until the first
canvas frame; web keeps the gradient.

## Perf
iPhone 17 Pro Max simulator, idle board: frame avg 16.5–16.7 ms, p95 16.8, max 17.3, 0 frames > 20 ms;
update p95 1 ms, render(JS) p95 1 ms (`[perf]` log). New per-frame work is typed-array / scalar only; the VoiceOver
refresh is ≤ 4 Hz and pushes nothing unless something changed.
