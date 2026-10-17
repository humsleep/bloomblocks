// Which CloudKV the engine talks to: an injected one (unit tests), the e2e fake (window.__cloudkv,
// e2e / DEV builds only), or the native plugin (src/native/cloudkv.ts, agent N) when the platform
// has it. Web / Android: none → the engine stays "off" (local only), silently.
import type { CloudKVChange, CloudKVPlugin } from "../native/cloudkv.ts";

export type { CloudKVChange, CloudKVPlugin };

/** A call that failed because the platform has no implementation ("not implemented" / UNIMPLEMENTED). */
export function isUnimplemented(e: unknown): boolean {
  const o = e as { code?: string; message?: string } | null;
  return o?.code === "UNIMPLEMENTED" || /not implemented|unimplemented/i.test(o?.message ?? String(e));
}

export async function resolveCloudKV(): Promise<CloudKVPlugin | null> {
  if (import.meta.env.MODE === "e2e" || import.meta.env.DEV) {
    const fake = (globalThis as { __cloudkv?: CloudKVPlugin }).__cloudkv;
    if (fake) return fake;
  }
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("CloudKV")) return null;
    return (await import("../native/cloudkv.ts")).CloudKV;
  } catch (e) {
    console.info("[sync] no CloudKV", e);
    return null;
  }
}
