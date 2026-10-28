<template>
  <Teleport to="body">
    <template v-if="spot">
      <svg class="pointer-events-none fixed inset-0 z-[549] h-full w-full text-primary" aria-hidden="true">
        <line :x1="point.x" :y1="point.y" :x2="leader.x" :y2="leader.y" stroke="currentColor" stroke-width="1" />
      </svg>
      <div class="field-pin pointer-events-none fixed z-[550] text-primary" :style="pinStyle" aria-hidden="true">
        <CrosshairIcon class="size-6" />
      </div>
      <section ref="plate" class="field-note surface-rail fixed z-[550] rounded-lg border border-border text-foreground" :style="position" aria-label="Field note" @pointerdown.stop @wheel.stop>
        <header class="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
          <h2 class="hud-label">{{ placeName }}</h2>
          <button type="button" class="field-control px-2 py-1 text-xs text-muted-foreground" @mousedown.prevent @click="requestClose">Done <kbd>Esc</kbd></button>
        </header>

        <div v-if="before.length" class="border-b border-border px-3 py-2" aria-label="Before this visit">
          <h3 class="hud-label mb-2 text-muted-foreground">Before this visit</h3>
          <ul class="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
            <li v-for="marker in before" :key="marker.id" class="flex max-w-full items-center gap-1.5 rounded bg-muted/50 px-2 py-1 text-xs" :title="marker.note ?? undefined">
              <img v-if="game.getItemById(marker.itemId)?.icon" :src="game.getItemById(marker.itemId)?.icon ?? undefined" alt="" class="size-5 object-contain" :class="marker.lootedAt ? 'opacity-55 grayscale' : ''">
              <span class="truncate">{{ game.getItemById(marker.itemId)?.name ?? marker.name }}</span>
              <b class="tabular" :class="marker.lootedAt ? 'text-looted' : 'text-primary'">×{{ marker.quantity }}</b>
              <span v-if="marker.lootedAt" class="text-looted">Looted</span>
              <span v-else class="sr-only">Still here</span>
            </li>
          </ul>
        </div>
        <div v-if="entries.length" class="border-b border-border px-3 py-2" aria-label="Added this visit" aria-live="polite">
          <h3 class="hud-label mb-2 text-muted-foreground">This visit · {{ entries.length }}</h3>
          <ul class="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
            <li v-for="(entry, i) in entries" :key="i" class="flex max-w-full items-center gap-1.5 rounded bg-muted px-2 py-1 text-xs" :class="editing === i ? 'outline outline-primary' : ''" :title="entry.note">
              <img v-if="entry.item.icon" :src="entry.item.icon" alt="" class="size-5 object-contain">
              <span class="truncate">{{ entry.item.name }}</span>
              <b class="tabular text-primary">×{{ entry.quantity }}</b>
              <MessageSquareIcon v-if="entry.note" class="size-3 shrink-0" />
            </li>
          </ul>
        </div>

        <p v-if="editing !== null" class="px-3 pt-2 text-xs text-primary">Editing last entry · Enter to update</p>
        <div class="flex items-center gap-2 px-3 py-2 focus-within:ring-1 focus-within:ring-inset focus-within:ring-primary">
          <PlusIcon class="size-4 shrink-0 text-primary" />
          <input ref="line" v-model="text" class="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" role="combobox" aria-label="Item and quantity" aria-autocomplete="list" :aria-controls="showResults ? 'field-results' : undefined" :aria-expanded="showResults" :aria-activedescendant="showResults && results[selected] ? `field-option-${selected}` : undefined" placeholder="12 matches, hatchet, 3 peaches…" autocomplete="off" spellcheck="false" @focus="lineFocused = true" @blur="lineFocused = false">
          <span class="tabular text-xs text-muted-foreground">×{{ parsed.quantity }}</span>
        </div>
        <p v-if="parsed.note" class="px-3 pb-2 text-xs text-muted-foreground">Note: {{ parsed.note }}</p>
        <ul v-if="showResults" id="field-results" role="listbox" aria-label="Item suggestions" class="border-t border-border p-1" :class="empty ? 'grid grid-cols-2 gap-1' : ''">
          <li v-for="(item, i) in results" :id="`field-option-${i}`" :key="item.id" role="option" :aria-selected="!empty && selected === i">
            <button type="button" tabindex="-1" class="field-control flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm" :class="!empty && selected === i ? 'bg-accent' : ''" :title="item.name" @mousedown.prevent @click="commit(item)">
              <img v-if="item.icon" :src="item.icon" alt="" class="size-7 shrink-0 object-contain">
              <span class="min-w-0 flex-1">
                <span v-if="empty && item.id === add.lastItem.value?.id" class="block text-[10px] text-muted-foreground">Again</span>
                <span class="block truncate" :class="empty ? 'text-xs' : ''">{{ item.name }}</span>
              </span>
              <kbd v-if="empty" class="text-[10px] text-muted-foreground">Alt{{ i + 1 }}</kbd>
              <span v-else-if="selected === i" class="tabular text-xs text-primary">×{{ parsed.quantity }} ↵</span>
            </button>
          </li>
          <li v-if="!results.length" class="px-2 py-4 text-sm text-muted-foreground">No item found. Try another name.</li>
        </ul>
        <footer class="space-y-1 border-t border-border px-3 py-2 text-xs text-muted-foreground">
          <p v-if="error" role="status" class="text-warning">{{ error }}</p>
          <div v-if="!empty || editing !== null" class="flex gap-2 pb-1">
            <button type="button" class="field-control px-2 py-1 underline underline-offset-2" @mousedown.prevent @click="discardDraft">{{ editing !== null ? 'Cancel edit' : 'Discard draft' }}</button>
            <button v-if="editing !== null" type="button" class="field-control px-2 py-1 text-destructive underline underline-offset-2" @mousedown.prevent @click="removeEdited">Remove entry</button>
          </div>
          <p v-if="empty"><kbd>Enter</kbd> done · <kbd>Space</kbd> repeat &amp; done</p>
          <p v-else><kbd>Enter</kbd> {{ editing !== null ? 'update' : 'add' }} · <kbd>↑ ↓</kbd> choose · <kbd>Tab</kbd> complete</p>
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
import type { Item, Marker } from '~/types'
import type { Spot } from '~/lib/addItem'
import { parseFieldNote, placeFieldNote, entryContribution } from './b/fieldNote'

