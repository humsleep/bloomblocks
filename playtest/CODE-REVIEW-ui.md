# Code review — UI lifecycle findings (sub-review of Part 1, 2026-10-14, read-only)

## P1 Town leaks a ScaleManager "resize" listener per open — town/TownScene.ts:231-232
`this.events.once("shutdown", …off)` never runs: `finish()` closes via `game.scene.remove(TOWN_KEY)` → `Systems.destroy` emits only DESTROY. 50 opens = 50 handlers each retaining a dead TownScene. Fix: `this.events.once("destroy", …)` or `scale.off` inside `finish()`.

## P1 create() throw leaves host input disabled and town un-openable forever — TownScene.ts:141, town/index.ts:28-31, launchTown (~756)
`d.host.input.enabled = false` before painting that can throw (e.g. getContext null under iOS canvas memory pressure). Scene stays registered (CREATING) and renders over the board; later opens hit `if (game.scene.keys[TOWN_KEY]) return;` without onClose → `busy`/`townOpen` stuck true, HUD hidden, canPlay false. Fix: try/catch in create() restoring input + removing scene + rethrow; launchTown must call `l.onClose()` / remove the stale scene instead of silently returning.

## P1 VoiceOver users can open the town but cannot close it
While `townOpen`, HUD/board are cleared from the a11y layer and no town controls are published; canvas is aria-hidden. Fix: publish a "close" control (and one per house for the keepsake) while the town is open.

## P2 Vertical drag released during closing reopens the town — TownScene.ts:394-401
`onUp` with axis y sets phase "opening" even when "closing" (resize → close mid-drag). Fix: early return in onUp/onMove when phase is closing/closed.

## P2 Failed `import("./daily.ts")` cached forever — LanternsScene.ts:709
`this.dmP ??= import(...)` keeps a rejected promise → unhandled rejections on every refreshMoon/enterDailyPlay/onDailyDone. Fix: reset dmP on failure.

Checked clean: town texture cleanup, double-open guards, background mid-transition, TextureBank growth bounded, BoardView pooling, ResultSheet/SettingsSheet/Guide pooled, a11y DOM bounded, vis.ts listeners once.
