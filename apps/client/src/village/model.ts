// Village 1.0 rules (pure, deterministic; unit-tested in tests/village-model.test.ts).
// Everything is derived from the existing progress (cleared boards, the daily log) plus the synced
// bit sets of vstate.ts — no counter is ever stored, so two devices that merged agree, and nothing
// can go down (no punishment: a 30-day gap loses nothing).
//
//   lit days     distinct days a board was solved: v.pd ∪ the daily log (≤ today). A player from
//                before the village (boards cleared, no pd yet) has at least 1.
//   residents    move in at cumulative lit days (catalog.ts RESIDENTS: Wick + Momo 0, Sage 2,
//                Luna 4, Pip 7); never leave. The next one shows as a silhouette ("eve").
//   drops        1 per cleared board + 3 per daily; never spent
//   jar          the first 3 jars fill every 3 drops, then every 6; each full jar = one gift mail
//   mail         move-in letters (resident's signature piece) and jar gifts (GIFT_SEQ), ids stable
//                across devices (mailId); opened = in v.lr = the piece is owned
//   letters      ≤ 1 letter a day; the other mails of that day arrive as a gift with a paper tag
//                (local decision, cached on the device: deliver())
//   friendship   0–5 from talk days since the resident moved in (+2 per request, 1.1)
//   cottage      one room, 18 snap slots (15 floor in 3 rows of 5 + 3 wall) + the rug layer
//   cozy (R4)    score of the cottage (distinct items, resident sets, a colour match) → level 0–5;
//                levels reached are kept as synced bits (v.cz) so a reward never goes away
import { ALL_PIECES, COLORWAYS, CW_STRIDE, type FurnitureSet, GIFT_SEQ, ITEMS, itemById, type Item, type ItemId, type Piece, pieceBit, pieceOfBit, REQUESTS, type Request, RESIDENTS, type Resident, type ResidentId, SETS, STARTER } from "./catalog.ts";
import type { VState } from "./vstate.ts";

/** Days since 1970-01-01 of a local ISO date (UTC arithmetic, as pipsApi.isoDay). */
export function dayOf(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}
export function isoOfDay(day: number): string {
  return new Date(day * 86_400_000).toISOString().slice(0, 10);
}
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface VillageInput {
  /** today: a deduce board or Today's puzzle without hints (puzzle.hard lines) */
  hardToday?: boolean;
  cleared: { gentle: number; deduce: number };
  /** completion dates of Today's puzzle (the daily log's keys) */
  dailyDates: readonly string[];
  v: VState;
  /** local date */
  today: string;
}

// ---------------------------------------------------------------- lit days, drops, jar

export function litDayList(inp: VillageInput): number[] {
  const t = dayOf(inp.today);
  const s = new Set<number>();
  for (const d of inp.v.pd) if (d <= t) s.add(d);
  for (const iso of inp.dailyDates) if (DATE_RE.test(iso)) {
    const d = dayOf(iso);
    if (d <= t) s.add(d);
  }
  return [...s].sort((a, b) => a - b);
}

export function litDays(inp: VillageInput): number {
  const n = litDayList(inp).length;
  return n === 0 && inp.cleared.gentle + inp.cleared.deduce > 0 ? 1 : n;
}

export const DROPS_PER_DAILY = 3;
export function drops(inp: VillageInput): number {
  const dailies = new Set(inp.dailyDates.filter((d) => DATE_RE.test(d))).size;
  return Math.max(0, inp.cleared.gentle) + Math.max(0, inp.cleared.deduce) + DROPS_PER_DAILY * dailies;
}

/** First EARLY_JARS jars fill every EARLY_SIZE drops, then every LATE_SIZE. */
export const EARLY_JARS = 3;
export const EARLY_SIZE = 3;
export const LATE_SIZE = 6;

