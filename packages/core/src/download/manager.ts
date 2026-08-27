import { existsSync, renameSync, unlinkSync, readdirSync, statSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import type { RommClient } from "../romm/client.js";
import type { RommRom } from "../romm/types.js";
import { LibraryIndex } from "../db/index.js";
import { downloadTargetPath, rommSlugToEsdeFolder } from "../platform-map.js";
import { verifyRomFileHash } from "../hash.js";
import { syncEsdeMetadata } from "../esde/metadata.js";
import { expectedHashesForFile, hashesMatchRom, romHasExpectedHash } from "./hashes.js";
import { log } from "../log.js";

export interface DownloadQueueState {
  active: DownloadJob[];
  failed: DownloadJob[];
}

export type DownloadStatus =
  | "queued"
  | "downloading"
  | "metadata"
  | "done"
  | "error"
  | "cancelled";

export interface DownloadJob {
  id: string;
  romId: number;
  romName: string;
  rommSlug: string;
  filenames: string[];
  status: DownloadStatus;
  progressBytes: number;
  totalBytes: number | null;
  coverUrl?: string | null;
  error?: string;
}

export interface DownloadManagerOptions {
  client: RommClient;
  index: LibraryIndex;
  romsPath: string;
  rdHomePath?: string;
  platformMapOverrides?: Record<string, string>;
}

interface VerifiedFile {
  filename: string;
  path: string;
  size: number;
  sha1: string;
  verified: boolean;
}

function romFilenames(rom: RommRom): string[] {
  if (rom.files && rom.files.length > 0) {
    return rom.files.map((f) => f.file_name);
  }
  if (rom.fs_name) return [rom.fs_name];
  return [];
}

/** Atomically move a completed .part file into place (handles cross-device renames). */
function finalizePartFile(partPath: string, destPath: string): void {
  try {
    renameSync(partPath, destPath);
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? String(e.code) : "";
    if (code !== "EXDEV") throw e;
    copyFileSync(partPath, destPath);
    unlinkSync(partPath);
  }
}

function isActiveDownloadStatus(status: DownloadStatus): boolean {
  return status === "queued" || status === "downloading" || status === "metadata";
}

export class DownloadManager extends EventEmitter {
  private queue: DownloadJob[] = [];
  private failedJobs: DownloadJob[] = [];
  private active: DownloadJob | null = null;
  private activeAbort: AbortController | null = null;
  private cancelled = new Set<string>();
  private running = false;
  private opts: DownloadManagerOptions;
  /** RomM metadata captured at enqueue for hash verification. */
  private romByJobId = new Map<string, RommRom>();

  constructor(opts: DownloadManagerOptions) {
    super();
    this.opts = opts;
  }

  /** Active job first, then queued — top-to-bottom FIFO in the UI. */
  getJobs(): DownloadJob[] {
    return [...(this.active ? [this.active] : []), ...this.queue];
  }

  getFailedJobs(): DownloadJob[] {
    return [...this.failedJobs];
  }

  getQueueState(): DownloadQueueState {
    return { active: this.getJobs(), failed: this.getFailedJobs() };
  }

  private emitFailed(): void {
    this.emit("failed", this.getFailedJobs());
  }

  getActiveCount(): number {
    return this.getJobs().filter((j) => isActiveDownloadStatus(j.status)).length;
  }

  /** Active queue job for a rom_id, if any. */
  getActiveJobForRom(romId: number): DownloadJob | undefined {
    return this.getJobs().find((j) => j.romId === romId && isActiveDownloadStatus(j.status));
  }

  isRomInQueue(romId: number): boolean {
    return this.getActiveJobForRom(romId) !== undefined;
  }

  enqueue(rom: RommRom, rommSlug: string): DownloadJob {
    const existing = this.getActiveJobForRom(rom.id);
    if (existing) {
      log.download("enqueue skipped: already in queue", {
        romId: rom.id,
        jobId: existing.id,
        status: existing.status,
      });
      return existing;
    }

    const hadFailed = this.failedJobs.some((j) => j.romId === rom.id);
    this.failedJobs = this.failedJobs.filter((j) => j.romId !== rom.id);
    if (hadFailed) this.emitFailed();

    const filenames = romFilenames(rom);
    if (filenames.length === 0) {
      throw new Error(`ROM ${rom.id} has no downloadable files`);
    }
    const job: DownloadJob = {
      id: `${rom.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      romId: rom.id,
      romName: rom.name,
      rommSlug,
      filenames,
      status: "queued",
      progressBytes: 0,
      totalBytes: rom.filesize ?? rom.fs_size_bytes ?? null,
      coverUrl: this.opts.client.coverUrlFor(rom),
    };
    this.romByJobId.set(job.id, rom);
    this.queue.push(job);
    log.download("job enqueued", {
      jobId: job.id,
      romId: rom.id,
      romName: rom.name,
      rommSlug,
    });
    this.emit("queue", this.getJobs());
    void this.pump();
    return job;
  }

  enqueueMany(roms: { rom: RommRom; rommSlug: string }[]): DownloadJob[] {
    return roms.map(({ rom, rommSlug }) => this.enqueue(rom, rommSlug));
  }

  cancel(jobId: string): void {
    this.cancelled.add(jobId);

    const queued = this.queue.find((j) => j.id === jobId);
    if (queued) {
      queued.status = "cancelled";
      this.queue = this.queue.filter((j) => j.id !== jobId);
      this.romByJobId.delete(jobId);
      this.emit("job", queued);
      this.emit("queue", this.getJobs());
      return;
    }

    if (this.active?.id === jobId) {
      this.active.status = "cancelled";
      this.activeAbort?.abort();
      this.emit("job", { ...this.active });
      this.emit("queue", this.getJobs());
    }
  }

  cancelAll(): void {
    for (const job of [...this.getJobs()]) {
      this.cancel(job.id);
    }
  }

  dismissFailed(jobId: string): void {
    const before = this.failedJobs.length;
    this.failedJobs = this.failedJobs.filter((j) => j.id !== jobId);
    if (this.failedJobs.length !== before) {
      log.download("failed job dismissed", { jobId });
      this.emitFailed();
    }
  }

  clearFailed(): void {
    if (this.failedJobs.length === 0) return;
    this.failedJobs = [];
    log.download("failed jobs cleared");
    this.emitFailed();
  }

  async retry(jobId: string): Promise<DownloadJob | null> {
    const failed = this.failedJobs.find((j) => j.id === jobId);
    if (!failed) return null;
    this.dismissFailed(jobId);
    const rom = await this.opts.client.getRom(failed.romId);
    return this.enqueue(rom, failed.rommSlug);
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
          this.romByJobId.delete(job.id);
          continue;
        }
        this.active = job;
        job.status = "downloading";
        this.emit("job", job);
        this.emit("queue", this.getJobs());
        const abort = new AbortController();
        this.activeAbort = abort;
        try {
          await this.runJob(job, abort.signal);
          job.status = "done";
        } catch (e) {
          if (this.cancelled.has(job.id)) {
            job.status = "cancelled";
          } else {
            job.status = "error";
            job.error = e instanceof Error ? e.message : String(e);
          }
          log.download("job failed", {
            jobId: job.id,
            romId: job.romId,
            status: job.status,
            error: job.error,
          });
        } finally {
          this.activeAbort = null;
        }
        log.download("job finished", {
          jobId: job.id,
          romId: job.romId,
          romName: job.romName,
          status: job.status,
          error: job.error,
        });
        this.emit("job", job);
        this.active = null;
        this.romByJobId.delete(job.id);
        if (job.status === "error") {
          this.failedJobs.push({ ...job });
          this.emitFailed();
        }
        this.emit("queue", this.getJobs());
      }
    } finally {
      this.running = false;
    }
  }

  private removePartFiles(job: DownloadJob): void {
    const { romsPath, platformMapOverrides = {} } = this.opts;
    for (const filename of job.filenames) {
      const dest = downloadTargetPath(romsPath, job.rommSlug, filename, platformMapOverrides);
      const part = `${dest}.part`;
      if (existsSync(part)) {
        try {
          unlinkSync(part);
        } catch {
          /* ignore */
        }
      }
    }
  }

  private rollbackWrittenFiles(writtenDests: string[]): void {
    for (const dest of writtenDests) {
      if (existsSync(dest)) {
        try {
          unlinkSync(dest);
        } catch {
          /* ignore */
        }
      }
    }
  }

  private async runJob(job: DownloadJob, signal: AbortSignal): Promise<void> {
    const { client, index, romsPath, rdHomePath, platformMapOverrides = {} } = this.opts;
    const rom = this.romByJobId.get(job.id) ?? (await client.getRom(job.romId));
    const esde = rommSlugToEsdeFolder(job.rommSlug, platformMapOverrides);
    const completedFiles: VerifiedFile[] = [];
    const writtenDests: string[] = [];
    let indexed = false;
    let received = 0;

    log.download("runJob start", {
      jobId: job.id,
      romId: job.romId,
      romName: job.romName,
      rommSlug: job.rommSlug,
      esdeFolder: esde,
      romsPath,
      rdHomePath: rdHomePath ?? null,
      filenames: job.filenames,
    });

    try {
      for (const filename of job.filenames) {
        if (this.cancelled.has(job.id)) throw new Error("cancelled");

        const dest = downloadTargetPath(romsPath, job.rommSlug, filename, platformMapOverrides);
        const partPath = `${dest}.part`;
        if (existsSync(partPath)) {
          try {
            unlinkSync(partPath);
          } catch {
            /* ignore */
          }
        }

        await client.downloadRomContent(job.romId, filename, partPath, {
          signal,
          onProgress: (bytes) => {
            job.progressBytes = received + bytes;
            this.emit("job", job);
          },
        });

        const { sha1, verified: hashVerified } = await verifyRomFileHash(
          partPath,
          expectedHashesForFile(rom, filename),
        );
        finalizePartFile(partPath, dest);
        writtenDests.push(dest);
        const st = statSync(dest);
        received += st.size;
        job.progressBytes = received;
        this.emit("job", job);
        completedFiles.push({ filename, path: dest, size: st.size, sha1, verified: hashVerified });
        log.download("file finalized", {
          romId: job.romId,
          filename,
          dest,
          size: st.size,
          sha1,
          verified: hashVerified,
        });
      }

      if (this.cancelled.has(job.id)) throw new Error("cancelled");

      const downloadedAt = new Date().toISOString();
      for (const file of completedFiles) {
        index.upsertFile({
          rom_id: job.romId,
          romm_slug: job.rommSlug,
          esde_folder: esde,
          filename: file.filename,
          size: file.size,
          sha1: file.sha1,
          path: file.path,
          downloaded_at: downloadedAt,
          verified: file.verified,
        });
      }
      indexed = true;
      const indexRows = index.getByRomId(job.romId);
      log.index("upsert complete", {
        romId: job.romId,
        rowCount: indexRows.length,
        rows: indexRows.map((r) => ({
          filename: r.filename,
          path: r.path,
          verified: r.verified,
          sha1: r.sha1,
        })),
      });

      if (rdHomePath) {
        log.esde("metadata phase starting", {
          romId: job.romId,
          rdHomePath,
          esdeFolder: esde,
          primaryFilename: job.filenames[0] ?? "",
        });
        job.status = "metadata";
        this.emit("job", job);
        this.emit("queue", this.getJobs());
        await syncEsdeMetadata({
          client,
          romId: job.romId,
          rommSlug: job.rommSlug,
          primaryFilename: job.filenames[0] ?? "",
          rdHomePath,
          platformMapOverrides,
          signal,
        });
        if (this.cancelled.has(job.id)) throw new Error("cancelled");
        log.esde("metadata phase complete", { romId: job.romId });
      } else {
        log.esde("metadata skipped (no rdHomePath)", { romId: job.romId });
      }

      log.download("runJob complete", {
        jobId: job.id,
        romId: job.romId,
        files: completedFiles.length,
        indexed: true,
      });
    } catch (e) {
      const allFilesWritten = writtenDests.length === job.filenames.length;
      log.download("runJob error", {
        jobId: job.id,
        romId: job.romId,
        error: e instanceof Error ? e.message : String(e),
        writtenDests,
        allFilesWritten,
        indexed,
        cancelled: this.cancelled.has(job.id),
      });
      if (this.cancelled.has(job.id) || !allFilesWritten) {
        this.rollbackWrittenFiles(writtenDests);
        if (indexed) index.deleteByRomId(job.romId);
      }
      this.removePartFiles(job);
      throw e;
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

export type RomLocalStatus = "missing" | "verified" | "unverified";

export function getRomLocalStatus(
  rom: RommRom,
  index: LibraryIndex,
  _romsPath: string,
  rommSlug: string,
  _overrides: Record<string, string> = {},
): RomLocalStatus {
  const ctx = {
    romId: rom.id,
    romName: rom.name,
    rommSlug,
    fsName: rom.fs_name ?? null,
    fileCount: rom.files?.length ?? 0,
    filenames: romFilenames(rom),
  };

  const indexed = index.getByRomId(rom.id);
  if (indexed.length === 0) {
    log.library("status missing: no index rows", ctx);
    return "missing";
  }

  for (const row of indexed) {
    const onDisk = existsSync(row.path);
    if (!onDisk) {
      log.library("status missing: file not on disk", {
        ...ctx,
        path: row.path,
        filename: row.filename,
      });
      return "missing";
    }
  }

  const filenames = romFilenames(rom);
  const hasDetailedFiles = Boolean(rom.files?.length);
  if (hasDetailedFiles && filenames.length > 0) {
    for (const name of filenames) {
      if (!indexed.some((r) => r.filename === name)) {
        log.library("status missing: indexed filename mismatch", {
          ...ctx,
          expected: name,
          indexedFilenames: indexed.map((r) => r.filename),
        });
        return "missing";
      }
    }
  }

  let anyUnverified = false;
  for (const row of indexed) {
    if (romHasExpectedHash(rom, row.filename)) {
      const match = hashesMatchRom(rom, row.filename, row.sha1);
      if (!match) {
        log.library("status missing: hash mismatch", {
          ...ctx,
          filename: row.filename,
          storedSha1: row.sha1,
          expected: expectedHashesForFile(rom, row.filename),
        });
        return "missing";
      }
    } else {
      anyUnverified = true;
    }
  }

  const status = anyUnverified ? "unverified" : "verified";
  return status;
}

export function isRomDownloaded(
  rom: RommRom,
  index: LibraryIndex,
  romsPath: string,
  rommSlug: string,
  overrides: Record<string, string> = {},
): boolean {
  return getRomLocalStatus(rom, index, romsPath, rommSlug, overrides) !== "missing";
}
