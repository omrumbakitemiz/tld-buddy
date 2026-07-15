import { createClient, type RedisClientType } from 'redis'
import { getRedisUrl } from './config'

let client: RedisClientType | null = null
let connecting: Promise<RedisClientType> | null = null

export async function getRedis(): Promise<RedisClientType> {
  if (client?.isOpen) return client

  if (!connecting) {
    connecting = (async () => {
      try {
        const url = getRedisUrl()
        const redis = createClient({ url })
        redis.on('error', (err) => console.error('Redis error:', err))
        await redis.connect()
        client = redis as RedisClientType
        return client
      } catch (err) {
        // Allow a later request to retry instead of sticking on a rejected promise
        connecting = null
        client = null
        throw err
      }
    })()
  }

  return connecting
}
