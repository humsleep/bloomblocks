# Visual v9 — light, stone, one lantern (phase 5, agent V, 2026-10-16)

Input: `playtest/BENCHMARK-VISUAL.md` (5.2/10). Method: one target keyframe first, then the game was
rebuilt to match it. Everything is still procedural Canvas 2D (no bitmap assets, no third-party
textures — so no `docs/ART-SOURCES.md` entry was needed), `Phaser.CANVAS` kept.

Shots in `playtest/shots/v9/` (prefix `vis-` = this pass; U's flow shots share the folder):
- `keyframe.png` — the target still (play screen, house + courtyard, 4 lanterns mid-solve), rendered by
  `src/render/dev/keyframe.html` with the production bake code (`?far` = 8×8 falloff audit,
  `?lan=solved`, `?se`). `keyframe-vs-v8.png` = v8 `pm-03` beside it. `keyframe-solved.png`.
- In game (Chromium dev build, 440×956 @3x = Pro Max, 375×667 @2x = SE): `vis-pm-01-mid`,
  `vis-pm-02-conflict`, `vis-pm-03-over-stuck`, `vis-pm-04-hint`, `vis-pm-05-deduce`, `vis-pm-07-town`,
  `vis-se-01-mid`, `vis-se-02-deduce-late`, `vis-pm-a11y-01-mid` (text ×3.1 + Bold + Increase Contrast),
  `vis-pm-rm-03-over-stuck`, `vis-pm-rm-06-finale-*` (Reduce Motion), `vis-pm-06-finale-{200,1000,1600,2400}`
  + `-strip` (playFinale), `vis-pm-08-real-finale-strip` (the real solve flow as U wires it today).
- CVD (Machado 2009, severity 1, linear RGB; protan · deutan · tritan · grey): `cvd-pm-01-mid`,
  `cvd-pm-02-conflict`, `cvd-pm-03-over-stuck`. Lit vs dark separates by lightness in all four; the
  conflict ✕, the over-full veil + tag and the stuck thread keep reading by shape.
- Before: `before-pm-mid.png`, `before-pm-solve.png` (same dev harness, pre-v9 source).

## 1. Light model (`src/render/court.ts`, `BoardView`)
- The floor is always baked dark stone. A second bake holds **the same slabs under full lantern light**
  ("lit floor", one Phaser frame per cell). A lit cell shows its lit slab, times a **falloff**
  (multiply) along its nearest lantern's ray: white at the lantern → amber `FAR = (0.89, 0.78, 0.63)`,
  `w(t) = e^(−(t − 0.5)/1.7)`; then a soft **bloom** (ADD, 1.6 cells, strength `bloomA(d)`) so light
  corridors glow and spill a little into the grout. Every lantern adds a **pool** (ADD, r = 1.5 cells,
  0.8 Hz candle flicker 0.92–1.0, still under Reduce Motion) and a **contact shadow**.
- **Occlusion + rim**: rays stop at stones (`planLight`); a stone a ray stops at gets a warm rim on the
  side facing the lantern (rock: crescent; marker stone: its face edge), strength by distance, lit when
  the light reaches the cell before it.
- **Flow**: unchanged contract — each cell's light fades in `spreadDelay(d)` (≈ 40 ms/cell) after the
  flight; with the in-cell gradient the light reads as running along the ray. Reduce Motion: 120 ms fade.
- **Contrast** (audited in `keyframe.html`, 8×8 single lantern): dark slab mean L 0.025–0.033;
  farthest lit cell (d = 7) mean L **0.42**, 5th percentile 0.31; next to the lantern 0.74.
  Dark→far-lit ≥ **5.6:1** (target ≥ 4.3:1 / lit ≥ 0.27). Number faces stay ≈ 8:1 against their ink.
- v4's rule holds: no "double light" during play (a cell takes its nearest lantern's light, no sum).
- **Cost**: when nothing animates the board is ONE baked composite image (base + light + rims;
  `BoardView.comp`, re-painted once per settled move); per-cell sprites (lit / multiply / bloom /
  rims) run only during animations, the finale and guide previews. The lit floor is baked lazily
  (first light, else 120 ms after the board appears), off the cold-start path. Light stamps are
  ½-resolution (they are soft). No per-frame allocation (typed arrays, cached textures).

## 2. Stone-slab material
Tileable value-noise fbm (128², made once) applied as an `overlay` pattern; 8 slab variants per size
(tint, grain, pits, flecks, cracks on odd variants, worn hollow, edge occlusion, irregular worn
corners), grain turned by a random quarter per stamp, an upright moonlit bevel (top/right lip, dark
bottom/left). Lit variants are the same stones in warm sandstone, so a cell keeps its cracks when lit.
Grout ≥ 0.06 cell.

## 3. Flowers removed
`F` channel, flower sprites and `drawFlower` use on the board are gone; `setScales()` is a no-op.

