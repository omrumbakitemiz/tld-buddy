<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="flex items-center gap-2 px-3 pb-2 pt-3">
      <div class="relative flex-1">
        <SearchIcon class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input v-model="query" placeholder="Filter places…" class="h-9 pl-8" aria-label="Filter places on this map" />
      </div>
      <Button variant="outline" size="icon" class="size-9 shrink-0" aria-label="Choose which places to track" title="Choose which places to track" @click="showPOIConfig = true">
        <SlidersHorizontalIcon class="size-4" />
      </Button>
    </div>

    <ul ref="listRef" class="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3" aria-label="Places on this map">
      <li
        v-for="poi in list"
        :key="poi.id"
        :data-poi="poi.id"
        :class="cn('rounded-lg border transition-colors', open === poi.id ? 'border-place/50 bg-accent/70' : 'border-transparent hover:bg-accent/50')"
      >
        <button
          type="button"
          class="flex w-full items-center gap-2.5 p-2 text-left"
          :aria-expanded="open === poi.id"
          @click="toggle(poi.id)"
        >
          <MapPinIcon v-if="getPOIPin(poi.id)" class="size-4 shrink-0 text-place" aria-label="Pinned" />
          <MapPinOffIcon v-else class="size-4 shrink-0 text-muted-foreground/60" aria-label="Not pinned yet" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm">{{ poi.name }}</span>
            <span class="flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
              <span v-if="poi.type" class="capitalize">{{ poi.type }}</span>
              <span v-for="f in features(poi)" :key="f">{{ f }}</span>
            </span>
          </span>
          <span v-if="getStashedItemCount(poi.id)" class="tabular rounded-md bg-secondary px-1.5 py-0.5 text-[11px] text-secondary-foreground">
            {{ getStashedItemCount(poi.id) }} stashed
          </span>
          <ChevronDownIcon :class="cn('size-4 shrink-0 text-muted-foreground transition-transform', open === poi.id && 'rotate-180')" />
        </button>

        <div v-if="open === poi.id" class="space-y-3 px-2 pb-2.5">
          <div class="flex flex-wrap gap-1.5">
            <template v-if="getPOIPin(poi.id)">
              <Button size="sm" variant="outline" @click="flyTo(poi.id)">
                <NavigationIcon class="size-3.5" /> Show on map
              </Button>
              <Button size="sm" variant="ghost" @click="startPin(poi.id)">Move pin</Button>
              <Button size="sm" variant="ghost" class="text-muted-foreground" @click="unpinPOI(poi.id)">Unpin</Button>
            </template>
            <Button v-else size="sm" @click="startPin(poi.id)">
              <MapPinIcon class="size-3.5" /> Pin on map
            </Button>
          </div>

          <section :aria-label="`Stash at ${poi.name}`">
            <h3 class="hud-label mb-1 text-muted-foreground">Stash{{ currentRun ? '' : ' (pick a run first)' }}</h3>
            <ul v-if="getStashedItems(poi.id).length" class="space-y-1">
              <li v-for="s in getStashedItems(poi.id)" :key="s.id" class="flex items-center gap-2 rounded-md bg-background/50 py-1 pl-1.5 pr-1">
                <img v-if="getItemById(s.itemId)?.icon" :src="getItemById(s.itemId)!.icon!" alt="" class="size-6 object-contain">
                <span class="min-w-0 flex-1 truncate text-sm">{{ getItemById(s.itemId)?.name ?? 'Unknown item' }}</span>
                <QuantityStepper
                  :model-value="s.quantity"
                  :label="getItemById(s.itemId)?.name ?? 'item'"
                  allow-zero
                  @update:model-value="(q) => setStashedQuantity(s.id, q)"
                />
                <Button size="icon" variant="ghost" class="size-8" :aria-label="`Take all ${getItemById(s.itemId)?.name ?? 'items'} out of the stash`" @click="removeStashedItem(s.id)">
                  <XIcon class="size-4" />
                </Button>
              </li>
            </ul>
            <p v-else-if="!adding" class="text-xs text-muted-foreground">Nothing stashed here.</p>

            <div v-if="adding" class="mt-2 space-y-2 rounded-lg border border-border bg-background/40 p-2">
              <ItemPicker max-height="11rem" placeholder="What are you stashing?" @pick="(item) => stash(poi.id, item.id)" />
              <Button size="sm" variant="ghost" class="w-full" @click="adding = false">Done</Button>
            </div>
            <Button v-else-if="currentRun" size="sm" variant="outline" class="mt-2 w-full" @click="adding = true">
              <PlusIcon class="size-3.5" /> Stash an item
            </Button>
          </section>

          <a v-if="poi.wikiUrl" :href="poi.wikiUrl" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Wiki <ExternalLinkIcon class="size-3" />
          </a>
        </div>
      </li>
    </ul>

    <div v-if="!list.length" class="px-6 pb-8 text-center text-sm text-muted-foreground">
      <template v-if="!currentMap">Pick a map first.</template>
      <template v-else-if="query">No places match “{{ query }}”.</template>
      <template v-else-if="currentMapAllPOIs.length">
        <p class="text-foreground">No places tracked on {{ currentMap.name }}</p>
        <p class="mt-1">Track the ones you care about to pin them and keep stashes there.</p>
        <Button class="mt-3" size="sm" @click="enablePOIs(currentMapAllPOIs.map((p) => p.id))">
          Track all {{ currentMapAllPOIs.length }} places
        </Button>
        <Button class="mt-3 ml-1" size="sm" variant="ghost" @click="showPOIConfig = true">Choose…</Button>
      </template>
      <template v-else>No known places on this map.</template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import Fuse from 'fuse.js'
