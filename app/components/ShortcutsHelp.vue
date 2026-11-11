<script setup lang="ts">
const emit = defineEmits<{ close: [] }>()

const SHORTCUTS: [string[], string][] = [
  [['/'], 'Rechercher'],
  [['j'], 'Note suivante'],
  [['k'], 'Note précédente'],
  [['Entrée', 'o'], 'Déplier / replier'],
  [['e'], 'Modifier'],
  [['p'], 'Épingler / désépingler'],
  [['c'], 'Copier le markdown'],
  [['Suppr'], 'Supprimer (annulable)'],
  [['h'], 'Onglet précédent'],
  [['l'], 'Onglet suivant'],
  [['Échap'], 'Fermer, désélectionner, vider la recherche'],
  [['?'], 'Afficher cette aide'],
]
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="panel" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title">
      <h2 id="shortcuts-title">Raccourcis clavier</h2>
      <dl>
        <template v-for="[keys, label] in SHORTCUTS" :key="label">
          <dt>
            <kbd v-for="key in keys" :key="key">{{ key }}</kbd>
          </dt>
          <dd>{{ label }}</dd>
        </template>
      </dl>
      <button type="button" class="close" @click="emit('close')">Fermer</button>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.45);
  z-index: 20;
  padding: 1rem;
}
.panel {
  width: min(26rem, 100%);
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 1.25rem 1.5rem;
}
h2 {
  margin: 0 0 1rem;
  font-size: 1.125rem;
}
dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.5rem 1rem;
  margin: 0 0 1.25rem;
}
dt {
  display: flex;
  gap: 0.3rem;
  justify-content: flex-end;
}
dd {
  margin: 0;
  color: var(--text-dim);
}
kbd {
  min-width: 1.6rem;
  padding: 0.05rem 0.4rem;
  border: 1px solid var(--border);
  border-bottom-width: 2px;
  border-radius: 6px;
  background: var(--bg-elev-2);
  color: var(--text);
  font-size: 0.8125rem;
  text-align: center;
}
.close {
  display: block;
  margin-left: auto;
}
</style>
