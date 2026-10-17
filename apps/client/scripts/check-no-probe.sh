#!/usr/bin/env bash
# Fails if a built App.app (Release / archive) still contains the measurement-only ColdStartProbe,
# or its web bundle (public/) still carries the DEV / e2e test bridge.
# Usage: scripts/check-no-probe.sh path/to/App.app
set -euo pipefail
APP="${1:?path to App.app}"
BIN="$APP/App"
[[ -f "$BIN" ]] || { echo "no binary at $BIN" >&2; exit 2; }
# Debug builds keep the code in App.debug.dylib; check every Mach-O of the app itself.
FILES=("$BIN"); [[ -f "$APP/App.debug.dylib" ]] && FILES+=("$APP/App.debug.dylib")
HITS=$( { for f in "${FILES[@]}"; do nm -m "$f" 2>/dev/null; strings -a "$f"; done; } | grep -c -E "ColdStartProbe|lanternly\.perf|perf\.jsonl" || true)
if [[ "$HITS" != "0" ]]; then echo "FAIL: $HITS probe symbol/string hits in $APP" >&2; exit 1; fi
# The web bundle must be the production build: no DEV / e2e test bridge (src/testing/bridge.ts →
# window.__test, e2e/bridge.ts → window.__e2e) and no DEV-only capture hook (src/dev/shot.ts).
[[ -d "$APP/public" ]] || { echo "FAIL: no web bundle at $APP/public" >&2; exit 1; }
WEB=$(grep -rlE "__test\b|__e2e\b|devShot" "$APP/public" --include="*.js" 2>/dev/null || true)
if [[ -n "$WEB" ]]; then echo "FAIL: test bridge / dev hook in the web bundle: $WEB" >&2; exit 1; fi
echo "OK: no ColdStartProbe / lanternly.perf / perf.jsonl / test bridge in $(basename "$(dirname "$APP")")/$(basename "$APP")"
