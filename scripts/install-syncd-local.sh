#!/usr/bin/env bash
# Install rommdeck-syncd for local development on this machine.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "Building syncd…"
npm run build:core
npm run build:syncd

node --input-type=module -e "
import { installSyncDaemonUnit } from './packages/core/dist/sync/install-daemon.js';
const result = await installSyncDaemonUnit(['$REPO_ROOT']);
if (!result.ok) {
  console.error(result.output);
  process.exit(1);
}
console.log(result.output);
console.log('Enable: systemctl --user enable --now rommdeck-syncd.service');
"
