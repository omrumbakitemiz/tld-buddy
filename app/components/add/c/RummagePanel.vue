<template>
  <Transition name="rummage">
    <section
      v-if="r.session.value"
      ref="panelRef"
      :class="cn('surface-rail pointer-events-auto absolute bottom-3 right-[3.75rem] top-3 z-[570] flex flex-col overflow-hidden rounded-xl border border-border shadow-[0_8px_28px_oklch(0.1_0.02_258/0.6)] transition-[width] duration-200', r.compact.value ? 'w-[16.5rem]' : 'w-[21rem]')"
      aria-label="Log loot at this spot"
      data-rummage="session"
    >
      <header class="flex items-start gap-2 px-3.5 pb-2.5 pt-3">
        <div class="min-w-0 flex-1">
          <h2 class="rummage-plate" :title="r.session.value.name">
            <span :class="cn('size-[7px] shrink-0 rounded-full', r.session.value.spot.poiId ? 'bg-place' : 'border border-muted-foreground')" aria-hidden="true" />
            <span class="truncate">{{ r.session.value.name }}</span>
          </h2>
          <p class="tabular mt-1.5 truncate text-xs text-muted-foreground">
            <template v-if="r.session.value.kind && !r.compact.value">{{ r.session.value.kind }} · </template>{{ summary }}
          </p>
        </div>
        <Button
          v-if="r.session.value.spot.poiId && !r.compact.value"
          size="icon"
          variant="ghost"
          class="-mt-1 size-8 shrink-0 text-muted-foreground"
          aria-label="Open this place in the Places tab"
          title="Open in Places (stash, details)"
          @click="(e: MouseEvent) => { ui.selectPOI(r.session.value!.spot.poiId ?? null); pointerFocus(e) }"
        >
          <ExternalLinkIcon class="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          class="-mr-1.5 -mt-1 size-8 shrink-0 text-muted-foreground"
          :aria-label="r.compact.value ? 'Show the full panel' : 'Make the panel compact'"
          :aria-pressed="r.compact.value"
          :title="r.compact.value ? 'Full panel' : 'Compact panel (more map)'"
          @click="(e: MouseEvent) => { r.compact.value = !r.compact.value; pointerFocus(e) }"
        >
          <ChevronsLeftIcon v-if="r.compact.value" class="size-4" />
          <ChevronsRightIcon v-else class="size-4" />
        </Button>
      </header>

      <div class="px-3">
        <div class="relative">
          <SearchIcon class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref="inputRef"
            v-model="r.query.value"
            type="text"
            role="combobox"
            aria-label="Find an item"
            aria-controls="rummage-grid"
            aria-expanded="true"
            :aria-activedescendant="activeId"
            autocomplete="off"
            spellcheck="false"
            placeholder="Find an item, e.g. peaches 3"
            class="rummage-input"
            @input="r.onQueryChange"
            @keydown="onKey"
          >
          <button
            v-if="r.query.value"
            type="button"
            class="absolute right-1.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
            tabindex="-1"
            @click="clearQuery"
          >
            <XIcon class="size-3.5" />
          </button>
        </div>
      </div>

      <!-- The item the keys act on: fixed height so nothing below it moves -->
      <div class="mx-3 mt-2 flex h-12 items-center gap-2 rounded-lg bg-background/50 pl-2.5 pr-1" aria-live="polite">
        <template v-if="r.targetItem.value && !r.flash.value">
          <img v-if="r.targetItem.value.icon" :src="r.targetItem.value.icon" alt="" class="size-6 shrink-0 object-contain">
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium leading-tight">{{ r.targetItem.value.name }}</span>
            <span :class="cn('block truncate text-[11px] leading-tight', armedHere ? 'text-primary' : 'text-muted-foreground')">
              {{ armedHere ? 'type a number for how many' : 'at this spot' }}
            </span>
          </span>
          <button type="button" tabindex="-1" class="rummage-step" :aria-label="`One less ${r.targetItem.value.name}`" @mousedown.prevent @click="act(() => r.dec(r.targetItem.value!))">
            <MinusIcon class="size-3.5" />
          </button>
          <span :class="cn('tabular w-11 text-center text-base font-semibold', targetCount ? 'text-primary' : 'text-muted-foreground')">
            {{ targetCount ? `×${targetCount}` : 'none' }}
          </span>
          <button type="button" tabindex="-1" class="rummage-step" :aria-label="`One more ${r.targetItem.value.name}`" @mousedown.prevent @click="act(() => r.tick(r.targetItem.value!))">
            <PlusIcon class="size-3.5" />
          </button>
        </template>
        <p v-else-if="r.flash.value" class="text-xs text-warning">{{ r.flash.value }}</p>
        <p v-else class="text-xs leading-snug text-muted-foreground">Tick what you found. Right after a tick, type a number for how many.</p>
      </div>

      <!-- Right under the strip so Tab from the search line lands here: the note is for what you just ticked -->
      <div class="px-3 pt-2">
        <input
          ref="noteRef"
          v-model="note"
          type="text"
          :disabled="!r.noteMarker.value"
          :placeholder="r.noteMarker.value ? `Note for ${r.noteMarker.value.name}, e.g. car trunk` : 'Tick an item to add a note to it'"
          aria-label="Note for the item you just ticked"
          class="rummage-input rummage-input--note"
          @blur="saveNote"
          @keydown.enter.prevent="commitNote"
          @keydown.esc.stop.prevent="commitNote"
        >
      </div>

      <div class="max-h-[52%] shrink-0 overflow-y-auto px-3 pb-3 pt-3" data-rummage="grid-scroll">
        <h3 class="hud-label mb-1.5 flex items-baseline justify-between text-muted-foreground">
          <span>{{ r.searching.value ? 'Matches' : 'Likely here' }}</span>
          <span v-if="r.searching.value && r.parsed.value.quantity > 1" class="tabular text-primary">adds ×{{ r.parsed.value.quantity }}</span>
          <span v-else-if="r.searching.value && r.parsed.value.note" class="max-w-[60%] truncate normal-case tracking-normal">note: {{ r.parsed.value.note }}</span>
        </h3>
        <div v-if="r.view.value.length" id="rummage-grid" role="listbox" aria-label="Items" :class="cn('grid gap-x-1 gap-y-1.5', r.compact.value ? 'grid-cols-4' : 'grid-cols-5')">
          <RummageTile
            v-for="(item, i) in r.view.value"
            :id="`rummage-tile-${item.id}`"
            :key="item.id"
            :item="item"
            :count="r.stateOf(item.id).count"
            :looted="r.stateOf(item.id).looted"
            :active="r.cursor.value === i"
            :enter="r.searching.value && i === (r.cursor.value ?? 0)"
            @tick="act(() => r.tick(item))"
            @dec="act(() => r.dec(item))"
          />
        </div>
        <p v-else class="py-6 text-center text-sm text-muted-foreground">No item matches “{{ r.parsed.value.query }}”.</p>
      </div>

      <section class="min-h-24 flex-1 overflow-y-auto border-t border-border px-3 pb-2 pt-2.5" aria-label="Already on this spot" data-rummage="tray">
        <h3 class="hud-label mb-1 flex items-baseline justify-between text-muted-foreground">
          <span>On this spot</span>
          <span class="tabular">{{ r.trayRows.value.length }}</span>
        </h3>
        <ul v-if="r.trayRows.value.length" class="space-y-px">
          <li
            v-for="m in r.trayRows.value"
            :key="m.id"
            :class="cn('flex items-center gap-2 rounded-md py-0.5 pl-1 pr-0.5', m.lootedAt && 'text-muted-foreground')"
          >
            <img
              v-if="getItemById(m.itemId)?.icon"
              :src="getItemById(m.itemId)!.icon!"
              alt=""
              :class="cn('size-6 shrink-0 object-contain', m.lootedAt && 'opacity-55 grayscale')"
            >
            <PackageIcon v-else class="size-5 shrink-0 text-muted-foreground" />
            <button
              type="button"
              class="min-w-0 flex-1 truncate rounded text-left text-sm hover:text-primary"
              :title="m.note ? `${m.name}: ${m.note}` : `Show ${m.name} on the map`"
              @click="(e: MouseEvent) => { ui.selectMarker(m.id); pointerFocus(e) }"
            >
              {{ m.name }}<span v-if="m.note" class="text-muted-foreground"> · {{ m.note }}</span>
            </button>
            <span v-if="m.quantity > 1" class="tabular text-xs">×{{ m.quantity }}</span>
            <button
              type="button"
              :class="cn('grid size-7 shrink-0 place-items-center rounded-full border transition-colors', m.lootedAt ? 'border-transparent bg-looted text-[oklch(0.22_0.03_258)]' : 'border-border text-muted-foreground hover:border-looted hover:text-looted')"
              :aria-pressed="!!m.lootedAt"
              :aria-label="m.lootedAt ? `${m.name} is looted. Mark as still here` : `Mark ${m.name} looted`"
              :title="m.lootedAt ? 'Looted: click if it is still there' : 'Mark looted'"
              @click="(e: MouseEvent) => { toggleLooted(m.id); pointerFocus(e) }"
            >
              <CheckIcon class="size-3.5" :stroke-width="3" />
            </button>
          </li>
        </ul>
        <p v-else class="py-1 text-xs text-muted-foreground">Nothing logged here yet.</p>
      </section>

      <footer class="flex items-center gap-2 border-t border-border p-3">
        <p v-if="!r.compact.value" class="flex min-w-0 flex-1 flex-wrap gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
          <span><kbd class="rummage-kbd">↵</kbd> add</span>
          <span><kbd class="rummage-kbd">0–9</kbd> how many</span>
          <span><kbd class="rummage-kbd">−</kbd> less</span>
          <span><kbd class="rummage-kbd">Ctrl Z</kbd> step back</span>
          <span><kbd class="rummage-kbd">Right-click</kbd> move here</span>
        </p>
        <Button size="sm" :class="cn('h-9 px-4', r.compact.value && 'w-full')" @click="act(() => r.close())">
          Done <kbd class="ml-1 text-[10px] opacity-70">Esc</kbd>
        </Button>
      </footer>
    </section>

    <section
      v-else-if="r.picking.value"
      class="surface-rail pointer-events-auto absolute right-[3.75rem] top-3 z-[570] w-[21rem] rounded-xl border border-border p-4 shadow-[0_8px_28px_oklch(0.1_0.02_258/0.6)]"
      aria-label="Choose where to log loot"
      data-rummage="pick"
    >
      <p class="flex items-center gap-2 text-sm font-medium"><CrosshairIcon class="size-4 text-primary" /> Where did you search?</p>
      <p class="mt-1 text-xs text-muted-foreground">Click any spot on the map, or right-click a place plate.</p>
      <div class="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" @click="r.close()">Cancel <kbd class="ml-1 text-[10px] text-muted-foreground">Esc</kbd></Button>
      </div>
    </section>
  </Transition>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { CheckIcon, ChevronsLeftIcon, ChevronsRightIcon, CrosshairIcon, ExternalLinkIcon, MinusIcon, PackageIcon, PlusIcon, SearchIcon, XIcon } from '@lucide/vue'
