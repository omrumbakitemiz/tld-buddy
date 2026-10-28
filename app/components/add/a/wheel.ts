// Variant A ("Wheel", docs/add-item/CONCEPTS.md): the pure parts. Geometry of the radial
// menu, the keyboard model and quantity entry. No Vue, no DOM: unit-tested in
// scripts/test-add-item-a.ts.

// ── Geometry ────────────────────────────────────────────────────────────────

/** Radii in CSS px. The hole stays clear so the spot (and its live tile) shows through. */
export const WHEEL = {
  /** Clear centre over the spot */
  hole: 36,
  /** Slices start here */
  inner: 40,
  /** Slices end here */
  outer: 150,
  /** Where a slice's icon + label stack is centred */
  content: 102,
  /** Where a slice's digit sits (next to the hole, i.e. next to the pointer) */
  digit: 51,
  slices: 8,
} as const

/** Middle of slice `i` in radians, 0 = 12 o'clock, clockwise (slice 1 on top, 3 on the right). */
export function sliceMid(i: number, n: number = WHEEL.slices): number {
  return (2 * Math.PI * i) / n
}

/** Point at radius `r` and clock angle `a` (0 = up, clockwise), relative to the centre, y down. */
export function polar(r: number, a: number): { x: number; y: number } {
  return { x: round(r * Math.sin(a)), y: round(-r * Math.cos(a)) }
}

/** SVG path of an annular sector between radii r0..r1 and clock angles a0..a1. */
export function sectorPath(r0: number, r1: number, a0: number, a1: number): string {
  const large = a1 - a0 > Math.PI ? 1 : 0
  const p0 = polar(r1, a0)
  const p1 = polar(r1, a1)
  const p2 = polar(r0, a1)
  const p3 = polar(r0, a0)
  return `M${p0.x} ${p0.y}A${r1} ${r1} 0 ${large} 1 ${p1.x} ${p1.y}L${p2.x} ${p2.y}A${r0} ${r0} 0 ${large} 0 ${p3.x} ${p3.y}Z`
}

/** The sector for slice `i` of `n`. */
export function slicePath(i: number, n: number = WHEEL.slices, r0: number = WHEEL.inner, r1: number = WHEEL.outer): string {
  const half = Math.PI / n
  const mid = sliceMid(i, n)
  return sectorPath(r0, r1, mid - half, mid + half)
}

/** Which slice a point (relative to the centre, y down) falls in, or -1 inside the hole / outside. */
export function sliceAt(dx: number, dy: number, n: number = WHEEL.slices, r0: number = WHEEL.inner, r1: number = WHEEL.outer): number {
  const r = Math.hypot(dx, dy)
  if (r < r0 || r > r1) return -1
  let a = Math.atan2(dx, -dy)
  if (a < 0) a += 2 * Math.PI
  return Math.round(a / (2 * Math.PI / n)) % n
}

/**
 * Put the readout plate below the wheel when it fits, else above, else wherever there is
 * more room. `cy` is the wheel centre and `height` the container height, both in px.
 */
export function readoutSide(cy: number, height: number, plate: number, radius: number = WHEEL.outer, gap = 10): 'below' | 'above' {
  const below = height - (cy + radius + gap)
  const above = cy - radius - gap
  if (below >= plate) return 'below'
  if (above >= plate) return 'above'
  return below >= above ? 'below' : 'above'
}

function round(n: number) {
  return Math.round(n * 100) / 100 || 0
}

/** One slice as the ring draws it. */
export interface WheelSlice {
  key: string
  kind: 'group' | 'item' | 'empty'
  /** Group label (uppercase HUD voice) or item name (as written) */
  label: string
  icon?: string | null
  /** Picks from this group in the open wheel (bone count pill) */
  count?: number
  /** Unlooted quantity of this item already at the spot (apricot pill, like a marker) */
  here?: number
}

// ── Keyboard model ──────────────────────────────────────────────────────────

/** What the wheel is showing. */
export type Stage = 'groups' | 'items' | 'search' | 'note' | 'qty'

export interface KeyInput {
  key: string
  code: string
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
}

export interface KeyState {
  stage: Stage
  /** At least one item was added in this wheel */
  hasPick: boolean
  /** The search line is empty */
  queryEmpty: boolean
  /**
   * Where focus is inside the wheel: the wheel itself, one of the slices (arrow keys move
   * it), or a button in the plate (which keeps its own Enter, Space and Tab).
   */
  focus?: 'root' | 'slice' | 'control'
  /** The slice that has focus, if any */
  focusedSlice?: number | null
  /** The search line is in its quantity (`x12`) or note (`# …`) part, so digits are typed */
  digitsTyped?: boolean
}

