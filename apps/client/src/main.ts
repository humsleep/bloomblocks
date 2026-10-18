// M1 boot. Cold-start path (tap → first interactive frame):
//   module eval → [save restore ‖ Phaser boot] → sky/board bake → board draw → 2 rAF → probe.mark()
// Everything else (house, particles, ads, preferences, app-state listeners, the
// next-level worker) runs after mark(). No web font: the UI is text-free.
import Phaser from "./phaser.ts";
import { App } from "@capacitor/app";
import { Preferences } from "@capacitor/preferences";
import { adsApi } from "./game/adsHooks.ts";
import { governor } from "./game/frameGovernor.ts";
import { loadGuide, loadNumberStyle, loadSessionCount, loadShareTime, noteResume, setAdAudio, setHapticsEnabled, startAudio } from "./game/feedback.ts";
import { LanternsScene, type SafeInsets } from "./game/LanternsScene.ts";
import { localDateISO, markFirstPaint, Session } from "./game/session.ts";
import { markInteractive } from "./native/probe.ts";
import { BG_HEX } from "./render/palette.ts";
import { flush } from "./save/store.ts";

declare const __VARIANT__: string;

function canvasSize(parent: HTMLElement): { w: number; h: number; dpr: number } {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  return { w: Math.round(parent.clientWidth * dpr), h: Math.round(parent.clientHeight * dpr), dpr };
}

/** Safe-area insets (CSS px). index.html's #safe probe resolves max(env(), --safe-*). */
function safeInsets(): SafeInsets {
  const el = document.getElementById("safe");
  if (!el) return { top: 0, bottom: 0, left: 0, right: 0 };
  const cs = getComputedStyle(el);
  const n = (v: string): number => parseFloat(v) || 0;
  return { top: n(cs.paddingTop), bottom: n(cs.paddingBottom), left: n(cs.paddingLeft), right: n(cs.paddingRight) };
}

async function boot(): Promise<void> {
  const parent = document.getElementById("app")!;
  const sessionP = Session.restore(); // file reads start immediately, in parallel with the rest
  // the number style decides the first bake; the guide bits decide the first-run lesson (both tiny Preferences reads)
  const prefsP = Promise.all([loadNumberStyle(), loadGuide(), loadSessionCount()]);
  startAudio(); // arms the first-gesture unlock only; no AudioContext yet
  const { w, h, dpr } = canvasSize(parent);
  const game = new Phaser.Game({
    type: Phaser.CANVAS,
    parent,
    width: w,
    height: h,
    backgroundColor: BG_HEX,
    banner: false,
    audio: { noAudio: true },
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / dpr },
    render: { antialias: true, clearBeforeRender: false },
    input: { activePointers: 1, keyboard: false, gamepad: false },
    disableContextMenu: true,
  });

  const [session] = await Promise.all([sessionP, prefsP]);
  const safe = safeInsets();

  const scene = new LanternsScene();
  game.scene.add("lanterns", scene, true, {
    session,
    dpr,
    safe,
    onInteractive: () => {
      markInteractive(__VARIANT__);
      // L: the level worker starts only after the first presented frame (cold-start gate)
      requestAnimationFrame(() => requestAnimationFrame(() => markFirstPaint()));
      // decorate after the first presented frame (same 2 rAF as the probe)
      requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(afterInteractive, 0)));
    },
    onMove: () => {
      // Ad SDK init is deferred until after the first confirmed move (§3); idempotent.
      adsApi.init();
    },
  });
  // test bridge (DEV / e2e only; tree-shaken from m0 / m1 — L's request)
  if ((import.meta.env.DEV && import.meta.env.MODE !== "test") || import.meta.env.MODE === "e2e") {
    void import("./testing/bridge.ts").then((m) => m.attach({ game, scene }));
  }
  console.info(`[boot] level ${session.levelNumber} (${session.seedKey}): ${session.restoreInfo}`);

  function afterInteractive(): void {
    scene.decorate();
    // idle frame governor: full rate around input / motion, 20 fps ambient, no frames while hidden,
    // backgrounded or under a full-screen ad (playtest/perf/idle-governor.md). After the first
    // presented frame, so the cold-start path is untouched.
    // VITE_IDLE_GOVERNOR=off (build-time, A/B measurements only) keeps Phaser's own 60 fps loop
    if (import.meta.env["VITE_IDLE_GOVERNOR"] !== "off") governor.install(game);
    // Safety net: if the screen or safe-area box ever changes (rotation lock off,
    // split view…), resize the canvas and relayout.
    let last = `${w}x${h}`;
    new ResizeObserver(() => {
      const s = canvasSize(parent);
      if (`${s.w}x${s.h}` === last) return;
      last = `${s.w}x${s.h}`;
      Object.assign(safe, safeInsets());
      game.scale.resize(s.w, s.h);
      game.scale.setZoom(1 / s.dpr);
      scene.layout();
    }).observe(parent);
    // Settings only in Preferences (progress lives in files).
    void Preferences.get({ key: "haptics" }).then((r) => setHapticsEnabled(r.value !== "off"));
    // a full-screen ad is up: the game's audio goes quiet (WKWebView keeps Web Audio playing under it)
    adsApi.onFullscreen((open) => {
      setAdAudio(open);
      if (open) governor.sleep("ad");
      else governor.resume("ad");
    });
    void loadShareTime();
    // Focus loss (notification shade, consent, ads) is not a session end: just
    // drop the half tap, remember when, and skip animations on return.
    let pausedAt = 0;
    void App.addListener("pause", () => {
      pausedAt = Date.now();
      scene.onPause();
      governor.sleep("app");
      void flush();
      void Preferences.set({ key: "lastActiveAt", value: String(Date.now()) });
    });
    void App.addListener("resume", () => {
      if (pausedAt) noteResume(Date.now() - pausedAt);
      pausedAt = 0;
      scene.skipAnimations();
      scene.onResume();
      governor.resume("app");
    });
    // R2 (A5): duskwick://daily/<n> and https://humsleep.github.io/apps/duskwick/<n> open today's daily
    // (src/game/deepLink.ts; the cold-start launch URL is read here too, after the first frame)
    void import("./game/deepLink.ts").then((m) => m.installDeepLinks(scene, localDateISO)).catch((e: unknown) => console.warn("[link]", e));
    if (import.meta.env.DEV) void import("./dev/shot.ts").then((m) => m.devShot(scene, session));
  }
}

window.addEventListener("error", (e) => console.error("[error]", e.message, e.filename, e.lineno));
boot().catch((e: unknown) => console.error("[boot] failed", e instanceof Error ? `${e.message}\n${e.stack}` : String(e)));
