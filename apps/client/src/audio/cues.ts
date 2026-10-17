/**
 * Public audio API (the only module the game imports). Deliberately tiny: it
 * holds the desired state, arms the first-gesture unlock and app-lifecycle
 * listeners, and owns the single AudioContext. All synthesis lives in
 * runtime.ts, which is dynamically imported on the first gesture — cold start
 * pays for neither the AudioContext nor the synth code.
 *
 *   initAudio()              call once at boot (idempotent; no audio work until a gesture)
 *   playCue(name, opts?)     fire-and-forget; silently dropped while muted / backgrounded / before unlock
 *   setMuted(m)              fades out and suspends the context (zero audio CPU while muted)
 *   setAmbient(0|1|2|3)      0 off, 1 wind, 2 + crickets, 3 + water
 */
import { App } from "@capacitor/app";
import type { Runtime } from "./runtime.ts";
import type { AmbientLevel, CueName, CueOpts } from "./types.ts";

export type { AmbientLevel, CueName, CueOpts } from "./types.ts";
export { pitchIndexForCell } from "./scale.ts";

const GESTURES = ["pointerdown", "pointerup", "touchend", "keydown"] as const;
const QUEUE_MAX_AGE_MS = 400; // cues fired while the runtime chunk loads; older ones are dropped

let armed = false;
let ctx: AudioContext | null = null;
let rt: Runtime | null = null;
let loading: Promise<void> | null = null;
let silentUnlockDone = false;
let suspendTimer: ReturnType<typeof setTimeout> | null = null;

let muted = false;
let background = false;
let ambient: AmbientLevel = 0;
const queue: { name: CueName; opts: CueOpts; at: number }[] = [];

const noop = (): void => undefined;
const wanted = (): boolean => !muted && !background;

export function initAudio(): void {
  if (armed || typeof window === "undefined") return;
  armed = true;
  background = document.visibilityState === "hidden";
  for (const ev of GESTURES) window.addEventListener(ev, onGesture, { capture: true, passive: true });
  document.addEventListener("visibilitychange", () => setBackground(document.visibilityState === "hidden"));
  // Capacitor pause/resume (app switcher, lock screen). visibilitychange usually fires too; both are idempotent.
  try {
    App.addListener("pause", () => setBackground(true)).catch(noop);
    App.addListener("resume", () => setBackground(false)).catch(noop);
  } catch {
    /* plugin unavailable (plain browser without Capacitor bridge) */
  }
}

/** Unlock now — for callers already inside a user-gesture handler (e.g. a first-tap listener added late). */
export function unlockAudio(): void {
  initAudio();
  onGesture();
}

export function playCue(
  name: "tap" | "place" | "spread" | "remove" | "invalid" | "nearComplete" | "complete" | "nextLevel" | "stoneTap",
  opts?: { pitchIndex?: number | undefined; litCount?: number | undefined; sequence?: number[] | undefined },
): void {
  initAudio();
  if (!wanted()) return;
  if (!ctx && userActivated()) onGesture(); // called from inside a tap before the capture listener ran
  if (!ctx) return;
  if (rt) rt.play(name, opts ?? {});
  else {
    queue.push({ name, opts: opts ?? {}, at: performance.now() });
    load();
  }
}

export function setMuted(m: boolean): void {
  initAudio();
  if (muted === m) return;
  muted = m;
  if (!m && !ctx && userActivated()) onGesture(); // unmute toggle is itself a tap
  apply();
}

export function setAmbient(level: 0 | 1 | 2 | 3): void {
  ambient = level;
  rt?.setAmbient(level);
}

/** For settings UI / diagnostics. */
export function audioState(): { muted: boolean; ambient: AmbientLevel; context: AudioContextState | "none"; voices: number } {
  return { muted, ambient, context: ctx?.state ?? "none", voices: rt?.voiceCount ?? 0 };
}

function userActivated(): boolean {
  return typeof navigator !== "undefined" && navigator.userActivation?.isActive === true;
}

function onGesture(): void {
  if (!wanted()) return; // a muted player never pays for audio
  if (!ctx) {
    // Mix with the player's own music/podcast and obey the ring/silent switch (WebKit Audio Session API, iOS 17+).
    try {
      const nav = navigator as Navigator & { audioSession?: { type: string } };
      if (nav.audioSession) nav.audioSession.type = "ambient";
    } catch {
      /* older WebKit */
    }
    try {
      ctx = new AudioContext({ latencyHint: "interactive" });
    } catch {
      return;
    }
    ctx.onstatechange = () => {
      // iOS "interrupted" (call, Siri) → silent until resumed by resume event or the next tap.
      if (ctx?.state === "running" && wanted()) rt?.setActive(true);
    };
  }
  if (ctx.state !== "running") ctx.resume().catch(noop);
  if (!silentUnlockDone) {
    // Classic iOS unlock: start a 1-sample silent buffer inside the gesture.
    silentUnlockDone = true;
    const s = ctx.createBufferSource();
    s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    s.connect(ctx.destination);
    s.start(0);
  }
  load();
}

function load(): void {
  if (loading || !ctx) return;
  const c = ctx;
  loading = import("./runtime.ts")
    .then((m) => {
      rt = m.createRuntime(c);
      rt.setAmbient(ambient);
      rt.setActive(wanted());
      const now = performance.now();
      for (const q of queue.splice(0)) if (now - q.at < QUEUE_MAX_AGE_MS) rt.play(q.name, q.opts);
    })
    .catch((e: unknown) => {
      loading = null;
      console.warn("[audio] runtime load failed", e);
    });
}

function setBackground(bg: boolean): void {
  if (background === bg) return;
  background = bg;
  apply();
}

/** Converge the context to the desired state: audible ⇄ faded + suspended. */
function apply(): void {
  if (!ctx) return;
  const c = ctx;
  if (suspendTimer) clearTimeout(suspendTimer);
  suspendTimer = null;
  rt?.setActive(wanted());
  if (wanted()) {
    if (c.state !== "running") c.resume().catch(noop); // if WebKit refuses without a gesture, the next tap resumes
  } else {
    // Let the 40 ms fade finish, then suspend: zero audio-thread CPU while muted or in the background.
    suspendTimer = setTimeout(() => {
      if (!wanted() && c.state === "running") c.suspend().catch(noop);
    }, rt ? 60 : 0);
  }
}

// DEV-only audition hook (dead-code-eliminated from release builds):
//   __lanternAudio.demo()  plays every cue in sequence; also playCue/setMuted/setAmbient/state.
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>)["__lanternAudio"] = {
    playCue,
    setMuted,
    setAmbient,
    initAudio,
    state: audioState,
    demo: () => void import("./dev/demo.ts").then((m) => m.playAll(playCue)),
  };
}
