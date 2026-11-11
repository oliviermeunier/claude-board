import { test } from 'node:test'
import assert from 'node:assert/strict'
import { exportFileName, notesToMarkdown } from '../app/utils/export'

const base = { created_at: '2026-11-10T09:00:00.000Z', pinned_at: null, files: [] as string[] }

test('notesToMarkdown : épinglées en premier, titres des notes rétrogradés sous le titre de la note', () => {
  const markdown = notesToMarkdown(
    'mon-app',
    [
      { ...base, title: 'Récente', body: '# Plan\n\n```md\n# pas un titre\n```' },
      { ...base, title: null, body: 'Commande utile', pinned_at: '2026-11-10T10:00:00.000Z', files: ['/tmp/a.md'] },
    ],
    new Date('2026-11-11T12:00:00Z'),
  )
  const titles = [...markdown.matchAll(/^## (.+)$/gm)].map((m) => m[1])
  assert.deepEqual(titles, ['Commande utile', 'Récente'])
  assert.match(markdown, /^### Plan$/m)
  assert.match(markdown, /^# pas un titre$/m)
  assert.match(markdown, /épinglée/)
  assert.match(markdown, /- `\/tmp\/a\.md`/)
  assert.match(markdown, /^# mon-app$/m)
})

test('exportFileName : nom de fichier sans accents ni espaces, daté', () => {
  assert.equal(exportFileName('Électricité & co', new Date(2026, 10, 11)), 'claude-board-electricite-co-2026-11-11.md')
  assert.equal(exportFileName('', new Date(2026, 0, 5)), 'claude-board-notes-2026-01-05.md')
})
