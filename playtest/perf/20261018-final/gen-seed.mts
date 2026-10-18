// Writes worst-village.json: the G4 worst case from e2e/village-shots.spec.ts (7 residents, 14 lit days, full cottage, winter night)
import { writeFileSync } from "node:fs";
import { emptyRoom, encodeRoom, place } from "/Users/hyukahn/workspace/puzzle-lab/apps/client/src/village/model.ts";
import { pieceBit } from "/Users/hyukahn/workspace/puzzle-lab/apps/client/src/village/catalog.ts";
let r = emptyRoom();
const put = (slot: number, item: string, cw: string): void => { r = place(r, slot, pieceBit({ item: item as never, cw: cw as never })) ?? r; };
put(0, "bookshelf", "sage"); put(1, "floorLamp", "cream"); put(3, "dresser", "rose"); put(4, "cactus", "sage"); put(5, "rockingChair", "rose");
put(7, "roundTable", "cream"); put(9, "candles", "cream"); put(10, "knitBasket", "rose"); put(12, "cushion", "rose"); put(14, "snowGlobe", "cream");
put(15, "stringLights", "rose"); put(16, "wreath", "sage"); put(17, "hangingPlant", "sage"); put(0, "stripedRug", "rose");
const DAY = Math.floor(Date.UTC(2026, 11, 20) / 86_400_000);
const pd = Array.from({ length: 14 }, (_, i) => DAY - 13 + i);
const u = ["floorLamp:cream", "dresser:rose", "cactus:sage", "rockingChair:rose", "roundTable:cream", "candles:cream", "stringLights:rose", "wreath:sage", "hangingPlant:sage", "bookshelf:sage", "stripedRug:rose"]
  .map((k) => pieceBit({ item: k.split(":")[0] as never, cw: k.split(":")[1] as never }));
writeFileSync(new URL("./worst-village.json", import.meta.url), JSON.stringify({
  sv: { pd, ch: pd, lr: [1, 2, 3, 4, 5, 6], u, mk: [], q: [4, 5, 20, 21, 8], w: [], r: { "0": { s: encodeRoom(r), n: 1, at: 1, dev: "shotdev0" } } },
  loc: { visits: 9, lastVisit: DAY - 1, season: "winter" },
}));
