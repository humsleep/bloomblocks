# a11y: VoiceOver layer and iOS preferences

`import { a11y } from "../a11y/index.ts";` This module puts a hidden DOM layer over the canvas: transparent `<button>`s with `aria-label`, plus an ARIA grid for the board. Since v11 (playtest/ux-v11.md) the game also SHOWS short localized lines (error line, tutorial band, How-to-play sheet, HUD captions, result labels); their strings live in `strings.ts` too, and the scene speaks every shown line once (`A11yLayer.say`). Sighted taps pass through to the canvas (`pointer-events: none`). VoiceOver double-tap fires `click` on the focused button, which calls your `onActivate` or `activate`.

## 1. Init (once, off the cold-start path)

Call it in `main.ts` `afterInteractive()`, after the first frame:

```ts
a11y.init(game.canvas);
a11y.onChange((p) => scene.applyA11y(p)); // fontScale 1–2, boldText, increaseContrast, reduceMotion, voiceOver
const p = a11y.prefs();                   // current values (defaults until init / first frame)
```

Before `init()` nothing touches the DOM. Calls made earlier are kept and applied on the first frame. All DOM writes happen in one rAF, and only nodes that changed are touched.

`onChange` fires when you return to the app (`visibilitychange`), on native plugin events, and on media-query changes. It also fires when the spoken language changes. When it fires, send your labels again.

## 2. Controls: `setControls(screen, controls)`

Geometry is in **CSS px relative to the canvas** (scene px / dpr). Each call **replaces** that screen's set. All screens are shown together in reading order (top to bottom, left to right), so you don't need to sort.

```ts
a11y.setControls("hud", [
  { id: "settings", label: a11y.t("settings"), x, y, w, h, onActivate: () => this.toggleSheet() },
  { id: "undo", label: a11y.t("undo"), ... },
  { id: "hint", label: a11y.t("hint"), ... },
  { id: "left", label: a11y.t(s.daily ? "home" : "street"), ... },
  { id: "moon", label: a11y.t(dailyDone ? "dailyDone" : "daily"), ... },
  { id: "far", label: a11y.t(atTower ? "house" : "tower"), ... },
]);
```

Call it again after `layout()` and whenever something appears, disappears or moves. That includes the camera travel ending, the settings sheet opening or closing, and the result card showing. **Don't call it every frame.** It's cheap, but there's no reason to.

- **Modal moments**: while the settings sheet or result card is open, clear the HUD with `setControls("hud", [])` and publish only the sheet or card (`"sheet"` / `"card"`). Include a `close` control, because a sighted user's "tap outside" doesn't exist for VoiceOver.
- **Toggle segments**: pass `pressed: true/false` and VoiceOver will say "selected". Examples: `soundOn` / `soundOff`, `hapticsOn` / `hapticsOff`, `numbersDigits` / `numbersDots`, `shareTimeOn` / `shareTimeOff`.
- **Hidden during travel / reveal**: publish `[]` for the affected screen while input is blocked.
- Optional `hint` is spoken after a pause (`aria-describedby`).

Label keys: `settings close undo hint street home daily dailyDone tower house nextLevel share adBreak level{n} soundOn soundOff hapticsOn hapticsOff numbersDigits numbersDots shareTimeOn shareTimeOff replayGuide`.

## 3. Board: `setBoard(board | null)`

```ts
a11y.setBoard({
  rows: lv.h, cols: lv.w, x, y, w, h,                 // board rect, CSS px relative to the canvas
  describe: (r, c) => a11y.cell(this.cellInfo(r, c)), // r, c 0-based
  activate: (r, c) => this.tapCell(r, c),             // same path as a real tap
});
```

`CellInfo = { row, col, kind: "floor" | "lantern" | "rock", lit?, conflict?, number?, around?, stuck? }`. `around` is the number of lanterns on the rock's four neighbours. `stuck` is the ⊘ mark. Example output: "Row 2, column 3, rock 2, needs 1 more".

**After every state change** (move, undo, hint, restore, new level), call `setBoard(sameBoard)` again. The cell labels are refreshed and only the changed ones are written. Use `setBoard(null)` when no board is interactive (town, travel).

## 4. `announce(text)`: polite live region

Announce outcomes that the focused element doesn't already say:

| When | Text |
| --- | --- |
| lantern placed / removed via a cell | `t("ann.placed")` / `t("ann.removed")` |
| a placement creates a conflict | `t("ann.conflict")` |
| undo | `t("ann.undone")` |
| hint shown | `t("ann.hint")` plus `a11y.cell(...)` of the hinted cell |
| level solved | `t("ann.solved")` (then the result card's controls) |
| new level shown | `t("level", { n })` |

Calls made in the same frame are spoken together, and repeats are spoken again. Keep it to one short phrase per event.

## 5. Preferences (P1-6)

| Field | Source |
| --- | --- |
| `fontScale` | Native plugin, or the `-apple-system-body` probe px divided by 17, clamped to [1, 2]. Use it to scale sign plates and card numbers (UX-AUDIT P1-6). |
| `boldText` | Native, or the probe's weight (best effort). Draw numbers at weight 800. |
| `increaseContrast` | Native, or `prefers-contrast: more`. Use opaque threads and rims. |
| `reduceMotion` | Native, or `prefers-reduced-motion`. Feed it into `motion.reduced`. |
| `voiceOver` | Native only. Pause idle hint animations and the guide's finger, which VoiceOver users can't see. |
