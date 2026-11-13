import { test } from 'node:test'
import assert from 'node:assert/strict'
import { closeStreams, trackStream } from '../server/utils/events'

test('closeStreams ferme chaque flux ouvert, une seule fois', () => {
  const closed: string[] = []
  trackStream(() => closed.push('a'))
  trackStream(() => closed.push('b'))

  closeStreams()
  closeStreams()

  assert.deepEqual(closed, ['a', 'b'])
})

test('closeStreams laisse un flux déjà terminé par le client', () => {
  const closed: string[] = []
  const untrack = trackStream(() => closed.push('a'))
  untrack()

  closeStreams()

  assert.deepEqual(closed, [])
})
