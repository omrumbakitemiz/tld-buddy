import { ref, computed } from 'vue'
import type { GameMap, Item, Marker, AppData, Run, Difficulty, MapVariant } from '~/types'
import { getVariantKey } from '~/types'

const STORAGE_KEY = 'tld-map-v7'

const defaultData: AppData = {
  runs: [],
  currentRunId: null,
  currentMapId: null,
  markers: [],
}

const appData = ref<AppData>({ ...defaultData })
const staticMaps = ref<GameMap[]>([])
const staticItems = ref<Item[]>([])
let loaded = false
let staticDataLoaded = false

// ── Load static data from JSON files ────────────────────────────────────────

async function loadItems(): Promise<Item[]> {
  try {
    const res = await fetch('/data/items.json')
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data)) return []
    return data as Item[]
  } catch {
    console.warn('Could not load items from /data/items.json')
    return []
  }
}

async function loadMaps(): Promise<GameMap[]> {
  try {
    const res = await fetch('/data/maps.json')
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data)) return []
    return data as GameMap[]
  } catch {
    console.warn('Could not load maps from /data/maps.json')
    return []
  }
}

// ── Persistence ─────────────────────────────────────────────────────────────

function load() {
  if (loaded) return
  loaded = true
  if (typeof window === 'undefined') return
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return
  try {
    const parsed = JSON.parse(raw) as Partial<AppData>
    appData.value = {
      runs: Array.isArray(parsed.runs) ? parsed.runs : [],
      currentRunId: parsed.currentRunId ?? null,
      currentMapId: parsed.currentMapId ?? null,
      markers: Array.isArray(parsed.markers) ? parsed.markers : [],
    }
  } catch {
    console.error('Failed to load saved data')
  }
}

function save() {
  if (typeof window === 'undefined') return
  const toSave: AppData = {
    runs: appData.value.runs,
    currentRunId: appData.value.currentRunId,
    currentMapId: appData.value.currentMapId,
    markers: appData.value.markers,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
}

// Auto-load on first import
if (typeof window !== 'undefined') {
  load()
}

// ── Composable ──────────────────────────────────────────────────────────────

export function useGameData() {
  load()

  // Load static data (items + maps) asynchronously on first use
  if (typeof window !== 'undefined' && !staticDataLoaded) {
    staticDataLoaded = true

    Promise.all([loadItems(), loadMaps()]).then(([items, maps]) => {
      if (items.length > 0) staticItems.value = items
      if (maps.length > 0) staticMaps.value = maps

      // Auto-select first map if none selected
      if (!appData.value.currentMapId && maps.length > 0) {
        appData.value.currentMapId = maps[0].id
      }
    })
  }

  // ── Computed ────────────────────────────────────────────────────────────

  const maps = computed(() => staticMaps.value)
  const items = computed(() => staticItems.value)
  const markers = computed(() => appData.value.markers)
  const runs = computed(() => appData.value.runs)
  const currentMapId = computed(() => appData.value.currentMapId)

  const currentRun = computed(() =>
    appData.value.runs.find((r) => r.id === appData.value.currentRunId) ?? null,
  )

  const currentMap = computed(() =>
    staticMaps.value.find((m) => m.id === appData.value.currentMapId) ?? null,
  )

  /**
   * Resolves the correct map variant (default or interloper)
   * based on the current run's difficulty.
   */
  const currentMapVariant = computed<MapVariant | null>(() => {
    const map = currentMap.value
    if (!map) return null
    const run = currentRun.value
    if (!run) return map.default // fallback to default when no run selected
    const key = getVariantKey(run.difficulty)
    return map[key]
  })

  /**
   * Markers for the current map AND current run.
   */
  const currentMapMarkers = computed(() =>
    appData.value.markers.filter(
      (m) =>
        m.mapId === appData.value.currentMapId &&
        m.runId === appData.value.currentRunId,
    ),
  )

  // ── Run management ──────────────────────────────────────────────────────

  function addRun(name: string, difficulty: Difficulty): Run {
    const run: Run = {
      id: `run-${Date.now()}`,
      name,
      difficulty,
      createdAt: Date.now(),
    }
    appData.value.runs.push(run)
    appData.value.currentRunId = run.id
    save()
    return run
  }

  function deleteRun(runId: string) {
    appData.value.runs = appData.value.runs.filter((r) => r.id !== runId)
    appData.value.markers = appData.value.markers.filter((m) => m.runId !== runId)
    if (appData.value.currentRunId === runId) {
      appData.value.currentRunId = appData.value.runs[0]?.id ?? null
    }
    save()
  }

  function setCurrentRun(runId: string) {
    appData.value.currentRunId = runId
    save()
  }

  // ── Map selection ───────────────────────────────────────────────────────

  function setCurrentMap(mapId: string) {
    appData.value.currentMapId = mapId
    save()
  }

  // ── Items ───────────────────────────────────────────────────────────────

  function getItemById(itemId: string) {
    return staticItems.value.find((i) => i.id === itemId)
  }

  // ── Markers ─────────────────────────────────────────────────────────────

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
    // Static data
    maps,
    items,
    markers,
    // Runs
    runs,
    currentRun,
    addRun,
    deleteRun,
    setCurrentRun,
    // Maps
    currentMap,
    currentMapId,
    currentMapVariant,
    setCurrentMap,
    // Markers (scoped to current map + run)
    currentMapMarkers,
    addMarker,
    deleteMarker,
    // Items
    getItemById,
  }
}
