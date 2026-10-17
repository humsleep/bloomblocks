// Real play time of the current level for the ads pacing ("playSeconds", policy: excludes time in
// the background and in menus). Fed from the scene's frame loop: only foreground frames while the
// player is on the board count, and one frame never counts for more than MAX_STEP_MS (the first
// frame after a resume can carry the whole background gap). A new level (key) starts from 0 —
// a relayout (rotation / text size) does not.
export const MAX_STEP_MS = 250;

export class PlayTimer {
  private ms = 0;
  private key = "";

  /** One frame: `key` identifies the level, `active` = foreground, on the board, nothing modal. */
  tick(key: string, deltaMs: number, active: boolean): void {
    if (key !== this.key) {
      this.key = key;
      this.ms = 0;
    }
    if (active && Number.isFinite(deltaMs) && deltaMs > 0) this.ms += Math.min(deltaMs, MAX_STEP_MS);
  }

  seconds(): number {
    return Math.round(this.ms / 1000);
  }
}
