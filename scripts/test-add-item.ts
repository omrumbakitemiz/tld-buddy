// Unit tests for the add-item helpers in app/lib/addItem.ts (search, frecency, spots, batches).
// Run: pnpm test
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  LOOT_GROUPS, computeFrecency, foldText, likelyItemIdsForPOI, nearestSpot, parseEntry, planBatch, rankItems, ringSlot,
} from '../app/lib/addItem'
import type { Item } from '../shared/types/game'

let passed = 0
function test(name: string, fn: () => void) {
  try {
    fn()
    passed++
    console.log(`ok   ${name}`)
  } catch (err) {
    console.error(`FAIL ${name}`)
    throw err
  }
}

const items: Item[] = JSON.parse(readFileSync(path.resolve(import.meta.dirname, '..', 'public', 'data', 'items.json'), 'utf8'))
const ids = new Set(items.map((i) => i.id))
const names = (list: Item[]) => list.map((i) => i.name)

test('foldText strips case, accents and punctuation', () => {
  assert.equal(foldText("Rüdiger's Diary"), 'rudiger s diary')
  assert.equal(foldText('RIFLE  Ammunition'), 'rifle ammunition')
  assert.equal(foldText('rıfle'), 'rifle')
})

test('every curated group and likely-item id exists in the catalogue', () => {
  for (const g of LOOT_GROUPS) for (const id of g.items) assert.ok(ids.has(id), `${g.id}: ${id}`)
  for (const kind of ['residential', 'industrial', 'sporting', 'cave', 'outdoors', undefined]) {
    for (const id of likelyItemIdsForPOI(kind ? { type: kind } : null)) assert.ok(ids.has(id), `${kind}: ${id}`)
  }
})

test('every S1 farmhouse item is in the first 8 of its loot group', () => {
  for (const id of ['wood-matches', 'pinnacle-peaches', 'rifle-ammunition', 'hatchet', 'sewing-kit', 'wool-toque', 'cloth', 'fir-firewood', 'antiseptic', 'flare', 'bandage', 'beef-jerky', 'hacksaw']) {
    assert.ok(LOOT_GROUPS.some((g) => (g.items as readonly string[]).indexOf(id) >= 0 && (g.items as readonly string[]).indexOf(id) < 8), id)
  }
})

test('rankItems puts whole-name prefix first and shorter names before longer', () => {
  const r = names(rankItems(items, 'rifle', { limit: 5 }))
  assert.equal(r[0], 'Rifle Ammunition')
  assert.ok(r.indexOf('Rifle Ammunition') < r.indexOf('Rifle Shell Casing'))
})

test('rankItems matches word prefixes across words ("rif am")', () => {
  assert.equal(rankItems(items, 'rif am', { limit: 1 })[0]?.name, 'Rifle Ammunition')
  assert.equal(rankItems(items, 'wood mat', { limit: 1 })[0]?.name, 'Wood Matches')
})

test('rankItems prefers loggable loot and history over a mere name prefix ("pea")', () => {
  assert.notEqual(rankItems(items, 'pea', { limit: 1 })[0]?.name, 'Peach Pie')
  const fre = new Map([['pinnacle-peaches', 2]])
  assert.equal(rankItems(items, 'pea', { limit: 1, frecency: fre })[0]?.name, 'Pinnacle Peaches')
  assert.equal(rankItems(items, 'hacks', { limit: 1 })[0]?.name, 'Hacksaw')
  assert.equal(rankItems(items, 'firew', { limit: 1 })[0]?.name, 'Fir Firewood')
})

test('ringSlot keeps 30 one-by-one adds apart on concentric rings', () => {
  const pts = Array.from({ length: 30 }, (_, i) => ringSlot({ x: 0, y: 0 }, i))
  for (let i = 0; i < pts.length; i++) {
    for (let j = 0; j < i; j++) assert.ok(Math.hypot(pts[i]!.x - pts[j]!.x, pts[i]!.y - pts[j]!.y) > 5, `${i} vs ${j}`)
  }
})

test('rankItems lets frecency break ties inside a tier', () => {
  const plain = names(rankItems(items, 'mat', { limit: 3 }))
  const fre = new Map([['wood-matches', 10]])
  const boosted = names(rankItems(items, 'mat', { limit: 3, frecency: fre }))
  assert.equal(boosted[0], 'Wood Matches')
  assert.ok(plain.length > 0)
})

