<template>
  <div
    class="wheel-readout surface-rail flex w-[19.5rem] flex-col gap-2 rounded-xl border border-border p-3 shadow-[0_8px_28px_oklch(0.1_0.02_258/0.6)]"
    @wheel="onWheel"
  >
    <!-- Where: the place, the pile you joined, or a fresh spot -->
    <div class="flex min-w-0 items-center gap-2">
      <span v-if="place.kind === 'poi'" class="size-[7px] shrink-0 rounded-full bg-place" aria-hidden="true" />
      <MapPinIcon v-else class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span class="hud-label min-w-0 flex-1 truncate">{{ place.name }}</span>
      <span v-if="crumb" class="hud-label shrink-0 text-muted-foreground">{{ crumb }}</span>
      <span v-else-if="hereCount" class="hud-label tabular shrink-0 text-muted-foreground">{{ hereCount }} here</span>
    </div>

    <!-- This wheel's tally: one mini tile per item, newest ringed -->
    <ol v-if="picks.length" class="flex flex-wrap gap-1.5" aria-label="Added in this wheel">
      <li
        v-for="(p, i) in shownPicks"
        :key="p.key"
        class="wheel-mini"
        :class="{ 'wheel-mini--last': i === shownPicks.length - 1 && !overflow }"
        :title="p.quantity > 1 ? `${p.name} ×${p.quantity}` : p.name"
      >
        <img v-if="p.icon" :src="p.icon" alt="" class="size-[18px] object-contain" draggable="false">
        <PackageIcon v-else class="size-3.5 text-muted-foreground" />
        <span v-if="p.quantity > 1" class="wheel-mini__qty tabular">{{ p.quantity }}</span>
        <span class="sr-only">{{ p.name }}{{ p.quantity > 1 ? ` ×${p.quantity}` : '' }}</span>
      </li>
      <li v-if="overflow" class="hud-label tabular self-center pl-0.5 text-muted-foreground">+{{ overflow }}</li>
    </ol>

    <!-- The one line that matters right now -->
    <div class="flex h-10 min-w-0 items-center gap-2.5 rounded-lg bg-background/60 px-2.5">
      <template v-if="stage === 'search'">
        <SearchIcon class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          ref="inputRef"
          :value="query"
          class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          placeholder="Search all items"
          aria-label="Search all items"
          autocomplete="off"
          spellcheck="false"
          @input="emit('update:query', ($event.target as HTMLInputElement).value)"
        >
        <span class="tabular shrink-0 text-xs text-muted-foreground">{{ resultCount ? `${resultCount} found` : 'None' }}</span>
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

      <template v-else-if="hover">
        <img v-if="hover.icon" :src="hover.icon" alt="" class="size-6 shrink-0 object-contain" draggable="false">
        <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ hover.name }}</span>
        <span v-if="hover.here" class="tabular shrink-0 text-xs text-loot">{{ hover.here }} here</span>
      </template>

      <template v-else-if="last">
        <span class="wheel-mini wheel-mini--last shrink-0" aria-hidden="true">
          <img v-if="last.icon" :src="last.icon" alt="" class="size-[18px] object-contain" draggable="false">
          <PackageIcon v-else class="size-3.5 text-muted-foreground" />
        </span>
        <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ last.name }}</span>
        <button type="button" class="wheel-step" aria-label="One fewer" title="One fewer (−)" :disabled="last.quantity <= 1" @click="emit('qty', -1)">
          <MinusIcon class="size-3.5" />
        </button>
        <span
          class="wheel-qty tabular"
          :class="{ 'wheel-qty--typing': qtyTyping }"
          aria-live="polite"
          :aria-label="`Quantity ${last.quantity}`"
        >×{{ last.quantity }}</span>
        <button type="button" class="wheel-step" aria-label="One more" title="One more (+)" @click="emit('qty', 1)">
          <PlusIcon class="size-3.5" />
        </button>
      </template>

      <span v-else class="text-sm text-muted-foreground">{{ stage === 'items' ? 'Pick an item' : 'Pick a group, or type a name' }}</span>
    </div>

    <!-- Actions: back and more inside a group; same again elsewhere; done -->
    <div class="flex items-center gap-1.5">
      <template v-if="stage === 'items'">
        <button type="button" class="wheel-action shrink-0 pl-1.5" title="Back to the groups (Esc, or right-click the wheel)" @click="emit('back')">
          <ChevronLeftIcon class="size-4" /> Groups
        </button>
        <button
          v-if="pages && pages.pages > 1"
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
        {{ picks.length ? 'Done' : 'Close' }} <kbd class="wheel-kbd">{{ stage === 'search' ? 'Esc' : '⏎' }}</kbd>
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
import { ChevronLeftIcon, MapPinIcon, MinusIcon, PackageIcon, PencilLineIcon, PlusIcon, SearchIcon } from '@lucide/vue'
import type { Stage } from './wheel'

/** The plate under (or over) the wheel: where, what you added, the live line, and the keys. */

interface Shown { key: string; name: string; icon?: string | null; quantity: number }

const props = defineProps<{
  stage: Stage
  place: { name: string; kind: 'poi' | 'pile' | 'new' }
  hereCount: number
  /** "FIRE · 2/3" while a group or search is showing */
  crumb: string | null
  picks: Shown[]
  last: Shown | null
  hover: { name: string; icon?: string | null; here?: number } | null
  again: { name: string; icon?: string | null } | null
  query: string
  note: string
  resultCount: number
  /** Shift+digits are being typed into the quantity */
  qtyTyping: boolean
  /** Paging through a group's items */
  pages: { page: number; pages: number } | null
}>()

const emit = defineEmits<{
  'update:query': [value: string]
  'update:note': [value: string]
  qty: [delta: number]
  again: []
  done: []
  back: []
  more: []
  wheel: [e: WheelEvent]
}>()

const MAX_TILES = 9
const shownPicks = computed(() => props.picks.slice(-MAX_TILES))
const overflow = computed(() => Math.max(0, props.picks.length - MAX_TILES))

const hints = computed<{ keys: string[]; label: string }[]>(() => {
  switch (props.stage) {
    case 'items':
      return [{ keys: ['1–8'], label: 'add' }, { keys: ['9'], label: 'more' }, { keys: ['Esc'], label: 'back' }]
    case 'search':
      return [{ keys: ['1–8', '⏎'], label: 'add' }, { keys: ['Esc'], label: 'back' }]
    case 'note':
      return [{ keys: ['⏎'], label: 'save & done' }, { keys: ['Tab'], label: 'save' }, { keys: ['Esc'], label: 'cancel' }]
    default:
      return props.picks.length
        ? [{ keys: ['⇧', '1–9'], label: 'quantity' }, { keys: ['⌫'], label: 'take back' }, { keys: ['Tab'], label: 'note' }]
        : [{ keys: ['1–8'], label: 'group' }, { keys: ['a–z'], label: 'search' }, { keys: ['Esc'], label: 'close' }]
  }
})

const inputRef = ref<HTMLInputElement | null>(null)

/** Focus the search/note line once it exists, caret at the end. */
async function focusInput() {
  await nextTick()
  const el = inputRef.value
  if (!el) return
  el.focus({ preventScroll: true })
  el.setSelectionRange(el.value.length, el.value.length)
}

function onWheel(e: WheelEvent) {
  emit('wheel', e)
}

defineExpose({ focusInput })
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

.wheel-mini--last {
  border-color: var(--loot);
  animation: wheel-drop 200ms cubic-bezier(0.16, 1, 0.3, 1);
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
