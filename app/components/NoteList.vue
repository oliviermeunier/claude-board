<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useNotes, type Note } from '../composables/useNotes'
import { useSSE } from '../composables/useSSE'

const { list, remove, clear, restore, open, reveal } = useNotes()

// How long the « Annuler » bar stays after a deletion.
const UNDO_MS = 8000

// Clé d'onglet des notes sans projet (sans fichier, ou fichier hors d'un dossier projet).
const OTHERS = '__autres__'

const allNotes = ref<Note[]>([])
const query = ref('')
const activeTab = ref<string | null>(null)
const unreadIds = ref<Set<number>>(new Set())
const loading = ref(true)
const error = ref<string | null>(null)
const confirmClear = ref(false)
const undo = ref<{ message: string; ids: number[] } | null>(null)
let undoTimer: ReturnType<typeof setTimeout> | null = null

function tabOf(note: Note): string {
  return note.project ?? OTHERS
}

const tabs = computed(() => {
  const counts = new Map<string, { count: number; unread: number }>()
  for (const note of allNotes.value) {
    const entry = counts.get(tabOf(note)) ?? { count: 0, unread: 0 }
    entry.count++
    if (unreadIds.value.has(note.id)) entry.unread++
    counts.set(tabOf(note), entry)
  }
  const keys = [...counts.keys()].filter((key) => key !== OTHERS).sort((a, b) => a.localeCompare(b, 'fr'))
  if (counts.has(OTHERS)) keys.push(OTHERS)
  return keys.map((key) => ({ key, label: key === OTHERS ? 'Autres' : key, ...counts.get(key)! }))
})

const tabNotes = computed(() => allNotes.value.filter((note) => tabOf(note) === activeTab.value))
// A search looks through every project, not only the open tab.
const notes = computed(() => (query.value ? allNotes.value.filter((note) => matchesQuery(note, query.value)) : tabNotes.value))
// Pinned notes are listed first, without day separators; « Tout effacer » leaves them alone.
const pinnedNotes = computed(() => notes.value.filter((note) => note.pinned_at))
const otherNotes = computed(() => notes.value.filter((note) => !note.pinned_at))
const activeLabel = computed(() => tabs.value.find((tab) => tab.key === activeTab.value)?.label ?? '')
const activeUnread = computed(() => tabNotes.value.filter((note) => unreadIds.value.has(note.id)).length)

// Retombe sur l'onglet de la note la plus récente quand l'onglet courant n'existe pas ou plus.
function ensureActiveTab() {
  if (activeTab.value && tabs.value.some((tab) => tab.key === activeTab.value)) return
  activeTab.value = allNotes.value[0] ? tabOf(allNotes.value[0]) : null
}

