# Testability proposals and bugs found (test agent, 2026-10-14)

## Status (agent L, phase 2, 2026-10-14)

| Item | Status |
| --- | --- |
| P1 bridge | `src/testing/bridge.ts` → `window.__test` {session, game, scene, clock, worker, flush}; loaded by a guarded dynamic import (`(DEV && MODE !== "test") \|\| MODE === "e2e"`), absent from the m1 bundle (`vite build --mode m1 --outDir <tmp>` + grep `__test` → nothing). `session` is attached by `Session.restore`; `game`/`scene` need the main.ts line in docs/phase2-plan.md "Requests to U". `e2e/bridge.ts` prefers `window.__test` and each scene hook, falling back to the boot patch / private fields. |
| P2 geometry | `ResultSheet.buttonCenter` (src/game/ResultSheet.ts; the old daily.ts `ResultCard` is deleted), `cellCenter` / `hudPoints` / `SettingsSheet.segmentCenter`, town `housePoints()` / `keepsake` (e2e `townHousePoints` / `townKeepsake`): done. |
| P3 idle | requested from U (`isIdle()` + "idle" event); e2e/bridge.ts uses it when present. |
| P4 clock | `clock` / `setClock` / `resetClock` in session.ts; `localDateISO()` and `DailyClock` read it. `window.__test.clock.set(localISO)`. town/data.ts: requested from U. |
| P5 worker | `setLevelWorker(factory \| null \| "default", { dropPending })`; fake: `tests/fakes/levelWorker.ts`; slow wrapper: `slowWorker()` / `window.__test.worker.slow(ms)`. |
| BUG-1 | fixed (daily in its own slot; leave/switch commit progress only after the target loads) — session.test.ts "[BUG-1]" ×6, e2e daily "[BUG-1]". |
| BUG-2 | fixed (`mode: daily ? MODE.daily : MODE.free`) — core `verifySubmission` on a client daily run.bin (unit + e2e). Daily run.bin = first completion only (practice never overwrites; written on relaunch if the kill came first). |
| BUG-3 | fixed (calendar-month arithmetic, `prevMonth`) — every month boundary 2026–2028 + a three-year walk. |
| OBS-1 | fixed (failed append → full rewrite from memory; a slot whose last full write failed is rewritten, not appended to) — five fault-injection tests. |
| PERF-1 (client) | next level generated in the worker as soon as a level loads; no 15 s cap, no main-thread generation while a worker exists (crash or 12 s without a reply (watchdog, `levelWorkerConfig.timeoutMs` on `clock.after`) → restart ×2 → main thread in its own task); the worker is created only after the first paint (`markFirstPaint()` / canvas + 2 rAF fallback); `session.nextLevelStatus` / `nextLevelReady` for U's waiting state — tests/worker.test.ts, e2e play "PERF-1". |


Nothing in `src/` or `games/` was edited. Everything below is a proposal for the agents that own
those files. The test suite already works without any of it (test-side shims), but each hook
would make the E2E suite less coupled to private fields.

## How the suite reaches the app today (no src changes)

| Need | Test-side shim |
| --- | --- |
| Capacitor plugins on desktop | `vite --mode e2e` aliases `@capacitor/{app,filesystem,haptics,preferences,share}` to `tests/fakes/*` (in-memory, mirrored to localStorage so reload = relaunch; `window.__fakes` exposes files, prefs, shares, haptics, `fire("pause")`, failure injection). Vitest uses the same fakes. |
| The running game | `e2e/bridge.ts` (injected into `index.html` in e2e mode only) wraps `Phaser.Game.prototype.boot` to keep the game, then reads `scene.deps.session`, `scene.geo`, `scene.board.*` (TS-private fields, readable at runtime). |
| Time | Init script replaces `Date` with a ticking, shifted clock (`localStorage["__e2e:now"]`); context time zone `Asia/Seoul`. |
| Taps | Real mouse clicks at canvas coordinates computed from `scene.geo` (inverse of `cellAt`) and HUD object positions. |

## Proposals (file → code)

### P1. A test bridge instead of private-field access — `src/main.ts`

After `game.scene.add("lanterns", scene, …)`:

```ts
if (import.meta.env.DEV || import.meta.env.MODE === "e2e") {
  (window as unknown as { __test?: unknown }).__test = {
    game, scene, session,
    cellPoint: (cell: number) => scene.cellCenter(cell),      // P2
    hud: () => scene.hudPoints(),                              // P2
    idle: () => scene.isIdle(),                                // P3
  };
}
```
Then `e2e/bridge.ts` shrinks to `window.__test` and the Phaser boot patch goes away.

### P2. Public geometry — `src/game/LanternsScene.ts`

```ts
/** Canvas-pixel centre of a board cell (inverse of cellAt). */
cellCenter(cell: number): { x: number; y: number } {
  const g = this.geo, lv = this.deps.session.level;
  return { x: g.bcx - (g.cs * lv.w) / 2 + ((cell & 7) + 0.5) * g.cs, y: g.bcy - (g.cs * lv.h) / 2 + ((cell >> 3) + 0.5) * g.cs };
}
hudPoints(): Record<"gear" | "hint" | "undo" | "left" | "moon" | "far", { x: number; y: number }> { … }
```
`SettingsSheet.segmentCenter(opt: SheetHit)` and `ResultSheet.buttonCenter("share" | "home" | "break")` likewise
(the tests currently replicate `segPos` / `cx + btn.x`).

### P3. A readiness signal — `src/game/LanternsScene.ts`

