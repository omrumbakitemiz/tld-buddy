<template>
  <div class="flex flex-col h-screen w-screen overflow-hidden bg-background text-foreground">
    <NuxtRouteAnnouncer />

    <!-- Top Bar -->
    <header class="relative z-[1000] flex items-center justify-between h-10 px-4 bg-card/80 backdrop-blur-md border-b border-border shrink-0">
      <h1 class="text-sm font-bold tracking-wide text-primary uppercase">
        TLD Map
      </h1>

      <div class="flex items-center gap-1">
        <TooltipProvider :delay-duration="200">
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
        </TooltipProvider>
      </div>
    </header>

    <!-- Map fills remaining space (z-0 creates stacking context to contain Leaflet's internal z-indexes) -->
    <main class="flex-1 min-h-0 relative z-0">
      <InteractiveMap
        ref="mapRef"
        @request-add-marker="onRequestAddMarker"
      />
    </main>

    <!-- Left Sheet: Map Selector -->
    <MapSelector v-model:open="showMapSelector" />

    <!-- Right Sheet: Marker Panel -->
    <MarkerPanel
      v-model:open="showMarkerPanel"
      @fly-to="onFlyToMarker"
    />

    <!-- Dialog: Item Manager -->
    <ItemManager v-model:open="showItemManager" />

    <!-- Dialog: Add Marker -->
    <MarkerDialog
      :show="showMarkerDialog"
      :pending-position="pendingMarkerPosition"
      @close="showMarkerDialog = false"
      @save="onSaveMarker"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { MapIcon, CrosshairIcon, PackageIcon } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip'
import InteractiveMap from '~/components/InteractiveMap.vue'
import MapSelector from '~/components/MapSelector.vue'
import MarkerPanel from '~/components/MarkerPanel.vue'
import ItemManager from '~/components/ItemManager.vue'
import MarkerDialog from '~/components/MarkerDialog.vue'
import { useGameData } from '~/composables/useGameData'
import type { Marker } from '~/types'

const { currentMap, addMarker, getItemById } = useGameData()

const mapRef = ref<InstanceType<typeof InteractiveMap> | null>(null)
const showMapSelector = ref(false)
const showMarkerPanel = ref(false)
const showItemManager = ref(false)
const showMarkerDialog = ref(false)
const pendingMarkerPosition = ref<{ x: number; y: number } | null>(null)

function closeAllPanels() {
  showMapSelector.value = false
  showMarkerPanel.value = false
  showItemManager.value = false
}

function openPanel(panel: 'maps' | 'markers' | 'items') {
  closeAllPanels()
  // Use nextTick so the closing animation completes before reopening
  nextTick(() => {
    if (panel === 'maps') showMapSelector.value = true
    else if (panel === 'markers') showMarkerPanel.value = true
    else if (panel === 'items') showItemManager.value = true
  })
}

function onRequestAddMarker(position: { x: number; y: number }) {
  pendingMarkerPosition.value = position
  showMarkerDialog.value = true
}

function onSaveMarker(data: { itemId: string; quantity: number; note: string; name: string }) {
  if (!pendingMarkerPosition.value || !currentMap.value) return

  const item = getItemById(data.itemId)
  const markerName = data.name || item?.name || 'Marker'

  addMarker({
    mapId: currentMap.value.id,
    itemId: data.itemId,
    name: markerName,
    x: pendingMarkerPosition.value.x,
    y: pendingMarkerPosition.value.y,
    quantity: data.quantity,
    note: data.note,
  })

  showMarkerDialog.value = false
  pendingMarkerPosition.value = null
}

function onFlyToMarker(marker: Marker) {
  mapRef.value?.flyToMarker(marker)
  showMarkerPanel.value = false
}
</script>
