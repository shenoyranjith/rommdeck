import { app, BrowserWindow, ipcMain, shell, session } from "electron";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  loadConfig,
  saveConfig,
  updateConfig,
  createRommClient,
  LibraryIndex,
  resolveRetroDeckPaths,
  DownloadManager,
  deleteLocalRom,
  isGamelistWriteActive,
  shutdownGamelistWrites,
  getRomLocalStatus,
  isRomDownloaded,
  readDaemonStatus,
  ensureDevice,
  runSyncSession,
  rommSlugToEsdeFolder,
  romHasEsdeMetadata,
  type RommDeckConfig,
  type RommRom,
  log,
  getAppLogPath,
} from "@rommdeck/core";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let downloadManager: DownloadManager | null = null;
let libraryIndex: LibraryIndex | null = null;
let quitting = false;
let queueRestoreScheduled = false;
let quitConfirmResolve: ((confirmed: boolean) => void) | null = null;

/** Defer queue restore until after the library can load platforms (or a short fallback). */
function scheduleQueueRestore(): void {
  if (queueRestoreScheduled) return;
  queueRestoreScheduled = true;
  void getDownloadManager()
    .restorePersistedQueue()
    .catch((e) => {
      log.download("queue restore failed", {
        error: e instanceof Error ? e.message : String(e),
      });
    });
}

function hasActiveTransfers(): boolean {
  if (downloadManager?.hasActiveWork()) return true;
  return isGamelistWriteActive();
}

function askRendererToConfirmQuit(breakdown: {
  downloading: number;
  queued: number;
  metadata: number;
  gamelistWriteActive: boolean;
}): Promise<boolean> {
  const win = mainWindow;
  if (!win || win.isDestroyed()) return Promise.resolve(false);

  return new Promise((resolve) => {
    quitConfirmResolve = resolve;
    win.webContents.send("app:quitConfirm", breakdown);
  });
}

async function performQuit(win: BrowserWindow | null): Promise<void> {
  if (hasActiveTransfers()) {
    await downloadManager?.prepareForShutdown();
  } else {
    downloadManager?.flushPersistedQueue();
  }
  await shutdownGamelistWrites();
  quitting = true;
  if (win && !win.isDestroyed()) win.close();
  else app.quit();
}

async function requestAppQuit(win: BrowserWindow | null): Promise<void> {
  if (quitting) return;

  if (hasActiveTransfers()) {
    const breakdown = downloadManager?.getActiveBreakdown() ?? {
      downloading: 0,
      queued: 0,
      metadata: 0,
      gamelistWriteActive: isGamelistWriteActive(),
      total: 0,
    };
    const confirmed = await askRendererToConfirmQuit(breakdown);
    if (!confirmed) return;
  }

  await performQuit(win);
}

function attachWindowCloseGuard(win: BrowserWindow): void {
  win.on("close", (e) => {
    if (quitting) return;
    e.preventDefault();
    void requestAppQuit(win);
  });
}

function getIndex(): LibraryIndex {
  if (!libraryIndex) libraryIndex = new LibraryIndex();
  return libraryIndex;
}

function primaryRomFilename(rom: RommRom, index: LibraryIndex): string | undefined {
  const rows = index.getByRomId(rom.id);
  if (rows.length > 0) return rows[0]?.filename;
  if (rom.fs_name) return rom.fs_name;
  const first = rom.files?.[0];
  return first?.file_name;
}

function romLocalFlags(
  rom: RommRom,
  index: LibraryIndex,
  romsPath: string,
  slug: string,
  overrides: Record<string, string>,
  rdHomePath?: string,
  downloadedMediaPath?: string,
): { downloaded: boolean; verified?: boolean; metadataMissing?: boolean } {
  if (!slug) {
    const rows = index.getByRomId(rom.id);
    if (rows.length === 0) return { downloaded: false };
    const downloaded = true;
    const verified = rows.every((r) => r.verified);
    const primary = rows[0]?.filename;
    const metadataMissing =
      rdHomePath && primary
        ? !romHasEsdeMetadata({
            rdHomePath,
            downloadedMediaPath,
            rommSlug: rows[0]?.romm_slug ?? "",
            primaryFilename: primary,
            platformMapOverrides: overrides,
          })
        : undefined;
    return { downloaded, verified, metadataMissing };
  }
  const status = getRomLocalStatus(rom, index, romsPath, slug, overrides);
  if (status === "missing") return { downloaded: false };
  const primary = primaryRomFilename(rom, index);
  const metadataMissing =
    rdHomePath && primary
      ? !romHasEsdeMetadata({
          rdHomePath,
          downloadedMediaPath,
          rommSlug: slug,
          primaryFilename: primary,
          platformMapOverrides: overrides,
        })
      : undefined;
  return {
    downloaded: true,
    verified: status === "verified",
    metadataMissing,
  };
}

