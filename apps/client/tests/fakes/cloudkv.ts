// Fake iCloud key-value store for the sync tests: one FakeCloud = one iCloud account's store,
// shared by any number of FakeCloudKV "devices" (the plugin contract of src/native/cloudkv.ts).
//   - a set() on one device reaches the others as a 'server' change (async, like iCloud)
//   - a device starts "fresh": its 'initialSync' arrives only when the test says so (initialSync())
//   - available = false → signed out; switchAccount() swaps the store underneath (an 'account' change)
//   - quotaBytes: set() of a value larger than that rejects (the native TOO_LARGE / quota)
import type { CloudKVChange, CloudKVPlugin } from "../../src/native/cloudkv.ts";

export class FakeCloud {
  values = new Map<string, string>();
  devices: FakeCloudKV[] = [];
  /** reject set() of values above this many bytes (null = no limit) */
  quotaBytes: number | null = null;
  writes: Array<{ key: string; bytes: number }> = [];

  device(): FakeCloudKV {
    const d = new FakeCloudKV(this);
    this.devices.push(d);
    return d;
  }
}

type Listener = (e: CloudKVChange) => void;

export class FakeCloudKV implements CloudKVPlugin {
  available = true;
  /** false = a fresh install before iCloud's first delivery: the store reads empty until initialSync() */
  delivered = true;
  /** deliver other devices' writes as 'server' changes */
  online = true;
  listeners: Listener[] = [];
  calls: string[] = [];
  /** events fired before a listener attached (the native plugin retains them) */
  private retained: CloudKVChange[] = [];

  constructor(public cloud: FakeCloud) {}

  async getAll(): Promise<{ available: boolean; values: Record<string, string> }> {
    this.calls.push("getAll");
    if (!this.available) return { available: false, values: {} };
    if (!this.delivered) return { available: true, values: {} };
    return { available: true, values: Object.fromEntries(this.cloud.values) };
  }

  async set(o: { key: string; value: string }): Promise<void> {
    this.calls.push(`set ${o.key}`);
    if (!this.available) return; // no iCloud identity: the local store takes it, nothing syncs
    const bytes = new TextEncoder().encode(o.value).length;
    if (bytes > 64 * 1024 || (this.cloud.quotaBytes !== null && bytes > this.cloud.quotaBytes)) throw Object.assign(new Error("too large"), { code: "TOO_LARGE" });
    this.cloud.values.set(o.key, o.value);
    this.cloud.writes.push({ key: o.key, bytes });
    for (const d of this.cloud.devices) if (d !== this && d.online && d.available) setTimeout(() => d.fire({ reason: "server", keys: [o.key] }), 0);
  }

  async remove(o: { key: string }): Promise<void> {
    this.calls.push(`remove ${o.key}`);
    this.cloud.values.delete(o.key);
  }

  async synchronize(): Promise<{ ok: boolean }> {
    return { ok: this.available };
  }

  async addListener(_event: "change", cb: Listener): Promise<{ remove: () => Promise<void> }> {
    this.listeners.push(cb);
    for (const e of this.retained.splice(0)) cb(e);
    return { remove: async () => void (this.listeners = this.listeners.filter((f) => f !== cb)) };
  }

  async removeAllListeners(): Promise<void> {
    this.listeners = [];
  }

  fire(e: CloudKVChange): void {
    if (!this.listeners.length) this.retained.push(e);
    for (const f of this.listeners) f(e);
  }

  initialSync(): void {
    this.delivered = true;
    this.fire({ reason: "initialSync", keys: [...this.cloud.values.keys()] });
  }

  /** The device signs into another account (or the same one again): the store underneath changes. */
  switchAccount(to: FakeCloud): void {
    this.cloud.devices = this.cloud.devices.filter((d) => d !== this);
    this.cloud = to;
    to.devices.push(this);
    this.fire({ reason: "account", keys: [] });
  }
}
