<template>
  <div v-if="auth.state.value === 'checking'" class="grid h-dvh place-items-center bg-background text-muted-foreground">
    <LoaderIcon class="size-6 animate-spin" aria-label="Loading" />
  </div>

  <LoginScreen v-else-if="auth.state.value === 'signed-out'" @authenticated="auth.signedIn" />

  <div v-else class="flex h-dvh w-screen flex-col overflow-hidden bg-background text-foreground">
    <NuxtRouteAnnouncer />
    <AppTopBar @logout="auth.logout" />
    <SyncBanner />
    <GameRunBanner />

    <div class="relative flex min-h-0 flex-1">
      <TravelModeView v-if="travelMode" class="flex-1" />
      <template v-else>
        <SidePanel @fly-to="flyTo" @edit="(m) => (editingMarker = m)" @add-loot="startAddLoot('panel')" />

        <!-- isolate creates a stacking context that contains Leaflet's internal z-indexes -->
        <main class="relative isolate min-w-0 flex-1">
          <InteractiveMap ref="mapRef" @request-add-marker="onRequestAddMarker" />
          <AddUiHost />

          <div class="pointer-events-none absolute inset-x-0 bottom-4 z-[550] flex justify-center px-3">
            <div ref="cardSlotRef" class="pointer-events-auto">
              <LootCard
                v-if="selectedMarkers.length"
                :markers="selectedMarkers"
                @close="ui.selectMarker(null)"
                @edit="(m) => (editingMarker = m)"
                @delete="(id) => (pendingDeleteMarkerId = id)"
                @open="(id) => ui.selectMarker(id)"
              />
              <Button
                v-else-if="currentMap && !ui.placingLoot.value && !ui.pinningPOIId.value && !addUi.hideAddButton.value"
                size="lg"
                class="h-11 rounded-full px-5 shadow-[0_6px_20px_oklch(0.1_0.02_258/0.55)]"
                title="Add loot (A) — or right-click / long-press the map"
                @click="startAddLoot('button')"
              >
                <PlusIcon class="size-4" /> Add loot
                <kbd class="ml-1 hidden rounded bg-primary-foreground/15 px-1 text-[10px] sm:inline">A</kbd>
              </Button>
            </div>
          </div>
        </main>
      </template>
    </div>

    <RunSelector v-model:open="ui.showRuns.value" />
    <POIConfig v-model:open="ui.showPOIConfig.value" />
    <SearchPalette v-model:open="ui.showSearch.value" @fly-to="flyTo" @action="onPaletteAction" />
    <ShortcutsDialog v-model:open="ui.showShortcuts.value" />

    <MarkerDialog :show="!!pendingMarkerPosition" @close="pendingMarkerPosition = null" @save="onSaveMarker" />
    <MarkerEditDialog
      :marker="editingMarker"
      @close="editingMarker = null"
      @save="onUpdateMarker"
      @delete="(id) => { editingMarker = null; pendingDeleteMarkerId = id }"
    />
    <ConfirmDialog
      :open="!!pendingDeleteMarkerId"
      title="Delete this loot marker?"
      description="It disappears from the map for this run. If you took it, use “Mark looted” instead to keep the record."
      confirm-label="Delete"
      @update:open="(v) => { if (!v) pendingDeleteMarkerId = null }"
      @confirm="confirmDeleteMarker"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { LoaderIcon, PlusIcon } from '@lucide/vue'
import { Button } from '~/components/ui/button'
import AppTopBar from '~/components/AppTopBar.vue'
import AddUiHost from '~/components/add/AddUiHost.vue'
import ConfirmDialog from '~/components/ConfirmDialog.vue'
import InteractiveMap from '~/components/InteractiveMap.vue'
import LoginScreen from '~/components/LoginScreen.vue'
import LootCard from '~/components/LootCard.vue'
import MarkerDialog from '~/components/MarkerDialog.vue'
import MarkerEditDialog from '~/components/MarkerEditDialog.vue'
import POIConfig from '~/components/POIConfig.vue'
import RunSelector from '~/components/RunSelector.vue'
import SearchPalette from '~/components/SearchPalette.vue'
import ShortcutsDialog from '~/components/ShortcutsDialog.vue'
import SidePanel from '~/components/SidePanel.vue'
import SyncBanner from '~/components/SyncBanner.vue'
import GameRunBanner from '~/components/GameRunBanner.vue'
import TravelModeView from '~/components/TravelModeView.vue'
import { useAddItem } from '~/composables/useAddItem'
import { useAddUi, type AddRequest } from '~/composables/useAddUi'
import { useAuth } from '~/composables/useAuth'
import { useGameData } from '~/composables/useGameData'
import { useLiveGame } from '~/composables/useLiveGame'
import { useShortcuts } from '~/composables/useShortcuts'
import { useUiState, type PanelTab } from '~/composables/useUiState'
import type { Marker } from '~/types'

