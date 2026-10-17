// JS side of the app-local ReviewPrompt plugin (ios/App/App/ReviewPrompt.swift): Apple's own rating
// sheet (AppStore.requestReview). WHEN to call it is src/game/rating.ts's decision, never this file's.
// Web / tests: no native plugin — the call is recorded on globalThis.__reviewFake (e2e reads it).
import { Capacitor, registerPlugin } from "@capacitor/core";

interface ReviewPromptPlugin {
  request(): Promise<{ requested: boolean; reason?: string }>;
}

const ReviewPrompt = registerPlugin<ReviewPromptPlugin>("ReviewPrompt");

export interface ReviewFake {
  requests: { at: number; moment: string }[];
}

/** Ask iOS for its rating sheet (the system may show nothing). true = handed to the system. Never rejects. */
export async function requestReview(moment: string): Promise<boolean> {
  if (Capacitor.getPlatform() !== "ios") {
    const g = globalThis as unknown as { __reviewFake?: ReviewFake };
    (g.__reviewFake ??= { requests: [] }).requests.push({ at: Date.now(), moment });
    return false;
  }
  try {
    return (await ReviewPrompt.request()).requested;
  } catch {
    return false;
  }
}
