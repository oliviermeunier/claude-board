import { useDb, NOTE_COLUMNS, type NoteRow } from '../utils/db'
import { attachmentsByNote, toNote, type Note } from '../utils/project'

export default defineEventHandler((event): Note[] => {
  const { q } = getQuery<{ q?: string }>(event)
  const db = useDb()

  let rows: NoteRow[]
  if (q && q.trim()) {
    const like = `%${q.trim()}%`
    rows = db
      .prepare(
        `SELECT ${NOTE_COLUMNS}
         FROM notes
         WHERE COALESCE(title, '') LIKE ? OR body LIKE ?
         ORDER BY created_at DESC, id DESC`,
      )
      .all(like, like) as NoteRow[]
  } else {
    rows = db
      .prepare(
        `SELECT ${NOTE_COLUMNS}
         FROM notes
         ORDER BY created_at DESC, id DESC`,
      )
      .all() as NoteRow[]
  }

  const files = attachmentsByNote()
  return rows.map((row) => toNote(row, files.get(row.id) ?? []))
})
