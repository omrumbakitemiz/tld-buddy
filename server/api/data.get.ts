import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const DEFAULT_DATA = {
  runs: [],
  currentRunId: null,
  currentMapId: null,
  markers: [],
  enabledPOIs: [],
  poiPins: [],
  stashedItems: [],
}

export default defineEventHandler(async () => {
  try {
    const data = await redis.get('app-data')
    return data ?? DEFAULT_DATA
  } catch (err) {
    console.error('Failed to read from Upstash:', err)
    return DEFAULT_DATA
  }
})
