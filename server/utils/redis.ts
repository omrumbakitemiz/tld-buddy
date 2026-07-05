import { createClient, type RedisClientType } from 'redis'

let client: RedisClientType | null = null
let connecting: Promise<RedisClientType> | null = null

export async function getRedis(): Promise<RedisClientType> {
  if (client?.isOpen) return client

  if (!connecting) {
    connecting = (async () => {
      const config = useRuntimeConfig()
      const url = config.redisUrl || 'redis://localhost:6379'

      const redis = createClient({ url })
      redis.on('error', (err) => console.error('Redis error:', err))
      await redis.connect()
      client = redis as RedisClientType
      return client
    })()
  }

  return connecting
}
