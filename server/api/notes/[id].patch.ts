import { useDb, NOTE_COLUMNS, type NoteRow } from '../../utils/db'
import { validateNotePatch, ValidationError } from '../../utils/validate'
import { emitNoteEvent } from '../../utils/events'
import { attachmentsByNote, toNote, type Note } from '../../utils/project'

export default defineEventHandler(async (event): Promise<Note> => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'id must be a positive integer' })
  }

  let patch
  try {
    patch = validateNotePatch(await readBody(event))
  } catch (err) {
    if (err instanceof ValidationError) {
      throw createError({ statusCode: 400, statusMessage: `${err.field}: ${err.message}` })
    }
    throw err
  }

  const db = useDb()
  const selectNote = db.prepare(`SELECT ${NOTE_COLUMNS} FROM notes WHERE id = ?`)
  const current = selectNote.get(id) as NoteRow | undefined
  if (!current) {
    throw createError({ statusCode: 404, statusMessage: 'Note not found' })
  }

  db.transaction(() => {
    db.prepare(`UPDATE notes SET title = ?, body = ?, updated_at = ? WHERE id = ?`).run(
      patch.title !== undefined ? patch.title : current.title,
      patch.body ?? current.body,
      new Date().toISOString(),
      id,
    )
    if (patch.files) {
      db.prepare(`DELETE FROM attachments WHERE note_id = ?`).run(id)
      const insertFile = db.prepare(`INSERT INTO attachments (note_id, position, path) VALUES (?, ?, ?)`)
      patch.files.forEach((path, position) => insertFile.run(id, position, path))
    }
  })()

  const note = toNote(selectNote.get(id) as NoteRow, attachmentsByNote([id]).get(id) ?? [])
  emitNoteEvent({ type: 'note.updated', note })
  return note
})
