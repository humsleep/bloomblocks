// The courtyard: baked flagstones + rocks, and live light on top of them.
// All per-cell animation runs in typed arrays stepped from the scene's update
// (no tweens, no per-frame allocation); skip = jump every channel to its target.
// v9 light model (src/render/court.ts): the dark courtyard is one baked texture; a second bake
// holds the same slabs under full lantern light ("lit floor", one frame per cell). A lit cell
// shows its lit-floor frame (normal), times a falloff (multiply) along its lantern's ray, under a
// soft warm bloom (ADD); every lantern adds a flickering pool; stones a ray stops at get a warm
// rim on the side facing the lantern. Per frame only alpha / position / scale change.
import Phaser from "../phaser.ts";
import type PhaserTypes from "phaser";
import { drawNumberedRock, drawRock } from "../render/draw.ts";
import { bloomA, DIR_ROT, groutOf, paintCourtyard, paintLightStill, paintLitFloor, planLight, rimA, type CourtFrame, type CourtGeom, type LightStamps } from "../render/court.ts";
import { PAL } from "../render/palette.ts";
import { hashStr, rng } from "../render/rng.ts";
import { vis } from "../render/vis.ts";
import type { NumberStyle, TextureBank } from "../render/textures.ts";
import { sceneryOf } from "./Scenery.ts";
import { clamp01, easeInCubic, easeOutBack, easeOutCubic, lerp, motion, spreadDelay } from "./motion.ts";
import { hasBit, index, NO_CLUE, type PipsLevel, raysOf, type StoneStatus } from "./pipsApi.ts";
import { ambient, governor } from "./frameGovernor.ts";
import { lanternGeom } from "../render/lantern.ts";
import type { FaceExpr } from "../render/wick.ts";

/** A stuck dark cell as drawn: crossed-out sparkle on the cell, threads to what blocks it. */
export interface BlockedView {
  cell: number;
  /** full stones to thread to (only when 'stone' is a cause) */
  stones: readonly number[];
  /** the player's lanterns whose light covers the cell's candidates (only when 'light' is a cause) */
  lanterns: readonly number[];
  /** per lanterns[k], the candidate cell the thread bends through */
  via: readonly number[];
  /** true: lanterns[] is the one culprit (bright thread, tilt + flicker + cool rim); false: faint threads only */
  strong: boolean;
}

/** A number that can no longer reach its count (⊘): stuck mark on its shoulder, thread to the culprit (or none). */
export interface StuckStoneView {
  stone: number;
  /** the culprit lantern, -1 = none (marker only) */
  lantern: number;
  /** the stone's side cell the culprit's light covers (thread bends there), -1 = straight */
  via: number;
  /** faint thread (a stuck cell already carries the bright one) */
  faint: boolean;
}

/** What a remove hint points at (why the lantern goes back): a broken number, a stuck cell or the lantern it sees. */
export interface WhyView {
  target: number;
  kind: "stone" | "cell" | "lantern";
}

export type BoardFrame = "track" | "daily" | "deduce";

/** The scenery side of the finale (Scenery implements it). */
export interface FinaleScenery {
  playFinale(o: { now: number; reduced?: boolean | undefined; camera?: boolean | undefined; nextNumber?: number | undefined; kind?: string | undefined }): number;
  finaleDone(now: number): boolean;
  skipFinale(now: number): void;
}

/** board.playFinale options (phase 5 #6; U calls it once the last light has spread). */
export interface FinaleOpts {
  /** scene clock (this.time.now) */
  now: number;
  /** wave origin: the last placed lantern's cell */
  origin: number;
  /** windows / camera push / sky warmth / village light / plate flip */
  scenery?: FinaleScenery;
  /** default: motion.reduced */
  reduced?: boolean;
  /** false = no camera push (e.g. the daily's result sheet needs a still frame) */
  camera?: boolean;
  /** the plate turns to this number at +1.2 s (gentle / deduce: the next level) */
  nextNumber?: number;
  /** skip the board wave (the caller already played it) */
  noWave?: boolean;
  /** "level" (default, ≈ 2.6 s) · "alley" (10th of a block: 1.5× longer, roof glow) · "daily" (no camera push) */
  kind?: "level" | "alley" | "daily";
}

/** What the view needs of a board state (PipsState satisfies it). */
export interface BoardState {
  readonly w: number;
  readonly h: number;
  readonly stones: { lo: number; hi: number };
  readonly lanterns: { lo: number; hi: number };
}

type Image = PhaserTypes.GameObjects.Image;
const ADD = Phaser.BlendModes.ADD;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Per-cell animated scalar (64 cells). kind 0 = ease-out, 1 = back-out (bloom), 2 = pulse (0→1→0). */
class Chan {
  readonly val = new Float32Array(64);
  private readonly from = new Float32Array(64);
  private readonly to = new Float32Array(64);
  private readonly t0 = new Float64Array(64);
  private readonly dur = new Float32Array(64);
  private readonly kind = new Uint8Array(64);
  private readonly live = new Uint8Array(64);
  active = 0;

  set(i: number, to: number, now: number, delay: number, dur: number, kind = 0): void {
    if (kind !== 2 && this.live[i] === 0 && this.val[i] === to) return;
    this.from[i] = this.val[i]!;
    this.to[i] = to;
    this.t0[i] = now + delay;
    this.dur[i] = Math.max(1, dur);
    this.kind[i] = kind;
    if (this.live[i] === 0) this.active++;
    this.live[i] = 1;
  }

  /** Where cell i is heading (its value once running animations finish). */
  goal(i: number): number {
    return this.live[i] === 1 && this.kind[i] !== 2 ? this.to[i]! : this.val[i]!;
  }

  jump(i: number, v: number): void {
    if (this.live[i] === 1) this.active--;
    this.live[i] = 0;
    this.val[i] = v;
  }

  /** Finish everything now. */
  settle(): void {
    for (let i = 0; i < 64; i++) if (this.live[i] === 1) this.jump(i, this.kind[i] === 2 ? 0 : this.to[i]!);
  }

  step(now: number): void {
    if (this.active === 0) return;
    for (let i = 0; i < 64; i++) {
      if (this.live[i] === 0) continue;
      const t = (now - this.t0[i]!) / this.dur[i]!;
      if (t <= 0) continue;
      const k = this.kind[i]!;
      if (t >= 1) {
        this.jump(i, k === 2 ? 0 : this.to[i]!);
        continue;
      }
      if (k === 2) this.val[i] = Math.sin(Math.PI * t);
      else this.val[i] = lerp(this.from[i]!, this.to[i]!, k === 1 ? easeOutBack(t) : easeOutCubic(t));
    }
  }
}

const enum Mode {
  Idle,
  FlyIn,
  Rest,
  Leave,
}

class Rig {
  mode = Mode.Idle;
  cell = -1;
  t0 = 0;
  landT = -1e9;
  fx = 0;
  fy = 0;
  fs = 1;
  tx = 0;
  ty = 0;
  ts = 1;
  phase = 0;
  moon = false;
  conflict = false;
  /** hint: this lantern is not part of the answer (lifts, strong cool halo, arrow) */
  wrong = false;
  wrongT0 = 0;
  /** next to an over-full stone: faint coral rim */
  overAdj = false;
  /** stuck read-out: this lantern's light blocks a dark cell (tilt, flicker, cool rim) */
  blame = false;
  blameT0 = 0;
  /** conflict arrival shake */
  shakeT0 = -1e9;
  /** which texture the rim image carries now: 0 none, 1 cool, 2 coral */
  rimKind = 0;
  /** leave by lifting up and fading (no basket to fly back to) */
  fade = false;
  onArrive: (() => void) | null = null;
  /** v12 (Wick, A4): the face painted on the paper (null until the view makes one) */
  face: Image | null = null;
  constructor(
    readonly halo: Image,
    readonly body: Image,
    readonly flame: Image,
    readonly ring: Image,
    readonly cool: Image,
    readonly shadow: Image,
  ) {}
  hide(): void {
    this.mode = Mode.Idle;
    this.cell = -1;
    this.wrong = false;
    this.overAdj = false;
    this.blame = false;
    this.shakeT0 = -1e9;
    this.rimKind = 0;
    this.cool.setVisible(false);
    this.body.setRotation(0).setAlpha(1);
    this.ring.setVisible(false);
    this.halo.setVisible(false);
    this.body.setVisible(false);
    this.flame.setVisible(false);
    this.shadow.setVisible(false);
    this.face?.setVisible(false);
  }
}

export interface BoardGeom {
  cs: number;
  gap: number;
  pad: number;
  u: number;
}

export interface SyncResult {
  /** ms offsets (from now) at which newly lit cells light up, ascending */
  litTimes: number[];
  newlyLit: number;
  darkCells: number[];
  litFloor: number;
  floorCount: number;
  conflictPairs: number;
  /** the placed lantern now sees another lantern */
  invalid: boolean;
  /** ms until the placed/removed lantern's light has finished changing */
  settleMs: number;
}

export interface FlightEnds {
  /** where a placed lantern comes from / a removed one goes, board-local px, and its scale there */
  x: number;
  y: number;
  scale: number;
  /** fade out on the way (removal without a basket) */
  fade?: boolean;
  onArrive?: () => void;
}

const STONE_POOL = 24;
const RIM_POOL = 40;
const MULTIPLY = Phaser.BlendModes.MULTIPLY;
/**
 * Marks on a numbered rock stay outside the digit's box (phase 2, audit P0-1). The digit is
 * ≈ 0.33 × 0.43 cell around (0, -0.025); with its arrival pulse (× 1.28) ≈ ±0.21 × ±0.3.
 */
const STONE_MARK_DX = 0.4;
const STONE_MARK_DY = 0.4;
const STONE_MARK_S = 0.5;
/** "Too many" tag: 0.3 cell tall (0.525 wide), above-right of the digit. */
const OVER_TAG_H = 0.3;
const OVER_TAG_DX = 0.3;
const OVER_TAG_DY = 0.46;
const enum Hint {
  None,
  Ghost,
}

