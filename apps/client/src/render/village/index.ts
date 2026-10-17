// The village art kit's entry (docs/team/village-contract.md): `villageArt` implements the contract's
// VillageArt (src/village/art.ts is the canonical interface; it loads THIS module lazily — the village
// chunk only). Pure drawing: same inputs, same pixels; variation from `seed`.
import { drawFurnitureAt, FURNITURE_IDS, furnitureScale, ITEMS, type Colorway, type ItemId } from "./furniture.ts";
import { drawLanternHouse, LANTERN_THEMES, LH_EXTENT, LH_MAIN, LH_SMALL, type LanternTheme, type LanternWindow, type ResidentId } from "./lanternHouse.ts";
import { drawMailboxAt, drawVillageBackdrop } from "./nature.ts";
import { drawResidentAt, drawResidentPortrait, residentFit, RESIDENT_BOX, type ResidentExpr } from "./residents.ts";
import { drawCottageOutside, drawRoomGuests, drawRoomShell } from "./room.ts";
import { drawGiftStage, drawLetterSender, drawLetterStage, type GiftStageOpts, type LetterStageOpts } from "./stage.ts";
import { hexA, mix, setPxPerPt, T, type Box } from "./shade.ts";
import { drawTimeWash, SEASONS, TIMES, type Season, type TimeOfDay } from "./atmos.ts";
import { drawMarketStall, drawPostcardFrame, drawRequestBubble, REQUEST_CATEGORIES, type RequestCategory } from "./extras.ts";

type G = CanvasRenderingContext2D;
/** round 3: the environment the scene set (setEnvironment); explicit options win */
let ENV: { time: TimeOfDay; season: Season } = { time: "dusk", season: "summer" };
interface HouseSpecV {
  resident: ResidentId | "cottage" | null;
  lit: boolean;
  eve: boolean;
  seed: number;
  /** round 3: winter puts a snow cap on the lid */
  season?: Season;
}

/** Device px per pt for the OUTLINE rule: the scene bakes at ≤ 2× (contract §4). */
function unitFrom(g: G): void {
  const m = g.getTransform();
  setPxPerPt(Math.max(1, Math.min(3, Math.hypot(m.a, m.b))));
}
/** The OUTLINE rule wants px per pt; drawing coordinates are canvas px already scaled by the caller. */
function withUnit<T>(g: G, fn: () => T): T {
  unitFrom(g);
  // canvas px == pt × scale: userScale() divides by px-per-pt, so 1 user unit == 1 pt at scale 1
  return fn();
}

const EMPTY: LanternTheme = { paper: "#D9CCC0", paperLo: "#A8988E", roof: "#7D7092", door: "#4E4060", flower: T.lilac };
/** the player's cottage: terracotta, like the room's lid (room.ts ROOF) */
const COTTAGE: LanternTheme = { paper: "#FFEBD0", paperLo: "#E9BE8C", roof: "#B97A62", door: "#7A5240", flower: T.pink };
const SEED_FLOWERS = [T.pink, T.lilac, T.lemon, T.coral, T.mint];

function drawHouseV(g: G, spec: HouseSpecV, at: Box): void {
  withUnit(g, () => {
    const base = spec.resident === null ? EMPTY : spec.resident === "cottage" ? COTTAGE : LANTERN_THEMES[spec.resident];
    const theme: LanternTheme = { ...base, flower: SEED_FLOWERS[Math.abs(spec.seed) % SEED_FLOWERS.length]! };
    const small = (spec.seed >>> 3) % 3;
    const windows: LanternWindow[] = [...LH_MAIN, ...(small === 1 ? [LH_SMALL[0]!] : small === 2 ? [LH_SMALL[1]!] : [])];
    const s = Math.min(at.w / (LH_EXTENT.left + LH_EXTENT.right), at.h / LH_EXTENT.top);
    g.save();
    drawLanternHouse(g, at.x + at.w / 2, at.y + at.h, s, {
      theme,
      windows,
      dark: spec.lit ? [] : windows.map((_, i) => i).filter((i) => !(spec.eve && i === 0)),
      heart: spec.lit ? "lit" : "dark",
      dim: spec.lit ? 0 : 0.55,
      doorLantern: spec.lit,
      groundGlow: spec.lit,
      snow: (spec.season ?? ENV.season) === "winter",
    });
    if (spec.eve) {
      // tomorrow's resident: a plum silhouette in the left window, lit from behind
      const w = windows[0]!;
      const cx = at.x + at.w / 2 + w.x * s;
      const cy = at.y + at.h + w.y * s;
      g.save();
      g.beginPath();
      g.arc(cx, cy, w.r * s * 0.98, 0, Math.PI * 2);
      g.clip();
      drawResidentAt(g, spec.resident && spec.resident !== "cottage" ? spec.resident : "sage", "silhouette", cx, cy + w.r * s * 1.05, w.r * s * 2.3, { glow: false, shadow: false });
      g.restore();
    }
    g.restore();
  });
}

