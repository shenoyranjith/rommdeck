import { basename, join } from "node:path";
import type { IndexedRomFile } from "../db/index.js";
import { isRetroArchSyncPlatform } from "../platform-emulator-map.js";

/** RetroArch battery-save extensions probed under `{saves_path}/{esde_folder}/`. */
export const BATTERY_SAVE_EXTENSIONS = [
  ".srm",
  ".sav",
  ".rtc",
  ".eep",
  ".fla",
  ".mcr",
  ".mcd",
  ".vmp",
  ".cds",
  ".bkr",
  ".bcr",
  ".smpc",
] as const;

/** RetroArch save-state suffixes under `{states_path}/{esde_folder}/`. */
export const STATE_FILE_SUFFIXES = [
  ".state",
  ".state0",
  ".state1",
  ".state2",
  ".state3",
  ".state4",
  ".state5",
  ".state6",
  ".state7",
  ".state8",
  ".state9",
] as const;

export type SaveFileKind = "battery" | "state";

export interface ExpectedSavePath {
  rom_id: number;
  esde_folder: string;
  absolutePath: string;
  file_name: string;
  kind: SaveFileKind;
  slot: string;
  emulator: "retroarch";
}

/** ROM filename without extension; preserves `(USA)` and other tags. */
export function romBasename(filename: string): string {
  const base = basename(filename);
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return base;
  return base.slice(0, dot);
}

/** RomM slotted uploads embed a UTC timestamp tag before the extension. */
const DATETIME_TAG_PATTERN = / \[\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\]/;

/** Strip RomM datetime tags so paths match RetroArch filenames. */
export function untagSaveFileName(fileName: string): string {
  return fileName.replace(DATETIME_TAG_PATTERN, "");
}

/** Extension (including dot) from a server or local save basename. */
export function saveFileExtension(fileName: string): string {
  const untagged = untagSaveFileName(fileName);
  const dot = untagged.lastIndexOf(".");
  if (dot <= 0) return "";
  return untagged.slice(dot);
}

/** Map a RomM save filename to the local RetroArch basename for an indexed ROM. */
export function resolveLocalSaveFileName(
  indexedRomFilename: string,
  serverFileName: string,
): string {
  const ext = saveFileExtension(serverFileName);
  if (!ext) return untagSaveFileName(serverFileName);
  return `${romBasename(indexedRomFilename)}${ext}`;
}

/** RomM pairs saves on `(rom_id, slot)` — each state slot needs a distinct slot name. */
export function slotForSaveFileName(fileName: string): string {
  const lower = fileName.toLowerCase();
  const match = lower.match(/\.state(\d*)$/);
  if (match) {
    const suffix = match[1];
    return suffix === "" ? "state" : `state${suffix}`;
  }
  return "default";
}

export function isStateFileName(fileName: string): boolean {
  return /\.state\d*$/i.test(fileName);
}

export function resolveExpectedSavePaths(row: IndexedRomFile, roots: {
  savesPath: string;
  statesPath: string;
}): ExpectedSavePath[] {
  if (!isRetroArchSyncPlatform(row.esde_folder)) return [];

  const base = romBasename(row.filename);
  const out: ExpectedSavePath[] = [];

  for (const ext of BATTERY_SAVE_EXTENSIONS) {
    const file_name = `${base}${ext}`;
    out.push({
      rom_id: row.rom_id,
      esde_folder: row.esde_folder,
      absolutePath: join(roots.savesPath, row.esde_folder, file_name),
      file_name,
      kind: "battery",
      slot: "default",
      emulator: "retroarch",
    });
  }

  for (const suffix of STATE_FILE_SUFFIXES) {
    const file_name = `${base}${suffix}`;
    out.push({
      rom_id: row.rom_id,
      esde_folder: row.esde_folder,
      absolutePath: join(roots.statesPath, row.esde_folder, file_name),
      file_name,
      kind: "state",
      slot: slotForSaveFileName(file_name),
      emulator: "retroarch",
    });
  }

  return out;
}

/** Canonical local path for a downloaded or uploaded save/state file. */
export function resolveLocalSavePath(
  roots: { savesPath: string; statesPath: string },
  esdeFolder: string,
  fileName: string,
): string {
  const root = isStateFileName(fileName) ? roots.statesPath : roots.savesPath;
  return join(root, esdeFolder, fileName);
}

/** Dedupe indexed rows by `(rom_id, esde_folder, filename)`. */
export function uniqueIndexedRomFiles(rows: IndexedRomFile[]): IndexedRomFile[] {
  const seen = new Set<string>();
  const out: IndexedRomFile[] = [];
  for (const row of rows) {
    const key = `${row.rom_id}\0${row.esde_folder}\0${row.filename}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}
