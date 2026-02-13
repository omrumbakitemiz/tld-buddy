<template>
  <Sheet :open="open" @update:open="$emit('update:open', $event)">
    <SheetContent side="right" class="w-96 p-0 flex flex-col h-full max-h-screen">
      <SheetHeader class="px-5 pt-5 pb-0 shrink-0">
        <SheetTitle class="text-base">Locations</SheetTitle>
        <SheetDescription class="text-xs text-muted-foreground">
          {{ currentMap ? currentMap.name : 'No map selected' }}
          <span v-if="currentMapPOIs.length" class="text-primary"> &middot; {{ currentMapPOIs.length }} enabled</span>
        </SheetDescription>
      </SheetHeader>

      <div class="px-4 pt-3 shrink-0">
        <Input
          v-model="searchQuery"
          placeholder="Search locations..."
          class="h-8 text-sm"
        />
      </div>

      <Separator class="my-3 shrink-0" />

      <div class="flex-1 min-h-0 overflow-y-auto px-3">
        <div class="space-y-1.5 pb-4">
          <div
            v-for="poi in filteredPOIs"
            :key="poi.id"
            class="rounded-lg border border-border bg-card overflow-hidden"
          >
            <!-- POI header (always visible) -->
            <div
              class="flex items-center gap-2 p-2.5 cursor-pointer hover:bg-accent/50 transition-colors"
              @click="toggleExpanded(poi.id)"
            >
              <LandmarkIcon class="h-4 w-4 text-primary shrink-0" />

              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold truncate">{{ poi.name }}</p>
                <div class="flex items-center gap-1 mt-0.5">
                  <span v-if="poi.type" class="text-[10px] text-muted-foreground capitalize">{{ poi.type }}</span>
                  <span v-if="poi.hasForge" class="text-[10px] px-1 rounded bg-orange-500/20 text-orange-400">Forge</span>
                  <span v-if="poi.hasWorkbench" class="text-[10px] px-1 rounded bg-blue-500/20 text-blue-400">Bench</span>
                  <span v-if="poi.hasBed" class="text-[10px] px-1 rounded bg-emerald-500/20 text-emerald-400">Bed</span>
                </div>
              </div>

              <!-- Stash count -->
              <Badge v-if="getStashedItemCount(poi.id) > 0" variant="secondary" class="text-[10px] px-1.5 py-0 h-4 shrink-0">
                {{ getStashedItemCount(poi.id) }} items
              </Badge>

              <!-- Pin indicator -->
              <MapPinIcon v-if="getPOIPin(poi.id)" class="h-3.5 w-3.5 text-primary shrink-0" />

              <ChevronDownIcon
                :class="cn('h-4 w-4 text-muted-foreground transition-transform shrink-0', expandedPOI === poi.id && 'rotate-180')"
              />
            </div>

            <!-- Expanded content -->
            <div v-if="expandedPOI === poi.id" class="border-t border-border px-2.5 py-2.5 space-y-2.5">
              <!-- Action buttons -->
              <div class="flex items-center gap-1.5">
                <Button
                  v-if="!getPOIPin(poi.id)"
                  variant="outline"
                  size="sm"
                  class="h-7 text-xs"
                  @click="startPinning(poi.id)"
                >
                  <MapPinIcon class="h-3 w-3 mr-1" />
                  Pin to Map
                </Button>
                <Button
                  v-else
                  variant="outline"
                  size="sm"
                  class="h-7 text-xs"
                  @click="handleFlyTo(poi.id)"
                >
                  <NavigationIcon class="h-3 w-3 mr-1" />
                  Fly to
                </Button>
                <Button
                  v-if="getPOIPin(poi.id)"
                  variant="ghost"
                  size="sm"
                  class="h-7 text-xs text-destructive hover:text-destructive"
                  @click="unpinPOI(poi.id)"
                >
                  <XIcon class="h-3 w-3 mr-1" />
                  Unpin
                </Button>
              </div>

              <!-- Stashed items list -->
              <div v-if="getStashedItems(poi.id).length > 0" class="space-y-1">
                <p class="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Stashed Items</p>
                <div
                  v-for="stash in getStashedItems(poi.id)"
                  :key="stash.id"
                  class="flex items-center gap-2 p-1.5 rounded-md bg-muted/30"
                >
                  <img
                    v-if="getItemById(stash.itemId)?.icon"
                    :src="getItemById(stash.itemId)!.icon!"
                    class="h-5 w-5 object-contain shrink-0"
                  />
                  <span class="text-xs flex-1 min-w-0 truncate">
                    {{ getItemById(stash.itemId)?.name ?? 'Unknown' }}
                    <span v-if="stash.quantity > 1" class="text-muted-foreground">&times;{{ stash.quantity }}</span>
                  </span>
                  <span v-if="stash.note" class="text-[10px] text-muted-foreground truncate max-w-[80px]">{{ stash.note }}</span>
                  <button
                    class="h-5 w-5 flex items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0 cursor-pointer"
                    @click.stop="removeStashedItem(stash.id)"
                  >
                    <XIcon class="h-3 w-3" />
                  </button>
                </div>
              </div>

              <!-- Add item to stash -->
              <div class="space-y-1.5">
                <button
                  v-if="!showAddStash"
                  class="text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer"
                  @click="showAddStash = true"
                >
                  + Add item to stash
                </button>

                <div v-else class="space-y-1.5 p-2 rounded-md border border-border bg-muted/20">
                  <Input
                    v-model="stashItemSearch"
                    placeholder="Search items..."
                    class="h-7 text-xs"
                  />

                  <!-- Compact item grid -->
                  <div class="h-[120px] overflow-y-auto rounded border border-border">
                    <div class="p-1">
                      <TooltipProvider :delay-duration="150">
                        <div class="grid grid-cols-8 gap-1">
                          <Tooltip v-for="item in stashFilteredItems" :key="item.id">
                            <TooltipTrigger as-child>
                              <button
                                @click="stashSelectedItemId = item.id"
                                :class="cn(
                                  'h-8 w-full rounded border transition-all cursor-pointer flex items-center justify-center',
                                  stashSelectedItemId === item.id
                                    ? 'border-primary ring-1 ring-primary bg-primary/10'
                                    : 'border-border bg-muted/30 hover:border-primary/40'
                                )"
                              >
                                <img v-if="item.icon" :src="item.icon" class="h-5 w-5 object-contain" />
                                <div v-else class="h-5 w-5 rounded bg-muted/50" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" class="text-xs">{{ item.name }}</TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                    </div>
                  </div>

                  <!-- Selected item + quantity -->
                  <div v-if="stashSelectedItemId" class="flex items-center gap-1.5">
                    <span class="text-xs flex-1 truncate">{{ getItemById(stashSelectedItemId)?.name }}</span>
                    <div class="flex items-center gap-1">
                      <button
                        v-for="q in [1, 3, 5, 10]"
                        :key="q"
                        @click="stashQty = q"
                        :class="cn(
                          'px-1.5 py-0.5 text-[10px] rounded border cursor-pointer',
                          stashQty === q ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/40'
                        )"
                      >{{ q }}</button>
                    </div>
                  </div>

                  <div class="flex gap-1.5">
                    <Button
                      size="sm"
                      class="h-7 text-xs flex-1"
                      :disabled="!stashSelectedItemId"
                      @click="handleAddStash(poi.id)"
                    >
                      Add
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      class="h-7 text-xs"
                      @click="resetAddStash"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty state -->
          <div v-if="currentMapPOIs.length === 0" class="text-center py-8 text-muted-foreground text-sm">
            <LandmarkIcon class="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>No locations enabled for this map</p>
            <p class="text-xs mt-1">Open POI Settings to enable locations</p>
          </div>
          <div v-else-if="filteredPOIs.length === 0" class="text-center py-8 text-muted-foreground text-sm">
            <p>No locations match your search</p>
          </div>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  LandmarkIcon, MapPinIcon, NavigationIcon, XIcon, ChevronDownIcon,
} from 'lucide-vue-next'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '~/components/ui/sheet'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Input } from '~/components/ui/input'
import { Separator } from '~/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip'
import { useGameData } from '~/composables/useGameData'
import { cn } from '~/lib/utils'