interface VisitEntry {
  item: Item
  quantity: number
  note: string
  markerId: string
}

const seam = useAddUi()
const add = useAddItem()
const ui = useUiState()
const game = useGameData()
const spot = ref<Spot | null>(null)
const before = ref<Marker[]>([])
const text = ref('')
const error = ref('')
const selected = ref(0)
const editing = ref<number | null>(null)
const line = ref<HTMLInputElement>()
const lineFocused = ref(false)
const plate = ref<HTMLElement>()
const height = ref(400)
const entries = ref<VisitEntry[]>([])
const drafts = new Map<string, {
  spot: Spot
  text: string
  before: Marker[]
  entries: VisitEntry[]
  batchId?: string
  editing: number | null
}>()
let batchId: string | undefined
let unregister: (() => void) | undefined
let observer: ResizeObserver | undefined
const contextKey = computed(() => `${game.currentRun.value?.id}/${game.currentMapId.value}`)
const parsed = computed(() => parseFieldNote(text.value))
const empty = computed(() => !text.value.trim())
const showResults = computed(() => lineFocused.value)
const results = computed(() => {
  if (parsed.value.query) return add.search(parsed.value.query, { limit: 6 })
  const list = [add.lastItem.value, ...add.frecent(6), ...add.search('', { limit: 6 })]
    .filter((item): item is Item => !!item)
  return [...new Map(list.map((item) => [item.id, item])).values()].slice(0, 6)
})
const placeName = computed(() => spot.value?.poiId
  ? game.getPOIById(spot.value.poiId)?.name ?? 'Field note'
  : 'Field note')
const point = computed(() => {
  void seam.viewTick.value
  return spot.value && seam.mapView.value
    ? seam.mapView.value.toClient(spot.value)
    : { x: 0, y: 0 }
})
const layout = computed(() => {
  void seam.viewTick.value
  const bounds = seam.mapView.value?.container.getBoundingClientRect()
  if (!bounds) return null
  const width = Math.min(360, bounds.width - 24)
  return { ...placeFieldNote(point.value, bounds, width, height.value), width, maxHeight: bounds.height - 24 }
})
const position = computed(() => layout.value ? {
  left: `${layout.value.left}px`,
  top: `${layout.value.top}px`,
  width: `${layout.value.width}px`,
  maxHeight: `${layout.value.maxHeight}px`,
} : {})
const pinStyle = computed(() => ({ left: `${point.value.x}px`, top: `${point.value.y}px` }))
const leader = computed(() => {
  const box = layout.value
  if (!box) return point.value
  return {
    x: Math.max(box.left, Math.min(point.value.x, box.left + box.width)),
    y: Math.max(box.top + 12, Math.min(point.value.y, box.top + height.value - 12)),
  }
})

function focus() {
  if (spot.value) nextTick(() => line.value?.focus({ preventScroll: true }))
}

