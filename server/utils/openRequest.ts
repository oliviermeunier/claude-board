import { existsSync } from 'node:fs'
import type { H3Event } from 'h3'
import { validateOpenPath, ValidationError } from './validate'
import { launch, type OpenCommand } from './opener'

export async function handleOpenRequest(event: H3Event, toCommand: (path: string) => OpenCommand) {
  const raw = await readBody(event)

  let path: string
  try {
    path = validateOpenPath(raw)
  } catch (err) {
    if (err instanceof ValidationError) {
      throw createError({ statusCode: 400, statusMessage: `${err.field}: ${err.message}` })
    }
    throw err
  }

  if (!existsSync(path)) {
    throw createError({ statusCode: 404, statusMessage: 'File does not exist' })
  }

  launch(toCommand(path))

  setResponseStatus(event, 204)
  return null
}
