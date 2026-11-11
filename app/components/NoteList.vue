<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useNotes, type Note } from '../composables/useNotes'
import { useSSE } from '../composables/useSSE'

const { list, remove, clear, open, reveal } = useNotes()

// Clé d'onglet des notes sans projet (sans fichier, ou fichier hors d'un dossier projet).
const OTHERS = '__autres__'

const allNotes = ref<Note[]>([])
const query = ref('')
const activeTab = ref<string | null>(null)
const unreadIds = ref<Set<number>>(new Set())
const loading = ref(true)
const error = ref<string | null>(null)
const confirmClear = ref(false)

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
const notes = computed(() => (query.value ? tabNotes.value.filter((note) => matchesQuery(note, query.value)) : tabNotes.value))
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
  onCleared: (project) => {
    if (project === undefined) dropNotes(() => false)
    else dropNotes((note) => note.project !== project)
  },
})

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

function matchesQuery(note: Note, q: string): boolean {
  const needle = q.toLowerCase()
  return (note.title?.toLowerCase().includes(needle) ?? false) || note.body.toLowerCase().includes(needle)
}

async function onDelete(id: number) {
  await remove(id)
  dropNotes((note) => note.id !== id)
}

async function onClear() {
  confirmClear.value = false
  const project = activeTab.value === OTHERS ? null : activeTab.value
  try {
    await clear(project)
    dropNotes((note) => note.project !== project)
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

    <div v-if="notes.length > 0 && !query" class="toolbar">
      <button v-if="!confirmClear" type="button" class="danger" @click="confirmClear = true">
        Tout effacer
      </button>
      <template v-else>
        <span class="confirm">Effacer les {{ notes.length }} notes de « {{ activeLabel }} »&nbsp;?</span>
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

    <template v-for="(note, index) in notes" :key="note.id">
      <div v-if="index === 0 || dayKey(note) !== dayKey(notes[index - 1]!)" class="day-separator">
        <span>{{ dayLabel(note) }}</span>
      </div>
      <NoteCard
        :note="note"
        :unread="unreadIds.has(note.id)"
        @delete="onDelete"
        @updated="replaceNote"
        @open="onOpen"
        @reveal="onReveal"
      />
    </template>
  </div>
</template>

<style scoped>
.dim { color: var(--text-dim); }
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
