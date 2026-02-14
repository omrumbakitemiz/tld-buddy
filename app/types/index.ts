export type Difficulty = 'pilgrim' | 'voyageur' | 'stalker' | 'interloper' | 'misery'

export interface Run {
  id: string
  name: string
  difficulty: Difficulty
  createdAt: number
}

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
}

// ── POI (Point of Interest) ─────────────────────────────────────────────────

export interface POI {
  id: string           // e.g. "ash-canyon--anglers-den"
  name: string         // e.g. "Angler's Den"
  mapId: string        // e.g. "ash-canyon"
  type?: string        // e.g. "cave", "sporting", "residential"
  hasBed?: boolean
  hasWorkbench?: boolean
  hasShelter?: boolean
  hasForge?: boolean
  wikiUrl?: string
}

/** User-placed coordinates for a POI on the map (persisted per run) */
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

// ── Map Connections ──────────────────────────────────────────────────────────

export interface MapConnection {
  maps: [string, string]
  label?: string
}

// ── App persistence ─────────────────────────────────────────────────────────

export interface AppData {
  runs: Run[]
  currentRunId: string | null
  currentMapId: string | null
  markers: Marker[]
  enabledPOIs: string[]       // global list of enabled POI ids
  poiPins: POIPin[]           // per-run pin positions
  stashedItems: StashedItem[] // per-run item stashes at POIs
  recentMapIds: string[]      // ordered list of recently visited map ids (most recent first)
  travelMode: boolean         // whether travel mode is active
  travelLeftMapId: string | null   // left map in travel mode
  travelRightMapId: string | null  // right map in travel mode
}

/**
 * Returns the map variant key for a given difficulty.
 * pilgrim/voyageur/stalker → 'default'
 * interloper/misery → 'interloper'
 */
export function getVariantKey(difficulty: Difficulty): 'default' | 'interloper' {
  return difficulty === 'interloper' || difficulty === 'misery' ? 'interloper' : 'default'
}