import { Button } from '~/components/ui/button'
import { useGameData } from '~/composables/useGameData'
import { useUiState } from '~/composables/useUiState'
import { cn } from '~/lib/utils'
import RummageTile from './RummageTile.vue'
import { useRummage } from './useRummage'
import type { CursorKey } from './rummage'

const r = useRummage()
const ui = useUiState()
const { getItemById, toggleLooted } = useGameData()

const panelRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const noteRef = ref<HTMLInputElement | null>(null)
const note = ref('')
/** The marker the note field is editing: the item you just ticked */
const noteFor = ref<string | null>(null)

const armedHere = computed(() => !!r.armed.value && r.armed.value.itemId === r.targetItem.value?.id)
const targetCount = computed(() => (r.targetItem.value ? r.stateOf(r.targetItem.value.id).count : 0))
const activeId = computed(() => {
  const item = r.cursor.value === null ? null : r.view.value[r.cursor.value]
  return item ? `rummage-tile-${item.id}` : undefined
})

const summary = computed(() => {
  const rows = r.trayRows.value
  if (!rows.length) return 'nothing logged here yet'
  const looted = rows.filter((m) => m.lootedAt).length
  return `${rows.length} logged here${looted ? `, ${looted} looted` : ''}`
})

// The note field follows the item you just ticked
watch(() => r.noteMarker.value?.id, () => {
  noteFor.value = r.noteMarker.value?.id ?? null
  note.value = r.noteMarker.value?.note ?? ''
}, { immediate: true })

