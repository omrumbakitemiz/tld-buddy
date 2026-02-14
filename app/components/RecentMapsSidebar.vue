<template>
  <div
    v-if="recentMaps.length > 0"
    class="recent-sidebar"
    :class="{ 'recent-sidebar--expanded': expanded }"
    @mouseenter="expanded = true"
    @mouseleave="expanded = false"
  >
    <!-- Toggle / header -->
    <div class="recent-sidebar__header" @click="expanded = !expanded">
      <HistoryIcon class="h-4 w-4 shrink-0 text-muted-foreground" />
      <Transition name="fade">
        <span v-if="expanded" class="text-xs font-semibold tracking-wide uppercase text-muted-foreground flex-1">
          Recent Maps
        </span>
      </Transition>
      <Transition name="fade">
        <button
          v-if="expanded"
          class="recent-sidebar__clear"
          title="Clear recent maps"
          @click.stop="handleClearRecentMaps()"
        >
          <XIcon class="h-3.5 w-3.5" />
        </button>
      </Transition>
    </div>

    <!-- Map list -->
    <ScrollArea class="recent-sidebar__list">
      <div class="flex flex-col gap-1.5 p-1.5">
        <TooltipProvider :delay-duration="300">
          <Tooltip v-for="mapItem in recentMaps" :key="mapItem.id">
            <TooltipTrigger as-child>
              <button
                :class="cn(
                  'recent-sidebar__item',
                  mapItem.id === currentMapId && 'recent-sidebar__item--active'
                )"
                @click="handleSelectMap(mapItem.id)"
              >
                <!-- Thumbnail -->
                <div class="recent-sidebar__thumb">
                  <img
                    :src="getMapThumbnail(mapItem)"
                    :alt="mapItem.name"
                    class="recent-sidebar__thumb-img"
                    loading="lazy"
                  />
                </div>

                <!-- Name (visible when expanded) -->
                <Transition name="fade">
                  <div v-if="expanded" class="recent-sidebar__info">
                    <span class="text-xs font-medium truncate">{{ mapItem.name }}</span>
                    <span class="text-[10px] text-muted-foreground capitalize">{{ mapItem.type }}</span>
                  </div>
                </Transition>
              </button>
            </TooltipTrigger>
            <TooltipContent v-if="!expanded" side="right" :side-offset="8">
              <p>{{ mapItem.name }}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </ScrollArea>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { HistoryIcon, XIcon } from 'lucide-vue-next'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip'
import { ScrollArea } from '~/components/ui/scroll-area'
import { useGameData } from '~/composables/useGameData'
import { cn } from '~/lib/utils'

const { recentMaps, currentMapId, setCurrentMap, clearRecentMaps, getMapThumbnail } = useGameData()

const expanded = ref(false)

function handleClearRecentMaps() {
  expanded.value = false
  clearRecentMaps()
}

function handleSelectMap(mapId: string) {
  setCurrentMap(mapId)
}
</script>

<style scoped>
.recent-sidebar {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 900;
  display: flex;
  flex-direction: column;
  width: 52px;
  background: oklch(0.14 0.01 60 / 0.85);
  backdrop-filter: blur(12px);
  border-right: 1px solid oklch(0.26 0.015 60 / 0.6);
  transition: width 0.2s ease;
  overflow: hidden;
}

.recent-sidebar--expanded {
  width: 200px;
}

.recent-sidebar__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid oklch(0.26 0.015 60 / 0.4);
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s ease;
}

.recent-sidebar__header:hover {
  background: oklch(0.22 0.015 60 / 0.5);
}

.recent-sidebar__clear {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  color: oklch(0.58 0.03 70);
  transition: background 0.15s ease, color 0.15s ease;
  flex-shrink: 0;
}

.recent-sidebar__clear:hover {
  background: oklch(0.50 0.16 25 / 0.3);
  color: oklch(0.75 0.14 25);
}

.recent-sidebar__list {
  flex: 1;
  min-height: 0;
}

.recent-sidebar__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 4px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s ease;
  text-align: left;
}

.recent-sidebar__item:hover {
  background: oklch(0.24 0.02 70 / 0.5);
}

.recent-sidebar__item--active {
  background: oklch(0.70 0.14 75 / 0.15);
  box-shadow: inset 0 0 0 1.5px oklch(0.70 0.14 75 / 0.4);
}

.recent-sidebar__thumb {
  position: relative;
  width: 36px;
  height: 36px;
  min-width: 36px;
  border-radius: 4px;
  overflow: hidden;
  background: oklch(0.22 0.015 60);
  border: 1px solid oklch(0.30 0.02 60 / 0.5);
}

.recent-sidebar__thumb-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

.recent-sidebar__info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

/* Fade transition for expanded content */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
