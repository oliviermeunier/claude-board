import { createHash } from 'node:crypto'
import { useDb, NOTE_COLUMNS, type NoteRow } from './db'
import { emitNoteEvent } from './events'
import { toNote, type Note } from './project'
import type { CaptureInput, NoteInput } from './validate'

export function createNote(input: NoteInput): Note {
  const db = useDb()
  const insertNote = db.prepare(
    `INSERT INTO notes (title, body, created_at, cwd, session_id) VALUES (?, ?, ?, ?, ?)`,
  )
  const insertFile = db.prepare(`INSERT INTO attachments (note_id, position, path) VALUES (?, ?, ?)`)

  const id = db.transaction(() => {
    const noteId = insertNote.run(input.title, input.body, new Date().toISOString(), input.cwd, input.session_id)
      .lastInsertRowid
    input.files.forEach((path, position) => insertFile.run(noteId, position, path))
    return noteId
  })()

  const row = db.prepare(`SELECT ${NOTE_COLUMNS} FROM notes WHERE id = ?`).get(id) as NoteRow
  const note = toNote(row, input.files)
  emitNoteEvent({ type: 'note.created', note })
  return note
}

// Same title and body = same note, whatever the session: a resumed or forked session
// replays its transcript, and its notes must not show up twice.
export function captureSignature(note: { title: string | null; body: string }): string {
  return createHash('sha256').update(`${note.title ?? ''}\x1f${note.body}`).digest('hex')
}

// Creates the notes never captured before. Already captured ones are skipped, even if deleted since.
export function captureNotes(input: CaptureInput): { created: Note[]; skipped: number } {
  const db = useDb()
  const claim = db.prepare(`INSERT OR IGNORE INTO captures (signature, captured_at) VALUES (?, ?)`)
  const link = db.prepare(`UPDATE captures SET note_id = ? WHERE signature = ?`)

  // One transaction per note: a failed insert must not leave its signature claimed.
  const captureOne = db.transaction((candidate: CaptureInput['notes'][number]): Note | null => {
    const signature = captureSignature(candidate)
    if (claim.run(signature, new Date().toISOString()).changes === 0) return null
    const note = createNote({ ...candidate, files: [], cwd: input.cwd, session_id: input.session_id })
    link.run(note.id, signature)
    return note
  })

  const created: Note[] = []
  let skipped = 0
  for (const candidate of input.notes) {
    const note = captureOne(candidate)
    if (note) created.push(note)
    else skipped++
  }
  return { created, skipped }
}
