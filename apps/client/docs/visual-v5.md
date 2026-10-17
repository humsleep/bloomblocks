# Round-4 UI fixes, v5 (2026-10-14)

From `playtest/ANALYSIS-r3.md`. Shots `playtest/shots/v5/00…11` (+ `05-gray.png`),
capture: `cd apps/client && npx tsx scripts/sim-shots.ts [--only <name>]` (06 and 10 need a tap
on the hint / share button after `--stage`). Still text-free; the only glyphs are digits and `:`.

## Colour meaning
Coral (`PAL.coral` #F2907A, rim `coralDeep`) means "not allowed / too many" and nothing else:
lanterns that see each other, a number with too many lanterns. Hints and the stuck read-out stay
cool moonlight; satisfied stays gold.

## Stuck (blocked cells)
- Mark: a dim four-point sparkle crossed out by one stroke (not a ring, not the hint's ghost lantern).
- `blocked[].lanterns` may contain correct lanterns, so only one is blamed: `culpritOf()` asks the
  rules' `mostCulpable` among the wrong lanterns listed. That lantern tilts back and forth, flickers
  and gets a cool rim; its thread runs stuck cell → the candidate its light covers (small circle) →
  the lantern, and it pings once. No wrong lantern involved → faint threads to ≤ 3 listed lanterns.
- Stone threads only when `'stone'` is in `causes`.

## Conflicts
The dotted moonlight line (read as "connect" 8/8) is gone: a coral ✕ pops halfway between the two
lanterns, both get a coral ring + rim, and the new lantern and its partner shake once (420 ms).

## Numbers
white/ink = not yet (or a 0 whose neighbours are not all lit), gold = satisfied, coral = too many —
the same for every number including 0. Too many: coral digit on the dimmed rock, two rising up-chevrons
on the rock's shoulder, a shake on arrival and every 3 s. Grayscale: dark rock + mid digit + chevrons
vs. dark-on-light (under) vs. light outlined digit on light rock (satisfied).

## Hints, undo, track
- Remove hint: the wrong lantern gets a cool halo and a ghost copy of it sinks away and fades on a
  loop; the hint button shows the lantern with two fading copies below it and a return curl. Every
  removal now sinks and fades (no lift).
- Undo (curved arrow, left of the hint): pops the last move; the journal is rewritten without it.
  Dim when there is nothing to undo.
- Track button: no "+" (two small stars over the hill instead). First tap ever (guide bit 32): a 1 s
  peek card of the other track's board (deduce = bigger, starry), then the switch.

## Onboarding (guide bits: goal 16, tap 1, digit 2, conflict 4, track 8, peek 32)
1. Goal card over the courtyard (gentle 1, twice or until a tap): 3×3 yard, the finger sets four
   lanterns around a "4", all tiles light, the 4 turns gold, every window of the house glows.
2. Tap → light. 3. Digit: the ghost lanterns light the floor like real ones. 4. Conflict: second
   lantern in the first's light → coral rims + ✕ + shake → the finger takes it back → ✕ fades.

## Daily (lazy chunk `daily.ts`, share plugin lazy)
- The sky moon is a live sprite with the real phase (rules `moonPhase`, 8 steps); it breathes while
  today's daily (device-local date) is not done. Tap → today's daily; done → replay as practice.
- Daily board: moon-silver frame with a fine inner line and a few stars; the house plate shows the
  daily number (blank while `dailyNumber` ≤ 0, before DAILY_EPOCH 2026-11-01). The track button
  becomes "home" (icon of the track you came from).
- No timer on screen; active time counts in the background (paused when backgrounded / away).
- Result card: real moon, ⏱ m:ss, 🔥 streak + the month's two shield lanterns (dim = used), share
  (system sheet, rules `shareText`, "#n" dropped while n ≤ 0) and home.
- Streak (Preferences `streak`): +1 per day with a counted completion; each missed day is covered by
  a shield of its month (2 per calendar month) or the streak restarts at 1. Only a completion on the
  daily's own local date counts; only the first completion of a date counts (Preferences `daily`).
- Saves: `pips-daily-level.json` / `pips-daily-journal.log` (seed key carries the date),
  `runs/p5-daily-<date>.bin`; `pips-progress.json` `daily` = resume into today's daily after a kill.
