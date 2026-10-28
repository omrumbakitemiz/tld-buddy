import { isAuthenticated } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    return { authenticated: await isAuthenticated(event) }
  } catch (err) {
    console.error('Session check failed:', err)
    throw createError({ statusCode: 503, statusMessage: 'Storage unavailable' })
  }
})
