// The lit street, as its own Phaser scene on top of the caller's scene (lazy
// chunk: nothing here is on the cold-start path).
//   layers   backdrop (one baked texture: sky, moon, far hill + deduce tower, mid hill)
//            street chunks (CW-pt strips baked on demand, a pool of 3 reused canvases)
//            live sprites (a few breathing glows: festival lanterns, lamps, newest heart window, stars)
//            UI (grabber pill at the top, home button at the bottom)
//   input    drag sideways = scroll (with momentum); drag down = pull the sheet away;
//            tap home = close.
//   visit    phase 5 (BENCHMARK-UX #4): after gentle 5 / 10 / 15 … the game drops by for ~2.5 s —
//            the street opens on the new lamp / landmark, it lights up (bloom + one Success
//            haptic), and the street closes by itself; a tap anywhere ends it early. Reduce
//            Motion: a still cut, lit at once, 1.2 s. The caller's scene gets no input while the street is open
//            and is hidden (not rendered) once the street covers the screen.
import type PhaserTypes from "phaser";
import Phaser from "../phaser.ts";
import { drawGlow, drawHomeButton, GLOW } from "../render/draw.ts";
import { PAL, rgba, UI } from "../render/palette.ts";
import { vis } from "../render/vis.ts";
import { a11y, type A11yControl } from "../a11y/index.ts";
import { moonPhase, type PipsLevel, trackParams } from "../game/pipsApi.ts";
import { keepsakeLevel, rememberKeepsake } from "../save/keepsakes.ts";
import { ambient } from "../game/frameGovernor.ts";
import { seedKeyFor } from "../game/levelIds.ts";
import type { TownData } from "./data.ts";
import { keepsakeSize, paintKeepsake, paintKeepsakeWaiting } from "./keepsakeBoard.ts";
import { buildStreet, openingScroll, type Street, type StreetHouse, type StreetItem } from "./layout.ts";
import { haptic } from "../game/feedback.ts";
import { makeText, styleText } from "../game/uiText.ts";
import { VISIT_MS, VISIT_REDUCED_MS } from "../game/progress.ts";
import { catTail, heartOf, itemLights, paintBackdrop, paintChunk, paintItemBloom, paintTail, type TowerInfo, townGeom, type TownGeom } from "./paint.ts";

export const TOWN_KEY = "town";
const POOL = 3;
const OPEN_MS = 340;
const CLOSE_MS = 260;
/** drag distance (pt) before a gesture picks an axis */
const SLOP = 8;
/** pull-down distance (fraction of the screen) or speed (pt/ms) that closes */
const CLOSE_FRAC = 0.2;
const CLOSE_V = 0.55;

export interface TownLaunch {
  host: PhaserTypes.Scene;
  onClose: () => void;
  data: TownData;
  t0: number;
  tData: number;
  /** a milestone visit: the item earned by gentle house n lights up, then the street closes */
  visit?: { n: number };
}

interface Chunk {
  idx: number;
  key: string;
  tex: PhaserTypes.Textures.CanvasTexture;
  img: PhaserTypes.GameObjects.Image;
}

interface Glow {
  x: number;
  y: number;
  r: number;
  phase: number;
  /** street-space (scrolls) or screen-space */
  street: boolean;
  amp: number;
}

const reducedMotion = (): boolean => vis.p.reduceMotion;
const N_MOTH = 4;
const N_TAIL = 3;
/** keepsake card on screen: pop in, hold, fade (ms) */
const KEEP_IN = 220;
const KEEP_HOLD = 4200;
const KEEP_OUT = 260;
/** a board still being generated: the breathing placeholder gives up after this long (ms) */
const KEEP_WAIT_MAX = 30_000;
/** lit houses around the view whose boards are generated ahead of a tap (missing from the keepsake file) */
const PREWARM = 6;

function safeInsets(): { top: number; bottom: number } {
  let el = document.getElementById("safe");
  let temp = false;
  if (!el) {
    el = document.createElement("div");
    el.style.cssText =
      "position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)";
    document.body.appendChild(el);
    temp = true;
  }
  const cs = getComputedStyle(el);
  const out = { top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 };
  if (temp) el.remove();
  return out;
}

export class TownScene extends Phaser.Scene {
  private launchData!: TownLaunch;
  private u = 1;
  /** texture px per pt */
  private q = 2;
  private g!: TownGeom;
  private street!: Street;
  private tower!: TowerInfo;
  private backdrop!: PhaserTypes.GameObjects.Image;
  private chunks: Chunk[] = [];
  private glows: Glow[] = [];
  private glowImgs: PhaserTypes.GameObjects.Image[] = [];
  private homeBtn!: PhaserTypes.GameObjects.Image;
  private grabber!: PhaserTypes.GameObjects.Image;
  /** the street's one explanation (what a house is, what the tower is), under the grabber; caption box in pt */
  private caption: PhaserTypes.GameObjects.Text[] = [];
  private captionBox = { x: 0, y: 0, w: 0, h: 0 };
  private keys: string[] = [];
  private scrollX = 0;
  private maxScroll = 0;
  private vx = 0;
  /** sheet offset (pt, ≥ 0 = pulled down) */
  private sheetY = 0;
  private phase: "opening" | "open" | "closing" | "closed" = "opening";
  private phaseT0 = 0;
  private closeFrom = 0;
  private drag: { x0: number; y0: number; axis: "none" | "x" | "y"; sx0: number; samples: { t: number; x: number; y: number }[] } | null = null;
  private hostInput = true;
  private reduced = false;
  private firstFrame = true;
  private tBake = 0;
  private bakes = 0;

  constructor() {
    super({ key: TOWN_KEY });
  }

  init(d: TownLaunch): void {
    this.launchData = d;
  }

