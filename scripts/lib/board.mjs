// Shared by the board scripts: where things live, and how to start or stop the server.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const SERVER_ENTRY = join(ROOT, '.output', 'server', 'index.mjs')
export const STATE_DIR = join(homedir(), '.board')
export const PID_FILE = join(STATE_DIR, 'server.pid')
export const LOG_FILE = join(STATE_DIR, 'server.log')
export const HOST = process.env.NITRO_HOST || '127.0.0.1'
export const PORT = process.env.NITRO_PORT || '4848'
export const BOARD_URL = process.env.BOARD_URL || `http://${HOST}:${PORT}`
const START_TIMEOUT_MS = 15_000

export async function isUp() {
  try {
    const res = await fetch(`${BOARD_URL}/api/notes?q=board-healthcheck`, { signal: AbortSignal.timeout(1000) })
    return res.ok
  } catch {
    return false
  }
}

export async function waitUntil(predicate, timeoutMs) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return true
    await new Promise((r) => setTimeout(r, 250))
  }
  return false
}

// Starts the built server, detached, unless it already answers. Returns a status message.
export async function startServer() {
  if (await isUp()) return { ok: true, message: `board déjà actif → ${BOARD_URL}` }
  if (!existsSync(SERVER_ENTRY)) {
    return { ok: false, message: `${SERVER_ENTRY} absent — lancer « npm run setup » dans ${ROOT}` }
  }

  mkdirSync(STATE_DIR, { recursive: true })
  const log = openSync(LOG_FILE, 'a')
  // process.execPath: the Node that compiled better-sqlite3 (native module) at install time.
  const child = spawn(process.execPath, [SERVER_ENTRY], {
    cwd: ROOT,
    detached: true,
    stdio: ['ignore', log, log],
    windowsHide: true,
    env: { ...process.env, NODE_ENV: 'production', NITRO_HOST: HOST, NITRO_PORT: PORT },
  })
  child.unref()
  writeFileSync(PID_FILE, String(child.pid))

  if (!(await waitUntil(isUp, START_TIMEOUT_MS))) {
    return { ok: false, message: `pas de réponse après ${START_TIMEOUT_MS / 1000}s — voir ${LOG_FILE}` }
  }
  return { ok: true, message: `board démarré (pid ${child.pid}) → ${BOARD_URL}` }
}

// Stops a server started by startServer (one run by systemd or launchd is left alone).
export async function stopServer() {
  if (!existsSync(PID_FILE)) {
    return (await isUp())
      ? `board actif mais géré ailleurs (service système) : pas de ${PID_FILE}`
      : 'board arrêté'
  }
  const pid = Number(readFileSync(PID_FILE, 'utf8').trim())
  try {
    process.kill(pid)
  } catch {
    // Already stopped.
  }
  rmSync(PID_FILE, { force: true })
  await waitUntil(async () => !(await isUp()), 5000)
  return `board arrêté (pid ${pid})`
}
