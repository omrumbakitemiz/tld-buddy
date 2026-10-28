import { SESSION_COOKIE, clearSessionCookie, revokeSession } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    await revokeSession(getCookie(event, SESSION_COOKIE))
  } catch (err) {
    // Storage down: the cookie is still cleared below; tell the client revocation didn't happen
    console.error('Failed to revoke session:', err)
    clearSessionCookie(event)
    throw createError({ statusCode: 503, statusMessage: 'Storage unavailable' })
  }
  clearSessionCookie(event)
  return { ok: true }
})
