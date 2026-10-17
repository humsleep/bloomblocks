// Lit street ("마을 거리") — public entry. Everything behind it is lazy: this file
// only holds a dynamic import, so even a static import of openTown adds nothing
// measurable to the cold-start path. Design: docs/town.md.
import type PhaserTypes from "phaser";

let busy = false;

/**
 * Open the lit street over `scene` (a separate Phaser scene on top). The caller's
 * scene keeps running but gets no input while the street is open and is hidden
 * while the street covers the screen; both are restored before `onClose` runs.
 * Closing: swipe down anywhere, or tap the home button at the bottom.
 * Calling it again while the street is open (or still loading) does nothing.
 */
export function openTown(scene: PhaserTypes.Scene, opts: { onClose: () => void; visit?: { n: number } }): void {
  if (busy) return;
  busy = true;
  const t0 = performance.now();
  const done = (): void => {
    busy = false;
    opts.onClose();
  };
  void Promise.all([import("./data.ts"), import("./TownScene.ts"), import("../save/keepsakes.ts")])
    .then(async ([data, sceneMod, keep]) => {
      // the solved boards (keepsake cards) are read with the saves: a tap shows one at once
      const [d] = await Promise.all([data.loadTownData(), keep.loadKeepsakes()]);
      sceneMod.launchTown({ host: scene, onClose: done, data: d, t0, tData: performance.now() - t0, ...(opts.visit ? { visit: opts.visit } : {}) });
    })
    .catch((e: unknown) => {
      console.error("[town] failed to open", e);
      done();
    });
}