// Keep the cursor tile in view
watch(activeId, async (id) => {
  if (!id) return
  await nextTick()
  document.getElementById(id)?.scrollIntoView({ block: 'nearest' })
})

function focusSearch() {
  inputRef.value?.focus({ preventScroll: true })
}

function saveNote() {
  r.setNote(noteFor.value, note.value)
}

function commitNote() {
  saveNote()
  focusSearch()
}

/** Mouse actions: keep a half-typed note, do the thing, hand the keyboard back to the search line */
function act(fn: () => void) {
  saveNote()
  fn()
  focusSearch()
}

function clearQuery() {
  r.query.value = ''
  r.onQueryChange()
  focusSearch()
}

/** After a mouse click on a panel button the search line gets the keyboard back; keyboard activation (detail 0) leaves focus where it is */
function pointerFocus(e: MouseEvent) {
  if (e.detail > 0) focusSearch()
}

/** The search line is the keyboard: arrows move over tiles, digits set quantity, Enter adds. */
function onKey(e: KeyboardEvent) {
  if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return
  let empty = !r.query.value
  const k = e.key
  // Digits then a space: they were a search's first word ("3 peaches"), not a quantity (a letter straight after
  // digits just ends the number: `⏎ 12 pin` is 12, then a new search). The DOM value is set directly because the
  // key's own insertion happens before Vue re-renders.
  if (empty && r.typingNumber() && k === ' ' && inputRef.value) {
    inputRef.value.value = r.query.value = r.reclaimDigits()
    empty = false
  }
  if (k === 'Escape') {
    e.preventDefault()
    if (!empty) clearQuery()
    else r.close()
  } else if (k === 'ArrowDown' || k === 'ArrowUp' || ((k === 'ArrowLeft' || k === 'ArrowRight') && empty)) {
    e.preventDefault()
    r.move(k as CursorKey)
  } else if (k === 'Enter') {
    e.preventDefault()
    if (!empty) {
      if (!r.commitQuery()) r.say('No item matches that')
    } else if (!r.again()) r.say('Arrow to an item or type its name first')
  } else if (empty && k === ' ') {
    e.preventDefault()
    r.again()
  } else if (empty && (k === '+' || k === '=')) {
    e.preventDefault()
    r.again()
  } else if (empty && (k === '-' || k === 'Delete')) {
    e.preventDefault()
    if (r.targetItem.value) r.dec(r.targetItem.value)
  } else if (empty && /^[0-9]$/.test(k) && r.armed.value) {
    e.preventDefault()
    r.digit(k)
    return
  }
  r.endNumber()
}

