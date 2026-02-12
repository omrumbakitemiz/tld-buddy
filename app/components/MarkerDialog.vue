<template>
  <Dialog :open="show" @update:open="(val) => !val && $emit('close')">
    <DialogScrollContent class="max-w-xl">
      <DialogHeader>
        <DialogTitle>Add Marker</DialogTitle>
        <DialogDescription>
          Select an item and add details for this map location
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-5 py-4">
        <!-- Item selection -->
        <div class="space-y-2">
          <Label class="text-sm font-semibold">Select Item *</Label>

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
                      @click="selectedItemId = freqItem.id"
                      :class="cn(
                        'h-10 w-full rounded-md border transition-all cursor-pointer flex items-center justify-center',
                        selectedItemId === freqItem.id
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

          <!-- Item list -->
          <div class="h-[240px] overflow-y-auto rounded-lg border border-border">
            <div class="p-1.5 space-y-1">
              <div
                v-for="item in filteredItems"
                :key="item.id"
                @click="selectedItemId = item.id"
                :class="cn(
                  'flex items-center gap-2.5 p-2.5 rounded-md cursor-pointer transition-all text-sm',
                  selectedItemId === item.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent'
                )"
              >
                <img
                  v-if="item.icon"
                  :src="item.icon"
                  :alt="item.name"
                  class="h-7 w-7 rounded object-contain shrink-0"
                  :class="selectedItemId === item.id ? 'bg-primary-foreground/20' : 'bg-muted/50'"
                />
                <div v-else class="h-7 w-7 rounded shrink-0" :class="selectedItemId === item.id ? 'bg-primary-foreground/20' : 'bg-muted/50'" />

                <div class="flex-1 min-w-0">
                  <span class="font-medium">{{ item.name }}</span>
                </div>
                <CheckIcon v-if="selectedItemId === item.id" class="h-4 w-4 shrink-0 ml-2" />
              </div>

              <div v-if="filteredItems.length === 0" class="text-center py-6 text-muted-foreground text-sm">
                No items match your filters
              </div>
            </div>
          </div>
        </div>

        <!-- Custom name -->
        <div class="space-y-1.5">
          <Label for="marker-name" class="text-sm">Custom Name</Label>
          <Input
            id="marker-name"
            v-model="markerName"
            placeholder="Leave empty to use item name"
            class="h-9 text-sm"
          />
        </div>

        <!-- Quantity -->
        <div class="space-y-1.5">
          <Label class="text-sm">Quantity *</Label>
          <div class="flex items-center gap-1.5">
            <button
              v-for="preset in [1, 3, 5, 10]"
              :key="preset"
              @click="quantity = preset; customQty = false"
              :class="cn(
                'inline-flex items-center justify-center rounded-md px-4 py-1.5 text-xs font-medium border transition-colors cursor-pointer min-w-[44px]',
                quantity === preset && !customQty
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/50 text-muted-foreground border-border hover:border-primary/40'
              )"
            >
              {{ preset }}
            </button>
            <button
              @click="customQty = true"
              :class="cn(
                'inline-flex items-center justify-center rounded-md px-4 py-1.5 text-xs font-medium border transition-colors cursor-pointer',
                customQty
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/50 text-muted-foreground border-border hover:border-primary/40'
              )"
            >
              Custom
            </button>
            <Input
              v-if="customQty"
              v-model.number="quantity"
              type="number"
              min="1"
              placeholder="1"
              class="h-7 text-sm w-20 ml-1"
              autofocus
            />
          </div>
        </div>

        <!-- Note -->
        <div class="space-y-1.5">
          <Label for="note" class="text-sm">Note</Label>
          <Textarea
            id="note"
            v-model="note"
            placeholder="Add any notes about this location..."
            rows="2"
            class="text-sm resize-none"
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" size="sm" @click="$emit('close')">Cancel</Button>
        <Button size="sm" @click="handleSave" :disabled="!selectedItemId">
          Add Marker
        </Button>
      </DialogFooter>
    </DialogScrollContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-vue-next'
import { Dialog, DialogScrollContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
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
  save: [data: { itemId: string; quantity: number; note: string; name: string }]
}>()

const { items, markers } = useGameData()

// ── Frequently used items ────────────────────────────────────────────────
const FREQ_COLS = 8 // icons per row
const FREQ_VISIBLE_ROWS = 2
const freqExpanded = ref(false)

const frequentItems = computed(() => {
  // Count itemId occurrences across all markers
  const counts = new Map<string, number>()
  for (const m of markers.value) {
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

const selectedItemId = ref('')
const markerName = ref('')
const quantity = ref(1)
const customQty = ref(false)
const note = ref('')
const searchQuery = ref('')
const activeCategories = ref<string[]>([])

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
    selectedItemId.value = ''
    markerName.value = ''
    quantity.value = 1
    customQty.value = false
    note.value = ''
    searchQuery.value = ''
    freqExpanded.value = false
  }
})

function handleSave() {
  if (!selectedItemId.value) return
  emit('save', {
    itemId: selectedItemId.value,
    quantity: quantity.value || 1,
    note: note.value,
    name: markerName.value,
  })
}
</script>
