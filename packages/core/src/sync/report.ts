import type { SyncOperation } from "../romm/types.js";
import type { SyncDiscoveryStats, SyncResult } from "./protocol.js";

export interface SyncDiscoveryReport {
  indexedRomFiles: number;
  retroArchRomFiles: number;
  skippedStandalonePlatforms: string[];
  existingSaveFiles: number;
}

export interface SyncOperationSummary {
  upload: number;
  download: number;
  conflict: number;
  no_op: number;
  total: number;
}

/** IPC-safe sync result for the GUI. */
export interface SyncResultReport {
  sessionId: string | number | null;
  completed: number;
  failed: number;
  conflicts: SyncOperation[];
  errors: string[];
  operations: SyncOperation[];
  discovery?: SyncDiscoveryReport;
  operationSummary: SyncOperationSummary;
  device?: {
    registered: boolean;
    updated: boolean;
  };
}

export function summarizeSyncOperations(
  operations: SyncOperation[],
): SyncOperationSummary {
  const upload = operations.filter((o) => o.type === "upload").length;
  const download = operations.filter((o) => o.type === "download").length;
  const conflict = operations.filter((o) => o.type === "conflict").length;
  const no_op = operations.filter((o) => o.type === "no_op").length;
  return {
    upload,
    download,
    conflict,
    no_op,
    total: operations.length,
  };
}

export function discoveryToReport(
  discovery: SyncDiscoveryStats | undefined,
): SyncDiscoveryReport | undefined {
  if (!discovery) return undefined;
  return {
    indexedRomFiles: discovery.indexedRomFiles,
    retroArchRomFiles: discovery.retroArchRomFiles,
    skippedStandalonePlatforms: [...discovery.skippedStandalonePlatforms].sort(),
    existingSaveFiles: discovery.existingSaveFiles,
  };
}

export function toSyncResultReport(
  result: SyncResult,
  device?: { registered: boolean; updated: boolean },
): SyncResultReport {
  return {
    sessionId: result.sessionId,
    completed: result.completed,
    failed: result.failed,
    conflicts: result.conflicts,
    errors: result.errors,
    operations: result.operations,
    discovery: discoveryToReport(result.discovery),
    operationSummary: summarizeSyncOperations(result.operations),
    device,
  };
}
