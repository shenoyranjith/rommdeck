import type { RomItem } from "./types";

export interface CatalogCacheEntry {
  items: RomItem[];
  total: number;
}

/** In-memory Library caches for the GUI session (per platform / search). */
const catalogByKey = new Map<string, CatalogCacheEntry>();
const downloadedRomsBySlug = new Map<string, RomItem[]>();
const downloadedIdsBySlug = new Map<string, number[]>();

export function catalogCacheKey(
  platformId: number | undefined | null,
  search: string,
): string {
  return `${platformId ?? "none"}:${search}`;
}

export function getCatalog(key: string): CatalogCacheEntry | undefined {
  return catalogByKey.get(key);
}

export function setCatalog(key: string, items: RomItem[], total: number): void {
  catalogByKey.set(key, { items, total });
}

export function getDownloadedRoms(slug: string): RomItem[] | undefined {
  return downloadedRomsBySlug.get(slug);
}

export function setDownloadedRoms(slug: string, items: RomItem[]): void {
  downloadedRomsBySlug.set(slug, items);
  downloadedIdsBySlug.set(
    slug,
    items.map((r) => r.id),
  );
}

export function getDownloadedIds(slug: string): number[] | undefined {
  return downloadedIdsBySlug.get(slug);
}

export function setDownloadedIds(slug: string, ids: number[]): void {
  downloadedIdsBySlug.set(slug, ids);
}

/** Drop downloaded caches after local delete / index changes. */
export function invalidateDownloaded(slug: string): void {
  downloadedRomsBySlug.delete(slug);
  downloadedIdsBySlug.delete(slug);
}

/** Keep catalog badges in sync when a local copy is removed. */
export function markCatalogRomDownloaded(
  platformId: number | undefined,
  romId: number,
  downloaded: boolean,
): void {
  if (platformId == null) return;
  const prefix = `${platformId}:`;
  for (const [key, entry] of catalogByKey) {
    if (!key.startsWith(prefix)) continue;
    let changed = false;
    const items = entry.items.map((r) => {
      if (r.id !== romId || r.downloaded === downloaded) return r;
      changed = true;
      return { ...r, downloaded };
    });
    if (changed) catalogByKey.set(key, { ...entry, items });
  }
}
