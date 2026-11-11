import { validateNoteInput, ValidationError } from '../utils/validate'
import { createNote } from '../utils/notes'
import type { Note } from '../utils/project'

export default defineEventHandler(async (event): Promise<Note> => {
  let input
  try {
    input = validateNoteInput(await readBody(event))
  } catch (err) {
    if (err instanceof ValidationError) {
      throw createError({ statusCode: 400, statusMessage: `${err.field}: ${err.message}` })
    }
    throw err
  }

  const note = createNote(input)
  setResponseStatus(event, 201)
  return note
})
