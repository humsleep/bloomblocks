#!/usr/bin/env bash
# Build (Debug) + install + launch on the booted simulator, streaming the app console.
# Usage: scripts/sim-run.sh [m1|m0] [--no-build]
set -euo pipefail
cd "$(dirname "$0")/.."
VARIANT="${1:-m1}"
BUNDLE=$(node -p 'require("./app.identity.json").bundleId')
if [[ "${2:-}" != "--no-build" ]]; then
  npm run -s "build:$VARIANT" >/dev/null || { npm run -s "build:$VARIANT"; exit 1; }
  npm run -s ios:sync >/dev/null
  xcodebuild -quiet -project ios/App/App.xcodeproj -scheme App -configuration Debug \
    -destination 'generic/platform=iOS Simulator' -derivedDataPath build/dd-sim build
fi
xcrun simctl install booted build/dd-sim/Build/Products/Debug-iphonesimulator/App.app
exec xcrun simctl launch --console-pty --terminate-running-process booted "$BUNDLE"
