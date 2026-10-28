<template>
  <div class="relative h-full w-full" :class="{ 'map-placing': placing, 'night-map': nightMap }">
    <div
      v-if="!staticDataReady"
      class="flex h-full w-full flex-col items-center justify-center gap-3 text-muted-foreground"
    >
      <LoaderIcon class="size-8 animate-spin opacity-60" />
      <p class="text-sm">Unrolling the maps…</p>
    </div>

    <div
      v-else-if="!currentMap"
      class="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground"
    >
      <MapIcon class="size-10 opacity-50" />
      <p class="text-base font-medium text-foreground">Pick a region to start</p>
      <p class="text-sm">Open the Maps tab in the side panel, or press 3.</p>
    </div>

    <div
      v-show="currentMap"
      ref="container"
      class="h-full w-full"
      role="application"
      :aria-label="currentMap ? `${currentMap.name} map` : 'Map'"
    />
    <div v-if="currentMap" class="map-vignette" aria-hidden="true" />

    <!-- Placement hint -->
    <div
      v-if="placing"
      class="pointer-events-none absolute inset-x-0 top-3 z-[500] flex justify-center px-3"
    >
      <div class="pointer-events-auto flex items-center gap-3 rounded-full surface-rail border border-border py-1.5 pl-4 pr-1.5 text-sm shadow-lg">
        <CrosshairIcon class="size-4 text-primary" />
        <span>{{ placingLabel }}</span>
        <Button size="sm" variant="ghost" class="h-7 rounded-full" @click="cancelPlacement">
          Cancel <kbd class="ml-1 text-[10px] text-muted-foreground">Esc</kbd>
        </Button>
      </div>
    </div>

    <!-- Looted markers are hidden: say so, and offer the way back -->
    <button
      v-if="currentMap && hideLooted && !placing"
      type="button"
      class="surface-rail absolute left-3 top-3 z-[500] flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs shadow-lg transition-colors hover:border-primary/50"
      title="Show looted markers (H)"
      @click="hideLooted = false"
    >
      <EyeOffIcon class="size-3.5 text-muted-foreground" />
      Looted hidden
      <kbd class="text-[10px] text-muted-foreground">H</kbd>
    </button>

    <!-- Zoom / fit -->
    <div v-if="currentMap" class="absolute bottom-4 right-3 z-[500] flex flex-col overflow-hidden rounded-lg border border-border surface-rail shadow-lg">
      <button class="map-ctl" aria-label="Zoom in" title="Zoom in (+)" @click="zoomIn">
        <PlusIcon class="size-4" />
      </button>
      <button class="map-ctl border-y border-border" aria-label="Zoom out" title="Zoom out (−)" @click="zoomOut">
        <MinusIcon class="size-4" />
      </button>
      <button class="map-ctl" aria-label="Fit whole map" title="Fit whole map (F)" @click="fit">
        <MaximizeIcon class="size-4" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import L from 'leaflet'
import { CrosshairIcon, EyeOffIcon, LoaderIcon, MapIcon, MaximizeIcon, MinusIcon, PlusIcon } from '@lucide/vue'
import { Button } from '~/components/ui/button'
import { useGameData } from '~/composables/useGameData'
import { useImageMap } from '~/composables/useImageMap'
import { useUiState } from '~/composables/useUiState'
import { useAddUi, type AddRequest, type MapTile } from '~/composables/useAddUi'
import type { Marker } from '~/types'

const emit = defineEmits<{
  'request-add-marker': [request: AddRequest]
}>()

const {
  currentMap, currentMapVariant, currentMapMarkers, currentMapPOIPins,
  items, getItemById, getPOIById, getStashedItemCount, pinPOI, staticDataReady,
} = useGameData()
const ui = useUiState()
const { selectedMarkerId, selectedGroupIds, selectedPOIId, placingLoot, pinningPOIId, hideLooted, nightMap, cancelPlacement } = ui

const addUi = useAddUi()

const container = ref<HTMLElement | null>(null)
const placing = computed(() => placingLoot.value || !!pinningPOIId.value)
const placingLabel = computed(() => {
  if (pinningPOIId.value) return `Click where ${getPOIById(pinningPOIId.value)?.name ?? 'this place'} is`
  return 'Click the map where the loot is'
})

let markerLayer: L.LayerGroup | null = null
let renderedMapId: string | null = null
let pendingFly: { x: number; y: number } | null = null
let poiLayer: L.LayerGroup | null = null
const markerViews = new Map<string, { key: string; layer: L.Marker }>()
const poiViews = new Map<string, { key: string; layer: L.Marker }>()

