<template>
  <Dialog :open="show" @update:open="(val) => !val && $emit('close')">
    <DialogScrollContent class="max-w-xl">
      <DialogHeader>
        <DialogTitle>Add Marker</DialogTitle>
        <DialogDescription>
          Select one or more items to mark at this map location
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-3 py-3">
        <!-- Item selection -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <Label class="text-sm font-semibold">Select Items *</Label>
            <span v-if="itemQuantities.size > 0" class="text-xs text-muted-foreground">
              {{ itemQuantities.size }} selected
            </span>
          </div>

          <!-- Frequently Used icon grid -->
          <div v-if="showFrequentSection" class="space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Frequently Used</span>
              <button
                v-if="hasMoreFrequent"
                @click="freqExpanded = !freqExpanded"
                class="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                {{ freqExpanded ? 'Show less' : 'Show more' }}
                <ChevronUpIcon v-if="freqExpanded" class="h-3 w-3" />
                <ChevronDownIcon v-else class="h-3 w-3" />
              </button>
            </div>
            <TooltipProvider :delay-duration="200">
              <div class="grid grid-cols-8 gap-1.5">
                <Tooltip v-for="freqItem in visibleFrequentItems" :key="freqItem.id">
                  <TooltipTrigger as-child>
                    <button
                      @click="toggleItemSelection(freqItem.id)"
                      :class="cn(
                        'relative h-10 w-full rounded-md border transition-all cursor-pointer flex items-center justify-center',
                        selectedItemIds.has(freqItem.id)
                          ? 'border-primary ring-1 ring-primary bg-primary/10'
                          : 'border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/60'
                      )"
                    >
                      <img
                        v-if="freqItem.icon"
                        :src="freqItem.icon"
                        :alt="freqItem.name"
                        class="h-7 w-7 object-contain"
                      />
                      <div v-else class="h-7 w-7 rounded bg-muted/50" />
                      <CheckIcon v-if="selectedItemIds.has(freqItem.id)" class="absolute -top-1 -right-1 h-3.5 w-3.5 text-primary bg-background rounded-full" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" class="text-xs">
                    {{ freqItem.name }}
                    <span class="text-muted-foreground ml-1">&times;{{ freqItem.usageCount }}</span>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>

          <!-- Search -->
          <Input
            v-model="searchQuery"
            placeholder="Search items..."
            class="h-8 text-sm"
          />

          <!-- Category filter badges -->
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="cat in availableCategories"
              :key="cat"
              @click="toggleCategory(cat)"
              :class="cn(
                'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium border transition-colors cursor-pointer',
                isCategoryActive(cat)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/50 text-muted-foreground border-border hover:border-primary/40'
              )"
            >
              {{ cat }}
              <span class="ml-1 opacity-60">{{ getCategoryCount(cat) }}</span>
            </button>
          </div>

          <!-- Item grid -->
          <div class="h-[180px] overflow-y-auto rounded-lg border border-border">
            <div class="p-1.5">
              <TooltipProvider :delay-duration="150">
                <div class="grid grid-cols-10 gap-1">
                  <Tooltip v-for="item in filteredItems" :key="item.id">
                    <TooltipTrigger as-child>
                      <button
                        @click="toggleItemSelection(item.id)"
                        :class="cn(
                          'relative h-10 w-full rounded-md border transition-all cursor-pointer flex items-center justify-center',
                          selectedItemIds.has(item.id)
                            ? 'border-primary ring-1 ring-primary bg-primary/10'
                            : 'border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/60'
                        )"
                      >
                        <img
                          v-if="item.icon"
                          :src="item.icon"
                          :alt="item.name"
                          class="h-7 w-7 object-contain"
                        />
                        <div v-else class="h-7 w-7 rounded bg-muted/50 flex items-center justify-center text-[9px] text-muted-foreground font-medium leading-tight text-center overflow-hidden px-0.5">
                          {{ item.name.substring(0, 3) }}
                        </div>
                        <CheckIcon v-if="selectedItemIds.has(item.id)" class="absolute -top-1 -right-1 h-3.5 w-3.5 text-primary bg-background rounded-full" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" class="text-xs">
                      {{ item.name }}
                      <span v-if="item.category" class="text-muted-foreground ml-1">&middot; {{ item.category }}</span>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>

              <div v-if="filteredItems.length === 0" class="text-center py-6 text-muted-foreground text-sm">
                No items match your filters
              </div>
            </div>
          </div>

          <!-- Selected items preview with per-item quantity -->
          <div v-if="selectedItems.length > 0" class="space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-muted-foreground">Selected ({{ selectedItems.length }})</span>
              <button
                v-if="selectedItems.length > 1"
                @click="itemQuantities.clear()"
                class="text-[11px] text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
              >
                Clear all
              </button>
            </div>
            <div class="flex flex-col gap-1.5">
              <div
                v-for="selItem in selectedItems"
                :key="selItem.id"
                class="flex items-center gap-2 px-2 py-1.5 rounded-md bg-primary/10 border border-primary/30 text-xs"
              >
                <img
                  v-if="selItem.icon"
                  :src="selItem.icon"
                  :alt="selItem.name"
                  class="h-5 w-5 rounded object-contain shrink-0"
                />
                <span class="font-medium truncate flex-1 min-w-0">{{ selItem.name }}</span>

                <!-- Per-item quantity controls -->
                <div class="flex items-center gap-0.5 shrink-0">
                  <button
                    @click="decrementQuantity(selItem.id)"
                    :disabled="getItemQuantity(selItem.id) <= 1"
                    :class="cn(
                      'h-5 w-5 rounded flex items-center justify-center transition-colors cursor-pointer text-[10px] font-bold',
                      getItemQuantity(selItem.id) <= 1
                        ? 'text-muted-foreground/40 cursor-not-allowed'
                        : 'hover:bg-primary/20 text-foreground'
                    )"
                  >
                    <MinusIcon class="h-3 w-3" />
                  </button>
                  <input
                    type="number"
                    :value="getItemQuantity(selItem.id)"
                    @change="(e) => setItemQuantity(selItem.id, parseInt((e.target as HTMLInputElement).value) || 1)"
                    min="1"
                    class="w-8 h-5 text-center text-xs font-semibold bg-background/60 border border-border rounded px-0 py-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    @click="incrementQuantity(selItem.id)"
                    class="h-5 w-5 rounded flex items-center justify-center hover:bg-primary/20 text-foreground transition-colors cursor-pointer text-[10px] font-bold"
                  >
                    <PlusIcon class="h-3 w-3" />
                  </button>
                </div>

                <!-- Remove button -->
                <button
                  @click="toggleItemSelection(selItem.id)"
                  class="h-4 w-4 rounded-full hover:bg-destructive/20 hover:text-destructive flex items-center justify-center transition-colors cursor-pointer shrink-0"
                >
                  <XIcon class="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- More options toggle -->
        <div>
          <button
            @click="showMoreOptions = !showMoreOptions"
            class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <ChevronRightIcon :class="cn('h-3.5 w-3.5 transition-transform', showMoreOptions && 'rotate-90')" />
            More options
            <span v-if="markerName || note" class="h-1.5 w-1.5 rounded-full bg-primary" />
          </button>

          <div v-if="showMoreOptions" class="mt-2 space-y-2.5 pl-1 border-l-2 border-border ml-1.5">
            <!-- Custom Name -->
            <div class="space-y-1 pl-3">
              <Label for="marker-name" class="text-xs">Custom Name</Label>
              <Input
                id="marker-name"
                v-model="markerName"
                :placeholder="selectedItems.length > 1 ? 'Use item names' : 'Use item name'"
                class="h-8 text-sm"
                :disabled="selectedItems.length > 1"
              />
              <span v-if="selectedItems.length > 1" class="text-[10px] text-muted-foreground">
                Each marker will use its item name
              </span>
            </div>

            <!-- Note -->
            <div class="space-y-1 pl-3">
              <Label for="note" class="text-xs">Note</Label>
              <Input
                id="note"
                v-model="note"
                placeholder="Optional notes about this location..."
                class="h-8 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" size="sm" @click="$emit('close')">Cancel</Button>
        <Button size="sm" @click="handleSave" :disabled="itemQuantities.size === 0">
          {{ itemQuantities.size > 1 ? `Add ${itemQuantities.size} Markers` : 'Add Marker' }}
        </Button>
      </DialogFooter>
    </DialogScrollContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { CheckIcon, ChevronDownIcon, ChevronRightIcon, ChevronUpIcon, MinusIcon, PlusIcon, XIcon } from 'lucide-vue-next'
