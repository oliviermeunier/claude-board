import type { Note } from './useNotes'

export type NoteEvent =
  | { type: 'note.created'; note: Note }
  | { type: 'note.updated'; note: Note }
  | { type: 'note.deleted'; id: number }
  | { type: 'note.restored'; notes: Note[] }
  | { type: 'note.cleared'; project?: string | null }

export interface SSEHandlers {
  onCreated?: (note: Note) => void
  onUpdated?: (note: Note) => void
  onDeleted?: (id: number) => void
  onRestored?: (notes: Note[]) => void
  // project undefined = tout effacé.
  onCleared?: (project: string | null | undefined) => void
}

export function useSSE(handlers: SSEHandlers) {
  let source: EventSource | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let stopped = false

  function connect() {
    if (stopped) return
    source = new EventSource('/api/stream')

    source.addEventListener('note.created', (msg) => {
      const data = JSON.parse((msg as MessageEvent).data) as Extract<NoteEvent, { type: 'note.created' }>
      handlers.onCreated?.(data.note)
    })

    source.addEventListener('note.updated', (msg) => {
      const data = JSON.parse((msg as MessageEvent).data) as Extract<NoteEvent, { type: 'note.updated' }>
      handlers.onUpdated?.(data.note)
    })

    source.addEventListener('note.deleted', (msg) => {
      const data = JSON.parse((msg as MessageEvent).data) as Extract<NoteEvent, { type: 'note.deleted' }>
      handlers.onDeleted?.(data.id)
    })

    source.addEventListener('note.restored', (msg) => {
      const data = JSON.parse((msg as MessageEvent).data) as Extract<NoteEvent, { type: 'note.restored' }>
      handlers.onRestored?.(data.notes)
    })

    source.addEventListener('note.cleared', (msg) => {
      const data = JSON.parse((msg as MessageEvent).data) as Extract<NoteEvent, { type: 'note.cleared' }>
      handlers.onCleared?.(data.project)
    })

    source.addEventListener('error', () => {
      source?.close()
      source = null
      if (!stopped) {
        retryTimer = setTimeout(connect, 2000)
      }
    })
  }

  function stop() {
    stopped = true
    if (retryTimer) clearTimeout(retryTimer)
    source?.close()
    source = null
  }

  return { connect, stop }
}
