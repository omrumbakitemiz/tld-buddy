<template>
  <Sheet :open="open" @update:open="$emit('update:open', $event)">
    <SheetContent side="right" class="w-80 p-0 flex flex-col">
      <SheetHeader class="px-5 pt-5 pb-0">
        <SheetTitle class="text-base">Markers</SheetTitle>
        <SheetDescription class="text-xs text-muted-foreground">
          {{ currentMap ? currentMap.name : 'No map selected' }}
          <span v-if="currentRun" class="text-muted-foreground/60"> &middot; {{ currentRun.name }}</span>
          <span v-if="currentMap" class="text-primary"> &middot; {{ currentMapMarkers.length }}</span>
        </SheetDescription>
      </SheetHeader>

      <div class="px-4 pt-3">
        <Input
          v-model="searchQuery"
          placeholder="Search markers..."
          class="h-8 text-sm"
        />
      </div>

      <Separator class="my-3" />

      <ScrollArea class="flex-1 px-3">
        <div class="space-y-1.5 pb-4">
          <div
            v-for="marker in filteredMarkers"
            :key="marker.id"
            class="group flex items-start gap-2 p-2.5 rounded-lg border border-border bg-card hover:border-primary/40 cursor-pointer transition-all"
            @click="$emit('fly-to', marker)"
          >
            <div class="flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0 mt-0.5">
              {{ marker.quantity > 1 ? marker.quantity : '&bull;' }}
            </div>

            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold truncate">{{ marker.name }}</p>
              <p v-if="getItemById(marker.itemId)" class="text-xs text-muted-foreground mt-0.5">
                {{ getItemById(marker.itemId)?.name }}
                <span v-if="marker.quantity > 1">&times; {{ marker.quantity }}</span>
              </p>
              <p v-if="marker.note" class="text-xs text-muted-foreground/70 mt-1 line-clamp-2">
                {{ marker.note }}
              </p>
            </div>

            <Button
              size="icon"
              variant="ghost"
              class="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive shrink-0"
              @click.stop="handleDeleteMarker(marker.id)"
            >
              <TrashIcon class="h-3 w-3" />
            </Button>
          </div>

          <!-- Empty states -->
          <div v-if="currentMapMarkers.length === 0" class="text-center py-8 text-muted-foreground text-sm">
            <CrosshairIcon class="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>No markers on this map</p>
            <p class="text-xs mt-1">Click "Add Marker" on the map</p>
          </div>
          <div v-else-if="filteredMarkers.length === 0" class="text-center py-8 text-muted-foreground text-sm">
            <p>No markers match your search</p>
          </div>
        </div>
      </ScrollArea>
    </SheetContent>
  </Sheet>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { CrosshairIcon, TrashIcon } from 'lucide-vue-next'
import Fuse from 'fuse.js'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '~/components/ui/sheet'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { ScrollArea } from '~/components/ui/scroll-area'
import { Separator } from '~/components/ui/separator'
import { useGameData } from '~/composables/useGameData'
import type { Marker } from '~/types'

defineProps<{ open: boolean }>()
defineEmits<{
  'update:open': [value: boolean]
  'fly-to': [marker: Marker]
}>()

const { currentMap, currentRun, currentMapMarkers, getItemById, deleteMarker } = useGameData()

const searchQuery = ref('')

const fuse = computed(() => {
  const items = currentMapMarkers.value.map((marker) => {
    const item = getItemById(marker.itemId)
    return {
      ...marker,
      _searchText: `${marker.name} ${item?.name ?? ''} ${marker.note ?? ''}`,
    }
  })
  return new Fuse(items, { keys: ['_searchText'], threshold: 0.4 })
})

const filteredMarkers = computed(() => {
  if (!searchQuery.value.trim()) return currentMapMarkers.value
  return fuse.value.search(searchQuery.value).map((r) => r.item)
})

function handleDeleteMarker(markerId: string) {
  if (confirm('Delete this marker?')) {
    deleteMarker(markerId)
  }
}
</script>
