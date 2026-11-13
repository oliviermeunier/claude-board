import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { request } from 'node:http'
import { fileURLToPath } from 'node:url'

let server: ChildProcess
let tmpDir: string
const PORT = 4849
const BASE = `http://127.0.0.1:${PORT}`
const DOCS = '/docs-test'
const isWindows = process.platform === 'win32'

function post(body: object) {
  return fetch(`${BASE}/api/notes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function assertPortFree(): Promise<void> {
  try {
    await fetch(`${BASE}/api/notes`)
  } catch {
    return
  }
  throw new Error(`Port ${PORT} already in use: a previous test server is probably still running`)
}

function waitForServer(timeoutMs = 120_000): Promise<void> {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(`${BASE}/api/notes`)
        if (res.ok) return resolve()
      } catch {}
      if (Date.now() - start > timeoutMs) return reject(new Error('Server start timeout'))
      setTimeout(tick, 200)
    }
    tick()
  })
}

before(async () => {
  await assertPortFree()
  tmpDir = mkdtempSync(join(tmpdir(), 'board-test-'))
  const dbPath = join(tmpDir, 'test.db')

  server = spawn('npx', ['nuxt', 'dev', '--host', '127.0.0.1', '--port', String(PORT)], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, BOARD_DB_PATH: dbPath, BOARD_DOCS_ROOT: DOCS, NODE_ENV: 'test' },
    stdio: 'ignore',
    // Own process group, so the whole tree (npx + nuxt) can be stopped at the end.
    // On Windows npx is a .cmd, which needs a shell; the tree is killed with taskkill instead.
    detached: !isWindows,
    shell: isWindows,
    windowsHide: true,
  })

  await waitForServer()
})

after(() => {
  if (server?.pid) {
    if (isWindows) spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' })
    else process.kill(-server.pid, 'SIGTERM')
  }
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
})

// fetch refuses to set the Host header: node:http sends it as given.
function statusWithHost(host: string, path = '/api/notes'): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: PORT, path, headers: { host } }, (res) => {
      res.resume()
      resolve(res.statusCode ?? 0)
    })
    req.on('error', reject)
    req.end()
  })
}

test('Host : une requête au nom d\'un autre site est refusée (DNS rebinding)', async () => {
  assert.equal(await statusWithHost('exemple.invalid'), 403)
  assert.equal(await statusWithHost(`exemple.invalid:${PORT}`), 403)
  assert.equal(await statusWithHost('exemple.invalid', '/'), 403)
  assert.equal(await statusWithHost(`127.0.0.1:${PORT}`), 200)
  assert.equal(await statusWithHost(`localhost:${PORT}`), 200)
})

test('GET /api/notes returns empty array initially', async () => {
  const res = await fetch(`${BASE}/api/notes`)
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), [])
})

test('POST then GET roundtrip', async () => {
  const post = await fetch(`${BASE}/api/notes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Hello', body: 'World' }),
  })
  assert.equal(post.status, 201)
  const created = await post.json()
  assert.equal(created.title, 'Hello')
  assert.equal(created.body, 'World')
  assert.ok(created.id)
  assert.ok(created.created_at)

  const list = await (await fetch(`${BASE}/api/notes`)).json()
  assert.equal(list.length, 1)
  assert.equal(list[0].id, created.id)
})

test('POST without body returns 400', async () => {
  const res = await fetch(`${BASE}/api/notes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'no body' }),
  })
  assert.equal(res.status, 400)
})

test('GET /api/notes?q=xxx filters', async () => {
  await fetch(`${BASE}/api/notes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ body: 'needle in haystack' }),
  })
  const hit = await (await fetch(`${BASE}/api/notes?q=needle`)).json()
  assert.ok(hit.length >= 1)
  assert.ok(hit.some((n: { body: string }) => n.body.includes('needle')))

  const miss = await (await fetch(`${BASE}/api/notes?q=zzznotfoundzzz`)).json()
  assert.equal(miss.length, 0)
})

test('DELETE removes a note', async () => {
  const created = await (
    await fetch(`${BASE}/api/notes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: 'to delete' }),
    })
  ).json()

  const del = await fetch(`${BASE}/api/notes/${created.id}`, { method: 'DELETE' })
  assert.equal(del.status, 204)

  const list = await (await fetch(`${BASE}/api/notes`)).json()
  assert.ok(!list.find((n: { id: number }) => n.id === created.id))
})

test('DELETE /api/notes removes all notes', async () => {
  await fetch(`${BASE}/api/notes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ body: 'to clear' }),
  })

  const del = await fetch(`${BASE}/api/notes`, { method: 'DELETE' })
  assert.equal(del.status, 200)
  assert.ok((await del.json()).deleted.length >= 1)

  const list = await (await fetch(`${BASE}/api/notes`)).json()
  assert.equal(list.length, 0)
})

