<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useNotes, type Note } from '../composables/useNotes'

const props = defineProps<{ note: Note; unread: boolean }>()
const emit = defineEmits<{
  delete: [id: number]
  open: [path: string]
  reveal: [path: string]
  updated: [note: Note]
}>()

const { update } = useNotes()

const expanded = ref(false)
const copyState = ref<'idle' | 'copied'>('idle')

const editing = ref(false)
const saving = ref(false)
const editError = ref<string | null>(null)
const draftTitle = ref('')
const draftBody = ref('')
const bodyInput = ref<HTMLTextAreaElement | null>(null)

const headline = computed(() => {
  if (props.note.title?.trim()) return props.note.title.trim()
  const firstLine = props.note.body.split('\n').find((l) => l.trim()) ?? ''
  return firstLine.replace(/^#+\s*/, '').slice(0, 120) || '(sans titre)'
})

const relativeDate = computed(() => {
  const d = new Date(props.note.created_at)
  const diff = Date.now() - d.getTime()
  const sec = Math.round(diff / 1000)
  if (sec < 60) return `il y a ${sec}s`
  const min = Math.round(sec / 60)
  if (min < 60) return `il y a ${min}min`
  const hour = Math.round(min / 60)
  if (hour < 24) return `il y a ${hour}h`
  const day = Math.round(hour / 24)
  if (day < 30) return `il y a ${day}j`
  return d.toLocaleDateString('fr-FR')
})

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

function downloadUrl(index: number): string {
  return `/api/notes/${props.note.id}/files/${index}`
}

const filesLabel = computed(() => {
  const count = props.note.files.length
  return `${count} fichier${count > 1 ? 's' : ''} joint${count > 1 ? 's' : ''}`
})

const absoluteDate = computed(() => {
  const lines = [new Date(props.note.created_at).toLocaleString('fr-FR')]
  if (props.note.updated_at) lines.push(`modifiée le ${new Date(props.note.updated_at).toLocaleString('fr-FR')}`)
  if (props.note.cwd) lines.push(`depuis ${props.note.cwd}`)
  return lines.join('\n')
})

async function copyBody() {
  try {
    await navigator.clipboard.writeText(props.note.body)
    copyState.value = 'copied'
    setTimeout(() => (copyState.value = 'idle'), 1200)
  } catch {
    /* clipboard blocked */
  }
}

// One click: the note goes to the trash, and the board offers to undo.
function onDeleteClick() {
  emit('delete', props.note.id)
}

function toggle() {
  // Replier pendant la modification ferait perdre le brouillon.
  if (editing.value) return
  expanded.value = !expanded.value
}

async function startEdit() {
  draftTitle.value = props.note.title ?? ''
  draftBody.value = props.note.body
  editError.value = null
  editing.value = true
  expanded.value = true
  await nextTick()
  bodyInput.value?.focus()
}

function cancelEdit() {
  editing.value = false
  editError.value = null
}

async function saveEdit() {
  if (saving.value) return
  if (!draftBody.value.trim()) {
    editError.value = 'Le contenu ne peut pas être vide.'
    return
  }
  saving.value = true
  try {
    const note = await update(props.note.id, { title: draftTitle.value.trim() || null, body: draftBody.value })
    emit('updated', note)
    editing.value = false
    editError.value = null
  } catch (e) {
    editError.value = `Erreur d'enregistrement : ${(e as Error).message}`
  } finally {
    saving.value = false
  }
}

const pinning = ref(false)

async function togglePin() {
  if (pinning.value) return
  pinning.value = true
  try {
    emit('updated', await update(props.note.id, { pinned: !props.note.pinned_at }))
  } finally {
    pinning.value = false
  }
}

defineExpose({ togglePin })

</script>

<template>
  <article class="card" :class="{ expanded, unread, pinned: note.pinned_at }">
    <header class="head" @click="toggle">
      <span class="badge" v-if="unread" title="Nouveau">●</span>
      <span class="headline">{{ headline }}</span>
      <span v-if="note.files.length > 0" class="files-count" :title="filesLabel" :aria-label="filesLabel">
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
          <path
            d="M13.5 7.5 8.1 12.9a3.25 3.25 0 0 1-4.6-4.6l5.6-5.6a2.17 2.17 0 0 1 3.07 3.07l-5.6 5.6a1.08 1.08 0 0 1-1.53-1.53L10 4.9"
            fill="none"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        {{ note.files.length }}
      </span>
      <span class="date" :title="absoluteDate">
        {{ relativeDate }}<span v-if="note.updated_at" class="edited"> · modifiée</span>
      </span>
      <button
        type="button"
        class="pin-btn"
        :class="{ active: note.pinned_at }"
        :title="note.pinned_at ? 'Désépingler' : 'Épingler : en haut de l’onglet, épargnée par « Tout effacer »'"
        :aria-label="note.pinned_at ? 'Désépingler la note' : 'Épingler la note'"
        :aria-pressed="Boolean(note.pinned_at)"
        @click.stop="togglePin"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path
            d="M9.8 1.9 14.1 6.2 11.6 7.4 9.3 9.7 9.6 12.6 8.3 13.9 5.7 11.3 2.4 14.6 M5.7 11.3 2.1 7.7 3.4 6.4 6.3 6.7 8.6 4.4Z"
            :fill="note.pinned_at ? 'currentColor' : 'none'"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <button
        type="button"
        class="edit-btn"
        :class="{ active: editing }"
        title="Modifier la note"
        aria-label="Modifier la note"
        @click.stop="startEdit"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path
            d="M11.2 2.3a1.6 1.6 0 0 1 2.3 2.3L5.6 12.5 2.5 13.5l1-3.1 7.7-8.1Z M9.8 3.8l2.4 2.4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <button
        type="button"
        class="copy-btn"
        :class="{ copied: copyState === 'copied' }"
        :title="copyState === 'copied' ? 'Copié' : 'Copier le markdown de la note'"
        :aria-label="copyState === 'copied' ? 'Copié' : 'Copier le markdown de la note'"
        @click.stop="copyBody"
      >
        <svg v-if="copyState === 'copied'" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <svg v-else viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3" />
          <path d="M10.5 5.5V4a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" fill="none" stroke="currentColor" stroke-width="1.3" />
        </svg>
      </button>
      <button
        type="button"
        class="delete-btn"
        title="Supprimer (annulable)"
        aria-label="Supprimer la note"
        @click.stop="onDeleteClick"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path
            d="M6 2h4M2.5 4h11M4 4l.7 9.1c.05.5.47.9.98.9h4.64c.51 0 .93-.4.98-.9L12 4M6.5 6.5v5M9.5 6.5v5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </header>
    <section v-if="expanded" class="body-wrap">
      <ul v-if="note.files.length > 0" class="attachments">
        <li v-for="(path, index) in note.files" :key="path" class="attachment">
          <a class="file-btn" :href="downloadUrl(index)" download :title="`Télécharger ${path}`">
            <svg class="file-icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path
                d="M9 1.75H4.5c-.69 0-1.25.56-1.25 1.25v10c0 .69.56 1.25 1.25 1.25h7c.69 0 1.25-.56 1.25-1.25V5.5L9 1.75Z M9 1.75V5.5h3.75"
                fill="none"
                stroke="currentColor"
                stroke-width="1.2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span class="file-name">{{ fileName(path) }}</span>
            <svg class="download-icon" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
              <path
                d="M8 2.5v8 M4.5 7 8 10.5 11.5 7 M3 13.5h10"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </a>
          <button
            type="button"
            class="icon-btn"
            title="Ouvrir dans l'éditeur"
            aria-label="Ouvrir dans l'éditeur"
            @click="emit('open', path)"
          >
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
              <path
                d="M6.5 3.5h-3v9h9v-3 M9.5 2.5h4v4 M13.5 2.5 7.5 8.5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.4"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
          <button
            type="button"
            class="icon-btn"
            title="Afficher dans le dossier"
            aria-label="Afficher dans le dossier"
            @click="emit('reveal', path)"
          >
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
              <path
                d="M1.75 4.25c0-.69.56-1.25 1.25-1.25h3l1.5 1.75H13c.69 0 1.25.56 1.25 1.25v6c0 .69-.56 1.25-1.25 1.25H3c-.69 0-1.25-.56-1.25-1.25v-7.75Z"
                fill="none"
                stroke="currentColor"
                stroke-width="1.4"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </li>
      </ul>
      <form
        v-if="editing"
        class="edit-form"
        @submit.prevent="saveEdit"
        @keydown.esc.prevent="cancelEdit"
        @keydown.ctrl.enter.prevent="saveEdit"
        @keydown.meta.enter.prevent="saveEdit"
      >
        <input v-model="draftTitle" class="edit-title" type="text" placeholder="Titre (facultatif)" maxlength="500" />
        <textarea ref="bodyInput" v-model="draftBody" class="edit-body" spellcheck="false" />
        <p v-if="editError" class="edit-error">{{ editError }}</p>
        <div class="edit-actions">
          <span class="edit-hint">Ctrl+Entrée pour enregistrer · Échap pour annuler</span>
          <button type="button" :disabled="saving" @click="cancelEdit">Annuler</button>
          <button type="submit" class="primary" :disabled="saving">{{ saving ? 'Enregistrement…' : 'Enregistrer' }}</button>
        </div>
      </form>
      <NoteBody v-else :source="note.body" :note-id="note.id" />
    </section>
  </article>
</template>

<style scoped>
.card {
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  margin-bottom: 0.75rem;
  overflow: hidden;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.card.expanded {
  box-shadow: var(--shadow);
}
/* New notes: amber edge on the left, the board's "something arrived" colour. */
.card.pinned {
  box-shadow: inset 3px 0 0 var(--primary);
}
.card.pinned.expanded {
  box-shadow: inset 3px 0 0 var(--primary), var(--shadow);
}
.pin-btn {
  display: inline-flex;
  align-items: center;
  padding: 3px 5px;
  background: transparent;
  border-color: transparent;
  color: var(--text-dim);
  opacity: 0;
}
.head:hover .pin-btn,
.pin-btn:focus-visible,
.pin-btn.active {
  opacity: 1;
}
.pin-btn:hover {
  color: var(--text);
  background: var(--bg-elev-2);
}
.pin-btn.active {
  color: var(--primary);
}
.card.unread {
  border-color: var(--highlight-border);
  box-shadow: inset 3px 0 0 var(--highlight);
}
.head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1.1rem;
  cursor: pointer;
  user-select: none;
}
.head:hover {
  background: var(--bg-elev-2);
}
.badge {
  color: var(--highlight);
  font-size: 0.8125rem;
  line-height: 1;
}
.headline {
  flex: 1;
  font-size: 1.0625rem;
  font-weight: 600;
  letter-spacing: -0.005em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.date {
  color: var(--text-dim);
  font-size: 0.8125rem;
  white-space: nowrap;
}
.files-count {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--text-dim);
  font-size: 0.8125rem;
  white-space: nowrap;
}
.attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  list-style: none;
  margin: 10px 0 4px;
  padding: 0 0 10px;
  border-bottom: 1px dashed var(--border);
}
.attachment {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}
.file-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 20rem;
  padding: 0.25rem 0.75rem 0.25rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg-elev-2);
  color: var(--primary);
  font-size: 0.8125rem;
  font-family: 'Cascadia Code', 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  text-decoration: none;
  transition: background 0.1s, border-color 0.1s;
}
.file-btn:hover {
  background: var(--bg-elev);
  border-color: var(--primary);
}
.file-icon,
.download-icon {
  flex-shrink: 0;
}
.download-icon {
  opacity: 0.7;
}
.file-btn:hover .download-icon {
  opacity: 1;
}
.file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.icon-btn {
  display: inline-flex;
  align-items: center;
  padding: 4px 5px;
  background: transparent;
  border-color: transparent;
  color: var(--text-dim);
}
.icon-btn:hover {
  color: var(--primary);
  background: var(--bg-elev-2);
}
.copy-btn {
  display: inline-flex;
  align-items: center;
  padding: 3px 5px;
  background: transparent;
  border-color: transparent;
  color: var(--text-dim);
  opacity: 0;
}
.head:hover .copy-btn,
.copy-btn:focus-visible,
.copy-btn.copied {
  opacity: 1;
}
.copy-btn:hover {
  color: var(--text);
  background: var(--bg-elev-2);
}
.copy-btn.copied {
  color: var(--primary);
}
.edit-btn {
  display: inline-flex;
  align-items: center;
  padding: 3px 5px;
  background: transparent;
  border-color: transparent;
  color: var(--text-dim);
  opacity: 0;
}
.head:hover .edit-btn,
.edit-btn:focus-visible,
.edit-btn.active {
  opacity: 1;
}
.edit-btn:hover {
  color: var(--text);
  background: var(--bg-elev-2);
}
.edit-btn.active {
  color: var(--primary);
}
.edited {
  font-style: italic;
}
.edit-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 12px;
}
.edit-title,
.edit-body {
  width: 100%;
  font: inherit;
  color: var(--text);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 10px;
}
.edit-title:focus,
.edit-body:focus {
  outline: none;
  border-color: var(--primary);
}
.edit-body {
  min-height: 320px;
  resize: vertical;
  font-family: 'Cascadia Code', 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.875rem;
  line-height: 1.5;
}
.edit-error {
  margin: 0;
  color: var(--danger);
  font-size: 0.875rem;
}
.edit-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}
.edit-hint {
  flex: 1;
  color: var(--text-dim);
  font-size: 0.8125rem;
}
.edit-actions .primary {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--on-primary);
  font-weight: 600;
}
.edit-actions button:disabled {
  opacity: 0.6;
  cursor: default;
}
.delete-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 5px;
  background: transparent;
  border-color: transparent;
  color: var(--text-dim);
  opacity: 0;
  white-space: nowrap;
}
.head:hover .delete-btn,
.delete-btn:focus-visible {
  opacity: 1;
}
.delete-btn:hover {
  color: var(--danger);
  background: var(--bg-elev-2);
}
.body-wrap {
  padding: 0.35rem 1.1rem 1.1rem;
  border-top: 1px solid var(--border);
}
</style>
