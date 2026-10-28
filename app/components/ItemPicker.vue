<template>
  <div class="flex min-h-0 flex-col gap-2">
    <div class="relative">
      <SearchIcon class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref="searchRef"
        v-model="query"
        :placeholder="placeholder"
        class="h-9 pl-8"
        aria-label="Search items"
        @keydown.enter.exact.prevent="onEnter"
        @keydown.down.prevent="focusGrid"
      />
    </div>

    <div class="flex flex-wrap gap-1" role="group" aria-label="Item categories">
      <button
        v-for="cat in itemCategories"
        :key="cat.name"
        type="button"
        :aria-pressed="activeCategories.includes(cat.name)"
        :class="cn(
          'inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs transition-colors',
          activeCategories.includes(cat.name)
            ? 'border-primary/60 bg-primary/15 text-foreground'
            : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
        )"
        @click="toggleCategory(cat.name)"
      >
        {{ cat.name }}
        <span class="tabular text-[10px] opacity-70">{{ cat.count }}</span>
      </button>
    </div>

    <section v-if="frequent.length && !query.trim()" aria-label="Frequently used">
      <h3 class="hud-label mb-1 text-muted-foreground">Used often this run</h3>
      <div class="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1">
        <ItemTile
          v-for="item in frequent"
          :key="`f-${item.id}`"
          :item="item"
          :selected="isSelected(item.id)"
          @pick="emit('pick', item)"
        />
      </div>
    </section>

    <div
      ref="gridRef"
      class="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-background/40 p-1.5"
      :style="{ maxHeight }"
    >
      <div v-if="results.length" class="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1" role="listbox" aria-label="Items" :aria-multiselectable="multiple">
        <ItemTile
          v-for="item in results"
          :key="item.id"
          :item="item"
          :selected="isSelected(item.id)"
          @pick="emit('pick', item)"
        />
      </div>
      <p v-else class="py-6 text-center text-sm text-muted-foreground">
        No items match “{{ query }}”{{ activeCategories.length < itemCategories.length ? ' in these categories' : '' }}.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import Fuse from 'fuse.js'
import { SearchIcon } from '@lucide/vue'
import { Input } from '~/components/ui/input'
import ItemTile from '~/components/ItemTile.vue'
import { useGameData } from '~/composables/useGameData'
import { cn } from '~/lib/utils'
import type { Item } from '~/types'

const props = withDefaults(defineProps<{
  selectedIds?: string[]
  multiple?: boolean
  placeholder?: string
  maxHeight?: string
  autofocus?: boolean
}>(), {
  selectedIds: () => [],
  multiple: false,
  placeholder: 'Search items…',
  maxHeight: '14rem',
  autofocus: true,
})

const emit = defineEmits<{
  pick: [item: Item]
  /** Enter on an empty search with something already picked: the caller should save */
  submit: []
}>()

const { items, itemCategories, currentRunMarkers, currentRunStashedItems, getItemById } = useGameData()

const query = ref('')
const searchRef = ref<InstanceType<typeof Input> | null>(null)
const gridRef = ref<HTMLElement | null>(null)

// Default: everything except collectibles (notes, letters) which are rarely loot
const activeCategories = ref<string[]>([])
watch(itemCategories, (cats) => {
  if (!activeCategories.value.length) activeCategories.value = cats.map((c) => c.name).filter((c) => c !== 'Collectible')
}, { immediate: true })

function toggleCategory(name: string) {
  const list = activeCategories.value
  const idx = list.indexOf(name)
  if (idx >= 0) list.splice(idx, 1)
  else list.push(name)
}

const fuse = computed(() => new Fuse(items.value, { keys: ['name', 'category'], threshold: 0.35, ignoreLocation: true }))

const results = computed(() => {
  const q = query.value.trim()
  // A search looks through every category so nothing is ever "missing"
  if (q) return fuse.value.search(q, { limit: 80 }).map((r) => r.item)
  const active = new Set(activeCategories.value)
  return items.value.filter((i) => !i.category || active.has(i.category))
})

const frequent = computed(() => {
  const counts = new Map<string, number>()
  for (const m of currentRunMarkers.value) counts.set(m.itemId, (counts.get(m.itemId) ?? 0) + 1)
  for (const s of currentRunStashedItems.value) counts.set(s.itemId, (counts.get(s.itemId) ?? 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 16)
    .map(([id]) => getItemById(id))
    .filter((i): i is Item => !!i)
})

function isSelected(id: string) {
  return props.selectedIds.includes(id)
}

/** Enter adds the top match; with nothing typed it never picks a random item, it submits (or does nothing). */
function onEnter() {
  if (!query.value.trim()) {
    if (props.selectedIds.length) emit('submit')
    return
  }
  const first = results.value[0]
  if (first) emit('pick', first)
}

function focusGrid() {
  gridRef.value?.querySelector<HTMLElement>('button')?.focus()
}

function focusSearch() {
  const el = (searchRef.value as unknown as { $el?: HTMLElement })?.$el
  const input = el instanceof HTMLInputElement ? el : el?.querySelector('input')
  input?.focus()
}

onMounted(() => {
  if (props.autofocus) nextTick(focusSearch)
})

defineExpose({ focusSearch, reset: () => { query.value = '' } })
</script>
