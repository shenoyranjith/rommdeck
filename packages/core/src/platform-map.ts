import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export interface PlatformMapEntry {
  rommSlug: string;
  esdeFolder: string;
  name?: string;
}

/** Bundled map: RomM slug → ES-DE folder (inverted from RomM ES-DE example). */
let cachedBundled: Record<string, string> | null = null;

function bundledMapPath(): string {
  // Prefer repo data/ when running from source; fall back to packaged copy.
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, "../../../data/platform-map.json"),
    join(here, "../../data/platform-map.json"),
    join(process.cwd(), "data/platform-map.json"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return candidates[0]!;
}

export function loadBundledPlatformMap(): Record<string, string> {
  if (cachedBundled) return cachedBundled;
  const path = bundledMapPath();
  if (!existsSync(path)) {
    cachedBundled = {};
    return cachedBundled;
  }
  const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, string>;
  cachedBundled = raw;
  return raw;
}

/** Resolve ES-DE folder for a RomM platform slug. */
export function rommSlugToEsdeFolder(
  rommSlug: string,
  overrides: Record<string, string> = {},
): string {
  if (overrides[rommSlug]) return overrides[rommSlug];
  const map = loadBundledPlatformMap();
  if (map[rommSlug]) return map[rommSlug];
  // Identity fallback when slug already matches folder name
  return rommSlug;
}

/** Invert: ES-DE folder → RomM slug (first match wins). */
export function esdeFolderToRommSlug(
  esdeFolder: string,
  overrides: Record<string, string> = {},
): string | null {
  for (const [slug, folder] of Object.entries(overrides)) {
    if (folder === esdeFolder) return slug;
  }
  const map = loadBundledPlatformMap();
  for (const [slug, folder] of Object.entries(map)) {
    if (folder === esdeFolder) return slug;
  }
  return null;
}

export function downloadTargetPath(
  romsPath: string,
  rommSlug: string,
  filename: string,
  overrides: Record<string, string> = {},
): string {
  const folder = rommSlugToEsdeFolder(rommSlug, overrides);
  return join(romsPath, folder, filename);
}
