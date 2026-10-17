#!/usr/bin/env bash
# 10-minute soak on the paired iPhone (Release build installed via device-install.sh).
#   phase A (RELAUNCH_MIN, default 5 min): process-cold relaunch every 30 s, `devicectl device
#     info processes` snapshot after each (confirms the app is alive, no watchdog kills).
#   phase B (IDLE_MIN, default 5 min): app left idle on the board while xctrace records
#     Leaks (Allocations + Leaks) attached to it → soak-leaks.trace.
#   then copies the device's crash reports for the app (systemCrashLogs, App-*.ips) and
#     the perf.jsonl lines written during the soak.
# Frame pacing (finale / town) needs a human driving the UI: run
#   xcrun xctrace record --template 'Animation Hitches' --device $UDID --attach App \
#     --time-limit 60s --output <out>/hitches.trace
# while playing through a finale and opening the town, then open the trace in Instruments.
# UNTESTED on device as of 2026-10-13 (phone was locked).
# Usage: scripts/soak-ios.sh [UDID]
set -euo pipefail
cd "$(dirname "$0")/.."
UDID="${1:-${DEVICE_UDID:-FAECA527-B1FD-579D-97C6-5D8C818DFD40}}"
RELAUNCH_MIN="${RELAUNCH_MIN:-5}"
IDLE_MIN="${IDLE_MIN:-5}"
if [[ "$(xcrun devicectl device info lockState --device "$UDID" 2>/dev/null | awk '/passcodeRequired/ {print $NF}')" == "true" ]]; then
  echo "iPhone $UDID is LOCKED: unlock it, Auto-Lock = Never, keep it on the charger, rerun." >&2
  exit 2
fi
BUNDLE=$(node -p 'require("./app.identity.json").bundleId')
OUT="../../playtest/perf/$(date +%Y%m%d-%H%M%S)-soak"
mkdir -p "$OUT/crashes"
START=$(date -u +%Y-%m-%dT%H:%M:%SZ)
# xctrace wants the hardware UDID (0000xxxx-…), not the CoreDevice identifier devicectl uses.
HWUDID=$(xcrun devicectl device info details --device "$UDID" 2>/dev/null | awk '/ udid:/ {print $NF; exit}')
HWUDID="${HWUDID:-$UDID}"

echo "[soak] phase A: relaunch every 30 s for $RELAUNCH_MIN min"
for i in $(seq 1 $((RELAUNCH_MIN * 2))); do
  xcrun devicectl device process launch --device "$UDID" --terminate-existing "$BUNDLE" >/dev/null
  sleep 28
  xcrun devicectl device info processes --device "$UDID" 2>/dev/null | grep -c "App.app/App" \
    | xargs -I{} printf '%s\t%s\n' "$i" "{}" >> "$OUT/alive.tsv"
  printf '.'
done
echo
echo "[soak] phase B: idle $IDLE_MIN min with Leaks/Allocations attached"
xcrun devicectl device process launch --device "$UDID" --terminate-existing "$BUNDLE" >/dev/null
sleep 5
xcrun xctrace record --template Leaks --device "$HWUDID" --attach App \
  --time-limit "$((IDLE_MIN * 60))s" --output "$OUT/soak-leaks.trace" || echo "xctrace failed (see above)"
xcrun xctrace export --input "$OUT/soak-leaks.trace" --toc > "$OUT/soak-leaks-toc.xml" 2>/dev/null || :

echo "[soak] crash reports since $START"
xcrun devicectl device info files --device "$UDID" --domain-type systemCrashLogs 2>/dev/null \
  | grep -iE "^ *(Retired/)?(App-|App_|Lanternly|Duskwick|jetsam|WebContent)" > "$OUT/crash-listing.txt" || :
while read -r f; do
  name=$(echo "$f" | awk '{print $1}')
  xcrun devicectl device copy from --device "$UDID" --domain-type systemCrashLogs --source "$name" \
    --destination "$OUT/crashes/$(basename "$name")" >/dev/null 2>&1 || :
done < <(grep -E "^ *App-.*\.ips|JetsamEvent|WebContent" "$OUT/crash-listing.txt" || :)
xcrun devicectl device copy from --device "$UDID" --domain-type appDataContainer \
  --domain-identifier "$BUNDLE" --source Documents/perf.jsonl --destination "$OUT/perf.jsonl" >/dev/null 2>&1 || :
echo "alive per relaunch (1 = running):"; cut -f2 "$OUT/alive.tsv" | tr '\n' ' '; echo
echo "crash files: $(ls "$OUT/crashes" | wc -l | tr -d ' ')  → $OUT"
