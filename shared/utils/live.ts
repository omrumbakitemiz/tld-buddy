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
  /** Map pixels per game metre (≈ world unit), or null without calibration. */
  pxPerMeter: number | null
}

/** An item in a game event: aimed at (mark), picked up or put down. */
export interface LiveMarkItem {
  name: string // GearItem.DisplayName, e.g. "Hatchet"
  gearName?: string // prefab name, e.g. "GEAR_Hatchet"
  /** The object's id in the game (ObjectGuid), the same in every session of a save. */
  objectId?: string
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
  /** Where the aimed item lies (same scene as scenes[0]); the marker goes there, not at the player. */
  at?: { x: number; y: number; z: number } | null
}

/**
 * Items the player took (`pickup`: from the ground or a container) or put down (`drop`: on the
 * ground, or into a container). Pickups loot the nearest marker for the item; drops add a stash.
 */
export interface LiveItemsEvent {
  id: string
  type: 'pickup' | 'drop'
  createdAt: number
  scenes: LiveSceneSample[]
  items: LiveMarkItem[]
  /** Name of the container the items came from or went into, e.g. "Locker". */
  container?: string | null
}

export type LiveGameEvent = LiveMarkEvent | LiveItemsEvent

export const MAX_LIVE_SCENES = 8
const SCENE_NAME = /^[A-Za-z0-9_]{1,64}$/
const EVENT_ID = /^[A-Za-z0-9-]{8,64}$/
const GEAR_NAME = /^[A-Za-z0-9_]{1,80}$/
const OBJECT_ID = /^[A-Za-z0-9_-]{1,64}$/
const MAX_COORD = 100_000
const MAX_ITEM_NAME = 100
const MAX_QUANTITY = 9999
export const MAX_EVENT_ITEMS = 50
const MAX_CONTAINER_NAME = 60

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

function validateItem(item: unknown, at: string): string | null {
  if (!item || typeof item !== 'object') return `${at} must be an object`
  const { name, gearName, quantity, objectId } = item as Record<string, unknown>
  if (typeof name !== 'string' || !name.trim() || name.length > MAX_ITEM_NAME) return `${at}.name must be a short string`
  if (gearName !== undefined && (typeof gearName !== 'string' || !GEAR_NAME.test(gearName))) return `${at}.gearName is not a prefab name`
  if (objectId !== undefined && (typeof objectId !== 'string' || !OBJECT_ID.test(objectId))) return `${at}.objectId is not an object id`
  if (quantity !== undefined && (!Number.isInteger(quantity) || (quantity as number) < 1 || (quantity as number) > MAX_QUANTITY)) {
    return `${at}.quantity must be a whole number 1–${MAX_QUANTITY}`
  }
  return null
}

/** Problem with a POST /api/live/v1/events body, or null when it is a valid game event. */
export function validateLiveEvent(body: unknown): string | null {
  if (!body || typeof body !== 'object') return 'body must be an object'
  const { id, type, scenes, item, items, container, at } = body as Record<string, unknown>
  if (typeof id !== 'string' || !EVENT_ID.test(id)) return 'id must be 8–64 letters, digits or dashes'
  if (type !== 'mark' && type !== 'pickup' && type !== 'drop') return 'type must be "mark", "pickup" or "drop"'
  const problem = validateScenes(scenes)
  if (problem) return problem
  if (type === 'mark') {
    if (at !== undefined && at !== null) {
      if (typeof at !== 'object') return 'at must be an object'
      for (const key of ['x', 'y', 'z']) {
        const v = (at as Record<string, unknown>)[key]
        if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > MAX_COORD) return `at.${key} must be a finite number`
      }
    }
    return item === undefined || item === null ? null : validateItem(item, 'item')
  }
  if (!Array.isArray(items) || items.length < 1 || items.length > MAX_EVENT_ITEMS) return `items must be an array of 1–${MAX_EVENT_ITEMS} entries`
  for (const [i, it] of items.entries()) {
    const p = validateItem(it, `items[${i}]`)
    if (p) return p
  }
  if (container !== undefined && container !== null && (typeof container !== 'string' || container.length > MAX_CONTAINER_NAME)) {
    return 'container must be a short string'
  }
  return null
}

const cleanItem = (item: LiveMarkItem): LiveMarkItem => ({ name: item.name.trim(), gearName: item.gearName, quantity: item.quantity, objectId: item.objectId })

