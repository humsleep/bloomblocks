// Shared helpers for the client unit tests.
import { u32Hex } from "@core/bytes.ts";
import { stateHash } from "@core/game.ts";
import type { BB } from "@games/lanterns-pips/index.ts";
import { lanternsPips as G, type PipsLevel, type PipsState } from "../src/game/pipsApi.ts";
import { flush } from "../src/save/store.ts";
import { fakeBackend } from "./fakes/backend.ts";
import { lanternlyPath } from "./fakes/filesystem.ts";

export { fakeBackend };

/** Fresh device: no files, no preferences. */
export function resetDevice(): void {
  fakeBackend.reset();
}

/** Every queued write has landed (the store's serial queue). */
export async function settle(): Promise<void> {
  await flush();
  await flush();
}

export function readFile(name: string): string | null {
  return fakeBackend.readText(lanternlyPath(name));
}

export function writeFile(name: string, text: string): void {
  fakeBackend.files.set(lanternlyPath(name), { data: text, enc: "utf8" });
}

export function fileExists(name: string): boolean {
  return fakeBackend.files.has(lanternlyPath(name));
}

export function readBinary(name: string): Uint8Array | null {
  const f = fakeBackend.files.get(lanternlyPath(name));
  if (!f) return null;
  const s = f.enc === "base64" ? atob(f.data) : f.data;
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

export function setPref(key: string, value: string): void {
  fakeBackend.prefs.set(key, value);
}

export function cellsOf(bb: BB): number[] {
  const out: number[] = [];
  for (let i = 0; i < 64; i++) if (((i < 32 ? bb.lo >>> i : bb.hi >>> (i - 32)) & 1) === 1) out.push(i);
  return out;
}

export function lanternCells(s: PipsState): number[] {
  return cellsOf(s.lanterns);
}

export function floorCells(level: PipsLevel): number[] {
  const out: number[] = [];
  for (let y = 0; y < level.h; y++) {
    for (let x = 0; x < level.w; x++) {
      const i = y * 8 + x;
      if (((i < 32 ? level.stones.lo >>> i : level.stones.hi >>> (i - 32)) & 1) === 0) out.push(i);
    }
  }
  return out;
}

/** The journal text the session writes for a sequence of cells (header + "<move><hash>" lines). */
export function journalFor(levelId: number, seedKey: string, level: PipsLevel, cells: readonly number[]): string {
  let t = `PPJ1 ${u32Hex(levelId)} ${seedKey}\n`;
  let s = G.init(seedKey, level);
  for (const c of cells) {
    const next = G.apply(s, { x: c & 7, y: c >> 3 });
    if (!next) throw new Error(`illegal cell ${c}`);
    s = next;
    t += `${c.toString(16).padStart(2, "0")}${u32Hex(stateHash(G, s))}\n`;
  }
  return t;
}

/** Deterministic PRNG for test-side randomness (mulberry32). */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