  /**
   * A street that cannot be built (e.g. a canvas context refused under iOS memory pressure) must
   * never leave the game behind it without input or the street un-openable: give everything back
   * and remove this scene.
   */
  create(): void {
    try {
      this.build();
    } catch (e) {
      console.warn("[town] failed to build the street", e);
      this.abort();
    }
  }

  private hostTaken = false;

  private abort(): void {
    if (this.phase === "closed") return;
    this.phase = "closed";
    const d = this.launchData;
    this.scale.off("resize", this.onResize, this);
    a11y.setControls("town", []);
    if (this.hostTaken) d.host.input.enabled = this.hostInput;
    this.setHostVisible(true);
    this.scene.setVisible(false);
    const game = this.sys.game;
    const keys = this.keys.slice();
    requestAnimationFrame(() => {
      game.scene.remove(TOWN_KEY);
      for (const k of keys) if (game.textures.exists(k)) game.textures.remove(k);
      d.onClose();
    });
  }

  private build(): void {
    const tc = performance.now();
    const d = this.launchData;
    this.reduced = reducedMotion();
    this.u = Math.min(window.devicePixelRatio || 1, 3);
    this.q = Math.min(this.u, 2); // bake at ≤ 2x like the main scene's backdrop
    const W = this.scale.width / this.u;
    const H = this.scale.height / this.u;
    const safe = safeInsets();
    this.g = townGeom(W, H, safe.top, safe.bottom);
    this.street = buildStreet(d.data.gentle, d.data.festival);
    // a visit: the earned item starts dark (not painted) and lights up once the street is open
    if (d.visit) {
      const its = this.street.items.filter((it) => it.n === d.visit!.n);
      this.visitItem = its.find((it) => it.kind !== "lamp") ?? its[0] ?? null;
      if (this.visitItem) this.visitItem.lit = false;
      this.visitT0 = performance.now();
    }
    const g = this.g;
    const u = this.u;
    const q = this.q;

    // host: no input while the street is open
    this.hostInput = d.host.input.enabled;
    d.host.input.enabled = false;
    this.hostTaken = true;

    // backdrop
    const bk = this.mk("town-backdrop", W * q, H * q, (ctx) => {
      ctx.setTransform(q, 0, 0, q, 0, 0);
      this.tower = paintBackdrop(ctx, g, d.data.deduce, d.data.gentle, moonPhase(d.data.today));
    });
    this.backdrop = this.add.image(0, 0, bk).setOrigin(0, 0).setScale(u / q);

    // chunk pool (canvases reused while scrolling)
    for (let i = 0; i < POOL; i++) {
      const key = `town-chunk-${i}`;
      this.mk(key, g.CW * q, (g.H - g.top) * q, () => undefined);
      const tex = this.textures.get(key) as PhaserTypes.Textures.CanvasTexture;
      const img = this.add.image(0, g.top * u, key).setOrigin(0, 0).setScale(u / q).setVisible(false);
      this.chunks.push({ idx: -1, key, tex, img });
    }

    // live glows
    const glowKey = this.mk("town-glow", 64, 64, (ctx) => drawGlow(ctx, 32, 32, 32, GLOW.halo));
    const starKey = this.mk("town-star", 24, 24, (ctx) => {
      drawGlow(ctx, 12, 12, 12, GLOW.star);
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillRect(11.3, 0, 1.4, 24);
      ctx.fillRect(0, 11.3, 24, 1.4);
    });
    const S = g.S;
    for (const l of this.street.lanterns) if (l.state === "lit") this.glows.push({ x: l.x * S, y: g.yb + l.y * S + 0.03 * S + 0.2 * S * 0.56, r: 0.36 * S, phase: l.x * 3.1, street: true, amp: 0.35 });
    for (const it of this.street.items) for (const p of itemLights(it, S, g.yb)) this.glows.push({ ...p, phase: p.x, street: true, amp: 0.3 });
    if (d.data.gentle > 0) {
      const h = heartOf(this.street.houses[d.data.gentle - 1]!, S, g.yb);
      this.glows.push({ x: h.x, y: h.y, r: h.r * 4, phase: 0, street: true, amp: 0.5 });
    }
    for (const w of this.tower.windows.slice(0, this.tower.lit)) if ((w.x * 7 + w.y) % 5 < 1.2) this.glows.push({ x: w.x, y: w.y, r: w.w * 3, phase: w.y, street: false, amp: 0.4 });
    if (this.tower.beacon) this.glows.push({ ...this.tower.beacon, r: 0.4 * S, phase: 1, street: false, amp: 0.5 });
    // ambient() (../game/frameGovernor.ts): breathing glows, twinkling stars, moths and the cats' slow tail
    // swish read the same at the governor's 20 fps; a scroll still moves the (non-ambient) chunks → full rate
    for (let i = 0; i < 24; i++) this.glowImgs.push(ambient(this.add.image(0, 0, glowKey).setBlendMode(Phaser.BlendModes.ADD).setVisible(false)));
    this.visitGlow = this.add.image(0, 0, glowKey).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    const stars: PhaserTypes.GameObjects.Image[] = [];
    for (let i = 0; i < 6; i++) {
      const sx = ((i * 0.618 + 0.11) % 1) * W;
      const sy = g.safeTop + 20 + ((i * 0.37 + 0.2) % 1) * (g.yb - 2.8 * S - g.safeTop - 20) * 0.7;
      stars.push(ambient(this.add.image(sx * u, sy * u, starKey).setScale((u * (6 + (i % 3) * 3)) / 24).setAlpha(0.6)));
    }
    this.stars = stars;

    // UI: grabber pill (pull down) + home button
    const gw = 40;
    const grab = this.mk(`town-grab@${u}`, gw * u, 5 * u, (ctx, w, h) => {
      ctx.fillStyle = rgba(PAL.moon, 0.45);
      ctx.beginPath();
      ctx.roundRect(0, 0, w, h, h / 2);
      ctx.fill();
    });
    this.grabber = this.add.image((W / 2) * u, (g.safeTop + 10) * u, grab);
    const hb = 56;
    // THE house button (the same glyph as the daily's way home and the result sheet)
    const home = this.mk(`town-home@${u}`, hb * u, hb * u, (ctx, w) => drawHomeButton(ctx, w));
    this.homeBtn = this.add.image((W / 2) * u, (H - g.safeBottom - 40) * u, home);
    // the street has no other words: say once, quietly, what a house and the tower are
    const wrap = (W - 48) * u;
    // below today's moon (paintBackdrop: centre 0.8 W, safeTop + 46), above the tower's top even on an SE
    const capTop = g.safeTop + 74;
    let cy = capTop * u;
    let cw = 0;
    for (const [key, pt, alpha] of [["town.caption", 15, 1], ["town.captionTower", 13, 0.72]] as const) {
      const t = makeText(this, 10).setPosition((W / 2) * u, cy).setAlpha(alpha).setShadow(0, u, "rgba(10,12,30,0.7)", 4 * u).setVisible(true);
      const sz = styleText(t, a11y.t(key), { pt, u, weight: "600", color: UI.caption, wrap, cap: 1.4 });
      cy += sz.h + 4 * u;
      cw = Math.max(cw, sz.w);
      this.caption.push(t);
    }
    this.captionBox = { x: (W * u - cw) / 2 / u, y: capTop, w: cw / u, h: cy / u - capTop };

    // idle life (phase 2): moths around the lamps, the roof cats' tails — off under Reduce Motion
    const moth = this.mk(`town-moth@${u}`, 8 * u, 6 * u, (ctx, w, h) => {
      ctx.fillStyle = "rgba(244,235,208,0.85)";
      ctx.beginPath();
      ctx.ellipse(w * 0.3, h * 0.45, w * 0.26, h * 0.38, -0.4, 0, Math.PI * 2);
      ctx.ellipse(w * 0.7, h * 0.45, w * 0.26, h * 0.38, 0.4, 0, Math.PI * 2);
      ctx.fill();
    });
    for (let i = 0; i < N_MOTH; i++) this.moths.push(ambient(this.add.image(0, 0, moth).setVisible(false)));
    const ts = Math.round(g.S * 0.13);
    const tail = this.mk(`town-tail@${u}`, ts * q, ts * q, (ctx, w, h) => {
      ctx.scale(q, q);
      paintTail(ctx, w / q, h / q, g.S);
    });
    for (let i = 0; i < N_TAIL; i++) this.tails.push(ambient(this.add.image(0, 0, tail).setOrigin(0.1, 0.9).setScale(u / q).setVisible(false)));
    this.tailRoots = this.street.houses.map((h) => catTail(h, S, g.yb)).filter((t): t is { x: number; y: number; s: number } => t !== null);
    this.lampPts = this.street.items.filter((it) => it.kind === "lamp" && it.lit).flatMap((it) => itemLights(it, S, g.yb));
    // the keepsake card (the solved board of a tapped house) + the warm light that breathes on
    // its placeholder while a board is still being generated
    this.keep = this.add.image(0, 0, "__DEFAULT").setVisible(false);
    const keepGlowKey = this.mk("town-keepglow", 64, 64, (ctx) =>
      drawGlow(ctx, 32, 32, 32, [[0, "rgba(255,214,130,0.85)"], [0.4, "rgba(255,190,100,0.34)"], [1, "rgba(255,170,80,0)"]]),
    );
    this.keepGlow = this.add.image(0, 0, keepGlowKey).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);

