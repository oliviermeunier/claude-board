<script setup lang="ts">
import { ref, onMounted } from 'vue'

type TextSize = 'small' | 'normal' | 'large'

// Must match the key read by the inline script in nuxt.config.ts.
const STORAGE_KEY = 'board-text-size'

const OPTIONS: { value: TextSize; label: string; title: string }[] = [
  { value: 'small', label: 'A', title: 'Texte compact' },
  { value: 'normal', label: 'A', title: 'Texte normal' },
  { value: 'large', label: 'A', title: 'Grand texte' },
]

const size = ref<TextSize>('normal')

function apply(value: TextSize) {
  size.value = value
  if (value === 'normal') delete document.documentElement.dataset.textSize
  else document.documentElement.dataset.textSize = value
  try {
    if (value === 'normal') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, value)
  } catch {
    /* storage blocked: the choice only lasts for this page */
  }
}

onMounted(() => {
  const current = document.documentElement.dataset.textSize
  size.value = current === 'small' || current === 'large' ? current : 'normal'
})
</script>

<template>
  <div class="size-toggle" role="radiogroup" aria-label="Taille du texte">
    <button
      v-for="option in OPTIONS"
      :key="option.value"
      type="button"
      role="radio"
      :class="[option.value, { active: size === option.value }]"
      :aria-checked="size === option.value"
      :aria-label="option.title"
      :title="option.title"
      @click="apply(option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.size-toggle {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-elev);
}
/* Fixed pixel sizes: the buttons show the three sizes without changing with them. */
.size-toggle button {
  width: 26px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-dim);
  font-weight: 600;
  line-height: 1;
}
.size-toggle .small { font-size: 11px; }
.size-toggle .normal { font-size: 13px; }
.size-toggle .large { font-size: 16px; }
.size-toggle button:hover {
  color: var(--text);
  background: var(--bg-elev-2);
}
.size-toggle button.active {
  color: var(--primary);
  background: var(--bg-elev-2);
}
</style>
