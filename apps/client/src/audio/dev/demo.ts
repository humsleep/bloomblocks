/** DEV: a scripted tour of every cue (used by the audition page and window.__lanternAudio.demo()). */
import type { CueName, CueOpts } from "../types.ts";

type Play = (name: CueName, opts?: CueOpts) => void;

export const DEMO: { at: number; name: CueName; opts?: CueOpts; label: string }[] = [
  { at: 0, name: "tap", label: "tap" },
  { at: 500, name: "stoneTap", label: "stoneTap" },
  { at: 1100, name: "place", opts: { pitchIndex: 2, litCount: 2 }, label: "place (dim, 2 lit)" },
  { at: 1100, name: "spread", opts: { pitchIndex: 2, litCount: 2 }, label: "spread ×2" },
  { at: 2100, name: "place", opts: { pitchIndex: 7, litCount: 9 }, label: "place (bright, 9 lit)" },
  { at: 2100, name: "spread", opts: { pitchIndex: 7, litCount: 9 }, label: "spread ×9" },
  { at: 3300, name: "remove", opts: { pitchIndex: 7 }, label: "remove" },
  { at: 4000, name: "invalid", label: "invalid" },
  { at: 4600, name: "invalid", opts: { sequence: [4, 9] }, label: "invalid + conflict beating" },
  { at: 6000, name: "nearComplete", label: "nearComplete (pad swell)" },
  { at: 8000, name: "complete", opts: { sequence: [2, 5, 3, 7, 9, 6, 10] }, label: "complete (7-note personal melody)" },
  { at: 11500, name: "nextLevel", label: "nextLevel" },
];

export function playAll(play: Play, onStep?: (label: string) => void): void {
  for (const s of DEMO) {
    setTimeout(() => {
      play(s.name, s.opts);
      onStep?.(s.label);
    }, s.at);
  }
}
