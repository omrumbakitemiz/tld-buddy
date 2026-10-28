<template>
  <div ref="hostRef" class="pointer-events-none absolute inset-0 z-[650] overflow-hidden">
    <!-- When the map can't pan far enough (a spot at the painting's edge) the wheel slides in and points back -->
    <svg v-if="open && center?.shifted" class="absolute inset-0 size-full" aria-hidden="true">
      <line :x1="center.x" :y1="center.y" :x2="center.sx" :y2="center.sy" class="wheel-leader" />
      <circle :cx="center.sx" :cy="center.sy" r="9" class="wheel-leader-spot" />
    </svg>

    <div
      v-if="open && center"
      ref="rootRef"
      class="wheel-root absolute size-0 outline-none"
      :style="{ left: `${center.x}px`, top: `${center.y}px` }"
      role="dialog"
      aria-modal="false"
      :aria-label="`Add loot at ${place.name}`"
      aria-describedby="wheel-a-help"
      tabindex="-1"
      data-add-wheel
    >
      <p id="wheel-a-help" class="sr-only">
        Arrow keys move around the ring, Enter or Space picks. Digits 1 to 8 pick directly, letters search.
        After a pick, x then a number sets its quantity. Backspace takes the last pick back. Enter closes.
      </p>
      <WheelRing
        ref="ringRef"
        :slices="slices"
        :hovered="hovered"
        :focused="focusIdx"
        :roving="roving"
        :label="ringLabel"
        :ring-key="ringKey"
        :pulse="pulse"
        :resting="resting && focusIdx === null"
        @pick="onPointerPick"
        @hover="onHover"
        @focus="(i) => (focusIdx = i)"
        @hole="onHole"
        @context="onRingContext"
        @wheel="onWheel"
      />
      <WheelReadout
        ref="readoutRef"
        class="pointer-events-auto absolute"
        :style="readoutStyle"
        :stage="stage"
        :place="place"
        :here="hereTiles"
        :crumb="crumb"
        :has-picks="session.picks.value.length > 0"
        :last="lastInfo"
        :hover="hoverInfo"
        :again="againInfo"
        :query="query"
        :note="noteText"
        :qty-draft="qtyDraft"
        :result-count="searchResults.length"
        :qty-typing="!!qtyBuffer"
        :pages="stage === 'items' ? groupPage : null"
        @update:query="(v) => (query = v)"
        @update:note="(v) => (noteText = v)"
        @update:qty-draft="(v) => (qtyDraft = v)"
        @qty="(d) => run({ type: 'qty-step', delta: d })"
        @qty-open="run({ type: 'qty-open' })"
        @note="run({ type: 'note' })"
        @again="run({ type: 'again' })"
        @done="close()"
        @back="run({ type: 'back' })"
        @more="run({ type: 'more' })"
        @wheel="onWheel"
        @contextmenu.prevent
      />
    </div>
    <p class="sr-only" aria-live="polite">{{ liveText }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import WheelReadout, { type HereTile } from '~/components/add/a/WheelReadout.vue'
import WheelRing from '~/components/add/a/WheelRing.vue'
import { useWheelSession } from '~/components/add/a/useWheelSession'
import {
  WHEEL, pageOf, readKey, readoutSide, searchTypesDigits, stepQuantity, typeQuantity, wheelSteps,
  type KeyState, type Stage, type WheelAction, type WheelSlice,
} from '~/components/add/a/wheel'
import { useAddItem } from '~/composables/useAddItem'
import { useAddUi, type AddRequest, type MapPos, type MapTile } from '~/composables/useAddUi'
import { useGameData } from '~/composables/useGameData'
import { useStaticData } from '~/composables/useStaticData'
import { useUiState } from '~/composables/useUiState'
import { LOOT_GROUPS, parseEntry, type Spot } from '~/lib/addItem'
import type { Item } from '~/types'

/**
 * Variant A, "Wheel" (docs/add-item/a/NOTES.md): the game's radial menu, opened on the
 * map at the pointer. Ring 1 = 8 fixed groups, ring 2 = a group's items in a fixed order,
 * letters search. Every pick is written at once (one undo batch per open wheel, see
 * useWheelSession); the spot stays visible through the hole in the middle.
 */

const addUi = useAddUi()
const addItem = useAddItem()
const game = useGameData()
const ui = useUiState()
const { itemsById } = useStaticData()

// ── Groups: fixed order, fixed members. Only slot 8 (Recent) follows this run's habits ─────

const RECENT = 'recent'
/** A painted item icon stands for each group, the way the game's radial shows items */
const GROUP_ICON: Record<string, string> = {
  fire: 'wood-matches',
  food: 'pinnacle-peaches',
  aid: 'water-potable',
  arms: 'hunting-rifle',
  tools: 'hatchet',
  clothing: 'wool-toque',
  materials: 'cloth',
}
const groups = [
  ...LOOT_GROUPS.map((g) => ({ id: g.id as string, label: g.label as string, items: g.items as readonly string[], members: new Set<string>(g.items) })),
  { id: RECENT, label: 'Recent', items: [] as readonly string[], members: new Set<string>() },
]

// ── State of the open wheel ───────────────────────────────────────────────────────

const open = ref(false)
const spot = shallowRef<Spot & { snapped: 'poi' | 'marker' | null }>({ x: 0, y: 0, snapped: null })
const session = useWheelSession(spot)
const stage = ref<Stage>('groups')
const groupIdx = ref<number | null>(null)
const page = ref(0)
const query = ref('')
const noteText = ref('')
const qtyDraft = ref('')
const hovered = ref<number | null>(null)
/** The slice with keyboard focus, and the one Tab lands on */
const focusIdx = ref<number | null>(null)
const roving = ref(0)
const qtyBuffer = ref('')
const pulse = ref(0)
const liveText = ref('')
/** Faded so the map under the ring reads: after a pick, and while the pointer is away from it */
const resting = ref(false)
/** Markers that were at the spot before this wheel opened */
const before = ref(new Set<string>())
/** Recent (slot 8) is frozen when the wheel opens, so it doesn't move under a flick */
let recent: Item[] = []
let restoreFocus: HTMLElement | null = null
let wheelAcc = 0

const hostRef = ref<HTMLElement | null>(null)
const rootRef = ref<HTMLElement | null>(null)
const ringRef = ref<InstanceType<typeof WheelRing> | null>(null)
const readoutRef = ref<InstanceType<typeof WheelReadout> | null>(null)

function groupList(i: number): Item[] {
  const g = groups[i]!
  if (g.id === RECENT) return recent
  return g.items.map((id) => itemsById.value.get(id)).filter((x): x is Item => !!x)
}

const markersHere = computed(() => (open.value ? addItem.markersAt(spot.value) : []))

/** Unlooted quantity per item already at the spot */
const hereByItem = computed(() => {
  const map = new Map<string, number>()
  for (const m of markersHere.value) if (!m.lootedAt) map.set(m.itemId, (map.get(m.itemId) ?? 0) + m.quantity)
  return map
})

/** Everything at the spot for the plate: remaining loot first, then looted */
const hereTiles = computed<HereTile[]>(() => {
  const lastId = session.last.value?.markerId
  return [...markersHere.value]
    .sort((a, b) => Number(!!a.lootedAt) - Number(!!b.lootedAt) || a.id.localeCompare(b.id))
    .map((m) => {
      const item = itemsById.value.get(m.itemId)
      const name = m.name || item?.name || 'Loot'
      const touched = session.touched.value.has(m.id)
      const label = `${name}${m.quantity > 1 ? ` ×${m.quantity}` : ''}${m.lootedAt ? ', looted' : ''}${touched ? ', added now' : ''}${m.note ? `, note: ${m.note}` : ''}`
      return { id: m.id, name, icon: item?.icon, quantity: m.quantity, looted: !!m.lootedAt, touched, last: m.id === lastId, label }
    })
})

/** The search line can carry a quantity and a note: "mat x12 # kitchen" */
const parsed = computed(() => parseEntry(query.value))
const searchResults = computed(() => (stage.value === 'search' && parsed.value.query ? addItem.search(parsed.value.query, { limit: 99 }) : []))

const groupPage = computed(() => (groupIdx.value === null ? null : pageOf(groupList(groupIdx.value), page.value)))

/** The items the ring currently offers, slot by slot */
const slotItems = computed<(Item | null)[]>(() => {
  const list = stage.value === 'search' ? searchResults.value.slice(0, WHEEL.slices) : stage.value === 'items' ? groupPage.value?.items ?? [] : []
  return Array.from({ length: WHEEL.slices }, (_, i) => list[i] ?? null)
})

const showingItems = computed(() => stage.value === 'items' || stage.value === 'search')

const slices = computed<WheelSlice[]>(() => {
  if (showingItems.value) {
    return slotItems.value.map((item, i) => item
      ? { key: `i-${item.id}`, kind: 'item' as const, label: item.name, icon: item.icon, here: hereByItem.value.get(item.id) }
      : { key: `e-${i}`, kind: 'empty' as const, label: '' })
  }
  return groups.map((g) => ({
    key: `g-${g.id}`,
    kind: 'group' as const,
    label: g.label,
    icon: GROUP_ICON[g.id] ? itemsById.value.get(GROUP_ICON[g.id]!)?.icon : null,
    count: session.picks.value.filter((p) => g.members.has(p.itemId)).length || undefined,
  }))
})

const ringKey = computed(() => (stage.value === 'search' ? 'search' : stage.value === 'items' ? `items-${groupIdx.value}-${page.value}` : 'groups'))
const ringLabel = computed(() => {
  if (stage.value === 'search') return `Search results for ${parsed.value.query || 'nothing yet'}`
  if (stage.value === 'items' && groupIdx.value !== null) {
    const p = groupPage.value
    return `${groups[groupIdx.value]!.label} items${p && p.pages > 1 ? `, page ${p.page + 1} of ${p.pages}` : ''}`
  }
  return 'Groups'
})

const crumb = computed(() => (stage.value === 'items' && groupIdx.value !== null ? groups[groupIdx.value]!.label : null))

const place = computed(() => {
  const s = spot.value
  const poi = s.poiId ? game.getPOIById(s.poiId) : undefined
  if (poi) return { name: poi.name, kind: 'poi' as const }
  if (before.value.size) return { name: 'Existing pile', kind: 'pile' as const }
  if (session.picks.value.length) return { name: 'New pile', kind: 'new' as const }
  return { name: 'New spot', kind: 'new' as const }
})

const lastInfo = computed(() => {
  const p = session.last.value
  return p ? { name: session.nameOf(p.itemId), quantity: p.quantity } : null
})

/**
 * The slice the pointer was on when it picked: until the pointer moves to another slice, the
 * plate keeps showing the pick (and its quantity) instead of what's under the pointer.
 */
const hoverLock = ref<number | null>(null)
function onHover(i: number | null) {
  if (i !== null && i !== hoverLock.value) hoverLock.value = null
  hovered.value = i
}

const hoverInfo = computed(() => {
  const i = hovered.value ?? focusIdx.value
  if (i === null || i === hoverLock.value || stage.value === 'note' || stage.value === 'qty') return null
  if (showingItems.value) {
    const item = slotItems.value[i]
    return item ? { name: item.name, icon: item.icon, here: hereByItem.value.get(item.id) } : null
  }
  if (!groups[i]) return null
  const top = groupList(i).slice(0, 3).map((x) => x.name)
  return { name: top.length ? `${top.join(', ')}…` : 'Nothing logged yet this run', icon: null }
})

const againItem = computed<Item | null>(() => session.lastItem.value ?? addItem.lastItem.value)
const againInfo = computed(() => (againItem.value ? { name: againItem.value.name, icon: againItem.value.icon } : null))

// ── Position: the wheel is pinned to the spot and follows pans and zooms ──────────────

const center = computed(() => {
  void addUi.viewTick.value
  const view = addUi.mapView.value
  const host = hostRef.value
  if (!open.value || !view || !host) return null
  const c = view.toClient(spot.value)
  const box = host.getBoundingClientRect()
  const sx = c.x - box.left
  const sy = c.y - box.top
  const x = clampAxis(sx, box.width)
  const y = clampAxis(sy, box.height)
  return { x, y, sx, sy, left: box.left, top: box.top, w: box.width, h: box.height, shifted: Math.hypot(x - sx, y - sy) > WHEEL.inner }
})

/** Keep the whole ring inside the map (mid-axis when the map is smaller than the ring). */
function clampAxis(v: number, size: number) {
  const m = WHEEL.outer + 6
  return size < 2 * m ? size / 2 : Math.min(size - m, Math.max(m, v))
}

const PLATE_W = 312
const PLATE_H = 250
const readoutStyle = computed(() => {
  const c = center.value
  if (!c) return {}
  // Keep the plate inside the map horizontally even when the wheel hugs an edge
  const shift = Math.max(8 - (c.x - PLATE_W / 2), Math.min(0, c.w - 8 - (c.x + PLATE_W / 2)))
  const side = readoutSide(c.y, c.h, PLATE_H)
  return {
    left: `${-PLATE_W / 2 + shift}px`,
    ...(side === 'below' ? { top: `${WHEEL.outer + 10}px` } : { bottom: `${WHEEL.outer + 10}px` }),
  }
})

// ── Opening and closing ──────────────────────────────────────────────────────────

function openAt(pos: MapPos) {
  if (!game.currentRun.value || !game.currentMap.value) {
    ui.showRuns.value = !game.currentRun.value
    return
  }
  if (open.value) close()
  spot.value = addItem.resolveSpot(pos)
  before.value = new Set(addItem.markersAt(spot.value).map((m) => m.id))
  const seen = new Set<string>()
  // This run's habits first; a new run falls back to what this kind of place usually holds
  recent = [...addItem.frecent(16), ...addItem.likelyItems(spot.value.poiId, 16)].filter((i) => !seen.has(i.id) && !!seen.add(i.id)).slice(0, 16)
  session.reset()
  toGroups()
  noteText.value = ''
  qtyBuffer.value = ''
  hovered.value = null
  hoverLock.value = null
  focusIdx.value = null
  roving.value = 0
  resting.value = false
  open.value = true
  addUi.active.value = true
  addUi.hideAddButton.value = true
  ui.placingLoot.value = false
  ui.selectMarker(null)
  const n = before.value.size
  liveText.value = `Add loot at ${place.value.name}${n ? `, ${n} item${n > 1 ? 's' : ''} already here` : ''}. Digits 1 to 8 pick a group, arrows move, letters search.`
  const active = document.activeElement as HTMLElement | null
  restoreFocus = active && active !== document.body && !active.closest('[data-add-wheel]') ? active : null
  nextTick(() => {
    rootRef.value?.focus({ preventScroll: true })
    addUi.mapView.value?.reveal(spot.value, WHEEL.outer + 16)
  })
}

function close() {
  if (!open.value) return
  const done = session.summary()
  if (done) addUi.announce(`Added ${done.text}`, done.batchId)
  const hadFocus = !!rootRef.value?.contains(document.activeElement) || document.activeElement === document.body
  open.value = false
  session.reset()
  addUi.active.value = false
  addUi.hideAddButton.value = false
  if (hadFocus) {
    if (restoreFocus?.isConnected && !addUi.mapView.value?.container.contains(restoreFocus)) restoreFocus.focus({ preventScroll: true })
    else (document.activeElement as HTMLElement | null)?.blur()
  }
  restoreFocus = null
}

function toGroups() {
  stage.value = 'groups'
  groupIdx.value = null
  page.value = 0
  query.value = ''
}

function sameSpot(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y) < 1
}

