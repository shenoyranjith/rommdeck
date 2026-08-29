import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import type { RommClient } from "../romm/client.js";
import type { ConflictPolicy } from "../config.js";
import type { ClientSaveState, SyncOperation } from "../romm/types.js";
import { LibraryIndex } from "../db/index.js";
import { md5File, fileMtimeIso } from "../hash.js";
import {
  resolveExpectedSavePaths,
  resolveLocalSavePath,
  resolveLocalSaveFileName,
  uniqueIndexedRomFiles,
  slotForSaveFileName,
  isStateFileName,
  untagSaveFileName,
} from "./save-paths.js";

export { ensureDevice, type EnsureDeviceResult } from "./device.js";
export {
  toSyncResultReport,
  summarizeSyncOperations,
  type SyncResultReport,
  type SyncDiscoveryReport,
  type SyncOperationSummary,
} from "./report.js";

export interface SyncPaths {
  savesPath: string;
  statesPath: string;
  romsPath: string;
}

export interface SyncDiscoveryStats {
  indexedRomFiles: number;
  retroArchRomFiles: number;
  skippedStandalonePlatforms: Set<string>;
  existingSaveFiles: number;
}

export interface SyncResult {
  sessionId: string | number | null;
  completed: number;
  failed: number;
  conflicts: SyncOperation[];
  errors: string[];
  operations: SyncOperation[];
  discovery?: SyncDiscoveryStats;
}

/** Build negotiate payload from indexed ROMs + deterministic RetroArch save paths. */
export async function buildNegotiatePayload(
  index: LibraryIndex,
  paths: SyncPaths,
): Promise<{ saves: ClientSaveState[]; discovery: SyncDiscoveryStats }> {
  const indexed = uniqueIndexedRomFiles(index.getAll());
  const skippedStandalonePlatforms = new Set<string>();
  let retroArchRomFiles = 0;
  const saves: ClientSaveState[] = [];

  for (const row of indexed) {
    const expected = resolveExpectedSavePaths(row, {
      savesPath: paths.savesPath,
      statesPath: paths.statesPath,
    });
    if (expected.length === 0) {
      skippedStandalonePlatforms.add(row.esde_folder);
      continue;
    }
    retroArchRomFiles++;

    for (const candidate of expected) {
      if (!existsSync(candidate.absolutePath)) continue;
      let size = 0;
      try {
        size = statSync(candidate.absolutePath).size;
      } catch {
        continue;
      }
      try {
        const content_hash = await md5File(candidate.absolutePath);
        const updated_at = await fileMtimeIso(candidate.absolutePath);
        saves.push({
          rom_id: candidate.rom_id,
          file_name: candidate.file_name,
          slot: candidate.slot,
          emulator: candidate.emulator,
          content_hash,
          updated_at,
          file_size_bytes: size,
        });
      } catch {
        // skip unreadable files
      }
    }
  }

  return {
    saves,
    discovery: {
      indexedRomFiles: indexed.length,
      retroArchRomFiles,
      skippedStandalonePlatforms,
      existingSaveFiles: saves.length,
    },
  };
}

function esdeFolderForRom(index: LibraryIndex, romId: number): string | null {
  const rows = index.getByRomId(romId);
  return rows[0]?.esde_folder ?? null;
}

function findLocalSaveFile(
  index: LibraryIndex,
  paths: SyncPaths,
  op: SyncOperation,
): string | null {
  const esdeFolder = esdeFolderForRom(index, op.rom_id);
  const fileName = localFileNameForOperation(index, op);
  if (esdeFolder) {
    const canonical = resolveLocalSavePath(
      { savesPath: paths.savesPath, statesPath: paths.statesPath },
      esdeFolder,
      fileName,
    );
    if (existsSync(canonical)) return canonical;
  }

  // Fallback: basename match anywhere under saves/states (legacy paths).
  return findByBasename(paths, fileName);
}

function findByBasename(paths: SyncPaths, fileName: string): string | null {
  for (const root of [paths.savesPath, paths.statesPath]) {
    if (!existsSync(root)) continue;
    const stack = [root];
    while (stack.length) {
      const dir = stack.pop()!;
      let entries: string[];
      try {
        entries = readdirSync(dir);
      } catch {
        continue;
      }
      for (const name of entries) {
        const full = join(dir, name);
        let st;
        try {
          st = statSync(full);
        } catch {
          continue;
        }
        if (st.isDirectory()) stack.push(full);
        else if (basename(full) === fileName) return full;
      }
    }
  }
  return null;
}

