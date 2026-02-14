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

    <!-- Bottom controls -->
    <div class="absolute bottom-6 left-1/2 -translate-x-1/2 z-[999] flex items-center gap-3">
      <!-- Pin POI mode -->
      <template v-if="pinPOIMode">
        <div class="bg-amber-600 text-white px-5 py-2.5 rounded-full font-medium shadow-lg animate-pulse text-sm">
          Click to pin "{{ pinPOIName }}"
        </div>
        <Button variant="destructive" size="sm" @click="cancelPinMode">
          Cancel
        </Button>
      </template>

      <!-- Add marker mode -->
      <template v-else-if="addMarkerMode">
        <div class="bg-primary text-primary-foreground px-5 py-2.5 rounded-full font-medium shadow-lg animate-pulse text-sm">
          Click on the map to place a marker
        </div>
        <Button variant="destructive" size="sm" @click="addMarkerMode = false">
          Cancel
        </Button>
      </template>

      <!-- Default: Add Marker button -->
      <Button
        v-else
        variant="default"
        class="shadow-lg"
        @click="addMarkerMode = true"
        title="Or Shift+Click anywhere on the map"
      >
        <PlusIcon class="h-4 w-4 mr-2" />
        Add Marker
      </Button>
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

const {
  currentMap, currentMapVariant, currentMapMarkers, currentMapPOIPins,
  pois, getItemById, getStashedItems, pinPOI,
} = useGameData()

const mapContainer = ref<HTMLElement | null>(null)
const addMarkerMode = ref(false)

// POI pin placement mode
const pinPOIMode = ref(false)
const pinPOIId = ref<string | null>(null)
const pinPOIName = ref('')

let map: L.Map | null = null
let imageOverlay: L.ImageOverlay | null = null
let markerLayer: L.LayerGroup | null = null
let poiLayer: L.LayerGroup | null = null

function initMap() {
  if (!mapContainer.value || !currentMapVariant.value) return
  destroyMap()

  map = L.map(mapContainer.value, {
    crs: L.CRS.Simple,
    minZoom: -3,
    maxZoom: 4,
    zoomSnap: 0.25,
    zoomDelta: 0.5,
    attributionControl: false,
    zoomControl: false,
  })

  const { imageWidth, imageHeight, imageUrl } = currentMapVariant.value
  const bounds: L.LatLngBoundsExpression = [
    [0, 0],
    [imageHeight, imageWidth],
  ]

  imageOverlay = L.imageOverlay(imageUrl, bounds).addTo(map)
  map.fitBounds(bounds)

  markerLayer = L.layerGroup().addTo(map)
  poiLayer = L.layerGroup().addTo(map)

  // Handle clicks
  map.on('click', (e: L.LeafletMouseEvent) => {
    // POI pin placement mode
    if (pinPOIMode.value && pinPOIId.value) {
      pinPOI(pinPOIId.value, e.latlng.lng, e.latlng.lat)
      cancelPinMode()
      renderPOIs()
      return
    }

    // Shift+Click → instant marker
    if (e.originalEvent.shiftKey) {
      emit('request-add-marker', { x: e.latlng.lng, y: e.latlng.lat })
      return
    }

    // Add marker mode
    if (!addMarkerMode.value) return
    addMarkerMode.value = false
    emit('request-add-marker', { x: e.latlng.lng, y: e.latlng.lat })
  })

  renderMarkers()
  renderPOIs()
}

function destroyMap() {
  if (map) {
    map.remove()
    map = null
    imageOverlay = null
    markerLayer = null
    poiLayer = null
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
      markerHtml = `<div class="tld-marker tld-marker--icon"><img src="${item.icon}" alt="" class="tld-marker__img" />${qtyBadge}</div>`
      size = [32, 32]
      anchor = [16, 16]
      popupOffset = [0, -20]
    } else {
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

function renderPOIs() {
  if (!poiLayer) return
  poiLayer.clearLayers()

  currentMapPOIPins.value.forEach((pin) => {
    const poi = pois.value.find((p) => p.id === pin.poiId)
    if (!poi) return

    const stashItems = getStashedItems(pin.poiId)
    const stashCount = stashItems.length

    // POI marker: landmark-style label
    const stashBadge = stashCount > 0
      ? `<span class="tld-poi__count">${stashCount}</span>`
      : ''

    const poiHtml = `<div class="tld-poi">${escapeHtml(poi.name)}${stashBadge}</div>`

    const icon = L.divIcon({
      className: '',
      html: poiHtml,
      iconSize: [0, 0], // auto-sized by CSS
      iconAnchor: [0, 16],
      popupAnchor: [60, -10],
    })

    const lMarker = L.marker([pin.y, pin.x], { icon }).addTo(poiLayer!)

    // Build popup with stash info
    let stashHtml = ''
    if (stashCount > 0) {
      const itemRows = stashItems.map((s) => {
        const item = getItemById(s.itemId)
        const iconImg = item?.icon
          ? `<img src="${item.icon}" style="width:18px;height:18px;object-fit:contain;margin-right:6px;flex-shrink:0" />`
          : ''
        return `<div style="display:flex;align-items:center;font-size:11px;padding:2px 0">
          ${iconImg}<span>${escapeHtml(item?.name ?? 'Unknown')}</span>
          ${s.quantity > 1 ? `<span style="opacity:0.6;margin-left:4px">&times;${s.quantity}</span>` : ''}
        </div>`
      }).join('')
      stashHtml = `<div style="margin-top:6px;border-top:1px solid rgba(255,255,255,0.1);padding-top:6px">${itemRows}</div>`
    }

    const featureTags = [
      poi.hasForge ? '<span style="color:#f97316">Forge</span>' : '',
      poi.hasWorkbench ? '<span style="color:#3b82f6">Bench</span>' : '',
      poi.hasBed ? '<span style="color:#10b981">Bed</span>' : '',
      poi.hasShelter ? '<span style="color:#a855f7">Shelter</span>' : '',
    ].filter(Boolean).join(' &middot; ')

    const popupContent = `
      <div style="min-width:140px">
        <div style="font-weight:700;font-size:13px">${escapeHtml(poi.name)}</div>
        ${poi.type ? `<div style="font-size:11px;opacity:0.6;text-transform:capitalize">${escapeHtml(poi.type)}</div>` : ''}
        ${featureTags ? `<div style="font-size:10px;margin-top:3px">${featureTags}</div>` : ''}
        ${stashHtml}
      </div>
    `

    lMarker.bindPopup(popupContent, { closeButton: true, maxWidth: 250 })
  })
}

function flyToMarker(marker: Marker) {
  if (!map) return
  map.flyTo([marker.y, marker.x], 0, { duration: 0.8 })
}

function flyToPosition(pos: { x: number; y: number }) {
  if (!map) return
  map.flyTo([pos.y, pos.x], 0, { duration: 0.8 })
}

function startPinMode(poiId: string) {
  const poi = pois.value.find((p) => p.id === poiId)
  if (!poi) return
  pinPOIMode.value = true
  pinPOIId.value = poiId
  pinPOIName.value = poi.name
  addMarkerMode.value = false
}

function cancelPinMode() {
  pinPOIMode.value = false
  pinPOIId.value = null
  pinPOIName.value = ''
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

// Watch POI pins to re-render
watch(currentMapPOIPins, () => {
  renderPOIs()
}, { deep: true })

// Watch map variant changes to reinitialize
watch(
  () => currentMapVariant.value?.imageUrl,
  (newUrl, oldUrl) => {
    if (newUrl !== oldUrl) {
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

// Expose methods for parent component
defineExpose({ flyToMarker, flyToPosition, startPinMode })
</script>
