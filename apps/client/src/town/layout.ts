// Street layout (pure, no DOM): where every lit house, milestone and festival
// lantern sits. Units: "hu" = one house body width (the same unit as
// render/house.ts). x runs from the street start (0) to the right, y is
// relative to the street baseline (negative = up). The painter multiplies by S
// (pt per hu). Every number below is a tuning lever; see docs/town.md.
import { seedKeyFor } from "../game/levelIds.ts";
import { houseFor, type HouseSpec } from "../render/house.ts";

export type FestivalLantern = "lit" | "covered" | "waiting";

/** One small hand-drawn extra per lit house ("something new on each house"). */
export type Keepsake =
  | "flowerBox" | "doorLantern" | "shutters" | "garland" | "bench" | "bird" | "ivy"
  | "cat" | "mailbox" | "awning" | "laundry" | "weathervane" | "birdhouse";

/** Unlock order: houses 1..13 each introduce a kind never seen before on the street (8 = the cat). */
export const KEEPSAKE_ORDER: readonly Keepsake[] = [
  "flowerBox", "doorLantern", "shutters", "garland", "bench", "bird", "ivy",
  "cat", "mailbox", "awning", "laundry", "weathervane", "birdhouse",
];

export type Landmark = "fountain" | "bellTower" | "bridge" | "tree" | "windmill" | "bandstand";
/** Every LANDMARK_EVERY-th house: 10 fountain, 20 bell tower, 30 bridge, 40 tree, 50 windmill, 60 bandstand, then repeat. */
export const LANDMARKS: readonly Landmark[] = ["fountain", "bellTower", "bridge", "tree", "windmill", "bandstand"];

export const TUNE = {
  /** empty street before house 1 */
  startHu: 0.9,
  /** yard between two lit houses (room for a clothesline: generator lines reach 0.48 hu out) */
  gapHu: 0.62,
  /** extra yard where a lamp post stands */
  lampGapHu: 0.42,
  /** extra yard where a landmark stands */
  landmarkGapHu: 1.75,
  /** street after the last silhouette (fades into the dark) */
  endHu: 1.4,
  lampEvery: 5,
  landmarkEvery: 10,
  /** unlit houses shown ahead of the newest lit one */
  ahead: 3,
  /** ahead houses get smaller and closer: they read as "further up the street, not yet" */
  aheadScale: [0.8, 0.66, 0.54] as readonly number[],
  aheadGapScale: 0.55,
  /** festival lanterns: spacing along the string, clearance around a roof peak (keeps the heart window free) */
  lanternPitchHu: 0.27,
  peakClearHu: 0.3,
  /** houses from this number on carry two keepsakes (new combinations keep each house new) */
  doubleKeepsakeFrom: 14,
} as const;

export interface StreetHouse {
  n: number;
  /** centre x, hu */
  x: number;
  scale: number;
  lit: boolean;
  spec: HouseSpec;
  keepsakes: Keepsake[];
}

export interface StreetItem {
  kind: "lamp" | Landmark;
  /** the house number that earned it */
  n: number;
  x: number;
  scale: number;
  lit: boolean;
}

export interface Swag {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  sag: number;
}

export interface StreetLanternPos {
  x: number;
  /** string y at x (hu, negative up) — the lantern hangs below it */
  y: number;
  state: FestivalLantern;
}

export interface Street {
  gentle: number;
  houses: StreetHouse[];
  items: StreetItem[];
  swags: Swag[];
  lanterns: StreetLanternPos[];
  /** total length, hu */
  length: number;
  /** x of the newest lit house (or the first dark one) — the view opens around it */
  focusX: number;
}

export function keepsakesFor(n: number): Keepsake[] {
  const K = KEEPSAKE_ORDER.length;
  const first = KEEPSAKE_ORDER[(n - 1) % K]!;
  if (n < TUNE.doubleKeepsakeFrom) return [first];
  let j = (n * 5 + 3) % K;
  if (KEEPSAKE_ORDER[j] === first) j = (j + 1) % K;
  return [first, KEEPSAKE_ORDER[j]!];
}

export function landmarkFor(n: number): Landmark | null {
  if (n <= 0 || n % TUNE.landmarkEvery !== 0) return null;
  return LANDMARKS[(n / TUNE.landmarkEvery - 1) % LANDMARKS.length]!;
}

/** Peak of a house's roof (string anchor), hu above the baseline (negative). */
export function peakY(h: StreetHouse): number {
  const sp = h.spec;
  return -(sp.bodyH + sp.roofH * (sp.roof === "gable" ? 1 : 0.95)) * h.scale;
}

/** y of the festival string at x on a swag. */
export function swagY(sw: Swag, x: number): number {
  const t = (x - sw.ax) / (sw.bx - sw.ax);
  return sw.ay + (sw.by - sw.ay) * t + sw.sag * 4 * t * (1 - t);
}

