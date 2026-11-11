import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { defaultDbPath } from './paths'

export interface NoteRow {
  id: number
  title: string | null
  body: string
  created_at: string
  updated_at: string | null
  // Folder the note was written from (project root for Claude sessions), null if unknown.
  cwd: string | null
  session_id: string | null
  // Pinned notes stay at the top of their tab and survive « Tout effacer ».
  pinned_at: string | null
}

export const NOTE_COLUMNS = 'id, title, body, created_at, updated_at, cwd, session_id, pinned_at'

let dbInstance: Database.Database | null = null

function resolveDbPath(): string {
  return process.env.BOARD_DB_PATH || defaultDbPath()
}

export function useDb(): Database.Database {
  if (dbInstance) return dbInstance

  const path = resolveDbPath()
  mkdirSync(dirname(path), { recursive: true })

  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // notes.file_path is legacy: it is only read once, to seed the attachments table.
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT,
      body        TEXT NOT NULL,
      file_path   TEXT,
      created_at  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);
  `)

  const hasAttachments = db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'attachments'`)
    .get()
  if (!hasAttachments) {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE attachments (
          id        INTEGER PRIMARY KEY AUTOINCREMENT,
          note_id   INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
          position  INTEGER NOT NULL,
          path      TEXT NOT NULL
        );
        CREATE INDEX idx_attachments_note ON attachments(note_id, position);
        INSERT INTO attachments (note_id, position, path)
          SELECT id, 0, file_path FROM notes WHERE file_path IS NOT NULL;
      `)
    })()
  }

  const noteColumns = db.prepare(`PRAGMA table_info(notes)`).all() as { name: string }[]
  for (const column of ['updated_at', 'cwd', 'session_id', 'pinned_at']) {
    if (!noteColumns.some((existing) => existing.name === column)) {
      db.exec(`ALTER TABLE notes ADD COLUMN ${column} TEXT`)
    }
  }

  // One row per note captured from a Claude Code transcript, kept after the note is deleted:
  // the hook rescans the whole transcript, and a deleted note must not come back.
  db.exec(`
    CREATE TABLE IF NOT EXISTS captures (
      signature    TEXT PRIMARY KEY,
      note_id      INTEGER,
      captured_at  TEXT NOT NULL
    );
  `)

  dbInstance = db
  return db
}
