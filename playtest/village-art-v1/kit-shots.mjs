// v14 village art — G1 shots of the REAL app modules (apps/client/src/render/village/*, served by the
// app's own Vite dev server in e2e mode), composed the way the village scene will (contract boxes).
//   (cd apps/client && npx vite --mode e2e --port 4420) ; node playtest/village-art-v1/kit-shots.mjs [base] [out]
// Writes @2x PNGs (the bake scale, contract §4) + 1× copies, and checks.json (fit / clip / G8 data checks).
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire("/Users/hyukahn/workspace/puzzle-lab/apps/client/package.json");
const { chromium } = require("playwright");

const BASE = process.argv[2] ?? "http://localhost:4420";
const OUT = process.argv[3] ?? "/Users/hyukahn/workspace/puzzle-lab/playtest/shots/v14-village/";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 1 })).newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
page.on("console", (m) => m.type() === "error" && console.log("console:", m.text()));
await page.goto(BASE + "/404-kit-shots");

const scenes = await page.evaluate(async () => {
  const K = await import("/src/render/village/index.ts");
  const A = K.villageArt;
  const out = {};
  const checks = {};
  const SC = 2;
  const make = (w, h) => {
    const c = document.createElement("canvas");
    c.width = Math.round(w * SC);
    c.height = Math.round(h * SC);
    const g = c.getContext("2d");
    g.scale(SC, SC);
    return { c, g };
  };
  const font = await K.loadVillageFont("en");
  const fontKo = await K.loadVillageFont("ko");
  const label = (g, s, x, y, px = 13, col = "#FFF3DE", stack = font, align = "center") => {
    g.font = `600 ${px}px ${stack}`;
    g.fillStyle = col;
    g.textAlign = align;
    g.fillText(s, x, y);
  };

  // (a) the village at dusk: backdrop + the six plots + residents + the mailbox
  {
    const W = 430, H = 932;
    const { c, g } = make(W, H);
    const at = { x: 0, y: 0, w: W, h: H };
    A.drawVillageBackdrop(g, at);
    const L = K.villageLayout(at);
    const spec = {
      sage: { resident: "sage", lit: true, eve: false, seed: 3 },
      luna: { resident: "luna", lit: false, eve: true, seed: 5 },
      wick: { resident: "wick", lit: true, eve: false, seed: 1 },
      momo: { resident: "momo", lit: true, eve: false, seed: 2 },
      pip: { resident: null, lit: false, eve: false, seed: 9 },
      cottage: { resident: "cottage", lit: true, eve: false, seed: 4 },
    };
    for (const id of ["sage", "luna", "wick", "momo", "pip", "cottage"]) A.drawLanternHouse(g, spec[id], L.houses[id]);
    A.drawMailbox(g, L.mailbox, true);
    const res = (id, expr, x, y, s) => A.drawResident(g, id, expr, { x: x - s * 0.4, y: y - s * 0.86, w: s * 0.8, h: s * 0.86 });
    res("sage", "sleepy", 172, 458, 30);
    res("momo", "shy", 286, 668, 44);
    res("wick", "happy", 206, 732, 70);
    out.a_village = c;
    checks.village = { houses: Object.fromEntries(Object.entries(L.houses).map(([k, b]) => [k, b])) };
  }

  // (b) the cottage room: shell + furniture in the 18 slots + the rug + Wick and Momo + the heart emote
  {
    const W = 430, H = 520;
    const { c, g } = make(W, H);
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#191838");
    bg.addColorStop(1, "#241F48");
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    const at = { x: 10, y: 50, w: 410, h: 440 };
    A.drawRoom(g, at, { wallpaper: 0, floor: 0 });
    const R = K.roomGeometry(at);
    const put = (slot, id, cw, span = 1) => {
      const b = R.slots[slot];
      const box = span === 2 ? { x: b.x, y: b.y, w: b.w * 2, h: b.h } : b;
      A.drawFurniture(g, id, cw, box);
    };
    A.drawFurniture(g, "roundRug", "sage", R.rug);
    // back row 0..4, mid 5..9, front 10..14, wall 15..17
    put(15, "frame", "cream");
    put(16, "wallClock", "sage");
    put(0, "bookshelf", "sage");
    put(1, "paperLantern", "cream");
    put(3, "smallBed", "rose", 2);
    put(5, "archChair", "rose");
    put(7, "teaTable", "cream");
    put(8, "cushion", "rose");
    put(9, "smallPot", "sage");
    put(10, "flowerVase", "rose");
    put(13, "teapot", "sage");
    // Momo on her cushion (slot 8), Wick in the front row (slot 11)
    const m8 = R.slots[8];
    const momoBox = { x: m8.x + m8.w * 0.12, y: m8.y + m8.h * 0.12, w: m8.w * 0.76, h: m8.h * 0.62 };
    A.drawResident(g, "momo", "happy", momoBox);
    const head = K.residentHead(momoBox, "momo");
    K.drawEmote(g, head.x, head.y, 12, "heart");
    const s11 = R.slots[11];
    A.drawResident(g, "wick", "talk", { x: s11.x, y: s11.y + s11.h * 0.25, w: s11.w, h: s11.h * 0.75 });
    // empty slot markers are the scene's; show slot 12 + 14 outlines faintly for the check
    out.b_room = c;
    checks.room = { slots: R.slots.length, k: R.k };
  }

  // (c) the drawer cards: every item × every colourway at 64 pt, then the locked silhouettes (G8)
  {
    const ids = A.furnitureIds;
    const cols = 6, cw = 64, ch = 84, gap = 10;
    const rows = Math.ceil(ids.reduce((n, id) => n + 1, 0) * 3 / cols) + 2;
    const W = 16 + cols * (cw + gap), H = 40 + rows * (ch + gap) + 40;
    const { c, g } = make(W, H);
    g.fillStyle = "#2A2350";
    g.fillRect(0, 0, W, H);
    const cws = { paperLantern: ["cream", "sage", "rose"], archChair: ["cream", "sage", "rose"], cushion: ["rose", "cream"], teaTable: ["cream", "sage", "rose"], smallBed: ["cream", "sage", "rose"], smallPot: ["sage", "cream", "rose"], flowerVase: ["rose", "cream"], bookshelf: ["cream", "sage", "rose"], roundRug: ["sage", "rose"], wallClock: ["cream", "sage"], frame: ["cream", "rose"], teapot: ["rose", "sage"] };
    const cards = [];
    for (const id of ids) for (const cv of cws[id]) cards.push({ id, cv, locked: false });
    for (const id of ids) cards.push({ id, cv: cws[id][0], locked: true });
    const clip = [];
    cards.forEach((o, i) => {
      const x = 12 + (i % cols) * (cw + gap), y = 30 + Math.floor(i / cols) * (ch + gap);
      g.fillStyle = o.locked ? "#E9DCC6" : "#FFF3DE";
      g.beginPath();
      g.roundRect(x, y, cw, ch, 10);
      g.fill();
      const art = { x: x + 6, y: y + 6, w: cw - 12, h: ch - 30 };
      // draw into its own layer to measure whether anything crosses the art box (catalog clip, #9)
      const L = document.createElement("canvas");
      L.width = W * SC;
      L.height = H * SC;
      const lg = L.getContext("2d");
      lg.scale(SC, SC);
      A.drawFurniture(lg, o.id, o.cv, art, { locked: o.locked, fit: "card" });
      const d = lg.getImageData(0, 0, L.width, L.height).data;
      let out = 0;
      for (let yy = Math.floor((y - 4) * SC); yy < Math.ceil((y + ch + 4) * SC); yy++)
        for (let xx = Math.floor((x - 4) * SC); xx < Math.ceil((x + cw + 4) * SC); xx++) {
          const inside = xx >= (art.x - art.w * 0.12) * SC && xx < (art.x + art.w * 1.12) * SC && yy >= (art.y - art.h * 0.12) * SC && yy < (art.y + art.h * 1.12) * SC;
          if (!inside && d[(yy * L.width + xx) * 4 + 3] > 24) out++;
        }
      clip.push({ id: o.id, cw: o.cv, locked: o.locked, pxOutsidePad: out });
      g.save();
      g.beginPath();
      g.roundRect(x, y, cw, ch, 10);
      g.clip();
      g.drawImage(L, 0, 0, W, H);
      g.restore();
      label(g, o.locked ? "locked" : o.cv, x + cw / 2, y + ch - 14, 9, "#7A6A86");
      label(g, o.id, x + cw / 2, y + ch - 4, 8, "#3B2C45");
    });
    out.c_catalog = c;
    checks.catalog = clip;
  }

  // (d) the gift (closed / opening) on its cushion, the envelope, the letter with text ON its lines
  {
    const W = 430, H = 640;
    const { c, g } = make(W, H);
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#2A2350");
    bg.addColorStop(1, "#3A2F63");
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    K.drawGiftCushion(g, { x: 20, y: 160, w: 120, h: 30 }, "#F6A7B8", 0.2);
    K.drawGift(g, { x: 30, y: 60, w: 100, h: 108 }, { paper: "#A8DCC8", ribbon: "#F2907A", open: 0 });
    K.drawGiftCushion(g, { x: 160, y: 160, w: 120, h: 30 }, "#F6A7B8", 0.55);
    K.drawGift(g, { x: 170, y: 40, w: 100, h: 128 }, { paper: "#A8DCC8", ribbon: "#F2907A", open: 0.7 });
    A.drawResident(g, "momo", "happy", { x: 282, y: 120, w: 50, h: 52 });
    const mh = K.residentHead({ x: 282, y: 120, w: 50, h: 52 }, "momo");
    K.drawEmote(g, mh.x, mh.y, 11, "heart");
    K.drawEnvelope(g, { x: 340, y: 124, w: 76, h: 50 }, "#E58C9E");
    // the letter: en (3 lines) and ko (3 lines), text laid out on letterLines()'s baselines
    const letter = (x, y, w, lines, stack) => {
      const px = 15;
      const h = K.letterHeight(w, lines.length + 1, px);
      const at = { x, y, w, h };
      K.drawLetterPaper(g, at, lines.length + 1, px, "#F6A7B8");
      const LL = K.letterLines(at, lines.length + 1, px);
      g.font = `600 ${px}px ${stack}`;
      g.fillStyle = "#3B2C45";
      g.textAlign = "left";
      lines.forEach((s, i) => g.fillText(s, LL.x0, LL.baselines[i]));
      g.textAlign = "right";
      g.fillText(lines === EN ? "— Momo" : "— 모모", LL.x1, LL.baselines[lines.length]);
      return { h, baselines: LL.baselines, blankLines: 0 };
    };
    const EN = ["Dear lantern-keeper,", "the petals on your sill are from", "my garden. Come for tea soon!"];
    const KO = ["등불지기에게,", "창가의 꽃잎은 우리 정원에서", "가져왔어. 곧 차 마시러 와!"];
    checks.letterEn = letter(20, 220, 390, EN, font);
    checks.letterKo = letter(20, 420, 390, KO, fontKo);
    out.d_gift_letter = c;
  }

  // (e) the five residents × expressions (talk / idle / happy / shy / sleepy / silhouette)
  {
    const ids = ["wick", "momo", "sage", "luna", "pip"];
    const ex = ["idle", "talk", "happy", "shy", "sleepy", "silhouette"];
    const W = 24 + ex.length * 66, H = 24 + ids.length * 76;
    const { c, g } = make(W, H);
    g.fillStyle = "#3A2F63";
    g.fillRect(0, 0, W, H);
    ids.forEach((id, j) => ex.forEach((e, i) => A.drawResident(g, id, e, { x: 16 + i * 66, y: 14 + j * 76, w: 60, h: 64 })));
    out.e_residents = c;
  }

  // (f) the room's wallpaper / floor variants (0..2), small
  {
    const W = 430, H = 170;
    const { c, g } = make(W, H);
    g.fillStyle = "#191838";
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 3; i++) A.drawRoom(g, { x: 8 + i * 140, y: 8, w: 134, h: 150 }, { wallpaper: i, floor: i });
    out.f_room_variants = c;
  }

  // (g) houses: lit / eve / empty / cottage, and every resident's colours
  {
    const W = 430, H = 220;
    const { c, g } = make(W, H);
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#352C5E");
    bg.addColorStop(1, "#302957");
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    const list = [["wick", true, false], ["momo", true, false], ["sage", true, false], ["luna", true, false], ["pip", true, false], ["luna", false, true], [null, false, false], ["cottage", true, false]];
    list.forEach(([r, lit, eve], i) => A.drawLanternHouse(g, { resident: r, lit, eve, seed: i * 7 + 1 }, { x: 4 + (i % 4) * 106, y: 6 + Math.floor(i / 4) * 106, w: 100, h: 100 }));
    out.g_houses = c;
  }
  // (h) G2: the letters in their handwriting faces (subset, renamed), en / ko / ja / zh-Hans / zh-Hant, SE text width
  {
    const L = [
      ["en", ["Um, hello,", "This cushion is from my old house. It's very brave.", "Now it's yours."], "— Momo"],
      ["ko", ["저, 안녕하세요,", "예전 집에서 가져온 쿠션이에요. 용감한 쿠션요.", "이제 당신 거예요."], "— 모모"],
      ["ja", ["えっと…こんにちは。モモです。", "あなたが灯した明かりのそばに、だれかの家ができますよ。", "ねえ、聞いてもいい？"], "— モモ"],
      ["zh-Hans", ["嗯……你好。我是桃桃。", "你点亮的每一盏灯旁边，都会有人住进新家。", "灯笼慢慢地亮起来了，真好看呀！"], "— 桃桃"],
      ["zh-Hant", ["嗯……你好。我是桃桃。", "你點亮的每一盞燈旁邊，都會有人住進新家。", "燈籠慢慢地亮起來了，真好看呀！"], "— 桃桃"],
    ];
    const W = 375, px = 17, pw = 343;
    const stacks = {};
    for (const [lang] of L) stacks[lang] = await K.loadVillageFont(lang, "letter");
    await document.fonts.ready;
    const wrapped = L.map(([lang, lines, sign]) => {
      const g0 = document.createElement("canvas").getContext("2d");
      g0.font = `600 ${px}px ${stacks[lang]}`;
      const maxW = pw * 0.82;
      const outL = [];
      const cjk = lang !== "en" && lang !== "ko";
      for (const line of lines) {
        const units = cjk ? [...line] : line.split(/(?<= )/);
        let cur = "";
        for (const u of units) {
          if (g0.measureText(cur + u).width > maxW && cur) {
            // kinsoku: never start a line with closing punctuation
            if (/^[、。，．！？）」』…～]/.test(u)) { cur += u; continue; }
            outL.push(cur.trimEnd());
            cur = u.trimStart();
          } else cur += u;
        }
        outL.push(cur);
      }
      return { lang, lines: outL, sign };
    });
    const heights = wrapped.map((w) => K.letterHeight(pw, w.lines.length + 1, px));
    const H = heights.reduce((a, b) => a + b + 20, 20);
    const { c, g } = make(W, H);
    g.fillStyle = "#2A2350";
    g.fillRect(0, 0, W, H);
    let y = 14;
    checks.letters = {};
    wrapped.forEach((w, i) => {
      const at = { x: 16, y, w: pw, h: heights[i] };
      K.drawLetterPaper(g, at, w.lines.length + 1, px, "#F6A7B8");
      const LL = K.letterLines(at, w.lines.length + 1, px);
      g.font = `600 ${px}px ${stacks[w.lang]}`;
      g.fillStyle = "#3B2C45";
      g.textAlign = "left";
      w.lines.forEach((s, j) => g.fillText(s, LL.x0, LL.baselines[j]));
      g.textAlign = "right";
      g.fillText(w.sign, LL.x1, LL.baselines[w.lines.length]);
      const loaded = [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family);
      checks.letters[w.lang] = { stack: stacks[w.lang].split(",")[0], lines: w.lines.length, loaded };
      y += heights[i] + 20;
    });
    out.h_letters_5locales = c;
  }
  const res = {};
  for (const [k, c] of Object.entries(out)) res[k] = { url: c.toDataURL("image/png"), w: c.width, h: c.height };
  return { res, checks, mem: K.estimateVillageBytes(430, 932, 2), mem3: K.estimateVillageBytes(430, 932, 3) };
});

