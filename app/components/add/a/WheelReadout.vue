<template>
  <div
    class="wheel-readout surface-rail flex w-[19.5rem] flex-col gap-2 rounded-xl border border-border p-3 shadow-[0_8px_28px_oklch(0.1_0.02_258/0.6)]"
    @wheel="(e: WheelEvent) => emit('wheel', e)"
  >
    <!-- Where: the place, the pile you joined, or a fresh spot -->
    <div class="flex min-w-0 items-center gap-2">
      <span v-if="place.kind === 'poi'" class="size-[7px] shrink-0 rounded-full bg-place" aria-hidden="true" />
      <MapPinIcon v-else class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span class="hud-label min-w-0 flex-1 truncate">{{ place.name }}</span>
      <span v-if="crumb" class="hud-label shrink-0 text-muted-foreground">{{ crumb }}</span>
      <span v-else-if="here.length" class="hud-label tabular shrink-0 text-muted-foreground">
        {{ here.length }} here<template v-if="lootedCount"> · {{ lootedCount }} looted</template>
      </span>
    </div>

    <!-- Everything at this spot: what was there (washed out if looted) and what this wheel added (solid ring) -->
    <template v-if="here.length">
      <ul class="flex flex-wrap gap-1.5" aria-label="At this spot">
        <li
          v-for="t in shownHere"
          :key="t.id"
          class="wheel-mini"
          :class="{ 'wheel-mini--new': t.touched, 'wheel-mini--last': t.last, 'wheel-mini--looted': t.looted }"
          :title="t.label"
        >
          <img v-if="t.icon" :src="t.icon" alt="" class="wheel-mini__img" draggable="false">
          <PackageIcon v-else class="size-3.5 text-muted-foreground" />
          <span v-if="t.quantity > 1 && !t.looted" class="wheel-mini__qty tabular" aria-hidden="true">{{ t.quantity }}</span>
          <span v-if="t.looted" class="wheel-mini__tick" aria-hidden="true"><CheckIcon class="size-2" :stroke-width="4" /></span>
          <span class="sr-only">{{ t.label }}</span>
        </li>
        <li v-if="overflow" class="hud-label tabular self-center pl-0.5 text-muted-foreground">+{{ overflow }}</li>
      </ul>
      <p v-if="!hasPicks" class="line-clamp-2 text-xs leading-4 text-muted-foreground">
        Already here: {{ hereSummary }}
      </p>
    </template>

    <!-- The one line that matters right now -->
    <div class="flex h-10 min-w-0 items-center gap-2.5 rounded-lg bg-background/60 px-2.5">
      <template v-if="stage === 'search'">
        <SearchIcon class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          ref="inputRef"
          :value="query"
          class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          placeholder="Search all items"
          aria-label="Search all items. Add x and a number for a quantity, # and text for a note"
          autocomplete="off"
          spellcheck="false"
          @input="emit('update:query', ($event.target as HTMLInputElement).value)"
        >
        <span class="tabular shrink-0 text-xs text-muted-foreground" aria-live="polite">{{ resultCount ? `${resultCount} found` : 'None' }}</span>
      </template>

      <template v-else-if="stage === 'note'">
        <PencilLineIcon class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          ref="inputRef"
          :value="note"
          class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          :placeholder="last ? `Note for ${last.name}` : 'Note'"
          :aria-label="last ? `Note for ${last.name}` : 'Note'"
          maxlength="200"
          autocomplete="off"
          @input="emit('update:note', ($event.target as HTMLInputElement).value)"
        >
      </template>

      <template v-else-if="stage === 'qty' && last">
        <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ last.name }}</span>
        <label class="wheel-qty-field">
          <span aria-hidden="true">×</span>
          <input
            ref="inputRef"
            :value="qtyDraft"
            class="w-10 bg-transparent text-right outline-none tabular"
            inputmode="numeric"
            maxlength="3"
            :aria-label="`Quantity of ${last.name}`"
            autocomplete="off"
            @input="onQtyInput"
          >
        </label>
      </template>

      <template v-else-if="hover">
        <img v-if="hover.icon" :src="hover.icon" alt="" class="size-6 shrink-0 object-contain" draggable="false">
        <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ hover.name }}</span>
        <span v-if="hover.here" class="tabular shrink-0 text-xs text-loot">{{ hover.here }} here</span>
      </template>

      <template v-else-if="last">
        <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ last.name }}</span>
        <button type="button" class="wheel-step" :aria-label="`Note for ${last.name}`" title="Note (Tab)" @click="emit('note')">
          <PencilLineIcon class="size-3.5" />
        </button>
        <button type="button" class="wheel-step" aria-label="One fewer" title="One fewer (−)" :disabled="last.quantity <= 1" @click="emit('qty', -1)">
          <MinusIcon class="size-3.5" />
        </button>
        <button
          type="button"
          class="wheel-qty tabular"
          :class="{ 'wheel-qty--typing': qtyTyping }"
          :aria-label="`Quantity ${last.quantity}, change`"
          title="Type a quantity (x)"
          @click="emit('qty-open')"
        >×{{ last.quantity }}</button>
        <button type="button" class="wheel-step" aria-label="One more" title="One more (+)" @click="emit('qty', 1)">
          <PlusIcon class="size-3.5" />
        </button>
      </template>

      <span v-else class="text-sm text-muted-foreground">{{ stage === 'items' ? 'Pick an item' : 'Pick a group, or type a name' }}</span>
    </div>

    <!-- Right after a pick: how to change its quantity, in words -->
    <p v-if="last && (stage === 'groups' || stage === 'qty') && !hover" class="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] leading-4 text-muted-foreground">
      <template v-if="stage === 'qty'">
        Type the number, <kbd class="wheel-kbd">⏎</kbd> to keep it, <kbd class="wheel-kbd">Esc</kbd> to cancel
      </template>
      <template v-else>
        <span>Quantity:</span>
        <span class="inline-flex items-center gap-0.5"><kbd class="wheel-kbd">x</kbd><kbd class="wheel-kbd">12</kbd><kbd class="wheel-kbd">⏎</kbd></span>
        <span>or</span>
        <span class="inline-flex items-center gap-0.5"><kbd class="wheel-kbd">⇧</kbd><kbd class="wheel-kbd">12</kbd></span>
        <span class="inline-flex items-center gap-0.5"><kbd class="wheel-kbd">+</kbd><kbd class="wheel-kbd">−</kbd></span>
        <span>scroll</span>
      </template>
    </p>

    <!-- Actions -->
    <div class="flex items-center gap-1.5">
      <template v-if="stage === 'items' || stage === 'search'">
        <button type="button" class="wheel-action shrink-0 pl-1.5" title="Back to the groups (Esc)" @click="emit('back')">
          <ChevronLeftIcon class="size-4" /> Groups <kbd class="wheel-kbd">Esc</kbd>
        </button>
        <button
          v-if="stage === 'items' && pages && pages.pages > 1"
          type="button"
          class="wheel-action shrink-0"
          title="Next page of this group (9)"
          @click="emit('more')"
        >
          More <span class="tabular text-muted-foreground">{{ pages.page + 1 }}/{{ pages.pages }}</span>
          <kbd class="wheel-kbd">9</kbd>
        </button>
        <span class="flex-1" />
      </template>
      <button
        v-else-if="again"
        type="button"
        class="wheel-action min-w-0 flex-1"
        :title="`Add one more ${again.name} here (Space)`"
        @click="emit('again')"
      >
        <kbd class="wheel-kbd">Space</kbd>
        <span class="shrink-0 text-muted-foreground">Again</span>
        <img v-if="again.icon" :src="again.icon" alt="" class="size-4 shrink-0 object-contain" draggable="false">
        <span class="truncate">{{ again.name }}</span>
      </button>
      <span v-else class="flex-1" />
      <button type="button" class="wheel-action shrink-0" title="Close the wheel (Enter)" @click="emit('done')">
        {{ hasPicks ? 'Done' : 'Close' }} <kbd v-if="stage !== 'search'" class="wheel-kbd">⏎</kbd>
      </button>
    </div>

    <!-- What the keys do here -->
    <p class="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] leading-4 text-muted-foreground">
      <span v-for="h in hints" :key="h.label" class="inline-flex items-center gap-1">
        <kbd v-for="k in h.keys" :key="k" class="wheel-kbd">{{ k }}</kbd>{{ h.label }}
      </span>
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { CheckIcon, ChevronLeftIcon, MapPinIcon, MinusIcon, PackageIcon, PencilLineIcon, PlusIcon, SearchIcon } from '@lucide/vue'
import type { Stage } from './wheel'

