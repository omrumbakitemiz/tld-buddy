import { ref, computed } from 'vue'
import type { GameMap, Item, Marker, AppData } from '~/types'

const STORAGE_KEY = 'tld-map-v6'

const defaultData: AppData = {
  maps: [],
  items: [],
  markers: [],
  currentMapId: null,
}

const appData = ref<AppData>({ ...defaultData })
let loaded = false
let wikiDataLoaded = false

// Load wiki items from the generated JSON file
async function loadWikiItems(): Promise<Item[]> {
  try {
    const res = await fetch('/data/items.json')
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data)) return []
    return data as Item[]
  } catch {
    console.warn('Could not load wiki items from /data/items.json')
    return []
  }
}

// Load wiki maps from the generated JSON file
async function loadWikiMaps(): Promise<GameMap[]> {
  try {
    const res = await fetch('/data/maps.json')
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data)) return []
    // Convert wiki map format → GameMap format
    return data.map((m: any) => ({
      id: m.id,
      name: m.name,
      imageUrl: m.imageUrl,
      imageWidth: m.imageWidth,
      imageHeight: m.imageHeight,
      createdAt: 0,
      type: m.type ?? 'region',
      wikiUrl: m.wikiUrl,
    })) as GameMap[]
  } catch {
    console.warn('Could not load wiki maps from /data/maps.json')
    return []
  }
}

function load() {
  if (loaded) return
  loaded = true
  if (typeof window === 'undefined') return
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return
  try {
    const parsed = JSON.parse(raw) as Partial<AppData>
    appData.value = {
      maps: Array.isArray(parsed.maps) ? parsed.maps : [],
      items: Array.isArray(parsed.items) ? parsed.items : [],
      markers: Array.isArray(parsed.markers) ? parsed.markers : [],
      currentMapId: parsed.currentMapId ?? null,
    }
  } catch {
    console.error('Failed to load saved data')
  }
}

function save() {
  if (typeof window === 'undefined') return
  // Don't persist wiki data in localStorage -- they come from JSON files
  const toSave = {
    maps: appData.value.maps.filter((m) => m.type === 'custom'),
    items: appData.value.items.filter((i) => i.id.startsWith('custom-')),
    markers: appData.value.markers,
    currentMapId: appData.value.currentMapId,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
}

// Auto-load on first import
if (typeof window !== 'undefined') {
  load()
}

export function useGameData() {
  load()

  // Load wiki data (items + maps) asynchronously on first use
  if (typeof window !== 'undefined' && !wikiDataLoaded) {
    wikiDataLoaded = true

    // Load items and maps in parallel
    Promise.all([loadWikiItems(), loadWikiMaps()]).then(([wikiItems, wikiMaps]) => {
      if (wikiItems.length > 0) {
        const customItems = appData.value.items.filter((i) => i.id.startsWith('custom-'))
        appData.value.items = [...wikiItems, ...customItems]
      }

      if (wikiMaps.length > 0) {
        const customMaps = appData.value.maps.filter((m) => m.type === 'custom')
        appData.value.maps = [...wikiMaps, ...customMaps]

        // Auto-select first map if none selected
        if (!appData.value.currentMapId && appData.value.maps.length > 0) {
          appData.value.currentMapId = appData.value.maps[0].id
        }
      }
    })
  }

  const maps = computed(() => appData.value.maps)
  const items = computed(() => appData.value.items)
  const markers = computed(() => appData.value.markers)
  const currentMapId = computed(() => appData.value.currentMapId)
  const currentMap = computed(() =>
    appData.value.maps.find((m) => m.id === appData.value.currentMapId) ?? null,
  )
  const currentMapMarkers = computed(() =>
    appData.value.markers.filter((m) => m.mapId === appData.value.currentMapId),
  )

  // Maps
  function addMap(map: Omit<GameMap, 'id' | 'createdAt' | 'type'>) {
    const newMap: GameMap = { ...map, id: `map-${Date.now()}`, createdAt: Date.now(), type: 'custom' }
    appData.value.maps.push(newMap)
    if (!appData.value.currentMapId) {
      appData.value.currentMapId = newMap.id
    }
    save()
    return newMap
  }

  function deleteMap(mapId: string) {
    appData.value.maps = appData.value.maps.filter((m) => m.id !== mapId)
    appData.value.markers = appData.value.markers.filter((m) => m.mapId !== mapId)
    if (appData.value.currentMapId === mapId) {
      appData.value.currentMapId = appData.value.maps[0]?.id ?? null
    }
    save()
  }

  function setCurrentMap(mapId: string) {
    appData.value.currentMapId = mapId
    save()
  }

  // Items
  function addItem(name: string, description?: string, category?: string) {
    const newItem: Item = { id: `custom-${Date.now()}`, name, description, category }
    appData.value.items.push(newItem)
    save()
    return newItem
  }

  function deleteItem(itemId: string) {
    appData.value.items = appData.value.items.filter((i) => i.id !== itemId)
    save()
  }

  function getItemById(itemId: string) {
    return appData.value.items.find((i) => i.id === itemId)
  }

  // Markers
  function addMarker(marker: Omit<Marker, 'id'>) {
    const newMarker: Marker = { ...marker, id: `marker-${Date.now()}` }
    appData.value.markers.push(newMarker)
    save()
    return newMarker
  }

  function deleteMarker(markerId: string) {
    appData.value.markers = appData.value.markers.filter((m) => m.id !== markerId)
    save()
  }

  return {
    maps,
    items,
    markers,
    currentMap,
    currentMapId,
    currentMapMarkers,
    addMap,
    deleteMap,
    setCurrentMap,
    addItem,
    deleteItem,
    getItemById,
    addMarker,
    deleteMarker,
  }
}
