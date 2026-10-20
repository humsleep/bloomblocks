// The village (1.0 skeleton): its own Phaser scene on top of the puzzle scene, a lazy chunk
// (src/village/index.ts holds the only static entry — a dynamic import). Nothing here is on the
// cold-start path.
//   village   backdrop + lantern houses (one baked texture), residents in front of their houses
//             (each its own image: an ambient() breathing bob), the mailbox (amber flag), the jar
//   card      dialogue card at the bottom: name tag above, 1–3 lines (more only at large Dynamic
//             Type), height follows the text (wrap.ts: kinsoku, balanced, never overflows)
//   letter    the paper letter (greeting / body / signature) → its gift
//   gift      the revealed piece (+ a tag line when it is the day's second mail) →
//             "Put it in my cottage" (auto slot, then the room) / "Later" (it waits in the drawer)
//   room      the cottage: 18 snap slots + the rug layer; a slot opens the catalog drawer
//             (tabs, colourway dots, locked cards with their real name and where they come from)
// Every tappable thing is one hit box, and the same list feeds VoiceOver (a11y.setControls).
// Art comes through art.ts (the designer's kit, or placeholders). Words through text.ts.
import type PhaserTypes from "phaser";
import Phaser from "../phaser.ts";
import { a11y, type A11yControl } from "../a11y/index.ts";
import type { Lang } from "../a11y/strings.ts";
import { ambient } from "../game/frameGovernor.ts";
import { drawVillageDisc } from "../game/hudArt.ts";
import { cue, haptic } from "../game/feedback.ts";
import { textScale } from "../game/uiText.ts";
import { UI } from "../render/palette.ts";
import { vis } from "../render/vis.ts";
import { type Environment, loadArt, type VillageArt } from "./art.ts";
import { COLORWAYS, DRAWER_TABS, type Colorway, itemById, type ItemId, type Piece, pieceBit, pieceOfBit, RESIDENTS, type ResidentId, SETS } from "./catalog.ts";
import {
  activeRequests, fulfilled, isoOfDay, marketOffers, marketState, nextAsk, roomCategories, visitors,
  autoSlot, cards, COTTAGE, coverOf, dayOf, deliver, roomOf, emptyRoom, encodeRoom, eve, FLOOR_COLS, FLOOR_SLOTS, itemOfBit, jarProgress, drops, litDayList,
  type Mail, mailOrder, mails, overflow, owned, partnerSlot, place, placedBits, removeAt, residents, type ResidentState, type RoomLayout, slotWhere, SLOTS, type VillageInput,
  COZY_AT, cozyLevel, cozyScore, setOfItem, setProgress, setsDone,
} from "./model.ts";
import { cozyText, type CozyKey } from "./strings.ts";
import { CHAPTERS, type Hint, pageBit, setBit, storyState, STORY, storyUi, unreadPages } from "./story.ts";
import {
  boardTheme, type BoardTheme, chooseSkin, chooseTheme, cozyBit, EVENING_LEVEL, friendBit, type LanternSkin, lanternSkin, notePending, noteUnlocks,
  SKIN_NEEDS, SKINS, skinUnlocked, THEME_NEEDS, THEMES, themeUnlocked,
} from "../game/cosmetics.ts";
import { adsApi } from "../game/adsHooks.ts";
import { drawFramedLantern } from "../render/lantern.ts";
import { themeTints } from "../render/court.ts";
import { firstSnowSeason, type Hemisphere, hemisphereOf, type Line, pickHost, pickLine, type Pick, pickVisit, pushSeen, regionOf, seasonOf, timeBandOf } from "./picker.ts";
import { loadVillage, onVillageChange, peekVillage, updateVillage, type VillageSave } from "./store.ts";
import { placeholderArt } from "./placeholderArt.ts";
import { drawerTitle, itemName, type LineSet, loadLines, residentName, tabName, vt } from "./text.ts";
import { CARD, cardHeight, fitCardName, fitCardSource, fitDialogue, fitLetter, fitPill, fitTab, fitTag, LETTER, letterPaperW, letterTrackingEm, splitSignature } from "./textLayout.ts";
import { type Fit, fitText, villageFont } from "./wrap.ts";
import { normBits, roomDev, roomStamp } from "./vstate.ts";

export const VILLAGE_KEY = "village";
const OPEN_MS = 300;
const TAB_H = 36;
const INK = UI.ink;
/** the letter's pressed flower / the emote in the sender's colour */
const CW_FILL: Record<Colorway, string> = { cream: "#F1E4C8", sage: "#A9C7A0", rose: "#E9A9B4" };

/** Canvas letterSpacing exists here (Chromium, Safari 17.4+?) — unverified on iOS 17 WKWebView, hence the fallback. */
export const canvasTracking = (): boolean =>
  typeof CanvasRenderingContext2D !== "undefined" && "letterSpacing" in CanvasRenderingContext2D.prototype && !(globalThis as { __noCanvasLetterSpacing?: boolean }).__noCanvasLetterSpacing;

/**
 * fillText with tracking `trackPx` between graphemes: canvas letterSpacing when the engine has it, else
 * glyph by glyph (each advance = its measured width + trackPx) — the same width trackedMeasure() gives.
 */
export function drawTracked(g: CanvasRenderingContext2D, text: string, x: number, y: number, trackPx: number, align: "left" | "right"): void {
  if (!trackPx) {
    g.textAlign = align;
    g.fillText(text, x, y);
    return;
  }
  if (canvasTracking()) {
    const gg = g as CanvasRenderingContext2D & { letterSpacing: string };
    const keep = gg.letterSpacing;
    gg.letterSpacing = `${trackPx}px`;
    g.textAlign = "left";
    // letterSpacing also adds after the last glyph: measure without it for the right edge
    const w = g.measureText(text).width - trackPx;
    g.fillText(text, align === "right" ? x - w : x, y);
    gg.letterSpacing = keep;
    return;
  }
  const cs = [...text];
  g.textAlign = "left";
  const total = cs.reduce((a, c) => a + g.measureText(c).width, 0) + trackPx * Math.max(0, cs.length - 1);
  let cx = align === "right" ? x - total : x;
  for (const c of cs) {
    g.fillText(c, cx, y);
    cx += g.measureText(c).width + trackPx;
  }
}

/** The drawer card's colour-dot row (centre y): right under the name, never past the card's bottom. */
function dotRowY(cy0: number, cw: number, ch: number, nf: Fit): number {
  return Math.min(cy0 + ch - 11, cy0 + cw - 8 + nf.lines.length * nf.size * 1.15 + 12);
}

/** a small padlock (locked drawer cards), centre (x, y), body half-width r */
function drawLock(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  g.save();
  g.strokeStyle = UI.inkSoft;
  g.fillStyle = UI.inkSoft;
  g.lineWidth = 1.4;
  g.beginPath();
  g.arc(x, y - r * 0.35, r * 0.62, Math.PI, 0);
  g.stroke();
  g.beginPath();
  g.roundRect(x - r, y - r * 0.35, r * 2, r * 1.6, r * 0.35);
  g.fill();
  g.restore();
}

const ACCENT: Record<ResidentId, string> = { wick: "#FFC864", momo: "#E58C9E", sage: "#8FC79A", luna: "#B7A6E8", pip: "#F2D06B", kuri: "#E8A87C", yuki: "#A9D4E8" };
const PAPER = UI.paper;

export interface VillageData {
  inp: VillageInput;
  save: VillageSave;
  lines: LineSet;
  art: VillageArt;
  lang: Lang;
  dev: string;
  /** the handwriting stack for letters (kit loadVillageFont "letter"), null = the UI face */
  letterFont: string | null;
}
export interface VillageLaunch {
  host: PhaserTypes.Scene;
  onClose: () => void;
  data: VillageData;
  /** tap time (performance.now) — the open time is logged from it */
  t0: number;
  /** tap → data ready (chunks, save, lines, art kit) */
  tData?: number;
  /** the first village frame is on screen (the host's "opening" veil can go) */
  onShown?: () => void;
}

type Screen = "village" | "letter" | "gift" | "room" | "market" | "story";
interface Hit {
  id: string;
  /** a drawer grid card: moves with the grid scroll, only live inside its window */
  grid?: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  pressed?: boolean;
  act: () => void;
}
interface CardState {
  who: ResidentId;
  line: Line;
  text: string;
  fit: Fit;
  /** host card: the next host line on tap */
  hostNext?: Pick | null;
}
interface ResSprite {
  id: ResidentId;
  img: PhaserTypes.GameObjects.Image;
  x: number;
  y: number;
  w: number;
  h: number;
  phase: number;
}

const reduced = (): boolean => vis.p.reduceMotion;

function safeInsets(): { top: number; bottom: number } {
  const el = document.getElementById("safe");
  if (!el) return { top: 0, bottom: 0 };
  const cs = getComputedStyle(el);
  return { top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 };
}

export class VillageScene extends Phaser.Scene {
  private L!: VillageLaunch;
  private d!: VillageData;
  private u = 1;
  private q = 1;
  private W = 375;
  private H = 667;
  private top = 0;
  private bottom = 667;
  private keys = new Set<string>();
  private screenNow: Screen = "village";
  private hits: Hit[] = [];
  private bg!: PhaserTypes.GameObjects.Image;
  private hud!: PhaserTypes.GameObjects.Image;
  private mailImg!: PhaserTypes.GameObjects.Image;
  private cardImg!: PhaserTypes.GameObjects.Image;
  private stallImg: PhaserTypes.GameObjects.Image | null = null;
  private bubbles = new Map<ResidentId, PhaserTypes.GameObjects.Image>();
  private emoteImg!: PhaserTypes.GameObjects.Image;
  private overlay!: PhaserTypes.GameObjects.Image;
  private drawerImg!: PhaserTypes.GameObjects.Image;
  private res: ResSprite[] = [];
  private card: CardState | null = null;
  private cardY = 0;
  private hostInput = true;
  private closed = false;
  private firstFrame = true;
  /** the first village frame has been presented */
  private shown = false;
  /** the backdrop bake still running (the sky and ground are up; the houses and neighbors follow, a step per frame) */
  private bakeLeft: Bake | null = null;
  private unsub: (() => void) | null = null;
  // per-visit talk state
  private taps = new Map<ResidentId, { n: number; after?: string }>();
  // mail / gift / room state
  private openMail: Mail | null = null;
  private openReturn = false;
  private room: RoomLayout = emptyRoom();
  private highlight = -1;
  private drawer: { slot: number; tab: string; cw: Partial<Record<ItemId, Colorway>> } | null = null;
  private stateLog: string[] = [];
  /** R4: the cozy rewards panel over the cottage; the level it just reached (0 = no level-up moment) */
  private cozyOpen = false;
  private cozyUp = 0;
  /** a locked reward's "how to get it" line, shown in the panel after a tap */
  private cozyMsg = "";
  /** R4 C: a short line over the cottage (a set just completed), until `until` (ms, performance.now) */
  private roomToast: { text: string; until: number } | null = null;

  constructor() {
    super({ key: VILLAGE_KEY });
  }

  init(l: VillageLaunch): void {
    this.L = l;
    this.d = l.data;
  }

  create(): void {
    try {
      this.build();
    } catch (e) {
      console.warn("[village] failed to build", e);
      this.finish();
    }
  }

  // ------------------------------------------------------------------ derived

  private get today(): number {
    return dayOf(this.d.inp.today);
  }
  private input2(): VillageInput {
    return { ...this.d.inp, v: this.d.save.sv };
  }
  private residentsNow(): ResidentState[] {
    return residents(this.input2());
  }
  private mailsNow(): Mail[] {
    return mails(this.input2());
  }
  private ownedNow(): Set<number> {
    return owned(this.input2());
  }
  /** Unread mail in delivery order (the return letter first). */
  private unread(): Mail[] {
    return this.mailsNow().filter((m) => !m.read).sort(mailOrder);
  }
  private hasUnread(): boolean {
    return this.unread().length > 0 || (!!this.d.save.loc.ret && !this.d.save.loc.ret.read);
  }

  // ------------------------------------------------------------------ build

  private tBuild = 0;
  private build(): void {
    const tb = performance.now();
    const l = this.L;
    this.u = Math.min(window.devicePixelRatio || 1, 3);
    this.q = Math.min(this.u, 2);
    this.hostInput = l.host.input.enabled;
    l.host.input.enabled = false;
    this.layoutSize();
    this.room = roomOf(this.d.save.sv.r[COTTAGE]?.s);

    this.bg = this.add.image(0, 0, "__DEFAULT").setOrigin(0, 0);
    this.mailImg = this.add.image(0, 0, "__DEFAULT").setOrigin(0, 0);
    this.hud = this.add.image(0, 0, "__DEFAULT").setOrigin(0, 0);
    this.overlay = this.add.image(0, 0, "__DEFAULT").setOrigin(0, 0).setVisible(false);
    this.drawerImg = this.add.image(0, 0, "__DEFAULT").setOrigin(0, 0).setVisible(false);
    this.cardImg = this.add.image(0, 0, "__DEFAULT").setOrigin(0, 0).setVisible(false);
    this.emoteImg = this.add.image(0, 0, "__DEFAULT").setOrigin(0, 0).setVisible(false);

    this.arrive();
    this.render();

    this.input.on("pointerdown", (p: PhaserTypes.Input.Pointer) => this.onDown(p.x / this.u, p.y / this.u));
    this.input.on("pointermove", (p: PhaserTypes.Input.Pointer) => this.onDrag(p.y / this.u));
    this.input.on("pointerup", (p: PhaserTypes.Input.Pointer) => {
      const dragged = this.drag?.moved ?? false;
      this.drag = null;
      if (dragged) this.pushA11y();
      else this.onTap(p.x / this.u, p.y / this.u);
    });
    this.scale.on("resize", this.onResize, this);
    this.events.once("destroy", () => this.scale.off("resize", this.onResize, this));
    this.tBuild = performance.now() - tb;
    this.unsub = onVillageChange((s) => {
      // a merge from another device landed (or our own write): redraw what depends on it
      this.d.save = s;
      if (!this.drawer && this.screenNow === "room") this.room = roomOf(s.sv.r[COTTAGE]?.s);
      this.render();
    });

    if (!reduced()) {
      // fade in what is on screen now (hidden layers keep alpha 1 for later)
      const on = this.children.list.filter((g) => (g as PhaserTypes.GameObjects.Image).visible) as PhaserTypes.GameObjects.Image[];
      for (const go of on) go.setAlpha(0);
      this.tweens.add({ targets: on, alpha: 1, duration: OPEN_MS, ease: "Sine.easeOut" });
    }
  }

  private layoutSize(): void {
    this.W = this.scale.width / this.u;
    this.H = this.scale.height / this.u;
    const s = safeInsets();
    this.top = s.top;
    this.bottom = this.H - s.bottom;
  }

  private onResize(): void {
    if (this.closed) return;
    this.layoutSize();
    this.render();
  }

  /**
   * The visit starts: deliver new mail (≤ 1 letter a day), file overflow, the welcome-back letter
   * after ≥ 7 days, count the visit, and Wick says the news (if any).
   */
  private arrive(): void {
    const loc = this.d.save.loc;
    const today = this.today;
    const all = this.mailsNow();
    const filed = overflow(all);
    const dl = deliver(all, loc.mail, today, loc.ld);
    const returning = loc.lastVisit !== null && today - loc.lastVisit >= 3;
    const longGap = loc.lastVisit !== null && today - loc.lastVisit >= 7;
    const first = loc.visits === 0;
    this.returning = returning;
    void updateVillage((x) => {
      x.loc.mail = dl.known;
      x.loc.ld = dl.letterDay;
      if (filed.length) {
        x.sv.lr = normBits([...x.sv.lr, ...filed]);
        x.loc.fresh = normBits([...x.loc.fresh, ...filed.map((id) => this.pieceOfMail(id)).filter((b): b is number => b !== null)]);
      }
      if (longGap) x.loc.ret = { d: today, read: false };
      if (x.loc.lastVisit !== today) x.loc.visits += 1;
      x.loc.lastVisit = today;
    }).then((s) => {
      this.d.save = s;
      this.render();
    });
    // in memory now (the write lands right after)
    loc.mail = dl.known;
    loc.ld = dl.letterDay;
    if (filed.length) this.d.save.sv.lr = normBits([...this.d.save.sv.lr, ...filed]);
    if (longGap) loc.ret = { d: today, read: false };
    // Wick's news: first visit > someone moved in > tomorrow's newcomer > mail
    const once = new Set(loc.once);
    const host = (ev: string): Pick | null => pickHost(this.d.lines.lines, ev, once);
    let news: Pick | null = null;
    let key: string | null = null;
    if (first) news = host("firstVillageVisit");
    if (!news) {
      const newcomer = this.residentsNow().find((r) => r.movedIn && !r.r.host && r.r.moveIn > 0 && !once.has(`host:movedIn:${r.r.id}`));
      if (newcomer) {
        news = host("residentMovedIn");
        key = `host:movedIn:${newcomer.r.id}`;
      }
    }
    if (!news && eve(this.input2()) && !once.has(`host:eve:${today}`)) {
      news = host("moveInEve");
      key = `host:eve:${today}`;
    }
    if (!news && this.hasUnread() && !once.has(`host:mail:${today}`)) {
      news = host("mailWaiting");
      key = `host:mail:${today}`;
    }
    if (!news && loc.season && loc.season !== this.env.season) {
      news = host("seasonChanged");
      key = `host:season:${today}`;
    }
    if (!news && marketState(this.input2()) === "open" && !once.has(`host:market:${today}`)) {
      news = host("marketOpen");
      key = `host:market:${today}`;
    }
    // the season this device last saw the village in (a change is news next time)
    const season = this.env.season;
    if (loc.season !== season) {
      loc.season = season;
      void updateVillage((x) => void (x.loc.season = season));
    }
    if (news) {
      const k = news.consume ?? key;
      const next = first && news.consume ? pickHost(this.d.lines.lines, "firstVillageVisit", new Set([...once, news.consume])) : null;
      this.showHost(news, next, k);
    }
    // R4: rewards reached so far (a room decorated before 1.1, friendships), then the cozy evening (level 5, once a day)
    this.syncUnlocks();
    if (this.d.save.sv.cz.includes(cozyBit(EVENING_LEVEL)) && adsApi.cozyEvening()) notePending("evening");
  }

