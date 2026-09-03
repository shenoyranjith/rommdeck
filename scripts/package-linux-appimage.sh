#!/usr/bin/env bash
# Build a Linux .AppImage from the Compose createDistributable tree + bundled syncd.
#
# Usage (from repo root):
#   ./scripts/package-linux-appimage.sh
#   ./scripts/package-linux-appimage.sh /path/to/out
#
# Requires: full JDK 17+ with jlink + jpackage (not a JRE-only install), Linux, network
# (first run downloads appimagetool).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC_ROOT="$REPO_ROOT/src"
OUT_DIR="${1:-$REPO_ROOT/dist}"
VERSION="${ROMMDECK_VERSION:-}"
if [[ -z "$VERSION" ]]; then
  VERSION="$(grep -E '^rommdeck\.version=' "$SRC_ROOT/gradle.properties" | cut -d= -f2)"
fi
APP_NAME="RommDeck"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64) APPIMAGE_ARCH="x86_64" ;;
  aarch64|arm64) APPIMAGE_ARCH="aarch64" ;;
  *)
    echo "Unsupported architecture: $ARCH" >&2
    exit 1
    ;;
esac

# Compose createDistributable needs jlink + jpackage on the Gradle JVM.
find_jdk_tool() {
  local tool="$1"
  if [[ -n "${JAVA_HOME:-}" && -x "$JAVA_HOME/bin/$tool" ]]; then
    echo "$JAVA_HOME/bin/$tool"
    return 0
  fi
  if command -v "$tool" >/dev/null 2>&1; then
    command -v "$tool"
    return 0
  fi
  local candidate
  for candidate in /usr/lib/jvm/*/bin/"$tool"; do
    if [[ -x "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

if ! find_jdk_tool jlink >/dev/null || ! find_jdk_tool jpackage >/dev/null; then
  cat >&2 <<'EOF'
Compose packaging needs a full JDK with `jlink` and `jpackage`.
Your current Java install looks like a JRE (runtime only).

On Fedora:
  sudo dnf install java-25-openjdk-devel java-25-openjdk-jmods

Then re-run this script. Optionally:
  export JAVA_HOME=/usr/lib/jvm/java-25-openjdk
EOF
  exit 1
fi

echo "==> Building Compose distributable + syncd"
(
  cd "$SRC_ROOT"
  ./gradlew --no-daemon :apps:desktop:prepareLinuxAppImageContents
)

COMPOSE_APP="$SRC_ROOT/apps/desktop/build/compose/binaries/main/app/$APP_NAME"
if [[ ! -d "$COMPOSE_APP" ]]; then
  echo "Missing Compose app image at $COMPOSE_APP" >&2
  exit 1
fi
if [[ ! -x "$COMPOSE_APP/syncd/bin/rommdeck-syncd" && ! -f "$COMPOSE_APP/syncd/bin/rommdeck-syncd" ]]; then
  echo "Missing bundled syncd under $COMPOSE_APP/syncd" >&2
  exit 1
fi

STAGE="$(mktemp -d)"
cleanup() { rm -rf "$STAGE"; }
trap cleanup EXIT

APPDIR="$STAGE/$APP_NAME.AppDir"
mkdir -p "$APPDIR"
cp -a "$COMPOSE_APP" "$APPDIR/rommdeck"

ICON_SRC="$SRC_ROOT/apps/desktop/src/jvmMain/resources/icons/app-icon-512.png"
if [[ -f "$ICON_SRC" ]]; then
  cp "$ICON_SRC" "$APPDIR/rommdeck.png"
  ln -sf rommdeck.png "$APPDIR/.DirIcon"
fi

cat > "$APPDIR/rommdeck.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=RommDeck
Comment=RomM ↔ RetroDECK (ES-DE frontend)
Exec=AppRun
Icon=rommdeck
Categories=Game;
Terminal=false
EOF

cat > "$APPDIR/AppRun" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
HERE="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")"
export ROMMDECK_APP_ROOT="$HERE/rommdeck"
# Prefer the bundled JRE from the Compose/jpackage tree.
exec "$ROMMDECK_APP_ROOT/bin/RommDeck" "$@"
EOF
chmod +x "$APPDIR/AppRun"
chmod +x "$APPDIR/rommdeck/bin/RommDeck" 2>/dev/null || true
chmod +x "$APPDIR/rommdeck/syncd/bin/rommdeck-syncd" 2>/dev/null || true

TOOL_DIR="${ROMMDECK_APPIMAGETOOL_DIR:-$HOME/.cache/rommdeck/appimagetool}"
mkdir -p "$TOOL_DIR"
APPIMAGETOOL="$TOOL_DIR/appimagetool-$APPIMAGE_ARCH.AppImage"
if [[ ! -x "$APPIMAGETOOL" ]]; then
  echo "==> Downloading appimagetool ($APPIMAGE_ARCH)"
  URL="https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-${APPIMAGE_ARCH}.AppImage"
  curl -fsSL -o "$APPIMAGETOOL" "$URL"
  chmod +x "$APPIMAGETOOL"
fi

mkdir -p "$OUT_DIR"
OUT_FILE="$OUT_DIR/RommDeck-${VERSION}-linux-${APPIMAGE_ARCH}.AppImage"
echo "==> Packaging $OUT_FILE"
# Extracted CI runners often lack FUSE; appimagetool falls back with APPIMAGE_EXTRACT_AND_RUN.
export APPIMAGE_EXTRACT_AND_RUN=1
"$APPIMAGETOOL" "$APPDIR" "$OUT_FILE"
chmod +x "$OUT_FILE"

echo "Built $OUT_FILE"
ls -lh "$OUT_FILE"