function getDownloadManager(): DownloadManager {
  if (!downloadManager) {
    const cfg = loadConfig();
    const paths = resolveRetroDeckPaths(cfg.retrodeck);
    const client = createRommClient(cfg.romm.baseUrl, cfg.romm.apiToken);
    downloadManager = new DownloadManager({
      client,
      index: getIndex(),
      romsPath: paths.romsPath,
      rdHomePath: paths.rdHomePath,
      downloadedMediaPath: paths.downloadedMediaPath,
      platformMapOverrides: cfg.platformMapOverrides,
    });
    log.download("DownloadManager initialized", {
      romsPath: paths.romsPath,
      rdHomePath: paths.rdHomePath,
      downloadedMediaPath: paths.downloadedMediaPath,
      rdHomeSource: paths.source,
    });
    downloadManager.on("job", (job) => {
      mainWindow?.webContents.send("downloads:job", job);
    });
    downloadManager.on("queue", (jobs) => {
      mainWindow?.webContents.send("downloads:queue", jobs);
    });
    downloadManager.on("failed", (jobs) => {
      mainWindow?.webContents.send("downloads:failed", jobs);
    });
  }
  return downloadManager;
}

function resetDownloadManager(): void {
  downloadManager = null;
}

function resolvePreloadPath(): string {
  const candidates = [
    path.join(__dirname, "preload.js"),
    path.join(__dirname, "preload.mjs"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  throw new Error(`RommDeck preload script not found next to ${__dirname}`);
}

function createWindow(): void {
  // Same process: never open a second window (HMR / accidental double ready)
  const existing = BrowserWindow.getAllWindows()[0];
  if (existing && !existing.isDestroyed()) {
    mainWindow = existing;
    if (process.env.VITE_DEV_SERVER_URL) {
      void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    }
    mainWindow.focus();
    return;
  }

  const preload = resolvePreloadPath();
  log.app("window creating", { preload });
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 640,
    title: "RommDeck",
    // Match default candy accent — CSS frame is a body fill ring; edge clip reveals this.
    backgroundColor: "#ff2d95",
    frame: false,
    show: false,
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      // sandbox must stay enabled for CJS preload (require("electron"))
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  const emitMaximized = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send("window:maximized", mainWindow.isMaximized());
  };
  mainWindow.on("maximize", emitMaximized);
  mainWindow.on("unmaximize", emitMaximized);

  mainWindow.webContents.on("preload-error", (_event, preloadPath, error) => {
    log.error("app", "preload failed", {
      preloadPath,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  attachWindowCloseGuard(mainWindow);

  if (process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    // Docked DevTools — detached mode left orphan windows on every restart
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

/** Preload rebuild: refresh open windows instead of relying only on Vite WS. */
process.on("message", (msg) => {
  if (msg === "electron-vite&type=hot-reload") {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.reload();
    }
  }
});

function registerIpc(): void {
  // Idempotent: main HMR / double-ready must not throw on re-register
  ipcMain.removeHandler("config:get");
  ipcMain.removeHandler("config:save");
  ipcMain.removeHandler("config:replace");
  ipcMain.removeHandler("romm:test");
  ipcMain.removeHandler("romm:platforms");
  ipcMain.removeHandler("romm:roms");
  ipcMain.removeHandler("romm:rom");
  ipcMain.removeHandler("paths:retrodeck");
  ipcMain.removeHandler("platform:mapFolder");
  ipcMain.removeHandler("downloads:enqueue");
  ipcMain.removeHandler("downloads:enqueueMany");
  ipcMain.removeHandler("downloads:enqueuePlatform");
  ipcMain.removeHandler("downloads:list");
  ipcMain.removeHandler("downloads:cancel");
  ipcMain.removeHandler("downloads:cancelAll");
  ipcMain.removeHandler("downloads:retry");
  ipcMain.removeHandler("downloads:retryAll");
  ipcMain.removeHandler("downloads:dismissFailed");
  ipcMain.removeHandler("downloads:clearFailed");
  ipcMain.removeHandler("library:deleteLocal");
  ipcMain.removeHandler("library:downloadedIds");
  ipcMain.removeHandler("library:downloadedRoms");
  ipcMain.removeHandler("library:stats");
  ipcMain.removeHandler("daemon:status");
  ipcMain.removeHandler("daemon:systemctl");
  ipcMain.removeHandler("sync:now");
  ipcMain.removeHandler("shell:openPath");
  ipcMain.removeHandler("window:minimize");
  ipcMain.removeHandler("window:maximize");
  ipcMain.removeHandler("window:close");
  ipcMain.removeHandler("window:isMaximized");
  ipcMain.removeHandler("window:setBackground");
  ipcMain.removeHandler("app:getVersion");
  ipcMain.removeHandler("app:quitConfirmResponse");

  ipcMain.handle("config:get", () => loadConfig());

  const windowFrom = (e: Electron.IpcMainInvokeEvent) =>
    BrowserWindow.fromWebContents(e.sender);

  ipcMain.handle("app:getVersion", () => app.getVersion());

  ipcMain.handle("app:quitConfirmResponse", (_e, confirmed: unknown) => {
    quitConfirmResolve?.(confirmed === true);
    quitConfirmResolve = null;
  });

  ipcMain.handle("window:minimize", (e) => {
    windowFrom(e)?.minimize();
  });
  ipcMain.handle("window:maximize", (e) => {
    const win = windowFrom(e);
    if (!win) return false;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
    return win.isMaximized();
  });
  ipcMain.handle("window:close", (e) => {
    windowFrom(e)?.close();
  });
  ipcMain.handle("window:isMaximized", (e) => windowFrom(e)?.isMaximized() ?? false);
  ipcMain.handle("window:setBackground", (e, color: string) => {
    const win = windowFrom(e);
    if (win && typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color)) {
      win.setBackgroundColor(color);
    }
  });

  ipcMain.handle("config:save", (_e, partial: Partial<RommDeckConfig>) => {
    const next = updateConfig(partial);
    resetDownloadManager();
    return next;
  });

  ipcMain.handle("config:replace", (_e, full: RommDeckConfig) => {
    saveConfig(full);
    resetDownloadManager();
    return loadConfig();
  });

  ipcMain.handle("romm:test", async () => {
    const cfg = loadConfig();
    const client = createRommClient(cfg.romm.baseUrl, cfg.romm.apiToken);
    return client.testConnection();
  });

  ipcMain.handle("romm:platforms", async () => {
    const cfg = loadConfig();
    const client = createRommClient(cfg.romm.baseUrl, cfg.romm.apiToken);
    const platforms = await client.getPlatforms();
    const result = platforms.map((p) => ({
      ...p,
      logoUrl: client.logoUrlFor(p),
      displayName: p.display_name || p.custom_name || p.name,
    }));
    scheduleQueueRestore();
    return result;
  });

  ipcMain.handle(
    "romm:roms",
    async (
      _e,
      opts: {
        platformId?: number;
        platformSlug?: string;
        searchTerm?: string;
        limit?: number;
        offset?: number;
      },
    ) => {
      const cfg = loadConfig();
      const client = createRommClient(cfg.romm.baseUrl, cfg.romm.apiToken);
      const paths = resolveRetroDeckPaths(cfg.retrodeck);
      const result = await client.getRoms(opts);
      const index = getIndex();
      const items = result.items.map((rom: RommRom) => {
        const slug = rom.platform_slug ?? opts.platformSlug ?? "";
        const local = romLocalFlags(
          rom,
          index,
          paths.romsPath,
          slug,
          cfg.platformMapOverrides,
          paths.rdHomePath,
          paths.downloadedMediaPath,
        );
        return {
          ...rom,
          ...local,
          coverUrl: client.coverUrlFor(rom),
        };
      });
      return { ...result, items };
    },
  );

  ipcMain.handle("romm:rom", async (_e, romId: number) => {
    const cfg = loadConfig();
    const client = createRommClient(cfg.romm.baseUrl, cfg.romm.apiToken);
    const paths = resolveRetroDeckPaths(cfg.retrodeck);
    const rom = await client.getRom(romId);
    const index = getIndex();
    const slug = rom.platform_slug ?? "";
    const local = romLocalFlags(
      rom,
      index,
      paths.romsPath,
      slug,
      cfg.platformMapOverrides,
      paths.rdHomePath,
      paths.downloadedMediaPath,
    );
    return {
      ...rom,
      ...local,
      coverUrl: client.coverUrlFor(rom, "large"),
      coverUrlSmall: client.coverUrlFor(rom, "small"),
    };
  });

  ipcMain.handle("paths:retrodeck", () => {
    const cfg = loadConfig();
    return resolveRetroDeckPaths(cfg.retrodeck);
  });

  ipcMain.handle("platform:mapFolder", (_e, slug: string) => {
    const cfg = loadConfig();
    return rommSlugToEsdeFolder(slug, cfg.platformMapOverrides);
  });

  ipcMain.handle("downloads:enqueue", async (_e, romId: number, platformSlug: string) => {
    const cfg = loadConfig();
    const client = createRommClient(cfg.romm.baseUrl, cfg.romm.apiToken);
    const rom = await client.getRom(romId);
    return getDownloadManager().enqueue(rom, platformSlug);
  });

  ipcMain.handle(
    "downloads:enqueueMany",
    async (_e, items: { romId: number; platformSlug: string }[]) => {
      const cfg = loadConfig();
      const client = createRommClient(cfg.romm.baseUrl, cfg.romm.apiToken);
      const dm = getDownloadManager();
      const roms: { rom: RommRom; rommSlug: string }[] = [];
      for (const item of items) {
        const rom = await client.getRom(item.romId);
        roms.push({ rom, rommSlug: item.platformSlug });
      }
      return dm.enqueueMany(roms);
    },
  );

  ipcMain.handle(
    "downloads:enqueuePlatform",
    async (_e, platformId: number, platformSlug: string) => {
      const cfg = loadConfig();
      const client = createRommClient(cfg.romm.baseUrl, cfg.romm.apiToken);
      const paths = resolveRetroDeckPaths(cfg.retrodeck);
      const index = getIndex();
      const dm = getDownloadManager();
      const pageSize = 100;
      let offset = 0;
      let total = Infinity;
      let queued = 0;
      let skipped = 0;

      dm.beginBatch();
      try {
        while (offset < total) {
          const page = await client.getRoms({
            platformId,
            limit: pageSize,
            offset,
          });
          total = page.total;
          for (const rom of page.items) {
            const slug = rom.platform_slug ?? platformSlug;
            if (isRomDownloaded(rom, index, paths.romsPath, slug, cfg.platformMapOverrides)) {
              skipped++;
              continue;
            }
            if (dm.isRomInQueue(rom.id)) {
              skipped++;
              continue;
            }
            dm.enqueue(rom, slug);
            queued++;
          }
          offset += page.items.length;
          if (page.items.length === 0) break;
        }
      } finally {
        dm.endBatch();
      }

      return { queued, skipped, total: Number.isFinite(total) ? total : queued + skipped };
    },
  );

  ipcMain.handle("downloads:list", () => getDownloadManager().getQueueState());
  ipcMain.handle("downloads:cancel", (_e, jobId: string) => {
    getDownloadManager().cancel(jobId);
  });
  ipcMain.handle("downloads:cancelAll", () => {
    getDownloadManager().cancelAll();
  });
  ipcMain.handle("downloads:retry", async (_e, jobId: string) => {
    return getDownloadManager().retry(jobId);
  });
  ipcMain.handle("downloads:retryAll", async () => {
    return getDownloadManager().retryAll();
  });
  ipcMain.handle("downloads:dismissFailed", (_e, jobId: string) => {
    getDownloadManager().dismissFailed(jobId);
  });
  ipcMain.handle("downloads:clearFailed", () => {
    getDownloadManager().clearFailed();
  });

  ipcMain.handle("library:deleteLocal", async (_e, romId: number) => {
    const cfg = loadConfig();
    const paths = resolveRetroDeckPaths(cfg.retrodeck);
    return deleteLocalRom(getIndex(), romId, {
      rdHomePath: paths.rdHomePath,
      downloadedMediaPath: paths.downloadedMediaPath,
    });
  });

  ipcMain.handle("library:downloadedIds", (_e, platformSlug?: string) => {
    const index = getIndex();
    if (platformSlug) return index.getDownloadedRomIdsForSlug(platformSlug);
    return [...index.getDownloadedRomIds()];
  });

  ipcMain.handle("library:downloadedRoms", async (_e, platformSlug: string) => {
    const cfg = loadConfig();
    const client = createRommClient(cfg.romm.baseUrl, cfg.romm.apiToken);
    const paths = resolveRetroDeckPaths(cfg.retrodeck);
    const ids = getIndex().getDownloadedRomIdsForSlug(platformSlug);
    if (ids.length === 0) return [];

    const concurrency = 8;
    const results: unknown[] = new Array(ids.length);
    let cursor = 0;

    async function worker() {
      while (cursor < ids.length) {
        const idx = cursor++;
        const romId = ids[idx]!;
        try {
          const rom = await client.getRom(romId);
          const local = romLocalFlags(
            rom,
            getIndex(),
            paths.romsPath,
            platformSlug,
            cfg.platformMapOverrides,
            paths.rdHomePath,
            paths.downloadedMediaPath,
          );
          results[idx] = {
            ...rom,
            ...local,
            coverUrl: client.coverUrlFor(rom),
            coverUrlSmall: client.coverUrlFor(rom, "small"),
          };
        } catch {
          results[idx] = null;
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(concurrency, ids.length) }, () => worker()),
    );
    return results.filter(Boolean);
  });

  ipcMain.handle("library:stats", () => getIndex().getStats());

  ipcMain.handle("daemon:status", () => readDaemonStatus());

  ipcMain.handle("daemon:systemctl", async (_e, action: "enable" | "disable" | "start" | "stop" | "status") => {
    if (process.platform !== "linux") {
      return { ok: false, output: "systemd controls are only available on Linux" };
    }
    try {
      const args =
        action === "enable"
          ? ["--user", "enable", "--now", "rommdeck-syncd.service"]
          : action === "disable"
            ? ["--user", "disable", "--now", "rommdeck-syncd.service"]
            : ["--user", action, "rommdeck-syncd.service"];
      const { stdout, stderr } = await execFileAsync("systemctl", args);
      return { ok: true, output: stdout || stderr };
    } catch (e) {
      return {
        ok: false,
        output: e instanceof Error ? e.message : String(e),
      };
    }
  });

  ipcMain.handle("sync:now", async () => {
    const cfg = loadConfig();
    const paths = resolveRetroDeckPaths(cfg.retrodeck);
    const client = createRommClient(cfg.romm.baseUrl, cfg.romm.apiToken);
    const index = getIndex();
    const deviceId = await ensureDevice(client, {
      deviceId: cfg.sync.deviceId,
      deviceName: cfg.sync.deviceName,
      syncMode: cfg.sync.mode,
      paths: {
        romsPath: paths.romsPath,
        savesPath: paths.savesPath,
        statesPath: paths.statesPath,
      },
    });
    if (cfg.sync.deviceId !== deviceId) {
      cfg.sync.deviceId = deviceId;
      saveConfig(cfg);
    }
    return runSyncSession(client, index, {
      deviceId,
      paths: {
        romsPath: paths.romsPath,
        savesPath: paths.savesPath,
        statesPath: paths.statesPath,
      },
      conflictPolicy: cfg.sync.conflictPolicy,
      unattended: false,
    });
  });

  ipcMain.handle("shell:openPath", (_e, p: string) => shell.openPath(p));
}

function installRommAssetAuth(): void {
  // Cover <img> tags can't send Bearer headers — inject them for the configured RomM host.
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    try {
      const cfg = loadConfig();
      const base = cfg.romm.baseUrl?.replace(/\/+$/, "");
      if (base && details.url.startsWith(base) && cfg.romm.apiToken) {
        details.requestHeaders.Authorization = `Bearer ${cfg.romm.apiToken}`;
      }
    } catch {
      // ignore config read errors
    }
    callback({ requestHeaders: details.requestHeaders });
  });
}

app.whenReady().then(async () => {
  log.app("started", { version: app.getVersion(), logFile: getAppLogPath() });
  installRommAssetAuth();
  registerIpc();
  createWindow();
  // Fallback if the user never hits the library (e.g. opens Downloads first).
  setTimeout(() => scheduleQueueRestore(), 3000);
  app.on("before-quit", (e) => {
    if (quitting) return;
    e.preventDefault();
    void requestAppQuit(mainWindow);
  });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  libraryIndex?.close();
  if (process.platform !== "darwin") app.quit();
});
