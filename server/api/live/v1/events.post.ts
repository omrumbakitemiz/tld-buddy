import { cleanLiveEvent, validateLiveEvent, type LiveMarkEvent } from '#shared/utils/live'
import { readLimitedBody } from '../../../utils/body'
import { getModToken } from '../../../utils/config'
import { isModRequest, publishLiveEvent } from '../../../utils/live'

const MAX_BODY_BYTES = 16 * 1024

/**
 * One-off events from the game mod ("mark here"). Held until a browser acks them, so the
 * marker is added even if no TLD Buddy tab is open at the moment of the key press.
 * Idempotent per event id: the mod retries until it gets an answer.
 */
export default defineEventHandler(async (event) => {
  if (!getModToken()) {
    throw createError({ statusCode: 403, statusMessage: 'Live bridge disabled', message: 'Set MOD_TOKEN on the server to enable it.' })
  }
  if (!isModRequest(event)) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const text = await readLimitedBody(event, MAX_BODY_BYTES)
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid JSON' })
  }
  const problem = validateLiveEvent(body)
  if (problem) throw createError({ statusCode: 400, statusMessage: 'Invalid live event', message: problem })

  publishLiveEvent(cleanLiveEvent(body as Omit<LiveMarkEvent, 'createdAt'>, Date.now()))
  setResponseStatus(event, 202)
  return null
})
