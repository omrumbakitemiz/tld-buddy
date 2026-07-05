/** Resolve server secrets at runtime (Docker injects env after build). */
export function getAppPassword(): string {
  const config = useRuntimeConfig()
  return (
    config.appPassword
    || process.env.NUXT_APP_PASSWORD
    || process.env.APP_PASSWORD
    || ''
  )
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
