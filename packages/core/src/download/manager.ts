import { existsSync, unlinkSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import type { RommClient } from "../romm/client.js";
import type { RommRom } from "../romm/types.js";
import { LibraryIndex } from "../db/index.js";
import { downloadTargetPath, rommSlugToEsdeFolder } from "../platform-map.js";
import { sha1File } from "../hash.js";

export type DownloadStatus = "queued" | "downloading" | "done" | "error" | "cancelled";

export interface DownloadJob {
  id: string;
  romId: number;
  romName: string;
  rommSlug: string;
  filenames: string[];
  status: DownloadStatus;
  progressBytes: number;
  totalBytes: number | null;
  error?: string;
}

export interface DownloadManagerOptions {
  client: RommClient;
  index: LibraryIndex;
  romsPath: string;
  platformMapOverrides?: Record<string, string>;
}

function romFilenames(rom: RommRom): string[] {
  if (rom.files && rom.files.length > 0) {
    return rom.files.map((f) => f.file_name);
  }
  if (rom.fs_name) return [rom.fs_name];
  return [];
}

export class DownloadManager extends EventEmitter {
  private queue: DownloadJob[] = [];
  private active: DownloadJob | null = null;
  private cancelled = new Set<string>();
  private running = false;
  private opts: DownloadManagerOptions;

  constructor(opts: DownloadManagerOptions) {
    super();
    this.opts = opts;
  }

  getJobs(): DownloadJob[] {
    return [...this.queue, ...(this.active ? [this.active] : [])];
  }

  enqueue(rom: RommRom, rommSlug: string): DownloadJob {
    const filenames = romFilenames(rom);
    if (filenames.length === 0) {
      throw new Error(`ROM ${rom.id} has no downloadable files`);
    }
    const job: DownloadJob = {
      id: `${rom.id}-${Date.now()}`,
      romId: rom.id,
      romName: rom.name,
      rommSlug,
      filenames,
      status: "queued",
      progressBytes: 0,
      totalBytes: rom.filesize ?? null,
    };
    this.queue.push(job);
    this.emit("queue", this.getJobs());
    void this.pump();
    return job;
  }

  enqueueMany(roms: { rom: RommRom; rommSlug: string }[]): DownloadJob[] {
    return roms.map(({ rom, rommSlug }) => this.enqueue(rom, rommSlug));
  }

  cancel(jobId: string): void {
    this.cancelled.add(jobId);
    const q = this.queue.find((j) => j.id === jobId);
    if (q) {
      q.status = "cancelled";
      this.queue = this.queue.filter((j) => j.id !== jobId);
      this.emit("queue", this.getJobs());
    }
  }

  private async pump(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.length > 0) {
        const job = this.queue.shift()!;
        if (this.cancelled.has(job.id)) {
          job.status = "cancelled";
          this.emit("job", job);
          continue;
        }
        this.active = job;
        job.status = "downloading";
        this.emit("job", job);
        try {
          await this.runJob(job);
          job.status = "done";
        } catch (e) {
          if (this.cancelled.has(job.id)) {
            job.status = "cancelled";
          } else {
            job.status = "error";
            job.error = e instanceof Error ? e.message : String(e);
          }
        }
        this.emit("job", job);
        this.active = null;
        this.emit("queue", this.getJobs());
      }
    } finally {
      this.running = false;
    }
  }

  private async runJob(job: DownloadJob): Promise<void> {
    const { client, index, romsPath, platformMapOverrides = {} } = this.opts;
    const esde = rommSlugToEsdeFolder(job.rommSlug, platformMapOverrides);
    let received = 0;

    for (const filename of job.filenames) {
      if (this.cancelled.has(job.id)) throw new Error("cancelled");
      const dest = downloadTargetPath(romsPath, job.rommSlug, filename, platformMapOverrides);
      await client.downloadRomContent(job.romId, filename, dest, (bytes) => {
        // bytes is cumulative for this file; approximate overall
        job.progressBytes = received + bytes;
        this.emit("job", job);
      });
      const st = statSync(dest);
      received += st.size;
      job.progressBytes = received;
      let sha1: string | null = null;
      try {
        sha1 = await sha1File(dest);
      } catch {
        sha1 = null;
      }
      index.upsertFile({
        rom_id: job.romId,
        romm_slug: job.rommSlug,
        esde_folder: esde,
        filename,
        size: st.size,
        sha1,
        path: dest,
        downloaded_at: new Date().toISOString(),
      });
    }
  }
}

/** Delete local ROM files for a rom_id; never touches RomM. */
export function deleteLocalRom(
  index: LibraryIndex,
  romId: number,
): { removed: string[]; missing: string[] } {
  const rows = index.deleteByRomId(romId);
  const removed: string[] = [];
  const missing: string[] = [];
  for (const row of rows) {
    if (existsSync(row.path)) {
      unlinkSync(row.path);
      removed.push(row.path);
    } else {
      missing.push(row.path);
    }
  }
  return { removed, missing };
}

/** Rescan an ES-DE platform folder and return filenames present on disk. */
export function scanLocalPlatformFolder(romsPath: string, esdeFolder: string): string[] {
  const dir = join(romsPath, esdeFolder);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => {
    try {
      return statSync(join(dir, name)).isFile();
    } catch {
      return false;
    }
  });
}

export function isRomDownloaded(
  rom: RommRom,
  index: LibraryIndex,
  romsPath: string,
  rommSlug: string,
  overrides: Record<string, string> = {},
): boolean {
  const filenames = romFilenames(rom);
  if (filenames.length === 0) return false;
  const indexed = index.getByRomId(rom.id);
  const indexedNames = new Set(indexed.map((r) => r.filename));

  for (const filename of filenames) {
    const dest = downloadTargetPath(romsPath, rommSlug, filename, overrides);
    if (existsSync(dest)) continue;
    if (indexedNames.has(filename) && indexed.some((r) => r.filename === filename && existsSync(r.path))) {
      continue;
    }
    // Also accept filename-only match after external copy
    const esde = rommSlugToEsdeFolder(rommSlug, overrides);
    const local = scanLocalPlatformFolder(romsPath, esde);
    if (!local.includes(filename)) return false;
  }
  return true;
}