async function reload() {
  try {
    allNotes.value = await list()
    error.value = null
    ensureActiveTab()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

function updateTitle() {
  document.title = unreadIds.value.size > 0 ? `(${unreadIds.value.size}) Claude Board` : 'Claude Board'
}

function setUnread(next: Set<number>) {
  unreadIds.value = next
  updateTitle()
}

function markActiveTabRead() {
  const ids = new Set(tabNotes.value.map((note) => note.id))
  if (![...unreadIds.value].some((id) => ids.has(id))) return
  setUnread(new Set([...unreadIds.value].filter((id) => !ids.has(id))))
}

function selectTab(key: string) {
  activeTab.value = key
  confirmClear.value = false
  markActiveTabRead()
}

function dropNotes(keep: (note: Note) => boolean) {
  const removed = allNotes.value.filter((note) => !keep(note)).map((note) => note.id)
  allNotes.value = allNotes.value.filter(keep)
  if (removed.some((id) => unreadIds.value.has(id))) {
    setUnread(new Set([...unreadIds.value].filter((id) => !removed.includes(id))))
  }
  ensureActiveTab()
}

const sse = useSSE({
  onCreated: (note) => {
    allNotes.value = [note, ...allNotes.value.filter((n) => n.id !== note.id)]
    ensureActiveTab()
    if (document.hidden || tabOf(note) !== activeTab.value) {
      setUnread(new Set([...unreadIds.value, note.id]))
    }
  },
  onUpdated: (note) => {
    if (!replaceNote(note)) return
    if (document.hidden || tabOf(note) !== activeTab.value) {
      setUnread(new Set([...unreadIds.value, note.id]))
    }
  },
  onDeleted: (id) => dropNotes((note) => note.id !== id),
  onRestored: (notes) => mergeNotes(notes),
  onCleared: (project) => {
    if (project === undefined) dropNotes((note) => Boolean(note.pinned_at))
    else dropNotes((note) => note.project !== project || Boolean(note.pinned_at))
  },
})

// Ajoute des notes (restaurées) à leur place chronologique.
function mergeNotes(notes: Note[]) {
  const ids = new Set(notes.map((note) => note.id))
  allNotes.value = [...allNotes.value.filter((note) => !ids.has(note.id)), ...notes].sort(
    (a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id,
  )
  ensureActiveTab()
}

function offerUndo(message: string, ids: number[]) {
  if (ids.length === 0) return
  if (undoTimer) clearTimeout(undoTimer)
  undo.value = { message, ids }
  undoTimer = setTimeout(() => (undo.value = null), UNDO_MS)
}

async function onUndo() {
  if (!undo.value) return
  const { ids } = undo.value
  undo.value = null
  if (undoTimer) clearTimeout(undoTimer)
  try {
    mergeNotes(await restore(ids))
  } catch (e) {
    error.value = `Erreur de restauration : ${(e as Error).message}`
  }
}

// Remplace la note sur place, sans changer son rang : la liste reste triée par date de création.
function replaceNote(updated: Note): boolean {
  const index = allNotes.value.findIndex((note) => note.id === updated.id)
  if (index === -1) return false
  allNotes.value = allNotes.value.map((note) => (note.id === updated.id ? updated : note))
  ensureActiveTab()
  return true
}

// Local calendar day, so the separators follow the viewer's timezone.
function dayKey(note: Note): string {
  const d = new Date(note.created_at)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function dayLabel(note: Note): string {
  const d = new Date(note.created_at)
  const today = new Date()
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  if (dayKey(note) === dayKey({ created_at: today.toISOString() } as Note)) return "Aujourd'hui"
  if (dayKey(note) === dayKey({ created_at: yesterday.toISOString() } as Note)) return 'Hier'
  const label = d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function projectLabel(note: Note): string {
  return note.project ?? 'Autres'
}

function matchesQuery(note: Note, q: string): boolean {
  const needle = q.toLowerCase()
  return (note.title?.toLowerCase().includes(needle) ?? false) || note.body.toLowerCase().includes(needle)
}

async function onDelete(id: number) {
  try {
    await remove(id)
  } catch (e) {
    error.value = `Erreur de suppression : ${(e as Error).message}`
    return
  }
  dropNotes((note) => note.id !== id)
  offerUndo('Note supprimée', [id])
}

async function onClear() {
  confirmClear.value = false
  const project = activeTab.value === OTHERS ? null : activeTab.value
  try {
    const ids = await clear(project)
    dropNotes((note) => note.project !== project || Boolean(note.pinned_at))
    offerUndo(`${ids.length} note${ids.length > 1 ? 's' : ''} effacée${ids.length > 1 ? 's' : ''}`, ids)
  } catch (e) {
    error.value = `Erreur effacement: ${(e as Error).message}`
  }
}

async function onOpen(path: string) {
  try {
    await open(path)
  } catch (e) {
    error.value = `Erreur ouverture: ${(e as Error).message}`
  }
}

async function onReveal(path: string) {
  try {
    await reveal(path)
  } catch (e) {
    error.value = `Erreur ouverture du dossier: ${(e as Error).message}`
  }
}

function onVisibility() {
  if (!document.hidden) markActiveTabRead()
}

onMounted(() => {
  reload()
  sse.connect()
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('focus', markActiveTabRead)
})

onBeforeUnmount(() => {
  sse.stop()
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('focus', markActiveTabRead)
})
</script>

<template>
  <div class="note-list">
    <div class="topbar">
      <nav class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          class="tab"
          :class="{ active: tab.key === activeTab }"
          @click="selectTab(tab.key)"
        >
          {{ tab.label }}
          <span class="count">{{ tab.count }}</span>
          <span v-if="tab.unread > 0" class="badge">{{ tab.unread }}</span>
        </button>
      </nav>
      <div class="settings">
        <TextSizeToggle />
        <ThemeToggle />
      </div>
    </div>

    <SearchBar v-model="query" />

    <div v-if="otherNotes.length > 0 && !query" class="toolbar">
      <button v-if="!confirmClear" type="button" class="danger" @click="confirmClear = true">
        Tout effacer
      </button>
      <template v-else>
        <span class="confirm">
          Effacer les {{ otherNotes.length }} notes de « {{ activeLabel }} »<template v-if="pinnedNotes.length > 0"> (les épinglées sont gardées)</template>&nbsp;?
        </span>
        <button type="button" class="danger" @click="onClear">Oui</button>
        <button type="button" @click="confirmClear = false">Non</button>
      </template>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="activeUnread > 0" class="unread-banner" @click="markActiveTabRead">
      {{ activeUnread }} nouvelle{{ activeUnread > 1 ? 's' : '' }} note{{ activeUnread > 1 ? 's' : '' }} — cliquer pour marquer comme lu
    </div>

    <p v-if="loading" class="dim">Chargement…</p>
    <div v-else-if="allNotes.length === 0" class="dim empty">
      <p class="empty-title">Aucune note pour le moment.</p>
      <p>Dans Claude Code, demande une note : Claude l'écrit entre <code>&lt;note&gt;</code> et <code>&lt;/note&gt;</code>, elle arrive ici.</p>
      <p>Depuis un terminal : <code>board-note "Titre" &lt;&lt;&lt; "corps en markdown"</code></p>
    </div>
    <p v-else-if="notes.length === 0" class="dim empty">Aucun résultat pour « {{ query }} ».</p>
    <p v-else-if="query" class="search-summary">
      {{ notes.length }} résultat{{ notes.length > 1 ? 's' : '' }} dans tous les projets
    </p>

    <template v-if="pinnedNotes.length > 0">
      <div class="day-separator pinned-separator"><span>Épinglées</span></div>
      <NoteCard
        v-for="note in pinnedNotes"
        :key="note.id"
        :note="note"
        :unread="unreadIds.has(note.id)"
        :project-label="query ? projectLabel(note) : null"
        @delete="onDelete"
        @updated="replaceNote"
        @open="onOpen"
        @reveal="onReveal"
      />
    </template>

    <template v-for="(note, index) in otherNotes" :key="note.id">
      <div v-if="index === 0 || dayKey(note) !== dayKey(otherNotes[index - 1]!)" class="day-separator">
        <span>{{ dayLabel(note) }}</span>
      </div>
      <NoteCard
        :note="note"
        :unread="unreadIds.has(note.id)"
        :project-label="query ? projectLabel(note) : null"
        @delete="onDelete"
        @updated="replaceNote"
        @open="onOpen"
        @reveal="onReveal"
      />
    </template>

    <div v-if="undo" class="undo-bar" role="status">
      <span>{{ undo.message }}</span>
      <button type="button" class="undo-btn" @click="onUndo">Annuler</button>
    </div>
  </div>
</template>

<style scoped>
.dim { color: var(--text-dim); }
.undo-bar {
  position: fixed;
  left: 50%;
  bottom: 1.5rem;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.6rem 0.75rem 0.6rem 1.1rem;
  background: var(--text);
  color: var(--bg);
  border-radius: 999px;
  box-shadow: var(--shadow);
  font-size: 0.9375rem;
  z-index: 10;
}
.undo-btn {
  background: transparent;
  border: none;
  color: var(--primary-on-inverse, var(--primary));
  font-weight: 700;
  padding: 0.2rem 0.6rem;
}
.undo-btn:hover {
  background: rgba(127, 127, 127, 0.2);
}
.day-separator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 1.5rem 0 0.75rem;
  color: var(--text-dim);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.search-summary {
  margin: 0 0 0.75rem;
  color: var(--text-dim);
  font-size: 0.875rem;
}
.pinned-separator {
  color: var(--primary);
}
.day-separator::before,
.day-separator::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}
.day-separator:first-of-type {
  margin-top: 4px;
}
.topbar {
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 16px;
}
.tabs {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 4px;
  min-width: 0;
}
.tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  padding: 0.6rem 1rem;
  margin-bottom: -1px;
  font-size: 1rem;
  color: var(--text-dim);
}
.tab:hover { background: var(--bg-elev-2); color: var(--text); }
.tab.active {
  color: var(--text);
  border-bottom-color: var(--primary);
  font-weight: 600;
}
.tab.active .count {
  color: var(--primary);
  background: var(--primary-soft);
}
.count {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-dim);
  background: var(--bg-elev-2);
  border-radius: 999px;
  padding: 0 0.45rem;
  line-height: 1.4rem;
}
.badge {
  background: var(--highlight);
  color: var(--on-highlight);
  border-radius: 999px;
  padding: 0 7px;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 18px;
}
.toolbar {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.confirm {
  color: var(--text-dim);
  font-size: 0.875rem;
}
.empty { text-align: center; padding: 3rem 1.25rem; line-height: 1.7; }
.empty p { margin: 0.4rem 0; }
.empty-title { font-size: 1.125rem; color: var(--text); font-weight: 600; }
.settings { display: flex; gap: 0.5rem; flex-shrink: 0; }
.empty code {
  background: var(--bg-elev-2);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.95em;
}
.error {
  background: var(--danger-soft);
  border: 1px solid var(--danger);
  color: var(--danger);
  padding: 10px 14px;
  border-radius: var(--radius);
  margin-bottom: 12px;
}
.unread-banner {
  background: var(--highlight-soft);
  border: 1px solid var(--highlight-border);
  color: var(--highlight-text);
  font-weight: 600;
  border-radius: var(--radius);
  padding: 8px 14px;
  margin-bottom: 10px;
  cursor: pointer;
  text-align: center;
  font-size: 0.875rem;
}
.unread-banner:hover {
  border-color: var(--highlight);
}
</style>
