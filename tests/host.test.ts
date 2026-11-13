import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isAllowedHost } from '../server/utils/host'

test('isAllowedHost : la boucle locale passe, avec ou sans port', () => {
  for (const host of ['127.0.0.1:4848', '127.0.0.1', 'localhost:4848', 'LOCALHOST:4848', '[::1]:4848', '[::1]']) {
    assert.equal(isAllowedHost(host), true, host)
  }
})

test('isAllowedHost : un autre nom est refusé, même s\'il ressemble à la boucle locale', () => {
  for (const host of ['exemple.invalid', 'exemple.invalid:4848', '127.0.0.1.exemple.invalid', 'localhost.exemple.invalid:4848', '192.168.1.10:4848']) {
    assert.equal(isAllowedHost(host), false, host)
  }
})

test('isAllowedHost : un en-tête absent ou vide est refusé', () => {
  assert.equal(isAllowedHost(undefined), false)
  assert.equal(isAllowedHost(''), false)
})

test('isAllowedHost : l\'interface d\'écoute choisie par NITRO_HOST passe aussi', () => {
  assert.equal(isAllowedHost('192.168.1.10:4848', '192.168.1.10'), true)
  assert.equal(isAllowedHost('192.168.1.11:4848', '192.168.1.10'), false)
  // 0.0.0.0 listens everywhere and names no host: it allows nothing more.
  assert.equal(isAllowedHost('192.168.1.10:4848', '0.0.0.0'), false)
})

test('isAllowedHost : BOARD_ALLOWED_HOSTS ajoute des noms, séparés par des virgules', () => {
  assert.equal(isAllowedHost('poste.lan:4848', '0.0.0.0', 'poste.lan, 192.168.1.10'), true)
  assert.equal(isAllowedHost('192.168.1.10:4848', '0.0.0.0', 'poste.lan, 192.168.1.10'), true)
  assert.equal(isAllowedHost('exemple.invalid', '0.0.0.0', 'poste.lan, 192.168.1.10'), false)
})
