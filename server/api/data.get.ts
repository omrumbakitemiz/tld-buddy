import { getRedis } from '../utils/redis'

const DEFAULT_DATA = {
  runs: [],
  currentRunId: null,
  currentMapId: null,
  markers: [],
  enabledPOIs: [],
  poiPins: [],
  stashedItems: [],
  recentMapIds: [],
  travelMode: false,
  travelLeftMapId: null,
  travelRightMapId: null,
}

export default defineEventHandler(async () => {
  try {
    const redis = await getRedis()
    const raw = await redis.get('app-data')
    if (!raw) return DEFAULT_DATA
    return JSON.parse(raw)
  } catch (err) {
    console.error('Failed to read from Redis:', err)
    return DEFAULT_DATA
  }
})
