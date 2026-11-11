import { basename, parse, relative, resolve, sep } from 'node:path'
import { useDb, type NoteRow } from './db'
import { docsRoot, gitRoot, homeDir, relativeInside } from './paths'

export interface Note extends NoteRow {
  files: string[]
  project: string | null
}

// The project is the first folder under the docs root; a file at the root has none.
export function projectOf(filePath: string | null | undefined): string | null {
  if (!filePath) return null
  const rel = relativeInside(docsRoot(), filePath)
  if (!rel) return null
  const [first, ...rest] = rel.split(sep)
  return first && rest.length > 0 ? first : null
}

// Project of the folder a note was written from: the first folder under the docs root,
// otherwise the name of the git repository holding it (or of the folder itself outside a repository).
// The home directory, its parents and drive roots have none.
export function projectOfCwd(cwd: string | null | undefined): string | null {
  if (!cwd) return null
  const rel = relativeInside(docsRoot(), cwd)
  if (rel) return rel.split(sep)[0] || null
  const folder = resolve(cwd)
  const dir = gitRoot(folder) ?? folder
  const home = homeDir()
  const isHomeOrAbove = relative(dir, home) === '' || relativeInside(dir, home) !== null
  if (dir === parse(dir).root || isHomeOrAbove) return null
  return basename(dir) || null
}

export function attachmentsByNote(noteIds?: number[]): Map<number, string[]> {
  const db = useDb()
  const rows = (
    noteIds
      ? db
          .prepare(
            `SELECT note_id, path FROM attachments
             WHERE note_id IN (${noteIds.map(() => '?').join(',') || 'NULL'})
             ORDER BY note_id, position`,
          )
          .all(...noteIds)
      : db.prepare(`SELECT note_id, path FROM attachments ORDER BY note_id, position`).all()
  ) as { note_id: number; path: string }[]

  const map = new Map<number, string[]>()
  for (const row of rows) {
    const files = map.get(row.note_id) ?? []
    files.push(row.path)
    map.set(row.note_id, files)
  }
  return map
}

// A note belongs to the project of its first attachment, otherwise to the folder it was written from.
export function toNote(row: NoteRow, files: string[]): Note {
  return { ...row, files, project: projectOf(files[0]) ?? projectOfCwd(row.cwd) }
}
