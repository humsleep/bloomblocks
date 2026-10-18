# Village art v1 — app port notes (v14)

Port of the village art kit (playtest/village-mock, r2-village-art.md v2) into `apps/client/src/render/village/*`,
plus the puzzle screen's house → lantern-house (one world) and the Reality re-review defects (r2-critique-reality.md).

## Step 1 — kit core + lantern-house on the puzzle screen (done)

- `render/village/shade.ts`: tokens `T`, the ONE light model, `solid()` recipe, `OUTLINE` rule (2.5 % of on-screen
  height, 0.5–1.6 pt; px-per-pt set per bake with `setPxPerPt(u)`), material `texture()` (lazy 128² noise tile),
  `contact` / `glow` / `grain` / `flower` / `stoneBlob` / `miniLantern` / `moon` (lit side LEFT).
- `render/village/lanternHouse.ts`: `drawLanternHouse(ctx, cx, gy, s, opts)` + `LANTERN_THEMES` (wick, momo, sage,
  luna, pip, level) + `lanternHouseFor(seedKey, n, plateHalfHu)` → `HouseSpec` kind `"lantern"`:
  heart = round skylight in the lid (lit on solve), progress = 2 main windows + 0–2 small lower ones (only when they
  clear the number plate at this layout), door 30×48 units, no chimney / line / cat.