/** Keeps only the known fields of a validated event, and stamps the server's time. */
export function cleanLiveEvent(body: Omit<LiveMarkEvent, 'createdAt'> | Omit<LiveItemsEvent, 'createdAt'>, createdAt: number): LiveGameEvent {
  const scenes = cleanScenes(body.scenes)
  if (body.type === 'mark') {
    const at = body.at ? { x: body.at.x, y: body.at.y, z: body.at.z } : null
    return { id: body.id, type: 'mark', createdAt, scenes, item: body.item ? cleanItem(body.item) : null, at }
  }
  // No control characters: the name ends up in a marker note
  const container = body.container?.replace(/\p{Cc}/gu, '').trim() || null
  return { id: body.id, type: body.type, createdAt, scenes, items: body.items.map(cleanItem), container }
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
  // The game prefixes items the player hasn't had yet with "New" ("New Pork and Beans")
  const plain = fold(item.name.replace(/^\s*new\s+/i, ''))
  const byName = items.find((i) => fold(i.name) === name) ?? items.find((i) => fold(i.name) === plain)
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
  /** Game object id, for marks of one specific item (not stashes, which can hold several). */
  gameId?: string
  /** Set when this mark repeats an existing marker (the key pressed again): add nothing. */
  repeatOf?: string
  /** With repeatOf: the object now lies elsewhere, so the marker should move to this plan's spot. */
  moved?: boolean
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
    /** The run's markers, to spot the mark key pressed again on the same thing. */
    markers?: MarkerLike[]
  },
): PlannedMark | null {
  // The item's own spot when known (it can be a few metres from the player); indoors the door wins anyway
  const [here, ...before] = event.scenes
  const scenes = event.at && here ? [{ ...here, x: event.at.x, y: event.at.y, z: event.at.z }, ...before] : event.scenes
  const pos = resolveLivePosition({ scenes }, ctx.scenes, ctx.calibration, ctx.variant, ctx.imageFor)
  if (!pos?.point) return null
  const item = matchItem(event.item, ctx.items)
  const notes: string[] = []
  if (pos.indoors) notes.push(`Inside ${sceneLabel(event.scenes[0]!.scene)}`)
  // Keep what the game called it when the app has no such item, so it can be sorted later
  if (!item && event.item) notes.push(`Game: ${event.item.name}`)
  const plan: PlannedMark = {
    id: markerIdForEvent(event),
    mapId: pos.mapId,
    x: pos.point.x,
    y: pos.point.y,
    itemId: item?.id ?? UNSORTED_ITEM_ID,
    name: item?.name ?? UNSORTED_ITEM_NAME,
    quantity: event.item?.quantity ?? 1,
    gameId: event.item?.objectId,
    note: notes.length ? notes.join(' · ') : undefined,
  }
  const near = (m: MarkerLike) => Math.hypot(m.x - plan.x, m.y - plan.y) <= REPEAT_MARK_RADIUS_M * (pos.pxPerMeter ?? 0)
  const repeat = ctx.markers?.find((m) => !m.lootedAt && m.mapId === plan.mapId && (plan.gameId
    ? m.gameId === plan.gameId
    : !m.gameId && m.itemId === plan.itemId && near(m) && (
      // A stash of it lies right there (the player put it down): whenever that was
      isStashOf(m.note, plan.note)
      // Without an object id: the same thing marked moments ago
      || (m.note === plan.note && Math.abs(event.createdAt - markerTime(m.id)) <= REPEAT_MARK_WINDOW_MS))))
  if (repeat) {
    plan.repeatOf = repeat.id
    // The same object somewhere else: the player moved it, so its marker should follow
    if (plan.gameId && !near(repeat)) plan.moved = true
  }
  return plan
}

/** A mark of the same item this close to an earlier one (soon after, or its stash) is a repeat. */
export const REPEAT_MARK_RADIUS_M = 1.5
export const REPEAT_MARK_WINDOW_MS = 2 * 60 * 1000

/** A stash note ("Stashed · Inside Camp Office") for the same place as a mark's note. */
function isStashOf(stashNote: string | undefined, markNote: string | undefined): boolean {
  if (!stashNote?.startsWith('Stashed')) return false
  const rest = (note: string | undefined) => (note ?? '').split(' · ').filter((p) => !p.startsWith('Stashed'))
  return rest(stashNote).join(' · ') === rest(markNote).join(' · ')
}

/** Epoch ms in a `marker-<ms>-<rand>` id; 0 when absent. */
const markerTime = (id: string) => Number(id.split('-')[1]) || 0

/** Within this distance a pickup counts as taking a marked item (covers hand-placed markers too). */
export const PICKUP_RADIUS_M = 20
/** Drops of the same item this close to an earlier one add to that stash instead of a new marker. */
export const STASH_MERGE_RADIUS_M = 3

/** What a pickup or drop needs to know about the run's markers. */
export interface MarkerLike {
  id: string
  mapId: string
  itemId: string
  x: number
  y: number
  quantity: number
  note?: string
  lootedAt?: number | null
  gameId?: string
}

