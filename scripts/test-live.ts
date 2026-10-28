// Unit tests for the game mod's live state: validation and map positioning (shared/utils/live.ts).
// Run: pnpm test
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { applyTransform, cleanLiveState, headingOnMap, resolveLivePosition, validateLiveState, type LiveState, type MapCalibration, type MapTransform } from '../shared/utils/live'
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
  assert.deepEqual(pos, { mapId: 'mystery-lake', scene: 'LakeRegion', indoors: false, point: { x: 120, y: 240 }, rotation: 90 })
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

test('committed calibration and scene table are consistent', () => {
  // Keeps public/data honest: every calibrated scene is in the table with the same map id
  const scenes = JSON.parse(readFileSync('public/data/game-scenes.json', 'utf8')) as GameScene[]
  const cal = JSON.parse(readFileSync('public/data/map-calibration.json', 'utf8')) as MapCalibration
  for (const [scene, entry] of Object.entries(cal)) {
    assert.equal(scenes.find((s) => s.scene === scene)?.mapId, entry.mapId, scene)
    for (const t of [entry.default, entry.interloper]) if (t) assert.equal(t.matrix.length, 6, scene)
  }
})

console.log(`\n${passed} passed`)
