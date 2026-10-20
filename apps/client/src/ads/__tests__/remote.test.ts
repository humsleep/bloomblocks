// ./remote.ts: the GitHub Pages config file. Bad JSON / HTTP errors / offline / timeout → null and
// nothing cached; a good file is cached for the next launch. Values are clamped by policy.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBackend } from "../../../tests/fakes/backend.ts";
import { resolveFlags, resolveRules, RULES } from "../policy.ts";
import { fetchRemoteConfig, loadCachedConfig, REMOTE_CACHE_KEY, REMOTE_CONFIG_URL, REMOTE_TIMEOUT_MS } from "../remote.ts";

const serve = (body: string, status = 200) => vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status })));

beforeEach(() => fakeBackend.reset());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("remote ad config", () => {
  it("a good file is returned and cached for the next launch", async () => {
    const body = JSON.stringify({ rules: { perDay: 6 }, flags: { banner: true } });
    serve(body);
    expect(await fetchRemoteConfig()).toEqual({ rules: { perDay: 6 }, flags: { banner: true } });
    expect(vi.mocked(fetch).mock.calls[0]![0]).toBe(REMOTE_CONFIG_URL);
    expect(fakeBackend.prefs.get(REMOTE_CACHE_KEY)).toBe(body);
    vi.unstubAllGlobals(); // next launch, offline
    expect(await loadCachedConfig()).toEqual({ rules: { perDay: 6 }, flags: { banner: true } });
  });

  it("bad JSON, a non-object, or an HTTP error is ignored and does not replace the cached copy", async () => {
    fakeBackend.prefs.set(REMOTE_CACHE_KEY, JSON.stringify({ rules: { perDay: 6 } }));
    for (const [body, status] of [["{rules:", 200], ["[1,2]", 200], ["null", 200], ["<html>404</html>", 404]] as const) {
      serve(body, status);
      expect(await fetchRemoteConfig()).toBeNull();
    }
    expect(await loadCachedConfig()).toEqual({ rules: { perDay: 6 } });
    fakeBackend.prefs.set(REMOTE_CACHE_KEY, "{corrupt");
    expect(await loadCachedConfig()).toBeNull();
  });

  it("offline → null; no cache → null", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Load failed"))));
    expect(await fetchRemoteConfig()).toBeNull();
    expect(await loadCachedConfig()).toBeNull();
  });

  it("a server that never answers times out → null", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_u: string, o: RequestInit) => new Promise((_r, rej) => o.signal!.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError"))))),
    );
    const p = fetchRemoteConfig();
    await vi.advanceTimersByTimeAsync(REMOTE_TIMEOUT_MS);
    expect(await p).toBeNull();
  });

  it("out-of-range and wrong-type values from the file are clamped / ignored", async () => {
    serve(JSON.stringify({ rules: { graceUnits: 0, unitsBetween: 1, perDay: 99, playSecondsBetween: "1", breakMs: 1 }, flags: { banner: "yes", rewardArchive: true } }));
    const cfg = await fetchRemoteConfig();
    const r = resolveRules(cfg?.rules);
    expect(r.graceUnits).toBe(5);
    expect(r.unitsBetween).toBe(2);
    expect(r.perDay).toBe(10);
    expect(r.playSecondsBetween).toBe(RULES.playSecondsBetween);
    expect(r.breakMs).toBe(RULES.breakMs); // the card's promise is not remote-configurable
    expect(resolveFlags(cfg?.flags)).toEqual({ banner: false, rewardKeepsake: false, rewardArchive: true, cozyEvening: true });
  });
});
