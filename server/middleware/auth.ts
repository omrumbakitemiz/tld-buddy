import { isAuthenticated } from '../utils/auth'

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname

  // Only user data needs a session; auth routes and static assets stay public
  if (!path.startsWith('/api/data')) return

  if (!(await isAuthenticated(event).catch(() => false))) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
})
