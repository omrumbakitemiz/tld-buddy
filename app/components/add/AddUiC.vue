<template>
  <!-- Variant C · Rummage: a loot session on a building (docs/add-item/c/NOTES.md) -->
  <div ref="rootRef" class="pointer-events-none absolute inset-0">
    <div v-if="ringStyle" :key="ringKey" class="rummage-ring" :style="ringStyle" aria-hidden="true" />
    <RummagePanel ref="panelRef" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import RummagePanel from '~/components/add/c/RummagePanel.vue'
import { useRummage } from '~/components/add/c/useRummage'
import { useAddItem } from '~/composables/useAddItem'
import { useAddUi } from '~/composables/useAddUi'
import { useGameData } from '~/composables/useGameData'
import { useUiState } from '~/composables/useUiState'

/**
 * Registers Rummage with the add-item seam and owns what happens outside the panel:
 * the ring on the map, entry points (A, right-click, plate click, map click while open),
 * and the keyboard when focus is elsewhere. The panel itself is c/RummagePanel.vue.
 */

const addUi = useAddUi()
const addItem = useAddItem()
const ui = useUiState()
const game = useGameData()
const r = useRummage()

const rootRef = ref<HTMLElement | null>(null)
const panelRef = ref<InstanceType<typeof RummagePanel> | null>(null)

const open = computed(() => !!r.session.value || r.picking.value)

// The panel covers the right third of the map. A clicked spot is visible by definition, so this only nudges it
// off the panel's edge; a place's plate runs ~150 px to the right of its pin and needs that room too.
const PANEL_CLEARANCE = 360 + 60 + 24

function reveal(spot: { x: number; y: number; poiId?: string }) {
  const view = addUi.mapView.value
  if (!view) return
  const w = view.container.clientWidth
  view.reveal(spot, { right: Math.min(PANEL_CLEARANCE + (spot.poiId ? 150 : 0), w * 0.55), top: 110, bottom: 110, left: 110 })
}

function focusSearch() {
  nextTick(() => panelRef.value?.focusSearch())
}

function openAtPos(pos: { x: number; y: number }) {
  if (!game.currentRun.value) {
    ui.showRuns.value = true
    return
  }
  r.openAtPos(pos)
  if (r.session.value) reveal(r.session.value.spot)
  focusSearch()
}

function begin(req: { pos: { x: number; y: number } } | null) {
  if (!game.currentRun.value) {
    ui.showRuns.value = true
    return
  }
  if (req) return openAtPos(req.pos)
  if (r.session.value) return focusSearch()
  // No pointer on the map: a selected place is the spot, otherwise ask for a click
  const pin = ui.selectedPOIId.value ? game.getPOIPin(ui.selectedPOIId.value) : undefined
  if (pin) return openAtPos(pin)
  r.startPicking()
}

const unregister = addUi.register({
  start: begin,
  request: (req) => openAtPos(req.pos),
  // While a session is open (or waiting for a spot), a map click moves it
  interceptClick: (req) => {
    if (!open.value) return false
    openAtPos(req.pos)
    return true
  },
  // Place plates: a click opens the session there; the Places tab stays one key (2) away
  interceptPOIClick: (poiId) => {
    const pin = game.getPOIPin(poiId)
    if (!pin || !game.currentRun.value) return false
    ui.selectedPOIId.value = null
    openAtPos(pin)
    return true
  },
})

// The session owns the keyboard and the add button's job while it is open
watch(open, (v) => {
  addUi.active.value = v
  addUi.hideAddButton.value = v
}, { immediate: true })
watch(() => r.picking.value, (v) => addUi.mapView.value?.container.classList.toggle('rummage-pick', v), { immediate: true })

// Another map, another run: the session doesn't carry over
watch([() => game.currentMap.value?.id, () => game.currentRun.value?.id], () => r.close())

// ── Ring on the map ─────────────────────────────────────────────────────────

const ringStyle = computed(() => {
  void addUi.viewTick.value
  const s = r.session.value
  const view = addUi.mapView.value
  const root = rootRef.value
  if (!s || !view || !root) return null
  const p = view.toClient(s.spot)
  const box = root.getBoundingClientRect()
  return { transform: `translate(${p.x - box.left}px, ${p.y - box.top}px) translate(-50%, -50%)` }
})
/** A new spot replays the ring's entrance */
const ringKey = computed(() => (r.session.value ? `${r.session.value.spot.x}|${r.session.value.spot.y}` : ''))

// ── Keyboard outside the panel ──────────────────────────────────────────────

const isField = (el: EventTarget | null) => {
  const t = el as HTMLElement | null
  return !!t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))
}

function onKeydown(e: KeyboardEvent) {
  if (!open.value || e.isComposing) return
  const target = e.target as HTMLElement | null
  // Dialogs (runs, search palette, …) keep their own keys
  if (target?.closest?.('[role="dialog"]')) return

  // Ctrl/Cmd+Z: the shell skips it while a text field has focus. In an empty search line there
  // is nothing of ours to undo, so it steps back the last item; with text typed it stays native.
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
    if (isField(target) && (target === panelRef.value?.noteRef || r.query.value)) return
    e.preventDefault()
    e.stopPropagation()
    const n = addItem.undo()
    addUi.announce(n ? 'Undone' : 'Nothing to undo')
    return
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return

  if (e.key === 'Escape' && !isField(target)) {
    e.preventDefault()
    r.close()
    return
  }
  // Typing with focus anywhere else (map, tray button) lands in the search line
  const onButton = target?.tagName === 'BUTTON'
  if (r.session.value && !isField(target) && e.key.length === 1 && !(onButton && e.key === ' ')) {
    panelRef.value?.focusSearch()
  }
}

// Back from the game: the search line is waiting
function onWindowFocus() {
  if (r.session.value && !isField(document.activeElement)) panelRef.value?.focusSearch()
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown, true)
  window.addEventListener('focus', onWindowFocus)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown, true)
  window.removeEventListener('focus', onWindowFocus)
  addUi.mapView.value?.container.classList.remove('rummage-pick')
  unregister()
  r.close()
})
</script>

<style>
/* The spot being searched: an apricot ring with an ink keyline, like the markers it will hold */
.rummage-ring {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 480;
  width: 68px;
  height: 68px;
  border-radius: 50%;
  border: 2px solid var(--loot);
  box-shadow: 0 0 0 1.5px oklch(0.16 0.03 258), inset 0 0 0 1.5px oklch(0.16 0.03 258 / 0.7);
  pointer-events: none;
  animation: rummage-ring-in 220ms cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes rummage-ring-in {
  from { opacity: 0; scale: 1.35; }
  to { opacity: 1; scale: 1; }
}
.leaflet-container.rummage-pick {
  cursor: crosshair !important;
}
@media (prefers-reduced-motion: reduce) {
  .rummage-ring { animation: none; }
}
</style>
