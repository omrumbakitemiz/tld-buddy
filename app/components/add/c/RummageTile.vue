<template>
  <button
    type="button"
    tabindex="-1"
    role="option"
    :aria-selected="active"
    :aria-label="label"
    :title="item.category ? `${item.name} · ${item.category}` : item.name"
    :class="cn(
      'rummage-tile group relative flex flex-col items-center gap-1 rounded-lg border px-0.5 pb-1 pt-1.5 text-center transition-colors',
      active ? 'border-foreground/45 bg-accent' : 'border-transparent hover:bg-accent/60',
    )"
    @mousedown.prevent
    @click="emit('tick')"
    @contextmenu.prevent="emit('dec')"
  >
    <span :class="cn('rummage-chip', count > 0 && 'rummage-chip--here',)">
      <img v-if="item.icon" :src="item.icon" alt="" class="size-[26px] object-contain" draggable="false" loading="lazy">
      <PackageIcon v-else class="size-[18px] text-muted-foreground" />
      <span v-if="count > 0" class="rummage-qty tabular">{{ count }}</span>
      <span v-else-if="looted" class="rummage-tick" aria-hidden="true"><CheckIcon class="size-2.5" :stroke-width="4" /></span>
    </span>
    <span class="line-clamp-2 min-h-[2.1em] w-full text-[10.5px] leading-[1.05] text-foreground/90">{{ item.name }}</span>
    <kbd v-if="enter" class="absolute left-1 top-1 rounded bg-primary px-1 text-[9px] font-semibold leading-[14px] text-primary-foreground">↵</kbd>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CheckIcon, PackageIcon } from '@lucide/vue'
import { cn } from '~/lib/utils'
import type { Item } from '~/types'

/** One item tile of the Rummage grid. It looks like the marker it creates: ink squircle, apricot ring and quantity pill once it's on the map. */
const props = defineProps<{
  item: Item
  /** Unlooted units at the spot */
  count: number
  /** Only looted units here: a mint tick instead of the ring */
  looted: boolean
  /** The cursor is on this tile */
  active: boolean
  /** Show the Enter hint (top search result) */
  enter?: boolean
}>()
const emit = defineEmits<{ tick: []; dec: [] }>()

const label = computed(() => `${props.item.name}${props.count ? `, ${props.count} here` : ''}${props.looted && !props.count ? ', looted here' : ''}`)
</script>

<style scoped>
.rummage-chip {
  position: relative;
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 9px;
  background: oklch(0.22 0.03 258);
  border: 2px solid oklch(0.33 0.03 258);
  transition: border-color 160ms ease, box-shadow 160ms ease;
}
.rummage-tile:hover .rummage-chip {
  border-color: oklch(0.5 0.04 258);
}
.rummage-chip--here {
  border-color: var(--loot);
  box-shadow: 0 0 0 1.5px oklch(0.16 0.03 258);
}
.rummage-tile:hover .rummage-chip--here {
  border-color: var(--loot);
}
.rummage-qty {
  position: absolute;
  top: -7px;
  right: -8px;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  border-radius: 9px;
  background: var(--loot);
  color: var(--primary-foreground);
  font-size: 10px;
  font-weight: 750;
  line-height: 17px;
  text-align: center;
  box-shadow: 0 0 0 1.5px oklch(0.16 0.03 258);
}
.rummage-tick {
  position: absolute;
  bottom: -6px;
  right: -6px;
  display: grid;
  width: 16px;
  height: 16px;
  place-items: center;
  border-radius: 50%;
  background: var(--looted);
  color: oklch(0.22 0.03 258);
  box-shadow: 0 0 0 1.5px oklch(0.16 0.03 258);
}
</style>
