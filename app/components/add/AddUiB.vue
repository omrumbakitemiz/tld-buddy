<template>
  <Teleport to="body">
    <template v-if="spot">
      <div class="field-pin pointer-events-none fixed z-[550] text-primary" :style="{ left: `${point.x}px`, top: `${point.y}px` }" aria-hidden="true"><CrosshairIcon class="size-6" /></div>
      <section ref="plate" class="field-note surface-rail fixed z-[550] rounded-lg border border-border text-foreground" :style="position" aria-label="Field note" @pointerdown.stop @wheel.stop>
        <header class="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
          <h2 class="hud-label">{{ placeName }}</h2>
          <button type="button" class="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary" @click="close">Done <kbd>Esc</kbd></button>
        </header>
        <div v-if="here.length" class="border-b border-border px-3 py-2 text-xs text-muted-foreground">At this spot · {{ here.length }} {{ here.length === 1 ? 'item' : 'items' }}</div>
        <div v-if="entries.length" class="flex max-h-28 flex-wrap gap-2 overflow-y-auto px-3 py-3" aria-label="Added this visit" aria-live="polite">
          <span v-for="(entry, i) in entries" :key="i" class="flex max-w-full items-center gap-1.5 rounded bg-muted px-2 py-1 text-xs" :title="entry.note">
            <img v-if="entry.item.icon" :src="entry.item.icon" alt="" class="size-5 object-contain">
            <span class="truncate">{{ entry.item.name }}</span><b class="tabular text-primary">×{{ entry.quantity }}</b><MessageSquareIcon v-if="entry.note" class="size-3 shrink-0" />
          </span>
        </div>
        <div class="flex items-center gap-2 px-3 py-2 focus-within:ring-1 focus-within:ring-inset focus-within:ring-primary">
          <PlusIcon class="size-4 shrink-0 text-primary" />
          <input ref="line" v-model="text" class="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" role="combobox" aria-label="Item and quantity" aria-autocomplete="list" aria-controls="field-results" :aria-expanded="true" :aria-activedescendant="results[selected] ? `field-option-${selected}` : undefined" placeholder="12 matches, hatchet, 3 peaches…" autocomplete="off" spellcheck="false">
          <span class="tabular text-xs text-muted-foreground">×{{ parsed.quantity }}</span>
        </div>
        <div v-if="parsed.note" class="px-3 pb-2 text-xs text-muted-foreground">Note: {{ parsed.note }}</div>
        <ul id="field-results" role="listbox" aria-label="Item suggestions" class="border-t border-border p-1">
          <li v-for="(item, i) in results" :id="`field-option-${i}`" :key="item.id" role="option" :aria-selected="selected === i">
            <button type="button" tabindex="-1" class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent" :class="selected === i ? 'bg-accent' : ''" @mousedown.prevent @click="commit(item)">
              <img v-if="item.icon" :src="item.icon" alt="" class="size-7 object-contain">
              <span class="min-w-0 flex-1 truncate"><span v-if="!text.trim() && item.id === add.lastItem.value?.id" class="text-muted-foreground">Again: </span>{{ item.name }}</span>
              <span v-if="selected === i" class="tabular text-xs text-primary">×{{ parsed.quantity }} ↵</span>
              <span v-else class="text-xs text-muted-foreground">{{ item.category }}</span>
            </button>
          </li>
          <li v-if="!results.length" class="px-2 py-4 text-sm text-muted-foreground">No item found. Try another name.</li>
        </ul>
        <footer class="space-y-1 border-t border-border px-3 py-2 text-xs text-muted-foreground">
          <p v-if="error" role="alert" class="text-destructive">{{ error }}</p>
          <p><kbd>Enter</kbd> {{ text.trim() ? 'add' : entries.length ? 'done' : 'repeat' }} · <kbd>↑ ↓</kbd> choose · <kbd>Tab</kbd> complete</p>
          <p>Quantity before or after · <kbd>#</kbd> note · empty <kbd>⌫</kbd> edit last</p>
        </footer>
      </section>
    </template>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { CrosshairIcon, MessageSquareIcon, PlusIcon } from '@lucide/vue'
