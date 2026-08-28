export interface Platform {
  id: number;
  name: string;
  slug: string;
  rom_count?: number;
  logoUrl?: string | null;
  displayName?: string;
}

export interface RomItem {
  id: number;
  name: string;
  platform_slug?: string;
  platform_name?: string;
  platform_display_name?: string;
  summary?: string | null;
  fs_name?: string;
  fs_size_bytes?: number;
  filesize?: number;
  files?: { file_name: string; file_size_bytes?: number }[];
  path_cover_small?: string | null;
  path_cover_large?: string | null;
  url_cover?: string | null;
  coverUrl?: string | null;
  coverUrlSmall?: string | null;
  downloaded?: boolean;
  /** False when downloaded but RomM provided no hash to verify against. */
  verified?: boolean;
  /** True when downloaded but absent from ES-DE gamelist.xml. */
  metadataMissing?: boolean;
}

export type StatusFilter = "all" | "downloaded" | "missing";

export type LibraryViewMode = "grid" | "list";

export const PAGE_SIZE = 48;
