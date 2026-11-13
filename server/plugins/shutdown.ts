import { closeStreams } from '../utils/events'

// Nitro waits for open connections before exiting, up to NITRO_SHUTDOWN_TIMEOUT (30 s):
// an SSE stream never ends by itself, so each open board tab would hold the server that long.
export default defineNitroPlugin(() => {
  // Without Nitro's own signal handlers, a listener here would keep the process alive.
  if (import.meta.dev || process.env.NITRO_SHUTDOWN_DISABLED) return
  const signals = (process.env.NITRO_SHUTDOWN_SIGNALS || 'SIGTERM SIGINT').split(' ').map((s) => s.trim())
  for (const signal of signals) process.once(signal, closeStreams)
})