const auth = useAuth()
const ui = useUiState()
const live = useLiveGame()
const addUi = useAddUi()
const addItem = useAddItem()
const {
  maps, markers, currentMap, currentMapId, currentRun, addMarker, updateMarker, setLooted, toggleLooted,
  deleteMarker, setCurrentMap, getItemById, travelMode, toggleTravelMode, authExpired, apiSynced,
} = useGameData()

const mapRef = ref<InstanceType<typeof InteractiveMap> | null>(null)
const pendingMarkerPosition = ref<{ x: number; y: number } | null>(null)
const editingMarker = ref<Marker | null>(null)
const pendingDeleteMarkerId = ref<string | null>(null)

const selectedMarker = computed(() => markers.value.find((m) => m.id === ui.selectedMarkerId.value) ?? null)
/** What the loot card shows: one marker, or every marker of a grouped tile */
const selectedMarkers = computed(() => {
  if (selectedMarker.value) return [selectedMarker.value]
  const ids = new Set(ui.selectedGroupIds.value ?? [])
  return ids.size ? markers.value.filter((m) => ids.has(m.id)) : []
})
const cardSlotRef = ref<HTMLElement | null>(null)

// Keep the selected loot visible: if the card would cover it, pan the map up a little
watch(() => selectedMarkers.value.map((m) => m.id).join(','), async (ids) => {
  if (!ids) return
  await nextTick()
  await new Promise((r) => requestAnimationFrame(r))
  const card = cardSlotRef.value?.getBoundingClientRect()
  const list = selectedMarkers.value
  if (!card || !list.length) return
  const center = { x: list.reduce((a, m) => a + m.x, 0) / list.length, y: list.reduce((a, m) => a + m.y, 0) / list.length }
  mapRef.value?.revealPosition(center, card)
})

onMounted(() => {
  // Phones start with the map, not the bottom sheet
  if (window.matchMedia('(max-width: 767px)').matches) ui.panelOpen.value = false
  auth.check()
})

// API answered 401 → back to the login screen
watch(authExpired, (expired) => {
  if (!expired) return
  authExpired.value = false
  auth.expired()
})

// First visit: open a map, and ask for a run once data has loaded
watch([apiSynced, () => maps.value.length], ([synced, mapCount]) => {
  if (!synced || !mapCount) return
  if (!currentMapId.value && maps.value[0]) setCurrentMap(maps.value[0].id)
  if (!currentRun.value) ui.showRuns.value = true
}, { immediate: true })

// Follow the game into a new region. Only on a change in the game, so browsing other maps
// while playing is not undone every second.
watch(() => live.position.value?.mapId, (mapId) => {
  if (mapId && mapId !== currentMapId.value && !travelMode.value) setCurrentMap(mapId)
})

// Switching maps or runs drops selections that no longer apply
watch([currentMapId, () => currentRun.value?.id], () => {
  if (selectedMarkers.value.some((m) => m.mapId !== currentMapId.value)) ui.selectMarker(null)
  ui.cancelPlacement()
})

function flyTo(target: { x: number; y: number; mapId: string }) {
  if (target.mapId !== currentMapId.value) setCurrentMap(target.mapId)
  nextTick(() => mapRef.value?.flyToPosition(target, target.mapId))
  if (window.matchMedia('(max-width: 767px)').matches) ui.panelOpen.value = false
}

function startAddLoot(source: AddRequest['source'] = 'key') {
  if (!currentRun.value) {
    ui.showRuns.value = true
    return
  }
  ui.selectMarker(null)
  ui.pinningPOIId.value = null
  // The add-item variant being tried owns the flow (docs/add-item); the pointer is the spot when it's over the map
  const variant = addUi.handlers()
  if (variant?.start) {
    const p = addUi.pointer.value
    variant.start(p ? { pos: p.pos, client: p.client, source } : null)
    return
  }
  ui.placingLoot.value = true
  // On phones the sheet covers the map you need to tap
  if (window.matchMedia('(max-width: 767px)').matches) ui.panelOpen.value = false
}

function onRequestAddMarker(req: AddRequest) {
  if (!currentRun.value) {
    ui.showRuns.value = true
    return
  }
  const variant = addUi.handlers()
  if (variant?.request) variant.request(req)
  else pendingMarkerPosition.value = req.pos
}

