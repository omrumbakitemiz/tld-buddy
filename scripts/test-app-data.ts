// Unit tests for the data migration, validation and three-way merge in shared/utils/appData.ts.
// Run: pnpm test
import assert from 'node:assert/strict'
import { createDefaultAppData, mergeAppData, normalizeAppData, validateAppData } from '../shared/utils/appData'
import type { AppData } from '../shared/types/game'

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

/** Document exactly as the pre-overhaul build stored it (no lootedAt, no revision). */
const LEGACY_SEED = {
  runs: [{ id: 'run-1', name: 'Old Stalker', difficulty: 'stalker', createdAt: 1752000000000 }],
  currentRunId: 'run-1',
  currentMapId: 'mystery-lake',
  markers: [
    { id: 'marker-1', runId: 'run-1', mapId: 'mystery-lake', itemId: 'hatchet', name: 'Hatchet', x: 2100, y: 2300, quantity: 1 },
    { id: 'marker-2', runId: 'run-1', mapId: 'mystery-lake', itemId: 'rifle-ammunition', name: 'Rifle Ammunition', x: 2600, y: 1800, quantity: 5, note: 'under the bed' },
  ],
  enabledPOIs: ['mystery-lake--camp-office'],
  poiPins: [{ poiId: 'mystery-lake--camp-office', x: 2900, y: 2200 }],
  stashedItems: [{ id: 'stash-1', runId: 'run-1', poiId: 'mystery-lake--camp-office', itemId: 'hatchet', quantity: 1 }],
  recentMapIds: ['mystery-lake'],
  travelMode: false,
  travelLeftMapId: null,
  travelRightMapId: null,
}

/** Even older shape: no stashes, pins, recent maps or travel fields at all. */
const OLDEST_SEED = {
  runs: [{ id: 'run-1', name: 'R', difficulty: 'pilgrim', createdAt: 1 }],
  currentRunId: 'run-1',
  currentMapId: null,
  markers: [{ id: 'marker-1', runId: 'run-1', mapId: 'm', itemId: 'i', name: 'x', x: 1, y: 2, quantity: 1 }],
  enabledPOIs: [],
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))
const marker = (id: string, extra: Record<string, unknown> = {}) =>
  ({ id, runId: 'run-1', mapId: 'mystery-lake', itemId: 'flare', name: id, x: 1, y: 1, quantity: 1, lootedAt: null, ...extra })

// ── Migration ───────────────────────────────────────────────────────────────

test('legacy seed passes validation as stored', () => {
  assert.equal(validateAppData(LEGACY_SEED), null)
  assert.equal(validateAppData(OLDEST_SEED), null)
})

test('legacy seed normalizes losslessly and still validates', () => {
  const d = normalizeAppData(LEGACY_SEED)
  assert.equal(d.markers.length, 2)
  assert.equal(d.markers[0]!.lootedAt, null)
  assert.equal(d.markers[1]!.note, 'under the bed')
  assert.equal(d.stashedItems.length, 1)
  assert.equal(validateAppData(d), null)
  assert.equal(validateAppData(normalizeAppData(OLDEST_SEED)), null)
})

test('normalize drops orphans and duplicate ids so client saves always validate', () => {
  const d = normalizeAppData({
    ...LEGACY_SEED,
    markers: [...LEGACY_SEED.markers, LEGACY_SEED.markers[0], { ...LEGACY_SEED.markers[0], id: 'orphan', runId: 'gone' }],
  })
  assert.deepEqual(d.markers.map((m) => m.id), ['marker-1', 'marker-2'])
  assert.equal(validateAppData(d), null)
})

// ── Validation (A2) ─────────────────────────────────────────────────────────

test('validation rejects null records that would wipe data', () => {
  assert.notEqual(validateAppData({ runs: [null], markers: [null] }), null)
  assert.notEqual(validateAppData({ runs: [], markers: [null] }), null)
  assert.notEqual(validateAppData(null), null)
  assert.notEqual(validateAppData({}), null)
})

test('validation rejects bad ids, references and numbers', () => {
  const base = clone(LEGACY_SEED)
  const cases: Array<[string, (d: typeof base) => void]> = [
    ['missing run id', (d) => { delete (d.runs[0] as Partial<typeof d.runs[0]>).id }],
    ['bad difficulty', (d) => { (d.runs[0] as Record<string, unknown>).difficulty = 'nightmare' }],
    ['duplicate marker id', (d) => { d.markers.push(clone(d.markers[0]!)) }],
    ['dangling marker run', (d) => { d.markers[0]!.runId = 'nope' }],
    ['string coordinate', (d) => { (d.markers[0] as Record<string, unknown>).x = '12' }],
    ['negative quantity', (d) => { d.markers[0]!.quantity = -1 }],
    ['dangling stash run', (d) => { d.stashedItems[0]!.runId = 'nope' }],
    ['pin without coords', (d) => { delete (d.poiPins[0] as Partial<typeof d.poiPins[0]>).x }],
    ['non-string enabled POI', (d) => { (d.enabledPOIs as unknown[]).push(3) }],
  ]
  for (const [label, mutate] of cases) {
    const d = clone(base)
    mutate(d)
    assert.notEqual(validateAppData(d), null, label)
  }
})

test('validation accepts an emptied-but-valid document (user deleted every run)', () => {
  assert.equal(validateAppData(createDefaultAppData()), null)
})

// ── Merge ───────────────────────────────────────────────────────────────────

const BASE = normalizeAppData(LEGACY_SEED)

