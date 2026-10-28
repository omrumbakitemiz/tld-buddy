import { isAuthenticated } from '../../../utils/auth'
import { currentLiveMessage, pendingLiveEvents, subscribeLive } from '../../../utils/live'

const KEEPALIVE_MS = 15_000

/**
 * Server-sent events for signed-in browsers:
 * - `state`: the latest game state, right away and then on every update from the mod
 * - `game`: game events (mark here, pickups, drops) not yet acked, right away and then as they happen
 * Ping events keep proxies (Cloudflare) from closing an idle stream while the game is not running.
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
  const push = (name: string, data: unknown) => void stream.push({ event: name, data: JSON.stringify(data) })

  const unsubscribe = subscribeLive((b) => (b.kind === 'state' ? push('state', b.message) : push('game', b.event)))
  const keepalive = setInterval(() => void stream.push({ event: 'ping', data: '' }), KEEPALIVE_MS)
  stream.onClosed(async () => {
    unsubscribe()
    clearInterval(keepalive)
    await stream.close()
  })

  push('state', currentLiveMessage())
  for (const e of pendingLiveEvents()) push('game', e)
  return stream.send()
})
