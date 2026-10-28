// Pure helpers shared by every add-item variant (see docs/add-item/CONCEPTS.md, "Shared seam").
// No Vue, no DOM: unit-tested in scripts/test-add-item.ts.

import type { Item, Marker, POI, POIPin } from '../../shared/types/game'

// ── Text ────────────────────────────────────────────────────────────────────

/** Lowercase and strip diacritics ("Rüdiger's" → "rudigers", "ı" → "i") so search forgives accents and punctuation. */
export function foldText(text: string): string {
  return text
    .toLocaleLowerCase('en')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// ── Frecency ────────────────────────────────────────────────────────────────

/** Epoch ms encoded in ids made by `createId` (`marker-<ms>-<rand>`); 0 when absent. */
export function idTime(id: string): number {
  const ms = Number(id.split('-')[1])
  return Number.isFinite(ms) ? ms : 0
}

const HALF_LIFE_MS = 3 * 24 * 60 * 60 * 1000

/**
 * Frequency × recency per item over the given markers (normally the current run).
 * Each marker scores 1 + 2^(-age / 3 days), so items logged often stay high and
 * something logged once a minute ago still beats an old one-off.
 */
export function computeFrecency(markers: Pick<Marker, 'id' | 'itemId'>[], now = Date.now()): Map<string, number> {
  const scores = new Map<string, number>()
  for (const m of markers) {
    const t = idTime(m.id)
    const recency = t ? Math.pow(2, -Math.max(0, now - t) / HALF_LIFE_MS) : 0
    scores.set(m.itemId, (scores.get(m.itemId) ?? 0) + 1 + recency)
  }
  return scores
}

/** Top `n` items by frecency, ties by most recent. */
export function topByFrecency(frecency: Map<string, number>, itemsById: Map<string, Item>, n: number): Item[] {
  return [...frecency.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => itemsById.get(id))
    .filter((i): i is Item => !!i)
    .slice(0, n)
}

// ── Search ──────────────────────────────────────────────────────────────────

export interface RankOptions {
  frecency?: Map<string, number>
  /** Restrict to these item ids (e.g. one loot group) */
  only?: Set<string>
  limit?: number
}

/**
 * Rank items for a query. Order of preference:
 * whole name starts with the query > a word starts with it > every query word is a
 * prefix of some name word ("rif am" → Rifle Ammunition) > substring > subsequence.
 * Within a tier, frecency wins, then shorter names ("Rifle" before "Rifle Shell Casing").
 * An empty query returns frecency order (then alphabetical).
 */
export function rankItems(items: Item[], query: string, opts: RankOptions = {}): Item[] {
  const { frecency, only, limit = 50 } = opts
  const pool = only ? items.filter((i) => only.has(i.id)) : items
  const q = foldText(query)
  const fre = (id: string) => frecency?.get(id) ?? 0

  if (!q) {
    return [...pool]
      .sort((a, b) => fre(b.id) - fre(a.id) || a.name.localeCompare(b.name))
      .slice(0, limit)
  }

  const qWords = q.split(' ')
  const scored: { item: Item; tier: number }[] = []
  for (const item of pool) {
    const name = foldText(item.name)
    const words = name.split(' ')
    let tier = -1
    if (name.startsWith(q)) tier = 5
    else if (words.some((w) => w.startsWith(q))) tier = 4
    else if (qWords.length > 1 && qWords.every((qw) => words.some((w) => w.startsWith(qw)))) tier = 3
    else if (name.includes(q)) tier = 2
    else if (isSubsequence(q.replace(/ /g, ''), name.replace(/ /g, ''))) tier = 1
    if (tier >= 0) scored.push({ item, tier })
  }
  scored.sort((a, b) =>
    b.tier - a.tier
    || fre(b.item.id) - fre(a.item.id)
    || a.item.name.length - b.item.name.length
    || a.item.name.localeCompare(b.item.name))
  return scored.slice(0, limit).map((s) => s.item)
}

function isSubsequence(needle: string, hay: string): boolean {
  if (needle.length < 3) return false
  let i = 0
  for (const ch of hay) if (ch === needle[i] && ++i === needle.length) return true
  return false
}

/**
 * Split "12 matches", "matches 12", "matches x12", "12x mat", "3 peaches - in the fridge"
 * into a quantity, the item query and an optional note.
 */
export function parseEntry(input: string): { quantity: number; query: string; note: string } {
  let text = input.trim()
  let note = ''
  const noteMatch = text.match(/\s(?:-|#)\s*(.*)$/)
  if (noteMatch) {
    note = noteMatch[1]!.trim()
    text = text.slice(0, noteMatch.index).trim()
  }
  let quantity = 1
  const lead = text.match(/^(\d+)\s*x?\s+(.*)$/i) ?? text.match(/^(\d+)x(\S.*)$/i)
  const tail = text.match(/^(.*?)\s+x?(\d+)$/i)
  if (lead) {
    quantity = Number(lead[1])
    text = lead[2]!
  } else if (tail) {
    quantity = Number(tail[2])
    text = tail[1]!
  }
  return { quantity: Math.max(1, Math.min(999, quantity || 1)), query: text.trim(), note }
}

// ── Curated loot groups ─────────────────────────────────────────────────────

/**
 * The wiki categories are noisy (books under Fire/Light, ammo under Tool), so quick-pick UIs
 * use these hand-made groups instead. Order inside a group = rough "how often players log it".
 * Fixed order and fixed membership: a radial/hotbar must not reshuffle under muscle memory.
 */
export const LOOT_GROUPS = [
  { id: 'fire', label: 'Fire', items: ['wood-matches', 'cardboard-matches', 'fir-firewood', 'cedar-firewood', 'reclaimed-wood', 'stick', 'coal', 'accelerant', 'lantern-fuel', 'firestriker', 'magnifying-lens', 'newsprint', 'tinder-plug', 'birch-bark', 'firelog', 'storm-lantern', 'flare', 'torch', 'flashlight'] },
  { id: 'food', label: 'Food', items: ['pinnacle-peaches', 'pork-and-beans', 'tin-of-sardines', 'canned-ham', 'canned-corn', 'tomato-soup', 'condensed-milk', 'peanut-butter', 'dog-food', 'beef-jerky', 'granola-bar', 'energy-bar', 'chocolate-bar', 'military-grade-mre', 'emergency-food', 'salty-crackers', 'cereal', 'ketchup-chips', 'venison-raw', 'wolf-meat-raw'] },
  { id: 'aid', label: 'Drink & aid', items: ['water-potable', 'orange-soda', 'summit-soda', 'stacys-grape-soda', 'tin-of-coffee', 'herbal-tea', 'go-energy-drink', 'antiseptic', 'bandage', 'painkillers', 'antibiotics', 'old-mans-beard-wound-dressing', 'water-purification-tablets', 'vitamin-c-pills', 'heat-pack', 'emergency-stim', 'rose-hip-tea', 'reishi-tea'] },
  { id: 'arms', label: 'Arms', items: ['rifle-ammunition', 'hunting-rifle', 'revolver-ammunition', 'revolver', 'distress-pistol', 'flare-shell', 'survival-bow', 'manufactured-arrow', 'simple-arrow', 'arrowhead', 'can-of-gunpowder', 'scrap-lead', 'rifle-shell-casing', 'revolver-shell-casing', 'firearm-cleaning-kit', 'bear-spear', 'noisemaker'] },
  { id: 'tools', label: 'Tools', items: ['hatchet', 'hunting-knife', 'prybar', 'hacksaw', 'can-opener', 'sewing-kit', 'whetstone', 'simple-tools', 'quality-tools', 'cooking-pot', 'recycled-can', 'fishing-tackle', 'hook', 'line', 'snare', 'bedroll', 'mountaineering-rope', 'insulated-flask', 'heavy-hammer', 'improvised-knife', 'improvised-hatchet', 'book'] },
  { id: 'clothing', label: 'Clothing', items: ['wool-toque', 'wool-scarf', 'expedition-parka', 'mackinaw-jacket', 'thick-wool-sweater', 'cowichan-sweater', 'wool-shirt', 'thermal-underwear', 'wool-longjohns', 'cargo-pants', 'combat-pants', 'wool-socks', 'climbing-socks', 'mukluks', 'insulated-boots', 'work-boots', 'mountaineering-boots', 'work-gloves', 'ski-gloves', 'wool-mittens', 'gauntlets', 'moose-hide-satchel', 'crampons', 'balaclava', 'down-vest', 'cotton-toque'] },
  { id: 'materials', label: 'Materials', items: ['cloth', 'scrap-metal', 'cured-gut', 'fresh-gut', 'cured-leather', 'cured-deer-hide', 'cured-wolf-pelt', 'cured-rabbit-pelt', 'cured-moose-hide', 'cured-black-bear-hide', 'cured-birch-sapling', 'cured-maple-sapling', 'old-mans-beard-lichen', 'reishi-mushroom', 'burdock-root', 'acorns', 'car-battery', 'stump-remover', 'crow-feather'] },
] as const

export type LootGroupId = (typeof LOOT_GROUPS)[number]['id']

// ── Likely items per place (concept C) ──────────────────────────────────────

const LIKELY_BY_KIND: Record<string, string[]> = {
  residential: ['wood-matches', 'pinnacle-peaches', 'pork-and-beans', 'tomato-soup', 'water-potable', 'antiseptic', 'painkillers', 'cloth', 'wool-toque', 'wool-socks', 'sewing-kit', 'can-opener', 'newsprint', 'book', 'recycled-can', 'orange-soda'],
  industrial: ['scrap-metal', 'prybar', 'hacksaw', 'simple-tools', 'lantern-fuel', 'accelerant', 'wood-matches', 'work-gloves', 'work-boots', 'flare', 'cloth', 'reclaimed-wood', 'storm-lantern', 'heavy-hammer', 'beef-jerky', 'water-potable'],
  sporting: ['rifle-ammunition', 'hunting-rifle', 'hunting-knife', 'fishing-tackle', 'hook', 'line', 'snare', 'wood-matches', 'flare', 'bedroll', 'cured-gut', 'cooking-pot', 'beef-jerky', 'water-potable', 'cloth', 'firestriker'],
  cave: ['fir-firewood', 'cedar-firewood', 'stick', 'reishi-mushroom', 'old-mans-beard-lichen', 'wood-matches', 'flare', 'bedroll', 'rifle-ammunition', 'hatchet', 'beef-jerky', 'water-potable', 'cloth', 'antiseptic', 'torch', 'coal'],
  outdoors: ['fir-firewood', 'cedar-firewood', 'stick', 'reishi-mushroom', 'burdock-root', 'old-mans-beard-lichen', 'acorns', 'wood-matches', 'flare', 'rifle-ammunition', 'hatchet', 'hunting-knife', 'cloth', 'cured-gut', 'beef-jerky', 'water-potable'],
}
LIKELY_BY_KIND.landmark = LIKELY_BY_KIND.outdoors!
LIKELY_BY_KIND.store = LIKELY_BY_KIND.residential!
LIKELY_BY_KIND.commercial = LIKELY_BY_KIND.residential!
LIKELY_BY_KIND.building = LIKELY_BY_KIND.residential!
LIKELY_BY_KIND.trailer = LIKELY_BY_KIND.residential!
LIKELY_BY_KIND.indoors = LIKELY_BY_KIND.residential!
LIKELY_BY_KIND.church = LIKELY_BY_KIND.residential!
LIKELY_BY_KIND.outside = LIKELY_BY_KIND.outdoors!
LIKELY_BY_KIND.lake = LIKELY_BY_KIND.outdoors!

/**
 * Item ids worth suggesting at a place, as a hint (loot in the game is randomised).
 * Untyped places (and plain map spots) get a general mix.
 */
export function likelyItemIdsForPOI(poi: Pick<POI, 'type'> | null | undefined): string[] {
  const kind = poi?.type?.toLowerCase()
  return LIKELY_BY_KIND[kind ?? ''] ?? LIKELY_BY_KIND.residential!
}

// ── Spots ───────────────────────────────────────────────────────────────────

export interface Spot {
  x: number
  y: number
  /** The pinned place this spot belongs to, if any */
  poiId?: string
}

/** Map-pixel radius inside which a click counts as "the same spot" (a building is ~40–120 px). */
export const SPOT_RADIUS = 40

/**
 * Snap a position to the closest pinned place or existing marker within `radius` map px.
 * Returns the position unchanged when nothing is close. Markers win over places when
 * closer, so adding next to an existing pile joins that pile.
 */
export function nearestSpot(
  pos: { x: number; y: number },
  pins: POIPin[],
  markers: Pick<Marker, 'x' | 'y'>[],
  radius = SPOT_RADIUS,
): Spot & { snapped: 'poi' | 'marker' | null } {
  let best: (Spot & { snapped: 'poi' | 'marker' | null; d: number }) | null = null
  for (const p of pins) {
    const d = Math.hypot(p.x - pos.x, p.y - pos.y)
    if (d <= radius && (!best || d < best.d)) best = { x: p.x, y: p.y, poiId: p.poiId, snapped: 'poi', d }
  }
  for (const m of markers) {
    const d = Math.hypot(m.x - pos.x, m.y - pos.y)
    if (d <= radius && (!best || d < best.d)) best = { x: m.x, y: m.y, poiId: best?.poiId, snapped: 'marker', d }
  }
  if (!best) return { ...pos, snapped: null }
  const { d: _d, ...spot } = best
  if (spot.snapped === 'marker') {
    // A pile is drawn as a ring around its centre: join the centre, not one member
    const pile = markersAtSpot(spot, markers, SPREAD_RADIUS * 2 + 1)
    spot.x = pile.reduce((a, m) => a + m.x, 0) / pile.length
    spot.y = pile.reduce((a, m) => a + m.y, 0) / pile.length
  }
  return spot
}

/** Markers that belong to a spot: within `radius` of it. */
export function markersAtSpot<M extends Pick<Marker, 'x' | 'y'>>(spot: { x: number; y: number }, markers: M[], radius = SPOT_RADIUS): M[] {
  return markers.filter((m) => Math.hypot(m.x - spot.x, m.y - spot.y) <= radius)
}

// ── Batches ─────────────────────────────────────────────────────────────────

export interface BatchEntry {
  itemId: string
  quantity: number
  note?: string
}

export type BatchOp =
  | { kind: 'stack'; markerId: string; add: number }
  | { kind: 'add'; itemId: string; quantity: number; x: number; y: number; note?: string }

/** Spread radius for new markers around a spot, so they are separable when zoomed in. */
export const SPREAD_RADIUS = 12

/**
 * Plan how entries land on a spot: an entry stacks onto an unlooted marker of the same
 * item at the spot when neither has a note; otherwise it becomes a new marker, placed on
 * a ring around the spot (positions continue around the ring past markers already there).
 * Repeated entries of the same item in one batch merge first.
 */
export function planBatch(
  spot: { x: number; y: number },
  entries: BatchEntry[],
  existing: Pick<Marker, 'id' | 'itemId' | 'x' | 'y' | 'lootedAt' | 'note'>[],
  radius = SPOT_RADIUS,
): BatchOp[] {
  const merged: BatchEntry[] = []
  for (const e of entries) {
    if (e.quantity < 1) continue
    const prev = !e.note ? merged.find((m) => m.itemId === e.itemId && !m.note) : undefined
    if (prev) prev.quantity += e.quantity
    else merged.push({ ...e })
  }

  const here = markersAtSpot(spot, existing, radius)
  const ops: BatchOp[] = []
  const adds: BatchEntry[] = []
  for (const e of merged) {
    const target = !e.note ? here.find((m) => m.itemId === e.itemId && !m.lootedAt && !m.note) : undefined
    if (target) ops.push({ kind: 'stack', markerId: target.id, add: e.quantity })
    else adds.push(e)
  }

  const total = here.length + adds.length
  adds.forEach((e, i) => {
    const slot = here.length + i
    const at = total === 1 ? { x: spot.x, y: spot.y } : ringSlot(spot, slot)
    ops.push({ kind: 'add', itemId: e.itemId, quantity: e.quantity, note: e.note || undefined, ...at })
  })
  return ops
}

/**
 * Position of the n-th marker around a spot. Slots don't depend on how many there will be,
 * so items added one at a time land apart just like a batch: 6 on the first ring, 12 on
 * the second (offset half a step), and so on outwards.
 */
export function ringSlot(spot: { x: number; y: number }, slot: number): { x: number; y: number } {
  let ring = 1
  let first = 0
  while (slot >= first + 6 * ring) {
    first += 6 * ring
    ring++
  }
  const size = 6 * ring
  const angle = (2 * Math.PI * (slot - first + (ring > 1 ? 0.5 : 0))) / size - Math.PI / 2
  return { x: spot.x + Math.cos(angle) * SPREAD_RADIUS * ring, y: spot.y + Math.sin(angle) * SPREAD_RADIUS * ring }
}
