// Village 1.0 catalog (owner's 4-week scope: 12 items × 2–3 colourways) and the resident roster.
// Pure data. The item index is the sync bit base (index × 4 + colourway): NEVER reorder or reuse
// an index — retire an item by leaving its slot in place. Names here are the ones the drawer shows
// and VoiceOver reads; the drawings (src/render/village, docs/team/village-contract.md) must match
// them (gate G8).

export const COLORWAYS = ["cream", "sage", "rose"] as const;
export type Colorway = (typeof COLORWAYS)[number];
/** bits reserved per item (room for a 4th colourway in 1.1) */
export const CW_STRIDE = 4;

export type Category = "lighting" | "seating" | "table" | "bed" | "plant" | "storage" | "rug" | "wall" | "small";
/** where an item can go in the cottage: a floor slot, a wall slot, or the rug layer under the floor */
export type Layer = "floor" | "wall" | "rug";

export type ItemId =
  | "paperLantern" | "archChair" | "cushion" | "teaTable" | "smallBed" | "smallPot"
  | "flowerVase" | "bookshelf" | "roundRug" | "wallClock" | "frame" | "teapot"
  // full village (owner, round 3): the other 12 ★ pieces of r2-village-design.md §2.6
  | "floorLamp" | "candles" | "stringLights" | "rockingChair" | "roundTable" | "cactus"
  | "hangingPlant" | "dresser" | "stripedRug" | "wreath" | "knitBasket" | "snowGlobe";

export interface Item {
  id: ItemId;
  /** stable sync index (0..63) */
  index: number;
  cat: Category;
  layer: Layer;
  /** floor slots taken side by side (the bed takes two) */
  span: 1 | 2;
  /** the colourways this item comes in, the first is its "own" */
  colorways: readonly Colorway[];
  name: { en: string; ko: string };
}

const it = (index: number, id: ItemId, cat: Category, layer: Layer, colorways: readonly Colorway[], en: string, ko: string, span: 1 | 2 = 1): Item =>
  ({ id, index, cat, layer, span, colorways, name: { en, ko } });

export const ITEMS: readonly Item[] = [
  it(0, "paperLantern", "lighting", "floor", ["cream", "sage", "rose"], "Paper lantern", "종이 등불"),
  it(1, "archChair", "seating", "floor", ["cream", "sage", "rose"], "Arched chair", "아치 의자"),
  it(2, "cushion", "seating", "floor", ["rose", "cream"], "Floor cushion", "꽃잎 방석"),
  it(3, "teaTable", "table", "floor", ["cream", "sage", "rose"], "Tea table", "찻상"),
  it(4, "smallBed", "bed", "floor", ["cream", "sage", "rose"], "Little bed", "작은 침대", 2),
  it(5, "smallPot", "plant", "floor", ["sage", "cream", "rose"], "Little pot", "작은 화분"),
  it(6, "flowerVase", "plant", "floor", ["rose", "cream"], "Flower vase", "꽃병"),
  it(7, "bookshelf", "storage", "floor", ["cream", "sage", "rose"], "Bookshelf", "책장"),
  it(8, "roundRug", "rug", "rug", ["sage", "rose"], "Round rug", "둥근 러그"),
  it(9, "wallClock", "wall", "wall", ["cream", "sage"], "Wall clock", "벽시계"),
  it(10, "frame", "wall", "wall", ["cream", "rose"], "Picture frame", "액자"),
  it(11, "teapot", "small", "floor", ["rose", "sage"], "Teapot", "찻주전자"),
  it(12, "floorLamp", "lighting", "floor", ["cream", "sage"], "Floor lamp", "스탠드 등"),
  it(13, "candles", "lighting", "floor", ["cream", "rose"], "Candle stand", "촛대"),
  it(14, "stringLights", "lighting", "wall", ["cream", "rose"], "String lights", "줄등"),
  it(15, "rockingChair", "seating", "floor", ["cream", "sage", "rose"], "Rocking chair", "흔들의자"),
  it(16, "roundTable", "table", "floor", ["cream", "sage"], "Round table", "둥근 탁자"),
  it(17, "cactus", "plant", "floor", ["sage", "rose"], "Cactus", "선인장"),
  it(18, "hangingPlant", "plant", "wall", ["sage", "cream"], "Hanging plant", "매달린 화분"),
  it(19, "dresser", "storage", "floor", ["cream", "sage", "rose"], "Dresser", "서랍장"),
  it(20, "stripedRug", "rug", "rug", ["sage", "rose"], "Striped rug", "줄무늬 러그"),
  it(21, "wreath", "wall", "wall", ["sage", "rose"], "Wreath", "화환"),
  it(22, "knitBasket", "small", "floor", ["rose", "cream"], "Knitting basket", "뜨개 바구니"),
  it(23, "snowGlobe", "small", "floor", ["cream", "sage"], "Snow globe", "스노볼"),
];

const BY_ID = new Map(ITEMS.map((x) => [x.id, x]));
const BY_INDEX = new Map(ITEMS.map((x) => [x.index, x]));
export const itemById = (id: string): Item | undefined => BY_ID.get(id as ItemId);

