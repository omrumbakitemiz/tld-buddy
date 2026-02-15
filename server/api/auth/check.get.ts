import { validateSessionToken } from '../../utils/auth'

export default defineEventHandler((event) => {
  const token = getCookie(event, 'tld-buddy-session')

  if (!token || !validateSessionToken(token)) {
    return { authenticated: false }
  }

  return { authenticated: true }
})
