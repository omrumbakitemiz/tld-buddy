import { ref, computed } from 'vue'
import type { GameMap, Item, Marker, AppData, Run, Difficulty, MapVariant, POI, POIPin, StashedItem } from '~/types'
import { getVariantKey } from '~/types'

const LOCAL_CACHE_KEY = 'tld-buddy-v1'
const SAVE_DEBOUNCE_MS = 500

const MAX_RECENT_MAPS = 10

const defaultData: AppData = {
  runs: [],
  currentRunId: null,
  currentMapId: null,
  markers: [],
  enabledPOIs: [],
  poiPins: [],
  stashedItems: [],
  recentMapIds: [],
}

const appData = ref<AppData>({ ...defaultData })
const staticMaps = ref<GameMap[]>([])
const staticItems = ref<Item[]>([])
const staticPOIs = ref<POI[]>([])
let loaded = false
let staticDataLoaded = false
let saveTimer: ReturnType<typeof setTimeout> | null = null

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

async function loadPOIs(): Promise<POI[]> {
  try {
    const res = await fetch('/data/pois.json')
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data)) return []
    return data as POI[]
  } catch {
    console.warn('Could not load POIs from /data/pois.json')
    return []
  }
}

// ── Persistence ─────────────────────────────────────────────────────────────

function parseAppData(parsed: Partial<AppData>): AppData {
  return {
    runs: Array.isArray(parsed.runs) ? parsed.runs : [],
    currentRunId: parsed.currentRunId ?? null,
    currentMapId: parsed.currentMapId ?? null,
    markers: Array.isArray(parsed.markers) ? parsed.markers : [],
    enabledPOIs: Array.isArray(parsed.enabledPOIs) ? parsed.enabledPOIs : [],
    poiPins: Array.isArray(parsed.poiPins) ? parsed.poiPins : [],
    stashedItems: Array.isArray(parsed.stashedItems) ? parsed.stashedItems : [],
    recentMapIds: Array.isArray(parsed.recentMapIds) ? parsed.recentMapIds : [],
  }
}

/** Load from localStorage first (instant), then reconcile with API (async). */
function load() {
  if (loaded) return
  loaded = true
  if (typeof window === 'undefined') return

  // Step 1: Read from localStorage cache for instant UI
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_KEY)
    if (raw) {
      appData.value = parseAppData(JSON.parse(raw))
    }
  } catch {
    console.warn('Failed to read localStorage cache')
  }

  // Step 2: Fetch from API in background, API wins if available
  loadFromAPI()
}

async function loadFromAPI() {
  try {
    const res = await fetch('/api/data')
    if (!res.ok) return
    const data = await res.json()
    if (data && typeof data === 'object') {
      appData.value = parseAppData(data)
      // Update local cache with API data
      saveToLocalStorage()
    }
  } catch {
    console.warn('Could not fetch from API, using local cache')
  }
}

/** Write to localStorage (instant, synchronous). */
function saveToLocalStorage() {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(appData.value))
  } catch {
    // localStorage full or unavailable -- not critical
  }
}

/** Write to API (debounced, async). */
function saveToAPI() {
  if (typeof window === 'undefined') return
  fetch('/api/data', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(appData.value),
  }).catch(() => {
    console.warn('Failed to save to API')
  })
}

/** Save to both localStorage (instant) and API (debounced). */
function save() {
  // Instant write to localStorage cache
  saveToLocalStorage()

  // Debounced write to API
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(saveToAPI, SAVE_DEBOUNCE_MS)
}

// Auto-load on first import
if (typeof window !== 'undefined') {
  load()
}

// ── Composable ──────────────────────────────────────────────────────────────

