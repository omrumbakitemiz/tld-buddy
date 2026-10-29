// Data models shared by the client (app/) and the API (server/).

export type Difficulty = 'pilgrim' | 'voyageur' | 'stalker' | 'interloper' | 'misery'

export const DIFFICULTIES: readonly Difficulty[] = ['pilgrim', 'voyageur', 'stalker', 'interloper', 'misery']

export interface Run {
  id: string
  name: string
  difficulty: Difficulty
  createdAt: number
}

// ── Static game data (public/data/*.json) ───────────────────────────────────

export interface MapVariant {
  imageUrl: string
  imageWidth: number
  imageHeight: number
}

export interface GameMap {
  id: string
  name: string
  type: 'region' | 'transition'
  isDLC: boolean
  default: MapVariant
  interloper: MapVariant
}

export interface Item {
  id: string
  name: string
  description?: string
  category?: string
  icon?: string | null
  wikiUrl?: string
}

export interface POI {
  id: string // e.g. "ash-canyon--anglers-den"
  name: string // e.g. "Angler's Den"
  mapId: string // e.g. "ash-canyon"
  type?: string // e.g. "cave", "sporting", "residential"
  hasBed?: boolean
  hasWorkbench?: boolean
  hasShelter?: boolean
  hasForge?: boolean
  wikiUrl?: string
}

export interface MapConnection {
  maps: [string, string]
  label?: string
}

/** Game scene name (`GameManager.m_ActiveScene`) to app map id, used by the game mod bridge. */
export interface GameScene {
  scene: string // e.g. "LakeRegion"
  mapId: string // e.g. "mystery-lake"
  /** Seen in the mod's log while playing. Unverified entries come from the game's asset catalog. */
  verified?: boolean
}

// ── User data (persisted in Redis under `app-data`) ─────────────────────────

/** An item spotted at a map position, scoped to one run. */
export interface Marker {
  id: string
  runId: string
  mapId: string
  itemId: string
  name: string
  x: number
  y: number
  quantity: number
  note?: string
  /** Epoch ms when marked as looted. Absent/null = still there. Added in the UI overhaul; older data has none. */
  lootedAt?: number | null
  /** Game object id (ObjectGuid, kept in TLD saves) of the item marked with the mod's mark key. */
  gameId?: string
}

/** User-placed coordinates for a POI on the map (global, shared across all runs) */
export interface POIPin {
  poiId: string
  x: number
  y: number
}

/** An item stashed at a POI location (persisted per run) */
export interface StashedItem {
  id: string
  runId: string
  poiId: string
  itemId: string
  quantity: number
  note?: string
}

export interface AppData {
  runs: Run[]
  currentRunId: string | null
  currentMapId: string | null
  markers: Marker[]
  enabledPOIs: string[] // global list of enabled POI ids
  poiPins: POIPin[] // global pin positions (shared across runs)
  stashedItems: StashedItem[] // per-run item stashes at POIs
  recentMapIds: string[] // recently visited map ids (most recent first)
  travelMode: boolean
  travelLeftMapId: string | null
  travelRightMapId: string | null
}

/**
 * Returns the map variant key for a given difficulty.
 * pilgrim/voyageur/stalker → 'default', interloper/misery → 'interloper'
 */
export function getVariantKey(difficulty: Difficulty): 'default' | 'interloper' {
  return difficulty === 'interloper' || difficulty === 'misery' ? 'interloper' : 'default'
}
