/**
 * @deprecated Compatibility shim for the pre-cues call sites in main.ts.
 * New code should import { initAudio, playCue, setMuted, setAmbient } from "./cues.ts".
 * Everything here routes into the same single AudioContext / runtime.
 */
import { playCue, setMuted, unlockAudio } from "./cues.ts";

export class Sfx {
  private m = false;

  get muted(): boolean {
    return this.m;
  }
  set muted(v: boolean) {
    this.m = v;
    setMuted(v);
  }

  /** Called from inside a pointerdown handler: arms listeners and unlocks right away. */
  unlock(): void {
    unlockAudio();
  }

  place(): void {
    playCue("place");
  }
  remove(): void {
    playCue("remove");
  }
  deny(): void {
    playCue("invalid");
  }
  win(): void {
    playCue("complete");
  }
}
