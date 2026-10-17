// DEV / e2e ONLY: window.__test, the app's test surface (TESTABILITY.md P1, P4, P5).
//
// Loaded with a dynamic import guarded by
//   (import.meta.env.DEV && import.meta.env.MODE !== "test") || import.meta.env.MODE === "e2e"
// (session.ts after restore; main.ts may attach the game / scene the same way), so the m0 / m1
// production bundles contain none of it — check: `vite build --mode m1` and grep the output
// for "__test" (apps/client/tests/bridge.test.ts documents the command).
//
//   __test.session          the live Session (set by Session.restore)
//   __test.game / scene     set by main.ts through attach() once U wires it (null until then)
//   __test.scene?.cellCenter / hudPoints / isIdle   scene hooks (U, TESTABILITY.md P2 / P3)
//   __test.clock            move the app's wall clock (localDateISO, the daily) without replacing Date
//   __test.worker           swap the level worker: slow it down, crash it, or remove it
//   __test.flush()          resolves when every queued save has landed
//   __test.governor         the idle frame governor: state(), force(true | false | null), movers()
import {
  clock, hasLevelWorker, levelGen, type LevelWorker, type LevelWorkerFactory, resetClock, type Session, setClock, setLevelWorker,
} from "../game/session.ts";
import { levelForTrack, type Track } from "../game/pipsApi.ts";
import { flush } from "../save/store.ts";
import { governor } from "../game/frameGovernor.ts";

/** A worker whose replies arrive `delayMs` after the real worker's (slow phone simulation). */
export function slowWorker(inner: LevelWorkerFactory, delayMs: number): LevelWorkerFactory {
  return () => {
    const w = inner();
    const listeners: Array<(e: { data?: unknown; message?: string }) => void> = [];
    w.addEventListener("message", (e) => {
      setTimeout(() => {
        for (const f of listeners) f(e);
      }, delayMs);
    });
    const slow: LevelWorker = {
      postMessage: (m) => w.postMessage(m),
      addEventListener: (type, f) => {
        if (type === "message") listeners.push(f);
        else w.addEventListener(type, f);
      },
      terminate: () => w.terminate?.(),
    };
    return slow;
  };
}

const realWorker: LevelWorkerFactory = () =>
  new Worker(new URL("../game/nextLevel.worker.ts", import.meta.url), { type: "module" }) as unknown as LevelWorker;

export interface TestBridge {
  session: Session | null;
  game: unknown;
  scene: unknown;
  clock: {
    /** Pin the wall clock to a local time ("2026-10-15T00:00:05"), ticking from there; null = real clock. */
    set(localISO: string | null): void;
    today(): string;
  };
  worker: {
    /** Replies `ms` later than normal. */
    slow(ms: number): void;
    /** No worker: the main thread generates (between frames). */
    none(): void;
    /** The real module worker again. */
    reset(): void;
    available(): boolean;
    /** Track levels ≥ n cannot be generated (main thread throws; the worker is removed). null = back to normal. */
    failFrom(n: number | null): void;
  };
  flush(): Promise<void>;
  governor: typeof governor;
}

function create(): TestBridge {
  return {
    session: null,
    game: null,
    scene: null,
    clock: {
      set(localISO) {
        if (localISO === null) {
          resetClock();
          return;
        }
        const offset = new Date(localISO).getTime() - Date.now();
        setClock({ now: () => new Date(Date.now() + offset) });
      },
      today() {
        const d = clock.now();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      },
    },
    worker: {
      slow: (ms) => setLevelWorker(slowWorker(realWorker, ms)),
      none: () => setLevelWorker(null),
      reset: () => setLevelWorker("default"),
      available: () => hasLevelWorker(),
      failFrom: (n) => {
        if (n === null) {
          levelGen.track = (t: Track, k: number) => levelForTrack(t, k);
          setLevelWorker("default");
          return;
        }
        setLevelWorker(null);
        levelGen.track = (t: Track, k: number) => {
          if (k >= n) throw new Error(`test: ${t} ${k} cannot be generated`);
          return levelForTrack(t, k);
        };
      },
    },
    flush,
    governor,
  };
}

const g = globalThis as unknown as { __test?: TestBridge };

/** The one bridge of this page (created on first use). */
export function bridge(): TestBridge {
  return (g.__test ??= create());
}

/** Session.restore → the live session. */
export function attachSession(s: Session): void {
  bridge().session = s;
}

/** main.ts (agent U): `attach({ game, scene })` after the scene is added. */
export function attach(parts: { game?: unknown; scene?: unknown }): void {
  const b = bridge();
  if (parts.game !== undefined) b.game = parts.game;
  if (parts.scene !== undefined) b.scene = parts.scene;
}
