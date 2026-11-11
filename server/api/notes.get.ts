import { useDb, NOTE_COLUMNS, type NoteRow } from '../utils/db'
import { attachmentsByNote, projectOfCwd, toNote, type Note } from '../utils/project'

// ?q= filters on title and body; ?cwd=<folder> keeps the notes of that folder's project (used by the MCP server).
export default defineEventHandler((event): Note[] => {
  const { q, cwd } = getQuery<{ q?: string; cwd?: string }>(event)
  const db = useDb()

  let rows: NoteRow[]
  if (q && q.trim()) {
    const like = `%${q.trim()}%`
    rows = db
      .prepare(
        `SELECT ${NOTE_COLUMNS}
         FROM notes
         WHERE deleted_at IS NULL AND (COALESCE(title, '') LIKE ? OR body LIKE ?)
         ORDER BY created_at DESC, id DESC`,
      )
      .all(like, like) as NoteRow[]
  } else {
    rows = db
      .prepare(
        `SELECT ${NOTE_COLUMNS}
         FROM notes
         WHERE deleted_at IS NULL
         ORDER BY created_at DESC, id DESC`,
      )
      .all() as NoteRow[]
  }

  const files = attachmentsByNote()
  const notes = rows.map((row) => toNote(row, files.get(row.id) ?? []))
  if (!cwd) return notes
  const project = projectOfCwd(cwd)
  return notes.filter((note) => note.project === project)
})
