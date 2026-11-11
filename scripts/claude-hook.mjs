#!/usr/bin/env node
// Hooks Claude Code du board (installés par « npm run setup » dans ~/.claude/settings.json).
//
//   claude-hook.mjs session-start   démarre le board si besoin et rappelle à Claude comment écrire une note
//   claude-hook.mjs stop            envoie au board les blocs <note> du transcript
//
// Le hook ne fait jamais échouer Claude Code : toute erreur est ignorée (sortie 0).

import { readFileSync } from 'node:fs'
import { BOARD_URL, startServer } from './lib/board.mjs'
import { notesFromTranscript } from './lib/transcript.mjs'

const BATCH = 100

const INSTRUCTIONS = `Board de notes local actif (${BOARD_URL}). Pour envoyer une note à l'utilisateur, écris dans ta réponse un bloc qui commence par une ligne <note> et finit par une ligne </note> : la première ligne est le titre, la suite est du markdown. Écris <note pin> au lieu de <note> pour épingler une note de référence durable. Le bloc reste visible dans le terminal et arrive sur le board à la fin de ta réponse. Fais-le quand l'utilisateur te demande une note, ou pour un contenu qu'il voudra relire ou copier plus tard (commandes, extrait de code, récapitulatif). N'écris jamais ces balises en début de ligne pour un autre usage.`

function readStdin() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'))
  } catch {
    return {}
  }
}

async function postCapture(payload) {
  const res = await fetch(`${BOARD_URL}/api/capture`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}

async function onStop(input) {
  if (!input.transcript_path) return
  const notes = notesFromTranscript(readFileSync(input.transcript_path, 'utf8'))
  if (notes.length === 0) return

  // The session's own folder: the board derives the project from it, and « Reprendre la session » needs it.
  const base = {
    cwd: input.cwd ?? null,
    session_id: input.session_id ?? null,
  }
  // The whole transcript is sent every time: the board skips notes it already has,
  // and a note missed by an earlier run (server down) is caught up here.
  for (let i = 0; i < notes.length; i += BATCH) {
    const payload = { ...base, notes: notes.slice(i, i + BATCH) }
    try {
      await postCapture(payload)
    } catch {
      if (!(await startServer()).ok) return
      await postCapture(payload)
    }
  }
}

async function onSessionStart() {
  await startServer()
  // Stdout of a SessionStart hook is added to Claude's context.
  console.log(INSTRUCTIONS)
}

try {
  const event = process.argv[2]
  if (event === 'stop') await onStop(readStdin())
  else if (event === 'session-start') await onSessionStart()
} catch (err) {
  console.error(`board hook: ${err?.message ?? err}`)
}
process.exit(0)
