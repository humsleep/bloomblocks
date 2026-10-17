// Fire-and-forget haptics. iOS applies the user's system haptics setting itself.
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

let enabled = true;
export function setHapticsEnabled(on: boolean): void {
  enabled = on;
}

const fire = (p: Promise<void>): void => void p.catch(() => undefined);

export const haptic = {
  place: (): void => { if (enabled) fire(Haptics.impact({ style: ImpactStyle.Medium })); },
  remove: (): void => { if (enabled) fire(Haptics.impact({ style: ImpactStyle.Light })); },
  complete: (): void => { if (enabled) fire(Haptics.notification({ type: NotificationType.Success })); },
};
