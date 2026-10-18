// JS side of the app-local AdAudio plugin (ios/App/App/AdAudio.swift): AVAudioSession .ambient,
// GMA "app manages the audio session", game mute → MobileAds.isApplicationMuted.
// Used only by src/ads/AdMobAds.ts (dynamic import after the first move).
import { Capacitor, registerPlugin } from "@capacitor/core";

interface AdAudioPlugin {
  configure(o: { muted: boolean }): Promise<{ category: string; applicationManaged: boolean; muted: boolean }>;
  /** release = a Release configuration on a real device (not Debug / Measure / simulator) */
  buildKind(): Promise<{ release: boolean }>;
}

const AdAudio = registerPlugin<AdAudioPlugin>("AdAudio");

/** true when the native plugin applied the settings; false on web / an older native shell. Never rejects. */
export async function configureAdAudio(muted: boolean): Promise<boolean> {
  if (Capacitor.getPlatform() !== "ios") return false;
  try {
    const r = await AdAudio.configure({ muted });
    if (import.meta.env?.DEV) console.info("[ads] audio", r);
    return true;
  } catch {
    return false;
  }
}

/** true ONLY when the native shell says it is a Release build on a device. Web, an older shell
 *  without the method, or any error → false (test ads: the fail-safe side). Never rejects. */
export async function isReleaseBuild(): Promise<boolean> {
  if (Capacitor.getPlatform() !== "ios") return false;
  try {
    return (await AdAudio.buildKind()).release === true;
  } catch (e) {
    console.warn("[ads] build kind unavailable → test ads", e);
    return false;
  }
}
