#!/usr/bin/env node
// MCP server (stdio) that lets Claude Code read the board: search notes and read one in full.
// Registered by « npm run setup » with `claude mcp add --scope user claude-board`.
// Read-only on purpose; it talks to the board's HTTP API, and starts the board if needed.
//
// Protocol: JSON-RPC 2.0, one message per line on stdin/stdout. Nothing else may be written to stdout.

import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { join } from 'node:path'
import { BOARD_URL, ROOT, isUp, startServer } from './lib/board.mjs'

const SUPPORTED_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']
const VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version
const EXCERPT = 240

const INSTRUCTIONS =
  "Claude Board est le board de notes local de l'utilisateur : notes écrites pendant ses sessions Claude Code, " +
  "rangées par projet. Utilise board_search pour retrouver une note (par défaut dans le projet courant), " +
  'puis board_read pour la lire en entier. Les notes épinglées sont les références importantes du projet.'

const TOOLS = [
  {
    name: 'board_search',
    description:
      "Cherche dans les notes du board de l'utilisateur (titre et contenu). Par défaut, seulement les notes du projet " +
      "courant ; scope « tous » pour tous les projets. Sans query, liste les notes les plus récentes. " +
      'Renvoie pour chaque note : numéro, titre, projet, date, épinglée ou non, et un extrait.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Texte à chercher (vide : toutes les notes)' },
        scope: {
          type: 'string',
          enum: ['projet', 'tous'],
          description: 'projet (défaut) : projet du dossier courant ; tous : tous les projets',
        },
        pinned_only: { type: 'boolean', description: 'Seulement les notes épinglées' },
        limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Nombre maximum de notes (défaut 20)' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'board_read',
    description: "Lit une note du board en entier (markdown), avec ses fichiers joints et son dossier d'origine.",
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'integer', minimum: 1, description: 'Numéro de la note (voir board_search)' } },
      required: ['id'],
      additionalProperties: false,
    },
  },
]

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`)
}

const text = (value, isError = false) => ({ content: [{ type: 'text', text: value }], ...(isError ? { isError } : {}) })

async function api(path) {
  if (!(await isUp())) {
    const { ok, message } = await startServer()
    if (!ok) throw new Error(`le board ne répond pas (${message})`)
  }
  const res = await fetch(`${BOARD_URL}${path}`, { signal: AbortSignal.timeout(5000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${path}`)
  return res.json()
}

function headline(note) {
  if (note.title?.trim()) return note.title.trim()
  const firstLine = note.body.split('\n').find((line) => line.trim()) ?? ''
  return firstLine.replace(/^#+\s*/, '').slice(0, 120) || '(sans titre)'
}

function summary(note) {
  const parts = [`#${note.id}`, headline(note), note.project ?? 'Autres', note.created_at.slice(0, 10)]
  if (note.pinned_at) parts.push('épinglée')
  const excerpt = note.body.replace(/\s+/g, ' ').trim()
  return `${parts.join(' · ')}\n  ${excerpt.length > EXCERPT ? `${excerpt.slice(0, EXCERPT)}…` : excerpt}`
}

async function boardSearch(args) {
  const query = typeof args.query === 'string' ? args.query.trim() : ''
  const allProjects = args.scope === 'tous'
  const limit = Number.isInteger(args.limit) ? Math.min(Math.max(args.limit, 1), 100) : 20

  const params = new URLSearchParams()
  if (query) params.set('q', query)
  if (!allProjects) params.set('cwd', process.cwd())
  let notes = await api(`/api/notes?${params}`)
  if (args.pinned_only) notes = notes.filter((note) => note.pinned_at)
  // Pinned notes first: they are the project's references.
  notes = [...notes.filter((n) => n.pinned_at), ...notes.filter((n) => !n.pinned_at)]

  const where = allProjects ? 'tous les projets' : 'le projet courant'
  if (notes.length === 0) {
    return text(
      `Aucune note${query ? ` pour « ${query} »` : ''} dans ${where}.` +
        (allProjects ? '' : ' Essayer scope « tous » pour chercher dans tous les projets.'),
    )
  }
  const shown = notes.slice(0, limit)
  const more = notes.length > shown.length ? `\n\n(${notes.length - shown.length} autres notes non affichées)` : ''
  return text(`${notes.length} note(s) dans ${where} :\n\n${shown.map(summary).join('\n\n')}${more}`)
}

async function boardRead(args) {
  if (!Number.isInteger(args.id) || args.id < 1) return text('id doit être un numéro de note', true)
  const note = (await api('/api/notes')).find((n) => n.id === args.id)
  if (!note) return text(`Note #${args.id} introuvable (supprimée ?)`, true)
  const meta = [
    `Projet : ${note.project ?? 'Autres'}`,
    `Créée le : ${note.created_at}${note.updated_at ? ` · modifiée le ${note.updated_at}` : ''}`,
    note.pinned_at ? 'Épinglée' : null,
    note.cwd ? `Dossier : ${note.cwd}` : null,
    note.files.length > 0 ? `Fichiers joints :\n${note.files.map((f) => `- ${f}`).join('\n')}` : null,
  ].filter(Boolean)
  return text(`# ${headline(note)} (note #${note.id})\n\n${meta.join('\n')}\n\n---\n\n${note.body}`)
}

const HANDLERS = { board_search: boardSearch, board_read: boardRead }

async function handle(message) {
  const { id, method, params } = message
  const isRequest = id !== undefined && id !== null
  try {
    switch (method) {
      case 'initialize': {
        const requested = params?.protocolVersion
        return send({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_VERSIONS[0],
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: 'claude-board', version: VERSION },
            instructions: INSTRUCTIONS,
          },
        })
      }
      case 'ping':
        return send({ jsonrpc: '2.0', id, result: {} })
      case 'tools/list':
        return send({ jsonrpc: '2.0', id, result: { tools: TOOLS } })
      case 'tools/call': {
        const handler = HANDLERS[params?.name]
        if (!handler) {
          return send({ jsonrpc: '2.0', id, error: { code: -32602, message: `outil inconnu : ${params?.name}` } })
        }
        let result
        try {
          result = await handler(params.arguments ?? {})
        } catch (err) {
          result = text(`Erreur : ${err.message}`, true)
        }
        return send({ jsonrpc: '2.0', id, result })
      }
      default:
        // Notifications (no id), such as notifications/initialized, need no answer.
        if (isRequest) send({ jsonrpc: '2.0', id, error: { code: -32601, message: `méthode inconnue : ${method}` } })
    }
  } catch (err) {
    if (isRequest) send({ jsonrpc: '2.0', id, error: { code: -32603, message: err.message } })
  }
}

const lines = createInterface({ input: process.stdin })
lines.on('line', (line) => {
  if (!line.trim()) return
  let message
  try {
    message = JSON.parse(line)
  } catch {
    send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON invalide' } })
    return
  }
  handle(message)
})