export function jarsFilled(d: number): number {
  const early = EARLY_JARS * EARLY_SIZE;
  return d < early ? Math.floor(d / EARLY_SIZE) : EARLY_JARS + Math.floor((d - early) / LATE_SIZE);
}
/** The jar being filled now: drops in it and its size (HUD jar). */
export function jarProgress(d: number): { have: number; size: number } {
  const early = EARLY_JARS * EARLY_SIZE;
  if (d < early) return { have: d % EARLY_SIZE, size: EARLY_SIZE };
  return { have: (d - early) % LATE_SIZE, size: LATE_SIZE };
}

// ---------------------------------------------------------------- residents

export interface ResidentState {
  r: Resident;
  movedIn: boolean;
  /** the lit day it moved in on (null: not yet, or before the first lit day) */
  moveInDay: number | null;
  friendship: number;
  points: number;
}

/** points for level 0..5 (narrative §3.3, [P]) */
export const FRIEND_LEVELS = [0, 2, 5, 9, 14, 21] as const;
export function friendLevel(points: number): number {
  let l = 0;
  for (let i = 0; i < FRIEND_LEVELS.length; i++) if (points >= FRIEND_LEVELS[i]!) l = i;
  return l;
}

export function residents(inp: VillageInput): ResidentState[] {
  const list = litDayList(inp);
  const n = litDays(inp);
  return RESIDENTS.map((r) => {
    const movedIn = n >= r.moveIn;
    const moveInDay = movedIn && r.moveIn > 0 ? (list[r.moveIn - 1] ?? null) : null;
    const from = moveInDay ?? Number.NEGATIVE_INFINITY;
    const done = REQUESTS.filter((q) => q.r === r.id && requestDone(inp.v.q, q)).length;
    const points = movedIn ? inp.v.ch.filter((d) => d >= from).length + 2 * done : 0;
    return { r, movedIn, moveInDay, points, friendship: friendLevel(points) };
  });
}

/** The resident who moves in on the next lit day (window silhouette, Wick's "tomorrow" line). */
export function eve(inp: VillageInput): Resident | null {
  const n = litDays(inp);
  return RESIDENTS.find((r) => r.moveIn === n + 1) ?? null;
}

// ---------------------------------------------------------------- mail

/** Mail ids: move-in letters 0..15 (resident index), request thank-yous 16..63 (16 + request id), jar gift j (1-based) = 64 + j − 1. */
export const THANKS_BASE = 16;
export const JAR_BASE = 64;
export const mailIdMoveIn = (r: Resident): number => r.index;
export const mailIdJar = (j: number): number => JAR_BASE + j - 1;

export interface Mail {
  id: number;
  kind: "moveIn" | "jar" | "thanks" | "market";
  /** jar number (1-based) for jar gifts */
  jar: number;
  sender: ResidentId;
  piece: Piece;
  read: boolean;
}

/** Gift senders in 1.0: residents with letter.gift lines who live here; round robin over jars. */
export function jarSender(j: number, moved: readonly Resident[]): ResidentId {
  const c = moved.filter((r) => r.giftSender);
  return (c[(j - 1) % Math.max(1, c.length)] ?? RESIDENTS[0]!).id;
}

export const jarPiece = (j: number): Piece => GIFT_SEQ[(j - 1) % GIFT_SEQ.length]!;

export function mails(inp: VillageInput): Mail[] {
  const read = new Set(inp.v.lr);
  const moved = residents(inp).filter((x) => x.movedIn).map((x) => x.r);
  // the host's lantern is already in the cottage (STARTER): no move-in mail from Wick
  const out: Mail[] = moved.filter((r) => !r.host).map((r) => ({ id: mailIdMoveIn(r), kind: "moveIn" as const, jar: 0, sender: r.id, piece: r.signature, read: read.has(mailIdMoveIn(r)) }));
  // a fulfilled request: a thank-you letter with a piece of that category
  for (const q of REQUESTS) {
    if (!requestDone(inp.v.q, q)) continue;
    const piece = requestGift(q);
    out.push({ id: THANKS_BASE + q.id, kind: "thanks", jar: 0, sender: q.r, piece, read: read.has(THANKS_BASE + q.id) });
  }
  const jars = jarsFilled(drops(inp));
  for (let j = 1; j <= jars; j++) out.push({ id: mailIdJar(j), kind: "jar", jar: j, sender: jarSender(j, moved), piece: jarPiece(j), read: read.has(mailIdJar(j)) });
  return out;
}

