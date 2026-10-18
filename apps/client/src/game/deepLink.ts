// Deep links (R2, decision A5): the share text's link and the custom scheme open the daily.
//
//   duskwick://daily · duskwick://daily/<n> · duskwick://today
//   https://humsleep.github.io/apps/duskwick[/<n>][/][?ct=…]      (Universal Links, docs/web/README.md)
//
// Routing (routeDaily): #n of today → today's daily. 1.0 has no archive of past dailies, so a past
// #n (allowPast off) and a future #n both open TODAY's daily — the link is an invitation to play,
// never a way to see a board before its day. A player who has not reached the daily yet (the
// first lessons) is not pulled out of them: the scene declines and the link is dropped.
//
// Nothing here is on the cold-start path: main.ts installs the listener after the first frame
// (afterInteractive), and the launch URL of a cold start is read then too (App.getLaunchUrl).
import { App } from "@capacitor/app";
import { dailyNumber, isoDay, isoFromDay } from "./pipsApi.ts";

/** What a link asks for: a daily number, or today's daily. null = not ours. */
export type LinkTarget = { daily: number } | { daily: "today" };

const WEB_HOST = "humsleep.github.io";
const WEB_PATH = /^\/apps\/duskwick(?:\/(\d{1,6}))?\/?$/;
const APP_PATH = /^\/?(?:daily(?:\/(\d{1,6}))?|today)\/?$/;

/** Parse a deep link (custom scheme or the web daily's address). Query / hash are ignored (ct=…). */
export function parseDeepLink(raw: string | null | undefined): LinkTarget | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  const num = (s: string | undefined): LinkTarget => (s ? { daily: Number(s) } : { daily: "today" });
  if (u.protocol === "duskwick:") {
    // duskwick://daily/14 → host "daily", path "/14"; duskwick:daily/14 → path "daily/14"
    const path = u.host ? `/${u.host}${u.pathname === "/" ? "" : u.pathname}` : u.pathname;
    const m = APP_PATH.exec(path);
    return m ? num(m[1]) : null;
  }
  if (u.protocol === "https:" && u.hostname.toLowerCase() === WEB_HOST) {
    const m = WEB_PATH.exec(u.pathname);
    return m ? num(m[1]) : null;
  }
  return null;
}

export interface RouteOptions {
  /** may a past daily open (1.0: no archive → false); the predicate gets the date */
  allowPast?: (dateISO: string) => boolean;
}

/** The date a link opens: today's daily unless #n is today (or an allowed past day). Never a future day. */
export function routeDaily(t: LinkTarget, today: string, o: RouteOptions = {}): string {
  if (t.daily === "today") return today;
  const todayN = dailyNumber(today);
  if (!Number.isInteger(t.daily) || t.daily < 1 || t.daily > todayN) return today;
  const date = isoFromDay(isoDay(today) - (todayN - t.daily));
  if (date === today) return today;
  return o.allowPast?.(date) ? date : today;
}

/** The scene's side: "done" (opened / already there), "busy" (try again soon), "skip" (not for this player now). */
export type OpenResult = "done" | "busy" | "skip";

export interface LinkSink {
  openDailyLink(dateISO: string): OpenResult;
}

/** How long a link waits for a busy screen (a sheet, a board switch) before it is dropped. */
export const LINK_WAIT_MS = 20_000;
const RETRY_MS = 400;

let pending: { date: string; until: number } | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let lastUrl = "";
let lastAt = -1e9;

/** Route one URL into the scene (deduped: the launch URL and the appUrlOpen event may both carry it). */
export function handleLink(sink: LinkSink, url: string, today: () => string, now: () => number = () => Date.now()): boolean {
  const t = parseDeepLink(url);
  if (!t) return false;
  if (url === lastUrl && now() - lastAt < 2000) return true;
  lastUrl = url;
  lastAt = now();
  pending = { date: routeDaily(t, today()), until: now() + LINK_WAIT_MS };
  if (timer) clearTimeout(timer);
  timer = null;
  const step = (): void => {
    timer = null;
    if (!pending) return;
    // the day may have turned while waiting: today's daily is still what the link asked for
    const date = pending.date < today() ? today() : pending.date;
    const r = sink.openDailyLink(date);
    if (r !== "busy") console.info(`[link] ${url} → ${date}: ${r}`);
    if (r === "busy" && now() < pending.until) timer = setTimeout(step, RETRY_MS);
    else {
      if (r === "busy") console.info(`[link] ${url} → ${date}: dropped (the screen stayed busy)`);
      pending = null;
    }
  };
  step();
  return true;
}

/** main.ts, after the first frame: the cold-start launch URL, then every later link. */
export function installDeepLinks(sink: LinkSink, today: () => string): void {
  void App.addListener("appUrlOpen", (e: { url?: string }) => void handleLink(sink, e?.url ?? "", today)).catch(() => undefined);
  const app = App as unknown as { getLaunchUrl?: () => Promise<{ url?: string } | undefined> };
  void app.getLaunchUrl?.().then((r) => r?.url && handleLink(sink, r.url, today)).catch(() => undefined);
}

/** Tests: forget the dedupe and any waiting link. */
export function resetDeepLinks(): void {
  pending = null;
  if (timer) clearTimeout(timer);
  timer = null;
  lastUrl = "";
  lastAt = -1e9;
}
