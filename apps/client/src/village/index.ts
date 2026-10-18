// The village — public entry (the puzzle scene's "Village" button). Everything behind it is a
// lazy chunk: this file only holds dynamic imports, so a static import of openVillage adds nothing
// measurable to the cold-start path (gate G5).
import type PhaserTypes from "phaser";
import type { Lang } from "../a11y/strings.ts";

export interface VillageProgress {
  cleared: { gentle: number; deduce: number };
  /** completion dates of Today's puzzle */
  dailyDates: string[];
  today: string;
  /** today: Today's puzzle solved without hints (the residents' "hard one" lines) */
  hardToday?: boolean;
}

let busy = false;
/** the scene module once loaded (prewarm or a first open): later opens need no import */
let mod: typeof import("./VillageScene.ts") | null = null;
const loadMod = (): Promise<typeof import("./VillageScene.ts")> => import("./VillageScene.ts").then((m) => (mod = m));

/**
 * Open the village over `host` (a separate Phaser scene on top; the host gets no input while it is
 * open and is hidden once the village covers it; both restored before `onClose`). Calling it again
 * while it is open (or loading) does nothing. Warm (prewarmVillage ran, the daily log is in memory):
 * the scene is added in the same task as the tap — no async hop on a busy main thread.
 */
export function openVillage(host: PhaserTypes.Scene, o: { progress: VillageProgress | (() => Promise<VillageProgress>); lang: Lang; onClose: () => void; onShown?: () => void; t0?: number }): void {
  if (busy) return;
  busy = true;
  const t0 = o.t0 ?? performance.now();
  const done = (): void => {
    busy = false;
    o.onClose();
  };
  const fail = (e: unknown): void => {
    console.error("[village] failed to open", e);
    done();
  };
  try {
    const warm = mod && typeof o.progress !== "function" ? mod.prepareNow(o.progress, o.lang) : null;
    if (mod && warm) {
      mod.launchVillage({ host, onClose: done, data: warm, t0, tData: performance.now() - t0, ...(o.onShown ? { onShown: o.onShown } : {}) });
      return;
    }
  } catch (e) {
    fail(e);
    return;
  }
  const progress = typeof o.progress === "function" ? o.progress() : Promise.resolve(o.progress);
  void Promise.all([loadMod().then((m) => (m.dataMs["mod"] = Math.round(performance.now() - t0), m)), progress])
    .then(async ([m, p]) => {
      const data = await m.prepareVillage(p, o.lang);
      m.launchVillage({ host, onClose: done, data, t0, tData: performance.now() - t0, ...(o.onShown ? { onShown: o.onShown } : {}) });
    })
    .catch(fail);
}

/** Everything an open needs is in memory and the backdrop is baked: the open is a blit (no opening veil needed). */
export function villageWarm(lang: Lang): boolean {
  return !!mod?.isWarm(lang);
}

/**
 * Load the village's code and data ahead of a tap (idle, after launch: scene, art kit, lines, save) and bake its
 * backdrop in small idle steps. Resolves true when all of it is done, false when input stopped it (call again later).
 */
export function prewarmVillage(lang: Lang, progress?: () => Promise<VillageProgress>, idle: () => boolean = () => true): Promise<boolean> {
  if (!idle()) return Promise.resolve(false);
  return loadMod()
    .then(async (m) => {
      if (!idle()) return false;
      return m.prewarm(lang, await progress?.().catch(() => undefined), idle);
    })
    .catch(() => true);
}