  /** R4: write the rewards reached (this room's cozy levels, residents at friendship 3) as synced bits; returns the new ones. */
  private syncUnlocks(): number[] {
    const want = new Set<number>();
    const lvl = cozyLevel(cozyScore(this.room));
    for (let k = 1; k <= lvl; k++) want.add(cozyBit(k));
    for (const r of this.residentsNow()) if (r.movedIn && r.friendship >= 3) want.add(friendBit(r.r.index));
    // R4 B: a set completed once keeps its story page open (whatever the room holds later)
    for (const x of setsDone(this.room)) want.add(setBit(RESIDENTS.find((r) => r.id === x.r)!.index));
    const have = new Set(this.d.save.sv.cz);
    const add = [...want].filter((b) => !have.has(b));
    if (add.length) {
      const apply = (x: VillageSave): void => void (x.sv.cz = normBits([...x.sv.cz, ...add]));
      apply(this.d.save);
      void updateVillage(apply);
      if (add.some((b) => b < 20)) notePending("reward");
      this.log(`unlocks ${add.join(",")}`);
    }
    noteUnlocks(this.d.save.sv.cz);
    return add;
  }
  private returning = false;
  /** the hour's light and the season, read when the village opens (a long visit keeps them) */
  private env = environmentNow();

  private pieceOfMail(id: number): number | null {
    const m = this.mailsNow().find((x) => x.id === id);
    return m ? pieceBit(m.piece) : null;
  }

  // ------------------------------------------------------------------ textures

  /** bake time per texture key (ms, last bake) — perf notes / tests */
  readonly prof: Record<string, number> = {};
  private tex(key: string, wPt: number, hPt: number, paint: (g: CanvasRenderingContext2D) => void): string {
    const t0 = performance.now();
    const q = this.q;
    const w = Math.max(1, Math.ceil(wPt * q));
    const h = Math.max(1, Math.ceil(hPt * q));
    if (this.textures.exists(key)) this.textures.remove(key);
    const t = this.textures.createCanvas(key, w, h);
    if (!t) throw new Error(`[village] no canvas for ${key}`);
    const g = t.getContext();
    if (!g) throw new Error(`[village] no 2D context for ${key}`);
    g.setTransform(q, 0, 0, q, 0, 0);
    paint(g);
    t.refresh();
    this.keys.add(key);
    this.prof[key] = Math.round((performance.now() - t0) * 10) / 10;
    return key;
  }
  private show(img: PhaserTypes.GameObjects.Image, key: string, x: number, y: number): void {
    img.setTexture(key).setPosition(x * this.u, y * this.u).setScale(this.u / this.q).setVisible(true);
  }

  private measureAt(g: CanvasRenderingContext2D, weight = 600): (size: number) => (s: string) => number {
    const lang = this.d.lang;
    return (size: number) => (s: string) => {
      g.font = villageFont(lang, size, weight);
      return g.measureText(s).width;
    };
  }
  /** a scratch context for measuring (fits are computed before the texture exists) */
  private scratch(): CanvasRenderingContext2D {
    this.scratchCtx ??= document.createElement("canvas").getContext("2d")!;
    return this.scratchCtx;
  }
  private scratchCtx: CanvasRenderingContext2D | null = null;

  private text(g: CanvasRenderingContext2D, lines: readonly string[], x: number, y: number, size: number, o: { color?: string; align?: CanvasTextAlign; lineH?: number; weight?: number } = {}): void {
    g.save();
    g.font = villageFont(this.d.lang, size, o.weight ?? 600);
    g.fillStyle = o.color ?? INK;
    g.textAlign = o.align ?? "left";
    g.textBaseline = "top";
    const lh = size * (o.lineH ?? CARD.lineH);
    lines.forEach((l, i) => g.fillText(l, x, y + i * lh));
    g.restore();
  }

  private pill(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, label: string, primary: boolean): void {
    g.save();
    g.beginPath();
    g.roundRect(x, y, w, h, h / 2);
    if (primary) {
      g.fillStyle = UI.primaryLip;
      g.beginPath();
      g.roundRect(x, y + 3, w, h, h / 2);
      g.fill();
      g.fillStyle = UI.primary;
      g.beginPath();
      g.roundRect(x, y, w, h, h / 2);
      g.fill();
    } else {
      g.strokeStyle = vis.p.increaseContrast ? UI.caption : "rgba(244,235,208,0.6)";
      g.lineWidth = 1.5;
      g.stroke();
    }
    const f = fitPill(label, w - 24, textScale(), this.measureAt(g), this.d.lang);
    this.text(g, f.lines, x + w / 2, y + (h - f.size) / 2, f.size, { align: "center", color: primary ? INK : UI.caption });
    g.restore();
  }

  private disc(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, glyph: "back" | "close" | "postcard"): void {
    g.save();
    g.fillStyle = "rgba(20,26,51,0.55)";
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = UI.caption;
    g.lineWidth = 2.4;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    if (glyph === "postcard") {
      // a little card with a stamp corner
      g.rect(cx - r * 0.42, cy - r * 0.3, r * 0.84, r * 0.6);
      g.moveTo(cx + r * 0.12, cy - r * 0.3);
      g.lineTo(cx + r * 0.12, cy - r * 0.02);
      g.lineTo(cx + r * 0.42, cy - r * 0.02);
    } else if (glyph === "back") {
      g.moveTo(cx + r * 0.2, cy - r * 0.38);
      g.lineTo(cx - r * 0.22, cy);
      g.lineTo(cx + r * 0.2, cy + r * 0.38);
    } else {
      g.moveTo(cx - r * 0.3, cy - r * 0.3);
      g.lineTo(cx + r * 0.3, cy + r * 0.3);
      g.moveTo(cx + r * 0.3, cy - r * 0.3);
      g.lineTo(cx - r * 0.3, cy + r * 0.3);
    }
    g.stroke();
    g.restore();
  }

  // ------------------------------------------------------------------ render

  /** Redraw the current screen (static textures) and rebuild the hit boxes / VoiceOver list. */
  private render(): void {
    if (this.closed) return;
    this.hits = [];
    const s = this.screenNow;
    this.bg.setVisible(true);
    if (s === "room") this.renderRoom();
    else this.renderVillage();
    if (s === "letter") this.renderLetter();
    else if (s === "gift") this.renderGift();
    else if (s === "market") this.renderMarket();
    else if (s === "room" && this.cozyOpen && !this.drawer) this.renderCozy();
    else if (s === "story") this.renderStory();
    else this.overlay.setVisible(false);
    if (s !== "room" || !this.drawer) {
      this.drawerImg.setVisible(false);
      this.gridImg?.setVisible(false);
      this.fadeImg?.setVisible(false);
      this.gridScroll = 0;
      this.gridWin = { y: 0, h: 0, content: 0 };
    }
    this.renderCard();
    this.pushA11y();
    if (this.firstFrame) {
      this.firstFrame = false;
      requestAnimationFrame(() => {
        if (this.closed) return;
        const ms = Math.round(performance.now() - this.L.t0);
        this.openMs = ms;
        console.info(`[village] open ${ms} ms (data ${Math.round(this.L.tData ?? 0)} ms ${JSON.stringify(dataMs)}, build ${Math.round(this.tBuild)} ms) ${JSON.stringify(this.prof)}`);
        this.shown = true;
        this.L.onShown?.();
        // the village covers the screen: the puzzle scene below stops rendering
        const h = this.L.host;
        if (h.sys.settings.visible) h.sys.setVisible(false);
      });
    }
  }
  /** tap → first village frame (ms), for the perf notes */
  openMs = 0;

  // --- village

  private houseSlots(): HouseSlot[] {
    return houseSlotsFor(this.d.art, this.W, this.H, this.top, this.bottom);
  }

  private renderVillage(): void {
    const { W, H } = this;
    const art = this.d.art;
    const rs = this.residentsNow();
    const nextIn = eve(this.input2());
    const houses = this.houseSlots();
    // the backdrop + houses layer: a rasterized copy is kept between opens (and baked ahead by
    // prewarm in idle steps), so an open only blits it — the kit's backdrop raster is the costly part (G5).
    // Not baked yet: the sky and ground come first (one step), the houses a frame at a time (update).
    const moved = new Set(rs.filter((r) => r.movedIn).map((r) => r.r.id));
    const sig = bgSig(W, H, this.q, moved, nextIn?.id ?? null, this.env);
    const done = bgCache?.sig === sig;
    const job = done ? null : bakeJob(art, sig, W, H, this.q, houses, moved, nextIn?.id ?? null, this.env);
    if (job && job.i === 0) bakeStep(job);
    const hit = bgCache?.sig === sig ? bgCache.canvas : (job?.canvas ?? null);
    this.bakeLeft = bgCache?.sig === sig ? null : job;
    const key = this.tex("village-bg", W, H, (g) => {
      if (hit) {
        g.save();
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.drawImage(hit, 0, 0);
        g.restore();
      } else paintVillageBg(g, art, W, H, houses, moved, nextIn?.id ?? null, this.env); // no canvas to cache in
    });
    this.show(this.bg, key, 0, 0);

    if (this.bakeLeft) this.hideFolk();
    else this.renderFolk(houses, rs, nextIn);

    // HUD: back disc + caption, the lantern jar
    const r = 22;
    const bx = 16 + r;
    const by = this.top + 10 + r;
    const jar = jarProgress(drops(this.input2()));
    const hk = this.tex("village-hud", W, by + r + 26, (g) => {
      this.disc(g, bx, by, r, "back");
      this.text(g, [a11y.t("cap.back")], bx, by + r + 4, 13, { align: "center", color: UI.caption });
      // G1 re-review 2 #6 (designer): the lantern jar = the SAME disc as the puzzle HUD's village button
      // (hudArt drawVillageDisc, its light level = the jar), caption "2/3" under it like every disc caption
      g.save();
      g.translate(W - 16 - r - r, by - r);
      drawVillageDisc(g, r * 2, jar.size > 0 ? jar.have / jar.size : 0);
      g.restore();
      this.text(g, [`${jar.have}/${jar.size}`], W - 16 - r, by + r + 4, 13, { align: "center", color: UI.caption });
      // R4 B: the storybook disc beside the back disc (the sky right holds the moon; an amber dot = a page to read)
      const sx = bx + 2 * r + 18;
      this.storyDisc(g, sx, by, r, unreadPages(this.storyNow()) > 0);
      this.text(g, [storyUi(this.d.lang, "caption")], sx, by + r + 4, 13, { align: "center", color: UI.caption });
    });
    this.show(this.hud, hk, 0, 0);
    this.hud.setVisible(this.screenNow !== "room");
    if (this.screenNow === "village") {
      this.hits.push({ id: "back", x: bx - r - 6, y: by - r - 6, w: 2 * r + 12, h: 2 * r + 30, label: vt(this.d.lang, "back"), act: () => this.close() });
      this.hits.push({ id: "jar", x: W - 56, y: by - 24, w: 48, h: 64, label: vt(this.d.lang, "jar", { have: jar.have, size: jar.size }), act: () => undefined });
      const sx = bx + 2 * r + 18;
      const unread = unreadPages(this.storyNow());
      this.hits.push({ id: "story", x: sx - r - 6, y: by - r - 6, w: 2 * r + 12, h: 2 * r + 30, label: unread ? storyUi(this.d.lang, "dotNew") : storyUi(this.d.lang, "book"), act: () => this.openStory() });
    }
  }

  /** the backdrop is still being baked: nothing stands on bare ground */
  private hideFolk(): void {
    for (const sp of this.res) sp.img.setVisible(false);
    for (const b of this.bubbles.values()) b.setVisible(false);
    this.mailImg.setVisible(false);
    this.stallImg?.setVisible(false);
  }

  /** the neighbors, their request bubbles, the houses' doors, the mailbox and the stall (after the backdrop is baked) */
  private renderFolk(houses: readonly HouseSlot[], rs: readonly ResidentState[], nextIn: ReturnType<typeof eve>): void {
    const { W, H } = this;
    // residents (breathing: ambient)
    const want = rs.filter((r) => r.movedIn);
    for (const r of want) {
      const h = houses.find((x) => x.who === r.r.id)!;
      const size = Math.max(40, Math.min(72, h.w * 0.4));
      const x = h.cx + h.w * 0.3 - size / 2;
      const y = h.by + 6 - size;
      let sp = this.res.find((s) => s.id === r.r.id);
      const expr = this.card?.who === r.r.id ? "talk" : r.friendship >= 3 ? "happy" : r.r.id === "momo" && r.friendship < 1 ? "shy" : "idle";
      const tk = this.tex(`village-res-${r.r.id}-${expr}`, size, size, (g) => this.d.art.drawResident(g, r.r.id, expr, { x: 0, y: 0, w: size, h: size }));
      if (!sp) {
        sp = { id: r.r.id, img: ambient(this.add.image(0, 0, tk).setOrigin(0, 0)), x, y, w: size, h: size, phase: r.r.index * 1.7 };
        this.res.push(sp);
        this.children.bringToTop(this.cardImg);
      }
      Object.assign(sp, { x, y, w: size, h: size });
      this.show(sp.img, tk, x, y);
      sp.img.setVisible(this.screenNow === "village");
      if (this.screenNow === "village") {
        this.hits.push({ id: `res-${r.r.id}`, x: x - 6, y: y - 10, w: size + 12, h: size + 16, label: vt(this.d.lang, "talk", { name: residentName(this.d.lang, r.r.id) }), act: () => this.talk(r.r.id) });
      }
    }
    for (const sp of this.res) if (!want.some((r) => r.r.id === sp.id)) sp.img.setVisible(false);

    // open requests: a paper bubble with the category's icon over the resident (contract §7 drawRequestBubble)
    const open = activeRequests(this.d.save.sv);
    for (const sp of this.res) {
      const q = open.find((x) => x.r === sp.id);
      let b = this.bubbles.get(sp.id);
      if (!q || this.screenNow !== "village" || !sp.img.visible) {
        b?.setVisible(false);
        continue;
      }
      // the kit's bubble sits up-right of the head point with a thought tail down to it: a texture with room for both
      const R = Math.max(9, sp.w * 0.17);
      const bw = R * 3.2;
      const bh = R * 3.5;
      const hx0 = R * 0.5;
      const hy0 = R * 3.35;
      const bk = this.tex(`village-req-${q.cat}`, bw, bh, (g) => (this.d.art.drawRequestBubble ?? placeholderArt.drawRequestBubble!)(g, hx0, hy0, R, q.cat));
      b ??= this.add.image(0, 0, bk).setOrigin(0, 0);
      this.bubbles.set(sp.id, b);
      const head = this.d.art.residentHead ? this.d.art.residentHead({ x: sp.x, y: sp.y, w: sp.w, h: sp.h }, sp.id) : { x: sp.x + sp.w * 0.6, y: sp.y + sp.h * 0.3 };
      const bxp = Math.max(2, Math.min(W - bw - 2, head.x - hx0)); // never off either screen edge
      const byp = head.y - hy0;
      this.show(b, bk, bxp, byp);
      const name = residentName(this.d.lang, sp.id);
      this.hits.push({ id: `req-${sp.id}`, x: bxp, y: byp, w: bw, h: bh * 0.75, label: vt(this.d.lang, "wants", { name, cat: vt(this.d.lang, `cat.${q.cat}` as "cat.rug") }), act: () => this.talk(sp.id) });
    }

    // houses: the cottage door, empty houses (a11y)
    if (this.screenNow === "village") {
      for (const h of houses) {
        const x = h.cx - h.w * 0.4;
        const y = h.by - h.h * 0.9;
        if (h.who === "cottage") this.hits.push({ id: "cottage", x, y, w: h.w * 0.8, h: h.h * 0.9, label: vt(this.d.lang, "cottageOpen"), act: () => this.goRoom() });
        else if (!rs.find((r) => r.r.id === h.who)!.movedIn) {
          this.hits.push({ id: `house-${h.who}`, x, y, w: h.w * 0.8, h: h.h * 0.9, label: vt(this.d.lang, nextIn?.id === h.who ? "eveHouse" : "emptyHouse"), act: () => undefined });
        }
      }
    }

    // mailbox (front left, below the cottage)
    const cot = houses.find((h) => h.who === "cottage")!;
    const mb = this.d.art.villageLayout?.({ x: 0, y: 0, w: W, h: H }).mailbox;
    const mw = mb ? mb.w : 40;
    const mh = mb ? mb.h : 52;
    const mx = mb ? mb.x : Math.max(8, cot.cx - cot.w * 0.5 - 4);
    const my = mb ? mb.y : cot.by + 12;
    const flag = this.hasUnread();
    const mk = this.tex(`village-mailbox-${flag ? 1 : 0}`, mw, mh + 14, (g) => this.d.art.drawMailbox(g, { x: 0, y: 14, w: mw, h: mh }, flag));
    this.show(this.mailImg, mk, mx, my - 14);
    this.mailImg.setVisible(this.screenNow === "village");
    if (this.screenNow === "village") this.hits.push({ id: "mailbox", x: mx - 8, y: my - 14, w: mw + 16, h: mh + 22, label: vt(this.d.lang, flag ? "mailboxNew" : "mailboxEmpty"), act: () => this.openMailbox() });

    // the market stall (kit layout's `market` plot, else beside the mailbox)
    const ms = marketState(this.input2());
    const lay = this.d.art.villageLayout?.({ x: 0, y: 0, w: W, h: H }) as { market?: { x: number; y: number; w: number; h: number } } | undefined;
    // shortcut: the fallback spot is left of the mailbox until the kit's villageLayout has a `market` plot (contract §7)
    const st = lay?.market ?? { x: Math.max(8, mx - 76), y: my - 18, w: 70, h: 62 };
    const sk = this.tex(`village-stall-${ms === "open" ? 1 : 0}`, st.w, st.h, (g) => (this.d.art.drawMarketStall ?? placeholderArt.drawMarketStall!)(g, { x: 0, y: 0, w: st.w, h: st.h }, ms === "open"));
    this.stallImg ??= this.add.image(0, 0, sk).setOrigin(0, 0);
    this.show(this.stallImg, sk, st.x, st.y);
    this.stallImg.setVisible(this.screenNow === "village");
    if (this.screenNow === "village") {
      this.hits.push({ id: "stall", x: st.x - 4, y: st.y - 4, w: st.w + 8, h: st.h + 8, label: vt(this.d.lang, ms === "open" ? "stall" : ms === "done" ? "stallDone" : "stallClosed"), act: () => this.openMarket() });
    }
  }

  // --- dialogue card

  /** The speaker's emote bubble, its tail on the resident's head (kit residentHead / drawEmote, Reality #11). */
  private renderEmote(): void {
    const c = this.card;
    const sp = c && this.screenNow === "village" ? this.res.find((r) => r.id === c.who && r.img.visible) : undefined;
    const art = this.d.art;
    if (!c || !sp || !art.drawEmote) {
      this.emoteImg.setVisible(false);
      return;
    }
    const me = this.residentsNow().find((r) => r.r.id === c.who);
    const icon = c.who === "sage" ? "zzz" : c.who === "luna" ? "star" : (me?.friendship ?? 0) >= 2 || c.who === "momo" ? "heart" : "note";
    const head = art.residentHead ? art.residentHead({ x: sp.x, y: sp.y, w: sp.w, h: sp.h }, c.who) : { x: sp.x + sp.w / 2, y: sp.y + sp.h * 0.3 };
    const r = Math.max(8, sp.w * 0.16);
    const bw = r * 4;
    const bh = r * 4;
    const k = this.tex(`village-emote-${c.who}-${icon}`, bw, bh, (g) => art.drawEmote!(g, bw / 2, bh - 2, r, icon, ACCENT[c.who]));
    this.show(this.emoteImg, k, head.x - bw / 2, head.y - bh + 2);
    this.children.bringToTop(this.emoteImg);
  }

