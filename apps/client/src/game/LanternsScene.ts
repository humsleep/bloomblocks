// The one and only scene. Portrait, one-handed, text-free (digits only):
//   top     gear (settings sheet), dusk sky, the village on the far hill (one light per
//           solved gentle house; tap → the town street, lazy ../town), the current house
//           (its windows = progress, its number plate = the level number)
//   far     round 5: the deduce track is a PLACE — a tall tower on the far ridge (left),
//           its windows light as deduce levels are cleared; tap → the camera travels to the
//           tower's courtyard (the tower stands where the house was, starrier boards). From
//           there the home house sits on the far hill (right); tap → travel back.
//   middle  on the near hill: the street icon (left; the daily's home button there),
//           undo + the hint lantern (right)
//   sky     the moon shows today's real phase and opens the daily (lazy ./daily.ts)
//   bottom  the courtyard board (pips rules), as wide as the screen allows
// Completion is a ~2 s sequence (tap anywhere to skip: a chevron shows the way)
// that carries the courtyard's light into the house window; the house walks off
// to the left and the next one slides in from the right.
// First run: a wordless ghost-finger guide on gentle 1–3 (Guide.ts), starting with
// the goal card (a tiny yard lit up fully → the house's windows glow).
// Phase 5 (BENCHMARK-UX): the "this alley" strip over the house (the current block of ten, the
// finale marked; on the tower a column of floors); after gentle 5 / 10 / 15 … a 2.5 s visit to the
// street where the new lamp / landmark lights up; the finale then waits at the "board away" beat
// for the ads slot (ads.beforeNextBoard) before the next board comes in. One role per HUD button:
// the left one is always the street (dimmed on the daily), the daily's way out is its own chip
// beside the gear. The daily's result sheet v2 closes into a quiet 3 s night beat; on the 2nd
// counted day it asks (soft card first) about a daily reminder (src/notify).
import type PhaserTypes from "phaser";
import Phaser from "../phaser.ts";
import { type HouseSpec, towerFor } from "../render/house.ts";
import { lanternHouseFor } from "../render/village/lanternHouse.ts";
import { BG_HEX, PAL, UI } from "../render/palette.ts";
import { TextureBank } from "../render/textures.ts";
import { BoardView, type BlockedView, type FlightEnds, type StuckStoneView, type SyncResult, type WhyView } from "./BoardView.ts";
import {
  type BlockedCell, blockedCells, type BoardAnalysis, cannotReach, culpritOf, dailyNumber, floorNeighbours, moonPhase, hasBit, index, moveCells, NO_CLUE, type PipsState, raysOf,
  seeingPair, solutionOf, startCells, type StoneStatus, stepHint,
} from "./pipsApi.ts";
import { clock, localDateISO } from "./session.ts";
import type { PlanCtx } from "../notify/index.ts";
import { reminderMinute } from "../notify/plan.ts";
import type { DailyClock, DailyState } from "./daily.ts";
import {
  ambientForLevel, cue, getNumberStyle, getShareTime, GUIDE, guideDone, haptic, hapticsEnabled, isMuted, markGuide, pitchIndexForCell, sessionCount, setHaptics,
  setNumberStyle, setShareTime, toggleMuted,
} from "./feedback.ts";
import { getLanternFaces, loadLanternFaces, setLanternFaces } from "./feedback.ts";
import { ResultSheet } from "./ResultSheet.ts";
import { vis, type VisPrefs } from "../render/vis.ts";
import { adsApi, type UnitInfo } from "./adsHooks.ts";
import { PlayTimer } from "./playTimer.ts";
import { lazyRetry } from "./lazy.ts";
import { a11y, A11yLayer, type Ctl } from "./a11yLayer.ts";
import { Guide } from "./Guide.ts";
import { SettingsSheet } from "./SettingsSheet.ts";
import { clamp01, easeInCubic, easeInOutCubic, easeOutCubic, lerp, motion } from "./motion.ts";
import { DEPTH, Scenery } from "./Scenery.ts";
import type { Session } from "./session.ts";
import { syncSignal } from "../sync/signal.ts";
import type { SyncHost } from "../sync/local.ts";
import type { AdScreen } from "./adsHooks.ts";
import { flush } from "../save/store.ts";
import { PRIVACY_POLICY_URL } from "../legal.ts";
import { openExternal } from "../native/external.ts";
import { AskCard, type AskSpec } from "./AskCard.ts";
import { drawAlleyHouse, drawBackDisc, drawBell, drawClock, drawGearDisc, drawLampMark, drawRulesDisc, drawTodayDisc, drawTowerFloor, drawVillageDisc } from "./hudArt.ts";
import { DIGIT_FONT, drawBreakChip as drawBreakChipArt, drawCalendarTile } from "../render/draw.ts";
import { Preferences } from "@capacitor/preferences";
import { alleyOf, giftEarned, milestoneOf, monthStrip, streakMilestone, towerOpen } from "./progress.ts";
import type { SheetExtras } from "./ResultSheet.ts";
import { ambient, governor } from "./frameGovernor.ts";
import { BigWord, LineBand } from "./LineBand.ts";
import { dailyMoment, type HappyMoment, houseMoment, rating } from "./rating.ts";
import { makeText, primaryButton, styleText, uiFont } from "./uiText.ts";

export interface SafeInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface SceneDeps {
  session: Session;
  dpr: number;
  /** Safe-area insets in CSS px (the canvas is full-screen; we lay out inside them). */
  safe: SafeInsets;
  /** Called once after the first board draw with input enabled. */
  onInteractive: () => void;
  /** Called after every confirmed move (ads init is deferred to the first one). */
  onMove: (kind: "placed" | "removed" | "complete") => void;
}

interface Geo {
  u: number;
  W: number;
  H: number;
  cs: number;
  gap: number;
  pad: number;
  bcx: number;
  bcy: number;
  boardTop: number;
  side: number;
  /** centre y of the hint / track buttons */
  ctrlY: number;
  ctrlS: number;
  houseBaseY: number;
  crestY: number;
  houseMaxW: number;
  houseMaxH: number;
  /** R2: the message slot between the HUD row and the board (captions + band / "Solved!" / "Next house →"), px */
  slotH: number;
}

/** Completion timeline (ms from the final tap). */
interface Finale {
  t0: number;
  origin: number;
  waveAt: number;
  flowAt: number;
  heartAt: number;
  riseAt: number;
  outAt: number;
  inAt: number;
  endAt: number;
  fired: number;
  advanced: boolean;
  reduced: boolean;
  /** waiting at the swap for the worker's next level (never generated on the main thread here) */
  hold: boolean;
  /** where the new house starts its slide (the incoming silhouette's spot after a hold), px */
  inFrom: number;
  /** the finished unit, for the ads natural break */
  unit: UnitInfo;
  /** failed next-level generations during this hold; `fallback` = give up, replay the solved level */
  retries?: number;
  fallback?: boolean;
  /** phase 5: the gentle level whose milestone the street visit shows (0 = none) */
  visit: number;
  /** the "board away" beat's gates (street visit, ads slot): not started / running / done */
  gate: "idle" | "running" | "done";
  /** the player tapped to skip: the next board hurries in once the gates are through */
  quick: boolean;
  /** the ads slot ran through ads.beforeNextBoard (else the old onUnitComplete after the swap) */
  adsGated: boolean;
  /** V's board.playFinale has finished (the house / board exit waits for it) */
  finDone: boolean;
  /** v11 (NOVICE-TEST C12 / D2): gentle 1–3 wait at the exit beat for "Next house →" (no auto-advance) */
  needNext: boolean;
  nextTapped: boolean;
}

/** the ads slot never holds the next board longer than this */
const ADS_GATE_MAX_MS = 185_000;
/** the daily's closing night beat */
const NIGHT_MS = 3000;
/** V's finale (docs/phase2-plan.md "Requests to V"), duck-typed */
type FinaleKind = "level" | "alley" | "daily";

const F_WAVE = 1;
const F_FLOW = 2;
const F_HEART = 4;
const F_RISE = 8;
const F_ADV = 16;
/** next-level generation attempts retried during a finale hold before falling back */
const FINALE_RETRIES = 2;

/**
 * Stuck read-out delay (ms of no input; any input cancels it). Phase 2 (audit P1-9, Claire): it
 * appeared 250 ms after the last lantern and spoiled the "aha" — now 0.9 s in every case.
 */
const BLOCKED_IDLE_MS = 900;
/** v11 (NOVICE-TEST D2): gentle 1…this many wait for "Next house →" instead of moving on by themselves. */
const NEXT_BUTTON_UPTO = 3;
/**
 * v11 (NOVICE-TEST D5): the daily's "today" button waits until this many gentle boards are solved.
 * R2 (decision A7): 3 — right after gentle 3 a small card offers the first daily once ("dailyOffer");
 * the "today" pointer (the finger's one-time tap on the button) comes one board later, after the card.
 */
const DAILY_AFTER = 3;
/** HUD fade during camera moves (audit P0-2). */
const HUD_FADE_MS = 150;
/** R2 (A1): the top HUD row — disc size and its centre below the safe top (pt). Captions sit under the discs. */
const TOP_DISC = 40;
const TOP_Y = 26;
/** R2: during the solved moment the whole HUD rests at this one opacity (not a mix of "disabled" buttons) */
const HUD_REST = 0.4;
/** The guide comes back after this much idle time when a stray tap stopped it (ms). v11: 6 s (2.5 s
 *  came back while a 60-year-old was still reading — NOVICE-TEST §5-A). */
const GUIDE_IDLE_MS = 6000;
/** Track switch: board + house out, swap, back in (ms). */
const SW_OUT = 300;
const SW_IN = 380;

/** Travel between the house and the tower: camera flies in to the landmark, swap, flies out (ms). */
const TRAVEL_IN = 520;
const TRAVEL_OUT = 560;
const TRAVEL_ZOOM = 2.4;
/** First unlock of the tower: a 1.5 s look over to it while it lights up. */
const REVEAL_MS = 1500;

/** v11 error line kinds (NOVICE-TEST §5-C); "stuck" = a dead end, explained by the stuck read-out itself. */
type BoardError = { kind: "conflict" | "over" | "zero" | "numbers" | "early" | "stuck"; at: number; n?: number };

type Down = "none" | "tut" | "howBtn" | "howSheet" | "gear" | "hint" | "left" | "today" | "far" | "village" | "undo" | "moon" | "brk" | "back" | "alley" | "cell" | "sheet" | "card" | "ask" | "swallow";
type DailyMod = typeof import("./daily.ts");
type TownMod = { openTown?: (scene: PhaserTypes.Scene, opts: { onClose: () => void; visit?: { n: number } }) => void };
/** The town street (another agent's module): optional at build time — the glob is empty when it does not exist. */
const TOWN = import.meta.glob<TownMod>("../town/index.ts");
const townLoader = TOWN["../town/index.ts"];
/** R2 village (src/village): its entry is a lazy chunk too — nothing of it on the cold-start path. */
const villageLoader = lazyRetry(() => import("../village/index.ts"));

export class LanternsScene extends Phaser.Scene {
  private deps!: SceneDeps;
  private u = 1;
  private bank!: TextureBank;
  private board!: BoardView;
  private scenery!: Scenery;
  private hintBtn!: PhaserTypes.GameObjects.Image;
  /** left of the controls: the street icon (opens the town), or on the daily the way home */
  private leftBtn!: PhaserTypes.GameObjects.Image;
  private undoBtn!: PhaserTypes.GameObjects.Image;
  /** the daily's calendar tile (today's day of month + moon phase) */
  private calImg!: PhaserTypes.GameObjects.Image;
  /** camera travel house ↔ tower (and the first-unlock look at the tower) */
  private travel: { t0: number; kind: "go" | "reveal"; tx: number; ty: number; ready: boolean; swapped: boolean; inT0: number; faded: boolean } | null = null;
  private townOpen = false;
  /**
   * Fixed UI camera: the HUD (gear, undo, hint, street / home, calendar tile, settings sheet,
   * result card) is drawn by this camera only, so the world camera's zoom / pan (tower
   * reveal, house ↔ tower travel) never moves it out of the safe area. Every other object is
   * drawn by the main camera only (filtered as it is added to the scene).
   */
  private uiCam!: PhaserTypes.Cameras.Scene2D.Camera;
  private hud = new Set<PhaserTypes.GameObjects.GameObject>();
  // daily (module loaded on first need)
  private dm: DailyMod | null = null;
  private ds: DailyState | null = null;
  private clock: DailyClock | null = null;
  /** the daily's result: a bottom sheet (phase 2; the board shrinks into the space above it) */
  private card: ResultSheet | null = null;
  /** 0 → 1: the board's move into the space above the result sheet */
  private cardK = 0;
  /** HUD opacity: 0 while the camera moves (tower reveal / travel / switch / town) */
  private hudA = 1;
  private hudT = 0;
  /** when the current level started (ads: play seconds of the finished unit) */
  /** real play time of the level (ads pacing): foreground frames on the board only */
  private play = new PlayTimer();
  /** ad-break chip after a unit (moon + pause), until the next move or 8 s */
  private breakChip!: PhaserTypes.GameObjects.Image;
  private breakT0 = -1e9;
  private replayPending = false;
  private visOff: (() => void) | null = null;
  /** "idle" | the one wrong lantern awaiting the second tap | a ghost on the board */
  private hintState: { kind: "idle" } | { kind: "remove"; cell: number; remaining: number } | { kind: "ghost" } = { kind: "idle" };
  /** beads on the hint button after a lift: wrong lanterns still left (cleared by the next move) */
  private hintDots = 0;
  private hintPulseT0 = -1e9;
  /** v14 (mock g): the hint disc's attention state — after a quiet spell on an unsolved board */
  private hintAttn = false;
  private lastInput = 0;
  private blockedShown = false;
  private blockedCache: { state: PipsState | null; list: BlockedCell[] } = { state: null, list: [] };
  private guide!: Guide;
  private sheet!: SettingsSheet;
  private trackNudgeT0 = -1e9;
  private chevron!: PhaserTypes.GameObjects.Image;
  private chevronT0 = -1e9;
  private houseArriveT0 = -1e9;
  private switching: { t0: number; swapped: boolean; ready: boolean; inT0: number; after: (() => void) | null } | null = null;
  private geo!: Geo;
  private house: HouseSpec | null = null;
  private gearIcon!: PhaserTypes.GameObjects.Image;
  private downCell = -1;
  private down: Down = "none";
  private finale: Finale | null = null;
  private nearDark = false;
  private boardSlide = 0;
  private tmpPts: number[] = [];
  private decorated = false;
  // perf sampling (ring buffers, no per-frame allocation)
  private frameDt = new Float32Array(600);
  private renderMs = new Float32Array(600);
  private updateMs = new Float32Array(600);
  private frameN = 0;
  private renderT0 = 0;
  private perfT0 = 0;
  // phase 5
  /** the alley strip (10 cells), the lamp mark between 5 and 6, the breathing glow on the current cell */
  private alley: PhaserTypes.GameObjects.Image[] = [];
  private alleyLamp!: PhaserTypes.GameObjects.Image;
  private alleyGlow!: PhaserTypes.GameObjects.Image;
  private alleyBox = { x: 0, y: 0, w: 0, h: 0, on: false, cur: -1 };
  /** the daily's way out (beside the gear) */
  private backChip!: PhaserTypes.GameObjects.Image;
  /** the far home's breathing halo (tower screen) */
  private farGlow!: PhaserTypes.GameObjects.Image;
  private ask!: AskCard;
  private askAct: { yes: () => void; no: () => void } | null = null;
  /** the daily's closing night beat */
  private night: { t0: number; left: boolean } | null = null;
  private nightVeil!: PhaserTypes.GameObjects.Image;
  /** a milestone visit is on screen (the street, opened by the finale) */
  private visiting = false;
  /** gentle levels whose street visit already played (a replayed finale does not visit again) */
  private visited = 0;
  /** a move happened in this launch (ads are initialised after the first one) */
  private moved = false;
  /** v11 (D1): captions under the HUD icons (made after the first frame) */
  private caps: { t: PhaserTypes.GameObjects.Text; of: PhaserTypes.GameObjects.Image; key: string; dy: number }[] = [];
  /** v11: the "?" button beside the gear and its How-to-play sheet (lazy ./HowToSheet.ts) */
  private howBtn!: PhaserTypes.GameObjects.Image;
  private howTo: import("./HowToSheet.ts").HowToSheet | null = null;
  private loadHowTo = lazyRetry(() => import("./HowToSheet.ts"));
  private howPulseT0 = -1e9;
  private howNudged = "";
  /** v11: the first-yard tutorial (lazy ./Tutorial.ts); `tutWanted` hides board + HUD until it is in */
  private tut: import("./Tutorial.ts").Tutorial | null = null;
  private tutWanted = false;
  private tutLoading = false;
  private tutEndT0 = -1e9;
  private loadTutorial = lazyRetry(() => import("./Tutorial.ts"));
  /** v11: the guidance band (error line / hint line / tutorial) and the big one-word moment */
  private band!: LineBand;
  private bigWord!: BigWord;
  /** the error line: kinds already explained on this board (once each), the board they belong to */
  private errSeen = new Set<string>();
  private errBoard = "";
  /** what the band shows now: an error line (its kind), a hint line, a stone-tap line, or nothing */
  private bandFor: "" | "err" | "hint" | "stone" | "lesson" = "";
  private errKindShown = "";
  private stoneLineT0 = -1e9;
  private errCache: { state: PipsState | null; err: BoardError | null } = { state: null, err: null };
  /** what the flow did, in order (tests / logs): "out", "visit", "ads", "in" */
  readonly flowLog: string[] = [];
  /** v12 (Wick, A4): the hero on the bottom stepping stone (lazy ./WickActor.ts, after the first frame) */
  private wick: import("./WickActor.ts").WickHero | null = null;
  private loadWick = lazyRetry(() => import("./WickActor.ts"));
  /** the "lantern faces" setting has been read (faces stay off until then: nothing baked at boot) */
  private facesReady = false;

  constructor() {
    super("lanterns");
  }

  init(deps: SceneDeps): void {
    this.deps = deps;
    this.u = deps.dpr;
  }

  create(): void {
    const tCreate = performance.now();
    this.uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height, false, "ui");
    this.events.on("addedtoscene", (go: PhaserTypes.GameObjects.GameObject) => {
      if (!this.hud.has(go)) this.uiCam.ignore(go);
    });
    this.bank = new TextureBank(this);
    this.scenery = new Scenery(this, this.bank);
    this.board = new BoardView(this, this.bank);
    this.board.root.setDepth(DEPTH.board);
    this.gearIcon = this.add.image(0, 0, "__DEFAULT").setDepth(DEPTH.hud).setAlpha(0.72);
    // v11: "?" (How to play) beside the gear; its texture is baked after the first frame (decorate)
    this.howBtn = this.add.image(0, 0, "__DEFAULT").setDepth(DEPTH.hud).setVisible(false);
    // ambient(): the soft breathe of "remove" (a tap's pulse runs at full rate: input wakes the governor)
    this.hintBtn = ambient(this.add.image(0, 0, "__DEFAULT").setDepth(DEPTH.hud));
    this.leftBtn = this.add.image(0, 0, "__DEFAULT").setDepth(DEPTH.hud);
    this.undoBtn = this.add.image(0, 0, "__DEFAULT").setDepth(DEPTH.hud);
    this.calImg = this.add.image(0, 0, "__DEFAULT").setDepth(DEPTH.hud).setVisible(false);
    // r6: the daily's visible entry — today's calendar tile beside the street button (the moon stays a second way in)
    this.todayGlow = ambient(this.add.image(0, 0, "__DEFAULT").setDepth(DEPTH.hud).setBlendMode(Phaser.BlendModes.ADD).setVisible(false));
    this.todayBtn = this.add.image(0, 0, "__DEFAULT").setDepth(DEPTH.hud).setVisible(false);
    this.chevron = this.add.image(0, 0, "__DEFAULT").setDepth(DEPTH.hud).setVisible(false);
    this.breakChip = this.add.image(0, 0, "__DEFAULT").setDepth(DEPTH.hud).setVisible(false);
    this.guide = new Guide(this, this.bank, this.board);
    this.guide.onGoalWindows = (on) => {
      const now = this.time.now;
      if (on) {
        this.scenery.setProgress(99, now, true);
        this.scenery.lightHeart(true, now, true);
      } else this.redraw();
    };
    this.sheet = new SettingsSheet(this, this.bank);
    this.alleyGlow = ambient(this.add.image(0, 0, "__DEFAULT").setDepth(DEPTH.hud).setBlendMode(Phaser.BlendModes.ADD).setVisible(false));
    for (let i = 0; i < 10; i++) this.alley.push(this.add.image(0, 0, "__DEFAULT").setDepth(DEPTH.hud).setVisible(false));
    this.alleyLamp = this.add.image(0, 0, "__DEFAULT").setDepth(DEPTH.hud).setVisible(false);
    this.backChip = this.add.image(0, 0, "__DEFAULT").setDepth(DEPTH.hud).setVisible(false);
    this.farGlow = ambient(this.add.image(0, 0, "__DEFAULT").setDepth(DEPTH.town).setBlendMode(Phaser.BlendModes.ADD).setVisible(false));
    this.nightVeil = this.add.image(0, 0, "__DEFAULT").setOrigin(0, 0).setDepth(DEPTH.motes + 0.5).setVisible(false);
    this.ask = new AskCard(this, this.bank, 40);
    // v11: the one shown line (why a move broke a rule / what a hint means) and the big "Solved!"
    this.band = new LineBand(this, this.bank, DEPTH.hud + 2);
    this.bigWord = new BigWord(this, DEPTH.hud + 2);
    this.markHud([...this.band.objects, ...this.bigWord.objects]);
    this.markHud([
      this.gearIcon, this.howBtn, this.hintBtn, this.leftBtn, this.undoBtn, this.calImg, this.todayGlow, this.todayBtn, this.breakChip, ...this.sheet.objects,
      this.alleyGlow, ...this.alley, this.alleyLamp, this.backChip, ...this.ask.objects,
    ]);
    // iOS text size / bold / contrast changed: re-bake what depends on them (rare; a relayout)
    this.visOff = vis.onChange((p, prev) => this.onVis(p, prev));
    this.events.once("destroy", () => this.visOff?.());

