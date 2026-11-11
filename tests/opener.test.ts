import { test } from 'node:test'
import assert from 'node:assert/strict'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { openCommand, revealCommand } from '../server/utils/opener'
import { validateOpenPath, ValidationError } from '../server/utils/validate'

test('openCommand : open sur Mac, xdg-open sous Linux, explorer sous Windows', () => {
  assert.deepEqual(openCommand('/home/u/a.md', 'darwin'), { command: 'open', args: ['/home/u/a.md'] })
  assert.deepEqual(openCommand('/home/u/a.md', 'linux'), { command: 'xdg-open', args: ['/home/u/a.md'] })
  const winFile = String.raw`C:\Users\u\a.md`
  assert.deepEqual(openCommand(winFile, 'win32'), { command: 'explorer.exe', args: [winFile] })
})

test('revealCommand : Finder avec le fichier sélectionné sur Mac', () => {
  assert.deepEqual(revealCommand('/Users/u/docs/a.md', 'darwin'), {
    command: 'open',
    args: ['-R', '/Users/u/docs/a.md'],
  })
})

test('revealCommand : dossier parent sous Linux', () => {
  assert.deepEqual(revealCommand('/home/u/docs/a.md', 'linux'), {
    command: 'xdg-open',
    args: ['/home/u/docs'],
  })
})

test('revealCommand : Explorateur avec le fichier sélectionné sous Windows', () => {
  const winFile = String.raw`C:\Users\u\mes docs\a.md`
  assert.deepEqual(revealCommand(winFile, 'win32'), {
    command: 'explorer.exe',
    args: ['/select,', winFile],
  })
})

test('validateOpenPath refuse un chemin qui sort du dossier personnel par ..', () => {
  assert.throws(() => validateOpenPath({ path: join(homedir(), '..', '..', 'etc', 'passwd') }), ValidationError)
})

test('validateOpenPath refuse le dossier personnel lui-même et un voisin au nom proche', () => {
  assert.throws(() => validateOpenPath({ path: homedir() }), ValidationError)
  assert.throws(() => validateOpenPath({ path: join(`${homedir()}-autre`, 'a.md') }), ValidationError)
})

test('validateOpenPath renvoie le chemin normalisé', () => {
  const home = homedir()
  assert.equal(validateOpenPath({ path: join(home, 'docs', '..', 'notes', 'a.md') }), join(home, 'notes', 'a.md'))
  // join() normalise déjà : on passe le « .. » brut pour vérifier que validateOpenPath le résout.
  assert.equal(validateOpenPath({ path: `${home}/docs/../notes/a.md` }), join(home, 'notes', 'a.md'))
})
