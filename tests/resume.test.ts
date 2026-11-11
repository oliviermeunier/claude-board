import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canResume, resumeCommand } from '../app/utils/resume'

test('resumeCommand : retourne dans le dossier puis reprend la session', () => {
  assert.equal(
    resumeCommand('5a55d2d1-16de', '/home/u/mon projet', false),
    "cd '/home/u/mon projet' && claude --resume 5a55d2d1-16de",
  )
  assert.equal(
    resumeCommand('5a55d2d1-16de', String.raw`C:\Dev\app`, true),
    String.raw`cd "C:\Dev\app"; claude --resume 5a55d2d1-16de`,
  )
  assert.equal(resumeCommand('abc', null, false), 'claude --resume abc')
})

test('resumeCommand : protège les apostrophes du chemin', () => {
  assert.equal(resumeCommand('abc', "/home/u/l'app", false), String.raw`cd '/home/u/l'\''app' && claude --resume abc`)
})

test('canResume : refuse un identifiant de session qui pourrait injecter une commande', () => {
  assert.equal(canResume('5a55d2d1-16de-40c6'), true)
  assert.equal(canResume('x; rm -rf ~'), false)
  assert.equal(canResume(null), false)
  assert.throws(() => resumeCommand('a b', null, false))
})
