import { ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'

/** UI-only state shared between the shell, the map and the panels (per device, never synced). */

export type PanelTab = 'loot' | 'places' | 'maps'
export type LootFilter = 'remaining' | 'all' | 'looted'

const panelOpen = useLocalStorage('tld-buddy-ui-panel-open', true)
const panelTab = useLocalStorage<PanelTab>('tld-buddy-ui-panel-tab', 'loot')
const hideLooted = useLocalStorage('tld-buddy-ui-hide-looted', false)
const lootFilter = useLocalStorage<LootFilter>('tld-buddy-ui-loot-filter', 'remaining')

const selectedMarkerId = ref<string | null>(null)
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

function selectMarker(id: string | null) {
  selectedMarkerId.value = id
  if (id) selectedPOIId.value = null
}

function selectPOI(id: string | null) {
  selectedPOIId.value = id
  if (id) {
    selectedMarkerId.value = null
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
    selectedMarkerId,
    selectedPOIId,
    placingLoot,
    pinningPOIId,
    showRuns,
    showSearch,
    showShortcuts,
    showPOIConfig,
    openPanel,
    selectMarker,
    selectPOI,
    cancelPlacement,
  }
}
