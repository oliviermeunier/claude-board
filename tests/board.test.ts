import { test } from 'node:test'
import assert from 'node:assert/strict'
import { serviceStartCommand } from '../scripts/lib/board.mjs'

test('serviceStartCommand : sous Linux avec l\'unité installée, le serveur démarre par systemd', () => {
  assert.deepEqual(serviceStartCommand('linux', true), {
    command: 'systemctl',
    args: ['--user', 'start', 'board.service'],
  })
})

test('serviceStartCommand : sans unité systemd, ou sur un autre système, pas de service à démarrer', () => {
  assert.equal(serviceStartCommand('linux', false), null)
  assert.equal(serviceStartCommand('darwin', true), null)
  assert.equal(serviceStartCommand('win32', true), null)
})
