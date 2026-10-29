// Unit tests for the in-game HUD data (shared/utils/hud.ts). Run: pnpm test
import assert from 'node:assert/strict'
import { createDefaultAppData } from '../shared/utils/appData'
import { hudData } from '../shared/utils/hud'
import { applyTransform, invertTransform, type MapCalibration, type MapTransform } from '../shared/utils/live'
import type { AppData, GameMap, GameScene, Marker } from '../shared/types/game'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok   ${name}`)
}

const t: MapTransform = { matrix: [0.5, 0.1, 100, -0.1, 0.5, 200], imageWidth: 1000, imageHeight: 1000 }
const scenes: GameScene[] = [{ scene: 'LakeRegion', mapId: 'mystery-lake' }]
const calibration: MapCalibration = { LakeRegion: { mapId: 'mystery-lake', default: t } }
const maps = [{ id: 'mystery-lake', default: { imageWidth: 1000, imageHeight: 1000 } }] as unknown as GameMap[]

function marker(id: string, world: { x: number; z: number }, extra: Partial<Marker> = {}): Marker {
  const p = applyTransform(t, world.x, world.z)
  return { id, runId: 'run-1', mapId: 'mystery-lake', itemId: 'hatchet', name: 'Hatchet', x: p.x, y: p.y, quantity: 1, ...extra }
}

function data(markers: Marker[], gameSave?: string): AppData {
  return { ...createDefaultAppData(), runs: [{ id: 'run-1', name: 'Stalker', difficulty: 'stalker', createdAt: 0, gameSave }], currentRunId: 'run-1', markers }
}

test('inverse transform gives back the world position', () => {
  const p = applyTransform(t, 123.4, -56.7)
  const w = invertTransform(t, p.x, p.y)!
  assert.ok(Math.abs(w.x - 123.4) < 1e-9 && Math.abs(w.z + 56.7) < 1e-9)
})

test('outdoors: unlooted markers of the map, nearest first, with world positions', () => {
  const d = data([
    marker('m-far', { x: 300, z: 0 }),
    marker('m-near', { x: 10, z: 5 }, { name: 'Flare', note: 'Dropped' }),
    marker('m-looted', { x: 1, z: 1 }, { lootedAt: 5 }),
    marker('m-door', { x: 50, z: 0 }, { note: 'Inside Camp Office' }),
    { ...marker('m-other', { x: 0, z: 0 }), mapId: 'pleasant-valley' },
  ], 'Sandbox-1')
  const hud = hudData(d, 'Sandbox-1', { scene: 'LakeRegion', x: 0, z: 0 }, scenes, calibration, maps)
  assert.equal(hud.run, 'Stalker')
  assert.deepEqual(hud.markers.map((m) => m.name + (m.stash ? '*' : '') + (m.inside ? `@${m.inside}` : '')), ['Flare*', 'Hatchet@Camp Office', 'Hatchet'])
  assert.deepEqual([hud.markers[0]!.x, hud.markers[0]!.z], [10, 5])
})

test('indoors: the markers noted inside this building, without positions', () => {
  const d = data([marker('m-in', { x: 50, z: 0 }, { note: 'Stored in Locker · Inside Camp Office' }), marker('m-out', { x: 0, z: 0 })], 'Sandbox-1')
  const hud = hudData(d, 'Sandbox-1', { scene: 'CampOffice', x: 1, z: 1 }, scenes, calibration, maps)
  assert.deepEqual(hud.markers, [{ name: 'Hatchet', quantity: 1, stash: true, inside: 'Camp Office', x: null, z: null }])
})

test('run choice: the linked run; the current run only when it tracks no other save', () => {
  const here = { scene: 'LakeRegion', x: 0, z: 0 }
  assert.equal(hudData(data([], 'Sandbox-2'), 'Sandbox-1', here, scenes, calibration, maps).run, null)
  assert.equal(hudData(data([]), 'Sandbox-1', here, scenes, calibration, maps).run, 'Stalker')
})

console.log(`\n${passed} hud tests passed`)
