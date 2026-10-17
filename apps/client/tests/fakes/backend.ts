// In-memory backing store shared by the Capacitor plugin fakes (tests only).
//
// Used two ways:
//   - vitest (node): pure in-memory; tests call fakeBackend.reset() between cases.
//   - Playwright e2e build (vite --mode e2e aliases @capacitor/* here): the maps are
//     mirrored to localStorage under "__fake:" keys so a page reload keeps the "device"
//     files, exactly like a relaunch on the phone. Each Playwright test gets a fresh
//     browser context, i.e. a fresh device.
//
// Everything is reachable from tests through globalThis.__fakes.

export interface FakeFile {
  data: string;
  /** "utf8" = text, "base64" = binary payload stored as base64 */
  enc: "utf8" | "base64";
  /** modification time (ms, Date.now() at the write); seeded files may have none */
  mtime?: number;
}

export type FsOp = "readFile" | "writeFile" | "appendFile" | "rename" | "deleteFile";

export interface FakeBackend {
  files: Map<string, FakeFile>;
  prefs: Map<string, string>;
  shares: Array<{ text?: string; title?: string; url?: string; dialogTitle?: string; files?: string[] }>;
  haptics: string[];
  /** the URL a cold start was opened with (App.getLaunchUrl; deep links, R2) */
  launchUrl: string | null;
  /** Ops that fail on their next call(s): op → remaining failures. */
  failures: Map<FsOp, number>;
  /** Count of calls per op (diagnostics / ordering assertions). */
  calls: Array<{ op: string; path: string }>;
  listeners: Map<string, Array<(data?: unknown) => void>>;
  reset(): void;
  persist(): void;
  failNext(op: FsOp, times?: number): void;
  /** Fire a Capacitor App event ("pause", "resume", "appStateChange", …). */
  fire(event: string, data?: unknown): void;
  readText(path: string): string | null;
}

const LS_KEY = "__fake:device";

function hasLocalStorage(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

function load(b: FakeBackend): void {
  if (!hasLocalStorage()) return;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return;
    const j = JSON.parse(raw) as { files?: Record<string, FakeFile>; prefs?: Record<string, string>; shares?: FakeBackend["shares"] };
    for (const [k, v] of Object.entries(j.files ?? {})) b.files.set(k, v);
    for (const [k, v] of Object.entries(j.prefs ?? {})) b.prefs.set(k, v);
    for (const s of j.shares ?? []) b.shares.push(s);
  } catch {
    /* corrupt test store: start empty */
  }
  try {
    // e2e: a cold start "opened from a link" (App.getLaunchUrl), set before the page loads
    b.launchUrl = window.localStorage.getItem("__fake:launchUrl");
  } catch {
    /* corrupt test store: start empty */
  }
}

function create(): FakeBackend {
  const b: FakeBackend = {
    files: new Map(),
    prefs: new Map(),
    shares: [],
    haptics: [],
    launchUrl: null,
    failures: new Map(),
    calls: [],
    listeners: new Map(),
    reset() {
      b.files.clear();
      b.prefs.clear();
      b.shares.length = 0;
      b.haptics.length = 0;
      b.failures.clear();
      b.calls.length = 0;
      b.listeners.clear();
      b.launchUrl = null;
      b.persist();
    },
    persist() {
      if (!hasLocalStorage()) return;
      try {
        window.localStorage.setItem(
          LS_KEY,
          // Cache files (the share postcard PNG, ~1 MB) are not mirrored: the OS may drop Caches anyway,
          // and they would blow the localStorage quota
          JSON.stringify({ files: Object.fromEntries([...b.files].filter(([k]) => !k.startsWith("CACHE/"))), prefs: Object.fromEntries(b.prefs), shares: b.shares }),
        );
      } catch {
        /* quota: ignore */
      }
    },
    failNext(op, times = 1) {
      b.failures.set(op, (b.failures.get(op) ?? 0) + times);
    },
    fire(event, data) {
      for (const f of b.listeners.get(event) ?? []) f(data);
    },
    readText(path) {
      const f = b.files.get(path);
      if (!f) return null;
      if (f.enc === "utf8") return f.data;
      return atob(f.data);
    },
  };
  load(b);
  return b;
}

const g = globalThis as unknown as { __fakes?: FakeBackend };
/** One backend per realm (shared by every fake plugin module). */
export const fakeBackend: FakeBackend = (g.__fakes ??= create());

/** Throw if a failure was injected for `op`. */
export function maybeFail(op: FsOp, path: string): void {
  fakeBackend.calls.push({ op, path });
  const n = fakeBackend.failures.get(op) ?? 0;
  if (n > 0) {
    fakeBackend.failures.set(op, n - 1);
    throw new Error(`injected ${op} failure (${path})`);
  }
}
