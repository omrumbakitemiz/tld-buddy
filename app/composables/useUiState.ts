import { ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'

/** UI-only state shared between the shell, the map and the panels (per device, never synced). */

export type PanelTab = 'loot' | 'places' | 'maps'
export type LootFilter = 'remaining' | 'all' | 'looted'

const panelOpen = useLocalStorage('tld-buddy-ui-panel-open', true)
const panelTab = useLocalStorage<PanelTab>('tld-buddy-ui-panel-tab', 'loot')
const hideLooted = useLocalStorage('tld-buddy-ui-hide-looted', false)
const lootFilter = useLocalStorage<LootFilter>('tld-buddy-ui-loot-filter', 'remaining')
/** Dim the bright cream map images for dark rooms */
const nightMap = useLocalStorage('tld-buddy-ui-night-map', true)
/** Draw the breadcrumb trail of where the player walked in game */
const showTrail = useLocalStorage('tld-buddy-ui-show-trail', true)
/** Keep the map centred on the player while the game runs; dragging the map turns it off */
const followPlayer = useLocalStorage('tld-buddy-ui-follow-player', true)

const selectedMarkerId = ref<string | null>(null)
/** Several markers drawn as one tile, picked together */
const selectedGroupIds = ref<string[] | null>(null)
const selectedPOIId = ref<string | null>(null)
/** Map is waiting for a click to place new loot */
const placingLoot = ref(false)
/** Map is waiting for a click to pin this POI */
const pinningPOIId = ref<string | null>(null)

const showRuns = ref(false)
const showSearch = ref(false)
const showShortcuts = ref(false)
const showPOIConfig = ref(false)

function openPanel(tab: PanelTab) {
  panelTab.value = tab
  panelOpen.value = true
}

const isPhone = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches

function selectMarker(id: string | null) {
  selectedMarkerId.value = id
  selectedGroupIds.value = null
  if (id) {
    selectedPOIId.value = null
    // On phones the bottom sheet would cover the loot card
    if (isPhone()) panelOpen.value = false
  }
}

function selectGroup(ids: string[]) {
  selectedMarkerId.value = null
  selectedGroupIds.value = ids
  selectedPOIId.value = null
  if (isPhone()) panelOpen.value = false
}

function selectPOI(id: string | null) {
  selectedPOIId.value = id
  if (id) {
    selectedMarkerId.value = null
    selectedGroupIds.value = null
    openPanel('places')
  }
}

function cancelPlacement() {
  placingLoot.value = false
  pinningPOIId.value = null
}

export function useUiState() {
  return {
    panelOpen,
    panelTab,
    hideLooted,
    lootFilter,
    nightMap,
    showTrail,
    followPlayer,
    selectedMarkerId,
    selectedGroupIds,
    selectedPOIId,
    placingLoot,
    pinningPOIId,
    showRuns,
    showSearch,
    showShortcuts,
    showPOIConfig,
    openPanel,
    selectMarker,
    selectGroup,
    selectPOI,
    cancelPlacement,
  }
}
