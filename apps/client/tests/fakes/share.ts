// Fake @capacitor/share (tests / e2e only): records what would go to the system share sheet.
import { fakeBackend } from "./backend.ts";

export const Share = {
  async share(o: { text?: string; title?: string; url?: string; dialogTitle?: string; files?: string[] }): Promise<{ activityType?: string }> {
    fakeBackend.shares.push({ ...o });
    fakeBackend.persist();
    return { activityType: "fake" };
  },
  async canShare(): Promise<{ value: boolean }> {
    return { value: true };
  },
};