import {
  ChevronDownIcon, ExternalLinkIcon, MapPinIcon, MapPinOffIcon, NavigationIcon,
  PlusIcon, SearchIcon, SlidersHorizontalIcon, XIcon,
} from '@lucide/vue'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import ItemPicker from '~/components/ItemPicker.vue'
import QuantityStepper from '~/components/QuantityStepper.vue'
import { useGameData } from '~/composables/useGameData'
import { useUiState } from '~/composables/useUiState'
import { cn } from '~/lib/utils'
import type { POI } from '~/types'

const emit = defineEmits<{ 'fly-to': [target: { x: number; y: number; mapId: string }] }>()

const {
  currentMap, currentRun, currentMapPOIs, currentMapAllPOIs, getItemById,
  getPOIPin, unpinPOI, getStashedItems, getStashedItemCount, addStashedItem,
  setStashedQuantity, removeStashedItem, enablePOIs,
} = useGameData()
const { selectedPOIId, pinningPOIId, placingLoot, showPOIConfig, panelOpen } = useUiState()

const query = ref('')
const adding = ref(false)
const listRef = ref<HTMLElement | null>(null)
const open = computed(() => selectedPOIId.value)

const list = computed(() => {
  const q = query.value.trim()
  if (!q) return currentMapPOIs.value
  return new Fuse(currentMapPOIs.value, { keys: ['name', 'type'], threshold: 0.35, ignoreLocation: true }).search(q).map((r) => r.item)
})

function features(poi: POI) {
  return [poi.hasBed && 'Bed', poi.hasWorkbench && 'Workbench', poi.hasForge && 'Forge'].filter(Boolean) as string[]
}

function toggle(id: string) {
  selectedPOIId.value = selectedPOIId.value === id ? null : id
}

// Opening a place from the map scrolls it into view
watch(selectedPOIId, (id) => {
  adding.value = false
  if (!id) return
  nextTick(() => listRef.value?.querySelector(`[data-poi="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
})

function flyTo(poiId: string) {
  const pin = getPOIPin(poiId)
  if (pin && currentMap.value) emit('fly-to', { x: pin.x, y: pin.y, mapId: currentMap.value.id })
}

function startPin(poiId: string) {
  placingLoot.value = false
  pinningPOIId.value = poiId
  // On phones the sheet covers the map; get it out of the way
  if (window.matchMedia('(max-width: 767px)').matches) panelOpen.value = false
}

function stash(poiId: string, itemId: string) {
  if (!currentRun.value) return
  addStashedItem({ runId: currentRun.value.id, poiId, itemId, quantity: 1 })
}
</script>
