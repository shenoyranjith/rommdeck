import type Database from "better-sqlite3";

export interface Migration {
  id: number;
  name: string;
  up: (db: Database.Database) => void;
}

/**
 * Ordered, append-only migrations. Next schema change = add `{ id: 2, ... }` here.
 * Never edit a migration that may already have run on a user's machine.
 */
export const MIGRATIONS: Migration[] = [
  {
    id: 1,
    name: "001_init",
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS rom_files (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          rom_id INTEGER NOT NULL,
          romm_slug TEXT NOT NULL,
          esde_folder TEXT NOT NULL,
          filename TEXT NOT NULL,
          size INTEGER,
          sha1 TEXT,
          path TEXT NOT NULL UNIQUE,
          downloaded_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_rom_files_rom_id ON rom_files(rom_id);
        CREATE INDEX IF NOT EXISTS idx_rom_files_slug ON rom_files(romm_slug);
      `);
    },
  },
  {
    id: 2,
    name: "002_rom_files_verified",
    up(db) {
      db.exec(`
        ALTER TABLE rom_files ADD COLUMN verified INTEGER NOT NULL DEFAULT 1;
      `);
    },
  },
];

function ensureMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
}

function appliedIds(db: Database.Database): Set<number> {
  const rows = db.prepare(`SELECT id FROM schema_migrations`).all() as { id: number }[];
  return new Set(rows.map((r) => r.id));
}

export function runMigrations(db: Database.Database): void {
  ensureMigrationsTable(db);

  const applied = appliedIds(db);
  const insert = db.prepare(
    `INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)`,
  );

  const pending = MIGRATIONS.filter((m) => !applied.has(m.id)).sort((a, b) => a.id - b.id);

  if (pending.length === 0) return;

  const run = db.transaction(() => {
    for (const migration of pending) {
      migration.up(db);
      insert.run(migration.id, migration.name, new Date().toISOString());
    }
  });
  run();
}

export function currentSchemaVersion(db: Database.Database): number {
  ensureMigrationsTable(db);
  const row = db.prepare(`SELECT MAX(id) AS v FROM schema_migrations`).get() as {
    v: number | null;
  };
  return row.v ?? 0;
}
