#!/usr/bin/env bash
# Launch Compose Desktop with display env vars set.
# Use this from Cursor's terminal; Konsole/GNOME Terminal usually work without it.

set -euo pipefail
cd "$(dirname "$0")"

# A daemon started without DISPLAY keeps that environment for forked :run tasks.
./gradlew --stop >/dev/null 2>&1 || true

export DISPLAY="${DISPLAY:-:0}"
export WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-wayland-0}"

if [[ -z "${XAUTHORITY:-}" ]]; then
  uid="$(id -u)"
  for f in "/run/user/${uid}"/xauth_*; do
    if [[ -f "$f" ]]; then
      export XAUTHORITY="$f"
      break
    fi
  done
fi

# XWayland ignores a fractional Wayland output scale, so Compose would render far
# smaller than native apps. Detect the compositor scale and hand it to the app.
if [[ -z "${ROMMDECK_UI_SCALE:-}" ]]; then
  detected=""
  if command -v kscreen-doctor >/dev/null 2>&1; then
    detected="$(kscreen-doctor -o 2>/dev/null \
      | sed 's/\x1b\[[0-9;]*m//g' \
      | sed -n 's/.*Scale:[[:space:]]*\([0-9.][0-9.]*\).*/\1/p' \
      | head -1)"
  fi
  if [[ -z "$detected" ]] && command -v gsettings >/dev/null 2>&1; then
    detected="$(gsettings get org.gnome.desktop.interface text-scaling-factor 2>/dev/null)"
  fi
  if [[ -n "$detected" && "$detected" != "1.0" && "$detected" != "1" ]]; then
    export ROMMDECK_UI_SCALE="$detected"
  fi
fi
# App also auto-detects via kscreen-doctor when this var is unset (IDE runs).

echo "Launching with:"
echo "  DISPLAY=$DISPLAY"
echo "  WAYLAND_DISPLAY=$WAYLAND_DISPLAY"
echo "  XAUTHORITY=${XAUTHORITY:-unset}"
echo "  ROMMDECK_UI_SCALE=${ROMMDECK_UI_SCALE:-1 (auto)}"

java_home="$(dirname "$(dirname "$(readlink -f "$(command -v java)")")")"
xawt="$java_home/lib/libawt_xawt.so"
if [[ ! -f "$xawt" ]]; then
  echo
  echo "ERROR: Headless JDK detected — missing $xawt"
  echo "Compose Desktop needs the full (non-headless) JDK."
  echo
  echo "  sudo dnf install java-25-openjdk"
  echo
  echo "Run ./check-display.sh for details."
  exit 1
fi
echo

exec ./gradlew :apps:desktop:run --no-daemon "$@"
