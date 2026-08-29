import {
  app,
  BrowserWindow,
  ipcMain,
  nativeImage,
  shell,
  session,
  type NativeImage,
} from "electron";
import { existsSync, copyFileSync, mkdirSync, writeFileSync } from "node:fs";
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
  writeDaemonStatus,
  ensureDevice,
  runSyncSession,
  toSyncResultReport,
  ensureSyncDaemonUnit,
  installSyncDaemonUnit,
  refreshSyncDaemonRuntime,
  isSyncDaemonUnitInstalled,
  rommSlugToEsdeFolder,
  loadBundledPlatformMap,
  romHasEsdeMetadata,
  type RommDeckConfig,
  type RommRom,
  log,
  getAppLogPath,
} from "@rommdeck/core";

const execFileAsync = promisify(execFile);

function redactForLog(value: unknown): unknown {
  if (typeof value === "string") {
    return value.length > 120 ? `${value.slice(0, 80)}…(${value.length} chars)` : value;
  }
  if (Array.isArray(value)) {
    return value.length > 8
      ? [...value.slice(0, 8).map(redactForLog), `…+${value.length - 8}`]
      : value.map(redactForLog);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === "apiToken" || k === "token") {
        out[k] = typeof v === "string" && v ? "[redacted]" : v;
      } else {
        out[k] = redactForLog(v);
      }
    }
    return out;
  }
  return value;
}

function ipcSummary(_channel: string, args: unknown[]): Record<string, unknown> | undefined {
  if (args.length === 0) return undefined;
  const payload = args.length === 1 ? args[0] : args;
  return { args: redactForLog(payload) };
}