function drawResidentV(g: G, id: ResidentId, expr: ResidentExpr, at: Box): void {
  withUnit(g, () => {
    const size = residentFit(at.w, at.h);
    const gy = at.y + at.h - ((RESIDENT_BOX.y1 - 92) / 100) * size;
    drawResidentAt(g, id, expr, at.x + at.w / 2, gy, size);
  });
}

/** Locked card (G8): the item's OWN drawing as a plum-grey silhouette (offscreen, then tinted). */
function drawLocked(g: G, id: ItemId, cw: Colorway, at: Box, s: number): void {
  const m = g.getTransform();
  const sc = Math.max(1, Math.hypot(m.a, m.b));
  const pad = Math.ceil(Math.min(at.w, at.h) * 0.12);
  const W = Math.ceil((at.w + pad * 2) * sc);
  const H = Math.ceil((at.h + pad * 2) * sc);
  const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(W, H) : Object.assign(document.createElement("canvas"), { width: W, height: H });
  const x = c.getContext("2d") as G | null;
  if (!x) return;
  x.setTransform(sc, 0, 0, sc, (pad - at.x) * sc, (pad - at.y) * sc);
  drawFurnitureAt(x, id, cw, at.x + at.w / 2, at.y + at.h, s, true);
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalCompositeOperation = "source-in";
  x.fillStyle = "#6A5F82";
  x.fillRect(0, 0, W, H);
  // a soft top-left light on the silhouette so it still reads as an object, not a hole
  x.globalCompositeOperation = "source-atop";
  const gr = x.createLinearGradient(0, 0, W, H);
  gr.addColorStop(0, hexA("#B8ACCF", 0.35));
  gr.addColorStop(0.6, hexA("#B8ACCF", 0));
  x.fillStyle = gr;
  x.fillRect(0, 0, W, H);
  g.drawImage(c as CanvasImageSource, at.x - pad, at.y - pad, at.w + pad * 2, at.h + pad * 2);
}

/**
 * opts.fit: "room" (default) = the room's common scale (a teapot stays smaller than a bookshelf);
 * "card" = fill the drawer card's art box (every item reads at 64 pt). Never crosses the box (Reality #9).
 */
function drawFurnitureV(g: G, itemId: ItemId, colorway: Colorway, at: Box, opts?: { locked?: boolean; fit?: "room" | "card" }): void {
  if (!ITEMS[itemId]) return;
  withUnit(g, () => {
    const s = furnitureScale(itemId, at.w, at.h, opts?.fit ?? "room");
    if (opts?.locked) drawLocked(g, itemId, colorway, at, s);
    else drawFurnitureAt(g, itemId, colorway, at.x + at.w / 2, at.y + at.h, s);
  });
}

