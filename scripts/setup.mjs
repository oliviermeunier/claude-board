#!/usr/bin/env node
// Installation du board, identique sous Linux, macOS et Windows.
//
//   npm install && npm run setup        installe (à relancer après chaque mise à jour du dépôt)
//   npm run setup -- --no-autostart     sans lancement automatique à l'ouverture de session
//   npm run setup -- --no-claude        sans les hooks Claude Code
//   npm run setup:remove                désinstalle (la base ~/.board/board.db est conservée)
//
// Étapes :
//   1. build Nuxt
//   2. commandes board-note et board-server dans ~/.local/bin
//   3. hooks Claude Code dans ~/.claude/settings.json (copie de sauvegarde : settings.json.board-backup)
//   4. lancement à l'ouverture de session : service systemd --user (Linux), LaunchAgent (macOS),
//      raccourci dans le dossier Démarrage (Windows)
//   5. démarrage du serveur

import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, dirname, join, resolve } from 'node:path'
import { BOARD_URL, HOST, LOG_FILE, PORT, ROOT, SERVER_ENTRY, isUp, startServer, stopServer, waitUntil } from './lib/board.mjs'
import { addBoardHooks, removeBoardHooks } from './lib/claude-settings.mjs'

const args = new Set(process.argv.slice(2))
const REMOVE = args.has('--remove')
const AUTOSTART = !args.has('--no-autostart')
const CLAUDE = !args.has('--no-claude')

const IS_WINDOWS = process.platform === 'win32'
const IS_MAC = process.platform === 'darwin'
const NODE = process.execPath
const HOME = homedir()
const BIN_DIR = join(HOME, '.local', 'bin')
const COMMANDS = ['board-note', 'board-server']
const CLAUDE_SETTINGS = join(HOME, '.claude', 'settings.json')
const SYSTEMD_UNIT = join(HOME, '.config', 'systemd', 'user', 'board.service')
const LAUNCH_AGENT = join(HOME, 'Library', 'LaunchAgents', 'local.board.server.plist')
const STARTUP_DIR = join(
  process.env.APPDATA ?? join(HOME, 'AppData', 'Roaming'),
  'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup',
)
const STARTUP_SHORTCUT = join(STARTUP_DIR, 'Claude Board.lnk')
// Name used before the app was called Claude Board.
const LEGACY_STARTUP_SHORTCUT = join(STARTUP_DIR, 'Board.lnk')

const ok = (message) => console.log(`✓ ${message}`)
const warn = (message) => console.warn(`! ${message}`)
const posix = (path) => path.replace(/\\/g, '/')

function run(command, commandArgs, options = {}) {
  return spawnSync(command, commandArgs, { stdio: 'ignore', ...options })
}

function hasSystemd() {
  return !IS_WINDOWS && !IS_MAC && run('systemctl', ['--user', 'show-environment']).status === 0
}

// ── 1. Build ────────────────────────────────────────────────────────────────

function build() {
  console.log('→ build (npm run build)…')
  // One command string (npm is npm.cmd on Windows, which needs a shell).
  const result = spawnSync('npm run build', { cwd: ROOT, stdio: 'inherit', shell: true })
  if (result.status !== 0) {
    console.error('Le build a échoué. Si un ancien serveur tourne encore, l\'arrêter puis relancer « npm run setup ».')
    process.exit(1)
  }
  ok('build')
}

// ── 2. Commands ─────────────────────────────────────────────────────────────

function isOurCommand(path) {
  try {
    if (lstatSync(path).isSymbolicLink()) return true // ancien lien vers scripts/board-note
    return readFileSync(path, 'utf8').includes('board-')
  } catch {
    return false
  }
}

