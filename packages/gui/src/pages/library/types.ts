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
}
