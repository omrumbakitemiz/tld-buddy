<template>
  <Dialog :open="open" @update:open="(val) => $emit('update:open', val)">
    <DialogScrollContent class="surface-card sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Places to track</DialogTitle>
        <DialogDescription>
          Tracked places show up in the Places tab, where you can pin them on the map and keep stashes.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-3 py-3">
        <!-- Search -->
        <Input
          v-model="searchQuery"
          placeholder="Search all places…"
          class="h-8 text-sm"
        />

        <!-- Region selector -->
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="region in regionOptions"
            :key="region.mapId"
            @click="selectedRegion = region.mapId"
            :class="cn(
              'inline-flex h-7 items-center rounded-md border px-2 text-xs transition-colors',
              selectedRegion === region.mapId
                ? 'border-primary/60 bg-primary/15 text-foreground'
                : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
            )"
          >
            {{ region.name }}
            <span class="ml-1 opacity-60">{{ region.enabledCount }}/{{ region.totalCount }}</span>
          </button>
        </div>

        <!-- Bulk actions -->
        <div v-if="selectedRegion" class="flex items-center gap-2">
          <Button variant="outline" size="sm" class="h-7 text-xs" @click="enableAllInRegion">
            Track all
          </Button>
          <Button variant="outline" size="sm" class="h-7 text-xs" @click="disableAllInRegion">
            Track none
          </Button>
          <span class="text-xs text-muted-foreground ml-auto">
            {{ regionEnabledCount }} of {{ regionPOIs.length }} tracked
          </span>
        </div>

        <!-- POI list for selected region -->
        <div class="h-[280px] overflow-y-auto rounded-lg border border-border">
          <div class="p-1.5 space-y-0.5">
            <button
              v-for="poi in filteredPOIs"
              :key="poi.id"
              type="button"
              role="checkbox"
              :aria-checked="isPOIEnabled(poi.id)"
              @click="togglePOI(poi.id)"
              :class="cn(
                'flex w-full items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors text-sm',
                isPOIEnabled(poi.id)
                  ? 'border border-place/40 bg-accent'
                  : 'border border-transparent hover:bg-accent/60'
              )"
            >
              <!-- Toggle indicator -->
              <span
                :class="cn(
                  'h-4 w-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors',
                  isPOIEnabled(poi.id)
                    ? 'bg-primary border-primary'
                    : 'border-muted-foreground/40'
                )"
              >
                <CheckIcon v-if="isPOIEnabled(poi.id)" class="h-3 w-3 text-primary-foreground" />
              </span>

              <span class="flex-1 min-w-0">
                <span class="font-medium">{{ poi.name }}</span>
              </span>

              <!-- Feature badges -->
              <span class="flex items-center gap-1 shrink-0">
                <span v-if="poi.hasForge" class="text-[11px] text-muted-foreground">Forge</span>
                <span v-if="poi.hasWorkbench" class="text-[11px] text-muted-foreground">Bench</span>
                <span v-if="poi.hasBed" class="text-[11px] text-muted-foreground">Bed</span>
              </span>
            </button>

            <div v-if="filteredPOIs.length === 0" class="text-center py-6 text-muted-foreground text-sm">
              {{ searchQuery ? 'No locations match your search' : 'Select a region above' }}
            </div>
          </div>
        </div>

        <!-- Global stats -->
        <div class="text-xs text-muted-foreground">
          {{ enabledPOIs.length }} places tracked across all regions
        </div>
      </div>
    </DialogScrollContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { CheckIcon } from '@lucide/vue'
import { Dialog, DialogScrollContent, DialogDescription, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { useGameData } from '~/composables/useGameData'
import { cn } from '~/lib/utils'

defineProps<{ open: boolean }>()
defineEmits<{ 'update:open': [value: boolean] }>()

const {
  maps, pois, enabledPOIs, currentMapId,
  togglePOI, enablePOIs, disablePOIs, isPOIEnabled,
} = useGameData()

const searchQuery = ref('')
// Start on the region you're looking at
const selectedRegion = ref<string | null>(currentMapId.value)

/** Region options with counts */
const regionOptions = computed(() => {
  return maps.value.map((m) => {
    const regionPois = pois.value.filter((p) => p.mapId === m.id)
    const enabled = regionPois.filter((p) => isPOIEnabled(p.id)).length
    return {
      mapId: m.id,
      name: m.name,
      totalCount: regionPois.length,
      enabledCount: enabled,
    }
  }).filter((r) => r.totalCount > 0)
})

/** POIs for the selected region */
const regionPOIs = computed(() => {
  if (!selectedRegion.value) return []
  return pois.value.filter((p) => p.mapId === selectedRegion.value)
})

const regionEnabledCount = computed(() =>
  regionPOIs.value.filter((p) => isPOIEnabled(p.id)).length,
)

/** Filtered POIs (search applies across all regions or within selected) */
const filteredPOIs = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()

  if (q) {
    // Search across all regions
    return pois.value.filter((p) => p.name.toLowerCase().includes(q))
  }

  // Show selected region's POIs
  return regionPOIs.value
})

function enableAllInRegion() {
  const ids = regionPOIs.value.map((p) => p.id)
  enablePOIs(ids)
}

function disableAllInRegion() {
  const ids = regionPOIs.value.map((p) => p.id)
  disablePOIs(ids)
}
</script>
