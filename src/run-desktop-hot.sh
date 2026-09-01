#!/usr/bin/env bash
# Launch Compose Desktop with Hot Reload — UI changes apply without restarting the window.
# Requires Kotlin 2.1.20+ and Compose Multiplatform 1.10+ (bundled hot reload).
# Uses JetBrains Runtime (auto-provisioned via gradle.properties).

set -euo pipefail
cd "$(dirname "$0")"

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

echo "Compose Hot Reload — save Kotlin files to refresh the UI (Ctrl+C to quit)"
echo "  DISPLAY=$DISPLAY"
echo "  ROMMDECK_UI_SCALE=${ROMMDECK_UI_SCALE:-auto}"

java_home="$(dirname "$(dirname "$(readlink -f "$(command -v java)")")")"
xawt="$java_home/lib/libawt_xawt.so"
if [[ ! -f "$xawt" ]]; then
  echo "ERROR: Headless JDK — install full java-25-openjdk for AWT."
  exit 1
fi

chmod +x ./run-desktop-hot.sh 2>/dev/null || true
exec ./gradlew :apps:desktop:hotRunJvm --autoReload --no-daemon "$@"