export const villageArt = {
  drawLanternHouse: drawHouseV,
  drawResident: drawResidentV,
  drawFurniture: drawFurnitureV,
  drawVillageBackdrop: (g: G, at: Box, o?: { time?: TimeOfDay; season?: Season }): void => withUnit(g, () => drawVillageBackdrop(g, at, { ...ENV, ...o })),
  drawRoom: (g: G, at: Box, spec: { wallpaper: number; floor: number; time?: TimeOfDay; season?: Season }): void => withUnit(g, () => drawRoomShell(g, at, { ...ENV, ...spec })),
  // ---- round 3 (full village), the contract's §7 signatures (src/village/art.ts)
  /** the hour + season the next bakes use (the scene sets it before baking) */
  setEnvironment: (env: { time: TimeOfDay; season: Season }): void => {
    ENV = { time: env.time, season: env.season };
  },
  /** the time's colour over a finished layer (the houses layer: dawn rose / day lift / night blue) */
  drawTimeWash: (g: G, at: Box, time?: TimeOfDay): void => drawTimeWash(g, at, time ?? ENV.time),
  /** the stall; open = its lantern lit. Returns the 3 pedestal boxes for the day's pieces + the sign box */
  drawMarketStall: (g: G, at: Box, open = true) => withUnit(g, () => drawMarketStall(g, at, open)),
  /** a request bubble whose tail touches (cx, by) — a resident's head top (residentHead) */
  drawRequestBubble: (g: G, cx: number, by: number, r: number, cat: RequestCategory, fresh?: boolean): void => withUnit(g, () => drawRequestBubble(g, cx, by, r, cat, fresh)),
  /** the postcard frame filling `at` (1080 × 1350 design): the room picture goes in `picture` */
  drawPostcardFrame: (g: G, at: Box): { picture: Box; stamp: Box; caption: Box } =>
    withUnit(g, () => {
      g.save();
      g.translate(at.x, at.y);
      const r = drawPostcardFrame(g, at.w, at.h);
      g.restore();
      const off = (b: Box): Box => ({ x: b.x + at.x, y: b.y + at.y, w: b.w, h: b.h });
      return { picture: off(r.room), stamp: off(r.stamp), caption: off(r.caption) };
    }),
  drawMailbox: (g: G, at: Box, flag: boolean): void =>
    withUnit(g, () => {
      const s = Math.min(at.w / 30, at.h / 42);
      drawMailboxAt(g, at.x + at.w / 2 - 4 * s, at.y + at.h, s, flag);
    }),
  furnitureIds: FURNITURE_IDS,
  // v15 (Reality G1): the two moments as kit compositions (the scene writes the words)
  drawGiftStage: (g: G, at: Box, o: GiftStageOpts) => withUnit(g, () => drawGiftStage(g, at, o)),
  drawLetterStage: (g: G, at: Box, o: LetterStageOpts) => withUnit(g, () => drawLetterStage(g, at, o)),
  drawLetterSender: (g: G, paper: Box, who: ResidentId, size?: number): void => withUnit(g, () => drawLetterSender(g, paper, who, size)),
  drawRoomGuests: (g: G, at: Box): void => withUnit(g, () => drawRoomGuests(g, at)),
  drawCottageOutside: (g: G, screen: Box, room: Box): void => withUnit(g, () => drawCottageOutside(g, screen, room)),
  drawPortrait: (g: G, id: ResidentId, expr: ResidentExpr, cx: number, cy: number, r: number): void => withUnit(g, () => drawResidentPortrait(g, id, expr, cx, cy, r)),
};

// extras for the scene (layout helpers + letter / gift / emote art), not part of the minimal contract
export { villageLayout, PLOTS, MAILBOX_PLOT } from "./nature.ts";
export { roomGeometry, FLOOR_ROWS, WALL_SLOTS } from "./room.ts";
export { drawLetterPaper, letterLines, letterHeight, drawEnvelope, drawGift, drawGiftCushion, drawEmote, rimLight } from "./letter.ts";
export { loadVillageFont, villageCanvasFont, cjkStack, LETTER_FACES } from "./fonts.ts";
export { RESIDENTS } from "./residents.ts";
export { residentHead } from "./residents.ts";

/**
 * G4: texture memory of the village + the room at a bake scale (RGBA 4 B/px): the backdrop (screen-sized),
 * 6 houses, 5 residents × 2 faces, the room shell, 18 slot items at the room's sizes, the 12 × 3 catalog
 * cards (64 pt) and the letter / gift art. W × H in pt; scale = the bake's px per pt (≤ 2, contract §4).
 */
export function estimateVillageBytes(W = 430, H = 932, scale = 2): { village: number; room: number; extras: number; total: number } {
  // round 3 worst case (night + winter, all 7 residents, 24 items × 3 colourways): one backdrop per open
  // village (time/season change = a re-bake that replaces it, never two), 8 houses, 7 residents × 2 faces +
  // 7 portraits; the room shell, 18 slots, the rug, 72 drawer cards; the market (stall + 3), the postcard.
  const px = (w: number, h: number): number => Math.ceil(w * scale) * Math.ceil(h * scale) * 4;
  const pad = (w: number, h: number): number => px(w * 1.24, h * 1.24);
  const village = px(W, H) + 8 * pad(150, 162) + 7 * 2 * pad(70, 70) + 7 * pad(56, 56) + pad(34, 46) + 7 * pad(44, 44);
  const room = px(W, H * 0.62) + 15 * pad(70, 105) + 3 * pad(56, 56) + pad(170, 30) + 72 * pad(64, 64) + px(360, 300) + pad(120, 140);
  // the postcard is drawn at 1080 × 1350 device px once on share and released (not × scale)
  const extras = pad(220, 200) + 3 * pad(52, 52) + 1080 * 1350 * 4;
  return { village, room, extras, total: village + room + extras };
}
void mix;

export { TIMES, SEASONS, REQUEST_CATEGORIES };
export type { TimeOfDay, Season, RequestCategory };
