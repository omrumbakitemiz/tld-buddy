// Unit tests for variant A ("Wheel"): app/components/add/a/wheel.ts, plus the ring slots it relies on.
// Run: pnpm test
import assert from 'node:assert/strict'
import {
  WHEEL, contribution, digitOf, ownsMarker, pageOf, polar, readKey, readoutSide, sectorPath, sliceAt, sliceMid,
  stepQuantity, summarise, typeQuantity, wheelSteps, type KeyInput, type KeyState, type WheelPick,
} from '../app/components/add/a/wheel'
import { SPREAD_RADIUS, planBatch, ringSlot } from '../app/lib/addItem'

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

const k = (key: string, extra: Partial<KeyInput> = {}): KeyInput => ({
  key,
  code: /^\d$/.test(key) ? `Digit${key}` : key === ' ' ? 'Space' : /^[a-z]$/i.test(key) ? `Key${key.toUpperCase()}` : key,
  shiftKey: false, ctrlKey: false, metaKey: false, altKey: false,
  ...extra,
})
const at = (stage: KeyState['stage'], hasPick = false, queryEmpty = true): KeyState => ({ stage, hasPick, queryEmpty })

test('slices run clockwise from 12 o\'clock and hit-test back to themselves', () => {
  assert.deepEqual(polar(10, sliceMid(0)), { x: 0, y: -10 })
  assert.deepEqual(polar(10, sliceMid(2)), { x: 10, y: 0 })
  for (let i = 0; i < 8; i++) {
    const p = polar(WHEEL.content, sliceMid(i))
    assert.equal(sliceAt(p.x, p.y), i, `slice ${i}`)
  }
  assert.equal(sliceAt(0, 0), -1, 'hole')
  assert.equal(sliceAt(0, -(WHEEL.outer + 5)), -1, 'outside')
})

test('sectorPath draws a closed annular sector', () => {
  const d = sectorPath(40, 150, -Math.PI / 8, Math.PI / 8)
  assert.match(d, /^M.+A150 150 0 0 1 .+L.+A40 40 0 0 0 .+Z$/)
})

test('readout goes below when it fits, above otherwise', () => {
  assert.equal(readoutSide(300, 900, 200), 'below')
  assert.equal(readoutSide(700, 900, 200), 'above')
  assert.equal(readoutSide(300, 500, 400), 'above', 'neither fits: the roomier side')
  assert.equal(readoutSide(150, 600, 400), 'below', 'neither fits: the roomier side')
})

test('plain digits choose; 9 pages a group; 0 does nothing', () => {
  assert.deepEqual(readKey(k('3'), at('groups')), { type: 'slice', index: 2 })
  assert.deepEqual(readKey(k('8'), at('items', true)), { type: 'slice', index: 7 })
  assert.deepEqual(readKey(k('9'), at('items')), { type: 'more' })
  assert.deepEqual(readKey(k('9'), at('groups')), { type: 'noop' })
  assert.deepEqual(readKey(k('0'), at('groups')), { type: 'noop' })
  assert.deepEqual(readKey(k('2'), at('search', false, false)), { type: 'slice', index: 1 }, 'digits pick search results')
})

test('Shift+digits and the numpad are quantity, never navigation', () => {
  assert.deepEqual(readKey(k('@', { code: 'Digit2', shiftKey: true }), at('groups', true)), { type: 'qty-digit', digit: 2 })
  assert.deepEqual(readKey(k('5', { code: 'Numpad5' }), at('items', true)), { type: 'qty-digit', digit: 5 })
  assert.deepEqual(readKey(k('!', { code: 'Digit1', shiftKey: true }), at('groups', false)), { type: 'noop' }, 'nothing picked yet')
  assert.deepEqual(readKey(k('+'), at('groups', true)), { type: 'qty-step', delta: 1 })
  assert.deepEqual(readKey(k('-', { code: 'Minus' }), at('groups', true)), { type: 'qty-step', delta: -1 })
})