// ── Picks ─────────────────────────────────────────────────────────────────────────

function pick(item: Item, opts: { quantity?: number; note?: string } = {}) {
  const fromGroup = groupIdx.value
  if (!session.pick(item, opts)) return
  const p = session.last.value!
  toGroups()
  qtyBuffer.value = ''
  hoverLock.value = hovered.value
  resting.value = true
  pulse.value++
  liveText.value = `Added ${item.name}${p.quantity > 1 ? ` ×${p.quantity}` : ''}. ${session.picks.value.length} in this wheel. x then a number sets the quantity.`
  afterRingChange(fromGroup ?? 0)
}

function setLastQuantity(quantity: number) {
  const p = session.last.value
  if (!p) return
  session.setLastQuantity(quantity)
  liveText.value = `${session.nameOf(p.itemId)} ×${quantity}`
}

// ── Actions (keys, clicks and the wheel all end up here) ────────────────────────────

/** Focus stays where the user is: on a slice when they were moving by keyboard, else on the wheel. */
let keyboardOnRing = false
function afterRingChange(slice: number) {
  if (keyboardOnRing) {
    roving.value = slice
    nextTick(() => ringRef.value?.focusSlice(slice))
  } else {
    focusRoot()
  }
}

function run(action: WheelAction) {
  if (action.type !== 'qty-digit') qtyBuffer.value = ''
  if (!['qty-digit', 'qty-step', 'again', 'remove-last', 'noop'].includes(action.type)) resting.value = false
  switch (action.type) {
    case 'slice':
      return onSlice(action.index)
    case 'more':
      page.value++
      hovered.value = null
      return afterRingChange(0)
    case 'focus-step':
    case 'focus-to': {
      const from = focusIdx.value ?? hovered.value ?? (action.type === 'focus-step' && action.delta < 0 ? 0 : -1)
      const next = action.type === 'focus-to' ? nextFilled(action.index - 1, 1) : nextFilled(from, action.delta)
      if (next === null) return
      roving.value = next
      return ringRef.value?.focusSlice(next)
    }
    case 'pick-top': {
      const top = searchResults.value[0]
      if (top) pick(top, { quantity: parsed.value.quantity, note: parsed.value.note })
      else liveText.value = `Nothing matches ${parsed.value.query}`
      return
    }
    case 'qty-digit': {
      const next = typeQuantity(qtyBuffer.value, action.digit)
      qtyBuffer.value = next.buffer
      if (next.quantity) setLastQuantity(next.quantity)
      return
    }
    case 'qty-step': {
      const p = session.last.value
      if (p) setLastQuantity(stepQuantity(p.quantity, action.delta))
      return
    }
    case 'qty-open': {
      const p = session.last.value
      if (!p) return
      qtyDraft.value = String(p.quantity)
      stage.value = 'qty'
      return readoutRef.value?.focusInput()
    }
    case 'qty-save': {
      const n = Number(qtyDraft.value)
      if (n >= 1) setLastQuantity(Math.min(999, n))
      stage.value = 'groups'
      return focusRoot()
    }
    case 'again':
      if (againItem.value) pick(againItem.value)
      return
    case 'remove-last': {
      const name = session.removeLast()
      if (name) liveText.value = `Took back ${name}`
      return
    }
    case 'back':
      if (stage.value === 'groups') return close()
      if (stage.value === 'qty' || stage.value === 'note') {
        stage.value = 'groups'
        return focusRoot()
      }
      {
        const from = groupIdx.value ?? 0
        toGroups()
        hovered.value = null
        return afterRingChange(from)
      }
    case 'close':
      return close()
    case 'note':
      if (!session.last.value) return
      noteText.value = session.lastNote.value
      stage.value = 'note'
      return readoutRef.value?.focusInput()
    case 'note-save':
      session.noteLast(noteText.value)
      liveText.value = noteText.value.trim() ? 'Note saved' : 'Note removed'
      stage.value = 'groups'
      if (action.close) return close()
      return focusRoot()
    case 'search-start':
      stage.value = 'search'
      query.value = action.text
      hovered.value = null
      focusIdx.value = null
      return readoutRef.value?.focusInput()
    case 'noop':
      return
  }
}