/** Only explicit discard can throw away text; ordinary dismissal keeps the line. */
function guardDraft() {
  if (empty.value && editing.value === null) return false
  error.value = 'Draft kept. Finish or discard it before leaving this spot.'
  focus()
  return true
}

function finish() {
  if (entries.value.length) seam.announce(`Added ${entries.value.length} items`, batchId ?? null)
  spot.value = null
  seam.active.value = false
  seam.hideAddButton.value = false
  ui.cancelPlacement()
}

function requestClose() {
  if (!guardDraft()) finish()
}

function open(req: AddRequest) {
  if (!game.currentRun.value) {
    ui.showRuns.value = true
    return
  }
  if (spot.value) {
    if (guardDraft()) return
    finish()
  }
  const draft = drafts.get(contextKey.value)
  spot.value = draft?.spot ?? add.resolveSpot(req.pos)
  text.value = draft?.text ?? ''
  drafts.delete(contextKey.value)
  before.value = draft?.before ?? add.markersAt(spot.value).map((marker) => ({ ...marker }))
  error.value = draft ? 'Unfinished entry restored at its original spot.' : ''
  entries.value = draft?.entries ?? []
  batchId = draft?.batchId
  editing.value = draft?.editing ?? null
  selected.value = 0
  ui.selectMarker(null)
  ui.cancelPlacement()
  seam.active.value = true
  seam.hideAddButton.value = true
  seam.mapView.value?.reveal(spot.value, 70)
  focus()
}

function start(req: AddRequest | null) {
  if (req) open(req)
  else {
    ui.placingLoot.value = true
    seam.announce('Click a spot to start a field note')
  }
}

/** Amend the batch's contribution, never the marker's pre-visit baseline. */
function amendEntry(index: number, quantity: number) {
  const entry = entries.value[index]
  if (!entry || !batchId) return false
  const total = entryContribution(entries.value, entry.markerId, index, quantity)
  return add.amend(batchId, entry.markerId, total)
}

function commit(item = results.value[selected.value]) {
  if (!spot.value || !item || (!parsed.value.query && !empty.value)) {
    error.value = 'Type an item name before adding a note.'
    return false
  }
  const value = { item, quantity: parsed.value.quantity, note: parsed.value.note }
  const index = editing.value
  const previous = index === null ? undefined : entries.value[index]
  if (previous && previous.item.id === item.id && previous.note === value.note) {
    if (!amendEntry(index!, value.quantity)) return editUnavailable()
    entries.value[index!] = { ...value, markerId: previous.markerId }
  } else {
    if (previous && !amendEntry(index!, 0)) return editUnavailable()
    const result = add.addAt(spot.value, [{ itemId: item.id, quantity: value.quantity, note: value.note }], { batchId })
    const marker = result?.markers[0]
    if (!result || !marker) {
      error.value = 'Select a run and map before adding.'
      return false
    }
    batchId = result.batchId
    const entry = { ...value, markerId: marker.id }
    if (index === null) entries.value.push(entry)
    else entries.value[index] = entry
  }
  discardDraft()
  return true
}

function editUnavailable() {
  error.value = 'This entry was undone. Discard the draft and add it again.'
  return false
}

function discardDraft() {
  text.value = ''
  error.value = ''
  selected.value = 0
  editing.value = null
  focus()
}

function removeEdited() {
  if (editing.value === null || !amendEntry(editing.value, 0)) return
  entries.value.splice(editing.value, 1)
  if (!entries.value.length) batchId = undefined
  discardDraft()
}

function editLast() {
  const last = entries.value.at(-1)
  if (!last) {
    error.value = 'No entry in this visit to edit.'
    return
  }
  editing.value = entries.value.length - 1
  text.value = `${last.quantity} ${last.item.name}${last.note ? ` # ${last.note}` : ''}`
  focus()
}

function repeatAndFinish() {
  const item = add.lastItem.value
  if (!item) {
    error.value = 'Add an item first to use repeat.'
    return
  }
  if (commit(item)) finish()
}

function openSelected() {
  const ids = new Set([ui.selectedMarkerId.value, ...(ui.selectedGroupIds.value ?? [])])
  const markers = game.currentMapMarkers.value.filter((marker) => ids.has(marker.id))
  if (!markers.length) return false
  const pos = {
    x: markers.reduce((sum, marker) => sum + marker.x, 0) / markers.length,
    y: markers.reduce((sum, marker) => sum + marker.y, 0) / markers.length,
  }
  open({ pos, client: seam.mapView.value?.toClient(pos) ?? { x: 0, y: 0 }, source: 'key' })
  return true
}

