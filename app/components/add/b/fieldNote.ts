import { parseEntry } from '../../../lib/addItem'

/** A hash is a note delimiter even without surrounding spaces. */
export function parseFieldNote(input: string) {
  const hash = input.indexOf('#')
  if (hash < 0) return parseEntry(input)
  const entry = parseEntry(input.slice(0, hash))
  return { ...entry, note: input.slice(hash + 1).trim() }
}

/** Keep the note beside its pin, flipping left at the map's right edge. */
export function placeFieldNote(point: { x: number; y: number }, bounds: { left: number; right: number; top: number; bottom: number }, width: number, height: number) {
  const left = point.x + 24 + width <= bounds.right - 12 ? point.x + 24 : point.x - width - 24
  return {
    left: Math.max(bounds.left + 12, Math.min(left, bounds.right - width - 12)),
    top: Math.max(bounds.top + 12, Math.min(point.y - 20, bounds.bottom - height - 12)),
  }
}

/** The seam amends a whole batch contribution, not one repeated line. */
export function entryContribution(entries: { markerId: string; quantity: number }[], markerId: string, index: number, quantity: number) {
  return entries.reduce((sum, entry, i) => sum + (entry.markerId === markerId ? (i === index ? quantity : entry.quantity) : 0), 0)
}
