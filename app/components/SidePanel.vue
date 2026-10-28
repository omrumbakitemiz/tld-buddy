<template>
  <aside
    v-show="panelOpen"
    id="side-panel"
    :class="cn(
      'surface-rail z-[600] flex flex-col border-border',
      // Tablet/desktop: docked column beside the map. Phone: bottom sheet over the map.
      'fixed inset-x-0 bottom-0 max-h-[62dvh] rounded-t-2xl border-t shadow-[0_-8px_30px_oklch(0.1_0.02_258/0.5)]',
      'md:static md:h-auto md:max-h-none md:w-[22rem] md:shrink-0 md:rounded-none md:border-r md:border-t-0 md:shadow-none',
    )"
    aria-label="Side panel"
  >
    <!-- Handle: tap to collapse the sheet back to the map -->
    <button
      type="button"
      class="mx-auto mt-1 flex h-5 w-16 items-center justify-center md:hidden"
      aria-label="Collapse panel"
      @click="panelOpen = false"
    >
      <span class="h-1 w-10 rounded-full bg-border" />
    </button>
    <TabsRoot v-model="panelTab" class="flex min-h-0 flex-1 flex-col">
      <div class="flex items-center gap-1 px-2 pt-2">
        <TabsList class="flex flex-1 gap-1" aria-label="Panel sections">
          <TabsTrigger
            v-for="(tab, i) in tabs"
            :key="tab.value"
            :value="tab.value"
            class="hud-label flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md text-muted-foreground transition-colors hover:text-foreground data-[state=active]:bg-accent data-[state=active]:text-foreground"
            :title="`${tab.label} (${i + 1})`"
          >
            <component :is="tab.icon" class="size-3.5" />
            {{ tab.label }}
            <span v-if="tab.count" class="tabular rounded bg-background/60 px-1 text-[10px] tracking-normal">{{ tab.count }}</span>
          </TabsTrigger>
        </TabsList>
        <Button size="icon" class="size-9 shrink-0 md:hidden" aria-label="Add loot" @click="emit('add-loot')">
          <PlusIcon class="size-4" />
        </Button>
        <Button size="icon" variant="ghost" class="size-9 shrink-0" aria-label="Close panel" title="Close panel (P)" @click="panelOpen = false">
          <PanelLeftCloseIcon class="hidden size-4 md:block" />
          <XIcon class="size-4 md:hidden" />
        </Button>
      </div>
      <TabsContent value="loot" class="min-h-0 flex-1 outline-none">
        <LootTab @fly-to="(p) => emit('fly-to', p)" @edit="(m) => emit('edit', m)" />
      </TabsContent>
      <TabsContent value="places" class="min-h-0 flex-1 outline-none">
        <PlacesTab @fly-to="(p) => emit('fly-to', p)" />
      </TabsContent>
      <TabsContent value="maps" class="min-h-0 flex-1 outline-none">
        <MapsTab />
      </TabsContent>
    </TabsRoot>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { LandmarkIcon, MapIcon, PackageIcon, PanelLeftCloseIcon, PlusIcon, XIcon } from '@lucide/vue'
import { Button } from '~/components/ui/button'
import LootTab from '~/components/panel/LootTab.vue'
import PlacesTab from '~/components/panel/PlacesTab.vue'
import MapsTab from '~/components/panel/MapsTab.vue'
import { useGameData } from '~/composables/useGameData'
import { useUiState } from '~/composables/useUiState'
import { cn } from '~/lib/utils'
import type { Marker } from '~/types'

const emit = defineEmits<{
  'fly-to': [target: { x: number; y: number; mapId: string }]
  edit: [marker: Marker]
  'add-loot': []
}>()

const { panelOpen, panelTab } = useUiState()
const { currentMapMarkers, currentMapPOIs } = useGameData()

const tabs = computed(() => [
  { value: 'loot', label: 'Loot', icon: PackageIcon, count: currentMapMarkers.value.filter((m) => !m.lootedAt).length },
  { value: 'places', label: 'Places', icon: LandmarkIcon, count: currentMapPOIs.value.length },
  { value: 'maps', label: 'Maps', icon: MapIcon, count: 0 },
])
</script>