/** The plate under (or over) the wheel: where, what's here, the live line, and the keys. */

export interface HereTile {
  id: string
  name: string
  icon?: string | null
  quantity: number
  looted: boolean
  /** This wheel created or stacked onto it */
  touched: boolean
  /** The last pick landed here */
  last: boolean
  label: string
}

const props = defineProps<{
  stage: Stage
  place: { name: string; kind: 'poi' | 'pile' | 'new' }
  /** Every marker at the spot, unlooted first */
  here: HereTile[]
  /** "FIRE" while a group is showing */
  crumb: string | null
  hasPicks: boolean
  last: { name: string; quantity: number } | null
  hover: { name: string; icon?: string | null; here?: number } | null
  again: { name: string; icon?: string | null } | null
  query: string
  note: string
  qtyDraft: string
  resultCount: number
  /** Shift+digits are being typed into the quantity */
  qtyTyping: boolean
  /** Paging through a group's items */
  pages: { page: number; pages: number } | null
}>()

const emit = defineEmits<{
  'update:query': [value: string]
  'update:note': [value: string]
  'update:qtyDraft': [value: string]
  qty: [delta: number]
  'qty-open': []
  note: []
  again: []
  done: []
  back: []
  more: []
  wheel: [e: WheelEvent]
}>()

