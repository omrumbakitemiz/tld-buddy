<template>
  <div class="flex w-full h-full">
    <!-- Left Map Panel -->
    <div class="flex-1 min-w-0 flex flex-col border-r border-border">
      <TravelMapPanel
        side="left"
        :map="travelLeftMap"
        :map-id="travelLeftMapId"
        :other-map-id="travelRightMapId"
        @select-map="setTravelLeftMap"
      />
    </div>

    <!-- Right Map Panel -->
    <div class="flex-1 min-w-0 flex flex-col">
      <TravelMapPanel
        side="right"
        :map="travelRightMap"
        :map-id="travelRightMapId"
        :other-map-id="travelLeftMapId"
        @select-map="setTravelRightMap"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGameData } from '~/composables/useGameData'
import TravelMapPanel from '~/components/TravelMapPanel.vue'

const {
  travelLeftMap,
  travelRightMap,
  travelLeftMapId,
  travelRightMapId,
  setTravelLeftMap,
  setTravelRightMap,
} = useGameData()
</script>
