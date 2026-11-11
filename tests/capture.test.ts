import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractNotes, notesFromTranscript } from '../scripts/lib/transcript.mjs'
import { addBoardHooks, removeBoardHooks } from '../scripts/lib/claude-settings.mjs'

const note = (title: string | null, body: string, pinned = false) => ({ title, body, pinned })

test('extractNotes : titre sur la première ligne, markdown ensuite', () => {
  const text = 'Voici la note :\n<note>\n## Commandes utiles\n\n- `npm test`\n</note>\nFin.'
  assert.deepEqual(extractNotes(text), [note('Commandes utiles', '- `npm test`')])
})

test('extractNotes : balise sur la même ligne que le titre', () => {
  assert.deepEqual(extractNotes('<note>Titre\ncorps</note>'), [note('Titre', 'corps')])
})

test('extractNotes : une seule ligne devient une note sans titre', () => {
  assert.deepEqual(extractNotes('<note>Penser au backup</note>'), [note(null, 'Penser au backup')])
})

test('extractNotes : <note pin> crée une note épinglée', () => {
  assert.deepEqual(extractNotes('<note pin>\nRéférence\ncontenu durable\n</note>'), [
    note('Référence', 'contenu durable', true),
  ])
  assert.deepEqual(extractNotes('<note pin>Une ligne</note>'), [note(null, 'Une ligne', true)])
})

test('extractNotes : ignore une mention au milieu d\'une phrase', () => {
  assert.deepEqual(extractNotes('Écris `<note>…</note>` pour envoyer une note.'), [])
  assert.deepEqual(extractNotes('Le bloc <note>\nx\n</note> plus loin'), [])
})

test('extractNotes : ignore un exemple dans un bloc de code', () => {
  const text = '```\n<note>\nExemple\ncorps\n</note>\n```'
  assert.deepEqual(extractNotes(text), [])
})

test('extractNotes : garde les blocs de code à l\'intérieur de la note', () => {
  const text = '<note>\nScript\n```bash\necho "</note> pas ici"\n```\n</note>'
  // La ligne « echo » ne finit pas par </note> : elle reste dans le corps.
  assert.deepEqual(extractNotes(text), [note('Script', '```bash\necho "</note> pas ici"\n```')])
})

test('extractNotes : plusieurs notes, une note vide ignorée', () => {
  const text = '<note>\nA\na\n</note>\n<note>\n</note>\n<note pin>\nB\nb\n</note>'
  assert.deepEqual(extractNotes(text), [note('A', 'a'), note('B', 'b', true)])
})

test('notesFromTranscript : ne lit que les messages de Claude', () => {
  const lines = [
    { type: 'user', message: { content: '<note>\nDe l\'utilisateur\nx\n</note>' } },
    { type: 'assistant', message: { content: [{ type: 'text', text: '<note>\nDe Claude\ny\n</note>' }] } },
    { type: 'assistant', message: { content: [{ type: 'tool_use', input: { text: '<note>\nOutil\nz\n</note>' } }] } },
    'pas du json',
  ]
  const jsonl = lines.map((l) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n')
  assert.deepEqual(notesFromTranscript(jsonl), [note('De Claude', 'y')])
})

test('addBoardHooks : ajoute SessionStart et Stop sans toucher aux autres hooks, sans doublon', () => {
  const other = { type: 'command', command: 'node autre.mjs' }
  const settings = { model: 'x', hooks: { Stop: [{ hooks: [other] }] } }
  const command = (event: string) => `node /b/scripts/claude-hook.mjs ${event}`

  const once = addBoardHooks(settings, command)
  const twice = addBoardHooks(once, command)
  assert.deepEqual(twice, once)
  assert.equal(once.model, 'x')
  assert.deepEqual(once.hooks.Stop, [
    { hooks: [other] },
    { hooks: [{ type: 'command', command: 'node /b/scripts/claude-hook.mjs stop' }] },
  ])
  assert.equal(once.hooks.SessionStart[0].hooks[0].command, 'node /b/scripts/claude-hook.mjs session-start')
  // L'objet d'origine n'est pas modifié.
  assert.equal(settings.hooks.Stop.length, 1)

  assert.deepEqual(removeBoardHooks(once), { model: 'x', hooks: { Stop: [{ hooks: [other] }] } })
  assert.deepEqual(removeBoardHooks(addBoardHooks({}, command)), {})
})
