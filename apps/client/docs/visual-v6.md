# Round-5 UI fixes, v6 (2026-10-14)

From `playtest/ANALYSIS-r4.md`. Shots `playtest/shots/v6/01…11` (+ `05-gray.png`, `07b-tower-finger.png`,
`10b-daily-result-after.png`). Capture: `cd apps/client && npx tsx scripts/sim-shots.ts [--only <name>]`;
06 and 11 are `--stage`d and need a tap (hint button / gear). Bursts land in `_burst/`; the kept frame
was picked by eye (01 = frame 3, 02 = 3, 07 = 2, 10 = 0). Still text-free: digits only.

## Rules contract (round 5, adapted in `src/game/pipsApi.ts`)
`BoardAnalysis.culprit` · `stuckStones[{stone, reason, lanterns}]` · `blocked[].culprits` ·
`shareText(level, r, {showTime})`. The session passes its toggle history to `analyzeBoard` (culprit
tie-break). `culpritOf(a)` = `a.culprit`, else `blocked[0..].culprits[0]`, else none.

## Stuck = ONE culprit
- Only the culprit lantern is blamed (tilt, flicker, cool rim, one ping). Up to two stuck cells that
  it causes get the crossed-out sparkle and a bright thread bending through the spot its light covers;
  a stone cause of those cells gets one faint thread. Nothing else is listed.
- ⊘ numbers (`stuckStones` 'cannotReach'): the same crossed sparkle, small, on the rock's shoulder
  (digit stays readable) and a thread to the culprit — bright when no stuck cell carries one, faint
  otherwise; only the nearest such number is threaded, ≤ 2 marked.
- No culprit: markers only (the first stuck cell, or the stuck numbers), no threads.

## Over-full
The up-chevrons (read "needs more" 7/8) are gone: a coral tag with a bold white MINUS and a small
lantern ("one lantern less") on the rock's shoulder, bobbing down. Coral kept; in grayscale
(`05-gray.png`) the dark-rimmed white minus on a mid-grey pill carries it.

## Track = a place (the tower)
- No corner button. A tall tower stands on the far ridge (left). Its five windows light one per
  cleared deduce level; its lantern room glows once the tower is open; a small door plate shows the
  deduce level. Locked (before gentle 5) it is a dim silhouette, a tap only knocks.
- First unlock (gentle 6 reached, guide bit 64): a 1.5 s camera look — zoom toward the tower, its
  lantern room and windows light, back — then the ghost finger taps the tower (bit 8 once tapped).
- Tap the tower → the camera flies into it (zoom 2.4, fade), the deduce level swaps in, the camera
  flies out of the tower that now stands where the house was (`towerFor`: narrow stone body, glass
  lantern room = heart window, stacked windows, door plate). Deduce courtyard: deep-blue rim with
  gold/white stars. From there the home house sits on the far hill (right, plate = gentle level);
  tap → travel back. Reduced motion: the old board/house slide.
- The house is narrower (≤ 64 % W) so both landmarks stay visible.

## Remove hint (shows WHY)
The wrong lantern dims (≈ 55 %), sinks a little and loses its halo; a coral take-back curl turns
beside it; a coral thread with a dark-rimmed arrow head runs to what it breaks — an over-full
number (lands on the digit), else a stuck cell, else a ⊘ number, else the lantern it sees — which
pulses a coral ring. No ghost copy (the place hint's moonlit ghost is unchanged). The hint button in
this state: dimmed lantern + coral curl, coral rim.

## Daily
- Calendar tile (moonlit band with the date's moon phase, binder rings, day-of-month digits) between
  the home button and undo on the daily board; the result card shows the same tile at the top.
- Shields: an umbrella held over a lantern (lit / dim = used). The first time the card shows them
  (Preferences `shieldIntro`), a row of three days (lit · dark · lit) appears, a shield flies from
  its slot over the dark day, the day lights, then all returns (≈ 3.2 s, once).

## Guide
- Numbers (gentle 2): after the lanterns, the finger ends ON the rock while its digit turns gold
  (v5 pointed at nothing). Then the 0: finger moves to a free side of a 0 rock (away from the
  lesson's light), a ghost lantern appears, the 0 turns coral "too many" with the minus tag, shakes,
  a coral ✕ pops between them; the finger takes it back, the ✕ fades, the finger leaves.
- Conflict (gentle 3): `seeingPair` never uses a cell next to a 0 rock and prefers cells next to no
  number at all.

## Plate, settings, town
- Door plate digits ≥ 20 pt (22 pt on roomy doors), ink #1E1A33 on cream / moonlit enamel ≈ 14:1.
- Settings: third row = share box + stopwatch / struck stopwatch (Preferences `shareTime`, default
  on) → `shareText(…, {showTime})`.
- Town street: tap a village house on the far hill or the small street icon (left of the controls;
  on the daily that slot is the home button). `import.meta.glob("../town/index.ts")` lazy-loads
  `openTown(scene, {onClose})`; when the module is absent the icon is hidden and taps no-op.

## Fixed UI camera, worker-only next level (follow-up)
- A second camera ("ui", never zoomed / scrolled) draws the HUD only: gear, undo, hint, street /
  home, calendar tile, settings sheet, result card. Every other object is filtered off it as it is
  added to the scene (`addedtoscene`), HUD objects are filtered off the main camera (`markHud`).
  The tower reveal / travel zoom only the world; the HUD stays in the safe area (07 / 07b re-shot).
- The next level is requested from the worker when the level starts (250 ms after a swap) and again
  when the finale starts. If it is not there at the swap beat, the finale holds with the board away
  (timeline frozen) until `session.whenNextReady()` resolves; a skip tap jumps to that beat. The
  main thread only generates when there is no worker at all (or it failed / 15 s passed).