defineExpose({ focusSearch, inputRef, noteRef, panelRef })
</script>

<style scoped>
.rummage-plate {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  line-height: 1.25;
}
.rummage-input {
  height: 2.5rem;
  width: 100%;
  border-radius: 6px;
  border: 1px solid var(--input);
  background: oklch(0.2 0.03 258 / 0.7);
  padding: 0 2rem 0 0.75rem;
  font-size: 0.875rem;
  color: var(--foreground);
  outline: none;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}
.rummage-input--note {
  height: 2.25rem;
  font-size: 0.8125rem;
  padding-left: 0.75rem !important;
}
.rummage-input:is(input[role='combobox']) {
  padding-left: 2rem;
}
.rummage-input::placeholder {
  color: var(--muted-foreground);
}
.rummage-input:focus-visible {
  border-color: var(--ring);
  box-shadow: 0 0 0 3px oklch(0.82 0.105 58 / 0.22);
}
.rummage-input:disabled {
  opacity: 0.55;
}
.rummage-step {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: 6px;
  color: var(--muted-foreground);
  transition: background-color 150ms ease, color 150ms ease;
}
.rummage-step:hover {
  background: var(--accent);
  color: var(--foreground);
}
.rummage-kbd {
  border: 1px solid var(--border);
  background: var(--muted);
  border-radius: 4px;
  padding: 0 4px;
  font-family: inherit;
  font-size: 10px;
  color: var(--foreground);
}
.rummage-enter-active,
.rummage-leave-active {
  transition: opacity 200ms ease, transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
}
.rummage-enter-from,
.rummage-leave-to {
  opacity: 0;
  transform: translateX(12px);
}
@media (prefers-reduced-motion: reduce) {
  .rummage-enter-active,
  .rummage-leave-active {
    transition: none;
  }
}
</style>
