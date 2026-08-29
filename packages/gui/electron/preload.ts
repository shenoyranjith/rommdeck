import { contextBridge, ipcRenderer } from "electron";
import type { RommDeckConfig } from "@rommdeck/core";

export interface RommDeckApi {
  getConfig: () => Promise<RommDeckConfig>;
  saveConfig: (partial: Partial<RommDeckConfig>) => Promise<RommDeckConfig>;
  replaceConfig: (full: RommDeckConfig) => Promise<RommDeckConfig>;
  testConnection: () => Promise<{ ok: boolean; platforms?: number; error?: string }>;
  getPlatforms: () => Promise<unknown[]>;
  getRoms: (opts: {
    platformId?: number;
    platformSlug?: string;
    searchTerm?: string;
    limit?: number;
    offset?: number;
  }) => Promise<{ items: unknown[]; total: number }>;
  getRom: (romId: number) => Promise<unknown>;
  getRetroDeckPaths: () => Promise<unknown>;
  mapFolder: (slug: string) => Promise<string>;
  getBundledPlatformMap: () => Promise<Record<string, string>>;
  enqueueDownload: (romId: number, platformSlug: string) => Promise<unknown>;
  enqueueMany: (items: { romId: number; platformSlug: string }[]) => Promise<unknown[]>;
  enqueuePlatform: (
    platformId: number,
    platformSlug: string,
  ) => Promise<{ queued: number; skipped: number; total: number }>;
  listDownloads: () => Promise<{ active: unknown[]; failed: unknown[] }>;
  cancelDownload: (jobId: string) => Promise<void>;
  cancelAllDownloads: () => Promise<void>;
  retryDownload: (jobId: string) => Promise<unknown>;
  retryAllFailedDownloads: () => Promise<unknown[]>;
  dismissFailedDownload: (jobId: string) => Promise<void>;
  clearFailedDownloads: () => Promise<void>;
  onDownloadJob: (cb: (job: unknown) => void) => () => void;
  onDownloadQueue: (cb: (jobs: unknown[]) => void) => () => void;
  onDownloadFailed: (cb: (jobs: unknown[]) => void) => () => void;
  deleteLocal: (romId: number) => Promise<unknown>;
  downloadedIds: (platformSlug?: string) => Promise<number[]>;
  getDownloadedRoms: (platformSlug: string) => Promise<unknown[]>;
  getLibraryStats: () => Promise<{ downloadedRoms: number; storageBytes: number }>;
  daemonStatus: () => Promise<unknown>;
  daemonInstalled: () => Promise<boolean>;
  installDaemon: () => Promise<{ ok: boolean; output: string }>;
  systemctl: (action: "enable" | "disable" | "start" | "stop" | "status" | "restart") => Promise<{ ok: boolean; output: string }>;
  syncNow: () => Promise<unknown>;
  openPath: (p: string) => Promise<string>;
  openExternal: (url: string) => Promise<{ ok: boolean; error?: string }>;
  getAppVersion: () => Promise<string>;
  setWindowBackground: (color: string) => Promise<void>;
  windowMinimize: () => Promise<void>;
  windowMaximize: () => Promise<boolean>;
  windowClose: () => Promise<void>;
  windowIsMaximized: () => Promise<boolean>;
  onWindowMaximized: (cb: (maximized: boolean) => void) => () => void;
  onQuitConfirm: (
    cb: (payload: {
      downloading: number;
      queued: number;
      metadata: number;
      gamelistWriteActive: boolean;
    }) => void,
  ) => () => void;
  respondQuitConfirm: (confirmed: boolean) => Promise<void>;
}

