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
      tabindex="-1"
      data-add-wheel
    >
      <WheelRing
        :slices="slices"
        :hovered="hovered"
        :ring-key="ringKey"
        :pulse="pulse"
        @pick="onSlice"
        @hover="onHover"
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
        :here-count="hereCount"
        :crumb="crumb"
        :picks="shownPicks"
        :last="shownPicks.at(-1) ?? null"
        :hover="hoverInfo"
        :again="againInfo"
        :query="query"
        :note="noteText"
        :result-count="searchResults.length"
        :qty-typing="!!qtyBuffer"
        :pages="stage === 'items' ? groupPage : null"
        @update:query="(v) => (query = v)"
        @update:note="(v) => (noteText = v)"
        @qty="(d) => run({ type: 'qty-step', delta: d })"
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
import WheelReadout from '~/components/add/a/WheelReadout.vue'
import WheelRing from '~/components/add/a/WheelRing.vue'
import {
  WHEEL, contribution, ownsMarker, pageOf, readKey, readoutSide, stepQuantity, summarise, typeQuantity, wheelSteps,
  type Stage, type WheelAction, type WheelPick, type WheelSlice,
} from '~/components/add/a/wheel'
import { useAddItem } from '~/composables/useAddItem'
import { useAddUi, type AddRequest, type MapPos } from '~/composables/useAddUi'
import { useGameData } from '~/composables/useGameData'
import { useStaticData } from '~/composables/useStaticData'
import { useUiState } from '~/composables/useUiState'
import type { Spot } from '~/lib/addItem'
import type { Item } from '~/types'

/**
 * Variant A, "Wheel" (docs/add-item/a/NOTES.md): the game's radial menu, opened on the
 * map at the pointer. Ring 1 = 8 fixed groups, ring 2 = a group's items, letters search.
 * Every pick is written at once (one undo batch per open wheel), the spot stays visible
 * through the hole in the middle.
 */

const addUi = useAddUi()
const addItem = useAddItem()
const game = useGameData()
const ui = useUiState()
const { itemsById } = useStaticData()

// ── Groups (fixed order: never reshuffled, so digits and directions stay put) ──────────

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
  ...addItem.groups.map((g) => ({ id: g.id as string, label: g.label, members: new Set<string>(g.items) })),
  { id: RECENT, label: 'Recent', members: new Set<string>() },
]

// ── State of the open wheel ───────────────────────────────────────────────────────

const open = ref(false)
const spot = shallowRef<Spot & { snapped: 'poi' | 'marker' | null }>({ x: 0, y: 0, snapped: null })
const stage = ref<Stage>('groups')
const groupIdx = ref<number | null>(null)
const page = ref(0)
const query = ref('')
const noteText = ref('')
const picks = ref<WheelPick[]>([])
const hovered = ref<number | null>(null)
const qtyBuffer = ref('')
const pulse = ref(0)
const liveText = ref('')
let batchId: string | null = null
/** Markers this wheel created (anything else a pick lands on was there before) */
const created = new Set<string>()
/** Item order per group, frozen when the wheel opens so slices don't move under a flick */
const orders = new Map<string, Item[]>()
let restoreFocus: HTMLElement | null = null
let wheelAcc = 0

const hostRef = ref<HTMLElement | null>(null)
const rootRef = ref<HTMLElement | null>(null)
const readoutRef = ref<InstanceType<typeof WheelReadout> | null>(null)

function order(groupId: string): Item[] {
  let list = orders.get(groupId)
  if (!list) {
    if (groupId === RECENT) {
      // This run's habits first; a new run falls back to what this kind of place usually holds
      const seen = new Set<string>()
      list = [...addItem.frecent(16), ...addItem.likelyItems(spot.value.poiId, 16)].filter((i) => !seen.has(i.id) && !!seen.add(i.id)).slice(0, 16)
    } else {
      list = addItem.groupItems(groupId as Parameters<typeof addItem.groupItems>[0])
    }
    orders.set(groupId, list)
  }
  return list
}

