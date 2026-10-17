// E2E-only test bridge (loaded by vite.config.ts `--mode e2e` before src/main.ts; never in
// the m0/m1 builds). Prefers the app's own test surface, window.__test (src/testing/bridge.ts:
// the session, the clock, the level worker; game / scene once main.ts attaches them, and the
// scene hooks cellCenter / hudPoints / isIdle once LanternsScene has them — see
// docs/phase2-plan.md "Requests to U"). Fallback for what the app does not expose yet: a
// Phaser.Game.prototype.boot patch keeps the game, and the scene's runtime fields are read
// directly (TypeScript `private` is compile-time only).
import Phaser from "../src/phaser.ts";
import type { TestBridge } from "../src/testing/bridge.ts";
import { fakeBackend } from "../tests/fakes/backend.ts";

type AnyObj = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** The app's window.__test (absent until Session.restore attached it). */
const appTest = (): TestBridge | undefined => (window as unknown as { __test?: TestBridge }).__test;

const games: AnyObj[] = [];
const proto = (Phaser as unknown as { Game: { prototype: AnyObj } }).Game.prototype;
const origBoot = proto["boot"] as (...a: unknown[]) => unknown;
proto["boot"] = function (this: AnyObj, ...a: unknown[]) {
  games.push(this);
  return origBoot.apply(this, a);
};