function installCommands() {
  mkdirSync(BIN_DIR, { recursive: true })
  for (const name of COMMANDS) {
    const script = join(ROOT, 'scripts', `${name}.mjs`)
    const shPath = join(BIN_DIR, name)
    // Peut être un ancien lien symbolique vers le dépôt : on le supprime pour ne pas écrire à travers.
    rmSync(shPath, { force: true })
    writeFileSync(shPath, `#!/bin/sh\nexec "${posix(NODE)}" "${posix(script)}" "$@"\n`, { mode: 0o755 })
    if (IS_WINDOWS) writeFileSync(join(BIN_DIR, `${name}.cmd`), `@"${NODE}" "${script}" %*\r\n`)
  }
  ok(`commandes ${COMMANDS.join(', ')} → ${BIN_DIR}`)

  const sameDir = (dir) => (IS_WINDOWS ? dir.toLowerCase() : dir) === (IS_WINDOWS ? BIN_DIR.toLowerCase() : BIN_DIR)
  const inPath = (process.env.PATH ?? '').split(delimiter).some((dir) => dir && sameDir(resolve(dir)))
  if (!inPath) warn(`${BIN_DIR} n'est pas dans le PATH : l'y ajouter pour appeler board-note directement.`)
}

function removeCommands() {
  for (const name of COMMANDS) {
    for (const path of [join(BIN_DIR, name), join(BIN_DIR, `${name}.cmd`)]) {
      if (isOurCommand(path)) rmSync(path, { force: true })
    }
  }
  ok('commandes retirées')
}

// ── 3. Claude Code hooks ────────────────────────────────────────────────────

function updateClaudeSettings(transform, label) {
  if (!existsSync(dirname(CLAUDE_SETTINGS))) {
    warn('~/.claude absent (Claude Code pas encore lancé ?) : hooks non installés, relancer « npm run setup » plus tard.')
    return
  }
  let settings = {}
  if (existsSync(CLAUDE_SETTINGS)) {
    const raw = readFileSync(CLAUDE_SETTINGS, 'utf8')
    try {
      settings = raw.trim() ? JSON.parse(raw) : {}
    } catch {
      warn(`${CLAUDE_SETTINGS} n'est pas du JSON valide : hooks non modifiés.`)
      return
    }
    copyFileSync(CLAUDE_SETTINGS, `${CLAUDE_SETTINGS}.board-backup`)
  }
  writeFileSync(CLAUDE_SETTINGS, `${JSON.stringify(transform(settings), null, 2)}\n`)
  ok(label)
}

function installClaudeHooks() {
  const hook = posix(join(ROOT, 'scripts', 'claude-hook.mjs'))
  updateClaudeSettings(
    (settings) => addBoardHooks(settings, (event) => `"${posix(NODE)}" "${hook}" ${event}`),
    `hooks Claude Code (SessionStart, Stop) → ${CLAUDE_SETTINGS}`,
  )
}

// ── 4. Autostart ────────────────────────────────────────────────────────────

