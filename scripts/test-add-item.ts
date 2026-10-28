// Unit tests for the add-item helpers in app/lib/addItem.ts (search, frecency, spots, batches).
// Run: pnpm test
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  LOOT_GROUPS, computeFrecency, foldText, likelyItemIdsForPOI, nearestSpot, parseEntry, planAdjust, planBatch, rankItems,
} from '../app/lib/addItem'
import { moveCursor, pushDigit } from '../app/components/add/c/rummage'
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

test('rankItems puts whole-name prefix first and shorter names before longer', () => {
  const r = names(rankItems(items, 'rifle', { limit: 5 }))
  assert.equal(r[0], 'Rifle Ammunition')
  assert.ok(r.indexOf('Rifle Ammunition') < r.indexOf('Rifle Shell Casing'))
})

test('rankItems matches word prefixes across words ("rif am")', () => {
  assert.equal(rankItems(items, 'rif am', { limit: 1 })[0]?.name, 'Rifle Ammunition')
  assert.equal(rankItems(items, 'wood mat', { limit: 1 })[0]?.name, 'Wood Matches')
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

test('planAdjust records extra units so undo can take them back', () => {
  const ledger = { added: [] as string[], stacked: [] as { markerId: string; add: number }[] }
  const r = planAdjust(ledger, { id: 'm1', quantity: 3 }, 4)
  assert.deepEqual(r, { applied: 4, quantity: 7, remove: false })
  assert.deepEqual(ledger.stacked, [{ markerId: 'm1', add: 4 }])
  // a marker the batch created needs no record: undo deletes it
  const made = { added: ['m2'], stacked: [] as { markerId: string; add: number }[] }
  planAdjust(made, { id: 'm2', quantity: 1 }, 5)
  assert.deepEqual(made.stacked, [])
})

test('planAdjust only takes back what the batch added', () => {
  const ledger = { added: [] as string[], stacked: [{ markerId: 'm1', add: 2 }] }
  // 3 were there before, the batch added 2: can remove 2 but not the original 3
  assert.deepEqual(planAdjust(ledger, { id: 'm1', quantity: 5 }, -9), { applied: -2, quantity: 3, remove: false })
  assert.deepEqual(ledger.stacked, [])
  assert.deepEqual(planAdjust(ledger, { id: 'm1', quantity: 3 }, -1), { applied: 0, quantity: 3, remove: false })
})

test('planAdjust deletes a marker the batch created once it reaches zero', () => {
  const ledger = { added: ['m2', 'm3'], stacked: [{ markerId: 'm2', add: 1 }] }
  assert.deepEqual(planAdjust(ledger, { id: 'm2', quantity: 2 }, -1), { applied: -1, quantity: 1, remove: false })
  assert.deepEqual(planAdjust(ledger, { id: 'm2', quantity: 1 }, -1), { applied: -1, quantity: 0, remove: true })
  assert.deepEqual(ledger.added, ['m3'])
  assert.deepEqual(ledger.stacked, [])
})

test('rummage digits build one number inside the window and restart after a pause', () => {
  let r = pushDigit('', 0, 10_000, '1')
  assert.deepEqual(r, { buffer: '1', value: 1 })
  r = pushDigit(r.buffer, 10_000, 10_400, '2')
  assert.equal(r.value, 12)
  r = pushDigit(r.buffer, 10_400, 12_000, '5')
  assert.equal(r.value, 5, 'a pause starts over')
  assert.equal(pushDigit('', 0, 1, '0').value, 0, 'zeros alone are nothing')
  assert.equal(pushDigit('0', 1, 2, '7').value, 7)
  assert.equal(pushDigit('999', 5, 6, '1').value, 999, 'capped at 999')
})

test('rummage cursor moves over the tile grid and stops at the edges', () => {
  assert.equal(moveCursor(null, 'ArrowDown', 5, 20), 0)
  assert.equal(moveCursor(0, 'ArrowDown', 5, 20), 5)
  assert.equal(moveCursor(4, 'ArrowRight', 5, 20), 4, 'no wrap to the next row')
  assert.equal(moveCursor(5, 'ArrowLeft', 5, 20), 5)
  assert.equal(moveCursor(2, 'ArrowUp', 5, 20), 2)
  assert.equal(moveCursor(17, 'ArrowDown', 5, 20), 17, 'no tile below')
  assert.equal(moveCursor(18, 'ArrowRight', 5, 19), 18, 'last tile')
  assert.equal(moveCursor(3, 'ArrowDown', 5, 0), null)
})

console.log(`\n${passed} add-item tests passed`)
