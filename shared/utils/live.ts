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

/** What the player aimed at when they pressed the mark key. */
export interface LiveMarkItem {
  name: string // GearItem.DisplayName, e.g. "Hatchet"
  gearName?: string // prefab name, e.g. "GEAR_Hatchet"
  quantity?: number
}

/** "Mark here" pressed in game. Body of POST /api/live/v1/events (without createdAt). */
export interface LiveMarkEvent {
  id: string // made by the mod, so retries and several tabs can't add the marker twice
  type: 'mark'
  /** Stamped by the server when it accepts the event (the game PC's clock is not trusted). */
  createdAt: number
  scenes: LiveSceneSample[]
  item?: LiveMarkItem | null
}

export const MAX_LIVE_SCENES = 8
const SCENE_NAME = /^[A-Za-z0-9_]{1,64}$/
const EVENT_ID = /^[A-Za-z0-9-]{8,64}$/
const GEAR_NAME = /^[A-Za-z0-9_]{1,80}$/
const MAX_COORD = 100_000
const MAX_ITEM_NAME = 100
const MAX_QUANTITY = 9999

function validateScenes(scenes: unknown): string | null {
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

const cleanScenes = (scenes: LiveSceneSample[]) => scenes.map(({ scene, x, y, z, heading }) => ({ scene, x, y, z, heading }))

/** Problem with a POST body, or null when it is a valid LiveState. */
export function validateLiveState(body: unknown): string | null {
  if (!body || typeof body !== 'object') return 'body must be an object'
  return validateScenes((body as { scenes?: unknown }).scenes)
}

/** Keeps only the known fields, so nothing else from the request is stored or broadcast. */
export function cleanLiveState(body: LiveState): LiveState {
  return { scenes: cleanScenes(body.scenes) }
}

/** Problem with a POST /api/live/v1/events body, or null when it is a valid mark event. */
export function validateLiveEvent(body: unknown): string | null {
  if (!body || typeof body !== 'object') return 'body must be an object'
  const { id, type, scenes, item } = body as Record<string, unknown>
  if (typeof id !== 'string' || !EVENT_ID.test(id)) return 'id must be 8–64 letters, digits or dashes'
  if (type !== 'mark') return 'type must be "mark"'
  const problem = validateScenes(scenes)
  if (problem) return problem
  if (item === undefined || item === null) return null
  if (typeof item !== 'object') return 'item must be an object'
  const { name, gearName, quantity } = item as Record<string, unknown>
  if (typeof name !== 'string' || !name.trim() || name.length > MAX_ITEM_NAME) return 'item.name must be a short string'
  if (gearName !== undefined && (typeof gearName !== 'string' || !GEAR_NAME.test(gearName))) return 'item.gearName is not a prefab name'
  if (quantity !== undefined && (!Number.isInteger(quantity) || (quantity as number) < 1 || (quantity as number) > MAX_QUANTITY)) {
    return `item.quantity must be a whole number 1–${MAX_QUANTITY}`
  }
  return null
}

export function cleanLiveEvent(body: Omit<LiveMarkEvent, 'createdAt'>, createdAt: number): LiveMarkEvent {
  const item = body.item
    ? { name: body.item.name.trim(), gearName: body.item.gearName, quantity: body.item.quantity }
    : null
  return { id: body.id, type: 'mark', createdAt, scenes: cleanScenes(body.scenes), item }
}

// ── Turning a mark event into a marker ──────────────────────────────────────

/** Item id of the placeholder marker when the player aimed at nothing the app knows. */
export const UNSORTED_ITEM_ID = 'unsorted-loot'
export const UNSORTED_ITEM_NAME = 'Unsorted loot'

const fold = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** App item for what the game showed: display name first, then the prefab name without GEAR_. */
export function matchItem<I extends { id: string; name: string }>(item: LiveMarkItem | null | undefined, items: I[]): I | null {
  if (!item) return null
  const name = fold(item.name)
  const byName = items.find((i) => fold(i.name) === name)
  if (byName) return byName
  if (!item.gearName) return null
  const gear = fold(item.gearName.replace(/^GEAR_/i, ''))
  return items.find((i) => fold(i.id) === gear || fold(i.name) === gear) ?? null
}

/**
 * Same id for the same event in every tab and on every retry. Keeps the `marker-<ms>-<rand>`
 * shape of createId, so code that reads the time from marker ids (frecency) still works.
 */
export function markerIdForEvent(event: Pick<LiveMarkEvent, 'id' | 'createdAt'>): string {
  return `marker-${event.createdAt}-${event.id.replace(/-/g, '').slice(0, 10).toLowerCase()}`
}

/** "CampOffice" → "Camp Office", "LakeCabinA" → "Lake Cabin A" (for notes on indoor marks). */
export function sceneLabel(scene: string): string {
  return scene.replace(/_/g, ' ').replace(/([a-z])([A-Z0-9])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
}

export interface PlannedMark {
  id: string
  mapId: string
  x: number
  y: number
  itemId: string
  name: string
  quantity: number
  note?: string
}

/**
 * Marker for a mark event, or null when the position can't be placed on a calibrated map
 * (e.g. the save was loaded inside a building, or the region isn't calibrated yet).
 */
export function planMark<I extends { id: string; name: string }>(
  event: LiveMarkEvent,
  ctx: {
    scenes: GameScene[]
    calibration: MapCalibration
    variant: 'default' | 'interloper'
    imageFor?: (mapId: string) => { imageWidth: number; imageHeight: number } | undefined
    items: I[]
  },
): PlannedMark | null {
  const pos = resolveLivePosition({ scenes: event.scenes }, ctx.scenes, ctx.calibration, ctx.variant, ctx.imageFor)
  if (!pos?.point) return null
  const item = matchItem(event.item, ctx.items)
  const notes: string[] = []
  if (pos.indoors) notes.push(`Inside ${sceneLabel(event.scenes[0]!.scene)}`)
  // Keep what the game called it when the app has no such item, so it can be sorted later
  if (!item && event.item) notes.push(`Game: ${event.item.name}`)
  return {
    id: markerIdForEvent(event),
    mapId: pos.mapId,
    x: pos.point.x,
    y: pos.point.y,
    itemId: item?.id ?? UNSORTED_ITEM_ID,
    name: item?.name ?? UNSORTED_ITEM_NAME,
    quantity: event.item?.quantity ?? 1,
    note: notes.length ? notes.join(' · ') : undefined,
  }
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
