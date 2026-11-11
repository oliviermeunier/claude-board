import { ref } from 'vue'
import type { Note } from './useNotes'

// Desktop notification when a note arrives while the board is not on screen.
// The choice is kept in the browser; the permission itself is the browser's.
const STORAGE_KEY = 'board-notifications'

const enabled = ref(false)
const supported = ref(false)

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'on'
  } catch {
    return false
  }
}

function store(on: boolean) {
  try {
    if (on) localStorage.setItem(STORAGE_KEY, 'on')
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage blocked: the choice only lasts for this page */
  }
}

function headline(note: Note): string {
  if (note.title?.trim()) return note.title.trim()
  const firstLine = note.body.split('\n').find((line) => line.trim()) ?? ''
  return firstLine.replace(/^#+\s*/, '').slice(0, 120) || 'Nouvelle note'
}

export function useNotifications() {
  function init() {
    supported.value = typeof window !== 'undefined' && 'Notification' in window
    enabled.value = supported.value && readStored() && Notification.permission === 'granted'
  }

  async function toggle() {
    if (!supported.value) return
    if (enabled.value) {
      enabled.value = false
      store(false)
      return
    }
    const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission
    enabled.value = permission === 'granted'
    store(enabled.value)
  }

  function notify(note: Note) {
    if (!enabled.value || !document.hidden || Notification.permission !== 'granted') return
    const body = note.title ? note.body.replace(/[#*`>_-]/g, '').trim().slice(0, 160) : ''
    const notification = new Notification(headline(note), {
      body: [note.project, body].filter(Boolean).join(' · '),
      icon: '/favicon.svg',
      tag: `note-${note.id}`,
    })
    notification.onclick = () => {
      window.focus()
      notification.close()
    }
  }

  return { enabled, supported, init, toggle, notify }
}
