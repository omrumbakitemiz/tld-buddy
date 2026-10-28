<template>
  <!-- Variant C · Rummage: a loot session on a building (docs/add-item/c/NOTES.md) -->
  <div ref="rootRef" class="pointer-events-none absolute inset-0">
    <div v-if="ringStyle" :key="ringKey" class="rummage-ring" :style="ringStyle" aria-hidden="true" />
    <Button
      v-if="chipStyle"
      size="sm"
      class="pointer-events-auto absolute left-0 top-0 z-[480] h-8 rounded-full px-3.5 shadow-[0_4px_14px_oklch(0.1_0.02_258/0.55)]"
      :style="chipStyle"
      @click="begin(null)"
    >
      <PlusIcon class="size-3.5" /> Log loot here <kbd class="ml-0.5 text-[10px] opacity-70">A</kbd>
    </Button>
    <RummagePanel ref="panelRef" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { PlusIcon } from '@lucide/vue'
import { Button } from '~/components/ui/button'
import RummagePanel from '~/components/add/c/RummagePanel.vue'
import { RUMMAGE_KEY, createRummage } from '~/components/add/c/useRummage'
import { useAddItem } from '~/composables/useAddItem'
import { useAddUi } from '~/composables/useAddUi'
import { useGameData } from '~/composables/useGameData'
import { useUiState } from '~/composables/useUiState'

/**
 * Registers Rummage with the add-item seam and owns what happens outside the panel: the ring on the
 * map, the "Log loot here" chip on a selected place, the entry points (A, right-click on the map, a
 * loot tile or a plate, Shift-click) and the keys while focus is elsewhere. The panel is c/RummagePanel.vue.
 */

const addUi = useAddUi()
const addItem = useAddItem()
const ui = useUiState()
const game = useGameData()
const r = createRummage()
provide(RUMMAGE_KEY, r)

const rootRef = ref<HTMLElement | null>(null)
const panelRef = ref<InstanceType<typeof RummagePanel> | null>(null)

const open = computed(() => !!r.session.value || r.picking.value)

// The panel covers the right of the map. A spot you pointed at is visible by definition, so this only nudges
// it off the panel's edge; a place's plate runs ~150 px to the right of its pin and needs that room too.
const panelWidth = computed(() => (r.compact.value ? 264 : 336))

function reveal(spot: { x: number; y: number; poiId?: string }) {
  const view = addUi.mapView.value
  if (!view) return
  const clearance = panelWidth.value + 60 + 24 + (spot.poiId ? 150 : 0)
  view.reveal(spot, { right: Math.min(clearance, view.container.clientWidth * 0.55), top: 110, bottom: 110, left: 110 })
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

// Moving a session takes a deliberate gesture: right-click (map, tile or plate), `A`, Shift-click. A plain
// click only chooses a spot while the session is waiting for one, so a stray click never relocates logging.
const unregister = addUi.register({
  start: begin,
  request: (req) => openAtPos(req.pos),
  interceptClick: (req) => {
    if (!r.picking.value) return false
    openAtPos(req.pos)
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

// ── On the map ──────────────────────────────────────────────────────────────

/** Map position → pixels inside this overlay (re-read on every pan and zoom) */
function toLocal(pos: { x: number; y: number }) {
  void addUi.viewTick.value
  const view = addUi.mapView.value
  const root = rootRef.value
  if (!view || !root) return null
  const p = view.toClient(pos)
  const box = root.getBoundingClientRect()
  return { x: p.x - box.left, y: p.y - box.top }
}

const ringStyle = computed(() => {
  const s = r.session.value
  const p = s && toLocal(s.spot)
  return p ? { transform: `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)` } : null
})
/** A new spot replays the ring's entrance */
const ringKey = computed(() => (r.session.value ? `${r.session.value.spot.x}|${r.session.value.spot.y}` : ''))

/** A selected place offers "Log loot here" under its pin: the plain plate click still selects the place as before */
const chipStyle = computed(() => {
  const pin = !open.value && ui.selectedPOIId.value ? game.getPOIPin(ui.selectedPOIId.value) : undefined
  const p = pin && toLocal(pin)
  return p ? { transform: `translate(${p.x - 8}px, ${p.y + 18}px)` } : null
})

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

  // Ctrl/Cmd+Z inside a session steps back the last thing (the whole visit is one undo batch for the toast
  // and for Ctrl+Z after Done). With text typed in a field it stays the browser's own undo.
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
    if (isField(target) && (target === panelRef.value?.noteRef || r.query.value)) return
    e.preventDefault()
    e.stopPropagation()
    if (!r.stepBack()) r.say('Nothing to step back here yet')
    return
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return

  if (e.key === 'Escape' && !isField(target)) {
    e.preventDefault()
    r.close()
    return
  }
  // Typing with focus on a button or the map goes to the search line; a digit right after a tick still means "how many"
  const onButton = target?.tagName === 'BUTTON'
  if (r.session.value && !isField(target) && e.key.length === 1 && !(onButton && e.key === ' ')) {
    if (/^[0-9]$/.test(e.key) && r.armed.value) {
      e.preventDefault()
      r.digit(e.key)
    }
    panelRef.value?.focusSearch()
  }
}

// Back from the game: the search line is waiting, and a number typed earlier doesn't linger
function onWindowFocus() {
  r.disarm()
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