/** Unlooted quantity per item already at the spot */
const hereByItem = computed(() => {
  const map = new Map<string, number>()
  if (!open.value) return map
  for (const m of addItem.markersAt(spot.value)) if (!m.lootedAt) map.set(m.itemId, (map.get(m.itemId) ?? 0) + m.quantity)
  return map
})
const hereCount = computed(() => (open.value ? addItem.markersAt(spot.value).length : 0))

const searchResults = computed(() => (stage.value === 'search' && query.value.trim() ? addItem.search(query.value, { limit: 99 }) : []))

const groupPage = computed(() => (groupIdx.value === null ? null : pageOf(order(groups[groupIdx.value]!.id), page.value)))

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
    count: picks.value.filter((p) => g.members.has(p.itemId)).length || undefined,
  }))
})

const ringKey = computed(() => (stage.value === 'search' ? 'search' : stage.value === 'items' ? `items-${groupIdx.value}-${page.value}` : 'groups'))

const crumb = computed(() => {
  if (stage.value !== 'items' || groupIdx.value === null) return null
  return groups[groupIdx.value]!.label
})

const place = computed(() => {
  const s = spot.value
  const poi = s.poiId ? game.getPOIById(s.poiId) : undefined
  if (poi) return { name: poi.name, kind: 'poi' as const }
  if (s.snapped === 'marker') return { name: 'Existing spot', kind: 'pile' as const }
  return { name: 'New spot', kind: 'new' as const }
})

const shownPicks = computed(() => picks.value.map((p, i) => {
  const item = itemsById.value.get(p.itemId)
  return { key: `${i}-${p.itemId}`, name: item?.name ?? 'Loot', icon: item?.icon, quantity: p.quantity }
}))

/**
 * The slice the pointer was on when it picked: until the pointer moves to another slice, the
 * readout keeps showing the pick (and its quantity) instead of what's under the pointer.
 */
const hoverLock = ref<number | null>(null)
function onHover(i: number | null) {
  if (i !== null && i !== hoverLock.value) hoverLock.value = null
  hovered.value = i
}

const hoverInfo = computed(() => {
  const i = hovered.value
  if (i === null || i === hoverLock.value || stage.value === 'note') return null
  if (showingItems.value) {
    const item = slotItems.value[i]
    return item ? { name: item.name, icon: item.icon, here: hereByItem.value.get(item.id) } : null
  }
  const g = groups[i]
  if (!g) return null
  const top = order(g.id).slice(0, 3).map((x) => x.name)
  return { name: top.length ? `${top.join(', ')}…` : 'Nothing logged yet this run', icon: null }
})

const againItem = computed<Item | null>(() => {
  const last = picks.value.at(-1)
  return last ? itemsById.value.get(last.itemId) ?? null : addItem.lastItem.value
})
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
  return { x, y, sx, sy, w: box.width, h: box.height, shifted: Math.hypot(x - sx, y - sy) > WHEEL.inner }
})

/** Keep the whole ring inside the map (mid-axis when the map is smaller than the ring). */
function clampAxis(v: number, size: number) {
  const m = WHEEL.outer + 6
  return size < 2 * m ? size / 2 : Math.min(size - m, Math.max(m, v))
}

const PLATE_W = 312
const PLATE_H = 200
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
  stage.value = 'groups'
  groupIdx.value = null
  page.value = 0
  query.value = ''
  noteText.value = ''
  picks.value = []
  hovered.value = null
  qtyBuffer.value = ''
  batchId = null
  created.clear()
  orders.clear()
  open.value = true
  addUi.active.value = true
  addUi.hideAddButton.value = true
  ui.placingLoot.value = false
  ui.selectMarker(null)
  liveText.value = `Add loot at ${place.value.name}. 1 to 8 picks a group, or type a name.`
  const active = document.activeElement as HTMLElement | null
  restoreFocus = active && active !== document.body && !active.closest('[data-add-wheel]') ? active : null
  nextTick(() => {
    rootRef.value?.focus({ preventScroll: true })
    addUi.mapView.value?.reveal(spot.value, WHEEL.outer + 16)
  })
}

