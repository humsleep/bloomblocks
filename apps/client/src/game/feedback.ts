// Feel layer: haptics + audio cues, fire-and-forget, never on the cold-start path.
//
// Audio: src/audio/cues.ts (owned by the audio pass). Its facade is tiny and
// defers the AudioContext + synth code to the first gesture, so importing it
// eagerly costs the cold start nothing measurable.
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Preferences } from "@capacitor/preferences";
import { initAudio, pitchIndexForCell, playCue, setAmbient, setMuted, type CueName, type CueOpts } from "../audio/cues.ts";

export { pitchIndexForCell };
export type { CueName, CueOpts };

export function cue(name: CueName, opts?: CueOpts): void {
  try {
    playCue(name, opts);
  } catch (e) {
    console.warn("[cues]", name, e);
  }
}

let muted = false;
/** Boot: arm the audio unlock and apply the saved mute setting (Preferences "muted"). */
export function startAudio(): void {
  initAudio();
  void Preferences.get({ key: "muted" }).then((r) => {
    muted = r.value === "1";
    setMuted(muted);
  });
}
export function isMuted(): boolean {
  return muted;
}
export function toggleMuted(): boolean {
  muted = !muted;
  setMuted(muted);
  void Preferences.set({ key: "muted", value: muted ? "1" : "0" });
  return muted;
}
/** Ambient bed by level: wind → + crickets → + distant water. */
export function ambientForLevel(n: number): void {
  setAmbient(n < 5 ? 1 : n < 15 ? 2 : 3);
}

let hapticsOn = true;
export function setHapticsEnabled(on: boolean): void {
  hapticsOn = on;
}
export function hapticsEnabled(): boolean {
  return hapticsOn;
}
/** Settings sheet (phase 2, audit P1-13): haptics on/off, Preferences "haptics" = "on" | "off". */
export function setHaptics(on: boolean): void {
  hapticsOn = on;
  void Preferences.set({ key: "haptics", value: on ? "on" : "off" });
}
const fire = (p: Promise<void>): void => void p.catch(() => undefined);

// Capacitor Haptics exposes Light/Medium/Heavy impacts, selection ticks and
// notifications — no "soft"/"rigid" styles or intensity. Closest mapping:
//   place → Light impact · remove → selection tick (softest) ·
//   invalid (≈ rigid 0.3) → two crisp selection ticks 45 ms apart ·
//   complete → Medium impact now, Success notification when the window lights.
export const haptic = {
  place: (): void => {
    if (hapticsOn) fire(Haptics.impact({ style: ImpactStyle.Light }));
  },
  remove: (): void => {
    if (hapticsOn) fire(Haptics.selectionStart().then(() => Haptics.selectionChanged()).then(() => Haptics.selectionEnd()));
  },
  invalid: (): void => {
    if (!hapticsOn) return;
    fire(Haptics.selectionStart().then(() => Haptics.selectionChanged()));
    setTimeout(() => fire(Haptics.selectionChanged().then(() => Haptics.selectionEnd())), 45);
  },
  completeHit: (): void => {
    if (hapticsOn) fire(Haptics.impact({ style: ImpactStyle.Medium }));
  },
  success: (): void => {
    if (hapticsOn) fire(Haptics.notification({ type: NotificationType.Success }));
  },
};

// ---------------------------------------------------------------- settings (Preferences)

export type NumberStyle = "digits" | "dots";
let numberStyle: NumberStyle = "digits";

/** Read before the first board bake (in parallel with the save restore). Digits are the default. */
export async function loadNumberStyle(): Promise<NumberStyle> {
  try {
    const r = await Preferences.get({ key: "numbers" });
    numberStyle = r.value === "dots" ? "dots" : "digits";
  } catch {
    /* default */
  }
  return numberStyle;
}
export function getNumberStyle(): NumberStyle {
  return numberStyle;
}
export function setNumberStyle(s: NumberStyle): void {
  numberStyle = s;
  void Preferences.set({ key: "numbers", value: s });
}

