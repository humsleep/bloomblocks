// Fake level worker (tests only) for session.setLevelWorker: requests queue up in `inbox`
// and are answered only when the test says so (respond / respondAll), so a "slow phone"
// worker is just a test that waits before responding. Levels come straight from the rules
// (@games), never through src/game/pipsApi.ts — tests can count main-thread generation there.
import { levelForDaily, levelForTrack, type Track } from "@games/lanterns-pips/tracks.ts";
import type { LevelWorker } from "../../src/game/session.ts";

type Req = { track?: Track; n?: number; daily?: string };
type Listener = (e: { data?: unknown; message?: string }) => void;

export class FakeLevelWorker implements LevelWorker {
  /** every worker the factory made, oldest first */
  static all: FakeLevelWorker[] = [];
  /** answer every request on its own (a fast worker) instead of waiting for respond() */
  static auto = false;
  inbox: Req[] = [];
  /** every request ever posted to this worker */
  posted: Req[] = [];
  terminated = false;
  private listeners: Record<"message" | "error", Listener[]> = { message: [], error: [] };

  constructor() {
    FakeLevelWorker.all.push(this);
  }

  static reset(): void {
    FakeLevelWorker.all = [];
    FakeLevelWorker.auto = false;
  }

  /** The newest worker (the one the session talks to). */
  static get current(): FakeLevelWorker {
    return FakeLevelWorker.all.at(-1)!;
  }

  /** Every request posted to any worker, as "track:n" / "daily:date". */
  static requests(): string[] {
    return FakeLevelWorker.all.flatMap((w) => w.posted.map(keyOf));
  }

  postMessage(msg: unknown): void {
    if (this.terminated) throw new Error("posted to a terminated worker");
    const r = msg as Req;
    this.inbox.push(r);
    this.posted.push(r);
    if (FakeLevelWorker.auto) {
      setTimeout(() => {
        if (!this.terminated && this.inbox.includes(r)) this.respond(keyOf(r));
      }, 0);
    }
  }

  addEventListener(type: "message" | "error", f: Listener): void {
    this.listeners[type].push(f);
  }

  terminate(): void {
    this.terminated = true;
  }

  /** Answer the oldest queued request (or the one matching `key`) with the real level. */
  respond(key?: string): string {
    const i = key === undefined ? 0 : this.inbox.findIndex((r) => keyOf(r) === key);
    if (i < 0 || i >= this.inbox.length) throw new Error(`no queued request ${key ?? ""} (queue: ${this.inbox.map(keyOf).join(", ")})`);
    const [r] = this.inbox.splice(i, 1);
    const level = r!.daily ? levelForDaily(r!.daily) : levelForTrack(r!.track!, r!.n!);
    this.emit("message", { data: { ...r, level } });
    return keyOf(r!);
  }

  respondAll(): string[] {
    const out: string[] = [];
    while (this.inbox.length) out.push(this.respond());
    return out;
  }

  /** The generator threw inside the worker. */
  respondError(key?: string): void {
    const i = key === undefined ? 0 : this.inbox.findIndex((r) => keyOf(r) === key);
    const [r] = this.inbox.splice(i, 1);
    this.emit("message", { data: { ...r, error: "boom" } });
  }

  /** The worker script died (uncaught error / failed to load). */
  crash(message = "worker crashed"): void {
    this.emit("error", { message });
  }

  private emit(type: "message" | "error", e: { data?: unknown; message?: string }): void {
    for (const f of this.listeners[type]) f(e);
  }
}

export const keyOf = (r: Req): string => (r.daily ? `daily:${r.daily}` : `${r.track}:${r.n}`);