import { useAddUi, type AddRequest } from '~/composables/useAddUi'
import { useAddItem } from '~/composables/useAddItem'
import { useUiState } from '~/composables/useUiState'
import { useGameData } from '~/composables/useGameData'
import type { Item } from '~/types'
import type { Spot } from '~/lib/addItem'
import { parseFieldNote, placeFieldNote } from './b/fieldNote'

const seam = useAddUi()
const add = useAddItem()
const ui = useUiState()
const game = useGameData()
const spot = ref<Spot | null>(null)
const text = ref('')
const error = ref('')
const selected = ref(0)
const line = ref<HTMLInputElement>()
const plate = ref<HTMLElement>()
const height = ref(440)
const entries = ref<{ item: Item; quantity: number; note: string }[]>([])
let batchId: string | undefined
let unregister: (() => void) | undefined
let observer: ResizeObserver | undefined
const parsed = computed(() => parseFieldNote(text.value))
const results = computed(() => {
  if (parsed.value.query) return add.search(parsed.value.query, { limit: 6 })
  const list = [add.lastItem.value, ...add.frecent(6), ...add.search('', { limit: 6 })].filter((i): i is Item => !!i)
  return [...new Map(list.map((i) => [i.id, i])).values()].slice(0, 6)
})
const here = computed(() => spot.value ? add.markersAt(spot.value) : [])
const placeName = computed(() => spot.value?.poiId ? game.getPOIById(spot.value.poiId)?.name ?? 'Field note' : 'Field note')
const point = computed(() => {
  void seam.viewTick.value
  return spot.value && seam.mapView.value ? seam.mapView.value.toClient(spot.value) : { x: 0, y: 0 }
})
const position = computed(() => {
  void seam.viewTick.value
  const bounds = seam.mapView.value?.container.getBoundingClientRect()
  if (!bounds) return {}
  const width = Math.min(360, bounds.width - 24)
  const pos = placeFieldNote(point.value, bounds, width, height.value)
  return { left: `${pos.left}px`, top: `${pos.top}px`, width: `${width}px`, maxHeight: `${bounds.height - 24}px` }
})
function focus() { if (spot.value) nextTick(() => line.value?.focus({ preventScroll: true })) }
function close() {
  if (entries.value.length) seam.announce(`Added ${entries.value.length} items`, batchId ?? null)
  spot.value = null
  seam.active.value = false
  seam.hideAddButton.value = false
  ui.cancelPlacement()
}
function open(req: AddRequest) {
  if (!game.currentRun.value) { ui.showRuns.value = true; return }
  if (spot.value) close()
  spot.value = add.resolveSpot(req.pos)
  text.value = ''; error.value = ''; entries.value = []; batchId = undefined; selected.value = 0
  ui.selectMarker(null); ui.cancelPlacement(); seam.active.value = true; seam.hideAddButton.value = true
  seam.mapView.value?.reveal(spot.value, 70)
  focus()
}
function start(req: AddRequest | null) {
  if (req) open(req)
  else { ui.placingLoot.value = true; seam.announce('Click a spot to start a field note') }
}
function commit(item = results.value[selected.value]) {
  if (!spot.value || !item) return
  const entry = { item, quantity: parsed.value.quantity, note: parsed.value.note }
  const result = add.addAt(spot.value, [{ itemId: item.id, quantity: entry.quantity, note: entry.note }], { batchId })
  if (!result) { error.value = 'Select a run and map before adding.'; return }
  batchId = result.batchId
  entries.value.push(entry)
  seam.announce(`Added ${item.name} ×${entry.quantity}`, batchId)
  text.value = ''; error.value = ''; selected.value = 0; focus()
}
function editLast() {
  const last = entries.value.pop()
  if (!last || !spot.value) return
  add.undo(batchId)
  batchId = undefined
  if (entries.value.length) {
    const result = add.addAt(spot.value, entries.value.map((e) => ({ itemId: e.item.id, quantity: e.quantity, note: e.note })))
    batchId = result?.batchId
  }
  text.value = `${last.quantity} ${last.item.name}${last.note ? ` # ${last.note}` : ''}`
  seam.announce('Last entry reopened', batchId ?? null)
}
function onKey(e: KeyboardEvent) {
  if (e.isComposing || e.defaultPrevented) return
  const target = e.target as HTMLElement | null
  if (!spot.value) {
    if (e.key !== 'Enter' || e.ctrlKey || e.metaKey || e.altKey || target?.closest('input,textarea,select,button,[role="dialog"],[contenteditable="true"]')) return
    const ids = new Set([ui.selectedMarkerId.value, ...(ui.selectedGroupIds.value ?? [])])
    const markers = game.currentMapMarkers.value.filter((m) => ids.has(m.id))
    if (!markers.length) return
    e.preventDefault()
    const pos = { x: markers.reduce((s, m) => s + m.x, 0) / markers.length, y: markers.reduce((s, m) => s + m.y, 0) / markers.length }
    open({ pos, client: seam.mapView.value?.toClient(pos) ?? { x: 0, y: 0 }, source: 'key' })
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
    e.preventDefault()
    if (batchId) add.undo(batchId)
    entries.value = []; batchId = undefined; seam.announce('Undone'); focus(); return
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return
  if (e.key === 'Escape') { e.preventDefault(); close(); return }
  if (e.target !== line.value) return
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault(); selected.value = (selected.value + (e.key === 'ArrowDown' ? 1 : -1) + results.value.length) % Math.max(1, results.value.length)
  } else if (e.key === 'Enter' || (e.key === ',' && !parsed.value.note)) {
    e.preventDefault()
    if (e.repeat) return
    if (!text.value.trim() && entries.value.length) close()
    else commit()
  } else if (e.key === 'Tab' && !e.shiftKey) {
    e.preventDefault()
    const item = results.value[selected.value]
    if (text.value.trim() && item) text.value = `${parsed.value.quantity > 1 ? `${parsed.value.quantity} ` : ''}${item.name}${parsed.value.note ? ` # ${parsed.value.note}` : ''}`
    else if (entries.value.length) { editLast(); text.value += text.value.includes(' # ') ? '' : ' # ' }
    else text.value = `${add.lastItem.value?.name ?? ''} # `
  } else if (e.key === 'Backspace' && !text.value) { e.preventDefault(); editLast() }
}
watch(text, () => { selected.value = 0; error.value = '' })
watch(seam.notice, (n) => { if (n?.text === 'Undone' || n?.text === 'Nothing to undo') { entries.value = []; batchId = undefined } })
watch([game.currentMapId, () => game.currentRun.value?.id], close)
watch(plate, (el) => { observer?.disconnect(); if (el) observer?.observe(el) })
onMounted(() => {
  observer = new ResizeObserver(([entry]) => { if (entry) height.value = entry.target.getBoundingClientRect().height })
  unregister = seam.register({ start, request: open, interceptClick: () => { if (spot.value) close(); return false } })
  window.addEventListener('keydown', onKey, true)
  window.addEventListener('focus', focus)
})
onBeforeUnmount(() => {
  close(); unregister?.(); observer?.disconnect()
  window.removeEventListener('keydown', onKey, true); window.removeEventListener('focus', focus)
})
</script>

<style scoped>
.field-note { overflow-y: auto; caret-color: var(--primary); transition: border-color 180ms ease; }
.field-note::selection, .field-note :deep(::selection) { background: var(--primary); color: var(--primary-foreground); }
.field-pin { transform: translate(-50%, -50%); }
@media (prefers-reduced-motion: reduce) { .field-note { transition: none; } }
</style>
