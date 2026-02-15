import { validateSessionToken } from '../utils/auth'

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname

  // Only protect /api/data routes -- skip auth routes and everything else
  if (!path.startsWith('/api/data')) {
    return
  }

  const token = getCookie(event, 'tld-buddy-session')

  if (!token || !validateSessionToken(token)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
})
