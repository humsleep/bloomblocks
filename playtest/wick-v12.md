# Wick B+ in the app (v12) — progress notes (decision A4)

Spec: `docs/team/r1-visual.md` §5, order: `docs/team/r1-critique-visual.md` (c). Mockups: `playtest/shots/wick-v2/`.
Screenshots: `playtest/shots/v12-wick/`.

## Step 1 — `src/render/wick.ts` + lazy TextureBank bake
- `src/render/wick.ts`: B+ paths (body 73×52, sheen, flame + core, arm nubs) as absolute M/L/C/Q/Z strings traced by
  `tracePath` (no Path2D needed), face rig (8 expressions), board-lantern face (4 + look ±1, cream underlay),
  motion functions (breathe 3.2 s, blink 140 ms, hop 620 ms, worry 480 ms).
- `TextureBank.wick / wickFlame / wickShadow / lanternFace`: get-or-create, first called after the first frame
  (faces turn on only after `loadLanternFaces()` resolves in `decorate()`), so nothing is baked on the boot path.

## Step 2 — board lantern faces
- `BoardView`: one face image per lantern rig (ambient), above the flame; idle / worried (conflict pair, looking at
  each other; blamed lantern) / happy (solve wave: each lantern smiles when the wave reaches it; Reduce Motion:
  all at once) / sleepy (doze). One blink at a time across the board (2.8–5.5 s, texture swap at 20 fps).
- Face = paper width × 0.92 with a cream underlay; lantern paper centre is cream now (`lantern.ts`).

## Step 3 — Settings "lantern faces"
- `feedback.ts` `loadLanternFaces / getLanternFaces / setLanternFaces` (Preferences `lanternFaces` = on | off, default on).
- `SettingsSheet`: row "faces" (options 14 facesOn / 15 facesOff; indices 0–13 unchanged), icon = lantern with / without face.
- Strings (10 locales, one block at the end of `a11y/strings.ts`): `cap.faces`, `facesOn`, `facesOff`, `tut.followWick`.

## Step 4 — hero (`src/game/WickActor.ts`, lazy chunk)
- `WickHero` on the bottom stepping stone (`backdrop.steppingStones`), depth between the front hill and the board.
  Size fitted so the flame tip and the hop stay under the LineBand's bottom edge and the house plate (`fitWick`).
- Reacts: place (happy 0.65 s), conflict (worried + shiver, until calm), hint (curious 2.4 s), solve (hop + cheer,
  then happy until the next board), doze after 45 s idle / the night beat (sleepy, slow breathe).
- Hidden: tutorial, town, daily (the calendar tile owns the centre slot), ad-break chip, result sheet, faces off.

## Step 5 — tutorial guide
- `WickGuide implements GuideActor`: hops onto the cell, stamps (ripple + onPress), hops back beside it. The hand stays
  the fallback when faces are off. Band line "tut.followWick" with Wick, "tut.follow" with the hand.

## Step 6 — board softening
- Lit slabs: no crack lines, grain ×0.6, pits ×0.5. Dark slabs: grain ×0.75, crack alpha 0.42 → 0.3.

### Fixes found while shooting
- The flame stayed fully visible above the band in the r1 mock. In the app the hero **ducks** under the error band
  (scale = band room / his height, 180 ms) and the size is refitted every quiet frame (new house plate, Dynamic Type).
- The tutorial guide faded in on every loop (alpha from the loop time) → fades in once.

## Acceptance (measured)
- Cold start, Chromium, CPU ×4, 393×852 @3x, interleaved A (before Wick) / B (with Wick), n = 10 each
  (`node playtest/wick-v12/coldstart.mjs`):
  - returning player: interactive median 696 → 702 ms (**+6 ms**), p75 715 → 729; first tap → render median 11.8 → 14.2 ms (+2.4)
  - first run (tutorial): 604 → 606 ms (**+2 ms**)
- Idle governor (`scripts/measure-idle.mjs`, 15 s): board 20 renders/s, town 20/s, result 22.7/s (before: 22.9/s).
  The script's result screen was stale (the first daily's welcome card blocked it): seeded `dailyIntro: "1"` like e2e/fixtures.ts.
- `scripts/idle-movers.mjs`: board, mid-game, hint, settings, result, reduced → ambient 20 fps, no Wick object listed.
  First run (tutorial guide) and conflict were full rate before Wick too (the hand / the conflict flicker); the hand's
  finger mover is gone, Wick's images are all ambient (his hops ask keepAwake).
- Overlaps (`node playtest/wick-v12/shots.mjs`, en15 / ko15 393×852 insets 59/34, enSE / koSE 375×667 insets 20/0):
  Wick's box vs the house plate, the LineBand panel and every HUD caption → **0** in 48 shots (`playtest/shots/v12-wick/overlap.json`).

## Tests
- `npm run typecheck:all` ✓ · client vitest 385 ✓ (new `tests/wick.test.ts`: 12 — paths / B+ placement / face rig /
  every expression and lantern face draws / blink · hop · worry · breathe / the faces setting persists and defaults on).
- e2e: two pinned caption lists gained the new row (`flow.spec.ts` settings v2, `i18n.spec.ts` settings captions).
- Quiet `npm run verify`: exit 0 (root 249, client 385, fuzz 10, e2e 150 chromium + webkit, m1 build).

## Not done here (decision A4 scope)
- HUD unification, the spoiler-free postcard, the alternate icon (other agents / later).
- On a real device: cold start p75 and battery with Wick (Chromium A/B only so far).
