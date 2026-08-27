import { getApi } from "../../api";
import { PAGE_SIZE, type RomItem } from "./types";

export type CatalogQuery = {
  platformId?: number;
  platformSlug?: string;
  searchTerm?: string;
};

/** Single RomM /api/roms page used by initial load, infinite scroll, and full-catalog fill. */
export async function fetchRomPage(
  query: CatalogQuery,
  opts: { limit?: number; offset: number },
): Promise<{ items: RomItem[]; total: number }> {
  const result = await getApi().getRoms({
    platformId: query.platformId,
    platformSlug: query.platformSlug,
    searchTerm: query.searchTerm,
    limit: opts.limit ?? PAGE_SIZE,
    offset: opts.offset,
  });
  const items = result.items as RomItem[];
  return {
    items,
    total: result.total ?? opts.offset + items.length,
  };
}

export function mergeRomPages(prev: RomItem[], next: RomItem[]): RomItem[] {
  if (next.length === 0) return prev;
  const seen = new Set(prev.map((r) => r.id));
  const added = next.filter((r) => !seen.has(r.id));
  return added.length === 0 ? prev : [...prev, ...added];
}

export function catalogQueryFrom(
  selected: { id: number; slug: string } | null | undefined,
  search: string,
): CatalogQuery {
  return {
    platformId: selected?.id,
    platformSlug: selected?.slug,
    searchTerm: search || undefined,
  };
}
