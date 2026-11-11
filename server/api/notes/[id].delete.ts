import { useDb } from '../../utils/db'
import { emitNoteEvent } from '../../utils/events'

export default defineEventHandler((event) => {
  const idParam = getRouterParam(event, 'id')
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'id must be a positive integer' })
  }

  const db = useDb()
  const result = db.prepare(`DELETE FROM notes WHERE id = ?`).run(id)
  if (result.changes === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Note not found' })
  }

  emitNoteEvent({ type: 'note.deleted', id })
  setResponseStatus(event, 204)
  return null
})
