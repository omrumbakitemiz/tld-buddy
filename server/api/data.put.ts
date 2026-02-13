import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
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
