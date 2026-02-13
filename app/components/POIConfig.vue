<template>
  <Dialog :open="open" @update:open="(val) => $emit('update:open', val)">
    <DialogScrollContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>POI Settings</DialogTitle>
        <DialogDescription>
          Enable locations you want to track across your maps
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-3 py-3">
        <!-- Search -->
        <Input
          v-model="searchQuery"
          placeholder="Search locations..."
          class="h-8 text-sm"
        />

        <!-- Region selector -->
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="region in regionOptions"
            :key="region.mapId"
            @click="selectedRegion = region.mapId"
            :class="cn(
              'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium border transition-colors cursor-pointer',
              selectedRegion === region.mapId
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-muted/50 text-muted-foreground border-border hover:border-primary/40'
            )"
          >
            {{ region.name }}
            <span class="ml-1 opacity-60">{{ region.enabledCount }}/{{ region.totalCount }}</span>
          </button>
        </div>

        <!-- Bulk actions -->
        <div v-if="selectedRegion" class="flex items-center gap-2">
          <Button variant="outline" size="sm" class="h-7 text-xs" @click="enableAllInRegion">
            Enable All
          </Button>
          <Button variant="outline" size="sm" class="h-7 text-xs" @click="disableAllInRegion">
            Disable All
          </Button>
          <span class="text-xs text-muted-foreground ml-auto">
            {{ regionEnabledCount }} / {{ regionPOIs.length }} enabled
          </span>
        </div>

        <!-- POI list for selected region -->
        <div class="h-[280px] overflow-y-auto rounded-lg border border-border">
          <div class="p-1.5 space-y-0.5">
            <div
              v-for="poi in filteredPOIs"
              :key="poi.id"
              @click="togglePOI(poi.id)"
              :class="cn(
                'flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-pointer transition-all text-sm',
                isPOIEnabled(poi.id)
                  ? 'bg-primary/10 border border-primary/30'
                  : 'hover:bg-accent border border-transparent'
              )"
            >
              <!-- Toggle indicator -->
              <div
                :class="cn(
                  'h-4 w-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors',
                  isPOIEnabled(poi.id)
                    ? 'bg-primary border-primary'
                    : 'border-muted-foreground/40'
                )"
              >
                <CheckIcon v-if="isPOIEnabled(poi.id)" class="h-3 w-3 text-primary-foreground" />
              </div>

              <div class="flex-1 min-w-0">
                <span class="font-medium">{{ poi.name }}</span>
              </div>

              <!-- Feature badges -->
              <div class="flex items-center gap-1 shrink-0">
                <span v-if="poi.hasForge" class="text-[10px] px-1.5 py-0 rounded bg-orange-500/20 text-orange-400 font-medium">Forge</span>
                <span v-if="poi.hasWorkbench" class="text-[10px] px-1.5 py-0 rounded bg-blue-500/20 text-blue-400 font-medium">Bench</span>
                <span v-if="poi.hasBed" class="text-[10px] px-1.5 py-0 rounded bg-emerald-500/20 text-emerald-400 font-medium">Bed</span>
                <span v-if="poi.hasShelter" class="text-[10px] px-1.5 py-0 rounded bg-purple-500/20 text-purple-400 font-medium">Shelter</span>
              </div>
            </div>

            <div v-if="filteredPOIs.length === 0" class="text-center py-6 text-muted-foreground text-sm">
              {{ searchQuery ? 'No locations match your search' : 'Select a region above' }}
            </div>
          </div>
        </div>

        <!-- Global stats -->
        <div class="text-xs text-muted-foreground">
          {{ enabledPOIs.length }} locations enabled across all regions
        </div>
      </div>
    </DialogScrollContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { CheckIcon } from 'lucide-vue-next'
import { Dialog, DialogScrollContent, DialogDescription, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { useGameData } from '~/composables/useGameData'
import { cn } from '~/lib/utils'

defineProps<{ open: boolean }>()
defineEmits<{ 'update:open': [value: boolean] }>()

const {
  maps, pois, enabledPOIs,
  togglePOI, enablePOIs, disablePOIs, isPOIEnabled,
} = useGameData()

const searchQuery = ref('')
const selectedRegion = ref<string | null>(null)

/** Region options with counts */
const regionOptions = computed(() => {
  return maps.value.map((m) => {
    const regionPois = pois.value.filter((p) => p.mapId === m.id)
    const enabled = regionPois.filter((p) => enabledPOIs.value.includes(p.id)).length
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