## 4. One lantern
`src/render/lantern.ts` redraws the **icon's framed paper lantern from the icon's own path data**
(handle, roof cap, rounded paper body with two faint ribs, wooden posts, base). `drawLantern(ctx, h,
glow)` keeps its signature and anchor (0.8h wide, body centre 0.4h / 0.56h), so the board, guide,
result-sheet shields, town street, keepsake boards, hint "lift" icon, track icon, over tag and the
sky lantern all show the same object. Board lantern height 0.92 cell. The hint ghost outlines the new
silhouette.

## 5. Courtyard, not a card
The navy `drawPanel`-style frame is gone: a low stone wall (block seams, moss, moonlit lip, front face,
soft cast shadow on the ground, its own shadow on the floor), a paler threshold step where three
stepping stones come down from the house door (baked into the front layer at the HUD's centre slot),
the wall may reach ≤ 9 pt into the side gutter but keeps ≥ 6 pt to the screen edge (SE 8×8). Daily =
moon-silver wall with an inlay line; deduce = night-blue wall with gold stars. Tap targets unchanged
(cells are the layout's). The empty sky gets a bough from the right edge with one hanging lit lantern.

## 6. Finale — `board.playFinale(opts): Promise<void>`
U's call `{ origin, now, reduced, kind }` works as is (Scenery is found via `sceneryOf`). Options:
`nextNumber`, `camera: false`, `noWave`, `scenery`. From `now`: wave 0–380 ms · light swell 1.0→1.25
(+220–820) · camera push 6 % toward the heart window (+400–1000, ease-in-out-sine; anchor fixed at
start) · windows at 90 ms intervals from +400 (heart last) with light pools on the ground under lower
windows (ADD) · sky warms toward skyGlow (+700, back over 1.2 s) · the village light this level earns
+ two "promise" flickers · plate flip to `nextNumber` (+1.2 s) · camera back 2.1–2.6 s. `"alley"` =
3.9 s, 135 ms window steps, roof glow; `"daily"` = no camera. Reduce Motion: windows + village light
only, 1.0 s. `board.skipFinale(now)` jumps to the end. If the house starts to leave early the push eases
back in 300 ms (U's current timeline exits at ~0.7 s — see Requests to U #1).

## 7. Numerals
`src/render/glyphs.ts`: one hand-authored monoline digit set (SVG centre paths 0–9 + colon, round caps,
stroke ≈ 15 % of cap height, Bold Text ×1.22). Used on the marker stones (carved: light lip, dark
groove, lighter groove floor), house / tower / far plates (`bank.numerals`), town plates and the
calendar tile. **Marker stones** are now pale carved slabs (flat face, 0.12-cell side, chipped
corner, cast shadow). States: ink = engraved; **satisfied = the groove fills with lantern light**
(bright fill + dark groove walls + warm wash on the face, no sticker outline); over-full = coral groove
+ the face veil (now face-shaped) + the "too many" tag; stuck = unchanged mark/thread.

## 8. HUD grammar
`drawHudDisc` (night-stone gradient, 1 pt moon rim at 28 %) + `hudStroke` (2.25 pt at 48 pt, round
caps/joins, moon ink). Redrawn: undo (arc + stroked chevron), hint (same disc, stroked magnifier
holding lantern light + 6 pt flame dot; still differs from undo by shape AND lightness), street
(stroked roofline + one lit window), home (stroked house + lit window, shared with the daily back
chip), gear (stroked), ad-break chip. `src/game/hudArt.ts` (handed over by U) redrawn in the same
grammar: alley houses / tower floors / lamp mark (now the framed lantern) / month days / milestone
lantern / gift chip / hourglass / bell / clock / restart / privacy / back chip. Increase Contrast
keeps opaque discs and solid rims.

## Also
Breathing window on the far home (tower screen); lit landmarks in the street throw a pool on the
cobbles; `paintItemBloom(ctx, item, g, k)` in `src/town/paint.ts` for the visit moment (not wired:
TownScene is U's).

## Performance (honest)
- Chromium, CPU ×4 throttle, 440×956 @3x, idle mid board, median of 5: see the report numbers in the
  phase-5 summary; frame cost rose while the light sprites existed and dropped back with the static
  composite (one board image when idle). Headless Chromium canvas is a poor proxy for WKWebView.
- iOS simulator first-interactive (`scripts/measure-sim.sh` builds of the pre-v9 and v9 bundles on a
  throwaway SE3 sim): the first back-to-back runs were dominated by machine load (before median
  3115 ms, after 1658 ms — not comparable); the interleaved A/B is recorded in the phase-5 report.
- Memory: + one lit-floor canvas and one composite canvas per board (≈ 5–7 MB each at 3x for 8×8).

## WebGL (out of scope, noted)
`Phaser.WEBGL` would add: real bloom / glow PostFX on the light layer, normal-mapped Light2D on
slabs and stones (true per-pixel falloff and occlusion instead of the baked multiply), and cheaper
additive blending. Cost: shader compile on cold start (must re-pass the p75 ≤ 1.0 s gate on device)
and the custom phaser-core build flags.

## Open
- U: hold the house/board exit until `playFinale` resolves (≈ 2.6 s), pass `nextNumber`; ResultSheet
  digits → `bank.numerals`; tower floor column overlaps the moon/bough on SE.
- App icon: unchanged (already the framed lantern); benchmark #10's +15 % background lift not done.

## Progress log (V, 2026-10-16; one line per verified step, typecheck green after each)
- [x] keyframe (src/render/dev/keyframe.*) + playtest/shots/v9/keyframe*.png
- [x] #1 light model (lit floor × falloff, bloom, pools, rims, contact shadow, static composite, lazy lit bake)
- [x] #2 stone slabs (noise pattern, 8 variants, quarter-turned grain, upright bevel)
- [x] #3 flowers removed
- [x] #4 icon lantern everywhere (drawLantern → lantern.ts)
- [x] #5 courtyard wall + threshold + stepping stones; bough with hanging lantern (own image, hidden on the tower screen, right 17 % of the sky so the alley strip / tower floors stay clear)
- [x] #6 board.playFinale / skipFinale + Scenery finale (camera push cut when the house leaves early)
- [x] #7 numerals (stones, plates, far plate, town plates, calendar)
- [x] #8 HUD grammar (draw.ts icons + hudArt.ts handed over by U)
- [x] U requests: playFinale; hudArt restyle; paintItemBloom + landmark pools; breathing far-home window; plateN kept
- [x] sim cold start interleaved A/B (SE3, 4 rounds × 3): before median 1195 / p75 1240 ms, after median 1229 / p75 1239 ms
- [x] verification: typecheck ✓ · vitest 348/348 ✓ · Playwright chromium + webkit 110 passed / 26 skipped / 0 failed ✓
- [x] perf (Chromium, CPU ×4, 440×956 @3x, idle mid board, interleaved medians): frame avg 41–42 → 40 ms (static composite); board+sky bake 105–110 → 251–256 ms throttled (≈ +36 ms unthrottled desktop) — the cost that remains is the dark courtyard bake (slab variants + wall); the lit floor is already off the cold-start path
- [ ] open: U holds the exit until playFinale resolves + passes nextNumber; ResultSheet digits → bank.numerals; SE strip/moon overlap; #9 house facades and #10 result postcard / store set not started

## Round 2 (v10, coordinator critique) — progress
- [x] R2-1 numbered stones = the same boulder family (drawRock outline/shadow/occlusion, pale limestone, noise grain + pits, a smoothed face, moss as a lower-rim band — never round tufts); veil back to the boulder ellipse; rims = the rock rim ×1.07; numeral cap 0.43 cell unchanged, ink ≈ 8:1
- [x] R2-2 alley strip = a festoon: each cell draws its cord segment + a hanging paper lantern (done lit, current half-lit, ahead unlit paper, 10th bigger with the landmark sparkle); the mark after the 5th = a paper globe on the cord. Size / position stay U's (Requests to U: 22 pt cells, pitch = cell so the cord is continuous, keep clear of the moon on SE)
- [x] R2-3 courtyard grounding: the wall is laid as single dressed stones (irregular outer edge, ≤ 2.5 pt bulge, SE keeps ≥ 6 pt), mortar joints, grass at its foot, a soft ground vignette (22 pt) around it, a wider pale threshold; stepping stones 1.6× bigger. Tap targets unchanged
- [x] R2-4 town reframed (src/town/paint.ts): street scale S = clamp(0.25 W, 84, 118) (was 0.19 W, 70–92) so ~2½ houses fill the lower half; a back street of house silhouettes with lit windows on the mid hill, more far houses on the raised ridge, two moonlit cloud wisps, a foreground picket fence in silhouette along the verge; lit landmarks pool light on the cobbles. paintItemBloom → TownScene is U's (Requests to U, round 2 #2)
- [x] R2-5 house facades (src/render/house.ts, layout unchanged — own seed stream): 4 wall treatments (timber frame · clapboard · stone plinth · brick) × gable-with-shingles / mansard (no more flat box: level 1 is now a brick mansard with the heart dormer) × shutters (4 muted colours) × window boxes, wall grain, eave occlusion, moonlit rim moved to the right edge. Procedural, not hand-drawn SVG facades (honest)
- [x] R2 extras: hudArt `drawClock` is now an alarm clock (bold ring, two bells, feet, hands never collinear) — no longer reads as "1" at 16–24 pt; the numeral set has `#` (U can drop the result sheet's special case)
- [x] R2 verification: typecheck ✓ · vitest 348/348 ✓ · Playwright chromium 55 passed / webkit 55 passed (13 skipped each; one earlier webkit run lost its preview server — "Could not connect" — and was re-run green). Shots: playtest/shots/v10/ (pm-*, se-*, pm-a11y-*, pm-rm-*, cvd-*, before-after-v8-v10.png)
