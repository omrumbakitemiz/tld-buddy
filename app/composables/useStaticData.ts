import { ref, shallowRef, computed } from 'vue'
import type { GameMap, GameScene, Item, MapConnection, POI } from '~/types'
import type { MapCalibration } from '#shared/utils/live'

/** Read-only game data shipped in public/data, loaded once per page. */

const maps = shallowRef<GameMap[]>([])
const items = shallowRef<Item[]>([])
const pois = shallowRef<POI[]>([])
const connections = shallowRef<MapConnection[]>([])
const gameScenes = shallowRef<GameScene[]>([])
const calibration = shallowRef<MapCalibration>({})
const ready = ref(false)
let started = false

async function fetchJson(url: string): Promise<unknown> {
  try {
    const res = await fetch(url, { cache: 'no-cache' })
    return res.ok ? await res.json() : null
  } catch {
    console.warn(`Could not load ${url}`)
    return null
  }
}

async function loadJson<T>(url: string): Promise<T[]> {
  const data = await fetchJson(url)
  return Array.isArray(data) ? (data as T[]) : []
}

async function loadObject<T>(url: string): Promise<T | null> {
  const data = await fetchJson(url)
  return data && typeof data === 'object' && !Array.isArray(data) ? (data as T) : null
}

function start() {
  if (started || typeof window === 'undefined') return
  started = true
  Promise.all([
    loadJson<Item>('/data/items.json'),
    loadJson<GameMap>('/data/maps.json'),
    loadJson<POI>('/data/pois.json'),
    loadJson<MapConnection>('/data/map-connections.json'),
    loadJson<GameScene>('/data/game-scenes.json'),
    loadObject<MapCalibration>('/data/map-calibration.json'),
  ]).then(([i, m, p, c, s, cal]) => {
    items.value = i
    maps.value = m
    pois.value = p
    connections.value = c
    gameScenes.value = s
    calibration.value = cal ?? {}
  }).finally(() => {
    ready.value = true
  })
}

const itemsById = computed(() => new Map(items.value.map((i) => [i.id, i])))
const mapsById = computed(() => new Map(maps.value.map((m) => [m.id, m])))
const poisById = computed(() => new Map(pois.value.map((p) => [p.id, p])))
const itemCategories = computed(() => {
  const counts = new Map<string, number>()
  for (const item of items.value) {
    if (item.category) counts.set(item.category, (counts.get(item.category) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([name, count]) => ({ name, count }))
})

/** Thumbnails are pre-scaled copies in /maps/thumbs (scripts/make-map-thumbs.sh). */
export function thumbnailUrl(imageUrl: string): string {
  return imageUrl.replace(/^\/maps\//, '/maps/thumbs/')
}

export function useStaticData() {
  start()
  return {
    maps,
    items,
    pois,
    connections,
    gameScenes,
    calibration,
    ready,
    itemsById,
    mapsById,
    poisById,
    itemCategories,
    getItem: (id: string) => itemsById.value.get(id),
    getMap: (id: string | null | undefined) => (id ? mapsById.value.get(id) : undefined),
    getPOI: (id: string) => poisById.value.get(id),
  }
}