- `render/house.ts`: `kind: "lantern"`, `theme`, `HouseWindow.glass = "lantern"`; `drawHouse(…, u)` dispatches.
- `textures.litWindow(…, glass)`: a lantern window's lit overlay is round warm glass (no brick-house frame).
- `Scenery.setHouse`: plate clamp (never touches a window / flower box above it, re-review #4); `housePlateSize()`
  shared with the scene's small-window room check. Incoming silhouette = lantern-house too.
- `LanternsScene.placeHouse`: gentle + daily → `lanternHouseFor`; the deduce track keeps the tower.
- Re-review fixes in this step:
  - #1 moon: `drawMoonPhase` always mirrors → lit side faces the afterglow (left). Same in `shade.moon`.
    (`game/postcard.ts` has its own `drawMoonPhaseAt` — another agent's file, not touched; flagged.)
  - #2 flame "candle on a dish": the rig gap stays 7.2 units (r1 misread fix). What sat under the flame was a stone:
    the door stone is no longer painted, the middle stone steps 27 pt left (`stoneX`), and the puzzle house has no
    threshold stone. Wick stands at the door.
  - #3 bough: painted in the light model (plum-brown bark in 3 value passes with a key-lit top edge, night-green
    leaves with a key-light gradient + soft midrib band, outline = base → ink). No #120F22 cut-out.
  - #4 plate vs flower boxes: clamp above; on en15 the gap is ≈ 9 pt, SE ≈ 4 pt.
- Cold start (Chromium, CPU ×4, `playtest/wick-v12/coldstart.mjs`, n = 8 each, A = before this phase):
  returning Δ interactive median **+4 ms**, first run (tutorial) **+11 ms** (gate ≤ +20 ms). First tap Δ 0.2 ms.
- Shots: `playtest/shots/v14-village/{en15,enSE}-0x-L{4,9}-*.png` (board idle / half the windows / solved heart).

## Step 2 — the kit to the contract (docs/team/village-contract.md) (done)

`src/render/village/index.ts` exports `villageArt` (all six contract functions + `furnitureIds`); `src/village/art.ts`
(Frontend) loads it lazily — the kit lands in its own `village-*.js` chunk (47.7 KB). Only `lanternHouse.ts` + `shade.ts`
are shared with the puzzle screen (11.5 KB chunk; cold start measured, below).

| module | what |
|---|---|
| `residents.ts` | Wick, Momo, Sage, Luna, Pip: one body (Wick B+ paths + face rig), palette / flame (drop, petal, leaf, moon, twin) / proportion; `idle · talk · happy · shy · sleepy · silhouette` (plum `#4A3866` + one warm dot, never black). `residentHead(at)` = emote anchor |
| `furniture.ts` | the 12 catalog items × their catalog colourways in the PASS grammar; pilot 6 ported (`archChair` = renamed "Round chair"; tea table cream = warm cream token, mottle 0.12 = half); new: cushion, flower vase, round rug, wall clock, picture frame, teapot. `furnitureScale(id, w, h, "room" | "card")`: room = one common scale (bed ≥ 2× chair), card = fills the art box; never crosses the box |
| `nature.ts` | `drawVillageBackdrop(at)` (sky with the afterglow LEFT, moon lit-left, shadow-blurred cloud — no `ctx.filter`, hills, far lantern-houses, lawn, lane + a branch to every door, string lights whose bulbs skip the back houses' handles, pond, props, fireflies, plum vignette) + `villageLayout(at)` / `PLOTS` (6 houses + the mailbox) + `drawMailboxAt` (flag = band joined to the box) |
| `room.ts` | `drawRoomShell(at, {wallpaper, floor})` (3 papers × 3 floors), lid roof with scallops as value bands, round window on the right (cool fill) with the lit-left moon + two tiny lantern-houses, string lights; `roomGeometry(at)` = the 18 slot boxes + rug box + window |
| `letter.ts` | upright letter paper whose ruled lines ARE the text baselines (`letterLines` / `letterHeight`: n lines, ≤ 1 blank), envelope + wax seal, gift box + lid in one front projection, ribbon in colour, `rimLight` = inner gradient (no hairline), gift cushion, `drawEmote(hx, hy)` with the tail touching the head |
| `fonts.ts` | `loadVillageFont(lang, "ui" \| "letter")`: Fredoka 600 (already bundled) via FontFace + system CJK semibold stack; `LETTER_FACES` = the hook for the handwriting faces (empty — not downloaded, see G2) |

Contract notes for Frontend: `drawFurniture(…, { locked, fit: "card" })` — `fit` is an extra optional field (cards fill
their art box; default "room" keeps one scale across slots). Locked = the item's own drawing tinted (offscreen canvas).

Re-review defects closed in this step: #6 gift rim (gradient), #7 lid projection + ribbon colour, #8 letter (upright, ≤ 1
blank), #9 card clip (checked: 0 px outside box + PAD for all 42 cards), #10 locked = actual item, #11 heart on Momo's
head, #12 room roof value bands, #13 picnic removed (no lid-clear spot in the middle strip), #15 Album not drawn.
#14 wrap / kinsoku / orphans = Frontend's `src/village/wrap.ts`; CJK semibold = both `villageFont` and `fonts.ts cjkStack`.

## Step 3 — measurements + G1 shots (done)

- Cold start (Chromium ×4, n = 10, A = before this phase, B = full v14 incl. Frontend's village chunk):
  returning Δ median **−8 ms**, first run **−1 ms**, first tap Δ 0.1 ms (gate ≤ +20 ms).
- Idle: board / mid-game governor `ambient` 20 fps, `idle-movers` none; measure-idle board 20.2 renders/s.
- G4 texture estimate (`estimateVillageBytes`, RGBA): **@2x village 10.7 MB + room 11.4 MB = 22.1 MB** (backdrop
  screen-sized, 6 houses, 5 residents × 2, room shell, 18 slots, 36 catalog cards, letter / gift); @3x would be 49.9 MB.
  Device soak (3 GB, 20 round trips, ≤ 60 MB WebContent) still to run on a real phone.
- G1 shots (`playtest/shots/v14-village/`):
  - real app (e2e build, safe areas): `{en15,ko15,enSE,koSE}-0{1..6}-L{4,9}-*.png` — board idle / half the windows /
    solved heart skylight; overlap.json: Wick vs plate / band / captions = 0.
  - real kit modules (app's Vite, `playtest/village-art-v1/kit-shots.mjs`): `kit-{a_village,b_room,c_catalog,
    d_gift_letter,e_residents,f_room_variants,g_houses}@{2x,1x}.png`, `kit-checks.json`.
- Tests: `tests/village-art.test.ts` (11): lantern-house spec, catalog ↔ drawings (G8), no clip, room scale,
  18 slots, plot overlaps, letter lines, resident head; every item × colourway draws.

## Open
- G2 fonts: the handwriting faces are NOT downloaded (needs the owner's own approval in chat — an agent message is not
  approval). Build = Fredoka + CJK semibold; `fonts.ts LETTER_FACES` is the hook.
- `game/postcard.ts drawMoonPhaseAt` (another agent's file) still lights the right side — one-line mirror like `draw.ts`.
- The town street (`town/layout.ts` → `houseFor`) still draws brick houses; switching it to `lanternHouseFor` is one
  call but changes the town screen's layout (its owner's call).
- #5 string lights vs the house handle (puzzle screen): the app's lights hang ≥ 40 pt above the lantern-house's handle on
  15 Pro and SE (shots above) — no tangent; in the village the bulbs skip both back houses' handles.
- Verify: typecheck ✓, unit 252 ✓, client 506 ✓ (incl. village-art 11), fuzz ✓, e2e 185 ✓ / 1 ✘
  (`e2e/village.spec.ts:29` WebKit, Frontend's new spec — passes alone 3/3: timing under load), build:m1 ✓.

## Step 4 — G2 letter fonts (owner-approved; files downloaded by the lead) (done)

- `apps/client/scripts/subset-letter-fonts.py` (fontTools + brotli in a scratch venv, `python -I`, paths as args):
  per-language subset = the language's village text + a base set (ASCII, punctuation; kana for ja) → WOFF2,
  names replaced by `DuskwickHand Latin / KR / JP / SC / TC` (LXGW Reserved Font Names; all five renamed),
  copyright / version / licence name records kept. Manifest: `src/render/village/letterGlyphs.json`.
- Files (`public/fonts/`): letter-latin 16.3 KB (Patrick Hand) · letter-ko 54.9 KB (Gaegu Bold) · letter-ja 47.6 KB
  (Klee One SemiBold) · letter-zh-Hans 32.8 KB (LXGW WenKai) · letter-zh-Hant 42.8 KB (LXGW WenKai TC) = 194 KB.
  Gaegu lacks § · × – — … (they fall back to Fredoka / system in the stack).
  ja / zh are subset from the G3 probe lines (no translations yet) — rerun the script when their lines land.
- `fonts.ts`: `LETTER_FACES` (10 languages → 5 faces, weight range 100–900 so no faux bold), FontFace lazy-load from the
  village chunk only, Fredoka → system fallback on failure.
- Licences: `public/fonts/OFL-{PatrickHand,Gaegu,KleeOne,LXGWWenKai,LXGWWenKaiTC}.txt` + five notices in
  `public/licenses.txt` (with the subset/rename note).
- Tests (+2): lines ⊆ subset (only punctuation may fall back), sizes (< 120 KB each, < 400 KB total), neutral names,
  10 languages mapped, notices present. Shot: `playtest/shots/v14-village/kit-h_letters_5locales@{2x,1x}.png`.
- `game/postcard.ts drawMoonPhaseAt`: lit side left (mirror always), like `draw.ts`.

## Step 5 — G1 real-build polish (Reality "G1 실제 빌드 검수", designer's share) (done)

Puzzle screen (#24–#27):
- HUD = mock g's one grammar: every disc gets the glass top light (`drawHudDisc`); Village = the lantern-jar line
  glyph with its light level (`drawVillageDisc`, en caption "Village"); Today = plain disc + cream calendar, "waiting"
  = the amber new-dot (no amber ring); Hint = attention state (amber rim + amber glyph) after 25 s without a move
  on an unsolved board (one texture swap, no animation).
- The alley string = the kit's string-light bulbs (paper, wooden caps, value-band ribs); the lit pool is a radial
  that fits inside its cell (no square clipping); the cord's hairline is gone.
- Far landmark plate ("1") removed; the far tower shrinks to clear the top row's captions (SE: not drawn when < 0.3×,
  its tap target stays).
- The house number hangs on a little signpost beside the lantern-house (never over the door; SE included).
- Only Wick's stepping stone is painted (no dark "hole" behind him).
Gift (#10–#12): `stage.drawGiftStage` — the open box (dark mouth, inner light gradient), the lid popped on its hinge,
  soft light wedges (additive radial fills, no hairlines), the piece rising with sparkles, the sender (shy) and a
  friend (happy) on paper stages; the name chip = name + colour dot. Cushion redrawn as a petal zabuton.
Room (#13–#15): cottage 94 % wide, the spare height to the sky; outside = dusk sky + moon (lit left) + hills + lawn
  (`drawCottageOutside`); a hanging paper lantern = the room's key light; empty slots show only while placing, as a
  faint warm spot; Wick + Momo visit at the front corners. (Default furniture = Frontend's data.)
Letter (#5–#7): `stage.drawLetterStage` — envelope (flap open, wax seal) behind the paper, paper at the vertical
  centre, the sender leaning on its lower left, the signature on its own right-aligned line. Korean = Gaegu Regular
  (re-subset, 33.3 KB) at 1.03 × with −0.04 em tracking.
Shots: `playtest/shots/village-v2/` — `{se,pm}-{ko,en}-{1..6}-*.png` (real e2e build, `village-shots.mjs`, own port)
  and `puzzle-{en15,ko15,enSE,koSE}-*.png`.

## Step 6 — no invisible tap target (lead decision) (done)
- The deduce tower (the track's door) is always drawn where it is tappable: on SE it shrinks to ≈ 0.28× (≈ 28 pt) under
  the captions; only on a screen with no room at all (< 0.12×) is it not drawn — and then `farTarget` has no hit box.
- `e2e/tower-se.spec.ts` (375 × 667): visible, top ≥ the captions' bottom, a tap travels to deduce 1 (chromium + webkit ✓,
  with places.spec 28/28, run on its own preview: `E2E_PORT` in playwright.config.ts).
- Cold start vs the pre-HUD build (Chromium ×4, while the lead's verify ran): run 1 returning −4 ms / first run +19 ms,
  run 2 (n = 12) returning −13 ms / first run −3 ms → within noise, gate ≤ +20 ms holds.

## Step 7 — G1 re-review 2, designer's items (done)
- Room (#1): the room box runs from the header to the dialogue card's band (≈ 59 % of the pm height incl. the lid,
  bottom-anchored); a taller box deepens the kit room (`roomMap` ex ≤ 32 %: half deeper floor, half taller wall).
  Floor pieces are 1.55 × their slot share (may overhang ≤ 1.6 ×, drawn back row first). The rug is a header disc
  (rug glyph + caption, kept on screen) — no lone pill; the lawn below has no flower specks; a porch step under the
  cottage; the moon moved to the header's free column.
- Portraits (#2): `drawPortrait` frames a resident by its FACE centre (`portraitLayout`); test: both eyes inside
  0.8 r for all five residents at three sizes.
- Village jar (#6): the puzzle HUD's `drawVillageDisc` (light level = the jar) + "2/3" caption.
- Gift (#8): the stage is centred and 9 % bigger (no empty top), the lid = the box's own projection (square-ish slab,
  ribbon + bow) tipped on its hinge, the residents stand in pools of the gift's light (no paper plates over houses).
- Shots: `playtest/shots/village-v3/{se,pm}-{ko,en,ja}-{1..6}-*.png`. Targeted e2e on E2E_PORT: village + tower-se 10/10.
- Process: servers stopped by PID only (TEAM.md rule).

## Step 8 — G1 re-review 3 conditions (done)
- #1 band: the room box ends 158 pt above the bottom (just over the card); the porch deck + step are drawn BELOW the
  frame now (they were hidden under it) — no empty navy band.
- #2 SE header: the outside moon is drawn only where the sky strip above the lid clears the header (not on SE).
- #4 gift: the lid is tossed behind the box to the right, well under the floating piece (no "cushion on the lid").
- Shots overwritten: `playtest/shots/village-v3/{se,pm}-{ko,en}-*.png`; village.spec on E2E_PORT ✓; PID-only stop.

## Step 9 — round 3: the full village (owner) (done, kit side)
- (a) Residents: Kuri (wide, low, knit scarf with value-band ribs, chestnut lid) and Yuki (tall, a six-point snowflake
  flame, frost-blue lid); all 6 expressions + face portraits; gift wraps; 8 plots (back row of four).
- (b) Furniture 24 = the catalog's order (Frontend named the 12): floor lamp, candle stand, string lights (wall),
  rocking chair, round table, cactus, hanging plant (wall), dresser, striped rug, wreath (wall), knitting basket, snow globe.
  Misread self-check (Reality style, at 64 pt card + room size):

  | item | likely misread | fix in the drawing |
  |---|---|---|
  | rocking chair | plain chair | rockers reach past the legs both ways; spindle back |
  | candle stand | birthday cake | candles of 3 heights + flames + a glazed dish, no frosting band |
  | string lights (wall) | necklace / beads | bulbs hang below a swag between two nails, each glows |
  | hanging plant | grapes (v1 dot chains) | pointed leaves alternating on stems; three cords to a ring |
  | cactus | cucumber | arms + ribs + spines + bloom; pot |
  | dresser | microwave / safe | three drawers with knobs, turned feet, a bud vase on top |
  | striped rug | towel / bookshelf top | flat slab in projection + fringes both ends (rug layer only) |
  | wreath | donut / life ring | leaf ring + berries + a bow; nail above |
  | knitting basket | fruit basket | crossed needles + wound-yarn texture on the balls |
  | snow globe | crystal ball | wooden base + a tiny lantern-house + snow inside |
  | floor lamp | umbrella | tulip shade lit from inside + its own pool |
  | round table | mushroom | turned pedestal + cross foot + a cup on top |
- (c) 4 times (`atmos.ts`): the key light stays upper-left (low sun / high sun / afterglow / moon); sky, lawn, hills,
  lamp strength change; `drawTimeWash` for the houses layer. 4 seasons: spring blossoms + petals, summer fireflies
  (dusk / night only), autumn canopies + fallen leaves + mushrooms, winter snow on crests / canopies / lids, frozen pond,
  snowfall; no flower beds in winter. Room window follows both.
- (d) Market stall (3 pedestals, striped awning, lantern at the left post), (e) request bubbles (9 category glyphs, amber
  new-dot), (f) postcard frame 1080 × 1350 (stamp, ring postmark — no text / level / date).
- G4 worst case (night + winter, 7 residents, 24 × colourways cards, market, postcard) @2x: village 13.2 + room 15.7 +
  extras 6.8 = **35.7 MB** (one backdrop per visit; a time / season change replaces it).
- G5: the boot path gains only +0.6 KB (lanternHouse chunk: Kuri / Yuki themes + the snow cap); the village chunk
  61.8 → 84.4 KB (lazy). The Chromium A/B ran under load average ≈ 218 (other agents' work) — invalid (A itself
  2045 ms vs 716 ms normally); to repeat on a quiet machine.
- Letter fonts re-subset from the real 10-locale lines (shown strings only): latin 16 · ko 37 · ja 98 · zh-Hans 121 ·
  zh-Hant 161 KB = 432 KB (each player downloads one).
- Shots: `playtest/shots/village-v4/kit-r3_*.png` (residents, furniture, times × seasons, room windows, market + requests,
  postcard, night + winter at full size). Tests: village-art 17/17.

## Step 10 — final G1 (full village), art items (done)
- #1 sky seam: it was the cool wash — a horizontal-gradient RECT whose top edge (0.55 × horizon) cut the sky in every
  time of day. Now a radial wash fading to nothing on all sides; `drawTimeWash` fades in over its first 14 % (no hard
  top edge). Checked on the 16-sheet: no seam in dawn / day / dusk / night.
- #2 visitors: `drawResident(…, { pose: "sit" })` (lower, wider, leaning mochi); the scene seats each on an EMPTY
  floor slot next to the piece of its category (right, else left, else the nearest free front slot) — never on furniture.
  Real PNG: Momo sits beside the cushion.
- #3 locked cards: the item's OWN drawing drained to plum-grey (a clock keeps its dial, a dresser its drawers, the snow
  globe its house, the rug its stripes) instead of one flat fill.
- #4 daytime depth (one light): sun upper-left + soft light shafts, horizon haze, a ground that darkens towards the
  viewer and away from the sun, a weaker day wash, a softer sun bloom.
- #5 postcard: the REAL app-baked 1080 × 1350 PNG (`bakeRoomPostcard`, en + ko, via `postcard-real.mjs`): real copy
  ("… 내 작은 오두막" / date · link), the caption now ends 14 units before the postmark ring (no collision), no
  board / answer / level on it. `playtest/shots/village-v5/postcard-real-{en,ko}.png`.
- Request bubble at the screen edge: `VillageScene` already clamps its x (`Math.min(W − bw − 2, …)`) — the pm-en-1 clip
  predates that; not an art-code issue.
- Not changed: what the store claims; the moon vs "Back" caption on store 04 (scene layout, Frontend).
- Tests: village-art 17/17; village.spec chromium 8/8 on its own port; servers stopped by PID.
