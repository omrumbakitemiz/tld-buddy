import { getRedis } from '../utils/redis'

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
    const data = await getRedis().get('app-data')
    return data ?? DEFAULT_DATA
  } catch (err) {
    console.error('Failed to read from Upstash:', err)
    return DEFAULT_DATA
  }
})
