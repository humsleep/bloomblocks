#!/usr/bin/env bash
# Low-end PROXY only (not the gate): N process-cold launches of a Measure (Release + probe) simulator build on
# a simulator of its own (default: a throwaway "iPhone SE (3rd generation)" clone, so other
# agents' simulators are never touched), INTERVAL s apart. Reads Documents/perf.jsonl
# (ColdStartProbe) and samples phys_footprint (`footprint`) of the app process and the newest
# WebContent process of that simulator INTERVAL s after each launch.
#
# Usage: scripts/measure-sim.sh <m0|m1> [N=10] [INTERVAL=8]
#   env APP=<path to Measure-iphonesimulator App.app>  (default: build one; see below)
#   env SIM_UDID=<udid>   reuse a simulator instead of creating + deleting a clone
# Building never writes dist/ or ios/App/App/public (shared with other agents): the Measure
# sim app is built once, then the variant's web bundle is built to build/web-<variant> and
# swapped into a copy of the .app (ad-hoc re-signed).
# Simulator timings run on the Mac's CPU/GPU — use them for relative comparison only.
set -euo pipefail
cd "$(dirname "$0")/.."
VARIANT="${1:?m0 or m1}"
N="${2:-10}"
INTERVAL="${3:-8}"
BUNDLE=$(node -p 'require("./app.identity.json").bundleId')
OUT="../../playtest/perf/$(date +%Y%m%d-%H%M%S)-sim-se3-$VARIANT"
mkdir -p "$OUT"

if [[ -z "${APP:-}" ]]; then
  BASE=build/dd-sim-measure/Build/Products/Measure-iphonesimulator/App.app
  [[ -d "$BASE" ]] || xcodebuild -quiet -project ios/App/App.xcodeproj -scheme App -configuration Measure \
    -destination 'generic/platform=iOS Simulator' -derivedDataPath build/dd-sim-measure build
  npx vite build --mode "$VARIANT" --outDir "build/web-$VARIANT" --emptyOutDir >/dev/null
  APP="build/sim-$VARIANT/App.app"
  rm -rf "build/sim-$VARIANT"; mkdir -p "build/sim-$VARIANT"; cp -R "$BASE" "$APP"
  # keep Capacitor's cordova shims, replace the web bundle
  find "$APP/public" -mindepth 1 -maxdepth 1 ! -name 'cordova*.js' -exec rm -rf {} +
  cp -R "build/web-$VARIANT/." "$APP/public/"
  codesign -f -s - "$APP" >/dev/null 2>&1
fi

CREATED=0
if [[ -z "${SIM_UDID:-}" ]]; then
  RT=$(xcrun simctl list runtimes -j | node -e 'const r=JSON.parse(require("fs").readFileSync(0,"utf8")).runtimes.filter(x=>x.isAvailable&&x.platform==="iOS");console.log(r.at(-1).identifier)')
  SIM_UDID=$(xcrun simctl create "perf-se3-$$" "com.apple.CoreSimulator.SimDeviceType.iPhone-SE-3rd-generation" "$RT")
  CREATED=1
fi
U="$SIM_UDID"
cleanup() { xcrun simctl shutdown "$U" 2>/dev/null || :; if [[ $CREATED == 1 ]]; then xcrun simctl delete "$U" 2>/dev/null || :; fi; }
trap cleanup EXIT
xcrun simctl list devices | grep "$U" | grep -q Booted || xcrun simctl boot "$U"
xcrun simctl bootstatus "$U" -b >/dev/null
sleep 20 # let first-boot daemons settle
xcrun simctl install "$U" "$APP"

# `simctl launch` sometimes never returns on these runtimes although the app starts:
# fire it in the background and reap the client after the interval.
launch() {
  xcrun simctl terminate "$U" "$BUNDLE" >/dev/null 2>&1 || :
  sleep 1
  xcrun simctl launch "$U" "$BUNDLE" >/dev/null 2>&1 & local p=$!
  sleep "$INTERVAL"; kill "$p" 2>/dev/null || :; wait "$p" 2>/dev/null || :
}
apppid() { xcrun simctl spawn "$U" launchctl list | awk -v b="UIKitApplication:$BUNDLE" 'index($3,b)==1 {print $1}' | head -1; }
mem() { # phys_footprint MB of pid $1
  [[ -n "$1" && "$1" != "-" ]] || { echo "?"; return; }
  footprint -p "$1" 2>/dev/null | awk '/phys_footprint:/ {v=$2; u=$3} END {if (v=="") print "?"; else if (u ~ /KB/) printf "%.1f", v/1024; else if (u ~ /GB/) printf "%.1f", v*1024; else printf "%.1f", v}'
}
wcpid() { pgrep -n -f "$U/.*WebContent" || pgrep -n -f "Devices/$U.*com.apple.WebKit.WebContent" || echo ""; }

launch; sleep 4 # warm-up, uncounted
DATA=$(xcrun simctl get_app_container "$U" "$BUNDLE" data)
PERF="$DATA/Documents/perf.jsonl"
BEFORE=$([[ -f "$PERF" ]] && wc -l < "$PERF" | tr -d ' ' || echo 0)
: > "$OUT/mem.tsv"
for i in $(seq 1 "$N"); do
  launch
  printf '%s\t%s\t%s\n' "$i" "$(mem "$(apppid)")" "$(mem "$(wcpid)")" >> "$OUT/mem.tsv"
  printf '.'
done
echo
tail -n +"$((BEFORE + 1))" "$PERF" > "$OUT/run.jsonl"

node - "$OUT/run.jsonl" "$OUT/mem.tsv" "$VARIANT" <<'JS'
const fs = require("node:fs");
const [file, memf, label] = process.argv.slice(2);
const rows = fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const ms = rows.map((r) => r.ms).filter((v) => v >= 0).sort((a, b) => a - b);
if (!ms.length) { console.log("no samples"); process.exit(1); }
const q = (a, p) => a[Math.min(a.length - 1, Math.ceil(p * a.length) - 1)];
const med = (a) => (a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2);
console.log(`[sim SE3] ${label}: n=${ms.length} median=${med(ms)} p75=${q(ms, 0.75)} max=${ms.at(-1)} min=${ms[0]} ms (config=${[...new Set(rows.map((r) => r.config))]} variant=${[...new Set(rows.map((r) => r.variant))]})`);
const mem = fs.readFileSync(memf, "utf8").trim().split("\n").map((l) => l.split("\t"));
const app = mem.map((m) => +m[1]).filter(Number.isFinite).sort((a, b) => a - b);
const wc = mem.map((m) => +m[2]).filter(Number.isFinite).sort((a, b) => a - b);
if (app.length) console.log(`  app phys_footprint MB median=${med(app)} max=${app.at(-1)}`);
if (wc.length) console.log(`  WebContent phys_footprint MB median=${med(wc)} max=${wc.at(-1)}`);
JS
echo "raw: $OUT"
