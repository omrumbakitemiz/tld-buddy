import { computed, inject, ref, shallowRef, type InjectionKey } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { createId } from '#shared/utils/appData'
import { useAddItem } from '~/composables/useAddItem'
import { useAddUi } from '~/composables/useAddUi'
import { useGameData } from '~/composables/useGameData'
import { parseEntry, type Spot } from '~/lib/addItem'
import { createLedger, moveCursor, pushDigit, type CursorKey } from './rummage'
import type { Item, Marker } from '~/types'

/**
 * State and actions of a Rummage session (docs/add-item/c/NOTES.md): one open spot, live writes
 * through the shared seam. Created once by AddUiC and provided to the panel.
 *
 * A session is ONE undo batch (the seam's `addAt` with a batch id, `amend` for edits inside it), so
 * the closing toast's Undo and Ctrl+Z after Done take the whole visit back. Inside the open session the
 * ledger (rummage.ts) lets `-`, right-click and Ctrl+Z step back one thing at a time.
 */

export const TILE_COUNT = 20
const COMPACT_TILES = 8
/** Map px: closer than this to the open spot counts as the same spot (a pile's centre drifts as it grows) */
const SAME_SPOT = 20
/** Digits mean "how many" only this long after a tick; after that they are part of a search ("3 peaches") */
const ARM_MS = 4000

interface Session {
  spot: Spot
  name: string
  kind: string | null
  likely: Item[]
}