export class BoardView {
  readonly root: PhaserTypes.GameObjects.Container;
  private base: Image;
  /** lit-floor frame per cell (normal blend) */
  private lit: Image[] = [];
  /** falloff along the ray per cell (multiply) */
  private fall: Image[] = [];
  /** warm haze per lit cell (ADD) */
  private glow: Image[] = [];
  private dbl: Image[] = [];
  private dark: Image[] = [];
  /** light plan: d (−1 dark, 0 lantern, k steps), the way the light travels, stone rims */
  private planD = new Int8Array(64);
  private planDir = new Int8Array(64);
  private planRim = new Int8Array(256);
  /** guide preview: a hypothetical lantern's ray step / direction per cell */
  private prevD = new Int8Array(64).fill(-1);
  private prevDir = new Int8Array(64);
  /** which falloff each cell shows now (d·4 + dir), −1 none */
  private fallSig = new Int16Array(64).fill(-1);
  private litKey = "";
  /** the lit floor is baked lazily (first light, or shortly after the first frame): cold start */
  private litReady = false;
  private litJob: { cg: CourtGeom; seed: string; m: number; isFloor: (c: number, r: number) => boolean } | null = null;
  private litTimer: PhaserTypes.Time.TimerEvent | null = null;
  /** static light composite (base + light, one image) shown whenever nothing animates */
  private comp: Image;
  private compKey = "";
  private compDirty = true;
  private compOn = false;
  private baseGeom = { gx: 0, gy: 0, cw: 1, ch: 1, m: 0 };
  private fallK = 1;
  private bloomK = 1;
  private poolK = 1;
  /** rim lights: pooled ADD images, fed by the light of the cell before the stone on that ray */
  private rims: Image[] = [];
  private rimFeed = new Int16Array(RIM_POOL).fill(-1);
  private rimA = new Float32Array(RIM_POOL);
  private rimN = 0;
  private ring: Image;
  // numbered stones: pip overlays + status sprites, pooled (slot k ↔ stoneCell[k])
  private pipImg: Image[] = [];
  private pipWarm: Image[] = [];
  private pipOver: Image[] = [];
  private overMk: Image[] = [];
  private veil: Image[] = [];
  private outline: Image[] = [];
  private stoneCell: number[] = [];
  private stoneSlot = new Int8Array(64).fill(-1);
  private SOk = new Chan();
  private SOver = new Chan();
  private SBlk = new Chan();
  private overT0 = new Float64Array(64);
  /** guide preview: a number shown "too many" (the 0-rock lesson) */
  private prevOver = new Float32Array(64);
  /** cells next to an over-full stone (their lanterns get a faint cool rim) */
  private overNbr = new Uint8Array(64);
  private pipY = 0;
  private numStyle: NumberStyle = "digits";
  private level: PipsLevel | null = null;
  // stuck dark cells: crossed-out sparkle + moonlight threads to the blockers + one ping on them
  private blk: Image[] = [];
  private blkOn = new Uint8Array(64);
  private BRing = new Chan();
  private threadG: PhaserTypes.GameObjects.Graphics;
  /** each thread = the cells it passes (stuck cell first); `lan` = it ends on a lantern */
  private threads: { cells: number[]; lan: boolean; faint: boolean }[] = [];
  private threadT0 = 0;
  private threadA = new Chan();
  private threadDrawnAt = -1;
  private pings: Image[] = [];
  private pingT0 = new Float64Array(8).fill(-1e9);
  private pingStone = new Int8Array(8).fill(-1);
  // guide previews (onboarding): light preview per cell, gold preview per stone
  private P = new Chan();
  private prevOk = new Float32Array(64);
  // remove hint (round 5): the lantern dims and sinks a little, a coral take-back curl beside it,
  // and a coral thread with an arrow head to what it breaks (number / stuck cell / the lantern it sees)
  private takeBack: Image;
  private whyG: PhaserTypes.GameObjects.Graphics;
  private whyRing: Image;
  private why: WhyView | null = null;
  private wrongCell = -1;
  private wrongT0 = 0;
  // conflicts: a coral ✕ between two lanterns that see each other
  private xs: Image[] = [];
  private xKeys = { far: "__DEFAULT", near: "__DEFAULT" };
  private frame: BoardFrame = "track";
  // hint: ghost lantern + anchor ring
  private ghostImg: Image;
  private anchorRing: Image;
  private hintMode = Hint.None as Hint;
  private ghostCell = -1;
  private anchorCell = -1;
  private hintT0 = 0;
  private lines: PhaserTypes.GameObjects.Graphics;
  private rigs: Rig[] = [];
  private rigLayer: { halo: PhaserTypes.GameObjects.Container; shadow: PhaserTypes.GameObjects.Container; body: PhaserTypes.GameObjects.Container; flame: PhaserTypes.GameObjects.Container; face: PhaserTypes.GameObjects.Container };
  /**
   * v12 (Wick, decision A4): every placed lantern has a face on its paper (idle; worried when it
   * sees another lantern, looking at it; happy in a wave when the board is solved; sleepy when the
   * game dozes). Off until setFaces(true) — the scene turns it on after the first frame (the face
   * textures are baked on first use, never on the boot path) and the Settings switch turns it off.
   */
  private faces = false;
  private faceW = 0;
  private doze = false;
  /** per cell: when its face turns happy (the solve wave), 1e12 = not solved */
  private happyAt = new Float64Array(64).fill(1e12);
  private blinkRig: Rig | null = null;
  private blinkT0 = -1e9;
  private nextBlink = 0;

  private L = new Chan();
  private D = new Chan();
  private W = new Chan();
  private counts = new Uint8Array(64);
  private prevCounts = new Uint8Array(64);
  private geom: BoardGeom = { cs: 1, gap: 1, pad: 0, u: 1 };
  private w = 5;
  private h = 5;
  private stones = { lo: 0, hi: 0 };
  private baseKey = "";
  private texKeys = { lantern: "", flame: "", flameMoon: "", halo: "", ring: "", cool: "", coral: "", shadow: "" };
  /** lantern cells in placement order (the completion melody) */
  private order: number[] = [];
  private darkCells: number[] = [];
  private ringT0 = -1e9;
  private pairs: number[] = [];
  private linesT0 = 0;
  private stateRef: BoardState | null = null;
  // finale (playFinale): bloom swell + pool swell, resolved from update()
  private finT0 = -1e9;
  private finEnd = -1e9;
  private finReduced = false;
  private finResolve: (() => void) | null = null;
  private finScenery: FinaleScenery | null = null;
  private glowBoost = 1;
  /**
   * v11 (NOVICE-TEST C6 / D14): ONE error is emphasised at a time — the scene names it; the other
   * kind's marks rest at half strength ("conflict": the ✕ leads, an over-full number dims; "over":
   * the other way round; null: both as they are).
   */
  private focus: "conflict" | "over" | null = null;

  constructor(
    private readonly scene: PhaserTypes.Scene,
    private readonly bank: TextureBank,
  ) {
    const s = scene;
    // Phaser probes "new" canvas blend modes asynchronously (an image onload) and the renderer
    // copies the table before it answers, so MULTIPLY can fall back to source-over. Every
    // WebKit / Chromium we ship on has canvas 'multiply' (the v9 light falloff needs it).
    const rend = scene.sys.game.renderer as unknown as { blendModes?: string[] };
    if (Array.isArray(rend.blendModes)) rend.blendModes[MULTIPLY] = "multiply";
    this.root = s.add.container(0, 0);
    this.base = s.add.image(0, 0, "__DEFAULT");
    this.comp = s.add.image(0, 0, "__DEFAULT").setVisible(false);
    this.root.add([this.base, this.comp]);
    for (let i = 0; i < 64; i++) {
      this.lit.push(s.add.image(0, 0, "__DEFAULT").setVisible(false));
      this.fall.push(s.add.image(0, 0, "__DEFAULT").setVisible(false).setBlendMode(MULTIPLY));
      this.glow.push(s.add.image(0, 0, "__DEFAULT").setVisible(false).setBlendMode(ADD));
      this.dbl.push(s.add.image(0, 0, "__DEFAULT").setVisible(false).setBlendMode(ADD));
    }
    this.root.add(this.lit);
    this.root.add(this.fall);
    this.root.add(this.glow);
    this.root.add(this.dbl);
    for (let k = 0; k < RIM_POOL; k++) this.rims.push(s.add.image(0, 0, "__DEFAULT").setVisible(false).setBlendMode(ADD));
    this.root.add(this.rims);
    // ambient(): slow breathes (near-complete cells, stuck marks, veils, warm digits, ✕, threads, the
    // hint ghost's bob) read the same at the governor's 20 fps; their pops / shakes move non-ambient objects
    for (let i = 0; i < 2; i++) this.dark.push(ambient(s.add.image(0, 0, "__DEFAULT").setVisible(false)));
    this.root.add(this.dark);
    for (let i = 0; i < 64; i++) this.blk.push(ambient(s.add.image(0, 0, "__DEFAULT").setVisible(false)));
    this.root.add(this.blk);
    for (let k = 0; k < STONE_POOL; k++) {
      this.veil.push(ambient(s.add.image(0, 0, "__DEFAULT").setVisible(false)));
      this.outline.push(s.add.image(0, 0, "__DEFAULT").setVisible(false));
      this.pipImg.push(s.add.image(0, 0, "__DEFAULT").setVisible(false));
      this.pipWarm.push(ambient(s.add.image(0, 0, "__DEFAULT").setVisible(false)));
      this.pipOver.push(s.add.image(0, 0, "__DEFAULT").setVisible(false));
      this.overMk.push(ambient(s.add.image(0, 0, "__DEFAULT").setVisible(false)));
    }
    this.root.add(this.veil);
    this.root.add(this.outline);
    this.root.add(this.pipImg);
    this.root.add(this.pipWarm);
    this.root.add(this.pipOver);
    this.root.add(this.overMk);
    this.lines = s.add.graphics();
    this.root.add(this.lines);
    this.threadG = ambient(s.add.graphics().setVisible(false));
    this.root.add(this.threadG);
    for (let k = 0; k < 8; k++) this.pings.push(s.add.image(0, 0, "__DEFAULT").setVisible(false));
    this.root.add(this.pings);
    this.whyG = s.add.graphics().setVisible(false);
    this.whyRing = s.add.image(0, 0, "__DEFAULT").setVisible(false);
    this.root.add([this.whyG, this.whyRing]);
    this.rigLayer = { halo: s.add.container(0, 0), shadow: s.add.container(0, 0), body: s.add.container(0, 0), flame: s.add.container(0, 0), face: s.add.container(0, 0) };
    // conflict ✕ between the halos and the lantern bodies: on two neighbouring lanterns it sits on
    // their shared edge, and the bodies stay whole on top of it (phase 2b)
    for (let k = 0; k < 8; k++) this.xs.push(ambient(s.add.image(0, 0, "__DEFAULT").setVisible(false)));
    this.root.add([this.rigLayer.halo, this.rigLayer.shadow, ...this.xs, this.rigLayer.body, this.rigLayer.flame, this.rigLayer.face]);
    this.takeBack = s.add.image(0, 0, "__DEFAULT").setVisible(false);
    this.ghostImg = ambient(s.add.image(0, 0, "__DEFAULT").setOrigin(0.5, 0.56).setVisible(false));
    this.anchorRing = ambient(s.add.image(0, 0, "__DEFAULT").setVisible(false));
    for (let k = 0; k < 24; k++) {
      // ambient: the pool (halo), the breathing flame, the moon ring and the cool / coral rim; the
      // body (and its contact shadow) carries every real move (fly-in, leave, take-back)
      const r = new Rig(
        ambient(s.add.image(0, 0, "__DEFAULT").setBlendMode(ADD).setVisible(false)),
        s.add.image(0, 0, "__DEFAULT").setOrigin(0.5, 0.56).setVisible(false),
        ambient(s.add.image(0, 0, "__DEFAULT").setBlendMode(ADD).setVisible(false)),
        ambient(s.add.image(0, 0, "__DEFAULT").setVisible(false)),
        ambient(s.add.image(0, 0, "__DEFAULT").setVisible(false)),
        s.add.image(0, 0, "__DEFAULT").setVisible(false),
      );
      r.phase = k * 1.37;
      this.rigLayer.shadow.add(r.shadow);
      this.rigLayer.halo.add(r.cool);
      this.rigLayer.halo.add(r.halo);
      this.rigLayer.halo.add(r.ring);
      this.rigLayer.body.add(r.body);
      this.rigLayer.flame.add(r.flame);
      // ambient(): a face follows its body (whose real moves keep full rate); blinks are texture swaps
      r.face = ambient(s.add.image(0, 0, "__DEFAULT").setVisible(false));
      this.rigLayer.face.add(r.face);
      this.rigs.push(r);
    }
    this.ring = s.add.image(0, 0, "__DEFAULT").setVisible(false);
    this.root.add(this.ring);
    this.root.add([this.anchorRing, this.ghostImg, this.takeBack]);
  }

  get cellSize(): number {
    return this.geom.cs;
  }
  get boardW(): number {
    return this.w * this.geom.cs;
  }
  get boardH(): number {
    return this.h * this.geom.cs;
  }
  /** Lantern body height on the board, px. */
  get lanternH(): number {
    // v9: the framed lantern (icon shape) stands 0.92 cell tall; its handle rises above the cell
    return Math.round(this.geom.cs * 0.92);
  }

  cx(i: number): number {
    return -this.boardW / 2 + ((i & 7) + 0.5) * this.geom.cs;
  }
  cy(i: number): number {
    return -this.boardH / 2 + ((i >> 3) + 0.5) * this.geom.cs;
  }