export type WheelAction =
  | { type: 'slice'; index: number }
  | { type: 'more' }
  | { type: 'focus-step'; delta: number }
  | { type: 'focus-to'; index: number }
  | { type: 'qty-digit'; digit: number }
  | { type: 'qty-step'; delta: number }
  | { type: 'qty-open' }
  | { type: 'qty-save' }
  | { type: 'again' }
  | { type: 'remove-last' }
  | { type: 'back' }
  | { type: 'close' }
  | { type: 'note' }
  | { type: 'note-save'; close: boolean }
  | { type: 'search-start'; text: string }
  | { type: 'pick-top' }
  /** Swallow the key and do nothing (keeps it from the page and the shell) */
  | { type: 'noop' }

/**
 * Map a keydown to a wheel action. `null` means "not ours": let the browser have it
 * (typing in the search/note/quantity line, a focused button, browser shortcuts).
 *
 * Plain digits always choose (1–8 slice, 9 more). Quantity is `x` then digits (a visible
 * field), Shift+digits, the numpad, or +/−, so a digit never means two things.
 */
export function readKey(k: KeyInput, s: KeyState): WheelAction | null {
  const mod = k.ctrlKey || k.metaKey

  if (s.stage === 'note') {
    if (k.key === 'Enter' && !mod) return { type: 'note-save', close: true }
    if (k.key === 'Tab') return { type: 'note-save', close: false }
    if (k.key === 'Escape') return { type: 'back' }
    return null
  }
  if (s.stage === 'qty') {
    if ((k.key === 'Enter' || k.key === ' ' || k.key === 'Tab') && !mod) return { type: 'qty-save' }
    if (k.key === 'Escape') return { type: 'back' }
    return null
  }

  if (mod) {
    // Ctrl+Z inside the wheel takes back the last pick; in the search line it edits text
    if (k.key.toLowerCase() === 'z' && !k.shiftKey && !k.altKey && s.stage !== 'search') return { type: 'remove-last' }
    return null
  }
  if (k.altKey) return null

  // A focused button in the plate keeps its native keys
  if (s.focus === 'control' && (k.key === 'Enter' || k.key === ' ' || k.key === 'Tab')) return null
  if (k.key === 'Tab' && k.shiftKey) return null

  const typing = s.stage === 'search' && s.digitsTyped
  // A digit is what the key types; Shift+digit is read by physical key (it types !@#…)
  const plain = !k.shiftKey && /^\d$/.test(k.key) ? Number(k.key) : null
  const shifted = k.shiftKey && /^Digit\d$/.test(k.code) ? Number(k.code.slice(5)) : null
  // Numpad digits by physical key too, so they set quantities with NumLock on or off
  const numpad = /^Numpad\d$/.test(k.code) ? Number(k.code.slice(6)) : null
  if (shifted !== null) {
    // In the search line Shift+3 is "#", the start of a note
    if (s.stage === 'search') return null
    return s.hasPick ? { type: 'qty-digit', digit: shifted } : { type: 'noop' }
  }
  if (numpad !== null && s.stage !== 'search') return s.hasPick ? { type: 'qty-digit', digit: numpad } : { type: 'noop' }
  if (s.stage !== 'search' && (k.key === '+' || k.key === '=' || k.code === 'NumpadAdd')) return s.hasPick ? { type: 'qty-step', delta: 1 } : { type: 'noop' }
  if (s.stage !== 'search' && (k.key === '-' || k.code === 'NumpadSubtract')) return s.hasPick ? { type: 'qty-step', delta: -1 } : { type: 'noop' }

  if (plain !== null) {
    if (typing) return null
    if (plain >= 1 && plain <= 8) return { type: 'slice', index: plain - 1 }
    if (plain === 9 && s.stage === 'items') return { type: 'more' }
    return { type: 'noop' }
  }

  const sliceFocused = s.focus === 'slice' && s.focusedSlice !== null && s.focusedSlice !== undefined
  switch (k.key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return { type: 'focus-step', delta: 1 }
    case 'ArrowLeft':
    case 'ArrowUp':
      return s.stage === 'search' && k.key === 'ArrowLeft' ? null : { type: 'focus-step', delta: -1 }
    case 'Home':
      return s.stage === 'search' ? null : { type: 'focus-to', index: 0 }
    case 'End':
      return s.stage === 'search' ? null : { type: 'focus-to', index: 7 }
    case 'Enter':
      if (sliceFocused) return { type: 'slice', index: s.focusedSlice! }
      if (s.stage === 'search') return s.queryEmpty ? { type: 'close' } : { type: 'pick-top' }
      return { type: 'close' }
    case 'Escape':
      return s.stage === 'groups' ? { type: 'close' } : { type: 'back' }
    case 'Tab':
      return s.hasPick ? { type: 'note' } : null
    case ' ':
      if (sliceFocused) return { type: 'slice', index: s.focusedSlice! }
      return s.stage === 'search' && !s.queryEmpty ? null : { type: 'again' }
    case 'Backspace':
      if (s.stage === 'search') return s.queryEmpty ? { type: 'back' } : null
      if (s.stage === 'items') return { type: 'back' }
      return s.hasPick ? { type: 'remove-last' } : { type: 'noop' }
  }

  if (s.stage !== 'search' && k.key.length === 1 && /\p{L}/u.test(k.key)) {
    // `x` = "times": opens the quantity field for the last pick (no item name starts with x)
    if (s.hasPick && k.key.toLowerCase() === 'x') return { type: 'qty-open' }
    return { type: 'search-start', text: k.key }
  }
  return null
}

