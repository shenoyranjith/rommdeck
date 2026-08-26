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
  isRomDownloaded,
  readDaemonStatus,
  ensureDevice,
  runSyncSession,
  rommSlugToEsdeFolder,
  type RommDeckConfig,
  type RommRom,
} from "@rommdeck/core";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let downloadManager: DownloadManager | null = null;
let libraryIndex: LibraryIndex | null = null;

function getIndex(): LibraryIndex {
  if (!libraryIndex) libraryIndex = new LibraryIndex();
  return libraryIndex;
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
      platformMapOverrides: cfg.platformMapOverrides,
    });
    downloadManager.on("job", (job) => {
      mainWindow?.webContents.send("downloads:job", job);
    });
    downloadManager.on("queue", (jobs) => {
      mainWindow?.webContents.send("downloads:queue", jobs);
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
  console.log(`[rommdeck] preload: ${preload}`);
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: "RommDeck",
    backgroundColor: "#0f1419",
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      // sandbox must stay enabled for CJS preload (require("electron"))
      sandbox: true,
    },
  });

  mainWindow.webContents.on("preload-error", (_event, preloadPath, error) => {
    console.error(`[rommdeck] preload failed (${preloadPath}):`, error);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    // Docked DevTools — detached mode left orphan windows on every restart
    mainWindow.webContents.openDevTools({ mode: "right" });
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
  ipcMain.removeHandler("paths:retrodeck");
  ipcMain.removeHandler("platform:mapFolder");
  ipcMain.removeHandler("downloads:enqueue");
  ipcMain.removeHandler("downloads:enqueueMany");
  ipcMain.removeHandler("downloads:enqueuePlatform");
  ipcMain.removeHandler("downloads:list");
  ipcMain.removeHandler("downloads:cancel");
  ipcMain.removeHandler("library:deleteLocal");
  ipcMain.removeHandler("library:downloadedIds");
  ipcMain.removeHandler("daemon:status");
  ipcMain.removeHandler("daemon:systemctl");
  ipcMain.removeHandler("sync:now");
  ipcMain.removeHandler("shell:openPath");

  ipcMain.handle("config:get", () => loadConfig());

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
    return client.getPlatforms();
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
        const downloaded = slug
          ? isRomDownloaded(rom, index, paths.romsPath, slug, cfg.platformMapOverrides)
          : index.getByRomId(rom.id).length > 0;
        return {
          ...rom,
          downloaded,
          coverUrl: client.coverUrlFor(rom),
        };
      });
      return { ...result, items };
    },
  );

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
      const jobs = [];
      for (const item of items) {
        const rom = await client.getRom(item.romId);
        jobs.push(dm.enqueue(rom, item.platformSlug));
      }
      return jobs;
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
          dm.enqueue(rom, slug);
          queued++;
        }
        offset += page.items.length;
        if (page.items.length === 0) break;
      }

      return { queued, skipped, total: Number.isFinite(total) ? total : queued + skipped };
    },
  );

  ipcMain.handle("downloads:list", () => getDownloadManager().getJobs());
  ipcMain.handle("downloads:cancel", (_e, jobId: string) => {
    getDownloadManager().cancel(jobId);
  });

  ipcMain.handle("library:deleteLocal", (_e, romId: number) => {
    return deleteLocalRom(getIndex(), romId);
  });

  ipcMain.handle("library:downloadedIds", () => {
    return [...getIndex().getDownloadedRomIds()];
  });

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

app.whenReady().then(() => {
  installRommAssetAuth();
  registerIpc();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  libraryIndex?.close();
  if (process.platform !== "darwin") app.quit();
});