  /** The cell under a world point (the board root's transform applied), or -1 off the board. */
  cellAtWorld(x: number, y: number): number {
    const r = this.root;
    const lx = (x - r.x) / r.scaleX + this.boardW / 2;
    const ly = (y - r.y) / r.scaleY + this.boardH / 2;
    const c = Math.floor(lx / this.geom.cs);
    const rr = Math.floor(ly / this.geom.cs);
    return c >= 0 && rr >= 0 && c < this.w && rr < this.h ? index(c, rr) : -1;
  }

  /** A numbered rock (its digit must never be covered by a guide finger). */
  isNumber(cell: number): boolean {
    const lv = this.level;
    if (!lv || cell < 0) return false;
    return hasBit(lv.stones, cell) && lv.clues[cell] !== NO_CLUE;
  }

  get gridW(): number {
    return this.w;
  }
  get gridH(): number {
    return this.h;
  }

  /**
   * New level (or new size). Bakes the floor + rocks (numbered ones with their
   * empty slate inlay) into one texture; pips are live overlays.
   */
  build(level: PipsLevel, seedKey: string, geom: BoardGeom, numStyle: NumberStyle, frame: BoardFrame = "track"): void {
    this.geom = geom;
    this.frame = frame;
    this.level = level;
    this.numStyle = numStyle;
    this.w = level.w;
    this.h = level.h;
    this.stones = level.stones;
    const { cs, gap, pad, u } = geom;
    // v9 courtyard: a low stone wall in the ground instead of a card. The wall may reach a little
    // past the layout's pad into the side gutter, keeping ≥ 6 pt to the screen edge (SE 8×8).
    const sw = this.scene.scale.width;
    const bulge = 2.5 * u; // single wall stones push out up to this (irregular edge)
    const ext = Math.max(0, Math.min(9 * u, (sw - this.boardW - pad * 2) / 2 - 6 * u - bulge));
    const wall = pad + ext;
    const face = Math.max(3 * u, cs * 0.06);
    const sp = Math.round(26 * u); // room for the cast shadow + the ground vignette
    const gx = Math.round(wall + sp);
    const gy = Math.round(wall + sp);
    const cw = Math.ceil(this.boardW + gx * 2);
    const ch = Math.ceil(this.boardH + gy * 2 + face);
    const isFloor = (c: number, rr: number): boolean => !hasBit(level.stones, index(c, rr));
    const court: CourtFrame = frame === "daily" ? "daily" : frame === "deduce" ? "deduce" : "track";
    const cg = { cw, ch, gx, gy, cols: this.w, rows: this.h, cs, gap, wall, face, u, bulge, vig: 22 * u };
    const key = `board:${seedKey}@${cs}:${court}:${Math.round(ext)}`;
    if (this.baseKey && this.baseKey !== key) this.bank.remove(this.baseKey);
    this.baseKey = this.bank.canvas(key, cw, ch, (ctx) => {
      paintCourtyard(ctx, cg, court, seedKey, isFloor);
      // rocks after all slabs so their shadows fall over neighbours
      for (let y = 0; y < this.h; y++) {
        for (let x = 0; x < this.w; x++) {
          const i = index(x, y);
          if (!hasBit(level.stones, i)) continue;
          const cx = gx + x * cs + cs / 2;
          const cy = gy + y * cs + cs / 2;
          if (level.clues[i] !== NO_CLUE) drawNumberedRock(ctx, cx, cy, cs, rng(hashStr(`${seedKey}:${i}`)));
          else drawRock(ctx, cx, cy - cs * 0.02, cs * 0.43, rng(hashStr(`${seedKey}:${i}`)));
        }
      }
    });
    this.base.setTexture(this.baseKey).setOrigin((gx + this.boardW / 2) / cw, (gy + this.boardH / 2) / ch).setPosition(0, 0);
    // the lit floor (same slabs under lantern light, one frame per cell) is baked on first light
    // or ~1 frame after the board appears — not on the cold-start path
    const m = Math.ceil(gap / 2) + 1;
    this.baseGeom = { gx, gy, cw, ch, m };
    if (this.litKey) this.bank.remove(this.litKey);
    this.litKey = "";
    this.litReady = false;
    this.litJob = { cg, seed: seedKey, m, isFloor };
    this.litTimer?.remove();
    this.litTimer = this.scene.time.delayedCall(120, () => this.ensureLit());
    if (this.compKey) this.bank.remove(this.compKey);
    this.compKey = "";
    this.compDirty = true;
    this.compOn = false;
    this.comp.setVisible(false);
    this.base.setVisible(true);
    this.fallK = this.bank.lightK(cs);
    this.bloomK = this.bank.bloomK(cs);
    this.poolK = this.bank.poolK(cs);
    const darkKey = this.bank.dark(cs, groutOf(cs, gap), u);
    for (let i = 0; i < 64; i++) {
      const on = (i & 7) < this.w && i >> 3 < this.h && !hasBit(this.stones, i);
      const x = this.cx(i);
      const y = this.cy(i);
      void on;
      this.lit[i]!.setPosition(x, y).setVisible(false);
      this.fall[i]!.setPosition(x, y).setScale(this.fallK).setVisible(false);
      this.fallSig[i] = -1;
      this.glow[i]!.setPosition(x, y).setScale(this.bloomK).setVisible(false);
      this.dbl[i]!.setPosition(x, y).setScale(this.bloomK).setVisible(false);
      this.prevD[i] = -1;
      this.L.jump(i, 0);
      this.D.jump(i, 0);
      this.W.jump(i, 0);
      this.counts[i] = 0;
    }
    this.planD.fill(-1);
    this.rimN = 0;
    for (const im of this.rims) im.setVisible(false);
    for (const d of this.dark) d.setTexture(darkKey).setVisible(false);
    const blkKey = this.bank.blockedMark(cs, u);
    for (let i = 0; i < 64; i++) {
      // a numbered stone carries its stuck mark on the shoulder (the digit stays readable)
      const onStone = hasBit(level.stones, i);
      // phase 2: nothing is drawn over a digit — the mark sits on the rock's upper-right shoulder
      this.blk[i]!.setTexture(blkKey).setPosition(this.cx(i) + (onStone ? cs * STONE_MARK_DX : 0), this.cy(i) - (onStone ? cs * STONE_MARK_DY : 0)).setScale(onStone ? STONE_MARK_S : 1).setVisible(false);
      this.prevOver[i] = 0;
      this.blkOn[i] = 0;
      this.BRing.jump(i, 0);
      this.P.jump(i, 0);
      this.prevOk[i] = 0;
      this.overNbr[i] = 0;
      this.SOk.jump(i, 0);
      this.SOver.jump(i, 0);
      this.SBlk.jump(i, 0);
      this.overT0[i] = -1e9;
      this.stoneSlot[i] = -1;
    }
    // numbered stones
    this.stoneCell = [];
    this.pipY = this.bank.numberOffsetY(cs);
    const veilKey = this.bank.stoneVeil(cs, u);
    const outKey = this.bank.stoneOutline(cs, u);
    for (let i = 0; i < 64 && this.stoneCell.length < STONE_POOL; i++) {
      if (level.clues[i] === NO_CLUE || !hasBit(level.stones, i)) continue;
      const k = this.stoneCell.length;
      this.stoneCell.push(i);
      this.stoneSlot[i] = k;
      const x = this.cx(i);
      const y = this.cy(i);
      this.pipImg[k]!.setPosition(x, y + this.pipY).setScale(1).setAlpha(1).setVisible(true);
      this.pipOver[k]!.setPosition(x, y + this.pipY).setScale(1).setVisible(false);
      this.overMk[k]!.setTexture(this.bank.overMark(Math.round(cs * OVER_TAG_H))).setVisible(false);
      this.pipWarm[k]!.setPosition(x, y + this.pipY).setScale(1).setVisible(false);
      this.veil[k]!.setTexture(veilKey).setPosition(x, y).setVisible(false);
      this.outline[k]!.setTexture(outKey).setPosition(x, y).setVisible(false);
    }
    for (let k = this.stoneCell.length; k < STONE_POOL; k++) {
      this.pipImg[k]!.setVisible(false);
      this.pipWarm[k]!.setVisible(false);
      this.pipOver[k]!.setVisible(false);
      this.overMk[k]!.setVisible(false);
      this.veil[k]!.setVisible(false);
      this.outline[k]!.setVisible(false);
    }
    this.applyNumberTextures();
    const pingKey = this.bank.ringColor(Math.round(cs * 1.15), u, "#DCEBFA");
    for (let k = 0; k < this.pings.length; k++) {
      this.pings[k]!.setTexture(pingKey).setVisible(false);
      this.pingT0[k] = -1e9;
      this.pingStone[k] = -1;
    }
    this.threads = [];
    this.threadG.clear().setVisible(false);
    this.threadA.jump(0, 0);
    this.threadDrawnAt = -1;
    this.takeBack.setTexture(this.bank.takeBack(Math.round(cs * 0.5))).setVisible(false);
    this.whyRing.setTexture(this.bank.ringColor(Math.round(cs * 1.12), u, PAL.coral)).setVisible(false);
    this.whyG.clear().setVisible(false);
    this.why = null;
    this.wrongCell = -1;
    // phase 2 (audit P1-8): 0.8 cell with a heavy dark outline (colour-blind safe by shape); on
    // the shared edge of two neighbouring lanterns 0.72 cell, so it stays inside the gap between
    // their bodies (under them) instead of reaching over them
    this.xKeys = { far: this.bank.conflictX(Math.round(cs * 0.8)), near: this.bank.conflictX(Math.round(cs * 0.72)) };
    for (const x of this.xs) x.setTexture(this.xKeys.far).setVisible(false);
    this.ghostImg.setTexture(this.bank.ghost(this.lanternH)).setVisible(false);
    this.anchorRing.setVisible(false);
    this.hintMode = Hint.None;
    this.ghostCell = -1;
    this.anchorCell = -1;
    this.ring.setTexture(this.bank.ring(Math.round(cs * 1.1), u)).setVisible(false);
    const lh = this.lanternH;
    this.faceW = Math.max(8, Math.round(lanternGeom(lh).bodyW * 0.92));
    this.happyAt.fill(1e12);
    this.texKeys = {
      lantern: this.bank.lantern(lh, 1),
      flame: this.bank.flame(Math.round(cs * 0.5), false),
      flameMoon: this.bank.flame(Math.round(cs * 0.5), true),
      halo: this.bank.pool(cs),
      ring: this.bank.ringColor(Math.round(cs * 0.96), u, PAL.coral),
      cool: this.bank.coolHalo(Math.round(cs * 1.4)),
      coral: this.bank.coralHalo(Math.round(cs * 1.4)),
      shadow: this.bank.contactShadow(cs),
    };
    for (const r of this.rigs) {
      r.cool.setTexture(this.texKeys.cool);
      r.halo.setTexture(this.texKeys.halo);
      r.ring.setTexture(this.texKeys.ring);
      r.body.setTexture(this.texKeys.lantern);
      r.flame.setTexture(this.texKeys.flame);
      r.shadow.setTexture(this.texKeys.shadow);
      r.hide();
    }
    this.order = [];
    this.pairs = [];
    this.darkCells = [];
    this.lines.clear();
    this.stateRef = null;
  }

  /** Digits (default) or dice pips; switching re-textures the live overlays only. */
  setNumberStyle(style: NumberStyle): void {
    if (style === this.numStyle) return;
    this.numStyle = style;
    this.applyNumberTextures();
  }

