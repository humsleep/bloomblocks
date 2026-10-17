// Review P2: a failed import("./daily.ts") was cached forever (every later moon tap / daily step
// replayed the rejection). lazyRetry caches successes only.
import { describe, expect, it, vi } from "vitest";
import { lazyRetry } from "../src/game/lazy.ts";

describe("lazyRetry", () => {
  it("retries after a failure, then caches the success", async () => {
    const load = vi.fn<() => Promise<string>>().mockRejectedValueOnce(new Error("chunk")).mockResolvedValue("mod");
    const get = lazyRetry(load);
    await expect(get()).rejects.toThrow("chunk");
    await expect(get()).resolves.toBe("mod");
    await expect(get()).resolves.toBe("mod");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("concurrent callers share one load", async () => {
    const load = vi.fn(async () => 1);
    const get = lazyRetry(load);
    await Promise.all([get(), get(), get()]);
    expect(load).toHaveBeenCalledOnce();
  });
});