/** "Show time in share" (Preferences "shareTime", default on; Yuki wanted it off, Rachel on). */
let shareTime = true;
export async function loadShareTime(): Promise<boolean> {
  try {
    const r = await Preferences.get({ key: "shareTime" });
    shareTime = r.value !== "0";
  } catch {
    /* default on */
  }
  return shareTime;
}
export function getShareTime(): boolean {
  return shareTime;
}
export function setShareTime(on: boolean): void {
  shareTime = on;
  void Preferences.set({ key: "shareTime", value: on ? "1" : "0" });
}

/** v12 (Wick, decision A4): faces on the board's lanterns + Wick (Preferences "lanternFaces" = "on" | "off", default on). */
let lanternFaces = true;
export async function loadLanternFaces(): Promise<boolean> {
  try {
    const r = await Preferences.get({ key: "lanternFaces" });
    lanternFaces = r.value !== "off";
  } catch {
    /* default on */
  }
  return lanternFaces;
}
export function getLanternFaces(): boolean {
  return lanternFaces;
}
export function setLanternFaces(on: boolean): void {
  lanternFaces = on;
  void Preferences.set({ key: "lanternFaces", value: on ? "on" : "off" });
}

/**
 * Wordless guide steps already shown (bit set, Preferences "guide"):
 * 1 = tap → light (gentle 1), 2 = digit rock (gentle 2), 4 = two lanterns that
 * see each other (gentle 3), 8 = track button nudge (after gentle 5),
 * 16 = goal card (gentle 1, before the tap lesson), 32 = track peek (v5, unused since round 5),
 * 64 = the tower's first-unlock look (round 5: the camera looks over while it lights up),
 * 128 = the daily's moon (phase 2: once after gentle 3 while today's daily is unplayed).
 * Bit 8 now means "the player has tapped the tower" (the finger taps it until then).
 * v11: 256 = the first-yard tutorial (Tutorial.ts) was played or skipped; it replaces the goal card
 * and the gentle-1 tap lesson (their bits are set with it).
 */
export const GUIDE = { tap: 1, digit: 2, conflict: 4, track: 8, goal: 16, peek: 32, tower: 64, moon: 128, tutorial: 256 } as const;
let guideBits = 0;
export async function loadGuide(): Promise<number> {
  try {
    const r = await Preferences.get({ key: "guide" });
    guideBits = Number(r.value ?? "0") | 0;
  } catch {
    /* none */
  }
  return guideBits;
}
export function guideDone(bit: number): boolean {
  return (guideBits & bit) !== 0;
}
export function markGuide(bit: number): void {
  if (guideBits & bit) return;
  guideBits |= bit;
  void Preferences.set({ key: "guide", value: String(guideBits) });
}

/** "Show the guide again" (settings): forget the first-run lessons (goal card, tap, digit, conflict). */
export function replayGuide(): void {
  guideBits &= ~(GUIDE.goal | GUIDE.tap | GUIDE.digit | GUIDE.conflict);
  void Preferences.set({ key: "guide", value: String(guideBits) });
}

// ---------------------------------------------------------------- sessions (phase 5)

/**
 * Sessions so far, this one included (Preferences "sessions"): a launch, or a return after
 * ≥ 30 min in the background. The first session introduces at most four new things (tap,
 * numbers, conflict, today's puzzle); the tower waits for a later session (progress.ts towerOpen).
 */
let sessions = 1;
export const SESSION_GAP_MS = 30 * 60_000;
export async function loadSessionCount(): Promise<number> {
  try {
    const r = await Preferences.get({ key: "sessions" });
    sessions = Math.max(0, Number(r.value ?? "0") | 0) + 1;
  } catch {
    sessions = 1;
  }
  void Preferences.set({ key: "sessions", value: String(sessions) }).catch(() => undefined);
  return sessions;
}
export function sessionCount(): number {
  return sessions;
}
/** Back from the background after `awayMs`: a long break starts a new session. */
export function noteResume(awayMs: number): void {
  if (awayMs < SESSION_GAP_MS) return;
  sessions++;
  void Preferences.set({ key: "sessions", value: String(sessions) }).catch(() => undefined);
}

/** While a full-screen ad is up the game is silent (the saved mute setting is untouched). */
export function setAdAudio(adOpen: boolean): void {
  setMuted(adOpen || muted);
}
