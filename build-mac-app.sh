#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
DIST="$ROOT/dist"
APP="$DIST/D-Writing-Pad.app"
STAGING="$DIST/dmg-staging"
ICONSET="$DIST/D-Writing-Pad.iconset"
DMG="$DIST/D-Writing-Pad.dmg"

npm --prefix "$ROOT" run build:formatters
npm --prefix "$ROOT" run build:manglish-dictionary
swift "$ROOT/Sources/AppIconGenerator/main.swift" "$ICONSET" "$ROOT/icon.png"
iconutil --convert icns "$ICONSET" --output "$ROOT/AppIcon.icns"
swift build --package-path "$ROOT" --configuration release \
  --triple arm64-apple-macosx13.0 \
  --jobs 1 \
  --scratch-path "$DIST/build-arm64"
swift build --package-path "$ROOT" --configuration release \
  --triple x86_64-apple-macosx13.0 \
  --jobs 1 \
  --scratch-path "$DIST/build-x86_64"

mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
mkdir -p "$APP/Contents/Resources/malayalam-hunspell"
lipo -create \
  "$DIST/build-arm64/arm64-apple-macosx/release/Notepad" \
  "$DIST/build-x86_64/x86_64-apple-macosx/release/Notepad" \
  -output "$APP/Contents/MacOS/Notepad"
cp "$ROOT/index.html" "$ROOT/styles.css" "$ROOT/app.js" "$ROOT/manglish.js" "$ROOT/manglish-plugin.js" "$ROOT/manglish-dictionary.js" "$ROOT/formatters.bundle.js" "$ROOT/AppIcon.icns" "$APP/Contents/Resources/"
cp "$ROOT/data/malayalam-hunspell/Copyright" "$ROOT/data/malayalam-hunspell/GPL-3.0.txt" "$ROOT/data/malayalam-hunspell/ml_IN.aff" "$ROOT/data/malayalam-hunspell/ml_IN.dic" "$APP/Contents/Resources/malayalam-hunspell/"

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>D-Writing-Pad</string>
  <key>CFBundleDisplayName</key>
  <string>D-Writing-Pad</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>CFBundleIdentifier</key>
  <string>com.local.notepad</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>CFBundleExecutable</key>
  <string>Notepad</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSPrincipalClass</key>
  <string>NSApplication</string>
</dict>
</plist>
PLIST

codesign --force --deep --sign - "$APP"
if [ -d "$ROOT/dist/Notepad.app" ]; then
  rm -rf "$ROOT/dist/Notepad.app"
fi

rm -rf "$STAGING"
rm -rf "$ICONSET"
mkdir -p "$STAGING"
cp -R "$APP" "$STAGING/D-Writing-Pad.app"
ln -s /Applications "$STAGING/Applications"
hdiutil create -volname "D-Writing-Pad" -srcfolder "$STAGING" -ov -format UDZO "$DMG"
rm -rf "$STAGING"

echo "Built universal app: $APP"
echo "Built installer disk image: $DMG"
