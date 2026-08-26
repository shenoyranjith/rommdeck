#!/usr/bin/env bash
# Deploy rommdeck-syncd to a RetroDECK Linux host and restart the user unit.
# Usage: REMOTE=deck@192.168.1.20 ./scripts/deploy-syncd.sh
set -euo pipefail

REMOTE="${REMOTE:?Set REMOTE=user@host}"
REMOTE_APP="${REMOTE_APP:-.local/share/rommdeck/app}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Building packages…"
(cd "$REPO_ROOT" && npm run build:core && npm run build:syncd)

echo "Syncing to $REMOTE:~/$REMOTE_APP …"
ssh "$REMOTE" "mkdir -p ~/$REMOTE_APP/packages/core/dist ~/$REMOTE_APP/packages/syncd/dist ~/$REMOTE_APP/data ~/$REMOTE_APP/packaging/systemd ~/.local/bin ~/.config/systemd/user"

rsync -az --delete "$REPO_ROOT/packages/core/dist/" "$REMOTE:~/$REMOTE_APP/packages/core/dist/"
rsync -az "$REPO_ROOT/packages/core/package.json" "$REMOTE:~/$REMOTE_APP/packages/core/package.json"
rsync -az --delete "$REPO_ROOT/packages/syncd/dist/" "$REMOTE:~/$REMOTE_APP/packages/syncd/dist/"
rsync -az "$REPO_ROOT/packages/syncd/package.json" "$REMOTE:~/$REMOTE_APP/packages/syncd/package.json"
rsync -az "$REPO_ROOT/data/platform-map.json" "$REMOTE:~/$REMOTE_APP/data/platform-map.json"
rsync -az "$REPO_ROOT/packaging/systemd/rommdeck-syncd.service" "$REMOTE:~/$REMOTE_APP/packaging/systemd/rommdeck-syncd.service"
rsync -az "$REPO_ROOT/package.json" "$REMOTE:~/$REMOTE_APP/package.json"

# Install runtime deps on the host (better-sqlite3 native build)
rsync -az "$REPO_ROOT/packages/core/package.json" "$REMOTE:/tmp/rommdeck-core-pkg.json"
ssh "$REMOTE" bash -s <<EOF
set -euo pipefail
APP="\$HOME/$REMOTE_APP"
BIN="\$HOME/.local/bin"

cd "\$APP"
# Minimal package.json for host node_modules
cat > package.json <<'PKG'
{
  "name": "rommdeck-host",
  "private": true,
  "type": "module",
  "dependencies": {
    "better-sqlite3": "^11.8.1",
    "chokidar": "^4.0.3"
  }
}
PKG
npm install --omit=dev

cat > "\$BIN/rommdeck-syncd" <<WRAP
#!/usr/bin/env bash
export NODE_PATH="\$APP/node_modules:\${NODE_PATH:-}"
cd "\$APP"
exec node --experimental-vm-modules "\$APP/packages/syncd/dist/cli.js" "\$@"
WRAP
# Fix APP expansion in wrapper
cat > "\$BIN/rommdeck-syncd" <<WRAP
#!/usr/bin/env bash
APP="\$HOME/$REMOTE_APP"
export NODE_PATH="\$APP/node_modules:\${NODE_PATH:-}"
cd "\$APP"
# Resolve @rommdeck/core via symlink
mkdir -p "\$APP/node_modules/@rommdeck"
ln -sfn "\$APP/packages/core" "\$APP/node_modules/@rommdeck/core"
exec node "\$APP/packages/syncd/dist/cli.js" "\$@"
WRAP
chmod +x "\$BIN/rommdeck-syncd"

cp "\$APP/packaging/systemd/rommdeck-syncd.service" "\$HOME/.config/systemd/user/rommdeck-syncd.service"
sed -i "s|ExecStart=.*|ExecStart=\$BIN/rommdeck-syncd|" "\$HOME/.config/systemd/user/rommdeck-syncd.service"

systemctl --user daemon-reload
systemctl --user restart rommdeck-syncd.service || systemctl --user start rommdeck-syncd.service
systemctl --user --no-pager status rommdeck-syncd.service || true
EOF

echo "Deployed. Enable at login: ssh $REMOTE 'systemctl --user enable rommdeck-syncd.service'"