/** Pieces owned: the gifts in opened mail, plus extra unlocks (v.u). */
export function owned(inp: VillageInput): Set<number> {
  const s = new Set<number>(STARTER.map(pieceBit));
  for (const m of mails(inp)) if (m.read) s.add(pieceBit(m.piece));
  for (const b of inp.v.u) if (pieceOfBit(b)) s.add(b);
  return s;
}

/** Mail delivery order: move-ins of the newcomers (roster order), the host's, then jars in order. */
export function mailOrder(a: Mail, b: Mail): number {
  const rank = (m: Mail): number => (m.kind === "jar" ? 3 : m.kind === "thanks" ? 2 : RESIDENTS[m.id]?.host ? 1 : 0);
  return rank(a) - rank(b) || a.jar - b.jar || a.id - b.id;
}

/** A delivered mail as this device first showed it (local, never synced). */
export interface MailMeta {
  /** letter = paper letter; tag = the gift with a one-line paper tag (a second mail that day) */
  k: "letter" | "tag";
  /** sender as first shown (a jar's round robin can change when someone moves in) */
  s: ResidentId;
  /** day delivered */
  d: number;
}

/**
 * Deliver the unread mail this device has not shown yet: the first one (mailOrder) is a letter
 * unless a letter already came today; the rest are gifts with a tag. `letterDay` = the day of this
 * device's last letter. Pure: returns the new cache and letter day.
 */
export function deliver(all: readonly Mail[], known: Readonly<Record<string, MailMeta>>, today: number, letterDay: number | null): { known: Record<string, MailMeta>; letterDay: number | null } {
  const out: Record<string, MailMeta> = { ...known };
  let ld = letterDay;
  for (const m of all.filter((x) => !x.read && !out[x.id]).sort(mailOrder)) {
    const k = ld === today ? "tag" : "letter";
    if (k === "letter") ld = today;
    out[m.id] = { k, s: m.sender, d: today };
  }
  return { known: out, letterDay: ld };
}

/** The mailbox shows at most this many unread; older ones are filed (opened → owned) on open. */
export const MAILBOX_MAX = 10;
export function overflow(all: readonly Mail[]): number[] {
  const unread = all.filter((m) => !m.read).sort(mailOrder);
  return unread.length > MAILBOX_MAX ? unread.slice(0, unread.length - MAILBOX_MAX).map((m) => m.id) : [];
}

// ---------------------------------------------------------------- the cottage room

export const FLOOR_ROWS = 3;
export const FLOOR_COLS = 5;
export const FLOOR_SLOTS = FLOOR_ROWS * FLOOR_COLS;
export const WALL_SLOTS = 3;
export const SLOTS = FLOOR_SLOTS + WALL_SLOTS; // 18
export const COTTAGE = "0";

export interface Placed {
  bit: number;
  flip: boolean;
}
export interface RoomLayout {
  /** 0–4 back row, 5–9 middle, 10–14 front, 15–17 wall (left → right) */
  slots: (Placed | null)[];
  rug: Placed | null;
  wallpaper: number;
  floor: number;
}

export const emptyRoom = (): RoomLayout => ({ slots: Array.from({ length: SLOTS }, () => null), rug: null, wallpaper: 0, floor: 0 });

/**
 * The cottage before its first edit: Wick's lantern back left, the pot back right, the tea table in
 * the middle, the rug under it — the front row stays free for the first gifts.
 */