```ts
isIdle(): boolean { return this.decorated && !this.finale && !this.switching && !this.travel && !this.townOpen && !this.board.busy; }
```
and `this.events.emit("idle")` when it becomes true — tests would wait on the event, not poll.

### P4. Injectable clock — `src/game/session.ts`, `src/town/data.ts`

`localDateISO(d = new Date())` is already injectable; the call sites in `LanternsScene` (`localDateISO()`
×4) and `town/data.ts` (`localISO()`) read the real clock. A one-line `export const clock = { now: () => new Date() }`
in `session.ts`, used by those call sites, would let tests move days without replacing `Date`.

### P5. Worker opt-out for tests — `src/game/session.ts`

`nextLevelWorker()` is module-private. `export function setLevelWorker(w: Worker | null)` would let unit
tests exercise the worker path (`whenNextReady`, prefetch) with a fake worker; today node has no `Worker`
and only the main-thread fallback is covered.

### P6. `town/data.ts` reads `location` in DEV without a guard

`devFromQuery()` calls `new URLSearchParams(location.search)`; in vitest (DEV = true, no DOM) it throws.
Guard with `typeof location !== "undefined"` (the unit test stubs `location` for now).

## Bugs found (repro → suspected place)

| # | Severity | Bug | Repro | Where |
| --- | --- | --- | --- | --- |
| BUG-1 | **High** | After a relaunch into today's daily, *home* returns to the daily itself; `progress.daily` is deleted but the board stays the daily (completed → finale/card again). | Open daily → place a lantern → kill/reload → tap home. Tests: `session.test.ts` "[BUG-1]", `e2e/daily.spec.ts` "[BUG-1]" (both expected-fail). | `src/game/session.ts:486` — the constructor stores `first` under `runs[first.track]`; a daily run has `track: "gentle"`, so `leaveDaily()` (`:551`) picks the daily run back up. Fix: `if (!first.info.daily) this.runs[first.track] = first;` |
| BUG-2 | Medium | Daily `run.bin` is written with `mode = MODE.free`; a server `verifySubmission` for a daily (expects `MODE.daily`) rejects every daily run (`expect-mode`). | Complete a daily, decode `runs/p5-daily-<date>.bin`, header mode = 0. Test: `session.test.ts` "[BUG-2]". | `src/game/session.ts:285` (`runBytes`: `mode: MODE.free` for every slot). Fix: `mode: this.info.daily ? MODE.daily : MODE.free` (journal replay check uses the same bytes, so keep both in sync). |
| BUG-3 | Low | The streak shield book drops the previous month on the 1st after a ≤ 30-day month (Mar/May/Jul/Oct/Dec 1): `day − 31` already lands two months back. The month's used shields are forgotten → the town festival string loses its covered lanterns. Streak math itself is unaffected. | `countCompletion` with last = 2026-09-28, completion 2026-10-01 → `shields` = `{}` instead of `{"2026-09": 2}`. Test: `daily.test.ts` "[BUG-3]". | `src/game/daily.ts:112` — use calendar months (`isoFromDay(day).slice(0,7)` and the two previous `YYYY-MM` computed by month arithmetic). |
| PERF-1 | Medium (ship risk on older phones) | Gentle finale generation is slow and unbounded: desktop (M-series) gentle 50 = **6.0 s** (19.6 s while the machine was loaded), 14,976 attempts and still out of band; 60 = 2.6 s, 80 = 2.8 s, 100 = 1.8 s. At ×3–5 on a phone, the worker misses the 15 s wait and `advance()` then generates **on the main thread** → a multi-second freeze in the finale. | `npm run test:fuzz:slow` (budget 3 s desktop) fails on gentle 50. | `games/lanterns-pips/generator.ts:378` loop runs to `maxAttempts * 20` while no candidate passes; `src/game/session.ts:387` (15 s cap) + `:403` (main-thread fallback). Suggest a pre-generated finale table or a hard attempt cap, and never generating finales on the main thread. |
| OBS-1 | Low | One failed journal append silently loses every later move of that level on relaunch (later lines carry hashes of states that include the lost move, so the verifying prefix stops before it). Not data corruption, but up to a whole level of moves can vanish after a single transient write error. | `session.test.ts` "a failed append is logged; relaunch restores the verifying prefix". | `src/game/session.ts:311` (append) / `:260` (prefix replay). Option: on an append failure, schedule a full `rewriteJournal()`. |
| OBS-2 | Trivial | `onPause` saves the daily time and *then* stops the clock, so the saved `ms` is a frame short of the stopped clock. | `e2e/daily.spec.ts` pause test (tolerance 50 ms). | `src/game/LanternsScene.ts:1564–1565` — swap the two lines. |
| DEV-1 | Fixed (test-owned) | `npm run dev` died on load: Vite pre-bundled `phaser-core` without the feature-flag transform → `require("phaser3spectorjs")` pageerror, no canvas. | Original `vite.config.ts` + `npx vite` → pageerror. | Fixed in `vite.config.ts` (`optimizeDeps.rolldownOptions.plugins`, `optimizeDeps.entries: ["index.html"]`, watcher ignores `build/` / `ios/`). Guarded by `e2e/smoke.spec.ts`. |

Not verifiable from the web: whether the iOS Filesystem plugin's `rename` overwrites an existing
destination (every `writeAtomic` relies on it). The fakes assume POSIX overwrite; worth one
on-device check of `pips-progress.json` after two level completions.

When a bug is fixed, its `it.fails` / `test.fail` turns red on purpose: flip it to `it` / `test` (done for BUG-1/2/3 and OBS-1).
