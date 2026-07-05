/** Resolve server secrets at runtime (Docker injects env after build). */
export function getAppPassword(): string {
  const config = useRuntimeConfig()
  const raw =
    config.appPassword
    || process.env.NUXT_APP_PASSWORD
    || process.env.APP_PASSWORD
    || ''
  // Nitro applyEnv uses destr(), so numeric-looking passwords become numbers
  return String(raw)
}

/** Session cookie Secure flag. Set COOKIE_SECURE=false for HTTP-only homelab access. */
export function getCookieSecure(): boolean {
  const raw = process.env.COOKIE_SECURE ?? process.env.NUXT_COOKIE_SECURE
  if (raw !== undefined && raw !== '') {
    return raw === 'true' || raw === '1'
  }
  return process.env.NODE_ENV === 'production'
}

export function getRedisUrl(): string {
  const config = useRuntimeConfig()
  return (
    config.redisUrl
    || process.env.NUXT_REDIS_URL
    || process.env.REDIS_URL
    || 'redis://localhost:6379'
  )
}
