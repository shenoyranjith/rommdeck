import chokidar from "chokidar";
import {
  loadConfig,
  saveConfig,
  createRommClient,
  LibraryIndex,
  resolveRetroDeckPaths,
  ensureDevice,
  runSyncSession,
  writeDaemonStatus,
  getLogsDir,
} from "@rommdeck/core";
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

function log(msg: string): void {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    mkdirSync(getLogsDir(), { recursive: true });
    appendFileSync(join(getLogsDir(), "syncd.log"), line + "\n");
  } catch {
    // ignore log write failures
  }
}

async function syncOnce(reason: string): Promise<void> {
  const cfg = loadConfig();
  if (!cfg.romm.baseUrl || !cfg.romm.apiToken) {
    log(`skip sync (${reason}): RomM not configured`);
    writeDaemonStatus({
      running: true,
      pid: process.pid,
      lastError: "RomM not configured",
      lastResult: "error",
    });
    return;
  }

  const paths = resolveRetroDeckPaths(cfg.retrodeck);
  if (!paths.savesPath || !paths.statesPath) {
    log(`skip sync (${reason}): RetroDECK saves/states paths missing`);
    writeDaemonStatus({
      running: true,
      pid: process.pid,
      lastError: "RetroDECK paths missing",
      lastResult: "error",
    });
    return;
  }

  const client = createRommClient(cfg.romm.baseUrl, cfg.romm.apiToken);
  const index = new LibraryIndex();
  try {
    const syncPaths = {
      romsPath: paths.romsPath,
      savesPath: paths.savesPath,
      statesPath: paths.statesPath,
    };
    const device = await ensureDevice(client, {
      deviceId: cfg.sync.deviceId,
      deviceName: cfg.sync.deviceName,
      syncMode: cfg.sync.mode,
      paths: syncPaths,
      registerNew: cfg.sync.registerNewDevice,
      resetSyncHistory: cfg.sync.resetSyncHistory,
    });
    let configDirty = false;
    if (cfg.sync.deviceId !== device.deviceId) {
      cfg.sync.deviceId = device.deviceId;
      configDirty = true;
    }
    if (cfg.sync.registerNewDevice || cfg.sync.resetSyncHistory) {
      cfg.sync.registerNewDevice = false;
      cfg.sync.resetSyncHistory = false;
      configDirty = true;
    }
    if (configDirty) saveConfig(cfg);

    log(`sync start (${reason}) device=${device.deviceId}`);
    const result = await runSyncSession(client, index, {
      deviceId: device.deviceId,
      paths: syncPaths,
      conflictPolicy: cfg.sync.conflictPolicy,
      unattended: true,
    });

    const lastResult =
      result.failed === 0 && result.conflicts.length === 0
        ? "ok"
        : result.completed > 0
          ? "partial"
          : "error";

    writeDaemonStatus({
      running: true,
      pid: process.pid,
      lastSyncAt: new Date().toISOString(),
      lastResult,
      lastError: result.errors[0] ?? null,
      pendingConflicts: result.conflicts,
      completedOps: result.completed,
      failedOps: result.failed,
    });
    log(
      `sync done (${reason}) completed=${result.completed} failed=${result.failed} conflicts=${result.conflicts.length}`,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log(`sync error (${reason}): ${msg}`);
    writeDaemonStatus({
      running: true,
      pid: process.pid,
      lastSyncAt: new Date().toISOString(),
      lastResult: "error",
      lastError: msg,
    });
  } finally {
    index.close();
  }
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  writeDaemonStatus({
    running: true,
    pid: process.pid,
    lastError: null,
  });
  log(`rommdeck-syncd starting pid=${process.pid} interval=${cfg.sync.intervalSeconds}s debounce=${cfg.sync.debounceSeconds}s`);

  let debounceTimer: NodeJS.Timeout | null = null;
  let syncing = false;
  let pending = false;

  const trigger = async (reason: string) => {
    if (syncing) {
      pending = true;
      return;
    }
    syncing = true;
    try {
      await syncOnce(reason);
    } finally {
      syncing = false;
      if (pending) {
        pending = false;
        await trigger("queued");
      }
    }
  };

  const scheduleDebounced = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      void trigger("fs-watch");
    }, cfg.sync.debounceSeconds * 1000);
  };

  const paths = resolveRetroDeckPaths(cfg.retrodeck);
  const watchRoots = [paths.savesPath, paths.statesPath].filter(Boolean);
  if (watchRoots.length > 0) {
    const watcher = chokidar.watch(watchRoots, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 500 },
    });
    watcher.on("all", (event, path) => {
      log(`fs ${event} ${path}`);
      scheduleDebounced();
    });
    log(`watching ${watchRoots.join(", ")}`);
  } else {
    log("no saves/states paths to watch");
  }

  // Initial sync after short delay
  setTimeout(() => void trigger("startup"), 2000);

  setInterval(
    () => void trigger("interval"),
    Math.max(60, cfg.sync.intervalSeconds) * 1000,
  );

  const shutdown = () => {
    log("shutting down");
    writeDaemonStatus({ running: false, pid: null });
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  console.error(e);
  writeDaemonStatus({
    running: false,
    pid: null,
    lastResult: "error",
    lastError: e instanceof Error ? e.message : String(e),
  });
  process.exit(1);
});
