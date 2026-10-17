// Fake @capacitor/preferences (tests / e2e only): string key → string value.
import { fakeBackend } from "./backend.ts";

export const Preferences = {
  async get(o: { key: string }): Promise<{ value: string | null }> {
    return { value: fakeBackend.prefs.has(o.key) ? fakeBackend.prefs.get(o.key)! : null };
  },
  async set(o: { key: string; value: string }): Promise<void> {
    fakeBackend.prefs.set(o.key, String(o.value));
    fakeBackend.persist();
  },
  async remove(o: { key: string }): Promise<void> {
    fakeBackend.prefs.delete(o.key);
    fakeBackend.persist();
  },
  async clear(): Promise<void> {
    fakeBackend.prefs.clear();
    fakeBackend.persist();
  },
  async keys(): Promise<{ keys: string[] }> {
    return { keys: [...fakeBackend.prefs.keys()] };
  },
};