function close() {
  if (!open.value) return
  if (picks.value.length && batchId) {
    const entries = picks.value.map((p) => ({ name: itemsById.value.get(p.itemId)?.name ?? 'Loot', quantity: p.quantity }))
    addUi.announce(`Added ${summarise(entries)}`, batchId)
  }
  const hadFocus = !!rootRef.value?.contains(document.activeElement)
  open.value = false
  picks.value = []
  batchId = null
  addUi.active.value = false
  addUi.hideAddButton.value = false
  if (hadFocus) {
    if (restoreFocus?.isConnected && !addUi.mapView.value?.container.contains(restoreFocus)) restoreFocus.focus({ preventScroll: true })
    else (document.activeElement as HTMLElement | null)?.blur()
  }
  restoreFocus = null
}

function sameSpot(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y) < 1
}

// ── Picks ─────────────────────────────────────────────────────────────────────────

function pick(item: Item) {
  const before = new Set(addItem.markersAt(spot.value).map((m) => m.id))
  const res = addItem.addAt(spot.value, [{ itemId: item.id, quantity: 1 }], batchId ? { batchId } : {})
  const marker = res?.markers[0]
  if (!res || !marker) return
  batchId = res.batchId
  if (!before.has(marker.id)) created.add(marker.id)
  picks.value.push({ itemId: item.id, markerId: marker.id, quantity: 1, stacked: !created.has(marker.id) })
  stage.value = 'groups'
  groupIdx.value = null
  page.value = 0
  query.value = ''
  hoverLock.value = hovered.value
  pulse.value++
  liveText.value = `Added ${item.name}. ${picks.value.length} in this wheel.`
  focusRoot()
}

/** Give the last pick a new quantity and tell the batch, so undo stays exact. */
function setLastQuantity(quantity: number) {
  const last = picks.value.at(-1)
  if (!last || !batchId || last.quantity === quantity) return
  last.quantity = quantity
  addItem.amend(batchId, last.markerId, contribution(picks.value, last.markerId))
  liveText.value = `${itemsById.value.get(last.itemId)?.name ?? 'Item'} ×${quantity}`
}

function removeLast() {
  const last = picks.value.pop()
  if (!last || !batchId) return
  addItem.amend(batchId, last.markerId, contribution(picks.value, last.markerId))
  liveText.value = `Took back ${itemsById.value.get(last.itemId)?.name ?? 'the last item'}`
}

function saveNote() {
  const last = picks.value.at(-1)
  const text = noteText.value.trim()
  if (!last || !batchId) return
  const marker = game.markers.value.find((m) => m.id === last.markerId)
  if ((marker?.note ?? '') === text) return
  if (ownsMarker(picks.value, last)) {
    game.updateMarker(last.markerId, { note: text })
  } else {
    // The pick shares a marker (stacked on earlier loot): give it its own, noted marker
    addItem.amend(batchId, last.markerId, contribution(picks.value, last.markerId) - last.quantity)
    const res = addItem.addAt(spot.value, [{ itemId: last.itemId, quantity: last.quantity, note: text }], { batchId })
    const m = res?.markers[0]
    if (!m) return
    created.add(m.id)
    last.markerId = m.id
    last.stacked = false
  }
  liveText.value = 'Note saved'
}

// ── Actions (keys, clicks and the wheel all end up here) ────────────────────────────

