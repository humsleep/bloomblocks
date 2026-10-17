// Local notifications for U's src/notify/** (docs/phase2-plan.md "Phase 5": opt-in, asked on the
// 2nd counted daily result). Wraps @capacitor/local-notifications 8.3.1 so that:
//   • nothing loads or prompts at launch (dynamic import on first use; the plugin's native load()
//     only registers its delegate — no permission request),
//   • the permission prompt appears ONLY from requestPermission() (your opt-in "yes" tap), and
//     asks for .alert only (native NotifyAuth; the stock plugin would ask alert+sound+badge):
//     the plugin's schedule() would silently prompt when the status is still undetermined, so
//     schedule() here refuses unless permission is already granted,
//   • web / e2e / Android: every call is a harmless no-op ("unsupported").
// iOS needs no Info.plist key and no entitlement for LOCAL notifications (aps-environment is
// for remote push only). The text shown is the notification's own title/body (localize in U).
import { Capacitor, registerPlugin } from "@capacitor/core";

/** ios/App/App/NotifyAuth.swift — the ONE prompt, alert only (no sound / badge). */
const NotifyAuth = registerPlugin<{
  request(): Promise<{ granted: boolean; status: string }>;
  status(): Promise<{ status: string }>;
}>("NotifyAuth");

export type NotifyPermission = "granted" | "denied" | "prompt" | "unsupported";

export interface DailyReminder {
  /** stable id (int32) — scheduling the same id replaces the pending one */
  id: number;
  title: string;
  body: string;
  /** local wall-clock time of the first fire */
  at: Date;
  /** repeat every day at the same local time */
  daily?: boolean;
}

type Plugin = typeof import("@capacitor/local-notifications").LocalNotifications;
let mod: Promise<Plugin | null> | null = null;

function plugin(): Promise<Plugin | null> {
  if (Capacitor.getPlatform() !== "ios") return Promise.resolve(null);
  mod ??= import("@capacitor/local-notifications").then(
    (m) => m.LocalNotifications,
    () => null,
  );
  return mod;
}

const norm = (s: string): NotifyPermission => (s === "granted" ? "granted" : s === "denied" ? "denied" : "prompt");

export const notifications = {
  /** Current permission, never prompts. */
  async permission(): Promise<NotifyPermission> {
    const p = await plugin();
    if (!p) return "unsupported";
    try {
      return norm((await p.checkPermissions()).display);
    } catch {
      return "unsupported";
    }
  },

  /** Shows the system prompt (alert only; once per install, later calls just report). Call only from the player's opt-in tap. */
  async requestPermission(): Promise<NotifyPermission> {
    const p = await plugin();
    if (!p) return "unsupported";
    try {
      const r = await NotifyAuth.request();
      return r.status === "authorized" || r.status === "provisional" || r.status === "ephemeral" ? "granted" : r.status === "denied" ? "denied" : "prompt";
    } catch {
      // older native shell without NotifyAuth: fall back to the stock request (alert+sound+badge)
      try {
        return norm((await p.requestPermissions()).display);
      } catch {
        return "unsupported";
      }
    }
  },

  /** Schedules only when already granted (never triggers the prompt). true when scheduled. */
  async schedule(n: DailyReminder): Promise<boolean> {
    const p = await plugin();
    if (!p || (await notifications.permission()) !== "granted") return false;
    try {
      await p.schedule({
        notifications: [
          {
            id: n.id,
            title: n.title,
            body: n.body,
            schedule: n.daily
              ? { on: { hour: n.at.getHours(), minute: n.at.getMinutes() }, allowWhileIdle: true }
              : { at: n.at, allowWhileIdle: true },
          },
        ],
      });
      return true;
    } catch (e) {
      console.warn("[notify] schedule failed", e);
      return false;
    }
  },

  async cancel(ids: number[]): Promise<void> {
    const p = await plugin();
    if (!p || ids.length === 0) return;
    await p.cancel({ notifications: ids.map((id) => ({ id })) }).catch(() => undefined);
  },

  async pendingIds(): Promise<number[]> {
    const p = await plugin();
    if (!p) return [];
    try {
      return (await p.getPending()).notifications.map((n) => n.id);
    } catch {
      return [];
    }
  },
};
