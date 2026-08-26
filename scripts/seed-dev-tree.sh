#!/usr/bin/env bash
# Seed a local RetroDECK-like tree for Mac / non-RetroDECK development.
set -euo pipefail

ROOT="${ROMMDECK_DEV_ROOT:-$HOME/rommdeck-dev/retrodeck}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CFG_DIR="${ROMMDECK_CONFIG_DIR:-$HOME/.config/rommdeck}"

mkdir -p "$ROOT"/{roms,saves,states}
# Common ES-DE folders used while developing
for folder in nes snes gb gba n64 gc megadrive psx psp dreamcast; do
  mkdir -p "$ROOT/roms/$folder"
done

# Materialize fixtures/retrodeck.json with expanded $HOME
EXPANDED="$CFG_DIR/fixtures-retrodeck.json"
mkdir -p "$CFG_DIR"
sed "s|\${HOME}|$HOME|g" "$REPO_ROOT/fixtures/retrodeck.json" > "$EXPANDED"

DEV_CFG="$CFG_DIR/config.dev.json"
if [[ ! -f "$DEV_CFG" ]]; then
  cat > "$DEV_CFG" <<EOF
{
  "profile": "dev",
  "romm": {
    "baseUrl": "http://192.168.1.10:8080",
    "apiToken": ""
  },
  "retrodeck": {
    "configPath": "$EXPANDED",
    "romsPath": "$ROOT/roms",
    "savesPath": "$ROOT/saves",
    "statesPath": "$ROOT/states"
  },
  "sync": {
    "enabled": false,
    "mode": "push_pull",
    "intervalSeconds": 60,
    "debounceSeconds": 15,
    "conflictPolicy": "keep_both",
    "deviceId": null,
    "deviceName": "RommDeck Dev"
  },
  "platformMapOverrides": {}
}
EOF
  echo "Wrote $DEV_CFG — set romm.baseUrl and apiToken"
else
  echo "Keeping existing $DEV_CFG"
fi

# Also write main config if missing
MAIN_CFG="$CFG_DIR/config.json"
if [[ ! -f "$MAIN_CFG" ]]; then
  cp "$DEV_CFG" "$MAIN_CFG"
  echo "Wrote $MAIN_CFG"
fi

echo "Dev tree ready at $ROOT"
echo "Run with: ROMMDECK_PROFILE=dev npm run dev:gui"