test('Space repeats, Enter closes (or takes the top result), Esc steps back', () => {
  assert.deepEqual(readKey(k(' '), at('groups')), { type: 'again' })
  assert.deepEqual(readKey(k(' '), at('search', true, true)), { type: 'again' })
  assert.equal(readKey(k(' '), at('search', true, false)), null, 'a space inside a search is typed')
  assert.deepEqual(readKey(k('Enter'), at('groups', true)), { type: 'close' })
  assert.deepEqual(readKey(k('Enter'), at('search', false, false)), { type: 'pick-top' })
  assert.deepEqual(readKey(k('Escape'), at('groups')), { type: 'close' })
  assert.deepEqual(readKey(k('Escape'), at('items')), { type: 'back' })
  assert.deepEqual(readKey(k('Escape'), at('search', false, false)), { type: 'back' })
})

test('Backspace and Ctrl+Z take back the last pick; inside text they edit text', () => {
  assert.deepEqual(readKey(k('Backspace'), at('groups', true)), { type: 'remove-last' })
  assert.deepEqual(readKey(k('Backspace'), at('items', true)), { type: 'back' })
  assert.equal(readKey(k('Backspace'), at('search', true, false)), null)
  assert.deepEqual(readKey(k('Backspace'), at('search', true, true)), { type: 'back' })
  assert.deepEqual(readKey(k('z', { ctrlKey: true }), at('groups', true)), { type: 'remove-last' })
  assert.deepEqual(readKey(k('z', { metaKey: true }), at('items', true)), { type: 'remove-last' })
  assert.equal(readKey(k('z', { ctrlKey: true }), at('search', true, false)), null)
  assert.equal(readKey(k('k', { ctrlKey: true }), at('groups')), null, 'other shortcuts pass through')
})

test('letters start a search, Tab opens the note, note keys save or cancel', () => {
  assert.deepEqual(readKey(k('h'), at('groups')), { type: 'search-start', text: 'h' })
  assert.deepEqual(readKey(k('A', { shiftKey: true }), at('items')), { type: 'search-start', text: 'A' })
  assert.equal(readKey(k('h'), at('search', false, false)), null)
  assert.deepEqual(readKey(k('Tab'), at('groups', true)), { type: 'note' })
  assert.deepEqual(readKey(k('Tab'), at('groups', false)), { type: 'noop' })
  assert.deepEqual(readKey(k('Enter'), at('note', true)), { type: 'note-save', close: true })
  assert.deepEqual(readKey(k('Tab'), at('note', true)), { type: 'note-save', close: false })
  assert.deepEqual(readKey(k('Escape'), at('note', true)), { type: 'back' })
  assert.equal(readKey(k('3'), at('note', true)), null, 'digits are typed into a note')
})

test('digitOf reads the physical key, so Shift+1 is still 1', () => {
  assert.equal(digitOf({ key: '!', code: 'Digit1' }), 1)
  assert.equal(digitOf({ key: '7', code: 'Numpad7' }), 7)
  assert.equal(digitOf({ key: 'a', code: 'KeyA' }), null)
})

test('typeQuantity builds a number, skips leading zeros and caps at three digits', () => {
  let q = typeQuantity('', 1)
  assert.deepEqual(q, { buffer: '1', quantity: 1 })
  q = typeQuantity(q.buffer, 2)
  assert.deepEqual(q, { buffer: '12', quantity: 12 })
  assert.deepEqual(typeQuantity('', 0), { buffer: '', quantity: null })
  assert.deepEqual(typeQuantity('999', 4), { buffer: '4', quantity: 4 }, 'a fourth digit starts over')
  assert.equal(stepQuantity(1, -1), 1)
  assert.equal(stepQuantity(998, 5), 999)
})