  private applyNumberTextures(): void {
    const lv = this.level;
    if (!lv) return;
    const cs = this.geom.cs;
    for (let k = 0; k < this.stoneCell.length; k++) {
      const n = lv.clues[this.stoneCell[k]!]!;
      this.pipImg[k]!.setTexture(this.bank.number(cs, n, "ink", this.numStyle));
      this.pipOver[k]!.setTexture(this.bank.number(cs, n, "over", this.numStyle));
      this.pipWarm[k]!.setTexture(this.bank.number(cs, n, "warm", this.numStyle));
    }
  }

  private isFloor(i: number): boolean {
    return (i & 7) < this.w && i >> 3 < this.h && !hasBit(this.stones, i);
  }

  private computeCounts(st: BoardState): void {
    this.prevCounts.set(this.counts);
    this.counts.fill(0);
    this.pairs.length = 0;
    for (let i = 0; i < 64; i++) {
      if (!hasBit(st.lanterns, i)) continue;
      this.counts[i]!++;
      for (let d = 0; d < 4; d++) {
        const [dx, dy] = DIRS[d]!;
        let x = (i & 7) + dx;
        let y = (i >> 3) + dy;
        while (x >= 0 && y >= 0 && x < st.w && y < st.h) {
          const j = index(x, y);
          if (hasBit(st.stones, j)) break;
          this.counts[j]!++;
          if (d === 0 || d === 2) if (hasBit(st.lanterns, j)) this.pairs.push(i, j);
          x += dx;
          y += dy;
        }
      }
    }
  }

  /**
   * Bring the view to `st`. With `move` it animates (spread from / retract to
   * the toggled cell, lantern drop-in / lift-away); without, it snaps.
   */
  sync(st: BoardState, now: number, move: { cell: number; placed: boolean; ends: FlightEnds; also?: readonly number[] } | null): SyncResult {
    this.stateRef = st;
    this.computeCounts(st);
    if (move) this.happyAt.fill(1e12);
    const reduced = motion.reduced;
    const animate = move !== null;
    // placement order (the completion melody plays it back)
    const ord = this.order;
    for (let k = ord.length - 1; k >= 0; k--) if (!hasBit(st.lanterns, ord[k]!)) ord.splice(k, 1);
    for (let i = 0; i < 64; i++) if (hasBit(st.lanterns, i) && !ord.includes(i)) ord.push(i);

    const litTimes: number[] = [];
    const flight = animate && !reduced ? 140 : 0;
    const lift = animate && !reduced ? 100 : 0;
    let maxD = 0;
    if (move) {
      for (let i = 0; i < 64; i++) {
        if (!this.isFloor(i)) continue;
        if (((this.counts[i]! > 0) !== (this.prevCounts[i]! > 0)) || ((this.counts[i]! > 1) !== (this.prevCounts[i]! > 1))) {
          maxD = Math.max(maxD, Math.abs((i & 7) - (move.cell & 7)) + Math.abs((i >> 3) - (move.cell >> 3)));
        }
      }
    }
    let settle = 0;
    let litFloor = 0;
    let floorCount = 0;
    const dark: number[] = [];
    for (let i = 0; i < 64; i++) {
      if (!this.isFloor(i)) continue;
      floorCount++;
      const c = this.counts[i]!;
      const p = this.prevCounts[i]!;
      if (c > 0) litFloor++;
      else dark.push(i);
      if (!animate) {
        this.L.jump(i, c > 0 ? 1 : 0);
        this.D.jump(i, c > 1 ? 1 : 0);
        continue;
      }
      const d = Math.abs((i & 7) - (move!.cell & 7)) + Math.abs((i >> 3) - (move!.cell >> 3));
      let delay: number;
      if (reduced) delay = 0;
      else if (move!.placed) delay = flight + spreadDelay(d);
      else delay = (maxD - d) * 30;
      const turningOn = c > 0 && p === 0;
      const turningOff = c === 0 && p > 0;
      if (turningOn) {
        this.L.set(i, 1, now, delay, reduced ? 120 : 150);
        litTimes.push(delay);
        settle = Math.max(settle, delay + 150);
      } else if (turningOff) {
        this.L.set(i, 0, now, delay, reduced ? 120 : 110);
        settle = Math.max(settle, delay + 110);
      }
      if ((c > 1) !== (p > 1)) this.D.set(i, c > 1 ? 1 : 0, now, delay, 160);
    }
    litTimes.sort((a, b) => a - b);
    this.applyPlan(st);

    // lanterns
    for (const r of this.rigs) {
      if (r.mode === Mode.Idle || r.mode === Mode.Leave) continue;
      if (!hasBit(st.lanterns, r.cell)) {
        if (move && !move.placed && !reduced && (move.cell === r.cell || move.also?.includes(r.cell))) {
          const k = move.also ? move.also.indexOf(r.cell) : -1;
          this.startLeave(r, now + Math.max(0, k) * 45, { ...move.ends, x: this.cx(r.cell), y: this.cy(r.cell) - this.geom.cs * 0.9 });
        }
        else r.hide();
      }
    }
    for (let i = 0; i < 64; i++) {
      if (!hasBit(st.lanterns, i) || this.rigAt(i)) continue;
      const r = this.freeRig();
      r.cell = i;
      r.tx = this.cx(i);
      r.ty = this.cy(i) - this.geom.cs * 0.03;
      r.ts = 1;
      if (move && move.cell === i && move.placed && !reduced) {
        r.mode = Mode.FlyIn;
        r.t0 = now;
        r.fx = move.ends.x;
        r.fy = move.ends.y;
        r.fs = move.ends.scale;
      } else {
        r.mode = Mode.Rest;
        r.landT = animate && !reduced ? now : -1e9;
      }
      r.halo.setVisible(true);
      r.body.setVisible(true);
      r.flame.setVisible(true);
    }
    // conflict flags
    let invalid = false;
    const conflictCells = new Set<number>();
    for (let k = 0; k < this.pairs.length; k++) conflictCells.add(this.pairs[k]!);
    for (const r of this.rigs) {
      if (r.mode === Mode.Idle || r.mode === Mode.Leave) continue;
      r.conflict = conflictCells.has(r.cell);
      // round 4: a conflict keeps the warm flame. v11 (C6): the ✕ alone says "not allowed" — no
      // coral ring around the two lanterns as well
      r.moon = false;
      if (move && move.placed && move.cell === r.cell && r.conflict) invalid = true;
    }
    if (invalid && move) {
      // the new lantern and every lantern it sees give one short shake as the ✕ appears
      const partners = new Set<number>([move.cell]);
      for (let k = 0; k < this.pairs.length; k += 2) {
        if (this.pairs[k] === move.cell) partners.add(this.pairs[k + 1]!);
        if (this.pairs[k + 1] === move.cell) partners.add(this.pairs[k]!);
      }
      for (const r of this.rigs) if (partners.has(r.cell) && r.mode !== Mode.Leave) r.shakeT0 = now + (reduced ? 0 : 160);
    }
    this.linesT0 = now + (move?.placed && !reduced ? 140 : 0);
    this.drawLines();
    // near-complete hint (≤ 2 dark cells)
    this.darkCells = dark.length > 0 && dark.length <= 2 ? dark : [];
    for (let k = 0; k < this.dark.length; k++) {
      const c = this.darkCells[k];
      const im = this.dark[k]!;
      if (c === undefined) im.setVisible(false);
      else im.setPosition(this.cx(c), this.cy(c)).setVisible(true).setAlpha(0);
    }
    if (!animate) this.render(now);
    return {
      litTimes,
      newlyLit: litTimes.length,
      darkCells: this.darkCells.slice(),
      litFloor,
      floorCount,
      conflictPairs: this.pairs.length / 2,
      invalid,
      settleMs: settle,
    };
  }

  /** Bake the lit floor + light textures now (idempotent). */
  private ensureLit(): void {
    if (this.litReady || !this.litJob) return;
    this.litTimer?.remove();
    this.litTimer = null;
    const { cg, seed, m, isFloor } = this.litJob;
    const cs = cg.cs;
    this.litKey = this.bank.canvas(`litfloor:${seed}@${cs}`, this.boardW + m * 2, this.boardH + m * 2, (ctx) =>
      paintLitFloor(ctx, { ...cg, gx: m, gy: m }, seed, isFloor));
    const ltex = this.scene.textures.get(this.litKey);
    const glowKey = this.bank.bloom(cs);
    const waveKey = this.bank.bloom(cs, 0.62);
    for (let i = 0; i < 64; i++) {
      const c = i & 7;
      const rr = i >> 3;
      if (c >= this.w || rr >= this.h) continue;
      if (!ltex.has(`c${i}`)) ltex.add(`c${i}`, 0, m + c * cs, m + rr * cs, cs, cs);
      if (this.isFloor(i)) this.lit[i]!.setTexture(this.litKey, `c${i}`);
      this.glow[i]!.setTexture(glowKey);
      this.dbl[i]!.setTexture(waveKey);
    }
    // the stamps the composite needs
    for (let d = 0; d <= 8; d++) this.bank.falloff(cs, d);
    this.bank.rockRim(cs);
    this.litReady = true;
    this.compDirty = true;
  }

  /** Paint base + light into the composite texture (once per settled change). */
  private bakeComp(): void {
    if (!this.litReady) return;
    const g = this.baseGeom;
    const cs = this.geom.cs;
    const tm = this.scene.textures;
    if (!this.compKey) {
      this.compKey = this.bank.canvas(`comp:${this.baseKey}`, g.cw, g.ch, () => {});
      this.comp.setTexture(this.compKey).setOrigin(this.base.originX, this.base.originY).setPosition(0, 0);
    }
    const tex = tm.get(this.compKey) as PhaserTypes.Textures.CanvasTexture;
    const ctx = tex.getContext();
    const src = (k: string): CanvasImageSource => tm.get(k).getSourceImage() as CanvasImageSource;
    ctx.clearRect(0, 0, g.cw, g.ch);
    ctx.drawImage(src(this.baseKey), 0, 0);
    const st: LightStamps = {
      src: src(this.bank.falloff(cs, 0)),
      ray: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((d) => src(this.bank.falloff(cs, d))),
      pool: src(this.bank.pool(cs)),
      rim: src(this.bank.rockRim(cs)),
      marker: [],
      bloom: src(this.bank.bloom(cs)),
    };
    paintLightStill(ctx, src(this.litKey), g.m, g.m, g.gx, g.gy, cs, this.w, this.h, { d: this.planD, dir: this.planDir, rim: this.planRim }, st, (i) => this.isNumber(i), false);
    tex.refresh();
    this.compDirty = false;
  }

  /**
   * v9 light plan: which falloff each lit cell shows (its nearest lantern's ray step and
   * direction) and which stones get a rim. Called on every sync (not per frame).
   */
  private applyPlan(st: BoardState): void {
    planLight(st.w, st.h, (i) => hasBit(st.stones, i), (i) => hasBit(st.lanterns, i), this.planD, this.planDir, this.planRim);
    this.compDirty = true;
    if (st.lanterns.lo !== 0 || st.lanterns.hi !== 0) this.ensureLit();
    for (let i = 0; i < 64; i++) {
      const d = this.planD[i]!;
      if (d >= 0) this.setFall(i, d, this.planDir[i]!);
    }
    // rims: fed by the cell before the stone on that ray (its light arrives first)
    const cs = this.geom.cs;
    let n = 0;
    for (let j = 0; j < 64 && n < RIM_POOL; j++) {
      for (let k = 0; k < 4 && n < RIM_POOL; k++) {
        const dd = this.planRim[j * 4 + k]!;
        if (dd < 0) continue;
        const fx = (j & 7) - (k === 0 ? 1 : k === 1 ? -1 : 0);
        const fy = (j >> 3) - (k === 2 ? 1 : k === 3 ? -1 : 0);
        const im = this.rims[n]!;
        const num = this.isNumber(j);
        // v10: numbered stones are boulders too — the same rim, a touch larger
        im.setTexture(this.bank.rockRim(cs)).setRotation(DIR_ROT[k]!).setScale(this.bank.rockRimK(cs) * (num ? 1.07 : 1)).setPosition(this.cx(j), this.cy(j) - (num ? 0 : cs * 0.02));
        this.rimFeed[n] = index(fx, fy);
        this.rimA[n] = rimA(dd);
        n++;
      }
    }
    for (let k = n; k < this.rimN; k++) this.rims[k]!.setVisible(false);
    this.rimN = n;
  }

