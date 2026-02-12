export interface GameMap {
  id: string
  name: string
  imageUrl: string
  imageWidth: number
  imageHeight: number
  createdAt: number
  type?: 'region' | 'transition' | 'custom'
  wikiUrl?: string
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
  mapId: string
  itemId: string
  name: string
  x: number // pixel coordinate on the image
  y: number // pixel coordinate on the image
  quantity: number
  note?: string
}

export interface AppData {
  maps: GameMap[]
  items: Item[]
  markers: Marker[]
  currentMapId: string | null
}