function onKey(event: KeyboardEvent) {
  if (event.isComposing || event.defaultPrevented) return
  const target = event.target as HTMLElement | null
  const otherControl = target !== line.value && target?.closest('input,textarea,select,button,[role="dialog"],[contenteditable="true"]')
  if (!spot.value) {
    if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey && !event.altKey && !otherControl && openSelected()) event.preventDefault()
    return
  }
  if (otherControl) return
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
    event.preventDefault()
    const count = add.undo(batchId)
    entries.value = []
    batchId = undefined
    editing.value = null
    if (spot.value) before.value = add.markersAt(spot.value).map((marker) => ({ ...marker }))
    seam.announce(count ? 'Undone' : 'Nothing to undo')
    focus()
    return
  }
  const quickPick = event.code.match(/^Digit([1-6])$/)?.[1]
  if (event.altKey && !event.ctrlKey && !event.metaKey && empty.value && quickPick) {
    event.preventDefault()
    if (!event.repeat) commit(results.value[Number(quickPick) - 1])
    return
  }
  if (event.ctrlKey || event.metaKey || event.altKey) return
  if (event.key === 'Escape') {
    event.preventDefault()
    requestClose()
    return
  }
  // Leaflet keeps focus after a drag. Route ordinary typing back into the note.
  if (event.target !== line.value) {
    const mapTarget = target === document.body || target === document.documentElement || target?.closest('.leaflet-container')
    if (!mapTarget) return
    if (event.key.length === 1 && !(empty.value && event.key === ' ')) {
      event.preventDefault()
      text.value += event.key
      focus()
      return
    }
    focus()
  }
  if (event.key === ' ' && empty.value && editing.value === null) {
    event.preventDefault()
    if (!event.repeat) repeatAndFinish()
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    selected.value = (selected.value + (event.key === 'ArrowDown' ? 1 : -1) + results.value.length) % Math.max(1, results.value.length)
  } else if (event.key === 'Enter' || event.key === ',' && !parsed.value.note) {
    event.preventDefault()
    if (event.repeat) return
    if (empty.value && editing.value === null) finish()
    else if (results.value.length) commit()
    else error.value = 'No matching item. Change the name or discard the draft.'
  } else if (event.key === 'Tab' && !event.shiftKey) {
    event.preventDefault()
    const item = results.value[selected.value]
    if (!empty.value && item && parsed.value.query) {
      text.value = `${parsed.value.quantity > 1 ? `${parsed.value.quantity} ` : ''}${item.name}${parsed.value.note ? ` # ${parsed.value.note}` : ''}`
    } else if (entries.value.length) {
      editLast()
      if (!text.value.includes(' # ')) text.value += ' # '
    } else {
      error.value = 'Type an item first, then # and its note.'
    }
  } else if (event.key === 'Backspace' && empty.value) {
    event.preventDefault()
    editLast()
  }
}

watch(text, () => {
  selected.value = 0
  if (!text.value.trim()) editing.value = null
})
watch(seam.notice, (notice) => {
  if (notice?.text !== 'Undone' && notice?.text !== 'Nothing to undo') return
  entries.value = []
  batchId = undefined
  editing.value = null
})
watch(contextKey, (_key, previousKey) => {
  if (!spot.value) return
  if (!empty.value) {
    drafts.set(previousKey, {
      spot: { ...spot.value },
      text: text.value,
      before: before.value,
      entries: [...entries.value],
      batchId,
      editing: editing.value,
    })
  }
  finish()
})
watch(plate, (element) => {
  observer?.disconnect()
  if (element) observer?.observe(element)
})
onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    if (entry) height.value = entry.target.getBoundingClientRect().height
  })
  unregister = seam.register({
    start,
    request: open,
    interceptClick: () => {
      if (!spot.value) return false
      if (guardDraft()) return true
      finish()
      return false
    },
    interceptTileClick: (_tile, req) => {
      if (!spot.value) return false
      open(req)
      return true
    },
  })
  window.addEventListener('keydown', onKey, true)
  window.addEventListener('focus', focus)
})
onBeforeUnmount(() => {
  finish()
  unregister?.()
  observer?.disconnect()
  window.removeEventListener('keydown', onKey, true)
  window.removeEventListener('focus', focus)
})
</script>

<style scoped>
.field-note {
  overflow-y: auto;
  caret-color: var(--primary);
  box-shadow: 0 8px 28px oklch(0.1 0.02 258 / 0.6);
  transition: border-color 180ms ease;
}
.field-control {
  border-radius: var(--radius-md);
}
.field-control:hover { background: var(--accent); }
.field-control:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.field-note::selection, .field-note :deep(::selection) {
  background: var(--primary);
  color: var(--primary-foreground);
}
.field-pin { transform: translate(-50%, -50%); }
@media (prefers-reduced-motion: reduce) {
  .field-note { transition: none; }
}
</style>
