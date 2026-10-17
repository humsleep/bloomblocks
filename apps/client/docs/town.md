# Lit street (마을 거리) — v1 (2026-10-14)

Asked for three rounds in a row (Priya r2–r4, Claire r4): *"a visible street of houses I have
lit, each with something new on it"*. It is the day-7 return hook for the relax-oriented players
(35–54): a place that keeps what they did, grows a little every session, and shows what comes next.
Shots: `playtest/shots/v6/town-12.png`, `town-30.png`, `town-60.png` (real app on the iPhone 17 Pro Max
simulator, staged with `src/town/dev/town-shots.ts`).

## Pillars
1. **Mine** — every house is the exact house the player lit (same seeded generator, same number plate).
2. **Always something new** — no two consecutive houses look "the same as before"; a street-scale gift every 5.
3. **What's next is visible** — dark houses ahead, an empty lantern for today, a tower with dark windows above.
4. **Calm** — wordless, no counters to chase, no red, no loss shown (a broken streak just leaves today's empty lantern).

## API (the only export)
```ts
// src/town/index.ts
export function openTown(scene: Phaser.Scene, opts: { onClose: () => void }): void;
```
- Adds a separate Phaser scene (`"town"`) on top of `scene`. While open: `scene.input.enabled = false`;
  `scene` is hidden (not rendered) once the street covers the screen, shown again during the
  pull-down / close slide. Input and visibility are restored, the town scene and its textures are
  removed, then `onClose()` runs (next frame, so the closing tap never reaches the caller).
- `index.ts` holds only a dynamic import → nothing is added to the cold-start path even if imported
  statically. Release chunks: `town` 0.46 kB, `data` 1.4 kB, `TownScene` 33 kB (12 kB gz).
- A second call while open / loading is ignored. A load error logs and calls `onClose()`.
- The UI agent's entry: the street button on the hill (left) and a tap on the village, via
  `import.meta.glob("../town/index.ts")` in `LanternsScene`.

## Data (read-only)
| What | Source | Rule |
| --- | --- | --- |
| Lit houses | `Library/lanternly/pips-progress.json` `gentle.level` | houses 1 … level − 1 (exactly the seed keys `seedKeyFor("gentle", n)` that were lit) |
| Tower windows | same file, `deduce.level` | lit windows = deduce level − 1 |
| Festival lanterns | Preferences `streak` (`daily.ts` StreakState) | see below |
| Moon | `moonPhase(today)` (rules) | same moon as the main sky |

Nothing is written. Corrupt / missing files → an empty street (3 dark houses + today's lantern).

## Screen (portrait, wordless; digits only on plates)
- **Backdrop** (fixed): dusk sky, stars, today's moon (same spot as the main scene), far ridge with the
  **deduce tower** (same silhouette as the main scene's far tower: tapered body, gallery, glass lantern
  room, cone roof), mid hill with round trees behind the roofs.
- **Street** (scrolls sideways): one house per cleared gentle level in order, `houseFor(seedKey, n)` +
  every window lit + its number plate; cobbled road with warm light pools; yards between houses.
- **Ahead**: the next 3 houses (the current level's house first) as dark silhouettes, shrinking
  (0.80 / 0.66 / 0.54) so they read as "further up the street, not yet"; milestones earned by those
  houses stand between them as dark silhouettes too ("two more houses to the next lamp").
  The street fades into the dark after the last one.
- **UI**: grabber pill at the top (pull down), home button at the bottom.
- **First view**: the newest lit house at 44 % of the width — lit neighbours left, the first dark house
  peeking in on the right.

## "Something new on each house"
All drawn in code (`paint.ts`). House *n* gets a keepsake on top of its generator details (chimney,
pots, clothesline and the generator's own cat at ≥ 8 are kept exactly as lit).

| n | keepsake | | n | keepsake |
| --- | --- | --- | --- | --- |
| 1 | flower boxes | | 8 | **cat on the roof** (guaranteed; a second cat if the generator already gave one) |
| 2 | wall lantern by the door (lit) | | 9 | mailbox with flag |
| 3 | shutters | | 10 | striped awning |
| 4 | green garland over the door | | 11 | laundry line into the yard |
| 5 | bench | | 12 | weathervane (moon-fish) |
| 6 | bird on the chimney | | 13 | birdhouse on a pole |
| 7 | ivy | | ≥ 14 | two keepsakes: `ORDER[(n−1) % 13]` + `ORDER[(5n+3) % 13]` (new pairs, new colours) |

Street-scale milestones (in the yard after the house that earned them):

| Every | What | Cycle |
| --- | --- | --- |
| 5 houses | lamp post (lit, light pool, breathing glow) | — |
| 10 houses | landmark | 10 fountain · 20 bell tower · 30 bridge over a stream · 40 tree with swing + fairy lights · 50 windmill · 60 bandstand with string lights · then repeats |

Rationale: a gentle level is ~1–3 min, a calm session ~15–20 min ≈ 5–8 houses → every session ends
with at least one street-scale gift (lamp), every ~2 sessions a landmark; a day-7 returner with ~30
houses has seen fountain, bell tower and bridge. Houses 1–13 each introduce a kind never seen before,
which covers the first 2–3 sessions where "new" matters most. **[PLACEHOLDER]** all cadences — check
"what did you notice on the newest house?" in round 5.

## Festival string (streak → street)
The string runs roof peak to roof peak over the lit houses and ends on the first dark house; lanterns
hang in the yards (never over a heart window), newest at the frontier, older ones walking back down
the street.
- **lit lantern** = a counted daily completion of the live streak.
- **covered lantern** (moon-silver cloth hood over an unlit lantern; told apart by shape) = a missed
  day a shield covered — the same idea as the result card's used shield lanterns.
- **empty lantern** (dim, dotted outline) at the frontier = **today**, while today's daily is not done.
- Broken streak (more missed days than shields): only today's empty lantern. No sad state.
- Exactness: `streak` / `last` are exact; days missed since `last` that are still coverable are exact
  (newest end). Past covered days are stored per month without dates, so they are spread evenly
  between the lit ones (≤ streak − 1). If exact placement matters later, `daily.ts` could keep the
  dates of the last ~60 completions (UI agent's file; not changed here).
- More days than lantern slots (≈ 3 per yard) → the oldest are not shown.

## Deduce tower
Floors = clamp(⌈d / 2⌉ + 2, 4, 12), two windows each, lit from the bottom (d = cleared deduce levels):
it grows with progress and always shows 2–4 dark windows above. d ≥ 24: the lantern room becomes a
beacon. Lantern room lit and plate shown once the tower is open (gentle ≥ 5 or d > 0 — the main
scene's rule minus its guide bit); the plate shows the tower's current level, the same number as the
plate on the main scene's tower. **[PLACEHOLDER]** floor cap / beacon threshold.

## Interaction
| Gesture | Result |
| --- | --- |
| drag sideways | scroll; momentum on release (decay τ = 325 ms) |
| drag down (> 8 pt, mostly vertical) | the sheet follows the finger; release past 20 % of the height or faster than 0.55 pt/ms → close, else snaps back |
| tap home | close |
| Reduce Motion | no slide (instant), no breathing glows / twinkle |
| screen resize | closes (simplest correct answer; portrait-locked app) |

## Performance
- **Backdrop**: one canvas baked per open at ≤ 2× (like the main scene's sky).
- **Street**: strips one screen wide (`CW` = W pt), baked at ≤ 2× into a **pool of 3 reused canvas
  textures**; only strips in view (+ one ahead in the scroll direction) exist. Visible strips bake
  immediately, the look-ahead strip at most one per frame. Memory ≈ 3 × 1.0 Mpx + backdrop 1.7 Mpx ≈ 19 MB.
- Layout is O(n) and pure (`layout.ts`): 100 houses 0.6 ms, 500 houses 3.5 ms (Node).
- Live layer: ≤ 24 additive glow sprites (lanterns, lamps, newest heart window, a few tower windows)
  + 6 twinkling stars; nothing is redrawn per frame.
- Measured: simulator (iPhone 17 Pro Max, WKWebView, 100 houses, dev server): **153 ms** from
  `openTown` to the first presented frame, of which 61 ms was dev-server module loading (release:
  local 33 kB chunk + one Filesystem read + one Preferences read). Strip bakes 1–8 ms (desktop Chrome).
  **iPhone 11 estimate: ~200–260 ms** (CPU parts ×2.5–3, two frame waits fixed) — under the 300 ms
  budget, worth confirming on device: the app logs
  `[town] open N ms to first frame (data …, bake …, H houses, L lanterns)`.
- Cold start: untouched (lazy chunks only; `index-*.js` contains no town code).

## Dev tools (none ship)
- Harness: `cd apps/client && npx vite --config src/town/dev/vite.config.ts --host --port 5180`, then
  `/src/town/dev/index.html?town=60&deduce=31&streak=23&covered=2[&done=1][&perf=1][&safeTop=62&safeBottom=34]`.
  A stand-in host scene opens the street and re-opens it after close. `window.__town.fake({...})`.
  (Own config: the app's dev server pre-bundles Phaser without the feature-flag plugin.)
- In any DEV build: `?town=<houses>&deduce=…&streak=…&covered=…&done=1` or `devFakeTown({...})`
  from `src/town/data.ts` overrides what the street shows (tree-shaken from release).
- Real app on the simulator: `npx tsx src/town/dev/town-shots.ts --houses 30 --deduce 14 --streak 9
  --covered 1` writes the app's own save files (refuses while `scripts/sim-shots.ts` runs), then tap
  the street button and `xcrun simctl io booted screenshot …`.

## Edge cases
- 0 houses: 3 dark houses, empty lantern, tower dark (closed) — the street is a promise.
- 500+ houses: fine (virtualized); the string only reaches back as far as the streak.
- A landmark yard pushes the dark houses off the first view (30, 60…): the landmark is the reward of
  that house, the dark ones are one swipe away.
- Daily done today: no empty lantern; today's is the newest lit one.
- Clock moved backwards: treated as no missed days.

## Changelog
- v1 2026-10-14 — first version (layout, keepsakes, milestones, festival string, tower, virtualized street).
