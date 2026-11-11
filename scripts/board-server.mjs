#!/usr/bin/env node
// board-server — démarre, arrête ou interroge le serveur du board.
//
// Usage :
//   board-server start     démarre le serveur en arrière-plan s'il ne répond pas déjà
//   board-server stop      arrête le serveur démarré par « start » (pas celui d'un service systemd/launchd)
//   board-server status    indique si le serveur répond
//
// Variables d'env : NITRO_HOST (défaut 127.0.0.1), NITRO_PORT (défaut 4848), BOARD_DB_PATH, BOARD_DOCS_ROOT.
// Journal : ~/.board/server.log

import { BOARD_URL, isUp, startServer, stopServer } from './lib/board.mjs'

const command = process.argv[2] ?? 'status'

if (command === 'start') {
  const { ok, message } = await startServer()
  ;(ok ? console.log : console.error)(message)
  process.exit(ok ? 0 : 1)
} else if (command === 'stop') {
  console.log(await stopServer())
} else if (command === 'status') {
  const up = await isUp()
  console.log(up ? `board actif → ${BOARD_URL}` : 'board arrêté')
  process.exit(up ? 0 : 3)
} else {
  console.error(`board-server: commande inconnue « ${command} » (start | stop | status)`)
  process.exit(2)
}