function ipcHandler<A extends unknown[], R>(
  channel: string,
  fn: (...args: A) => R | Promise<R>,
): (_event: Electron.IpcMainInvokeEvent, ...args: A) => Promise<R> {
  return async (_event, ...args) => {
    log.info("ipc", channel, ipcSummary(channel, args as unknown[]));
    const started = Date.now();
    try {
      const result = await fn(...args);
      log.debug("ipc", `${channel} ok`, { ms: Date.now() - started });
      return result;
    } catch (e) {
      log.error("ipc", `${channel} failed`, {
        ms: Date.now() - started,
        error: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  };
}

function ipcHandlerEvent<A extends unknown[], R>(
  channel: string,
  fn: (event: Electron.IpcMainInvokeEvent, ...args: A) => R | Promise<R>,
): (event: Electron.IpcMainInvokeEvent, ...args: A) => Promise<R> {
  return async (event, ...args) => {
    log.info("ipc", channel, ipcSummary(channel, args as unknown[]));
    const started = Date.now();
    try {
      const result = await fn(event, ...args);
      log.debug("ipc", `${channel} ok`, { ms: Date.now() - started });
      return result;
    } catch (e) {
      log.error("ipc", `${channel} failed`, {
        ms: Date.now() - started,
        error: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  };
}

async function restartSyncDaemonIfActive(): Promise<void> {
  if (process.platform !== "linux") return;
  try {
    const appRoot = path.resolve(__dirname, "../../..");
    await refreshSyncDaemonRuntime([appRoot, process.cwd()]);
    const { stdout } = await execFileAsync("systemctl", [
      "--user",
      "is-active",
      "rommdeck-syncd.service",
    ]);
    if (stdout.trim() !== "active") return;
    log.daemon("restarting sync daemon after config change");
    await execFileAsync("systemctl", ["--user", "restart", "rommdeck-syncd.service"]);
  } catch {
    // unit not installed or not running
  }
}

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
      syncMetadataOnDownload: cfg.retrodeck.syncMetadataOnDownload,
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

let appIcon: NativeImage | undefined;

function resolveAppIconPath(): string | undefined {
  const roots = [path.join(__dirname, ".."), app.getAppPath()];
  const rels = [
    path.join(__dirname, "icon.png"),
    "assets/icon-256.png",
    "assets/icon.png",
    "dist/icon.png",
    "public/icon.png",
  ];
  const seen = new Set<string>();
  for (const root of roots) {
    for (const rel of rels) {
      const p = path.isAbsolute(rel) ? rel : path.resolve(root, rel);
      if (seen.has(p) || !existsSync(p)) continue;
      seen.add(p);
      return p;
    }
  }
  return undefined;
}

function loadAppIcon(): NativeImage | undefined {
  const iconPath = resolveAppIconPath();
  if (!iconPath) return undefined;
  let image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty()) {
    log.error("app", "icon failed to load", { iconPath });
    return undefined;
  }
  if (process.platform === "linux") {
    const { width, height } = image.getSize();
    if (width !== 256 || height !== 256) {
      image = image.resize({ width: 256, height: 256, quality: "best" });
    }
  }
  log.app("icon loaded", { iconPath, size: image.getSize() });
  return image;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function resolveAssetsDir(): string | undefined {
  const candidates = [
    path.join(__dirname, "..", "assets"),
    path.join(app.getAppPath(), "assets"),
  ];
  for (const p of candidates) {
    if (existsSync(path.join(p, "icon-256.png"))) return p;
  }
  return undefined;
}

/** Register icon + .desktop so Linux DEs (Wayland/X11) can show the taskbar icon. */
function ensureLinuxDesktopIntegration(): void {
  if (process.platform !== "linux") return;

  const assetsDir = resolveAssetsDir();
  if (!assetsDir) {
    log.error("app", "linux desktop integration skipped — assets dir not found");
    return;
  }
  const home = app.getPath("home");
  const iconSizes = [256, 128, 48] as const;

  for (const size of iconSizes) {
    const src = path.join(assetsDir, size === 256 ? "icon-256.png" : `icon-${size}.png`);
    if (!existsSync(src)) continue;
    const destDir = path.join(
      home,
      ".local/share/icons/hicolor",
      `${size}x${size}`,
      "apps",
    );
    mkdirSync(destDir, { recursive: true });
    copyFileSync(src, path.join(destDir, "rommdeck.png"));
  }

  const icon256 = path.join(
    home,
    ".local/share/icons/hicolor/256x256/apps/rommdeck.png",
  );
  if (!existsSync(icon256)) return;

  const appsDir = path.join(home, ".local/share/applications");
  mkdirSync(appsDir, { recursive: true });

  const exec = `${shellQuote(process.execPath)} ${shellQuote(app.getAppPath())}`;
  const desktop = `[Desktop Entry]
Type=Application
Name=RommDeck
Comment=RomM and RetroDECK desktop bridge
Exec=${exec}
Icon=${icon256}
StartupWMClass=rommdeck
Categories=Game;
Terminal=false
`;

  writeFileSync(path.join(appsDir, "rommdeck.desktop"), desktop, "utf8");
  log.app("linux desktop entry installed", {
    desktop: path.join(appsDir, "rommdeck.desktop"),
    icon: icon256,
  });
}

function createWindow(): void {
  // Same process: never open a second window (HMR / accidental double ready)
  const existing = BrowserWindow.getAllWindows()[0];
  if (existing && !existing.isDestroyed()) {
    mainWindow = existing;
    if (appIcon) mainWindow.setIcon(appIcon);
    if (process.env.VITE_DEV_SERVER_URL) {
      void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    }
    mainWindow.focus();
    return;
  }

  const preload = resolvePreloadPath();
  log.app("window creating", { preload, hasIcon: Boolean(appIcon) });
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 640,
    title: "RommDeck",
    ...(appIcon ? { icon: appIcon } : {}),
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
    if (appIcon && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setIcon(appIcon);
    }
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
  ipcMain.removeHandler("platform:bundledMap");
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
  ipcMain.removeHandler("daemon:installed");
  ipcMain.removeHandler("daemon:install");
  ipcMain.removeHandler("daemon:systemctl");
  ipcMain.removeHandler("sync:now");
  ipcMain.removeHandler("logs:path");
  ipcMain.removeHandler("shell:openPath");
  ipcMain.removeHandler("shell:openExternal");
  ipcMain.removeHandler("window:minimize");
  ipcMain.removeHandler("window:maximize");
  ipcMain.removeHandler("window:close");
  ipcMain.removeHandler("window:isMaximized");
  ipcMain.removeHandler("window:setBackground");
  ipcMain.removeHandler("app:getVersion");
  ipcMain.removeHandler("app:quitConfirmResponse");

  ipcMain.handle("config:get", ipcHandler("config:get", () => loadConfig()));

  const windowFrom = (e: Electron.IpcMainInvokeEvent) =>
    BrowserWindow.fromWebContents(e.sender);

  ipcMain.handle("app:getVersion", ipcHandler("app:getVersion", () => app.getVersion()));

  ipcMain.handle(
    "app:quitConfirmResponse",
    ipcHandler("app:quitConfirmResponse", (_confirmed: unknown) => {
      quitConfirmResolve?.(_confirmed === true);
      quitConfirmResolve = null;
    }),
  );

  ipcMain.handle("window:minimize", ipcHandlerEvent("window:minimize", (e) => {
    windowFrom(e)?.minimize();
  }));
  ipcMain.handle("window:maximize", ipcHandlerEvent("window:maximize", (e) => {
    const win = windowFrom(e);
    if (!win) return false;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
    return win.isMaximized();
  }));
  ipcMain.handle("window:close", ipcHandlerEvent("window:close", (e) => {
    windowFrom(e)?.close();
  }));
  ipcMain.handle(
    "window:isMaximized",
    ipcHandlerEvent("window:isMaximized", (e) => windowFrom(e)?.isMaximized() ?? false),
  );
  ipcMain.handle(
    "window:setBackground",
    ipcHandlerEvent("window:setBackground", (e, color: string) => {
      const win = windowFrom(e);
      if (win && typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color)) {
        win.setBackgroundColor(color);
      }
    }),
  );

  ipcMain.handle(
    "config:save",
    ipcHandler("config:save", async (partial: Partial<RommDeckConfig>) => {
      log.config("config save", { keys: Object.keys(partial) });
      const next = updateConfig(partial);
      resetDownloadManager();
      if (partial.sync || partial.retrodeck) {
        await restartSyncDaemonIfActive();
      }
      if (partial.logging) {
        log.config("log level updated", { level: next.logging.level });
      }
      return next;
    }),
  );

  ipcMain.handle(
    "config:replace",
    ipcHandler("config:replace", (full: RommDeckConfig) => {
      log.config("config replace");
      saveConfig(full);
      resetDownloadManager();
      return loadConfig();
    }),
  );

  ipcMain.handle("romm:test", ipcHandler("romm:test", async () => {
    const cfg = loadConfig();
    const client = createRommClient(cfg.romm.baseUrl, cfg.romm.apiToken);
    return client.testConnection();
  }));

  ipcMain.handle("romm:platforms", ipcHandler("romm:platforms", async () => {
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
  }));

  ipcMain.handle(
    "romm:roms",
    ipcHandler(
      "romm:roms",
      async (opts: {
        platformId?: number;
        platformSlug?: string;
        searchTerm?: string;
        limit?: number;
        offset?: number;
      }) => {
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
    ),
  );

  ipcMain.handle("romm:rom", ipcHandler("romm:rom", async (romId: number) => {
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
  }));

  ipcMain.handle("paths:retrodeck", ipcHandler("paths:retrodeck", () => {
    const cfg = loadConfig();
    return resolveRetroDeckPaths(cfg.retrodeck);
  }));

  ipcMain.handle("platform:mapFolder", ipcHandler("platform:mapFolder", (slug: string) => {
    const cfg = loadConfig();
    return rommSlugToEsdeFolder(slug, cfg.platformMapOverrides);
  }));

  ipcMain.handle(
    "platform:bundledMap",
    ipcHandler("platform:bundledMap", () => loadBundledPlatformMap()),
  );

  ipcMain.handle(
    "downloads:enqueue",
    ipcHandler("downloads:enqueue", async (romId: number, platformSlug: string) => {
      const cfg = loadConfig();
      const client = createRommClient(cfg.romm.baseUrl, cfg.romm.apiToken);
      const rom = await client.getRom(romId);
      return getDownloadManager().enqueue(rom, platformSlug);
    }),
  );

  ipcMain.handle(
    "downloads:enqueueMany",
    ipcHandler(
      "downloads:enqueueMany",
      async (items: { romId: number; platformSlug: string }[]) => {
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
    ),
  );

  ipcMain.handle(
    "downloads:enqueuePlatform",
    ipcHandler(
      "downloads:enqueuePlatform",
      async (platformId: number, platformSlug: string) => {
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
    ),
  );

  ipcMain.handle(
    "downloads:list",
    ipcHandler("downloads:list", () => getDownloadManager().getQueueState()),
  );
  ipcMain.handle("downloads:cancel", ipcHandler("downloads:cancel", (jobId: string) => {
    getDownloadManager().cancel(jobId);
  }));
  ipcMain.handle("downloads:cancelAll", ipcHandler("downloads:cancelAll", () => {
    getDownloadManager().cancelAll();
  }));
  ipcMain.handle("downloads:retry", ipcHandler("downloads:retry", async (jobId: string) => {
    return getDownloadManager().retry(jobId);
  }));
  ipcMain.handle("downloads:retryAll", ipcHandler("downloads:retryAll", async () => {
    return getDownloadManager().retryAll();
  }));
  ipcMain.handle(
    "downloads:dismissFailed",
    ipcHandler("downloads:dismissFailed", (jobId: string) => {
      getDownloadManager().dismissFailed(jobId);
    }),
  );
  ipcMain.handle(
    "downloads:clearFailed",
    ipcHandler("downloads:clearFailed", () => {
      getDownloadManager().clearFailed();
    }),
  );

  ipcMain.handle(
    "library:deleteLocal",
    ipcHandler("library:deleteLocal", async (romId: number) => {
      const cfg = loadConfig();
      const paths = resolveRetroDeckPaths(cfg.retrodeck);
      return deleteLocalRom(getIndex(), romId, {
        rdHomePath: paths.rdHomePath,
        downloadedMediaPath: paths.downloadedMediaPath,
      });
    }),
  );

  ipcMain.handle(
    "library:downloadedIds",
    ipcHandler("library:downloadedIds", (platformSlug?: string) => {
      const index = getIndex();
      if (platformSlug) return index.getDownloadedRomIdsForSlug(platformSlug);
      return [...index.getDownloadedRomIds()];
    }),
  );

  ipcMain.handle(
    "library:downloadedRoms",
    ipcHandler("library:downloadedRoms", async (platformSlug: string) => {
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
    }),
  );

  ipcMain.handle(
    "library:stats",
    ipcHandler("library:stats", () => getIndex().getStats()),
  );

  ipcMain.handle(
    "daemon:status",
    ipcHandler("daemon:status", () => readDaemonStatus()),
  );

  ipcMain.handle(
    "daemon:installed",
    ipcHandler("daemon:installed", () => isSyncDaemonUnitInstalled()),
  );

  ipcMain.handle(
    "daemon:install",
    ipcHandler("daemon:install", async () => {
      const appRoot = path.resolve(__dirname, "../../..");
      return installSyncDaemonUnit([appRoot, process.cwd()]);
    }),
  );

  ipcMain.handle(
    "daemon:systemctl",
    ipcHandler(
      "daemon:systemctl",
      async (action: "enable" | "disable" | "start" | "stop" | "status" | "restart") => {
        if (process.platform !== "linux") {
          return { ok: false, output: "systemd controls are only available on Linux" };
        }
        try {
          if (action === "enable" && !isSyncDaemonUnitInstalled()) {
            const appRoot = path.resolve(__dirname, "../../..");
            const installed = await ensureSyncDaemonUnit([appRoot, process.cwd()]);
            if (!installed.ok) return installed;
          }

          const args =
            action === "enable"
              ? ["--user", "enable", "--now", "rommdeck-syncd.service"]
              : action === "disable"
                ? ["--user", "disable", "--now", "rommdeck-syncd.service"]
                : action === "restart"
                  ? ["--user", "restart", "rommdeck-syncd.service"]
                  : ["--user", action, "rommdeck-syncd.service"];
          const { stdout, stderr } = await execFileAsync("systemctl", args);
          log.daemon(`systemctl ${action}`, { ok: true });
          return { ok: true, output: stdout || stderr };
        } catch (e) {
          const output = e instanceof Error ? e.message : String(e);
          log.error("daemon", `systemctl ${action} failed`, { error: output });
          return { ok: false, output };
        }
      },
    ),
  );

  ipcMain.handle("sync:now", ipcHandler("sync:now", async () => {
    const cfg = loadConfig();
    const paths = resolveRetroDeckPaths(cfg.retrodeck);
    const client = createRommClient(cfg.romm.baseUrl, cfg.romm.apiToken);
    const index = getIndex();
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
    const current = readDaemonStatus();
    writeDaemonStatus({
      running: current.running,
      pid: current.pid,
      lastSyncAt: new Date().toISOString(),
      lastResult,
      lastError: result.errors[0] ?? null,
      pendingConflicts: result.conflicts,
      completedOps: result.completed,
      failedOps: result.failed,
    });

    return toSyncResultReport(result, {
      registered: device.registered,
      updated: device.updated,
    });
  }));

  ipcMain.handle("logs:path", ipcHandler("logs:path", () => getAppLogPath()));

  ipcMain.handle("shell:openPath", ipcHandler("shell:openPath", (p: string) => shell.openPath(p)));

  ipcMain.handle(
    "shell:openExternal",
    ipcHandler("shell:openExternal", async (raw: unknown) => {
      if (typeof raw !== "string" || !raw.trim()) {
        return { ok: false, error: "URL is required" };
      }
      let parsed: URL;
      try {
        parsed = new URL(raw.trim());
      } catch {
        return { ok: false, error: "Invalid URL" };
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { ok: false, error: "Only http and https URLs are allowed" };
      }
      await shell.openExternal(parsed.href);
      return { ok: true };
    }),
  );
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
  const cfg = loadConfig();
  log.app("started", {
    version: app.getVersion(),
    logFile: getAppLogPath(),
    logLevel: cfg.logging.level,
  });
  appIcon = loadAppIcon();
  const iconPath = resolveAppIconPath();
  if (iconPath) ensureLinuxDesktopIntegration();
  if (appIcon && process.platform === "darwin" && app.dock) {
    app.dock.setIcon(appIcon);
  }
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
