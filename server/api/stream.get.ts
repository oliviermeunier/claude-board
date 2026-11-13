import { trackStream, useEmitter, type NoteEvent } from '../utils/events'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Content-Type', 'text/event-stream')
  setHeader(event, 'Cache-Control', 'no-cache, no-transform')
  setHeader(event, 'Connection', 'keep-alive')
  setHeader(event, 'X-Accel-Buffering', 'no')
  setResponseStatus(event, 200)

  const res = event.node.res
  res.flushHeaders?.()

  const send = (e: NoteEvent) => {
    res.write(`event: ${e.type}\n`)
    res.write(`data: ${JSON.stringify(e)}\n\n`)
  }

  const emitter = useEmitter()
  const listener = (e: NoteEvent) => send(e)
  emitter.on('note', listener)

  res.write(`: connected ${new Date().toISOString()}\n\n`)
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`)
  }, 25_000)

  const untrack = trackStream(() => res.end())

  await new Promise<void>((resolve) => {
    event.node.req.on('close', () => {
      untrack()
      clearInterval(heartbeat)
      emitter.off('note', listener)
      resolve()
    })
  })
})