function run(action: WheelAction) {
  if (action.type !== 'qty-digit') qtyBuffer.value = ''
  switch (action.type) {
    case 'slice':
      return onSlice(action.index)
    case 'more':
      page.value++
      hovered.value = null
      return
    case 'pick-top': {
      const top = searchResults.value[0]
      if (top) pick(top)
      return
    }
    case 'qty-digit': {
      const next = typeQuantity(qtyBuffer.value, action.digit)
      qtyBuffer.value = next.buffer
      if (next.quantity) setLastQuantity(next.quantity)
      return
    }
    case 'qty-step': {
      const last = picks.value.at(-1)
      if (last) setLastQuantity(stepQuantity(last.quantity, action.delta))
      return
    }
    case 'again':
      if (againItem.value) pick(againItem.value)
      return
    case 'remove-last':
      return removeLast()
    case 'back':
      if (stage.value === 'groups') return close()
      stage.value = 'groups'
      groupIdx.value = null
      page.value = 0
      query.value = ''
      hovered.value = null
      return focusRoot()
    case 'close':
      return close()
    case 'note': {
      const last = picks.value.at(-1)
      noteText.value = last ? game.markers.value.find((m) => m.id === last.markerId)?.note ?? '' : ''
      stage.value = 'note'
      return readoutRef.value?.focusInput()
    }
    case 'note-save':
      saveNote()
      stage.value = 'groups'
      if (action.close) return close()
      return focusRoot()
    case 'search-start':
      stage.value = 'search'
      query.value = action.text
      hovered.value = null
      return readoutRef.value?.focusInput()
    case 'noop':
      return
  }
}

function onSlice(index: number) {
  if (stage.value === 'groups' || stage.value === 'note') {
    if (stage.value === 'note') saveNote()
    groupIdx.value = index
    page.value = 0
    stage.value = 'items'
    return
  }
  const item = slotItems.value[index]
  if (item) pick(item)
}

/** Right-click on the wheel works like right-click on the map under it: next spot (S4 along a road). */
function onRingContext(e: MouseEvent) {
  const pos = addUi.mapView.value?.fromClient({ x: e.clientX, y: e.clientY })
  if (pos) request({ pos, client: { x: e.clientX, y: e.clientY }, source: 'context' })
}

function onHole() {
  if (stage.value !== 'groups') run({ type: 'back' })
}

function focusRoot() {
  nextTick(() => rootRef.value?.focus({ preventScroll: true }))
}

/** Scroll over the wheel: quantity of the last pick; with nothing picked yet, the map zooms as usual. */
function onWheel(e: WheelEvent) {
  if (!picks.value.length) {
    addUi.mapView.value?.container.dispatchEvent(new WheelEvent('wheel', e))
    e.preventDefault()
    return
  }
  e.preventDefault()
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

function onKeyDown(e: KeyboardEvent) {
  if (e.isComposing) return
  if (!open.value) return maybeOpenWithSpace(e)
  // Another dialog (search palette, shortcuts) took over: leave its keys alone
  const target = e.target as HTMLElement | null
  if (target?.closest?.('[role="dialog"]:not([data-add-wheel])')) return
  const action = readKey(e, { stage: stage.value, hasPick: picks.value.length > 0, queryEmpty: !query.value })
  if (!action) return
  e.preventDefault()
  e.stopPropagation()
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
  const p = addUi.pointer.value
  const active = document.activeElement as HTMLElement | null
  if (!p || (active && active !== document.body && !addUi.mapView.value?.container.contains(active))) return
  e.preventDefault()
  openAt(p.pos)
}

// ── Pointer: a click (not a drag) anywhere outside the wheel closes it ─────────────────

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

// ── Seam ─────────────────────────────────────────────────────────────────────────

function start(req: AddRequest | null) {
  if (req) return openAt(req.pos)
  // No pointer over the map (button, palette, panel): aim with the shell's placing mode;
  // the click comes back through request()
  close()
  ui.placingLoot.value = true
}

function request(req: AddRequest) {
  if (open.value && sameSpot(addItem.resolveSpot(req.pos), spot.value)) return run({ type: 'back' })
  openAt(req.pos)
}

let unregister: (() => void) | null = null
onMounted(() => {
  unregister = addUi.register({ start, request })
  window.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('keyup', onKeyUp, true)
  window.addEventListener('pointerdown', onPointerDown, true)
  window.addEventListener('pointerup', onPointerUp, true)
})
onBeforeUnmount(() => {
  close()
  unregister?.()
  window.removeEventListener('keydown', onKeyDown, true)
  window.removeEventListener('keyup', onKeyUp, true)
  window.removeEventListener('pointerdown', onPointerDown, true)
  window.removeEventListener('pointerup', onPointerUp, true)
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
