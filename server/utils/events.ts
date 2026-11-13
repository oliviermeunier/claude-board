import { EventEmitter } from 'node:events'
import type { Note } from './project'

export type NoteEvent =
  | { type: 'note.created'; note: Note }
  | { type: 'note.updated'; note: Note }
  | { type: 'note.deleted'; id: number }
  | { type: 'note.restored'; notes: Note[] }
  // project absent = tout effacé ; null = notes sans projet.
  | { type: 'note.cleared'; project?: string | null }

declare global {
  // eslint-disable-next-line no-var
  var __boardEmitter: EventEmitter | undefined
}

export function useEmitter(): EventEmitter {
  if (!globalThis.__boardEmitter) {
    const emitter = new EventEmitter()
    emitter.setMaxListeners(50)
    globalThis.__boardEmitter = emitter
  }
  return globalThis.__boardEmitter
}

export function emitNoteEvent(event: NoteEvent): void {
  useEmitter().emit('note', event)
}

const streams = new Set<() => void>()

// Registers an open SSE stream; the returned function forgets it once the client has left.
export function trackStream(close: () => void): () => void {
  streams.add(close)
  return () => streams.delete(close)
}

export function closeStreams(): void {
  for (const close of streams) close()
  streams.clear()
}
