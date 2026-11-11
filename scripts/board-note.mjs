#!/usr/bin/env node
// board-note — poste une note sur le board local.
// La note est rangée dans l'onglet du projet courant (dépôt git du dossier courant), ou de son premier fichier joint.
//
// Usage :
//   board-note "Titre" <<'EOF'
//   markdown body here
//   EOF
//
//   board-note --file chemin/vers/note.md "Titre"
//   board-note --file plan.md --file plan.pdf "Titre" <<< "body"   (--file est répétable)
//   echo "body" | board-note --file note.md "Titre"
//
//   board-note "Titre seul, pas de stdin"
//
//   board-note --edit 42 <<'EOF'            (remplace le corps de la note #42)
//   board-note --edit 42 "Nouveau titre"    (remplace le titre)
//   board-note --edit 42 --file plan.md     (remplace les fichiers joints)
//   Avec --edit, seul ce qui est fourni est modifié ; le reste est conservé.
//
// Variables d'env :
//   BOARD_URL  — défaut http://127.0.0.1:4848

import { readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BOARD_URL, projectRoot } from './lib/board.mjs'

const STDIN_WAIT_MS = 500

function fail(message, code) {
  console.error(`board-note: ${message}`)
  process.exit(code)
}

function printHelp() {
  const lines = readFileSync(fileURLToPath(import.meta.url), 'utf8').split(/\r?\n/)
  const end = lines.findIndex((line) => line.startsWith('import '))
  console.log(
    lines
      .slice(1, end)
      .map((line) => line.replace(/^\/\/ ?/, ''))
      .join('\n')
      .trim(),
  )
}

function parseArgs(argv) {
  const args = { title: '', files: [], editId: '' }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = () => {
      if (i + 1 >= argv.length) fail(`${arg} attend une valeur`, 2)
      return argv[++i]
    }
    if (arg === '--file') args.files.push(resolve(next()))
    else if (arg.startsWith('--file=')) args.files.push(resolve(arg.slice('--file='.length)))
    else if (arg === '--edit') args.editId = next()
    else if (arg.startsWith('--edit=')) args.editId = arg.slice('--edit='.length)
    else if (arg === '-h' || arg === '--help') {
      printHelp()
      process.exit(0)
    } else if (!args.title) args.title = arg
    else fail(`argument inattendu: ${arg}`, 2)
  }
  return args
}

// Lit stdin s'il est redirigé (pipe, heredoc). Sans écrivain (shell non interactif),
// on abandonne après un court délai au lieu de bloquer, comme `timeout 0.5 cat` en bash.
function readStdin() {
  if (process.stdin.isTTY) return Promise.resolve('')
  return new Promise((done) => {
    const chunks = []
    let received = false
    const finish = () => {
      clearTimeout(timer)
      process.stdin.pause()
      done(Buffer.concat(chunks).toString('utf8'))
    }
    const timer = setTimeout(() => {
      if (!received) finish()
    }, STDIN_WAIT_MS)
    process.stdin.on('data', (chunk) => {
      received = true
      chunks.push(chunk)
    })
    process.stdin.on('end', finish)
    process.stdin.on('error', finish)
  })
}

const { title, files, editId } = parseArgs(process.argv.slice(2))
// Comme $(cat) en bash : les retours à la ligne finaux sont retirés.
const body = (await readStdin()).replace(/(\r?\n)+$/, '')

let method, url, payload, expected, doneLabel
if (editId) {
  if (!/^[1-9][0-9]*$/.test(editId)) fail('--edit attend un numéro de note', 2)
  if (!title && !body && files.length === 0) fail('rien à modifier (ni titre, ni stdin, ni --file)', 2)
  // Seuls les champs fournis partent dans le PATCH.
  payload = {}
  if (title) payload.title = title
  if (body) payload.body = body
  if (files.length > 0) payload.files = files
  method = 'PATCH'
  url = `${BOARD_URL}/api/notes/${editId}`
  expected = 200
  doneLabel = 'modifiée'
} else {
  // Sans body sur stdin, le body par défaut liste les fichiers joints.
  const finalBody = body || files.map((f) => `- \`${basename(f)}\``).join('\n')
  if (!finalBody) fail('body vide (ni stdin ni --file)', 2)
  payload = { title: title || null, body: finalBody, files, cwd: projectRoot(process.cwd()) }
  method = 'POST'
  url = `${BOARD_URL}/api/notes`
  expected = 201
  doneLabel = 'postée'
}

let res
try {
  res = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
} catch {
  fail(`requête échouée — serveur arrêté ? (${BOARD_URL})`, 4)
}

const text = await res.text()
if (res.status !== expected) {
  console.error(`board-note: HTTP ${res.status}`)
  console.error(text)
  process.exit(5)
}

console.log(`Note #${JSON.parse(text).id} ${doneLabel} → ${BOARD_URL}`)