  /**
   * Where the card goes: next to the speaker without covering them (above the head when there is
   * room under the HUD, else below the feet), with a tail pointing at them (Reality G1 #1, #2).
   * Without a visible speaker (the room, Wick's host lines there): at the bottom.
   */
  private cardPlace(h: number, tag: number): { y: number; tailX: number | null; tailUp: boolean } {
    const c = this.card!;
    const sp = this.screenNow === "village" ? this.res.find((r) => r.id === c.who && r.img.visible) : undefined;
    if (!sp) return { y: this.bottom - 12 - h, tailX: null, tailUp: false };
    const bubble = Math.max(8, sp.w * 0.16) * 4; // the emote above the head
    const above = sp.y - bubble - 10 - h;
    const minY = this.top + 74 + tag; // under the HUD row
    if (above >= minY) return { y: above, tailX: sp.x + sp.w / 2, tailUp: false };
    const below = Math.min(this.bottom - 12 - h, sp.y + sp.h + 14 + tag);
    return { y: below, tailX: sp.x + sp.w / 2, tailUp: true };
  }

  private renderCard(): void {
    const c = this.card;
    this.renderEmote();
    // Reality R3 P1-1: the card never covers the open drawer — it waits and shows again once the drawer closes
    if (!c || this.screenNow === "letter" || this.screenNow === "gift" || this.screenNow === "market" || this.drawer) {
      this.cardImg.setVisible(false);
      return;
    }
    const w = Math.min(this.W, 560) - 2 * CARD.margin;
    const h = cardHeight(c.fit);
    const tag = CARD.nameH;
    const x = (this.W - w) / 2;
    const place = this.cardPlace(h, tag);
    const y = place.y;
    this.cardY = y;
    const name = residentName(this.d.lang, c.who);
    const T = 12; // tail length
    const texH = h + tag + T;
    const oy = tag - 4; // paper top inside the texture
    const key = this.tex("village-card", w, texH, (g) => {
      // paper (+ the tail toward the speaker)
      g.save();
      g.fillStyle = PAPER;
      g.strokeStyle = UI.paperEdge;
      g.lineWidth = 1.5;
      g.beginPath();
      g.roundRect(0, oy, w, h, 16);
      g.fill();
      g.stroke();
      if (place.tailX !== null) {
        const tx = Math.max(28, Math.min(w - 28, place.tailX - x));
        g.beginPath();
        if (place.tailUp) {
          g.moveTo(tx - 10, oy + 1);
          g.lineTo(tx, oy - T + 2);
          g.lineTo(tx + 10, oy + 1);
        } else {
          g.moveTo(tx - 10, oy + h - 1);
          g.lineTo(tx, oy + h + T);
          g.lineTo(tx + 10, oy + h - 1);
        }
        g.fill();
        g.stroke();
        // hide the paper edge under the tail's base
        g.fillRect(tx - 9, place.tailUp ? oy - 0.5 : oy + h - 2.5, 18, 3);
      }
      g.restore();
      // the speaker's portrait (a round frame in their colour)
      const d = CARD.portrait;
      const pcx = CARD.pad + d / 2;
      const pcy = oy + CARD.pad + d / 2;
      g.save();
      g.beginPath();
      g.arc(pcx, pcy, d / 2, 0, Math.PI * 2);
      g.fillStyle = "#2B2552";
      g.fill();
      g.clip();
      // the face in the frame: feet just under the circle, the flame may leave it at the top
      // G1 re-review 2 #2 (designer): framed by the FACE centre (residents are drawn from their feet)
      if (this.d.art.drawPortrait) this.d.art.drawPortrait(g, c.who, "talk", pcx, pcy + d * 0.04, d / 2);
      else this.d.art.drawResident(g, c.who, "talk", { x: pcx - d * 0.6, y: pcy - d * 0.62, w: d * 1.2, h: d * 1.2 });
      g.restore();
      g.save();
      g.strokeStyle = ACCENT[c.who];
      g.lineWidth = 3;
      g.beginPath();
      g.arc(pcx, pcy, d / 2, 0, Math.PI * 2);
      g.stroke();
      g.restore();
      // name tag above the card, over the portrait's column (never over the text)
      g.save();
      g.font = villageFont(this.d.lang, 15, 700);
      const nw = Math.min(w - 24, g.measureText(name).width + 28);
      g.fillStyle = UI.primary;
      g.beginPath();
      g.roundRect(10, 0, nw, tag, tag / 2);
      g.fill();
      g.restore();
      this.text(g, [name], 10 + 14, (tag - 15) / 2, 15, { weight: 700 });
      this.text(g, c.fit.lines, CARD.pad + d + CARD.portraitGap, oy + CARD.pad, c.fit.size);
    });
    this.show(this.cardImg, key, x, y - oy - (place.tailUp ? 0 : 0));
    this.children.bringToTop(this.cardImg);
    this.hits.push({ id: "card", x, y: y - tag, w, h: h + tag, label: vt(this.d.lang, "card", { name, line: c.text.replace(/\n/g, " ") }), act: () => this.cardTap() });
  }

  private fitLine(text: string): Fit {
    return fitDialogue(text, this.W, textScale(), this.measureAt(this.scratch()), this.d.lang);
  }

  private showHost(p: Pick, next: Pick | null, consume: string | null | undefined): void {
    const text = this.d.lines.text(p.line);
    this.card = { who: "wick", line: p.line, text, fit: this.fitLine(text), hostNext: next && next.line.id !== p.line.id ? next : null };
    if (consume) {
      const add = (x: VillageSave): void => {
        x.loc.once = [...new Set([...x.loc.once, consume])];
      };
      add(this.d.save);
      void updateVillage(add);
    }
    a11y.announce(vt(this.d.lang, "card", { name: residentName(this.d.lang, "wick"), line: text }));
    this.log(`host ${p.line.id}`);
  }

  private cardTap(): void {
    const c = this.card;
    if (!c) return;
    if (c.hostNext) {
      const n = c.hostNext;
      this.showHost(n, null, n.consume);
      this.render();
      return;
    }
    // the same resident again (next tap)
    if (this.screenNow === "village") this.talk(c.who);
    else {
      this.card = null;
      this.render();
    }
  }

  /** Tap a resident: the next line (picker), or the card closes when there is nothing more. */
  private talk(id: ResidentId): void {
    cue("tap");
    const loc = this.d.save.loc;
    const today = this.today;
    const tap = this.taps.get(id) ?? { n: 0 };
    const rs = this.residentsNow();
    const me = rs.find((r) => r.r.id === id)!;
    const talkDay = loc.talk.day === today ? loc.talk : { day: today, n: {} };
    const pz = talkDay.pz ?? [];
    // requests: the one this resident would open now, or its open one ("again" on a later day only)
    const ask = nextAsk(this.input2(), id, roomCategories(roomOf(this.d.save.sv.r[COTTAGE]?.s)));
    const open = activeRequests(this.d.save.sv).find((q) => q.r === id) ?? null;
    const snowYear = Math.floor(today / 365);
    const pick = pickLine(this.d.lines.lines, id, {
      ask: ask ? { cat: ask.cat } : null,
      open: open ? { cat: open.cat, again: (loc.askDay?.[open.id] ?? -1) !== today } : null,
      firstSnow: firstSnowSeason(this.env.month, this.env.hemisphere) && !loc.once.some((k) => k.startsWith("snow:") && k.endsWith(`:${snowYear}`)),
      day: today,
      time: this.env.time,
      season: this.env.season,
      movedIn: new Set(rs.filter((r) => r.movedIn).map((r) => r.r.id)),
      friendship: me.friendship,
      solvedToday: litDayList(this.d.inp).includes(today),
      hardToday: this.d.inp.hardToday ?? false,
      returning: this.returning,
      puzzleTalkers: pz.filter((r) => r !== id).length,
      puzzleSaid: pz.includes(id),
      tap: tap.n,
      ...(tap.after ? { after: tap.after } : {}),
      talkToday: talkDay.n[id] ?? 0,
      seen: loc.seen[id] ?? [],
      once: new Set(loc.once),
    });
    if (!pick) {
      this.card = null;
      this.taps.set(id, { n: tap.n + 1 });
      this.render();
      return;
    }
    const text = this.d.lines.text(pick.line);
    this.card = { who: id, line: pick.line, text, fit: this.fitLine(text) };
    this.taps.set(id, { n: tap.n + 1, after: pick.trigger });
    // idempotent (it runs on the in-memory save now and again in the serialized write)
    const count = (talkDay.n[id] ?? 0) + 1;
    const apply = (x: VillageSave): void => {
      x.loc.seen[id] = pushSeen(x.loc.seen[id] ?? [], pick.line.id);
      if (pick.consume) x.loc.once = [...new Set([...x.loc.once, pick.consume])];
      if (x.loc.talk.day !== today) x.loc.talk = { day: today, n: {} };
      x.loc.talk.n[id] = count;
      if (pick.trigger.startsWith("puzzle.")) x.loc.talk.pz = [...new Set([...(x.loc.talk.pz ?? []), id])];
      if (!x.sv.ch.includes(today)) x.sv.ch = normBits([...x.sv.ch, today]);
      // a request opened: synced bit 2·id (asked); the day, locally ("again" waits a day)
      if (pick.trigger === "request.ask" && ask) {
        x.sv.q = normBits([...x.sv.q, 2 * ask.id]);
        x.loc.askDay = { ...(x.loc.askDay ?? {}), [ask.id]: today };
      }
    };
    apply(this.d.save);
    void updateVillage(apply);
    a11y.announce(vt(this.d.lang, "card", { name: residentName(this.d.lang, id), line: text }));
    this.log(`talk ${pick.line.id}`);
    this.render();
  }

  // --- mail

  private openMailbox(): void {
    cue("tap");
    this.card = null;
    const loc = this.d.save.loc;
    if (loc.ret && !loc.ret.read) {
      this.openReturn = true;
      this.openMail = null;
      this.screenNow = "letter";
      this.render();
      return;
    }
    const m = this.unread()[0];
    if (!m) return;
    this.openReturn = false;
    this.openMail = m;
    const meta = loc.mail[m.id];
    this.screenNow = meta?.k === "tag" ? "gift" : "letter";
    if (this.screenNow === "gift") this.markRead(m);
    this.log(`mail ${m.id} ${meta?.k ?? "letter"}`);
    this.render();
  }

  private senderOf(m: Mail): ResidentId {
    return this.d.save.loc.mail[m.id]?.s ?? m.sender;
  }

  // --- market (one stall, today's three pieces, pick one; no prices)

  private openMarket(): void {
    cue("tap");
    this.card = null;
    const ms = marketState(this.input2());
    if (ms !== "open") {
      // Wick says why (locked: a lantern first; done: tomorrow) — the stall itself says it to VoiceOver
      const p = pickHost(this.d.lines.lines, ms === "locked" ? "marketLocked" : "marketOpen", new Set());
      if (p && ms === "locked") this.showHost(p, null, null);
      this.render();
      return;
    }
    this.screenNow = "market";
    this.log("market");
    this.render();
  }