const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function installAutostart() {
  if (IS_WINDOWS) {
    rmSync(LEGACY_STARTUP_SHORTCUT, { force: true })
    const quote = (s) => `'${s.replace(/'/g, "''")}'`
    const script = [
      `$lnk = (New-Object -ComObject WScript.Shell).CreateShortcut(${quote(STARTUP_SHORTCUT)})`,
      `$lnk.TargetPath = ${quote(NODE)}`,
      `$lnk.Arguments = ${quote(`"${join(ROOT, 'scripts', 'board-server.mjs')}" start`)}`,
      `$lnk.WorkingDirectory = ${quote(ROOT)}`,
      // Fenêtre réduite : elle ne fait que passer, le serveur tourne détaché et caché.
      '$lnk.WindowStyle = 7',
      '$lnk.Save()',
    ].join('; ')
    const result = run('powershell', ['-NoProfile', '-NonInteractive', '-Command', script])
    if (result.status === 0) ok(`lancement à l'ouverture de session → ${STARTUP_SHORTCUT}`)
    else warn('raccourci de démarrage non créé : le hook Claude Code démarrera le serveur au besoin.')
    return 'manual'
  }

  if (IS_MAC) {
    mkdirSync(dirname(LAUNCH_AGENT), { recursive: true })
    writeFileSync(
      LAUNCH_AGENT,
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>local.board.server</string>
  <key>ProgramArguments</key>
  <array><string>${xml(NODE)}</string><string>${xml(SERVER_ENTRY)}</string></array>
  <key>WorkingDirectory</key><string>${xml(ROOT)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>NODE_ENV</key><string>production</string>
    <key>NITRO_HOST</key><string>${xml(HOST)}</string>
    <key>NITRO_PORT</key><string>${xml(PORT)}</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${xml(LOG_FILE)}</string>
  <key>StandardErrorPath</key><string>${xml(LOG_FILE)}</string>
</dict>
</plist>
`,
    )
    run('launchctl', ['unload', LAUNCH_AGENT])
    if (run('launchctl', ['load', '-w', LAUNCH_AGENT]).status === 0) {
      ok(`LaunchAgent → ${LAUNCH_AGENT}`)
      return 'service'
    }
    warn('launchctl load a échoué : démarrage manuel.')
    return 'manual'
  }

  if (hasSystemd()) {
    mkdirSync(dirname(SYSTEMD_UNIT), { recursive: true })
    writeFileSync(
      SYSTEMD_UNIT,
      `[Unit]
Description=Claude Board — notes locales des sessions Claude Code
After=network.target

[Service]
Type=simple
WorkingDirectory=${ROOT}
Environment=NODE_ENV=production
Environment=NITRO_HOST=${HOST}
Environment=NITRO_PORT=${PORT}
ExecStart="${NODE}" "${SERVER_ENTRY}"
Restart=on-failure
RestartSec=3

[Install]
WantedBy=default.target
`,
    )
    run('systemctl', ['--user', 'daemon-reload'])
    run('systemctl', ['--user', 'enable', 'board.service'])
    run('systemctl', ['--user', 'restart', 'board.service'])
    ok(`service systemd --user → ${SYSTEMD_UNIT}`)
    return 'service'
  }

  warn('ni systemd ni launchd : pas de lancement automatique, le hook Claude Code démarrera le serveur au besoin.')
  return 'manual'
}

function removeAutostart() {
  if (IS_WINDOWS) {
    rmSync(STARTUP_SHORTCUT, { force: true })
    rmSync(LEGACY_STARTUP_SHORTCUT, { force: true })
  }
  else if (IS_MAC) {
    if (existsSync(LAUNCH_AGENT)) run('launchctl', ['unload', '-w', LAUNCH_AGENT])
    rmSync(LAUNCH_AGENT, { force: true })
  } else if (existsSync(SYSTEMD_UNIT)) {
    run('systemctl', ['--user', 'disable', '--now', 'board.service'])
    rmSync(SYSTEMD_UNIT, { force: true })
    run('systemctl', ['--user', 'daemon-reload'])
  }
  ok('lancement automatique retiré')
}

// Stops every way the server may be running, so that the build can replace .output
// (Windows locks the loaded better-sqlite3 binary).
async function stopEverything() {
  await stopServer()
  if (IS_MAC && existsSync(LAUNCH_AGENT)) run('launchctl', ['unload', LAUNCH_AGENT])
  if (!IS_WINDOWS && !IS_MAC && existsSync(SYSTEMD_UNIT)) run('systemctl', ['--user', 'stop', 'board.service'])
}

// ── Main ────────────────────────────────────────────────────────────────────

// Nuxt 4 needs Node ^20.19.0 || >=22.12.0.
const [major, minor] = process.versions.node.split('.').map(Number)
const supported = (major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major > 22
if (!supported) {
  console.error(`Node ${process.versions.node} : il faut Node 20.19+, 22.12+ ou plus récent (24 recommandé).`)
  process.exit(1)
}

if (REMOVE) {
  await stopEverything()
  removeAutostart()
  removeCommands()
  updateClaudeSettings(removeBoardHooks, 'hooks Claude Code retirés')
  console.log('\nClaude Board désinstallé. Notes conservées dans ~/.board/board.db.')
  process.exit(0)
}

await stopEverything()
build()
installCommands()
if (CLAUDE) installClaudeHooks()

let started
if (AUTOSTART && installAutostart() === 'service') {
  started = await waitUntil(isUp, 15_000)
  if (!started) warn(`le service ne répond pas encore — voir ${LOG_FILE}`)
} else {
  if (!AUTOSTART) removeAutostart()
  const result = await startServer()
  started = result.ok
  ;(result.ok ? ok : warn)(result.message)
}

console.log(`
Claude Board : ${BOARD_URL}${started ? '' : ' (pas encore démarré)'}
Depuis un terminal : board-note "Titre" <<< "corps en markdown"
Depuis Claude Code : demander une note ; Claude l'écrit entre <note> et </note>, elle arrive sur le board.
(Les sessions Claude Code déjà ouvertes doivent être relancées pour prendre les hooks.)`)