test('rankItems with an empty query returns frecency order', () => {
  const fre = new Map([['hacksaw', 3], ['flare', 5]])
  assert.deepEqual(names(rankItems(items, '', { frecency: fre, limit: 2 })), ['Flare', 'Hacksaw'])
})

test('computeFrecency rewards frequency and recency', () => {
  const now = 1_800_000_000_000
  const day = 86_400_000
  const f = computeFrecency([
    { id: `marker-${now - 30 * day}-a`, itemId: 'old' },
    { id: `marker-${now - 30 * day}-b`, itemId: 'old' },
    { id: `marker-${now - 60_000}-c`, itemId: 'new' },
  ], now)
  assert.ok(f.get('old')! > f.get('new')!, 'twice beats once')
  assert.ok(f.get('new')! > 1.9, 'fresh one-off is nearly 2')
})

test('parseEntry reads quantities before or after the name, and notes', () => {
  assert.deepEqual(parseEntry('12 matches'), { quantity: 12, query: 'matches', note: '' })
  assert.deepEqual(parseEntry('matches 12'), { quantity: 12, query: 'matches', note: '' })
  assert.deepEqual(parseEntry('matches x12'), { quantity: 12, query: 'matches', note: '' })
  assert.deepEqual(parseEntry('12x mat'), { quantity: 12, query: 'mat', note: '' })
  assert.deepEqual(parseEntry('hacksaw - car trunk'), { quantity: 1, query: 'hacksaw', note: 'car trunk' })
  assert.deepEqual(parseEntry('2 rif # under the bed'), { quantity: 2, query: 'rif', note: 'under the bed' })
  assert.deepEqual(parseEntry('hatchet'), { quantity: 1, query: 'hatchet', note: '' })
})

test('nearestSpot snaps to a pin or a pile within the radius, else stays put', () => {
  const pins = [{ poiId: 'p', x: 100, y: 100 }]
  assert.deepEqual(nearestSpot({ x: 120, y: 100 }, pins, []), { x: 100, y: 100, poiId: 'p', snapped: 'poi' })
  assert.deepEqual(nearestSpot({ x: 500, y: 500 }, pins, []), { x: 500, y: 500, snapped: null })
  const pile = [{ x: 488, y: 500 }, { x: 512, y: 500 }]
  const s = nearestSpot({ x: 520, y: 505 }, pins, pile)
  assert.equal(s.snapped, 'marker')
  assert.equal(s.x, 500)
})

test('planBatch stacks the same item at a spot and rings new ones', () => {
  const existing = [
    { id: 'm1', itemId: 'flare', x: 100, y: 100, lootedAt: null },
    { id: 'm2', itemId: 'cloth', x: 100, y: 100, lootedAt: 123 },
    { id: 'far', itemId: 'flare', x: 900, y: 900, lootedAt: null },
  ]
  const ops = planBatch({ x: 100, y: 100 }, [
    { itemId: 'flare', quantity: 2 },
    { itemId: 'flare', quantity: 1 },
    { itemId: 'cloth', quantity: 3 },
    { itemId: 'hatchet', quantity: 1, note: 'stuck in a beam' },
  ], existing)
  assert.deepEqual(ops[0], { kind: 'stack', markerId: 'm1', add: 3 })
  const adds = ops.filter((o) => o.kind === 'add')
  assert.equal(adds.length, 2, 'looted cloth does not take new cloth; noted hatchet is its own marker')
  for (const a of adds) {
    assert.ok(a.kind === 'add')
    const d = Math.hypot(a.x - 100, a.y - 100)
    assert.ok(d > 11 && d < 13, 'on the ring')
  }
})

test('planBatch puts a lone item exactly on an empty spot', () => {
  const ops = planBatch({ x: 50, y: 60 }, [{ itemId: 'hacksaw', quantity: 1 }], [])
  assert.deepEqual(ops, [{ kind: 'add', itemId: 'hacksaw', quantity: 1, note: undefined, x: 50, y: 60 }])
})

test('incremental entries keep distinct positions on the shared ring', () => {
  const existing: { id: string; itemId: string; x: number; y: number }[] = []
  for (let i = 0; i < 9; i++) {
    const [op] = planBatch({ x: 100, y: 100 }, [{ itemId: `item-${i}`, quantity: 1 }], existing)
    assert.ok(op && op.kind === 'add')
    if (op.kind !== 'add') return
    for (const prev of existing) assert.ok(Math.hypot(prev.x - op.x, prev.y - op.y) > 5)
    existing.push({ ...op, id: `marker-${i}` })
  }
})

console.log(`\n${passed} add-item tests passed`)
