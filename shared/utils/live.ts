// Live game state sent by the TLD mod, and how it maps onto the app's region maps.
// Shared by the API (validation) and the client (positioning).

import type { GameScene } from '../types/game'

/** One scene the player was in: the current one first, then the ones they came from. */
export interface LiveSceneSample {
  scene: string // GameManager.m_ActiveScene, e.g. "LakeRegion" or "CampOffice"
  x: number
  y: number
  z: number
  heading: number // degrees, 0 = +z (north), 90 = +x (east)
}

/** Body of POST /api/live/v1/state. */
export interface LiveState {
  /**
   * Most recent first. scenes[0] is where the player is now; later entries are the last
   * position in each scene they left, so an interior can be placed at its door outside.
   */
  scenes: LiveSceneSample[]
}

/** Affine transform from world x/z to app map x/y (Leaflet CRS.Simple: y up from the bottom). */
export interface MapTransform {
  matrix: number[] // [a, b, c, d, e, f]: mapX = a·x + b·z + c, mapY = d·x + e·z + f
  rmsPx?: number
  imageWidth: number
  imageHeight: number
}

/** public/data/map-calibration.json, keyed by game scene. */
export type MapCalibration = Record<string, { mapId: string; default?: MapTransform; interloper?: MapTransform }>

export interface LivePosition {
  mapId: string
  /** Scene the position is taken from (the region, also while indoors). */
  scene: string
  /** Player is inside a scene that is not on a map (building, cave); position is where they entered. */
  indoors: boolean
  /** Map position, or null when the region is known but not calibrated yet. */
  point: { x: number; y: number } | null
  /** Heading on screen, degrees clockwise from up. Null indoors or without calibration. */
  rotation: number | null
}

export const MAX_LIVE_SCENES = 8
const SCENE_NAME = /^[A-Za-z0-9_]{1,64}$/
const MAX_COORD = 100_000

/** Problem with a POST body, or null when it is a valid LiveState. */
export function validateLiveState(body: unknown): string | null {
  if (!body || typeof body !== 'object') return 'body must be an object'
  const scenes = (body as { scenes?: unknown }).scenes
  if (!Array.isArray(scenes) || scenes.length < 1 || scenes.length > MAX_LIVE_SCENES) {
    return `scenes must be an array of 1–${MAX_LIVE_SCENES} entries`
  }
  for (const [i, s] of scenes.entries()) {
    if (!s || typeof s !== 'object') return `scenes[${i}] must be an object`
    const { scene, x, y, z, heading } = s as Record<string, unknown>
    if (typeof scene !== 'string' || !SCENE_NAME.test(scene)) return `scenes[${i}].scene is not a scene name`
    for (const [key, v] of Object.entries({ x, y, z, heading })) {
      if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > MAX_COORD) return `scenes[${i}].${key} must be a finite number`
    }
  }
  return null
}

/** Keeps only the known fields, so nothing else from the request is stored or broadcast. */
export function cleanLiveState(body: LiveState): LiveState {
  return { scenes: body.scenes.map(({ scene, x, y, z, heading }) => ({ scene, x, y, z, heading })) }
}

export function applyTransform(t: MapTransform, x: number, z: number): { x: number; y: number } {
  const [a, b, c, d, e, f] = t.matrix as [number, number, number, number, number, number]
  return { x: a * x + b * z + c, y: d * x + e * z + f }
}

/** Screen rotation (clockwise from up) of a world heading after the map transform. */
export function headingOnMap(t: MapTransform, heading: number): number {
  const [a, b, , d, e] = t.matrix as [number, number, number, number, number, number]
  const rad = (heading * Math.PI) / 180
  const dx = Math.sin(rad), dz = Math.cos(rad)
  // Map y points up, like screen "up" for the arrow
  const mx = a * dx + b * dz, my = d * dx + e * dz
  const deg = (Math.atan2(mx, my) * 180) / Math.PI
  return (deg + 360) % 360
}

/**
 * Where the player is on the app's maps. Walks the scene trail from the current scene back,
 * so inside a building the position is the door of the region they entered it from.
 * Uses the calibration for the run's artwork, falling back to the other artwork's only when
 * `imageFor` confirms both images have the same size.
 */
export function resolveLivePosition(
  state: LiveState | null,
  scenes: GameScene[],
  calibration: MapCalibration,
  variant: 'default' | 'interloper',
  imageFor?: (mapId: string) => { imageWidth: number; imageHeight: number } | undefined,
): LivePosition | null {
  if (!state) return null
  for (const [i, sample] of state.scenes.entries()) {
    const known = scenes.find((s) => s.scene === sample.scene)
    if (!known) continue
    const cal = calibration[sample.scene]
    const other = variant === 'default' ? 'interloper' : 'default'
    const fallback = cal?.[other]
    const image = imageFor?.(known.mapId)
    const sameImage = !!image && fallback?.imageWidth === image.imageWidth && fallback?.imageHeight === image.imageHeight
    const t = cal?.[variant] ?? (sameImage ? fallback : undefined)
    const indoors = i > 0
    return {
      mapId: known.mapId,
      scene: sample.scene,
      indoors,
      point: t ? applyTransform(t, sample.x, sample.z) : null,
      rotation: t && !indoors ? headingOnMap(t, sample.heading) : null,
    }
  }
  return null
}
