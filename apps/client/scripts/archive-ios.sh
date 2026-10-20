#!/usr/bin/env bash
# App Store archive: release gates → bump CFBundleVersion → build M1 web → cap sync →
# `xcodebuild archive` (Release, automatic signing) → prove the ColdStartProbe is absent.
# With --upload it then exports straight to App Store Connect (TestFlight) using the Apple ID signed in to
# Xcode (needs the App Store Connect record for the bundle id); without it, Xcode Organizer → Distribute App.
#
# Usage: scripts/archive-ios.sh [--check-only] [--allow-test-ads] [--marketing 1.1] [--upload]
#   --check-only      run only the gates (scripts/release-gates.mjs + check-no-probe.sh on the newest
#                     existing Release App.app); nothing is bumped, built, synced or archived.
#   --allow-test-ads  let Google's sample AdMob IDs / testing:true through with a loud warning —
#                     INTERNAL TestFlight builds only; the archive name gets a -TESTADS suffix.
# Gates (fail before anything is bumped or built): sample AdMob app/unit IDs or `testing: true` in
# src/ads/config.ts, sample GADApplicationIdentifier in Info.plist, config/plist app-ID mismatch,
# PERF_PROBE in a Release configuration; after archiving, ColdStartProbe symbols in the binary.
set -euo pipefail
cd "$(dirname "$0")/.."

CHECK_ONLY=0
UPLOAD=0
GATE_ARGS=()
BUMP_ARGS=()
while (($#)); do
  case "$1" in
    --check-only) CHECK_ONLY=1 ;;
    --upload) UPLOAD=1 ;;
    --allow-test-ads) GATE_ARGS+=(--allow-test-ads) ;;
    --marketing) BUMP_ARGS+=("$1" "${2:?--marketing needs a version}"); shift ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

node scripts/release-gates.mjs ${GATE_ARGS[@]+"${GATE_ARGS[@]}"}

if ((CHECK_ONLY)); then
  # Binary probe gate against the newest Release product already on disk (archive or Release build).
  NEWEST=$(ls -td build/archive/*.xcarchive/Products/Applications/App.app \
    build/dd-*/Build/Products/Release-iphoneos/App.app \
    build/dd-*/Build/Products/Release-iphonesimulator/App.app 2>/dev/null | head -1 || true)
  if [[ -n "$NEWEST" ]]; then
    echo "probe gate on newest Release product: $NEWEST"
    scripts/check-no-probe.sh "$NEWEST"
  else
    echo "probe gate: no Release App.app on disk yet (checked again after archiving)"
  fi
  echo "check-only: all gates passed (nothing bumped, built or archived)"
  exit 0
fi

SUFFIX=""
[[ ${#GATE_ARGS[@]} -gt 0 ]] && grep -q "3940256099942544\|testing: *true" src/ads/config.ts ios/App/App/Info.plist && SUFFIX="-TESTADS"

node scripts/bump-build.mjs ${BUMP_ARGS[@]+"${BUMP_ARGS[@]}"}
VER=$(node scripts/bump-build.mjs --print | tr -d ' ()' | tr -c '[:alnum:].\n' '-')
npm run -s build:m1 >/dev/null || { npm run -s build:m1; exit 1; }
npm run -s ios:sync >/dev/null
ARCHIVE="build/archive/Duskwick-$VER$SUFFIX.xcarchive"
xcodebuild -quiet -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -derivedDataPath build/dd-archive \
  -archivePath "$ARCHIVE" -allowProvisioningUpdates archive
if ! scripts/check-no-probe.sh "$ARCHIVE/Products/Applications/App.app"; then
  mv "$ARCHIVE" "${ARCHIVE%.xcarchive}-REJECTED-probe.xcarchive"
  echo "archive rejected (renamed *-REJECTED-probe): ColdStartProbe present" >&2
  exit 1
fi
[[ -n "$SUFFIX" ]] && echo "!!! $ARCHIVE serves GOOGLE TEST ADS — internal TestFlight only, never submit for review !!!" >&2
echo "archived $ARCHIVE"
if ((UPLOAD)); then
  [[ -n "$SUFFIX" ]] && { echo "refusing to upload a TESTADS archive" >&2; exit 1; }
  xcodebuild -quiet -exportArchive -archivePath "$ARCHIVE" -exportOptionsPlist scripts/ExportOptions-upload.plist \
    -exportPath build/export -allowProvisioningUpdates
  echo "uploaded $VER to App Store Connect — TestFlight lists it after processing (~5–30 min)"
fi