  private renderMarket(): void {
    const { W, H } = this;
    const lang = this.d.lang;
    const own = this.ownedNow();
    const offers = marketOffers(this.today);
    const meas = this.measureAt(this.scratch());
    const side = 16;
    const gap = 10;
    const cw = (Math.min(W, 520) - 2 * side - 2 * gap) / 3;
    const ch = cw + 64;
    const x0 = (W - (3 * cw + 2 * gap)) / 2;
    const y0 = Math.max(this.top + 120, (H - ch) / 2 - 20);
    const bw = Math.min(260, W - 64);
    const by = Math.min(this.bottom - 64, y0 + ch + 40);
    const key = this.tex("village-overlay", W, H, (g) => {
      g.fillStyle = "rgba(14,12,32,0.78)";
      g.fillRect(0, 0, W, H);
      const tf = fitPill(vt(lang, "marketTitle"), W - 48, textScale(), meas, lang);
      this.text(g, tf.lines, W / 2, y0 - 76, tf.size + 3, { align: "center", color: UI.caption, weight: 700 });
      const hf = fitPill(vt(lang, "marketHint"), W - 48, 1, meas, lang);
      this.text(g, hf.lines, W / 2, y0 - 40, hf.size - 2, { align: "center", color: UI.caption, weight: 500 });
      offers.forEach((p, i) => {
        const x = x0 + i * (cw + gap);
        const has = own.has(pieceBit(p));
        g.save();
        g.fillStyle = has ? "#D9CCB4" : PAPER; // opaque: the village never shows through (R3 P2)
        g.beginPath();
        g.roundRect(x, y0, cw, ch, 14);
        g.fill();
        g.restore();
        this.d.art.drawFurniture(g, p.item, p.cw, { x: x + 10, y: y0 + 10, w: cw - 20, h: cw - 20 }, { fit: "card" });
        const nf = fitCardName(itemName(lang, p.item), W, meas, lang);
        this.text(g, nf.lines, x + cw / 2, y0 + cw, nf.size, { align: "center", lineH: 1.15 });
        g.fillStyle = CW_FILL[p.cw];
        g.beginPath();
        g.arc(x + cw / 2, y0 + ch - 14, 6, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = "rgba(59,44,69,0.75)"; // a cream dot on a cream card still reads (R3 P2)
        g.lineWidth = 1.5;
        g.stroke();
        if (has) {
          g.strokeStyle = INK;
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(x + cw - 24, y0 + 16);
          g.lineTo(x + cw - 18, y0 + 22);
          g.lineTo(x + cw - 8, y0 + 10);
          g.stroke();
        }
      });
      this.pill(g, (W - bw) / 2, by, bw, 48, vt(lang, "close"), false);
    });
    this.show(this.overlay, key, 0, 0);
    this.children.bringToTop(this.overlay);
    offers.forEach((p, i) => {
      const x = x0 + i * (cw + gap);
      const has = own.has(pieceBit(p));
      const args = { item: itemName(lang, p.item), cw: vt(lang, `cw.${p.cw}` as "cw.cream") };
      this.hits.push({ id: `offer-${i}`, x, y: y0, w: cw, h: ch, label: vt(lang, has ? "owned" : "marketPick", args), act: () => (has ? a11y.announce(vt(lang, "owned", args)) : this.pickOffer(p)) });
    });
    this.hits.push({ id: "market-close", x: (W - bw) / 2, y: by, w: bw, h: 48, label: vt(lang, "close"), act: () => this.leaveMarket() });
  }

  private leaveMarket(): void {
    this.screenNow = "village";
    this.render();
  }

  /** Today's pick: synced v.mk (the day) + v.u (the piece); then the same reveal as a gift (put it in / later). */
  private pickOffer(p: Piece): void {
    cue("tap");
    const today = this.today;
    const bit = pieceBit(p);
    const apply = (x: VillageSave): void => {
      x.sv.mk = normBits([...x.sv.mk, today]);
      x.sv.u = normBits([...x.sv.u, bit]);
      x.loc.fresh = normBits([...x.loc.fresh, bit]);
    };
    apply(this.d.save);
    void updateVillage(apply);
    haptic.place();
    this.openMail = { id: -1, kind: "market", jar: 0, sender: "wick", piece: p, read: true };
    this.screenNow = "gift";
    this.log(`market pick ${p.item}:${p.cw}`);
    const host = pickHost(this.d.lines.lines, "marketPicked", new Set());
    if (host) this.afterGift = host;
    this.render();
  }
  /** a host line to say once the reveal closes (market pick) */
  private afterGift: Pick | null = null;

  private letterText(): { text: string; who: ResidentId } {
    const lines = this.d.lines;
    if (this.openReturn) {
      const l = lines.lines.find((x) => x.r === "wick" && x.t === "letter.return");
      return { text: l ? lines.text(l) : "", who: "wick" };
    }
    const m = this.openMail!;
    const who = this.senderOf(m);
    const kind = m.kind === "moveIn" ? "letter.move_in" : m.kind === "thanks" ? "letter.thanks" : "letter.gift";
    const pool = lines.lines.filter((x) => x.r === who && x.t === kind);
    const l = pool[m.id % Math.max(1, pool.length)];
    return { text: l ? lines.text(l) : "", who };
  }

  /** Measure with the letter's handwriting stack (art.loadVillageFont "letter"), or the UI face. */
  private letterMeasure(g: CanvasRenderingContext2D): (size: number) => (s: string) => number {
    const stack = this.d.letterFont;
    if (!stack) return this.measureAt(g, 500);
    return (size: number) => (t: string) => {
      g.font = `500 ${size}px ${stack}`;
      return g.measureText(t).width;
    };
  }

  private renderLetter(): void {
    const { W, H } = this;
    const art = this.d.art;
    const lang = this.d.lang;
    const { text, who } = this.letterText();
    const g0 = this.scratch();
    // the signature ("— 모모", de "– Momo", zh "—— 桃桃") always on its own last line, right-aligned (G1 #7, re-review 2 #5)
    const { body, signature } = splitSignature(text);
    const fit = fitLetter(body, W, textScale(), this.letterMeasure(g0), lang);
    const n = fit.lines.length + (signature ? 1 : 0);
    const pw = letterPaperW(W);
    const ph = art.letterHeight ? art.letterHeight(pw, n, fit.size) : LETTER.pad * 2 + Math.ceil(n * fit.size * LETTER.lineH);
    const bw = Math.min(260, W - 64);
    const bh = 50;
    // G1 #6: the envelope + paper + sender sit at the screen's vertical centre; the button right under them
    const stageTop = this.top + 64;
    const stageH = this.bottom - bh - 40 - stageTop;
    const envH = pw * 0.36 * 0.55;
    const px = (W - pw) / 2;
    const py = art.drawLetterStage ? stageTop + Math.max(0, (stageH - (envH + ph + 30)) / 2) + envH : Math.max(this.top + 70, (H - ph) / 2 - 40);
    const paper = { x: px, y: py, w: pw, h: ph };
    const by = Math.min(this.bottom - bh - 24, py + ph + 40);
    // G1 #9: the button says what it does; a tap outside the paper puts the letter away (unopened gift stays in the mailbox)
    const btnLabel = this.openReturn ? vt(lang, "close") : vt(lang, "openGift");
    this.hits.push({ id: "letter-away", x: 0, y: 0, w: W, h: H, label: vt(lang, "close"), act: () => this.letterAway() });
    const key = this.tex("village-overlay", W, H, (g) => {
      g.fillStyle = "rgba(14,12,32,0.72)";
      g.fillRect(0, 0, W, H);
      // the kit's upright paper ruled for exactly these lines; the text sits ON its baselines (Reality R6)
      let base: number[];
      let x0: number;
      let x1 = px + pw * 0.91;
      if (art.drawLetterStage) {
        // the envelope behind (flap open, wax seal), sized to the paper; then the paper on top
        art.drawLetterStage(g, { x: px, y: py - envH, w: pw, h: envH + ph }, { n: n - (signature ? 1 : 0), fontPx: fit.size, who, accent: ACCENT[who] });
      }
      if (art.drawLetterPaper && art.letterLines) {
        art.drawLetterPaper(g, paper, n, fit.size, ACCENT[who]);
        const L = art.letterLines(paper, n, fit.size);
        base = L.baselines;
        x0 = L.x0;
        x1 = L.x1;
      } else {
        g.fillStyle = PAPER;
        g.beginPath();
        g.roundRect(px, py, pw, ph, 10);
        g.fill();
        const lh = fit.size * LETTER.lineH;
        base = fit.lines.map((_, i) => py + LETTER.pad + (i + 1) * lh - lh * 0.25);
        x0 = px + pw * 0.09;
        g.fillStyle = "rgba(160,120,140,0.28)";
        for (const b of base) g.fillRect(x0, b + 1, pw * 0.82, 1);
      }
      g.save();
      g.font = this.d.letterFont ? `500 ${fit.size}px ${this.d.letterFont}` : villageFont(lang, fit.size, 500);
      g.fillStyle = INK;
      g.textBaseline = "alphabetic";
      // Korean: −0.10 em tracking (Gaegu's wide side bearings), letterSpacing or glyph by glyph (fitLetter measured the same)
      const track = letterTrackingEm(lang) * fit.size;
      fit.lines.forEach((l, i) => drawTracked(g, l, x0, base[i] ?? base.at(-1)!, track, "left"));
      if (signature) drawTracked(g, signature, x1, base[n - 1] ?? base.at(-1)!, track, "right");
      g.restore();
      // the sender leans on the paper's lower-left corner (72 pt, mock c)
      art.drawLetterSender?.(g, paper, who, Math.min(72, pw * 0.2));
      this.pill(g, (W - bw) / 2, by, bw, bh, btnLabel, true);
    });
    this.show(this.overlay, key, 0, 0);
    this.children.bringToTop(this.overlay);
    const name = residentName(lang, who);
    this.hits.push({ id: "letter", x: px, y: py, w: pw, h: ph, label: `${vt(lang, this.openReturn ? "welcomeBack" : "letterFrom", { name })}: ${text.replace(/\n/g, " ")}`, act: () => undefined });
    this.hits.push({ id: this.openReturn ? "letter-close" : "letter-gift", x: (W - bw) / 2, y: by, w: bw, h: bh, label: btnLabel, act: () => this.letterNext() });
  }

  private letterAway(): void {
    if (this.openReturn) return this.letterNext();
    this.openMail = null;
    this.screenNow = "village";
    this.render();
  }

  private letterNext(): void {
    cue("tap");
    if (this.openReturn) {
      this.openReturn = false;
      void updateVillage((x) => {
        if (x.loc.ret) x.loc.ret.read = true;
      });
      if (this.d.save.loc.ret) this.d.save.loc.ret.read = true;
      this.screenNow = "village";
      this.render();
      return;
    }
    const m = this.openMail;
    if (!m) return;
    this.markRead(m);
    this.screenNow = "gift";
    this.render();
  }

  /** Opened: the piece is owned (v.lr, synced) and "new" in the drawer. */
  private markRead(m: Mail): void {
    const bit = pieceBit(m.piece);
    const apply = (x: VillageSave): void => {
      x.sv.lr = normBits([...x.sv.lr, m.id]);
      x.loc.fresh = normBits([...x.loc.fresh, bit]);
    };
    apply(this.d.save);
    void updateVillage(apply);
    haptic.place();
  }

  private renderGift(): void {
    const m = this.openMail;
    if (!m) return;
    const { W, H } = this;
    const lang = this.d.lang;
    const who = this.senderOf(m);
    const meta = this.d.save.loc.mail[m.id];
    const item = itemById(m.piece.item)!;
    const cwName = vt(lang, `cw.${m.piece.cw}` as "cw.cream");
    const tagLine = meta?.k === "tag" ? this.tagLine(who, m.id) : "";
    const g0 = this.scratch();
    const tagFit = tagLine ? fitTag(tagLine, textScale(), this.measureAt(g0), lang) : null;
    const size = Math.min(160, W * 0.42);
    const cx = W / 2;
    const bw = Math.min(280, W - 64);
    const bh = 50;
    // G1 #10 (designer): the reveal fills the screen — the kit's stage (open box, light wedges, the piece
    // rising, the sender + a friend reacting) above, the tag note, then the two buttons at the bottom
    const laterY = this.bottom - bh - 18;
    const putY = laterY - bh - 14;
    const th = tagFit ? 16 + tagFit.lines.length * tagFit.size * 1.32 + 12 : 0;
    const ty = putY - 16 - th;
    const stage = { x: 12, y: this.top + 56, w: W - 24, h: Math.max(220, (tagFit ? ty : putY) - 14 - (this.top + 56)) };
    let itemBox = { x: cx - size / 2, y: Math.max(this.top + 80, H * 0.24), w: size, h: size };
    const key = this.tex("village-overlay", W, H, (g) => {
      g.fillStyle = "rgba(14,12,32,0.8)";
      g.fillRect(0, 0, W, H);
      const art = this.d.art;
      let chip = { x: cx - 110, y: itemBox.y - 44, w: 220, h: 34 };
      if (art.drawGiftStage) {
        const r = art.drawGiftStage(g, stage, { item: item.id, cw: m.piece.cw, sender: who });
        chip = r.chip;
        itemBox = r.item;
      } else {
        const w = item.span === 2 ? size * 1.4 : size;
        art.drawFurniture(g, item.id, m.piece.cw, { x: cx - w / 2, y: itemBox.y, w, h: size }, { fit: "card" });
      }
      // the name chip (mock c): the item's name + its colour as a dot (no colour word, G1 #12)
      const tf = fitPill(itemName(lang, item.id), chip.w - 40, textScale(), this.measureAt(g), lang);
      const chipW = Math.min(W - 32, Math.max(chip.w * 0.7, this.measureAt(g, 600)(tf.size + 1)(tf.lines[0] ?? "") + 54));
      const chipX = cx - chipW / 2;
      g.save();
      g.shadowColor = "rgba(20,15,44,0.4)";
      g.shadowBlur = 8;
      g.fillStyle = "#FFF7E8";
      g.beginPath();
      g.roundRect(chipX, chip.y, chipW, chip.h, chip.h / 2);
      g.fill();
      g.restore();
      const dotX = chipX + chipW - chip.h * 0.62;
      g.fillStyle = CW_FILL[m.piece.cw];
      g.beginPath();
      g.arc(dotX, chip.y + chip.h / 2, chip.h * 0.2, 0, Math.PI * 2);
      g.fill();
      g.lineWidth = 1.2;
      g.strokeStyle = "rgba(59,44,69,0.5)";
      g.stroke();
      this.text(g, tf.lines, cx - chip.h * 0.3, chip.y + (chip.h - (tf.size + 1) * 1.2) / 2, tf.size + 1, { align: "center", weight: 600 });
      if (tagFit) {
        const tw = Math.min(W - 48, 290);
        g.save();
        g.fillStyle = PAPER;
        g.beginPath();
        g.roundRect(cx - tw / 2, ty, tw, th, 8);
        g.fill();
        g.restore();
        this.text(g, tagFit.lines, cx, ty + 10, tagFit.size, { align: "center", weight: 500 });
      }
      this.pill(g, (W - bw) / 2, putY, bw, bh, vt(lang, "putIn"), true);
      this.pill(g, (W - bw) / 2, laterY, bw, bh, vt(lang, "later"), false);
    });
    this.show(this.overlay, key, 0, 0);
    this.children.bringToTop(this.overlay);
    const name = residentName(lang, who);
    const desc = `${vt(lang, "giftFrom", { name })}: ${vt(lang, "giftIs", { item: itemName(lang, item.id), cw: cwName })}${tagLine ? `. ${tagLine}` : ""}`;
    this.hits.push({ id: "gift", x: itemBox.x, y: itemBox.y, w: itemBox.w, h: itemBox.h, label: desc, act: () => undefined });
    this.hits.push({ id: "gift-put", x: (W - bw) / 2, y: putY, w: bw, h: bh + 4, label: vt(lang, "putIn"), act: () => this.putInCottage() });
    this.hits.push({ id: "gift-later", x: (W - bw) / 2, y: laterY, w: bw, h: bh, label: vt(lang, "later"), act: () => this.giftLater() });
  }

  private tagLine(who: ResidentId, seed: number): string {
    const pool = this.d.lines.lines.filter((l) => l.r === who && l.t === "gift.tag");
    const l = pool[seed % Math.max(1, pool.length)];
    return l ? this.d.lines.text(l) : "";
  }

  private giftLater(): void {
    cue("tap");
    this.openMail = null;
    this.screenNow = "village";
    this.sayAfterGift();
    this.render();
  }
  private sayAfterGift(): void {
    if (this.afterGift) this.showHost(this.afterGift, null, null);
    this.afterGift = null;
  }

  private putInCottage(): void {
    cue("tap");
    const m = this.openMail;
    if (!m) return;
    const bit = pieceBit(m.piece);
    this.openMail = null;
    this.room = roomOf(this.d.save.sv.r[COTTAGE]?.s);
    const already = placedBits(this.room).has(bit);
    const slot = already ? -1 : autoSlot(this.room, bit);
    this.screenNow = "room";
    if (slot >= 0) {
      const next = place(this.room, slot === FLOOR_SLOTS ? 0 : slot, bit);
      if (next) {
        this.commitRoom(next, bit);
        this.highlight = itemOfBit(bit)?.layer === "rug" ? FLOOR_SLOTS : slot;
        a11y.announce(vt(this.d.lang, "placed", { item: itemName(this.d.lang, m.piece.item) }));
      }
    } else if (!already) {
      // full: open the drawer on the front-middle slot with this piece's card first
      this.drawer = { slot: 12, tab: "all", cw: { [m.piece.item]: m.piece.cw } };
    }
    this.log(`put ${m.piece.item}:${m.piece.cw} → ${slot}`);
    this.firstCabin();
    if (!this.card) this.sayAfterGift();
    this.afterGift = null;
    this.render();
  }

  // --- room

  private goRoom(): void {
    cue("tap");
    this.card = null;
    this.room = roomOf(this.d.save.sv.r[COTTAGE]?.s);
    this.screenNow = "room";
    this.highlight = -1;
    this.firstCabin();
    this.checkRequests();
    this.render();
  }

  private firstCabin(): void {
    const p = pickHost(this.d.lines.lines, "firstCabinVisit", new Set(this.d.save.loc.once));
    if (p) this.showHost(p, null, p.consume);
  }

  private roomBox(): { x: number; y: number; w: number; h: number } {
    // G1 re-review 2 #1 (designer): the cottage takes the screen from the header down to the dialogue card's
    // band (≥ 60 % of the height); a taller box gives the kit's room a taller back wall (roomMap ex)
    const top = this.top + 60;
    // the room + its porch end just above the dialogue card (no empty band, re-review 3 #1)
    const bottom = this.bottom - 158;
    const w = this.W * 0.94;
    const h = Math.max(w * 1.05 * 0.8, Math.min(bottom - top, w * 1.05 * 1.32));
    // (the kit room is bottom-anchored in its box: it stands just above the card's band)
    return { x: (this.W - w) / 2, y: bottom - h, w, h };
  }

  /** The rug button: a disc in the header's right column (the HUD grammar), its caption under it. */
  /** the room postcard disc: left of the rug disc in the header (same disc + caption grammar) */
  private postcardDisc(): { x: number; y: number; r: number; cap: number } {
    const r = this.rugDisc();
    const m = this.measureAt(this.scratch());
    const lang = this.d.lang;
    // both captions ≤ 82 / 70 pt (shrunk like the rug's), side by side without touching
    const cap = Math.min(13, (13 * 82) / Math.max(1, m(13)(vt(lang, "rugChip"))), (13 * 70) / Math.max(1, m(13)(vt(lang, "postcard"))));
    const rugCap = m(cap)(vt(lang, "rugChip"));
    const capW = m(cap)(vt(lang, "postcard"));
    const rugLeft = Math.min(r.x - rugCap / 2, this.W - 8 - rugCap);
    const x = Math.min(r.x - 2 * r.r - 12, rugLeft - 14 - capW / 2);
    return { x, y: r.y, r: r.r, cap };
  }
  private rugDisc(): { x: number; y: number; r: number } {
    return { x: this.W - 16 - 22, y: this.top + 10 + 22, r: 22 };
  }

  /** Slot boxes (pt): floor rows grow toward the front (1.0 / 1.15 / 1.3), wall slots on the back wall. */
  private slotBoxes(): Array<{ x: number; y: number; w: number; h: number }> {
    const b = this.roomBox();
    const kit = this.d.art.roomGeometry?.(b);
    if (kit && kit.slots.length === SLOTS) return kit.slots;
    const out: Array<{ x: number; y: number; w: number; h: number }> = [];
    const rowY = [0.66, 0.8, 0.95];
    const rowS = [1, 1.15, 1.3];
    const inset = 10; // ≥ 8 pt inside the frame (Reality R10)
    for (let r = 0; r < 3; r++) {
      const cw = (b.w - 2 * inset) / FLOOR_COLS;
      const s = Math.min(cw, b.h * 0.2) * 0.88 * (rowS[r]! / 1.3);
      for (let c = 0; c < FLOOR_COLS; c++) {
        const cx = b.x + inset + cw * (c + 0.5);
        const by = b.y + b.h * rowY[r]! - 4;
        out.push({ x: cx - s / 2, y: by - s, w: s, h: s });
      }
    }
    const ws = Math.min(b.w * 0.2, b.h * 0.17);
    for (let i = 0; i < 3; i++) {
      const cx = b.x + b.w * (0.2 + 0.3 * i);
      out.push({ x: cx - ws / 2, y: b.y + b.h * 0.22, w: ws, h: ws });
    }
    return out;
  }

  private slotLabel(slot: number): string {
    const lang = this.d.lang;
    if (slot === FLOOR_SLOTS) return vt(lang, "rug");
    const w = slotWhere(slot);
    const col = w.row === "wall" ? vt(lang, `wcol.${w.col}` as "wcol.0") : vt(lang, `col.${w.col}` as "col.0");
    return vt(lang, "where", { row: vt(lang, `row.${w.row}` as "row.back"), col });
  }

  /**
   * Where each visitor sits (final G1 #2, designer): on an EMPTY floor slot next to the piece of its category
   * (the row's free neighbour, right first, else left; else the nearest free front-row slot), a little smaller
   * than the slot — never on top of furniture. Drawn with the "sit" pose.
   */
  private guestBoxes(boxes: ReadonlyArray<{ x: number; y: number; w: number; h: number }>): Array<{ r: ResidentId; box: { x: number; y: number; w: number; h: number } }> {
    const out: Array<{ r: ResidentId; box: { x: number; y: number; w: number; h: number } }> = [];
    const taken = new Set<number>();
    const free = (i: number): boolean => i >= 0 && i < FLOOR_SLOTS && !this.room.slots[i] && coverOf(this.room, i) < 0 && !taken.has(i);
    for (const v of visitors(this.d.save.sv, this.room)) {
      const slot = this.room.slots.findIndex((p) => p && itemOfBit(p.bit)?.cat === v.cat);
      const row = slot >= 0 && slot < FLOOR_SLOTS ? Math.floor(slot / FLOOR_COLS) : 2;
      const cand: number[] = [];
      if (slot >= 0 && slot < FLOOR_SLOTS) cand.push(slot + 1, slot - 1, slot + 2, slot - 2);
      for (let c = 0; c < FLOOR_COLS; c++) cand.push(row * FLOOR_COLS + c, 2 * FLOOR_COLS + c);
      let pick = cand.find((i) => free(i) && (slot < 0 || Math.floor(i / FLOOR_COLS) === row || i >= 2 * FLOOR_COLS));
      if (pick === undefined) pick = cand.find((i) => free(i)) ?? 12;
      taken.add(pick);
      const near = boxes[pick]!;
      const sz = Math.min(near.w * 0.95, near.h * 0.72);
      out.push({ r: v.r, box: { x: near.x + near.w / 2 - sz / 2, y: near.y + near.h - sz, w: sz, h: sz } });
    }
    return out;
  }

  /**
   * The room postcard (design §2.6, spoiler-free: no board): the cottage + its visitors on the kit's
   * postcard frame, 1080 × 1350, shared with the app's link (ct=room). PNG base64 or null.
   */
  bakeRoomPostcard(): string | null {
    try {
      const PW = 1080;
      const PH = 1350;
      const c = document.createElement("canvas");
      c.width = PW;
      c.height = PH;
      const g = c.getContext("2d");
      if (!g) return null;
      const art = this.d.art;
      const frame = (art.drawPostcardFrame ?? placeholderArt.drawPostcardFrame!)(g, { x: 0, y: 0, w: PW, h: PH });
      const pic = frame.picture;
      g.save();
      g.beginPath();
      g.rect(pic.x, pic.y, pic.w, pic.h);
      g.clip();
      art.setEnvironment?.(this.env);
      const rb = { x: pic.x + pic.w * 0.04, y: pic.y + pic.h * 0.04, w: pic.w * 0.92, h: pic.h * 0.92 };
      art.drawRoom(g, rb, { wallpaper: this.room.wallpaper, floor: this.room.floor });
      const slots = art.roomGeometry?.(rb).slots;
      if (slots && slots.length === SLOTS) {
        if (this.room.rug) {
          const p = pieceOfBit(this.room.rug.bit)!;
          art.drawFurniture(g, p.item, p.cw, art.roomGeometry!(rb).rug);
        }
        this.room.slots.forEach((p, i) => {
          if (!p) return;
          const piece = pieceOfBit(p.bit)!;
          const item = itemById(piece.item)!;
          const bx = slots[i]!;
          const w = item.span === 2 && partnerSlot(i) >= 0 ? slots[partnerSlot(i)]!.x + slots[partnerSlot(i)]!.w - bx.x : bx.w;
          art.drawFurniture(g, piece.item, piece.cw, { x: bx.x, y: bx.y, w, h: bx.h });
        });
        for (const v of this.guestBoxesIn(slots)) art.drawResident(g, v.r, "happy", v.box, { pose: "sit" });
      }
      g.restore();
      // the caption: "Duskwick · date" (the postmark's words), no puzzle, no numbers but the date
      const cap = frame.caption;
      g.save();
      g.fillStyle = INK;
      g.font = villageFont(this.d.lang, Math.round(cap.h * 0.22), 700);
      g.textBaseline = "top";
      g.fillText(vt(this.d.lang, "shareText"), cap.x, cap.y + cap.h * 0.12, cap.w);
      g.font = villageFont(this.d.lang, Math.round(cap.h * 0.16), 500);
      g.fillText(`${isoOfDay(this.today)} · humsleep.github.io/apps/duskwick`, cap.x, cap.y + cap.h * 0.5, cap.w);
      g.restore();
      const url = c.toDataURL("image/png");
      const i = url.indexOf(",");
      return i > 0 ? url.slice(i + 1) : null;
    } catch (e) {
      console.warn("[village] postcard bake failed", e);
      return null;
    }
  }
  private guestBoxesIn(boxes: ReadonlyArray<{ x: number; y: number; w: number; h: number }>): ReturnType<VillageScene["guestBoxes"]> {
    return this.guestBoxes(boxes);
  }

  /** Share the room postcard (image + text with the link, ct=room); text only when the image fails. */
  private async shareRoom(): Promise<void> {
    cue("tap");
    const lang = this.d.lang;
    const text = `${vt(lang, "shareText")}\nhttps://humsleep.github.io/apps/duskwick/?ct=room`;
    const b64 = this.bakeRoomPostcard();
    let file: string | null = null;
    if (b64) {
      try {
        const { Directory, Filesystem } = await import("@capacitor/filesystem");
        file = (await Filesystem.writeFile({ path: `share/duskwick-room-${isoOfDay(this.today)}.png`, data: b64, directory: Directory.Cache, recursive: true })).uri;
      } catch (e) {
        console.warn("[village] postcard image skipped", e);
      }
    }
    try {
      const { Share } = await import("@capacitor/share");
      await Share.share({ text, dialogTitle: " ", ...(file ? { files: [file] } : {}) });
    } catch (e) {
      if (!/cancel/i.test(e instanceof Error ? e.message : String(e))) console.info("[share]", text, e);
    }
    this.shared++;
    const p = pickHost(this.d.lines.lines, "postcardTaken", new Set());
    if (p && !this.closed) {
      this.showHost(p, null, null);
      this.render();
    }
  }
  /** tests: room postcards shared this visit */
  shared = 0;

  private renderRoom(): void {
    const { W, H } = this;
    const lang = this.d.lang;
    const art = this.d.art;
    const b = this.roomBox();
    const boxes = this.slotBoxes();
    const room = this.room;
    const guests = this.guestBoxes(boxes);
    // the rug chip grows with its label (never an ellipsis)
    const key = this.tex("village-bg", W, H, (g) => {
      g.fillStyle = "#141A33";
      g.fillRect(0, 0, W, H);
      // G1 #13 (designer): the cottage stands outside at dusk, not on a flat page
      art.drawCottageOutside?.(g, { x: 0, y: 0, w: W, h: H }, b);
      // header
      this.disc(g, 16 + 22, this.top + 10 + 22, 22, "back");
      if (!this.drawer) {
        const pd = this.postcardDisc();
        this.disc(g, pd.x, pd.y, pd.r, "postcard");
        g.save();
        g.strokeStyle = "rgba(244,235,208,0.35)";
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(pd.x, pd.y, pd.r, 0, Math.PI * 2);
        g.stroke();
        g.restore();
        this.text(g, [vt(lang, "postcard")], pd.x, pd.y + pd.r + 4, pd.cap, { align: "center", color: UI.caption });
        // R4: the cozy chip (left column, under the back disc): level + five dots
        const cc = this.cozyChip();
        const lvl = cozyLevel(cozyScore(room));
        g.save();
        g.fillStyle = "rgba(30,26,61,0.82)";
        g.beginPath();
        g.roundRect(cc.x, cc.y, cc.w, cc.h, cc.h / 2);
        g.fill();
        g.strokeStyle = "rgba(244,211,138,0.65)";
        g.lineWidth = 1.5;
        g.stroke();
        for (let k = 0; k < 5; k++) {
          g.beginPath();
          g.arc(cc.x + cc.w - 14 - (4 - k) * 9, cc.y + cc.h / 2, 3.2, 0, Math.PI * 2);
          g.fillStyle = k < lvl ? "#F4D38A" : "rgba(244,235,208,0.25)";
          g.fill();
        }
        g.restore();
        this.text(g, [cozyText(lang, "chip", { n: lvl })], cc.x + 12, cc.y + (cc.h - 13) / 2, 13, { color: UI.caption, weight: 700 });
      }
      // the title sits between the back disc and the postcard disc (never under them)
      const tl = 16 + 44 + 8;
      const tr = this.postcardDisc().x - 22 - 8;
      const tfit = fitPill(vt(lang, "cottage"), Math.max(60, tr - tl), 1, this.measureAt(g, 700), lang);
      this.text(g, tfit.lines, (tl + tr) / 2, this.top + 32 - tfit.size / 2, Math.min(19, tfit.size + 2), { align: "center", color: UI.caption, weight: 700 });
      art.drawRoom(g, b, { wallpaper: room.wallpaper, floor: room.floor });
      // rug layer under the floor pieces
      if (room.rug) {
        const p = pieceOfBit(room.rug.bit)!;
        art.drawFurniture(g, p.item, p.cw, art.roomGeometry?.(b).rug ?? { x: b.x + b.w * 0.18, y: b.y + b.h * 0.7, w: b.w * 0.64, h: b.h * 0.2 });
      }
      for (let s = 0; s < SLOTS; s++) {
        const bx = boxes[s]!;
        const p = room.slots[s];
        const covered = !p && coverOf(room, s) >= 0;
        if (p) {
          const piece = pieceOfBit(p.bit)!;
          const item = itemById(piece.item)!;
          const w = item.span === 2 ? boxes[partnerSlot(s)]!.x + boxes[partnerSlot(s)]!.w - bx.x : bx.w;
          g.save();
          if (p.flip) {
            g.translate(bx.x + w / 2, 0);
            g.scale(-1, 1);
            g.translate(-(bx.x + w / 2), 0);
          }
          art.drawFurniture(g, piece.item, piece.cw, { x: bx.x, y: bx.y, w, h: bx.h });
          g.restore();
        } else if (!covered && this.drawer) {
          // G1 #14 (designer): empty slots only show while placing — a faint warm spot on the floor / wall,
          // no dotted "parking lot" over the whole room
          const fx = bx.x + bx.w / 2;
          const fy = bx.y + bx.h - (s < FLOOR_SLOTS ? 6 : bx.h / 2);
          const r = bx.w * 0.34;
          const sp = g.createRadialGradient(fx, fy, 0, fx, fy, r);
          sp.addColorStop(0, "rgba(255,226,170,0.32)");
          sp.addColorStop(1, "rgba(255,226,170,0)");
          g.save();
          g.translate(fx, fy);
          g.scale(1, s < FLOOR_SLOTS ? 0.34 : 1);
          g.translate(-fx, -fy);
          g.fillStyle = sp;
          g.beginPath();
          g.arc(fx, fy, r, 0, Math.PI * 2);
          g.fill();
          g.restore();
        }
        if (this.highlight === s || this.drawer?.slot === s) {
          g.save();
          g.strokeStyle = UI.primary;
          g.lineWidth = 2.4;
          g.beginPath();
          g.ellipse(bx.x + bx.w / 2, bx.y + bx.h - 6, bx.w * 0.46, bx.h * 0.16, 0, 0, Math.PI * 2);
          g.stroke();
          g.restore();
        }
      }
      // visitors: residents whose fulfilled request's piece is in the room, sitting beside it (design §2.4)
      if (!this.drawer) for (const vb of guests) art.drawResident(g, vb.r, "happy", vb.box, { pose: "sit" });
      // the rug (the rug layer has no slot of its own): a header disc with a rug glyph + its caption (no lone pill)
      const rd = this.rugDisc();
      g.save();
      g.fillStyle = "rgba(30,26,61,0.72)";
      g.beginPath();
      g.arc(rd.x, rd.y, rd.r, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "rgba(244,235,208,0.35)";
      g.lineWidth = 1.5;
      g.stroke();
      g.strokeStyle = UI.caption;
      g.lineWidth = 2.2;
      g.beginPath();
      g.ellipse(rd.x, rd.y + 2, rd.r * 0.58, rd.r * 0.26, 0, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.ellipse(rd.x, rd.y + 2, rd.r * 0.28, rd.r * 0.11, 0, 0, Math.PI * 2);
      g.stroke();
      g.restore();
      const capPx = this.postcardDisc().cap; // one caption size for the header's two discs (R3 P2)
      // the caption stays on screen (it may be wider than the disc: right-aligned to the edge then)
      const capW = this.measureAt(g)(capPx)(vt(lang, "rugChip"));
      this.text(g, [vt(lang, "rugChip")], Math.min(rd.x, W - 8 - capW / 2), rd.y + rd.r + 4, capPx, { align: "center", color: UI.caption });
      // R4 C: the set-complete line, an amber paper strip under the header — painted last, over the room
      const t = this.roomToast;
      if (t && !this.drawer && performance.now() < t.until) {
        const tf = fitPill(t.text, W - 48, 1, this.measureAt(g), lang);
        const th = tf.lines.length * tf.size * 1.2 + 16;
        const ty = this.cozyChip().y + 30 + 10;
        g.save();
        g.fillStyle = "#F4D38A";
        g.beginPath();
        g.roundRect(16, ty, W - 32, th, 12);
        g.fill();
        g.restore();
        this.text(g, tf.lines, W / 2, ty + 8, tf.size, { align: "center", color: INK, weight: 700, lineH: 1.2 });
      } else if (t && performance.now() >= t.until) this.roomToast = null;
    });
    this.show(this.bg, key, 0, 0);
    for (const sp of this.res) sp.img.setVisible(false);
    // village-only layers stay out of the cottage
    this.stallImg?.setVisible(false);
    for (const b of this.bubbles.values()) b.setVisible(false);
    this.mailImg.setVisible(false);
    this.hud.setVisible(false);

    if (!this.drawer) {
      this.hits.push({ id: "room-back", x: 10, y: this.top + 4, w: 56, h: 56, label: vt(lang, "back"), act: () => this.leaveRoom() });
      // the postcard disc (top right): share the cottage, spoiler-free
      const pdh = this.postcardDisc();
      this.hits.push({ id: "postcard", x: pdh.x - pdh.r - 4, y: pdh.y - pdh.r - 4, w: 2 * pdh.r + 8, h: 2 * pdh.r + 24, label: vt(lang, "postcard"), act: () => void this.shareRoom() });
      for (const v of guests) {
        const name = residentName(lang, v.r);
        this.hits.push({ id: `guest-${v.r}`, x: v.box.x, y: v.box.y, w: v.box.w, h: v.box.h, label: vt(lang, "visiting", { name }), act: () => {
          const p = pickVisit(this.d.lines.lines, v.r);
          if (p) this.showSpeaker(v.r, p);
          this.render();
        } });
      }
      this.hits.push({ id: "room", x: b.x, y: b.y, w: b.w, h: b.h * 0.15, label: vt(lang, "room"), act: () => undefined });
      for (let s = 0; s < SLOTS; s++) {
        const bx = boxes[s]!;
        const c = coverOf(room, s);
        const p = c >= 0 ? room.slots[c] : null;
        const where = this.slotLabel(s);
        const label = p ? vt(lang, "slotHas", { where, item: itemName(lang, pieceOfBit(p.bit)!.item), cw: vt(lang, `cw.${pieceOfBit(p.bit)!.cw}` as "cw.cream") }) : vt(lang, "slotEmpty", { where });
        // floor slot boxes are tall (the item stands in them) and overlap the row behind: the tap area is the floor half
        const hy = s < FLOOR_SLOTS ? bx.y + bx.h * 0.5 : bx.y;
        this.hits.push({ id: `slot-${s}`, x: bx.x, y: hy, w: bx.w, h: bx.y + bx.h - hy, label, act: () => this.openDrawer(c >= 0 ? c : s) });
      }
      const rug = room.rug ? pieceOfBit(room.rug.bit) : null;
      this.hits.push({
        id: "slot-rug", x: this.rugDisc().x - 28, y: this.rugDisc().y - 26, w: 56, h: 72,
        label: rug ? vt(lang, "slotHas", { where: vt(lang, "rug"), item: itemName(lang, rug.item), cw: vt(lang, `cw.${rug.cw}` as "cw.cream") }) : vt(lang, "slotEmpty", { where: vt(lang, "rug") }),
        act: () => this.openDrawer(FLOOR_SLOTS),
      });
      // last = on top of the room's own tap areas (the chip overlaps the roof)
      const cc = this.cozyChip();
      this.hits.push({ id: "cozy", x: cc.x, y: cc.y - 7, w: cc.w, h: cc.h + 14, label: cozyText(lang, "chipA11y", { n: cozyLevel(cozyScore(room)) }), act: () => this.openCozy() });
      this.drawerImg.setVisible(false);
    } else this.renderDrawer();
  }



  // --- R4 B storybook

  private storyChapter: number | null = null;

  private storyNow(): ReturnType<typeof storyState> {
    return storyState(this.residentsNow(), this.d.save.sv.cz, this.d.save.sv.st);
  }

  private storyDisc(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, dot: boolean): void {
    g.save();
    g.fillStyle = "rgba(20,26,51,0.55)";
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    // an open book: two pages from a spine
    g.strokeStyle = UI.caption;
    g.lineWidth = 2.2;
    g.lineJoin = "round";
    for (const d of [-1, 1]) {
      g.beginPath();
      g.moveTo(cx, cy - r * 0.26);
      g.quadraticCurveTo(cx + d * r * 0.28, cy - r * 0.42, cx + d * r * 0.52, cy - r * 0.32);
      g.lineTo(cx + d * r * 0.52, cy + r * 0.34);
      g.quadraticCurveTo(cx + d * r * 0.28, cy + r * 0.24, cx, cy + r * 0.38);
      g.closePath();
      g.stroke();
    }
    g.beginPath();
    g.moveTo(cx, cy - r * 0.26);
    g.lineTo(cx, cy + r * 0.38);
    g.stroke();
    if (dot) {
      g.fillStyle = UI.primary;
      g.beginPath();
      g.arc(cx + r * 0.72, cy - r * 0.72, 5, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  private openStory(): void {
    cue("tap");
    this.card = null;
    this.storyChapter = null;
    this.screenNow = "story";
    this.log("story");
    this.render();
  }

  private closeStory(): void {
    cue("tap");
    this.storyChapter = null;
    this.screenNow = "village";
    this.render();
  }

  /** Open a chapter: its open pages count as read (synced v.st). */
  private openChapter(c: number): void {
    cue("tap");
    this.storyChapter = c;
    const st = this.storyNow()[c]!;
    const add = st.flatMap((p, k) => (p.open && !p.read ? [pageBit(c, k)] : []));
    if (add.length) {
      const apply = (x: VillageSave): void => void (x.sv.st = normBits([...x.sv.st, ...add]));
      apply(this.d.save);
      void updateVillage(apply);
    }
    this.render();
  }

  private hintText(h: Hint, who: ResidentId): string {
    const lang = this.d.lang;
    const name = residentName(lang, who);
    if (h.kind === "moveIn") return storyUi(lang, "moveIn", { name });
    if (h.kind === "friend") return storyUi(lang, "friend", { name, n: h.n });
    if (h.kind === "chapters") return storyUi(lang, "chapters", { n: Math.max(1, h.n) });
    if (h.kind === "later") return "· · ·";
    const set = SETS.find((x) => x.r === who)!;
    return storyUi(lang, "set", { name, items: set.items.map((i) => itemName(lang, i)).join(", ") });
  }

  private renderStory(): void {
    const { W, H } = this;
    const lang = this.d.lang;
    const st = this.storyNow();
    const meas = this.measureAt(this.scratch());
    const colW = Math.min(W, 520) - 32;
    const x0 = (W - colW) / 2;
    const bw = Math.min(260, W - 64);
    const by = this.bottom - 60;
    const c = this.storyChapter;
    if (c === null) {
      // the chapter list
      const titleY = this.top + 16;
      const qY = titleY + 30;
      const rowH = Math.min(62, (by - 16 - (qY + 34)) / CHAPTERS.length);
      const y0 = qY + 34;
      const key = this.tex("village-overlay", W, H, (g) => {
        g.fillStyle = "rgba(14,12,32,0.95)";
        g.fillRect(0, 0, W, H);
        this.text(g, [storyUi(lang, "book")], W / 2, titleY, 21, { align: "center", color: UI.caption, weight: 700 });
        this.text(g, [storyUi(lang, "question")], W / 2, qY, 14, { align: "center", color: "#F4D38A", weight: 600 });
        CHAPTERS.forEach((who, i) => {
          const y = y0 + i * rowH;
          const pages = st[i]!;
          const any = pages[0]!.open;
          g.save();
          g.fillStyle = any ? "rgba(255,243,222,0.1)" : "rgba(255,255,255,0.04)";
          g.beginPath();
          g.roundRect(x0, y, colW, rowH - 8, 12);
          g.fill();
          g.restore();
          const tc = any ? UI.caption : "rgba(244,235,208,0.45)";
          this.text(g, [storyUi(lang, "chapter", { n: i + 1 })], x0 + 14, y + 8, 11, { color: tc, weight: 600 });
          const tf = fitPill(any ? STORY[lang].title[who] : "· · ·", colW - 14 - 80, 1, meas, lang);
          this.text(g, tf.lines.slice(0, 1), x0 + 14, y + 24, Math.min(16, tf.size + 1), { color: tc, weight: 700 });
          pages.forEach((p, k) => {
            const dx = x0 + colW - 62 + k * 20;
            const dy = y + (rowH - 8) / 2;
            g.save();
            g.beginPath();
            g.arc(dx, dy, 6, 0, Math.PI * 2);
            if (p.open) {
              g.fillStyle = p.read ? "#F4D38A" : "rgba(244,211,138,0.25)";
              g.fill();
              if (!p.read) {
                g.strokeStyle = "#F4D38A";
                g.lineWidth = 2;
                g.stroke();
              }
            } else {
              g.strokeStyle = "rgba(244,235,208,0.3)";
              g.lineWidth = 1.5;
              g.stroke();
            }
            g.restore();
          });
        });
        this.pill(g, (W - bw) / 2, by, bw, 48, vt(lang, "close"), false);
      });
      this.show(this.overlay, key, 0, 0);
      this.children.bringToTop(this.overlay);
      CHAPTERS.forEach((who, i) => {
        const pages = st[i]!;
        const read = pages.filter((p) => p.read).length;
        const label = `${storyUi(lang, "chapter", { n: i + 1 })}: ${pages[0]!.open ? STORY[lang].title[who] : "…"}, ${storyUi(lang, "pages", { read })}`;
        this.hits.push({ id: `chapter-${i}`, x: x0, y: y0 + i * rowH, w: colW, h: rowH - 8, label, act: () => this.openChapter(i) });
      });
      this.hits.push({ id: "story-close", x: (W - bw) / 2, y: by, w: bw, h: 48, label: vt(lang, "close"), act: () => this.closeStory() });
      return;
    }
    // one chapter: its three pages on paper
    const who = CHAPTERS[c]!;
    const pages = st[c]!;
    const sizes = [15, 14, 13, 12];
    const padX = 18;
    const fits = pages.map((p, k) => (p.open ? fitText(STORY[lang].pages[who][k]!, { maxW: colW - 2 * padX, maxLines: 6, sizes, measureAt: meas, lang }) : fitText(this.hintText(p.hint!, who), { maxW: colW - 2 * padX - 16, maxLines: 3, sizes: [13, 12], measureAt: meas, lang })));
    const titleY = this.top + 14;
    const paperY = titleY + 62;
    const blockH = fits.map((f) => f.lines.length * f.size * 1.35);
    const paperH = Math.min(by - 14 - paperY, blockH.reduce((a, b) => a + b, 0) + 3 * 18 + 28);
    const key = this.tex("village-overlay", W, H, (g) => {
      g.fillStyle = "rgba(14,12,32,0.95)";
      g.fillRect(0, 0, W, H);
      this.text(g, [storyUi(lang, "chapter", { n: c + 1 })], W / 2, titleY, 13, { align: "center", color: "#F4D38A", weight: 600 });
      const tf = fitPill(pages[0]!.open ? STORY[lang].title[who] : "· · ·", colW, 1, meas, lang);
      this.text(g, tf.lines.slice(0, 2), W / 2, titleY + 20, Math.min(20, tf.size + 3), { align: "center", color: UI.caption, weight: 700 });
      g.save();
      g.fillStyle = PAPER;
      g.beginPath();
      g.roundRect(x0, paperY, colW, paperH, 14);
      g.fill();
      g.restore();
      let y = paperY + 16;
      pages.forEach((p, k) => {
        const f = fits[k]!;
        if (p.open) this.text(g, f.lines, x0 + padX, y, f.size, { color: INK, weight: 500, lineH: 1.35 });
        else {
          // a locked page: a lock and what opens it
          g.save();
          g.fillStyle = UI.inkSoft;
          g.strokeStyle = UI.inkSoft;
          g.lineWidth = 1.6;
          g.beginPath();
          g.arc(x0 + padX + 5, y + f.size * 0.55 - 3, 3.4, Math.PI, 0);
          g.stroke();
          g.beginPath();
          g.roundRect(x0 + padX, y + f.size * 0.55 - 3, 10, 8, 1.5);
          g.fill();
          g.restore();
          this.text(g, f.lines, x0 + padX + 16, y, f.size, { color: UI.inkSoft, weight: 600, lineH: 1.35 });
        }
        y += blockH[k]! + 18;
        if (k < 2) {
          g.save();
          g.strokeStyle = "rgba(59,44,69,0.14)";
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(x0 + padX, y - 10);
          g.lineTo(x0 + colW - padX, y - 10);
          g.stroke();
          g.restore();
        }
      });
      this.pill(g, (W - bw) / 2, by, bw, 48, storyUi(lang, "list"), false);
    });
    this.show(this.overlay, key, 0, 0);
    this.children.bringToTop(this.overlay);
    let y = paperY + 16;
    pages.forEach((p, k) => {
      const text = p.open ? STORY[lang].pages[who][k]! : this.hintText(p.hint!, who);
      this.hits.push({ id: `page-${k}`, x: x0, y, w: colW, h: blockH[k]!, label: text, act: () => undefined });
      y += blockH[k]! + 18;
    });
    this.hits.push({ id: "story-list", x: (W - bw) / 2, y: by, w: bw, h: 48, label: storyUi(lang, "list"), act: () => {
      cue("tap");
      this.storyChapter = null;
      this.render();
    } });
  }

  // --- R4 cozy rewards

  /** the cozy chip: under the back disc, left column of the header (pt) */
  private cozyChip(): { x: number; y: number; w: number; h: number } {
    const m = this.measureAt(this.scratch(), 700);
    const w = Math.ceil(m(13)(cozyText(this.d.lang, "chip", { n: 5 }))) + 12 + 10 + 5 * 9 + 10;
    return { x: 12, y: this.top + 62, w, h: 30 };
  }

  private openCozy(): void {
    cue("tap");
    this.card = null;
    this.cozyOpen = true;
    this.cozyUp = 0;
    this.cozyMsg = "";
    this.render();
  }

  private closeCozy(): void {
    cue("tap");
    this.cozyOpen = false;
    this.cozyUp = 0;
    this.render();
  }

  private skinHow(sk: LanternSkin): string {
    const lang = this.d.lang;
    const n = SKIN_NEEDS[sk];
    const parts: string[] = [];
    if (n.cozy !== null) parts.push(cozyText(lang, "needLevel", { n: n.cozy }));
    if (n.friend) parts.push(cozyText(lang, "needFriend", { name: residentName(lang, sk) }));
    return parts.join(" / ");
  }

  /** The rewards panel: level, score, the five level rewards, the lanterns and the boards to choose from. */
  private renderCozy(): void {
    const { W, H } = this;
    const lang = this.d.lang;
    const cz = this.d.save.sv.cz;
    const score = cozyScore(this.room);
    const lvl = cozyLevel(score);
    const meas = this.measureAt(this.scratch());
    const colW = Math.min(W, 520) - 32;
    const x0 = (W - colW) / 2;
    const upY = this.top + 12;
    const titleY = upY + (this.cozyUp ? 28 : 0);
    const scoreY = titleY + 28;
    const howF = fitPill(cozyText(lang, "how"), colW, 1, meas, lang);
    const howY = scoreY + 22;
    const rowH = 38;
    const rowsY0 = howY + howF.lines.length * howF.size * 1.2 + 12;
    const lanY = rowsY0 + 5 * rowH + 6;
    const cardsY = lanY + 22;
    const gap = 6;
    const cw = Math.min(54, (colW - gap * (SKINS.length - 1)) / SKINS.length);
    const ch = Math.round(cw * 1.3);
    const cx0 = (W - (SKINS.length * cw + (SKINS.length - 1) * gap)) / 2;
    const thY = cardsY + ch + 12;
    const swY = thY + 22;
    const sw = Math.min(92, (colW - 20) / 3);
    const sh = Math.round(sw * 0.6);
    const sx0 = (W - (3 * sw + 20)) / 2;
    const msgY = swY + sh + 22;
    const bw = Math.min(260, W - 64);
    const by = Math.min(this.bottom - 52, msgY + (this.cozyMsg ? 28 : 4));
    const lock = (g: CanvasRenderingContext2D, x: number, y: number): void => {
      g.save();
      g.fillStyle = "rgba(244,235,208,0.9)";
      g.strokeStyle = "rgba(244,235,208,0.9)";
      g.lineWidth = 1.6;
      g.beginPath();
      g.arc(x, y - 3, 3.2, Math.PI, 0);
      g.stroke();
      g.beginPath();
      g.roundRect(x - 4.5, y - 3, 9, 7, 1.5);
      g.fill();
      g.restore();
    };
    const key = this.tex("village-overlay", W, H, (g) => {
      g.fillStyle = "rgba(14,12,32,0.95)";
      g.fillRect(0, 0, W, H);
      if (this.cozyUp) this.text(g, [cozyText(lang, "up")], W / 2, upY, 16, { align: "center", color: "#F4D38A", weight: 700 });
      this.text(g, [cozyText(lang, "title", { n: lvl })], W / 2, titleY, 20, { align: "center", color: UI.caption, weight: 700 });
      const sline = lvl >= 5 ? cozyText(lang, "scoreMax", { score }) : cozyText(lang, "score", { score, left: COZY_AT[lvl + 1]! - score });
      this.text(g, [sline], W / 2, scoreY, 13, { align: "center", color: UI.caption, weight: 500 });
      this.text(g, howF.lines, W / 2, howY, howF.size, { align: "center", color: "rgba(244,235,208,0.72)", weight: 500, lineH: 1.2 });
      for (let k = 1; k <= 5; k++) {
        const yy = rowsY0 + (k - 1) * rowH;
        const got = cz.includes(cozyBit(k));
        const rh = rowH - 6;
        g.save();
        g.fillStyle = this.cozyUp === k ? "rgba(244,211,138,0.24)" : "rgba(255,255,255,0.05)";
        g.beginPath();
        g.roundRect(x0, yy, colW, rh, 10);
        g.fill();
        g.beginPath();
        g.arc(x0 + 18, yy + rh / 2, 11, 0, Math.PI * 2);
        g.fillStyle = got ? "#F4D38A" : "rgba(244,235,208,0.16)";
        g.fill();
        g.restore();
        this.text(g, [String(k)], x0 + 18, yy + rh / 2 - 7, 13, { align: "center", color: got ? INK : UI.caption, weight: 700 });
        const rf = fitPill(cozyText(lang, `r${k}` as CozyKey), colW - 40 - 26, 1, meas, lang);
        const lines = rf.lines.slice(0, 2);
        this.text(g, lines, x0 + 38, yy + (rh - lines.length * rf.size * 1.15) / 2, rf.size, { color: got ? UI.caption : "rgba(244,235,208,0.55)", weight: 600, lineH: 1.15 });
        if (got) {
          g.save();
          g.strokeStyle = "#F4D38A";
          g.lineWidth = 2.2;
          g.lineCap = "round";
          g.beginPath();
          g.moveTo(x0 + colW - 22, yy + rh / 2);
          g.lineTo(x0 + colW - 17, yy + rh / 2 + 5);
          g.lineTo(x0 + colW - 9, yy + rh / 2 - 5);
          g.stroke();
          g.restore();
        } else lock(g, x0 + colW - 15, yy + rh / 2);
      }
      this.text(g, [cozyText(lang, "lanterns")], x0, lanY, 13, { color: UI.caption, weight: 700 });
      SKINS.forEach((sk, i) => {
        const x = cx0 + i * (cw + gap);
        const open = skinUnlocked(sk, cz);
        const sel = lanternSkin() === sk;
        g.save();
        g.fillStyle = sel ? "rgba(244,211,138,0.26)" : "rgba(255,255,255,0.06)";
        g.beginPath();
        g.roundRect(x, cardsY, cw, ch, 10);
        g.fill();
        if (sel) {
          g.strokeStyle = UI.primary;
          g.lineWidth = 2;
          g.stroke();
        }
        const lh = ch * 0.8;
        g.globalAlpha = open ? 1 : 0.3;
        g.translate(x + cw / 2 - lh * 0.4, cardsY + (ch - lh) / 2);
        drawFramedLantern(g, lh, open ? 1 : 0.5, sk);
        g.restore();
        if (!open) lock(g, x + cw - 9, cardsY + 11);
      });
      this.text(g, [cozyText(lang, "boards")], x0, thY, 13, { color: UI.caption, weight: 700 });
      THEMES.forEach((t, i) => {
        const x = sx0 + i * (sw + 10);
        const open = themeUnlocked(t, cz);
        const sel = boardTheme() === t;
        const [a, b] = themeTints(t);
        const cs = (sw - 8) / 3;
        const rs = (sh - 6) / 2;
        g.save();
        g.fillStyle = "#15172B";
        g.beginPath();
        g.roundRect(x, swY, sw, sh, 8);
        g.fill();
        g.globalAlpha = open ? 1 : 0.35;
        for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
          const lit = r === 0 && c === 1;
          const px = x + 2 + c * (cs + 2);
          const py = swY + 2 + r * (rs + 2);
          g.fillStyle = lit ? "#F0C688" : (r + c) % 2 ? a : b;
          g.beginPath();
          g.roundRect(px, py, cs, rs, 3);
          g.fill();
          if (!lit && t !== "stone") {
            g.fillStyle = t === "garden" ? "rgba(124,176,108,0.6)" : "rgba(232,242,255,0.55)";
            g.beginPath();
            g.ellipse(px + cs * 0.2, py + rs * 0.8, cs * 0.12, rs * 0.08, 0, 0, Math.PI * 2);
            g.ellipse(px + cs * 0.8, py + rs * 0.25, cs * 0.1, rs * 0.07, 0, 0, Math.PI * 2);
            g.fill();
          }
        }
        g.restore();
        if (sel) {
          g.save();
          g.strokeStyle = UI.primary;
          g.lineWidth = 2;
          g.beginPath();
          g.roundRect(x - 2, swY - 2, sw + 4, sh + 4, 9);
          g.stroke();
          g.restore();
        }
        if (!open) lock(g, x + sw - 10, swY + 11);
        this.text(g, [cozyText(lang, `theme.${t}` as CozyKey)], x + sw / 2, swY + sh + 4, 12, { align: "center", color: open ? UI.caption : "rgba(244,235,208,0.55)", weight: 600 });
      });
      if (this.cozyMsg) {
        const mf = fitPill(this.cozyMsg, colW, 1, meas, lang);
        this.text(g, mf.lines, W / 2, msgY, mf.size, { align: "center", color: "#F4D38A", weight: 600, lineH: 1.2 });
      }
      this.pill(g, (W - bw) / 2, by, bw, 48, vt(lang, "close"), false);
    });
    this.show(this.overlay, key, 0, 0);
    this.children.bringToTop(this.overlay);
    for (let k = 1; k <= 5; k++) {
      const got = cz.includes(cozyBit(k));
      this.hits.push({ id: `cozy-r${k}`, x: x0, y: rowsY0 + (k - 1) * rowH, w: colW, h: rowH - 6, label: `${k}. ${cozyText(lang, `r${k}` as CozyKey)}${got ? " ✓" : ""}`, act: () => undefined });
    }
    SKINS.forEach((sk, i) => {
      const name = residentName(lang, sk);
      const open = skinUnlocked(sk, cz);
      const sel = lanternSkin() === sk;
      const label = open ? cozyText(lang, sel ? "inUse" : "use", { name }) : cozyText(lang, "locked", { name, how: this.skinHow(sk) });
      this.hits.push({ id: `skin-${sk}`, x: cx0 + i * (cw + gap), y: cardsY, w: cw, h: ch, label, ...(open ? { pressed: sel } : {}), act: () => this.pickSkin(sk, label) });
    });
    THEMES.forEach((t, i) => {
      const name = cozyText(lang, `theme.${t}` as CozyKey);
      const open = themeUnlocked(t, cz);
      const sel = boardTheme() === t;
      const label = open ? cozyText(lang, sel ? "inUse" : "use", { name }) : cozyText(lang, "locked", { name, how: cozyText(lang, "needLevel", { n: THEME_NEEDS[t] }) });
      this.hits.push({ id: `theme-${t}`, x: sx0 + i * (sw + 10), y: swY, w: sw, h: sh + 18, label, ...(open ? { pressed: sel } : {}), act: () => this.pickTheme(t, label) });
    });
    this.hits.push({ id: "cozy-close", x: (W - bw) / 2, y: by, w: bw, h: 48, label: vt(lang, "close"), act: () => this.closeCozy() });
  }

  private pickSkin(sk: LanternSkin, label: string): void {
    if (!skinUnlocked(sk, this.d.save.sv.cz)) {
      cue("tap");
      this.cozyMsg = label;
      a11y.announce(label);
    } else {
      chooseSkin(sk);
      haptic.place();
      cue("tap");
      this.cozyMsg = "";
    }
    this.render();
  }

  private pickTheme(t: BoardTheme, label: string): void {
    if (!themeUnlocked(t, this.d.save.sv.cz)) {
      cue("tap");
      this.cozyMsg = label;
      a11y.announce(label);
    } else {
      chooseTheme(t);
      haptic.place();
      cue("tap");
      this.cozyMsg = "";
    }
    this.render();
  }

  private leaveRoom(): void {
    cue("tap");
    this.cozyOpen = false;
    this.cozyUp = 0;
    this.screenNow = "village";
    this.highlight = -1;
    this.card = null;
    this.render();
  }

  private openDrawer(slot: number): void {
    cue("tap");
    this.card = null;
    this.highlight = -1;
    this.drawer = { slot, tab: "all", cw: {} };
    this.log(`drawer ${slot}`);
    this.render();
  }

  private closeDrawer(): void {
    this.drawer = null;
    this.render();
  }

  /** Cards the open slot can take: floor slots → floor pieces + rugs; wall slots → wall pieces; the rug chip → rugs. */
  private drawerCards(): ReturnType<typeof cards> {
    const d = this.drawer!;
    const layerOk = (layer: string): boolean => (d.slot === FLOOR_SLOTS ? layer === "rug" : d.slot < FLOOR_SLOTS ? layer === "floor" || layer === "rug" : layer === "wall");
    const tab = DRAWER_TABS.find((t) => t.id === d.tab) ?? DRAWER_TABS[0]!;
    return cards(this.ownedNow(), this.room).filter((c) => layerOk(c.item.layer) && (!tab.cats.length || tab.cats.includes(c.item.cat)));
  }

  /** Drawer card grid scroll (pt) and its visible window (pt, screen space) — the grid scrolls inside the drawer. */
  private gridScroll = 0;
  private gridWin = { y: 0, h: 0, content: 0 };

  private renderDrawer(): void {
    const d = this.drawer!;
    const { W, H } = this;
    const lang = this.d.lang;
    const fresh = new Set(this.d.save.loc.fresh);
    const progress = setProgress(this.room);
    // owned first (Reality G1 #20), catalog order inside each group
    const list = [...this.drawerCards()].sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || a.item.index - b.item.index);
    const cols = 4;
    const gap = 8;
    const side = 16;
    const cw = (Math.min(W, 600) - side * 2 - gap * (cols - 1)) / cols;
    const ch = cw + 58;
    const rows = Math.max(1, Math.ceil(list.length / cols));
    const occupied = d.slot === FLOOR_SLOTS ? this.room.rug : this.room.slots[d.slot] ?? null;
    const here = occupied ? pieceOfBit(occupied.bit) : null;
    const titleH = 44;
    const tabsH = TAB_H + 8;
    const actH = occupied ? 52 : 0;
    const head = titleH + tabsH + actH + 4;
    const gridH = rows * (ch + gap);
    // at most 55 % of the screen (G1 #22): the grid scrolls; the room slides up so the spot stays in view
    const dh = Math.min(Math.round(H * 0.55), head + gridH + 8 + (H - this.bottom));
    const dy = H - dh;
    const x0 = (W - Math.min(W, 600)) / 2 + side;
    const tabs = DRAWER_TABS.filter((t) => t.id === "all" || this.drawerCardsFor(t.id).length > 0);
    const tabW = (W - 2 * side - gap * (tabs.length - 1)) / tabs.length;
    const meas = this.measureAt(this.scratch());
    const winY = dy + head;
    const winH = Math.max(40, H - (H - this.bottom) - 8 - winY);
    this.gridWin = { y: winY, h: winH, content: gridH };
    this.gridScroll = Math.max(0, Math.min(this.gridScroll, Math.max(0, gridH - winH)));

    // the room slides up: the chosen spot sits above the drawer
    const boxes = this.slotBoxes();
    const spot = d.slot === FLOOR_SLOTS ? this.d.art.roomGeometry?.(this.roomBox()).rug ?? boxes[7]! : boxes[d.slot]!;
    const shift = Math.max(0, spot.y + spot.h + 18 - dy);
    this.bg.setY(-shift * this.u);

    const key = this.tex("village-drawer", W, dh, (g) => {
      g.fillStyle = PAPER;
      g.beginPath();
      g.roundRect(0, 0, W, dh + 20, 22);
      g.fill();
      g.fillStyle = UI.paperEdge;
      g.beginPath();
      g.roundRect(W / 2 - 22, 7, 44, 5, 2.5);
      g.fill();
      const tf = fitPill(drawerTitle(lang), W - 2 * side - 56, textScale(), meas, lang);
      this.text(g, tf.lines, side, 16, tf.size, { weight: 700 });
      g.save();
      g.strokeStyle = INK;
      g.lineWidth = 2.2;
      g.lineCap = "round";
      const cx = W - side - 16;
      g.beginPath();
      g.moveTo(cx - 7, 20);
      g.lineTo(cx + 7, 34);
      g.moveTo(cx + 7, 20);
      g.lineTo(cx - 7, 34);
      g.stroke();
      g.restore();
      tabs.forEach((t, i) => {
        const tx = side + i * (tabW + gap);
        g.save();
        g.fillStyle = t.id === d.tab ? UI.primary : "rgba(59,44,69,0.08)";
        g.beginPath();
        g.roundRect(tx, titleH, tabW, TAB_H, 14);
        g.fill();
        g.restore();
        // one line, shrinking 13 → 10 pt; two lines only if a locale needs it
        const f = fitTab(tabName(lang, t.id), W, meas, 2, lang);
        const lh = f.size * 1.1;
        this.text(g, f.lines, tx + tabW / 2, titleH + (TAB_H - f.lines.length * lh) / 2, f.size, { align: "center", lineH: 1.1 });
      });
      if (occupied) {
        const ay = titleH + tabsH + 4;
        const aw = (W - 2 * side - gap) / 2;
        g.save();
        g.strokeStyle = INK;
        g.lineWidth = 1.5;
        for (let i = 0; i < 2; i++) {
          g.beginPath();
          g.roundRect(side + i * (aw + gap), ay, aw, 40, 20);
          g.stroke();
        }
        g.restore();
        for (const [i, k] of (["takeOut", "turn"] as const).entries()) {
          const f = fitPill(vt(lang, k), aw - 16, 1, meas, lang);
          this.text(g, f.lines, side + i * (aw + gap) + aw / 2, ay + (40 - f.size) / 2, f.size, { align: "center" });
        }
      }
    });
    this.show(this.drawerImg, key, 0, dy);
    this.children.bringToTop(this.drawerImg);

    // the card grid: its own texture, scrolled and cropped to the window
    const drawn: Array<{ id: string; name: string[]; src: string[] }> = [];
    this.drawerDrawn = drawn;
    const gk = this.tex("village-drawer-grid", W, Math.max(1, gridH), (g) => {
      list.forEach((c, i) => {
        const cx0 = x0 + (i % cols) * (cw + gap);
        const cy0 = Math.floor(i / cols) * (ch + gap);
        const sel = d.cw[c.item.id] ?? c.cws.find((x) => x.owned)?.cw ?? c.cws[0]!.cw;
        const cur = c.cws.find((x) => x.cw === sel)!;
        g.save();
        g.fillStyle = c.unlocked ? "#FFFFFF" : "rgba(59,44,69,0.07)";
        g.beginPath();
        g.roundRect(cx0, cy0, cw, ch, 12);
        g.fill();
        if (here && here.item === c.item.id) {
          // the piece in this spot now: amber frame (G1 #23)
          g.strokeStyle = UI.primary;
          g.lineWidth = 2.5;
          g.stroke();
        }
        g.restore();
        const pad = 8;
        this.d.art.drawFurniture(g, c.item.id, sel, { x: cx0 + pad, y: cy0 + pad + 2, w: cw - pad * 2, h: cw - pad * 2 - 8 }, { locked: !cur.owned, fit: "card" });
        // name — always, locked too (G8)
        const nf = fitCardName(itemName(lang, c.item.id), W, meas, lang);
        if (c.unlocked) drawn.push({ id: c.item.id, name: nf.lines, src: [] });
        this.text(g, nf.lines, cx0 + cw / 2, cy0 + cw - 8, nf.size, { align: "center", weight: 600, lineH: 1.15 });
        // one centre line for the name and what sits under it (G1 re-review 2 #7); the band follows the name
        const bandY = dotRowY(cy0, cw, ch, nf) - 11;
        if (c.unlocked) {
          // colourway dots: owned filled, not-yet hollow
          c.cws.forEach((x, k) => {
            const dx = cx0 + cw / 2 + (k - (c.cws.length - 1) / 2) * 16;
            g.save();
            g.beginPath();
            g.arc(dx, bandY + 11, 5.5, 0, Math.PI * 2);
            if (x.owned) {
              g.fillStyle = CW_FILL[x.cw];
              g.fill();
            }
            g.strokeStyle = x.cw === sel ? INK : "rgba(59,44,69,0.4)";
            g.lineWidth = x.cw === sel ? 2 : 1;
            if (!x.owned) g.setLineDash([2, 2]);
            g.stroke();
            g.restore();
          });
        } else {
          // locked: a lock and HOW to get it, drawn on the card (G8, Reality G1 #19)
          const src = cur.source.kind === "resident" ? vt(lang, "srcResident", { name: residentName(lang, cur.source.id) }) : vt(lang, "srcJar");
          const sf = fitCardSource(src, W, meas, lang);
          drawn.push({ id: c.item.id, name: nf.lines, src: sf.lines });
          const lh = sf.size * 1.12;
          const top = Math.min(cy0 + ch - 6 - sf.lines.length * lh, bandY + 4);
          g.save();
          g.font = villageFont(lang, sf.size, 600);
          const w0 = g.measureText(sf.lines[0] ?? "").width;
          g.restore();
          // the lock sits just left of the (centred) first line
          drawLock(g, cx0 + cw / 2 - w0 / 2 - 4, top + lh / 2, 3.8);
          this.text(g, sf.lines, cx0 + cw / 2 + 4, top, sf.size, { align: "center", color: UI.inkSoft, weight: 600, lineH: 1.12 });
        }
        // R4 C: the resident set this item belongs to — "2/3" (amber when complete), top left
        const set = setOfItem(c.item.id);
        if (set && c.unlocked) {
          const have = progress.get(set.r) ?? 0;
          const label = `${have}/3`;
          g.save();
          g.fillStyle = have === 3 ? "#F4D38A" : "rgba(125,187,106,0.92)";
          g.beginPath();
          g.roundRect(cx0 + 6, cy0 + 6, 30, 17, 8.5);
          g.fill();
          g.restore();
          this.text(g, [label], cx0 + 21, cy0 + 8, 11, { align: "center", color: have === 3 ? INK : "#FFFFFF", weight: 700 });
        }
        if (c.cws.some((x) => fresh.has(x.bit) && x.owned && !x.placed)) {
          g.save();
          g.fillStyle = UI.primary;
          g.beginPath();
          g.arc(cx0 + cw - 10, cy0 + 10, 5, 0, Math.PI * 2);
          g.fill();
          g.restore();
        }
      });
    });
    this.gridImg ??= this.add.image(0, 0, gk).setOrigin(0, 0);
    this.show(this.gridImg, gk, 0, winY - this.gridScroll);
    this.applyGridCrop();
    this.children.bringToTop(this.gridImg);
    // a soft edge where the scrolled cards meet the tabs (no hard cut through a drawing)
    const fk = this.tex("village-drawer-fade", W, 12, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 12);
      gr.addColorStop(0, PAPER);
      gr.addColorStop(1, "rgba(255,243,222,0)");
      g.fillStyle = gr;
      g.fillRect(0, 0, W, 12);
    });
    this.fadeImg ??= this.add.image(0, 0, fk).setOrigin(0, 0);
    this.show(this.fadeImg, fk, 0, winY);
    this.fadeImg.setVisible(this.gridScroll > 0);
    this.children.bringToTop(this.fadeImg);

    // hits (the drawer is modal: only its own)
    this.hits.push({ id: "drawer-close", x: W - side - 40, y: dy + 4, w: 48, h: 44, label: vt(lang, "close"), act: () => this.closeDrawer() });
    tabs.forEach((t, i) => {
      this.hits.push({ id: `tab-${t.id}`, x: side + i * (tabW + gap), y: dy + titleH - 2, w: tabW, h: TAB_H + 4, pressed: t.id === d.tab, label: vt(lang, "drawerTab", { tab: tabName(lang, t.id) }), act: () => this.setTab(t.id) });
    });
    if (occupied) {
      const ay = dy + titleH + tabsH + 4;
      const aw = (W - 2 * side - gap) / 2;
      this.hits.push({ id: "slot-takeout", x: side, y: ay, w: aw, h: 40, label: vt(lang, "takeOut"), act: () => this.takeOut() });
      this.hits.push({ id: "slot-turn", x: side + aw + gap, y: ay, w: aw, h: 40, label: vt(lang, "turn"), act: () => this.turn() });
    }
    list.forEach((c, i) => {
      const cx0 = x0 + (i % cols) * (cw + gap);
      const cy0 = winY + Math.floor(i / cols) * (ch + gap);
      const sel = d.cw[c.item.id] ?? c.cws.find((x) => x.owned)?.cw ?? c.cws[0]!.cw;
      const cur = c.cws.find((x) => x.cw === sel)!;
      const name = itemName(lang, c.item.id);
      const cwName = vt(lang, `cw.${sel}` as "cw.cream");
      const src = cur.source.kind === "resident" ? vt(lang, "fromResident", { name: residentName(lang, cur.source.id) }) : vt(lang, "fromJar");
      const base = !cur.owned ? vt(lang, "locked", { item: name, cw: cwName, source: src }) : cur.placed ? vt(lang, "pickPlaced", { item: name, cw: cwName }) : vt(lang, "pick", { item: name, cw: cwName });
      const set = c.unlocked ? setOfItem(c.item.id) : undefined;
      const label = set ? `${base}. ${cozyText(lang, "setOf", { name: residentName(lang, set.r), have: setProgress(this.room).get(set.r) ?? 0 })}` : base;
      this.hits.push({ id: `card-${c.item.id}`, x: cx0, y: cy0, w: cw, h: ch - 22, label, grid: true, act: () => this.pickCard(c.item.id, sel, cur.owned) });
      if (c.unlocked) {
        const dy0 = dotRowY(cy0, cw, ch, fitCardName(name, W, meas, lang)) - 11;
        c.cws.forEach((x, k) => {
          const dx = cx0 + cw / 2 + (k - (c.cws.length - 1) / 2) * 16;
          this.hits.push({ id: `cw-${c.item.id}-${x.cw}`, x: dx - 8, y: dy0, w: 16, h: 22, grid: true, pressed: x.cw === sel, label: `${name}, ${vt(lang, `cw.${x.cw}` as "cw.cream")}`, act: () => this.pickCw(c.item.id, x.cw) });
        });
      }
    });
  }

  private gridImg: PhaserTypes.GameObjects.Image | null = null;
  private fadeImg: PhaserTypes.GameObjects.Image | null = null;
  /** tests: what each drawer card shows (name lines, the "how to get it" lines of a locked card) */
  private drawerDrawn: Array<{ id: string; name: string[]; src: string[] }> = [];
  private applyGridCrop(): void {
    const img = this.gridImg;
    if (!img) return;
    const q = this.q;
    img.setCrop(0, this.gridScroll * q, img.width, this.gridWin.h * q);
    img.setY((this.gridWin.y - this.gridScroll) * this.u);
    this.fadeImg?.setVisible(this.gridScroll > 0.5);
  }
  private drawerCardsFor(tabId: string): ReturnType<typeof cards> {
    const d = this.drawer!;
    const keep = d.tab;
    d.tab = tabId;
    const out = this.drawerCards();
    d.tab = keep;
    return out;
  }

  private setTab(id: string): void {
    if (!this.drawer) return;
    this.drawer.tab = id;
    this.gridScroll = 0;
    this.render();
  }
  private pickCw(item: ItemId, cw: Colorway): void {
    if (!this.drawer) return;
    this.drawer.cw[item] = cw;
    this.render();
  }
  private pickCard(item: ItemId, cw: Colorway, ownedIt: boolean): void {
    const d = this.drawer;
    if (!d) return;
    const lang = this.d.lang;
    if (!ownedIt) {
      const bit = pieceBit({ item, cw });
      const card = cards(this.ownedNow(), this.room).find((c) => c.item.id === item)!.cws.find((x) => x.bit === bit)!;
      a11y.announce(vt(lang, "locked", { item: itemName(lang, item), cw: vt(lang, `cw.${cw}` as "cw.cream"), source: card.source.kind === "resident" ? vt(lang, "fromResident", { name: residentName(lang, card.source.id) }) : vt(lang, "fromJar") }));
      return;
    }
    const bit = pieceBit({ item, cw });
    const it = itemById(item)!;
    const slot = it.layer === "rug" ? 0 : d.slot === FLOOR_SLOTS ? -1 : d.slot;
    if (slot < 0) return;
    const next = place(this.room, slot, bit);
    if (!next) {
      cue("tap");
      return;
    }
    haptic.place();
    this.commitRoom(next, bit);
    this.highlight = it.layer === "rug" ? FLOOR_SLOTS : slot;
    this.drawer = null;
    a11y.announce(vt(lang, "placed", { item: itemName(lang, item) }));
    this.log(`place ${item}:${cw} → ${slot}`);
    this.render();
  }
  private takeOut(): void {
    const d = this.drawer;
    if (!d) return;
    const next = d.slot === FLOOR_SLOTS ? { ...this.room, rug: null } : removeAt(this.room, d.slot);
    this.commitRoom(next, -1);
    this.drawer = null;
    this.render();
  }
  private turn(): void {
    const d = this.drawer;
    if (!d) return;
    const next: RoomLayout = { ...this.room, slots: this.room.slots.map((p) => (p ? { ...p } : null)), rug: this.room.rug ? { ...this.room.rug } : null };
    const p = d.slot === FLOOR_SLOTS ? next.rug : next.slots[d.slot];
    if (p) p.flip = !p.flip;
    this.commitRoom(next, -1);
    this.render();
  }

  /** Save the room (per-room LWW stamp: Lamport n + monotonic at — vstate.roomStamp). */
  private commitRoom(next: RoomLayout, placedBit: number): void {
    const setsBefore = new Set(setsDone(this.room).map((x) => x.r));
    this.room = next;
    const s = encodeRoom(next);
    const dev = roomDev(this.d.dev);
    const apply = (x: VillageSave): void => {
      const prev = x.sv.r[COTTAGE];
      if (prev?.s === s) return;
      x.sv.r[COTTAGE] = { s, ...roomStamp(prev, Date.now()), dev };
      if (placedBit >= 0) x.loc.fresh = x.loc.fresh.filter((b) => b !== placedBit);
    };
    apply(this.d.save);
    void updateVillage(apply);
    this.checkRequests();
    // R4 C: a set just completed — its resident comes over (drawn as a visitor) and says its visit line
    const fresh = setsDone(next).find((x) => !setsBefore.has(x.r));
    if (fresh) {
      const lang = this.d.lang;
      const text = cozyText(lang, "setDone", { name: residentName(lang, fresh.r) });
      this.roomToast = { text, until: performance.now() + 3600 };
      this.time.delayedCall(3700, () => this.render());
      a11y.announce(text);
      const v = pickVisit(this.d.lines.lines, fresh.r);
      if (v) this.showSpeaker(fresh.r, v);
      cue("nearComplete");
      this.log(`set done ${fresh.r}`);
    }
    // R4: a new cozy level opens the rewards panel on its moment
    const up = Math.max(0, ...this.syncUnlocks().filter((b) => b >= 1 && b <= 5));
    if (up > 0) {
      this.cozyOpen = true;
      this.cozyUp = up;
      this.cozyMsg = "";
      cue("nearComplete");
      haptic.success();
    }
  }

  /**
   * An open request whose category is now in the cottage is fulfilled (synced bit 2·id+1): that resident
   * comes to visit (drawn in the room) and says its visit line; the thank-you letter is in the mailbox.
   */
  private checkRequests(): void {
    const done = fulfilled(this.d.save.sv, this.room);
    if (!done.length) return;
    const apply = (x: VillageSave): void => {
      x.sv.q = normBits([...x.sv.q, ...done.map((q) => 2 * q.id + 1)]);
    };
    apply(this.d.save);
    void updateVillage(apply);
    const v = pickVisit(this.d.lines.lines, done[0]!.r);
    if (v) this.showSpeaker(done[0]!.r, v);
    this.log(`request done ${done.map((q) => q.id).join(",")}`);
  }

  /** A resident's line on the card (visitors in the cottage). */
  private showSpeaker(who: ResidentId, p: Pick): void {
    const text = this.d.lines.text(p.line);
    this.card = { who, line: p.line, text, fit: this.fitLine(text) };
    a11y.announce(vt(this.d.lang, "card", { name: residentName(this.d.lang, who), line: text }));
  }

  // ------------------------------------------------------------------ input / a11y

  /** a drag inside the drawer's card window scrolls the grid */
  private drag: { y0: number; s0: number; moved: boolean } | null = null;
  private onDown(x: number, y: number): void {
    void x;
    const w = this.gridWin;
    this.drag = this.drawer && w.content > w.h && y >= w.y && y <= w.y + w.h ? { y0: y, s0: this.gridScroll, moved: false } : null;
  }
  private onDrag(y: number): void {
    const d = this.drag;
    if (!d) return;
    if (!d.moved && Math.abs(y - d.y0) < 6) return;
    d.moved = true;
    this.gridScroll = Math.max(0, Math.min(this.gridWin.content - this.gridWin.h, d.s0 - (y - d.y0)));
    this.applyGridCrop();
  }
  /** a hit box where it is on screen now (grid cards move with the scroll), or null when scrolled out */
  private hitRect(h: Hit): { x: number; y: number; w: number; h: number } | null {
    if (!h.grid) return h;
    const y = h.y - this.gridScroll;
    const w = this.gridWin;
    return y + h.h < w.y || y > w.y + w.h ? null : { x: h.x, y, w: h.w, h: h.h };
  }

  private onTap(x: number, y: number): void {
    if (this.closed) return;
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const h0 = this.hits[i]!;
      const h = this.hitRect(h0);
      if (!h) continue;
      if (h0.grid && (y < this.gridWin.y || y > this.gridWin.y + this.gridWin.h)) continue;
      if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) {
        h0.act();
        return;
      }
    }
    // a tap on nothing: the drawer / card closes
    if (this.drawer && y < this.H - (this.drawerImg.displayHeight / this.u)) this.closeDrawer();
    else if (this.card) {
      this.card = null;
      this.render();
    }
  }