const MAX_TILES = 18
const shownHere = computed(() => props.here.slice(0, MAX_TILES))
const overflow = computed(() => Math.max(0, props.here.length - MAX_TILES))
const lootedCount = computed(() => props.here.filter((t) => t.looted).length)

/** "Wood Matches ×12, Pinnacle Peaches ×3 and 6 more (2 looted)" */
const hereSummary = computed(() => {
  const left = props.here.filter((t) => !t.looted)
  const named = left.slice(0, 3).map((t) => (t.quantity > 1 ? `${t.name} ×${t.quantity}` : t.name))
  const rest = left.length - named.length
  const list = !named.length ? 'only looted items' : rest > 0 ? `${named.join(', ')} and ${rest} more` : named.join(', ')
  return lootedCount.value && named.length ? `${list} (${lootedCount.value} looted)` : list
})

const hints = computed<{ keys: string[]; label: string }[]>(() => {
  switch (props.stage) {
    case 'items':
      return [{ keys: ['1–8'], label: 'add' }, { keys: ['9'], label: 'more' }, { keys: ['←', '→'], label: 'move' }]
    case 'search':
      return [{ keys: ['1–8', '⏎'], label: 'add' }, { keys: ['x12'], label: 'qty' }, { keys: ['#'], label: 'note' }]
    case 'note':
      return [{ keys: ['⏎'], label: 'save & done' }, { keys: ['Tab'], label: 'save' }, { keys: ['Esc'], label: 'cancel' }]
    case 'qty':
      return []
    default:
      return props.hasPicks
        ? [{ keys: ['⌫'], label: 'take back' }, { keys: ['Tab'], label: 'note' }, { keys: ['⏎'], label: 'done' }]
        : [{ keys: ['1–8'], label: 'group' }, { keys: ['a–z'], label: 'search' }, { keys: ['←', '→'], label: 'move' }, { keys: ['Esc'], label: 'close' }]
  }
})

function onQtyInput(e: Event) {
  const el = e.target as HTMLInputElement
  const digits = el.value.replace(/\D/g, '').slice(0, 3)
  if (digits !== el.value) el.value = digits
  emit('update:qtyDraft', digits)
}

