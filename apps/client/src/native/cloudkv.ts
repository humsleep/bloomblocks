// JS side of the app-local CloudKV plugin (ios/App/App/CloudKV.swift) — iCloud key-value
// store (NSUbiquitousKeyValueStore). Contract: docs/phase2-plan.md "Phase 4 — iCloud sync".
// Web/Android: no implementation is registered, so every call rejects with UNIMPLEMENTED
// and the sync module disables itself.
// Native limits: key 1–64 UTF-8 bytes (BAD_KEY), value ≤ 64 KB UTF-8 (TOO_LARGE);
// Apple's store-wide quota is 1 MB / 1024 keys (exceeding it → 'change' with reason 'quota').
import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export type CloudKVChangeReason = "server" | "initialSync" | "quota" | "account";

export interface CloudKVChange {
  reason: CloudKVChangeReason;
  /** Changed keys. Empty for an account change from NSUbiquityIdentityDidChange → re-read with getAll(). */
  keys: string[];
}

export interface CloudKVPlugin {
  /** available = an iCloud account is signed in (FileManager.ubiquityIdentityToken != nil). */
  getAll(): Promise<{ available: boolean; values: Record<string, string> }>;
  /** Writes immediately to the local store; upload is scheduled (coalesced synchronize ~1 s later). */
  set(o: { key: string; value: string }): Promise<void>;
  remove(o: { key: string }): Promise<void>;
  /** ok = false when iCloud is unavailable (no account or entitlement). */
  synchronize(): Promise<{ ok: boolean }>;
  /** Events fired before the first listener attaches are retained and delivered on attach. */
  addListener(event: "change", cb: (e: CloudKVChange) => void): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

export const CloudKV = registerPlugin<CloudKVPlugin>("CloudKV");
