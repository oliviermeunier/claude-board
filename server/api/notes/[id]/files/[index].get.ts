import { createReadStream, existsSync, statSync } from 'node:fs'
import { basename, extname } from 'node:path'
import { useDb } from '../../../../utils/db'

const CONTENT_TYPES: Record<string, string> = {
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
  '.json': 'application/json',
  '.html': 'text/html; charset=utf-8',
}

// Only serves a file attached to an existing note, never an arbitrary path.
export default defineEventHandler((event) => {
  const id = Number(getRouterParam(event, 'id'))
  const index = Number(getRouterParam(event, 'index'))
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(index) || index < 0) {
    throw createError({ statusCode: 400, statusMessage: 'id and index must be integers' })
  }

  const attachment = useDb()
    .prepare(`SELECT path FROM attachments WHERE note_id = ? ORDER BY position LIMIT 1 OFFSET ?`)
    .get(id, index) as { path: string } | undefined
  if (!attachment) throw createError({ statusCode: 404, statusMessage: 'Attachment not found' })
  if (!existsSync(attachment.path) || !statSync(attachment.path).isFile()) {
    throw createError({ statusCode: 404, statusMessage: 'File does not exist' })
  }

  const name = basename(attachment.path)
  setHeader(event, 'Content-Type', CONTENT_TYPES[extname(name).toLowerCase()] ?? 'application/octet-stream')
  setHeader(event, 'Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(name)}`)
  return sendStream(event, createReadStream(attachment.path))
})