/** The next slice in a direction that holds something (search results can leave gaps). */
function nextFilled(from: number, delta: number): number | null {
  const n = slices.value.length
  for (let k = 1; k <= n; k++) {
    const i = (((from + delta * k) % n) + n) % n
    if (slices.value[i]?.kind !== 'empty') return i
  }
  return null
}

function onSlice(index: number) {
  if (stage.value === 'groups' || stage.value === 'note' || stage.value === 'qty') {
    if (stage.value === 'note') session.noteLast(noteText.value)
    groupIdx.value = index
    page.value = 0
    stage.value = 'items'
    const p = groupPage.value
    liveText.value = `${groups[index]!.label}${p && p.pages > 1 ? `, page 1 of ${p.pages}` : ''}`
    return afterRingChange(0)
  }
  const item = slotItems.value[index]
  if (!item) return
  if (stage.value === 'search') pick(item, { quantity: parsed.value.quantity, note: parsed.value.note })
  else pick(item)
}

function onPointerPick(index: number) {
  keyboardOnRing = false
  run({ type: 'slice', index })
}

function onHole() {
  if (stage.value !== 'groups') run({ type: 'back' })
}

/**
 * Right-click on the wheel: inside a group, search or a field it steps back (like Esc and the
 * game's radial). On the top ring it does what right-click does on the map: a wheel at the
 * point under it, so S4 can hop along a road even when the next spot is under the ring.
 */
