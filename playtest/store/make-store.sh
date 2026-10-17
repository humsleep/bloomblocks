#!/usr/bin/env bash
# ONE command: real-app captures → framed App Store screenshots + contact sheet, per locale and size.
#
#   playtest/store/make-store.sh <lang[,lang…]|all> [--size 6.9] [--device <udid>] [--compose-only] [--no-build]
#
#   lang      en ko ja de fr es pt-BR it zh-Hans zh-Hant (captions.json) or "all"
#   --size    a key of sizes.json (default 6.9 → 1320×2868, iPhone 17 Pro Max simulator)
#   --device  simulator UDID (default: a simulator named "DW Store <size>", created and booted if missing)
#
# What it does (README.md has the details):
#   1. build: production web bundle (vite --mode m1, no test bridge) → Debug simulator app with that bundle
#      (own derived data: apps/client/build/dd-store; checked with scripts/check-no-probe.sh's web part)
#   2. clean status bar (9:41, full battery, no carrier)
#   3. per locale: seed the app's own save files + Preferences (store-shots.ts), launch with
#      -AppleLanguages, capture; the village / cottage / letter / settings states need taps:
#      done with `idb ui tap` when idb is installed, otherwise the script pauses and prints the point
#   4. compose.mjs: frames + localized captions → docs/store/screenshots/<dir>/01–08.png + contact.png
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
CLIENT="$HERE/../../apps/client"
LANGS="${1:?usage: make-store.sh <lang[,lang]|all> [--size 6.9] [--device udid] [--compose-only] [--no-build]}"; shift
SIZE=6.9; DEV=""; COMPOSE_ONLY=0; BUILD=1
while [[ $# -gt 0 ]]; do
  case "$1" in
    --size) SIZE="$2"; shift 2 ;;
    --device) DEV="$2"; shift 2 ;;
    --compose-only) COMPOSE_ONLY=1; shift ;;
    --no-build) BUILD=0; shift ;;
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
done
if [[ "$LANGS" == all ]]; then LANGS=$(node -e 'const c=require(process.argv[1]);console.log(Object.keys(c).filter(k=>k!=="shots"&&!k.startsWith("/")).join(","))' "$HERE/captions.json"); fi
J() { node -e 'const s=require(process.argv[1])[process.argv[2]];if(!s){console.error("unknown size "+process.argv[2]);process.exit(2)}const v=process.argv[3].split(".").reduce((o,k)=>o[k],s);console.log(Array.isArray(v)?v.join(" "):v)' "$HERE/sizes.json" "$SIZE" "$1"; }

if [[ $COMPOSE_ONLY == 0 ]]; then
  SIMNAME="DW Store $SIZE"
  if [[ -z "$DEV" ]]; then
    DEV=$(xcrun simctl list devices -j | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{for(const l of Object.values(JSON.parse(d).devices))for(const x of l)if(x.name===process.argv[1]&&x.isAvailable){console.log(x.udid);return}})' "$SIMNAME")
    [[ -n "$DEV" ]] || DEV=$(xcrun simctl create "$SIMNAME" "$(J simulator)")
  fi
  xcrun simctl boot "$DEV" 2>/dev/null || true
  xcrun simctl bootstatus "$DEV" -b >/dev/null
  APP="$CLIENT/build/dd-store/Build/Products/Debug-iphonesimulator/App.app"
  if [[ $BUILD == 1 ]]; then
    WEB="$CLIENT/build/store-web"
    (cd "$CLIENT" && npx vite build --mode m1 --outDir "$WEB" --emptyOutDir >/dev/null)
    (cd "$CLIENT" && xcodebuild -quiet -project ios/App/App.xcodeproj -scheme App -configuration Debug \
      -destination 'generic/platform=iOS Simulator' -derivedDataPath build/dd-store build)
    # the freshly built production web bundle replaces whatever the native project last synced
    cp "$APP/public/cordova.js" "$APP/public/cordova_plugins.js" "$WEB/"
    rm -rf "$APP/public" && cp -R "$WEB" "$APP/public"
    if grep -rlE '__test\b|__e2e\b|devShot' "$APP/public" >/dev/null; then echo "FAIL: test bridge in the web bundle" >&2; exit 1; fi
  fi
  xcrun simctl install "$DEV" "$APP"
  xcrun simctl status_bar "$DEV" override --time "9:41" --dataNetwork wifi --wifiMode active --wifiBars 3 \
    --cellularMode notSupported --batteryState charged --batteryLevel 100 --operatorName ""

  T() { (cd "$CLIENT" && npx tsx "$HERE/store-shots.ts" "$@" --device "$DEV" --out "$CLIENT/build/store-raw/$SIZE"); }
  tap() { # tap <name>: a point of sizes.json taps
    read -r X Y <<<"$(J "taps.$1")"
    if command -v idb >/dev/null; then idb ui tap --udid "$DEV" "$X" "$Y"
    else read -r -p "  tap \"$1\" at ($X, $Y) pt in the simulator, then press Enter " _ </dev/tty; fi
    sleep 2.5
  }
  for L in ${LANGS//,/ }; do
    echo "== $L ($SIZE)"
    for s in board-mid rule-light rule-conflict rule-number daily-mid daily-done; do
      T seed "$s" --lang "$L" >/dev/null
      if [[ $s == daily-done ]]; then sleep 13; else sleep 8; fi
      T grab "$s" --lang "$L" >/dev/null
    done
    T seed world --lang "$L" >/dev/null; sleep 8
    tap village; T grab village --lang "$L" >/dev/null
    tap mailbox; T grab letter --lang "$L" >/dev/null
    tap openGift; T grab gift --lang "$L" >/dev/null
    tap putInCottage; sleep 1; T grab room --lang "$L" >/dev/null
    T seed world --lang "$L" >/dev/null; sleep 8
    tap settings; T grab settings --lang "$L" >/dev/null
  done
fi
(cd "$CLIENT" && node "$HERE/compose.mjs" --lang "$LANGS" --size "$SIZE")
