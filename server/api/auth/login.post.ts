import {
  clearLoginFailures, clientKey, createSessionToken, isLoginLocked,
  passwordMatches, recordLoginFailure, setSessionCookie,
} from '../../utils/auth'
import { getAppPassword } from '../../utils/config'

export default defineEventHandler(async (event) => {
  if (!getAppPassword()) {
    throw createError({ statusCode: 500, statusMessage: 'APP_PASSWORD not configured' })
  }

  const key = clientKey(event)
  if (isLoginLocked(key)) {
    throw createError({ statusCode: 429, statusMessage: 'Too many attempts, try again in a few minutes' })
  }

  const body = await readBody<{ password?: unknown }>(event).catch(() => null)
  const submitted = String(body?.password ?? '')
  if (!passwordMatches(submitted)) {
    recordLoginFailure(key)
    throw createError({ statusCode: 401, statusMessage: 'Invalid password' })
  }

  clearLoginFailures(key)
  try {
    setSessionCookie(event, await createSessionToken())
  } catch (err) {
    console.error('Failed to create session:', err)
    throw createError({ statusCode: 503, statusMessage: 'Storage unavailable' })
  }
  return { ok: true }
})
