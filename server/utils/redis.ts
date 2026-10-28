import { createClient, type RedisClientType } from 'redis'
import { getRedisUrl } from './config'

/** How long a request waits for Redis before answering 503 instead of hanging. */
const READY_WAIT_MS = 3000

let client: RedisClientType | null = null
let connectPromise: Promise<unknown> | null = null
let lastErrorLog = 0

/**
 * Shared Redis client. It reconnects in the background forever, but requests never
 * queue behind a dead connection: commands fail fast while it is down (no offline
 * queue), so the API can answer 503 and the client keeps its local copy.
 */
export async function getRedis(): Promise<RedisClientType> {
  if (!client) {
    const redis = createClient({
      url: getRedisUrl(),
      disableOfflineQueue: true,
      socket: {
        connectTimeout: READY_WAIT_MS,
        reconnectStrategy: (retries) => Math.min(250 * 2 ** retries, 5000),
      },
    }) as RedisClientType
    redis.on('error', (err) => {
      // A down server errors on every retry; one line every 30 s is enough
      if (Date.now() - lastErrorLog > 30_000) {
        lastErrorLog = Date.now()
        console.error('Redis error:', err)
      }
    })
    client = redis
    connectPromise = redis.connect().catch((err) => {
      console.error('Redis connect failed:', err)
      client = null
      connectPromise = null
    })
  }

  if (!client.isReady) {
    await Promise.race([connectPromise, new Promise((resolve) => setTimeout(resolve, READY_WAIT_MS))])
  }
  if (!client?.isReady) throw new Error('Redis not ready')
  return client
}
