export default defineEventHandler((event) => {
  deleteCookie(event, 'tld-buddy-session', {
    path: '/',
  })

  return { ok: true }
})