  private pushA11y(): void {
    // grid cards scrolled out of the window are still listed (VoiceOver reaches every card), at the window's edge
    const ctl: A11yControl[] = this.hits.map((h) => {
      const r = this.hitRect(h) ?? { x: h.x, y: Math.min(Math.max(h.y - this.gridScroll, this.gridWin.y), this.gridWin.y + this.gridWin.h - 4), w: h.w, h: 4 };
      return { id: `village-${h.id}`, label: h.label, x: r.x, y: r.y, w: r.w, h: r.h, ...(h.pressed !== undefined ? { pressed: h.pressed } : {}), onActivate: () => h.act() };
    });
    a11y.setControls("village", ctl);
  }

  // ------------------------------------------------------------------ ambient motion

  /** One bake step a frame while the houses are still coming; the whole village when the last one lands. */
  private stepBake(): void {
    const job = this.bakeLeft;
    if (!job || !this.shown) return; // the first frame (sky and ground) goes out before any more baking
    if (bgCache?.sig !== job.sig && bake !== job) {
      this.render(); // another look of the backdrop is wanted (a resize): start over
      return;
    }
    // as many steps as fit a ~100 ms frame budget (a visit waiting for its houses, not a game frame: every frame drawn in between is a full-screen blit)
    const t0 = performance.now();
    let more = true;
    while (more && performance.now() - t0 < 100) more = bakeStep(job);
    if (more) {
      const t = this.textures.get("village-bg") as PhaserTypes.Textures.CanvasTexture;
      const g = t.getContext();
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(job.canvas, 0, 0);
      g.restore();
      t.refresh();
      return;
    }
    this.render();
    this.readyMs = Math.round(performance.now() - this.L.t0);
    console.info(`[village] ready ${this.readyMs} ms (bake steps ms ${JSON.stringify(bakeMs)})`);
    if (this.bakeLeft || reduced()) return;
    // the neighbors come in softly (they were hidden while the ground was bare)
    const folk = [...this.res.map((r) => r.img), ...this.bubbles.values(), this.mailImg, ...(this.stallImg ? [this.stallImg] : [])].filter((o) => o.visible);
    for (const o of folk) o.setAlpha(0);
    this.tweens.add({ targets: folk, alpha: 1, duration: OPEN_MS, ease: "Sine.easeOut" });
  }
  /** tap → the village is complete and live (houses, neighbors, hit boxes), for the perf notes */
  readyMs = 0;

