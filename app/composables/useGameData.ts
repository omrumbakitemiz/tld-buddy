import { computed } from 'vue'
import type { Difficulty, GameMap, MapVariant, Marker, POIPin, Run, StashedItem } from '~/types'
import { getVariantKey } from '~/types'
import { MAX_RECENT_MAPS, createId } from '#shared/utils/appData'
import { useAppStore } from './useAppStore'
import { thumbnailUrl, useStaticData } from './useStaticData'

/**
 * Domain operations over the user's data (runs, markers, POIs, stashes, travel mode).
 * State and syncing live in useAppStore; static game data in useStaticData.
 * Every mutation ends with `commit()`, which caches locally and schedules a save.
 */
export function useGameData() {
  const store = useAppStore()
  const { appData, commit } = store
  const statics = useStaticData()
  const { maps, items, pois, connections, getItem, getMap, getPOI } = statics

  // ── Runs ────────────────────────────────────────────────────────────────

  const runs = computed(() => appData.value.runs)
  const currentRun = computed(() => appData.value.runs.find((r) => r.id === appData.value.currentRunId) ?? null)

  function addRun(name: string, difficulty: Difficulty): Run {
    const run: Run = { id: createId('run'), name, difficulty, createdAt: Date.now() }
    appData.value.runs.push(run)
    appData.value.currentRunId = run.id
    commit()
    return run
  }

  function deleteRun(runId: string) {
    const d = appData.value
    d.runs = d.runs.filter((r) => r.id !== runId)
    d.markers = d.markers.filter((m) => m.runId !== runId)
    d.stashedItems = d.stashedItems.filter((s) => s.runId !== runId)
    if (d.currentRunId === runId) d.currentRunId = d.runs[0]?.id ?? null
    commit()
  }

  function setCurrentRun(runId: string) {
    appData.value.currentRunId = runId
    commit()
  }

  function updateRun(runId: string, updates: Partial<Pick<Run, 'name' | 'difficulty'>>) {
    const run = appData.value.runs.find((r) => r.id === runId)
    if (!run) return
    if (updates.name !== undefined) run.name = updates.name
    if (updates.difficulty !== undefined) run.difficulty = updates.difficulty
    commit()
  }

  // ── Maps ────────────────────────────────────────────────────────────────

  const currentMapId = computed(() => appData.value.currentMapId)
  const currentMap = computed(() => getMap(appData.value.currentMapId) ?? null)

  /** Map artwork variant (default or interloper) for the current run's difficulty. */
  function getMapVariant(map: GameMap): MapVariant {
    const run = currentRun.value
    return run ? map[getVariantKey(run.difficulty)] : map.default
  }

  const currentMapVariant = computed<MapVariant | null>(() => (currentMap.value ? getMapVariant(currentMap.value) : null))

  function getMapThumbnail(map: GameMap): string {
    return thumbnailUrl(getMapVariant(map).imageUrl)
  }

  const recentMaps = computed(() =>
    appData.value.recentMapIds.map((id) => getMap(id)).filter((m): m is GameMap => !!m),
  )

  function setCurrentMap(mapId: string) {
    const d = appData.value
    d.currentMapId = mapId
    // Already listed maps keep their slot so the recent list stays stable
    if (!d.recentMapIds.includes(mapId)) {
      d.recentMapIds = [mapId, ...d.recentMapIds].slice(0, MAX_RECENT_MAPS)
    }
    commit()
  }

  function clearRecentMaps() {
    appData.value.recentMapIds = []
    commit()
  }

  function getConnectedMaps(mapId: string): { map: GameMap; label?: string }[] {
    const results: { map: GameMap; label?: string }[] = []
    for (const conn of connections.value) {
      const neighborId = conn.maps[0] === mapId ? conn.maps[1] : conn.maps[1] === mapId ? conn.maps[0] : null
      const neighbor = neighborId ? getMap(neighborId) : undefined
      if (neighbor) results.push({ map: neighbor, label: conn.label })
    }
    return results
  }

  // ── Markers ─────────────────────────────────────────────────────────────

  const markers = computed(() => appData.value.markers)

  /** Markers of the current run, any map. */
  const currentRunMarkers = computed(() => appData.value.markers.filter((m) => m.runId === appData.value.currentRunId))

  /** Markers for the current map AND current run. */
  const currentMapMarkers = computed(() => currentRunMarkers.value.filter((m) => m.mapId === appData.value.currentMapId))

  /** Per-map counts for the current run: { total, remaining }. */
  const markerCountsByMap = computed(() => {
    const counts = new Map<string, { total: number; remaining: number }>()
    for (const m of currentRunMarkers.value) {
      const c = counts.get(m.mapId) ?? { total: 0, remaining: 0 }
      c.total++
      if (!m.lootedAt) c.remaining++
      counts.set(m.mapId, c)
    }
    return counts
  })

  function findMarker(markerId: string) {
    return appData.value.markers.find((m) => m.id === markerId)
  }

  /** `id` is only passed for markers from the game mod, whose ids must match across tabs. */
  function addMarker(marker: Omit<Marker, 'id'> & { id?: string }) {
    const newMarker: Marker = { lootedAt: null, ...marker, id: marker.id ?? createId('marker') }
    appData.value.markers.push(newMarker)
    commit()
    return newMarker
  }

  function updateMarker(markerId: string, updates: Partial<Pick<Marker, 'name' | 'quantity' | 'note' | 'x' | 'y'>>) {
    const marker = findMarker(markerId)
    if (!marker) return
    Object.assign(marker, updates)
    commit()
  }

  function setLooted(markerId: string, looted: boolean) {
    const marker = findMarker(markerId)
    if (!marker || !!marker.lootedAt === looted) return
    marker.lootedAt = looted ? Date.now() : null
    commit()
  }

  function toggleLooted(markerId: string) {
    const marker = findMarker(markerId)
    if (marker) setLooted(markerId, !marker.lootedAt)
  }

  function deleteMarker(markerId: string) {
    appData.value.markers = appData.value.markers.filter((m) => m.id !== markerId)
    commit()
  }

  // ── POIs ────────────────────────────────────────────────────────────────

  const enabledPOIs = computed(() => appData.value.enabledPOIs)
  const enabledPOISet = computed(() => new Set(appData.value.enabledPOIs))
  const pinsByPOI = computed(() => new Map(appData.value.poiPins.map((p) => [p.poiId, p])))

  const currentMapAllPOIs = computed(() => pois.value.filter((p) => p.mapId === appData.value.currentMapId))
  const currentMapPOIs = computed(() => currentMapAllPOIs.value.filter((p) => enabledPOISet.value.has(p.id)))

  /** Pinned, enabled POIs on the current map. Pins are global; stashes are per run. */
  const currentMapPOIPins = computed(() =>
    appData.value.poiPins.filter((pin) => enabledPOISet.value.has(pin.poiId) && getPOI(pin.poiId)?.mapId === appData.value.currentMapId),
  )

  function isPOIEnabled(poiId: string) {
    return enabledPOISet.value.has(poiId)
  }

  function togglePOI(poiId: string) {
    const list = appData.value.enabledPOIs
    const idx = list.indexOf(poiId)
    if (idx >= 0) list.splice(idx, 1)
    else list.push(poiId)
    commit()
  }

  function enablePOIs(poiIds: string[]) {
    appData.value.enabledPOIs = [...new Set([...appData.value.enabledPOIs, ...poiIds])]
    commit()
  }

  function disablePOIs(poiIds: string[]) {
    const remove = new Set(poiIds)
    appData.value.enabledPOIs = appData.value.enabledPOIs.filter((id) => !remove.has(id))
    commit()
  }

  function getPOIPin(poiId: string): POIPin | undefined {
    return pinsByPOI.value.get(poiId)
  }

  function pinPOI(poiId: string, x: number, y: number) {
    const d = appData.value
    if (!d.enabledPOIs.includes(poiId)) d.enabledPOIs.push(poiId)
    d.poiPins = [...d.poiPins.filter((p) => p.poiId !== poiId), { poiId, x, y }]
    commit()
  }

  function unpinPOI(poiId: string) {
    appData.value.poiPins = appData.value.poiPins.filter((p) => p.poiId !== poiId)
    commit()
  }

  // ── Stashes ─────────────────────────────────────────────────────────────

  const currentRunStashedItems = computed(() => {
    const runId = appData.value.currentRunId
    return runId ? appData.value.stashedItems.filter((s) => s.runId === runId) : []
  })

  const stashesByPOI = computed(() => {
    const byPOI = new Map<string, StashedItem[]>()
    for (const s of currentRunStashedItems.value) {
      const list = byPOI.get(s.poiId) ?? []
      list.push(s)
      byPOI.set(s.poiId, list)
    }
    return byPOI
  })

  function getStashedItems(poiId: string): StashedItem[] {
    return stashesByPOI.value.get(poiId) ?? []
  }

  function getStashedItemCount(poiId: string): number {
    return getStashedItems(poiId).length
  }

  /** Add to a stash; stacking onto an existing entry of the same item. */
  function addStashedItem(stash: Omit<StashedItem, 'id'>) {
    const existing = appData.value.stashedItems.find(
      (s) => s.runId === stash.runId && s.poiId === stash.poiId && s.itemId === stash.itemId && !s.note && !stash.note,
    )
    if (existing) {
      existing.quantity += stash.quantity
      commit()
      return existing
    }
    const newStash: StashedItem = { ...stash, id: createId('stash') }
    appData.value.stashedItems.push(newStash)
    commit()
    return newStash
  }

  function setStashedQuantity(stashId: string, quantity: number) {
    const stash = appData.value.stashedItems.find((s) => s.id === stashId)
    if (!stash) return
    if (quantity < 1) {
      removeStashedItem(stashId)
      return
    }
    stash.quantity = quantity
    commit()
  }

  function removeStashedItem(stashId: string) {
    appData.value.stashedItems = appData.value.stashedItems.filter((s) => s.id !== stashId)
    commit()
  }

  // ── Travel mode ─────────────────────────────────────────────────────────

  const travelMode = computed(() => appData.value.travelMode)
  const travelLeftMapId = computed(() => appData.value.travelLeftMapId)
  const travelRightMapId = computed(() => appData.value.travelRightMapId)
  const travelLeftMap = computed(() => getMap(appData.value.travelLeftMapId) ?? null)
  const travelRightMap = computed(() => getMap(appData.value.travelRightMapId) ?? null)

  function toggleTravelMode() {
    const d = appData.value
    d.travelMode = !d.travelMode
    // Entering travel mode starts from the map you were looking at
    if (d.travelMode && !d.travelLeftMapId && d.currentMapId) d.travelLeftMapId = d.currentMapId
    commit()
  }

  function setTravelLeftMap(mapId: string) {
    appData.value.travelLeftMapId = mapId
    commit()
  }

  function setTravelRightMap(mapId: string) {
    appData.value.travelRightMapId = mapId
    commit()
  }

  return {
    // Static data
    maps,
    items,
    pois,
    staticDataReady: statics.ready,
    itemCategories: statics.itemCategories,
    getItemById: getItem,
    getMapById: getMap,
    getPOIById: getPOI,
    // Runs
    runs,
    currentRun,
    addRun,
    deleteRun,
    setCurrentRun,
    updateRun,
    // Maps
    currentMap,
    currentMapId,
    currentMapVariant,
    recentMaps,
    setCurrentMap,
    clearRecentMaps,
    getMapThumbnail,
    getMapVariant,
    getConnectedMaps,
    // Markers
    markers,
    currentRunMarkers,
    currentMapMarkers,
    markerCountsByMap,
    addMarker,
    updateMarker,
    setLooted,
    toggleLooted,
    deleteMarker,
    // POIs
    enabledPOIs,
    currentMapAllPOIs,
    currentMapPOIs,
    currentMapPOIPins,
    isPOIEnabled,
    togglePOI,
    enablePOIs,
    disablePOIs,
    getPOIPin,
    pinPOI,
    unpinPOI,
    // Stashes
    currentRunStashedItems,
    getStashedItems,
    getStashedItemCount,
    addStashedItem,
    setStashedQuantity,
    removeStashedItem,
    // Travel mode
    travelMode,
    travelLeftMapId,
    travelRightMapId,
    travelLeftMap,
    travelRightMap,
    toggleTravelMode,
    setTravelLeftMap,
    setTravelRightMap,
    // Sync
    syncStatus: store.syncStatus,
    authExpired: store.authExpired,
    apiSynced: store.apiSynced,
    reloadFromAPI: store.pull,
  }
}