export function starterRoom(): RoomLayout {
  const r = emptyRoom();
  const b = (i: number): number => pieceBit(STARTER[i]!);
  r.slots[1] = { bit: b(0), flip: false };
  r.slots[3] = { bit: b(2), flip: false };
  r.slots[7] = { bit: b(1), flip: false };
  r.rug = { bit: b(3), flip: false };
  return r;
}

/** R4 D: the tower-top room (opens with the Lantern Festival): starts empty, on the starry wallpaper / dark floor. */
export const TOWER_ROOM = "1";
export function towerRoomOf(stored: string | undefined): RoomLayout {
  return stored ? decodeRoom(stored) : { ...emptyRoom(), wallpaper: 2, floor: 2 };
}

/** The room as stored, or the starter room when it was never edited. */
export function roomOf(stored: string | undefined): RoomLayout {
  return stored ? decodeRoom(stored) : starterRoom();
}

const code = (p: Placed | null): string => (p ? 1 + p.bit * 2 + (p.flip ? 1 : 0) : 0).toString(36).padStart(2, "0");
const uncode = (s: string): Placed | null => {
  const n = parseInt(s, 36);
  if (!Number.isFinite(n) || n <= 0) return null;
  const bit = (n - 1) >> 1;
  return pieceOfBit(bit) ? { bit, flip: ((n - 1) & 1) === 1 } : null;
};

/** 18 slots + rug (2 chars each) + wallpaper + floor = 40 base-36 chars (vstate ROOM_RE). */
export function encodeRoom(r: RoomLayout): string {
  return r.slots.map(code).join("") + code(r.rug) + (r.wallpaper % 36).toString(36) + (r.floor % 36).toString(36);
}
export function decodeRoom(s: string | undefined): RoomLayout {
  const out = emptyRoom();
  if (!s || s.length !== 40) return out;
  for (let i = 0; i < SLOTS; i++) out.slots[i] = uncode(s.slice(i * 2, i * 2 + 2));
  out.rug = uncode(s.slice(36, 38));
  out.wallpaper = parseInt(s[38]!, 36) || 0;
  out.floor = parseInt(s[39]!, 36) || 0;
  return sanitize(out);
}

/**
 * R4 cozy score (docs/team/r4-village-story-rewards.md §3), derived from the room, never stored: distinct
 * items placed + 3 per completed resident set + 1 when three or more of the placed pieces share a colourway.
 */
export function cozyScore(r: RoomLayout): number {
  const items = new Set<ItemId>();
  const perCw = new Map<string, number>();
  for (const p of [...r.slots, r.rug]) {
    const piece = p ? pieceOfBit(p.bit) : null;
    if (!piece || items.has(piece.item)) continue;
    items.add(piece.item);
    perCw.set(piece.cw, (perCw.get(piece.cw) ?? 0) + 1);
  }
  const sets = SETS.filter((x) => x.items.every((i) => items.has(i))).length;
  const match = [...perCw.values()].some((n) => n >= 3) ? 1 : 0;
  return items.size + 3 * sets + match;
}
/** score needed for cozy level 0..5 (the starter room's 4 pieces stay at level 0; [P]) */
export const COZY_AT = [0, 6, 10, 14, 18, 24] as const;
export function cozyLevel(score: number): number {
  let l = 0;
  for (let i = 0; i < COZY_AT.length; i++) if (score >= COZY_AT[i]!) l = i;
  return l;
}
/** The resident sets this room completes. */
export const setsDone = (r: RoomLayout): FurnitureSet[] => {
  const have = new Set([...r.slots, r.rug].flatMap((p) => (p ? [pieceOfBit(p.bit)?.item] : [])));
  return SETS.filter((x) => x.items.every((i) => have.has(i)));
};

export const slotLayer = (slot: number): "floor" | "wall" => (slot < FLOOR_SLOTS ? "floor" : "wall");
export const itemOfBit = (bit: number): Item | undefined => {
  const p = pieceOfBit(bit);
  return p ? itemById(p.item) : undefined;
};

