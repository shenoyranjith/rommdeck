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
  getRetroDeckPaths: () => Promise<unknown>;
  mapFolder: (slug: string) => Promise<string>;
  enqueueDownload: (romId: number, platformSlug: string) => Promise<unknown>;
  enqueueMany: (items: { romId: number; platformSlug: string }[]) => Promise<unknown[]>;
  enqueuePlatform: (
    platformId: number,
    platformSlug: string,
  ) => Promise<{ queued: number; skipped: number; total: number }>;
  listDownloads: () => Promise<unknown[]>;
  cancelDownload: (jobId: string) => Promise<void>;
  onDownloadJob: (cb: (job: unknown) => void) => () => void;
  onDownloadQueue: (cb: (jobs: unknown[]) => void) => () => void;
  deleteLocal: (romId: number) => Promise<unknown>;
  downloadedIds: () => Promise<number[]>;
  daemonStatus: () => Promise<unknown>;
  systemctl: (action: "enable" | "disable" | "start" | "stop" | "status") => Promise<{ ok: boolean; output: string }>;
  syncNow: () => Promise<unknown>;
  openPath: (p: string) => Promise<string>;
}

const api: RommDeckApi = {
  getConfig: () => ipcRenderer.invoke("config:get"),
  saveConfig: (partial) => ipcRenderer.invoke("config:save", partial),
  replaceConfig: (full) => ipcRenderer.invoke("config:replace", full),
  testConnection: () => ipcRenderer.invoke("romm:test"),
  getPlatforms: () => ipcRenderer.invoke("romm:platforms"),
  getRoms: (opts) => ipcRenderer.invoke("romm:roms", opts),
  getRetroDeckPaths: () => ipcRenderer.invoke("paths:retrodeck"),
  mapFolder: (slug) => ipcRenderer.invoke("platform:mapFolder", slug),
  enqueueDownload: (romId, platformSlug) =>
    ipcRenderer.invoke("downloads:enqueue", romId, platformSlug),
  enqueueMany: (items) => ipcRenderer.invoke("downloads:enqueueMany", items),
  enqueuePlatform: (platformId, platformSlug) =>
    ipcRenderer.invoke("downloads:enqueuePlatform", platformId, platformSlug),
  listDownloads: () => ipcRenderer.invoke("downloads:list"),
  cancelDownload: (jobId) => ipcRenderer.invoke("downloads:cancel", jobId),
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
  deleteLocal: (romId) => ipcRenderer.invoke("library:deleteLocal", romId),
  downloadedIds: () => ipcRenderer.invoke("library:downloadedIds"),
  daemonStatus: () => ipcRenderer.invoke("daemon:status"),
  systemctl: (action) => ipcRenderer.invoke("daemon:systemctl", action),
  syncNow: () => ipcRenderer.invoke("sync:now"),
  openPath: (p) => ipcRenderer.invoke("shell:openPath", p),
};

contextBridge.exposeInMainWorld("rommdeck", api);
