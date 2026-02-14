<template>
  <Sheet :open="open" @update:open="$emit('update:open', $event)">
    <SheetContent side="left" class="w-80 p-0 flex flex-col h-full max-h-screen">
      <SheetHeader class="px-5 pt-5 pb-0 shrink-0">
        <SheetTitle class="text-base">Maps</SheetTitle>
        <SheetDescription class="text-xs text-muted-foreground">
          Select a region to explore
        </SheetDescription>
      </SheetHeader>

      <Separator class="my-3 shrink-0" />

      <!-- Search -->
      <div class="px-3 shrink-0">
        <Input
          v-model="searchQuery"
          placeholder="Search maps..."
          class="h-8 text-sm"
        />
      </div>

      <!-- Type filter badges -->
      <div class="flex gap-1.5 px-3 pt-2 flex-wrap shrink-0">
        <Badge
          v-for="t in mapTypes"
          :key="t"
          :variant="activeTypes.includes(t) ? 'default' : 'outline'"
          class="cursor-pointer text-xs px-2.5 py-0.5"
          @click="toggleType(t)"
        >
          {{ t }}
        </Badge>
      </div>

      <div class="flex-1 min-h-0 overflow-y-auto px-3 mt-2">
        <div class="space-y-2 pb-4">
          <div
            v-for="mapItem in filteredMaps"
            :key="mapItem.id"
            :class="cn(
              'group relative rounded-lg border-2 cursor-pointer transition-all overflow-hidden',
              mapItem.id === currentMapId
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/40 bg-card'
            )"
            @click="handleSelectMap(mapItem.id)"
          >
            <!-- Map thumbnail (uses variant based on current run difficulty) -->
            <div class="h-24 w-full bg-muted overflow-hidden">
              <img
                :src="getMapThumbnail(mapItem)"
                :alt="mapItem.name"
                class="w-full h-full object-cover opacity-70"
                loading="lazy"
              />
            </div>

            <div class="flex items-center justify-between px-3 py-2">
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold truncate">{{ mapItem.name }}</p>
                <div class="flex items-center gap-1.5">
                  <Badge variant="outline" class="text-[10px] px-1.5 py-0 h-4">
                    {{ mapItem.type === 'transition' ? 'Transition' : 'Region' }}
                  </Badge>
                  <Badge v-if="mapItem.isDLC" variant="secondary" class="text-[10px] px-1.5 py-0 h-4">
                    DLC
                  </Badge>
                  <span class="text-xs text-muted-foreground">
                    {{ getMapMarkerCount(mapItem.id) }} markers
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty state -->
          <div v-if="filteredMaps.length === 0" class="text-center py-8 text-muted-foreground text-sm">
            <MapIcon class="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>{{ maps.length === 0 ? 'No maps available' : 'No maps match your filters' }}</p>
          </div>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { MapIcon } from 'lucide-vue-next'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '~/components/ui/sheet'
import { Badge } from '~/components/ui/badge'
import { Input } from '~/components/ui/input'
import { Separator } from '~/components/ui/separator'
import { useGameData } from '~/composables/useGameData'
import { cn } from '~/lib/utils'

defineProps<{ open: boolean }>()
defineEmits<{ 'update:open': [value: boolean] }>()

const { maps, markers, currentMapId, currentRun, setCurrentMap, getMapThumbnail } = useGameData()

const searchQuery = ref('')
const mapTypes = ['Region', 'Transition'] as const
const activeTypes = ref<string[]>(['Region', 'Transition'])

function toggleType(t: string) {
  const idx = activeTypes.value.indexOf(t)
  if (idx >= 0) {
    activeTypes.value.splice(idx, 1)
  } else {
    activeTypes.value.push(t)
  }
}

const filteredMaps = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  return maps.value.filter((m) => {
    // Type filter
    const mapType = m.type === 'transition' ? 'Transition' : 'Region'
    if (!activeTypes.value.includes(mapType)) return false

    // Search filter
    if (q && !m.name.toLowerCase().includes(q)) return false

    return true
  })
})

function getMapMarkerCount(mapId: string) {
  // Show markers for the current run only
  const runId = currentRun.value?.id
  if (!runId) return 0
  return markers.value.filter((m) => m.mapId === mapId && m.runId === runId).length
}

function handleSelectMap(mapId: string) {
  setCurrentMap(mapId)
}
</script>