/** The slot a span-2 piece at `slot` also covers, or -1 (no room to its right in the row). */
export function partnerSlot(slot: number): number {
  return slot < FLOOR_SLOTS && slot % FLOOR_COLS < FLOOR_COLS - 1 ? slot + 1 : -1;
}

/** Which slot's piece covers `slot` (itself, or a span-2 piece on its left), or -1. */
export function coverOf(r: RoomLayout, slot: number): number {
  if (r.slots[slot]) return slot;
  if (slot < FLOOR_SLOTS && slot % FLOOR_COLS > 0) {
    const left = r.slots[slot - 1];
    if (left && itemOfBit(left.bit)?.span === 2) return slot - 1;
  }
  return -1;
}

/** Drop anything invalid: wrong layer, unknown piece, overlaps, the same piece twice. */
export function sanitize(r: RoomLayout): RoomLayout {
  const out = emptyRoom();
  out.wallpaper = Math.min(2, Math.max(0, r.wallpaper | 0));
  out.floor = Math.min(2, Math.max(0, r.floor | 0));
  const used = new Set<number>();
  for (let i = 0; i < SLOTS; i++) {
    const p = r.slots[i];
    if (!p) continue;
    if (canPlace(out, i, p.bit, used)) {
      out.slots[i] = { ...p };
      used.add(p.bit);
    }
  }
  if (r.rug && itemOfBit(r.rug.bit)?.layer === "rug" && !used.has(r.rug.bit)) out.rug = { ...r.rug };
  return out;
}

/** Pieces in the room (each owned piece goes in at most once). */
export function placedBits(r: RoomLayout): Set<number> {
  const s = new Set<number>();
  for (const p of r.slots) if (p) s.add(p.bit);
  if (r.rug) s.add(r.rug.bit);
  return s;
}

/** Can piece `bit` go in `slot` (ignoring what is there now when `replacing`)? */
export function canPlace(r: RoomLayout, slot: number, bit: number, used: Set<number> = placedBits(r)): boolean {
  const item = itemOfBit(bit);
  if (!item || slot < 0 || slot >= SLOTS || used.has(bit)) return false;
  if (item.layer === "rug") return false; // the rug layer is not a slot
  if (item.layer !== slotLayer(slot)) return false;
  if (coverOf(r, slot) >= 0) return false;
  if (item.span === 2) {
    const p = partnerSlot(slot);
    if (p < 0 || coverOf(r, p) >= 0) return false;
  }
  return true;
}

const clone = (r: RoomLayout): RoomLayout => ({ ...r, slots: r.slots.map((p) => (p ? { ...p } : null)), rug: r.rug ? { ...r.rug } : null });

/** Put piece `bit` in `slot` (rugs: the rug layer, `slot` ignored). The piece leaves any other place first. */
export function place(r: RoomLayout, slot: number, bit: number, flip = false): RoomLayout | null {
  const item = itemOfBit(bit);
  if (!item) return null;
  let out = removeBit(clone(r), bit);
  if (item.layer === "rug") {
    out.rug = { bit, flip };
    return out;
  }
  // replacing what is in that slot
  const c = coverOf(out, slot);
  if (c >= 0) out = removeAt(out, c);
  if (item.span === 2) {
    const p = partnerSlot(slot);
    const cp = p >= 0 ? coverOf(out, p) : -1;
    if (cp >= 0) out = removeAt(out, cp);
  }
  if (!canPlace(out, slot, bit)) return null;
  out.slots[slot] = { bit, flip };
  return out;
}

export function removeAt(r: RoomLayout, slot: number): RoomLayout {
  const out = clone(r);
  const c = coverOf(out, slot);
  if (c >= 0) out.slots[c] = null;
  return out;
}
export function removeBit(r: RoomLayout, bit: number): RoomLayout {
  const out = clone(r);
  out.slots = out.slots.map((p) => (p && p.bit === bit ? null : p));
  if (out.rug?.bit === bit) out.rug = null;
  return out;
}