function onRingContext(e: MouseEvent) {
  if (stage.value !== 'groups') return run({ type: 'back' })
  const pos = addUi.mapView.value?.fromClient({ x: e.clientX, y: e.clientY })
  if (pos) request({ pos, client: { x: e.clientX, y: e.clientY }, source: 'context' })
}

function focusRoot() {
  focusIdx.value = null
  nextTick(() => {
    const active = document.activeElement
    if (!rootRef.value || (active && rootRef.value.contains(active) && active !== rootRef.value && !active.closest('[role="menuitem"]'))) return
    rootRef.value.focus({ preventScroll: true })
  })
}

/** Scroll over the wheel: quantity of the last pick; with nothing picked yet, the map zooms as usual. */
function onWheel(e: WheelEvent) {
  e.preventDefault()
  if (!session.picks.value.length) {
    addUi.mapView.value?.container.dispatchEvent(new WheelEvent('wheel', e))
    return
  }
  const delta = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY
  const res = wheelSteps(wheelAcc, delta)
  wheelAcc = res.acc
  if (res.steps) run({ type: 'qty-step', delta: res.steps })
}

// ── Keyboard: a capture listener so the wheel gets keys before the shell's shortcuts ──

function isTyping(el: EventTarget | null) {
  const t = el as HTMLElement | null
  return !!t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))
}

