<template>
  <header class="surface-rail relative z-[700] flex h-12 shrink-0 items-center gap-1.5 border-b border-border px-2 sm:gap-2 sm:px-3">
    <Button
      v-if="!travelMode"
      size="icon"
      variant="ghost"
      class="size-9 shrink-0"
      :aria-label="panelOpen ? 'Hide side panel' : 'Show side panel'"
      :aria-expanded="panelOpen"
      aria-controls="side-panel"
      :title="`${panelOpen ? 'Hide' : 'Show'} side panel ([)`"
      @click="panelOpen = !panelOpen"
    >
      <PanelLeftIcon class="size-4" />
    </Button>

    <span class="hud-label hidden shrink-0 text-[0.75rem] text-foreground lg:inline">TLD Buddy</span>

    <!-- Current map -->
    <button
      v-if="!travelMode"
      type="button"
      class="flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
      title="Change map (3)"
      @click="openPanel('maps')"
    >
      <MapIcon class="size-4 shrink-0 text-muted-foreground" />
      <span class="truncate font-medium">{{ currentMap?.name ?? 'Choose a map' }}</span>
      <ChevronDownIcon class="size-3.5 shrink-0 text-muted-foreground" />
    </button>
    <span v-else class="hud-label flex items-center gap-1.5 px-2 text-foreground">
      <CompassIcon class="size-4 text-primary" /> Travel mode
    </span>

    <!-- Run -->
    <button
      type="button"
      class="flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
      title="Runs (R)"
      @click="showRuns = true"
    >
      <template v-if="currentRun">
        <span class="hidden max-w-[10rem] truncate sm:inline">{{ currentRun.name }}</span>
        <span :class="cn('hud-label rounded border px-1.5 text-[10px]', difficultyClass(currentRun.difficulty))">{{ currentRun.difficulty }}</span>
      </template>
      <span v-else class="text-warning">Choose a run</span>
    </button>

    <div class="flex-1" />

    <!-- Search -->
    <button
      type="button"
      class="flex h-9 items-center gap-2 rounded-md border border-border bg-background/50 px-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground md:w-64"
      aria-label="Search"
      title="Search (/ or Ctrl K)"
      @click="showSearch = true"
    >
      <SearchIcon class="size-4 shrink-0" />
      <span class="hidden flex-1 text-left md:inline">Search loot, places, maps</span>
      <kbd class="hidden rounded border border-border px-1 text-[10px] md:inline">/</kbd>
    </button>

    <SyncIndicator />

    <Button
      size="icon"
      :variant="travelMode ? 'secondary' : 'ghost'"
      class="size-9"
      :aria-pressed="travelMode"
      :aria-label="travelMode ? 'Leave travel mode' : 'Travel mode: two maps side by side'"
      :title="travelMode ? 'Leave travel mode (T)' : 'Travel mode (T)'"
      @click="toggleTravelMode"
    >
      <CompassIcon class="size-4" />
    </Button>

    <DropdownMenuRoot>
      <DropdownMenuTrigger as-child>
        <Button size="icon" variant="ghost" class="size-9" aria-label="More">
          <EllipsisVerticalIcon class="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent
          align="end"
          :side-offset="6"
          class="surface-card z-[1000] min-w-56 rounded-lg border border-border p-1 text-sm shadow-xl data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          <DropdownMenuItem class="menu-item" @select="showRuns = true">
            <SwordsIcon class="size-4" /> Runs <kbd class="ml-auto">R</kbd>
          </DropdownMenuItem>
          <DropdownMenuItem class="menu-item" @select="showPOIConfig = true">
            <SlidersHorizontalIcon class="size-4" /> Places to track
          </DropdownMenuItem>
          <DropdownMenuCheckboxItem v-model="hideLooted" class="menu-item">
            <EyeOffIcon class="size-4" /> Hide looted markers <kbd class="ml-auto">H</kbd>
          </DropdownMenuCheckboxItem>
          <DropdownMenuItem class="menu-item" @select="showShortcuts = true">
            <KeyboardIcon class="size-4" /> Keyboard shortcuts <kbd class="ml-auto">?</kbd>
          </DropdownMenuItem>
          <DropdownMenuSeparator class="my-1 h-px bg-border" />
          <DropdownMenuItem class="menu-item text-destructive" @select="emit('logout')">
            <LogOutIcon class="size-4" /> Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  </header>
</template>

<script setup lang="ts">
import {
  DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal,
  DropdownMenuRoot, DropdownMenuSeparator, DropdownMenuTrigger,
} from 'reka-ui'
import {
  ChevronDownIcon, CompassIcon, EllipsisVerticalIcon, EyeOffIcon, KeyboardIcon, LogOutIcon,
  MapIcon, PanelLeftIcon, SearchIcon, SlidersHorizontalIcon, SwordsIcon,
} from '@lucide/vue'
import { Button } from '~/components/ui/button'
import SyncIndicator from '~/components/SyncIndicator.vue'
import { useGameData } from '~/composables/useGameData'
import { useUiState } from '~/composables/useUiState'
import { difficultyClass } from '~/lib/difficulty'
import { cn } from '~/lib/utils'

const emit = defineEmits<{ logout: [] }>()

const { currentMap, currentRun, travelMode, toggleTravelMode } = useGameData()
const { panelOpen, openPanel, showRuns, showSearch, showShortcuts, showPOIConfig, hideLooted } = useUiState()
</script>

<style scoped>
:deep(.menu-item) {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  height: 2.25rem;
  padding: 0 0.625rem;
  border-radius: calc(var(--radius) - 2px);
  cursor: pointer;
  outline: none;
  user-select: none;
}
:deep(.menu-item[data-highlighted]) {
  background: var(--accent);
}
:deep(.menu-item[data-state='checked']) {
  color: var(--primary);
}
:deep(.menu-item kbd) {
  font-size: 10px;
  color: var(--muted-foreground);
}
</style>
