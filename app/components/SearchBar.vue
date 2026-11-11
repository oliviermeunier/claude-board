<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const local = ref(props.modelValue)
const input = ref<HTMLInputElement | null>(null)

defineExpose({ focus: () => input.value?.focus() })
let timer: ReturnType<typeof setTimeout> | null = null

watch(local, (v) => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => emit('update:modelValue', v), 200)
})

watch(() => props.modelValue, (v) => {
  if (v !== local.value) local.value = v
})
</script>

<template>
  <div class="search">
    <input
      ref="input"
      v-model="local"
      type="search"
      placeholder="Rechercher dans toutes les notes…   ( / )"
      autocomplete="off"
      spellcheck="false"
    />
  </div>
</template>

<style scoped>
.search {
  margin-bottom: 16px;
}
input {
  width: 100%;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.7rem 1rem;
  font: inherit;
  color: var(--text);
}
input:focus {
  outline: none;
  border-color: var(--primary);
}
</style>
