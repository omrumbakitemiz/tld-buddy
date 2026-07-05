import { getCookieSecure } from '../../utils/config'

export default defineEventHandler((event) => {
  deleteCookie(event, 'tld-buddy-session', {
    path: '/',
    secure: getCookieSecure(),
  })

  return { ok: true }
})
