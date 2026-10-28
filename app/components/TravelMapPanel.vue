<template>
  <div class="flex flex-col h-full">
    <!-- Compact map selector bar -->
    <div class="surface-rail z-10 flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
      <!-- Map selector dropdown -->
      <div class="relative flex-1 min-w-0" ref="dropdownRef">
        <button
          class="flex h-9 w-full items-center gap-2 rounded-md border border-border bg-background/50 px-3 text-sm transition-colors hover:border-primary/40"
          :aria-expanded="showDropdown"
          @click="showDropdown = !showDropdown"
        >
          <MapIcon class="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span v-if="map" class="truncate font-medium">{{ map.name }}</span>
          <span v-else class="truncate text-muted-foreground">Select a map...</span>
          <ChevronDownIcon :class="cn('h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0 transition-transform', showDropdown && 'rotate-180')" />
        </button>

        <!-- Dropdown -->
        <div
          v-if="showDropdown"
          class="surface-card absolute inset-x-0 top-full z-[1000] mt-1 flex max-h-[400px] flex-col overflow-hidden rounded-lg border border-border shadow-xl"
        >
          <!-- Search -->
          <div class="p-2 border-b border-border shrink-0">
            <Input
              v-model="searchQuery"
              placeholder="Search maps..."
              class="h-7 text-xs"
              @keydown.escape="showDropdown = false"
              ref="searchInputRef"
            />
          </div>

          <!-- Connected maps section -->
          <div v-if="connectedMaps.length > 0 && !searchQuery.trim()" class="border-b border-border shrink-0">
            <p class="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Connected Maps</p>
            <div class="px-1 pb-1">
              <button
                v-for="conn in connectedMaps"
                :key="conn.map.id"
                :class="cn(
                  'flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-left text-sm transition-colors cursor-pointer',
                  conn.map.id === mapId
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'hover:bg-accent/50'
                )"
                @click="selectMap(conn.map.id)"
              >
                <LinkIcon class="h-3 w-3 text-primary shrink-0" />
                <span class="truncate">{{ conn.map.name }}</span>
                <span v-if="conn.label" class="text-[10px] text-muted-foreground ml-auto truncate max-w-[120px]">{{ conn.label }}</span>
              </button>
            </div>
          </div>

          <!-- All maps list -->
          <div class="flex-1 min-h-0 overflow-y-auto">
            <p class="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {{ searchQuery.trim() ? 'Results' : 'All Maps' }}
            </p>
            <div class="px-1 pb-2">
              <button
                v-for="m in filteredMaps"
                :key="m.id"
                :class="cn(
                  'flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-left text-sm transition-colors cursor-pointer',
                  m.id === mapId
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'hover:bg-accent/50'
                )"
                @click="selectMap(m.id)"
              >
                <span class="truncate flex-1">{{ m.name }}</span>
                <Badge variant="outline" class="text-[10px] px-1 py-0 h-4 shrink-0">
                  {{ m.type === 'transition' ? 'T' : 'R' }}
                </Badge>
                <Badge v-if="m.isDLC" variant="secondary" class="text-[10px] px-1 py-0 h-4 shrink-0">
                  DLC
                </Badge>
              </button>

              <div v-if="filteredMaps.length === 0" class="text-center py-4 text-muted-foreground text-xs">
                No maps found
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Side label -->
      <span class="hud-label shrink-0 text-muted-foreground">{{ side }}</span>
    </div>

    <!-- Map view -->
    <div class="relative isolate min-h-0 flex-1">
      <!-- Empty state -->
      <div
        v-if="!map"
        class="flex flex-col items-center justify-center w-full h-full gap-3 text-muted-foreground"
      >
        <MapPinOffIcon class="h-10 w-10 opacity-40" />
        <p class="text-sm font-medium">No map selected</p>
        <p class="text-xs">Choose a map from the selector above</p>
      </div>

      <!-- Leaflet container -->
      <div
        v-show="map"
        ref="mapContainer"
        class="w-full h-full"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { MapIcon, MapPinOffIcon, ChevronDownIcon, LinkIcon } from '@lucide/vue'
import { Badge } from '~/components/ui/badge'
import { Input } from '~/components/ui/input'
import { useGameData } from '~/composables/useGameData'
import { cn } from '~/lib/utils'
import type { GameMap } from '~/types'
import { useImageMap } from '~/composables/useImageMap'
import { onClickOutside } from '@vueuse/core'

const props = defineProps<{
  side: 'left' | 'right'
  map: GameMap | null
  mapId: string | null
  otherMapId: string | null
}>()

const emit = defineEmits<{
  'select-map': [mapId: string]
}>()

const { maps, getConnectedMaps, getMapVariant } = useGameData()

const mapContainer = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const searchInputRef = ref<InstanceType<typeof Input> | null>(null)
const showDropdown = ref(false)
const searchQuery = ref('')


// Close dropdown when clicking outside
onClickOutside(dropdownRef, () => {
  showDropdown.value = false
})

// ── Connected maps (based on the other side's selection) ────────────────

const connectedMaps = computed(() => {
  // Show maps connected to the OTHER side's map selection
  const otherId = props.otherMapId
  if (!otherId) return []
  return getConnectedMaps(otherId)
})

// ── Filtered maps ───────────────────────────────────────────────────────

const filteredMaps = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  return maps.value.filter((m) => {
    if (q && !m.name.toLowerCase().includes(q)) return false
    return true
  })
})

// ── Map selection ───────────────────────────────────────────────────────

function selectMap(mapId: string) {
  emit('select-map', mapId)
  showDropdown.value = false
  searchQuery.value = ''
}

// ── Leaflet map ─────────────────────────────────────────────────────────

const variant = computed(() => (props.map ? getMapVariant(props.map) : null))
useImageMap(mapContainer, variant)

// Focus search input when dropdown opens
watch(showDropdown, (open) => {
  if (open) {
    nextTick(() => {
      const input = searchInputRef.value?.$el?.querySelector('input') ?? searchInputRef.value?.$el
      input?.focus()
    })
  } else {
    searchQuery.value = ''
  }
})

</script>
