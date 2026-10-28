import { ref, shallowRef, computed } from 'vue'
import type { GameMap, Item, MapConnection, POI } from '~/types'

/** Read-only game data shipped in public/data, loaded once per page. */

const maps = shallowRef<GameMap[]>([])
const items = shallowRef<Item[]>([])
const pois = shallowRef<POI[]>([])
const connections = shallowRef<MapConnection[]>([])
const ready = ref(false)
let started = false

async function loadJson<T>(url: string): Promise<T[]> {
  try {
    const res = await fetch(url, { cache: 'no-cache' })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? (data as T[]) : []
  } catch {
    console.warn(`Could not load ${url}`)
    return []
  }
}

function start() {
  if (started || typeof window === 'undefined') return
  started = true
  Promise.all([
    loadJson<Item>('/data/items.json'),
    loadJson<GameMap>('/data/maps.json'),
    loadJson<POI>('/data/pois.json'),
    loadJson<MapConnection>('/data/map-connections.json'),
  ]).then(([i, m, p, c]) => {
    items.value = i
    maps.value = m
    pois.value = p
    connections.value = c
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
