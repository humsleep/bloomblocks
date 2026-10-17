// Fake @capacitor/haptics (tests / e2e only): records every call.
import { fakeBackend } from "./backend.ts";

export enum ImpactStyle {
  Heavy = "HEAVY",
  Medium = "MEDIUM",
  Light = "LIGHT",
}
export enum NotificationType {
  Success = "SUCCESS",
  Warning = "WARNING",
  Error = "ERROR",
}

const rec = (s: string): Promise<void> => {
  fakeBackend.haptics.push(s);
  return Promise.resolve();
};

export const Haptics = {
  impact: (o?: { style?: ImpactStyle }): Promise<void> => rec(`impact:${o?.style ?? ImpactStyle.Heavy}`),
  notification: (o?: { type?: NotificationType }): Promise<void> => rec(`notification:${o?.type ?? NotificationType.Success}`),
  vibrate: (): Promise<void> => rec("vibrate"),
  selectionStart: (): Promise<void> => rec("selectionStart"),
  selectionChanged: (): Promise<void> => rec("selectionChanged"),
  selectionEnd: (): Promise<void> => rec("selectionEnd"),
};
