// The only part of src/sync on the cold-start path: a few bytes, no imports. The session and the
// daily tell the (lazily loaded) sync engine that something worth mirroring changed; the engine
// publishes its state for the settings sheet's cloud icon. Before the engine is loaded (or when
// iCloud is off) every call is a no-op.

/** "off" = no iCloud (web, signed out, disabled): local only · "pending" = waiting / a write due · "synced" */
export type SyncStatus = "off" | "pending" | "synced";
/** What changed: a level ended, a daily was counted, a setting changed. Never per move. */
export type SyncReason = "level" | "daily" | "settings" | "guide" | "village";

export const syncSignal = {
  status: "off" as SyncStatus,
  /** set by the engine */
  listener: null as ((why: SyncReason) => void) | null,
  /** set by the scene (the settings sheet redraws its cloud) */
  onStatus: null as ((s: SyncStatus) => void) | null,
  dirty(why: SyncReason): void {
    this.listener?.(why);
  },
  /**
   * Fresh install: has iCloud's first delivery been seen? "unknown" until the engine knows,
   * "pending" = iCloud available and its initial sync still due, "done" = merged / timed out / no iCloud.
   */
  initial: "unknown" as "unknown" | "pending" | "done",
  /** performance.now() until which a first-run lesson may wait for that delivery (the scene sets it) */
  holdUntil: 0,
  /** a first-run lesson waits a moment: a returning player's restore may be about to land */
  holdGuide(): boolean {
    return this.initial !== "done" && performance.now() < this.holdUntil;
  },
  /** "show the guide again" on this device: other devices' lesson bits must not cancel it (local only) */
  replayRequested: false,
  guideReplayed(): void {
    this.replayRequested = true;
    this.listener?.("guide");
  },
  setStatus(s: SyncStatus): void {
    if (this.status === s) return;
    this.status = s;
    this.onStatus?.(s);
  },
};
