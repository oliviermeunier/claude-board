import { validateCapture, ValidationError } from '../utils/validate'
import { captureNotes } from '../utils/notes'

// Called by the Claude Code Stop hook with every <note> block of the transcript; idempotent.
export default defineEventHandler(async (event) => {
  let input
  try {
    input = validateCapture(await readBody(event))
  } catch (err) {
    if (err instanceof ValidationError) {
      throw createError({ statusCode: 400, statusMessage: `${err.field}: ${err.message}` })
    }
    throw err
  }

  const { created, skipped } = captureNotes(input)
  return { created: created.map((note) => note.id), skipped }
})