export type MarkerChange =
  | { kind: 'add'; marker: PlannedMark }
  | { kind: 'quantity'; markerId: string; quantity: number; name: string; by: number }
  | { kind: 'looted'; markerId: string; name: string }

const INSIDE = 'Inside '

/**
 * Marker changes for a pickup or drop, or null when the position can't be placed on a calibrated
 * map (kept and retried later, like marks). Items are applied one after another, so picking up
 * two of the same thing loots two markers.
 *
 * A marker made with the mark key knows its game object, and only a pickup of that object loots
 * it. Otherwise, indoors every marker sits at the door, so there a pickup only matches markers
 * noted as inside the same building; outdoors it matches the nearest marker for the item within
 * PICKUP_RADIUS_M that isn't inside a building. A pickup leaves the rest when the marker holds more.
 */
export function planItemsEvent<I extends { id: string; name: string }>(
  event: LiveItemsEvent,
  ctx: {
    scenes: GameScene[]
    calibration: MapCalibration
    variant: 'default' | 'interloper'
    imageFor?: (mapId: string) => { imageWidth: number; imageHeight: number } | undefined
    items: I[]
    /** The run's markers. */
    markers: MarkerLike[]
  },
): MarkerChange[] | null {
  const pos = resolveLivePosition({ scenes: event.scenes }, ctx.scenes, ctx.calibration, ctx.variant, ctx.imageFor)
  if (!pos?.point || !pos.pxPerMeter) return null
  const at = pos.point
  const inside = pos.indoors ? `${INSIDE}${sceneLabel(event.scenes[0]!.scene)}` : null
  const distance = (m: MarkerLike) => Math.hypot(m.x - at.x, m.y - at.y) / pos.pxPerMeter!
  // Working copy, so later items in this event see the changes of earlier ones
  const markers = ctx.markers.filter((m) => m.mapId === pos.mapId).map((m) => ({ ...m }))
  const changes: MarkerChange[] = []

  for (const [i, it] of event.items.entries()) {
    const item = matchItem(it, ctx.items)
    const quantity = it.quantity ?? 1
    if (event.type === 'pickup') {
      // The very object marked with the mark key, wherever its marker is
      const exact = it.objectId ? markers.find((m) => !m.lootedAt && m.gameId === it.objectId) : undefined
      // Otherwise nothing the app knows can have a marker
      if (!exact && !item) continue
      const candidates = exact ? [exact] : markers.filter((m) => !m.lootedAt && m.itemId === item!.id
        // A marker for another object of the same kind is not this one
        && !(m.gameId && it.objectId)
        && (inside ? !!m.note?.includes(inside) : !m.note?.includes(INSIDE) && distance(m) <= PICKUP_RADIUS_M))
      // A stash in the container it came from first, then the closest
      const fromContainer = (m: MarkerLike) => (event.container && m.note?.includes(event.container) ? 0 : 1)
      candidates.sort((a, b) => fromContainer(a) - fromContainer(b) || distance(a) - distance(b))
      const target = candidates[0]
      if (!target) continue
      const name = item?.name ?? it.name
      if (target.quantity > quantity) {
        target.quantity -= quantity
        changes.push({ kind: 'quantity', markerId: target.id, quantity: target.quantity, name, by: -quantity })
      } else {
        target.lootedAt = event.createdAt
        changes.push({ kind: 'looted', markerId: target.id, name })
      }
      continue
    }

    const notes = [event.container ? `Stashed in ${event.container}` : 'Stashed']
    if (inside) notes.push(inside)
    if (!item) notes.push(`Game: ${it.name}`)
    const note = notes.join(' · ')
    const itemId = item?.id ?? UNSORTED_ITEM_ID
    const name = item?.name ?? UNSORTED_ITEM_NAME
    const stash = markers.find((m) => !m.lootedAt && m.itemId === itemId && m.note === note && distance(m) <= STASH_MERGE_RADIUS_M)
    if (stash) {
      stash.quantity += quantity
      changes.push({ kind: 'quantity', markerId: stash.id, quantity: stash.quantity, name, by: quantity })
      continue
    }
    // Same shape as other marker ids (the time is read from them), unique per item of the event
    const marker: PlannedMark = { id: `${markerIdForEvent(event)}-${i}`, mapId: pos.mapId, x: at.x, y: at.y, itemId, name, quantity, note }
    markers.push({ ...marker, lootedAt: null })
    changes.push({ kind: 'add', marker })
  }
  return changes
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
      pxPerMeter: t ? Math.sqrt(Math.abs(t.matrix[0]! * t.matrix[4]! - t.matrix[1]! * t.matrix[3]!)) : null,
    }
  }
  return null
}
