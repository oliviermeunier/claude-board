// Shared by the board scripts: where things live, and how to start or stop the server.
import { spawn, spawnSync } from 'node:child_process'
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
export const SYSTEMD_UNIT = join(homedir(), '.config', 'systemd', 'user', 'board.service')
const START_TIMEOUT_MS = 15_000

// How to start the server through its service, or null when it has none on this system.
export function serviceStartCommand(platform, unitInstalled) {
  if (platform !== 'linux' || !unitInstalled) return null
  return { command: 'systemctl', args: ['--user', 'start', 'board.service'] }
}

// The unit serves the address chosen at setup: an address overridden for this call is not its own.
function ownService() {
  const overridden = process.env.NITRO_HOST || process.env.NITRO_PORT || process.env.BOARD_URL
  return serviceStartCommand(process.platform, !overridden && existsSync(SYSTEMD_UNIT))
}

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

// Starts the built server unless it already answers: through its systemd service when it has one,
// detached otherwise. Returns a status message.
export async function startServer() {
  if (await isUp()) return { ok: true, message: `board déjà actif → ${BOARD_URL}` }
  if (!existsSync(SERVER_ENTRY)) {
    return { ok: false, message: `${SERVER_ENTRY} absent — lancer « npm run setup » dans ${ROOT}` }
  }

  // A detached server would hold the port and keep the service from ever starting again.
  const service = ownService()
  if (service && spawnSync(service.command, service.args, { stdio: 'ignore' }).status === 0) {
    return (await waitUntil(isUp, START_TIMEOUT_MS))
      ? { ok: true, message: `board démarré (service systemd) → ${BOARD_URL}` }
      : { ok: false, message: `le service ne répond pas après ${START_TIMEOUT_MS / 1000}s — voir « journalctl --user -u board »` }
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
