<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="px-3 pb-2 pt-3">
      <div class="relative">
        <SearchIcon class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input v-model="query" placeholder="Find a region…" class="h-9 pl-8" aria-label="Find a map" />
      </div>
    </div>

    <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 pb-3">
      <section v-for="group in groups" :key="group.title" :aria-label="group.title">
        <div class="mb-1 flex items-center justify-between px-1">
          <h3 class="hud-label text-muted-foreground">{{ group.title }}</h3>
          <button
            v-if="group.clearable"
            type="button"
            class="text-[11px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            @click="clearRecentMaps"
          >
            Clear
          </button>
        </div>
        <ul class="space-y-1">
          <li v-for="entry in group.maps" :key="`${group.title}-${entry.map.id}`">
            <button
              type="button"
              :aria-current="entry.map.id === currentMapId ? 'true' : undefined"
              :class="cn(
                'flex w-full items-center gap-3 rounded-lg border p-1.5 text-left transition-colors',
                entry.map.id === currentMapId ? 'border-primary/60 bg-accent' : 'border-transparent hover:bg-accent/60',
              )"
              @click="setCurrentMap(entry.map.id)"
            >
              <img :src="getMapThumbnail(entry.map)" alt="" class="h-11 w-16 shrink-0 rounded-md object-cover" loading="lazy">
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm">{{ entry.map.name }}</span>
                <span class="block truncate text-[11px] text-muted-foreground">
                  {{ entry.label ?? (entry.map.type === 'transition' ? 'Transition' : 'Region') }}{{ entry.map.isDLC ? ' · DLC' : '' }}
                </span>
              </span>
              <span v-if="counts(entry.map.id)" class="tabular shrink-0 text-right text-[11px] leading-tight">
                <span class="block text-loot">{{ counts(entry.map.id)!.remaining }} left</span>
                <span class="block text-muted-foreground">of {{ counts(entry.map.id)!.total }}</span>
              </span>
            </button>
          </li>
        </ul>
      </section>
      <p v-if="!groups.length" class="px-4 py-6 text-center text-sm text-muted-foreground">No region matches “{{ query }}”.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import Fuse from 'fuse.js'
import { SearchIcon } from '@lucide/vue'
import { Input } from '~/components/ui/input'
import { useGameData } from '~/composables/useGameData'
import { cn } from '~/lib/utils'
import type { GameMap } from '~/types'

const {
  maps, recentMaps, currentMapId, markerCountsByMap,
  setCurrentMap, clearRecentMaps, getMapThumbnail, getConnectedMaps,
} = useGameData()

const query = ref('')
const counts = (mapId: string) => markerCountsByMap.value.get(mapId)

type Entry = { map: GameMap; label?: string }

const groups = computed(() => {
  const q = query.value.trim()
  if (q) {
    const hits = new Fuse(maps.value, { keys: ['name'], threshold: 0.35 }).search(q).map((r) => ({ map: r.item }))
    return hits.length ? [{ title: 'Results', maps: hits as Entry[], clearable: false }] : []
  }
  const out: { title: string; maps: Entry[]; clearable: boolean }[] = []
  const connected = currentMapId.value ? getConnectedMaps(currentMapId.value) : []
  if (connected.length) out.push({ title: 'Connected to this map', maps: connected, clearable: false })
  if (recentMaps.value.length) out.push({ title: 'Recent', maps: recentMaps.value.map((map) => ({ map })), clearable: true })
  out.push({ title: 'Regions', maps: maps.value.filter((m) => m.type === 'region').map((map) => ({ map })), clearable: false })
  out.push({ title: 'Transitions', maps: maps.value.filter((m) => m.type === 'transition').map((map) => ({ map })), clearable: false })
  return out
})
</script>