export function buildStreet(gentle: number, festival: readonly FestivalLantern[]): Street {
  const n0 = Math.max(0, Math.floor(gentle));
  const total = n0 + TUNE.ahead;
  const houses: StreetHouse[] = [];
  const items: StreetItem[] = [];
  let prev: StreetHouse | null = null;
  let gapItems: { kind: StreetItem["kind"]; n: number }[] = [];
  for (let n = 1; n <= total; n++) {
    const lit = n <= n0;
    const scale = lit ? 1 : TUNE.aheadScale[n - n0 - 1] ?? 0.6;
    const spec = houseFor(seedKeyFor("gentle", n), n);
    let x: number;
    if (!prev) x = TUNE.startHu + 0.5 * scale;
    else {
      const ps = prev.scale;
      let gap = TUNE.gapHu * (prev.lit ? 1 : TUNE.aheadGapScale) * ps;
      const lamp = gapItems.some((g) => g.kind === "lamp");
      const land = gapItems.find((g) => g.kind !== "lamp");
      if (lamp) gap += TUNE.lampGapHu * ps;
      if (land) gap += TUNE.landmarkGapHu * ps;
      const L = prev.x + 0.5 * ps;
      x = L + gap + 0.5 * scale;
      const R = L + gap;
      // lamp alone: middle of the yard; with a landmark: lamp near the left house, landmark centred in the rest
      if (land && lamp) {
        const lampX = L + 0.42 * ps;
        items.push({ kind: "lamp", n: prev.n, x: lampX, scale: ps, lit: prev.lit });
        items.push({ kind: land.kind, n: prev.n, x: (lampX + 0.2 * ps + R - 0.28 * ps) / 2, scale: ps, lit: prev.lit });
      } else if (lamp) items.push({ kind: "lamp", n: prev.n, x: (L + R) / 2, scale: ps, lit: prev.lit });
      else if (land) items.push({ kind: land.kind, n: prev.n, x: (L + R) / 2, scale: ps, lit: prev.lit });
    }
    const h: StreetHouse = { n, x, scale, lit, spec, keepsakes: lit ? keepsakesFor(n) : [] };
    houses.push(h);
    prev = h;
    // milestones earned by house n stand in the yard after it (only between houses that are shown)
    gapItems = [];
    if (n < total) {
      if (n % TUNE.lampEvery === 0) gapItems.push({ kind: "lamp", n });
      const lm = landmarkFor(n);
      if (lm) gapItems.push({ kind: lm, n });
    }
  }
  const last = houses[houses.length - 1]!;
  const length = last.x + 0.5 * last.scale + TUNE.endHu;
  const newest = n0 > 0 ? houses[n0 - 1]! : houses[0]!;

  // festival string: roof peak → roof peak over the lit houses, ending on the first dark house
  const anchors = houses.slice(0, Math.max(2, n0 + 1));
  const swags: Swag[] = [];
  for (let k = 0; k + 1 < anchors.length; k++) {
    const a = anchors[k]!;
    const b = anchors[k + 1]!;
    const ax = a.x;
    const bx = b.x;
    swags.push({ ax, ay: peakY(a) - 0.04, bx, by: peakY(b) - 0.04, sag: 0.16 + 0.07 * (bx - ax) });
  }
  // newest day hangs nearest the frontier; walk back swag by swag
  const lanterns: StreetLanternPos[] = [];
  let d = festival.length - 1;
  for (let k = swags.length - 1; k >= 0 && d >= 0; k--) {
    const sw = swags[k]!;
    const x0 = sw.ax + TUNE.peakClearHu;
    const x1 = sw.bx - TUNE.peakClearHu;
    const inner = x1 - x0;
    if (inner <= 0) continue;
    const cnt = Math.max(1, Math.floor(inner / TUNE.lanternPitchHu));
    for (let i = cnt - 1; i >= 0 && d >= 0; i--, d--) {
      const x = x0 + ((i + 0.5) * inner) / cnt;
      lanterns.push({ x, y: swagY(sw, x), state: festival[d]! });
    }
  }
  lanterns.reverse();
  // the string only runs where it carries lanterns (plus the frontier swag)
  const firstUsed = lanterns.length > 0 ? swags.findIndex((s) => s.bx > lanterns[0]!.x) : swags.length - 1;
  return { gentle: n0, houses, items, swags: swags.slice(Math.max(0, firstUsed)), lanterns, length, focusX: newest.x };
}

/** Left / right edge of a house body, hu. */
const houseL = (h: StreetHouse): number => h.x - h.spec.left * h.scale;
const houseR = (h: StreetHouse): number => h.x + h.spec.right * h.scale;

/**
 * First view of the street (scroll x in pt, before clamping): as many lit houses fully in view
 * as possible, the newest one always among them, and — when that costs no lit house — the
 * newest further right, with the first dark house peeking in at the right edge ("next").
 *  S  pt per hu,  W  view width (pt).
 */
export function openingScroll(street: Street, S: number, W: number): number {
  const lit = street.houses.filter((h) => h.lit);
  if (lit.length === 0) return street.focusX * S - W * 0.4;
  const newest = lit[lit.length - 1]!;
  const edge = 0.12 * S; // breathing room at the screen edges
  const peek = 0.45 * S; // how much street after the newest house the view keeps (the first dark house's edge)
  // scroll range that keeps the newest house fully in view
  const lo = houseR(newest) * S + peek - W;
  const hi = houseL(newest) * S - edge;
  if (lo >= hi) return (newest.x * S) - W / 2; // a house wider than the screen (never at phone sizes)
  const count = (sx: number): number => lit.filter((h) => houseL(h) * S >= sx + edge * 0.5 && houseR(h) * S <= sx + W - edge * 0.5).length;
  // candidates: the newest at the right (lo), or any lit house's left edge at the screen's left
  const cands = [lo, ...lit.map((h) => houseL(h) * S - edge).filter((x) => x > lo && x < hi)];
  let best = lo;
  let bestN = count(lo);
  for (const c of cands) {
    const n = count(c);
    if (n > bestN) {
      best = c;
      bestN = n;
    }
  }
  return best;
}
