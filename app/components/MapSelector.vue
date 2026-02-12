<template>
  <Sheet :open="open" @update:open="$emit('update:open', $event)">
    <SheetContent side="left" class="w-80 p-0 flex flex-col h-full max-h-screen">
      <SheetHeader class="px-5 pt-5 pb-0 shrink-0">
        <SheetTitle class="text-base">Maps</SheetTitle>
        <SheetDescription class="text-xs text-muted-foreground">
          Select or add a map to work with
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
            <!-- Map thumbnail -->
            <div class="h-24 w-full bg-muted overflow-hidden">
              <img
                :src="mapItem.imageUrl"
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
                    {{ mapItem.type === 'transition' ? 'Transition' : mapItem.type === 'custom' ? 'Custom' : 'Region' }}
                  </Badge>
                  <span class="text-xs text-muted-foreground">
                    {{ getMapMarkerCount(mapItem.id) }} markers
                  </span>
                </div>
              </div>

              <Button
                v-if="mapItem.type === 'custom'"
                size="icon"
                variant="ghost"
                class="h-7 w-7 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive shrink-0"
                @click.stop="handleDeleteMap(mapItem.id)"
              >
                <TrashIcon class="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <!-- Empty state -->
          <div v-if="filteredMaps.length === 0" class="text-center py-8 text-muted-foreground text-sm">
            <MapIcon class="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>{{ maps.length === 0 ? 'No maps yet' : 'No maps match your filters' }}</p>
          </div>
        </div>
      </div>

      <Separator class="shrink-0" />

      <!-- Add map form -->
      <div class="p-4 space-y-3 shrink-0">
        <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Add New Map</p>
        <Input
          v-model="newMapName"
          placeholder="Map name"
          class="h-8 text-sm"
        />
        <Input
          v-model="newMapUrl"
          placeholder="Image URL (e.g. /maps/my-map.jpg)"
          class="h-8 text-sm"
          @blur="detectDimensions"
        />

        <!-- Loading / status indicator -->
        <div v-if="detecting" class="flex items-center gap-2 text-xs text-muted-foreground">
          <LoaderIcon class="h-3 w-3 animate-spin" />
          Detecting image dimensions...
        </div>
        <div v-else-if="detectError" class="text-xs text-destructive">
          {{ detectError }}
        </div>
        <div v-else-if="detectedWidth && detectedHeight" class="text-xs text-muted-foreground">
          Detected: {{ detectedWidth }} &times; {{ detectedHeight }}px
        </div>

        <Button
          class="w-full h-8 text-sm"
          :disabled="!newMapName || !newMapUrl || !detectedWidth || !detectedHeight || detecting"
          @click="handleAddMap"
        >
          <PlusIcon class="h-3.5 w-3.5 mr-1.5" />
          Add Map
        </Button>
      </div>
    </SheetContent>
  </Sheet>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { LoaderIcon, MapIcon, PlusIcon, TrashIcon } from 'lucide-vue-next'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '~/components/ui/sheet'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Input } from '~/components/ui/input'
import { Separator } from '~/components/ui/separator'
import { useGameData } from '~/composables/useGameData'
import { cn } from '~/lib/utils'

defineProps<{ open: boolean }>()
defineEmits<{ 'update:open': [value: boolean] }>()

const { maps, markers, currentMapId, addMap, deleteMap, setCurrentMap } = useGameData()

const searchQuery = ref('')
const mapTypes = ['Region', 'Transition', 'Custom'] as const
const activeTypes = ref<string[]>(['Region', 'Transition', 'Custom'])

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
    const mapType = m.type === 'transition' ? 'Transition' : m.type === 'custom' ? 'Custom' : 'Region'
    if (!activeTypes.value.includes(mapType)) return false

    // Search filter
    if (q && !m.name.toLowerCase().includes(q)) return false

    return true
  })
})

const newMapName = ref('')
const newMapUrl = ref('')
const detectedWidth = ref<number | null>(null)
const detectedHeight = ref<number | null>(null)
const detecting = ref(false)
const detectError = ref('')

function getMapMarkerCount(mapId: string) {
  return markers.value.filter((m) => m.mapId === mapId).length
}

function handleSelectMap(mapId: string) {
  setCurrentMap(mapId)
}

function handleDeleteMap(mapId: string) {
  if (confirm('Delete this map and all its markers?')) {
    deleteMap(mapId)
  }
}

function detectDimensions() {
  const url = newMapUrl.value.trim()
  if (!url) {
    detectedWidth.value = null
    detectedHeight.value = null
    detectError.value = ''
    return
  }

  detecting.value = true
  detectError.value = ''
  detectedWidth.value = null
  detectedHeight.value = null

  const img = new Image()
  img.onload = () => {
    detectedWidth.value = img.naturalWidth
    detectedHeight.value = img.naturalHeight
    detecting.value = false
  }
  img.onerror = () => {
    detectError.value = 'Could not load image. Check the URL.'
    detecting.value = false
  }
  img.src = url
}

function handleAddMap() {
  if (!newMapName.value || !newMapUrl.value || !detectedWidth.value || !detectedHeight.value) return
  addMap({
    name: newMapName.value,
    imageUrl: newMapUrl.value.trim(),
    imageWidth: detectedWidth.value,
    imageHeight: detectedHeight.value,
  })
  newMapName.value = ''
  newMapUrl.value = ''
  detectedWidth.value = null
  detectedHeight.value = null
  detectError.value = ''
}
</script>