/** "Put it in my cottage": the first free slot that fits, front row middle first. -1 = full. */
export const SLOT_PREFERENCE: readonly number[] = [12, 11, 13, 7, 6, 8, 10, 14, 5, 9, 2, 1, 3, 0, 4, 16, 15, 17];
export function autoSlot(r: RoomLayout, bit: number): number {
  const item = itemOfBit(bit);
  if (!item) return -1;
  if (item.layer === "rug") return r.rug ? -1 : FLOOR_SLOTS; // FLOOR_SLOTS stands for "the rug layer"
  for (const s of SLOT_PREFERENCE) if (canPlace(r, s, bit)) return s;
  return -1;
}

/** A spoken / shown slot name key: "back left", "front middle", "wall right" … (strings.ts slot.*) */
export function slotWhere(slot: number): { row: "back" | "middle" | "front" | "wall"; col: number } {
  if (slot >= FLOOR_SLOTS) return { row: "wall", col: slot - FLOOR_SLOTS };
  return { row: (["back", "middle", "front"] as const)[Math.floor(slot / FLOOR_COLS)]!, col: slot % FLOOR_COLS };
}

// ---------------------------------------------------------------- catalog cards

export interface Card {
  item: Item;
  /** per colourway: owned, and placed in the room */
  cws: Array<{ cw: (typeof COLORWAYS)[number]; bit: number; owned: boolean; placed: boolean; source: Source }>;
  /** at least one colourway owned */
  unlocked: boolean;
}
/** How a locked piece is had: a resident's move-in letter, or a gift jar. */
export type Source = { kind: "resident"; id: ResidentId } | { kind: "jar" };

export function sourceOf(bit: number): Source {
  const r = RESIDENTS.find((x) => pieceBit(x.signature) === bit);
  return r ? { kind: "resident", id: r.id } : { kind: "jar" };
}

export function cards(own: Set<number>, room: RoomLayout): Card[] {
  const placed = placedBits(room);
  return ITEMS.map((item) => {
    const cws = item.colorways.map((cw) => {
      const bit = item.index * CW_STRIDE + COLORWAYS.indexOf(cw);
      return { cw, bit, owned: own.has(bit), placed: placed.has(bit), source: sourceOf(bit) };
    });
    return { item, cws, unlocked: cws.some((c) => c.owned) };
  });
}

/** Sanity: every piece is reachable (a move-in gift or in the jar sequence). */
export function reachable(): boolean {
  const sig = new Set([...RESIDENTS.filter((r) => !r.host).map((r) => pieceBit(r.signature)), ...STARTER.map(pieceBit)]);
  const jar = new Set(GIFT_SEQ.map(pieceBit));
  return ALL_PIECES.every((p) => sig.has(pieceBit(p)) || jar.has(pieceBit(p)));
}

// ---------------------------------------------------------------- requests (v.q: bit 2·id asked, 2·id+1 done)

