#!/usr/bin/env bash
# Foreground sidecar (Ctrl+C to stop). Does not need a display.
set -euo pipefail
cd "$(dirname "$0")"
exec ./gradlew :apps:syncd:run --no-daemon "$@"
