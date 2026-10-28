import { computed, ref, shallowRef } from 'vue'
import { useAddItem } from '~/composables/useAddItem'
import { useAddUi } from '~/composables/useAddUi'
import { useGameData } from '~/composables/useGameData'
import { parseEntry, type Spot } from '~/lib/addItem'
import { moveCursor, pushDigit, type CursorKey } from './rummage'
import type { Item, Marker } from '~/types'

/**
 * State and actions of a Rummage session (docs/add-item/CONCEPTS.md, concept C): one open spot,
 * live writes through the shared seam. Module-level so the panel, the ring and the key handling share it.
 *
 * A "gesture" is a run of consecutive ticks on one item (plus the digits that set its quantity):
 * one undo batch, so Ctrl+Z steps back one thing, not the whole session.
 */

export const COLS = 5
export const TILE_COUNT = 20
/** Map px: closer than this to the open spot counts as the same spot (a pile's centre drifts a little as it grows) */
const SAME_SPOT = 20

interface Session {
  spot: Spot
  name: string
  kind: string | null
  poiId: string | null
  /** Likely items, frozen when the spot opens so the grid never reshuffles under the pointer */
  likely: Item[]
}

interface Gesture {
  itemId: string
  batchId: string
  markerId: string
  /** Units this gesture put on the map */
  q: number
}

const session = ref<Session | null>(null)
/** Waiting for the next map click to choose a spot (opened from the button / palette with no pointer) */
const picking = ref(false)
const query = ref('')
/** Items found by search during this session; they get a tile so they can be ticked again */
const extras = ref<Item[]>([])
/** Index of the cursor in the visible list (tiles, or search results) */
const cursor = ref<number | null>(null)
/** The item the cursor last rested on; survives moving to another spot (S4) */
const cursorItemId = ref<string | null>(null)
const current = shallowRef<Gesture | null>(null)
const stacks = new Map<string, Gesture[]>()
const pop = ref<{ id: string; n: number } | null>(null)
/** Items ticked since the session opened (for the summary when it closes) */
const touched = new Set<string>()
/** A one-line message in the strip (nothing to remove, …) */
const flash = ref<string | null>(null)
let popSeq = 0
let flashTimer: ReturnType<typeof setTimeout> | undefined
let digitBuffer = ''
let digitAt = 0

/** The last spot a session was closed on, per page load (the pick screen offers it back). */
const lastSpot = ref<{ spot: Spot; mapId: string } | null>(null)