/** One owned piece: an item in one colourway (= one sync bit). */
export interface Piece {
  item: ItemId;
  cw: Colorway;
}
export const pieceBit = (p: Piece): number => BY_ID.get(p.item)!.index * CW_STRIDE + COLORWAYS.indexOf(p.cw);
export function pieceOfBit(bit: number): Piece | null {
  const item = BY_INDEX.get(Math.floor(bit / CW_STRIDE));
  const cw = COLORWAYS[bit % CW_STRIDE];
  return item && cw && item.colorways.includes(cw) ? { item: item.id, cw } : null;
}
/** Every piece of the catalog, item order then colourway order. */
export const ALL_PIECES: readonly Piece[] = ITEMS.flatMap((x) => x.colorways.map((cw) => ({ item: x.id, cw })));

/** Drawer tabs (5 fit on an SE): each lists one or more categories. */
export const DRAWER_TABS: ReadonlyArray<{ id: string; cats: readonly Category[]; name: { en: string; ko: string } }> = [
  { id: "all", cats: [], name: { en: "All", ko: "전체" } },
  { id: "sit", cats: ["seating", "bed", "table"], name: { en: "Seats", ko: "의자" } },
  { id: "light", cats: ["lighting", "small", "storage"], name: { en: "Things", ko: "소품" } },
  { id: "green", cats: ["plant"], name: { en: "Plants", ko: "화분" } },
  { id: "wall", cats: ["wall", "rug"], name: { en: "Walls", ko: "벽" } },
];

// ---------------------------------------------------------------- residents

export type ResidentId = "wick" | "momo" | "sage" | "luna" | "pip" | "kuri" | "yuki";

export interface Resident {
  id: ResidentId;
  /** stable index (mail ids, sync) */
  index: number;
  /** cumulative lit days at which this resident lives here (owner 2026-10-17: Wick + Momo on day 0) */
  moveIn: number;
  name: { en: string; ko: string };
  /** the furniture piece in the move-in letter */
  signature: Piece;
  /** sends jar-gift letters in 1.0 (has letter.gift / gift.tag lines) */
  giftSender: boolean;
  /** the host: speaks for the village (host lines) */
  host?: true;
  /** furniture categories it likes; its requests ask for these, in order (narrative §2) */
  likes: readonly Category[];
}

export const RESIDENTS: readonly Resident[] = [
  { id: "wick", index: 0, moveIn: 0, name: { en: "Wick", ko: "윅" }, signature: { item: "paperLantern", cw: "cream" }, giftSender: true, host: true, likes: ["lighting", "table"] },
  { id: "momo", index: 1, moveIn: 0, name: { en: "Momo", ko: "모모" }, signature: { item: "cushion", cw: "rose" }, giftSender: true, likes: ["seating", "plant"] },
  { id: "sage", index: 2, moveIn: 2, name: { en: "Sage", ko: "세이지" }, signature: { item: "smallPot", cw: "sage" }, giftSender: true, likes: ["plant", "rug"] },
  { id: "luna", index: 3, moveIn: 4, name: { en: "Luna", ko: "루나" }, signature: { item: "wallClock", cw: "cream" }, giftSender: true, likes: ["wall", "lighting"] },
  { id: "pip", index: 4, moveIn: 7, name: { en: "Pip", ko: "핍" }, signature: { item: "roundRug", cw: "sage" }, giftSender: true, likes: ["rug", "small"] },
  { id: "kuri", index: 5, moveIn: 10, name: { en: "Kuri", ko: "쿠리" }, signature: { item: "knitBasket", cw: "rose" }, giftSender: true, likes: ["small", "seating"] },
  { id: "yuki", index: 6, moveIn: 14, name: { en: "Yuki", ko: "유키" }, signature: { item: "snowGlobe", cw: "cream" }, giftSender: true, likes: ["bed", "storage"] },
];
export const residentById = (id: string): Resident | undefined => RESIDENTS.find((r) => r.id === id);

/**
 * The cottage comes furnished (Reality G1 #14: the first room must not be empty): Wick's lantern —
 * the host's move-in gift, so Wick sends no move-in mail — and three starter pieces. Always owned
 * (derived, never stored); never sent again by a jar.
 */
export const STARTER: readonly Piece[] = [
  { item: "paperLantern", cw: "cream" },
  { item: "teaTable", cw: "cream" },
  { item: "smallPot", cw: "cream" },
  { item: "roundRug", cw: "rose" },
];

/** Requests: each resident asks for its liked categories, in order (id = resident index × 2 + k; sync bits 2·id asked, 2·id+1 done). */
export interface Request {
  id: number;
  r: ResidentId;
  cat: Category;
}
export const REQUESTS: readonly Request[] = RESIDENTS.flatMap((r) => r.likes.map((cat, k) => ({ id: r.index * 2 + k, r: r.id, cat })));

/**
 * Jar gifts, in order: every catalog piece that is not a resident's move-in gift, items interleaved
 * (each item's own colourway first), so the first jars bring different things. After the last one
 * the sequence starts again (a repeat brings nothing new; the letter still comes).
 */
export const GIFT_SEQ: readonly Piece[] = (() => {
  const sig = new Set([...RESIDENTS.map((r) => pieceBit(r.signature)), ...STARTER.map(pieceBit)]);
  const out: Piece[] = [];
  const maxCw = Math.max(...ITEMS.map((x) => x.colorways.length));
  for (let k = 0; k < maxCw; k++) for (const x of ITEMS) {
    const cw = x.colorways[k];
    if (cw && !sig.has(pieceBit({ item: x.id, cw }))) out.push({ item: x.id, cw });
  }
  return out;
})();
