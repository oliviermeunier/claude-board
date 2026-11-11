import { useDb, NOTE_COLUMNS, type NoteRow } from '../utils/db'
import { emitNoteEvent } from '../utils/events'
import { attachmentsByNote, toNote } from '../utils/project'

// Without a parameter: clears everything. With ?project=X: only that project (empty = notes without project).
// Pinned notes are always kept.
export default defineEventHandler((event) => {
  const { project } = getQuery<{ project?: string }>(event)
  const db = useDb()

  if (project === undefined) {
    db.prepare(`DELETE FROM notes WHERE pinned_at IS NULL`).run()
    emitNoteEvent({ type: 'note.cleared' })
  } else {
    const target = project || null
    const files = attachmentsByNote()
    const ids = (db.prepare(`SELECT ${NOTE_COLUMNS} FROM notes WHERE pinned_at IS NULL`).all() as NoteRow[])
      .filter((row) => toNote(row, files.get(row.id) ?? []).project === target)
      .map((row) => row.id)
    const del = db.prepare(`DELETE FROM notes WHERE id = ?`)
    db.transaction(() => ids.forEach((id) => del.run(id)))()
    emitNoteEvent({ type: 'note.cleared', project: target })
  }

  setResponseStatus(event, 204)
  return null
})