    // scroll: open with the newest lit house a little left of centre, the dark ones ahead on the right
    this.maxScroll = Math.max(0, this.street.length * S - W);
    this.scrollX = this.clampScroll(this.visitItem ? this.visitItem.x * S - W / 2 : this.openingScroll());
    this.syncChunks(true);
    this.place(0);

    this.input.on("pointerdown", (p: PhaserTypes.Input.Pointer) => this.onDown(p));
    this.input.on("pointermove", (p: PhaserTypes.Input.Pointer) => this.onMove(p));
    this.input.on("pointerup", (p: PhaserTypes.Input.Pointer) => this.onUp(p));
    this.input.on("pointerupoutside", (p: PhaserTypes.Input.Pointer) => this.onUp(p));
    // (removed again in finish / abort: game.scene.remove() destroys the scene without a
    // "shutdown" event, so a shutdown-only cleanup leaked one listener + one dead scene per open)
    this.scale.on("resize", this.onResize, this);
    this.events.once("destroy", () => this.scale.off("resize", this.onResize, this));

    this.phase = "opening";
    this.phaseT0 = performance.now();
    this.sheetY = this.reduced ? 0 : H;
    this.applySheet();
    if (this.visitItem && this.reduced) this.lightVisit(performance.now());
    this.tBake = performance.now() - tc;
  }

  // ------------------------------------------------------------- milestone visit

  private visitItem: StreetItem | null = null;
  private visitT0 = -1;
  private visitLitAt = -1;
  private visitGlow!: PhaserTypes.GameObjects.Image;
  private bloomStep = -1;

  /** Tests: a visit is running (item, lit yet). */
  get visit(): { n: number; kind: string; lit: boolean } | null {
    const it = this.visitItem;
    return it && this.launchData.visit ? { n: it.n, kind: it.kind, lit: it.lit } : null;
  }

  /** The earned item lights: re-bake the chunks it sits in, add its glows, one Success tap. */
  private lightVisit(now: number): void {
    const it = this.visitItem;
    if (!it || it.lit) return;
    it.lit = true;
    this.visitLitAt = now;
    for (const c of this.chunks) if (c.idx >= 0) this.bake(c, c.idx);
    const S = this.g.S;
    for (const p of itemLights(it, S, this.g.yb)) this.glows.push({ ...p, phase: p.x, street: true, amp: 0.3 });
    if (it.kind === "lamp") this.lampPts.push(...itemLights(it, S, this.g.yb));
    haptic.success();
    console.info(`[town] visit: ${it.kind} of house ${it.n} lit`);
  }

  private stepVisit(now: number, sx: number): void {
    if (!this.launchData.visit || this.phase === "closing" || this.phase === "closed") {
      if (this.visitGlow?.visible) this.visitGlow.setVisible(false);
      return;
    }
    const t = now - this.visitT0;
    if (this.visitItem && !this.visitItem.lit && this.phase === "open" && t >= 380) this.lightVisit(now);
    // the bloom: V's paintItemBloom (pool on the cobbles + swelling lights), k = sin(π·t) over
    // 900 ms, baked in 8 steps (one small ADD texture per step, reused)
    const it = this.visitItem;
    if (it && this.visitLitAt > 0 && !this.reduced) {
      const t = (now - this.visitLitAt) / 900;
      if (t < 1) {
        const step = Math.round(Math.sin(Math.PI * t) * 8);
        const g = this.g;
        const S = g.S * it.scale;
        const x0 = it.x * g.S - 2.2 * S;
        const y0 = g.yb - 2.6 * S;
        const w = 4.4 * S;
        const h = 3.3 * S;
        if (step !== this.bloomStep) {
          this.bloomStep = step;
          const q = this.q;
          const name = `town-bloom-${step}`;
          const key = this.textures.exists(name) ? name : this.mk(name, w * q, h * q, (ctx) => {
            ctx.setTransform(q, 0, 0, q, -x0 * q, -y0 * q);
            paintItemBloom(ctx, it, g, step / 8);
          });
          this.visitGlow.setTexture(key).setOrigin(0, 0).setScale(this.u / q).setAlpha(1);
        }
        this.visitGlow.setVisible(step > 0).setPosition((x0 - sx) * this.u, y0 * this.u);
      } else if (this.visitGlow.visible) this.visitGlow.setVisible(false);
    }
    if (t >= (this.reduced ? VISIT_REDUCED_MS : VISIT_MS)) this.close();
  }

  private stars: PhaserTypes.GameObjects.Image[] = [];
  private moths: PhaserTypes.GameObjects.Image[] = [];
  private tails: PhaserTypes.GameObjects.Image[] = [];
  private tailRoots: { x: number; y: number; s: number }[] = [];
  private lampPts: { x: number; y: number; r: number }[] = [];
  private keep!: PhaserTypes.GameObjects.Image;
  private keepT0 = -1e9;
  private keepN = 0;
  private keepX = 0;
  /** roof top of the tapped house (pt): the card floats just above it */
  private keepTop = 0;
  private keepWorker: Worker | null = null;
  private keepAsked = 0;
  /** the card on screen is the placeholder (its board is being generated) */
  private keepWait = false;
  private keepGlow!: PhaserTypes.GameObjects.Image;
  /** boards asked from the worker (tap or prewarm), and the prewarm queue (newest first) */
  private keepPending = new Set<number>();
  private keepQueue: number[] = [];

  /** Create (or replace) a canvas texture and remember it for cleanup. */
  private mk(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): string {
    if (this.textures.exists(key)) this.textures.remove(key);
    const t = this.textures.createCanvas(key, Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h)));
    if (!t) return "__DEFAULT";
    draw(t.getContext(), t.width, t.height);
    t.refresh();
    if (!this.keys.includes(key)) this.keys.push(key);
    return key;
  }

  /**
   * First view: as many lit houses as fit, the newest among them and toward the right, the
   * first dark house peeking in at the right edge (layout.ts openingScroll; scroll for the rest).
   */
  private openingScroll(): number {
    return openingScroll(this.street, this.g.S, this.g.W);
  }

  private clampScroll(x: number): number {
    return Math.max(0, Math.min(this.maxScroll, x));
  }

  /** Make sure the visible chunks are baked; `all` also bakes the one ahead now (else at most one per frame). */
  private syncChunks(all: boolean): void {
    const { CW, W } = this.g;
    const first = Math.floor(this.scrollX / CW);
    const last = Math.floor((this.scrollX + W - 0.001) / CW);
    const ahead = this.vx < -0.01 ? first - 1 : last + 1;
    const want = [first, last, ahead].filter((i, k, a) => i >= 0 && i * CW < this.street.length * this.g.S + CW && a.indexOf(i) === k);
    let budget = all ? 3 : 1;
    for (const idx of want) {
      if (this.chunks.some((c) => c.idx === idx)) continue;
      const visible = idx >= first && idx <= last;
      if (!visible && budget <= 0) continue;
      // reuse the chunk farthest from the view
      const mid = (first + last) / 2;
      const slot = this.chunks.slice().sort((a, b) => (b.idx < 0 ? 1e9 : Math.abs(b.idx - mid)) - (a.idx < 0 ? 1e9 : Math.abs(a.idx - mid)))[0]!;
      if (slot.idx >= first && slot.idx <= last) continue;
      this.bake(slot, idx);
      budget--;
    }
  }

  private bake(c: Chunk, idx: number): void {
    const t0 = performance.now();
    const ctx = c.tex.getContext();
    const q = this.q;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.tex.width, c.tex.height);
    const x0 = idx * this.g.CW;
    ctx.setTransform(q, 0, 0, q, -x0 * q, -this.g.top * q);
    paintChunk(ctx, this.street, this.g, x0, q);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    c.tex.refresh();
    c.idx = idx;
    this.bakes++;
    if (import.meta.env.DEV) console.debug(`[town] chunk ${idx} baked in ${(performance.now() - t0).toFixed(1)} ms`);
  }

  /** Position chunks + live sprites for the current scroll. */
  private place(now: number): void {
    const u = this.u;
    const sx = Math.round(this.scrollX * u) / u;
    for (const c of this.chunks) {
      if (c.idx < 0) continue;
      const x = c.idx * this.g.CW - sx;
      const vis = x < this.g.W && x + this.g.CW > 0;
      c.img.setVisible(vis).setPosition(Math.round(x * u), Math.round(this.g.top * u));
    }
    let k = 0;
    const amp = this.reduced ? 0 : 1;
    for (const gl of this.glows) {
      if (k >= this.glowImgs.length) break;
      const x = gl.street ? gl.x - sx : gl.x;
      if (x < -gl.r || x > this.g.W + gl.r) continue;
      const img = this.glowImgs[k++]!;
      const a = 0.55 + gl.amp * 0.45 * amp * Math.sin(now / 900 + gl.phase);
      img.setVisible(true).setPosition(x * u, gl.y * u).setScale((gl.r * 2 * u) / 64).setAlpha(a);
    }
    for (; k < this.glowImgs.length; k++) this.glowImgs[k]!.setVisible(false);
    if (!this.reduced) this.stars.forEach((s, i) => s.setAlpha(0.35 + 0.35 * Math.sin(now / (700 + i * 130) + i * 2)));
  }

  private applySheet(): void {
    this.cameras.main.setScroll(0, -this.sheetY * this.u);
  }

  private setHostVisible(v: boolean): void {
    const h = this.launchData.host;
    if (h.sys.settings.visible !== v) h.sys.setVisible(v);
  }

  // ------------------------------------------------------------- input

  private onDown(p: PhaserTypes.Input.Pointer): void {
    if (this.phase !== "open" && this.phase !== "opening") return;
    if (this.launchData.visit) {
      // a visit is not something to browse: any touch lights it (if not yet) and goes back
      this.lightVisit(performance.now());
      this.close();
      return;
    }
    this.vx = 0;
    const x = p.x / this.u;
    const y = p.y / this.u;
    this.drag = { x0: x, y0: y, axis: "none", sx0: this.scrollX, samples: [{ t: performance.now(), x, y }] };
  }

  private onMove(p: PhaserTypes.Input.Pointer): void {
    if (this.phase === "closing" || this.phase === "closed") return;
    const d = this.drag;
    if (!d || !p.isDown) return;
    const x = p.x / this.u;
    const y = p.y / this.u;
    const dx = x - d.x0;
    const dy = y - d.y0;
    if (d.axis === "none" && Math.hypot(dx, dy) > SLOP) {
      d.axis = dy > 0 && Math.abs(dy) > Math.abs(dx) * 1.3 ? "y" : "x";
      if (d.axis === "y") this.setHostVisible(true);
    }
    d.samples.push({ t: performance.now(), x, y });
    if (d.samples.length > 6) d.samples.shift();
    if (d.axis === "x") this.scrollX = this.clampScroll(d.sx0 - dx);
    else if (d.axis === "y") {
      this.sheetY = Math.max(0, dy);
      this.applySheet();
    }
  }

  private onUp(p: PhaserTypes.Input.Pointer): void {
    const d = this.drag;
    this.drag = null;
    // a drag released while the street is already closing (e.g. a resize closed it) never reopens it
    if (!d || this.phase === "closing" || this.phase === "closed") return;
    const now = performance.now();
    const s0 = d.samples[0]!;
    const s1 = d.samples[d.samples.length - 1]!;
    const dt = Math.max(1, s1.t - s0.t);
    if (d.axis === "x") {
      this.vx = now - s1.t > 80 ? 0 : -(s1.x - s0.x) / dt; // pt per ms, scroll direction
    } else if (d.axis === "y") {
      const vy = (s1.y - s0.y) / dt;
      if (this.sheetY > this.g.H * CLOSE_FRAC || vy > CLOSE_V) this.close();
      else {
        this.phase = "opening";
        this.phaseT0 = now;
        this.openFrom = this.sheetY;
      }
    } else {
      // tap — in the street's own coordinates: while the sheet is still sliding up (the first
      // 340 ms) everything is drawn `sheetY` lower than at rest, and a tap must hit what is seen
      const x = p.x / this.u;
      const y = p.y / this.u - this.sheetY;
      const hx = this.homeBtn.x / this.u;
      const hy = this.homeBtn.y / this.u;
      if (Math.hypot(x - hx, y - hy) <= 34) {
        this.close();
        return;
      }
      const h = this.houseAt(x, y);
      const showing = this.keepT0 > 0 && now - this.keepT0 < KEEP_IN + KEEP_HOLD;
      if (h && h.n !== this.keepAsked) this.showKeepsake(h); // another house: its card replaces this one
      else if (h && this.keepWait) return; // the same house again while its board is coming: keep waiting
      else if (showing) this.dismissKeep(now); // a tap anywhere else skips the card
      else if (h) this.showKeepsake(h);
    }
    if (d.axis === "x") this.prewarmKeepsakes();
  }

  private openFrom = -1;

  /** The lit house under a point (pt, street coordinates at rest), if any. A little slack around each house. */
  private houseAt(x: number, y: number): StreetHouse | null {
    const g = this.g;
    const sx = x + this.scrollX;
    const pad = 6;
    for (const h of this.street.houses) {
      if (!h.lit) continue;
      const s = g.S * h.scale;
      if (sx >= h.x * g.S - h.spec.left * s - pad && sx <= h.x * g.S + h.spec.right * s + pad && y >= g.yb - h.spec.top * s - pad && y <= g.yb + 0.12 * g.S) return h;
    }
    return null;
  }

  /**
   * Show the board solved at house `h`: from the keepsake file at once (the session remembers
   * every gentle level as it is solved); a house solved before that file existed gets a
   * breathing placeholder card right away while its board is generated in a worker.
   */
  private showKeepsake(h: StreetHouse): void {
    const now = performance.now();
    this.keepAsked = h.n;
    this.keepX = h.x * this.g.S;
    this.keepTop = this.g.yb - h.spec.top * this.g.S * h.scale;
    const level = keepsakeLevel(h.n);
    if (level) {
      this.paintKeep(h.n, level, now);
      return;
    }
    this.paintWaiting(h.n, now);
    this.requestKeep(h.n);
  }

  /** The keepsake worker (lazy); null when this WebView has none. */
  private worker(): Worker | null {
    if (this.keepWorker) return this.keepWorker;
    try {
      this.keepWorker = new Worker(new URL("../game/nextLevel.worker.ts", import.meta.url), { type: "module" });
    } catch (e) {
      console.warn("[town] keepsake worker", e);
      return null;
    }
    this.keepWorker.onmessage = (e: MessageEvent<{ n?: number; level?: PipsLevel; error?: string }>) => this.onKeepLevel(e.data);
    this.keepWorker.onerror = (e) => {
      console.warn("[town] keepsake worker error", e.message);
      this.keepPending.clear();
      if (this.keepWait) this.dismissKeep(performance.now());
    };
    return this.keepWorker;
  }

  private requestKeep(n: number): void {
    if (this.keepPending.has(n)) return;
    const w = this.worker();
    if (!w) {
      if (this.keepWait && this.keepAsked === n) this.dismissKeep(performance.now());
      return;
    }
    this.keepPending.add(n);
    w.postMessage({ track: "gentle", n });
  }

  private onKeepLevel(m: { n?: number; level?: PipsLevel; error?: string }): void {
    const n = m.n ?? 0;
    this.keepPending.delete(n);
    if (this.phase === "closed") return;
    if (m.level) rememberKeepsake(n, m.level);
    else console.warn(`[town] keepsake ${n}: ${m.error ?? "no level"}`);
    if (this.keepWait && this.keepAsked === n) {
      if (m.level) this.paintKeep(n, m.level, performance.now(), true);
      else this.dismissKeep(performance.now());
    }
    this.pumpPrewarm();
  }

  /**
   * Generate, ahead of a tap, the boards of the lit houses around the view that the keepsake
   * file does not have yet (houses solved before it existed) — one at a time, newest first,
   * so a tap's own request waits for at most one board.
   */
  private prewarmKeepsakes(): void {
    if (this.phase === "closing" || this.phase === "closed") return;
    const g = this.g;
    const c = this.scrollX + g.W / 2;
    const near = this.street.houses
      .filter((h) => h.lit && Math.abs(h.x * g.S - c) < g.W * 1.2 && !keepsakeLevel(h.n) && !this.keepPending.has(h.n))
      .sort((a, b) => b.n - a.n)
      .slice(0, PREWARM)
      .map((h) => h.n);
    this.keepQueue = near;
    this.pumpPrewarm();
  }

  private pumpPrewarm(): void {
    if (this.keepPending.size > 0 || this.phase === "closed") return;
    while (this.keepQueue.length > 0) {
      const n = this.keepQueue.shift()!;
      if (keepsakeLevel(n)) continue;
      this.requestKeep(n);
      return;
    }
  }

  private cardMaxW(): number {
    return Math.min(this.g.W * 0.62, 260);
  }

  private paintKeep(n: number, level: PipsLevel, now: number, fromWaiting = false): void {
    const q = this.q;
    const maxW = this.cardMaxW();
    const { w, h } = keepsakeSize(level, maxW);
    const key = this.mk("town-keep", w * q, h * q, (ctx) => paintKeepsake(ctx, level, seedKeyFor("gentle", n), maxW, q));
    this.keep.setTexture(key).setScale(this.u / q);
    this.keepN = n;
    this.keepWait = false;
    // from the placeholder: the card is already up — no second pop, the hold starts now
    this.keepT0 = fromWaiting && this.keep.visible ? now - KEEP_IN : now;
    console.info(`[town] keepsake board of house ${n}${fromWaiting ? " (generated)" : ""}`);
  }

  /** The placeholder: the card's panel and empty board well (same size), a warm light breathing in it. */
  private paintWaiting(n: number, now: number): void {
    const q = this.q;
    const maxW = this.cardMaxW();
    const p = trackParams("gentle", n);
    const { w, h } = keepsakeSize(p, maxW);
    const key = this.mk(`town-keep-wait`, w * q, h * q, (ctx) => paintKeepsakeWaiting(ctx, p.w, p.h, maxW, q));
    this.keep.setTexture(key).setScale(this.u / q);
    this.keepN = n;
    this.keepWait = true;
    this.keepT0 = now;
  }

  /** Fade the card out now (a tap skipped it, or its board could not be made). */
  private dismissKeep(now: number): void {
    if (this.keepT0 < 0) return;
    this.keepWait = false;
    const t = now - this.keepT0;
    if (t < KEEP_IN + KEEP_HOLD) this.keepT0 = now - KEEP_IN - KEEP_HOLD;
  }

  /** The keepsake card: above its house, pops in, holds, fades; a tap anywhere skips it. */
  private stepKeep(now: number, sx: number): void {
    if (this.keepWait && now - this.keepT0 > KEEP_WAIT_MAX) this.dismissKeep(now);
    // while waiting, the hold never runs out (the card stays until its board arrives)
    const t = this.keepWait ? Math.min(now - this.keepT0, KEEP_IN) : now - this.keepT0;
    if (this.keepT0 < 0 || t > KEEP_IN + KEEP_HOLD + KEEP_OUT) {
      if (this.keep.visible) {
        this.keep.setVisible(false);
        this.keepGlow.setVisible(false);
        this.keepAsked = 0;
        this.keepT0 = -1e9;
      }
      return;
    }
    const u = this.u;
    const g = this.g;
    const k = this.reduced ? 1 : Math.min(1, t / KEEP_IN);
    const pop = this.reduced ? 1 : 1 - (1 - k) ** 3;
    const out = Math.max(0, Math.min(1, (t - KEEP_IN - KEEP_HOLD) / KEEP_OUT));
    const hw = (this.keep.displayWidth / u) / 2;
    const x = Math.max(hw + 8, Math.min(g.W - hw - 8, this.keepX - sx));
    const kh = this.keep.displayHeight / u;
    const y = Math.max(g.safeTop + 30 + kh / 2, this.keepTop - 14 - kh / 2) + (1 - pop) * 16;
    const a = (1 - out) * Math.min(1, k * 1.5);
    this.keep.setVisible(true).setPosition(x * u, y * u).setAlpha(a).setScale((this.u / this.q) * (0.85 + 0.15 * pop));
    if (this.keepWait) {
      // a warm light breathes where the board will appear (still under Reduce Motion)
      const br = this.reduced ? 0.9 : 0.65 + 0.35 * (0.5 + 0.5 * Math.sin(now / 520));
      const r = (Math.min(this.keep.displayWidth, this.keep.displayHeight) / u) * (this.reduced ? 0.5 : 0.44 + 0.08 * Math.sin(now / 520));
      this.keepGlow.setVisible(true).setPosition(x * u, y * u).setScale((r * 2 * u) / 64).setAlpha(a * br);
    } else if (this.keepGlow.visible) this.keepGlow.setVisible(false);
  }

  /** Idle life: moths circling the lamps in view, the roof cats' tails swishing now and then. */
  private stepLife(now: number, sx: number): void {
    const u = this.u;
    const W = this.g.W;
    if (this.reduced) {
      for (const m of this.moths) if (m.visible) m.setVisible(false);
    } else {
      let li = 0;
      for (let i = 0; i < N_MOTH; i++) {
        const m = this.moths[i]!;
        // two moths per lamp in view (first visible lamps)
        let p: { x: number; y: number; r: number } | undefined;
        for (; li < this.lampPts.length; li++) {
          const c = this.lampPts[li]!;
          if (c.x - sx > -20 && c.x - sx < W + 20) break;
        }
        p = this.lampPts[li + (i >> 1)];
        if (!p || p.x - sx < -20 || p.x - sx > W + 20) {
          if (m.visible) m.setVisible(false);
          continue;
        }
        const ph = i * 2.3;
        const x = p.x - sx + Math.sin(now / 900 + ph) * p.r * 0.35 + Math.sin(now / 370 + ph) * 3;
        const y = p.y + Math.cos(now / 1300 + ph * 1.7) * p.r * 0.22 + Math.sin(now / 290 + ph) * 2;
        m.setVisible(true).setPosition(x * u, y * u).setScale(1, 0.55 + 0.45 * Math.abs(Math.sin(now / 45 + ph))).setAlpha(0.75);
      }
    }
    let k = 0;
    for (const r of this.tailRoots) {
      if (k >= N_TAIL) break;
      const x = r.x - sx;
      if (x < -20 || x > W + 20) continue;
      const tl = this.tails[k]!;
      // a slow swish every ~5 s (still under Reduce Motion)
      const c = ((now / 5200 + k * 0.37) % 1) * 5200;
      const swish = this.reduced || c > 900 ? 0 : Math.sin((c / 900) * Math.PI * 2) * 0.45;
      tl.setVisible(true).setPosition(x * u, r.y * u).setRotation(swish);
      k++;
    }
    for (; k < N_TAIL; k++) if (this.tails[k]!.visible) this.tails[k]!.setVisible(false);
  }

  close(): void {
    if (this.phase === "closing" || this.phase === "closed") return;
    this.setHostVisible(true);
    this.phase = "closing";
    this.phaseT0 = performance.now();
    this.closeFrom = this.sheetY;
  }

  private onResize(): void {
    // rare (rotation lock off / split view): simplest correct answer is to close
    this.close();
  }

  // ------------------------------------------------------------- frame

  override update(_time: number, delta: number): void {
    if (this.phase === "closed" || !this.street) return; // aborted / finished: waiting for removal
    const now = performance.now();
    if (this.firstFrame) {
      this.firstFrame = false;
      const d = this.launchData;
      requestAnimationFrame(() => {
        const ms = performance.now() - d.t0;
        console.info(`[town] open ${ms.toFixed(0)} ms to first frame (data ${d.tData.toFixed(0)} ms, bake ${this.tBake.toFixed(0)} ms, ${d.data.gentle} houses, ${this.street.lanterns.length} lanterns)`);
        if (import.meta.env.DEV) (window as unknown as { __townOpenMs?: number }).__townOpenMs = ms;
      });
    }
    const H = this.g.H;
    if (this.phase === "opening") {
      const from = this.openFrom >= 0 ? this.openFrom : H;
      const t = this.reduced ? 1 : Math.min(1, (now - this.phaseT0) / (this.openFrom >= 0 ? 220 : OPEN_MS));
      const e = 1 - (1 - t) ** 3;
      this.sheetY = from * (1 - e);
      this.applySheet();
      if (t >= 1) {
        const first = this.openFrom < 0;
        this.phase = "open";
        this.openFrom = -1;
        this.setHostVisible(false);
        if (first && !this.launchData.visit) this.prewarmKeepsakes();
      }
    } else if (this.phase === "closing") {
      const t = this.reduced ? 1 : Math.min(1, (now - this.phaseT0) / CLOSE_MS);
      const e = t * t;
      this.sheetY = this.closeFrom + (H - this.closeFrom) * e;
      this.applySheet();
      if (t >= 1) {
        this.finish();
        return;
      }
    }
    // momentum (iOS-like decay)
    if (!this.drag && Math.abs(this.vx) > 0.005) {
      this.scrollX = this.clampScroll(this.scrollX + this.vx * delta);
      if (this.scrollX <= 0 || this.scrollX >= this.maxScroll) this.vx = 0;
      this.vx *= Math.exp(-delta / 325);
    }
    this.syncChunks(false);
    this.place(now);
    const sx = Math.round(this.scrollX * this.u) / this.u;
    this.stepLife(now, sx);
    this.stepKeep(now, sx);
    this.stepVisit(now, sx);
    this.stepA11y(now);
  }

  private a11yT = 0;
  private a11ySig = "";

  /**
   * VoiceOver: while the street is open the game's HUD and board are cleared from the a11y layer,
   * so the street publishes its own controls — "close" (the house button) and one per lit house in
   * view (its keepsake card). ≤ 4 Hz, pushed only when something changed.
   */
  private stepA11y(now: number): void {
    if (now - this.a11yT < 250) return;
    this.a11yT = now;
    const g = this.g;
    const open = this.phase === "open" || this.phase === "opening";
    const ctl: A11yControl[] = [];
    let sig = "";
    if (open) {
      const hx = this.homeBtn.x / this.u;
      const hy = this.homeBtn.y / this.u + this.sheetY;
      ctl.push({ id: "town-close", label: a11y.t("close"), x: hx - 28, y: hy - 28, w: 56, h: 56, onActivate: () => this.close() });
      const cb = this.captionBox;
      ctl.push({ id: "town-caption", label: `${a11y.t("town.caption")} ${a11y.t("town.captionTower")}`, x: cb.x, y: cb.y + this.sheetY, w: cb.w, h: cb.h, onActivate: () => undefined });
      sig += `c${Math.round(hy)}|`;
      for (const h of this.street.houses) {
        if (!h.lit) continue;
        const s = g.S * h.scale;
        const x0 = h.x * g.S - h.spec.left * s - this.scrollX;
        const x1 = h.x * g.S + h.spec.right * s - this.scrollX;
        if (x1 < 0 || x0 > g.W) continue;
        const y0 = g.yb - h.spec.top * s + this.sheetY;
        ctl.push({
          id: `town-house-${h.n}`, label: a11y.t("town.house", { n: h.n }), x: Math.max(0, x0), y: y0, w: Math.min(g.W, x1) - Math.max(0, x0), h: g.yb + this.sheetY - y0,
          onActivate: () => this.showKeepsake(h),
        });
        sig += `${h.n}:${Math.round(x0)},${Math.round(y0)}|`;
      }
    }
    if (sig === this.a11ySig) return;
    this.a11ySig = sig;
    a11y.setControls("town", ctl);
  }

  private finish(): void {
    if (this.phase === "closed") return;
    this.phase = "closed";
    const d = this.launchData;
    this.setHostVisible(true);
    const keys = this.keys.slice();
    const game = this.sys.game;
    this.keepWorker?.terminate();
    this.keepWorker = null;
    this.scale.off("resize", this.onResize, this);
    a11y.setControls("town", []);
    // give the host its input back on the next frame (the closing tap must not reach it)
    requestAnimationFrame(() => {
      d.host.input.enabled = this.hostInput;
      game.scene.remove(TOWN_KEY);
      for (const k of keys) if (game.textures.exists(k)) game.textures.remove(k);
      d.onClose();
    });
    this.scene.setVisible(false);
  }

  /** DEV: how many chunk bakes so far (scroll test). */
  get bakeCount(): number {
    return this.bakes;
  }

  /**
   * Tests / a11y: canvas-px centres of the lit houses fully in view, where they are on screen
   * right now (the sheet may still be sliding up: its offset is included).
   */
  housePoints(): { n: number; x: number; y: number }[] {
    const g = this.g;
    if (!g || this.phase === "closing" || this.phase === "closed") return [];
    const out: { n: number; x: number; y: number }[] = [];
    for (const h of this.street.houses) {
      if (!h.lit) continue;
      const s = g.S * h.scale;
      const x = h.x * g.S - this.scrollX;
      const y = g.yb - h.spec.bodyH * s * 0.5 + this.sheetY;
      if (x - h.spec.left * s < 0 || x + h.spec.right * s > g.W || y > g.H - g.safeBottom - 80) continue;
      out.push({ n: h.n, x: x * this.u, y: y * this.u });
    }
    return out;
  }

  /** Tests: the keepsake card — which house was asked, which one is on screen ("placeholder" while it is generated). */
  get keepsake(): { asked: number; shown: number; placeholder: boolean } {
    const up = this.keepT0 > 0;
    return { asked: this.keepAsked, shown: up && !this.keepWait ? this.keepN : 0, placeholder: up && this.keepWait };
  }
}

/**
 * Add the town scene on top of `host`. openTown (./index.ts) never calls this while a street is
 * open, so a scene still registered here is a stale one (a failed / interrupted open): it is
 * removed — silently returning would leave the caller waiting for an onClose that never comes.
 */
export function launchTown(l: TownLaunch): void {
  const game = l.host.sys.game;
  if (game.scene.keys[TOWN_KEY]) {
    console.warn("[town] a stale street scene was replaced");
    game.scene.remove(TOWN_KEY);
  }
  game.scene.add(TOWN_KEY, new TownScene(), true, l);
}
