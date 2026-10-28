<template>
  <div
    class="wheel-ring absolute"
    :style="{ left: `${-WHEEL.outer}px`, top: `${-WHEEL.outer}px`, width: `${size}px`, height: `${size}px` }"
    @contextmenu.prevent="(e: MouseEvent) => emit('context', e)"
  >
    <svg
      class="absolute inset-0 overflow-visible"
      :viewBox="`${-WHEEL.outer} ${-WHEEL.outer} ${size} ${size}`"
      :width="size"
      :height="size"
      aria-hidden="true"
    >
      <g :key="ringKey" class="wheel-ring__slices">
        <path
          v-for="(s, i) in slices"
          :key="s.key"
          :d="paths[i]"
          class="wheel-slice"
          :class="{
            'wheel-slice--hot': hovered === i && s.kind !== 'empty',
            'wheel-slice--empty': s.kind === 'empty',
          }"
          @pointerenter="emit('hover', s.kind === 'empty' ? null : i)"
          @pointerleave="emit('hover', null)"
          @click="s.kind !== 'empty' && emit('pick', i)"
        />
      </g>
      <!-- The rim and the hole: hairlines that hold the ring together on the cream map -->
      <circle :r="WHEEL.outer" class="wheel-rim" />
      <circle :r="WHEEL.inner" class="wheel-rim" />
      <!-- Clear centre over the spot: swallows clicks so the map behind doesn't take them -->
      <circle :r="WHEEL.inner" class="wheel-hole" @click="emit('hole')" />
      <g :key="pulse" class="wheel-crosshair" :class="{ 'wheel-crosshair--pulse': pulse > 0 }">
        <circle :r="WHEEL.hole - 4" />
        <path :d="`M0 ${-WHEEL.hole + 4}v6M0 ${WHEEL.hole - 4}v-6M${-WHEEL.hole + 4} 0h6M${WHEEL.hole - 4} 0h-6`" />
      </g>
    </svg>

    <!-- Slice contents: icon + label stacked at mid-radius, the digit next to the hole -->
    <div :key="ringKey" class="wheel-ring__content pointer-events-none absolute inset-0">
      <template v-for="(s, i) in slices" :key="s.key">
        <template v-if="s.kind !== 'empty'">
          <span
            class="wheel-digit tabular"
            :class="{ 'wheel-digit--hot': hovered === i }"
            :style="at(WHEEL.digit, i)"
          >{{ i + 1 }}</span>
          <span class="wheel-cell" :class="{ 'wheel-cell--hot': hovered === i }" :style="at(WHEEL.content, i)">
            <span class="relative grid size-9 place-items-center">
              <img v-if="s.icon" :src="s.icon" alt="" class="size-9 object-contain" draggable="false">
              <HistoryIcon v-else-if="s.kind === 'group'" class="size-6" :stroke-width="1.75" />
              <PackageIcon v-else class="size-6" :stroke-width="1.75" />
              <span v-if="s.here" class="wheel-pill wheel-pill--here tabular" :title="`${s.here} already here`">{{ s.here }}</span>
              <span v-else-if="s.count" class="wheel-pill wheel-pill--count tabular">{{ s.count }}</span>
            </span>
            <span :class="s.kind === 'group' ? 'hud-label wheel-label--group' : 'wheel-label--item'">{{ s.label }}</span>
          </span>
        </template>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { HistoryIcon, PackageIcon } from '@lucide/vue'
import { WHEEL, polar, sliceMid, slicePath, type WheelSlice } from './wheel'

/** The radial ring itself: 8 slices around a clear hole over the spot. Pure view. */

const props = defineProps<{
  slices: WheelSlice[]
  hovered: number | null
  /** Changes when the ring's meaning changes (groups → a group's items → search), to replay the swap */
  ringKey: string
  /** Bumps on every pick: the crosshair gives a small beat */
  pulse: number
}>()

const emit = defineEmits<{
  pick: [index: number]
  hover: [index: number | null]
  hole: []
  /** Right-click on the ring: the map point under it is where the next wheel goes */
  context: [e: MouseEvent]
}>()

