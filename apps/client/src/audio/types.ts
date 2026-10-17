/** Shared audio types (type-only; no runtime code so the eager facade stays tiny). */

export type CueName =
  | "tap"
  | "place"
  | "spread"
  | "remove"
  | "invalid"
  | "nearComplete"
  | "complete"
  | "nextLevel"
  | "stoneTap";

export interface CueOpts {
  /** Index into the D-major-pentatonic ladder (0 = A3 … 14 = F#6). See pitchIndexForCell(). */
  pitchIndex?: number | undefined;
  /** Cells newly lit by this placement (brightness of `place`, number of `spread` chimes). */
  litCount?: number | undefined;
  /** `complete`: pitch indices of the placed lanterns in placement order. `invalid`: two conflicting lanterns' pitch indices. */
  sequence?: number[] | undefined;
}

/** 0 = off, 1 = light wind, 2 = + crickets, 3 = + distant water. */
export type AmbientLevel = 0 | 1 | 2 | 3;