const api: RommDeckApi = {
  getConfig: () => ipcRenderer.invoke("config:get"),
  saveConfig: (partial) => ipcRenderer.invoke("config:save", partial),
  replaceConfig: (full) => ipcRenderer.invoke("config:replace", full),
  testConnection: () => ipcRenderer.invoke("romm:test"),
  getPlatforms: () => ipcRenderer.invoke("romm:platforms"),
  getRoms: (opts) => ipcRenderer.invoke("romm:roms", opts),
  getRom: (romId) => ipcRenderer.invoke("romm:rom", romId),
  getRetroDeckPaths: () => ipcRenderer.invoke("paths:retrodeck"),
  mapFolder: (slug) => ipcRenderer.invoke("platform:mapFolder", slug),
  getBundledPlatformMap: () => ipcRenderer.invoke("platform:bundledMap"),
  enqueueDownload: (romId, platformSlug) =>
    ipcRenderer.invoke("downloads:enqueue", romId, platformSlug),
  enqueueMany: (items) => ipcRenderer.invoke("downloads:enqueueMany", items),
  enqueuePlatform: (platformId, platformSlug) =>
    ipcRenderer.invoke("downloads:enqueuePlatform", platformId, platformSlug),
  listDownloads: () => ipcRenderer.invoke("downloads:list"),
  cancelDownload: (jobId) => ipcRenderer.invoke("downloads:cancel", jobId),
  cancelAllDownloads: () => ipcRenderer.invoke("downloads:cancelAll"),
  retryDownload: (jobId) => ipcRenderer.invoke("downloads:retry", jobId),
  retryAllFailedDownloads: () => ipcRenderer.invoke("downloads:retryAll"),
  dismissFailedDownload: (jobId) => ipcRenderer.invoke("downloads:dismissFailed", jobId),
  clearFailedDownloads: () => ipcRenderer.invoke("downloads:clearFailed"),
  onDownloadJob: (cb) => {
    const handler = (_: unknown, job: unknown) => cb(job);
    ipcRenderer.on("downloads:job", handler);
    return () => ipcRenderer.removeListener("downloads:job", handler);
  },
  onDownloadQueue: (cb) => {
    const handler = (_: unknown, jobs: unknown[]) => cb(jobs);
    ipcRenderer.on("downloads:queue", handler);
    return () => ipcRenderer.removeListener("downloads:queue", handler);
  },
  onDownloadFailed: (cb) => {
    const handler = (_: unknown, jobs: unknown[]) => cb(jobs);
    ipcRenderer.on("downloads:failed", handler);
    return () => ipcRenderer.removeListener("downloads:failed", handler);
  },
  deleteLocal: (romId) => ipcRenderer.invoke("library:deleteLocal", romId),
  downloadedIds: (platformSlug) => ipcRenderer.invoke("library:downloadedIds", platformSlug),
  getDownloadedRoms: (platformSlug) => ipcRenderer.invoke("library:downloadedRoms", platformSlug),
  getLibraryStats: () => ipcRenderer.invoke("library:stats"),
  daemonStatus: () => ipcRenderer.invoke("daemon:status"),
  daemonInstalled: () => ipcRenderer.invoke("daemon:installed"),
  installDaemon: () => ipcRenderer.invoke("daemon:install"),
  systemctl: (action) => ipcRenderer.invoke("daemon:systemctl", action),
  syncNow: () => ipcRenderer.invoke("sync:now"),
  openPath: (p) => ipcRenderer.invoke("shell:openPath", p),
  openExternal: (url) => ipcRenderer.invoke("shell:openExternal", url),
  getAppVersion: () => ipcRenderer.invoke("app:getVersion"),
  setWindowBackground: (color) => ipcRenderer.invoke("window:setBackground", color),
  windowMinimize: () => ipcRenderer.invoke("window:minimize"),
  windowMaximize: () => ipcRenderer.invoke("window:maximize"),
  windowClose: () => ipcRenderer.invoke("window:close"),
  windowIsMaximized: () => ipcRenderer.invoke("window:isMaximized"),
  onWindowMaximized: (cb) => {
    const handler = (_: unknown, maximized: boolean) => cb(maximized);
    ipcRenderer.on("window:maximized", handler);
    return () => ipcRenderer.removeListener("window:maximized", handler);
  },
  onQuitConfirm: (cb) => {
    const handler = (
      _: unknown,
      payload: {
        downloading: number;
        queued: number;
        metadata: number;
        gamelistWriteActive: boolean;
      },
    ) => cb(payload);
    ipcRenderer.on("app:quitConfirm", handler);
    return () => ipcRenderer.removeListener("app:quitConfirm", handler);
  },
  respondQuitConfirm: (confirmed) => ipcRenderer.invoke("app:quitConfirmResponse", confirmed),
};

contextBridge.exposeInMainWorld("rommdeck", api);
