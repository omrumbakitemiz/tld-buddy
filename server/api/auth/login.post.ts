import { createSessionToken } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const { password } = await readBody<{ password: string }>(event)

  const appPassword = process.env.APP_PASSWORD
  if (!appPassword) {
    throw createError({ statusCode: 500, statusMessage: 'APP_PASSWORD not configured' })
  }

  if (!password || password !== appPassword) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid password' })
  }

  const token = createSessionToken()

  setCookie(event, 'tld-buddy-session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })

  return { ok: true }
})
