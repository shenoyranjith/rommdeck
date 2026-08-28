import { existsSync, renameSync, unlinkSync, readdirSync, statSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import type { RommClient } from "../romm/client.js";
import type { RommRom } from "../romm/types.js";
import { LibraryIndex } from "../db/index.js";
import { downloadTargetPath, rommSlugToEsdeFolder } from "../platform-map.js";
import { verifyRomFileHash } from "../hash.js";
import { syncEsdeMetadata, removeEsdeMetadata } from "../esde/metadata.js";
import { isGamelistWriteActive, shutdownGamelistWrites } from "../esde/gamelist-queue.js";
import { expectedHashesForFile, hashesMatchRom, romHasExpectedHash } from "./hashes.js";
import {
  clearPersistedDownloadQueue,
  loadPersistedDownloadQueue,
  savePersistedDownloadQueue,
  type PersistedActiveEntry,
  type PersistedDownloadQueue,
} from "./queue-persist.js";
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
  downloadedMediaPath?: string;
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

export interface ActiveTransferBreakdown {
  downloading: number;
  queued: number;
  metadata: number;
  gamelistWriteActive: boolean;
  total: number;
}

export class DownloadManager extends EventEmitter {
  private queue: DownloadJob[] = [];
  private failedJobs: DownloadJob[] = [];
  private active: DownloadJob | null = null;
  private activeAbort: AbortController | null = null;
  /** Jobs waiting for or running ES-DE metadata sync (downloads may continue). */
  private metadataJobs: DownloadJob[] = [];
  private metadataAbort = new Map<string, AbortController>();
  private cancelled = new Set<string>();
  private running = false;
  private opts: DownloadManagerOptions;
  /** RomM metadata captured at enqueue for hash verification. */
  private romByJobId = new Map<string, RommRom>();
  private restored = false;
  private shuttingDown = false;
  private shutdownSnapshot: PersistedDownloadQueue | null = null;
  private batchDepth = 0;
  private failedDirty = false;
  private emitScheduled = false;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private jobEmitLast = new Map<string, number>();

  /** Coalesce queue notifications while enqueueing many jobs. */
  beginBatch(): void {
    this.batchDepth++;
  }

  endBatch(): void {
    if (this.batchDepth <= 0) return;
    this.batchDepth--;
    if (this.batchDepth === 0) this.afterEnqueue();
  }

  constructor(opts: DownloadManagerOptions) {
    super();
    this.opts = opts;
  }

  /** Reload active + failed jobs from disk and resume the pump. */
  async restorePersistedQueue(): Promise<void> {
    if (this.restored) return;

    const data = loadPersistedDownloadQueue();
    if (!data) {
      this.restored = true;
      return;
    }

    log.download("restoring persisted queue", {
      active: data.active.length,
      failed: data.failed.length,
      savedAt: data.savedAt,
    });

    let downloadQueued = 0;
    let metadataQueued = 0;

    for (const failed of data.failed) {
      if (this.getActiveJobForRom(failed.romId)) continue;
      this.failedJobs.push({
        ...failed,
        status: "error",
        progressBytes: 0,
        error: failed.error ?? "Failed before last exit",
      });
    }

    this.beginBatch();
    try {
      let processed = 0;
      for (const entry of data.active) {
        const job = this.jobFromPersisted(entry);
        if (this.getActiveJobForRom(job.romId)) continue;

        const needsDownload = !this.jobFilesComplete(job);

        if (!needsDownload && this.opts.rdHomePath) {
          this.scheduleMetadata(job);
          metadataQueued++;
        } else if (needsDownload) {
          this.queue.push(job);
          downloadQueued++;
        }

        processed++;
        if (processed % 25 === 0) {
          await new Promise<void>((resolve) => setImmediate(resolve));
        }
      }
    } finally {
      this.endBatch();
    }

    this.restored = true;
    this.flushPersistedQueue();

    if (this.failedJobs.length > 0) this.emitFailed();
    if (this.getJobs().length > 0) this.flushEmitQueue();

    log.download("queue restore complete", {
      downloadQueued,
      metadataQueued,
      failed: this.failedJobs.length,
    });
  }

  private jobFromPersisted(entry: PersistedActiveEntry): DownloadJob {
    return {
      ...entry.job,
      status: entry.phase === "metadata" ? "metadata" : "queued",
      progressBytes: 0,
    };
  }

  private jobFilesComplete(job: Pick<DownloadJob, "romId" | "filenames">): boolean {
    const rows = this.opts.index.getByRomId(job.romId);
    if (rows.length === 0) return false;
    return job.filenames.every((filename) => {
      const row = rows.find((r) => r.filename === filename);
      return row !== undefined && existsSync(row.path);
    });
  }

  private buildPersistedActive(): PersistedActiveEntry[] {
    return this.getJobs()
      .filter((j) => isActiveDownloadStatus(j.status))
      .map((job) => ({
        phase: job.status === "metadata" ? ("metadata" as const) : ("download" as const),
        job: {
          id: job.id,
          romId: job.romId,
          romName: job.romName,
          rommSlug: job.rommSlug,
          filenames: job.filenames,
          totalBytes: job.totalBytes,
          coverUrl: job.coverUrl ?? null,
        },
      }));
  }

  private buildPersistedPayload(): PersistedDownloadQueue {
    const active = this.buildPersistedActive();
    const failed = this.failedJobs.map((job) => ({
      id: job.id,
      romId: job.romId,
      romName: job.romName,
      rommSlug: job.rommSlug,
      filenames: job.filenames,
      totalBytes: job.totalBytes,
      coverUrl: job.coverUrl ?? null,
      error: job.error,
    }));
    return {
      version: 1,
      savedAt: new Date().toISOString(),
      active,
      failed,
    };
  }

  /** Write queue state to disk (e.g. on window close when nothing is actively transferring). */
  flushPersistedQueue(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    this.writePersistedSnapshot();
  }

  private schedulePersistQueue(): void {
    if (this.shuttingDown) return;
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.writePersistedSnapshot();
    }, 500);
  }

  private scheduleEmitQueue(): void {
    this.schedulePersistQueue();
    if (this.emitScheduled) return;
    this.emitScheduled = true;
    setImmediate(() => {
      this.emitScheduled = false;
      this.emit("queue", this.getJobs());
    });
  }

  private flushEmitQueue(): void {
    this.emitScheduled = false;
    this.emit("queue", this.getJobs());
  }

  private emitJobThrottled(job: DownloadJob): void {
    if (job.status !== "downloading") {
      this.emit("job", job);
      return;
    }
    const now = Date.now();
    const last = this.jobEmitLast.get(job.id) ?? 0;
    if (now - last < 100) return;
    this.jobEmitLast.set(job.id, now);
    this.emit("job", job);
  }

  private afterEnqueue(): void {
    if (this.batchDepth > 0) return;
    if (this.failedDirty) {
      this.failedDirty = false;
      this.emitFailed();
    }
    this.scheduleEmitQueue();
    void this.pump();
  }

  private writePersistedSnapshot(): void {
    try {
      if (this.shuttingDown && this.shutdownSnapshot) {
        savePersistedDownloadQueue(this.shutdownSnapshot);
        return;
      }

      const payload = this.buildPersistedPayload();
      if (payload.active.length === 0 && payload.failed.length === 0) {
        clearPersistedDownloadQueue();
        return;
      }

      savePersistedDownloadQueue(payload);
      log.download("queue persisted", {
        active: payload.active.length,
        failed: payload.failed.length,
      });
    } catch (e) {
      log.download("persist queue failed", {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  private emitFailed(): void {
    this.schedulePersistQueue();
    this.emit("failed", this.getFailedJobs());
  }

  /** Active download, then metadata queue, then download queue — top-to-bottom FIFO in the UI. */
  getJobs(): DownloadJob[] {
    return [
      ...(this.active ? [this.active] : []),
      ...this.metadataJobs,
      ...this.queue,
    ];
  }

  getFailedJobs(): DownloadJob[] {
    return [...this.failedJobs];
  }

  getQueueState(): DownloadQueueState {
    return { active: this.getJobs(), failed: this.getFailedJobs() };
  }

  getActiveCount(): number {
    return this.getJobs().filter((j) => isActiveDownloadStatus(j.status)).length;
  }

  getActiveBreakdown(): ActiveTransferBreakdown {
    const jobs = this.getJobs();
    const downloading = jobs.filter((j) => j.status === "downloading").length;
    const queued = jobs.filter((j) => j.status === "queued").length;
    const metadata = jobs.filter((j) => j.status === "metadata").length;
    const gamelistWriteActive = isGamelistWriteActive();
    return {
      downloading,
      queued,
      metadata,
      gamelistWriteActive,
      total: downloading + queued + metadata,
    };
  }

  hasActiveWork(): boolean {
    const b = this.getActiveBreakdown();
    return b.total > 0 || b.gamelistWriteActive;
  }

  /** Cancel transfers and drain or abort in-flight gamelist writes before app exit. */
  async prepareForShutdown(): Promise<void> {
    log.download("prepareForShutdown");
    this.shutdownSnapshot = this.buildPersistedPayload();
    if (
      this.shutdownSnapshot.active.length > 0 ||
      this.shutdownSnapshot.failed.length > 0
    ) {
      savePersistedDownloadQueue(this.shutdownSnapshot);
      log.download("queue persisted for shutdown", {
        active: this.shutdownSnapshot.active.length,
        failed: this.shutdownSnapshot.failed.length,
      });
    }
    this.shuttingDown = true;
    if (this.active) this.cancel(this.active.id);
    for (const job of [...this.queue]) this.cancel(job.id);
    for (const job of [...this.metadataJobs]) {
      this.cancelled.add(job.id);
      this.metadataAbort.get(job.id)?.abort();
    }
    await shutdownGamelistWrites();
  }

  /** Active queue job for a rom_id, if any. */
  getActiveJobForRom(romId: number): DownloadJob | undefined {
    return this.getJobs().find((j) => j.romId === romId && isActiveDownloadStatus(j.status));
  }

  isRomInQueue(romId: number): boolean {
    return this.getActiveJobForRom(romId) !== undefined;
  }

  enqueue(rom: RommRom, rommSlug: string): DownloadJob {
    const job = this.addToQueue(rom, rommSlug);
    this.afterEnqueue();
    return job;
  }

  enqueueMany(roms: { rom: RommRom; rommSlug: string }[]): DownloadJob[] {
    this.beginBatch();
    try {
      return roms.map(({ rom, rommSlug }) => this.addToQueue(rom, rommSlug));
    } finally {
      this.endBatch();
    }
  }

  private addToQueue(rom: RommRom, rommSlug: string): DownloadJob {
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
    if (hadFailed) {
      if (this.batchDepth > 0) this.failedDirty = true;
      else this.emitFailed();
    }

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
    return job;
  }

  cancel(jobId: string): void {
    this.cancelled.add(jobId);

    const queued = this.queue.find((j) => j.id === jobId);
    if (queued) {
      queued.status = "cancelled";
      this.queue = this.queue.filter((j) => j.id !== jobId);
      this.romByJobId.delete(jobId);
      this.emit("job", queued);
      this.scheduleEmitQueue();
      return;
    }

    if (this.active?.id === jobId) {
      this.active.status = "cancelled";
      this.activeAbort?.abort();
      this.emit("job", { ...this.active });
      this.scheduleEmitQueue();
      return;
    }

    const metadata = this.metadataJobs.find((j) => j.id === jobId);
    if (metadata) {
      metadata.status = "cancelled";
      this.metadataAbort.get(jobId)?.abort();
      this.metadataJobs = this.metadataJobs.filter((j) => j.id !== jobId);
      this.metadataAbort.delete(jobId);
      this.emit("job", { ...metadata });
      this.scheduleEmitQueue();
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

  async retryAll(): Promise<DownloadJob[]> {
    const toRetry = [...this.failedJobs];
    if (toRetry.length === 0) return [];
    log.download("retrying all failed jobs", { count: toRetry.length });
    this.beginBatch();
    try {
      const results: DownloadJob[] = [];
      for (const failed of toRetry) {
        const job = await this.retry(failed.id);
        if (job) results.push(job);
      }
      return results;
    } finally {
      this.endBatch();
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
          this.romByJobId.delete(job.id);
          this.scheduleEmitQueue();
          continue;
        }
        this.active = job;
        job.status = "downloading";
        this.emit("job", job);
        this.scheduleEmitQueue();
        const abort = new AbortController();
        this.activeAbort = abort;
        try {
          const metadataQueued = await this.runJob(job, abort.signal);
          if (metadataQueued) {
            this.active = null;
            this.romByJobId.delete(job.id);
            this.scheduleEmitQueue();
            continue;
          }
          if (!this.cancelled.has(job.id)) {
            job.status = "done";
          }
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
        this.scheduleEmitQueue();
      }
    } finally {
      this.running = false;
    }
  }

  private scheduleMetadata(job: DownloadJob): void {
    const { client, rdHomePath, downloadedMediaPath, platformMapOverrides = {} } = this.opts;
    if (!rdHomePath) return;

    job.status = "metadata";
    this.metadataJobs.push(job);
    log.esde("metadata queued", {
      jobId: job.id,
      romId: job.romId,
      rommSlug: job.rommSlug,
      primaryFilename: job.filenames[0] ?? "",
      pendingMetadata: this.metadataJobs.length,
    });
    this.emit("job", job);
    this.scheduleEmitQueue();

    const abort = new AbortController();
    this.metadataAbort.set(job.id, abort);

    void syncEsdeMetadata({
      client,
      romId: job.romId,
      rommSlug: job.rommSlug,
      primaryFilename: job.filenames[0] ?? "",
      rdHomePath,
      downloadedMediaPath,
      platformMapOverrides,
      signal: abort.signal,
    })
      .then(() => this.finishMetadataJob(job.id))
      .catch((e) => this.finishMetadataJob(job.id, e));
  }

  private finishMetadataJob(jobId: string, error?: unknown): void {
    const job = this.metadataJobs.find((j) => j.id === jobId);
    if (!job) return;

    this.metadataJobs = this.metadataJobs.filter((j) => j.id !== jobId);
    this.metadataAbort.delete(jobId);

    if (this.cancelled.has(jobId)) {
      job.status = "cancelled";
    } else if (error) {
      job.status = "error";
      job.error = error instanceof Error ? error.message : String(error);
      this.failedJobs.push({ ...job });
      this.emitFailed();
      log.download("metadata job failed", {
        jobId: job.id,
        romId: job.romId,
        error: job.error,
      });
    } else {
      job.status = "done";
      log.esde("metadata phase complete", { romId: job.romId, jobId: job.id });
    }

    log.download("metadata job finished", {
      jobId: job.id,
      romId: job.romId,
      status: job.status,
    });
    this.emit("job", job);
    this.scheduleEmitQueue();
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

  private async runJob(job: DownloadJob, signal: AbortSignal): Promise<boolean> {
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
            this.emitJobThrottled(job);
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
        this.scheduleMetadata(job);
        return true;
      }

      log.esde("metadata skipped (no rdHomePath)", { romId: job.romId });
      log.download("runJob complete", {
        jobId: job.id,
        romId: job.romId,
        files: completedFiles.length,
        indexed: true,
      });
      return false;
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
export async function deleteLocalRom(
  index: LibraryIndex,
  romId: number,
  esde?: { rdHomePath: string; downloadedMediaPath?: string },
): Promise<{ removed: string[]; missing: string[]; esdeCleaned: number }> {
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

  let esdeCleaned = 0;
  if (esde?.rdHomePath && rows.length > 0) {
    const byFolder = new Map<string, string>();
    for (const row of rows) {
      if (!byFolder.has(row.esde_folder)) byFolder.set(row.esde_folder, row.filename);
    }
    for (const [esdeFolder, primaryFilename] of byFolder) {
      const result = await removeEsdeMetadata({
        rdHomePath: esde.rdHomePath,
        downloadedMediaPath: esde.downloadedMediaPath,
        esdeFolder,
        primaryFilename,
      });
      if (result.gamelistRemoved) esdeCleaned += 1;
      esdeCleaned += result.mediaRemoved.length;
    }
  }

  return { removed, missing, esdeCleaned };
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