const size = WHEEL.outer * 2
const paths = computed(() => props.slices.map((_, i) => slicePath(i, props.slices.length)))

function at(r: number, i: number) {
  const p = polar(r, sliceMid(i, props.slices.length))
  return { left: `${WHEEL.outer + p.x}px`, top: `${WHEEL.outer + p.y}px` }
}
</script>

<style scoped>
.wheel-ring {
  /* Dusk-tinted float shadow, as for every overlay above the map */
  filter: drop-shadow(0 6px 18px oklch(0.1 0.02 258 / 0.55));
}

.wheel-slice {
  fill: oklch(0.2 0.03 258 / 0.94);
  stroke: oklch(0.16 0.03 258);
  stroke-width: 1.5;
  cursor: pointer;
  pointer-events: visiblePainted;
  transition: fill 120ms ease;
}

.wheel-slice:hover,
.wheel-slice--hot {
  fill: var(--primary);
}

.wheel-slice--empty {
  fill: oklch(0.2 0.03 258 / 0.72);
  cursor: default;
}

.wheel-rim {
  fill: none;
  stroke: var(--border);
  stroke-width: 1;
  pointer-events: none;
}

.wheel-hole {
  fill: transparent;
  cursor: default;
  pointer-events: all;
}

.wheel-crosshair {
  fill: none;
  stroke: var(--primary);
  stroke-width: 2;
  stroke-linecap: round;
  pointer-events: none;
  transform-origin: 0 0;
}

.wheel-crosshair--pulse {
  animation: wheel-beat 220ms cubic-bezier(0.16, 1, 0.3, 1);
}

.wheel-digit {
  position: absolute;
  translate: -50% -50%;
  display: grid;
  place-items: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 4px;
  background: oklch(0.27 0.03 258);
  color: var(--muted-foreground);
  font-size: 11px;
  font-weight: 750;
  line-height: 1;
  transition: background-color 120ms ease, color 120ms ease;
}

.wheel-digit--hot {
  background: oklch(0.2 0.03 258 / 0.18);
  color: var(--primary-foreground);
}

.wheel-cell {
  position: absolute;
  translate: -50% -50%;
  display: flex;
  width: 78px;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  color: var(--foreground);
  text-align: center;
  transition: color 120ms ease;
}

.wheel-cell--hot {
  color: var(--primary-foreground);
}

.wheel-label--group {
  font-size: 10.5px;
  line-height: 13px;
  white-space: nowrap;
}

.wheel-label--item {
  display: -webkit-box;
  max-width: 76px;
  overflow: hidden;
  font-size: 11px;
  font-weight: 500;
  line-height: 13px;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.wheel-pill {
  position: absolute;
  top: -6px;
  right: -9px;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  border-radius: 9px;
  font-size: 10px;
  font-weight: 750;
  line-height: 17px;
  text-align: center;
  box-shadow: 0 0 0 1.5px oklch(0.16 0.03 258);
}

/* Loot still at this spot: the marker's own apricot quantity pill */
.wheel-pill--here {
  background: var(--loot);
  color: var(--primary-foreground);
}

/* Picked from this group in this wheel: the bone count pill of a grouped tile */
.wheel-pill--count {
  background: var(--foreground);
  color: oklch(0.2 0.03 258);
}

.wheel-ring__slices,
.wheel-ring__content {
  animation: wheel-swap 140ms cubic-bezier(0.16, 1, 0.3, 1);
  transform-origin: 50% 50%;
}

.wheel-ring__slices {
  transform-origin: 0 0;
}

@keyframes wheel-swap {
  from {
    opacity: 0.2;
    transform: scale(0.96);
  }
}

@keyframes wheel-beat {
  50% {
    transform: scale(1.18);
  }
}

@media (prefers-reduced-motion: reduce) {
  .wheel-ring__slices,
  .wheel-ring__content,
  .wheel-crosshair--pulse {
    animation: none;
  }
}
</style>
