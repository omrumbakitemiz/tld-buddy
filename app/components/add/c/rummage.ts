// Pure helpers for concept C (Rummage): the quantity-digit buffer and the tile cursor.
// No Vue, no DOM: unit-tested in scripts/test-add-item.ts.

/** Digits typed this close together are one number ("1" "2" → 12). */
export const DIGIT_WINDOW_MS = 1200

/** Largest quantity one marker takes from the keyboard. */
export const MAX_QUANTITY = 999

/**
 * Feed one digit key into the quantity buffer. A pause starts a new number; leading zeros are dropped;
 * the number stops growing at 999. `value` is 0 while only zeros were typed.
 */
export function pushDigit(buffer: string, lastAt: number, now: number, digit: string): { buffer: string; value: number } {
  const fresh = now - lastAt > DIGIT_WINDOW_MS
  const joined = ((fresh ? '' : buffer) + digit).replace(/^0+/, '')
  const next = Number(joined) > MAX_QUANTITY ? buffer : joined
  return { buffer: next, value: Number(next || 0) }
}

export type CursorKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown'

/**
 * Move the tile cursor over a grid of `count` tiles in `cols` columns. The first arrow press from
 * "no cursor" lands on the first tile; the edges stop (no wrap) so the cursor never jumps unexpectedly.
 */
export function moveCursor(index: number | null, key: CursorKey, cols: number, count: number): number | null {
  if (!count) return null
  if (index === null || index < 0) return 0
  const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[key]
  const next = index + delta
  if (key === 'ArrowLeft' && index % cols === 0) return index
  if (key === 'ArrowRight' && (index % cols === cols - 1 || next >= count)) return index
  return next < 0 || next >= count ? index : next
}
