import { createDefaultAppData } from '#shared/utils/appData'
import { readAppData } from '../utils/appDataStore'

export default defineEventHandler(async (event) => {
  try {
    const { raw, rev } = await readAppData()
    // Revision travels in a header so the body keeps the exact shape older clients expect
    setHeader(event, 'X-Data-Rev', rev)
    if (!raw) return createDefaultAppData()
    return JSON.parse(raw)
  } catch (err) {
    console.error('Failed to read from Redis:', err)
    // Do NOT return empty defaults as 200 — client would treat that as truth and may overwrite Redis
    throw createError({ statusCode: 503, statusMessage: 'Storage unavailable' })
  }
})
