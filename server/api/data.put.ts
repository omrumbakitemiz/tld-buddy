import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    await redis.set('app-data', JSON.stringify(body))
    return { ok: true }
  } catch (err) {
    console.error('Failed to write to Upstash:', err)
    throw createError({ statusCode: 500, statusMessage: 'Failed to save data' })
  }
})
