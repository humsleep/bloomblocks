// Render the village mockups: node playtest/village-mock/render.mjs [view …]
// Each view → playtest/shots/village-mock/<file>.png at dpr 3 (430×932 pt → 1290×2796), and its
// detail crops at 2× that density (dpr 6).
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs";
import path from "node:path";
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../../apps/client/package.json"));
const { chromium } = require("playwright");
const out = path.join(here, "../shots/village-mock-v2");
fs.mkdirSync(out, { recursive: true });
const JOBS = {
  pilot: { file: "e-pilot-furniture", dpr: 2 },
  village: { file: "a-village", dpr: 3 },
  room: { file: "b-room-decorate", dpr: 3 },
  gift: { file: "c-letter-gift", dpr: 3 },
  board: { file: "d-board-reskin", dpr: 3 },
  puzzle: { file: "g-puzzle-house-before-after", dpr: 2 },
  dialog: { file: "f-dialogue-card-locales", dpr: 2 },
  icons: { file: "h-icons-1x", dpr: 3 },
};
const only = process.argv.slice(2);
const browser = await chromium.launch({ args: ["--allow-file-access-from-files"] });
for (const [view, job] of Object.entries(JOBS)) {
  if (only.length && !only.includes(view)) continue;
  for (const dpr of [job.dpr, job.dpr * 2]) {
    const page = await browser.newPage({ viewport: { width: 1700, height: 1200 } });
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
    await page.goto(pathToFileURL(path.join(here, "scenes.html")).href + `?view=${view}&dpr=${dpr}`);
    await page.waitForSelector("body[data-ready='1']", { timeout: 60000 });
    const err = await page.evaluate(() => document.body.dataset.err || "");
    if (err) errs.push(err);
    const crops = await page.evaluate((dpr) => {
      const sc = window.Scenes[new URLSearchParams(location.search).get("view")];
      const src = document.querySelector("canvas");
      return (sc.crops || []).map(([name, x, y, w, h]) => {
        const c = document.createElement("canvas");
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
        c.getContext("2d").drawImage(src, x * dpr, y * dpr, w * dpr, h * dpr, 0, 0, c.width, c.height);
        return [name, c.toDataURL("image/png")];
      });
    }, dpr);
    if (dpr === job.dpr) {
      const url = await page.evaluate(() => document.querySelector("canvas").toDataURL("image/png"));
      fs.writeFileSync(path.join(out, job.file + ".png"), Buffer.from(url.split(",")[1], "base64"));
      // 1× crops: what the eye gets on the phone (Reality checks line weights here)
      for (const [name, url1] of crops) fs.writeFileSync(path.join(out, `${job.file}-crop-${name}-1x.png`), Buffer.from(url1.split(",")[1], "base64"));
    } else {
      for (const [name, url2] of crops) fs.writeFileSync(path.join(out, `${job.file}-crop-${name}-2x.png`), Buffer.from(url2.split(",")[1], "base64"));
    }
    console.log(view, `dpr ${dpr}`, errs.length ? errs : "ok");
    await page.close();
  }
}
await browser.close();
