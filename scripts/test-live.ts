// Unit tests for the game mod's live state: validation and map positioning (shared/utils/live.ts).
// Run: pnpm test
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  applyTransform, cleanLiveEvent, cleanLiveState, headingOnMap, markerIdForEvent, matchItem, planItemsEvent, planMark, resolveLivePosition,
  sceneLabel, UNSORTED_ITEM_ID, validateLiveEvent, validateLiveState,
  type LiveItemsEvent, type LiveMarkEvent, type LiveState, type MapCalibration, type MapTransform, type MarkerChange, type MarkerLike,
} from '../shared/utils/live'
import type { GameScene } from '../shared/types/game'

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

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`)

// 2 px per metre, origin at (100, 200), no rotation
const T: MapTransform = { matrix: [2, 0, 100, 0, 2, 200], imageWidth: 4235, imageHeight: 4650 }
const SCENES: GameScene[] = [{ scene: 'LakeRegion', mapId: 'mystery-lake' }, { scene: 'RuralRegion', mapId: 'pleasant-valley' }]
const CAL: MapCalibration = { LakeRegion: { mapId: 'mystery-lake', default: T } }
const sample = (scene: string, x = 10, z = 20, heading = 0) => ({ scene, x, y: 5, z, heading })
const image = () => ({ imageWidth: 4235, imageHeight: 4650 })

test('valid state passes, junk is rejected', () => {
  assert.equal(validateLiveState({ scenes: [sample('LakeRegion')] }), null)
  assert.notEqual(validateLiveState(null), null)
  assert.notEqual(validateLiveState({ scenes: [] }), null)
  assert.notEqual(validateLiveState({ scenes: [{ ...sample('LakeRegion'), x: Number.NaN }] }), null)
  assert.notEqual(validateLiveState({ scenes: [{ ...sample('LakeRegion'), x: '1' }] }), null)
  assert.notEqual(validateLiveState({ scenes: [sample('../etc')] }), null)
  assert.notEqual(validateLiveState({ scenes: Array.from({ length: 9 }, () => sample('LakeRegion')) }), null)
})

test('clean drops unknown fields', () => {
  const dirty = { scenes: [{ ...sample('LakeRegion'), extra: 'x' }], other: 1 } as unknown as LiveState
  assert.deepEqual(cleanLiveState(dirty), { scenes: [sample('LakeRegion')] })
})

test('transform maps world x/z to map x/y', () => {
  assert.deepEqual(applyTransform(T, 10, 20), { x: 120, y: 240 })
})

test('heading: north is up, east is right, also through a rotated map', () => {
  near(headingOnMap(T, 0), 0)
  near(headingOnMap(T, 90), 90)
  near(headingOnMap(T, 270), 270)
  // Map rotated 90° clockwise: world north (+z) points right on screen
  const rotated: MapTransform = { ...T, matrix: [0, 1, 0, -1, 0, 0] }
  near(headingOnMap(rotated, 0), 90)
})

test('outdoors in a calibrated region: point and heading', () => {
  const pos = resolveLivePosition({ scenes: [sample('LakeRegion', 10, 20, 90)] }, SCENES, CAL, 'default', image)
  assert.deepEqual(pos, { mapId: 'mystery-lake', scene: 'LakeRegion', indoors: false, point: { x: 120, y: 240 }, rotation: 90, pxPerMeter: 2 })
})

test('indoors: placed at the door of the region they came from, no heading', () => {
  const state = { scenes: [sample('CampOffice', -1.9, 4, 180), sample('LakeRegion', 1019, 444, 270)] }
  const pos = resolveLivePosition(state, SCENES, CAL, 'default', image)
  assert.equal(pos?.indoors, true)
  assert.equal(pos?.scene, 'LakeRegion')
  assert.deepEqual(pos?.point, { x: 2138, y: 1088 })
  assert.equal(pos?.rotation, null)
})

test('known but uncalibrated region still gives the map, without a point', () => {
  const pos = resolveLivePosition({ scenes: [sample('RuralRegion')] }, SCENES, CAL, 'default', image)
  assert.equal(pos?.mapId, 'pleasant-valley')
  assert.equal(pos?.point, null)
})

test('unknown scenes only (fresh load inside a building): no position', () => {
  assert.equal(resolveLivePosition({ scenes: [sample('CampOffice')] }, SCENES, CAL, 'default', image), null)
  assert.equal(resolveLivePosition(null, SCENES, CAL, 'default', image), null)
})

test('interloper falls back to default calibration only for a same-size image', () => {
  const state = { scenes: [sample('LakeRegion')] }
  assert.deepEqual(resolveLivePosition(state, SCENES, CAL, 'interloper', image)?.point, { x: 120, y: 240 })
  const otherSize = () => ({ imageWidth: 3000, imageHeight: 3000 })
  assert.equal(resolveLivePosition(state, SCENES, CAL, 'interloper', otherSize)?.point, null)
  assert.equal(resolveLivePosition(state, SCENES, CAL, 'interloper')?.point, null)
})

const ITEMS = [
  { id: 'hatchet', name: 'Hatchet' },
  { id: 'peaches', name: 'Tin of Peaches' },
  { id: 'rifle-ammunition', name: 'Rifle Ammunition' },
]
const mark = (extra: Partial<LiveMarkEvent> = {}): LiveMarkEvent => ({
  id: '3f2c9a1b-0000-4000-8000-000000000000', type: 'mark', createdAt: 1761700000000,
  scenes: [sample('LakeRegion', 10, 20)], item: { name: 'Hatchet', gearName: 'GEAR_Hatchet', quantity: 1 }, ...extra,
})
const ctx = { scenes: SCENES, calibration: CAL, variant: 'default' as const, imageFor: image, items: ITEMS }

test('mark events validate; junk is rejected', () => {
  const { createdAt: _, ...body } = mark()
  assert.equal(validateLiveEvent(body), null)
  assert.equal(validateLiveEvent({ ...body, item: null }), null)
  assert.notEqual(validateLiveEvent({ ...body, id: 'short' }), null)
  assert.notEqual(validateLiveEvent({ ...body, type: 'other' }), null)
  assert.notEqual(validateLiveEvent({ ...body, item: { name: '' } }), null)
  assert.notEqual(validateLiveEvent({ ...body, item: { name: 'X', gearName: 'GEAR X/../' } }), null)
  assert.notEqual(validateLiveEvent({ ...body, item: { name: 'X', quantity: 0 } }), null)
  assert.notEqual(validateLiveEvent({ ...body, item: { name: 'X', quantity: 1.5 } }), null)
})

test('clean stamps the server time and drops unknown fields', () => {
  const { createdAt: _, ...body } = mark()
  const cleaned = cleanLiveEvent({ ...body, extra: 1 } as unknown as Omit<LiveMarkEvent, 'createdAt'>, 42)
  assert.equal(cleaned.createdAt, 42)
  assert.equal('extra' in cleaned, false)
})

test('items match by display name, then by prefab name', () => {
  assert.equal(matchItem({ name: 'Hatchet' }, ITEMS)?.id, 'hatchet')
  assert.equal(matchItem({ name: 'tin of peaches' }, ITEMS)?.id, 'peaches')
  assert.equal(matchItem({ name: 'Rifle Cartridges', gearName: 'GEAR_RifleAmmunition' }, ITEMS)?.id, 'rifle-ammunition')
  assert.equal(matchItem({ name: 'Mystery Box' }, ITEMS), null)
  assert.equal(matchItem(null, ITEMS), null)
})

test('marker ids are stable per event and keep the createId time shape', () => {
  const id = markerIdForEvent(mark())
  assert.equal(id, markerIdForEvent(mark()))
  assert.equal(Number(id.split('-')[1]), 1761700000000)
  assert.notEqual(id, markerIdForEvent(mark({ id: '9a9a9a9a-0000-4000-8000-000000000000' })))
})

test('scene labels read like place names', () => {
  assert.equal(sceneLabel('CampOffice'), 'Camp Office')
  assert.equal(sceneLabel('LakeCabinA'), 'Lake Cabin A')
})

test('planned mark outdoors: known item at the player position', () => {
  const plan = planMark(mark({ item: { name: 'Hatchet', quantity: 2 } }), ctx)
  assert.deepEqual(plan && { ...plan, id: undefined }, {
    id: undefined, mapId: 'mystery-lake', x: 120, y: 240, itemId: 'hatchet', name: 'Hatchet', quantity: 2, note: undefined, gameId: undefined,
  })
})

test('planned mark indoors: at the door, noted with the building', () => {
  const plan = planMark(mark({ scenes: [sample('CampOffice', -1, 3), sample('LakeRegion', 10, 20)] }), ctx)
  assert.deepEqual(plan && [plan.x, plan.y, plan.note], [120, 240, 'Inside Camp Office'])
})

test('planned mark for something unknown, or nothing aimed at: unsorted placeholder', () => {
  const unknown = planMark(mark({ item: { name: 'Mystery Box', quantity: 3 } }), ctx)
  assert.deepEqual(unknown && [unknown.itemId, unknown.name, unknown.quantity, unknown.note], [UNSORTED_ITEM_ID, 'Unsorted loot', 3, 'Game: Mystery Box'])
  const nothing = planMark(mark({ item: null }), ctx)
  assert.deepEqual(nothing && [nothing.itemId, nothing.quantity, nothing.note], [UNSORTED_ITEM_ID, 1, undefined])
})

test('planned mark without a calibrated position is skipped', () => {
  assert.equal(planMark(mark({ scenes: [sample('RuralRegion')] }), ctx), null)
  assert.equal(planMark(mark({ scenes: [sample('CampOffice')] }), ctx), null)
})

test('committed calibration and scene table are consistent', () => {
  // Keeps public/data honest: every calibrated scene is in the table with the same map id
  const scenes = JSON.parse(readFileSync('public/data/game-scenes.json', 'utf8')) as GameScene[]
  const cal = JSON.parse(readFileSync('public/data/map-calibration.json', 'utf8')) as MapCalibration
  for (const [scene, entry] of Object.entries(cal)) {
    assert.equal(scenes.find((s) => s.scene === scene)?.mapId, entry.mapId, scene)
    for (const t of [entry.default, entry.interloper]) if (t) assert.equal(t.matrix.length, 6, scene)
  }
})

// ── Pickups and drops ────────────────────────────────────────────────────────

const itemsEvent = (type: 'pickup' | 'drop', items: LiveItemsEvent['items'], extra: Partial<LiveItemsEvent> = {}): LiveItemsEvent => ({
  id: '7d1e2f3a-0000-4000-8000-000000000000', type, createdAt: 1761700000000, scenes: [sample('LakeRegion', 10, 20)], items, ...extra,
})
// Player at map (120, 240); 2 px per metre
const marker = (id: string, extra: Partial<MarkerLike> = {}): MarkerLike => ({
  id, mapId: 'mystery-lake', itemId: 'hatchet', x: 120, y: 240, quantity: 1, lootedAt: null, ...extra,
})
const withMarkers = (markers: MarkerLike[]) => ({ ...ctx, markers })
const summary = (changes: MarkerChange[] | null) => changes?.map((c) => (c.kind === 'add' ? `add ${c.marker.itemId}×${c.marker.quantity} ${c.marker.note}` : c.kind === 'quantity' ? `${c.markerId}=${c.quantity}` : `looted ${c.markerId}`))

test('pickup and drop events validate; junk is rejected', () => {
  const { createdAt: _, ...body } = itemsEvent('pickup', [{ name: 'Hatchet' }], { container: 'Locker' })
  assert.equal(validateLiveEvent(body), null)
  assert.notEqual(validateLiveEvent({ ...body, items: [] }), null)
  assert.notEqual(validateLiveEvent({ ...body, items: Array.from({ length: 51 }, () => ({ name: 'Stick' })) }), null)
  assert.notEqual(validateLiveEvent({ ...body, items: [{ name: '' }] }), null)
  assert.notEqual(validateLiveEvent({ ...body, container: 'x'.repeat(61) }), null)
  const cleaned = cleanLiveEvent({ ...body, container: ' Lock\u0007er ' }, 42)
  assert.deepEqual(cleaned.type === 'pickup' && [cleaned.createdAt, cleaned.container], [42, 'Locker'])
})

test('pickup loots the nearest marker for the item, within the radius', () => {
  const markers = [marker('far', { x: 120 + 2 * 25 }), marker('near', { x: 120 + 2 * 5 }), marker('other', { itemId: 'peaches' })]
  assert.deepEqual(summary(planItemsEvent(itemsEvent('pickup', [{ name: 'Hatchet' }]), withMarkers(markers))), ['looted near'])
  // 25 m away is too far
  assert.deepEqual(summary(planItemsEvent(itemsEvent('pickup', [{ name: 'Hatchet' }]), withMarkers([markers[0]!]))), [])
  // Already looted, or something the app doesn't know: nothing changes
  assert.deepEqual(summary(planItemsEvent(itemsEvent('pickup', [{ name: 'Hatchet' }]), withMarkers([marker('done', { lootedAt: 1 })]))), [])
  assert.deepEqual(summary(planItemsEvent(itemsEvent('pickup', [{ name: 'Stick' }]), withMarkers([marker('u', { itemId: UNSORTED_ITEM_ID })]))), [])
})

test('pickup takes part of a bigger stack, and two pickups loot two markers', () => {
  const stack = [marker('ammo', { itemId: 'rifle-ammunition', quantity: 10 })]
  assert.deepEqual(summary(planItemsEvent(itemsEvent('pickup', [{ name: 'Rifle Ammunition', quantity: 4 }]), withMarkers(stack))), ['ammo=6'])
  const two = [marker('a'), marker('b', { x: 122 })]
  assert.deepEqual(summary(planItemsEvent(itemsEvent('pickup', [{ name: 'Hatchet' }, { name: 'Hatchet' }]), withMarkers(two))), ['looted a', 'looted b'])
})

test('indoors a pickup only matches markers inside that building, preferring its container', () => {
  const indoors = { scenes: [sample('CampOffice', -1, 3), sample('LakeRegion', 10, 20)] }
  const markers = [
    marker('outside'),
    marker('cabin', { note: 'Inside Lake Cabin A' }),
    marker('desk', { note: 'Stashed in Desk · Inside Camp Office' }),
    marker('locker', { note: 'Stashed in Locker · Inside Camp Office' }),
  ]
  assert.deepEqual(summary(planItemsEvent(itemsEvent('pickup', [{ name: 'Hatchet' }], { ...indoors, container: 'Locker' }), withMarkers(markers))), ['looted locker'])
  // Outdoors, markers inside buildings (all at their door) are left alone
  assert.deepEqual(summary(planItemsEvent(itemsEvent('pickup', [{ name: 'Hatchet' }]), withMarkers(markers.slice(1)))), [])
})

test('drop adds a stash marker, and more of the same joins it', () => {
  const dropped = planItemsEvent(itemsEvent('drop', [{ name: 'Hatchet' }, { name: 'Mystery Box', quantity: 2 }]), withMarkers([]))
  assert.deepEqual(summary(dropped), ['add hatchet×1 Stashed', `add ${UNSORTED_ITEM_ID}×2 Stashed · Game: Mystery Box`])
  const ids = dropped!.map((c) => (c.kind === 'add' ? c.marker.id : ''))
  assert.equal(new Set(ids).size, 2)
  assert.equal(Number(ids[0]!.split('-')[1]), 1761700000000)
  const stash = [marker('s', { quantity: 2, note: 'Stashed' })]
  assert.deepEqual(summary(planItemsEvent(itemsEvent('drop', [{ name: 'Hatchet' }]), withMarkers(stash))), ['s=3'])
  // In a container indoors: noted, and kept apart from a loose stash at the same door
  const inLocker = planItemsEvent(itemsEvent('drop', [{ name: 'Hatchet' }], { scenes: [sample('CampOffice'), sample('LakeRegion', 10, 20)], container: 'Locker' }), withMarkers(stash))
  assert.deepEqual(summary(inLocker), ['add hatchet×1 Stashed in Locker · Inside Camp Office'])
})

test('pickups and drops without a calibrated position are kept for later', () => {
  assert.equal(planItemsEvent(itemsEvent('drop', [{ name: 'Hatchet' }], { scenes: [sample('RuralRegion')] }), withMarkers([])), null)
})

test('a marked object is looted only by picking up that object', () => {
  const markers = [marker('mine', { gameId: 'guid-a', x: 120 + 2 * 50 }), marker('plain')]
  // Its own marker wins even when far away
  assert.deepEqual(summary(planItemsEvent(itemsEvent('pickup', [{ name: 'Hatchet', objectId: 'guid-a' }]), withMarkers(markers))), ['looted mine'])
  // Another hatchet next to it leaves it alone, and takes the plain marker
  assert.deepEqual(summary(planItemsEvent(itemsEvent('pickup', [{ name: 'Hatchet', objectId: 'guid-b' }]), withMarkers([marker('mine', { gameId: 'guid-a' }), marker('plain')]))), ['looted plain'])
  // Works for items the app doesn't know too (an unsorted mark of that object)
  const unsorted = [marker('u', { itemId: UNSORTED_ITEM_ID, gameId: 'guid-c' })]
  assert.deepEqual(summary(planItemsEvent(itemsEvent('pickup', [{ name: 'Mystery Box', objectId: 'guid-c' }]), withMarkers(unsorted))), ['looted u'])
  // Marks carry the id; it must look like one
  assert.equal(planMark(mark({ item: { name: 'Hatchet', objectId: 'guid-a' } }), ctx)?.gameId, 'guid-a')
  const { createdAt: _, ...body } = mark({ item: { name: 'Hatchet', objectId: 'not an id!' } })
  assert.notEqual(validateLiveEvent(body), null)
})

test('items the game calls "New …" still match', () => {
  assert.equal(matchItem({ name: 'New Tin of Peaches' }, ITEMS)?.id, 'peaches')
})

test('the mark key pressed again on the same thing is a repeat', () => {
  const t = 1761700000000
  const earlier = (extra: Partial<MarkerLike> = {}) => marker(`marker-${t - 30_000}-abc`, extra)
  const withRun = (markers: MarkerLike[]) => ({ ...ctx, markers })
  // Same object id: a repeat however long ago
  assert.equal(planMark(mark({ item: { name: 'Hatchet', objectId: 'g1' } }), withRun([marker('marker-1-x', { gameId: 'g1' })]))?.repeatOf, 'marker-1-x')
  // No id: same item, same spot, moments ago
  assert.equal(planMark(mark(), withRun([earlier()]))?.repeatOf, `marker-${t - 30_000}-abc`)
  // Not a repeat: looted, a metre and a half away, long ago, or another object of the same kind
  assert.equal(planMark(mark(), withRun([earlier({ lootedAt: 1 })]))?.repeatOf, undefined)
  assert.equal(planMark(mark(), withRun([earlier({ x: 123 })]))?.repeatOf, undefined)
  assert.equal(planMark(mark(), withRun([marker(`marker-${t - 10 * 60_000}-abc`)]))?.repeatOf, undefined)
  assert.equal(planMark(mark({ item: { name: 'Hatchet', objectId: 'g2' } }), withRun([marker('marker-1-x', { gameId: 'g1' })]))?.repeatOf, undefined)
})

test('marking an item just put down is a repeat of its stash', () => {
  const t = 1761700000000
  const stash = (note: string) => marker(`marker-${t - 5_000}-abc`, { note })
  assert.equal(planMark(mark(), { ...ctx, markers: [stash('Stashed')] })?.repeatOf, `marker-${t - 5_000}-abc`)
  // Unknown items keep the game's name in both notes
  assert.equal(planMark(mark({ item: { name: 'Mystery Box' } }), { ...ctx, markers: [stash('Stashed · Game: Mystery Box')].map((m) => ({ ...m, itemId: UNSORTED_ITEM_ID })) })?.repeatOf, `marker-${t - 5_000}-abc`)
  // A stash of something else, or in another building, is not
  assert.equal(planMark(mark({ item: { name: 'Mystery Box' } }), { ...ctx, markers: [stash('Stashed · Game: Other')].map((m) => ({ ...m, itemId: UNSORTED_ITEM_ID })) })?.repeatOf, undefined)
  assert.equal(planMark(mark(), { ...ctx, markers: [stash('Stashed · Inside Camp Office')] })?.repeatOf, undefined)
})

console.log(`\n${passed} passed`)