function keyState(target: HTMLElement | null): KeyState {
  const onSlice = !!target?.closest?.('[role="menuitem"]')
  const onControl = !onSlice && !!target && target !== rootRef.value && !!rootRef.value?.contains(target) && !isTyping(target)
  return {
    stage: stage.value,
    hasPick: session.picks.value.length > 0,
    queryEmpty: !query.value.trim(),
    focus: onSlice ? 'slice' : onControl ? 'control' : 'root',
    focusedSlice: onSlice ? focusIdx.value : null,
    digitsTyped: stage.value === 'search' && searchTypesDigits(query.value),
  }
}

function onKeyDown(e: KeyboardEvent) {
  if (e.isComposing) return
  if (!open.value) return maybeOpenWithSpace(e)
  // Another dialog (search palette, shortcuts) took over: leave its keys alone
  const target = e.target as HTMLElement | null
  if (target?.closest?.('[role="dialog"]:not([data-add-wheel])')) return
  // Moved onto the ring from the search line with the arrows: typing goes back into the line
  if (stage.value === 'search' && !isTyping(target) && !e.ctrlKey && !e.metaKey && !e.altKey
    && (e.key === 'Backspace' || (e.key.length === 1 && !/^\d$/.test(e.key) && e.key !== ' '))) {
    readoutRef.value?.focusInputNow()
    focusIdx.value = null
    return
  }
  const state = keyState(target)
  const action = readKey(e, state)
  if (!action) return
  e.preventDefault()
  e.stopPropagation()
  keyboardOnRing = state.focus === 'slice' || action.type === 'focus-step' || action.type === 'focus-to'
  run(action)
}

