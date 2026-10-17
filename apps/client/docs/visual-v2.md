# Visual + game-feel pass v2 (2026-10-13)

> Superseded in parts by `visual-v3.md` (pips rules, no basket, hints, tracks). The pip-stone
> and basket notes below describe v2.

Dusk hill town. Each level = one house; its courtyard is the board. Text-free
(only a tiny level number, top-right, 38% alpha, for support). Shots:
`playtest/shots/v2/01…07`, solve video `playtest/shots/v2/solve.mp4`
(capture: `npx tsx apps/client/scripts/sim-shots.ts`).

## Layout (portrait, one-handed)
Full-bleed canvas; the scene lays out inside the safe area (`#safe` probe in index.html).
Board bottom-anchored above the home indicator (≤60% of the usable height, cells
≤68 pt, never <44 pt — frame/gutters shrink first). Basket just above the board.
The horizon/house base is laid out for a reference 7×7 board, so the baked sky
never changes between levels (no per-level re-bake / hill jump).

## Rendering
Everything is painted once into cached canvas textures (`src/render/textures.ts`)
and drawn as images: sky + far hills + distant town and the front ground are two
baked layers (≤2x bake scale); the board's floor + rocks are one baked texture per
level. Per-cell light, double-light, flowers and lantern rigs are pooled images whose
animation state lives in typed arrays (`BoardView.Chan`) stepped in `update()` —
no tweens, no per-frame allocation, skip = settle every channel.
Particles: 6 twinkle stars + 16 fireflies + 3 smoke + 12 completion motes = 37.

Palette and contrast: `src/render/palette.ts` (relative luminance floor 0.024,
stone body 0.15 / top 0.29, lit edge 0.27, lit core 0.60, conflict 0.45 →
floor:stone-top 4.6:1, floor:lit 4.3–8.7:1, floor:conflict 6.7:1). Conflict =
moonlight ring + flickering cool flame + dotted moonlight line, never red.

## Timeline
- place: lantern arcs from the basket 140 ms, squash 1.15→1 90 ms, light spreads ~40 ms/cell (ease-out), flowers bloom 0→1.12→1 160 ms
- remove: lift 100 ms → basket 180 ms; light retracts outer→inner 30 ms/cell
- near-complete (≤2 dark): dark cells breathe (1200 ms), fireflies gather
- finale (tap anywhere skips): spread → 100 ms hold → flower wave 35 ms/ring (≤380 ms) → motes flow into the heart window (window lights, Success haptic) → fireflies rise → board out 320 ms / house sinks behind the hill → next level in 380 ms. Input live ≈1.9–2.1 s after the final tap.
- Reduce Motion: no flights/blooms/waves/slides/drift; light fades 120 ms; finale = heart window + crossfade.

## Integration points
**Audio** — all calls go through `src/game/feedback.ts` → `src/audio/cues.ts`:
`startAudio()` (main.ts boot; restores Preferences `muted`), `toggleMuted()` (speaker
icon, top-left, 44 pt), `ambientForLevel(n)` (1–4 wind, 5–14 +crickets, 15+ +water).
Cue sites in `LanternsScene.ts`: `feedback()` → place + spread {pitchIndex, litCount},
invalid {sequence:[pA,pB]} at landing (+140 ms), remove; `onCellTap` → stoneTap;
`afterSync` → nearComplete on entering ≤2 dark; `stepFinale` (F_WAVE) → complete
{sequence: pitch indices in placement order}; `advanceLevel` → nextLevel;
finale skip → tap. Pitch = `pitchIndexForCell(x, y, h)`.

**Pip-stone variant** — `drawPipStone()` (`render/draw.ts`), `TextureBank.pipStone()`
and `BoardView.build(level, seedKey, geom, pips)`: pass `pips = (cell) => 0..4 | null`
to bake numbered rocks instead of plain ones. For "pip satisfied" feedback, overlay
`bank.pipStone()` images per stone (same pooling pattern as `dark`).

**Slide-to-move** — input: `LanternsScene` pointerdown/up (add pointermove; keep
`downCell`). View: `BoardView.sync(st, now, move)` already flies a rig from any
board-local point (`ends.x/y`, `Mode.FlyIn`); a slide is `{cell: to, placed: true,
ends: {x: cx(from), y: cy(from), scale: 1}}` after retracting `from` without a
basket return (add a `moved` flag that skips `startLeave`). Session needs a
`move(from, to)` beside `tap()`.

**Star rating** — finale hook between `F_HEART` and `outAt` in
`LanternsScene.stepFinale` (≈1.1 s in). Add `Scenery.awardStars(n, now)` (e.g.
1–3 large stars brightening above the house, reusing the star texture) and stretch
`outAt` by the reveal time; the rating itself belongs in `Session` (moves vs par).

## Not done / caveats
- Capacitor Haptics has no soft/rigid styles or intensity: remove = selection tick,
  invalid = two selection ticks 45 ms apart.
- Frame times measured only in the iOS Simulator (Debug, Mac GPU); needs an
  iPhone 11 run (`npm run ios:device:m1`, watch `[perf]` console lines every 10 s).
- `src/native/haptics.ts` and `public/fonts/` (Fredoka) are now unused.
