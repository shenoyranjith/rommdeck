#!/usr/bin/env bash
# Seed a local RetroDECK-like tree for non-RetroDECK / offline development.
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

MAIN_CFG="$CFG_DIR/config.json"
if [[ ! -f "$MAIN_CFG" ]]; then
  cat > "$MAIN_CFG" <<EOF
{
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
    "intervalSeconds": 300,
    "debounceSeconds": 45,
    "conflictPolicy": "keep_both",
    "deviceId": null,
    "deviceName": "RommDeck"
  },
  "platformMapOverrides": {}
}
EOF
  echo "Wrote $MAIN_CFG — set romm.baseUrl and apiToken"
else
  echo "Keeping existing $MAIN_CFG"
fi

echo "Dev tree ready at $ROOT"
echo "Run with: npm run dev:gui"