test('project is the first folder under the docs root', async () => {
  const inProject = await (await post({ body: 'a', file_path: `${DOCS}/alpha/feature/plan.md` })).json()
  const atRoot = await (await post({ body: 'b', file_path: `${DOCS}/loose.md` })).json()
  const outside = await (await post({ body: 'c', file_path: '/elsewhere/beta/plan.md' })).json()
  const noFile = await (await post({ body: 'd' })).json()

  assert.equal(inProject.project, 'alpha')
  assert.equal(atRoot.project, null)
  assert.equal(outside.project, null)
  assert.equal(noFile.project, null)

  const list = await (await fetch(`${BASE}/api/notes`)).json()
  assert.equal(list.find((n: { id: number }) => n.id === inProject.id).project, 'alpha')
})

test('DELETE /api/notes?project=X only removes that project', async () => {
  await fetch(`${BASE}/api/notes`, { method: 'DELETE' })
  await post({ body: 'm', file_path: `${DOCS}/alpha/f/plan.md` })
  await post({ body: 'n', file_path: `${DOCS}/beta/f/plan.md` })
  await post({ body: 'o' })

  const del = await fetch(`${BASE}/api/notes?project=alpha`, { method: 'DELETE' })
  assert.equal(del.status, 200)
  assert.equal((await del.json()).deleted.length, 1)

  const list = await (await fetch(`${BASE}/api/notes`)).json()
  assert.deepEqual(list.map((n: { body: string }) => n.body).sort(), ['n', 'o'])
})

test('DELETE /api/notes?project= removes notes without project', async () => {
  await fetch(`${BASE}/api/notes`, { method: 'DELETE' })
  await post({ body: 'n', file_path: `${DOCS}/beta/f/plan.md` })
  await post({ body: 'o' })
  await post({ body: 'r', file_path: `${DOCS}/loose.md` })

  await fetch(`${BASE}/api/notes?project=`, { method: 'DELETE' })

  const list = await (await fetch(`${BASE}/api/notes`)).json()
  assert.deepEqual(list.map((n: { body: string }) => n.body), ['n'])
})

test('POST accepts several files; project comes from the first one', async () => {
  const note = await (
    await post({ body: 'multi', files: [`${DOCS}/beta/a/plan.md`, `${DOCS}/alpha/b/plan.pdf`] })
  ).json()
  assert.deepEqual(note.files, [`${DOCS}/beta/a/plan.md`, `${DOCS}/alpha/b/plan.pdf`])
  assert.equal(note.project, 'beta')

  const legacy = await (await post({ body: 'legacy', file_path: `${DOCS}/alpha/c/plan.md` })).json()
  assert.deepEqual(legacy.files, [`${DOCS}/alpha/c/plan.md`])

  const bad = await post({ body: 'x', files: ['relative/path.md'] })
  assert.equal(bad.status, 400)
})

test('GET /api/notes/:id/files/:index downloads the attached file', async () => {
  const path = join(tmpDir, 'plan à lire.md')
  writeFileSync(path, '# Plan\n')
  const note = await (await post({ body: 'with file', files: [path] })).json()

  const res = await fetch(`${BASE}/api/notes/${note.id}/files/0`)
  assert.equal(res.status, 200)
  assert.equal(await res.text(), '# Plan\n')
  assert.match(res.headers.get('content-disposition') ?? '', /attachment; filename\*=UTF-8''plan%20%C3%A0%20lire\.md/)

  assert.equal((await fetch(`${BASE}/api/notes/${note.id}/files/1`)).status, 404)
})

test('POST /api/reveal refuse un chemin relatif', async () => {
  const res = await fetch(`${BASE}/api/reveal`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: 'docs/a.md' }),
  })
  assert.equal(res.status, 400)
})

test('POST /api/reveal renvoie 404 pour un fichier absent', async () => {
  const res = await fetch(`${BASE}/api/reveal`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: join(homedir(), 'board-test-fichier-absent.md') }),
  })
  assert.equal(res.status, 404)
})

