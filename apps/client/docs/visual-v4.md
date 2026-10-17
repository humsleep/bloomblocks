# Round-3 UI fixes, v4 (2026-10-13)

From the round-2 persona re-test (`playtest/ANALYSIS-r2.md`). Shots `playtest/shots/v4/01…10`
(+ `03-gray.png`, `01c-onboarding-c.png`), video `v4/solve.mp4`
(capture: `cd apps/client && npx tsx scripts/sim-shots.ts`, header lists the tap-first shots).
Everything stays text-free; the only glyphs are digits.

## Numbers
- Default = big rounded digits (system `ui-rounded` = SF Pro Rounded on iOS: no font load
  on the cold-start path). Cap height ≈ 0.43 cell (19 pt on a 44 pt cell, 8×8 on a 375 pt SE).
  "0" is a real zero, never a ring.
- under: engraved near-black digit on the pale rock (≈ 8:1) · ok: gold digit with a dark rim +
  warm glow · over: moonlight-blue digit with a navy rim on the dimmed rock, moonlit edge, a soft
  shake on arrival and again every 3 s while it stays over; lanterns touching it get a faint cool
  rim. Grayscale: under = dark-on-light, ok = light outlined digit on light rock, over = light
  digit on a dark rock with a bright ring.
- Dice pips stay as a setting (gear → numbers). Numbered rocks carry no moss any more (v3's tuft
  was counted as a pip); plain rocks keep theirs.

## Settings sheet (gear, top left)
Two rows of two segments (≥ 56 pt): sound on / off, digits / dots. Warm rim = chosen.
Tap outside to close. Preferences keys `muted`, `numbers` (read in parallel with the save restore).

## Stuck made visible (analysis.blocked)
After a 1.2 s pause — or at once when every number is satisfied, no conflict, and only blocked
cells are dark — each blocked cell gets a cool dashed ring, a thin moonlight thread runs to each
stone touching it that blocks it (or the nearest blocking stone), and those stones ping once with
a soft stone knock. by='light' never occurs in practice (rules note); its branch threads to the
lanterns and stays harmless. Any touch hides it.

## Hints
- removeWrong is one lantern at a time: it lifts, gets a strong cool halo and an up-arrow; the
  button turns into "lift" with beads on its rim = wrong lanterns left after this one. Second tap
  (or tapping the lantern) takes it back; the beads stay on the "?" button until the next move.
- place: ghost = the real lantern shape washed in moonlight, bright outline (v3 was a faint dash).

## First run (Preferences `guide`, bits 1/2/4/8)
Ghost finger on gentle 1–3, until the first real move on that level:
1. tap a cell → ghost lantern + ghost light spreading;
2. a rock the opening shows (`startCells`) → finger places its lanterns → the digit turns gold;
3. two ghost lanterns that see each other → dotted moonlight line flickers → finger takes one back.
On gentle 1–3 a real conflict + 1.6 s pause → the finger taps one of the two lanterns.
Once, after gentle 5: the track button swells and the finger taps it twice.
Conflicts stay cool moonlight (palette rule), not red.

## Other
- Track button: deduce = steep hill with a lit lantern on the summit + a warm "+" badge;
  gentle = little house with a lit window.
- Double light removed during play (no rule depends on it, 8/8 read it as a state); the additive
  tile is only used by the finale wave.
- Level number = the house's number plate on its door (≥ 15 pt, ≈ 13:1; cream on gentle,
  moon-blue on deduce). The top-right number is gone.
- Next level: the solved house walks off to the left and the next slides in from the right; a tap
  during the finale jumps ahead with a chevron gliding over the house.

Unchanged: saves/resume (a track-generator bump invalidates caches and journals through the seed
key → fresh level, progress kept), audio cues, cold-start path, finale timing.