  override update(time: number): void {
    if (this.closed) return;
    if (this.bakeLeft) this.stepBake();
    if (reduced() || this.screenNow !== "village") return;
    // residents breathe (ambient(): the governor keeps 20 fps for this)
    for (const s of this.res) {
      if (!s.img.visible) continue;
      const bob = Math.sin(time / 900 + s.phase) * 1.4;
      s.img.setY((s.y + bob) * this.u);
    }
  }

  // ------------------------------------------------------------------ close

  private close(): void {
    cue("tap");
    this.finish();
  }

  private finish(): void {
    if (this.closed) return;
    this.closed = true;
    const l = this.L;
    this.unsub?.();
    this.scale.off("resize", this.onResize, this);
    a11y.setControls("village", []);
    const h = l.host;
    if (!h.sys.settings.visible) h.sys.setVisible(true);
    const game = this.sys.game;
    const keys = [...this.keys];
    this.scene.setVisible(false);
    // the closing tap must not reach the board: input back on the next frame
    requestAnimationFrame(() => {
      h.input.enabled = this.hostInput;
      game.scene.remove(VILLAGE_KEY);
      for (const k of keys) if (game.textures.exists(k)) game.textures.remove(k);
      l.onClose();
    });
  }

  // ------------------------------------------------------------------ tests

