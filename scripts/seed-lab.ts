/**
 * Seed a throwaway Redis with a realistic TLD Buddy document for the add-item lab
 * (docs/add-item). Never point this at production: it overwrites `app-data`.
 *
 * Usage:  pnpm tsx scripts/seed-lab.ts redis://localhost:6393/1
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createClient } from 'redis'
import { validateAppData } from '../shared/utils/appData'
import type { AppData, GameMap, Marker, POI, POIPin, StashedItem } from '../shared/types/game'

const url = process.argv[2]
if (!url || /6379\b/.test(url)) {
  console.error('Pass the lab Redis URL, e.g. redis://localhost:6393/1 (refusing the default port 6379).')
  process.exit(1)
}

const data = (f: string) => JSON.parse(readFileSync(path.resolve(import.meta.dirname, '..', 'public', 'data', f), 'utf8'))
const maps: GameMap[] = data('maps.json')
const pois: POI[] = data('pois.json')

// Deterministic RNG so every variant sees the same world
let seed = 20261028
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)
const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)]!
const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1))

const NOW = Date.now()
let tick = NOW - 6 * 24 * 3600_000
const id = (prefix: string) => `${prefix}-${(tick += int(20_000, 900_000))}-${Math.random().toString(36).slice(2, 8)}`

const COMMON = ['wood-matches', 'pinnacle-peaches', 'pork-and-beans', 'tin-of-sardines', 'fir-firewood', 'cedar-firewood', 'cloth', 'rifle-ammunition', 'antiseptic', 'bandage', 'water-potable', 'beef-jerky', 'scrap-metal', 'newsprint', 'stick', 'tomato-soup', 'condensed-milk', 'lantern-fuel', 'accelerant', 'flare', 'wool-socks', 'wool-toque', 'painkillers', 'reishi-mushroom', 'cured-gut', 'old-mans-beard-lichen', 'recycled-can', 'granola-bar', 'tinder-plug', 'coal']
const RARE = ['hacksaw', 'prybar', 'hatchet', 'hunting-knife', 'hunting-rifle', 'revolver', 'firestriker', 'magnifying-lens', 'sewing-kit', 'whetstone', 'quality-tools', 'expedition-parka', 'mukluks', 'gauntlets', 'moose-hide-satchel', 'insulated-flask', 'distress-pistol', 'storm-lantern', 'book', 'simple-tools']
const STACKABLE = new Set(['wood-matches', 'fir-firewood', 'cedar-firewood', 'cloth', 'rifle-ammunition', 'stick', 'scrap-metal', 'newsprint', 'coal', 'pinnacle-peaches', 'pork-and-beans', 'bandage', 'water-potable', 'tinder-plug', 'reishi-mushroom'])
const NOTES = ['in the kitchen cupboard', 'under the bed', 'locker by the door', 'car trunk', 'next to the corpse', 'basement shelf', 'behind the counter', 'on the workbench']

const runs = [
  { id: 'run-lab-stalker', name: 'Stalker — the long walk', difficulty: 'stalker' as const, createdAt: NOW - 20 * 24 * 3600_000 },
  { id: 'run-lab-voyageur', name: 'Voyageur practice', difficulty: 'voyageur' as const, createdAt: NOW - 40 * 24 * 3600_000 },
]

const markers: Marker[] = []
const pins: POIPin[] = []
const enabled: string[] = []
const stashes: StashedItem[] = []

/** Lay one "building" worth of loot on a ring, like the app does for a batch. */
function addPile(runId: string, mapId: string, cx: number, cy: number, count: number, lootedShare: number) {
  const chosen = new Set<string>()
  while (chosen.size < count) chosen.add(rand() < 0.75 ? pick(COMMON) : pick(RARE))
  ;[...chosen].forEach((itemId, i) => {
    const angle = (2 * Math.PI * i) / Math.max(count, 6) - Math.PI / 2
    markers.push({
      id: id('marker'),
      runId,
      mapId,
      itemId,
      name: itemId.split('-').map((w) => w[0]!.toUpperCase() + w.slice(1)).join(' '),
      x: count === 1 ? cx : cx + Math.cos(angle) * 12,
      y: count === 1 ? cy : cy + Math.sin(angle) * 12,
      quantity: STACKABLE.has(itemId) ? int(2, 12) : 1,
      note: rand() < 0.12 ? pick(NOTES) : undefined,
      lootedAt: rand() < lootedShare ? NOW - int(1, 72) * 3600_000 : null,
    })
  })
}

// Main run: five regions with plenty of loot, pins and a couple of stashes
const regions = ['mystery-lake', 'pleasant-valley', 'coastal-highway', 'desolation-point', 'forlorn-muskeg']
for (const mapId of regions) {
  const map = maps.find((m) => m.id === mapId)!
  const { imageWidth: w, imageHeight: h } = map.default
  const mapPois = pois.filter((p) => p.mapId === mapId).slice(0, mapId === 'mystery-lake' || mapId === 'pleasant-valley' ? 12 : 6)
  for (const poi of mapPois) {
    const x = int(Math.round(w * 0.15), Math.round(w * 0.85))
    const y = int(Math.round(h * 0.15), Math.round(h * 0.85))
    pins.push({ poiId: poi.id, x, y })
    enabled.push(poi.id)
    // Most pinned places have loot logged next to them
    if (rand() < 0.75) addPile('run-lab-stalker', mapId, x + int(-8, 8), y + int(-8, 8), int(2, 8), 0.35)
  }
  // Loose finds along routes (cars, corpses)
  for (let i = 0; i < 6; i++) addPile('run-lab-stalker', mapId, int(200, w - 200), int(200, h - 200), int(1, 2), 0.2)
}
for (const poiId of enabled.slice(0, 2)) {
  for (const itemId of ['rifle-ammunition', 'fir-firewood', 'pinnacle-peaches', 'cloth']) {
    stashes.push({ id: id('stash'), runId: 'run-lab-stalker', poiId, itemId, quantity: int(3, 20) })
  }
}
// Older run with a little data so run switching has something to show
addPile('run-lab-voyageur', 'mystery-lake', 2100, 2300, 5, 0.8)

const doc: AppData = {
  runs,
  currentRunId: 'run-lab-stalker',
  currentMapId: 'mystery-lake',
  markers,
  enabledPOIs: enabled,
  poiPins: pins,
  stashedItems: stashes,
  recentMapIds: regions,
  travelMode: false,
  travelLeftMapId: null,
  travelRightMapId: null,
}

const problem = validateAppData(doc)
if (problem) throw new Error(`Seed does not validate: ${problem}`)

const client = createClient({ url })
await client.connect()
await client.set('app-data', JSON.stringify(doc))
await client.set('app-data:rev', '1')
await client.quit()
console.log(`Seeded ${url}: ${markers.length} markers on ${regions.length} maps, ${pins.length} pins, ${stashes.length} stashes.`)
