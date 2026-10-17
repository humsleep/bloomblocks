// R2 (decision A5): deep links — parse the custom scheme and the web daily's address, route to
// today's daily (1.0 has no archive: past and future #n open today), retry while a screen is busy.
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleLink, type LinkSink, type OpenResult, parseDeepLink, resetDeepLinks, routeDaily } from "../src/game/deepLink.ts";

describe("parseDeepLink", () => {
  it.each([
    ["duskwick://daily/14", { daily: 14 }],
    ["duskwick://daily/14/", { daily: 14 }],
    ["duskwick://daily", { daily: "today" }],
    ["duskwick://today", { daily: "today" }],
    ["duskwick:daily/3", { daily: 3 }],
    ["https://humsleep.github.io/duskwick/14?ct=share", { daily: 14 }],
    ["https://humsleep.github.io/duskwick/14/", { daily: 14 }],
    ["https://HUMSLEEP.github.io/duskwick?ct=tiktok_bio", { daily: "today" }],
    ["https://humsleep.github.io/duskwick/", { daily: "today" }],
  ])("%s", (url, want) => expect(parseDeepLink(url)).toEqual(want));

  it.each(["", "duskwick://town", "duskwick://daily/abc", "https://example.com/duskwick/14", "http://humsleep.github.io/duskwick/14", "https://humsleep.github.io/other/14", "https://humsleep.github.io/duskwick/14/x", "not a url"])(
    "ignores %s",
    (url) => expect(parseDeepLink(url)).toBeNull(),
  );
});

describe("routeDaily (1.0: today, never a future board)", () => {
  const today = "2026-11-14"; // #14
  it("today's #n → today", () => expect(routeDaily({ daily: 14 }, today)).toBe(today));
  it("'today' → today", () => expect(routeDaily({ daily: "today" }, today)).toBe(today));
  it("future #n → today", () => expect(routeDaily({ daily: 15 }, today)).toBe(today));
  it("past #n → today unless allowed", () => {
    expect(routeDaily({ daily: 3 }, today)).toBe(today);
    expect(routeDaily({ daily: 3 }, today, { allowPast: () => true })).toBe("2026-11-03");
    expect(routeDaily({ daily: 3 }, today, { allowPast: (d) => d !== "2026-11-03" })).toBe(today);
  });
  it("nonsense numbers → today; before the epoch everything → today", () => {
    expect(routeDaily({ daily: 0 }, today)).toBe(today);
    expect(routeDaily({ daily: 1.5 }, today, { allowPast: () => true })).toBe(today);
    expect(routeDaily({ daily: 1 }, "2026-10-20", { allowPast: () => true })).toBe("2026-10-20");
  });
});

describe("handleLink", () => {
  afterEach(() => {
    resetDeepLinks();
    vi.useRealTimers();
  });
  const sinkOf = (answers: OpenResult[]): LinkSink & { calls: string[] } => {
    const calls: string[] = [];
    return { calls, openDailyLink: (d) => (calls.push(d), answers.shift() ?? "done") };
  };

  it("opens once, ignores other URLs and a duplicate within 2 s (launch URL + event)", () => {
    const sink = sinkOf([]);
    expect(handleLink(sink, "https://example.com", () => "2026-11-14")).toBe(false);
    expect(handleLink(sink, "duskwick://daily/14", () => "2026-11-14", () => 1000)).toBe(true);
    expect(handleLink(sink, "duskwick://daily/14", () => "2026-11-14", () => 1500)).toBe(true);
    expect(sink.calls).toEqual(["2026-11-14"]);
  });

  it("retries while busy, gives up after the wait", () => {
    vi.useFakeTimers();
    const sink = sinkOf(["busy", "busy", "done"]);
    handleLink(sink, "duskwick://daily", () => "2026-11-14");
    vi.advanceTimersByTime(1000);
    expect(sink.calls.length).toBe(3);
    resetDeepLinks();
    const always = { calls: [] as string[], openDailyLink: (d: string): OpenResult => (always.calls.push(d), "busy") };
    handleLink(always, "duskwick://today", () => "2026-11-14");
    vi.advanceTimersByTime(25_000);
    const n = always.calls.length;
    vi.advanceTimersByTime(5_000);
    expect(always.calls.length).toBe(n);
    expect(n).toBeGreaterThan(10);
  });

  it("'skip' drops the link (a player who has not reached the daily yet)", () => {
    vi.useFakeTimers();
    const sink = sinkOf(["skip"]);
    handleLink(sink, "duskwick://daily/14", () => "2026-11-14");
    vi.advanceTimersByTime(5000);
    expect(sink.calls.length).toBe(1);
  });
});