  private log(s: string): void {
    this.stateLog.push(s);
    if (this.stateLog.length > 50) this.stateLog.shift();
  }

  /** Tests: what is on screen. */
  get view(): {
    screen: Screen; card: { who: string; lines: string[]; size: number; id: string } | null; unread: number; drawer: { slot: number; cards: string[]; drawn: Array<{ id: string; name: string[]; src: string[] }> } | null;
    room: Array<string | null>; rug: string | null; owned: string[]; residents: string[]; log: string[]; openMs: number;
  } {
    const name = (bit: number): string => {
      const p = pieceOfBit(bit)!;
      return `${p.item}:${p.cw}`;
    };
    return {
      screen: this.screenNow,
      card: this.card ? { who: this.card.who, lines: this.card.fit.lines, size: this.card.fit.size, id: this.card.line.id } : null,
      unread: this.unread().length + (this.d.save.loc.ret && !this.d.save.loc.ret.read ? 1 : 0),
      drawer: this.drawer ? { slot: this.drawer.slot, cards: this.drawerCards().map((c) => c.item.id), drawn: this.drawerDrawn } : null,
      room: this.room.slots.map((p) => (p ? name(p.bit) : null)),
      rug: this.room.rug ? name(this.room.rug.bit) : null,
      owned: [...this.ownedNow()].map(name).sort(),
      residents: this.residentsNow().filter((r) => r.movedIn).map((r) => r.r.id),
      log: this.stateLog.slice(),
      openMs: this.openMs,
    };
  }
  /** Tests: canvas-px centre of a hit box (null when not on screen). */
  hitPoint(id: string): { x: number; y: number } | null {
    const h0 = this.hits.find((x) => x.id === id);
    const h = h0 ? this.hitRect(h0) : null;
    return h ? { x: (h.x + h.w / 2) * this.u, y: (h.y + Math.min(h.h, 40) / 2) * this.u } : null;
  }
  /** Tests: every hit box id + label (VoiceOver list). */
  get hitList(): Array<{ id: string; label: string }> {
    return this.hits.map((h) => ({ id: h.id, label: h.label }));
  }
}

