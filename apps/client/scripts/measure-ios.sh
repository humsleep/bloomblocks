#!/usr/bin/env bash
# Cold-start gate measurement on a real iPhone (Measure build — Release settings + probe —
# already installed, see scripts/device-install.sh). N process-cold launches via devicectl
# (--terminate-existing), INTERVAL s apart; then pulls Documents/perf.jsonl
# (written by ColdStartProbe.swift) and prints n / median / p75 / max for the
# launches of THIS run only.
#
# Usage: scripts/measure-ios.sh <label m0|m1> [N=20] [UDID] [INTERVAL=10]
# The phone must be unlocked with the screen on for the whole run.
set -euo pipefail
cd "$(dirname "$0")/.."
LABEL="${1:?label (m0|m1)}"
N="${2:-20}"
UDID="${3:-${DEVICE_UDID:-FAECA527-B1FD-579D-97C6-5D8C818DFD40}}"
INTERVAL="${4:-10}"
# Fail fast if the phone is locked (DDI mount / launch need it unlocked, screen on).
if [[ "$(xcrun devicectl device info lockState --device "$UDID" 2>/dev/null | awk '/passcodeRequired/ {print $NF}')" == "true" ]]; then
  echo "iPhone $UDID is LOCKED: unlock it, set Settings > Display & Brightness > Auto-Lock = Never, keep it on the charger, rerun." >&2
  exit 2
fi
BUNDLE=$(node -p 'require("./app.identity.json").bundleId')
OUT="perf/$(date +%Y%m%d-%H%M%S)-$LABEL"
mkdir -p "$OUT"

pull() { # $1 = destination file; missing remote file → empty
  xcrun devicectl device copy from --device "$UDID" --domain-type appDataContainer \
    --domain-identifier "$BUNDLE" --source Documents/perf.jsonl --destination "$1" >/dev/null 2>&1 || : > "$1"
}

# One uncounted warm-up launch (first launch after install pays one-time costs).
xcrun devicectl device process launch --device "$UDID" --terminate-existing "$BUNDLE" >/dev/null
sleep "$INTERVAL"
pull "$OUT/before.jsonl"
BEFORE=$(wc -l < "$OUT/before.jsonl" | tr -d ' ')
echo "[$LABEL] $N process-cold launches of $BUNDLE on $UDID, ${INTERVAL}s apart (existing lines: $BEFORE)"
for i in $(seq 1 "$N"); do
  xcrun devicectl device process launch --device "$UDID" --terminate-existing "$BUNDLE" >/dev/null
  printf '.'
  sleep "$INTERVAL"
done
echo
pull "$OUT/after.jsonl"
tail -n +"$((BEFORE + 1))" "$OUT/after.jsonl" > "$OUT/run.jsonl"

node - "$OUT/run.jsonl" "$LABEL" <<'JS'
const fs = require("node:fs");
const [file, label] = process.argv.slice(2);
const rows = fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const ms = rows.map((r) => r.ms).filter((v) => v >= 0).sort((a, b) => a - b);
if (!ms.length) { console.log("no samples (app did not reach mark()? phone locked?)"); process.exit(1); }
const q = (p) => ms[Math.min(ms.length - 1, Math.ceil(p * ms.length) - 1)]; // nearest-rank
const mid = ms.length % 2 ? ms[(ms.length - 1) / 2] : (ms[ms.length / 2 - 1] + ms[ms.length / 2]) / 2;
const variants = [...new Set(rows.map((r) => r.variant))].join(",");
const configs = [...new Set(rows.map((r) => r.config))].join(",");
const prewarm = rows.filter((r) => r.prewarm).length;
const dfl = rows.map((r) => r.dflMs).sort((a, b) => a - b);
console.log(`${label}: n=${ms.length} median=${mid} p75=${q(0.75)} max=${ms[ms.length - 1]} min=${ms[0]} ms  (variant=${variants} config=${configs} prewarm=${prewarm})`);
console.log(`  process start→didFinishLaunching median=${dfl[Math.floor(dfl.length / 2)]} ms`);
if (configs !== "release") console.log("  WARNING: not a release build — not valid for the gate");
JS
echo "raw: $OUT/run.jsonl"
