import { Redis } from '@upstash/redis'

let redis: Redis | null = null

export function getRedis(): Redis {
  if (!redis) {
    const config = useRuntimeConfig()
    redis = new Redis({
      url: config.kvRestApiUrl,
      token: config.kvRestApiToken,
    })
  }
  return redis
}
