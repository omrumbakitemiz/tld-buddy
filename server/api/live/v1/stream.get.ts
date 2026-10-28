import { isAuthenticated } from '../../../utils/auth'
import { currentLiveMessage, subscribeLive } from '../../../utils/live'

const KEEPALIVE_MS = 15_000

/**
 * Server-sent events with the latest game state for signed-in browsers. Sends the current
 * state right away, then every update from the mod. Ping events keep proxies (Cloudflare)
 * from closing an idle stream while the game is not running.
 */
export default defineEventHandler(async (event) => {
  let ok: boolean
  try {
    ok = await isAuthenticated(event)
  } catch (err) {
    console.error('Session check failed:', err)
    throw createError({ statusCode: 503, statusMessage: 'Storage unavailable' })
  }
  if (!ok) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  // Ask nginx-style proxies not to buffer the stream
  setHeader(event, 'x-accel-buffering', 'no')
  const stream = createEventStream(event)
  const send = (message: unknown) => stream.push({ event: 'state', data: JSON.stringify(message) })

  const unsubscribe = subscribeLive((message) => void send(message))
  const keepalive = setInterval(() => void stream.push({ event: 'ping', data: '' }), KEEPALIVE_MS)
  stream.onClosed(async () => {
    unsubscribe()
    clearInterval(keepalive)
    await stream.close()
  })

  void send(currentLiveMessage())
  return stream.send()
})