const inputRef = ref<HTMLInputElement | null>(null)

/** Focus the search/note/quantity line once it exists, caret at the end (quantity: all selected). */
async function focusInput() {
  await nextTick()
  const el = inputRef.value
  if (!el) return
  el.focus({ preventScroll: true })
  if (props.stage === 'qty') el.select()
  else el.setSelectionRange(el.value.length, el.value.length)
}

/** Put focus back in the line right away, so the key being pressed lands in it. */
function focusInputNow() {
  inputRef.value?.focus({ preventScroll: true })
}

defineExpose({ focusInput, focusInputNow })
</script>

<style scoped>
.wheel-mini {
  position: relative;
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border-radius: 7px;
  background: oklch(0.22 0.03 258);
  border: 1.5px solid oklch(0.82 0.105 58 / 0.45);
}

.wheel-mini__img {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

/* Added in this wheel: the full apricot ring of loot you just logged */
.wheel-mini--new {
  border-color: var(--loot);
}

.wheel-mini--last {
  animation: wheel-drop 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* Looted: the map's wash-out, small */
.wheel-mini--looted {
  background: transparent;
  border-color: oklch(0.33 0.03 258 / 0.6);
}

.wheel-mini--looted .wheel-mini__img {
  opacity: 0.55;
  filter: grayscale(1) contrast(0.85);
}

.wheel-mini__tick {
  position: absolute;
  right: -5px;
  bottom: -5px;
  display: grid;
  width: 12px;
  height: 12px;
  place-items: center;
  border-radius: 50%;
  background: var(--looted);
  color: oklch(0.22 0.03 258);
  box-shadow: 0 0 0 1.5px oklch(0.16 0.03 258);
}

.wheel-qty-field {
  display: inline-flex;
  height: 26px;
  align-items: center;
  gap: 2px;
  padding: 0 8px;
  border-radius: 13px;
  background: var(--background);
  color: var(--foreground);
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 0 0 1.5px var(--loot);
}

.wheel-mini__qty {
  position: absolute;
  top: -6px;
  right: -7px;
  min-width: 15px;
  height: 15px;
  padding: 0 3px;
  border-radius: 8px;
  background: var(--loot);
  color: var(--primary-foreground);
  font-size: 9.5px;
  font-weight: 750;
  line-height: 15px;
  text-align: center;
  box-shadow: 0 0 0 1.5px oklch(0.16 0.03 258);
}

.wheel-qty {
  cursor: text;
  min-width: 38px;
  height: 22px;
  padding: 0 6px;
  border-radius: 11px;
  background: var(--loot);
  color: var(--primary-foreground);
  font-size: 12px;
  font-weight: 750;
  line-height: 22px;
  text-align: center;
}

/* Typing a quantity: the pill shows the caret's colour as a keyline */
.wheel-qty--typing {
  box-shadow: 0 0 0 2px var(--background), 0 0 0 3.5px var(--loot);
}

.wheel-step {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 6px;
  color: var(--muted-foreground);
  transition: background-color 150ms ease, color 150ms ease;
}

.wheel-step:hover:not(:disabled) {
  background: var(--accent);
  color: var(--foreground);
}

.wheel-step:disabled {
  opacity: 0.4;
}

.wheel-action {
  display: inline-flex;
  height: 32px;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 13px;
  transition: background-color 150ms ease, border-color 150ms ease;
}

.wheel-action:hover {
  background: var(--accent);
}

.wheel-kbd {
  display: inline-grid;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  place-items: center;
  border-radius: 4px;
  background: oklch(0.27 0.03 258);
  color: var(--muted-foreground);
  font-family: inherit;
  font-size: 10px;
  font-weight: 650;
  line-height: 1;
}

@keyframes wheel-drop {
  from {
    transform: scale(1.25);
  }
}

@media (prefers-reduced-motion: reduce) {
  .wheel-mini--last {
    animation: none;
  }
}
</style>