test('independent edits on both sides are all kept', () => {
  const local = clone(BASE)
  local.markers[0]!.lootedAt = 5
  local.markers.push(marker('local-new'))
  const remote = clone(BASE)
  remote.markers[0]!.note = 'from phone'
  remote.markers.push(marker('remote-new'))
  const m = mergeAppData(BASE, local, remote)
  const a = m.markers.find((x) => x.id === 'marker-1')!
  assert.equal(a.lootedAt, 5)
  assert.equal(a.note, 'from phone')
  assert.deepEqual(m.markers.map((x) => x.id).sort(), ['local-new', 'marker-1', 'marker-2', 'remote-new'])
})

test('run deleted remotely while a marker was added locally → run resurrected (A3)', () => {
  const local = clone(BASE)
  local.markers.push(marker('added-during-delete'))
  const remote: AppData = { ...clone(BASE), runs: [], markers: [], stashedItems: [], currentRunId: null }
  const m = mergeAppData(BASE, local, remote)
  assert.deepEqual(m.runs.map((r) => r.id), ['run-1'])
  assert.ok(m.markers.some((x) => x.id === 'added-during-delete'))
  // Untouched siblings that the other side deleted stay deleted
  assert.ok(!m.markers.some((x) => x.id === 'marker-1'))
  assert.equal(validateAppData(m), null)
})

test('run deleted locally while a marker was edited remotely → run resurrected (A3)', () => {
  const local: AppData = { ...clone(BASE), runs: [], markers: [], stashedItems: [], currentRunId: null }
  const remote = clone(BASE)
  remote.markers[1]!.quantity = 9
  const m = mergeAppData(BASE, local, remote)
  assert.deepEqual(m.runs.map((r) => r.id), ['run-1'])
  assert.equal(m.markers.find((x) => x.id === 'marker-2')?.quantity, 9)
  assert.equal(validateAppData(m), null)
})

test('run deleted while a stash was edited elsewhere → run resurrected (A3)', () => {
  const local: AppData = { ...clone(BASE), runs: [], markers: [], stashedItems: [], currentRunId: null }
  const remote = clone(BASE)
  remote.stashedItems[0]!.quantity = 4
  const m = mergeAppData(BASE, local, remote)
  assert.equal(m.runs.length, 1)
  assert.equal(m.stashedItems[0]?.quantity, 4)
})

test('run deleted with no concurrent child changes → stays deleted', () => {
  const local: AppData = { ...clone(BASE), runs: [], markers: [], stashedItems: [], currentRunId: null }
  const m = mergeAppData(BASE, local, clone(BASE))
  assert.equal(m.runs.length, 0)
  assert.equal(m.markers.length, 0)
  assert.equal(m.stashedItems.length, 0)
  assert.equal(m.currentRunId, null)
})

test('both sides add different markers with the same id → both kept, local re-id (A12)', () => {
  const local = clone(BASE)
  local.markers.push(marker('marker-3', { itemId: 'flare', name: 'Local flare' }))
  const remote = clone(BASE)
  remote.markers.push(marker('marker-3', { itemId: 'rope', name: 'Remote rope' }))
  const m = mergeAppData(BASE, local, remote)
  const names = m.markers.filter((x) => x.name === 'Local flare' || x.name === 'Remote rope')
  assert.equal(names.length, 2)
  assert.equal(m.markers.find((x) => x.name === 'Remote rope')!.id, 'marker-3')
  assert.notEqual(m.markers.find((x) => x.name === 'Local flare')!.id, 'marker-3')
  assert.equal(validateAppData(m), null)
})

test('same-id run collision re-ids the local run and moves its children with it (A12)', () => {
  const empty = createDefaultAppData()
  const local: AppData = { ...clone(empty), runs: [{ id: 'run-x', name: 'PC run', difficulty: 'stalker', createdAt: 1 }], currentRunId: 'run-x', markers: [{ ...marker('m-pc'), runId: 'run-x' }] }
  const remote: AppData = { ...clone(empty), runs: [{ id: 'run-x', name: 'Phone run', difficulty: 'misery', createdAt: 2 }], currentRunId: 'run-x', markers: [{ ...marker('m-phone'), runId: 'run-x' }] }
  const m = mergeAppData(empty, local, remote)
  assert.equal(m.runs.length, 2)
  const pcRun = m.runs.find((r) => r.name === 'PC run')!
  assert.notEqual(pcRun.id, 'run-x')
  assert.equal(m.markers.find((x) => x.id === 'm-pc')!.runId, pcRun.id)
  assert.equal(m.markers.find((x) => x.id === 'm-phone')!.runId, 'run-x')
  assert.equal(m.currentRunId, pcRun.id)
  assert.equal(validateAppData(m), null)
})

test('identical additions on both sides are not duplicated', () => {
  const local = clone(BASE)
  const remote = clone(BASE)
  local.markers.push(marker('same'))
  remote.markers.push(marker('same'))
  assert.equal(mergeAppData(BASE, local, remote).markers.filter((x) => x.id === 'same').length, 1)
})

test('set fields merge additions and removals from both sides', () => {
  const b = { ...createDefaultAppData(), enabledPOIs: ['x', 'y'] }
  const m = mergeAppData(b, { ...b, enabledPOIs: ['x', 'z'] }, { ...b, enabledPOIs: ['x', 'y', 'w'] })
  assert.deepEqual([...m.enabledPOIs].sort(), ['w', 'x', 'z'])
})

console.log(`\n${passed} tests passed`)
