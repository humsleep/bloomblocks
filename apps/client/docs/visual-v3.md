# Pips rules + playtest fixes, v3 (2026-10-13)

The client now plays Lanterns-P ("pips", gameId 5) through one import module,
`src/game/pipsApi.ts` (re-exports `games/lanterns-pips/index.ts`: `levelForTrack`,
`analyzeBoard`, `hintFor`, `solutionOf`; `trackSeedKey` from `tracks.ts`).
Shots `playtest/shots/v3/01…08` (+ `02-gray.png`), video `v3/solve.mp4`
(capture: `cd apps/client && npx tsx scripts/sim-shots.ts`, see the header for the
tap-first shots).

## Saves (Library/lanternly/)
`pips-progress.json` `{v:3, game:"pips", track, gentle:{level,cleared,hints}, deduce:{…}}`,
per track `pips-<track>-level.json` (cache) and `pips-<track>-journal.log`
(`PPJ1 <levelIdHex> <seedKey>` + `<move><hash>` lines, replayed with `verifyRun`),
`runs/p5-<levelIdHex>.bin` (run.bin, gameId 5). levelId = n (gentle) / 0x01000000|n (deduce);
seed key = `trackSeedKey(track, n)` (carries TRACK_GENERATOR_VERSION, so a generator bump
invalidates caches and journals by itself). The old lanterns files are never read:
an upgrading player starts fresh on gentle 1.

## Numbered stones
Dice-pale rock (top ≈ L 0.55 vs floor 0.024) with dark ink pips (≈ 6:1 on the rock),
dice layouts 0–4 (0 = an empty ring), pips ≈ 16 % of the cell. Plain rocks keep the
v2 mossy grey. Status (`analyzeBoard().stones`), all text-free:
- under: ink pips · ok: amber pips with a dark rim + warm glow
- over: rock dims under a moonlit edge, pips turn moon-pale and pulse once (+ a soft stone knock, never a buzzer)
- blocked: dashed cool outline, slow breathe
- a 0-stone is "ok" by the rules from frame 1; shown neutral until all its floor neighbours
  are lit (no pre-counting, ANALYSIS P1-5).

## Hints (button right, on the near hill; unlimited, counted per track in progress)
- removeWrong → those lanterns wobble, get a cool halo band and a moonlight flame; the
  button turns into "lift" (lantern + up-chevron). Second tap lifts them all (one action,
  one journal line per toggle). Any board tap cancels.
- place → pale dashed ghost lantern on the cell; its anchor (stone: warm ring + its pitch;
  dark cell: moon ring) pulses 3× then stays faint until the next move.
- `recent` toggle history is passed to `hintFor` for its tie-break.

## Dead cells
`analysis.deadCells` get a cool dashed tile with a diagonal sheen after 1.5 s without
input; any touch hides it. The near-complete breathing (≤ 2 dark) stays as in v2.

## Tracks
Gentle = the house scene. The left button on the hill (winding path with three lit
lanterns) switches to deduce; there it shows a little lit house (back home). One tap:
board + house sink (300 ms), the other track's level loads (kept in memory once loaded),
both slide back in (380 ms). Each track has its own level number (top right) and its own
distant row of houses: gentle = the hill town, deduce = smaller houses on the farthest ridge;
one light per cleared level.

## Layout
No basket: pips has no budget, so a count of lanterns left would mean nothing and the
over-budget ghost would mislead. Its band became the hint/track strip and board height.
Lanterns now drop in from just above their cell and lift away + fade when removed.
Board: full width minus 10 pt gutters, cells ≤ 80 pt, ≤ 62 % of the height; under 44 pt
the frame/gutters shrink first. The horizon is laid out for a reference 8×8 board (deduce
max), so the sky never re-bakes between levels or tracks (boards are width-bound on phones,
so all sizes are about equally tall). Measured: 6×6 on 375 pt = 56 pt cells, 8×8 = 44.5 pt;
5×5 on 440 pt = 80 pt.

## Unchanged
Finale (window lighting, personal melody = `complete` cue with the placement-order
pitches), audio cues, cold-start path (all reads in parallel at boot; generation off the
critical path in the worker after a completion).
