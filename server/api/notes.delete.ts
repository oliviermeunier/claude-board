import { useDb, NOTE_COLUMNS, type NoteRow } from '../utils/db'
import { emitNoteEvent } from '../utils/events'
import { attachmentsByNote, toNote } from '../utils/project'

// Without a parameter: clears everything. With ?project=X: only that project (empty = notes without project).
// Pinned notes are always kept. Cleared notes go to the trash; the response lists them so the UI can undo.
export default defineEventHandler((event) => {
  const { project } = getQuery<{ project?: string }>(event)
  const db = useDb()

  const rows = db
    .prepare(`SELECT ${NOTE_COLUMNS} FROM notes WHERE pinned_at IS NULL AND deleted_at IS NULL`)
    .all() as NoteRow[]
  const target = project === undefined ? undefined : project || null
  const files = target === undefined ? null : attachmentsByNote()
  const ids = rows
    .filter((row) => target === undefined || toNote(row, files!.get(row.id) ?? []).project === target)
    .map((row) => row.id)

  const trash = db.prepare(`UPDATE notes SET deleted_at = ? WHERE id = ?`)
  const now = new Date().toISOString()
  db.transaction(() => ids.forEach((id) => trash.run(now, id)))()

  emitNoteEvent(target === undefined ? { type: 'note.cleared' } : { type: 'note.cleared', project: target })
  return { deleted: ids }
})
