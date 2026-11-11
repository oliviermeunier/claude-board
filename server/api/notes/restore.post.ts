import { useDb, NOTE_COLUMNS, type NoteRow } from '../../utils/db'
import { emitNoteEvent } from '../../utils/events'
import { attachmentsByNote, toNote } from '../../utils/project'

const MAX_IDS = 10_000

// Takes notes out of the trash: { ids: number[] } → { restored: Note[] }.
export default defineEventHandler(async (event) => {
  const raw = (await readBody(event)) as { ids?: unknown } | null
  const ids = raw?.ids
  if (!Array.isArray(ids) || ids.length > MAX_IDS || !ids.every((id) => Number.isInteger(id) && id > 0)) {
    throw createError({ statusCode: 400, statusMessage: 'ids: array of positive integers required' })
  }

  const db = useDb()
  const restore = db.prepare(`UPDATE notes SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL`)
  const restoredIds = db.transaction(() => (ids as number[]).filter((id) => restore.run(id).changes > 0))()

  const select = db.prepare(`SELECT ${NOTE_COLUMNS} FROM notes WHERE id = ?`)
  const files = attachmentsByNote(restoredIds)
  const notes = restoredIds.map((id) => toNote(select.get(id) as NoteRow, files.get(id) ?? []))
  if (notes.length > 0) emitNoteEvent({ type: 'note.restored', notes })
  return { restored: notes }
})
