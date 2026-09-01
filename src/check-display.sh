#!/usr/bin/env bash
# Quick diagnostic — run from the same terminal where :apps:desktop:run fails.

set -u
echo "=== Display environment ==="
echo "DISPLAY=${DISPLAY:-<unset>}"
echo "WAYLAND_DISPLAY=${WAYLAND_DISPLAY:-<unset>}"
echo "XAUTHORITY=${XAUTHORITY:-<unset>}"
echo "XDG_SESSION_TYPE=${XDG_SESSION_TYPE:-<unset>}"
echo

uid="$(id -u)"
if [[ -z "${XAUTHORITY:-}" ]]; then
  for f in "/run/user/${uid}"/xauth_*; do
    [[ -f "$f" ]] && echo "Found xauth cookie: $f"
  done
fi

if [[ -S /tmp/.X11-unix/X0 ]]; then
  echo "X11 socket /tmp/.X11-unix/X0 exists"
else
  echo "WARNING: no /tmp/.X11-unix/X0 — is a graphical session running?"
fi

echo
echo "=== JDK GUI libraries (libawt_xawt.so) ==="
java_home="$(dirname "$(dirname "$(readlink -f "$(command -v java)")")")"
xawt="$java_home/lib/libawt_xawt.so"
if [[ -f "$xawt" ]]; then
  echo "OK: $xawt"
else
  echo "MISSING: $xawt"
  echo
  echo "You likely have the headless JDK only (no Swing/AWT/X11 support)."
  echo "Fedora fix:"
  echo "  sudo dnf install java-25-openjdk"
  echo
  echo "Or install full JDK 21 and point Gradle at it:"
  echo "  sudo dnf install java-21-openjdk-devel"
  rpm -q java-25-openjdk java-25-openjdk-headless 2>/dev/null || true
fi

echo
echo "=== Java headless probe (with DISPLAY=${DISPLAY:-:0}) ==="
export DISPLAY="${DISPLAY:-:0}"
tmp="$(mktemp -d)"
cat > "$tmp/HeadlessCheck.java" <<'EOF'
import java.awt.GraphicsEnvironment;

public class HeadlessCheck {
    public static void main(String[] args) {
        System.out.println("headless=" + GraphicsEnvironment.isHeadless());
        if (!GraphicsEnvironment.isHeadless()) {
            int screens = GraphicsEnvironment.getLocalGraphicsEnvironment().getScreenDevices().length;
            System.out.println("screens=" + screens);
        }
    }
}
EOF
if javac "$tmp/HeadlessCheck.java" 2>/dev/null; then
  java -Djava.awt.headless=false -cp "$tmp" HeadlessCheck
else
  echo "Could not compile probe (javac missing?)"
fi
rm -rf "$tmp"

echo
echo "If headless=true, Cursor's terminal cannot reach your display."
echo "Try: Konsole on your desktop → cd src && ./run-desktop.sh"
