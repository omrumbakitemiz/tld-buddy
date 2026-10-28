// Unit tests for concept C's pure helpers (app/components/add/c/rummage.ts). Run: pnpm test
import assert from 'node:assert/strict'
import { createLedger, moveCursor, pushDigit } from '../app/components/add/c/rummage'

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

test('a number lasts until the caller ends it, however slowly it is typed', () => {
  let r = pushDigit('', '1')
  assert.deepEqual(r, { buffer: '1', value: 1 })
  r = pushDigit(r.buffer, '2')
  assert.equal(r.value, 12)
  assert.equal(pushDigit('', '5').value, 5, 'a cleared buffer starts over')
  assert.equal(pushDigit('', '0').value, 0, 'zeros alone are nothing')
  assert.equal(pushDigit('0', '7').value, 7)
  assert.equal(pushDigit('999', '1').value, 999, 'capped at 999')
})

test('cursor moves over the tile grid and stops at the edges', () => {
  assert.equal(moveCursor(null, 'ArrowDown', 5, 20), 0)
  assert.equal(moveCursor(0, 'ArrowDown', 5, 20), 5)
  assert.equal(moveCursor(4, 'ArrowRight', 5, 20), 4, 'no wrap to the next row')
  assert.equal(moveCursor(5, 'ArrowLeft', 5, 20), 5)
  assert.equal(moveCursor(2, 'ArrowUp', 5, 20), 2)
  assert.equal(moveCursor(17, 'ArrowDown', 5, 20), 17, 'no tile below')
  assert.equal(moveCursor(18, 'ArrowRight', 5, 19), 18, 'last tile')
  assert.equal(moveCursor(3, 'ArrowDown', 4, 8), 7, 'compact grid has 4 columns')
  assert.equal(moveCursor(3, 'ArrowDown', 5, 0), null)
})

test('ledger tracks what the session put on each marker and steps back one entry at a time', () => {
  const l = createLedger()
  l.set('m1', 'matches', 1)
  l.set('m1', 'matches', 2)
  l.set('m2', 'peaches', 1)
  assert.equal(l.units('m1'), 2)
  assert.equal(l.live(), 2)
  assert.equal(l.latestFor('matches'), 'm1')
  assert.deepEqual(l.undo(), { markerId: 'm2', itemId: 'peaches', from: 0, to: 1, digits: undefined })
  assert.equal(l.live(), 1, 'm2 is empty again')
  assert.equal(l.undo()?.from, 1)
  assert.equal(l.units('m1'), 1)
})

test('ledger folds digits typed as one number into one entry', () => {
  const l = createLedger()
  l.set('m1', 'matches', 1) // the tick
  l.set('m1', 'matches', 1, { digits: true, continuing: false }) // "1"
  l.set('m1', 'matches', 12, { digits: true, continuing: true }) // "12"
  assert.equal(l.units('m1'), 12)
  assert.equal(l.last()?.digits, true)
  assert.equal(l.undo()?.to, 12)
  assert.equal(l.units('m1'), 1, 'one step back undoes the whole number')
})

test('ledger latestFor skips markers taken back to zero', () => {
  const l = createLedger()
  l.set('a', 'cloth', 2)
  l.set('b', 'cloth', 1)
  l.set('b', 'cloth', 0)
  assert.equal(l.latestFor('cloth'), 'a')
  assert.equal(l.latestFor('nothing'), null)
  l.clear()
  assert.equal(l.live(), 0)
  assert.equal(l.undo(), null)
})

console.log(`\n${passed} rummage tests passed`)
