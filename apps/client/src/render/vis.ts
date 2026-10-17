// Visual accessibility preferences the drawing honours (phase 2, audit P1-6):
//   fontScale        iOS Dynamic Type (1 = default "Large"): door / town plates and the result digits grow
//   boldText         iOS Bold Text: board digits and plates are drawn heavier (800)
//   increaseContrast iOS Increase Contrast: opaque threads / rims / HUD discs, steady (non-breathing) marks
//   reduceMotion     iOS Reduce Motion (read by motion.ts)
//   voiceOver        VoiceOver running (the hidden a11y layer is live)
// Source: agent A's src/a11y module (native A11yPrefs plugin) once it is attached; until then the
// web fallbacks below (matchMedia + a -apple-system-body probe, which WKWebView sizes by Dynamic Type).
// Nothing here allocates per frame; listeners fire only when a value actually changes.

export interface VisPrefs {
  fontScale: number;
  boldText: boolean;
  increaseContrast: boolean;
  reduceMotion: boolean;
  voiceOver: boolean;
}

const mq = (q: string): MediaQueryList | null => {
  try {
    return window.matchMedia(q);
  } catch {
    return null;
  }
};

/** WKWebView resolves `font: -apple-system-body` to the Dynamic Type body size (17 px at the default size). */
function probeFontScale(): number {
  try {
    const el = document.createElement("div");
    el.style.cssText = "position:fixed;left:-99px;top:0;visibility:hidden;font:-apple-system-body";
    document.body.appendChild(el);
    const px = parseFloat(getComputedStyle(el).fontSize) || 17;
    el.remove();
    // browsers without the keyword fall back to 16 px: treat ≤ 17 as the default size
    return Math.max(1, Math.min(3.2, px / 17));
  } catch {
    return 1;
  }
}

const rm = mq("(prefers-reduced-motion: reduce)");
const hc = mq("(prefers-contrast: more)");
let attached = false;
let cur: VisPrefs = {
  fontScale: typeof document !== "undefined" && document.body ? probeFontScale() : 1,
  boldText: false,
  increaseContrast: hc?.matches ?? false,
  reduceMotion: rm?.matches ?? false,
  voiceOver: false,
};
const subs = new Set<(p: VisPrefs, prev: VisPrefs) => void>();

function set(p: Partial<VisPrefs>): void {
  const next: VisPrefs = { ...cur, ...p };
  if (
    next.fontScale === cur.fontScale && next.boldText === cur.boldText && next.increaseContrast === cur.increaseContrast &&
    next.reduceMotion === cur.reduceMotion && next.voiceOver === cur.voiceOver
  ) return;
  const prev = cur;
  cur = next;
  for (const cb of subs) {
    try {
      cb(cur, prev);
    } catch (e) {
      console.warn("[vis] listener", e);
    }
  }
}

rm?.addEventListener("change", (e) => {
  if (!attached) set({ reduceMotion: e.matches });
});
hc?.addEventListener("change", (e) => {
  if (!attached) set({ increaseContrast: e.matches });
});

export const vis = {
  get p(): VisPrefs {
    return cur;
  },
  /** Bake-key suffix for textures whose look depends on bold / contrast ("" by default). */
  get sig(): string {
    return `${cur.boldText ? "B" : ""}${cur.increaseContrast ? "C" : ""}`;
  },
  /** Font weight for digits (board numbers, plates, result digits). */
  get weight(): string {
    return cur.boldText ? "800" : "700";
  },
  onChange(cb: (p: VisPrefs, prev: VisPrefs) => void): () => void {
    subs.add(cb);
    return () => subs.delete(cb);
  },
  /** Agent A's a11y module (src/a11y): its prefs win over the web fallbacks from now on. */
  attach(src: { prefs(): VisPrefs; onChange(cb: (p: VisPrefs) => void): () => void }): void {
    attached = true;
    try {
      // right after a11y.init only the media-query values are real (its Dynamic Type probe and the
      // native plugin answer a frame later, through onChange): keep our own probe's size till then
      const p0 = sanitize(src.prefs());
      const { fontScale: _f, boldText: _b, ...now } = p0;
      set(now);
      src.onChange((p) => set(sanitize(p)));
    } catch (e) {
      console.warn("[vis] a11y attach failed", e);
    }
  },
  /** DEV / capture: force values (e.g. ?vis=bold,contrast,xxxl,still). */
  devSet(p: Partial<VisPrefs>): void {
    set(p);
  },
};

function sanitize(p: Partial<VisPrefs>): Partial<VisPrefs> {
  const out: Partial<VisPrefs> = {};
  if (typeof p.fontScale === "number" && Number.isFinite(p.fontScale)) out.fontScale = Math.max(1, Math.min(3.2, p.fontScale));
  if (typeof p.boldText === "boolean") out.boldText = p.boldText;
  if (typeof p.increaseContrast === "boolean") out.increaseContrast = p.increaseContrast;
  if (typeof p.reduceMotion === "boolean") out.reduceMotion = p.reduceMotion;
  if (typeof p.voiceOver === "boolean") out.voiceOver = p.voiceOver;
  return out;
}

/** Plate digits (pt) for a base size: base × fontScale, clamped to [base, max]. */
export function scaledPt(base: number, max: number): number {
  return Math.round(Math.max(base, Math.min(max, base * cur.fontScale)));
}
