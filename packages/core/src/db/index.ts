import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { getLibraryDbPath } from "../paths.js";
import { currentSchemaVersion, runMigrations } from "./migrations.js";

export interface IndexedRomFile {
  id?: number;
  rom_id: number;
  romm_slug: string;
  esde_folder: string;
  filename: string;
  size: number | null;
  sha1: string | null;
  path: string;
  downloaded_at: string;
}

export class LibraryIndex {
  private db: Database.Database;

  constructor(dbPath = getLibraryDbPath()) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    runMigrations(this.db);
  }

  /** Highest applied migration id (for diagnostics). */
  schemaVersion(): number {
    return currentSchemaVersion(this.db);
  }

  upsertFile(row: Omit<IndexedRomFile, "id">): void {
    this.db
      .prepare(
        `INSERT INTO rom_files (rom_id, romm_slug, esde_folder, filename, size, sha1, path, downloaded_at)
         VALUES (@rom_id, @romm_slug, @esde_folder, @filename, @size, @sha1, @path, @downloaded_at)
         ON CONFLICT(path) DO UPDATE SET
           rom_id=excluded.rom_id,
           romm_slug=excluded.romm_slug,
           esde_folder=excluded.esde_folder,
           filename=excluded.filename,
           size=excluded.size,
           sha1=excluded.sha1,
           downloaded_at=excluded.downloaded_at`,
      )
      .run(row);
  }

  getByRomId(romId: number): IndexedRomFile[] {
    return this.db
      .prepare(`SELECT * FROM rom_files WHERE rom_id = ?`)
      .all(romId) as IndexedRomFile[];
  }

  getAll(): IndexedRomFile[] {
    return this.db.prepare(`SELECT * FROM rom_files ORDER BY romm_slug, filename`).all() as IndexedRomFile[];
  }

  getDownloadedRomIds(): Set<number> {
    const rows = this.db.prepare(`SELECT DISTINCT rom_id FROM rom_files`).all() as { rom_id: number }[];
    return new Set(rows.map((r) => r.rom_id));
  }

  /** Distinct RomM rom_ids indexed for a platform slug. */
  getDownloadedRomIdsForSlug(rommSlug: string): number[] {
    const rows = this.db
      .prepare(`SELECT DISTINCT rom_id FROM rom_files WHERE romm_slug = ? ORDER BY rom_id`)
      .all(rommSlug) as { rom_id: number }[];
    return rows.map((r) => r.rom_id);
  }

  deleteByRomId(romId: number): IndexedRomFile[] {
    const rows = this.getByRomId(romId);
    this.db.prepare(`DELETE FROM rom_files WHERE rom_id = ?`).run(romId);
    return rows;
  }

  deleteByPath(path: string): void {
    this.db.prepare(`DELETE FROM rom_files WHERE path = ?`).run(path);
  }

  findByFilename(filename: string, esdeFolder?: string): IndexedRomFile[] {
    if (esdeFolder) {
      return this.db
        .prepare(`SELECT * FROM rom_files WHERE filename = ? AND esde_folder = ?`)
        .all(filename, esdeFolder) as IndexedRomFile[];
    }
    return this.db
      .prepare(`SELECT * FROM rom_files WHERE filename = ?`)
      .all(filename) as IndexedRomFile[];
  }

  close(): void {
    this.db.close();
  }
}

export { MIGRATIONS, runMigrations, currentSchemaVersion } from "./migrations.js";
