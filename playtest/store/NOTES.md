# Store set notes (ASO lead, 2026-10-18)

## What was produced
- `docs/store/screenshots/<locale>/01–08.png` + `contact.png` for 10 locales (1320×2868, 6.9"), from the full-village build.
- `docs/store/review/att-flow.mp4` (28.8 s) and the exact steps in `docs/app-store-connect-pack.md` §4 and `README.md`.
- `docs/store/metadata.md` (+ `metadata.json`): name, subtitle, keywords, promo text, description for 17 storefront locales; §5 of the pack carries the name/subtitle/keyword table.

## Decisions
- **Dusk window.** The village and the cottage follow the device clock. The store set was captured at 17:00–17:12 KST (dusk band, autumn). The auto shots (board, rules, postcard, daily) do not depend on time.
- **Cottage shot is the closed-drawer view.** With the drawer open the room is pushed up under the status bar (Reality P2), and the first-cottage dialogue card has to be marked as seen (`host:wick.host.07`) to keep the screen clean.
- **Captions** are the QA'd ones in `captions.json`. Only the en-US 04 sub-caption mentions the count ("Seven lantern friends move in as you play").
- **Metadata.** Price words are out of name, subtitle and keywords (ko 무료, ja 無料, zh 免费/免費 removed). The description says ads exist and where they appear. The market is described as "nothing to buy". Akari / Nikoli / Light Up / Queens never appear (checked by `build-metadata.py`).
- **Two simulators.** `DW Store 17PM` (the one the Claude simulator tool is attached to) did the tapped shots and the ATT video. `DW Store 6.9` (created by `make-store.sh`) did the no-tap shots in the background. Both are iPhone 17 Pro Max, so the captures are interchangeable. `DW Store 6.9` was shut down afterwards.
- **No idb.** Taps were done with the Claude simulator tool at the points in `sizes.json`. `make-store.sh` uses idb when present and prompts otherwise.
- **ATT video.** Uninstall + reinstall instead of `simctl erase` on the attached device (an erase drops the tool's input connection). The simulator had been erased on 2026-10-17 evening.

## Known issues in the shots (app side, not fixed here)
- Italian HUD caption "Impostazioni" is clipped at the left edge (shots 01, 07); German "Einstellungen" and French "Réglages" are tight.
- The cottage view has an empty navy band below the room (about a fifth of the screen).
- pt-BR is captured with a southern-hemisphere (spring) village because the device region is BR; the other locales are autumn.
- Settings (08) is shown over the dimmed street board; the sheet is the real one.

## Not done / risks
- No native-speaker review of the 8 AI-drafted locales (captions and descriptions).
- The 80 PNGs are about 200 MB. Consider not committing them (regenerate with the command in `README.md`).
- Re-run the `village` phase between 17:00 and 21:00 whenever the village or the cottage art changes.
- Apple Ads / ASC screenshot upload per locale is the owner's step (ASC → each localization → 6.9" slot).
