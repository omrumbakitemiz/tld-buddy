import { cleanLiveState, validateLiveState, type LiveState } from '#shared/utils/live'
import { readLimitedBody } from '../../../utils/body'
import { getModToken } from '../../../utils/config'
import { isModRequest, publishLiveState } from '../../../utils/live'

const MAX_BODY_BYTES = 16 * 1024

/**
 * The game mod posts the player's scene and position here about once a second.
 * Authenticated with MOD_TOKEN (not the app session): the mod is not a browser.
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
  const problem = validateLiveState(body)
  if (problem) throw createError({ statusCode: 400, statusMessage: 'Invalid live state', message: problem })

  publishLiveState(cleanLiveState(body as LiveState))
  setResponseStatus(event, 204)
  return null
})
