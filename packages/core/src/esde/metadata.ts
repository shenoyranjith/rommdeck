import type { RommClient } from "../romm/client.js";
import { rommSlugToEsdeFolder } from "../platform-map.js";
import { log } from "../log.js";
import { upsertGamelistGameLocked, removeGamelistGameLocked } from "./gamelist.js";
import { downloadRomMedia, removeRomMedia } from "./media.js";
import { gamelistFilePath, resolveEsdePaths } from "./paths.js";
import { buildGamelistEntry } from "./rom-metadata.js";
import { hasGamelistEntry } from "./gamelist.js";

export interface SyncEsdeMetadataOptions {
  client: RommClient;
  romId: number;
  rommSlug: string;
  primaryFilename: string;
  rdHomePath: string;
  downloadedMediaPath?: string;
  platformMapOverrides?: Record<string, string>;
  signal?: AbortSignal;
}

export interface RemoveEsdeMetadataOptions {
  rdHomePath: string;
  downloadedMediaPath?: string;
  esdeFolder: string;
  primaryFilename: string;
}

/**
 * Write ES-DE gamelist + media from RomM after ROM files land on disk.
 * Gamelist writes are queued and file-locked per platform.
 */
export async function syncEsdeMetadata(opts: SyncEsdeMetadataOptions): Promise<void> {
  if (!opts.rdHomePath) {
    log.esde("syncEsdeMetadata skipped: empty rdHomePath", { romId: opts.romId });
    return;
  }

  const esdeFolder = rommSlugToEsdeFolder(opts.rommSlug, opts.platformMapOverrides ?? {});
  const esdePaths = resolveEsdePaths(opts.rdHomePath, opts.downloadedMediaPath);
  const gamelistPath = gamelistFilePath(esdePaths.gamelistsRoot, esdeFolder);

  log.esde("syncEsdeMetadata start", {
    romId: opts.romId,
    rommSlug: opts.rommSlug,
    esdeFolder,
    rdHomePath: opts.rdHomePath,
    mediaRoot: esdePaths.mediaRoot,
    primaryFilename: opts.primaryFilename,
    gamelistPath,
  });

  const rom = await opts.client.getRom(opts.romId);
  if (opts.signal?.aborted) throw new Error("cancelled");

  const media = await downloadRomMedia({
    client: opts.client,
    mediaRoot: esdePaths.mediaRoot,
    esdeFolder,
    romFilename: opts.primaryFilename,
    rom,
    signal: opts.signal,
  });
  if (opts.signal?.aborted) throw new Error("cancelled");

  const entry = buildGamelistEntry(rom, opts.primaryFilename);
  await upsertGamelistGameLocked(gamelistPath, entry, opts.signal);
  log.esde("gamelist upserted", { romId: opts.romId, path: entry.path, name: entry.name });

  log.esde("syncEsdeMetadata complete", {
    romId: opts.romId,
    romName: rom.name,
    esdeFolder,
    mediaFiles: media.length,
  });
}

/** Remove gamelist entry and downloaded media for a locally deleted ROM. */
export async function removeEsdeMetadata(opts: RemoveEsdeMetadataOptions): Promise<{
  gamelistRemoved: boolean;
  mediaRemoved: string[];
}> {
  const esdePaths = resolveEsdePaths(opts.rdHomePath, opts.downloadedMediaPath);
  const gamelistPath = gamelistFilePath(esdePaths.gamelistsRoot, opts.esdeFolder);
  const mediaRemoved = removeRomMedia(esdePaths.mediaRoot, opts.esdeFolder, opts.primaryFilename);
  const gamelistRemoved = await removeGamelistGameLocked(gamelistPath, opts.primaryFilename);
  log.esde("removeEsdeMetadata", {
    esdeFolder: opts.esdeFolder,
    primaryFilename: opts.primaryFilename,
    gamelistRemoved,
    mediaRemoved: mediaRemoved.length,
  });
  return { gamelistRemoved, mediaRemoved };
}

/** Whether ES-DE gamelist.xml lists this ROM (requires RetroDECK home). */
export function romHasEsdeMetadata(opts: {
  rdHomePath?: string;
  downloadedMediaPath?: string;
  rommSlug: string;
  primaryFilename: string;
  platformMapOverrides?: Record<string, string>;
}): boolean {
  if (!opts.rdHomePath || !opts.primaryFilename) return false;
  const esdeFolder = rommSlugToEsdeFolder(opts.rommSlug, opts.platformMapOverrides ?? {});
  const esdePaths = resolveEsdePaths(opts.rdHomePath, opts.downloadedMediaPath);
  const gamelistPath = gamelistFilePath(esdePaths.gamelistsRoot, esdeFolder);
  return hasGamelistEntry(gamelistPath, opts.primaryFilename);
}