/**
 * The search line accepts a quantity and a note after the name: `mat x12`, `hack # car trunk`,
 * `mat x12 # kitchen`. Once the line is in one of those parts, digits are typed, not picked.
 */
export function searchTypesDigits(query: string): boolean {
  return /(?:^|\s)x\d*$/i.test(query) || /\s(?:-|#)/.test(query) || /^#/.test(query.trim())
}

/** 0–9 from a digit-row or numpad key (by physical key, so Shift+1 still reads as 1). */
export function digitOf(k: Pick<KeyInput, 'key' | 'code'>): number | null {
  const m = k.code.match(/^(?:Digit|Numpad)(\d)$/)
  if (m) return Number(m[1])
  return /^\d$/.test(k.key) ? Number(k.key) : null
}

// ── Quantity ────────────────────────────────────────────────────────────────

export const MAX_QTY = 999

/**
 * Type one quantity digit. `buffer` is what was typed since the quantity entry started
 * (Shift pressed, or the first numpad digit). Returns the new buffer and quantity;
 * quantity is null while the buffer is still empty (a leading 0). Typing past three
 * digits starts over with the new digit.
 */
export function typeQuantity(buffer: string, digit: number): { buffer: string; quantity: number | null } {
  let next = `${buffer}${digit}`.replace(/^0+/, '')
  if (next.length > 3) next = String(digit).replace(/^0+/, '')
  return { buffer: next, quantity: next ? Math.min(MAX_QTY, Number(next)) : null }
}

export function stepQuantity(quantity: number, delta: number): number {
  return Math.max(1, Math.min(MAX_QTY, quantity + delta))
}

/**
 * Quantity steps from a wheel event. A mouse notch (one big delta) is exactly one step;
 * small trackpad deltas add up until they make one. Scrolling up adds.
 */
export function wheelSteps(acc: number, deltaY: number, per = 50): { steps: number; acc: number } {
  if (Math.abs(deltaY) >= per) return { steps: -Math.sign(deltaY), acc: 0 }
  const total = (Math.sign(acc) === Math.sign(deltaY) ? acc : 0) + deltaY
  if (Math.abs(total) < per) return { steps: 0, acc: total }
  return { steps: -Math.sign(total), acc: 0 }
}

// ── Picks ───────────────────────────────────────────────────────────────────

export interface WheelPick {
  itemId: string
  markerId: string
  quantity: number
  /** Landed on a marker that was there before this wheel opened */
  stacked: boolean
}

/** How much this wheel's picks put on one marker (what the batch must account for). */
export function contribution(picks: WheelPick[], markerId: string): number {
  return picks.reduce((sum, p) => (p.markerId === markerId ? sum + p.quantity : sum), 0)
}

/** True when the pick is the only thing this wheel put on a marker it created, so it may be edited in place. */
export function ownsMarker(picks: WheelPick[], pick: WheelPick): boolean {
  return !pick.stacked && picks.filter((p) => p.markerId === pick.markerId).length === 1
}

/** A page of up to `size` entries; pages wrap. */
export function pageOf<T>(list: readonly T[], page: number, size: number = WHEEL.slices): { items: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(list.length / size))
  const p = ((page % pages) + pages) % pages
  return { items: list.slice(p * size, p * size + size), page: p, pages }
}

/** Short summary for the toast: "Wood Matches ×12, Hatchet and 3 more". */
export function summarise(entries: { name: string; quantity: number }[], max = 2): string {
  const merged: { name: string; quantity: number }[] = []
  for (const e of entries) {
    const prev = merged.find((m) => m.name === e.name)
    if (prev) prev.quantity += e.quantity
    else merged.push({ ...e })
  }
  const label = (e: { name: string; quantity: number }) => (e.quantity > 1 ? `${e.name} ×${e.quantity}` : e.name)
  if (merged.length <= max + 1) {
    const parts = merged.map(label)
    return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0] ?? ''
  }
  return `${merged.slice(0, max).map(label).join(', ')} and ${merged.length - max} more`
}