export function useGameData() {
  load()

  // Load static data (items + maps + pois) asynchronously on first use
  if (typeof window !== 'undefined' && !staticDataLoaded) {
    staticDataLoaded = true

    Promise.all([loadItems(), loadMaps(), loadPOIs()]).then(([items, maps, pois]) => {
      if (items.length > 0) staticItems.value = items
      if (maps.length > 0) staticMaps.value = maps
      if (pois.length > 0) staticPOIs.value = pois

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
  const pois = computed(() => staticPOIs.value)
  const enabledPOIs = computed(() => appData.value.enabledPOIs)

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
    if (!run) return map.default
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

  // ── POI computed ──────────────────────────────────────────────────────────

  /** All POIs for the current map */
  const currentMapAllPOIs = computed(() =>
    staticPOIs.value.filter((p) => p.mapId === appData.value.currentMapId),
  )

  /** Only enabled POIs for the current map */
  const currentMapPOIs = computed(() =>
    currentMapAllPOIs.value.filter((p) => appData.value.enabledPOIs.includes(p.id)),
  )

  /** Pinned POIs for the current map + current run */
  const currentMapPOIPins = computed(() => {
    const runId = appData.value.currentRunId
    if (!runId) return []
    const enabledIds = new Set(appData.value.enabledPOIs)
    return appData.value.poiPins.filter((pin) => {
      if (!enabledIds.has(pin.poiId)) return false
      const poi = staticPOIs.value.find((p) => p.id === pin.poiId)
      return poi?.mapId === appData.value.currentMapId
    })
  })

  /** Stashed items for the current run */
  const currentRunStashedItems = computed(() => {
    const runId = appData.value.currentRunId
    if (!runId) return []
    return appData.value.stashedItems.filter((s) => s.runId === runId)
  })

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
    appData.value.stashedItems = appData.value.stashedItems.filter((s) => s.runId !== runId)
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

  /** Ordered list of recently visited maps (most recent first), resolved to GameMap objects */
  const recentMaps = computed(() => {
    return appData.value.recentMapIds
      .map((id) => staticMaps.value.find((m) => m.id === id))
      .filter((m): m is GameMap => !!m)
  })

  function trackRecentMap(mapId: string) {
    // If already in the list, don't reorder — keeps the sidebar stable
    if (appData.value.recentMapIds.includes(mapId)) return
    appData.value.recentMapIds = [mapId, ...appData.value.recentMapIds].slice(0, MAX_RECENT_MAPS)
  }

  function setCurrentMap(mapId: string) {
    appData.value.currentMapId = mapId
    trackRecentMap(mapId)
    save()
  }

  function clearRecentMaps() {
    appData.value.recentMapIds = []
    save()
  }

  // ── Items ───────────────────────────────────────────────────────────────

  function getItemById(itemId: string) {
    return staticItems.value.find((i) => i.id === itemId)
  }

  // ── Markers ─────────────────────────────────────────────────────────────

  let markerIdCounter = 0
  function addMarker(marker: Omit<Marker, 'id'>) {
    const newMarker: Marker = { ...marker, id: `marker-${Date.now()}-${markerIdCounter++}` }
    appData.value.markers.push(newMarker)
    save()
    return newMarker
  }

  function deleteMarker(markerId: string) {
    appData.value.markers = appData.value.markers.filter((m) => m.id !== markerId)
    save()
  }

  // ── POI management ────────────────────────────────────────────────────────

  function togglePOI(poiId: string) {
    const idx = appData.value.enabledPOIs.indexOf(poiId)
    if (idx >= 0) {
      appData.value.enabledPOIs.splice(idx, 1)
    } else {
      appData.value.enabledPOIs.push(poiId)
    }
    save()
  }

  function enablePOIs(poiIds: string[]) {
    const current = new Set(appData.value.enabledPOIs)
    for (const id of poiIds) current.add(id)
    appData.value.enabledPOIs = [...current]
    save()
  }

  function disablePOIs(poiIds: string[]) {
    const toRemove = new Set(poiIds)
    appData.value.enabledPOIs = appData.value.enabledPOIs.filter((id) => !toRemove.has(id))
    save()
  }

  function isPOIEnabled(poiId: string): boolean {
    return appData.value.enabledPOIs.includes(poiId)
  }

  // ── POI Pins ──────────────────────────────────────────────────────────────

  function pinPOI(poiId: string, x: number, y: number) {
    appData.value.poiPins = appData.value.poiPins.filter((p) => p.poiId !== poiId)
    appData.value.poiPins.push({ poiId, x, y })
    save()
  }

  function unpinPOI(poiId: string) {
    appData.value.poiPins = appData.value.poiPins.filter((p) => p.poiId !== poiId)
    save()
  }

  function getPOIPin(poiId: string): POIPin | undefined {
    return appData.value.poiPins.find((p) => p.poiId === poiId)
  }

  // ── Stashed Items ─────────────────────────────────────────────────────────

  function addStashedItem(stash: Omit<StashedItem, 'id'>) {
    const newStash: StashedItem = { ...stash, id: `stash-${Date.now()}` }
    appData.value.stashedItems.push(newStash)
    save()
    return newStash
  }

  function removeStashedItem(stashId: string) {
    appData.value.stashedItems = appData.value.stashedItems.filter((s) => s.id !== stashId)
    save()
  }

  function getStashedItems(poiId: string): StashedItem[] {
    const runId = appData.value.currentRunId
    if (!runId) return []
    return appData.value.stashedItems.filter((s) => s.poiId === poiId && s.runId === runId)
  }

  function getStashedItemCount(poiId: string): number {
    return getStashedItems(poiId).length
  }

  // ── Map thumbnails ──────────────────────────────────────────────────────

  /** Resolve the thumbnail URL for a map based on the current run's difficulty. */
  function getMapThumbnail(map: GameMap): string {
    const run = currentRun.value
    if (!run) return map.default.imageUrl
    const key = getVariantKey(run.difficulty)
    return map[key].imageUrl
  }

  return {
    // Static data
    maps,
    items,
    markers,
    pois,
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
    recentMaps,
    setCurrentMap,
    clearRecentMaps,
    getMapThumbnail,
    // Markers (scoped to current map + run)
    currentMapMarkers,
    addMarker,
    deleteMarker,
    // Items
    getItemById,
    // POIs
    enabledPOIs,
    currentMapAllPOIs,
    currentMapPOIs,
    currentMapPOIPins,
    currentRunStashedItems,
    togglePOI,
    enablePOIs,
    disablePOIs,
    isPOIEnabled,
    pinPOI,
    unpinPOI,
    getPOIPin,
    addStashedItem,
    removeStashedItem,
    getStashedItems,
    getStashedItemCount,
  }
}
