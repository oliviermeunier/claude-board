<script setup lang="ts">
import { onMounted } from 'vue'
import { useNotifications } from '../composables/useNotifications'

const { enabled, supported, init, toggle } = useNotifications()

onMounted(init)
</script>

<template>
  <button
    v-if="supported"
    type="button"
    class="notify-toggle"
    :class="{ active: enabled }"
    :aria-pressed="enabled"
    :title="enabled ? 'Notifications activées : une alerte du bureau quand une note arrive et que le board n’est pas affiché' : 'Activer les notifications du bureau'"
    :aria-label="enabled ? 'Désactiver les notifications' : 'Activer les notifications'"
    @click="toggle"
  >
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        d="M4 11.5V7.2a4 4 0 0 1 8 0v4.3l1.2 1.2H2.8L4 11.5Z M6.6 14.2a1.5 1.5 0 0 0 2.8 0"
        :fill="enabled ? 'currentColor' : 'none'"
        stroke="currentColor"
        stroke-width="1.3"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
    </svg>
  </button>
</template>

<style scoped>
.notify-toggle {
  display: inline-flex;
  align-items: center;
  padding: 0 7px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-elev);
  color: var(--text-dim);
}
.notify-toggle:hover {
  color: var(--text);
  background: var(--bg-elev-2);
}
.notify-toggle.active {
  color: var(--primary);
}
</style>