const { zoomIn, zoomOut, fit, flyTo, getMap } = useImageMap(container, currentMapVariant, (map) => {
  markerViews.clear()
  poiViews.clear()
  poiLayer = L.layerGroup().addTo(map)
  markerLayer = L.layerGroup().addTo(map)

  const request = (e: L.LeafletMouseEvent, source: AddRequest['source']): AddRequest => ({
    pos: { x: e.latlng.lng, y: e.latlng.lat },
    client: { x: e.originalEvent.clientX, y: e.originalEvent.clientY },
    source,
  })

  map.on('click', (e: L.LeafletMouseEvent) => {
    const pos = { x: e.latlng.lng, y: e.latlng.lat }
    if (pinningPOIId.value) {
      pinPOI(pinningPOIId.value, pos.x, pos.y)
      selectedPOIId.value = pinningPOIId.value
      cancelPlacement()
      return
    }
    // An add-item variant may own plain clicks (e.g. a stamp mode)
    if (addUi.handlers()?.interceptClick?.(request(e, 'placing'), e.originalEvent)) return
    if (placingLoot.value || e.originalEvent.shiftKey) {
      const source = placingLoot.value ? 'placing' : 'shift-click'
      placingLoot.value = false
      emit('request-add-marker', request(e, source))
      return
    }
    ui.selectMarker(null)
    selectedPOIId.value = null
  })

  // Right-click on desktop, long-press on touch
  map.on('contextmenu', (e: L.LeafletMouseEvent) => {
    if (pinningPOIId.value) return
    placingLoot.value = false
    emit('request-add-marker', request(e, 'context'))
  })

  // Pointer position and projection for the add-item variants (useAddUi)
  map.on('mousemove', (e: L.LeafletMouseEvent) => {
    addUi.pointer.value = { pos: { x: e.latlng.lng, y: e.latlng.lat }, client: { x: e.originalEvent.clientX, y: e.originalEvent.clientY } }
  })
  map.on('mouseout', () => (addUi.pointer.value = null))
  map.on('move zoom resize', () => addUi.viewTick.value++)
  const el = map.getContainer()
  addUi.mapView.value = {
    container: el,
    toClient: (pos) => {
      const pt = map.latLngToContainerPoint([pos.y, pos.x])
      const box = el.getBoundingClientRect()
      return { x: box.left + pt.x, y: box.top + pt.y }
    },
    fromClient: (client) => {
      const box = el.getBoundingClientRect()
      if (client.x < box.left || client.x > box.right || client.y < box.top || client.y > box.bottom) return null
      const ll = map.containerPointToLatLng([client.x - box.left, client.y - box.top])
      return { x: ll.lng, y: ll.lat }
    },
    reveal: (pos, margin = 120) => {
      const m = typeof margin === 'number' ? { top: margin, right: margin, bottom: margin, left: margin } : { top: 120, right: 120, bottom: 120, left: 120, ...margin }
      const pt = map.latLngToContainerPoint([pos.y, pos.x])
      const size = map.getSize()
      const dx = pt.x < m.left ? pt.x - m.left : pt.x > size.x - m.right ? pt.x - (size.x - m.right) : 0
      const dy = pt.y < m.top ? pt.y - m.top : pt.y > size.y - m.bottom ? pt.y - (size.y - m.bottom) : 0
      if (dx || dy) map.panBy([dx, dy], { animate: !reducedMotion() })
    },
    // CRS.Simple: one map pixel per screen pixel at zoom 0
    scale: () => Math.pow(2, -map.getZoom()),
  }

  // Grouping depends on zoom: regroup after every zoom change
  map.on('zoomend', renderMarkers)

  renderMarkers()
  renderPOIs()

  renderedMapId = currentMap.value?.id ?? null
  if (pendingFly) {
    map.setView([pendingFly.y, pendingFly.x], 0, { animate: false })
    pendingFly = null
  }
})

// ── Markers ─────────────────────────────────────────────────────────────────

const visibleMarkers = computed(() =>
  currentMapMarkers.value.filter((m) => !hideLooted.value || !m.lootedAt || m.id === selectedMarkerId.value),
)

/** Markers closer than this on screen merge into one tile with a count, so every tile stays clickable. */
const GROUP_RADIUS_PX = 22

// Lucide "package" glyph for items without an icon
const PACKAGE_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"/></svg>'
const TICK_SVG = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'

function itemLabel(m: Marker) {
  return `${m.name || getItemById(m.itemId)?.name || 'Loot'}${m.quantity > 1 ? ` ×${m.quantity}` : ''}`
}

