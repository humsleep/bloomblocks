# Lanterns level generator (`games/lanterns/generator.ts`)

Pure, integer-only, deterministic: `level = generate(params)` with
`rng = Rng.from(params.seedKey)` (core xoshiro128** + SHA-256 seed). Ports must
reproduce it draw-for-draw; `tests/lanterns/generator.test.ts` pins three
levels as a snapshot canary. Any change to the output → bump
`GENERATOR_VERSION` (seed keys embed it: `lanterns:free:g1:<n>`,
`lanterns:daily:g1:<YYYY-MM-DD>`), so saved runs and past dailies keep replaying.

## Pipeline (per attempt)

1. **Layout** — stones = `round(area × pct / 100)`, `pct` drawn from
   `[densityMin, densityMax]` (5×5 16–24 %, 6×6 17–26 %, 7×7 18–28 %, 8×8 18–30 %).
   Symmetry `rot180` (½), `mirror` (¼) or none (¼); dailies are always `rot180`.
   Once a candidate exists, 2 of every 3 attempts instead move one stone (and
   its symmetry partner) of the best candidate — hill-climbing toward the band.
2. **Structural filters** (reject):
   - `disconnected` — floor is not 4-connected (a sealed pocket reads as a separate puzzle).
   - `isolated` — a floor cell whose row and column segments are both length 1
     (a free, forced lantern). Subsumed by `disconnected` in practice (0 hits).
   - `openRoom` — a stone-free rectangle larger than 36 % of the board
     (5×5: 9, 6×6: 12, 7×7: 17, 8×8: 23 cells). Big open rooms are solved by a
     row of lanterns with no thought.
3. **Exact solve** (`solver.ts`): bitboard DFS, MRV branching on the dark cell
   with the fewest candidate lanterns, packing lower bound, iterative deepening
   → minimum lantern count, one optimal solution, number of optimal solutions
   (distinct sets, capped at 64). Node cap 300 000 (`solverLimit`, never hit so far).
4. **Solution filters** (reject):
   - `tooFew` — `minLanterns < max(3, side − 1)` (covers "min ≤ 1").
   - `forced` — forced-move ratio = 1000 ‰: a pure deduction player (place where a
     dark cell has exactly one non-conflicting position that lights it) solves
     it without a single decision. Never fires: without number clues forced
     cells are rare (see stats).
5. **Difficulty** — the human-like bot (`human.ts`) plays the level 8 times
   (screen) and, if promising, 56 more (confirm, against the winner's curse).
   Estimated seconds per run = 4 × placements + 2 × removals + 6 × dead ends
   (give-up after 400 actions = 300 s). `difficulty` = median, plus `fast`
   (~p20) and `tail` (~p88).
6. **Band** — accept when `median ∈ [lo, hi]`, `fast ≥ 0.4 × lo`,
   `tail ≤ 1.5 × hi`; otherwise keep the closest candidate (distance = seconds
   off, tail excess counts ½). After `maxAttempts` the closest is returned
   (`meta.inBand = false`). `budget = minLanterns + slack`.

## Curves

- `levelForIndex(n)` (free play, levelId = n): 1–5 → 5×5, 6–14 → 6×6, 15+ → 7×7.
  Tags cycle every 5 levels `mid, mid+, hard, easy, mid` (a breather right after
  each hard level); levels 1–2 are `intro`. Only 5×5 intro/easy get a spare
  lantern (slack 1): on bigger boards a spare makes the level trivial.
  Bands (seconds) live in `BANDS`.
- `levelForDaily(date)` (levelId = yyyymmdd): Mon–Tue 7×7 mid, Wed–Thu mid+,
  Fri hard, Sat–Sun 8×8 (8×8 appears nowhere else).

## Metadata

`minLanterns`, `solutions` (+`solutionsCapped`), `solution`, `forcedPermille`,
`difficulty` / `difficultyFast` / `difficultyTail`, `inBand`, `attempts`,
`rejected` (per reason), `outOfBand`, `stones`, `symmetry`.

Tools: `npm run gen:stats -- --count 1000 [--daily]`, `npm run sim:curve`.
