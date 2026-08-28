import { existsSync, readdirSync, unlinkSync } from "node:fs";
import { basename, extname, join } from "node:path";
import type { RommClient } from "../romm/client.js";
import type { RommRom } from "../romm/types.js";
import { log } from "../log.js";
import { mediaTypeDir } from "./paths.js";

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const VIDEO_EXTS = new Set([".mp4", ".mkv", ".avi", ".wmv", ".mov", ".webm"]);

export interface DownloadRomMediaOptions {
  client: RommClient;
  mediaRoot: string;
  esdeFolder: string;
  romFilename: string;
  rom: RommRom;
  signal?: AbortSignal;
}

export interface DownloadedMedia {
  type: string;
  path: string;
}

function mediaStem(filename: string): string {
  return basename(filename, extname(filename));
}

function extensionFromUrl(url: string, fallback: string): string {
  try {
    const pathname = new URL(url, "http://local").pathname;
    const ext = extname(pathname).toLowerCase();
    if (ext) return ext;
  } catch {
    /* ignore */
  }
  return fallback;
}

function destPath(dir: string, stem: string, ext: string): string {
  const normalized = ext.startsWith(".") ? ext : `.${ext}`;
  return join(dir, `${stem}${normalized.toLowerCase()}`);
}

async function downloadTo(
  client: RommClient,
  source: string,
  dest: string,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) throw new Error("cancelled");
  await client.downloadAsset(source, dest);
}

async function tryDownloadMedia(
  label: string,
  romId: number,
  run: () => Promise<DownloadedMedia>,
): Promise<DownloadedMedia | null> {
  try {
    return await run();
  } catch (e) {
    log.esde(`${label} download skipped`, {
      romId,
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

/** Download cover + first screenshot (when available) into ES-DE media folders. */
export async function downloadRomMedia(opts: DownloadRomMediaOptions): Promise<DownloadedMedia[]> {
  const { client, mediaRoot, esdeFolder, romFilename, rom, signal } = opts;
  const stem = mediaStem(romFilename);
  const saved: DownloadedMedia[] = [];

  const coverUrl = client.coverUrlFor(rom, "large");
  if (coverUrl) {
    const dir = mediaTypeDir(mediaRoot, esdeFolder, "covers");
    const ext = extensionFromUrl(coverUrl, ".png");
    const dest = destPath(dir, stem, ext);
    const item = await tryDownloadMedia("cover", rom.id, async () => {
      log.esde("downloading cover", { romId: rom.id, dest, source: coverUrl });
      await downloadTo(client, coverUrl, dest, signal);
      return { type: "covers", path: dest };
    });
    if (item) saved.push(item);
  }

  const screenshots = rom.merged_screenshots ?? [];
  const screenshotUrl = screenshots[0] ? client.resolveAssetUrl(screenshots[0]) : null;
  if (screenshotUrl) {
    const dir = mediaTypeDir(mediaRoot, esdeFolder, "screenshots");
    const ext = extensionFromUrl(screenshotUrl, ".jpg");
    const dest = destPath(dir, stem, ext);
    const item = await tryDownloadMedia("screenshot", rom.id, async () => {
      log.esde("downloading screenshot", { romId: rom.id, dest, source: screenshotUrl });
      await downloadTo(client, screenshotUrl, dest, signal);
      return { type: "screenshots", path: dest };
    });
    if (item) saved.push(item);
  }

  const videoUrl = client.resolveAssetUrl(rom.path_video);
  if (videoUrl) {
    const dir = mediaTypeDir(mediaRoot, esdeFolder, "videos");
    const ext = extensionFromUrl(videoUrl, ".mp4");
    const dest = destPath(dir, stem, ext);
    const item = await tryDownloadMedia("video", rom.id, async () => {
      log.esde("downloading video", { romId: rom.id, dest, source: videoUrl });
      await downloadTo(client, videoUrl, dest, signal);
      return { type: "videos", path: dest };
    });
    if (item) saved.push(item);
  }

  return saved;
}

/** Remove media files for a ROM (all supported extensions under known type folders). */
export function removeRomMedia(
  mediaRoot: string,
  esdeFolder: string,
  romFilename: string,
): string[] {
  const stem = mediaStem(romFilename);
  const removed: string[] = [];
  const types = ["covers", "screenshots", "videos", "marquees", "fanart", "titlescreens"];

  for (const type of types) {
    const dir = mediaTypeDir(mediaRoot, esdeFolder, type);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const fileStem = basename(name, extname(name));
      const ext = extname(name).toLowerCase();
      if (fileStem !== stem) continue;
      if (!IMAGE_EXTS.has(ext) && !VIDEO_EXTS.has(ext)) continue;
      const full = join(dir, name);
      try {
        unlinkSync(full);
        removed.push(full);
      } catch {
        /* ignore */
      }
    }
  }
  return removed;
}
