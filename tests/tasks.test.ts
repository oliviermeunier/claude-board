import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderMarkdown, toggleTask } from '../app/composables/useMarkdown'

const SOURCE = '# Titre\n\n- [ ] un\n- [x] deux\n- [X] trois\n- texte [ ] au milieu'

test('toggleTask coche une tâche', () => {
  assert.equal(toggleTask(SOURCE, 2), SOURCE.replace('- [ ] un', '- [x] un'))
})

test('toggleTask décoche une tâche, x ou X', () => {
  assert.equal(toggleTask(SOURCE, 3), SOURCE.replace('- [x] deux', '- [ ] deux'))
  assert.equal(toggleTask(SOURCE, 4), SOURCE.replace('- [X] trois', '- [ ] trois'))
})

test('toggleTask ne change rien sur une ligne sans tâche', () => {
  assert.equal(toggleTask(SOURCE, 0), SOURCE)
  assert.equal(toggleTask(SOURCE, 5), SOURCE)
  assert.equal(toggleTask(SOURCE, 99), SOURCE)
})

test('toggleTask ne touche pas une tâche dans un bloc de code', () => {
  const src = '```md\n- [ ] exemple\n```\n\n- [ ] vraie'
  assert.equal(toggleTask(src, 1), src)
  assert.equal(toggleTask(src, 4), '```md\n- [ ] exemple\n```\n\n- [x] vraie')
})

test('toggleTask garde le reste octet pour octet (imbriquée, numérotée, CRLF)', () => {
  const src = '1. a  \r\n   - [ ] b *c*  \r\n2. [x] d\r\n'
  assert.equal(toggleTask(src, 1), '1. a  \r\n   - [x] b *c*  \r\n2. [x] d\r\n')
  assert.equal(toggleTask(src, 2), '1. a  \r\n   - [ ] b *c*  \r\n2. [ ] d\r\n')
})

test('renderMarkdown produit une case par tâche avec data-line et checked', async () => {
  const html = await renderMarkdown(SOURCE)
  const boxes = html.match(/<input[^>]*class="task-checkbox"[^>]*>/g) ?? []
  assert.equal(boxes.length, 3)
  assert.match(boxes[0]!, /data-line="2"/)
  assert.doesNotMatch(boxes[0]!, /checked/)
  assert.match(boxes[1]!, /data-line="3"/)
  assert.match(boxes[1]!, /checked/)
  assert.match(boxes[2]!, /data-line="4"/)
  assert.match(boxes[2]!, /checked/)
  assert.doesNotMatch(html, /\[ \] un|\[x\] deux/)
  assert.match(html, /texte \[ \] au milieu/)
})

test('renderMarkdown ne fait pas de case d\'un [ ] dans un bloc de code', async () => {
  const html = await renderMarkdown('```md\n- [ ] exemple\n```\n\n`- [ ] inline`')
  assert.doesNotMatch(html, /task-checkbox/)
})

test('renderMarkdown échappe le texte d\'une tâche', async () => {
  const html = await renderMarkdown('- [ ] <b>gras</b> & plus')
  assert.match(html, /&lt;b&gt;gras&lt;\/b&gt; &amp; plus/)
  assert.doesNotMatch(html, /<b>/)
})
