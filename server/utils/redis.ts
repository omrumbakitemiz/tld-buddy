import { createClient, type RedisClientType } from 'redis'
import { getRedisUrl } from './config'

/** How long a request waits for Redis (connection or a single command) before giving up. */
export const REDIS_DEADLINE_MS = 3000

/** Raised for any "storage is down / too slow" condition; handlers answer 503 for it. */
export class StorageUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('Storage unavailable', { cause })
    this.name = 'StorageUnavailableError'
  }
}

let client: RedisClientType | null = null
let connectPromise: Promise<unknown> | null = null
let lastErrorLog = 0

/**
 * Shared Redis client. It reconnects in the background forever, but requests never
 * hang on it: there is no offline queue, every command has a deadline, and the
 * initial wait for a connection is capped. Callers get StorageUnavailableError.
 */
export async function getRedis(): Promise<RedisClientType> {
  if (!client) {
    const redis = createClient({
      url: getRedisUrl(),
      disableOfflineQueue: true,
      commandOptions: { timeout: REDIS_DEADLINE_MS },
      socket: {
        connectTimeout: REDIS_DEADLINE_MS,
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
    await Promise.race([connectPromise, new Promise((resolve) => setTimeout(resolve, REDIS_DEADLINE_MS))])
  }
  if (!client?.isReady) throw new StorageUnavailableError()
  return client
}

/**
 * Run a storage operation under a hard deadline; any Redis failure (down, slow, frozen,
 * disconnect) becomes StorageUnavailableError. The deadline is needed on top of the
 * client's command timeout, which only covers commands not yet written to the socket:
 * a server that accepts the bytes but never answers would otherwise hang the request.
 */
export async function withStorage<T>(fn: (redis: RedisClientType) => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new StorageUnavailableError('deadline exceeded')), REDIS_DEADLINE_MS * 2)
  })
  const work = getRedis().then(fn)
  work.catch(() => {}) // if the deadline wins, a late failure must not become an unhandled rejection
  try {
    return await Promise.race([work, deadline])
  } catch (err) {
    if (err instanceof StorageUnavailableError) throw err
    throw new StorageUnavailableError(err)
  } finally {
    clearTimeout(timer)
  }
}