const bridge = {
  fakes: fakeBackend,
  /** window.__test itself (clock, worker, flush) — undefined before the session restored. */
  get app(): TestBridge | undefined {
    return appTest();
  },
  get game(): AnyObj | undefined {
    return (appTest()?.game as AnyObj | null) ?? games[0];
  },
  get scene(): AnyObj | undefined {
    return (appTest()?.scene as AnyObj | null) ?? games[0]?.["scene"]?.getScene?.("lanterns") ?? undefined;
  },
  get town(): AnyObj | undefined {
    const sm = bridge.game?.["scene"];
    return sm?.keys?.["town"];
  },
  /** The village scene (src/village/VillageScene.ts), while it is open. */
  get village(): AnyObj | undefined {
    return bridge.game?.["scene"]?.keys?.["village"];
  },
  /** Client point of a village hit box (VillageScene.hitPoint). */
  villagePoint(id: string): { x: number; y: number } | null {
    const v = bridge.village;
    const p = v && typeof v["hitPoint"] === "function" ? (v["hitPoint"](id) as { x: number; y: number } | null) : null;
    return p ? bridge.toClient(p.x, p.y) : null;
  },
  /** Gate G3 with the page's real fonts (src/village/g3check.ts). */
  villageG3: () => import("../src/village/g3check.ts"),
  /** the village scene module (drawTracked: letter tracking with / without canvas letterSpacing) */
  villageScene: () => import("../src/village/VillageScene.ts"),
  get session(): AnyObj | undefined {
    return (appTest()?.session as AnyObj | null) ?? bridge.scene?.["deps"]?.["session"];
  },
  /** Scene created, decorated (house/particles in), the first layout done, window.__test attached. */
  ready(): boolean {
    const s = bridge.scene;
    return !!s && s["decorated"] === true && !!s["geo"] && !!appTest()?.session;
  },
  /** No finale / switch / travel / town transition running (scene.isIdle() once U adds it). */
  idle(): boolean {
    const s = bridge.scene;
    if (!s) return false;
    if (typeof s["isIdle"] === "function") return s["isIdle"]() as boolean;
    return !s["finale"] && !s["switching"] && !s["travel"];
  },
  /** The user-facing app name (share text), from the rules. */
  async appName(): Promise<string> {
    return (await bridge.api()).APP_NAME;
  },
  api: () => import("../src/game/pipsApi.ts"),
  /** R2 (A5): the postcard module (the pixel test bakes it in the page's real canvas) */
  postcard: () => import("../src/game/postcard.ts"),
  deepLink: () => import("../src/game/deepLink.ts"),
  resultSheet: () => import("../src/game/ResultSheet.ts"),
  runlog: () => import("../../../core/runlog.ts"),
  rng: () => import("../../../core/rng.ts"),
  /** Canvas pixel → CSS client point (the canvas is zoomed by 1 / dpr and fills #app). */
  toClient(px: number, py: number): { x: number; y: number } {
    const canvas = document.querySelector("#app canvas") as HTMLCanvasElement;
    const r = canvas.getBoundingClientRect();
    return { x: r.left + (px * r.width) / canvas.width, y: r.top + (py * r.height) / canvas.height };
  },
  /** Client point of a board cell's centre (cellAt() inverse). */
  cellPoint(cell: number): { x: number; y: number } {
    const s = bridge.scene!;
    if (typeof s["cellCenter"] === "function") {
      const p = s["cellCenter"](cell) as { x: number; y: number };
      return bridge.toClient(p.x, p.y);
    }
    const g = s["geo"] as AnyObj;
    const lv = bridge.session!["level"] as AnyObj;
    const x0 = g["bcx"] - (g["cs"] * lv["w"]) / 2;
    const y0 = g["bcy"] - (g["cs"] * lv["h"]) / 2;
    return bridge.toClient(x0 + ((cell & 7) + 0.5) * g["cs"], y0 + ((cell >> 3) + 0.5) * g["cs"]);
  },
  /** Client point of a scene object that has x / y in canvas pixels. */
  objPoint(name: "hintBtn" | "undoBtn" | "leftBtn" | "gearIcon" | "todayBtn" | "backChip" | "alley"): { x: number; y: number } {
    const s = bridge.scene!;
    if (typeof s["hudPoints"] === "function") {
      const key = ({ hintBtn: "hint", undoBtn: "undo", leftBtn: "left", gearIcon: "gear", todayBtn: "today", backChip: "back", alley: "alley" } as const)[name];
      const p = (s["hudPoints"]() as Record<string, { x: number; y: number }>)[key];
      if (p) return bridge.toClient(p.x, p.y);
    }
    const o = s[name] as AnyObj;
    return bridge.toClient(o["x"], o["y"]);
  },
  moonPoint(): { x: number; y: number } {
    const m = bridge.scene!["scenery"] as AnyObj;
    return bridge.toClient(m["moonX"], m["moonY"]);
  },
  farPoint(): { x: number; y: number; kind: string } {
    const f = (bridge.scene!["scenery"] as AnyObj)["farTarget"] as AnyObj;
    return { ...bridge.toClient(f["x"], f["y"]), kind: String(f["kind"]) };
  },
  /** Settings sheet segment k (0 soundOn, 1 soundOff, 2 digits, 3 dots, 4 timeOn, 5 timeOff). */
  sheetPoint(k: number): { x: number; y: number } {
    const sh = bridge.scene!["sheet"] as AnyObj;
    if (typeof sh["segmentCenter"] === "function") {
      const p = sh["segmentCenter"](k) as { x: number; y: number };
      return bridge.toClient(p.x, p.y);
    }
    const p = sh["segPos"](k) as { x: number; y: number };
    return bridge.toClient(sh["x0"] + p.x + sh["segW"] / 2, sh["y0"] + p.y + sh["segH"] / 2);
  },
  cardPoint(which: "share" | "home"): { x: number; y: number } {
    const c = bridge.scene!["card"] as AnyObj;
    if (typeof c["buttonCenter"] === "function") {
      const p = c["buttonCenter"](which) as { x: number; y: number };
      return bridge.toClient(p.x, p.y);
    }
    const b = c[which === "share" ? "shareBtn" : "homeBtn"] as AnyObj;
    return bridge.toClient(c["cx"] + b["x"], c["cy"] + b["y"]);
  },
  /** The question card's buttons (reminder ask, start over, ad-break confirm). */
  askPoint(which: "yes" | "no"): { x: number; y: number } {
    const a = bridge.scene!["ask"] as AnyObj;
    const p = a["buttonCenter"](which) as { x: number; y: number };
    return bridge.toClient(p.x, p.y);
  },
  /** The reminder web fake (src/notify): prompts, pending reminders. */
  notifyFake(): { prompts: number; pending: Array<{ id: number; body: string; at: number }>; perm: string } | null {
    const f = (globalThis as unknown as { __notifyFake?: { prompts: number; pending: Array<{ id: number; body: string; at: number }>; perm: string } }).__notifyFake;
    return f ? { prompts: f.prompts, pending: f.pending.map((p) => ({ ...p })), perm: f.perm } : null;
  },
  townHomePoint(): { x: number; y: number } | null {
    const t = bridge.town;
    if (!t || !t["homeBtn"]) return null;
    return bridge.toClient(t["homeBtn"]["x"], t["homeBtn"]["y"]);
  },
  /** Client points of the lit houses fully in view on the street (TownScene.housePoints). */
  townHousePoints(): { n: number; x: number; y: number }[] {
    const t = bridge.town;
    if (!t || typeof t["housePoints"] !== "function") return [];
    return (t["housePoints"]() as { n: number; x: number; y: number }[]).map((h) => ({ n: h.n, ...bridge.toClient(h.x, h.y) }));
  },
  /** The street's keepsake card: house asked / house on screen / generating placeholder. */
  townKeepsake(): { asked: number; shown: number; placeholder: boolean } | null {
    const t = bridge.town;
    return t ? (t["keepsake"] as { asked: number; shown: number; placeholder: boolean }) : null;
  },
  lanterns(): number[] {
    const st = bridge.session!["state"] as AnyObj;
    const out: number[] = [];
    for (let i = 0; i < 64; i++) if ((((i < 32 ? st["lanterns"]["lo"] >>> i : st["lanterns"]["hi"] >>> (i - 32)) as number) & 1) === 1) out.push(i);
    return out;
  },
  /** Solution cells of the current level (pure rules call). */
  async solution(): Promise<number[]> {
    const api = await bridge.api();
    const bb = api.solutionOf(bridge.session!["level"]);
    const out: number[] = [];
    if (!bb) return out;
    for (let i = 0; i < 64; i++) if (((i < 32 ? bb.lo >>> i : bb.hi >>> (i - 32)) & 1) === 1) out.push(i);
    return out;
  },
  file(name: string): string | null {
    return fakeBackend.readText(`LIBRARY/lanternly/${name}`);
  },
  pref(key: string): string | null {
    return fakeBackend.prefs.get(key) ?? null;
  },
  /** The iCloud mirror (src/sync), once started: status, device id. */
  sync(): { status: string; deviceId: string; remoteKeys: string[] } | null {
    const e = (window as unknown as { __sync?: { status: string; deviceId: string; remoteKeys: string[] } }).__sync;
    return e ? { status: e.status, deviceId: e.deviceId, remoteKeys: e.remoteKeys } : null;
  },
};