/** Greedy screen-space grouping at the current zoom. Remaining loot seeds groups first. */
function groupMarkers(map: L.Map, list: Marker[]): Marker[][] {
  const pts = list.map((m) => ({ m, p: map.latLngToLayerPoint([m.y, m.x]) }))
  pts.sort((a, b) => Number(!!a.m.lootedAt) - Number(!!b.m.lootedAt) || a.m.id.localeCompare(b.m.id))
  const used = new Set<string>()
  const groups: Marker[][] = []
  for (const seed of pts) {
    if (used.has(seed.m.id)) continue
    used.add(seed.m.id)
    const group = [seed.m]
    for (const other of pts) {
      if (used.has(other.m.id)) continue
      if (seed.p.distanceTo(other.p) <= GROUP_RADIUS_PX) {
        used.add(other.m.id)
        group.push(other.m)
      }
    }
    groups.push(group)
  }
  return groups
}

function tileHtml(group: Marker[], selected: boolean, label: string): string {
  const lead = group.find((m) => !m.lootedAt) ?? group[0]!
  const allLooted = group.every((m) => m.lootedAt)
  const item = getItemById(lead.itemId)
  const classes = ['tld-marker', allLooted && 'tld-marker--looted', group.length > 1 && 'tld-marker--group', selected && 'tld-marker--selected'].filter(Boolean).join(' ')
  const body = item?.icon
    ? `<img src="${escapeHtml(item.icon)}" alt="" class="tld-marker__img" draggable="false" />`
    : `<span class="tld-marker__glyph">${PACKAGE_SVG}</span>`
  const badge = group.length > 1
    ? `<span class="tld-marker__count">${group.length}</span>`
    : lead.quantity > 1 ? `<span class="tld-marker__qty">${lead.quantity}</span>` : ''
  return `<div class="${classes}"><span class="sr-only">${escapeHtml(label)}</span><span aria-hidden="true" class="contents">${body}${badge}<span class="tld-marker__tick">${TICK_SVG}</span></span></div>`
}

function renderMarkers() {
  const map = getMap()
  if (!markerLayer || !map) return
  const seen = new Set<string>()
  const groupIds = new Set(selectedGroupIds.value ?? [])
  for (const group of groupMarkers(map, visibleMarkers.value)) {
    const ids = group.map((m) => m.id)
    const viewKey = ids.join(',')
    seen.add(viewKey)
    const selected = ids.includes(selectedMarkerId.value ?? '') || (groupIds.size > 0 && ids.every((id) => groupIds.has(id)))
    const key = group.map((m) => `${m.x}|${m.y}|${m.itemId}|${m.quantity}|${!!m.lootedAt}|${m.name}`).join(';') + `|${selected}`
    const existing = markerViews.get(viewKey)
    if (existing?.key === key) continue
    if (existing) markerLayer.removeLayer(existing.layer)

    const remaining = group.filter((m) => !m.lootedAt).length
    const label = group.length === 1
      ? `${itemLabel(group[0]!)}${group[0]!.lootedAt ? ' (looted)' : ''}`
      : `${group.length} items here, ${remaining} still there: ${group.map(itemLabel).join(', ')}`
    // Group tiles sit at the centroid of their members
    const lat = group.reduce((a, m) => a + m.y, 0) / group.length
    const lng = group.reduce((a, m) => a + m.x, 0) / group.length
    const layer = L.marker([lat, lng], {
      icon: L.divIcon({ className: 'tld-icon', html: tileHtml(group, selected, label), iconSize: [34, 34], iconAnchor: [17, 17] }),
      title: label,
      alt: label,
      keyboard: true,
      riseOnHover: true,
      zIndexOffset: selected ? 1000 : remaining ? 0 : -100,
    })
    const choose = () => {
      if (group.length === 1) ui.selectMarker(selectedMarkerId.value === group[0]!.id ? null : group[0]!.id)
      else ui.selectGroup(ids)
    }
    layer.on('click', (e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e)
      if (!variantTileClick({ kind: 'loot', markerIds: ids }, { x: lng, y: lat }, e)) choose()
    })
    layer.on('contextmenu', (e: L.LeafletMouseEvent) => tileContextMenu({ x: lng, y: lat }, e))
    layer.on('keypress', (e: L.LeafletKeyboardEvent) => {
      if (e.originalEvent.key === 'Enter') choose()
    })
    layer.addTo(markerLayer)
    markerViews.set(viewKey, { key, layer })
  }
  for (const [id, view] of markerViews) {
    if (seen.has(id)) continue
    markerLayer.removeLayer(view.layer)
    markerViews.delete(id)
  }
}

