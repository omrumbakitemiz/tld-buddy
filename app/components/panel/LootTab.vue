<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="space-y-2 px-3 pb-2 pt-3">
      <div class="flex rounded-lg bg-background/50 p-0.5" role="radiogroup" aria-label="Show">
        <button
          v-for="f in filters"
          :key="f.value"
          type="button"
          role="radio"
          :aria-checked="lootFilter === f.value"
          :class="cn(
            'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md text-xs transition-colors',
            lootFilter === f.value ? 'bg-accent text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )"
          @click="lootFilter = f.value"
        >
          {{ f.label }}
          <span class="tabular text-[10px] opacity-75">{{ f.count }}</span>
        </button>
      </div>
      <div class="relative">
        <SearchIcon class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input v-model="query" placeholder="Filter loot on this map…" class="h-9 pl-8" aria-label="Filter loot on this map" />
      </div>
    </div>

    <ul class="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3" aria-label="Loot on this map">
      <li
        v-for="m in list"
        :key="m.id"
        :class="cn(
          'group flex items-center gap-2.5 rounded-lg border p-1.5 pr-1 transition-colors',
          m.id === selectedMarkerId ? 'border-primary/60 bg-accent' : 'border-transparent hover:bg-accent/60',
        )"
      >
        <button
          type="button"
          class="flex min-w-0 flex-1 items-center gap-2.5 text-left"
          :aria-label="`Show ${m.name || itemName(m)} on the map`"
          @click="focusMarker(m)"
        >
          <span
            :class="cn(
              'grid size-10 shrink-0 place-items-center rounded-md border-2 bg-background/60',
              m.lootedAt ? 'border-dashed border-muted-foreground/40 opacity-60 grayscale' : 'border-loot',
            )"
          >
            <img v-if="icon(m)" :src="icon(m)!" alt="" class="size-7 object-contain" loading="lazy">
            <PackageIcon v-else class="size-4 text-muted-foreground" />
          </span>
          <span class="min-w-0 flex-1">
            <span :class="cn('block truncate text-sm', m.lootedAt && 'text-muted-foreground line-through decoration-muted-foreground/50')">
              {{ m.name || itemName(m) }}
              <span v-if="m.quantity > 1" class="tabular text-muted-foreground">×{{ m.quantity }}</span>
            </span>
            <span v-if="m.note" class="block truncate text-xs text-muted-foreground">{{ m.note }}</span>
          </span>
        </button>
        <button
          type="button"
          :class="cn(
            'grid size-10 shrink-0 place-items-center rounded-md border transition-colors',
            m.lootedAt
              ? 'border-looted/40 bg-looted/15 text-looted hover:bg-looted/25'
              : 'border-border text-muted-foreground hover:border-loot/60 hover:text-loot',
          )"
          :aria-pressed="!!m.lootedAt"
          :aria-label="m.lootedAt ? `Mark ${m.name || itemName(m)} not looted` : `Mark ${m.name || itemName(m)} looted`"
          :title="m.lootedAt ? 'Looted — click to undo' : 'Mark looted'"
          @click="toggleLooted(m.id)"
        >
          <CheckIcon class="size-4" :stroke-width="m.lootedAt ? 3 : 2" />
        </button>
      </li>
    </ul>

    <div v-if="!list.length" class="px-6 pb-8 text-center text-sm text-muted-foreground">
      <template v-if="!currentRun">
        <p class="text-foreground">No run selected</p>
        <p class="mt-1">Loot is tracked per run. <button class="text-primary underline-offset-4 hover:underline" @click="showRuns = true">Choose or start a run</button>.</p>
      </template>
      <template v-else-if="!currentMapMarkers.length">
        <p class="text-foreground">Nothing marked on this map yet</p>
        <p class="mt-1">Press <kbd>A</kbd> then click the map, right-click a spot, or Shift-click it.</p>
      </template>
      <template v-else-if="query">
        <p>No loot matches “{{ query }}”.</p>
      </template>
      <template v-else-if="lootFilter === 'remaining'">
        <p class="text-foreground">All looted here</p>
        <p class="mt-1">Everything you marked on this map has been taken.</p>
      </template>
      <template v-else>
        <p>Nothing looted on this map yet.</p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import Fuse from 'fuse.js'
import { CheckIcon, PackageIcon, SearchIcon } from '@lucide/vue'
import { Input } from '~/components/ui/input'
import { useGameData } from '~/composables/useGameData'
import { useUiState } from '~/composables/useUiState'
import { cn } from '~/lib/utils'
import type { Marker } from '~/types'

const emit = defineEmits<{
  'fly-to': [target: { x: number; y: number; mapId: string }]
  edit: [marker: Marker]
}>()

const { currentRun, currentMapMarkers, getItemById, toggleLooted } = useGameData()
const { lootFilter, selectedMarkerId, selectMarker, showRuns } = useUiState()

const query = ref('')

const remainingCount = computed(() => currentMapMarkers.value.filter((m) => !m.lootedAt).length)
const filters = computed(() => [
  { value: 'remaining' as const, label: 'Still there', count: remainingCount.value },
  { value: 'looted' as const, label: 'Looted', count: currentMapMarkers.value.length - remainingCount.value },
  { value: 'all' as const, label: 'All', count: currentMapMarkers.value.length },
])

const itemName = (m: Marker) => getItemById(m.itemId)?.name ?? 'Unknown item'
const icon = (m: Marker) => getItemById(m.itemId)?.icon ?? null

const list = computed(() => {
  let result = currentMapMarkers.value
  if (lootFilter.value === 'remaining') result = result.filter((m) => !m.lootedAt)
  else if (lootFilter.value === 'looted') result = result.filter((m) => m.lootedAt)
  const q = query.value.trim()
  if (q) {
    const fuse = new Fuse(result.map((m) => ({ m, text: `${m.name} ${itemName(m)} ${m.note ?? ''}` })), { keys: ['text'], threshold: 0.4, ignoreLocation: true })
    return fuse.search(q).map((r) => r.item.m)
  }
  // Remaining first, then alphabetical: what you still need sits on top
  return [...result].sort((a, b) => Number(!!a.lootedAt) - Number(!!b.lootedAt) || (a.name || '').localeCompare(b.name || ''))
})

function focusMarker(m: Marker) {
  selectMarker(m.id)
  emit('fly-to', { x: m.x, y: m.y, mapId: m.mapId })
}
</script>
