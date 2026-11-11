<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { renderMarkdown } from '../composables/useMarkdown'

const props = defineProps<{ source: string }>()

const html = ref('<p class="dim">Rendu…</p>')
const root = ref<HTMLElement | null>(null)
const showAll = ref(false)
const overflowing = ref(false)
let resizeObserver: ResizeObserver | null = null

function measure() {
  const el = root.value
  if (!el) return
  overflowing.value = el.scrollHeight > el.clientHeight + 1
}

// Le corps est plafonné en hauteur : seuls ses enfants signalent que le contenu grandit.
function observeContent() {
  if (!root.value || !resizeObserver) return
  resizeObserver.disconnect()
  resizeObserver.observe(root.value)
  for (const child of Array.from(root.value.children)) resizeObserver.observe(child)
}

async function render() {
  html.value = await renderMarkdown(props.source)
}

watch(() => props.source, render, { immediate: true })

function onClick(e: MouseEvent) {
  const target = (e.target as HTMLElement | null)?.closest('button.copy-code') as HTMLElement | null
  if (!target) return
  const wrap = target.closest('.code-wrap') as HTMLElement | null
  if (!wrap) return
  const raw = wrap.getAttribute('data-raw') ?? ''
  const decoded = raw
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
  navigator.clipboard.writeText(decoded).then(() => {
    target.classList.add('copied')
    setTimeout(() => target.classList.remove('copied'), 1200)
  })
}

onMounted(() => {
  root.value?.addEventListener('click', onClick)
  resizeObserver = new ResizeObserver(measure)
  observeContent()
})
// v-html recrée les enfants à chaque rendu.
watch(html, () => requestAnimationFrame(() => {
  observeContent()
  measure()
}))
onBeforeUnmount(() => {
  root.value?.removeEventListener('click', onClick)
  resizeObserver?.disconnect()
})
</script>

<template>
  <div class="note-body-wrap">
    <div
      ref="root"
      class="note-body"
      :class="{ clamped: !showAll, faded: !showAll && overflowing }"
      v-html="html"
    />
    <button v-if="overflowing || showAll" type="button" class="see-more" @click="showAll = !showAll">
      {{ showAll ? 'Voir moins' : 'Voir plus' }}
    </button>
  </div>
</template>

<style>
.note-body {
  font-size: 1rem;
  line-height: 1.65;
  color: var(--text);
  word-wrap: break-word;
}
/* Environ dix lignes de texte, avec l'interligne 1.5. */
.note-body.clamped {
  max-height: 15em;
  overflow: hidden;
}
.note-body.faded {
  mask-image: linear-gradient(to bottom, #000 70%, transparent);
}
.note-body-wrap .see-more {
  margin-top: 6px;
  padding: 3px 10px;
  font-size: 0.8125rem;
  color: var(--primary);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 999px;
  cursor: pointer;
}
.note-body-wrap .see-more:hover {
  border-color: var(--primary);
}
.note-body p { margin: 0.6em 0; }
.note-body h1, .note-body h2, .note-body h3 { margin: 0.9em 0 0.35em; line-height: 1.3; letter-spacing: -0.01em; }
.note-body h1 { font-size: 1.45em; }
.note-body h2 { font-size: 1.25em; }
.note-body h3 { font-size: 1.08em; }
.note-body ul, .note-body ol { padding-left: 1.5em; margin: 0.6em 0; }
.note-body li + li { margin-top: 0.2em; }
.note-body table { border-collapse: collapse; margin: 0.8em 0; font-size: 0.9375rem; }
.note-body th, .note-body td { border: 1px solid var(--border); padding: 0.35em 0.7em; text-align: left; }
.note-body th { background: var(--bg-elev-2); }
.note-body hr { border: none; border-top: 1px solid var(--border); margin: 1.2em 0; }
.note-body a { color: var(--primary); }
.note-body code:not(pre code) {
  background: var(--bg-elev-2);
  padding: 0.1em 0.4em;
  border-radius: 4px;
  font-size: 0.9em;
}
.note-body .code-wrap {
  position: relative;
  margin: 0.6em 0;
}
.note-body .code-wrap pre {
  margin: 0;
  padding: 0.9rem 1rem;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 0.875rem;
  line-height: 1.55;
  border: 1px solid var(--border);
}
.note-body .code-wrap .copy-code {
  position: absolute;
  top: 6px;
  right: 6px;
  display: inline-flex;
  align-items: center;
  padding: 5px;
  color: var(--text-dim);
  background: var(--bg-elev);
  opacity: 0;
  transition: opacity 0.1s;
}
.note-body .code-wrap .copy-code:hover {
  color: var(--text);
}
.note-body .code-wrap .copy-code .icon-check,
.note-body .code-wrap .copy-code.copied .icon-copy {
  display: none;
}
.note-body .code-wrap .copy-code.copied .icon-check {
  display: block;
}
.note-body .code-wrap .copy-code.copied {
  opacity: 1;
  color: var(--primary);
}
.note-body .code-wrap:hover .copy-code {
  opacity: 1;
}
.note-body blockquote {
  border-left: 3px solid var(--border);
  padding-left: 12px;
  color: var(--text-dim);
  margin: 0.6em 0;
}
.note-body .dim { color: var(--text-dim); }
</style>
