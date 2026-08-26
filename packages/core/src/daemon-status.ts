import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { getDaemonStatusPath } from "./paths.js";
import type { SyncOperation } from "./romm/types.js";

export interface DaemonStatus {
  running: boolean;
  pid: number | null;
  lastSyncAt: string | null;
  lastResult: "ok" | "error" | "partial" | null;
  lastError: string | null;
  pendingConflicts: SyncOperation[];
  completedOps: number;
  failedOps: number;
  updatedAt: string;
}

export const EMPTY_STATUS: DaemonStatus = {
  running: false,
  pid: null,
  lastSyncAt: null,
  lastResult: null,
  lastError: null,
  pendingConflicts: [],
  completedOps: 0,
  failedOps: 0,
  updatedAt: new Date(0).toISOString(),
};

export function readDaemonStatus(): DaemonStatus {
  const path = getDaemonStatusPath();
  if (!existsSync(path)) return { ...EMPTY_STATUS };
  try {
    return { ...EMPTY_STATUS, ...JSON.parse(readFileSync(path, "utf8")) };
  } catch {
    return { ...EMPTY_STATUS };
  }
}

export function writeDaemonStatus(status: Partial<DaemonStatus> & Pick<DaemonStatus, never>): DaemonStatus {
  const current = readDaemonStatus();
  const next: DaemonStatus = {
    ...current,
    ...status,
    updatedAt: new Date().toISOString(),
  };
  const path = getDaemonStatusPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(next, null, 2), "utf8");
  return next;
}
