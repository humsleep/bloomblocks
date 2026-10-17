// Refreshes SKAdNetworkItems in ios/App/App/Info.plist from the networks' own published lists:
// Google (AdMob) + the planned iOS bidding partners AppLovin, Unity, Mintegral (v3 §2-4).
// Adapter SDKs are NOT added yet — only their SKAdNetwork IDs, so attribution works the day
// adapters are switched on. Writes ios/skadnetwork-sources.json (per-source IDs + fetch date).
//   node scripts/skan-update.mjs          fetch + rewrite
//   node scripts/skan-update.mjs --check  fetch + report the diff, change nothing (exit 1 if stale)
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const SOURCES = {
  google: "https://developers.google.com/admob/ios/3p-skadnetworks", // HTML page; the list is inline
  applovin: "https://skadnetwork-ids.applovin.com/v1/skadnetworkids.json",
  unity: "https://skan.mz.unity3d.com/v3/partner/skadnetworks.plist.json",
  mintegral: "https://dev.mintegral.com/skadnetworkids.xml",
};
const plist = new URL("../ios/App/App/Info.plist", import.meta.url);
const snap = new URL("../ios/skadnetwork-sources.json", import.meta.url);
const ids = (text) => [...new Set([...text.matchAll(/\b([a-z0-9]{10})\.skadnetwork\b/gi)].map((m) => `${m[1].toLowerCase()}.skadnetwork`))].sort();

const per = {};
for (const [name, url] of Object.entries(SOURCES)) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status} ${url}`);
  per[name] = ids(await res.text());
  if (per[name].length < 20) throw new Error(`${name}: only ${per[name].length} ids — page format changed?`);
}
if (!per.google.includes("cstr6suwn9.skadnetwork")) throw new Error("Google's own id cstr6suwn9 missing");
const all = [...new Set(Object.values(per).flat())].sort();
let current = [];
try {
  current = JSON.parse(execFileSync("plutil", ["-extract", "SKAdNetworkItems", "json", "-o", "-", plist.pathname], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }))
    .map((d) => d.SKAdNetworkIdentifier.toLowerCase());
} catch { /* key not there yet */ }
const added = all.filter((x) => !current.includes(x));
const removed = current.filter((x) => !all.includes(x));
console.log(`SKAdNetwork: ${all.length} ids (${Object.entries(per).map(([k, v]) => `${k} ${v.length}`).join(", ")}); +${added.length} −${removed.length}`);
if (process.argv.includes("--check")) process.exit(added.length || removed.length ? 1 : 0);
const items = JSON.stringify(all.map((id) => ({ SKAdNetworkIdentifier: id })));
execFileSync("plutil", ["-replace", "SKAdNetworkItems", "-json", items, plist.pathname]);
writeFileSync(snap, JSON.stringify({ fetched: new Date().toISOString().slice(0, 10), sources: SOURCES, ids: per }, null, 1) + "\n");