function resolveDownloadDest(
  index: LibraryIndex,
  paths: SyncPaths,
  op: SyncOperation,
): string {
  const esdeFolder = esdeFolderForRom(index, op.rom_id);
  const fileName = localFileNameForOperation(index, op);
  if (esdeFolder) {
    return resolveLocalSavePath(
      { savesPath: paths.savesPath, statesPath: paths.statesPath },
      esdeFolder,
      fileName,
    );
  }
  if (op.dest_path) return op.dest_path;
  const root = isStateFileName(fileName) ? paths.statesPath : paths.savesPath;
  return join(root, fileName);
}

function localFileNameForOperation(index: LibraryIndex, op: SyncOperation): string {
  const rows = index.getByRomId(op.rom_id);
  const serverName = op.file_name ?? op.file;
  if (rows[0]) {
    return resolveLocalSaveFileName(rows[0].filename, serverName);
  }
  return untagSaveFileName(serverName);
}

export async function runSyncSession(
  client: RommClient,
  index: LibraryIndex,
  opts: {
    deviceId: string | number;
    paths: SyncPaths;
    conflictPolicy: ConflictPolicy;
    /** When true, apply conflict policy automatically; otherwise leave pending. */
    unattended: boolean;
  },
): Promise<SyncResult> {
  const { saves, discovery } = await buildNegotiatePayload(index, opts.paths);
  const negotiated = await client.negotiate(opts.deviceId, saves);
  const result: SyncResult = {
    sessionId: negotiated.session_id,
    completed: 0,
    failed: 0,
    conflicts: [],
    errors: [],
    operations: negotiated.operations,
    discovery,
  };

  for (const op of negotiated.operations) {
    try {
      if (op.type === "no_op") {
        result.completed++;
        continue;
      }
      if (op.type === "conflict") {
        if (!opts.unattended) {
          result.conflicts.push(op);
          continue;
        }
        await applyConflictPolicy(
          client,
          index,
          opts.paths,
          op,
          opts.conflictPolicy,
          {
            deviceId: String(opts.deviceId),
            sessionId: negotiated.session_id,
          },
        );
        result.completed++;
        continue;
      }
      if (op.type === "upload") {
        const local = findLocalSaveFile(index, opts.paths, op);
        if (!local) throw new Error(`Local file not found for upload: ${op.file}`);
        await uploadSyncSave(client, op, local, {
          deviceId: String(opts.deviceId),
          sessionId: negotiated.session_id,
        });
        result.completed++;
        continue;
      }
      if (op.type === "download") {
        const dest = resolveDownloadDest(index, opts.paths, op);
        if (op.save_id != null) {
          await client.downloadSaveContent(op.save_id, dest, {
            deviceId: String(opts.deviceId),
            sessionId: negotiated.session_id,
          });
        } else if (op.source) {
          await client.downloadAsset(op.source, dest);
        } else {
          throw new Error("Download op missing save_id and source");
        }
        result.completed++;
        continue;
      }
    } catch (e) {
      result.failed++;
      result.errors.push(
        `${op.type} ${op.file}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  if (negotiated.session_id != null && negotiated.session_id !== "") {
    try {
      await client.completeSession(String(negotiated.session_id), {
        operations_completed: result.completed,
        operations_failed: result.failed,
        play_sessions: [],
      });
    } catch (e) {
      result.errors.push(
        `complete: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  return result;
}

async function uploadSyncSave(
  client: RommClient,
  op: SyncOperation,
  localPath: string,
  ctx: { deviceId: string; sessionId: string | number | null | undefined },
  overwrite = false,
): Promise<void> {
  await client.uploadSaveForSync(op.rom_id, localPath, {
    slot: op.slot ?? slotForSaveFileName(op.file),
    emulator: op.emulator ?? "retroarch",
    deviceId: ctx.deviceId,
    sessionId: ctx.sessionId ?? undefined,
    overwrite,
  });
}

async function applyConflictPolicy(
  client: RommClient,
  index: LibraryIndex,
  paths: SyncPaths,
  op: SyncOperation,
  policy: ConflictPolicy,
  ctx: { deviceId: string; sessionId: string | number | null | undefined },
): Promise<void> {
  if (policy === "device_wins" || policy === "keep_both") {
    const local = findLocalSaveFile(index, paths, op);
    if (!local) throw new Error(`Local file not found for conflict upload: ${op.file}`);
    await uploadSyncSave(client, op, local, ctx, policy === "device_wins");
  }
  if (policy === "server_wins") {
    const dest = resolveDownloadDest(index, paths, op);
    if (op.save_id != null) {
      await client.downloadSaveContent(op.save_id, dest, {
        deviceId: ctx.deviceId,
        sessionId: ctx.sessionId ?? undefined,
      });
    } else if (op.source) {
      await client.downloadAsset(op.source, dest);
    } else {
      throw new Error("Conflict server_wins missing save_id/source");
    }
  }
}
