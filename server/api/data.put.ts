import { getRedis } from '../utils/redis'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const redis = await getRedis()
    await redis.set('app-data', JSON.stringify(body))
    return { ok: true }
  } catch (err) {
    console.error('Failed to write to Redis:', err)
    throw createError({ statusCode: 500, statusMessage: 'Failed to save data' })
  }
})
