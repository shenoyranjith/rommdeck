export interface RommPlatform {
  id: number;
  name: string;
  slug: string;
  fs_slug?: string;
  rom_count?: number;
  custom_name?: string | null;
  display_name?: string | null;
  url_logo?: string | null;
  logo_path?: string | null;
}

export interface RommRomFile {
  id?: number;
  file_name: string;
  file_size_bytes?: number;
  file_extension?: string;
  md5_hash?: string | null;
  crc_hash?: string | null;
  sha1_hash?: string | null;
}

/** Shared metadata fields from RomM metadatum / provider payloads. */
export interface RommMetadatum {
  rom_id?: number;
  genres?: string[];
  franchises?: string[];
  collections?: string[];
  companies?: string[];
  developers?: string[];
  publishers?: string[];
  game_modes?: string[];
  age_ratings?: string[];
  first_release_date?: number | null;
  average_rating?: number | null;
}

export interface RommRom {
  id: number;
  name: string;
  slug?: string;
  fs_name?: string;
  fs_name_no_tags?: string;
  fs_name_no_ext?: string;
  fs_extension?: string;
  fs_path?: string;
  fs_size_bytes?: number;
  sha1_hash?: string | null;
  md5_hash?: string | null;
  platform_id?: number;
  platform_slug?: string;
  platform_name?: string;
  platform_display_name?: string;
  summary?: string | null;
  path_cover_small?: string | null;
  path_cover_large?: string | null;
  url_cover?: string | null;
  path_video?: string | null;
  merged_screenshots?: string[];
  metadatum?: RommMetadatum | null;
  igdb_metadata?: RommMetadatum | null;
  ss_metadata?: RommMetadatum | null;
  moby_metadata?: RommMetadatum | null;
  launchbox_metadata?: RommMetadatum | null;
  generated_first_release_date?: number | null;
  generated_player_count?: string | null;
  multi?: boolean;
  files?: RommRomFile[];
  filesize?: number;
}

export interface RommPaginated<T> {
  items?: T[];
  total?: number;
  char?: string;
  limit?: number;
  offset?: number;
  // Some RomM versions return a bare array
}

export interface RommDevice {
  id: number;
  name: string;
  platform?: string;
  hostname?: string;
  sync_mode?: string;
  paths?: Record<string, string>;
}

export interface SyncLocalSave {
  file: string;
  mtime: string;
  sha1: string;
}

export interface SyncLocalRom {
  rom_id: number;
  saves: SyncLocalSave[];
}

export type SyncOpType = "upload" | "download" | "conflict" | "noop";

export interface SyncOperation {
  type: SyncOpType;
  rom_id: number;
  file: string;
  destination?: string;
  source?: string;
  dest_path?: string;
  resolution?: "keep_both" | "server_wins" | "device_wins";
}

export interface NegotiateResponse {
  session_id: string;
  operations: SyncOperation[];
}

export interface CompleteSessionBody {
  operations_completed: number;
  operations_failed: number;
  play_sessions: unknown[];
}