defineProps<{ open: boolean }>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  'fly-to': [position: { x: number; y: number }]
  'start-pin': [poiId: string]
}>()

const {
  currentMap, currentRun, currentMapPOIs, items,
  getItemById, getStashedItems, getStashedItemCount,
  getPOIPin, unpinPOI, addStashedItem, removeStashedItem,
} = useGameData()

const searchQuery = ref('')
const expandedPOI = ref<string | null>(null)

// ── Stash form state ──────────────────────────────────────────────────────

const showAddStash = ref(false)
const stashItemSearch = ref('')
const stashSelectedItemId = ref('')
const stashQty = ref(1)

const stashFilteredItems = computed(() => {
  const q = stashItemSearch.value.trim().toLowerCase()
  let result = items.value.filter((i) => i.category !== 'Collectible')
  if (q) result = result.filter((i) => i.name.toLowerCase().includes(q))
  return result
})

function resetAddStash() {
  showAddStash.value = false
  stashItemSearch.value = ''
  stashSelectedItemId.value = ''
  stashQty.value = 1
}

// ── Filtered POIs ─────────────────────────────────────────────────────────

const filteredPOIs = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return currentMapPOIs.value
  return currentMapPOIs.value.filter((p) => p.name.toLowerCase().includes(q))
})

// ── Handlers ──────────────────────────────────────────────────────────────

function toggleExpanded(poiId: string) {
  if (expandedPOI.value === poiId) {
    expandedPOI.value = null
    resetAddStash()
  } else {
    expandedPOI.value = poiId
    resetAddStash()
  }
}

function startPinning(poiId: string) {
  emit('start-pin', poiId)
  emit('update:open', false)
}

function handleFlyTo(poiId: string) {
  const pin = getPOIPin(poiId)
  if (pin) {
    emit('fly-to', { x: pin.x, y: pin.y })
    emit('update:open', false)
  }
}

function handleAddStash(poiId: string) {
  if (!stashSelectedItemId.value || !currentRun.value) return
  addStashedItem({
    runId: currentRun.value.id,
    poiId,
    itemId: stashSelectedItemId.value,
    quantity: stashQty.value || 1,
  })
  resetAddStash()
}
</script>
