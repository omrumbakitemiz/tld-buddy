<template>
  <div
    v-if="marker"
    class="surface-rail flex w-[min(28rem,calc(100vw-1.5rem))] flex-col gap-2.5 rounded-xl border border-border p-3 shadow-[0_8px_28px_oklch(0.1_0.02_258/0.6)]"
    role="region"
    :aria-label="`Selected: ${title}`"
  >
    <div class="flex items-start gap-3">
      <div
        :class="cn(
          'grid size-12 shrink-0 place-items-center rounded-lg border-2 bg-background/60 transition-[filter,opacity,border-color]',
          looted ? 'border-dashed border-muted-foreground/50 opacity-70 grayscale' : 'border-loot',
        )"
      >
        <img v-if="item?.icon" :src="item.icon" alt="" class="size-9 object-contain">
        <PackageIcon v-else class="size-5 text-muted-foreground" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate font-medium leading-tight">
          {{ title }}
          <span v-if="marker.quantity > 1" class="tabular text-muted-foreground">×{{ marker.quantity }}</span>
        </p>
        <p class="mt-0.5 text-xs" :class="looted ? 'text-looted' : 'text-loot'">
          {{ looted ? `Looted ${lootedAgo}` : 'Still there' }}
          <span v-if="item && marker.name !== item.name" class="text-muted-foreground"> · {{ item.name }}</span>
        </p>
        <p v-if="marker.note" class="mt-1 line-clamp-2 text-sm text-muted-foreground">{{ marker.note }}</p>
      </div>
      <Button size="icon" variant="ghost" class="-mr-1 -mt-1 size-8 shrink-0" aria-label="Close" title="Close (Esc)" @click="emit('close')">
        <XIcon class="size-4" />
      </Button>
    </div>

    <div class="flex items-center gap-1.5">
      <Button
        :variant="looted ? 'secondary' : 'default'"
        class="h-10 flex-1"
        :aria-pressed="looted"
        @click="toggleLooted(marker.id)"
      >
        <component :is="looted ? Undo2Icon : CheckIcon" class="size-4" />
        {{ looted ? 'Not looted' : 'Mark looted' }}
        <kbd class="ml-1 hidden text-[10px] opacity-70 sm:inline">L</kbd>
      </Button>
      <Button
        v-if="!looted && marker.quantity > 1"
        variant="outline"
        class="h-10"
        title="Took one; keep the rest marked"
        @click="takeOne"
      >
        Take 1
      </Button>
      <Button variant="outline" size="icon" class="size-10" aria-label="Edit" title="Edit (E)" @click="emit('edit', marker)">
        <PencilIcon class="size-4" />
      </Button>
      <Button variant="outline" size="icon" class="size-10 text-destructive hover:bg-destructive/15 hover:text-destructive" aria-label="Delete" title="Delete (Del)" @click="emit('delete', marker.id)">
        <TrashIcon class="size-4" />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CheckIcon, PackageIcon, PencilIcon, TrashIcon, Undo2Icon, XIcon } from '@lucide/vue'
import { Button } from '~/components/ui/button'
import { useGameData } from '~/composables/useGameData'
import { cn } from '~/lib/utils'
import { timeAgo } from '~/lib/time'
import type { Marker } from '~/types'

const props = defineProps<{ marker: Marker | null }>()
const emit = defineEmits<{ close: []; edit: [marker: Marker]; delete: [markerId: string] }>()

const { getItemById, toggleLooted, updateMarker } = useGameData()

const item = computed(() => (props.marker ? getItemById(props.marker.itemId) : undefined))
const title = computed(() => props.marker?.name || item.value?.name || 'Loot')
const looted = computed(() => !!props.marker?.lootedAt)
const lootedAgo = computed(() => (props.marker?.lootedAt ? timeAgo(props.marker.lootedAt) : ''))

function takeOne() {
  if (!props.marker) return
  updateMarker(props.marker.id, { quantity: props.marker.quantity - 1 })
}
</script>
