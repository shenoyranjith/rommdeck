import type { RommClient } from "../romm/client.js";
import { rommSlugToEsdeFolder } from "../platform-map.js";
import { log } from "../log.js";

export interface SyncEsdeMetadataOptions {
  client: RommClient;
  romId: number;
  rommSlug: string;
  primaryFilename: string;
  rdHomePath: string;
  platformMapOverrides?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * Write ES-DE gamelist + media from RomM after ROM files land on disk.
 * Stub: fetches full ROM detail; gamelist/media writer follows in esde/gamelist.ts.
 */
export async function syncEsdeMetadata(opts: SyncEsdeMetadataOptions): Promise<void> {
  if (!opts.rdHomePath) {
    log.esde("syncEsdeMetadata skipped: empty rdHomePath", { romId: opts.romId });
    return;
  }

  const esdeFolder = rommSlugToEsdeFolder(opts.rommSlug, opts.platformMapOverrides ?? {});
  log.esde("syncEsdeMetadata start (stub — gamelist/media not implemented yet)", {
    romId: opts.romId,
    rommSlug: opts.rommSlug,
    esdeFolder,
    rdHomePath: opts.rdHomePath,
    primaryFilename: opts.primaryFilename,
  });

  const rom = await opts.client.getRom(opts.romId);
  if (opts.signal?.aborted) throw new Error("cancelled");

  log.esde("syncEsdeMetadata complete (stub — gamelist/media not implemented yet)", {
    romId: opts.romId,
    romName: rom.name,
    esdeFolder,
  });
}
