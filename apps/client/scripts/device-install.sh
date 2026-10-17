#!/usr/bin/env bash
# Measure build (= Release settings + the ColdStartProbe, PERF_PROBE) of M0 or M1 → install
# on the paired iPhone (automatic signing). CONFIG=Release installs the App Store
# configuration instead (no probe: measure-ios.sh then gets no samples).
# Usage: [CONFIG=Measure|Release] scripts/device-install.sh m0|m1 [UDID]
# Stops on any signing / provisioning / device error — fix it in Xcode or on the
# phone; this script never touches account or device security settings.
set -euo pipefail
cd "$(dirname "$0")/.."
VARIANT="${1:?m0 or m1}"
UDID="${2:-${DEVICE_UDID:-FAECA527-B1FD-579D-97C6-5D8C818DFD40}}"
CONFIG="${CONFIG:-Measure}"
# Fail fast if the phone is locked (DDI mount / launch need it unlocked, screen on).
if [[ "$(xcrun devicectl device info lockState --device "$UDID" 2>/dev/null | awk '/passcodeRequired/ {print $NF}')" == "true" ]]; then
  echo "iPhone $UDID is LOCKED: unlock it, set Settings > Display & Brightness > Auto-Lock = Never, keep it on the charger, rerun." >&2
  exit 2
fi
npm run -s "build:$VARIANT" >/dev/null || { npm run -s "build:$VARIANT"; exit 1; }
npm run -s ios:sync >/dev/null
xcodebuild -quiet -project ios/App/App.xcodeproj -scheme App -configuration "$CONFIG" \
  -destination 'generic/platform=iOS' -derivedDataPath build/dd-device \
  -allowProvisioningUpdates build
xcrun devicectl device install app --device "$UDID" "build/dd-device/Build/Products/$CONFIG-iphoneos/App.app"
echo "installed $VARIANT ($CONFIG) on $UDID"