function onKeyUp(e: KeyboardEvent) {
  // Releasing Shift ends a typed quantity: the next Shift+digits start a fresh number
  if (e.key === 'Shift') qtyBuffer.value = ''
}

/** Space with the pointer over the map opens the wheel there (A does too, via the shell). */
function maybeOpenWithSpace(e: KeyboardEvent) {
  if (e.key !== ' ' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || addUi.active.value) return
  if (isTyping(e.target) || document.querySelector('[role="dialog"]')) return
  const pos = pointerOnMap()
  const active = document.activeElement as HTMLElement | null
  if (!pos || (active && active !== document.body && !addUi.mapView.value?.container.contains(active))) return
  e.preventDefault()
  openAt(pos)
}

// ── Pointer: a click (not a drag) outside closes; moving away lets the ring rest ──────────

let down: { x: number; y: number; inside: boolean } | null = null
function onPointerDown(e: PointerEvent) {
  down = e.button === 0 ? { x: e.clientX, y: e.clientY, inside: !!rootRef.value?.contains(e.target as Node) } : null
}
function onPointerUp(e: PointerEvent) {
  const d = down
  down = null
  if (!open.value || !d || d.inside || e.button !== 0) return
  if (rootRef.value?.contains(e.target as Node)) return
  if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return
  close()
}
/** Last pointer position on the page: the shell's map pointer goes null while the wheel covers it */
let lastClient: { x: number; y: number } | null = null