// ---------------------------------------------------------------- fake iCloud (sync.spec.ts)
// A CloudKV (src/native/cloudkv.ts contract) backed by window.__cloudHost, a Playwright binding
// that several browser contexts ("devices") share. Without the binding (every other spec) there is
// no window.__cloudkv at all: the app sees no plugin and stays local-only, as on the web.
type CloudHost = (op: "getAll" | "set" | "remove", arg?: { key: string; value?: string }) => Promise<unknown>;
type CloudChange = { reason: "server" | "initialSync" | "quota" | "account"; keys: string[] };
const cloudHost = (): CloudHost | undefined => (window as unknown as { __cloudHost?: CloudHost }).__cloudHost;
const cloudListeners: Array<(e: CloudChange) => void> = [];
const fakeCloudKV = {
  async getAll(): Promise<{ available: boolean; values: Record<string, string> }> {
    return { available: true, values: (await cloudHost()!("getAll")) as Record<string, string> };
  },
  async set(o: { key: string; value: string }): Promise<void> {
    await cloudHost()!("set", o);
  },
  async remove(o: { key: string }): Promise<void> {
    await cloudHost()!("remove", o);
  },
  async synchronize(): Promise<{ ok: boolean }> {
    return { ok: true };
  },
  async addListener(_e: "change", cb: (e: CloudChange) => void): Promise<{ remove: () => Promise<void> }> {
    cloudListeners.push(cb);
    // iCloud delivers the account's store shortly after launch
    setTimeout(() => cb({ reason: "initialSync", keys: [] }), 300);
    return { remove: async () => undefined };
  },
  async removeAllListeners(): Promise<void> {
    cloudListeners.length = 0;
  },
};
Object.defineProperty(window, "__cloudkv", { configurable: true, get: () => (cloudHost() ? fakeCloudKV : undefined) });
(window as unknown as { __cloudFire: (e: CloudChange) => void }).__cloudFire = (e) => {
  for (const f of cloudListeners) f(e);
};

(window as unknown as { __e2e: typeof bridge }).__e2e = bridge;
export type E2EBridge = typeof bridge;
