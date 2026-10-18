// The drawing interface between the village scene (src/village) and the art kit
// (src/render/village, UI Designer) — contract: docs/team/village-contract.md.
// The kit is optional at build time: the glob is empty while it does not exist, and any function
// it does not export is filled in by the grey placeholders (placeholderArt.ts).
import type { Category, Colorway, ItemId, ResidentId } from "./catalog.ts";
import { placeholderArt } from "./placeholderArt.ts";

/** Canvas px. Draw so the thing's bottom centre sits at (x + w/2, y + h), inside the box. */
export interface PaintBox {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type Expression = "idle" | "happy" | "shy" | "sleepy" | "talk" | "silhouette";
export type { Colorway, ItemId, ResidentId };

export interface HouseSpec {
  /** null = still empty (dark), "cottage" = the player's room */
  resident: ResidentId | "cottage" | null;
  lit: boolean;
  /** the resident moving in tomorrow shows in the window */
  eve: boolean;
  seed: number;
}

export interface VillageArt {
  drawLanternHouse(g: CanvasRenderingContext2D, spec: HouseSpec, at: PaintBox): void;
  /** opts.pose "sit" (final G1 #2): the visitor settled on the floor by its piece (lower, wider, leaning) */
  drawResident(g: CanvasRenderingContext2D, id: ResidentId, expr: Expression, at: PaintBox, opts?: { pose?: "stand" | "sit" }): void;
  /** fit "room" (default): the room's common scale; "card": fill a drawer card's art box */
  drawFurniture(g: CanvasRenderingContext2D, itemId: ItemId, colorway: Colorway, at: PaintBox, opts?: { locked?: boolean; fit?: "room" | "card" }): void;
  drawVillageBackdrop(g: CanvasRenderingContext2D, at: PaintBox): void;
  drawRoom(g: CanvasRenderingContext2D, at: PaintBox, spec: { wallpaper: number; floor: number }): void;
  drawMailbox(g: CanvasRenderingContext2D, at: PaintBox, flag: boolean): void;
  readonly furnitureIds?: readonly ItemId[];
  /** where the backdrop puts each house (bottom centre = the door's ground point) and the mailbox */
  villageLayout?(at: PaintBox): { houses: Record<ResidentId | "cottage", PaintBox>; mailbox: PaintBox };
  /** the room shell's 18 slot boxes (0–14 floor, back row first; 15–17 wall) and the rug box */
  roomGeometry?(at: PaintBox): { slots: PaintBox[]; rug: PaintBox };
  /** the letter paper ruled for n lines at a font size, its baselines, its height (kit letter.ts) */
  drawLetterPaper?(g: CanvasRenderingContext2D, at: PaintBox, n: number, fontPx: number, accent?: string): void;
  letterLines?(at: PaintBox, n: number, fontPx: number): { baselines: number[]; x0: number; x1: number; pitch: number };
  letterHeight?(w: number, n: number, fontPx: number): number;
  /** the font-family stack for village text after its face loaded ("letter" = the handwriting face) */
  loadVillageFont?(lang: string, purpose?: "ui" | "letter"): Promise<string>;
  /** a resident's head top in a drawResident box, and the emote bubble drawn there */
  residentHead?(at: PaintBox, id?: ResidentId): { x: number; y: number };
  drawEmote?(g: CanvasRenderingContext2D, hx: number, hy: number, r: number, icon: "heart" | "note" | "star" | "zzz", col?: string): void;
  /** v15 (designer, Reality G1 #6/#10): the gift reveal and the letter as kit compositions; they return where the words go */
  drawGiftStage?(g: CanvasRenderingContext2D, at: PaintBox, o: { item: ItemId; cw: Colorway; sender: ResidentId }): { chip: PaintBox; item: PaintBox };
  drawLetterStage?(g: CanvasRenderingContext2D, at: PaintBox, o: { n: number; fontPx: number; who: ResidentId; accent: string }): { paper: PaintBox; lines: { baselines: number[]; x0: number; x1: number; pitch: number }; sign: { x: number; y: number } };
  drawLetterSender?(g: CanvasRenderingContext2D, paper: PaintBox, who: ResidentId, size?: number): void;
  /** v15: Wick + Momo visiting, at the room's front corners (drawn after the furniture) */
  drawRoomGuests?(g: CanvasRenderingContext2D, at: PaintBox): void;
  /** v15: the night outside the cottage (sky, moon, hills, lawn) behind the room shell */
  drawCottageOutside?(g: CanvasRenderingContext2D, screen: PaintBox, room: PaintBox): void;
  /** v15: a resident framed by its face centre at (cx, cy) in a circle of radius r (dialogue portraits) */
  drawPortrait?(g: CanvasRenderingContext2D, id: ResidentId, expr: Expression, cx: number, cy: number, r: number): void;
  // ---- full village (round 3, contract §7)
  /** the light of the hour and the season: the scene sets it before baking; the kit reads it in its draw functions */
  setEnvironment?(env: Environment): void;
  /** the backdrop as draw steps (≈ 10, a few ms each; run in order on the same ctx): baked in idle slices / progressively */
  drawVillageBackdropSteps?(g: CanvasRenderingContext2D, at: PaintBox): Array<() => void>;
  /** the market stall (one stall, a striped awning); `open` = lit lanterns on it */
  drawMarketStall?(g: CanvasRenderingContext2D, at: PaintBox, open: boolean): void;
  /** the request bubble over a resident: a small paper bubble with the category's icon */
  drawRequestBubble?(g: CanvasRenderingContext2D, cx: number, by: number, r: number, cat: Category): void;
  /** the room postcard's frame (1080 × 1350): paper, stamp, postmark ring — the room picture goes in `picture` */
  drawPostcardFrame?(g: CanvasRenderingContext2D, at: PaintBox): { picture: PaintBox; stamp: PaintBox; caption: PaintBox };
}

export type TimeBand = "dawn" | "day" | "dusk" | "night";
export type Season = "spring" | "summer" | "autumn" | "winter";
export interface Environment {
  time: TimeBand;
  season: Season;
}

type KitModule = { villageArt?: Partial<VillageArt> } & Partial<Pick<VillageArt, (typeof EXTRAS)[number]>>;
/** kit exports beside villageArt that the scene uses when present */
const EXTRAS = ["villageLayout", "roomGeometry", "drawLetterPaper", "letterLines", "letterHeight", "loadVillageFont", "residentHead", "drawEmote"] as const;
const KIT = import.meta.glob<KitModule>("../render/village/index.ts");
const kitLoader = KIT["../render/village/index.ts"];

/** true when the designer's kit is in this build */
export const hasKit = kitLoader !== undefined;

let art: Promise<VillageArt> | null = null;

/** The kit's functions where it has them, placeholders elsewhere. Never rejects. */
export function loadArt(): Promise<VillageArt> {
  art ??= (kitLoader
    ? kitLoader().then(
        (m) => {
          const extra: Partial<VillageArt> = {};
          for (const k of EXTRAS) if (m[k]) Object.assign(extra, { [k]: m[k] });
          return { ...extra, ...(m.villageArt ?? {}) };
        },
        (e: unknown) => (console.warn("[village] art kit failed to load", e), {}),
      )
    : Promise.resolve({}))
    .then((kit: Partial<VillageArt>) => guarded({ ...placeholderArt, ...kit } as VillageArt));
  return art;
}

/**
 * A kit function that throws (a resident, item or theme it does not draw yet — e.g. while the art
 * for the full village is in progress) falls back to the placeholder for that call, never breaking
 * the scene. Items outside `furnitureIds` go straight to the placeholder.
 */
function guarded(a: VillageArt): VillageArt {
  const safe = <K extends "drawLanternHouse" | "drawResident" | "drawFurniture" | "drawVillageBackdrop" | "drawRoom" | "drawMailbox">(k: K): VillageArt[K] =>
    ((...args: unknown[]) => {
      try {
        (a[k] as (...x: unknown[]) => void)(...args);
      } catch (e) {
        console.warn(`[village] art ${k} fell back`, e);
        (placeholderArt[k] as (...x: unknown[]) => void)(...args);
      }
    }) as VillageArt[K];
  const ids = a.furnitureIds ? new Set<string>(a.furnitureIds) : null;
  const furniture = safe("drawFurniture");
  return {
    ...a,
    drawLanternHouse: safe("drawLanternHouse"),
    drawResident: safe("drawResident"),
    drawVillageBackdrop: safe("drawVillageBackdrop"),
    drawRoom: safe("drawRoom"),
    drawMailbox: safe("drawMailbox"),
    drawFurniture: (g, id, cw, at, o) => (ids && !ids.has(id) ? placeholderArt.drawFurniture(g, id, cw, at, o) : furniture(g, id, cw, at, o)),
  };
}
