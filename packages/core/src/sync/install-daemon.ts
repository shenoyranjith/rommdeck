import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  chmodSync,
  symlinkSync,
  unlinkSync,
  cpSync,
  copyFileSync,
  rmSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getDataDir } from "../paths.js";

const execFileAsync = promisify(execFile);

/** Isolated Node runtime for syncd — never touches repo node_modules (Electron ABI). */
export function syncDaemonRuntimeDir(): string {
  return join(getDataDir(), "syncd-runtime");
}

export interface InstallSyncDaemonResult {
  ok: boolean;
  output: string;
  appRoot?: string;
}

export function syncDaemonUnitPath(): string {
  return join(homedir(), ".config/systemd/user/rommdeck-syncd.service");
}

export function syncDaemonBinPath(): string {
  return join(homedir(), ".local/bin/rommdeck-syncd");
}

export function isSyncDaemonUnitInstalled(): boolean {
  return existsSync(syncDaemonUnitPath());
}

/** Locate repo/app root containing packages/syncd/dist/cli.js */
export function findRommDeckAppRoot(startDirs: string[] = []): string | null {
  if (process.env.ROMMDECK_APP_ROOT) {
    const root = process.env.ROMMDECK_APP_ROOT;
    if (existsSync(join(root, "packages/syncd/dist/cli.js"))) return root;
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    ...startDirs,
    process.cwd(),
    join(here, "../../.."),
    join(here, "../../../.."),
  ];

  const seen = new Set<string>();
  for (const root of candidates) {
    const abs = root.startsWith("/") ? root : join(process.cwd(), root);
    if (seen.has(abs)) continue;
    seen.add(abs);
    if (existsSync(join(abs, "packages/syncd/dist/cli.js"))) return abs;
  }
  return null;
}

function symlinkDir(target: string, linkPath: string): void {
  mkdirSync(dirname(linkPath), { recursive: true });
  try {
    unlinkSync(linkPath);
  } catch {
    // missing
  }
  symlinkSync(target, linkPath, "dir");
}

function buildWrapperScript(runtimeDir: string): string {
  const runtime = runtimeDir.replace(/'/g, "'\\''");
  return `#!/usr/bin/env bash
set -euo pipefail
RUNTIME='${runtime}'
export NODE_PATH="$RUNTIME/node_modules"
exec node "$RUNTIME/packages/syncd/dist/cli.js" "$@"
`;
}

async function ensureSyncDaemonBuilt(appRoot: string): Promise<void> {
  const cli = join(appRoot, "packages/syncd/dist/cli.js");
  if (existsSync(cli)) return;
  await execFileAsync("npm", ["run", "build:core"], { cwd: appRoot });
  await execFileAsync("npm", ["run", "build:syncd"], { cwd: appRoot });
  if (!existsSync(cli)) {
    throw new Error("syncd build did not produce packages/syncd/dist/cli.js");
  }
}

function copyTree(src: string, dest: string): void {
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true, force: true });
}

/** Node-only deps for syncd; copies built packages so Node never realpath's into the repo. */
async function setupSyncDaemonRuntime(appRoot: string): Promise<string> {
  const runtime = syncDaemonRuntimeDir();
  mkdirSync(runtime, { recursive: true });

  const pkg = {
    name: "rommdeck-syncd-runtime",
    private: true,
    type: "module",
    dependencies: {
      "better-sqlite3": "^11.8.1",
      chokidar: "^4.0.3",
    },
  };
  const pkgText = `${JSON.stringify(pkg, null, 2)}\n`;
  const pkgPath = join(runtime, "package.json");
  const needsInstall =
    !existsSync(join(runtime, "node_modules/better-sqlite3")) ||
    !existsSync(pkgPath) ||
    readFileSync(pkgPath, "utf8") !== pkgText;
  writeFileSync(pkgPath, pkgText, "utf8");

  if (needsInstall) {
    await execFileAsync("npm", ["install", "--omit=dev"], { cwd: runtime });
  }

  // Drop stale symlinks from older installs (rmSync through symlinks deleted repo dist).
  rmSync(join(runtime, "packages"), { recursive: true, force: true });
  rmSync(join(runtime, "node_modules/@rommdeck"), { recursive: true, force: true });
  mkdirSync(join(runtime, "packages/core"), { recursive: true });
  mkdirSync(join(runtime, "packages/syncd"), { recursive: true });

  // Copy — Node resolves native deps from the module file path, not the repo.
  copyTree(join(appRoot, "packages/core/dist"), join(runtime, "packages/core/dist"));
  copyFileSync(join(appRoot, "packages/core/package.json"), join(runtime, "packages/core/package.json"));
  copyTree(join(appRoot, "packages/syncd/dist"), join(runtime, "packages/syncd/dist"));
  copyFileSync(join(appRoot, "packages/syncd/package.json"), join(runtime, "packages/syncd/package.json"));
  if (existsSync(join(appRoot, "data"))) {
    copyTree(join(appRoot, "data"), join(runtime, "data"));
  }

  symlinkDir(join(runtime, "packages/core"), join(runtime, "node_modules/@rommdeck/core"));

  return runtime;
}

