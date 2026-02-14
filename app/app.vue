<template>
  <div class="flex flex-col h-screen w-screen overflow-hidden bg-background text-foreground">
    <Analytics />
    <NuxtRouteAnnouncer />

    <!-- Top Bar -->
    <header class="relative z-[1000] flex items-center justify-between h-10 px-4 bg-card/80 backdrop-blur-md border-b border-border shrink-0">
      <div class="flex items-center gap-3">
        <h1 class="text-sm font-bold tracking-wide text-primary uppercase">
          TLD Buddy
        </h1>
        <Badge v-if="travelMode" variant="default" class="text-[9px] px-1.5 py-0 h-4 bg-primary/80">
          <CompassIcon class="h-2.5 w-2.5 mr-0.5" />
          Travel
        </Badge>

        <!-- Current run info -->
        <button
          v-if="currentRun"
          class="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/50 hover:bg-muted transition-colors cursor-pointer text-xs"
          @click="showRunSelector = true"
        >
          <SwordsIcon class="h-3 w-3 text-muted-foreground" />
          <span class="font-medium truncate max-w-[120px]">{{ currentRun.name }}</span>
          <Badge :variant="currentRun.difficulty === 'interloper' || currentRun.difficulty === 'misery' ? 'destructive' : 'default'" class="text-[9px] px-1 py-0 h-3.5 capitalize">
            {{ currentRun.difficulty }}
          </Badge>
        </button>
        <button
          v-else
          class="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/50 hover:bg-muted transition-colors cursor-pointer text-xs text-muted-foreground"
          @click="showRunSelector = true"
        >
          <SwordsIcon class="h-3 w-3" />
          <span>Select Run</span>
        </button>
      </div>

      <div class="flex items-center gap-1">
        <TooltipProvider :delay-duration="200">
          <!-- Travel Mode Toggle -->
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                :variant="travelMode ? 'default' : 'ghost'"
                size="icon"
                class="h-7 w-7"
                @click="toggleTravelMode"
              >
                <CompassIcon class="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{{ travelMode ? 'Exit Travel Mode' : 'Travel Mode' }}</p>
            </TooltipContent>
          </Tooltip>

          <!-- Separator between travel and other tools -->
          <div v-if="!travelMode" class="w-px h-4 bg-border mx-0.5" />

          <template v-if="!travelMode">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button variant="ghost" size="icon" class="h-7 w-7" @click="showRunSelector = true">
                  <SwordsIcon class="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Runs</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger as-child>
                <Button variant="ghost" size="icon" class="h-7 w-7" @click="openPanel('maps')">
                  <MapIcon class="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Maps</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger as-child>
                <Button variant="ghost" size="icon" class="h-7 w-7" @click="openPanel('pois')">
                  <LandmarkIcon class="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Locations</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger as-child>
                <Button variant="ghost" size="icon" class="h-7 w-7" @click="openPanel('markers')">
                  <CrosshairIcon class="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Markers</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger as-child>
                <Button variant="ghost" size="icon" class="h-7 w-7" @click="openPanel('items')">
                  <PackageIcon class="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Items</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger as-child>
                <Button variant="ghost" size="icon" class="h-7 w-7" @click="showPOIConfig = true">
                  <SlidersHorizontalIcon class="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>POI Settings</p>
              </TooltipContent>
            </Tooltip>
          </template>
        </TooltipProvider>
      </div>
    </header>

    <!-- Map fills remaining space (z-0 creates stacking context to contain Leaflet's internal z-indexes) -->
    <main class="flex-1 min-h-0 relative z-0">
      <!-- Travel Mode: dual side-by-side maps -->
      <TravelModeView v-if="travelMode" />

      <!-- Default Mode: single interactive map -->
      <InteractiveMap
        v-else
        ref="mapRef"
        @request-add-marker="onRequestAddMarker"
        @request-edit-marker="onRequestEditMarker"
        @request-delete-marker="onRequestDeleteMarker"
      />
      <!-- Recent maps sidebar (left edge overlay, hidden in travel mode) -->
      <RecentMapsSidebar v-if="!travelMode" />
    </main>

    <!-- Run Selector Dialog -->
    <RunSelector v-model:open="showRunSelector" />

    <!-- Left Sheet: Map Selector -->
    <MapSelector v-model:open="showMapSelector" />

    <!-- Right Sheet: Marker Panel -->
    <MarkerPanel
      v-model:open="showMarkerPanel"
      @fly-to="onFlyToMarker"
      @edit-marker="onRequestEditMarker"
    />

    <!-- Right Sheet: POI Panel -->
    <POIPanel
      v-model:open="showPOIPanel"
      @fly-to="onFlyToPosition"
      @start-pin="onStartPinPOI"
    />

    <!-- Dialog: Item Manager -->
    <ItemManager v-model:open="showItemManager" />

    <!-- Dialog: POI Config -->
    <POIConfig v-model:open="showPOIConfig" />

    <!-- Dialog: Add Marker -->
    <MarkerDialog
      :show="showMarkerDialog"
      :pending-position="pendingMarkerPosition"
      @close="showMarkerDialog = false"
      @save="onSaveMarker"
    />

    <!-- Dialog: Edit Marker -->
    <MarkerEditDialog
      :marker="editingMarker"
      @close="editingMarker = null"
      @save="onUpdateMarker"
      @delete="onDeleteMarkerFromEdit"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import { Analytics } from '@vercel/analytics/nuxt'
import { MapIcon, CrosshairIcon, PackageIcon, SwordsIcon, LandmarkIcon, SlidersHorizontalIcon, CompassIcon } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip'
import InteractiveMap from '~/components/InteractiveMap.vue'
import TravelModeView from '~/components/TravelModeView.vue'
import MapSelector from '~/components/MapSelector.vue'
import MarkerPanel from '~/components/MarkerPanel.vue'
import POIPanel from '~/components/POIPanel.vue'
import POIConfig from '~/components/POIConfig.vue'
import ItemManager from '~/components/ItemManager.vue'
import MarkerDialog from '~/components/MarkerDialog.vue'
import MarkerEditDialog from '~/components/MarkerEditDialog.vue'
import RunSelector from '~/components/RunSelector.vue'
import RecentMapsSidebar from '~/components/RecentMapsSidebar.vue'
import { useGameData } from '~/composables/useGameData'
import type { Marker } from '~/types'

const { currentMap, currentRun, addMarker, updateMarker, deleteMarker, getItemById, travelMode, toggleTravelMode } = useGameData()

const mapRef = ref<InstanceType<typeof InteractiveMap> | null>(null)
const showMapSelector = ref(false)
const showMarkerPanel = ref(false)
const showPOIPanel = ref(false)
const showItemManager = ref(false)
const showMarkerDialog = ref(false)
const showRunSelector = ref(false)
const showPOIConfig = ref(false)
const pendingMarkerPosition = ref<{ x: number; y: number } | null>(null)
const editingMarker = ref<Marker | null>(null)

// Check once on mount — if no run exists, show selector
onMounted(() => {
  if (!currentRun.value) {
    showRunSelector.value = true
  }
})

function closeAllPanels() {
  showMapSelector.value = false
  showMarkerPanel.value = false
  showPOIPanel.value = false
  showItemManager.value = false
}

function openPanel(panel: 'maps' | 'markers' | 'items' | 'pois') {
  closeAllPanels()
  nextTick(() => {
    if (panel === 'maps') showMapSelector.value = true
    else if (panel === 'markers') showMarkerPanel.value = true
    else if (panel === 'items') showItemManager.value = true
    else if (panel === 'pois') showPOIPanel.value = true
  })
}

function onRequestAddMarker(position: { x: number; y: number }) {
  if (!currentRun.value) {
    showRunSelector.value = true
    return
  }
  pendingMarkerPosition.value = position
  showMarkerDialog.value = true
}

function onSaveMarker(data: { items: Array<{ itemId: string; name: string; quantity: number }>; note: string }) {
  if (!pendingMarkerPosition.value || !currentMap.value || !currentRun.value) return

  const pos = { x: pendingMarkerPosition.value.x, y: pendingMarkerPosition.value.y }
  const count = data.items.length
  // When placing multiple markers at once, spread them in a small circle
  // so they don't stack on top of each other and are all visible.
  const SPREAD_RADIUS = 25

  for (let i = 0; i < count; i++) {
    const entry = data.items[i]!
    const item = getItemById(entry.itemId)
    const markerName = entry.name || item?.name || 'Marker'

    let x = pos.x
    let y = pos.y

    if (count > 1) {
      const angle = (2 * Math.PI * i) / count - Math.PI / 2
      x += Math.cos(angle) * SPREAD_RADIUS
      y += Math.sin(angle) * SPREAD_RADIUS
    }

    addMarker({
      runId: currentRun.value.id,
      mapId: currentMap.value.id,
      itemId: entry.itemId,
      name: markerName,
      x,
      y,
      quantity: entry.quantity,
      note: data.note,
    })
  }

  showMarkerDialog.value = false
  pendingMarkerPosition.value = null
}

function onRequestEditMarker(marker: Marker) {
  editingMarker.value = marker
}

function onRequestDeleteMarker(markerId: string) {
  if (confirm('Delete this marker?')) {
    deleteMarker(markerId)
  }
}

function onUpdateMarker(data: { id: string; name: string; quantity: number; note: string }) {
  updateMarker(data.id, { name: data.name, quantity: data.quantity, note: data.note })
  editingMarker.value = null
}

function onDeleteMarkerFromEdit(markerId: string) {
  deleteMarker(markerId)
  editingMarker.value = null
}

function onFlyToMarker(marker: Marker) {
  mapRef.value?.flyToMarker(marker)
  showMarkerPanel.value = false
}

function onFlyToPosition(position: { x: number; y: number }) {
  mapRef.value?.flyToPosition(position)
}

function onStartPinPOI(poiId: string) {
  mapRef.value?.startPinMode(poiId)
}
</script>