    this.input.on("pointerdown", (p: PhaserTypes.Input.Pointer) => {
      this.lastInput = this.time.now;
      if (this.townOpen) {
        this.down = "swallow";
        return;
      }
      if (this.tutOn) {
        this.down = "tut";
        this.tut?.down(p.x, p.y);
        return;
      }
      this.hideBlocked();
      this.downCell = -1;
      // the tower's first-unlock look is not something the player asked for: a touch hands the
      // board back at once (the look comes again at the next quiet moment if the tower was not lit yet)
      if (this.travel?.kind === "reveal") this.cancelReveal();
      // audit P0-2: no input while the camera moves (the HUD is fading out / away)
      if (this.travel || this.switching) {
        this.down = "swallow";
        return;
      }
      if (this.ask.isOpen) {
        this.down = "ask";
        return;
      }
      if (this.howTo?.isOpen) {
        this.down = "howSheet";
        this.howTo.down(p.x, p.y);
        return;
      }
      if (this.night) {
        // a touch ends the night beat at once
        this.down = "swallow";
        this.endNight();
        return;
      }
      if (this.sheet.isOpen) {
        this.down = "sheet";
        return;
      }
      if (this.card?.isOpen) {
        this.down = "card";
        return;
      }
      if (this.guide.active?.kind === "goal") {
        // the goal card covers the courtyard: a tap only closes it (never places a lantern under it)
        this.stopGuideOnTouch();
        this.down = "swallow";
        return;
      }
      this.down = this.hitAt(p.x, p.y);
      this.stopGuideOnTouch();
      if (this.down === "cell") this.downCell = this.finale || this.switching || this.travel ? -1 : this.cellAt(p.x, p.y);
    });
    this.input.on("pointerup", (p: PhaserTypes.Input.Pointer) => {
      this.lastInput = this.time.now;
      if (this.townOpen) {
        this.down = "none";
        return;
      }
      if (this.down === "tut") {
        this.down = "none";
        this.tut?.up(p.x, p.y);
        return;
      }
      if (this.down === "ask") {
        this.down = "none";
        this.onAsk(p.x, p.y);
        return;
      }
      if (this.down === "howSheet") {
        this.down = "none";
        const h = this.howTo?.up(p.x, p.y) ?? "outside";
        if (h === "close" || h === "outside") {
          cue("tap");
          this.closeHowTo();
        } else if (h === "replay") {
          cue("tap");
          this.closeHowTo();
          void this.startTutorial(true);
        }
        return;
      }
      if (this.down === "sheet") {
        this.down = "none";
        this.onSheet(p.x, p.y);
        return;
      }
      if (this.down === "card" || this.down === "swallow") {
        const was = this.down;
        this.down = "none";
        if (was === "card") this.onCard(p.x, p.y);
        return;
      }
      if (this.finale) {
        const f = this.finale;
        if (f.needNext && !f.nextTapped) {
          // gentle 1–3: only "Next house →" goes on; any other tap just hurries the finale to it
          if (this.nextT0 >= 0 && this.nextHit(p.x, p.y)) {
            cue("tap");
            f.nextTapped = true;
            this.hideNext();
            this.finishFinale(true);
          } else if (!f.finDone) this.hurryToNext();
          return;
        }
        cue("tap");
        this.finishFinale(true);
        return;
      }
      const hit = this.hitAt(p.x, p.y);
      if (this.down === "gear" && hit === "gear") this.openSheet();
      else if (this.down === "howBtn" && hit === "howBtn") void this.openHowTo();
      else if (this.down === "hint" && hit === "hint") this.onHint();
      else if (this.down === "left" && hit === "left") this.onLeft();
      else if (this.down === "far" && hit === "far") this.onFar();
      else if (this.down === "village" && hit === "village") this.openTownLazy();
      else if (this.down === "undo" && hit === "undo") this.onUndo();
      else if (this.down === "moon" && hit === "moon") this.onMoon();
      else if (this.down === "today" && hit === "today") this.onMoon();
      else if (this.down === "brk" && hit === "brk") this.onBreak();
      else if (this.down === "back" && hit === "back") this.onBack();
      else if (this.down === "alley" && hit === "alley") this.openTownLazy();
      else if (this.down === "cell" && !this.switching && !this.travel) {
        const c = this.cellAt(p.x, p.y);
        if (c >= 0 && c === this.downCell) this.onCellTap(c & 7, c >> 3);
      }
      this.downCell = -1;
      this.down = "none";
    });
    this.input.on("pointermove", (p: PhaserTypes.Input.Pointer) => {
      if (this.down === "howSheet" && p.isDown) this.howTo?.move(p.x, p.y);
    });
    this.game.events.on("prerender", () => {
      this.renderT0 = performance.now();
    });
    this.game.events.on("postrender", () => {
      if (governor.lastStepFull) this.renderMs[this.frameN % 600] = performance.now() - this.renderT0;
    });