test('wheelSteps: one notch is one step, trackpad deltas add up, up adds', () => {
  assert.deepEqual(wheelSteps(0, -100), { steps: 1, acc: 0 })
  assert.deepEqual(wheelSteps(0, 120), { steps: -1, acc: 0 })
  let r = wheelSteps(0, -20)
  assert.equal(r.steps, 0)
  r = wheelSteps(r.acc, -20)
  assert.equal(r.steps, 0)
  r = wheelSteps(r.acc, -20)
  assert.deepEqual(r, { steps: 1, acc: 0 })
  assert.equal(wheelSteps(-40, 20).acc, 20, 'a change of direction drops what was pending')
})

test('contribution and ownsMarker track what this wheel put on each marker', () => {
  const picks: WheelPick[] = [
    { itemId: 'matches', markerId: 'm1', quantity: 12, stacked: false },
    { itemId: 'cloth', markerId: 'm2', quantity: 1, stacked: true },
    { itemId: 'matches', markerId: 'm1', quantity: 1, stacked: false },
  ]
  assert.equal(contribution(picks, 'm1'), 13)
  assert.equal(contribution(picks, 'nope'), 0)
  assert.equal(ownsMarker(picks, picks[1]!), false, 'stacked on older loot')
  assert.equal(ownsMarker(picks, picks[2]!), false, 'shares its marker with an earlier pick')
  assert.equal(ownsMarker([picks[0]!], picks[0]!), true)
})

test('pageOf pages by eight and wraps', () => {
  const list = Array.from({ length: 19 }, (_, i) => i)
  assert.deepEqual(pageOf(list, 0).items, [0, 1, 2, 3, 4, 5, 6, 7])
  assert.deepEqual(pageOf(list, 2), { items: [16, 17, 18], page: 2, pages: 3 })
  assert.equal(pageOf(list, 3).page, 0)
  assert.deepEqual(pageOf([], 0), { items: [], page: 0, pages: 1 })
})

test('summarise names a couple of items and counts the rest', () => {
  assert.equal(summarise([{ name: 'Hatchet', quantity: 1 }]), 'Hatchet')
  assert.equal(summarise([{ name: 'Wood Matches', quantity: 12 }, { name: 'Hatchet', quantity: 1 }]), 'Wood Matches ×12 and Hatchet')
  assert.equal(summarise([
    { name: 'A', quantity: 1 }, { name: 'B', quantity: 2 }, { name: 'C', quantity: 1 }, { name: 'D', quantity: 1 }, { name: 'A', quantity: 1 },
  ]), 'A ×2, B ×2 and 2 more')
})

test('ringSlot puts every slot apart: 6 on the first ring, 12 on the second', () => {
  const spot = { x: 100, y: 100 }
  const pts = Array.from({ length: 18 }, (_, i) => ringSlot(spot, i))
  for (let i = 0; i < pts.length; i++) {
    const d = Math.hypot(pts[i]!.x - 100, pts[i]!.y - 100)
    assert.ok(Math.abs(d - (i < 6 ? SPREAD_RADIUS : SPREAD_RADIUS * 2)) < 1e-9, `slot ${i} radius`)
    for (let j = 0; j < i; j++) assert.ok(Math.hypot(pts[i]!.x - pts[j]!.x, pts[i]!.y - pts[j]!.y) > 5, `slots ${i}/${j} apart`)
  }
})

test('planBatch one item at a time (a wheel) spreads like one big batch', () => {
  const spot = { x: 500, y: 500 }
  const existing: { id: string; itemId: string; x: number; y: number; lootedAt: null }[] = []
  for (let i = 0; i < 9; i++) {
    const [op] = planBatch(spot, [{ itemId: `item-${i}`, quantity: 1 }], existing)
    assert.ok(op?.kind === 'add')
    existing.push({ id: `m${i}`, itemId: op.itemId, x: op.x, y: op.y, lootedAt: null })
  }
  for (let i = 0; i < existing.length; i++) {
    for (let j = 0; j < i; j++) {
      const d = Math.hypot(existing[i]!.x - existing[j]!.x, existing[i]!.y - existing[j]!.y)
      assert.ok(d > 5, `markers ${i} and ${j} overlap (${d.toFixed(1)} px)`)
    }
  }
})

console.log(`\n${passed} wheel tests passed`)