export function useRummage() {
  const game = useGameData()
  const addItem = useAddItem()
  const addUi = useAddUi()

  const placeName = (poiId?: string) => (poiId ? game.getPOIById(poiId)?.name : undefined)

  const spotMarkers = computed<Marker[]>(() => (session.value ? addItem.markersAt(session.value.spot) : []))

  const tiles = computed<Item[]>(() => {
    const s = session.value
    if (!s) return []
    const seen = new Set(s.likely.map((i) => i.id))
    return [...s.likely, ...extras.value.filter((i) => !seen.has(i.id))]
  })

  const parsed = computed(() => parseEntry(query.value))
  const searching = computed(() => !!parsed.value.query)
  const results = computed<Item[]>(() => (searching.value ? addItem.search(parsed.value.query, { limit: TILE_COUNT }) : []))
  /** What the grid shows right now */
  const view = computed<Item[]>(() => (searching.value ? results.value : tiles.value))

  const cursorItem = computed<Item | null>(() => {
    if (cursor.value !== null) return view.value[cursor.value] ?? null
    return null
  })
  /** The item digits, Enter and − act on: the cursor, else the last one touched */
  const targetItem = computed<Item | null>(() => {
    if (cursorItem.value) return cursorItem.value
    if (searching.value) return null
    return tiles.value.find((i) => i.id === cursorItemId.value) ?? null
  })

  /** What's on the map at the spot for an item: unlooted units, and whether any looted ones exist */
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
    [...spotMarkers.value].sort((a, b) =>
      Number(!!a.lootedAt) - Number(!!b.lootedAt) || a.name.localeCompare(b.name)),
  )

  // ── Opening and closing ───────────────────────────────────────────────────

  function nameOf(spot: Spot) {
    return placeName(spot.poiId) ?? 'Unnamed spot'
  }

  /** Open (or move) the session onto a spot. Nothing is written until something is ticked. */
  function openAt(spot: Spot) {
    const prev = session.value
    const poi = spot.poiId ? game.getPOIById(spot.poiId) : undefined
    const pin = spot.poiId ? game.getPOIPin(spot.poiId) : undefined
    const at: Spot = { x: pin?.x ?? spot.x, y: pin?.y ?? spot.y, poiId: spot.poiId }
    const same = !!prev && Math.hypot(prev.spot.x - at.x, prev.spot.y - at.y) < SAME_SPOT
    picking.value = false
    if (same) return
    summarize()
    session.value = {
      spot: at,
      name: nameOf(at),
      kind: poi?.type ? poi.type.toLowerCase() : null,
      poiId: spot.poiId ?? null,
      likely: addItem.likelyItems(spot.poiId, TILE_COUNT),
    }
    // A new spot is a new undo scope; the cursor item stays so "same item, next spot" is one key
    stacks.clear()
    current.value = null
    digitBuffer = ''
    query.value = ''
    syncCursor()
  }

  /** The panel showed every add as it happened; the toast only sums up when you leave a spot (Ctrl+Z still steps back) */
  function summarize() {
    const s = session.value
    if (s && touched.size) addUi.announce(`${touched.size} ${touched.size === 1 ? 'item' : 'items'} logged · ${s.name}`)
    touched.clear()
  }

  function openAtPos(pos: { x: number; y: number }) {
    openAt(addItem.resolveSpot(pos))
  }

  function startPicking() {
    session.value = null
    picking.value = true
  }

  function close() {
    const s = session.value
    if (s && game.currentMap.value) lastSpot.value = { spot: s.spot, mapId: game.currentMap.value.id }
    summarize()
    session.value = null
    picking.value = false
    query.value = ''
    extras.value = []
    cursor.value = null
    current.value = null
    stacks.clear()
    digitBuffer = ''
  }

  // ── Cursor ────────────────────────────────────────────────────────────────

  /** Point the cursor at the last item touched, adding a tile for it when the grid doesn't have one */
  function syncCursor() {
    const id = cursorItemId.value
    if (!id || searching.value) {
      cursor.value = searching.value ? 0 : null
      return
    }
    let idx = tiles.value.findIndex((i) => i.id === id)
    if (idx < 0) {
      const item = game.getItemById(id)
      if (item) {
        extras.value = [...extras.value, item]
        idx = tiles.value.findIndex((i) => i.id === id)
      }
    }
    cursor.value = idx >= 0 ? idx : null
  }

  function onQueryChange() {
    digitBuffer = ''
    cursor.value = searching.value ? 0 : null
    if (!searching.value) syncCursor()
  }

  function move(key: CursorKey) {
    digitBuffer = ''
    // Search results read as a ranked list: up/down step one result at a time (the grid only matters for the idle tiles)
    const count = view.value.length
    const next = searching.value && (key === 'ArrowDown' || key === 'ArrowUp')
      ? Math.max(0, Math.min(count - 1, (cursor.value ?? 0) + (key === 'ArrowDown' ? 1 : -1)))
      : moveCursor(cursor.value, key, COLS, count)
    cursor.value = next
    const item = next === null ? null : view.value[next]
    if (item && !searching.value) cursorItemId.value = item.id
  }

  function pointAt(item: Item) {
    cursorItemId.value = item.id
    if (searching.value) return
    const idx = tiles.value.findIndex((i) => i.id === item.id)
    cursor.value = idx >= 0 ? idx : null
  }

  // ── Ticking ───────────────────────────────────────────────────────────────

  function say(text: string) {
    clearTimeout(flashTimer)
    flash.value = text
    flashTimer = setTimeout(() => (flash.value = null), 2200)
  }

  function ensureTile(item: Item) {
    if (!tiles.value.some((i) => i.id === item.id)) extras.value = [...extras.value, item]
  }

  function setGesture(g: Gesture | null, item?: Item) {
    current.value = g
    if (g && item) stacks.set(item.id, [...(stacks.get(item.id) ?? []).filter((x) => x.batchId !== g.batchId), g])
  }

  function mark(item: Item) {
    pop.value = { id: item.id, n: ++popSeq }
  }

  /**
   * Add `n` of an item at the spot. Repeating the same item keeps extending one undo batch;
   * a different item (or a note) starts a new one.
   */
  function tick(item: Item, n = 1, note?: string) {
    digitBuffer = ''
    doTick(item, n, note)
  }

  function doTick(item: Item, n: number, note?: string) {
    const s = session.value
    if (!s) return
    ensureTile(item)
    pointAt(item)
    touched.add(item.id)
    const g = current.value
    if (!note && g && g.itemId === item.id) {
      const res = addItem.adjust(g.markerId, n, { batchId: g.batchId })
      if (res) {
        setGesture({ ...g, q: g.q + res.applied }, item)
        mark(item)
        return
      }
      current.value = null // undone elsewhere (Ctrl+Z, toast): start fresh below
    }
    const res = addItem.addAt(s.spot, [{ itemId: item.id, quantity: n, note }])
    const marker = res?.markers[0]
    if (!res || !marker) return
    setGesture({ itemId: item.id, batchId: res.batchId, markerId: marker.id, q: n }, item)
    mark(item)
  }

  /** Take one unit back, newest gesture first, never below what earlier sessions logged. */
  function dec(item: Item) {
    const list = stacks.get(item.id) ?? []
    digitBuffer = ''
    pointAt(item)
    while (list.length) {
      const g = list[list.length - 1]!
      const res = addItem.adjust(g.markerId, -1, { batchId: g.batchId })
      if (!res || res.applied === 0) {
        list.pop() // undone elsewhere, or nothing of this gesture left
        if (current.value === g) current.value = null
        continue
      }
      const next = { ...g, q: g.q + res.applied }
      if (next.q <= 0) {
        list.pop()
        if (current.value === g) current.value = null
      } else {
        list[list.length - 1] = next
        if (current.value === g) current.value = next
      }
      mark(item)
      return
    }
    say(`Nothing to take back: ${item.name} was already here`)
  }

  /** A digit key: set the quantity of the item you just ticked, or add that many of the cursor's item. */
  function digit(d: string) {
    const item = targetItem.value
    if (!item) return false
    const now = Date.now()
    const r = pushDigit(digitBuffer, digitAt, now, d)
    digitBuffer = r.buffer
    digitAt = now
    if (r.value < 1) return true
    const g = current.value
    if (g && g.itemId === item.id) {
      const res = addItem.adjust(g.markerId, r.value - g.q, { batchId: g.batchId })
      if (res) {
        setGesture({ ...g, q: g.q + res.applied }, item)
        mark(item)
        return true
      }
      current.value = null
    }
    doTick(item, r.value)
    return true
  }

  /** Whether digits will do something right now (otherwise they're typed into the search) */
  function digitsAreQuantity() {
    return !searching.value && !!targetItem.value
  }

  /** Commit the search line: the top result (or the one under the cursor) with its quantity and note. */
  function commitQuery() {
    const item = results.value[cursor.value ?? 0]
    if (!item) return false
    tick(item, parsed.value.quantity, parsed.value.note || undefined)
    query.value = ''
    onQueryChange()
    return true
  }

  /** Enter/Space/+ on an empty line: one more of the cursor's item. */
  function again() {
    const item = targetItem.value
    if (!item) return false
    tick(item, 1)
    return true
  }

  // ── Note ──────────────────────────────────────────────────────────────────

  const noteMarker = computed(() => {
    const g = current.value
    return g ? game.markers.value.find((m) => m.id === g.markerId) ?? null : null
  })

  /** Save a note on a marker (the one the note field was showing), skipping the write when nothing changed */
  function setNote(markerId: string | null, text: string) {
    const m = markerId ? game.markers.value.find((x) => x.id === markerId) : null
    if (!m) return
    const next = text.trim() || undefined
    if (next !== (m.note || undefined)) game.updateMarker(m.id, { note: next })
  }

  return {
    session, picking, query, cursor, cursorItemId, current, pop, flash, lastSpot,
    spotMarkers, tiles, view, results, searching, parsed, targetItem, cursorItem, trayRows, noteMarker,
    stateOf, openAt, openAtPos, startPicking, close, move, pointAt, onQueryChange,
    tick, dec, digit, digitsAreQuantity, commitQuery, again, setNote, say,
  }
}