export function createRummage() {
  const game = useGameData()
  const addItem = useAddItem()
  const addUi = useAddUi()

  const session = shallowRef<Session | null>(null)
  /** Waiting for the next map click to choose a spot (opened from the button / palette with no pointer) */
  const picking = ref(false)
  const query = ref('')
  const compact = useLocalStorage('tld-buddy-rummage-compact', false)
  /** Items found by search during this session; they get a tile so they can be ticked again */
  const extras = ref<Item[]>([])
  /** Index of the cursor in the visible list (tiles, or search results) */
  const cursor = ref<number | null>(null)
  /** The item the cursor last rested on; survives moving to another spot (S4) */
  const cursorItemId = ref<string | null>(null)
  /** Set right after a tick: digits then set how many of that marker. Cleared by anything else. */
  const armed = ref<{ itemId: string; markerId: string } | null>(null)
  /** The marker the note field edits: the last one ticked (stays put while you type, unlike `armed`) */
  const noteId = ref<string | null>(null)
  const flash = ref<string | null>(null)

  const ledger = createLedger()
  /** The unnoted marker this session is stacking each item onto */
  const plain = new Map<string, string>()
  let batchId = createId('batch')
  let digitBuffer = ''
  let flashTimer: ReturnType<typeof setTimeout> | undefined
  let armTimer: ReturnType<typeof setTimeout> | undefined

  const cols = computed(() => (compact.value ? 4 : 5))
  const spotMarkers = computed<Marker[]>(() => (session.value ? addItem.markersAt(session.value.spot) : []))

  const tiles = computed<Item[]>(() => {
    const s = session.value
    if (!s) return []
    const likely = compact.value ? s.likely.slice(0, COMPACT_TILES) : s.likely
    const seen = new Set(likely.map((i) => i.id))
    return [...likely, ...extras.value.filter((i) => !seen.has(i.id))]
  })
  const parsed = computed(() => parseEntry(query.value))
  const searching = computed(() => !!parsed.value.query)
  const results = computed<Item[]>(() => (searching.value ? addItem.search(parsed.value.query, { limit: TILE_COUNT }) : []))
  /** What the grid shows right now */
  const view = computed<Item[]>(() => (searching.value ? results.value : tiles.value))

  /** The item Enter, `-` and the strip act on: the cursor's, else the last one touched */
  const targetItem = computed<Item | null>(() => {
    if (cursor.value !== null) return view.value[cursor.value] ?? null
    if (searching.value) return null
    return tiles.value.find((i) => i.id === cursorItemId.value) ?? null
  })

  /** What's on the map at the spot for an item: unlooted units, and whether looted ones exist */
  function stateOf(itemId: string): { count: number; looted: boolean } {
    let count = 0
    let looted = false
    for (const m of spotMarkers.value) {
      if (m.itemId !== itemId) continue
      if (m.lootedAt) looted = true
      else count += m.quantity
    }
    return { count, looted }
  }

  const trayRows = computed(() =>
    [...spotMarkers.value].sort((a, b) => Number(!!a.lootedAt) - Number(!!b.lootedAt) || a.name.localeCompare(b.name)),
  )

  // ── Arming: when digits are a quantity ────────────────────────────────────

  function disarm() {
    clearTimeout(armTimer)
    armed.value = null
    digitBuffer = ''
  }
  function arm(itemId: string, markerId: string) {
    disarm()
    armed.value = { itemId, markerId }
    noteId.value = markerId
    armTimer = setTimeout(disarm, ARM_MS)
  }
  /** Digits keep the window open while you type them */
  function keepArmed() {
    clearTimeout(armTimer)
    armTimer = setTimeout(disarm, ARM_MS)
  }
  /** Any key that isn't a digit ends the number being typed */
  function endNumber() {
    digitBuffer = ''
  }
  const typingNumber = () => digitBuffer.length > 0

  // ── Opening and closing ───────────────────────────────────────────────────

  /** The panel showed every add as it happened; the toast sums up when you leave a spot and undoes the whole visit */
  function summarize() {
    const s = session.value
    const n = ledger.live()
    if (s && n) addUi.announce(`${n} ${n === 1 ? 'item' : 'items'} logged · ${s.name}`, batchId)
  }

  function resetBatch() {
    ledger.clear()
    plain.clear()
    batchId = createId('batch')
    noteId.value = null
    disarm()
  }

  /** Open (or move) the session onto a spot. Nothing is written until something is ticked. */
  function openAt(spot: Spot) {
    const prev = session.value
    const poi = spot.poiId ? game.getPOIById(spot.poiId) : undefined
    const pin = spot.poiId ? game.getPOIPin(spot.poiId) : undefined
    const at: Spot = { x: pin?.x ?? spot.x, y: pin?.y ?? spot.y, poiId: spot.poiId }
    picking.value = false
    if (prev && Math.hypot(prev.spot.x - at.x, prev.spot.y - at.y) < SAME_SPOT) return
    summarize()
    resetBatch()
    session.value = {
      spot: at,
      name: (spot.poiId && poi?.name) || 'Unnamed spot',
      kind: poi?.type ? poi.type.toLowerCase() : null,
      likely: addItem.likelyItems(spot.poiId, TILE_COUNT),
    }
    query.value = ''
    // The cursor item stays so "same item, next spot" is one key; it is not armed, so digits stay digits
    syncCursor()
  }

  function openAtPos(pos: { x: number; y: number }) {
    openAt(addItem.resolveSpot(pos))
  }

  function startPicking() {
    session.value = null
    picking.value = true
  }

  function close() {
    summarize()
    resetBatch()
    session.value = null
    picking.value = false
    query.value = ''
    extras.value = []
    cursor.value = null
  }

  // ── Cursor ────────────────────────────────────────────────────────────────

  /** Point the cursor at the last item touched, giving it a tile if the grid has none */
  function syncCursor() {
    const id = cursorItemId.value
    if (searching.value) {
      cursor.value = 0
      return
    }
    if (!id) {
      cursor.value = null
      return
    }
    if (!tiles.value.some((i) => i.id === id)) {
      const item = game.getItemById(id)
      if (item) extras.value = [...extras.value, item]
    }
    const idx = tiles.value.findIndex((i) => i.id === id)
    cursor.value = idx >= 0 ? idx : null
  }

  function onQueryChange() {
    disarm()
    if (searching.value) cursor.value = 0
    else syncCursor()
  }

  function move(key: CursorKey) {
    disarm()
    const count = view.value.length
    // Search results read as a ranked list: up/down step one result at a time
    const next = searching.value && (key === 'ArrowDown' || key === 'ArrowUp')
      ? Math.max(0, Math.min(count - 1, (cursor.value ?? 0) + (key === 'ArrowDown' ? 1 : -1)))
      : moveCursor(cursor.value, key, cols.value, count)
    cursor.value = next
    const item = next === null ? null : view.value[next]
    if (item && !searching.value) cursorItemId.value = item.id
  }

  function pointAt(item: Item) {
    cursorItemId.value = item.id
    if (!searching.value) syncCursor()
  }

  // ── Ticking ───────────────────────────────────────────────────────────────

  function say(text: string) {
    clearTimeout(flashTimer)
    flash.value = text
    flashTimer = setTimeout(() => (flash.value = null), 2200)
  }

  /** Set what the session has put on a marker. False when the batch is gone (undone elsewhere). */
  function setUnits(markerId: string, itemId: string, to: number, opts: { digits?: boolean; continuing?: boolean } = {}) {
    if (!addItem.amend(batchId, markerId, to)) return false
    ledger.set(markerId, itemId, to, opts)
    return true
  }

  /** Add `n` of an item at the spot (stacking onto what the session already put there). A note makes its own marker. */
  function tick(item: Item, n = 1, note?: string) {
    const s = session.value
    if (!s) return
    if (!tiles.value.some((i) => i.id === item.id)) extras.value = [...extras.value, item]
    pointAt(item)
    const stackOn = note ? undefined : plain.get(item.id)
    if (stackOn && ledger.units(stackOn) > 0) {
      if (setUnits(stackOn, item.id, ledger.units(stackOn) + n)) return arm(item.id, stackOn)
      resetBatch() // the batch was undone elsewhere: start the visit over
    }
    const res = addItem.addAt(s.spot, [{ itemId: item.id, quantity: n, note }], { batchId })
    const m = res?.markers[0]
    if (!m) return
    ledger.set(m.id, item.id, ledger.units(m.id) + n)
    if (!note) plain.set(item.id, m.id)
    arm(item.id, m.id)
  }

  /** Take one unit back from what this session put there, newest first; never touches earlier visits. */
  function dec(item: Item) {
    pointAt(item)
    const id = ledger.latestFor(item.id)
    if (!id) return say(`Nothing to take back: ${item.name} was already here`)
    const to = ledger.units(id) - 1
    if (!setUnits(id, item.id, to)) {
      resetBatch()
      return say('That was already undone')
    }
    if (armed.value?.markerId === id && to < 1) disarm()
  }

  /** A digit key right after a tick: set how many of that marker. False when digits aren't a quantity now. */
  function digit(d: string) {
    const a = armed.value
    if (!a) return false
    keepArmed()
    const r = pushDigit(digitBuffer, d)
    const continuing = digitBuffer.length > 0
    digitBuffer = r.buffer
    if (r.value < 1 || r.value === ledger.units(a.markerId)) return true
    if (!setUnits(a.markerId, a.itemId, r.value, { digits: true, continuing })) resetBatch()
    return true
  }

  /** Commit the search line: the highlighted match with the typed quantity and note. */
  function commitQuery() {
    const item = results.value[cursor.value ?? 0]
    if (!item) return false
    const { quantity, note } = parsed.value
    query.value = ''
    tick(item, quantity, note || undefined) // ticks last so the number that follows is its quantity
    return true
  }

  /** Enter/Space/+ on an empty line: one more of the target item. */
  function again() {
    const item = targetItem.value
    if (!item) return false
    tick(item, 1)
    return true
  }

  /** Ctrl+Z inside a session: step back the last thing, not the whole visit. False when there is nothing. */
  function stepBack() {
    const e = ledger.undo()
    if (!e) return null
    disarm()
    if (!addItem.amend(batchId, e.markerId, e.from)) resetBatch()
    return e
  }

  /**
   * A space right after digits means they were the start of a search ("3 peaches"), not a
   * quantity: take the quantity change back and hand the digits to the search line.
   */
  function reclaimDigits(): string {
    const typed = digitBuffer
    const a = armed.value
    digitBuffer = ''
    const last = ledger.last()
    if (a && last?.digits && last.markerId === a.markerId) stepBack()
    disarm()
    return typed
  }

  // ── Note ──────────────────────────────────────────────────────────────────

  const noteMarker = computed(() => (noteId.value ? game.markers.value.find((m) => m.id === noteId.value) ?? null : null))

  /** Save a note on a marker, skipping the write when nothing changed */
  function setNote(markerId: string | null, text: string) {
    const m = markerId ? game.markers.value.find((x) => x.id === markerId) : null
    if (!m) return
    const next = text.trim() || undefined
    if (next !== (m.note || undefined)) game.updateMarker(m.id, { note: next })
  }

  return {
    session, picking, query, compact, cols, cursor, armed, flash,
    tiles, view, searching, parsed, targetItem, trayRows, noteMarker,
    stateOf, openAt, openAtPos, startPicking, close, move, pointAt, onQueryChange, disarm, endNumber, typingNumber, reclaimDigits,
    tick, dec, digit, commitQuery, again, stepBack, setNote, say,
  }
}

export type Rummage = ReturnType<typeof createRummage>
export const RUMMAGE_KEY: InjectionKey<Rummage> = Symbol('rummage')

export function useRummage(): Rummage {
  const r = inject(RUMMAGE_KEY)
  if (!r) throw new Error('useRummage outside AddUiC')
  return r
}
