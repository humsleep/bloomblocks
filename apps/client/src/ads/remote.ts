// Remote ad config: a static JSON on GitHub Pages (owner guide: docs/web/remote-config.md).
// Only ever called from ads.init() (after the first confirmed move, never on the cold-start path).
// Never throws: a missing / broken / slow file means "keep what we have". Every value it returns
// still goes through resolveRules()/resolveFlags() (policy.ts), so the clamps are the safety floor.
import { Preferences } from "@capacitor/preferences";

export const REMOTE_CONFIG_URL = "https://humsleep.github.io/apps/duskwick/config.json";
export const REMOTE_TIMEOUT_MS = 5_000;
/** the raw text of the last fetched file that parsed to an object */
export const REMOTE_CACHE_KEY = "ads.remote.v1";

export interface RemoteConfig {
  rules?: unknown;
  flags?: unknown;
}

function parse(text: string | null | undefined): RemoteConfig | null {
  try {
    const o: unknown = text ? JSON.parse(text) : null;
    return o && typeof o === "object" && !Array.isArray(o) ? (o as RemoteConfig) : null;
  } catch {
    return null;
  }
}

/** Last good file from an earlier launch, or null. */
export async function loadCachedConfig(): Promise<RemoteConfig | null> {
  try {
    return parse((await Preferences.get({ key: REMOTE_CACHE_KEY })).value);
  } catch {
    return null;
  }
}

/** Fetches the file; caches and returns it when it parses, else null (offline, HTTP error, bad JSON, timeout). */
export async function fetchRemoteConfig(timeoutMs = REMOTE_TIMEOUT_MS): Promise<RemoteConfig | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(REMOTE_CONFIG_URL, { signal: ctl.signal, cache: "no-cache" });
    if (!res.ok) return null;
    const text = await res.text();
    const cfg = parse(text);
    if (cfg) await Preferences.set({ key: REMOTE_CACHE_KEY, value: text }).catch(() => undefined);
    return cfg;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
