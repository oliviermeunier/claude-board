import { isAbsolute, resolve } from 'node:path'
import { homeDir, relativeInside } from './paths'

const MAX_BODY = 1024 * 1024 // 1 Mo
const MAX_TITLE = 500
const MAX_FILES = 20
const MAX_PATH = 4096
const MAX_SESSION_ID = 200
const MAX_CAPTURED = 200

export interface NoteInput {
  title: string | null
  body: string
  files: string[]
  cwd: string | null
  session_id: string | null
  pinned: boolean
}

export interface CapturedNote {
  title: string | null
  body: string
  pinned: boolean
}

export interface CaptureInput {
  cwd: string | null
  session_id: string | null
  notes: CapturedNote[]
}

export class ValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message)
  }
}

export type NotePatch = Partial<Pick<NoteInput, 'title' | 'body' | 'files' | 'pinned'>>

function asObject(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ValidationError('body', 'Payload must be a JSON object')
  }
  return raw as Record<string, unknown>
}

function parseBody(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ValidationError('body', 'body is required (non-empty string)')
  }
  if (value.length > MAX_BODY) {
    throw new ValidationError('body', `body exceeds ${MAX_BODY} bytes`)
  }
  return value
}

function parseTitle(value: unknown): string | null {
  if (value == null) return null
  if (typeof value !== 'string') {
    throw new ValidationError('title', 'title must be a string')
  }
  if (value.length > MAX_TITLE) {
    throw new ValidationError('title', `title exceeds ${MAX_TITLE} chars`)
  }
  return value.trim() || null
}

function parseFiles(rawFiles: unknown[]): string[] {
  if (rawFiles.length > MAX_FILES) {
    throw new ValidationError('files', `at most ${MAX_FILES} files`)
  }

  const files: string[] = []
  for (const file of rawFiles) {
    if (typeof file !== 'string') {
      throw new ValidationError('files', 'each file must be a string')
    }
    if (!isAbsolute(file)) {
      throw new ValidationError('files', 'each file must be an absolute path')
    }
    if (!files.includes(file)) files.push(file)
  }
  return files
}

function parseCwd(value: unknown): string | null {
  if (value == null || value === '') return null
  if (typeof value !== 'string' || !isAbsolute(value) || value.length > MAX_PATH) {
    throw new ValidationError('cwd', 'cwd must be an absolute path')
  }
  return value
}

function parseSessionId(value: unknown): string | null {
  if (value == null || value === '') return null
  if (typeof value !== 'string' || value.length > MAX_SESSION_ID) {
    throw new ValidationError('session_id', `session_id must be a string of at most ${MAX_SESSION_ID} chars`)
  }
  return value
}

function parsePinned(value: unknown): boolean {
  if (value == null) return false
  if (typeof value !== 'boolean') {
    throw new ValidationError('pinned', 'pinned must be a boolean')
  }
  return value
}

function filesArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new ValidationError('files', 'files must be an array of strings')
  }
  return value
}

export function validateNoteInput(raw: unknown): NoteInput {
  const r = asObject(raw)

  // file_path (single file) is still accepted for older clients.
  const rawFiles = r.files != null ? [...filesArray(r.files)] : []
  if (r.file_path != null) rawFiles.unshift(r.file_path)

  return {
    title: parseTitle(r.title),
    body: parseBody(r.body),
    files: parseFiles(rawFiles),
    cwd: parseCwd(r.cwd),
    session_id: parseSessionId(r.session_id),
    pinned: parsePinned(r.pinned),
  }
}

// Notes extracted from a Claude Code transcript by the Stop hook.
export function validateCapture(raw: unknown): CaptureInput {
  const r = asObject(raw)
  if (!Array.isArray(r.notes)) {
    throw new ValidationError('notes', 'notes must be an array')
  }
  if (r.notes.length > MAX_CAPTURED) {
    throw new ValidationError('notes', `at most ${MAX_CAPTURED} notes`)
  }
  const notes = r.notes.map((note) => {
    const n = asObject(note)
    return { title: parseTitle(n.title), body: parseBody(n.body), pinned: parsePinned(n.pinned) }
  })
  return { cwd: parseCwd(r.cwd), session_id: parseSessionId(r.session_id), notes }
}

// Seuls les champs présents dans le payload sont modifiés ; title: null efface le titre.
export function validateNotePatch(raw: unknown): NotePatch {
  const r = asObject(raw)
  const patch: NotePatch = {}

  if ('title' in r) patch.title = parseTitle(r.title)
  if ('body' in r) patch.body = parseBody(r.body)
  if ('files' in r) patch.files = parseFiles(filesArray(r.files))
  if ('pinned' in r) {
    if (typeof r.pinned !== 'boolean') throw new ValidationError('pinned', 'pinned must be a boolean')
    patch.pinned = r.pinned
  }

  if (Object.keys(patch).length === 0) {
    throw new ValidationError('body', 'at least one of title, body, files, pinned is required')
  }
  return patch
}

export function validateOpenPath(raw: unknown): string {
  if (!raw || typeof raw !== 'object') {
    throw new ValidationError('body', 'Payload must be a JSON object')
  }
  const r = raw as Record<string, unknown>
  if (typeof r.path !== 'string' || !r.path) {
    throw new ValidationError('path', 'path is required')
  }
  if (!isAbsolute(r.path)) {
    throw new ValidationError('path', 'path must be absolute')
  }
  // Normalisé avant le contrôle, sinon « $HOME/../.. » passerait.
  const path = resolve(r.path)
  if (!relativeInside(homeDir(), path)) {
    throw new ValidationError('path', 'path must be under the home directory')
  }
  return path
}
