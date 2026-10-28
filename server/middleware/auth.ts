import { isAuthenticated } from '../utils/auth'

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname

  // Only user data needs a session; auth routes and static assets stay public
  if (!path.startsWith('/api/data')) return

  let ok: boolean
  try {
    ok = await isAuthenticated(event)
  } catch (err) {
    // Session secret lives in Redis: storage down is "try later", not "signed out"
    console.error('Session check failed:', err)
    throw createError({ statusCode: 503, statusMessage: 'Storage unavailable' })
  }
  if (!ok) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
})
