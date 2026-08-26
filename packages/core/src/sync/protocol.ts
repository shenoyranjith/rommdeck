import { existsSync, readdirSync, statSync } from "node:fs";
import { join, basename, extname } from "node:path";
import type { RommClient } from "../romm/client.js";
import type { ConflictPolicy, SyncMode } from "../config.js";
import type { SyncLocalRom, SyncOperation } from "../romm/types.js";
import { LibraryIndex } from "../db/index.js";
import { sha1File, fileMtimeIso } from "../hash.js";

const SAVE_EXTS = new Set([
  ".srm",
  ".sav",
  ".rtc",
  ".eep",
  ".fla",
  ".mcr",
  ".mcd",
  ".vmp",
  ".cds",
]);
const STATE_EXTS = new Set([
  ".state",
  ".state1",
  ".state2",
  ".state3",
  ".state4",
  ".state5",
  ".state6",
  ".state7",
  ".state8",
  ".state9",
  ".state10",
]);

export interface SyncPaths {
  savesPath: string;
  statesPath: string;
  romsPath: string;
}

export interface SyncResult {
  sessionId: string | null;
  completed: number;
  failed: number;
  conflicts: SyncOperation[];
  errors: string[];
  operations: SyncOperation[];
}

function contentBasename(filename: string): string {
  // Strip common multi-part / extension noise for matching
  const base = basename(filename);
  const withoutExt = base.replace(/\.[^.]+$/, "");
  return withoutExt.replace(/\s*\(.*?\)\s*/g, "").trim().toLowerCase();
}

function walkFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
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
      else if (st.isFile()) out.push(full);
    }
  }
  return out;
}

function isSaveOrState(path: string): "save" | "state" | null {
  const ext = extname(path).toLowerCase();
  const base = basename(path).toLowerCase();
  if (SAVE_EXTS.has(ext)) return "save";
  if (STATE_EXTS.has(ext) || /\.state\d*$/i.test(base)) return "state";
  // RetroArch often uses .srm and numbered states without extension quirks
  if (base.endsWith(".srm")) return "save";
  return null;
}

/** Build negotiate payload from indexed ROMs + files under saves/states. */
export async function buildNegotiatePayload(
  index: LibraryIndex,
  paths: SyncPaths,
): Promise<SyncLocalRom[]> {
  const indexed = index.getAll();
  const byRom = new Map<number, { basenames: Set<string>; files: SyncLocalRom["saves"] }>();

  for (const row of indexed) {
    let entry = byRom.get(row.rom_id);
    if (!entry) {
      entry = { basenames: new Set(), files: [] };
      byRom.set(row.rom_id, entry);
    }
    entry.basenames.add(contentBasename(row.filename));
  }

  const candidates = [...walkFiles(paths.savesPath), ...walkFiles(paths.statesPath)];
  for (const filePath of candidates) {
    if (!isSaveOrState(filePath)) continue;
    const stem = contentBasename(filePath);
    for (const [, entry] of byRom) {
      // Match if save stem contains ROM basename or vice versa
      let matched = false;
      for (const bn of entry.basenames) {
        if (!bn) continue;
        if (stem === bn || stem.startsWith(bn) || bn.startsWith(stem)) {
          matched = true;
          break;
        }
      }
      if (!matched) continue;
      try {
        const sha1 = await sha1File(filePath);
        const mtime = await fileMtimeIso(filePath);
        entry.files.push({ file: basename(filePath), mtime, sha1 });
      } catch {
        // skip unreadable
      }
      break;
    }
  }

  const roms: SyncLocalRom[] = [];
  for (const [rom_id, entry] of byRom) {
    roms.push({ rom_id, saves: entry.files });
  }
  return roms;
}

function findLocalFile(paths: SyncPaths, file: string): string | null {
  for (const root of [paths.savesPath, paths.statesPath]) {
    const direct = join(root, file);
    if (existsSync(direct)) return direct;
    for (const f of walkFiles(root)) {
      if (basename(f) === file) return f;
    }
  }
  return null;
}

export async function ensureDevice(
  client: RommClient,
  opts: {
    deviceId: number | null;
    deviceName: string;
    syncMode: SyncMode;
    paths: SyncPaths;
  },
): Promise<number> {
  if (opts.deviceId != null) return opts.deviceId;
  const device = await client.registerDevice({
    name: opts.deviceName,
    platform: "retrodeck",
    hostname: process.env.HOSTNAME ?? "rommdeck",
    sync_mode: opts.syncMode,
    paths: {
      roms: opts.paths.romsPath,
      saves: opts.paths.savesPath,
      states: opts.paths.statesPath,
    },
  });
  return device.id;
}

export async function runSyncSession(
  client: RommClient,
  index: LibraryIndex,
  opts: {
    deviceId: number;
    paths: SyncPaths;
    conflictPolicy: ConflictPolicy;
    /** When true, apply conflict policy automatically; otherwise leave pending. */
    unattended: boolean;
  },
): Promise<SyncResult> {
  const roms = await buildNegotiatePayload(index, opts.paths);
  const negotiated = await client.negotiate(opts.deviceId, roms);
  const result: SyncResult = {
    sessionId: negotiated.session_id,
    completed: 0,
    failed: 0,
    conflicts: [],
    errors: [],
    operations: negotiated.operations,
  };

  for (const op of negotiated.operations) {
    try {
      if (op.type === "noop") {
        result.completed++;
        continue;
      }
      if (op.type === "conflict") {
        if (!opts.unattended) {
          result.conflicts.push(op);
          continue;
        }
        const resolution = opts.conflictPolicy;
        // Re-issue as resolved by applying policy locally
        if (resolution === "device_wins" || resolution === "keep_both") {
          const local = findLocalFile(opts.paths, op.file);
          if (local && op.destination) {
            await client.uploadSave(op.destination, local, {
              rom_id: String(op.rom_id),
              file: op.file,
              resolution,
            });
          }
        }
        if (resolution === "server_wins" && op.source && op.dest_path) {
          await client.downloadAsset(op.source, op.dest_path);
        } else if (resolution === "server_wins" && op.source) {
          const dest = join(opts.paths.savesPath, op.file);
          await client.downloadAsset(op.source, dest);
        }
        result.completed++;
        continue;
      }
      if (op.type === "upload") {
        const local = findLocalFile(opts.paths, op.file);
        if (!local) throw new Error(`Local file not found for upload: ${op.file}`);
        if (!op.destination) throw new Error("Upload op missing destination");
        await client.uploadSave(op.destination, local, {
          rom_id: String(op.rom_id),
          file: op.file,
        });
        result.completed++;
        continue;
      }
      if (op.type === "download") {
        if (!op.source) throw new Error("Download op missing source");
        const dest =
          op.dest_path ||
          join(isSaveOrState(op.file) === "state" ? opts.paths.statesPath : opts.paths.savesPath, op.file);
        await client.downloadAsset(op.source, dest);
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

  if (negotiated.session_id) {
    try {
      await client.completeSession(negotiated.session_id, {
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
