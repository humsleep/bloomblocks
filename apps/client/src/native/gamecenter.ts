// JS side of the app-local GameCenter plugin (ios/App/App/GameCenter.swift). WHAT is sent and when is
// src/game/ranking.ts's decision. Web / tests: no native plugin — calls are recorded on
// globalThis.__gameCenterFake (signed in at once), so the flow is testable in a browser.
import { Capacitor, registerPlugin } from "@capacitor/core";

interface GameCenterPlugin {
  authenticate(): Promise<{ authenticated: boolean }>;
  submit(o: { id: string; score: number; context?: number }): Promise<{ submitted: boolean }>;
  show(o: { id: string }): Promise<{ shown: boolean }>;
}

const GameCenter = registerPlugin<GameCenterPlugin>("GameCenter");

export interface GameCenterFake {
  signedIn: boolean;
  scores: { id: string; score: number; context: number }[];
  shown: string[];
}
const fake = (): GameCenterFake => {
  const g = globalThis as unknown as { __gameCenterFake?: GameCenterFake };
  return (g.__gameCenterFake ??= { signedIn: false, scores: [], shown: [] });
};
const native = (): boolean => Capacitor.getPlatform() === "ios";

/** Sign in (Apple's sheet when needed). Never rejects. */
export async function gcAuthenticate(): Promise<boolean> {
  if (!native()) return (fake().signedIn = true);
  try {
    return (await GameCenter.authenticate()).authenticated;
  } catch {
    return false;
  }
}

export async function gcSubmit(id: string, score: number, context = 0): Promise<boolean> {
  if (!native()) {
    const f = fake();
    if (f.signedIn) f.scores.push({ id, score, context });
    return f.signedIn;
  }
  try {
    return (await GameCenter.submit({ id, score, context })).submitted;
  } catch {
    return false;
  }
}

export async function gcShow(id: string): Promise<boolean> {
  if (!native()) {
    fake().shown.push(id);
    return true;
  }
  try {
    return (await GameCenter.show({ id })).shown;
  } catch {
    return false;
  }
}