// ---------------------------------------------------------------- backdrop layer (cached)

interface HouseSlot {
  who: ResidentId | "cottage";
  cx: number;
  by: number;
  w: number;
  h: number;
}

/** House plots: the kit's layout (matches its paths) or an even 3 + 3 fallback. */
function houseSlotsFor(art: VillageArt, W: number, H: number, top: number, bottom: number): HouseSlot[] {
  const lay = art.villageLayout?.({ x: 0, y: 0, w: W, h: H });
  if (lay) {
    // every plot the kit lays out (8: the cottage + 7 residents), far ones first so near ones overlap them
    return (Object.keys(lay.houses) as Array<ResidentId | "cottage">)
      .map((who) => {
        const b = lay.houses[who];
        return { who, cx: b.x + b.w / 2, by: b.y + b.h, w: b.w, h: b.h };
      })
      .sort((a, b) => a.by - b.by);
  }
  const span = bottom - top;
  const back = top + span * 0.47;
  const front = top + span * 0.67;
  const wb = Math.min(W * 0.26, 150);
  const wf = Math.min(W * 0.3, 170);
  return [
    { who: "sage", cx: W * 0.2, by: back, w: wb, h: wb * 1.15 },
    { who: "luna", cx: W * 0.5, by: back, w: wb, h: wb * 1.15 },
    { who: "pip", cx: W * 0.8, by: back, w: wb, h: wb * 1.15 },
    { who: "cottage", cx: W * 0.2, by: front, w: wf, h: wf * 1.15 },
    { who: "wick", cx: W * 0.5, by: front, w: wf, h: wf * 1.15 },
    { who: "momo", cx: W * 0.8, by: front, w: wf, h: wf * 1.15 },
    { who: "kuri", cx: W * 0.35, by: back - span * 0.08, w: wb * 0.8, h: wb * 0.92 },
    { who: "yuki", cx: W * 0.65, by: back - span * 0.08, w: wb * 0.8, h: wb * 0.92 },
  ].sort((a, b) => a.by - b.by) as HouseSlot[];
}

/** The device's region (hemisphere): its first preferred language tag, else the formatter's locale. */
export function deviceRegion(): string | null {
  const tags = [...(typeof navigator !== "undefined" ? navigator.languages ?? [navigator.language] : []), Intl.DateTimeFormat().resolvedOptions().locale];
  for (const t of tags) {
    const r = regionOf(t);
    if (r) return r;
  }
  return null;
}
/** The hour's light and the season now (device clock, device region's hemisphere). */
export function environmentNow(d: Date = new Date()): Environment & { hemisphere: Hemisphere; month: number } {
  const hemisphere = hemisphereOf(deviceRegion());
  const month = d.getMonth() + 1;
  return { time: timeBandOf(d.getHours()), season: seasonOf(month, hemisphere), hemisphere, month };
}

/** the backdrop (the kit's draw steps when it has them, else its one call), then each house: one step = one forced raster */
function bgSteps(g: CanvasRenderingContext2D, art: VillageArt, W: number, H: number, houses: readonly HouseSlot[], moved: ReadonlySet<ResidentId>, eveId: ResidentId | null, env: Environment): Array<() => void> {
  art.setEnvironment?.(env);
  const box = { x: 0, y: 0, w: W, h: H };
  let backdrop: Array<() => void>;
  try {
    backdrop = art.drawVillageBackdropSteps ? art.drawVillageBackdropSteps(g, box) : [() => art.drawVillageBackdrop(g, box)];
  } catch (e) {
    console.warn("[village] art backdrop steps fell back", e);
    backdrop = [() => placeholderArt.drawVillageBackdrop(g, box)];
  }
  let dead = false; // a kit step threw: the rest of the kit's backdrop is skipped, the placeholder's one call closes it
  const last = backdrop.length - 1;
  const kit = backdrop.map((f, k) => (): void => {
    if (!dead) {
      try {
        f();
      } catch (e) {
        console.warn("[village] art backdrop step fell back", e);
        dead = true;
      }
    }
    if (dead && k === last) placeholderArt.drawVillageBackdrop(g, box);
  });
  return [
    ...kit,
    ...houses.map((h, i) => () => {
      const lit = h.who === "cottage" || moved.has(h.who);
      const spec = { resident: h.who === "cottage" ? ("cottage" as const) : lit ? h.who : null, lit, eve: eveId === h.who, seed: i * 7 + 3 };
      art.drawLanternHouse(g, spec, { x: h.cx - h.w / 2, y: h.by - h.h, w: h.w, h: h.h });
    }),
  ];
}
function paintVillageBg(g: CanvasRenderingContext2D, art: VillageArt, W: number, H: number, houses: readonly HouseSlot[], moved: ReadonlySet<ResidentId>, eveId: ResidentId | null, env: Environment): void {
  for (const step of bgSteps(g, art, W, H, houses, moved, eveId, env)) step();
}

const bgSig = (W: number, H: number, q: number, moved: ReadonlySet<ResidentId>, eveId: string | null, env: Environment): string =>
  `${W}x${H}@${q}|${[...moved].sort().join(",")}|${eveId ?? ""}|${env.time}|${env.season}`;
/** one rasterized backdrop (≈ 5 MB at 393 × 852 @2x), replaced when the size or the houses change */
let bgCache: { sig: string; canvas: HTMLCanvasElement } | null = null;

/** A backdrop bake in progress: resumable (prewarm slices it while idle), finished by the open if the player came early. */
interface Bake {
  sig: string;
  canvas: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  steps: Array<() => void>;
  i: number;
}
let bake: Bake | null = null;
/** ms of each bake step (the slices; perf notes / tests) */
export const bakeMs: number[] = [];

/** The job for this look of the backdrop: null when it is already baked (or no canvas), the running one if it is the same look. */
function bakeJob(art: VillageArt, sig: string, W: number, H: number, q: number, houses: readonly HouseSlot[], moved: ReadonlySet<ResidentId>, eveId: ResidentId | null, env: Environment): Bake | null {
  if (bgCache?.sig === sig) return null;
  if (bake?.sig === sig) return bake;
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(W * q);
  canvas.height = Math.ceil(H * q);
  const g = canvas.getContext("2d");
  if (!g) return null;
  g.fillStyle = "#171A31"; // the night ground under the bands still to come (never a hole)
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.setTransform(q, 0, 0, q, 0, 0);
  bake = { sig, canvas, g, steps: bgSteps(g, art, W, H, houses, moved, eveId, env), i: 0 };
  return bake;
}
/** Run the next step and force its raster (a 1 px read). True while steps remain; the last one caches the backdrop. */
function bakeStep(b: Bake): boolean {
  if (b.i >= b.steps.length) return false;
  const t0 = performance.now();
  b.steps[b.i++]!();
  b.g.getImageData(0, 0, 1, 1);
  bakeMs.push(Math.round((performance.now() - t0) * 10) / 10);
  if (b.i < b.steps.length) return true;
  bgCache = { sig: b.sig, canvas: b.canvas };
  if (bake === b) bake = null;
  return false;
}
const idleSlot = (): Promise<void> =>
  new Promise((r) => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(() => r(), { timeout: 1000 });
    else setTimeout(r, 0);
  });

/**
 * Bake the backdrop ahead, one step at a time, each in its own browser-idle slot and only while `idle()`
 * still holds (any input / motion stops it at the next step; the job is kept). True = nothing left to do.
 */
async function prebakeBg(art: VillageArt, p: Progress, save: VillageSave, idle: () => boolean): Promise<boolean> {
  if (typeof document === "undefined") return true;
  const u = Math.min(window.devicePixelRatio || 1, 3);
  const q = Math.min(u, 2);
  const app = document.getElementById("app");
  const W = (app?.clientWidth ?? window.innerWidth) || 0;
  const H = (app?.clientHeight ?? window.innerHeight) || 0;
  if (!W || !H) return true;
  const s = safeInsets();
  const inp: VillageInput = { cleared: p.cleared, dailyDates: p.dailyDates, v: save.sv, today: p.today };
  const moved = new Set(residents(inp).filter((r) => r.movedIn).map((r) => r.r.id));
  const nextIn = eve(inp)?.id ?? null;
  const env = environmentNow();
  const job = bakeJob(art, bgSig(W, H, q, moved, nextIn, env), W, H, q, houseSlotsFor(art, W, H, s.top, H - s.bottom), moved, nextIn, env);
  while (job && bake === job) {
    if (!idle()) return false;
    await idleSlot();
    if (!idle()) return false;
    if (bake !== job) break; // the open finished it meanwhile
    if (!bakeStep(job)) break;
  }
  return true;
}

type Progress = { cleared: { gentle: number; deduce: number }; dailyDates: string[]; today: string; hardToday?: boolean };
/** what prewarm / the last open resolved (lines per language, the art, the save, the device id) */
const ready: { lines: Map<string, LineSet>; fonts: Map<string, string | null>; art: VillageArt | null; save: VillageSave | null; dev: string | null } = { lines: new Map(), fonts: new Map(), art: null, save: null, dev: null };

const data = (p: Progress, lang: Lang, save: VillageSave, dev: string, lines: LineSet, art: VillageArt, letterFont: string | null): VillageData =>
  ({ inp: { cleared: p.cleared, dailyDates: p.dailyDates, v: save.sv, today: p.today, ...(p.hardToday ? { hardToday: true } : {}) }, save, lines, art, lang, dev, letterFont });

/** the letter's handwriting stack for a language (loads the subset face; null without the kit) */
async function letterFont(art: VillageArt, lang: Lang): Promise<string | null> {
  if (ready.fonts.has(lang)) return ready.fonts.get(lang) ?? null;
  const f = art.loadVillageFont ? await art.loadVillageFont(lang, "letter").catch(() => null) : null;
  ready.fonts.set(lang, f);
  return f;
}

/** Load everything the village needs (store, lines, art) — the scene builds synchronously. */
/** ms each part of the data phase took in the last cold open (perf notes) */
export const dataMs: Record<string, number> = {};
const timed = <T>(k: string, p: Promise<T>): Promise<T> => {
  const t0 = performance.now();
  return p.finally(() => (dataMs[k] = Math.round(performance.now() - t0)));
};
export async function prepareVillage(p: Progress, lang: Lang): Promise<VillageData> {
  const [save, dev, lines, art] = await Promise.all([timed("save", loadVillage()), timed("dev", deviceId()), timed("lines", loadLines(lang)), timed("art", loadArt())]);
  ready.lines.set(lang, lines);
  ready.art = art;
  ready.dev = dev;
  return data(p, lang, save, dev, lines, art, await timed("font", letterFont(art, lang)));
}

/** The data right now when everything is warm (no await), else null. */
export function prepareNow(p: Progress, lang: Lang): VillageData | null {
  const lines = ready.lines.get(lang);
  const save = peekVillage();
  return lines && ready.art && ready.dev && save && ready.fonts.has(lang) ? data(p, lang, save, ready.dev, lines, ready.art, ready.fonts.get(lang) ?? null) : null;
}

/** Everything an open needs is in memory and the backdrop is baked: the open only blits (no veil needed). */
export function isWarm(lang: Lang): boolean {
  return !!(ready.lines.has(lang) && ready.art && ready.dev && peekVillage() && ready.fonts.has(lang) && bgCache && !bake);
}

/**
 * Warm the caches prepareVillage reads (lines JSON, art kit chunk, the save, the device id), then bake the
 * backdrop in small idle steps. True = all done; false = stopped by input (call again at the next idle moment).
 */
export async function prewarm(lang: Lang, p?: Progress, idle: () => boolean = () => true): Promise<boolean> {
  if (!idle()) return false;
  const [lines, art, save, dev] = await Promise.all([loadLines(lang), loadArt(), loadVillage(), deviceId()]);
  ready.lines.set(lang, lines);
  ready.art = art;
  ready.dev = dev;
  await letterFont(art, lang);
  return p ? prebakeBg(art, p, save, idle) : true;
}

/** This device's sync id (the room records' tie-break), or a village-local one before sync made it. */
async function deviceId(): Promise<string> {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    const r = await Preferences.get({ key: "sync" });
    const m = r.value ? (JSON.parse(r.value) as { dev?: string }) : null;
    if (m?.dev && /^[a-z0-9]{8,32}$/.test(m.dev)) return m.dev;
    const own = await Preferences.get({ key: "villageDev" });
    if (own.value && /^[a-z0-9]{8,32}$/.test(own.value)) return own.value;
    const b = new Uint8Array(12);
    globalThis.crypto.getRandomValues(b);
    const id = [...b].map((x) => (x % 36).toString(36)).join("");
    await Preferences.set({ key: "villageDev", value: id });
    return id;
  } catch {
    return "local000";
  }
}

export function launchVillage(l: VillageLaunch): void {
  const game = l.host.sys.game;
  if (game.scene.keys[VILLAGE_KEY]) {
    console.warn("[village] a stale village scene was replaced");
    game.scene.remove(VILLAGE_KEY);
  }
  game.scene.add(VILLAGE_KEY, new VillageScene(), true, l);
}

// re-exported for the scene's own unit checks
export { COLORWAYS, RESIDENTS };
