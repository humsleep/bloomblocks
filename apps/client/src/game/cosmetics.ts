// R4 rewards (docs/team/r4-village-story-rewards.md §3): the cottage's cozy level and the residents' friendship
// unlock lantern skins and board themes for the puzzle screen, a third streak shield (level 3) and the
// "cozy evening" (level 5: 30 min without interstitials after a village visit, once a day).
// What is unlocked = the synced village bits v.cz (written by the village, OR-merged, never cleared). The
// chosen skin / theme are device settings (Preferences), read before the first bake like the number style.
import { Preferences } from "@capacitor/preferences";
import { setBoardTheme } from "../render/court.ts";
import { setShieldsPerMonth } from "./shieldCount.ts";

export const SKINS = ["wick", "momo", "sage", "luna", "pip", "kuri", "yuki"] as const;
export type LanternSkin = (typeof SKINS)[number];
export const THEMES = ["stone", "garden", "snow"] as const;
export type BoardTheme = (typeof THEMES)[number];

/** v.cz bit for cozy level k (1–5) */
export const cozyBit = (k: number): number => k;
/** v.cz bit for a resident's lantern (friendship 3), by catalog index */
export const friendBit = (residentIndex: number): number => 10 + residentIndex;

/** How a skin / theme unlocks: a cozy level and / or the resident's friendship (null = always). */
export const SKIN_NEEDS: Readonly<Record<LanternSkin, { cozy: number | null; friend: boolean }>> = {
  wick: { cozy: null, friend: false },
  momo: { cozy: 1, friend: true },
  sage: { cozy: 1, friend: true },
  luna: { cozy: 4, friend: true },
  kuri: { cozy: 4, friend: true },
  pip: { cozy: null, friend: true },
  yuki: { cozy: null, friend: true },
};
export const THEME_NEEDS: Readonly<Record<BoardTheme, number>> = { stone: 0, garden: 2, snow: 4 };
/** cozy level of the third shield and of the cozy evening */
export const SHIELD_LEVEL = 3;
export const EVENING_LEVEL = 5;

export function skinUnlocked(skin: LanternSkin, cz: readonly number[]): boolean {
  const n = SKIN_NEEDS[skin];
  if (n.cozy === null && !n.friend) return true;
  return (n.cozy !== null && cz.includes(cozyBit(n.cozy))) || (n.friend && cz.includes(friendBit(SKINS.indexOf(skin))));
}
export function themeUnlocked(t: BoardTheme, cz: readonly number[]): boolean {
  return THEME_NEEDS[t] === 0 || cz.includes(cozyBit(THEME_NEEDS[t]));
}
/** Highest cozy level reached (0–5). */
export const cozyReached = (cz: readonly number[]): number => [5, 4, 3, 2, 1].find((k) => cz.includes(cozyBit(k))) ?? 0;

// ---------------------------------------------------------------- state

// shortcut: the chosen skin / theme live in this device's Preferences (not the iCloud settings mirror), so a
// second device starts on Wick + stone; add them to sync SETTING_KEYS if players ask for it.
let skin: LanternSkin = "wick";
let theme: BoardTheme = "stone";
let cz: number[] = [];
/** bumps when the skin / theme changes (the puzzle scene re-bakes its board once) */
let version = 0;

const asSkin = (v: string | null): LanternSkin => (SKINS as readonly string[]).includes(v ?? "") ? (v as LanternSkin) : "wick";
const asTheme = (v: string | null): BoardTheme => (THEMES as readonly string[]).includes(v ?? "") ? (v as BoardTheme) : "stone";

/** Read before the first board bake (two tiny Preferences reads, in parallel with the save restore). */
export async function loadCosmetics(): Promise<void> {
  try {
    const [a, b] = await Promise.all([Preferences.get({ key: "lanternSkin" }), Preferences.get({ key: "boardTheme" })]);
    skin = asSkin(a.value);
    theme = asTheme(b.value);
  } catch {
    /* defaults */
  }
  setBoardTheme(theme);
}

/** The unlock bits from the village save (Preferences "village" → sv.cz). After the first frame only. */
export async function refreshUnlocks(): Promise<readonly number[]> {
  try {
    const r = await Preferences.get({ key: "village" });
    const o = r.value ? (JSON.parse(r.value) as { sv?: { cz?: unknown } }) : null;
    const xs = Array.isArray(o?.sv?.cz) ? (o.sv.cz as unknown[]) : [];
    cz = xs.filter((x): x is number => Number.isInteger(x) && (x as number) >= 0);
  } catch {
    /* keep what we had */
  }
  setShieldsPerMonth(shieldsPerMonth());
  return cz;
}
/** The village tells us right away when it writes new bits (no Preferences round trip). */
export function noteUnlocks(bits: readonly number[]): void {
  cz = [...bits];
  setShieldsPerMonth(shieldsPerMonth());
}

export const unlocks = (): readonly number[] => cz;
export const lanternSkin = (): LanternSkin => skin;
export const boardTheme = (): BoardTheme => theme;
export const cosmeticsVersion = (): number => version;
/** Streak shields per calendar month: 2, or 3 from cozy level 3. */
export const shieldsPerMonth = (): number => (cz.includes(cozyBit(SHIELD_LEVEL)) ? 3 : 2);

export function chooseSkin(s: LanternSkin): void {
  if (s === skin || !skinUnlocked(s, cz)) return;
  skin = s;
  version++;
  void Preferences.set({ key: "lanternSkin", value: s });
}
export function chooseTheme(t: BoardTheme): void {
  if (t === theme || !themeUnlocked(t, cz)) return;
  theme = t;
  version++;
  setBoardTheme(t);
  void Preferences.set({ key: "boardTheme", value: t });
}

// ---------------------------------------------------------------- notes for the puzzle screen

/** What the village visit brought, said once in the band when the puzzle screen comes back. */
export type CozyNote = "reward" | "evening";
let note: CozyNote | null = null;
export function notePending(n: CozyNote): void {
  if (note !== "reward") note = n; // a new reward outranks the evening (both are good news; one line)
}
export function takeNote(): CozyNote | null {
  const n = note;
  note = null;
  return n;
}