import { Dialog, DialogScrollContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { useGameData } from '~/composables/useGameData'
import { cn } from '~/lib/utils'

interface Props {
  show: boolean
  pendingPosition: { x: number; y: number } | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  save: [data: { items: Array<{ itemId: string; name: string; quantity: number }>; note: string }]
}>()

const { items, markers, currentRun } = useGameData()

// ── Frequently used items ────────────────────────────────────────────────
const FREQ_COLS = 8 // icons per row
const FREQ_VISIBLE_ROWS = 2
const freqExpanded = ref(false)

const frequentItems = computed(() => {
  // Count itemId occurrences across current run's markers only
  const runId = currentRun.value?.id
  const counts = new Map<string, number>()
  for (const m of markers.value) {
    if (runId && m.runId !== runId) continue
    counts.set(m.itemId, (counts.get(m.itemId) ?? 0) + 1)
  }
  if (counts.size === 0) return []

  // Sort descending by count, resolve to Item objects
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([itemId, count]) => {
      const item = items.value.find((i) => i.id === itemId)
      return item ? { ...item, usageCount: count } : null
    })
    .filter(Boolean) as (typeof items.value[number] & { usageCount: number })[]
})

const visibleFrequentItems = computed(() => {
  if (freqExpanded.value) return frequentItems.value
  return frequentItems.value.slice(0, FREQ_COLS * FREQ_VISIBLE_ROWS)
})