/** A click on a tile goes to the add-item variant first (useAddUi `interceptTileClick`). */
function variantTileClick(tile: MapTile, pos: { x: number; y: number }, e: L.LeafletMouseEvent): boolean {
  const req: AddRequest = { pos, client: { x: e.originalEvent.clientX, y: e.originalEvent.clientY }, source: 'placing' }
  return addUi.handlers()?.interceptTileClick?.(tile, req, e.originalEvent) ?? false
}

/** Right-click on a tile adds to that tile's spot, like right-clicking the map beside it. */
function tileContextMenu(pos: { x: number; y: number }, e: L.LeafletMouseEvent) {
  L.DomEvent.stopPropagation(e)
  L.DomEvent.preventDefault(e.originalEvent)
  if (pinningPOIId.value) return
  placingLoot.value = false
  emit('request-add-marker', { pos, client: { x: e.originalEvent.clientX, y: e.originalEvent.clientY }, source: 'context' })
}

// ── POIs ────────────────────────────────────────────────────────────────────

function renderPOIs() {
  if (!poiLayer) return
  const seen = new Set<string>()
  for (const pin of currentMapPOIPins.value) {
    const poi = getPOIById(pin.poiId)
    if (!poi) continue
    seen.add(pin.poiId)
    const count = getStashedItemCount(pin.poiId)
    const selected = selectedPOIId.value === pin.poiId
    const key = `${pin.x}|${pin.y}|${count}|${selected}`
    const existing = poiViews.get(pin.poiId)
    if (existing?.key === key) continue
    if (existing) poiLayer.removeLayer(existing.layer)

    const badge = count > 0 ? `<span class="tld-poi__count" aria-label="${count} stashed">${count}</span>` : ''
    const layer = L.marker([pin.y, pin.x], {
      icon: L.divIcon({
        className: 'tld-icon',
        html: `<div class="tld-poi${selected ? ' tld-poi--selected' : ''}">${escapeHtml(poi.name)}${badge}</div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      }),
      title: poi.name,
      keyboard: true,
    })
    layer.on('click', (e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e)
      if (!variantTileClick({ kind: 'place', poiId: pin.poiId }, { x: pin.x, y: pin.y }, e)) ui.selectPOI(pin.poiId)
    })
    layer.on('contextmenu', (e: L.LeafletMouseEvent) => tileContextMenu({ x: pin.x, y: pin.y }, e))
    layer.addTo(poiLayer)
    poiViews.set(pin.poiId, { key, layer })
  }
  for (const [id, view] of poiViews) {
    if (seen.has(id)) continue
    poiLayer.removeLayer(view.layer)
    poiViews.delete(id)
  }
}

watch([visibleMarkers, selectedMarkerId, selectedGroupIds, () => items.value.length], renderMarkers, { deep: true })
watch([currentMapPOIPins, selectedPOIId, () => currentMapMarkers.value.length], renderPOIs, { deep: true })
// Stash counts change without pins changing
watch(() => currentMapPOIPins.value.map((p) => getStashedItemCount(p.poiId)).join(','), renderPOIs)

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[c]!)
}

/** Fly to a position on the given map; if that map is still loading, jump there once it is built. */
function flyToPosition(pos: { x: number; y: number }, mapId?: string) {
  if (getMap() && (!mapId || mapId === renderedMapId)) flyTo(pos.x, pos.y, 0)
  else pendingFly = pos
}

/**
 * Pan just enough that a map position isn't hidden under an overlay (the loot card).
 * `avoid` is in viewport coordinates.
 */
function revealPosition(pos: { x: number; y: number }, avoid: DOMRect) {
  const map = getMap()
  if (!map || !container.value) return
  const box = container.value.getBoundingClientRect()
  const pt = map.latLngToContainerPoint([pos.y, pos.x])
  const margin = 28
  const top = avoid.top - box.top - margin
  const left = avoid.left - box.left - margin
  const right = avoid.right - box.left + margin
  if (pt.y > top && pt.x > left && pt.x < right) {
    map.panBy([0, pt.y - top], { animate: !reducedMotion() })
  }
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

onBeforeUnmount(() => {
  addUi.mapView.value = null
  addUi.pointer.value = null
})

defineExpose({ flyToPosition, fit, zoomIn, zoomOut, getMap, revealPosition })
</script>

<style scoped>
.map-ctl {
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  color: var(--foreground);
  transition: background-color 150ms ease;
}
.map-ctl:hover {
  background: var(--accent);
}
.map-ctl:focus-visible {
  outline-offset: -2px;
}
</style>