  /** Point cell i's falloff sprite at ray step d (0 = lantern cell) travelling dir. */
  private setFall(i: number, d: number, dir: number): void {
    const sig = Math.min(8, d) * 4 + (d === 0 ? 0 : dir);
    if (this.fallSig[i] === sig) return;
    this.fallSig[i] = sig;
    this.fall[i]!.setTexture(this.bank.falloff(this.geom.cs, d)).setRotation(d === 0 ? 0 : DIR_ROT[dir]!);
  }

  private rigAt(i: number): Rig | null {
    for (const r of this.rigs) if (r.cell === i && (r.mode === Mode.FlyIn || r.mode === Mode.Rest)) return r;
    return null;
  }

  private freeRig(): Rig {
    for (const r of this.rigs) if (r.mode === Mode.Idle) return r;
    for (const r of this.rigs) if (r.mode === Mode.Leave) {
      r.onArrive?.();
      r.onArrive = null;
      r.hide();
      return r;
    }
    return this.rigs[0]!;
  }

  private startLeave(r: Rig, now: number, ends: FlightEnds): void {
    r.mode = Mode.Leave;
    r.t0 = now;
    r.fx = r.body.x;
    r.fy = r.body.y;
    r.fs = r.body.scaleY;
    r.tx = ends.x;
    r.ty = ends.y;
    r.ts = ends.scale;
    r.onArrive = ends.onArrive ?? null;
    r.fade = ends.fade === true;
    r.cell = -1;
    r.conflict = false;
    r.wrong = false;
    r.blame = false;
    r.cool.setVisible(false);
    r.body.setRotation(0);
    if (r.moon) {
      r.moon = false;
      r.flame.setTexture(this.texKeys.flame);
    }
  }

  /** A coral ✕ halfway between every two lanterns that see each other (v4's dotted line read as "connect"). */
  private drawLines(): void {
    for (let k = 0; k < this.xs.length; k++) {
      const a = this.pairs[k * 2];
      const b = this.pairs[k * 2 + 1];
      const x = this.xs[k]!;
      if (a === undefined || b === undefined) {
        x.setVisible(false);
        continue;
      }
      const near = Math.abs((a & 7) - (b & 7)) + Math.abs((a >> 3) - (b >> 3)) === 1;
      x.setTexture(near ? this.xKeys.near : this.xKeys.far);
      x.setPosition((this.cx(a) + this.cx(b)) / 2, (this.cy(a) + this.cy(b)) / 2).setVisible(true).setAlpha(0);
    }
  }

  // ------------------------------------------------------------ pips stones

  /** Numbered-stone status from the rules analysis. Animates the change when `animate`. */
  setStones(stones: readonly { cell: number; status: StoneStatus }[], now: number, animate: boolean): void {
    const reduced = motion.reduced || !animate;
    this.overNbr.fill(0);
    for (const st of stones) {
      if (st.status !== "over") continue;
      for (const [dx, dy] of DIRS) {
        const x = (st.cell & 7) + dx;
        const y = (st.cell >> 3) + dy;
        if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.overNbr[index(x, y)] = 1;
      }
    }
    for (const st of stones) {
      const i = st.cell;
      if (this.stoneSlot[i]! < 0) continue;
      const ok = st.status === "ok" ? 1 : 0;
      const over = st.status === "over" ? 1 : 0;
      const blk = st.status === "blocked" ? 1 : 0;
      // status changes land with the light (after the lantern's flight)
      const delay = reduced ? 0 : 150;
      if (this.SOk.goal(i) !== ok) {
        if (reduced) this.SOk.jump(i, ok);
        else this.SOk.set(i, ok, now, delay, ok ? 260 : 160);
      }
      if (this.SOver.goal(i) !== over) {
        if (reduced) this.SOver.jump(i, over);
        else this.SOver.set(i, over, now, delay, 220);
        if (over && animate) this.overT0[i] = now + delay;
      }
      if (this.SBlk.goal(i) !== blk) {
        if (reduced) this.SBlk.jump(i, blk);
        else this.SBlk.set(i, blk, now, delay, 300);
      }
    }
  }

  // ------------------------------------------------------------ blocked cells

  /**
   * Stuck dark cells: a dim crossed-out sparkle each, a thin moonlight thread
   * from the cell to every blocker (drawn out over 420 ms), then one ping on
   * each. Light blockers are the player's own lanterns: their thread bends
   * through the candidate cell their light covers, and the lanterns tilt and
   * flicker with a cool rim. Empty list hides it all.
   */
  showBlocked(list: readonly BlockedView[], now: number, stuck: readonly StuckStoneView[] = []): void {
    const reduced = motion.reduced;
    const want = new Uint8Array(64);
    for (const b of list) want[b.cell] = 1;
    for (const st of stuck) want[st.stone] = 1;
    for (let i = 0; i < 64; i++) {
      if (want[i] === this.blkOn[i]) continue;
      this.blkOn[i] = want[i]!;
      if (reduced) this.BRing.jump(i, want[i]!);
      else this.BRing.set(i, want[i]!, now, 0, want[i] ? 360 : 160);
    }
    const blamed = new Set<number>();
    for (const b of list) if (b.strong) for (const l of b.lanterns) blamed.add(l);
    for (const st of stuck) if (st.lantern >= 0) blamed.add(st.lantern);
    for (const r of this.rigs) {
      if (r.mode !== Mode.Rest && r.mode !== Mode.FlyIn) continue;
      const on = blamed.has(r.cell);
      if (on && !r.blame) r.blameT0 = now + (reduced ? 0 : 380);
      r.blame = on;
    }
    if (list.length === 0 && stuck.length === 0) {
      if (reduced) this.threadA.jump(0, 0);
      else this.threadA.set(0, 0, now, 0, 160);
      return;
    }
    this.threads.length = 0;
    const targets: number[] = [];
    for (const b of list) {
      for (let k = 0; k < b.lanterns.length; k++) {
        const l = b.lanterns[k]!;
        const q = b.via[k] ?? l;
        const cells = q === b.cell || q === l ? [b.cell, l] : [b.cell, q, l];
        this.threads.push({ cells, lan: true, faint: !b.strong });
        if (b.strong && !targets.includes(l)) targets.push(l);
      }
      // stones: faint threads only (the culprit is the thing to look at)
      for (const st of b.stones) this.threads.push({ cells: [b.cell, st], lan: false, faint: true });
    }
    for (const st of stuck) {
      if (st.lantern < 0) continue;
      const cells = st.via < 0 || st.via === st.lantern ? [st.stone, st.lantern] : [st.stone, st.via, st.lantern];
      this.threads.push({ cells, lan: true, faint: st.faint });
      if (!targets.includes(st.lantern)) targets.push(st.lantern);
    }
    this.threadT0 = now;
    this.threadDrawnAt = -1;
    this.threadA.jump(0, 1);
    const pingAt = now + (reduced ? 0 : 420);
    for (let k = 0; k < this.pings.length; k++) {
      const t = targets[k];
      if (t === undefined) {
        this.pingStone[k] = -1;
        this.pings[k]!.setVisible(false);
        continue;
      }
      this.pingStone[k] = t;
      this.pingT0[k] = pingAt + k * 90;
      this.pings[k]!.setPosition(this.cx(t), this.cy(t));
    }
  }

  get blockedShown(): boolean {
    return this.threadA.goal(0) > 0 || this.BRing.active > 0;
  }

  private drawThreads(now: number): void {
    const t = motion.reduced ? 1 : clamp01((now - this.threadT0) / 420);
    if (t === this.threadDrawnAt) return;
    this.threadDrawnAt = t;
    const g = this.threadG.clear();
    const cs = this.geom.cs;
    const e = easeOutCubic(t);
    const N = 14;
    const pts: number[] = [];
    for (let k = 0; k < this.threads.length; k++) {
      const th = this.threads[k]!;
      // polyline through the cell centres; one bowed quadratic per segment so a thread never lies on a grid line
      pts.length = 0;
      for (let si = 0; si + 1 < th.cells.length; si++) {
        const x0 = this.cx(th.cells[si]!);
        const y0 = this.cy(th.cells[si]!);
        const x1 = this.cx(th.cells[si + 1]!);
        const y1 = this.cy(th.cells[si + 1]!);
        const len = Math.hypot(x1 - x0, y1 - y0) || 1;
        const bow = Math.min(cs * 0.22, len * 0.12) * ((k + si) % 2 === 0 ? 1 : -1);
        const mx = (x0 + x1) / 2 + (-(y1 - y0) / len) * bow;
        const my = (y0 + y1) / 2 + ((x1 - x0) / len) * bow;
        for (let j = si === 0 ? 0 : 1; j <= N; j++) {
          const q = j / N;
          pts.push((1 - q) * (1 - q) * x0 + 2 * (1 - q) * q * mx + q * q * x1, (1 - q) * (1 - q) * y0 + 2 * (1 - q) * q * my + q * q * y1);
        }
      }
      // phase 2: nothing over a digit — a thread that starts / ends on a numbered rock is cut at its edge
      const R = cs * 0.5;
      const first = th.cells[0]!;
      const last = th.cells[th.cells.length - 1]!;
      let j0 = 0;
      let j1 = pts.length / 2 - 1;
      if (hasBit(this.stones, first)) while (j0 < j1 && Math.hypot(pts[j0 * 2]! - this.cx(first), pts[j0 * 2 + 1]! - this.cy(first)) < R) j0++;
      if (hasBit(this.stones, last)) while (j1 > j0 && Math.hypot(pts[j1 * 2]! - this.cx(last), pts[j1 * 2 + 1]! - this.cy(last)) < R) j1--;
      const n = j1 - j0 + 1;
      const upto = j0 + Math.max(1, Math.round((n - 1) * e));
      // audit P1-7: a dark navy underlay (≥ 3:1 on lit floor); Increase Contrast = fully opaque
      const hc = vis.p.increaseContrast;
      const fa = th.faint ? (hc ? 0.8 : 0.55) : 1;
      for (let pass = 0; pass < 2; pass++) {
        if (pass === 0) g.lineStyle(Math.max(5, cs * (th.faint ? 0.075 : 0.105)), 0x0a0e24, (hc ? 0.95 : 0.8) * fa);
        else g.lineStyle(Math.max(th.faint ? 1.5 : 2, cs * (th.faint ? 0.024 : 0.037)), 0xdcebfa, (hc ? 1 : 0.95) * fa);
        g.beginPath();
        g.moveTo(pts[j0 * 2]!, pts[j0 * 2 + 1]!);
        for (let j = j0 + 1; j <= upto; j++) g.lineTo(pts[j * 2]!, pts[j * 2 + 1]!);
        g.strokePath();
      }
      g.fillStyle(0x0a0e24, 0.8 * fa);
      g.fillCircle(pts[j0 * 2]!, pts[j0 * 2 + 1]!, Math.max(3, cs * 0.07));
      g.fillStyle(0xdcebfa, fa);
      g.fillCircle(pts[j0 * 2]!, pts[j0 * 2 + 1]!, Math.max(2, cs * 0.045));
      // the bend: the spot that could have lit the cell, already in this lantern's light
      if (th.cells.length === 3 && e > 0.5 && !th.faint) {
        g.lineStyle(Math.max(1.5, cs * 0.03), 0xdcebfa, 0.9);
        g.strokeCircle(this.cx(th.cells[1]!), this.cy(th.cells[1]!), cs * 0.09);
      }
      if (e >= 1) g.fillCircle(pts[j1 * 2]!, pts[j1 * 2 + 1]!, Math.max(2.5, cs * 0.055));
    }
  }

