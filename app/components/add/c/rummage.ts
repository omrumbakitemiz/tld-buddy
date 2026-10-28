// Pure helpers for concept C (Rummage): the quantity-digit buffer, the tile cursor and the session ledger.
// No Vue, no DOM: unit-tested in scripts/test-add-item.ts.

/** Largest quantity one marker takes from the keyboard. */
export const MAX_QUANTITY = 999

/**
 * Feed one digit key into the quantity buffer. A number lasts until the first key that isn't a digit
 * (the caller clears the buffer then); leading zeros are dropped and it stops growing at 999.
 * `value` is 0 while only zeros were typed.
 */
export function pushDigit(buffer: string, digit: string): { buffer: string; value: number } {
  const joined = (buffer + digit).replace(/^0+/, '')
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

export interface LedgerEntry {
  markerId: string
  itemId: string
  /** Units this session had put on the marker before and after */
  from: number
  to: number
  /** Set while digits are typing one number: later digits update this entry instead of adding one */
  digits?: boolean
}

/**
 * What a session has put on the map: units per marker, plus a log to step back through.
 * One session is one undo batch in the seam; this is what lets `-` and Ctrl+Z reach inside it.
 */
export function createLedger() {
  const own = new Map<string, { itemId: string; q: number }>()
  const log: LedgerEntry[] = []

  const units = (markerId: string) => own.get(markerId)?.q ?? 0
  function store(markerId: string, itemId: string, q: number) {
    if (q > 0) own.set(markerId, { itemId, q })
    else own.delete(markerId)
  }

  return {
    units,
    /** Record that the session now has `to` units on a marker. `continuing` extends a digit entry. */
    set(markerId: string, itemId: string, to: number, opts: { digits?: boolean; continuing?: boolean } = {}) {
      const last = log[log.length - 1]
      if (opts.digits && opts.continuing && last?.digits && last.markerId === markerId) last.to = to
      else log.push({ markerId, itemId, from: units(markerId), to, digits: opts.digits })
      store(markerId, itemId, to)
    },
    /** Step back the latest entry; returns it so the caller can restore the marker. */
    undo(): LedgerEntry | null {
      const e = log.pop()
      if (e) store(e.markerId, e.itemId, e.from)
      return e ?? null
    },
    /** The latest entry, without removing it */
    last: (): LedgerEntry | null => log[log.length - 1] ?? null,
    /** The marker of an item this session touched most recently and still has units on */
    latestFor(itemId: string): string | null {
      for (let i = log.length - 1; i >= 0; i--) {
        const e = log[i]!
        if (e.itemId === itemId && units(e.markerId) > 0) return e.markerId
      }
      return null
    },
    /** Markers the session still has units on */
    live: () => own.size,
    clear() {
      own.clear()
      log.length = 0
    },
  }
}
