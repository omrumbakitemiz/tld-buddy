<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="max-w-lg p-0 gap-0 overflow-hidden">
      <DialogHeader class="px-6 pt-6 pb-3">
        <DialogTitle>Item Library</DialogTitle>
        <DialogDescription>
          Browse game items available for map markers
        </DialogDescription>
      </DialogHeader>

      <!-- Search + category filters -->
      <div class="px-6 space-y-2 pb-3">
        <Input
          v-model="searchQuery"
          placeholder="Search items..."
          class="h-8 text-sm"
        />
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="cat in availableCategories"
            :key="cat"
            @click="toggleCategory(cat)"
            :class="cn(
              'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium border transition-colors cursor-pointer',
              activeCategories.includes(cat)
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-muted/50 text-muted-foreground border-border hover:border-primary/40'
            )"
          >
            {{ cat }}
            <span class="ml-1 opacity-60">{{ getCategoryCount(cat) }}</span>
          </button>
        </div>
      </div>

      <!-- Scrollable item list -->
      <div class="overflow-y-auto max-h-[40vh] px-6">
        <div class="space-y-1.5 pb-3">
          <div
            v-for="item in filteredItems"
            :key="item.id"
            class="group flex items-center gap-3 justify-between p-2.5 rounded-lg border border-border bg-card hover:border-primary/40 transition-all"
          >
            <img
              v-if="item.icon"
              :src="item.icon"
              :alt="item.name"
              class="h-8 w-8 rounded object-contain shrink-0 bg-muted/50"
            />
            <div v-else class="h-8 w-8 rounded bg-muted/50 shrink-0" />

            <div class="flex-1 min-w-0 space-y-0.5">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-semibold text-sm">{{ item.name }}</span>
                <Badge v-if="item.category" variant="secondary" class="text-[10px] px-1.5 py-0">
                  {{ item.category }}
                </Badge>
              </div>
              <p v-if="item.description" class="text-xs text-muted-foreground line-clamp-1">
                {{ item.description }}
              </p>
            </div>
          </div>

          <div v-if="filteredItems.length === 0" class="text-center py-8 text-muted-foreground text-sm">
            <PackageIcon class="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>No items match your filters</p>
          </div>
        </div>
      </div>

      <!-- Item count footer -->
      <div class="px-6 py-3 border-t border-border">
        <p class="text-xs text-muted-foreground">
          {{ filteredItems.length }} of {{ items.length }} items
        </p>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { PackageIcon } from 'lucide-vue-next'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Badge } from '~/components/ui/badge'
import { Input } from '~/components/ui/input'
import { useGameData } from '~/composables/useGameData'
import { cn } from '~/lib/utils'

defineProps<{ open: boolean }>()
defineEmits<{ 'update:open': [value: boolean] }>()

const { items } = useGameData()

const searchQuery = ref('')
const activeCategories = ref<string[]>([])

// Derive available categories
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

const filteredItems = computed(() => {
  let result = items.value

  if (activeCategories.value.length > 0) {
    result = result.filter((i) => i.category && activeCategories.value.includes(i.category))
  }

  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    result = result.filter((i) => i.name.toLowerCase().includes(q))
  }

  return result
})
</script>
