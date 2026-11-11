<script setup lang="ts">
import { ref, onMounted } from 'vue'

type Theme = 'auto' | 'light' | 'dark'

// Must match the key read by the inline script in nuxt.config.ts.
const STORAGE_KEY = 'board-theme'

const OPTIONS: { value: Theme; label: string }[] = [
  { value: 'auto', label: 'Thème du système' },
  { value: 'light', label: 'Thème clair' },
  { value: 'dark', label: 'Thème sombre' },
]

const theme = ref<Theme>('auto')

function apply(value: Theme) {
  theme.value = value
  if (value === 'auto') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = value
  try {
    if (value === 'auto') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, value)
  } catch {
    /* storage blocked: the choice only lasts for this page */
  }
}

onMounted(() => {
  const current = document.documentElement.dataset.theme
  theme.value = current === 'light' || current === 'dark' ? current : 'auto'
})
</script>

<template>
  <div class="theme-toggle" role="radiogroup" aria-label="Thème">
    <button
      v-for="option in OPTIONS"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="theme === option.value"
      :aria-label="option.label"
      :title="option.label"
      :class="{ active: theme === option.value }"
      @click="apply(option.value)"
    >
      <svg v-if="option.value === 'auto'" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <rect x="2" y="3" width="12" height="8.5" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.3" />
        <path d="M6 14h4M8 11.5V14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
      </svg>
      <svg v-else-if="option.value === 'light'" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="1.3" />
        <path
          d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.06 1.06M11.54 11.54l1.06 1.06M3.4 12.6l1.06-1.06M11.54 4.46l1.06-1.06"
          fill="none"
          stroke="currentColor"
          stroke-width="1.3"
          stroke-linecap="round"
        />
      </svg>
      <svg v-else viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path
          d="M13.5 9.6A5.75 5.75 0 0 1 6.4 2.5a5.75 5.75 0 1 0 7.1 7.1Z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.3"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.theme-toggle {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-elev);
}
.theme-toggle button {
  display: inline-flex;
  align-items: center;
  padding: 4px 6px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-dim);
}
.theme-toggle button:hover {
  color: var(--text);
  background: var(--bg-elev-2);
}
.theme-toggle button.active {
  color: var(--primary);
  background: var(--bg-elev-2);
}
</style>
