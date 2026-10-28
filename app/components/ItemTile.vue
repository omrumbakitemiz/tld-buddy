<template>
  <button
    type="button"
    role="option"
    :aria-selected="selected"
    :aria-label="item.name"
    :title="item.category ? `${item.name} · ${item.category}` : item.name"
    :class="cn(
      'relative grid aspect-square w-full place-items-center rounded-md border transition-colors',
      selected
        ? 'border-primary bg-primary/15'
        : 'border-transparent bg-muted/50 hover:border-primary/40 hover:bg-muted',
    )"
    @click="emit('pick', item)"
    @keydown="onArrow"
  >
    <img v-if="item.icon" :src="item.icon" alt="" class="size-[70%] object-contain" loading="lazy" draggable="false">
    <span v-else class="px-0.5 text-center text-[10px] leading-tight text-muted-foreground">{{ item.name.slice(0, 8) }}</span>
    <span
      v-if="selected"
      class="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-primary text-primary-foreground"
      aria-hidden="true"
    >
      <CheckIcon class="size-3" :stroke-width="3" />
    </span>
  </button>
</template>

<script setup lang="ts">
import { CheckIcon } from '@lucide/vue'
import { cn } from '~/lib/utils'
import type { Item } from '~/types'

defineProps<{ item: Item; selected?: boolean }>()
const emit = defineEmits<{ pick: [item: Item] }>()

/** Arrow keys move between tiles in the same grid */
function onArrow(e: KeyboardEvent) {
  const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']
  if (!keys.includes(e.key)) return
  const el = e.currentTarget as HTMLElement
  const tiles = [...(el.parentElement?.querySelectorAll<HTMLElement>('button[role="option"]') ?? [])]
  const idx = tiles.indexOf(el)
  const cols = Math.max(1, Math.round((el.parentElement?.clientWidth ?? 1) / (el.offsetWidth + 4)))
  const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[e.key]!
  const next = tiles[idx + delta]
  if (next) {
    e.preventDefault()
    next.focus()
  }
}
</script>
