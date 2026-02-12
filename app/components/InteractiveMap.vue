<template>
  <div class="relative w-full h-full">
    <!-- Empty state -->
    <div
      v-if="!currentMap"
      class="flex flex-col items-center justify-center w-full h-full gap-3 text-muted-foreground"
    >
      <MapPinOffIcon class="h-12 w-12 opacity-40" />
      <p class="text-lg font-medium">No map selected</p>
      <p class="text-sm">Open the Maps panel to add or select a map</p>
    </div>

    <!-- Leaflet map container -->
    <div
      v-show="currentMap"
      ref="mapContainer"
      class="w-full h-full"
    />

    <!-- Add marker mode controls -->
    <div class="absolute bottom-6 left-1/2 -translate-x-1/2 z-[999] flex items-center gap-3">
      <Button
        v-if="!addMarkerMode"
        variant="default"
        class="shadow-lg"
        @click="addMarkerMode = true"
      >
        <PlusIcon class="h-4 w-4 mr-2" />
        Add Marker
      </Button>

      <template v-else>
        <div class="bg-primary text-primary-foreground px-5 py-2.5 rounded-full font-medium shadow-lg animate-pulse text-sm">
          Click on the map to place a marker
        </div>
        <Button variant="destructive" size="sm" @click="addMarkerMode = false">
          Cancel
        </Button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { MapPinOffIcon, PlusIcon } from 'lucide-vue-next'
import L from 'leaflet'
import { Button } from '~/components/ui/button'
import { useGameData } from '~/composables/useGameData'
import type { Marker } from '~/types'

const emit = defineEmits<{
  'request-add-marker': [position: { x: number; y: number }]
}>()

const { currentMap, currentMapMarkers, getItemById } = useGameData()

const mapContainer = ref<HTMLElement | null>(null)
const addMarkerMode = ref(false)

let map: L.Map | null = null
let imageOverlay: L.ImageOverlay | null = null
let markerLayer: L.LayerGroup | null = null

function initMap() {
  if (!mapContainer.value || !currentMap.value) return
  destroyMap()

  map = L.map(mapContainer.value, {
    crs: L.CRS.Simple,
    minZoom: -3,
    maxZoom: 4,
    zoomSnap: 0.25,
    zoomDelta: 0.5,
    attributionControl: false,
  })

  const { imageWidth, imageHeight, imageUrl } = currentMap.value
  const bounds: L.LatLngBoundsExpression = [
    [0, 0],
    [imageHeight, imageWidth],
  ]

  imageOverlay = L.imageOverlay(imageUrl, bounds).addTo(map)
  map.fitBounds(bounds)

  markerLayer = L.layerGroup().addTo(map)

  // Handle click-to-add-marker
  map.on('click', (e: L.LeafletMouseEvent) => {
    if (!addMarkerMode.value) return
    addMarkerMode.value = false
    emit('request-add-marker', { x: e.latlng.lng, y: e.latlng.lat })
  })

  renderMarkers()
}

function destroyMap() {
  if (map) {
    map.remove()
    map = null
    imageOverlay = null
    markerLayer = null
  }
}

function renderMarkers() {
  if (!markerLayer) return
  markerLayer.clearLayers()

  currentMapMarkers.value.forEach((marker) => {
    const item = getItemById(marker.itemId)
    const qtyBadge = marker.quantity > 1
      ? `<span class="tld-marker__qty">${marker.quantity}</span>`
      : ''

    let markerHtml: string
    let size: [number, number]
    let anchor: [number, number]
    let popupOffset: [number, number]

    if (item?.icon) {
      // Icon marker: rounded square with item image
      markerHtml = `<div class="tld-marker tld-marker--icon"><img src="${item.icon}" alt="" class="tld-marker__img" />${qtyBadge}</div>`
      size = [32, 32]
      anchor = [16, 16]
      popupOffset = [0, -20]
    } else {
      // Fallback: amber circle with quantity or dot
      const label = marker.quantity > 1 ? String(marker.quantity) : '&bull;'
      markerHtml = `<div class="tld-marker">${label}</div>`
      size = [28, 28]
      anchor = [14, 14]
      popupOffset = [0, -18]
    }

    const icon = L.divIcon({
      className: '',
      html: markerHtml,
      iconSize: size,
      iconAnchor: anchor,
      popupAnchor: popupOffset,
    })

    const lMarker = L.marker([marker.y, marker.x], { icon }).addTo(markerLayer!)

    const popupIcon = item?.icon
      ? `<img src="${item.icon}" style="width:24px;height:24px;object-fit:contain;border-radius:4px;background:rgba(255,255,255,0.1);margin-right:8px;flex-shrink:0" />`
      : ''

    const popupContent = `
      <div style="min-width:140px">
        <div style="display:flex;align-items:center;margin-bottom:4px">
          ${popupIcon}
          <div style="font-weight:700;font-size:13px">${escapeHtml(marker.name)}</div>
        </div>
        ${item ? `<div style="font-size:12px;opacity:0.75">${escapeHtml(item.name)} &times; ${marker.quantity}</div>` : ''}
        ${marker.note ? `<div style="font-size:11px;opacity:0.6;margin-top:4px">${escapeHtml(marker.note)}</div>` : ''}
      </div>
    `

    lMarker.bindPopup(popupContent, { closeButton: true, maxWidth: 220 })
  })
}

function flyToMarker(marker: Marker) {
  if (!map) return
  map.flyTo([marker.y, marker.x], 2, { duration: 0.8 })
}

function escapeHtml(text: string) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// Watch markers changes to re-render
watch(currentMapMarkers, () => {
  renderMarkers()
}, { deep: true })

// Watch map changes to reinitialize
watch(
  () => currentMap.value?.id,
  (newId, oldId) => {
    if (newId !== oldId) {
      nextTick(() => initMap())
    }
  },
)

onMounted(() => {
  nextTick(() => {
    setTimeout(() => initMap(), 50)
  })
})

onUnmounted(() => {
  destroyMap()
})

// Expose flyToMarker for parent component
defineExpose({ flyToMarker })
</script>
