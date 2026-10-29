import type { LiveState, TrailPoint } from '#shared/utils/live'
import { TRAIL_STEP_M } from '#shared/utils/live'
import { withStorage } from './redis'

/**
 * Breadcrumb trail per game save: where the player walked, one point every few metres.
 * Kept in Redis (not in the app document, which syncs whole on every change), capped.
 */
const MAX_POINTS = 20_000
const key = (save: string) => `trail:${save}`

/** Last point kept per save, so a new sample needs no Redis read. */
const last = new Map<string, TrailPoint>()
let lastErrorLog = 0

/** The point to add for this state, or null when the player hasn't moved far enough. */
function nextPoint(state: LiveState, now: number): { save: string; point: TrailPoint } | null {
  const save = state.save?.id
  const here = state.scenes[0]
  if (!save || !here) return null
  const prev = last.get(save)
  if (prev && prev.s === here.scene && Math.hypot(prev.x - here.x, prev.z - here.z) < TRAIL_STEP_M) return null
  const point: TrailPoint = { s: here.scene, x: Math.round(here.x * 10) / 10, z: Math.round(here.z * 10) / 10, t: now }
  if (state.world) point.d = state.world.day
  last.set(save, point)
  return { save, point }
}

/** Records the state's position when it moved on; returns the new point to broadcast. */
export function recordTrail(state: LiveState, now = Date.now()): { save: string; point: TrailPoint } | null {
  const next = nextPoint(state, now)
  if (!next) return null
  // Best effort: the live view must not wait for or fail on storage
  withStorage(async (redis) => {
    await redis.multi().rPush(key(next.save), JSON.stringify(next.point)).lTrim(key(next.save), -MAX_POINTS, -1).exec()
  }).catch((err) => {
    if (Date.now() - lastErrorLog > 60_000) {
      lastErrorLog = Date.now()
      console.error('Trail write failed:', err)
    }
  })
  return next
}

export async function readTrail(save: string): Promise<TrailPoint[]> {
  const raw = await withStorage((redis) => redis.lRange(key(save), 0, -1))
  const points: TrailPoint[] = []
  for (const line of raw) {
    try {
      points.push(JSON.parse(line) as TrailPoint)
    } catch {
      // skip a damaged entry
    }
  }
  return points
}

export async function clearTrail(save: string) {
  last.delete(save)
  await withStorage((redis) => redis.del(key(save)))
}
