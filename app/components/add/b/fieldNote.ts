import { parseEntry } from '../../../lib/addItem'

/** A hash is a note delimiter even without surrounding spaces. */
export function parseFieldNote(input: string) {
  return parseEntry(input.replace(/\s*#/, ' # '))
}

/** Keep the note beside its pin, flipping left at the map's right edge. */
export function placeFieldNote(point: { x: number; y: number }, bounds: { left: number; right: number; top: number; bottom: number }, width: number, height: number) {
  const left = point.x + 24 + width <= bounds.right - 12 ? point.x + 24 : point.x - width - 24
  return {
    left: Math.max(bounds.left + 12, Math.min(left, bounds.right - width - 12)),
    top: Math.max(bounds.top + 12, Math.min(point.y - 20, bounds.bottom - height - 12)),
  }
}
