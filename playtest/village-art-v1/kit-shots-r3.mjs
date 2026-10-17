// Round 3 (owner: full village) — kit captures from the REAL app modules (the app's Vite dev server):
// 7 residents × 6 expressions + portraits, 24 items × colourways (+ locked), 4 times × 4 seasons, the room
// window per time, the market stall, the request bubbles, the room postcard, and the worst case
// (night + winter, all residents) at full size. Writes @2x PNGs to playtest/shots/village-v4/.
//   (cd apps/client && npx vite --mode e2e --port 4421) ; node playtest/village-art-v1/kit-shots-r3.mjs [base] [out]
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire("/Users/hyukahn/workspace/puzzle-lab/apps/client/package.json");
const { chromium } = require("playwright");

const BASE = process.argv[2] ?? "http://localhost:4421";
const OUT = process.argv[3] ?? "/Users/hyukahn/workspace/puzzle-lab/playtest/shots/village-v4/";
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 900, height: 900 } })).newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
await page.goto(BASE + "/404-kit-r3");

const res = await page.evaluate(async () => {
  const K = await import("/src/render/village/index.ts");
  const F = await import("/src/render/village/furniture.ts");
  const A = K.villageArt;
  const SC = 2;
  const out = {};
  const make = (w, h, bg = "#2A2350") => {
    const c = document.createElement("canvas");
    c.width = Math.round(w * SC);
    c.height = Math.round(h * SC);
    const g = c.getContext("2d");
    g.scale(SC, SC);
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    return { c, g };
  };
  const ids = ["wick", "momo", "sage", "luna", "pip", "kuri", "yuki"];
  // residents × expressions + portraits
  {
    const ex = ["idle", "talk", "happy", "shy", "sleepy", "silhouette"];
    const { c, g } = make(24 + 7 * 66, 24 + ids.length * 76, "#3A2F63");
    ids.forEach((id, j) => {
      ex.forEach((e, i) => A.drawResident(g, id, e, { x: 16 + i * 66, y: 14 + j * 76, w: 60, h: 64 }));
      const cx = 16 + 6 * 66 + 30, cy = 14 + j * 76 + 32, r = 26;
      g.save();
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fillStyle = "#2B2552";
      g.fill();
      g.clip();
      A.drawPortrait(g, id, "talk", cx, cy, r);
      g.restore();
    });
    out.r3_residents = c;
  }
  // furniture: every item × colourway (card fit) + the locked silhouettes
  {
    const items = F.FURNITURE_IDS;
    const cards = [];
    for (const id of items) for (const cw of F.ITEMS[id].colorways) cards.push({ id, cw, locked: false });
    for (const id of items) cards.push({ id, cw: F.ITEMS[id].colorways[0], locked: true });
    const cols = 8, cw = 64, ch = 74, gap = 8;
    const { c, g } = make(16 + cols * (cw + gap), 16 + Math.ceil(cards.length / cols) * (ch + gap));
    cards.forEach((o, i) => {
      const x = 10 + (i % cols) * (cw + gap), y = 10 + Math.floor(i / cols) * (ch + gap);
      g.fillStyle = o.locked ? "#E9DCC6" : "#FFF3DE";
      g.beginPath();
      g.roundRect(x, y, cw, ch, 9);
      g.fill();
      A.drawFurniture(g, o.id, o.cw, { x: x + 6, y: y + 6, w: cw - 12, h: ch - 20 }, { locked: o.locked, fit: "card" });
      g.font = "600 7px system-ui";
      g.fillStyle = "#3B2C45";
      g.textAlign = "center";
      g.fillText(`${o.id}${o.locked ? "·🔒" : "·" + o.cw}`, x + cw / 2, y + ch - 4);
    });
    out.r3_furniture = c;
  }
  // 4 times × 4 seasons (village with its 8 houses, the time wash over the houses too)
  {
    const tw = 215, th = 466;
    const { c, g } = make(4 * tw + 30, 4 * th + 30);
    K.TIMES.forEach((time, i) =>
      K.SEASONS.forEach((season, j) => {
        const at = { x: 6 + i * (tw + 6), y: 6 + j * (th + 6), w: tw, h: th };
        g.save();
        g.beginPath();
        g.rect(at.x, at.y, at.w, at.h);
        g.clip();
        A.drawVillageBackdrop(g, at, { time, season });
        const L = K.villageLayout(at);
        for (const id of [...ids, "cottage"]) A.drawLanternHouse(g, { resident: id, lit: time !== "day", eve: false, seed: 3, season }, L.houses[id]);
        A.drawTimeWash(g, at, time);
        g.restore();
        g.font = "700 11px system-ui";
        g.fillStyle = "#FFF3DE";
        g.fillText(`${time} · ${season}`, at.x + 6, at.y + 14);
      }),
    );
    out.r3_times_seasons = c;
  }
  // the room's window per time (season varies with the row)
  {
    const { c, g } = make(4 * 210 + 10, 2 * 230 + 10, "#191838");
    K.TIMES.forEach((time, i) =>
      ["summer", "winter"].forEach((season, j) => A.drawRoom(g, { x: 5 + i * 210, y: 5 + j * 230, w: 200, h: 220 }, { wallpaper: i % 3, floor: j, time, season })),
    );
    out.r3_room_times = c;
  }
  // market stall with today's three, and the request bubbles over residents
  {
    const { c, g } = make(430, 560);
    const st = A.drawMarketStall(g, { x: 30, y: 10, w: 370, h: 300 });
    ["armchair", "rockingChair", "snowGlobe", "candles"].slice(1).forEach((id, i) => A.drawFurniture(g, id, F.ITEMS[id].colorways[0], st.slots[i], { fit: "card" }));
    K.REQUEST_CATEGORIES.forEach((cat, i) => {
      const id = ids[i % ids.length];
      const at = { x: 12 + (i % 5) * 84, y: 360 + Math.floor(i / 5) * 100, w: 60, h: 64 };
      A.drawResident(g, id, "talk", at);
      const h = K.residentHead(at, id);
      A.drawRequestBubble(g, h.x, h.y, 15, cat);
    });
    out.r3_market_requests = c;
  }
  // the room postcard: 1080 × 1350 (drawn at 3× in 360 × 450 pt)
  {
    const c = document.createElement("canvas");
    c.width = 1080;
    c.height = 1350;
    const g = c.getContext("2d");
    g.scale(3, 3);
    const pc0 = A.drawPostcardFrame(g, { x: 0, y: 0, w: 360, h: 450 });
    const pc = { room: pc0.picture, caption: pc0.caption };
    g.save();
    g.beginPath();
    g.roundRect(pc.room.x, pc.room.y, pc.room.w, pc.room.h, 6);
    g.clip();
    A.drawCottageOutside(g, pc.room, { x: pc.room.x + 8, y: pc.room.y + 6, w: pc.room.w - 16, h: pc.room.h - 12 });
    const rb = { x: pc.room.x + 8, y: pc.room.y + 6, w: pc.room.w - 16, h: pc.room.h - 12 };
    A.drawRoom(g, rb, { wallpaper: 0, floor: 0, time: "dusk", season: "winter" });
    const R = K.roomGeometry(rb);
    A.drawFurniture(g, "roundRug", "rose", R.rug);
    for (const [s, id, cw] of [[1, "paperLantern", "cream"], [3, "smallPot", "cream"], [7, "teaTable", "cream"], [16, "wreath", "rose"], [11, "rockingChair", "sage"], [0, "dresser", "rose"]]) A.drawFurniture(g, id, cw, R.slots[s]);
    A.drawRoomGuests(g, rb);
    g.restore();
    g.font = "600 13px system-ui";
    g.fillStyle = "#3B2C45";
    g.fillText("(the scene writes the caption here)", pc.caption.x, pc.caption.y + 20);
    out.r3_postcard = c;
  }
  // worst case at full size: night + winter, all residents out
  {
    const W = 430, H = 932;
    const { c, g } = make(W, H);
    const at = { x: 0, y: 0, w: W, h: H };
    A.drawVillageBackdrop(g, at, { time: "night", season: "winter" });
    const L = K.villageLayout(at);
    for (const id of [...ids, "cottage"]) A.drawLanternHouse(g, { resident: id, lit: true, eve: false, seed: 5, season: "winter" }, L.houses[id]);
    A.drawTimeWash(g, at, "night");
    for (const id of ids) {
      const b = L.houses[id];
      A.drawResident(g, id, "happy", { x: b.x + b.w * 0.72, y: b.y + b.h - 40, w: 36, h: 40 });
    }
    out.r3_night_winter = c;
  }
  const r = {};
  for (const [k, c] of Object.entries(out)) r[k] = c.toDataURL("image/png");
  return { r, mem: K.estimateVillageBytes(430, 932, 2) };
});
for (const [k, url] of Object.entries(res.r)) {
  writeFileSync(`${OUT}kit-${k}.png`, Buffer.from(url.split(",")[1], "base64"));
  console.log("wrote", k);
}
const mb = (b) => (b / 1048576).toFixed(1);
console.log("G4 worst case @2x MB: village", mb(res.mem.village), "room", mb(res.mem.room), "extras", mb(res.mem.extras), "total", mb(res.mem.total));
await browser.close();
