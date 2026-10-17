// Fake @capacitor/app (tests / e2e only). globalThis.__fakes.fire("pause" | "resume") drives
// the lifecycle listeners the app registers.
import { fakeBackend } from "./backend.ts";

export const App = {
  async addListener(event: string, cb: (data?: unknown) => void): Promise<{ remove: () => Promise<void> }> {
    const list = fakeBackend.listeners.get(event) ?? [];
    list.push(cb);
    fakeBackend.listeners.set(event, list);
    return {
      remove: async () => {
        const l = fakeBackend.listeners.get(event) ?? [];
        fakeBackend.listeners.set(event, l.filter((f) => f !== cb));
      },
    };
  },
  async removeAllListeners(): Promise<void> {
    fakeBackend.listeners.clear();
  },
  async getInfo(): Promise<{ name: string; id: string; build: string; version: string }> {
    return { name: "Duskwick", id: "test", build: "0", version: "0" };
  },
  async getState(): Promise<{ isActive: boolean }> {
    return { isActive: true };
  },
  async exitApp(): Promise<void> {},
  /** the URL a cold start was opened with (deep links); tests set fakeBackend.launchUrl */
  async getLaunchUrl(): Promise<{ url: string } | undefined> {
    return fakeBackend.launchUrl ? { url: fakeBackend.launchUrl } : undefined;
  },
};