/** Install ~/.local/bin/rommdeck-syncd and the systemd user unit. */
export async function installSyncDaemonUnit(
  startDirs: string[] = [],
): Promise<InstallSyncDaemonResult> {
  if (process.platform !== "linux") {
    return { ok: false, output: "systemd install is only supported on Linux" };
  }

  const appRoot = findRommDeckAppRoot(startDirs);
  if (!appRoot) {
    return {
      ok: false,
      output:
        "Could not find RommDeck install (missing packages/syncd/dist/cli.js). " +
        "Run npm run build from the repo root, or set ROMMDECK_APP_ROOT.",
    };
  }

  try {
    await ensureSyncDaemonBuilt(appRoot);
    const runtime = await setupSyncDaemonRuntime(appRoot);

    const binPath = syncDaemonBinPath();
    mkdirSync(dirname(binPath), { recursive: true });
    writeFileSync(binPath, buildWrapperScript(runtime), "utf8");
    chmodSync(binPath, 0o755);

    const unitDir = dirname(syncDaemonUnitPath());
    mkdirSync(unitDir, { recursive: true });
    const templatePath = join(appRoot, "packaging/systemd/rommdeck-syncd.service");
    if (!existsSync(templatePath)) {
      return { ok: false, output: `Missing unit template: ${templatePath}` };
    }
    const unit = readFileSync(templatePath, "utf8").replace(
      /^ExecStart=.*$/m,
      `ExecStart=${binPath}`,
    );
    writeFileSync(syncDaemonUnitPath(), unit, "utf8");

    await execFileAsync("systemctl", ["--user", "daemon-reload"]);

    return {
      ok: true,
      output:
        `Installed sync daemon (runtime: ${runtime}, source: ${appRoot}). ` +
        "Repo node_modules is unchanged (Electron ABI).",
      appRoot,
    };
  } catch (e) {
    return {
      ok: false,
      output: e instanceof Error ? e.message : String(e),
      appRoot,
    };
  }
}

/** Install or refresh runtime + unit. */
export async function ensureSyncDaemonUnit(
  startDirs: string[] = [],
): Promise<InstallSyncDaemonResult> {
  return installSyncDaemonUnit(startDirs);
}

/** Refresh copied packages in the runtime (after rebuild); keeps Node native deps isolated. */
export async function refreshSyncDaemonRuntime(
  startDirs: string[] = [],
): Promise<InstallSyncDaemonResult> {
  if (!existsSync(syncDaemonRuntimeDir())) {
    return ensureSyncDaemonUnit(startDirs);
  }
  const appRoot = findRommDeckAppRoot(startDirs);
  if (!appRoot) {
    return { ok: false, output: "Could not find RommDeck source for syncd runtime refresh" };
  }
  try {
    await ensureSyncDaemonBuilt(appRoot);
    const runtime = await setupSyncDaemonRuntime(appRoot);
    return { ok: true, output: `Refreshed sync daemon runtime at ${runtime}`, appRoot };
  } catch (e) {
    return {
      ok: false,
      output: e instanceof Error ? e.message : String(e),
      appRoot,
    };
  }
}