  // ------------------------------------------------------------ guide previews

  /** Onboarding: a ghost of the light a lantern on `cell` would cast (on) or its fade (off). */
  previewLight(cell: number, on: boolean, now: number): void {
    const lv = this.level;
    if (!lv) return;
    this.ensureLit();
    for (const c of raysOf(lv, cell)) {
      const d = Math.abs((c & 7) - (cell & 7)) + Math.abs((c >> 3) - (cell >> 3));
      const dx = (c & 7) - (cell & 7);
      const dy = (c >> 3) - (cell >> 3);
      this.prevD[c] = d;
      this.prevDir[c] = dx > 0 ? 0 : dx < 0 ? 1 : dy > 0 ? 2 : 3;
      if (on) this.P.set(c, 1, now, motion.reduced ? 0 : spreadDelay(d), 150);
      else this.P.set(c, 0, now, 0, 260);
    }
  }

  /** Onboarding: the stone's digit shown gold (v 0..1) as if it were satisfied. */
  previewStone(cell: number, v: number): void {
    this.prevOk[cell] = v;
  }

  /** Onboarding: the stone shown "too many" (v 0..1) — the 0-rock lesson; `shake` starts its shake now. */
  previewOver(cell: number, v: number, now: number, shake = false): void {
    this.prevOver[cell] = v;
    if (shake) this.overT0[cell] = now;
  }

  clearPreviews(): void {
    for (let i = 0; i < 64; i++) {
      this.P.jump(i, 0);
      this.prevOk[i] = 0;
      if (this.prevOver[i]! > 0 && this.SOver.val[i] === 0) this.overT0[i] = -1e9;
      this.prevOver[i] = 0;
    }
  }

  // ------------------------------------------------------------ hints

  /**
   * The one lantern the hint wants back (round 5, must not look like the moonlit place ghost):
   * it dims and sinks a little, a coral take-back curl turns beside it, and — when the analysis
   * knows what it breaks — a coral thread with an arrow head runs to that number / stuck cell /
   * lantern, which gets a coral ring pulse.
   */
  showWrong(cell: number, now: number, why: WhyView | null = null): void {
    for (const r of this.rigs) {
      if (r.mode !== Mode.Rest && r.mode !== Mode.FlyIn) continue;
      const w = r.cell === cell;
      if (w && !r.wrong) r.wrongT0 = now;
      r.wrong = w;
      r.flame.setTexture(this.texKeys.flame);
    }
    this.wrongCell = cell;
    this.wrongT0 = now;
    this.why = why && why.target !== cell ? why : null;
    this.takeBack.setVisible(true).setAlpha(0);
    this.drawWhy(0);
  }

  /** Coral thread from the wrong lantern to what it breaks, drawn out to fraction e. */
  private whyE = -1;
  private drawWhy(e: number): void {
    this.whyE = e;
    const g = this.whyG.clear();
    const w = this.why;
    if (!w || this.wrongCell < 0) {
      g.setVisible(false);
      this.whyRing.setVisible(false);
      return;
    }
    const cs = this.geom.cs;
    const x0 = this.cx(this.wrongCell);
    const y0 = this.cy(this.wrongCell);
    // phase 2 (audit P0-1): a number is never covered — the head stops at the rock's edge
    // (r × 1.05) and the coral ring around the rock pulses instead
    let x1 = this.cx(w.target);
    let y1 = this.cy(w.target);
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const stop = cs * (w.kind === "cell" ? 0.18 : w.kind === "stone" ? 0.45 * 1.05 + 0.04 : len < cs * 1.5 ? 0.26 : 0.42);
    x1 -= ((x1 - x0) / len) * stop;
    y1 -= ((y1 - y0) / len) * stop;
    const lead = len < cs * 1.5 ? 0.16 : 0.3;
    const sx = x0 + ((x1 - x0) / len) * cs * lead;
    const sy = y0 + ((y1 - y0) / len) * cs * lead;
    const bow = Math.min(cs * 0.25, len * 0.15);
    const mx = (sx + x1) / 2 + (-(y1 - sy) / len) * bow;
    const my = (sy + y1) / 2 + ((x1 - sx) / len) * bow;
    const N = 16;
    const upto = Math.max(1, Math.round(N * e));
    const pt = (q: number): [number, number] => [(1 - q) * (1 - q) * sx + 2 * (1 - q) * q * mx + q * q * x1, (1 - q) * (1 - q) * sy + 2 * (1 - q) * q * my + q * q * y1];
    for (let pass = 0; pass < 2; pass++) {
      g.lineStyle(pass === 0 ? Math.max(5, cs * 0.1) : Math.max(2, cs * 0.04), pass === 0 ? 0x2a0a04 : 0xf2907a, pass === 0 ? 0.85 : 1);
      g.beginPath();
      g.moveTo(sx, sy);
      for (let j = 1; j <= upto; j++) {
        const [px, py] = pt(j / N);
        g.lineTo(px, py);
      }
      g.strokePath();
    }
    if (e >= 1) {
      const [ax, ay] = pt(0.86);
      const dx = x1 - ax;
      const dy = y1 - ay;
      const dl = Math.hypot(dx, dy) || 1;
      const ux = dx / dl;
      const uy = dy / dl;
      const hl = cs * 0.22;
      const hw = cs * 0.14;
      const tri = [x1 + ux * cs * 0.04, y1 + uy * cs * 0.04, x1 - ux * hl - uy * hw, y1 - uy * hl + ux * hw, x1 - ux * hl + uy * hw, y1 - uy * hl - ux * hw];
      // dark rim triangle (scaled up about the head's centre) so the head reads on coral / lit floor too
      const mx2 = (tri[0]! + tri[2]! + tri[4]!) / 3;
      const my2 = (tri[1]! + tri[3]! + tri[5]!) / 3;
      const k = 1.45;
      g.fillStyle(0x2a0a04, 0.9);
      g.fillTriangle(mx2 + (tri[0]! - mx2) * k, my2 + (tri[1]! - my2) * k, mx2 + (tri[2]! - mx2) * k, my2 + (tri[3]! - my2) * k, mx2 + (tri[4]! - mx2) * k, my2 + (tri[5]! - my2) * k);
      g.fillStyle(0xf2907a, 1);
      g.fillTriangle(tri[0]!, tri[1]!, tri[2]!, tri[3]!, tri[4]!, tri[5]!);
    }
    g.setVisible(true);
    this.whyRing.setPosition(this.cx(w.target), this.cy(w.target));
  }

  /** A lantern belongs on `cell`; `anchor` (a stone or a dark cell) is why. */
  showGhost(cell: number, anchor: number, now: number): void {
    this.hintMode = Hint.Ghost;
    this.ghostCell = cell;
    this.anchorCell = anchor;
    this.hintT0 = now;
    this.ghostImg.setPosition(this.cx(cell), this.cy(cell) - this.geom.cs * 0.03).setVisible(true).setAlpha(0);
    const isStone = hasBit(this.stones, anchor);
    const size = Math.round(this.geom.cs * (isStone ? 1.12 : 1.04));
    this.anchorRing
      .setTexture(this.bank.ringColor(size, this.geom.u, isStone ? PAL.flame : PAL.moon))
      .setPosition(this.cx(anchor), this.cy(anchor))
      .setVisible(anchor !== cell)
      .setAlpha(0);
  }

  get ghostAt(): number {
    return this.hintMode === Hint.Ghost ? this.ghostCell : -1;
  }

  clearHint(): void {
    this.hintMode = Hint.None;
    this.ghostCell = -1;
    this.anchorCell = -1;
    this.ghostImg.setVisible(false);
    this.anchorRing.setVisible(false);
    this.takeBack.setVisible(false);
    this.whyG.clear().setVisible(false);
    this.whyRing.setVisible(false);
    this.why = null;
    this.wrongCell = -1;
    for (const r of this.rigs) {
      if (r.wrong) {
        r.wrong = false;
        r.body.setRotation(0).setAlpha(1);
        r.flame.setTexture(this.texKeys.flame);
      }
    }
  }

  /** Moonlight ring on a cell (stone tap, restored last move). */
  pulse(i: number, now: number): void {
    this.ring.setPosition(this.cx(i), this.cy(i)).setVisible(true);
    this.ringT0 = now;
  }

  /** Completion flower wave from `origin`. Returns the ring times (ms from now). */
  wave(origin: number, now: number, ringMs: number, maxMs: number): number[] {
    this.ensureLit();
    let maxR = 0;
    const ox = origin & 7;
    const oy = origin >> 3;
    for (let i = 0; i < 64; i++) if (this.isFloor(i)) maxR = Math.max(maxR, Math.round(Math.hypot((i & 7) - ox, (i >> 3) - oy)));
    const step = maxR > 0 ? Math.min(ringMs, maxMs / maxR) : ringMs;
    const times: number[] = [];
    for (let r = 0; r <= maxR; r++) times.push(Math.round(r * step));
    for (let i = 0; i < 64; i++) {
      if (!this.isFloor(i)) continue;
      const r = Math.round(Math.hypot((i & 7) - ox, (i >> 3) - oy));
      this.W.set(i, 1, now, r * step, 240, 2);
      // v12: the lanterns smile as the wave reaches them
      this.happyAt[i] = now + r * step;
    }
    return times;
  }

  /**
   * The v9 finale ("slow and big", BENCHMARK-VISUAL #6), ≈ 2.6 s from the end of the last spread:
   * 0–380 ms the wave runs across the courtyard; +220 ms every light swells 1.0 → 1.25 → 1.0
   * (pools grow 12 %); with `scenery`: +400 camera push 6 % toward the house while its windows light
   * at 90 ms intervals, +700 the sky warms and the village light comes on, +1200 the plate turns.
   * Reduce Motion: no wave / swell / camera / sky — the windows and the village light only (≈ 1 s).
   * Resolves at the end (or right away after skipFinale). No per-frame allocation.
   */
  playFinale(o: FinaleOpts): Promise<void> {
    this.finResolve?.();
    const reduced = o.reduced ?? motion.reduced;
    this.finT0 = o.now;
    this.finReduced = reduced;
    const sc: FinaleScenery | null = o.scenery ?? sceneryOf.get(this.scene) ?? null;
    this.finScenery = sc;
    let end = o.now + (reduced ? 1000 : o.kind === "alley" ? 3900 : 2600);
    if (!reduced && !o.noWave) this.wave(o.origin, o.now, 35, 380);
    else this.smile(o.now);
    if (sc) end = Math.max(end, sc.playFinale({ now: o.now, reduced, camera: o.camera, nextNumber: o.nextNumber, kind: o.kind }));
    this.finEnd = end;
    return new Promise<void>((res) => {
      this.finResolve = res;
    });
  }

  /** Tap to skip: everything jumps to its end state and playFinale resolves. */
  skipFinale(now: number): void {
    if (!this.finResolve) return;
    this.W.settle();
    this.finScenery?.skipFinale(now);
    this.finEnd = now;
    this.stepFinale(now);
  }

  get finalePlaying(): boolean {
    return this.finResolve !== null;
  }

  private stepFinale(now: number): void {
    if (!this.finResolve) return;
    const t = now - this.finT0;
    this.glowBoost = this.finReduced ? 1 : 1 + 0.25 * Math.sin(Math.PI * clamp01((t - 220) / 600));
    if (now >= this.finEnd && (!this.finScenery || this.finScenery.finaleDone(now))) {
      this.glowBoost = 1;
      const r = this.finResolve;
      this.finResolve = null;
      this.finScenery = null;
      r();
    }
  }

