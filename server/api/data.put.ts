import { getRedis } from '../utils/redis'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    await getRedis().set('app-data', JSON.stringify(body))
    return { ok: true }
  } catch (err) {
    console.error('Failed to write to Upstash:', err)
    throw createError({ statusCode: 500, statusMessage: 'Failed to save data' })
  }
})
