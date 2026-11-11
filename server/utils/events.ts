import { EventEmitter } from 'node:events'
import type { Note } from './project'

export type NoteEvent =
  | { type: 'note.created'; note: Note }
  | { type: 'note.updated'; note: Note }
  | { type: 'note.deleted'; id: number }
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
