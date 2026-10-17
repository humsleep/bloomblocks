/**
 * One scale for the whole game: D major pentatonic (D E F# A B). Every pair of
 * notes is consonant, so any combination of lanterns, chimes and chords works.
 *
 * Pitch index ladder (what the UI passes as opts.pitchIndex):
 *   0 A3  1 B3  2 D4  3 E4  4 F#4  5 A4  6 B4  7 D5  8 E5  9 F#5  10 A5 … 14 F#6
 */
const DEGREES = [0, 2, 4, 7, 9] as const;
const D4 = 293.6648;

export const PITCH_MIN = 0;
export const PITCH_MAX = 14;

/** Frequency (Hz) of a ladder index, optionally shifted by whole octaves. Works for any integer index. */
export function noteFreq(index: number, octaves = 0): number {
  const k = Math.round(index) + 3; // index 0 is A, degree 3 of the D scale
  const oct = Math.floor(k / 5);
  const semis = 12 * (oct - 1) + (DEGREES[k - oct * 5] ?? 0);
  return D4 * 2 ** (semis / 12 + octaves);
}

export function clampPitch(index: number | undefined, fallback: number): number {
  if (index === undefined || !Number.isFinite(index)) return fallback;
  return Math.max(PITCH_MIN, Math.min(PITCH_MAX, Math.round(index)));
}

/**
 * Suggested mapping from a board cell to a pitch index: rises to the right and
 * upward (bottom-left lowest). 8×8 boards span exactly the 0..14 ladder.
 */
export function pitchIndexForCell(x: number, y: number, h: number): number {
  return clampPitch(h - 1 - y + x, 4);
}
