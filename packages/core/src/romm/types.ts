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
  id: string | number;
  name: string;
  platform?: string;
  hostname?: string;
  sync_mode?: string;
  sync_config?: { paths?: Record<string, string> } | null;
  paths?: Record<string, string>;
}

export interface ClientSaveState {
  rom_id: number;
  file_name: string;
  slot: string;
  emulator: string;
  content_hash: string;
  updated_at: string;
  file_size_bytes: number;
}

/** @deprecated Legacy nested negotiate shape — prefer flat `ClientSaveState[]`. */
export interface SyncLocalSave {
  file: string;
  mtime: string;
  sha1: string;
}

/** @deprecated Legacy nested negotiate shape — prefer flat `ClientSaveState[]`. */
export interface SyncLocalRom {
  rom_id: number;
  saves: SyncLocalSave[];
}

export type SyncOpAction = "upload" | "download" | "conflict" | "no_op";

export interface SyncOperation {
  /** Normalized action (`no_op` from RomM API). */
  type: SyncOpAction;
  rom_id: number;
  /** Basename used for local lookup and UI (`file_name` from API). */
  file: string;
  file_name?: string;
  save_id?: number | null;
  slot?: string | null;
  emulator?: string | null;
  reason?: string;
  /** Legacy upload target (older RomM negotiate responses). */
  destination?: string;
  /** Legacy download URL (older RomM negotiate responses). */
  source?: string;
  /** Server-suggested path (older RomM) or ignored when using canonical paths. */
  dest_path?: string;
  resolution?: "keep_both" | "server_wins" | "device_wins";
  server_updated_at?: string;
  server_content_hash?: string | null;
}

export interface NegotiateResponse {
  session_id: string | number;
  operations: SyncOperation[];
  total_upload?: number;
  total_download?: number;
  total_conflict?: number;
  total_no_op?: number;
}

export interface CompleteSessionBody {
  operations_completed: number;
  operations_failed: number;
  play_sessions: unknown[];
}
