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

export interface AppData {
  runs: Run[]
  currentRunId: string | null
  currentMapId: string | null
  markers: Marker[]
}

/**
 * Returns the map variant key for a given difficulty.
 * pilgrim/voyageur/stalker → 'default'
 * interloper/misery → 'interloper'
 */
export function getVariantKey(difficulty: Difficulty): 'default' | 'interloper' {
  return difficulty === 'interloper' || difficulty === 'misery' ? 'interloper' : 'default'
}
