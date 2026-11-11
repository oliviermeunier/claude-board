export interface Note {
  id: number
  title: string | null
  body: string
  created_at: string
  updated_at: string | null
  files: string[]
  project: string | null
  cwd: string | null
  session_id: string | null
  pinned_at: string | null
}

export interface NewNote {
  title?: string | null
  body: string
  files?: string[]
}

// Seuls les champs présents sont modifiés ; title: null efface le titre.
export interface NotePatch {
  title?: string | null
  body?: string
  files?: string[]
  pinned?: boolean
}

export function useNotes() {
  async function list(q?: string): Promise<Note[]> {
    const url = q ? `/api/notes?q=${encodeURIComponent(q)}` : '/api/notes'
    return await $fetch<Note[]>(url)
  }

  async function create(payload: NewNote): Promise<Note> {
    return await $fetch<Note>('/api/notes', {
      method: 'POST',
      body: payload,
    })
  }

  async function update(id: number, payload: NotePatch): Promise<Note> {
    return await $fetch<Note>(`/api/notes/${id}`, {
      method: 'PATCH',
      body: payload,
    })
  }

  async function remove(id: number): Promise<void> {
    await $fetch(`/api/notes/${id}`, { method: 'DELETE' })
  }

  // project null = notes sans projet.
  async function clear(project: string | null): Promise<void> {
    await $fetch('/api/notes', { method: 'DELETE', query: { project: project ?? '' } })
  }

  async function open(path: string): Promise<void> {
    await $fetch('/api/open', {
      method: 'POST',
      body: { path },
    })
  }

  // Ouvre le gestionnaire de fichiers sur le dossier du fichier.
  async function reveal(path: string): Promise<void> {
    await $fetch('/api/reveal', {
      method: 'POST',
      body: { path },
    })
  }

  return { list, create, update, remove, clear, open, reveal }
}