  /** Board-local centres of up to n lit floor cells (spread over the board). */
  litPoints(n: number, out: number[]): void {
    out.length = 0;
    const cells: number[] = [];
    for (let i = 0; i < 64; i++) if (this.isFloor(i) && this.counts[i]! > 0) cells.push(i);
    if (cells.length === 0) return;
    for (let k = 0; k < n; k++) {
      const c = cells[Math.floor(((k + 0.5) * cells.length) / n) % cells.length]!;
      out.push(this.cx(c), this.cy(c));
    }
  }

  /** A lantern the lantern at `cell` sees (conflict partner), or -1. */
  partnerOf(cell: number): number {
    for (let k = 0; k < this.pairs.length; k += 2) {
      if (this.pairs[k] === cell) return this.pairs[k + 1]!;
      if (this.pairs[k + 1] === cell) return this.pairs[k]!;
    }
    return -1;
  }

  /** Lantern cells in placement order. */
  get placementOrder(): readonly number[] {
    return this.order;
  }

  get nearDark(): readonly number[] {
    return this.darkCells;
  }

  /** Jump every running animation to its end state. */
  settle(now: number): void {
    this.L.settle();
    this.D.settle();
    this.W.settle();
    this.SOk.settle();
    this.SOver.settle();
    this.SBlk.settle();
    this.BRing.settle();
    this.threadA.settle();
    this.P.settle();
    this.ringT0 = -1e9;
    for (const r of this.rigs) {
      if (r.mode === Mode.Leave) {
        r.onArrive?.();
        r.onArrive = null;
        r.hide();
      } else if (r.mode === Mode.FlyIn) {
        r.mode = Mode.Rest;
        r.landT = -1e9;
      }
    }
    this.linesT0 = 0;
    this.render(now);
  }

  get busy(): boolean {
    if (this.L.active + this.W.active > 0) return true;
    for (const r of this.rigs) if (r.mode === Mode.FlyIn || r.mode === Mode.Leave) return true;
    return false;
  }

  /** Per-frame. */
  update(now: number): void {
    this.L.step(now);
    this.D.step(now);
    this.W.step(now);
    this.SOk.step(now);
    this.SOver.step(now);
    this.SBlk.step(now);
    this.BRing.step(now);
    this.threadA.step(now);
    this.P.step(now);
    this.stepFinale(now);
    this.render(now);
  }

  private render(now: number): void {
    // nothing animating → one baked image (base + light + rims) instead of ~200 light sprites
    let anyP = false;
    for (let i = 0; i < 64; i++) if (this.P.val[i]! > 0.004) {
      anyP = true;
      break;
    }
    const still = this.litReady && this.L.active === 0 && this.W.active === 0 && !anyP && this.finResolve === null;
    if (still) {
      if (this.compDirty) this.bakeComp();
      if (!this.compOn) {
        this.compOn = true;
        this.comp.setVisible(true);
        this.base.setVisible(false);
        for (let i = 0; i < 64; i++) {
          if (this.lit[i]!.visible) {
            this.lit[i]!.setVisible(false);
            this.fall[i]!.setVisible(false);
            this.glow[i]!.setVisible(false);
          }
          if (this.dbl[i]!.visible) this.dbl[i]!.setVisible(false);
        }
        for (let k = 0; k < this.rimN; k++) this.rims[k]!.setVisible(false);
      }
    } else if (this.compOn) {
      this.compOn = false;
      this.comp.setVisible(false);
      this.base.setVisible(true);
    }
    if (!still) this.renderLight();
    this.renderRest(now);
  }

  private renderLight(): void {
    for (let i = 0; i < 64; i++) {
      const lv = this.L.val[i]!;
      const pv = 0.95 * this.P.val[i]!;
      const l = Math.max(lv, pv);
      const im = this.lit[i]!;
      const fa = this.fall[i]!;
      const gl = this.glow[i]!;
      if (l > 0.004) {
        // the falloff follows the real light, or the guide's preview lantern where there is none
        let d = this.planD[i]!;
        if (d >= 0 && lv >= pv) this.setFall(i, d, this.planDir[i]!);
        else if (this.prevD[i]! >= 0) {
          d = this.prevD[i]!;
          this.setFall(i, d, this.prevDir[i]!);
        }
        if (!im.visible) {
          im.setVisible(true);
          fa.setVisible(true);
          gl.setVisible(true);
        }
        im.setAlpha(l);
        fa.setAlpha(l);
        gl.setAlpha(Math.min(1, l * bloomA(Math.max(0, d)) * this.glowBoost));
      } else if (im.visible) {
        im.setVisible(false);
        fa.setVisible(false);
        gl.setVisible(false);
      }
      const w = this.W.val[i]!;
      // v4: no "double light" during play (8/8 read it as a state) — finale wave only
      const di = this.dbl[i]!;
      if (w > 0.004) {
        if (!di.visible) di.setVisible(true);
        di.setAlpha(0.85 * w);
      } else if (di.visible) di.setVisible(false);
    }
    // rims: lit as the light reaches the stone
    for (let k = 0; k < this.rimN; k++) {
      const f = this.rimFeed[k]!;
      const a = (f >= 0 ? this.L.val[f]! : 0) * this.rimA[k]!;
      const im = this.rims[k]!;
      if (a > 0.01) im.setVisible(true).setAlpha(a);
      else if (im.visible) im.setVisible(false);
    }
  }

