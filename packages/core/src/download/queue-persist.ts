import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { DownloadJob } from "./manager.js";
import { getDownloadQueuePath } from "../paths.js";
import { log } from "../log.js";

export type PersistedJobPhase = "download" | "metadata";

export interface PersistedActiveEntry {
  phase: PersistedJobPhase;
  job: Pick<
    DownloadJob,
    "id" | "romId" | "romName" | "rommSlug" | "filenames" | "totalBytes" | "coverUrl"
  >;
}

export interface PersistedDownloadQueue {
  version: 1;
  savedAt: string;
  active: PersistedActiveEntry[];
  failed: Array<
    Pick<
      DownloadJob,
      | "id"
      | "romId"
      | "romName"
      | "rommSlug"
      | "filenames"
      | "totalBytes"
      | "coverUrl"
      | "error"
    >
  >;
}

export function loadPersistedDownloadQueue(): PersistedDownloadQueue | null {
  const path = getDownloadQueuePath();
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as PersistedDownloadQueue;
    if (raw.version !== 1 || !Array.isArray(raw.active) || !Array.isArray(raw.failed)) {
      log.download("persisted queue ignored: invalid format", { path });
      return null;
    }
    return raw;
  } catch (e) {
    log.download("persisted queue load failed", {
      path,
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

export function savePersistedDownloadQueue(data: PersistedDownloadQueue): void {
  const path = getDownloadQueuePath();
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data)}\n`, "utf8");
  renameSync(tmp, path);
}

export function clearPersistedDownloadQueue(): void {
  const path = getDownloadQueuePath();
  try {
    if (existsSync(path)) unlinkSync(path);
  } catch {
    /* ignore */
  }
}