function patch(id: number, body: object) {
  return fetch(`${BASE}/api/notes/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

test('PATCH ne remplace que les champs envoyés', async () => {
  const created = await (await post({ title: 'Avant', body: 'corps avant', files: [`${DOCS}/beta/a/plan.md`] })).json()
  assert.equal(created.updated_at, null)

  const res = await patch(created.id, { body: 'corps après' })
  assert.equal(res.status, 200)
  const updated = await res.json()
  assert.equal(updated.body, 'corps après')
  assert.equal(updated.title, 'Avant')
  assert.deepEqual(updated.files, [`${DOCS}/beta/a/plan.md`])
  assert.equal(updated.created_at, created.created_at)
  assert.ok(updated.updated_at)

  const renamed = await (await patch(created.id, { title: 'Après' })).json()
  assert.equal(renamed.title, 'Après')
  assert.equal(renamed.body, 'corps après')

  const list = await (await fetch(`${BASE}/api/notes`)).json()
  const listed = list.find((n: { id: number }) => n.id === created.id)
  assert.equal(listed.title, 'Après')
  assert.ok(listed.updated_at)
})

test('PATCH files remplace les fichiers joints et le projet', async () => {
  const created = await (await post({ body: 'x', files: [`${DOCS}/beta/a/plan.md`] })).json()

  const moved = await (await patch(created.id, { files: [`${DOCS}/alpha/b/plan.md`, `${DOCS}/alpha/b/plan.pdf`] })).json()
  assert.deepEqual(moved.files, [`${DOCS}/alpha/b/plan.md`, `${DOCS}/alpha/b/plan.pdf`])
  assert.equal(moved.project, 'alpha')

  const detached = await (await patch(created.id, { files: [] })).json()
  assert.deepEqual(detached.files, [])
  assert.equal(detached.project, null)
})

test('PATCH garde la note à sa place dans la liste', async () => {
  await fetch(`${BASE}/api/notes`, { method: 'DELETE' })
  const older = await (await post({ body: 'ancienne' })).json()
  await post({ body: 'récente' })

  await patch(older.id, { body: 'ancienne modifiée' })

  const list = await (await fetch(`${BASE}/api/notes`)).json()
  assert.deepEqual(list.map((n: { body: string }) => n.body), ['récente', 'ancienne modifiée'])
})

test('PATCH refuse une modification invalide', async () => {
  const created = await (await post({ body: 'x' })).json()

  assert.equal((await patch(created.id, {})).status, 400)
  assert.equal((await patch(created.id, { body: '' })).status, 400)
  assert.equal((await patch(created.id, { files: ['relative.md'] })).status, 400)
  assert.equal((await patch(999_999, { body: 'y' })).status, 404)
  assert.equal((await patch(0, { body: 'y' })).status, 400)
})

function capture(body: object) {
  return fetch(`${BASE}/api/capture`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

test('le projet vient du dossier de travail quand la note n\'a pas de fichier', async () => {
  const fromRepo = await (await post({ body: 'a', cwd: join(tmpDir, 'mon-projet') })).json()
  const fromDocs = await (await post({ body: 'b', cwd: `${DOCS}/alpha/sous-dossier` })).json()
  const fromHome = await (await post({ body: 'c', cwd: homedir() })).json()
  const fileWins = await (await post({ body: 'd', cwd: join(tmpDir, 'mon-projet'), files: [`${DOCS}/beta/a/plan.md`] })).json()

  assert.equal(fromRepo.project, 'mon-projet')
  assert.equal(fromRepo.cwd, join(tmpDir, 'mon-projet'))
  assert.equal(fromDocs.project, 'alpha')
  assert.equal(fromHome.project, null)
  assert.equal(fileWins.project, 'beta')

  assert.equal((await post({ body: 'x', cwd: 'relatif' })).status, 400)
})

test('DELETE /api/notes?project=X suit aussi le projet du dossier de travail', async () => {
  await fetch(`${BASE}/api/notes`, { method: 'DELETE' })
  await post({ body: 'garder' })
  await post({ body: 'effacer', cwd: join(tmpDir, 'jetable') })

  await fetch(`${BASE}/api/notes?project=jetable`, { method: 'DELETE' })
  const list = await (await fetch(`${BASE}/api/notes`)).json()
  assert.deepEqual(list.map((n: { body: string }) => n.body), ['garder'])
})

test('POST /api/capture crée les notes une seule fois, même après suppression', async () => {
  await fetch(`${BASE}/api/notes`, { method: 'DELETE' })
  const payload = {
    session_id: 'session-1',
    cwd: join(tmpDir, 'capture'),
    notes: [
      { title: 'Première', body: 'un' },
      { title: null, body: 'deux' },
    ],
  }

  const first = await (await capture(payload)).json()
  assert.equal(first.created.length, 2)
  assert.equal(first.skipped, 0)

  const list = await (await fetch(`${BASE}/api/notes`)).json()
  const premiere = list.find((n: { title: string }) => n.title === 'Première')
  assert.equal(premiere.project, 'capture')
  assert.equal(premiere.session_id, 'session-1')

  // Rejouer le transcript (hook suivant, session reprise) ne recrée rien, pas même une note supprimée.
  await fetch(`${BASE}/api/notes/${premiere.id}`, { method: 'DELETE' })
  const again = await (await capture({ ...payload, session_id: 'session-2' })).json()
  assert.deepEqual(again, { created: [], skipped: 2 })
  assert.equal((await (await fetch(`${BASE}/api/notes`)).json()).length, 1)

  const added = await (await capture({ ...payload, notes: [...payload.notes, { title: 'Nouvelle', body: 'trois' }] })).json()
  assert.equal(added.created.length, 1)
})

test('POST /api/capture refuse un payload invalide', async () => {
  assert.equal((await capture({ notes: 'x' })).status, 400)
  assert.equal((await capture({ notes: [{ title: 't', body: '' }] })).status, 400)
})

test('épingler : PATCH pinned ne marque pas la note comme modifiée', async () => {
  const created = await (await post({ body: 'à épingler' })).json()
  assert.equal(created.pinned_at, null)

  const pinned = await (await patch(created.id, { pinned: true })).json()
  assert.ok(pinned.pinned_at)
  assert.equal(pinned.updated_at, null)

  // Ré-épingler garde la date d'épinglage d'origine.
  const again = await (await patch(created.id, { pinned: true })).json()
  assert.equal(again.pinned_at, pinned.pinned_at)

  const unpinned = await (await patch(created.id, { pinned: false })).json()
  assert.equal(unpinned.pinned_at, null)

  assert.equal((await patch(created.id, { pinned: 'oui' })).status, 400)
})

test('épingler : « Tout effacer » garde les notes épinglées', async () => {
  await fetch(`${BASE}/api/notes`, { method: 'DELETE' })
  for (const n of (await (await fetch(`${BASE}/api/notes`)).json()) as { id: number }[]) {
    await fetch(`${BASE}/api/notes/${n.id}`, { method: 'DELETE' })
  }
  await post({ body: 'épinglée', pinned: true, cwd: join(tmpDir, 'garde') })
  await post({ body: 'ordinaire', cwd: join(tmpDir, 'garde') })
  await post({ body: 'ailleurs' })

  await fetch(`${BASE}/api/notes?project=garde`, { method: 'DELETE' })
  let bodies = (await (await fetch(`${BASE}/api/notes`)).json()).map((n: { body: string }) => n.body).sort()
  assert.deepEqual(bodies, ['ailleurs', 'épinglée'])

  await fetch(`${BASE}/api/notes`, { method: 'DELETE' })
  bodies = (await (await fetch(`${BASE}/api/notes`)).json()).map((n: { body: string }) => n.body)
  assert.deepEqual(bodies, ['épinglée'])
})

test('épingler : une note capturée avec <note pin> arrive épinglée', async () => {
  const res = await (await capture({ notes: [{ title: 'Réf', body: 'épinglée par Claude', pinned: true }] })).json()
  const list = await (await fetch(`${BASE}/api/notes`)).json()
  assert.ok(list.find((n: { id: number }) => n.id === res.created[0]).pinned_at)
})

test('corbeille : une note supprimée disparaît puis revient avec restore', async () => {
  const created = await (await post({ body: 'à la corbeille', files: [join(tmpDir, 'plan à lire.md')] })).json()
  assert.equal((await fetch(`${BASE}/api/notes/${created.id}`, { method: 'DELETE' })).status, 204)
  assert.equal((await fetch(`${BASE}/api/notes/${created.id}`, { method: 'DELETE' })).status, 404)

  let list = await (await fetch(`${BASE}/api/notes`)).json()
  assert.ok(!list.some((n: { id: number }) => n.id === created.id))
  assert.equal((await patch(created.id, { body: 'x' })).status, 404)
  assert.equal((await fetch(`${BASE}/api/notes/${created.id}/files/0`)).status, 404)

  const res = await fetch(`${BASE}/api/notes/restore`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ids: [created.id, 999_999] }),
  })
  const { restored } = await res.json()
  assert.deepEqual(restored.map((n: { id: number }) => n.id), [created.id])
  assert.deepEqual(restored[0].files, created.files)

  list = await (await fetch(`${BASE}/api/notes`)).json()
  assert.ok(list.some((n: { id: number }) => n.id === created.id))
})

test('corbeille : « Tout effacer » renvoie les notes effacées, restaurables', async () => {
  await post({ body: 'effacée puis rendue', cwd: join(tmpDir, 'retour') })
  const { deleted } = await (await fetch(`${BASE}/api/notes?project=retour`, { method: 'DELETE' })).json()
  assert.equal(deleted.length, 1)

  await fetch(`${BASE}/api/notes/restore`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ids: deleted }),
  })
  const list = await (await fetch(`${BASE}/api/notes`)).json()
  assert.ok(list.some((n: { body: string }) => n.body === 'effacée puis rendue'))

  const bad = await fetch(`${BASE}/api/notes/restore`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ids: ['x'] }),
  })
  assert.equal(bad.status, 400)
})

test('projet : une note écrite dans un sous-dossier va dans le dépôt git qui le contient', async () => {
  const repo = join(tmpDir, 'mon-depot')
  mkdirSync(join(repo, '.git'), { recursive: true })
  mkdirSync(join(repo, 'src', 'lib'), { recursive: true })

  const note = await (await post({ body: 'depuis src/lib', cwd: join(repo, 'src', 'lib') })).json()
  assert.equal(note.project, 'mon-depot')
  // Le dossier réel est gardé : la commande de reprise de session en a besoin.
  assert.equal(note.cwd, join(repo, 'src', 'lib'))
})

// Talks to the MCP server over stdio, as Claude Code does.
async function mcpSession(cwd: string, messages: object[]): Promise<Map<number, any>> {
  const child = spawn(process.execPath, [fileURLToPath(new URL('../scripts/mcp-server.mjs', import.meta.url))], {
    cwd,
    env: { ...process.env, BOARD_URL: BASE },
    stdio: ['pipe', 'pipe', 'inherit'],
  })
  const responses = new Map<number, any>()
  const expected = messages.filter((m: any) => m.id !== undefined).length
  let buffer = ''
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('MCP timeout')), 15_000)
    child.stdout!.on('data', (chunk) => {
      buffer += chunk
      let newline
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const message = JSON.parse(buffer.slice(0, newline))
        buffer = buffer.slice(newline + 1)
        responses.set(message.id, message)
        if (responses.size === expected) {
          clearTimeout(timer)
          resolve()
        }
      }
    })
    for (const message of messages) child.stdin!.write(`${JSON.stringify(message)}\n`)
  })
  child.kill()
  return responses
}

test('MCP : initialize, liste des outils, recherche dans le projet courant et lecture', async () => {
  const project = join(tmpDir, 'projet-mcp')
  mkdirSync(join(project, '.git'), { recursive: true })
  const pinned = await (await post({ title: 'Déploiement', body: 'scp puis restart', cwd: project, pinned: true })).json()
  await post({ title: 'Autre projet', body: 'scp ailleurs', cwd: join(tmpDir, 'ailleurs') })

  const call = (id: number, name: string, args: object) => ({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } })
  const responses = await mcpSession(project, [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    call(3, 'board_search', { query: 'scp' }),
    call(4, 'board_search', { query: 'scp', scope: 'tous' }),
    call(5, 'board_read', { id: pinned.id }),
    call(6, 'board_read', { id: 999_999 }),
    { jsonrpc: '2.0', id: 7, method: 'nimporte/quoi' },
  ])

  assert.equal(responses.get(1).result.protocolVersion, '2025-06-18')
  assert.equal(responses.get(1).result.serverInfo.name, 'claude-board')
  assert.deepEqual(responses.get(2).result.tools.map((t: { name: string }) => t.name), ['board_search', 'board_read'])

  const inProject = responses.get(3).result.content[0].text
  assert.match(inProject, /Déploiement/)
  assert.match(inProject, /épinglée/)
  assert.doesNotMatch(inProject, /Autre projet/)
  assert.match(responses.get(4).result.content[0].text, /Autre projet/)

  const read = responses.get(5).result.content[0].text
  assert.match(read, /# Déploiement/)
  assert.match(read, /scp puis restart/)
  assert.equal(responses.get(6).result.isError, true)
  assert.equal(responses.get(7).error.code, -32601)
})