  private renderRest(now: number): void {
    // numbered stones: gold digit (ok); moonlight-blue digit on a dimmed rock + soft shake (over),
    // repeated gently every 3 s while it stays over; dashed cool outline (blocked)
    const reducedM = motion.reduced;
    const cs0 = this.geom.cs;
    for (let k = 0; k < this.stoneCell.length; k++) {
      const i = this.stoneCell[k]!;
      const ok = Math.max(this.SOk.val[i]!, this.prevOk[i]!);
      const ov = Math.max(this.SOver.val[i]!, this.prevOver[i]!);
      const bl = this.SBlk.val[i]!;
      const x = this.cx(i);
      const y = this.cy(i) + this.pipY;
      const warm = this.pipWarm[k]!;
      if (ok > 0.01) warm.setVisible(true).setAlpha(ok * (reducedM ? 1 : 0.92 + 0.08 * Math.sin(now / 700 + k)));
      else if (warm.visible) warm.setVisible(false);
      const pt = (now - this.overT0[i]!) / 520;
      const pulse = pt >= 0 && pt < 1 && !reducedM ? Math.sin(Math.PI * pt) : 0;
      let dx = 0;
      if (ov > 0.5 && !reducedM) {
        const st = (now - this.overT0[i]!) % 3000;
        if (st >= 0 && st < 480) dx = Math.sin(st / 28) * cs0 * 0.045 * (1 - st / 480);
      }
      this.pipImg[k]!.setScale(1 + 0.28 * pulse).setAlpha(1 - Math.max(ov, ok)).setPosition(x + dx, y);
      warm.setScale(1 + 0.28 * pulse).setPosition(x + dx, y);
      const mo = this.pipOver[k]!;
      const mk = this.overMk[k]!;
      // v11: the over-full number itself (coral digit on a dimmed rock) is the one mark — the
      // "−lantern" tag beside it is gone (C6: border + ✕ + tag + thread at once), the line says why
      const fo = this.focus === "conflict" ? 0.5 : 1;
      if (ov > 0.01) mo.setVisible(true).setAlpha(ov * fo).setScale(1 + 0.28 * pulse).setPosition(x + dx, y);
      else if (mo.visible) mo.setVisible(false);
      if (mk.visible) mk.setVisible(false);
      const v = this.veil[k]!;
      if (ov > 0.01) v.setVisible(true).setAlpha(ov * fo * (reducedM ? 1 : 0.85 + 0.15 * Math.sin(now / 500))).setX(x + dx);
      else if (v.visible) v.setVisible(false);
      // r6 (5/8: "dashed rings on numbers — what do they mean?"): no standing outline on numbers
      // that can no longer be met; the stuck read-out marks the ONE that matters, after a pause
      void bl;
      const o = this.outline[k]!;
      if (o.visible) o.setVisible(false);
    }
    // stuck cells: crossed-out sparkle (slow breathe) + threads + one ping per blocker
    for (let i = 0; i < 64; i++) {
      const bv = this.BRing.val[i]!;
      const im = this.blk[i]!;
      if (bv > 0.01) {
        const ph = reducedM ? 1 : 0.8 + 0.2 * Math.sin(now / 600);
        const base = hasBit(this.stones, i) ? STONE_MARK_S : 1;
        im.setVisible(true).setAlpha(bv * ph).setScale(base * (reducedM ? 1 : 0.97 + 0.03 * Math.sin(now / 600)));
      } else if (im.visible) im.setVisible(false);
    }
    const ta = this.threadA.val[0]!;
    if (ta > 0.01 && this.threads.length > 0) {
      this.drawThreads(now);
      this.threadG.setVisible(true).setAlpha(ta * (reducedM || vis.p.increaseContrast ? 1 : 0.86 + 0.14 * Math.sin(now / 700)));
    } else if (this.threadG.visible) this.threadG.setVisible(false);
    for (let k = 0; k < this.pings.length; k++) {
      const p = this.pings[k]!;
      const t = (now - this.pingT0[k]!) / 700;
      if (this.pingStone[k]! >= 0 && t >= 0 && t < 1 && ta > 0.5) {
        p.setVisible(true).setAlpha(reducedM ? 1 - t : Math.sin(Math.PI * Math.min(1, t * 1.6)) * (1 - t * 0.4)).setScale(reducedM ? 1 : 0.8 + 0.35 * easeOutCubic(t));
      } else if (p.visible) p.setVisible(false);
    }
    // hint ghost + anchor
    if (this.hintMode === Hint.Ghost) {
      const t = now - this.hintT0;
      const gin = clamp01(t / 220);
      const bob = reducedM ? 0 : Math.sin(t / 420) * this.geom.cs * 0.025;
      this.ghostImg.setAlpha(gin * (reducedM ? 1 : 0.86 + 0.14 * Math.sin(t / 300))).setScale(reducedM ? 1 : 1 + 0.04 * Math.sin(t / 300)).setY(this.cy(this.ghostCell) - this.geom.cs * 0.03 + bob);
      // anchor: three soft pulses (~2.4 s), then a faint steady ring while the ghost stays
      const at = t / 800;
      const a = at < 3 ? (reducedM ? 1 : 0.35 + 0.65 * Math.sin(Math.PI * (at % 1))) : 0.35;
      this.anchorRing.setAlpha(gin * a).setScale(at < 3 && !reducedM ? 0.92 + 0.12 * Math.sin(Math.PI * (at % 1)) : 1);
    }
    // near-complete breathing (1200 ms)
    if (this.darkCells.length > 0) {
      const b = motion.reduced ? 0.7 : 0.25 + 0.6 * (0.5 - 0.5 * Math.cos((now / 1200) * Math.PI * 2));
      for (let k = 0; k < this.darkCells.length; k++) this.dark[k]!.setAlpha(b);
    }
    // conflict ✕: pops in with the light, then a calm breathe
    if (this.pairs.length > 0) {
      const xt = (now - this.linesT0) / 220;
      const n = Math.min(this.xs.length, this.pairs.length / 2);
      for (let k = 0; k < n; k++) {
        const x = this.xs[k]!;
        if (xt < 0) {
          x.setAlpha(0);
          continue;
        }
        const pop = motion.reduced ? 1 : easeOutBack(clamp01(xt));
        const fx = this.focus === "over" ? 0.5 : 1;
        x.setAlpha(fx * clamp01(xt * 2) * (motion.reduced ? 1 : 0.85 + 0.15 * Math.sin(now / 420))).setScale(0.5 + 0.5 * pop);
      }
    }
    // ring
    const rt = (now - this.ringT0) / 650;
    if (rt >= 0 && rt < 1) this.ring.setVisible(true).setAlpha(1 - rt).setScale(0.75 + 0.45 * easeOutCubic(rt));
    else if (this.ring.visible) this.ring.setVisible(false);
    // lanterns
    const cs = this.geom.cs;
    for (const r of this.rigs) {
      if (r.mode === Mode.Idle) continue;
      let x = r.tx;
      let y = r.ty;
      let sx = 1;
      let sy = 1;
      let lit = 1;
      if (r.mode === Mode.FlyIn) {
        const t = clamp01((now - r.t0) / 140);
        const e = easeOutCubic(t);
        x = lerp(r.fx, r.tx, e);
        y = lerp(r.fy, r.ty, e) - Math.max(cs * 0.9, Math.abs(r.ty - r.fy) * 0.18) * 4 * e * (1 - e);
        sx = sy = lerp(r.fs, 1, e);
        lit = 0.6 + 0.4 * e;
        if (t >= 1) {
          r.mode = Mode.Rest;
          r.landT = now;
        }
      } else if (r.mode === Mode.Rest) {
        const k = clamp01((now - r.landT) / 90);
        if (k < 1) {
          const e = easeOutCubic(k);
          sx = 1.15 - 0.15 * e;
          sy = 0.88 + 0.12 * e;
        }
      } else if (r.mode === Mode.Leave) {
        // round 4: a removed lantern goes "away": it sinks a little and fades (no lift)
        const t = Math.max(0, now - r.t0);
        const e = easeInCubic(clamp01(t / 260));
        x = r.fx;
        y = r.fy + cs * 0.42 * e;
        sx = sy = r.fs * (1 - 0.22 * e);
        lit = 1 - e;
        r.body.setAlpha(1 - e);
        if (t >= 260) {
          r.onArrive?.();
          r.onArrive = null;
          r.hide();
          continue;
        }
      }
      let rot = 0;
      const reducedR = motion.reduced;
      let dim = 1;
      if (r.wrong && r.mode === Mode.Rest) {
        // take-back preview: the lantern dims and sinks a little (no ghost copy), the coral minus badge breathes beside it
        const wt = now - r.wrongT0;
        const e = reducedR ? 1 : easeOutCubic(clamp01(wt / 380));
        y += cs * 0.13 * e + (reducedR ? 0 : Math.sin(wt / 520) * cs * 0.015);
        sx = sy = 1 - 0.08 * e;
        dim = 1 - 0.45 * e;
        lit = 1 - 0.6 * e;
        const ca = clamp01((wt - 150) / 250);
        this.takeBack
          .setPosition(x + cs * 0.36, r.ty - cs * 0.3)
          .setAlpha(ca * (reducedR ? 1 : 0.85 + 0.15 * Math.sin(wt / 300)))
          // R2 (P1-7): the minus badge stays level (a turning curl read as undo)
          .setRotation(0)
          .setScale(reducedR ? 1 : 1 + 0.06 * Math.sin(wt / 300));
        if (this.why) {
          const te = reducedR ? 1 : clamp01((wt - 250) / 420);
          const ee = easeOutCubic(te);
          if (ee !== this.whyE && (Math.abs(ee - this.whyE) > 0.001 || ee >= 1)) this.drawWhy(ee);
          this.whyG.setAlpha(reducedR ? 1 : 0.8 + 0.2 * Math.sin(wt / 400));
          const rt = ((wt - 670) % 1600) / 900;
          if (wt > 670 && rt < 1 && !reducedR) this.whyRing.setVisible(true).setAlpha(Math.sin(Math.PI * rt) * 0.9).setScale(0.8 + 0.3 * rt);
          else if (reducedR && te >= 1) this.whyRing.setVisible(true).setAlpha(0.8).setScale(1);
          else this.whyRing.setVisible(false);
        }
      }
      r.body.setAlpha(r.mode === Mode.Leave ? r.body.alpha : dim);
      // stuck read-out: the blamed lantern tilts back and forth and flickers
      if (r.blame && r.mode === Mode.Rest && !reducedR) {
        const bt = now - r.blameT0;
        if (bt > 0) rot = Math.sin(bt / 190) * 0.13 * (0.6 + 0.4 * Math.abs(Math.sin(bt / 900)));
      }
      // conflict arrival: one short shake
      const st = now - r.shakeT0;
      if (st >= 0 && st < 420 && !reducedR) x += Math.sin(st / 26) * cs * 0.06 * (1 - st / 420);
      // rim: cool = blamed by a stuck cell. v11 (C6): no coral rims any more — a conflict shows its ✕,
      // an over-full number its own coral digit; a rim on the lanterns too was one signal too many
      const coral = false;
      const kind = coral ? 2 : r.blame && r.mode === Mode.Rest ? 1 : 0;
      if (kind !== r.rimKind) {
        r.rimKind = kind;
        r.cool.setVisible(kind > 0);
        if (kind > 0) r.cool.setTexture(kind === 2 ? this.texKeys.coral : this.texKeys.cool);
      }
      r.overAdj = this.overNbr[r.cell] === 1;
      if (kind > 0) {
        const base = kind === 2 ? (r.conflict ? 0.8 : 0.5) : 0.75;
        r.cool.setPosition(x, y + cs * 0.04).setAlpha(reducedR ? base : base * (0.8 + 0.2 * Math.sin(now / 500)));
      }
      r.body.setPosition(x, y).setScale(sx, sy).setRotation(rot);
      if (r.face) this.renderFace(r, now, x, y, sx, sy, rot, r.mode === Mode.Leave ? r.body.alpha : r.mode === Mode.FlyIn ? lit : dim);
      // breathing flame (≈1.6 s); conflict / blamed = flicker
      let fa: number;
      let fsc: number;
      const flick = r.conflict || (r.blame && r.mode === Mode.Rest);
      if (reducedR) {
        fa = r.conflict ? 0.5 : flick ? 0.8 : 0.95;
        fsc = 1;
      } else if (flick) {
        // a fast (~7 Hz) flicker would alias at the governor's ambient rate: keep full rate meanwhile
        governor.keepAwake(200);
        // audit P1-8: the two lanterns that see each other burn darker (luminance, not hue)
        const n = Math.abs(Math.sin(now * 0.031 + r.phase) * Math.sin(now * 0.017 + r.phase * 2));
        fa = r.conflict ? 0.3 + 0.4 * n : 0.45 + 0.55 * n;
        fsc = 0.85 + 0.25 * n;
      } else {
        const b = Math.sin((now / 1600) * Math.PI * 2 + r.phase);
        fa = 0.88 + 0.12 * b;
        fsc = 1 + 0.06 * b;
      }
      const fy = y - cs * 0.02 * sy;
      r.flame.setPosition(x + Math.sin(rot) * cs * 0.05, fy).setScale(fsc * sx, fsc * 1.15 * sy).setAlpha(fa * lit);
      // v9 pool: the lantern's own light on the ground, a slow 0.8 Hz candle flicker (still under Reduce Motion)
      const flk = reducedR ? 1 : 0.94 + 0.06 * Math.sin(now * 0.00503 + r.phase) * Math.sin(now * 0.0031 + r.phase * 1.7) + 0.02 * Math.sin(now * 0.0117 + r.phase);
      r.halo.setPosition(x, y + cs * 0.03).setScale(sx * this.poolK * (1 + 0.48 * (this.glowBoost - 1))).setAlpha((r.moon ? 0.35 : r.wrong ? 0.15 : 1) * lit * flk);
      // contact shadow stays on the ground under the landing spot
      const shA = r.mode === Mode.FlyIn ? lit * lit : r.mode === Mode.Leave ? r.body.alpha : dim;
      r.shadow.setVisible(true).setPosition(x, r.ty + this.lanternH * 0.35).setScale(sx, 1).setAlpha(shA);
      if (r.moon && r.mode === Mode.Rest) {
        const ra = reducedR ? 0.9 : 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(now / 420 + r.phase));
        r.ring.setVisible(true).setPosition(r.tx, r.ty + cs * 0.03).setAlpha(ra);
      } else if (r.ring.visible) r.ring.setVisible(false);
    }
  }

  // ---------------------------------------------------------------- v12 lantern faces (Wick, A4)

  /** Lantern faces on / off (Settings "lantern faces"; the scene turns them on after the first frame). */
  setFaces(on: boolean): void {
    if (on === this.faces) return;
    this.faces = on;
    if (!on) for (const r of this.rigs) r.face?.setVisible(false);
    if (!this.busy && this.stateRef) this.render(this.scene.time.now);
  }

  get facesOn(): boolean {
    return this.faces;
  }

  /** The game dozes (long idle): the faces close their eyes; any move wakes them. */
  setDoze(on: boolean): void {
    this.doze = on;
  }

  /** Every lantern smiles now (the solved moment without the wave: Reduce Motion, tutorial). */
  smile(now: number): void {
    this.happyAt.fill(now);
  }

  /** Which face a lantern shows now (tests / shots). */
  faceOf(cell: number): FaceExpr | null {
    const r = this.rigAt(cell);
    if (!r || !this.faces) return null;
    return this.faceFor(r, this.scene.time.now).expr;
  }

  private faceFor(r: Rig, now: number): { expr: FaceExpr; look: number } {
    if (r.conflict) {
      // the two lanterns that see each other look at each other (a column partner: straight on)
      const p = this.partnerOf(r.cell);
      const dx = p >= 0 ? (p & 7) - (r.cell & 7) : 0;
      return { expr: "worried", look: Math.sign(dx) };
    }
    if (r.blame && r.mode === Mode.Rest) return { expr: "worried", look: 0 };
    if (now >= this.happyAt[r.cell]!) return { expr: "happy", look: 0 };
    if (this.doze) return { expr: "sleepy", look: 0 };
    if (r === this.blinkRig && now - this.blinkT0 < 140) return { expr: "sleepy", look: 0 };
    return { expr: "idle", look: 0 };
  }

  private renderFace(r: Rig, now: number, x: number, y: number, sx: number, sy: number, rot: number, a: number): void {
    const im = r.face!;
    if (!this.faces || r.mode === Mode.Idle) {
      if (im.visible) im.setVisible(false);
      return;
    }
    // one blink at a time across the board, every 2.8–5.5 s (a texture swap: reads the same at 20 fps)
    if (now >= this.nextBlink && r.mode === Mode.Rest && !motion.reduced && Math.random() < 0.4) {
      this.blinkRig = r;
      this.blinkT0 = now;
      this.nextBlink = now + 2800 + Math.random() * 2700;
    }
    const f = this.faceFor(r, now);
    const key = this.bank.lanternFace(this.faceW, f.expr, f.look);
    if (im.texture.key !== key) im.setTexture(key);
    im.setVisible(true).setPosition(x, y).setScale(sx, sy).setRotation(rot).setAlpha(a);
  }

  /**
   * v11: a throwaway board (the tutorial's small yards): its display objects go first, then its
   * baked textures (courtyard, lit floor, composite) — nothing is left drawing from a removed one.
   */
  destroy(): void {
    this.litTimer?.remove();
    this.litTimer = null;
    this.finResolve?.();
    this.finResolve = null;
    this.root.destroy();
    for (const k of [this.baseKey, this.compKey, this.litKey]) if (k) this.bank.remove(k);
    this.baseKey = "";
    this.compKey = "";
    this.litKey = "";
  }

  /** v11: which error leads (the other one's marks rest at half strength). */
  setFocus(f: "conflict" | "over" | null): void {
    this.focus = f;
  }

  /** Kept for callers (v8 flowers / lit-tile zoom); v9 has no flowers and light does not scale. */
  setScales(_flower: number, _lit: number): void {}

  get state(): BoardState | null {
    return this.stateRef;
  }
}
