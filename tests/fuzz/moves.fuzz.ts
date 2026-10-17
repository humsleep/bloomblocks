// Random move sequences on every corpus level: apply() never throws, never mutates its input,
// returns null exactly for illegal moves, and the run.bin of the sequence round-trips and
// replays deterministically (CRC catches a flipped byte).
import { describe, expect, it } from "vitest";
import { bytesEqual } from "../../core/bytes.ts";
import { stateHash } from "../../core/game.ts";
import { decodeRun, encodeRun, MODE, recordRun, replay, verifyRun } from "../../core/runlog.ts";
import { analyze, hasBit, isComplete, lanternsPips as G, type PipsMove, type PipsState, TRACKS } from "../../games/lanterns-pips/index.ts";
import { corpus, deepFreeze, floor, prng } from "./corpus.ts";

describe.each(TRACKS)("%s: random move sequences", (track) => {
  it("never throw, never mutate, illegal ⇔ null, run.bin round-trip + deterministic replay", () => {
    const rnd = prng(track === "gentle" ? 0x51 : 0x52);
    for (const item of corpus(track)) {
      const { level } = item;
      const fl = floor(level);
      let s: PipsState = deepFreeze(G.init(item.label, level));
      const moves: PipsMove[] = [];
      const steps = 10 + Math.floor(rnd() * 50);
      for (let k = 0; k < steps; k++) {
        const r = rnd();
        // mostly floor cells, sometimes stones / off-board / non-integers
        const m: PipsMove = r < 0.85 ? { x: fl[Math.floor(rnd() * fl.length)]! & 7, y: fl[Math.floor(rnd() * fl.length)]! >> 3 }
          : r < 0.93 ? { x: Math.floor(rnd() * 10) - 1, y: Math.floor(rnd() * 10) - 1 }
          : { x: rnd() * 5, y: 1 };
        const before = G.stateBytes(s);
        let next: PipsState | null = null;
        expect(() => (next = G.apply(s, m)), `${item.label} ${JSON.stringify(m)}`).not.toThrow();
        expect(bytesEqual(G.stateBytes(s), before)).toBe(true);
        const legal = Number.isInteger(m.x) && Number.isInteger(m.y) && m.x >= 0 && m.y >= 0 && m.x < level.w && m.y < level.h
          && !hasBit(level.stones, m.y * 8 + m.x) && !isComplete(s);
        expect(next !== null, `${item.label} legality of ${JSON.stringify(m)}`).toBe(legal);
        if (next) {
          // exactly one bit toggled
          const st: PipsState = next;
          const i = m.y * 8 + m.x;
          expect(hasBit(st.lanterns, i)).toBe(!hasBit(s.lanterns, i));
          expect(analyze(st).used).toBe(analyze(s).used + (hasBit(st.lanterns, i) ? 1 : -1));
          s = deepFreeze(st);
          moves.push(m);
        }
      }
      // run.bin: record → encode → decode → verify; replay twice gives identical hashes
      const rec = recordRun(G, { seed: item.label, params: level, moves, mode: MODE.free, levelId: 7 });
      expect(stateHash(G, rec.state)).toBe(stateHash(G, s));
      const bytes = encodeRun(rec.run, G.moveWidth);
      const v = verifyRun(G, bytes, level);
      expect(v.ok).toBe(true);
      if (v.ok) {
        expect(bytesEqual(G.stateBytes(v.state), G.stateBytes(s))).toBe(true);
        expect(v.complete).toBe(isComplete(s));
      }
      const r1 = replay(G, decodeRun(bytes, 1), level);
      const r2 = replay(G, decodeRun(bytes, 1), level);
      expect(r1.perMoveHashes).toEqual(r2.perMoveHashes);
      if (bytes.length > 0) {
        const bad = bytes.slice();
        const at = Math.floor(rnd() * bad.length);
        bad[at] = bad[at]! ^ 0x5a;
        expect(verifyRun(G, bad, level).ok).toBe(false);
      }
    }
  });

  it("every move after completion is illegal", () => {
    for (const item of corpus(track).slice(0, 100)) {
      let s = G.init(item.label, item.level);
      for (let i = 0; i < 64; i++) if (hasBit(item.solution, i)) s = G.apply(s, { x: i & 7, y: i >> 3 })!;
      expect(isComplete(s)).toBe(true);
      for (const c of floor(item.level)) expect(G.apply(s, { x: c & 7, y: c >> 3 })).toBeNull();
    }
  });
});
