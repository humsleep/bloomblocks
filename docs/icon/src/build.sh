#!/bin/sh
# Regenerate candidate SVGs/PNGs and the shipped icon. Local, free: python3 (stdlib),
# Playwright Chromium from apps/client, sips. C1-* are frozen copies of the previous winner.
set -e
cd "$(dirname "$0")/.."
WINNER=${WINNER:-C3}
python3 src/gen.py candidates
node src/render.mjs png candidates/*.svg >/dev/null
for f in png/*-any-1024.png; do python3 src/pngtool.py opaque "$f" "$f"; done
for f in png/*-1024.png; do
  for s in 180 120 87 58 40; do sips -z $s $s "$f" --out "${f%-1024.png}-$s.png" >/dev/null; done
done
cp candidates/$WINNER-any.svg duskwick-icon.svg
cp candidates/$WINNER-dark.svg duskwick-icon-dark.svg
cp candidates/$WINNER-tinted.svg duskwick-icon-tinted.svg
cp png/$WINNER-any-1024.png duskwick-icon-1024.png
cp png/$WINNER-dark-1024.png duskwick-icon-dark-1024.png
cp png/$WINNER-tinted-1024.png duskwick-icon-tinted-1024.png
python3 src/pngtool.py info duskwick-icon-1024.png
echo "built (winner $WINNER)"

# ---- alternate icon B "Wick in the lantern" (PPO treatment; asset set AppIconWick). Independent of WINNER.
node src/wick-icon.mjs . >/dev/null
node src/render.mjs . duskwick-icon-wick.svg duskwick-icon-wick-dark.svg duskwick-icon-wick-tinted.svg >/dev/null
python3 src/pngtool.py opaque duskwick-icon-wick-1024.png duskwick-icon-wick-1024.png
RES=../../apps/client/resources/icon
SET=../../apps/client/ios/App/App/Assets.xcassets/AppIconWick.appiconset
mkdir -p "$SET"
for v in "" -dark -tinted; do
  case $v in "") n=AppIconWick;; -dark) n=AppIconWick-Dark;; -tinted) n=AppIconWick-Tinted;; esac
  cp duskwick-icon-wick$v-1024.png "$RES/$n-1024.png"
  cp duskwick-icon-wick$v-1024.png "$SET/$n-1024.png"
done
python3 src/pngtool.py info duskwick-icon-wick-1024.png
mkdir -p ../../playtest/shots/v13-share
node src/render.mjs --html "$PWD/src/icon-alt-preview.html" "$PWD/../../playtest/shots/v13-share/icon-alt-wick-preview.png" 1600 900 >/dev/null
echo "built alt icon AppIconWick"
