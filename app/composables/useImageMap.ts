import { onBeforeUnmount, onMounted, watch, type Ref } from 'vue'
import L from 'leaflet'
import type { MapVariant } from '~/types'

/**
 * A Leaflet map showing one region image in pixel coordinates (CRS.Simple).
 * Shared by the main map and both travel-mode panes. The map is rebuilt when the
 * image changes and kept sized to its container (panels collapsing, window resizes).
 */
export function useImageMap(
  container: Ref<HTMLElement | null>,
  variant: Ref<MapVariant | null>,
  onReady?: (map: L.Map) => void,
) {
  let map: L.Map | null = null
  let bounds: L.LatLngBounds | null = null
  let resizeObserver: ResizeObserver | null = null

  function build() {
    destroy()
    const el = container.value
    const v = variant.value
    if (!el || !v) return

    map = L.map(el, {
      crs: L.CRS.Simple,
      minZoom: -3,
      maxZoom: 3,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 90,
      attributionControl: false,
      zoomControl: false,
      keyboard: true,
    })
    bounds = L.latLngBounds([0, 0], [v.imageHeight, v.imageWidth])
    L.imageOverlay(v.imageUrl, bounds, { className: 'tld-map-image' }).addTo(map)
    map.fitBounds(bounds)
    // Allow a little overscroll but keep the painting on screen
    map.setMaxBounds(bounds.pad(0.25))
    map.setMinZoom(map.getBoundsZoom(bounds) - 1)
    onReady?.(map)
  }

  function destroy() {
    map?.remove()
    map = null
    bounds = null
  }

  watch(() => variant.value?.imageUrl, (next, prev) => {
    if (next !== prev) build()
  }, { flush: 'post' })

  onMounted(() => {
    build()
    resizeObserver = new ResizeObserver(() => map?.invalidateSize({ debounceMoveend: true }))
    if (container.value) resizeObserver.observe(container.value)
  })

  onBeforeUnmount(() => {
    resizeObserver?.disconnect()
    destroy()
  })

  return {
    getMap: () => map,
    fit: () => {
      if (map && bounds) map.flyToBounds(bounds, { duration: 0.4 })
    },
    zoomIn: () => map?.zoomIn(),
    zoomOut: () => map?.zoomOut(),
    flyTo: (x: number, y: number, zoom?: number) => {
      if (!map) return
      map.flyTo([y, x], Math.max(zoom ?? 0, map.getZoom()), { duration: 0.6 })
    },
  }
}