    // v11: a brand-new player starts in the first-yard tutorial — board and HUD wait hidden (nothing
    // extra is drawn or baked for it before the first frame; its chunk loads after it)
    this.tutWanted = this.firstRunTutorial();
    if (this.tutWanted) this.hudA = 0;
    this.layout();
    this.scenery.setMoon(moonPhase(localDateISO()));
    this.lastInput = this.time.now;
    const s = this.deps.session;
    if (s.complete) {
      // Killed between the last move and level end: replay the finale.
      const last = s.restoredLastMove ? index(s.restoredLastMove.x, s.restoredLastMove.y) : this.anyLantern();
      this.startFinale(last, 0, this.time.now + 450);
    } else if (s.restoredLastMove) this.board.pulse(index(s.restoredLastMove.x, s.restoredLastMove.y), this.time.now);
    console.info(`[boot] scene create (sky/board bake) ${Math.round(performance.now() - tCreate)} ms`);
    this.deps.onInteractive();
  }

  /** After the first presented frame: house, particles, worker prefetch. */
  decorate(): void {
    if (this.decorated) return;
    this.decorated = true;
    this.decoratedAt = this.time.now;
    const t0 = performance.now();
    this.bakeHowBtn();
    this.makeCaptions();
    this.scenery.decorate();
    this.placeHouse();
    this.scenery.setTown(this.deps.session.cleared("gentle"), false, this.time.now);
    this.refreshFar(false);
    this.redraw();
    ambientForLevel(this.deps.session.levelNumber);
    // v12 (Wick): lantern faces + the hero, after the first frame (Settings "lantern faces", default on)
    // R2 (A7): has the first-daily offer been shown (or the daily opened) already?
    void Promise.all([Preferences.get({ key: "dailyOffer" }), Preferences.get({ key: "dailyIntro" })])
      .then(([o, i]) => (this.offerSeen = o.value === "1" || i.value === "1"))
      .catch(() => (this.offerSeen = true));
    // R2 (A2): any full-screen ad in this session keeps the rating ask away
    adsApi.onFullscreen((open) => {
      if (open) rating.noteAd();
    });
    void loadLanternFaces().then(() => {
      this.facesReady = true;
      this.applyFaces();
    });
    // resumed straight into today's daily → its clock; otherwise learn (lazily) whether today's daily is done
    if (this.deps.session.daily) void this.enterDailyPlay();
    else setTimeout(() => void this.refreshMoon(), 1500);
    // phase 4: the iCloud mirror, its own chunk, well after the first frame (never on the launch path)
    syncSignal.onStatus = () => {
      if (this.sheet.isOpen) this.sheet.setCloud(syncSignal.status);
    };
    // a first run (nothing played yet): the goal card may wait up to 1.5 s for a returning player's
    // iCloud restore (only while iCloud is there and its first delivery is due), and the mirror starts now
    const firstRun = this.deps.session.levelOf("gentle") === 1 && this.deps.session.moves.length === 0 && !guideDone(GUIDE.goal);
    if (firstRun) syncSignal.holdUntil = performance.now() + 1500;
    setTimeout(() => {
      void import("../sync/index.ts").then((m) => m.startSync(this.syncHost())).catch((e: unknown) => {
        syncSignal.initial = "done";
        console.info("[sync] not started", e);
      });
    }, firstRun ? 0 : 1000);
    // R2 village: warm its code (scene, art kit, this language's lines) and pre-bake its backdrop, so a tap
    // on the Village disc only blits (gate G5: village open). Never on the launch path, and only in a truly
    // idle moment — the governor at its ambient rate (no input / motion for 1.5 s) and the browser idle:
    // a bake in the middle of play cost frames (smoke "full rate after a tap") and shifted the daily's
    // timing (e2e sync / daily, verify 2026-10-18).
    const idle = (): boolean => {
      const g = governor.state();
      return (!g.installed || g.mode !== "full") && !this.townOpen && !this.deps.session.daily && !this.ask.isOpen;
    };
    const ric = (f: () => void): void => {
      const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
      if (w.requestIdleCallback) w.requestIdleCallback(f, { timeout: 2000 });
      else setTimeout(f, 0);
    };
    const tryWarm = (): void => {
      if (!idle()) {
        setTimeout(tryWarm, 2_000);
        return;
      }
      ric(() => {
        if (!idle()) return void setTimeout(tryWarm, 2_000);
        const s = this.deps.session;
        const progress = async (): Promise<{ cleared: { gentle: number; deduce: number }; dailyDates: string[]; today: string }> => {
          const log = await this.daily().then((m) => m.loadLog()).catch(() => ({}));
          return { cleared: { gentle: s.cleared("gentle"), deduce: s.cleared("deduce") }, dailyDates: Object.keys(log), today: localDateISO() };
        };
        void villageLoader().then((m) => m.prewarmVillage(a11y.lang(), progress, idle)).catch(() => undefined);
      });
    };
    setTimeout(tryWarm, firstRun ? 20_000 : 8_000);
    // VoiceOver layer + iOS text size / bold / contrast / reduce motion (agent A), off the cold-start path
    try {
      this.a11y = new A11yLayer(this.u);
      this.a11y.init(this.game.canvas);
      vis.attach(a11y);
      a11y.onChange(() => this.a11y?.invalidate());
    } catch (e) {
      console.warn("[a11y] init failed", e);
      this.a11y = null;
    }
    console.info(`[boot] decorate (house/particles) ${Math.round(performance.now() - t0)} ms`);
  }

  private anyLantern(): number {
    const st = this.deps.session.state;
    for (let i = 0; i < 64; i++) if (hasBit(st.lanterns, i)) return i;
    return 0;
  }

  /** Canvas size changed (or first layout). */
  layout(): void {
    const { width: W, height: H } = this.scale;
    const u = this.u;
    const sf = this.deps.safe;
    const s = this.deps.session;
    const st = sf.top * u;
    const bottomMargin = Math.max(sf.bottom * u, 12 * u) + 10 * u;
    const usableH = H - st - bottomMargin;
    // The board takes the full width (minus slim gutters) up to 80 pt cells and 62 % of the
    // height; ≥ 44 pt targets are kept by trimming the frame and gutters first (7×7 on 375 pt).
    const fit = (bw: number, bh: number): { cs: number; pad: number; side: number } => {
      let pad = Math.round(8 * u);
      let side = Math.max(10 * u, Math.max(sf.left, sf.right) * u + 6 * u);
      let cs = Math.floor(Math.min((W - side * 2 - pad * 2) / bw, (usableH * 0.62 - pad * 2) / bh, 80 * u));
      if (cs < 44 * u) {
        // phase 2 (audit P1-14): ≥ 6 pt outside the frame even for 8×8 on a 375 pt screen
        pad = Math.round(5 * u);
        side = Math.max(6 * u, Math.max(sf.left, sf.right) * u);
        cs = Math.floor(Math.min((W - side * 2 - pad * 2) / bw, (usableH * 0.7 - pad * 2) / bh, 80 * u));
      }
      return { cs, pad, side };
    };
    const { cs, pad, side } = fit(s.level.w, s.level.h);
    const gap = Math.max(2, Math.round(3 * u));
    const boardH = cs * s.level.h + pad * 2;
    const bcy = Math.round(H - bottomMargin - boardH / 2);
    const boardTop = bcy - boardH / 2;
    // The horizon (house base) is laid out for a reference 8×8 board (the largest, deduce)
    // so the baked sky stays put from level to level and across tracks. Boards are
    // width-bound on phones, so a 5×5 and an 8×8 courtyard are about the same height.
    const ref = fit(8, 8);
    const refTop = H - bottomMargin - (ref.cs * 8 + ref.pad * 2);
    const ctrlS = Math.round(48 * u);
    // v11 (D1): the HUD row carries captions under its icons. R2 (A1, Reality P1-1 / P1-3): under the row
    // a message SLOT the height of a two-line band — the captions sit at its top; the error / hint line,
    // "Solved!" and "Next house →" all appear in it, so none of them ever covers the house, its plate or
    // a board row. The row and the horizon move up by the slot.
    const slotH = this.slotHeight();
    const houseBaseY = Math.round(refTop - slotH - ctrlS - 6 * u);
    const topBottom = this.topRowBottom();
    this.geo = {
      u, W, H, cs, gap, pad, side,
      bcx: Math.round(W / 2),
      bcy,
      boardTop,
      ctrlY: Math.round(boardTop - slotH - ctrlS / 2),
      ctrlS,
      houseBaseY,
      crestY: houseBaseY + 12 * u,
      // round 5: narrower so the far tower (left ridge) and the far home (right hill) stay in view
      houseMaxW: Math.min(W * 0.64, 300 * u),
      // R2: the house stays under the top HUD row (discs + captions; the alley strip runs in that row)
      houseMaxH: Math.max(60 * u, houseBaseY - topBottom - 10 * u),
      slotH,
    };
    const g = this.geo;
    // HUD row (left button, centre slot, undo, hint): the front layer keeps its bushes ≥ 30 pt away
    const bxs = Math.max(side + ctrlS / 2, 16 * u + ctrlS / 2);
    const hud = [bxs, bxs + ctrlS + 14 * u, W / 2, W - bxs - ctrlS - 14 * u, W - bxs].map((x) => ({ x, y: g.ctrlY, r: ctrlS / 2 }));
    // R2: stars / fireflies keep off every disc (the top row's three too; their x is final after the captions)
    const td = (TOP_DISC * u) / 2;
    const ty = st + TOP_Y * u;
    const keep = [...hud.filter((_, i) => i !== 2), ...[0, 1, 2].map((k) => ({ x: Math.max(side, 12 * u) + td + k * 64 * u, y: ty, r: td + 6 * u }))];
    this.scenery.layout({ W, H, u, safeTop: st, houseBaseY, crestY: g.crestY, hud, topBottom, keep });
    this.board.build(s.level, s.seedKey, { cs, gap, pad, u }, getNumberStyle(), s.daily ? "daily" : s.track === "deduce" ? "deduce" : "track");
    this.board.root.setPosition(g.bcx, g.bcy + this.boardSlide).setScale(1).setAlpha(1);
    this.board.setFaces(this.facesReady && getLanternFaces());
    this.wick?.cue("board", this.time.now);
    this.guide.stop();
    this.guide.layout(cs, u);
    this.sheet.layout(W, H, u, sf.bottom);
    // R2 HUD grammar: Settings is a disc like every other button (caption under it)
    const tdS = Math.round(TOP_DISC * u);
    this.gearIcon.setTexture(this.bank.canvas(`gearDisc${vis.sig}@${tdS}`, tdS, tdS, (ctx, w) => drawGearDisc(ctx, w)));
    this.placeTopRow();
    if (this.decorated) this.bakeHowBtn();
    this.chevron.setTexture(this.bank.chevron(Math.round(44 * u)));
    const bx = Math.max(side + ctrlS / 2, 16 * u + ctrlS / 2);
    this.hintBtn.setPosition(W - bx, g.ctrlY);
    this.undoBtn.setPosition(W - bx - ctrlS - 14 * u, g.ctrlY).setTexture(this.bank.undoIcon(ctrlS));
    this.leftBtn.setPosition(bx, g.ctrlY);
    this.todayBtn.setPosition(bx + ctrlS + 14 * u, g.ctrlY);
    this.todayGlow.setTexture(this.bank.halo(Math.round(ctrlS * 2.3))).setPosition(this.todayBtn.x, this.todayBtn.y);
    this.refreshToday();
    // the daily: today's calendar tile between the home button and undo (the "today" cue)
    if (s.daily) {
      const day = Number(s.daily.slice(8, 10));
      // R2 HUD grammar: the same "today" disc as the track's button (not a paper tile), no emphasis here
      const cw = ctrlS;
      const bold = vis.p.boldText;
      this.calImg.setTexture(this.bank.canvas(`todayDisc${day}-00${vis.sig}@${cw}`, cw, cw, (ctx, w) => drawTodayDisc(ctx, w, day, false, false, bold))).setPosition(g.bcx, g.ctrlY).setVisible(true);
    } else this.calImg.setVisible(false);
    this.card?.layout(W, H, u, sf.bottom);
    if (this.card) this.markHud([this.card.root]);
    this.breakChip.setTexture(this.bank.breakChip(Math.round(44 * u))).setPosition(g.bcx, g.ctrlY);
    // the daily's way out: its own disc in the top row after Rules (the left button stays the street)
    this.backChip.setTexture(this.bank.canvas(`backDisc${vis.sig}@${tdS}`, tdS, tdS, (ctx, w) => drawBackDisc(ctx, w))).setVisible(!!s.daily);
    this.farGlow.setTexture(this.bank.halo(Math.round(96 * u)));
    this.nightVeil.setTexture(this.bank.canvas("nightVeil", 4, 4, (ctx) => {
      ctx.fillStyle = "rgb(6,7,22)";
      ctx.fillRect(0, 0, 4, 4);
    })).setScale(W / 4, H / 4);
    this.ask.layout(W, H, u);
    this.howTo?.layout(W, H, u);
    // R2 (P1-3): the band hangs in the slot right above the board (the tutorial's rule too) — never on the house
    this.band.layout(W, u, g.slotH - 8 * u);
    this.band.anchor(g.bcx, g.boardTop - 1 * u);
    this.uiCam.setSize(W, H);
    this.hintState = { kind: "idle" };
    this.hintDots = 0;
    this.drawControls();
    this.blockedShown = false;
    if (this.decorated) this.placeHouse();
    this.layoutAlley();
    this.placeCaptions();
    this.redraw();
    this.tut?.relayout();
    this.fitWick();
  }

  /** R2: the message slot's height — a two-line band at the current text size (≥ the caption line + 8 pt). */
  private slotHeight(): number {
    const u = this.u;
    return Math.round(Math.max(this.capHeight() + 8 * u, 54 * u * Math.min(1.25, Math.max(1, vis.p.fontScale))));
  }

  /** R2: the bottom of the top HUD row (discs + their captions), canvas px. */
  private topRowBottom(): number {
    const u = this.u;
    return Math.round(this.deps.safe.top * u + TOP_Y * u + (TOP_DISC * u) / 2 + 1 * u + this.capHeight());
  }

  /** R2: right edge of the top row's discs / captions (the alley strip starts after it), canvas px. */
  private topRight = 0;

  /**
   * R2 (A1 HUD grammar): Settings · Rules (· Back on the daily) as discs in the top-left row, each caption
   * UNDER its disc (Reality #10); the pitch grows with the captions so they never touch.
   */
  private placeTopRow(): void {
    const g = this.geo;
    const u = this.u;
    const d = Math.round(TOP_DISC * u);
    const y = Math.round(this.deps.safe.top * u + TOP_Y * u);
    const x0 = Math.round(Math.max(g.side, 12 * u) + d / 2 + 2 * u);
    const capW = (key: string): number => this.caps.find((c) => c.key === key)?.t.displayWidth ?? 0;
    const pitch = (a: string, b: string): number => Math.round(Math.max(d + 12 * u, (capW(a) + capW(b)) / 2 + 10 * u));
    this.gearIcon.setPosition(x0, y);
    this.howBtn.setPosition(x0 + pitch("cap.settings", "cap.how"), y);
    this.backChip.setPosition(this.howBtn.x + pitch("cap.how", "cap.back"), y);
    const last = this.deps.session.daily ? { o: this.backChip, k: "cap.back" } : { o: this.howBtn, k: "cap.how" };
    this.topRight = Math.round(last.o.x + Math.max(d / 2, capW(last.k) / 2));
  }

  // ---------------------------------------------------------------- the alley strip (phase 5)

  /**
   * "This alley": the current block of ten gentle levels as ten small houses over the house
   * (done = lit window, current = warm rim + breathing glow, the 10th larger with the landmark
   * star, a lamp after the 5th). On the tower: a column of ten floors beside it (the current
   * floor breathing; the tower's plate is the one floor number). Hidden on the daily. Tap → street.
   */
  private layoutAlley(): void {
    const g = this.geo;
    const s = this.deps.session;
    const u = this.u;
    const on = !s.daily && townLoader !== undefined;
    this.alleyBox.on = on;
    if (!on) {
      for (const im of this.alley) im.setVisible(false);
      this.alleyLamp.setVisible(false);
      this.alleyGlow.setVisible(false);
      return;
    }
    const hc = vis.p.increaseContrast;
    const { cells } = alleyOf(s.levelNumber);
    this.alleyBox.cur = cells.findIndex((c) => c.state === "current");
    const st = this.deps.safe.top * u;
    // never over the moon (SE): below moon + 2 r, or left of it (moonPos, src/render/backdrop.ts)
    const m = this.scenery;
    const moonLow = m.moonY + m.moonR * 2 + 4 * u;
    const moonLeft = m.moonX - m.moonR * 2.4;
    if (s.track === "deduce") {
      const fw = Math.round(22 * u);
      const gap = 2 * u;
      const bottom = g.houseBaseY - 64 * u;
      // the column shrinks (11 → 7 pt floors) to stay under the moon; failing that it steps left of it
      // R2: under the top HUD row's captions; the moon (now under the row, at the right edge) only
      // limits the column when they share an x
      const colX = g.W * 0.79;
      const ceil = Math.max(this.topRowBottom() + 4 * u, colX + fw / 2 + 4 * u > moonLeft ? moonLow : 0);
      const fh = Math.round(Math.max(7 * u, Math.min(11 * u, (bottom - ceil) / 10 - gap)));
      const fits = bottom - 10 * (fh + gap) >= ceil;
      const x = Math.round(fits ? colX : Math.min(colX, moonLeft - fw / 2 - 4 * u));
      cells.forEach((c, i) => {
        const key = `floor-${c.state}-${c.finale ? 1 : 0}${hc ? "h" : ""}@${fw}x${fh}`;
        this.alley[i]!.setTexture(this.bank.canvas(key, fw, fh, (ctx, w, h) => drawTowerFloor(ctx, w, h, c.state, c.finale, hc)))
          .setPosition(x, bottom - fh / 2 - i * (fh + gap)).setScale(1).setVisible(true);
      });
      this.alleyLamp.setVisible(false);
      const top = bottom - 10 * (fh + gap);
      this.alleyBox = { ...this.alleyBox, x: x - 22 * u, y: top - 4 * u, w: 44 * u, h: bottom - top + 8 * u };
    } else {
      const fk = Math.min(vis.p.fontScale, 1.2);
      // round 3: V's lantern festoon — 22 pt cells, no gap, so the cord reads as one string.
      // R2 (A1): it runs in the top HUD row, right of the Settings / Rules discs (their captions sit
      // under them now); the moon moved under the row, so the whole row width is the strip's
      const lampW = 9 * u;
      const fin = 1.4;
      const left = this.topRight + 12 * u;
      const right = g.W - Math.max(12 * u, this.deps.safe.right * u + 6 * u);
      const cs = Math.round(Math.max(14 * u, Math.min(22 * u * fk, (right - left - lampW) / (9 + fin))));
      const pitch = cs;
      const width = 9 * pitch + cs * fin + lampW;
      // (the finale cell sits 0.2 cell higher: the row's visual centre is the top row's centre)
      const y = Math.round(st + TOP_Y * u + 0.2 * cs);
      const cx = Math.round((left + right) / 2);
      let x = cx - width / 2;
      cells.forEach((c, i) => {
        const sz = c.finale ? Math.round(cs * fin) : cs;
        const key = `alley-${c.state}-${c.finale ? 1 : 0}${hc ? "h" : ""}@${sz}`;
        this.alley[i]!.setTexture(this.bank.canvas(key, sz, sz, (ctx, w) => drawAlleyHouse(ctx, w, c.state, c.finale, hc)))
          .setPosition(x + sz / 2, y + (cs - sz) / 2).setScale(1).setVisible(true);
        x += c.finale ? sz : pitch;
        if (i === 4) {
          const lit = c.state === "done";
          this.alleyLamp.setTexture(this.bank.canvas(`alleyLamp-${lit ? 1 : 0}${hc ? "h" : ""}@${cs}`, cs, cs, (ctx, w) => drawLampMark(ctx, w, lit, hc)))
            .setPosition(x + lampW / 2 - 3 * u, y).setScale(0.8).setVisible(true);
          x += lampW;
        }
      });
      const h = Math.max(44 * u, cs * fin + 8 * u);
      this.alleyBox = { ...this.alleyBox, x: cx - width / 2 - 4 * u, y: y - h / 2, w: width + 8 * u, h };
    }
    const cur = this.alley[this.alleyBox.cur];
    if (cur) this.alleyGlow.setTexture(this.bank.halo(Math.round(40 * u))).setPosition(cur.x, cur.y);
  }

  /** The strip's cells follow the camera-free HUD: fade with it, the current cell breathes. */
  private stepAlley(now: number, hud: number): void {
    const on = this.alleyBox.on && hud > 0.01 && !this.night;
    for (const im of this.alley) im.setAlpha(hud).setVisible(on);
    this.alleyLamp.setAlpha(hud).setVisible(on && this.deps.session.track !== "deduce");
    const cur = this.alley[this.alleyBox.cur];
    if (on && cur) {
      const b = motion.reduced ? 0.7 : 0.45 + 0.35 * (0.5 + 0.5 * Math.sin(now / 650));
      this.alleyGlow.setVisible(true).setAlpha(hud * b).setPosition(cur.x, cur.y);
    } else if (this.alleyGlow.visible) this.alleyGlow.setVisible(false);
  }

  private drawControls(): void {
    const g = this.geo;
    const hs = this.hintState;
    this.hintBtn.setTexture(this.bank.hintIcon(g.ctrlS, hs.kind === "remove" ? "lift" : "ask", hs.kind === "remove" ? hs.remaining : this.hintDots, this.hintAttn));
    const s = this.deps.session;
    // phase 5: one role per button — the left one is always the street (dimmed, inactive on the
    // daily, whose way out is the chip beside the gear)
    // v14 (mock g): the village = the lantern-jar disc (the street keeps its own way in: the alley strip)
    const vs = Math.round(g.ctrlS * 0.86);
    this.leftBtn.setTexture(this.bank.canvas(`villageDisc${vis.sig}@${vs}`, vs, vs, (ctx, w) => drawVillageDisc(ctx, w))).setVisible(townLoader !== undefined);
    void s;
  }

  private placeHouse(): void {
    const s = this.deps.session;
    const g = this.geo;
    // daily numbers are ≤ 0 before DAILY_EPOCH (pre-launch): the plate stays blank then
    const n = s.daily ? dailyNumber(s.daily) : s.levelNumber;
    // the deduce track's courtyard belongs to the tower
    this.house = !s.daily && s.track === "deduce" ? towerFor(s.seedKey, n) : lanternHouseFor(s.seedKey, Math.max(1, n));
    // the daily's house carries the daily number on a moonlit plate
    this.scenery.setHouse(this.house, g.bcx, g.houseBaseY, g.houseMaxW, g.houseMaxH, g.u, { n, track: s.daily ? "deduce" : s.track });
    this.fitWick();
  }

  // ---------------------------------------------------------------- settings

  private openSheet(): void {
    if (this.finale || this.switching) return;
    cue("tap");
    this.clearHint();
    this.guide.stop();
    this.sheet.setCloud(syncSignal.status);
    this.sheet.show({ muted: isMuted(), numbers: getNumberStyle(), shareTime: getShareTime() }, this.time.now, hapticsEnabled(), this.sheetMore(this.notifyOn));
    // the reminder switch reflects the system permission too (it can be revoked in iOS Settings)
    void this.loadNotify().then(async (m) => {
      const on = m.notifyAvailable() ? await m.notify.isOn() : null;
      this.notifyOn = on;
      if (this.sheet.isOpen && on !== this.sheet.notifyState) this.sheet.show({ muted: isMuted(), numbers: getNumberStyle(), shareTime: getShareTime() }, this.time.now - 1000, hapticsEnabled(), this.sheetMore(on));
    }).catch(() => undefined);
  }
  /** the reminder switch as last known (null = unavailable on this device) */
  private notifyOn: boolean | null = false;

  private sheetMore(notify: boolean | null): import("./SettingsSheet.ts").SheetMore {
    let privacy = false;
    privacy = adsApi.privacyOptionsRequired();
    const s = this.deps.session;
    return { notify, privacy, canRestart: s.moves.length > 0 && !s.complete, t: (k) => a11y.t(k), faces: getLanternFaces() };
  }

  private onSheet(px: number, py: number): void {
    const h = this.sheet.hit(px, py);
    const now = this.time.now;
    if (h === "outside" || h === "close") {
      if (h === "close") cue("tap");
      this.sheet.hide(now);
      this.lastInput = now;
      return;
    }
    if (h === "soundOn" || h === "soundOff") {
      if (isMuted() !== (h === "soundOff")) adsApi.setMuted(toggleMuted());
      cue("tap");
    } else if (h === "digits" || h === "dots") {
      setNumberStyle(h);
      this.board.setNumberStyle(h);
      syncSignal.dirty("settings");
      cue("tap");
    } else if (h === "timeOn" || h === "timeOff") {
      setShareTime(h === "timeOn");
      syncSignal.dirty("settings");
      cue("tap");
    } else if (h === "hapticsOn" || h === "hapticsOff") {
      setHaptics(h === "hapticsOn");
      cue("tap");
      if (h === "hapticsOn") haptic.place();
    } else if (h === "facesOn" || h === "facesOff") {
      setLanternFaces(h === "facesOn");
      cue("tap");
      this.applyFaces();
      this.sheet.select({ muted: isMuted(), numbers: getNumberStyle(), shareTime: getShareTime() }, hapticsEnabled(), { faces: getLanternFaces() });
      return;
    } else if (h === "notifyOn" || h === "notifyOff") {
      cue("tap");
      if (h === "notifyOn") rating.notePrompt();
      const on = h === "notifyOn";
      this.notifyOn = on;
      this.sheet.select({ muted: isMuted(), numbers: getNumberStyle(), shareTime: getShareTime() }, hapticsEnabled(), { notify: on });
      void this.loadNotify().then(async (m) => {
        if (on) {
          const ok = await m.notify.enable();
          this.notifyOn = ok;
          if (this.sheet.isOpen) this.sheet.select({ muted: isMuted(), numbers: getNumberStyle(), shareTime: getShareTime() }, hapticsEnabled(), { notify: ok });
          if (ok) await this.syncNotify();
        } else await m.notify.disable();
      });
      return;
    } else if (h === "restart") {
      const s = this.deps.session;
      if (s.moves.length === 0 || s.complete || this.finale) return;
      cue("tap");
      this.sheet.hide(now);
      this.showAsk(
        { kind: "restart", text: a11y.t("ask.restart"), yes: a11y.t("ask.restartYes"), no: a11y.t("ask.cancel") },
        { yes: () => this.restartLevel(), no: () => undefined },
      );
      return;
    } else if (h === "privacy") {
      cue("tap");
      this.sheet.hide(now);
      void adsApi.showPrivacyOptions();
      return;
    } else if (h === "policy") {
      // App Review 5.1.1(i): the privacy policy, in Safari (never inside the game's WebView)
      cue("tap");
      this.sheet.hide(now);
      openExternal(PRIVACY_POLICY_URL);
      return;
    } else if (h === "replay") {
      // v11 (D9): the "How to play" row opens the same sheet as "?" (its Replay tutorial button
      // replaces the old "show the guide again")
      this.sheet.hide(now);
      void this.openHowTo();
      return;
    }
    this.sheet.select({ muted: isMuted(), numbers: getNumberStyle(), shareTime: getShareTime() }, hapticsEnabled());
  }

  private hitAt(px: number, py: number): Down {
    const r = 22 * this.u; // 44 pt targets
    const over = (im: PhaserTypes.GameObjects.Image, rr: number): boolean => Math.abs(px - im.x) <= rr && Math.abs(py - im.y) <= rr;
    if (over(this.gearIcon, r)) return "gear";
    if (this.howBtn.visible && over(this.howBtn, r)) return "howBtn";
    if (this.backChip.visible && Math.abs(px - this.backChip.x) <= Math.max(r, this.backChip.width / 2 + 4 * this.u) && Math.abs(py - this.backChip.y) <= r) return "back";
    const rb = Math.max(r, this.geo.ctrlS / 2 + 4 * this.u);
    if (over(this.hintBtn, rb)) return "hint";
    if (over(this.undoBtn, rb)) return "undo";
    if (this.leftBtn.visible && over(this.leftBtn, rb)) return this.deps.session.daily ? "swallow" : "left";
    if (this.todayBtn.visible && over(this.todayBtn, rb)) return "today";
    if (this.breakChip.visible && over(this.breakChip, rb)) return "brk";
    const m = this.scenery;
    if (Math.hypot(px - m.moonX, py - m.moonY) <= Math.max(m.moonR * 1.8, 26 * this.u)) return "moon";
    const ab = this.alleyBox;
    if (ab.on && !this.deps.session.daily && px >= ab.x && px <= ab.x + ab.w && py >= ab.y && py <= ab.y + ab.h) return "alley";
    if (py < this.geo.boardTop - 8 * this.u && !this.deps.session.daily) {
      const f = m.farTarget;
      // the far home on the tower screen: a ≥ 56 pt target (BENCHMARK-UX #8)
      const hw = f.kind === "home" ? Math.max(f.hw, 28 * this.u) : f.hw;
      const hh = f.kind === "home" ? Math.max(f.hh, 28 * this.u) : f.hh;
      if (Math.abs(px - f.x) <= hw && Math.abs(py - f.y) <= hh) return "far";
      if (townLoader && m.villageAt(px, py)) return "village";
    }
    return "cell";
  }

  private cellAt(px: number, py: number): number {
    const s = this.deps.session;
    const g = this.geo;
    const x = Math.floor((px - (g.bcx - (g.cs * s.level.w) / 2)) / g.cs);
    const y = Math.floor((py - (g.bcy - (g.cs * s.level.h) / 2)) / g.cs);
    return x >= 0 && y >= 0 && x < s.level.w && y < s.level.h ? index(x, y) : -1;
  }

  private toLocal(p: { x: number; y: number }): { x: number; y: number } {
    const r = this.board.root;
    return { x: (p.x - r.x) / r.scaleX, y: (p.y - r.y) / r.scaleY };
  }

  private onCellTap(x: number, y: number): void {
    if (this.finale || this.switching) return;
    const s = this.deps.session;
    const now = this.time.now;
    const cell = index(x, y);
    const r = s.tap(x, y); // journaled before anything animates
    if (r === "locked") return;
    if (r === "illegal") {
      if (hasBit(s.level.stones, cell)) {
        this.board.pulse(cell, now);
        cue("stoneTap", { pitchIndex: pitchIndexForCell(x, y, s.level.h) });
        haptic.invalid();
        // v11 (C16): a stone tap used to do "nothing" — say where lanterns go (at most every 3 s)
        if (now - this.stoneLineT0 > 3000 && this.bandFor !== "hint" && this.bandFor !== "err") {
          this.stoneLineT0 = now;
          this.showLine("stone", { main: a11y.t("err.stone") }, now, 2600);
        }
      }
      return;
    }
    const hs = this.hintState;
    this.hintDots = hs.kind === "remove" && hs.cell === cell ? hs.remaining : 0;
    this.clearHint();
    this.drawControls();
    this.onGuideMove();
    const placed = hasBit(s.state.lanterns, cell);
    const cs = this.geo.cs;
    // no basket on pips: a placed lantern drops in from just above its cell, a removed one lifts away and fades
    const ends: FlightEnds = placed
      ? { x: this.board.cx(cell), y: this.board.cy(cell) - cs * 1.0, scale: 0.75 }
      : { x: this.board.cx(cell), y: this.board.cy(cell) - cs * 0.9, scale: 0.85, fade: true };
    const res = this.board.sync(s.state, now, { cell, placed, ends });
    const overBefore = this.overStones();
    const a = s.analysis();
    this.board.setStones(this.stoneView(a), now, true);
    this.feedback(cell, placed, res, overBefore);
    if (r !== "complete") this.a11yAnnounce(res.invalid ? "conflict" : placed ? "placed" : "removed");
    this.moved = true;
    this.deps.onMove(r);
    if (r === "complete") this.startFinale(cell, res.settleMs, now);
  }

  /** Numbered stones currently "over" (before the analysis of the new state is applied). */
  private overStoneSet = new Set<number>();
  private overStones(): Set<number> {
    return this.overStoneSet;
  }

  /**
   * Stone status as shown. A 0-stone is "ok" from the first frame by the rules,
   * but glowing it then pre-counts it (playtest: "numbers matched" with dark
   * cells left) — it stays neutral until every floor cell around it is lit.
   */
  private stoneView(a: BoardAnalysis): { cell: number; status: StoneStatus }[] {
    const lv = this.deps.session.level;
    return a.stones.map((st) => {
      if (st.need !== 0 || st.status !== "ok") return st;
      const x = st.cell & 7;
      const y = st.cell >> 3;
      const around = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].filter(([nx, ny]) => nx! >= 0 && ny! >= 0 && nx! < lv.w && ny! < lv.h);
      const done = around.every(([nx, ny]) => hasBit(lv.stones, index(nx!, ny!)) || a.lit[index(nx!, ny!)] === 1);
      return { cell: st.cell, status: done ? "ok" : "under" };
    });
  }

  // ---------------------------------------------------------------- hints

  private onHint(): void {
    if (this.switching) return;
    const s = this.deps.session;
    const now = this.time.now;
    if (s.complete) return;
    this.wick?.cue("hint", now);
    const hs = this.hintState;
    if (hs.kind === "remove") {
      // second tap: the highlighted lantern goes back (one journaled move); the beads show how many are left
      const removed = s.removeMany([hs.cell]);
      this.hintDots = hs.remaining;
      this.clearHint();
      this.drawControls();
      if (removed.length > 0) {
        const first = removed[0]!;
        const cs = this.geo.cs;
        const res = this.board.sync(s.state, now, {
          cell: first, placed: false,
          ends: { x: this.board.cx(first), y: this.board.cy(first) - cs * 0.9, scale: 0.85, fade: true },
        });
        this.board.setStones(this.stoneView(s.analysis()), now, true);
        haptic.remove();
        cue("remove", { pitchIndex: pitchIndexForCell(first & 7, first >> 3, s.level.h) });
        this.afterSync(res, true);
        this.deps.onMove("removed");
      }
      return;
    }
    this.clearHint();
    this.hintDots = 0;
    if (s.daily && this.ds && !this.ds.result) {
      this.ds.hints++;
      // R2: when it was used (the postcard's strip shows the bulb in the order of play)
      (this.ds.hintAt ??= []).push(s.moves.length);
      this.saveDailyNow();
    }
    rating.noteHint();
    const h = stepHint(s.hint());
    console.info(`[hint] ${h.kind}${h.kind === "removeWrong" ? ` (${h.remaining} more)` : ""} (${s.track} hints so far ${s.hintsUsed()})`);
    if (h.kind === "removeWrong") {
      this.hintState = { kind: "remove", cell: h.cell, remaining: h.remaining };
      this.board.showWrong(h.cell, now, this.whyOf(h.cell));
      // v11 (C11): the hint says what it means — no guessing what the curl is for
      this.showLine("hint", { main: a11y.t("hint.remove"), sub: a11y.t("hint.removeSub") }, now, 5000);
      cue("tap");
      this.a11yAnnounce("hint", undefined, h.cell);
    } else if (h.kind === "place") {
      this.hintState = { kind: "ghost" };
      this.board.showGhost(h.cell, h.anchor, now);
      this.showLine("hint", { main: a11y.t("hint.place") }, now, 3800);
      cue("tap");
      this.a11yAnnounce("hint", undefined, h.cell);
      if (hasBit(s.level.stones, h.anchor)) {
        setTimeout(() => cue("stoneTap", { pitchIndex: pitchIndexForCell(h.anchor & 7, h.anchor >> 3, s.level.h) }), motion.reduced ? 0 : 240);
      }
    }
    this.hintPulseT0 = now;
    this.drawControls();
  }

  private clearHint(): void {
    if (this.bandFor === "hint") this.hideBand();
    if (this.hintState.kind === "idle") return;
    this.hintState = { kind: "idle" };
    this.board.clearHint();
    this.drawControls();
  }

  // ---------------------------------------------------------------- start over (settings)

  /** Take every move back (one journal rewrite per move; a board has ≤ 64). The level stays. */
  private restartLevel(): void {
    const s = this.deps.session;
    if (s.complete || this.finale || this.switching) return;
    const daily = s.daily && this.ds && !this.ds.result;
    let n = 0;
    while (s.moves.length > 0 && s.undo() >= 0) n++;
    if (n === 0) return;
    this.clearHint();
    this.hintDots = 0;
    this.hideBlocked();
    this.drawControls();
    this.redraw();
    if (daily) this.saveDailyNow();
    cue("remove", { pitchIndex: 3 });
    haptic.remove();
    this.a11yAnnounce("undone");
    this.lastInput = this.time.now;
    console.info(`[restart] ${n} moves taken back`);
  }

  // ---------------------------------------------------------------- undo

  /** Undo the last toggle (the session drops it from the journal); animates like a tap on that cell. */
  private onUndo(): void {
    if (this.finale || this.switching) return;
    const s = this.deps.session;
    const now = this.time.now;
    const cell = s.undo();
    if (cell < 0) return;
    this.clearHint();
    this.hintDots = 0;
    this.drawControls();
    this.onGuideMove();
    const placed = hasBit(s.state.lanterns, cell);
    const cs = this.geo.cs;
    const ends: FlightEnds = { x: this.board.cx(cell), y: this.board.cy(cell) - cs * (placed ? 1 : 0.9), scale: placed ? 0.75 : 0.85, fade: !placed };
    const res = this.board.sync(s.state, now, { cell, placed, ends });
    const overBefore = this.overStones();
    this.board.setStones(this.stoneView(s.analysis()), now, true);
    this.feedback(cell, placed, res, overBefore);
    this.a11yAnnounce("undone", undefined, cell);
    this.undoPulseT0 = now;
    if (s.daily && this.ds && !this.ds.result) {
      this.ds.undos++;
      this.saveDailyNow();
    }
    this.deps.onMove(placed ? "placed" : "removed");
  }
  private undoPulseT0 = -1e9;

  // ---------------------------------------------------------------- daily

  private daily(): Promise<DailyMod> {
    if (this.dm) return Promise.resolve(this.dm);
    return this.loadDaily();
  }
  /** the daily chunk: cached once loaded; a failed import is retried on the next call (review P2) */
  private loadDaily = lazyRetry(() =>
    import("./daily.ts").then((m) => {
      this.dm = m;
      this.card ??= new ResultSheet(this, this.bank, 30);
      const g = this.geo;
      this.card.layout(g.W, g.H, g.u, this.deps.safe.bottom);
      this.markHud([this.card.root]);
      return m;
    }),
  );

  /** The moon breathes while today's daily is not done yet. */
  private async refreshMoon(): Promise<void> {
    const dm = await this.daily();
    const today = localDateISO();
    const ds = this.ds?.date === today ? this.ds : await dm.loadDaily(today);
    this.scenery.moonBreath = !ds.result;
    this.moonKnown = true;
    this.scenery.setMoon(moonPhase(today));
    this.refreshToday();
    // reminders are re-planned on every launch / foreground (after the first frame; lazy chunk)
    void this.syncNotify();
  }

  /** The "today" button: today's day number; glowing while today's daily is unplayed, a check once done. */
  private refreshToday(): void {
    if (!this.geo) return;
    const today = localDateISO();
    const done = this.moonKnown && !this.scenery.moonBreath;
    // R2 HUD grammar: the "today" disc (calendar glyph + day); emphasis (amber rim) while unplayed
    const w = this.geo.ctrlS;
    const day = Number(today.slice(8, 10));
    const open = this.moonKnown && !done;
    const bold = vis.p.boldText;
    this.todayBtn.setTexture(this.bank.canvas(`todayDisc${day}-${open ? 1 : 0}${done ? 1 : 0}${vis.sig}@${w}`, w, w, (ctx, cw) => drawTodayDisc(ctx, cw, day, open, done, bold)));
    this.todayState = done ? "done" : "open";
  }
  /** shown on the track once the first lessons are over (the moon guide's moment), or once a daily was opened */
  private todayAvailable(): boolean {
    const s = this.deps.session;
    // v11 (D5): after gentle 5 (was 3) — the first daily is 6×6; five 5×5 boards come first
    return !s.daily && (s.cleared("gentle") >= DAILY_AFTER || guideDone(GUIDE.moon));
  }
  private todayBtn!: PhaserTypes.GameObjects.Image;
  private todayGlow!: PhaserTypes.GameObjects.Image;
  private todayState: "open" | "done" = "open";
  /** today's daily state is known (the moon guide waits for it) */
  private moonKnown = false;

  /** Moon tapped: open today's daily (a completed one opens as practice); on the daily, re-show its card. */
  private onMoon(): void {
    if (this.finale || this.switching || this.travel || this.moonPending) return;
    const s = this.deps.session;
    cue("tap");
    if (s.daily) {
      if (s.complete && this.ds?.result) this.showCard();
      return;
    }
    this.goDaily(localDateISO(), true);
  }
  /** Switch to a date's daily; a completed one restarts as practice when `practice` (moon), else shows its lit board + card (a link). */
  private goDaily(date: string, practice: boolean): void {
    this.clearHint();
    this.hideBlocked();
    this.guide.stop();
    markGuide(GUIDE.moon);
    // set synchronously: a second moon tap (or the tower / town) before the daily chunk is in
    // must not start a second switch (review P2)
    this.moonPending = true;
    void this.daily()
      .then(async (dm) => {
        const ds = await dm.loadDaily(date);
        this.ds = ds;
        this.startSwitch(() => this.deps.session.openDaily(date, practice && ds.result !== null), () => void this.enterDailyPlay().then(() => this.maybeDailyIntro()));
      })
      .catch((e: unknown) => console.warn("[daily] could not open", e))
      .finally(() => (this.moonPending = false));
  }

  /**
   * R2 (A5) deep link → a date's daily (src/game/deepLink.ts routes; 1.0 only ever passes today).
   * "busy" while another screen owns the moment (the caller retries); "skip" for a player who has
   * not reached the daily yet (the first lessons) or who is on another date's daily.
   */
  openDailyLink(date: string): "done" | "busy" | "skip" {
    const s = this.deps.session;
    if (!this.decorated || this.finale || this.switching || this.travel || this.moonPending || this.townOpen || this.tutOn) return "busy";
    if (this.sheet.isOpen || this.ask.isOpen || this.howTo?.isOpen) return "busy";
    if (s.daily) {
      if (s.daily !== date) return "skip";
      if (s.complete && this.ds?.result && !this.card?.isOpen) this.showCard();
      return "done";
    }
    if (!this.todayAvailable()) return "skip";
    this.goDaily(date, false);
    return "done";
  }
  /** a moon tap is loading the daily (the switch has not started yet) */
  private moonPending = false;

  /** On the daily board: (re)start its background clock unless it already has its counted result. */
  private async enterDailyPlay(): Promise<void> {
    const s = this.deps.session;
    const date = s.daily;
    if (!date) return;
    const dm = await this.daily();
    if (this.ds?.date !== date) this.ds = await dm.loadDaily(date);
    this.clock = new dm.DailyClock(this.ds.ms);
    if (!this.ds.result && !s.complete) this.clock.start();
    this.scenery.setMoon(moonPhase(date));
  }

  /**
   * v11 (NOVICE-TEST C13 / D4): the first time a daily opens, one small card says what it is —
   * "A new puzzle every day." · "Come back tomorrow to keep your streak." — its clock waits for it.
   */
  private async maybeDailyIntro(): Promise<void> {
    const s = this.deps.session;
    if (!s.daily || s.complete || this.ds?.result) return;
    let seen = false;
    try {
      seen = (await Preferences.get({ key: "dailyIntro" })).value === "1";
    } catch {
      /* not seen */
    }
    // after the board has slid in (a tap during the switch would be swallowed)
    for (let k = 0; k < 60 && (this.switching || this.travel); k++) await new Promise((r) => setTimeout(r, 50));
    if (seen || !s.daily || this.ask.isOpen || s.complete) return;
    void Preferences.set({ key: "dailyIntro", value: "1" }).catch(() => undefined);
    this.clock?.stop();
    const date = s.daily;
    const day = Number(date.slice(8, 10));
    const ph = moonPhase(date);
    const u = this.u;
    const resume = (): void => {
      const s2 = this.deps.session;
      if (s2.daily && this.clock && this.ds && !this.ds.result && !s2.complete) this.clock.start();
      this.lastInput = this.time.now;
    };
    this.showAsk(
      {
        kind: "dailyIntro",
        title: a11y.t("daily.title"),
        art: {
          key: `dailyIntro-${day}-${ph}`,
          draw: (ctx, w, h) => {
            const tw = Math.round(h * 0.82);
            ctx.save();
            ctx.translate(Math.round((w - tw) / 2), Math.round((h - tw * 1.1) / 2));
            drawCalendarTile(ctx, tw, Math.round(tw * 1.1), day, ph, u);
            ctx.restore();
          },
        },
        text: `${a11y.t("daily.intro")}\n${a11y.t("daily.intro2")}`,
        yes: a11y.t("daily.ok"),
        no: "",
      },
      { yes: resume, no: resume },
    );
  }

  /** Persist the daily's play time (pause, leaving, every counted hint / undo). */
  private saveDailyNow(): void {
    if (!this.dm || !this.ds || !this.clock || this.ds.result) return;
    this.ds.ms = this.clock.peek();
    this.dm.saveDaily(this.ds);
  }

  /** Daily solved: stop the clock, count it once (only on its own local date), show the card. */
  private async onDailyDone(): Promise<void> {
    const s = this.deps.session;
    const date = s.daily;
    if (!date) return;
    const dm = await this.daily();
    if (this.ds?.date !== date) this.ds = await dm.loadDaily(date);
    const ds = this.ds;
    const ms = this.clock ? this.clock.stop() : ds.ms;
    let st = await dm.loadStreak();
    const today = localDateISO();
    if (!ds.result) {
      // finished after local midnight → it is practice: time shown, the streak is not touched
      ds.ms = ms;
      // counted → the completion log too (phase 4: the streak can be rebuilt from it, and iCloud mirrors it)
      if (today === date) {
        st = dm.recordCompletion(st, date, { ms, hints: ds.hints, undos: ds.undos });
        this.freshResult = date;
      }
      ds.result = { dateISO: date, seconds: Math.max(1, Math.round(ms / 1000)), hints: ds.hints, undos: ds.undos, streak: dm.liveStreak(st, today) };
      dm.saveDaily(ds);
      console.info(`[daily] ${date} done in ${ds.result.seconds}s, streak ${ds.result.streak}${today === date ? "" : " (after midnight: not counted)"}`);
      // the daily's result moment (the policy shows nothing in the daily; it may offer the break)
      const res = ds.result;
      const counted = today === date;
      void adsApi.onUnitComplete({ track: s.homeTrack, daily: true, playSeconds: res.seconds, dailyStreak: counted ? res.streak : 0, dailyDate: date, counted }).then(() => {
        if (adsApi.offerBreak()) this.card?.showBreak();
      });
    }
    this.scenery.moonBreath = false;
    this.dailyShields = dm.shieldsLeft(st, today);
    const fresh = !!ds.result && ds.result.dateISO === today && this.freshResult === date;
    this.sheetExtras = await this.extrasFor(dm, today, fresh ? ds.result!.streak : 0);
    this.showCard();
    if (fresh) {
      void this.afterCountedDaily(dm);
      void this.noteDailyMoment(dm, ds.result!.hints);
    }
  }
  private dailyShields = 2;
  /** the date whose result was counted in this run (milestones / the reminder ask show then) */
  private freshResult = "";
  private sheetExtras: SheetExtras = {};

  /** The result sheet v2 extras: this month's strip; a milestone / the gift on a fresh counted day. */
  private async extrasFor(dm: DailyMod, today: string, freshStreak: number): Promise<SheetExtras> {
    try {
      await dm.logSettled();
      const log = await dm.loadLog();
      const { days } = monthStrip(Object.keys(log), today);
      // the gift is granted by the ads policy on this result moment (onUnitComplete runs alongside):
      // its own clock when known, else the same rule (every 7th counted day)
      const gift = freshStreak > 0 && (adsApi.giftActiveUntil() > Date.now() || giftEarned(freshStreak));
      return { month: days, milestone: streakMilestone(freshStreak), gift };
    } catch (e) {
      console.warn("[daily] sheet extras", e);
      return {};
    }
  }

  // ---------------------------------------------------------------- reminders (src/notify)

  private notifyMod: typeof import("../notify/index.ts") | null = null;
  private loadNotify = lazyRetry(() => import("../notify/index.ts").then((m) => (this.notifyMod = m)));

  /** What the planner needs, from the daily log (local times only, nothing leaves the device). */
  private async planCtx(dm: DailyMod): Promise<PlanCtx> {
    const log = await dm.loadLog();
    const today = localDateISO();
    const dates = Object.keys(log).sort();
    const mins = dates.map((d) => log[d]!.at).filter((at) => at > 0).map((at) => {
      const t = new Date(at);
      return t.getHours() * 60 + t.getMinutes();
    });
    const st = await dm.loadStreak();
    const now = clock.now();
    return {
      today, nowMinute: now.getHours() * 60 + now.getMinutes(), played: dates, todayDone: !!log[today], finishMinutes: mins,
      streak: dm.liveStreak(st, today), lang: a11y.lang(),
      at: (date, minute) => new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), Math.floor(minute / 60), minute % 60),
    };
  }

  /** Re-plan the reminders (foreground, daily done, switched on). Never on the launch path. */
  private async syncNotify(): Promise<void> {
    try {
      const dm = await this.daily();
      const m = await this.loadNotify();
      await m.notify.reschedule(await this.planCtx(dm));
    } catch (e) {
      console.warn("[notify] sync", e);
    }
  }

  /** the reminder soft ask waiting for the result sheet to go (it never stacks on the sheet) */
  private pendingAsk: (() => void) | null = null;

  /** A counted daily: drop today's reminder; on the 2nd counted day, the soft ask (once). */
  private async afterCountedDaily(dm: DailyMod): Promise<void> {
    try {
      const m = await this.loadNotify();
      await m.notify.cancelToday(localDateISO());
      const ctx = await this.planCtx(dm);
      void m.notify.reschedule(ctx);
      if (!(await m.notify.shouldAsk(ctx.played.length))) return;
      const minute = reminderMinute(ctx.finishMinutes);
      // round 2: asked once the sheet is gone and the night beat has brought the track back
      this.pendingAsk = () =>
        this.showAsk(this.notifyAsk(minute), {
          yes: () => void m.notify.enable().then(() => this.syncNotify()),
          no: () => void m.notify.later(),
        });
    } catch (e) {
      console.warn("[notify] ask", e);
    }
  }

  private notifyAsk(minute: number): AskSpec {
    const u = this.u;
    return {
      kind: "notify",
      art: {
        key: `notify-${minute}`,
        draw: (ctx, w, h) => {
          const s = h * 0.86;
          drawBell(ctx, w / 2 - s - 10 * u, (h - s) / 2, s, PAL.flame);
          drawClock(ctx, w / 2 + 10 * u, (h - s) / 2, s, PAL.moon, minute);
        },
      },
      text: a11y.t("ask.notify"),
      yes: a11y.t("ask.yes"),
      no: a11y.t("ask.later"),
    };
  }

  // ---------------------------------------------------------------- ask card

  private showAsk(spec: AskSpec, act: { yes: () => void; no: () => void }): void {
    // R2 (A2): a question card (reminder, ad break, the daily offer) means "no rating ask this session"
    if (spec.kind !== "dailyIntro" && spec.kind !== "restart") rating.notePrompt();
    this.askAct = act;
    this.ask.show(spec, this.time.now);
    this.a11yT = 0;
  }

  private onAsk(px: number, py: number): void {
    const h = this.ask.hit(px, py);
    if (h === "inside") return;
    const act = this.askAct;
    this.askAct = null;
    this.ask.hide(this.time.now);
    cue("tap");
    if (h === "yes") act?.yes();
    else act?.no();
    this.lastInput = this.time.now;
  }

  // ---------------------------------------------------------------- night beat

  /** The daily's sheet closed: a quiet 3 s of night (the windows go out), then the track. A touch skips it. */
  private startNight(): void {
    const now = this.time.now;
    this.night = { t0: now, left: false };
    this.scenery.setProgress(0, now, true);
    this.scenery.lightHeart(false, now, true);
    this.flow("night");
  }

  private endNight(): void {
    if (!this.night) return;
    this.night = null;
    this.veilOutT0 = this.time.now;
    this.leaveDaily();
  }
  private veilOutT0 = -1e9;

  private stepNight(now: number): void {
    const n = this.night;
    if (n) {
      const t = now - n.t0;
      this.nightVeil.setVisible(true).setAlpha(motion.reduced ? 0.55 : 0.55 * clamp01(t / 700));
      if (t >= NIGHT_MS) this.endNight();
      return;
    }
    if (!this.nightVeil.visible) return;
    const k = clamp01((now - this.veilOutT0) / 500);
    if (k >= 1) this.nightVeil.setVisible(false);
    else this.nightVeil.setAlpha(0.55 * (1 - k));
  }

  private showCard(): void {
    if (!this.card || !this.ds?.result) return;
    // no ads in the daily: its sheet never offers the ad break (docs/phase2-plan.md)
    // R2: the postcard's strip reads the move story (cells are compared, then dropped — never drawn)
    const story = { cells: moveCells(this.deps.session.moves), hintAt: this.ds.hintAt ?? [] };
    this.card.show(this.ds.result, this.dailyShields, this.time.now, false, { ...this.sheetExtras, ...story });
    this.a11yAnnounce("daily.done", { time: this.ds.result.seconds, streak: this.ds.result.streak });
  }

  private onCard(px: number, py: number): void {
    const c = this.card;
    if (!c) return;
    const h = c.hit(px, py);
    const now = this.time.now;
    if (h === "share" && this.dm && this.ds?.result) {
      cue("tap");
      void this.dm.shareResult(this.deps.session.level, this.ds.result, getShareTime(), c.shareCard(getShareTime()) ?? undefined);
    } else if (h === "home") {
      cue("tap");
      if (c.breakOffered) {
        c.hideBreak();
        adsApi.declineBreak();
      }
      c.hide(now);
      // phase 5: closing the sheet ends the evening — a quiet night beat, then the track
      this.startNight();
    } else if (h === "shields") {
      cue("tap");
      c.replayShields(now);
    } else if (h === "break") {
      cue("tap");
      c.hideBreak();
      this.confirmBreak();
    } else if (h === "outside") {
      if (c.breakOffered) {
        c.hideBreak();
        adsApi.declineBreak();
      }
      c.hide(now);
    }
    this.lastInput = now;
  }

  private leaveDaily(): void {
    this.card?.hide(this.time.now);
    this.clock?.stop();
    this.saveDailyNow();
    cue("tap");
    this.startSwitch(() => this.deps.session.leaveDaily(), () => {
      this.clock = null;
      void this.refreshMoon();
      const ask = this.pendingAsk;
      this.pendingAsk = null;
      // the track board has slid in: a calm beat, then the question (once)
      if (ask) setTimeout(() => {
        if (!this.ask.isOpen && !this.deps.session.daily) ask();
      }, motion.reduced ? 300 : 700);
      // R2 (A2): a happy daily (✨ / the 7th day) — the rating ask, only when no question comes now
      const moment = this.pendingRating;
      this.pendingRating = null;
      if (moment && !ask) this.ratingSoon(moment);
    });
  }

  // ---------------------------------------------------------------- R2 (A2) rating ask

  /** a happy daily's moment, asked when the evening is over (the night beat → the track) */
  private pendingRating: HappyMoment | null = null;

  private async noteDailyMoment(dm: DailyMod, hints: number): Promise<void> {
    try {
      await dm.logSettled();
      const days = Object.keys(await dm.loadLog()).length;
      this.pendingRating = dailyMoment({ counted: true, hints, countedDays: days });
    } catch (e) {
      console.warn("[rating] daily", e);
    }
  }

  /** After a calm beat, if the screen is still quiet: hand the moment to the rating policy. */
  private ratingSoon(moment: HappyMoment | null): void {
    if (!moment) return;
    setTimeout(() => {
      if (!this.isIdle() || this.ask.isOpen || this.tutOn || this.card?.isOpen || this.townOpen) return;
      void rating.moment(moment);
    }, motion.reduced ? 400 : 900);
  }

  // ---------------------------------------------------------------- R2 (A7) the first daily's offer

  /** shown once (Preferences "dailyOffer"), or the daily was already opened; null until read */
  private offerSeen: boolean | null = null;

  /**
   * After gentle 3, at the first quiet moment on gentle 4+ (no move yet, nothing else up): one small card
   * — "Today's puzzle" + what it is — [Play] opens today's daily, [Not now] closes it. Never again.
   */
  private stepOffer(now: number): void {
    if (this.offerSeen !== false) return;
    const s = this.deps.session;
    if (s.daily || s.track !== "gentle" || s.cleared("gentle") < DAILY_AFTER || s.complete || s.moves.length > 0) return;
    if (!this.isIdle() || this.tutOn || this.guide.active || !this.moonKnown || this.card?.isOpen || this.breakChip.visible || this.night) return;
    if (now - Math.max(this.lastInput, this.decoratedAt) < 900) return;
    this.offerSeen = true;
    void Preferences.set({ key: "dailyOffer", value: "1" }).catch(() => undefined);
    // today's daily already done (the moon / an older build): nothing to offer
    if (!this.scenery.moonBreath) return;
    // the card says what the daily's own welcome card would say: that one is not shown again
    void Preferences.set({ key: "dailyIntro", value: "1" }).catch(() => undefined);
    const today = localDateISO();
    const day = Number(today.slice(8, 10));
    const ph = moonPhase(today);
    const u = this.u;
    this.showAsk(
      {
        kind: "dailyOffer",
        title: a11y.t("daily.title"),
        art: {
          key: `dailyIntro-${day}-${ph}`,
          draw: (ctx, w, h) => {
            const tw = Math.round(h * 0.82);
            ctx.save();
            ctx.translate(Math.round((w - tw) / 2), Math.round((h - tw * 1.1) / 2));
            drawCalendarTile(ctx, tw, Math.round(tw * 1.1), day, ph, u);
            ctx.restore();
          },
        },
        text: `${a11y.t("daily.intro")}\n${a11y.t("daily.intro2")}`,
        yes: a11y.t("daily.offerYes"),
        no: a11y.t("ask.later"),
      },
      {
        yes: () => this.onMoon(),
        no: () => {
          this.lastInput = this.time.now;
        },
      },
    );
    this.flow("dailyOffer");
  }

  // ---------------------------------------------------------------- blocked cells

  private hideBlocked(): void {
    if (!this.blockedShown) return;
    this.blockedShown = false;
    this.board.showBlocked([], this.time.now);
  }

  private blockedNow(): BlockedCell[] {
    const s = this.deps.session;
    if (this.blockedCache.state !== s.state) this.blockedCache = { state: s.state, list: blockedCells(s.level, s.state, s.analysis()) };
    return this.blockedCache.list;
  }

  /**
   * Stuck read-out (round 5: ONE culprit). Dark cells nothing can light any more and
   * numbers that can no longer reach their count (⊘) show after a pause (1.2 s), or at
   * once when every number is satisfied and only such cells are left. Only the rules'
   * culprit is blamed (tilt, flicker, cool rim, bright thread through the spot its light
   * covers); stones it involves get a faint thread. No culprit → only the markers.
   * Testers (8/8): "J-16 listed five lanterns and three rocks".
   */
  private stepBlocked(now: number): void {
    if (this.blockedShown || this.tutOn || this.howTo?.isOpen || this.finale || this.switching || this.travel || this.townOpen || this.sheet.isOpen || this.deps.session.complete) return;
    if (this.board.busy || this.guide.active) return;
    const s = this.deps.session;
    const a = s.analysis();
    // v11 (C6 / D14): one error at a time — a conflict or an over-full number is explained first;
    // gentle 1–3 show no stuck marks at all (C3: "wrong" before the numbers were even learned) — the
    // error line alone says that one lantern is misplaced (stepErr)
    if (a.conflicts.length > 0 || a.stones.some((st) => st.status === "over") || this.earlyBoard()) return;
    const list = this.blockedNow();
    const stuckNums = cannotReach(a);
    // round 7 (R): nothing stuck locally, but the forced moves from here break further on — the
    // dead end is read out exactly like a stuck spot (Priya J-25: a silent "none" on a dead board)
    const dead = a.deadEnd;
    if (list.length === 0 && stuckNums.length === 0 && !dead) return;
    // phase 2 (audit P1-9): one delay for every case (0.9 s of no input; input cancels it)
    if (now - this.lastInput < BLOCKED_IDLE_MS) return;
    this.blockedShown = true;
    rating.noteDeadEnd();
    const culprit = culpritOf(a);
    const near = (x: number, y: number): number => Math.abs((x & 7) - (y & 7)) + Math.abs((x >> 3) - (y >> 3));
    // r6: exactly ONE thing lights — one stuck spot (a dark cell, else a number) and, when the
    // rules name a culprit tied to it, one thread to that ONE lantern. Nothing else is marked
    // (testers saw "three things at once": a second cell, a second number, standing rings).
    const view: BlockedView[] = [];
    const nums: StuckStoneView[] = [];
    let threaded = false;
    if (culprit >= 0) {
      const cell = list.filter((b) => b.culprits.includes(culprit) || b.lanterns.includes(culprit)).sort((x, y) => near(x.cell, culprit) - near(y.cell, culprit))[0];
      if (cell) {
        const j = cell.lanterns.indexOf(culprit);
        const via = j >= 0 ? cell.via[j]! : this.viaFor(cell.cell, culprit);
        view.push({ cell: cell.cell, stones: [], lanterns: [culprit], via: [via], strong: true });
        threaded = true;
      } else {
        const st = stuckNums.filter((x) => x.lanterns.includes(culprit)).sort((x, y) => near(x.stone, culprit) - near(y.stone, culprit))[0];
        if (st) {
          nums.push({ stone: st.stone, lantern: culprit, via: this.stoneVia(st.stone, culprit), faint: false });
          threaded = true;
        }
      }
    }
    if (!threaded && dead && culprit >= 0) {
      if (dead.kind === "cell") view.push({ cell: dead.at, stones: [], lanterns: [culprit], via: [this.viaFor(dead.at, culprit)], strong: true });
      else nums.push({ stone: dead.at, lantern: culprit, via: this.stoneVia(dead.at, culprit), faint: false });
      threaded = true;
    }
    // nothing tied to the culprit (or no culprit): one marker alone
    if (!threaded) {
      if (list.length > 0) view.push({ cell: list[0]!.cell, stones: [], lanterns: [], via: [], strong: false });
      else if (stuckNums.length > 0) nums.push({ stone: stuckNums[0]!.stone, lantern: -1, via: -1, faint: false });
      else if (dead) {
        if (dead.kind === "cell") view.push({ cell: dead.at, stones: [], lanterns: [], via: [], strong: false });
        else nums.push({ stone: dead.at, lantern: -1, via: -1, faint: false });
      }
    }
    this.board.showBlocked(view, now, nums);
    const ping = threaded ? culprit : -1;
    // v11: the read-out's one line, once per board ("this number" / "this tile" = the one marked)
    // (every tile lit, a number short: the gentler "check the numbers" line speaks instead — stepErr)
    const said = !this.errSeen.has("stuck") && this.bandFor !== "hint" && this.boardError()?.kind === "stuck";
    if (said) {
      this.errSeen.add("stuck");
      const lv = s.level;
      const line = nums[0] ? a11y.t("err.stuckNum", { n: lv.clues[nums[0].stone]! }) : a11y.t("err.stuckCell");
      this.errKindShown = "stuck";
      this.showLine("err", { main: line, tone: "warn" }, now, 3200);
    } else this.a11yAnnounce("stuck");
    if (ping >= 0) {
      const h = s.level.h;
      setTimeout(() => cue("stoneTap", { pitchIndex: pitchIndexForCell(ping & 7, ping >> 3, h) }), motion.reduced ? 0 : 420);
    }
  }

  // ---------------------------------------------------------------- v11 error line (NOVICE-TEST §5-C)

  /** gentle 1–3: no stuck marks / threads yet (the line alone explains a dead end). */
  private earlyBoard(): boolean {
    const s = this.deps.session;
    return !s.daily && s.track === "gentle" && s.levelNumber <= 3;
  }

  /** The one error to explain (priority: conflict > number over > 0 broken > dead end > all lit, numbers wrong). */
  private boardError(): BoardError | null {
    const s = this.deps.session;
    if (this.errCache.state !== s.state) this.errCache = { state: s.state, err: this.computeError() };
    return this.errCache.err;
  }

  private computeError(): BoardError | null {
    const s = this.deps.session;
    const lv = s.level;
    const a = s.analysis();
    const pair = a.conflicts[0];
    if (pair) return { kind: "conflict", at: pair[0] };
    const over = a.stones.find((st) => st.status === "over" && st.need > 0);
    if (over) return { kind: "over", at: over.cell, n: over.need };
    const zero = a.stones.find((st) => st.status === "over" && st.need === 0);
    if (zero) return { kind: "zero", at: zero.cell, n: 0 };
    let dark = false;
    for (let i = 0; i < 64 && !dark; i++) if ((i & 7) < lv.w && i >> 3 < lv.h && !hasBit(lv.stones, i) && a.lit[i] !== 1) dark = true;
    if (!dark) {
      // every tile lit, yet not solved: a number is short (the last, gentlest line)
      const wrong = a.stones.find((st) => st.status !== "ok");
      return wrong ? { kind: "numbers", at: wrong.cell, n: wrong.need } : null;
    }
    if (this.blockedNow().length === 0 && cannotReach(a).length === 0 && !a.deadEnd) return null;
    return { kind: this.earlyBoard() ? "early" : "stuck", at: -1 };
  }

  /**
   * One line at a time, 0.9 s after the error appears (input meanwhile postpones it), 2.8 s on
   * screen, each kind once per board; it goes as soon as its error is fixed. Dead ends on gentle 4+
   * are explained by the stuck read-out (stepBlocked) together with its one mark.
   */
  private stepErr(now: number): void {
    const s = this.deps.session;
    const key = `${s.seedKey}|${s.daily ?? ""}`;
    if (key !== this.errBoard) {
      this.errBoard = key;
      this.errSeen.clear();
    }
    if (this.bandFor && !this.band.isOpen) this.bandFor = "";
    const quiet = this.decorated && !this.tutOn && !this.howTo?.isOpen && !this.finale && !this.switching && !this.travel && !this.townOpen && !this.sheet.isOpen && !this.ask.isOpen && !this.card?.isOpen && !this.night && !s.complete;
    if (!quiet) {
      if (this.bandFor) this.hideBand();
      return;
    }
    const err = this.boardError();
    this.board.setFocus(err?.kind === "conflict" ? "conflict" : err?.kind === "over" || err?.kind === "zero" ? "over" : null);
    const ek = err ? `${err.kind}:${err.at}` : "";
    if (this.bandFor === "err" && this.errKindShown !== "stuck" && ek !== this.errKindShown) this.hideBand();
    if (this.bandFor === "err" && this.errKindShown === "stuck" && (!err || (err.kind !== "stuck" && err.kind !== "early"))) this.hideBand();
    if (!err || err.kind === "stuck" || this.errSeen.has(err.kind)) return;
    if (now - this.lastInput < BLOCKED_IDLE_MS || this.board.busy || this.bandFor === "hint" || this.guide.active?.kind === "remove") return;
    this.errSeen.add(err.kind);
    this.errKindShown = ek;
    const t = (k: string, v?: Record<string, string | number>): string => a11y.t(k, v);
    switch (err.kind) {
      case "conflict":
        this.showLine("err", { main: t("err.conflict"), tone: "warn" }, now, 2800);
        break;
      case "over":
        this.showLine("err", { main: t("err.over", { n: err.n ?? 0 }), tone: "warn" }, now, 2800);
        break;
      case "zero":
        this.showLine("err", { main: t("err.zero"), tone: "warn" }, now, 2800);
        break;
      case "early":
        rating.noteDeadEnd();
        this.showLine("err", { main: t("err.early"), sub: t("err.earlySub"), tone: "warn" }, now, 4200);
        break;
      case "numbers":
        // the number(s) still short get a soft moonlight pulse
        for (const st of s.analysis().stones) if (st.status !== "ok") this.board.pulse(st.cell, now);
        this.showLine("err", { main: t("err.numbers") }, now, 3200);
        break;
    }
  }

  /** Show a line in the band (and say it for VoiceOver). */
  private showLine(kind: "err" | "hint" | "stone" | "lesson", lines: import("./LineBand.ts").BandLines, now: number, holdMs: number): void {
    const text = lines.sub ? `${lines.main} ${lines.sub}` : lines.main;
    const again = this.band.text === text;
    this.bandFor = kind;
    this.band.show(lines, now, holdMs);
    if (kind !== "hint" && !again) this.a11y?.say(text);
    this.a11yT = 0;
  }

  private hideBand(): void {
    this.bandFor = "";
    this.band.hide(this.time.now);
  }

  /** Tests / shots: what the band says now ("" = nothing). */
  get bandText(): string {
    return this.band.text;
  }

  /** The candidate of `cell` (itself or a cell in its runs) that lantern `l`'s light covers. */
  private viaFor(cell: number, l: number): number {
    const lv = this.deps.session.level;
    const ray = new Set(raysOf(lv, l));
    for (const q of raysOf(lv, cell)) if (ray.has(q) && q !== l) return q;
    return l;
  }

  /** A free side of `stone` that lantern `l` lights (the thread bends there), or -1. */
  private stoneVia(stone: number, l: number): number {
    const lv = this.deps.session.level;
    const ray = new Set(raysOf(lv, l));
    for (const q of floorNeighbours(lv, stone)) if (q !== l && ray.has(q)) return q;
    return -1;
  }

  /** What the wrong lantern on `cell` breaks (a number, a stuck cell, the lantern it sees), for the remove hint. */
  private whyOf(cell: number): WhyView | null {
    const s = this.deps.session;
    const a = s.analysis();
    const near = (x: number): number => Math.abs((x & 7) - (cell & 7)) + Math.abs((x >> 3) - (cell >> 3));
    const over = a.stones.filter((st) => st.status === "over" && near(st.cell) === 1);
    if (over[0]) return { target: over[0].cell, kind: "stone" };
    const cells = this.blockedNow().filter((b) => b.culprits.includes(cell) || b.lanterns.includes(cell)).sort((x, y) => near(x.cell) - near(y.cell));
    if (cells[0]) return { target: cells[0].cell, kind: "cell" };
    const nums = (a.stuckStones ?? []).filter((st) => st.lanterns.includes(cell)).sort((x, y) => near(x.stone) - near(y.stone));
    if (nums[0]) return { target: nums[0].stone, kind: "stone" };
    const pair = a.conflicts.find(([p, q]) => p === cell || q === cell);
    if (pair) return { target: pair[0] === cell ? pair[1] : pair[0], kind: "lantern" };
    return null;
  }

  // ---------------------------------------------------------------- guide (first run)

  /** Which first-run lesson belongs to the current level, if it is still due. */
  private guideLesson(): number {
    const s = this.deps.session;
    // "show the guide again" (settings): the goal card, then the tap lesson on this board
    if (this.replayPending && !s.complete && !s.daily) return !guideDone(GUIDE.goal) ? GUIDE.goal : GUIDE.tap;
    if (s.track !== "gentle" || s.complete || s.daily) return 0;
    const n = s.levelNumber;
    // v11: gentle 1's goal card and tap lesson are replaced by the first-yard tutorial
    const bit = n === 2 ? GUIDE.digit : n === 3 ? GUIDE.conflict : 0;
    return bit && !guideDone(bit) ? bit : 0;
  }

  /** Start the level's lesson (fresh board only), the remove nudge, or the track nudge. */
  private stepGuide(now: number): void {
    if (!this.decorated || this.tutOn || this.howTo?.isOpen || this.finale || this.switching || this.travel || this.townOpen || this.sheet.isOpen) return;
    const g = this.guide;
    const s = this.deps.session;
    // VoiceOver users cannot see the finger: no demos while it runs (A's README)
    if (vis.p.voiceOver) {
      if (g.active) g.stop();
      return;
    }
    if (g.active) {
      if (g.active.kind === "track" && g.loops >= 2) {
        g.stop();
        markGuide(GUIDE.track);
      }
      if (g.active?.kind === "moon" && g.loops >= 2) {
        // one-time: two taps on the moon, then the static halo / breathing carries on alone
        g.stop();
        markGuide(GUIDE.moon);
      }
      if (g.active?.kind === "goal" && g.loops >= 2) {
        // goal seen twice → on to the first real lesson
        g.stop();
        markGuide(GUIDE.goal);
        this.lastInput = now - 600;
      }
      return;
    }
    if (this.board.busy || this.blockedShown || this.hintState.kind !== "idle") return;
    const idle = now - this.lastInput;
    const lesson = this.guideLesson();
    if (lesson && !this.replayPending && syncSignal.holdGuide()) return; // a restore may be landing
    if (lesson && (s.moves.length === 0 || (this.replayPending && lesson === GUIDE.goal)) && idle >= (this.guideStopped ? GUIDE_IDLE_MS : 600)) {
      if (this.replayPending && lesson === GUIDE.tap) this.replayPending = false;
      const lv = s.level;
      const sol = solutionOf(lv);
      if (!sol) return;
      const solCells: number[] = [];
      for (let i = 0; i < 64; i++) if (hasBit(sol, i)) solCells.push(i);
      if (lesson === GUIDE.goal) g.start({ kind: "goal" }, now);
      else if (lesson === GUIDE.tap) {
        // the answer lantern that lights the most cells: the clearest "light spreads"
        let best = solCells[0]!;
        for (const c of solCells) if (raysOf(lv, c).length > raysOf(lv, best).length) best = c;
        g.start({ kind: "tap", cell: best }, now);
      } else if (lesson === GUIDE.digit) {
        let pick: { stone: number; cells: number[] } | null = null;
        // prefer a rock the opening shows on its own (startCells: its free sides = its number)
        const open = startCells(lv);
        for (let i = 0; i < 64; i++) {
          const need = lv.clues[i]!;
          if (need === NO_CLUE || need === 0) continue;
          const cells = open.filter((c) => Math.abs((c & 7) - (i & 7)) + Math.abs((c >> 3) - (i >> 3)) === 1);
          if (cells.length === need && (!pick || need < pick.cells.length)) pick = { stone: i, cells };
        }
        for (let i = 0; i < 64 && !pick; i++) {
          const need = lv.clues[i]!;
          if (need === NO_CLUE || need === 0) continue;
          const cells = solCells.filter((c) => Math.abs((c & 7) - (i & 7)) + Math.abs((c >> 3) - (i >> 3)) === 1);
          if (cells.length === need) pick = { stone: i, cells };
        }
        if (pick) {
          // round 5: teach the 0 too — a 0 rock with a free side away from the lesson's light
          const lit = new Set<number>();
          for (const c of pick.cells) for (const q of raysOf(lv, c)) lit.add(q);
          let zero: { stone: number; cell: number } | undefined;
          let best = 99;
          for (let i = 0; i < 64; i++) {
            if (lv.clues[i] !== 0 || !hasBit(lv.stones, i)) continue;
            for (const c of floorNeighbours(lv, i)) {
              if (pick.cells.includes(c)) continue;
              const score = (lit.has(c) ? 4 : 0) + (floorNeighbours(lv, c).length < 2 ? 1 : 0) + Math.abs((c & 7) - (pick.stone & 7)) * 0.1;
              if (score < best) {
                best = score;
                zero = { stone: i, cell: c };
              }
            }
          }
          g.start(zero ? { kind: "digit", stone: pick.stone, cells: pick.cells, zero } : { kind: "digit", stone: pick.stone, cells: pick.cells }, now);
          // v11: the review demo says its rule in the band (the tutorial's words, NOVICE-TEST §5-A)
          this.showLine("lesson", { main: a11y.t("tut.t4a"), sub: a11y.t(zero ? "how.c4s" : "tut.t4b") }, now, 7000);
        } else markGuide(GUIDE.digit);
      } else {
        const pair = seeingPair(lv);
        if (pair) {
          g.start({ kind: "conflict", a: pair[0], b: pair[1] }, now);
          this.showLine("lesson", { main: a11y.t("tut.t3a"), sub: a11y.t("tut.t3ok") }, now, 7000);
        }
        else markGuide(GUIDE.conflict);
      }
      return;
    }
    if (this.replayPending && lesson === 0) this.replayPending = false;
    // during the first-run levels: two real lanterns see each other and the player pauses → finger taps one
    if (s.daily) return;
    // phase 2 (audit P0-4): once, after gentle 3, while today's daily is unplayed: the finger taps the moon
    if (
      !guideDone(GUIDE.moon) && s.cleared("gentle") >= DAILY_AFTER + 1 && this.offerSeen === true && this.scenery.moonBreath && this.moonKnown && s.moves.length === 0 &&
      idle >= 1400 && !this.travel && (guideDone(GUIDE.tower) || !this.towerUnlocked())
    ) {
      // r6: the finger now taps the visible "today" button (the moon stays a second way in)
      const t = this.todayAvailable() ? { x: this.todayBtn.x, y: this.todayBtn.y + 4 * this.u } : { x: this.scenery.moonX, y: this.scenery.moonY + this.scenery.moonR * 0.4 };
      g.start({ kind: "moon", ...t }, now);
      return;
    }
    if (s.track === "gentle" && s.levelNumber <= 3 && !guideDone(GUIDE.track) && idle >= 1600) {
      const c = s.analysis().conflicts[0];
      if (c) {
        g.start({ kind: "remove", cell: s.lastMoveCell === c[0] ? c[0] : c[1] }, now);
        return;
      }
    }
    // once, after gentle 5: the camera looks over to the tower while it lights up (1.5 s), then the finger taps it.
    // Quiet time counts from when the board became playable (decorate), not from the scene's creation:
    // at launch the look would otherwise start right as the first taps arrive.
    const quiet = now - Math.max(this.lastInput, this.decoratedAt);
    if (s.track === "gentle" && this.towerUnlocked() && s.moves.length === 0 && quiet >= 1200 && this.down === "none" && !this.travel) {
      const f = this.scenery.farTarget;
      if (!guideDone(GUIDE.tower)) {
        if (motion.reduced) {
          this.scenery.revealTower(now);
          markGuide(GUIDE.tower);
        } else this.startTravel("reveal", f.x, f.y);
        return;
      }
      if (!guideDone(GUIDE.track)) {
        this.trackNudgeT0 = now;
        g.start({ kind: "track", x: f.x, y: f.y }, now);
      }
    }
  }

  private guideStopped = false;
  /** scene time the board became playable (decorate); unrequested camera moves wait from here */
  private decoratedAt = 0;

  private stopGuideOnTouch(): void {
    const a = this.guide.active;
    if (!a) return;
    if (a.kind === "track") markGuide(GUIDE.track);
    if (a.kind === "moon") markGuide(GUIDE.moon);
    if (a.kind === "goal") markGuide(GUIDE.goal);
    this.guide.stop();
    this.guideStopped = true;
  }

  /** A real move ends the level's lesson for good. */
  private onGuideMove(): void {
    const lesson = this.guideLesson();
    if (lesson) markGuide(lesson);
    this.replayPending = false;
    this.guide.stop();
    this.guideStopped = false;
    this.dropBreak(true);
  }

  // ---------------------------------------------------------------- v11 HUD captions (NOVICE-TEST D1)

  /** One caption line under the HUD icons: 13 pt × Dynamic Type (≤ 1.4), canvas px incl. a little air. */
  private capHeight(): number {
    return Math.round(13 * this.u * Math.min(1.4, Math.max(1, vis.p.fontScale)) * 1.25 + 2 * this.u);
  }

  /** Town · Today · Undo · Hint under the row; Settings · Rules · Back under the top row's discs. */
  private makeCaptions(): void {
    const mk = (of: PhaserTypes.GameObjects.Image, key: string, dy: number): void => {
      const t = this.add.text(0, 0, "", { fontFamily: uiFont(), color: UI.caption, align: "center" }).setOrigin(0.5, 0).setDepth(DEPTH.hud).setVisible(false);
      t.setShadow(0, Math.round(1 * this.u), "rgba(6,7,20,0.9)", Math.round(3 * this.u), false, true);
      this.caps.push({ t, of, key, dy });
    };
    mk(this.leftBtn, "cap.town", 0);
    mk(this.todayBtn, "cap.today", 0);
    mk(this.undoBtn, "cap.undo", 0);
    mk(this.hintBtn, "cap.hint", 0);
    // R2: the top row's discs carry their captions under them too (Settings, Rules, Back)
    mk(this.gearIcon, "cap.settings", -1);
    mk(this.howBtn, "cap.how", -1);
    mk(this.backChip, "cap.back", -1);
    this.markHud(this.caps.map((c) => c.t));
    this.placeCaptions();
  }

  private placeCaptions(): void {
    if (this.caps.length === 0) return;
    const u = this.u;
    const g = this.geo;
    const fs = Math.round(13 * u * Math.min(1.4, Math.max(1, vis.p.fontScale)));
    for (const c of this.caps) {
      c.t.setFontFamily(uiFont()).setFontSize(fs).setFontStyle(vis.p.boldText ? "800" : "700").setScale(1).setText(a11y.t(c.key));
      // the top row's pitch follows its captions, so they may be a little wider (R2)
      const capMax = (c.dy === -1 ? 84 : 76) * u;
      if (c.t.width > capMax) c.t.setScale(capMax / c.t.width);
    }
    // R2 (Reality #10): every caption UNDER its disc — the top row's pitch follows its captions
    this.placeTopRow();
    for (const c of this.caps) {
      const y = c.dy >= 0 ? g.ctrlY + g.ctrlS / 2 + 1 * u + c.dy * u : c.of.y + (TOP_DISC * u) / 2 + 1 * u;
      c.t.setOrigin(0.5, 0).setPosition(c.of.x, y);
    }
    this.layoutAlley();
  }

  // ---------------------------------------------------------------- v11 "?" How to play (NOVICE-TEST §5-B)

  /** Rules: the HUD disc with a bold "?" (R2: same disc as every button; "Rules" under it). */
  private bakeHowBtn(): void {
    const u = this.u;
    const sz = Math.round(TOP_DISC * u);
    const bold = vis.p.boldText;
    this.howBtn.setTexture(this.bank.canvas(`rulesDisc${vis.sig}@${sz}`, sz, sz, (ctx, w) => drawRulesDisc(ctx, w, bold)));
  }

  private async openHowTo(): Promise<void> {
    if (this.finale || this.switching || this.travel || this.townOpen || this.tutOn || this.howTo?.isOpen || this.night) return;
    cue("tap");
    this.clearHint();
    this.hideBand();
    this.hideBlocked();
    this.guide.stop();
    try {
      const m = await this.loadHowTo();
      if (!this.howTo) {
        this.howTo = new m.HowToSheet({
          scene: this,
          bank: this.bank,
          u: this.u,
          ui: (objs) => this.markHud(objs),
          t: (k) => a11y.t(k),
          safeBottom: () => this.deps.safe.bottom,
        });
        this.howTo.layout(this.geo.W, this.geo.H, this.u);
      }
      if (this.finale || this.switching || this.travel || this.townOpen || this.tutOn) return;
      this.howTo.show(this.time.now);
      // the daily's clock rests while the rules are read (spec §5-B)
      const s = this.deps.session;
      if (s.daily && this.clock && this.ds && !this.ds.result && !s.complete) {
        this.clock.stop();
        this.saveDailyNow();
      }
      this.flow("howto");
      this.a11yT = 0;
    } catch (e) {
      console.warn("[howto] could not open", e);
    }
  }

  private closeHowTo(): void {
    if (!this.howTo?.isOpen) return;
    const now = this.time.now;
    this.howTo.hide(now);
    const s = this.deps.session;
    if (s.daily && this.clock && this.ds && !this.ds.result && !s.complete) this.clock.start();
    this.lastInput = now;
    this.a11yT = 0;
  }

  // ---------------------------------------------------------------- v11 first-yard tutorial (NOVICE-TEST §5-A)

  /** The tutorial owns the screen (loading or running). */
  private get tutOn(): boolean {
    return this.tutWanted || this.tut !== null;
  }

  /**
   * Shown by itself only to a brand-new player: gentle 1, nothing cleared on either track, no move,
   * neither the tutorial nor the old goal card seen. Existing players never get it automatically
   * (the "?" sheet replays it).
   */
  private firstRunTutorial(): boolean {
    const s = this.deps.session;
    return !s.daily && s.levelOf("gentle") === 1 && s.cleared("gentle") === 0 && s.cleared("deduce") === 0 && s.moves.length === 0 && !s.complete &&
      !guideDone(GUIDE.tutorial) && !guideDone(GUIDE.goal);
  }

  /** Start the tutorial (first run, or a replay from the "?" sheet). Never counts as a unit, never touches the session. */
  async startTutorial(replay: boolean): Promise<void> {
    if (this.tut || this.tutLoading) return;
    if (replay && (this.finale || this.switching || this.travel || this.townOpen)) return;
    this.tutLoading = true;
    this.tutWanted = true;
    this.clearHint();
    this.hideBlocked();
    this.hideBand();
    this.guide.stop();
    // a replay on the daily: its clock rests meanwhile
    if (this.deps.session.daily) {
      this.clock?.stop();
      this.saveDailyNow();
    }
    try {
      const m = await this.loadTutorial();
      const faces = await loadLanternFaces();
      if (!this.tutWanted) return; // a restore landed meanwhile
      const host: import("./Tutorial.ts").TutorialHost = {
        scene: this,
        bank: this.bank,
        u: this.u,
        area: () => {
          const g = this.geo;
          const u = this.u;
          return { W: g.W, H: g.H, top: g.ctrlY - g.ctrlS / 2, bottom: g.H - Math.max(this.deps.safe.bottom * u, 12 * u) - 10 * u, side: g.side, safeTop: this.deps.safe.top * u };
        },
        ui: (objs) => this.markHud(objs),
        windows: (k) => {
          const now = this.time.now;
          const n = this.house ? this.house.windows.length - 1 : 0;
          this.scenery.setProgress(Math.min(k, n), now, true);
          if (k > n) this.scenery.lightHeart(true, now, true);
        },
        t: (k, v) => a11y.t(k, v),
        say: (text) => {
          this.a11y?.say(text);
          this.a11yT = 0;
        },
        finished: (how) => this.endTutorial(how),
        faces,
      };
      this.tut = new m.Tutorial(host, replay);
      this.tut.start(this.time.now);
      this.flow(replay ? "tutorial-replay" : "tutorial");
    } catch (e) {
      console.warn("[tutorial] could not start", e);
      this.tutWanted = false;
    } finally {
      this.tutLoading = false;
    }
  }

  private endTutorial(how: "done" | "skipped"): void {
    const now = this.time.now;
    this.tut = null;
    this.tutWanted = false;
    this.tutEndT0 = now;
    markGuide(GUIDE.tutorial);
    markGuide(GUIDE.goal);
    markGuide(GUIDE.tap);
    this.flow(`tutorial-${how}`);
    // the house shows the real board's progress again; the board fades in (stepTutorial)
    this.scenery.lightHeart(this.deps.session.complete, now, false);
    this.redraw();
    this.lastInput = now;
    this.a11yT = 0;
    this.onTutorialEnd?.(how);
    // the "?" beside the gear pulses once: the rules are always there
    this.howPulseT0 = now + 500;
    const s = this.deps.session;
    if (s.daily && this.clock && this.ds && !this.ds.result && !s.complete) this.clock.start();
    this.a11yAnnounce("level", { n: s.levelNumber });
  }
  /** stage (b): the "?" button pulses once the tutorial is over */
  private onTutorialEnd: ((how: "done" | "skipped") => void) | null = null;

  /** The tutorial's frame step; the real board stays hidden under it and fades in after. */
  private stepTutorial(now: number): void {
    // first run: after the first frame, once a returning player's iCloud restore had its moment
    // (≤ 1.5 s, only while iCloud's first answer is due) — a restore then skips the tutorial
    if (this.tutWanted && !this.tut && !this.tutLoading && this.decorated && !syncSignal.holdGuide()) void this.startTutorial(false);
    this.tut?.update(now);
    if (this.tutOn) {
      this.board.root.setAlpha(0);
      return;
    }
    const k = (now - this.tutEndT0) / 450;
    if (k >= 0 && k < 1) this.board.root.setAlpha(motion.reduced ? 1 : easeOutCubic(k));
    else if (k >= 1 && k < 1.5) this.board.root.setAlpha(1);
  }

  // ---------------------------------------------------------------- tracks

  /** Draw these (and a container's children) with the fixed UI camera only. Idempotent. */
  private markHud(gos: readonly PhaserTypes.GameObjects.GameObject[]): void {
    const main = this.cameras.main;
    const visit = (go: PhaserTypes.GameObjects.GameObject): void => {
      this.hud.add(go);
      go.cameraFilter = (go.cameraFilter & ~this.uiCam.id) | main.id;
      // (phaser-core: duck-type containers — the Container class itself is not on the namespace)
      const list = (go as { list?: unknown }).list;
      if (Array.isArray(list)) for (const c of list as PhaserTypes.GameObjects.GameObject[]) visit(c);
    };
    for (const go of gos) visit(go);
  }

  /** Left button: the village (R2; inactive on the daily). The alley strip still opens the street. */
  private onLeft(): void {
    if (this.finale || this.switching || this.travel || this.moonPending || this.deps.session.daily) return;
    this.openVillageLazy();
  }

  /** The village (lazy chunk). While it is open the scene treats it like the town (townOpen: input off, HUD hidden). */
  private openVillageLazy(): void {
    if (this.finale || this.switching || this.travel || this.townOpen || this.moonPending) return;
    cue("tap");
    this.clearHint();
    this.hideBlocked();
    this.guide.stop();
    this.townOpen = true;
    const s = this.deps.session;
    const cleared = { gentle: s.cleared("gentle"), deduce: s.cleared("deduce") };
    // in memory when the daily chunk has read the log (usually: the moon did): no task hop
    const now = this.dm?.logNow();
    const today = localDateISO();
    const of = (log: Record<string, { hints: number }>): { cleared: { gentle: number; deduce: number }; dailyDates: string[]; today: string; hardToday: boolean } =>
      ({ cleared, dailyDates: Object.keys(log), today, hardToday: log[today]?.hints === 0 });
    const progress = now ? of(now) : async (): Promise<ReturnType<typeof of>> => of(await this.daily().then((m) => m.loadLog()).catch(() => ({})));
    void villageLoader().then(
      (m) => {
        this.clock?.stop();
        m.openVillage(this, {
          progress,
          lang: a11y.lang(),
          onClose: () => {
            this.townOpen = false;
            this.lastInput = this.time.now;
          },
        });
      },
      (e: unknown) => {
        console.warn("[village] failed to load", e);
        this.townOpen = false;
      },
    );
  }

  /** The daily's back chip (beside the gear): home to the track. */
  private onBack(): void {
    if (this.finale || this.switching || this.travel || this.moonPending || !this.deps.session.daily) return;
    this.clearHint();
    this.hideBlocked();
    this.leaveDaily();
  }

  /** The town street (lazy, optional module from the town agent); a no-op when it is not there. */
  private openTownLazy(): void {
    if (this.finale || this.switching || this.travel || this.townOpen || this.moonPending) return;
    if (!townLoader) return;
    cue("tap");
    this.clearHint();
    this.hideBlocked();
    this.guide.stop();
    this.townOpen = true;
    void townLoader().then(
      (m) => {
        if (!m.openTown) {
          this.townOpen = false;
          return;
        }
        this.clock?.stop();
        m.openTown(this, {
          onClose: () => {
            // (the town gives this scene its input back itself, before onClose)
            this.townOpen = false;
            this.lastInput = this.time.now;
          },
        });
      },
      (e: unknown) => {
        console.warn("[town] failed to load", e);
        this.townOpen = false;
      },
    );
  }

  /**
   * Is the tower open? Phase 5 (BENCHMARK-UX #10): after gentle 8 and not in the first session
   * (was gentle 5) — or the player has been there / has seen it open.
   */
  private towerUnlocked(): boolean {
    const s = this.deps.session;
    const visited = s.cleared("deduce") > 0 || s.levelOf("deduce") > 1 || s.track === "deduce" || guideDone(GUIDE.track) || guideDone(GUIDE.tower);
    return towerOpen({ cleared: s.cleared("gentle"), session: sessionCount(), visited });
  }

  /** Far landmark lights + plates follow the session. */
  private refreshFar(animate: boolean): void {
    const s = this.deps.session;
    const unlocked = this.towerUnlocked();
    // the lantern room stays dark until the first-unlock look has been shown once
    const beacon = unlocked && (guideDone(GUIDE.tower) || s.track === "deduce" || s.cleared("deduce") > 0);
    const mode = s.daily ? s.homeTrack : s.track;
    this.scenery.setFar(mode, { cleared: s.cleared("deduce"), unlocked, beacon, towerLevel: s.levelOf("deduce"), homeLevel: s.levelOf("gentle") }, animate, this.time.now);
  }

  /** The far tower (from home) or the far home (from the tower) was tapped: travel there. */
  private onFar(): void {
    if (this.finale || this.switching || this.travel || this.moonPending || this.deps.session.daily) return;
    const f = this.scenery.farTarget;
    if (f.kind === "tower" && !this.towerUnlocked()) {
      // not open yet: a soft knock, nothing else
      cue("stoneTap", { pitchIndex: 2 });
      return;
    }
    markGuide(GUIDE.track);
    markGuide(GUIDE.tower);
    if (this.guide.active?.kind === "track") this.guide.stop();
    this.trackNudgeT0 = -1e9;
    this.clearHint();
    this.hintDots = 0;
    this.hideBlocked();
    cue("tap");
    if (motion.reduced) {
      this.startSwitch(() => this.deps.session.switchTrack(), () => this.refreshFar(false));
      return;
    }
    this.startTravel("go", f.x, f.y);
  }

  /**
   * Camera travel. "go": the camera flies into the landmark (zoom in toward it), the
   * track swaps while the view is inside it, then the camera flies back out of the new
   * centre landmark (the tower now stands where the house was). "reveal": the first
   * unlock — the camera looks over to the tower, it lights up, the camera comes back (1.5 s).
   */
  private startTravel(kind: "go" | "reveal", tx: number, ty: number): void {
    const tr = { t0: this.time.now, kind, tx, ty, ready: kind === "reveal", swapped: false, inT0: 0, faded: false };
    this.travel = tr;
    // the zoomed view can show past the baked sky's edge: the camera paints its own background meanwhile
    this.cameras.main.setBackgroundColor(BG_HEX);
    this.saveDailyNow();
    if (kind === "go") {
      void this.deps.session.switchTrack().then(
        () => (tr.ready = true),
        (e: unknown) => {
          console.warn("[track] switch failed", e);
          tr.ready = true;
        },
      );
    }
  }

  /** A touch during the tower's first-unlock look: the camera snaps home and the touch counts. */
  private cancelReveal(): void {
    const tr = this.travel;
    if (!tr || tr.kind !== "reveal") return;
    const g = this.geo;
    const cam = this.cameras.main;
    cam.setZoom(1);
    cam.centerOn(g.W / 2, g.H / 2);
    cam.setBackgroundColor("rgba(0,0,0,0)");
    this.travel = null;
  }

  private stepTravel(now: number): void {
    const tr = this.travel;
    if (!tr) return;
    const cam = this.cameras.main;
    const g = this.geo;
    const cx = g.W / 2;
    const cy = g.H / 2;
    /** zoom + look at (x, y), kept inside the screen-sized world */
    const look = (z: number, x: number, y: number): void => {
      cam.setZoom(z);
      const hw = g.W / (2 * z);
      const hh = g.H / (2 * z);
      cam.centerOn(Math.min(g.W - hw, Math.max(hw, x)), Math.min(g.H - hh, Math.max(hh, y)));
    };
    const done = (): void => {
      look(1, cx, cy);
      cam.setBackgroundColor("rgba(0,0,0,0)");
      this.travel = null;
      this.lastInput = now;
    };
    if (tr.kind === "reveal") {
      const t = (now - tr.t0) / REVEAL_MS;
      // 0–0.33 look over, 0.33–0.66 hold while it lights, 0.66–1 back
      const k = t < 0.33 ? easeInOutCubic(clamp01(t / 0.33)) : t < 0.66 ? 1 : 1 - easeInOutCubic(clamp01((t - 0.66) / 0.34));
      look(1 + 0.9 * k, lerp(cx, tr.tx, k), lerp(cy, tr.ty, k));
      if (!tr.swapped && t >= 0.33) {
        tr.swapped = true;
        this.scenery.revealTower(now);
        markGuide(GUIDE.tower);
        cue("nearComplete");
      }
      if (t >= 1) {
        done();
        // then the finger shows the way: it taps the tower (once, until the player does)
        if (!guideDone(GUIDE.track)) {
          const f = this.scenery.farTarget;
          this.trackNudgeT0 = now;
          this.guide.start({ kind: "track", x: f.x, y: f.y }, now);
        }
      }
      return;
    }
    if (!tr.swapped) {
      const t = clamp01((now - tr.t0) / TRAVEL_IN);
      const k = easeInCubic(t);
      look(1 + (TRAVEL_ZOOM - 1) * k, lerp(cx, tr.tx, easeOutCubic(t)), lerp(cy, tr.ty, easeOutCubic(t)));
      if (!tr.faded && t >= 0.62) {
        tr.faded = true;
        cam.fadeOut(Math.round(TRAVEL_IN * 0.36), 10, 12, 30);
      }
      if (t >= 1 && tr.ready) {
        tr.swapped = true;
        tr.inT0 = now;
        const s = this.deps.session;
        this.layout();
        this.refreshFar(false);
        ambientForLevel(s.levelNumber);
        cue("nextLevel");
        if (s.restoredLastMove) this.board.pulse(index(s.restoredLastMove.x, s.restoredLastMove.y), now);
        cam.fadeIn(Math.round(TRAVEL_OUT * 0.45), 10, 12, 30);
      }
      return;
    }
    // out of the new centre landmark (the house / tower door)
    const t = clamp01((now - tr.inT0) / TRAVEL_OUT);
    const k = 1 - easeOutCubic(t);
    const hx = g.bcx;
    const hy = g.houseBaseY - this.scenery.houseHeight * 0.4;
    look(1 + (TRAVEL_ZOOM - 1) * k, lerp(cx, hx, k), lerp(cy, hy, k));
    if (t >= 1) done();
  }

  /** Board + house out, `task` (switch track / open or leave the daily), back in; `after` runs once swapped. */
  private startSwitch(task: () => Promise<void>, after: (() => void) | null = null): void {
    const sw = { t0: this.time.now, swapped: false, ready: false, inT0: 0, after };
    this.switching = sw;
    this.saveDailyNow();
    void task().then(
      () => (sw.ready = true),
      (e: unknown) => {
        console.warn("[track] switch failed", e);
        sw.ready = true;
      },
    );
  }

  private stepSwitch(now: number): void {
    const sw = this.switching;
    if (!sw) return;
    const g = this.geo;
    const reduced = motion.reduced;
    const offH = g.H - g.boardTop + 20 * g.u;
    const houseDrop = this.scenery.houseHeight + 40 * g.u;
    if (!sw.swapped) {
      const t = clamp01((now - sw.t0) / SW_OUT);
      if (reduced) this.board.root.setAlpha(1 - t);
      else {
        this.boardSlide = easeInCubic(t) * offH;
        this.board.root.y = g.bcy + this.boardSlide;
        this.scenery.setHouseOffset(easeInCubic(t) * houseDrop);
      }
      if (t >= 1 && sw.ready) {
        sw.swapped = true;
        sw.inT0 = now;
        const s = this.deps.session;
        this.cardK = 0;
        this.layout();
        if (!reduced) this.board.root.y = this.geo.bcy + this.boardSlide;
        else this.board.root.setAlpha(0);
        ambientForLevel(s.levelNumber);
        cue("nextLevel");
        if (s.restoredLastMove) this.board.pulse(index(s.restoredLastMove.x, s.restoredLastMove.y), now);
        sw.after?.();
        if (s.daily && s.complete) {
          // a completed daily (practice off) → show the board lit and its card
          const last = s.lastMoveCell >= 0 ? s.lastMoveCell : this.anyLantern();
          this.startFinale(last, 0, now + 300);
        }
      }
      return;
    }
    const t = clamp01((now - sw.inT0) / SW_IN);
    if (reduced) this.board.root.setAlpha(t);
    else {
      this.boardSlide = (1 - easeOutCubic(t)) * offH;
      this.board.root.y = g.bcy + this.boardSlide;
      this.scenery.setHouseOffset((1 - easeOutCubic(t)) * houseDrop);
    }
    if (t >= 1) {
      this.switching = null;
      this.boardSlide = 0;
      this.board.root.setPosition(g.bcx, g.bcy).setAlpha(1);
      this.scenery.setHouseOffset(0);
      this.lastInput = now;
    }
  }

  private feedback(cell: number, placed: boolean, res: SyncResult, overBefore: Set<number>): void {
    const s = this.deps.session;
    const h = s.level.h;
    const p = pitchIndexForCell(cell & 7, cell >> 3, h);
    // a stone that just went over gets a soft knock in its own pitch (never a buzzer)
    const nowOver = new Set<number>();
    for (const st of s.analysis().stones) if (st.status === "over") nowOver.add(st.cell);
    for (const c of nowOver) {
      if (overBefore.has(c)) continue;
      setTimeout(() => cue("stoneTap", { pitchIndex: pitchIndexForCell(c & 7, c >> 3, h) }), motion.reduced ? 0 : 160);
      break;
    }
    this.overStoneSet = nowOver;
    if (placed) {
      haptic.place();
      if (!res.invalid && res.newlyLit > 0) this.wick?.cue("place", this.time.now);
      cue("place", { pitchIndex: p, litCount: res.newlyLit });
      cue("spread", { pitchIndex: p, litCount: res.newlyLit });
      if (res.invalid) {
        const other = this.board.partnerOf(cell);
        const seq = other >= 0 ? [p, pitchIndexForCell(other & 7, other >> 3, h)] : [p];
        setTimeout(() => {
          cue("invalid", { sequence: seq });
          haptic.invalid();
        }, motion.reduced ? 0 : 140);
      }
    } else {
      haptic.remove();
      cue("remove", { pitchIndex: p });
    }
    this.afterSync(res, true);
  }

  /** House windows, fireflies and the near-complete state follow the board. */
  private afterSync(res: SyncResult, animate: boolean): void {
    const now = this.time.now;
    this.wick?.cue(res.conflictPairs > 0 ? "conflict" : "calm", now);
    const prog = this.house ? this.house.windows.length - 1 : 0;
    const k = res.floorCount > 0 ? Math.min(prog, Math.floor((res.litFloor / res.floorCount) * prog + 0.25)) : 0;
    this.scenery.setProgress(k, now + (animate ? res.settleMs * 0.6 : 0), animate);
    const near = res.darkCells.length > 0;
    if (near && !this.nearDark && animate) cue("nearComplete");
    this.nearDark = near;
    const pts = this.tmpPts;
    pts.length = 0;
    const r = this.board.root;
    for (const c of res.darkCells) pts.push(r.x + this.board.cx(c) * r.scaleX, r.y + this.board.cy(c) * r.scaleY);
    this.scenery.setFireflyTargets(pts);
  }

  /** Snap everything to the session state (no animation). */
  redraw(): void {
    const s = this.deps.session;
    const res = this.board.sync(s.state, this.time.now, null);
    const a = s.analysis();
    this.board.setStones(this.stoneView(a), this.time.now, false);
    this.overStoneSet = new Set(a.stones.filter((x) => x.status === "over").map((x) => x.cell));
    this.scenery.lightHeart(s.complete, this.time.now, false);
    this.afterSync(res, false);
  }

  // ---------------------------------------------------------------- finale

  private startFinale(origin: number, settleMs: number, t0: number): void {
    const reduced = motion.reduced;
    haptic.completeHit();
    this.scenery.setFireflyTargets([]);
    const spreadEnd = Math.max(150, settleMs);
    const waveAt = spreadEnd + 100;
    const s0 = this.deps.session;
    const unit: UnitInfo = { track: s0.track, daily: !!s0.daily, playSeconds: this.play.seconds() };
    const W = this.geo.W;
    // phase 5: the street visit after gentle 5 / 10 / 15 … (once per level)
    const n = s0.levelNumber;
    const visit = !s0.daily && s0.track === "gentle" && townLoader !== undefined && milestoneOf(n) !== null && n > this.visited ? n : 0;
    const needNext = !s0.daily && s0.track === "gentle" && n <= NEXT_BUTTON_UPTO;
    const p5 = { visit, gate: "idle" as const, quick: false, adsGated: false, finDone: false, needNext, nextTapped: false };
    let f: Finale;
    if (reduced) {
      f = { t0, origin, waveAt, flowAt: waveAt, heartAt: waveAt, riseAt: 1e9, outAt: waveAt + 450, inAt: waveAt + 650, endAt: waveAt + 900, fired: 0, advanced: false, reduced, hold: false, inFrom: W, unit, ...p5 };
    } else {
      // the alley's finale (every 10th) holds the lit house a little longer (BENCHMARK-UX #4)
      const long = !s0.daily && n % 10 === 0 ? 1.5 : 1;
      const flowAt = waveAt + 220;
      const outAt = flowAt + Math.round(500 * long);
      const inAt = outAt + 320;
      f = { t0, origin, waveAt, flowAt, heartAt: flowAt + 380, riseAt: flowAt + 260, outAt, inAt, endAt: inAt + 380, fired: 0, advanced: false, reduced, hold: false, inFrom: W, unit, ...p5 };
    }
    this.a11yAnnounce("complete");
    this.wick?.cue("solve", t0 + spreadEnd);
    // v11 (D2): the solved moment says so — "Solved!" for 1.4 s. R2 (P1-1): in the slot over the board,
    // never over a number stone or a lantern
    const g0 = this.geo;
    this.bigWord.show(a11y.t("done.solved"), g0.bcx, g0.boardTop - g0.slotH / 2, g0.u, t0 + spreadEnd, reduced ? 1100 : 1400, Math.min(30, (g0.slotH / g0.u - 10) / 1.2));
    this.finale = f;
    this.downCell = -1;
    // the next level is generated in the worker while this finale plays (no-op if already there)
    if (!this.deps.session.daily) this.deps.session.prefetchNext();
  }

  private stepFinale(now: number): void {
    const f = this.finale;
    if (!f) return;
    let e = now - f.t0;
    const g = this.geo;
    const s = this.deps.session;
    // round 2: the house / board exit (and the daily's sheet) waits for V's finale (≈ 2.6 s, alley
    // 3.9 s, Reduce Motion 1 s): the timeline stands still at the exit beat until it has played
    const exitAt = f.reduced ? f.outAt - 200 : f.outAt;
    if (f.fired & F_WAVE && !f.finDone && e > exitAt) {
      f.t0 = now - exitAt;
      e = exitAt;
    }
    // v11: the first three houses wait for the player's "Next house →" (the board stays lit meanwhile)
    if (f.needNext && !f.nextTapped && e > exitAt - 150) {
      // R2: "Next house →" takes the slot once "Solved!" has had its moment there
      if (this.nextT0 < 0 && !this.bigWord.shown) this.showNext(now);
      if (e > exitAt) {
        f.t0 = now - exitAt;
        e = exitAt;
      }
    }
    if (!(f.fired & F_WAVE) && e >= f.waveAt) {
      f.fired |= F_WAVE;
      const order = this.board.placementOrder.map((c) => pitchIndexForCell(c & 7, c >> 3, s.level.h));
      cue("complete", { sequence: order.length ? order : [7] });
      const kind: FinaleKind = s.daily ? "daily" : s.levelNumber % 10 === 0 && s.track === "gentle" ? "alley" : "level";
      // R2 (P1-1 / P1-2): no camera push (it pulled the board ~25 pt down, into the home-indicator zone)
      // and the plate keeps the solved house's number — the next house arrives with its own plate
      const opts = { origin: f.origin, now, reduced: f.reduced, kind, camera: false };
      void this.board.playFinale(opts).then(
        () => (f.finDone = true),
        (err: unknown) => {
          console.warn("[finale] playFinale", err);
          f.finDone = true;
        },
      );
    }
    if (!(f.fired & F_FLOW) && e >= f.flowAt) {
      f.fired |= F_FLOW;
      if (!f.reduced) {
        this.board.litPoints(12, this.tmpPts);
        const r = this.board.root;
        for (let k = 0; k < this.tmpPts.length; k += 2) {
          this.tmpPts[k] = r.x + this.tmpPts[k]! * r.scaleX;
          this.tmpPts[k + 1] = r.y + this.tmpPts[k + 1]! * r.scaleY;
        }
        this.scenery.flow(this.tmpPts, now, 420);
      }
    }
    if (!(f.fired & F_HEART) && e >= f.heartAt) {
      f.fired |= F_HEART;
      this.scenery.lightHeart(true, now, true);
      haptic.success();
    }
    if (!(f.fired & F_RISE) && e >= f.riseAt) {
      f.fired |= F_RISE;
      this.scenery.rise(now);
    }
    // the daily: the lit board stays; its result card comes up instead of the next house
    if (s.daily) {
      const ft = clamp01((e - f.flowAt) / 420);
      if (!f.reduced) this.board.root.setScale(1 - 0.04 * Math.sin(Math.PI * ft));
      if (!(f.fired & F_ADV) && e >= f.inAt) {
        f.fired |= F_ADV;
        f.advanced = true;
        void this.onDailyDone();
      }
      if (e >= f.endAt) this.endFinale();
      return;
    }
    // board + house motion
    const offH = g.H - g.boardTop + 20 * g.u;
    if (!f.advanced) {
      if (f.reduced) {
        const t = clamp01((e - (f.outAt - 200)) / 200);
        this.board.root.setAlpha(1 - t);
      } else {
        const ft = clamp01((e - f.flowAt) / 420);
        this.board.root.setScale(1 - 0.06 * easeOutCubic(ft)).setAlpha(1 - 0.1 * ft);
        const ot = clamp01((e - f.outAt) / 320);
        this.boardSlide = easeInCubic(ot) * offH;
        this.board.root.y = g.bcy + this.boardSlide;
        this.scenery.setHouseShift(-easeInCubic(ot) * g.W);
      }
    }
    if (!(f.fired & F_ADV) && e >= f.inAt) {
      // phase 5: the "board away" beat — street visit, then the ads slot — before the next board
      if (f.gate !== "done") {
        if (f.gate === "idle") this.runGates(f);
        f.t0 = now - f.inAt;
        return;
      }
      if (!s.nextReady) {
        // the worker is still generating (a late finale level can take seconds on a phone): hold the
        // "board away" beat — the timeline stands still; the incoming silhouette + breathing light fill it
        if (!f.hold && !f.fallback) {
          f.hold = true;
          console.info("[finale] waiting for the worker's next level");
          // audit P1-10: no empty stage — the next house's silhouette drifts in, and a soft light
          // breathes where the board will appear
          this.scenery.setIncoming(true, now, { x: g.bcx, y: g.bcy, w: this.board.boardW + g.pad * 2, h: this.board.boardH + g.pad * 2 }, f.reduced);
          // L's session.nextLevelReady: resolves when the worker's level is in (never rejects, no cap)
          void s.nextLevelReady.then(() => {
            f.hold = false;
            f.t0 = this.time.now - f.inAt;
            // generation threw (worker and main thread): retry twice, then bring the solved level
            // back as a fresh board — never an endless hold over an empty stage
            if (s.nextLevelStatus === "failed") {
              f.retries = (f.retries ?? 0) + 1;
              if (f.retries <= FINALE_RETRIES) s.retryNext();
              else f.fallback = true;
            }
          });
        }
        if (!f.fallback) {
          f.t0 = now - f.inAt;
          return;
        }
      }
      f.fired |= F_ADV;
      if (f.quick && s.nextReady) {
        // the player tapped to skip: straight in, with the chevron and the quick house arrival
        this.boardSlide = 0;
        this.advanceLevel(now);
        this.board.settle(now);
        this.endFinale();
        if (!motion.reduced) {
          this.chevronT0 = now;
          this.houseArriveT0 = now;
        }
        return;
      }
      this.advanceLevel(now, !s.nextReady);
    }
    if (f.advanced) {
      const it = clamp01((e - f.inAt) / (f.reduced ? 250 : 380));
      if (f.reduced) this.board.root.setAlpha(it);
      else {
        this.boardSlide = (1 - easeOutCubic(it)) * offH;
        this.board.root.setPosition(g.bcx, g.bcy + this.boardSlide).setScale(1).setAlpha(1);
        this.scenery.setHouseShift((1 - easeOutCubic(it)) * f.inFrom);
      }
    }
    if (e >= f.endAt) this.endFinale();
  }

  /** Swap in the next level (board off-screen at this point); `fallback`: the solved level again (next one unavailable). */
  private advanceLevel(now: number, fallback = false): void {
    const f = this.finale;
    if (f) {
      f.advanced = true;
      // the real house continues from where the incoming silhouette got to
      if (f.hold || this.scenery.incomingOn) f.inFrom = this.scenery.incomingShift(now, this.geo.W);
    }
    this.scenery.setIncoming(false, now);
    this.scenery.stopFlow();
    if (this.deps.session.daily) return;
    if (fallback) this.deps.session.fallbackToSolved();
    else this.deps.session.advance();
    this.nearDark = false;
    this.layout(); // rebuild board/house for the new level
    if (f && !f.reduced) {
      this.board.root.y = this.geo.bcy + this.boardSlide;
      this.scenery.setHouseShift(f.inFrom);
    }
    const s = this.deps.session;
    if (s.track === "gentle") this.scenery.setTown(s.cleared("gentle"), true, now);
    this.refreshFar(true);
    this.lastInput = now;
    ambientForLevel(this.deps.session.levelNumber);
    cue("nextLevel");
    this.a11yAnnounce("level", { n: this.deps.session.levelNumber });
    // start the next level's generation in the worker right away (it runs off the main thread)
  }

  /**
   * The "board away" beat (old board + house gone, the next not in yet): the street visit on
   * milestone levels, then the ads slot (N's ads.beforeNextBoard; config B's only interstitial
   * place). The finale's timeline stands still until both are through.
   */
  private runGates(f: Finale): void {
    f.gate = "running";
    this.flow("out");
    const run = async (): Promise<void> => {
      if (f.visit) {
        this.visited = Math.max(this.visited, f.visit);
        await this.visitStreet(f.visit);
      }
      if (!f.unit.daily) {
        // config B's only interstitial slot (N: ads.beforeNextBoard records the unit too, so the
        // unit goes to this call only — never also to onUnitComplete)
        f.adsGated = true;
        this.flow("ads");
        const still = (): boolean => this.finale === f && !this.townOpen && !this.sheet.isOpen && !this.travel && !this.switching && !document.hidden;
        const { stillAtBreak: _s, ...unit } = f.unit;
        void _s;
        const ctx = { ...unit, stillAtBreak: still, tapped: f.quick, lastInputAt: Date.now() - Math.max(0, this.time.now - this.lastInput) };
        let t: ReturnType<typeof setTimeout> | undefined;
        await Promise.race([
          adsApi.beforeNextBoard(ctx).then(() => undefined),
          new Promise<void>((res) => (t = setTimeout(res, ADS_GATE_MAX_MS))),
        ]).finally(() => clearTimeout(t));
      }
    };
    void run()
      .catch((e: unknown) => console.warn("[finale] gates", e))
      .finally(() => {
        f.gate = "done";
        if (this.finale === f) f.t0 = this.time.now - f.inAt;
        this.lastInput = this.time.now;
      });
  }

  /** The milestone trip: the street opens on the new lamp / landmark, it lights, the street closes. */
  private visitStreet(n: number): Promise<void> {
    if (!townLoader) return Promise.resolve();
    this.flow("visit");
    this.visiting = true;
    this.townOpen = true;
    // the street reads the progress file: let the completion's write land first
    return flush()
      .catch(() => undefined)
      .then(() => townLoader())
      .then(
        (m) =>
          new Promise<void>((resolve) => {
            if (!m.openTown) return resolve();
            m.openTown(this, { visit: { n }, onClose: () => resolve() });
          }),
      )
      .catch((e: unknown) => console.warn("[town] visit failed", e))
      .finally(() => {
        this.visiting = false;
        this.townOpen = false;
        this.lastInput = this.time.now;
      });
  }

  private flow(step: string): void {
    this.flowLog.push(step);
    if (this.flowLog.length > 40) this.flowLog.shift();
    console.info(`[flow] ${step}`);
  }

  private endFinale(): void {
    const f = this.finale;
    this.finale = null;
    this.hideNext();
    this.scenery.setIncoming(false, this.time.now);
    if (f && f.advanced && !f.unit.daily) this.flow("in");
    if (f && f.advanced && !f.unit.daily) {
      // config B: the ad (if any) ran in the "board away" beat (runGates); now the board is in, the
      // break chip may follow (8 s, until a move)
      this.dropBreak(true);
      if (f.adsGated && adsApi.offerBreak()) this.breakT0 = this.time.now;
      // R2 (A2): the 5th / 10th house's finale (its street visit) — not when the break chip is offered
      if (f.visit && this.breakT0 !== this.time.now) this.ratingSoon(houseMoment(f.visit));
    }
    this.boardSlide = 0;
    this.board.root.setPosition(this.geo.bcx, this.geo.bcy).setScale(1).setAlpha(1);
    this.scenery.setHouseOffset(0);
    this.scenery.setHouseShift(0);
  }

  /**
   * Tap during the finale: straight to the next level, input live. A chevron
   * glides right over the house and the new house hurries in from the right,
   * so the jump reads as "next", not as a glitch.
   */
  private finishFinale(tapped = false): void {
    const f = this.finale;
    if (!f) return;
    const now = this.time.now;
    if (f.needNext && !f.nextTapped) {
      // (back from the background) the first three houses still wait for "Next house →"
      this.hurryToNext();
      return;
    }
    // tap to skip: V's finale jumps to its end state (its promise resolves), the exit may go
    if (!f.finDone) {
      this.board.skipFinale(now);
      f.finDone = true;
    }
    const wasAdvanced = f.advanced;
    if (this.deps.session.daily) {
      if (!(f.fired & F_ADV)) {
        f.fired |= F_ADV;
        void this.onDailyDone();
      }
      this.board.settle(now);
      this.endFinale();
      return;
    }
    if (!f.advanced && (f.gate !== "done" || !this.deps.session.nextReady)) {
      // skip tapped before the swap: jump to the "board away" beat; the gates (street visit, ads
      // slot) and the worker run there, then the next board hurries in
      f.quick = tapped || f.quick;
      if (!f.hold && f.gate === "idle") f.t0 = now - f.inAt;
      if (!tapped && f.gate === "idle") this.runGates(f);
      return;
    }
    if (!f.advanced) {
      f.fired |= F_ADV;
      this.boardSlide = 0;
      this.advanceLevel(now);
    }
    this.board.settle(now);
    this.endFinale();
    if (tapped && !motion.reduced) {
      this.chevronT0 = now;
      if (!wasAdvanced) this.houseArriveT0 = now;
    }
  }

  /** Chevron + quick house arrival after a tap during the finale. */
  private stepNext(now: number): void {
    const g = this.geo;
    const ct = (now - this.chevronT0) / 650;
    if (ct >= 0 && ct < 1) {
      const y = g.houseBaseY - Math.min(this.scenery.houseHeight * 0.45, 90 * g.u);
      this.chevron.setVisible(true).setPosition(g.W * 0.5 + (ct * 2 - 0.5) * 40 * g.u + 70 * g.u, y).setAlpha(Math.sin(Math.PI * ct) * 0.9);
    } else if (this.chevron.visible) this.chevron.setVisible(false);
    const ht = (now - this.houseArriveT0) / 280;
    if (ht >= 0 && ht < 1) this.scenery.setHouseShift((1 - easeOutCubic(ht)) * g.W * 0.4);
    else if (ht >= 1 && ht < 2) {
      this.houseArriveT0 = -1e9;
      this.scenery.setHouseShift(0);
    }
  }

  // ---------------------------------------------------------------- v11 "Next house →" (gentle 1–3)

  private nextT0 = -1;
  private nextImg: PhaserTypes.GameObjects.Image | null = null;
  private nextTxt: PhaserTypes.GameObjects.Text | null = null;
  private nextBox = { x: 0, y: 0, w: 0, h: 0 };

  private showNext(now: number): void {
    const g = this.geo;
    const u = this.u;
    if (!this.nextImg || !this.nextTxt) {
      // ambient(): its slow breathe while it waits reads the same at the governor's 20 fps
      this.nextImg = ambient(this.add.image(0, 0, "__DEFAULT").setDepth(DEPTH.hud + 3).setVisible(false));
      this.nextTxt = ambient(makeText(this, DEPTH.hud + 3).setOrigin(0.5, 0.5));
      this.markHud([this.nextImg, this.nextTxt]);
    }
    const bw = Math.round(Math.min(g.W - 64 * u, 300 * u));
    // R2 (P1-1): the primary pill sits in the slot between the HUD row and the board (it covered row 4
    // and reached the home indicator before); ≥ 44 pt tall, its lip included in the slot
    const bh = Math.round(Math.max(44 * u, Math.min(56 * u, g.slotH - 8 * u)));
    const cy = Math.round(g.boardTop - g.slotH / 2 - 2 * u);
    this.nextBox = { x: Math.round(g.bcx - bw / 2), y: cy - bh / 2, w: bw, h: bh };
    this.nextImg.setTexture(primaryButton(this.bank, bw, bh, u)).setPosition(g.bcx, cy + 2 * u);
    styleText(this.nextTxt, a11y.t("done.next"), { pt: 20, u, weight: "800", cap: 1.4 });
    this.nextTxt.setPosition(g.bcx, cy);
    this.nextT0 = now;
    this.a11y?.say(a11y.t("done.next"));
    this.a11yT = 0;
  }

  private hideNext(): void {
    this.nextT0 = -1;
    this.nextImg?.setVisible(false);
    this.nextTxt?.setVisible(false);
  }

  private nextHit(px: number, py: number): boolean {
    const b = this.nextBox;
    const pad = 8 * this.u;
    return px >= b.x - pad && px <= b.x + b.w + pad && py >= b.y - pad && py <= b.y + b.h + pad;
  }

  /** A tap (or a return from the background) on gentle 1–3: the finale jumps to its rest with the button up. */
  private hurryToNext(): void {
    const f = this.finale;
    if (!f) return;
    const now = this.time.now;
    if (!f.finDone) {
      this.board.skipFinale(now);
      f.finDone = true;
    }
    // the button takes the slot at once
    this.bigWord.hide();
    const exitAt = f.reduced ? f.outAt - 200 : f.outAt;
    if (now - f.t0 < exitAt) f.t0 = now - exitAt;
  }

  /** The button breathes in (and, for VoiceOver, is a control) while the finale waits for it. */
  private stepNextBtn(now: number): void {
    if (this.nextT0 < 0 || !this.nextImg || !this.nextTxt) return;
    const t = motion.reduced ? 1 : clamp01((now - this.nextT0) / 260);
    const b = motion.reduced ? 1 : 1 + 0.025 * Math.sin((now - this.nextT0) / 420);
    this.nextImg.setVisible(true).setAlpha(t).setScale(b);
    this.nextTxt.setVisible(true).setAlpha(t).setScale(b);
  }

  /** Tests / shots: the "Next house →" button centre (canvas px), or null. */
  get nextPoint(): { x: number; y: number } | null {
    return this.nextT0 >= 0 ? { x: this.nextBox.x + this.nextBox.w / 2, y: this.nextBox.y + this.nextBox.h / 2 } : null;
  }

  // ---------------------------------------------------------------- frame

  override update(time: number, delta: number): void {
    const t0 = performance.now();
    const now = time;
    this.play.tick(
      this.deps.session.seedKey,
      delta,
      this.decorated && !this.tutOn && !this.howTo?.isOpen && !this.finale && !this.switching && !this.travel && !this.townOpen && !this.sheet.isOpen && !document.hidden,
    );
    this.stepFinale(now);
    this.stepSwitch(now);
    this.stepBlocked(now);
    this.stepErr(now);
    this.stepGuide(now);
    this.stepOffer(now);
    this.board.update(now);
    this.guide.update(now);
    this.scenery.update(now);
    this.sheet.update(now);
    this.stepNext(now);
    this.stepTravel(now);
    this.card?.update(now);
    this.ask.update(now);
    this.stepNight(now);
    this.stepCardBoard(now);
    this.stepTutorial(now);
    this.stepControls(now);
    this.band.update(now);
    this.bigWord.update(now);
    this.stepWick(now);
    this.stepNextBtn(now);
    this.howTo?.update(now);
    this.stepScreen();
    this.stepA11y(now);
    this.stepIdle();
    // the [perf] log describes full-rate frames (ambient ticks are 50 ms apart by design)
    if (governor.lastStepFull) {
      this.updateMs[this.frameN % 600] = performance.now() - t0;
      this.samplePerf(now, delta);
    }
  }

  /** Hint button: soft breathe while its highlight is on the board; a single pulse on tap. */
  private stepControls(now: number): void {
    const s = this.deps.session;
    const busy = !!this.finale || !!this.switching;
    // audit P0-2: while the camera moves (tower reveal / travel / switch / town) the HUD fades out
    // over 150 ms (input is blocked meanwhile) and comes back after — it never floats over the house
    const dt = Math.min(100, Math.max(0, now - this.hudT));
    this.hudT = now;
    const hide = !!this.travel || !!this.switching || this.townOpen || !!this.night || this.tutOn;
    const target = hide ? 0 : 1;
    const step = motion.reduced ? 1 : dt / HUD_FADE_MS;
    this.hudA = this.hudA < target ? Math.min(target, this.hudA + step) : Math.max(target, this.hudA - step);
    // R2 (A1): while the board is solved / switching, the WHOLE HUD rests at one opacity (eased) — no
    // mix of "disabled" buttons at 0.3 / 0.35 / 0.72 next to full-bright captions (the finale's look)
    const restTo = busy || s.complete ? 1 : 0;
    this.restA = motion.reduced ? restTo : this.restA < restTo ? Math.min(restTo, this.restA + dt / 260) : Math.max(restTo, this.restA - dt / 260);
    const rest = 1 - (1 - HUD_REST) * this.restA;
    const resting = this.restA > 0.001;
    const hud = this.hudA * rest;
    // the daily's result sheet carries its own home; the row above it steps aside
    const row = hud * (1 - this.cardK);
    const hc = vis.p.increaseContrast;
    const pt = (now - this.hintPulseT0) / 360;
    const pulse = pt >= 0 && pt < 1 && !motion.reduced ? Math.sin(Math.PI * pt) * 0.12 : 0;
    const breathe = this.hintState.kind === "remove" && !motion.reduced ? 0.05 * Math.sin(now / 260) : 0;
    this.hintBtn.setScale(1 + pulse + breathe).setAlpha(row * (hc ? 1 : 0.95)).setVisible(row > 0.01);
    // on the daily the street button stays (one role) but rests dim and inactive
    this.leftBtn.setAlpha(row * (s.daily && !resting ? (hc ? 0.5 : 0.3) : hc ? 1 : 0.95));
    // R2: while the daily's postcard sheet is up it owns the screen (its own Continue; taps go to it) — the
    // top row steps aside with the bottom row, so its milestone / gift moment never meets a caption (SE)
    const top = hud * (1 - this.cardK);
    this.backChip.setVisible(!!s.daily && top > 0.01).setAlpha(top * (hc ? 1 : 0.95));
    this.stepAlley(now, row);
    // the far home (tower screen): a soft halo breathes behind it — the way back is easy to find
    const far = this.decorated && !s.daily && s.track === "deduce" && hud > 0.01;
    if (far) {
      const f = this.scenery.farTarget;
      const b = motion.reduced ? 0.45 : 0.3 + 0.2 * (0.5 + 0.5 * Math.sin(now / 800));
      this.farGlow.setVisible(true).setPosition(f.x, f.y).setAlpha(hud * b);
    } else if (this.farGlow.visible) this.farGlow.setVisible(false);
    const canUndo = s.moves.length > 0 && !s.complete;
    const ut = (now - this.undoPulseT0) / 300;
    this.undoBtn
      .setScale(1 + (ut >= 0 && ut < 1 && !motion.reduced ? Math.sin(Math.PI * ut) * 0.1 : 0))
      .setAlpha(row * (!canUndo && !resting ? (hc ? 0.45 : 0.3) : hc ? 1 : 0.95))
      .setVisible(row > 0.01);
    if (s.daily) this.calImg.setAlpha(row).setVisible(row > 0.01);
    const tOn = this.todayAvailable() && row > 0.01;
    this.todayBtn.setVisible(tOn).setAlpha(row * (hc ? 1 : 0.95));
    // R2: unplayed today = the disc's emphasis state (amber rim + glyph); the old breathing glow is gone
    if (this.todayGlow.visible) this.todayGlow.setVisible(false);
    this.gearIcon.setAlpha(top * (hc ? 1 : 0.95)).setVisible(top > 0.01);
    // "?": after the tutorial (and once if a first-three board runs past 2 min) it pulses once
    const key = `${s.seedKey}|${s.daily ?? ""}`;
    if (!s.daily && s.track === "gentle" && s.levelNumber <= 3 && this.howNudged !== key && this.play.seconds() >= 120 && !busy) {
      this.howNudged = key;
      this.howPulseT0 = now;
    }
    const hp = (now - this.howPulseT0) / 800;
    // R2 (Reality #11): a smaller pulse — the 40 pt disc never reaches its caption under it
    const hps = hp >= 0 && hp < 1 && !motion.reduced ? 1 + 0.1 * Math.sin(Math.PI * hp) : 1;
    this.howBtn.setAlpha(top * (hc ? 1 : 0.95)).setScale(hps).setVisible(top > 0.01 && this.decorated);
    // R2: the slot under the row shows one thing at a time — while a line / "Solved!" / "Next house →"
    // is in it, the row's captions step aside (the discs stay, so "tap Hint again" still has its Hint)
    const slotOn = this.band.isOpen || this.bigWord.shown || this.nextT0 >= 0;
    this.slotA = motion.reduced ? (slotOn ? 1 : 0) : slotOn ? Math.min(1, this.slotA + dt / 140) : Math.max(0, this.slotA - dt / 200);
    // R2 (Reality #18): while the finger shows the "today" disc, its caption steps aside (the hand covered it)
    const pointing = this.guide.active?.kind === "moon";
    for (const c of this.caps) {
      const k = (c.dy >= 0 ? 1 - this.slotA : 1) * (pointing && c.key === "cap.today" ? 0 : 1);
      const on = c.of.visible && c.of.alpha > 0.01 && k > 0.01;
      c.t.setVisible(on);
      if (on) c.t.setAlpha(Math.min(1, c.of.alpha * (hc ? 1.05 : 1.05)) * k);
    }
    // the ad-break chip (moon + pause) after a unit, in the centre slot, until a move or 8 s
    const bt = now - this.breakT0;
    if (this.breakT0 > 0 && (bt >= 8000 || s.daily)) this.dropBreak(true);
    const bOn = bt >= 0 && bt < 8000 && !s.daily && !this.finale;
    if (bOn) this.breakChip.setVisible(true).setAlpha(row * Math.min(1, bt / 300, (8000 - bt) / 400));
    else if (this.breakChip.visible) this.breakChip.setVisible(false);
  }

  /** R2: 0 → 1 while the board is solved / switching (the HUD's one resting opacity) */
  private restA = 0;
  /** R2: 0 → 1 while the slot under the HUD row shows a line / "Solved!" / "Next house →" */
  private slotA = 0;

  /** Where the player is, for the ads layer (banner gating; N's ads.setScreen). Sent on change only. */
  private stepScreen(): void {
    const s = this.deps.session;
    const sc: AdScreen = this.townOpen ? "town" : this.tutOn ? "guide" : this.sheet.isOpen || this.howTo?.isOpen ? "settings" : this.card?.isOpen || this.night ? "result" : s.daily ? "daily" : this.guide.active ? "guide" : "track";
    if (sc === this.screen) return;
    this.screen = sc;
    adsApi.setScreen(sc);
  }
  private screen: AdScreen | "" = "";

  /** The daily's result sheet is up: the solved board shrinks into the space above it (and back). */
  private stepCardBoard(now: number): void {
    const open = !!this.card?.isOpen || !!this.night;
    const target = open ? 1 : 0;
    if (this.cardK === target && !open) return;
    const dt = Math.min(100, Math.max(0, now - this.cardT));
    this.cardT = now;
    const step = motion.reduced ? 1 : dt / 340;
    // leaving the daily: the shrunken board slides away as it is (no grow-back on the way out)
    if (!this.switching) this.cardK = this.cardK < target ? Math.min(target, this.cardK + step) : Math.max(target, this.cardK - step);
    if (this.finale && !this.deps.session.daily) return;
    const g = this.geo;
    const k = easeInOutCubic(this.cardK);
    const top = g.houseBaseY + 8 * g.u;
    const bottom = (this.card?.top ?? g.H) - 12 * g.u;
    const bh = this.board.boardH + g.pad * 2;
    const sc = Math.min(1, Math.max(0.4, (bottom - top) / bh));
    const ty = (top + bottom) / 2;
    this.board.root.setScale(lerp(1, sc, k)).setPosition(g.bcx, lerp(g.bcy, ty, k) + this.boardSlide);
  }
  private cardT = 0;

  private samplePerf(now: number, delta: number): void {
    this.frameDt[this.frameN % 600] = delta;
    this.frameN++;
    if (this.perfT0 === 0) this.perfT0 = now;
    if (now - this.perfT0 < 10000) return;
    this.perfT0 = now;
    const n = Math.min(600, this.frameN);
    const a = Array.from(this.frameDt.subarray(0, n)).sort((x, y) => x - y);
    const r = Array.from(this.renderMs.subarray(0, n)).sort((x, y) => x - y);
    const up = Array.from(this.updateMs.subarray(0, n)).sort((x, y) => x - y);
    const avg = a.reduce((x, y) => x + y, 0) / n;
    const pct = (xs: number[], q: number): number => xs[Math.min(xs.length - 1, Math.floor(xs.length * q))]!;
    console.info(
      `[perf] frame avg ${avg.toFixed(1)} ms p95 ${pct(a, 0.95).toFixed(1)} max ${pct(a, 1).toFixed(1)} | update p50 ${pct(up, 0.5).toFixed(2)} p95 ${pct(up, 0.95).toFixed(2)} | render(JS) p50 ${pct(r, 0.5).toFixed(1)} p95 ${pct(r, 0.95).toFixed(1)} ms (n=${n}, slow>20ms ${a.filter((x) => x > 20).length})`,
    );
  }

  /** The ad-break chip (moon + pause): a rewarded "30 minutes without breaks" (ads policy, agent N). */
  private onBreak(): void {
    cue("tap");
    this.dropBreak(false);
    this.confirmBreak();
  }

  /**
   * The rewarded ad break always goes through a confirm card first (AdMob: a clear reward
   * disclosure; the one allowed exception to the wordless rule). Text from N when it provides it.
   */
  private confirmBreak(data = adsApi.breakConfirm(a11y.lang())): void {
    if (data === null) {
      adsApi.declineBreak();
      return;
    }
    const u = this.u;
    this.showAsk(
      {
        kind: "break",
        art: { key: "break", draw: (ctx, w, h) => {
          const s = Math.round(h * 0.9);
          ctx.translate(w / 2 - s / 2, (h - s) / 2);
          void u;
          drawBreakChipArt(ctx, s);
        } },
        text: data.text,
        yes: data.yes,
        no: data.no,
      },
      {
        yes: () =>
          void adsApi.watchBreak().then((ok) => {
            if (!ok && data.unavailable) a11y.announce(data.unavailable);
          }),
        no: () => adsApi.declineBreak(),
      },
    );
  }

  /** The chip's result moment is over (declined = it passed without a tap). */
  private dropBreak(declined: boolean): void {
    if (this.breakT0 < 0) return;
    this.breakT0 = -1e9;
    if (declined) adsApi.declineBreak();
  }

  // ---------------------------------------------------------------- accessibility

  /** iOS text size / bold / contrast changed: re-bake what depends on them. */
  private onVis(p: VisPrefs, prev: VisPrefs): void {
    if (p.fontScale === prev.fontScale && p.boldText === prev.boldText && p.increaseContrast === prev.increaseContrast) return;
    if (this.finale || this.switching || this.travel) {
      this.visDirty = true;
      return;
    }
    this.relayoutForVis();
  }
  private visDirty = false;
  private relayoutForVis(): void {
    this.visDirty = false;
    this.scenery.refreshPlates();
    this.layout();
    if (this.card?.isOpen && this.ds?.result) this.showCard();
  }

  /** VoiceOver (agent A's hidden layer): see a11yLayer.ts. */
  private a11yAnnounce(kind: string, vars?: Record<string, string | number>, cell = -1): void {
    if (!this.a11y) return;
    this.a11y.announce(kind, vars, cell >= 0 ? this.cellInfo(cell >> 3, cell & 7) : undefined);
    this.a11yT = 0; // refresh the layer on the next frame
  }
  private a11y: A11yLayer | null = null;
  private a11yT = 0;
  private stepA11y(now: number): void {
    if (this.visDirty && !this.finale && !this.switching && !this.travel) this.relayoutForVis();
    if (!this.a11y || now - this.a11yT < 250) return;
    this.a11yT = now;
    this.publishA11y();
  }

  /** What VoiceOver can reach right now (HUD / settings / result sheet / board), canvas px. */
  private publishA11y(): void {
    const L = this.a11y;
    if (!L) return;
    const s = this.deps.session;
    const g = this.geo;
    const u = this.u;
    if (this.tutOn) {
      // the tutorial is the whole screen: its band, Skip / Start, and its yard
      const ta = this.tut?.a11y();
      L.controls("hud", (ta?.controls ?? []).map((c) => ({ id: c.id, key: c.label, x: c.x, y: c.y, w: c.w, h: c.h, act: c.act })));
      L.controls("sheet", []);
      L.controls("card", []);
      L.board(ta?.board ?? null, `tut:${ta?.sig ?? ""}`);
      return;
    }
    const box = (id: string, key: string, im: { x: number; y: number }, half: number, act: () => void, vars?: Record<string, string | number>): Ctl =>
      ({ id, key, ...(vars ? { vars } : {}), x: im.x - half, y: im.y - half, w: half * 2, h: half * 2, act });
    const moving = !!this.travel || !!this.switching || this.townOpen || this.hudA < 0.99;
    const modal = this.sheet.isOpen || !!this.card?.isOpen || this.ask.isOpen || !!this.night || !!this.howTo?.isOpen;
    // HUD
    const hud: Ctl[] = [];
    if (!moving && !modal) {
      const rb = Math.max(22 * u, g.ctrlS / 2 + 4 * u);
      hud.push(box("settings", "settings", this.gearIcon, 22 * u, () => this.openSheet()));
      if (this.howBtn.visible) hud.push(box("howTo", "howTo", this.howBtn, 22 * u, () => void this.openHowTo()));
      if (this.leftBtn.visible && !s.daily) hud.push(box("left", "village", this.leftBtn, rb, () => this.onLeft()));
      if (this.backChip.visible) hud.push({ id: "back", key: "leaveDaily", x: this.backChip.x - this.backChip.width / 2, y: this.backChip.y - 22 * u, w: this.backChip.width, h: 44 * u, act: () => this.onBack() });
      const ab = this.alleyBox;
      if (ab.on && !s.daily) {
        const cur = alleyOf(s.levelNumber).cells.findIndex((c) => c.state === "current") + 1;
        hud.push({ id: "alley", key: s.track === "deduce" ? "floor" : "alley", vars: { n: s.track === "deduce" ? s.levelNumber : cur }, x: ab.x, y: ab.y, w: ab.w, h: ab.h, act: () => this.openTownLazy() });
      }
      if (!s.complete) {
        if (s.moves.length > 0) hud.push(box("undo", "undo", this.undoBtn, rb, () => this.onUndo()));
        hud.push(box("hint", "hint", this.hintBtn, rb, () => this.onHint()));
      }
      const m = this.scenery;
      const mr = Math.max(m.moonR * 1.8, 26 * u);
      hud.push(box("moon", this.scenery.moonBreath ? "daily" : "dailyDone", { x: m.moonX, y: m.moonY }, mr, () => this.onMoon()));
      if (this.todayBtn.visible) hud.push(box("today", this.scenery.moonBreath ? "daily" : "dailyDone", this.todayBtn, rb, () => this.onMoon()));
      if (!s.daily && this.decorated) {
        const f = m.farTarget;
        if (f.kind === "home" || this.towerUnlocked()) hud.push({ id: "far", key: f.kind === "tower" ? "tower" : "house", x: f.x - f.hw, y: f.y - f.hh, w: f.hw * 2, h: f.hh * 2, act: () => this.onFar() });
      }
      if (this.breakChip.visible) hud.push(box("adBreak", "adBreak", this.breakChip, rb, () => this.onBreak()));
      if (this.band.isOpen) {
        const r = this.band.rect();
        hud.push({ id: "band", key: this.band.text, x: r.x, y: r.y, w: r.w, h: r.h, act: () => undefined });
      }
    }
    if (this.nextT0 >= 0) {
      const b = this.nextBox;
      hud.push({ id: "next", key: "done.next", x: b.x, y: b.y, w: b.w, h: b.h, act: () => {
        const f = this.finale;
        if (!f || !f.needNext || f.nextTapped) return;
        f.nextTapped = true;
        this.hideNext();
        this.finishFinale(true);
      } });
    }
    L.controls("hud", hud);
    // settings sheet (modal): its options + a close control
    const sheet: Ctl[] = [];
    if (this.sheet.isOpen) {
      const KEY: Record<string, string> = {
        soundOn: "soundOn", soundOff: "soundOff", digits: "numbersDigits", dots: "numbersDots", timeOn: "shareTimeOn", timeOff: "shareTimeOff",
        hapticsOn: "hapticsOn", hapticsOff: "hapticsOff", replay: "replayGuide", restart: "restart", notifyOn: "notifyOn", notifyOff: "notifyOff", privacy: "privacy", policy: "policy",
      };
      for (const c of this.sheet.controls()) {
        const opt = c.opt;
        const action = opt === "replay" || opt === "restart" || opt === "privacy" || opt === "policy";
        sheet.push({ id: opt, key: KEY[opt] ?? opt, ...(action ? {} : { pressed: c.selected }), x: c.x, y: c.y, w: c.w, h: c.h, act: () => this.onSheet(c.x + c.w / 2, c.y + c.h / 2) });
      }
      const cl = this.sheet.cloudBox();
      sheet.push({ id: "cloud", key: `sync.${syncSignal.status}`, x: cl.x, y: cl.y, w: cl.w, h: cl.h, act: () => undefined });
      const cb = this.sheet.closeBox();
      sheet.push({ id: "close", key: "close", x: cb.x, y: cb.y, w: cb.w, h: cb.h, act: () => this.sheet.hide(this.time.now) });
    }
    if (this.howTo?.isOpen) {
      for (const c of this.howTo.controls()) {
        const act = c.action === "close" ? () => this.closeHowTo() : c.action === "replay" ? () => {
          this.closeHowTo();
          void this.startTutorial(true);
        } : () => undefined;
        sheet.push({ id: c.id, key: c.label, x: c.x, y: c.y, w: c.w, h: c.h, act });
      }
    }
    L.controls("sheet", sheet);
    // the daily's result sheet
    const card: Ctl[] = [];
    if (this.ask.isOpen) {
      // the question card is modal over everything: only it is reachable
      for (const c of this.ask.controls()) {
        card.push({ id: `ask-${c.id}`, key: c.label, x: c.x, y: c.y, w: c.w, h: c.h, act: () => (c.id === "ask" ? undefined : this.onAsk(c.x + c.w / 2, c.y + c.h / 2)) });
      }
    } else if (this.card?.isOpen) {
      for (const c of this.card.controls()) {
        const act = c.id === "shields" ? () => this.card?.replayShields(this.time.now) : () => this.onCard(c.x + c.w / 2, c.y + c.h / 2);
        card.push({ id: c.id, key: c.id === "break" ? "adBreak" : c.id === "home" ? "res.continue" : c.id, ...(c.vars ? { vars: c.vars } : {}), x: c.x, y: c.y, w: c.w, h: c.h, act });
      }
      card.push({ id: "close", key: "close", x: 0, y: g.H * 0.1, w: 44 * u, h: 44 * u, act: () => this.card?.hide(this.time.now) });
    }
    L.controls("card", card);
    // the board (not while it is away, covered, or the goal card is up)
    const away = moving || this.sheet.isOpen || !!this.howTo?.isOpen || this.ask.isOpen || !!this.night || !!this.finale || this.guide.active?.kind === "goal";
    if (away) {
      L.board(null, "");
      return;
    }
    const r = this.board.root;
    const lv = s.level;
    const bw = this.board.boardW * r.scaleX;
    const bh = this.board.boardH * r.scaleY;
    L.board(
      {
        rows: lv.h, cols: lv.w, x: r.x - bw / 2, y: r.y - bh / 2, w: bw, h: bh,
        info: (row, col) => this.cellInfo(row, col),
        activate: (row, col) => {
          if (!s.complete) this.onCellTap(col, row);
        },
      },
      `${s.seedKey}:${s.moves.length}:${this.stateGen}`,
    );
  }

  /** bumps on every board state change (moves, undo, hint removes, restore) */
  private get stateGen(): number {
    const st = this.deps.session.state;
    return (st.lanterns.lo ^ (st.lanterns.hi * 31)) >>> 0;
  }

  private cellInfo(row: number, col: number): import("../a11y/index.ts").CellInfo {
    const s = this.deps.session;
    const lv = s.level;
    const i = index(col, row);
    if (hasBit(lv.stones, i)) {
      const n = lv.clues[i]!;
      if (n === NO_CLUE) return { row, col, kind: "rock", number: null };
      let around = 0;
      for (const q of floorNeighbours(lv, i)) if (hasBit(s.state.lanterns, q)) around++;
      const stuck = cannotReach(s.analysis()).some((x) => x.stone === i);
      return { row, col, kind: "rock", number: n, around, stuck };
    }
    if (hasBit(s.state.lanterns, i)) {
      const a = s.analysis();
      return { row, col, kind: "lantern", conflict: a.conflicts.some(([p, q]) => p === i || q === i) };
    }
    return { row, col, kind: "floor", lit: s.analysis().lit[i] === 1 };
  }

  /** App went to background: drop any half-finished tap. */
  onPause(): void {
    this.downCell = -1;
    this.down = "none";
    // OBS-2 (test agent): stop the clock first, then save the stopped time
    this.clock?.stop();
    this.saveDailyNow();
  }

  /** Back from background: the daily's clock runs again (only while its board is open and unsolved). */
  onResume(): void {
    const s = this.deps.session;
    if (s.daily && this.clock && this.ds && !this.ds.result && !s.complete && !this.howTo?.isOpen && !this.tutOn) this.clock.start();
    // a new day while the app slept: the moon follows
    if (!s.daily) void this.refreshMoon();
  }

  // ---------------------------------------------------------------- test / a11y geometry (L's requests)

  /** Canvas-pixel centre of a board cell (inverse of cellAt). */
  cellCenter(cell: number): { x: number; y: number } {
    const g = this.geo;
    const lv = this.deps.session.level;
    return { x: g.bcx - (g.cs * lv.w) / 2 + ((cell & 7) + 0.5) * g.cs, y: g.bcy - (g.cs * lv.h) / 2 + ((cell >> 3) + 0.5) * g.cs };
  }

  /** Canvas-pixel centres of the HUD targets. */
  hudPoints(): Record<"gear" | "hint" | "undo" | "left" | "today" | "moon" | "far" | "back" | "alley", { x: number; y: number }> {
    const f = this.scenery.farTarget;
    const at = (o: { x: number; y: number }): { x: number; y: number } => ({ x: o.x, y: o.y });
    const ab = this.alleyBox;
    return {
      gear: at(this.gearIcon), hint: at(this.hintBtn), undo: at(this.undoBtn), left: at(this.leftBtn), today: at(this.todayBtn),
      moon: { x: this.scenery.moonX, y: this.scenery.moonY }, far: { x: f.x, y: f.y }, back: at(this.backChip), alley: { x: ab.x + ab.w / 2, y: ab.y + ab.h / 2 },
    };
  }

  /** Tests / shots: the alley strip as shown (cell states, the current index, on screen). */
  get alleyView(): { on: boolean; cur: number; states: string[] } {
    const s = this.deps.session;
    return { on: this.alleyBox.on && this.alley[0]!.visible, cur: this.alleyBox.cur, states: alleyOf(s.levelNumber).cells.map((c) => c.state) };
  }

  // ---------------------------------------------------------------- v12 Wick (decision A4)

  /** Lantern faces + the hero follow the Settings switch (both stay off until the setting was read). */
  private applyFaces(): void {
    const on = this.facesReady && getLanternFaces();
    this.board.setFaces(on);
    if (!on || this.wick) return;
    void this.loadWick()
      .then((m) => {
        if (this.wick) return;
        this.wick = new m.WickHero(this, this.bank, DEPTH.front + 0.5);
        this.fitWick();
        if (this.deps.session.complete) this.wick.cue("solve", -1e9);
      })
      .catch((e: unknown) => console.info("[wick] not loaded", e));
  }

  /**
   * The hero stands on the bottom stepping stone. His size keeps the flame tip (and a hop) under the
   * error band's bottom edge and under the house number plate — he never covers either (r1 critique).
   */
  private fitWick(): void {
    const w = this.wick;
    if (!w || !this.geo) return;
    const g = this.geo;
    const u = this.u;
    const st = this.scenery.stones();
    const last = st[st.length - 1];
    if (!last) return;
    const gx = last.x;
    const gy = last.y + last.ry * 0.25;
    // free: under the house plate (when it is above him); while the error band is up he ducks under its bottom edge
    const tall = 0.8;
    let ceil = g.crestY - 40 * u;
    const pb = this.scenery.plateBox();
    if (pb && pb.x < gx + 40 * u && pb.x + pb.w > gx - 40 * u) ceil = Math.max(ceil, pb.y + pb.h);
    const room = gy - ceil - 4 * u;
    // quantised (4 pt steps, rounded down) so a new house rarely means new textures
    const q = 4 * u;
    const size = Math.round(Math.max(36 * u, Math.floor(Math.min(72 * u, room / tall) / q) * q));
    // R2: the band lives in the slot under the HUD row now (below him) — no ducking needed for it
    w.place(gx, gy, size, (room - size * tall) / (size / 100), 1);
  }

  private stepWick(now: number): void {
    const w = this.wick;
    if (!w) return;
    // the plate / house can change under him (a new house, Dynamic Type): refit while nothing moves
    if (!this.finale && !this.switching && !this.travel) this.fitWick();
    const on = this.facesReady && getLanternFaces() && this.decorated && !this.tutOn && !this.townOpen && !this.calImg.visible && !this.breakChip.visible && !this.card?.isOpen;
    w.show(on, now);
    // dozing: a long quiet spell (45 s without a touch) or the daily's night beat
    const doze = !!this.night || (now - this.lastInput > 45_000 && !this.finale);
    // the hint asks for attention after 25 s without a move on an unsolved board (one texture swap, no animation)
    const attn = !this.finale && !this.tutOn && !this.deps.session.complete && !this.townOpen && this.hintState.kind === "idle" && now - this.lastInput > 25_000;
    if (attn !== this.hintAttn) {
      this.hintAttn = attn;
      this.drawControls();
    }
    w.setDoze(doze);
    this.board.setDoze(doze);
    // (he only ducks if a band ever overlaps his box — kept as the safe fallback)
    const br = this.band.isOpen ? this.band.rect() : null;
    const wb = w.box;
    w.setDuck(!!br && br.x < wb.x + wb.w && br.x + br.w > wb.x && br.y < wb.y + wb.h && br.y + br.h > wb.y);
    w.update(now, this.hudA);
  }

  /** Tests / shots: Wick's box (canvas px) and expression, or null when he is not on screen. */
  get wickInfo(): { x: number; y: number; w: number; h: number; ground: number; expr: string; visible: boolean } | null {
    const w = this.wick;
    return w ? { ...w.box, expr: w.expr, visible: w.visible } : null;
  }

  /** Tests / shots: the house plate's box (canvas px). */
  get plateInfo(): { x: number; y: number; w: number; h: number } | null {
    return this.scenery.plateBox();
  }

  /** Nothing animating that would eat or redirect a tap. Emits "idle" on the false → true edge. */
  isIdle(): boolean {
    return this.decorated && !this.finale && !this.switching && !this.travel && !this.townOpen && !this.sheet.isOpen && !this.ask.isOpen && !this.night && !this.board.busy && !this.howTo?.isOpen;
  }
  private wasIdle = false;
  private stepIdle(): void {
    const idle = this.isIdle();
    if (idle && !this.wasIdle) this.events.emit("idle");
    this.wasIdle = idle;
  }

  // ---------------------------------------------------------------- iCloud sync (src/sync)

  /** Merged data may land now: nothing animating, no sheet / card / guide up, no moon tap loading. */
  private syncSafe(restore: boolean): boolean {
    // a restore onto a fresh install has nothing local to protect: a first-run lesson does not hold it
    if (restore) return this.isIdle() && !this.card?.isOpen && !this.moonPending;
    return this.isIdle() && !this.guide.active && !this.tutOn && !this.card?.isOpen && !this.moonPending && !this.replayPending;
  }

  /** A returning player's progress arrived: the first-run lessons step aside quietly. */
  private endGuideForRestore(): void {
    if (this.guide.active) this.guide.stop();
    // a returning player: the first-yard tutorial steps aside (the restore marks it learned)
    if (this.tut || this.tutWanted) {
      this.tut?.cancel();
      this.tut?.destroy();
      this.tut = null;
      this.tutWanted = false;
      this.tutEndT0 = this.time.now;
      markGuide(GUIDE.tutorial);
    }
    this.replayPending = false;
    this.guideStopped = false;
    this.lastInput = this.time.now;
  }

  /** The scene's side of the sync engine (src/sync/local.ts SyncHost). */
  syncHost(): SyncHost {
    return {
      session: this.deps.session,
      safe: (restore) => this.syncSafe(restore),
      swap: (task, restore) =>
        new Promise<void>((resolve) => {
          if (restore) this.endGuideForRestore();
          this.startSwitch(async () => {
            await task();
          }, () => {
            this.refreshFar(false);
            resolve();
          });
        }),
      refresh: (changes) => {
        const s = this.deps.session;
        if (changes.restore) this.endGuideForRestore();
        else if (this.guide.active && this.guideLesson() === 0) this.guide.stop(); // its lesson was learned elsewhere
        if (changes.numbers) this.board.setNumberStyle(changes.numbers);
        if (!s.daily) this.ds = null; // today's daily may have been solved on another device
        this.scenery.setTown(s.cleared("gentle"), false, this.time.now);
        this.refreshFar(false);
        if (!s.daily) void this.refreshMoon();
      },
    };
  }

  /** DEV / capture: open the settings sheet. */
  devOpenSettings(): void {
    this.openSheet();
  }

  /** Back from background: skip any running animation to its final state. */
  skipAnimations(): void {
    if (this.finale) this.finishFinale();
    else this.board.settle(this.time.now);
  }
}