function onSaveMarker(data: { items: Array<{ itemId: string; name: string; quantity: number }>; note: string }) {
  const pos = pendingMarkerPosition.value
  if (!pos || !currentMap.value || !currentRun.value) return

  // Several items at one spot get slightly different positions; on screen they are drawn
  // as one grouped tile until you zoom in far enough to tell them apart
  const SPREAD_RADIUS = 12
  const count = data.items.length
  let last: Marker | null = null
  data.items.forEach((entry, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2
    last = addMarker({
      runId: currentRun.value!.id,
      mapId: currentMap.value!.id,
      itemId: entry.itemId,
      name: entry.name || getItemById(entry.itemId)?.name || 'Loot',
      x: count > 1 ? pos.x + Math.cos(angle) * SPREAD_RADIUS : pos.x,
      y: count > 1 ? pos.y + Math.sin(angle) * SPREAD_RADIUS : pos.y,
      quantity: entry.quantity,
      note: data.note || undefined,
    })
  })
  pendingMarkerPosition.value = null
  if (count === 1 && last) ui.selectMarker((last as Marker).id)
}

function onUpdateMarker(data: { id: string; itemId: string; name: string; quantity: number; note: string; looted: boolean }) {
  updateMarker(data.id, { itemId: data.itemId, name: data.name, quantity: data.quantity, note: data.note })
  setLooted(data.id, data.looted)
  editingMarker.value = null
}

function confirmDeleteMarker() {
  const id = pendingDeleteMarkerId.value
  if (!id) return
  deleteMarker(id)
  if (ui.selectedMarkerId.value === id) ui.selectMarker(null)
  pendingDeleteMarkerId.value = null
}

function onPaletteAction(name: 'add-loot' | 'travel' | 'runs' | 'shortcuts' | 'hide-looted') {
  if (name === 'add-loot') startAddLoot('palette')
  else if (name === 'travel') toggleTravelMode()
  else if (name === 'runs') ui.showRuns.value = true
  else if (name === 'shortcuts') ui.showShortcuts.value = true
  else ui.hideLooted.value = !ui.hideLooted.value
}

const anyDialogOpen = computed(() =>
  ui.showRuns.value || ui.showSearch.value || ui.showShortcuts.value || ui.showPOIConfig.value
  || !!pendingMarkerPosition.value || !!editingMarker.value || !!pendingDeleteMarkerId.value,
)

useShortcuts(() => {
  if (auth.state.value !== 'signed-in') return []
  const tabs: PanelTab[] = ['loot', 'places', 'maps']
  const onMap = !travelMode.value
  return [
    { key: 'k', mod: true, allowInInput: true, handler: () => (ui.showSearch.value = !ui.showSearch.value) },
    // Undo the last add (any variant); typing fields keep their own Ctrl+Z
    ...(onMap && addItem.canUndo.value ? [{ key: 'z', mod: true, handler: () => {
      const n = addItem.undo()
      addUi.announce(n ? 'Undone' : 'Nothing to undo')
    } }] : []),
    // An open add-item UI owns the keyboard
    ...(anyDialogOpen.value || addUi.active.value ? [] : [
      { key: '/', handler: () => (ui.showSearch.value = true) },
      { key: '?', handler: () => (ui.showShortcuts.value = true) },
      { key: 't', handler: () => toggleTravelMode() },
      { key: 'r', handler: () => (ui.showRuns.value = true) },
      { key: 'h', handler: () => (ui.hideLooted.value = !ui.hideLooted.value) },
      { key: 'n', handler: () => (ui.nightMap.value = !ui.nightMap.value) },
      ...(onMap ? [
        { key: 'Escape', handler: () => {
          if (ui.placingLoot.value || ui.pinningPOIId.value) ui.cancelPlacement()
          else if (selectedMarkers.value.length) ui.selectMarker(null)
          else ui.selectedPOIId.value = null
        } },
        { key: 'a', handler: () => startAddLoot('key') },
        // '[' needs AltGr on Turkish Q and other layouts: match the physical key too, and offer P
        { key: '[', code: 'BracketLeft', handler: () => (ui.panelOpen.value = !ui.panelOpen.value) },
        { key: 'p', handler: () => (ui.panelOpen.value = !ui.panelOpen.value) },
        ...tabs.map((tab, i) => ({ key: String(i + 1), handler: () => ui.openPanel(tab) })),
        { key: 'f', handler: () => mapRef.value?.fit() },
        { key: '+', handler: () => mapRef.value?.zoomIn() },
        { key: '=', handler: () => mapRef.value?.zoomIn() },
        { key: '-', handler: () => mapRef.value?.zoomOut() },
        ...(selectedMarker.value ? [
          { key: 'l', handler: () => toggleLooted(selectedMarker.value!.id) },
          { key: 'e', handler: () => (editingMarker.value = selectedMarker.value) },
          { key: 'Delete', handler: () => (pendingDeleteMarkerId.value = selectedMarker.value!.id) },
          { key: 'Backspace', handler: () => (pendingDeleteMarkerId.value = selectedMarker.value!.id) },
        ] : []),
      ] : []),
    ]),
  ]
})
</script>