/** The map position under the pointer, even right after the wheel closed over it. */
function pointerOnMap(): MapPos | null {
  if (addUi.pointer.value) return addUi.pointer.value.pos
  const view = addUi.mapView.value
  if (!lastClient || !view) return null
  const el = document.elementFromPoint(lastClient.x, lastClient.y)
  if (!el || !(view.container.contains(el) || hostRef.value?.contains(el))) return null
  return view.fromClient(lastClient)
}

function onPointerMove(e: PointerEvent) {
  lastClient = { x: e.clientX, y: e.clientY }
  const c = center.value
  if (!open.value || !c || stage.value === 'search') return
  const near = Math.hypot(e.clientX - (c.left + c.x), e.clientY - (c.top + c.y)) <= WHEEL.outer + 4
  resting.value = !near && !rootRef.value?.contains(e.target as Node)
}

// ── Seam ─────────────────────────────────────────────────────────────────────────

function start(req: AddRequest | null) {
  if (req) return openAt(req.pos)
  // A with the pointer still where the last wheel was: the shell lost track of it, we didn't
  const pos = req === null && !ui.placingLoot.value ? pointerOnMap() : null
  if (pos) return openAt(pos)
  // No pointer over the map (button, palette, panel): aim with the shell's placing mode;
  // the click comes back through request()
  close()
  ui.placingLoot.value = true
}

function request(req: AddRequest) {
  if (open.value && sameSpot(addItem.resolveSpot(req.pos), spot.value)) return run({ type: 'back' })
  openAt(req.pos)
}

/** Shift-click on a loot tile or a place plate opens the wheel on that pile, as on the map. */
function interceptTileClick(_tile: MapTile, req: AddRequest, e: MouseEvent) {
  if (!e.shiftKey) return false
  request(req)
  return true
}

let unregister: (() => void) | null = null
onMounted(() => {
  unregister = addUi.register({ start, request, interceptTileClick })
  window.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('keyup', onKeyUp, true)
  window.addEventListener('pointerdown', onPointerDown, true)
  window.addEventListener('pointerup', onPointerUp, true)
  window.addEventListener('pointermove', onPointerMove, { passive: true })
})
onBeforeUnmount(() => {
  close()
  unregister?.()
  window.removeEventListener('keydown', onKeyDown, true)
  window.removeEventListener('keyup', onKeyUp, true)
  window.removeEventListener('pointerdown', onPointerDown, true)
  window.removeEventListener('pointerup', onPointerUp, true)
  window.removeEventListener('pointermove', onPointerMove)
})

// A different map or run means a different place: end the wheel there
watch([() => game.currentMapId.value, () => game.currentRun.value?.id, () => game.travelMode.value], () => close())
</script>

<style scoped>
.wheel-leader {
  stroke: var(--primary);
  stroke-width: 1.5;
  stroke-dasharray: 3 4;
}

.wheel-leader-spot {
  fill: oklch(0.2 0.03 258 / 0.6);
  stroke: var(--primary);
  stroke-width: 2;
}

.wheel-root {
  animation: wheel-open 160ms cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes wheel-open {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
}

@media (prefers-reduced-motion: reduce) {
  .wheel-root {
    animation: none;
  }
}
</style>