const hasMoreFrequent = computed(() => frequentItems.value.length > FREQ_COLS * FREQ_VISIBLE_ROWS)
const showFrequentSection = computed(() => frequentItems.value.length > 0 && !searchQuery.value.trim())

const itemQuantities = reactive(new Map<string, number>())
const selectedItemIds = computed(() => new Set(itemQuantities.keys()))
const selectedItems = computed(() =>
  items.value.filter((i) => itemQuantities.has(i.id))
)
const markerName = ref('')
const note = ref('')
const showMoreOptions = ref(false)
const searchQuery = ref('')
const activeCategories = ref<string[]>([])

function toggleItemSelection(itemId: string) {
  if (itemQuantities.has(itemId)) {
    itemQuantities.delete(itemId)
  } else {
    itemQuantities.set(itemId, 1)
  }
}

function getItemQuantity(itemId: string): number {
  return itemQuantities.get(itemId) ?? 1
}

function setItemQuantity(itemId: string, qty: number) {
  if (qty < 1) qty = 1
  itemQuantities.set(itemId, qty)
}

function incrementQuantity(itemId: string) {
  setItemQuantity(itemId, getItemQuantity(itemId) + 1)
}

function decrementQuantity(itemId: string) {
  setItemQuantity(itemId, getItemQuantity(itemId) - 1)
}

// Derive available categories from items
const availableCategories = computed(() => {
  const cats = new Set<string>()
  for (const item of items.value) {
    if (item.category) cats.add(item.category)
  }
  return [...cats].sort()
})

function getCategoryCount(category: string) {
  return items.value.filter((i) => i.category === category).length
}

// Default: all categories active except Collectible
watch(items, (newItems) => {
  if (newItems.length > 0 && activeCategories.value.length === 0) {
    const cats: string[] = []
    for (const item of newItems) {
      if (item.category && item.category !== 'Collectible' && !cats.includes(item.category)) {
        cats.push(item.category)
      }
    }
    activeCategories.value = cats
  }
}, { immediate: true })

function toggleCategory(cat: string) {
  const idx = activeCategories.value.indexOf(cat)
  if (idx >= 0) {
    activeCategories.value.splice(idx, 1)
  } else {
    activeCategories.value.push(cat)
  }
}

function isCategoryActive(cat: string) {
  return activeCategories.value.includes(cat)
}

const filteredItems = computed(() => {
  let result = items.value

  // Filter by active categories
  if (activeCategories.value.length > 0) {
    result = result.filter((i) => i.category && activeCategories.value.includes(i.category))
  }

  // Filter by search query
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    result = result.filter((i) => i.name.toLowerCase().includes(q))
  }

  return result
})

// Reset form when dialog opens
watch(() => props.show, (isOpen) => {
  if (isOpen) {
    itemQuantities.clear()
    markerName.value = ''
    note.value = ''
    showMoreOptions.value = false
    searchQuery.value = ''
    freqExpanded.value = false
  }
})

function handleSave() {
  if (itemQuantities.size === 0) return

  const selectedList = selectedItems.value.map((item) => ({
    itemId: item.id,
    name: itemQuantities.size === 1 ? (markerName.value || item.name) : item.name,
    quantity: getItemQuantity(item.id),
  }))

  emit('save', {
    items: selectedList,
    note: note.value,
  })
}
</script>
