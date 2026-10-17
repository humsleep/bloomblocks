// iOS accessibility preferences: the native A11yPrefs plugin when present, web fallbacks otherwise.
//   fontScale        native → else `font: -apple-system-body` probe px / 17 (WKWebView follows Dynamic Type)
//   boldText         native → else the probe's computed weight ≥ 600 (best effort)
//   increaseContrast native → else (prefers-contrast: more)
//   reduceMotion     native → else (prefers-reduced-motion: reduce)
//   voiceOver        native only (false on web)
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export interface A11yPrefs {
  fontScale: number;
  boldText: boolean;
  increaseContrast: boolean;
  reduceMotion: boolean;
  voiceOver: boolean;
}

/** Payload of the native plugin's get() and 'change' event (N). `language` is optional (preferred UI language). */
export interface NativePrefs {
  contentSizeCategory?: string;
  fontScale?: number;
  boldText?: boolean;
  increaseContrast?: boolean;
  reduceMotion?: boolean;
  voiceOver?: boolean;
  language?: string;
}

export interface A11yPrefsPlugin {
  get(): Promise<NativePrefs>;
  addListener(event: "change", cb: (p: NativePrefs) => void): Promise<PluginListenerHandle>;
}

export const DEFAULT_PREFS: Readonly<A11yPrefs> = { fontScale: 1, boldText: false, increaseContrast: false, reduceMotion: false, voiceOver: false };
/** Body text size at the default Dynamic Type setting (Large). */
export const BODY_PT = 17;

export const clampScale = (k: number): number => (Number.isFinite(k) ? Math.min(2, Math.max(1, k)) : 1);

export function samePrefs(a: A11yPrefs, b: A11yPrefs): boolean {
  return (
    a.fontScale === b.fontScale && a.boldText === b.boldText && a.increaseContrast === b.increaseContrast && a.reduceMotion === b.reduceMotion && a.voiceOver === b.voiceOver
  );
}

/** Web-side values, read by the layer (probe) and matchMedia. */
export interface WebPrefs {
  fontScale: number;
  boldText: boolean;
  increaseContrast: boolean;
  reduceMotion: boolean;
}

export function readProbe(probe: HTMLElement, win: Window): { fontScale: number; boldText: boolean } {
  const cs = win.getComputedStyle(probe);
  const px = parseFloat(cs.fontSize);
  const w = parseInt(cs.fontWeight, 10);
  // round to 1/100 so sub-pixel noise does not fire onChange
  return { fontScale: clampScale(Math.round((px / BODY_PT) * 100) / 100), boldText: Number.isFinite(w) && w >= 600 };
}

export function mediaFlag(win: Window, query: string): boolean {
  try {
    return typeof win.matchMedia === "function" && win.matchMedia(query).matches;
  } catch {
    return false;
  }
}

export function merge(web: WebPrefs, native: NativePrefs | null): A11yPrefs {
  const n = native ?? {};
  return {
    fontScale: clampScale(typeof n.fontScale === "number" ? n.fontScale : web.fontScale),
    boldText: typeof n.boldText === "boolean" ? n.boldText : web.boldText,
    increaseContrast: typeof n.increaseContrast === "boolean" ? n.increaseContrast : web.increaseContrast,
    reduceMotion: typeof n.reduceMotion === "boolean" ? n.reduceMotion : web.reduceMotion,
    voiceOver: n.voiceOver === true,
  };
}

/** The native plugin, or null on web / before N ships it. Never throws. */
export function nativePlugin(): A11yPrefsPlugin | null {
  try {
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("A11yPrefs")) return null;
    return registerPlugin<A11yPrefsPlugin>("A11yPrefs");
  } catch {
    return null;
  }
}
