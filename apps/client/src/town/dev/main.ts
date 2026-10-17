// DEV ONLY harness for the lit street (never part of the app bundle: nothing in
// src/main.ts imports it). Serve with `npx vite --host --port 5180` from apps/client and open
//   /src/town/dev/index.html?town=60&deduce=14&streak=9&covered=1
// (query → devFakeTown, see ../data.ts). A stand-in host scene opens the street at
// once and re-opens it 0.8 s after it is closed. window.__town.open() / .fake({...}) from the console.
// &safeTop=<pt>&safeBottom=<pt> fake the safe area when the browser reports none.
import type PhaserTypes from "phaser";
import Phaser from "../../phaser.ts";
import { devFakeTown } from "../data.ts";
import { openTown } from "../index.ts";

const q = new URLSearchParams(location.search);
const safe = document.getElementById("safe")!;
if (q.has("safeTop")) safe.style.paddingTop = `${Number(q.get("safeTop"))}px`;
if (q.has("safeBottom")) safe.style.paddingBottom = `${Number(q.get("safeBottom"))}px`;

// ?perf=1: mirror the [town] timing lines on screen (simulator Safari has no console here)
if (q.get("perf") === "1") {
  const box = document.createElement("pre");
  box.style.cssText = "position:fixed;left:8px;right:8px;top:60px;margin:0;font:11px ui-monospace,monospace;color:#fff;background:rgba(0,0,0,.55);z-index:9;pointer-events:none;white-space:pre-wrap";
  document.body.appendChild(box);
  for (const k of ["info", "debug"] as const) {
    const orig = console[k].bind(console);
    console[k] = (...a: unknown[]): void => {
      orig(...a);
      const t = a.map(String).join(" ");
      if (t.startsWith("[town]")) box.textContent = `${t}\n${box.textContent ?? ""}`.slice(0, 900);
    };
  }
}

class Host extends Phaser.Scene {
  constructor() {
    super({ key: "host" });
  }
  create(): void {
    const g = this.add.graphics();
    // stand-in for the game scene (canvas renderer: solid fills only)
    g.fillStyle(0x2b2350, 1).fillRect(0, 0, this.scale.width, this.scale.height);
    g.fillStyle(0x231f40, 1).fillRect(0, this.scale.height * 0.55, this.scale.width, this.scale.height * 0.45);
    this.input.on("pointerdown", () => console.info("[host] tap (should not happen while the street is open)"));
    const open = (): void => openTown(this, { onClose: () => setTimeout(open, 800) });
    (window as unknown as { __town: unknown }).__town = { open, fake: devFakeTown };
    open();
  }
}

const parent = document.getElementById("app")!;
const dpr = Math.min(window.devicePixelRatio || 1, 3);
new Phaser.Game({
  type: Phaser.CANVAS,
  parent,
  width: Math.round(parent.clientWidth * dpr),
  height: Math.round(parent.clientHeight * dpr),
  backgroundColor: 0x141a33,
  banner: false,
  audio: { noAudio: true },
  scale: { mode: Phaser.Scale.NONE, zoom: 1 / dpr },
  render: { antialias: true, clearBeforeRender: false },
  input: { activePointers: 1, keyboard: false, gamepad: false },
  disableContextMenu: true,
  scene: [Host as unknown as PhaserTypes.Types.Scenes.SceneType],
});