export const MAX_ACTIVE_REQUESTS = 2;
export const requestAsked = (q: readonly number[], r: Request): boolean => q.includes(2 * r.id);
export function requestDone(q: readonly number[], r: Request): boolean {
  return q.includes(2 * r.id + 1);
}
/** Asked and not yet fulfilled (no deadline: it stays until a matching piece is in the cottage). */
export function activeRequests(v: VState): Request[] {
  return REQUESTS.filter((r) => requestAsked(v.q, r) && !requestDone(v.q, r));
}
/** The request resident `id` would ask for now: one open per resident, ≤ 2 open in all, likes in order. */
export function nextAsk(inp: VillageInput, id: ResidentId, roomCats: ReadonlySet<string> = new Set()): Request | null {
  const active = activeRequests(inp.v);
  if (active.length >= MAX_ACTIVE_REQUESTS || active.some((r) => r.r === id)) return null;
  if (!residents(inp).find((x) => x.r.id === id)?.movedIn) return null;
  const open = REQUESTS.filter((r) => r.r === id && !requestAsked(inp.v.q, r));
  // a category the cottage lacks first (asking for what is already there would be fulfilled at once)
  return open.find((r) => !roomCats.has(r.cat)) ?? open[0] ?? null;
}
/** Categories in the room (placed pieces and the rug). */
export function roomCategories(room: RoomLayout): Set<string> {
  return new Set([...placedBits(room)].map((b) => itemOfBit(b)?.cat).filter((c): c is NonNullable<typeof c> => !!c));
}
/** Open requests the room now fulfils (a piece of that category is in the cottage). */
export function fulfilled(v: VState, room: RoomLayout): Request[] {
  const cats = roomCategories(room);
  return activeRequests(v).filter((r) => cats.has(r.cat));
}
/** Residents visiting the cottage: their fulfilled request's category is in the room (latest two). */
export function visitors(v: VState, room: RoomLayout): Array<{ r: ResidentId; cat: string }> {
  const cats = roomCategories(room);
  // R4 C: a completed resident set brings that resident over first (it sits by its set's first piece)
  const bySet = setsDone(room).map((x) => ({ r: x.r, cat: itemById(x.items[0])!.cat as string }));
  const byRequest = REQUESTS.filter((q) => requestDone(v.q, q) && cats.has(q.cat))
    .reverse()
    .map((q) => ({ r: q.r, cat: q.cat as string }));
  return [...bySet, ...byRequest]
    .filter((q, i, a) => a.findIndex((x) => x.r === q.r) === i)
    .slice(0, bySet.length ? 3 : 2);
}

/** R4 C: how many of each set's items stand in the room (drawer badges "2/3"). */
export function setProgress(room: RoomLayout): Map<ResidentId, number> {
  const have = new Set([...room.slots, room.rug].flatMap((p) => (p ? [pieceOfBit(p.bit)?.item] : [])));
  return new Map(SETS.map((x) => [x.r, x.items.filter((i) => have.has(i)).length]));
}
/** The set an item belongs to (each catalog item is in at most one). */
export const setOfItem = (item: ItemId): FurnitureSet | undefined => SETS.find((x) => x.items.includes(item));
/** The thank-you gift: a piece of the asked category (fixed per request; a repeat brings nothing new). */
export function requestGift(q: Request): Piece {
  const pool = ALL_PIECES.filter((p) => itemById(p.item)!.cat === q.cat && !STARTER.some((s) => pieceBit(s) === pieceBit(p)));
  const from = pool.length ? pool : ALL_PIECES.filter((p) => itemById(p.item)!.cat === q.cat);
  return from[(RESIDENTS.find((r) => r.id === q.r)!.index * 3 + q.id) % from.length]!;
}

// ---------------------------------------------------------------- market (v.mk: days a piece was picked)

/** The market's rotation: every piece but the starter ones, in a fixed shuffled order (same on every device). */
export const MARKET_ORDER: readonly Piece[] = (() => {
  const pool = ALL_PIECES.filter((p) => !STARTER.some((s) => pieceBit(s) === pieceBit(p)));
  const keyed = pool.map((p) => ({ p, k: hash32(`mk|${p.item}|${p.cw}`) }));
  return keyed.sort((a, b) => a.k - b.k).map((x) => x.p);
})();
function hash32(t: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 0x01000193) >>> 0;
  return h >>> 0;
}
export const MARKET_OFFERS = 3;
/** Today's three pieces: the next three of the rotation (a pick does not change them; unpicked ones come again). */
export function marketOffers(day: number): Piece[] {
  const n = MARKET_ORDER.length;
  return Array.from({ length: MARKET_OFFERS }, (_, k) => MARKET_ORDER[(((day * MARKET_OFFERS + k) % n) + n) % n]!);
}
/** "locked" until a board is lit today; "open"; "done" once today's piece is picked. */
export function marketState(inp: VillageInput): "locked" | "open" | "done" {
  const t = dayOf(inp.today);
  if (inp.v.mk.includes(t)) return "done";
  return litDayList(inp).includes(t) ? "open" : "locked";
}
