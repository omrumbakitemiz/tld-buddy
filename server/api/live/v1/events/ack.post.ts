import { isAuthenticated } from '../../../../utils/auth'
import { readLimitedBody } from '../../../../utils/body'
import { ackLiveEvents } from '../../../../utils/live'

const MAX_BODY_BYTES = 8 * 1024

/** A browser added the markers for these mark events: stop sending them to new tabs. */
export default defineEventHandler(async (event) => {
  let ok: boolean
  try {
    ok = await isAuthenticated(event)
  } catch (err) {
    console.error('Session check failed:', err)
    throw createError({ statusCode: 503, statusMessage: 'Storage unavailable' })
  }
  if (!ok) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const text = await readLimitedBody(event, MAX_BODY_BYTES)
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid JSON' })
  }
  const ids = (body as { ids?: unknown })?.ids
  if (!Array.isArray(ids) || ids.length > 100 || !ids.every((id) => typeof id === 'string' && id.length <= 64)) {
    throw createError({ statusCode: 400, statusMessage: 'ids must be an array of event ids' })
  }
  ackLiveEvents(ids as string[])
  setResponseStatus(event, 204)
  return null
})