const { res, checks, mem, mem3 } = scenes;
for (const [k, v] of Object.entries(res)) {
  writeFileSync(`${OUT}kit-${k}@2x.png`, Buffer.from(v.url.split(",")[1], "base64"));
  // the 1× copy: drawn by the browser at half size
  const one = await page.evaluate(async ({ url, w, h }) => {
    const im = new Image();
    im.src = url;
    await im.decode();
    const c = document.createElement("canvas");
    c.width = Math.round(w / 2);
    c.height = Math.round(h / 2);
    const g = c.getContext("2d");
    g.imageSmoothingQuality = "high";
    g.drawImage(im, 0, 0, c.width, c.height);
    return c.toDataURL("image/png");
  }, v);
  writeFileSync(`${OUT}kit-${k}@1x.png`, Buffer.from(one.split(",")[1], "base64"));
  console.log("wrote", k, v.w, "×", v.h);
}
const bad = checks.catalog.filter((c) => c.pxOutsidePad > 0);
console.log("catalog cards drawing outside box+PAD:", bad.length ? JSON.stringify(bad) : "none");
console.log("memory @2x MB", (mem.village / 1048576).toFixed(1), (mem.room / 1048576).toFixed(1), (mem.total / 1048576).toFixed(1), "@3x total MB", (mem3.total / 1048576).toFixed(1));
writeFileSync(`${OUT}kit-checks.json`, JSON.stringify({ checks, mem, mem3 }, null, 2));
await browser.close();
