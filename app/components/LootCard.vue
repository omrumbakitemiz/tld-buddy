<template>
  <div
    v-if="markers.length"
    class="surface-rail flex w-[min(28rem,calc(100vw-1.5rem))] flex-col gap-2.5 rounded-xl border border-border p-3 shadow-[0_8px_28px_oklch(0.1_0.02_258/0.6)]"
    role="region"
    :aria-label="single ? `Selected: ${title(single)}` : `${markers.length} items at this spot`"
  >
    <!-- One marker -->
    <template v-if="single">
      <div class="flex items-start gap-3">
        <div
          :class="cn(
            'grid size-12 shrink-0 place-items-center rounded-lg border-2 bg-background/60 transition-[filter,opacity,border-color]',
            single.lootedAt ? 'border-transparent opacity-60 grayscale' : 'border-loot',
          )"
        >
          <img v-if="icon(single)" :src="icon(single)!" alt="" class="size-9 object-contain">
          <PackageIcon v-else class="size-5 text-muted-foreground" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate font-medium leading-tight">
            {{ title(single) }}
            <span v-if="single.quantity > 1" class="tabular text-muted-foreground">×{{ single.quantity }}</span>
          </p>
          <p class="mt-0.5 text-xs" :class="single.lootedAt ? 'text-looted' : 'text-loot'">
            {{ single.lootedAt ? `Looted ${timeAgo(single.lootedAt)}` : 'Still there' }}
            <span v-if="itemName(single) && single.name !== itemName(single)" class="text-muted-foreground"> · {{ itemName(single) }}</span>
          </p>
          <p v-if="single.note" class="mt-1 line-clamp-2 text-sm text-muted-foreground">{{ single.note }}</p>
        </div>
        <Button size="icon" variant="ghost" class="-mr-1 -mt-1 size-8 shrink-0" aria-label="Close" title="Close (Esc)" @click="emit('close')">
          <XIcon class="size-4" />
        </Button>
      </div>

      <div class="flex items-center gap-1.5">
        <Button
          :variant="single.lootedAt ? 'secondary' : 'default'"
          class="h-10 flex-1"
          :aria-pressed="!!single.lootedAt"
          @click="toggleLooted(single.id)"
        >
          <component :is="single.lootedAt ? Undo2Icon : CheckIcon" class="size-4" />
          {{ single.lootedAt ? 'Not looted' : 'Mark looted' }}
          <kbd class="ml-1 hidden text-[10px] opacity-70 sm:inline">L</kbd>
        </Button>
        <Button
          v-if="!single.lootedAt && single.quantity > 1"
          variant="outline"
          class="h-10"
          title="Took one; keep the rest marked"
          @click="updateMarker(single.id, { quantity: single.quantity - 1 })"
        >
          Take 1
        </Button>
        <Button variant="outline" size="icon" class="size-10" aria-label="Edit" title="Edit (E)" @click="emit('edit', single)">
          <PencilIcon class="size-4" />
        </Button>
        <Button variant="outline" size="icon" class="size-10 text-destructive hover:bg-destructive/15 hover:text-destructive" aria-label="Delete" title="Delete (Del)" @click="emit('delete', single.id)">
          <TrashIcon class="size-4" />
        </Button>
      </div>
    </template>

    <!-- Several markers drawn as one tile -->
    <template v-else>
      <div class="flex items-center gap-2">
        <p class="flex-1 text-sm font-medium">
          {{ markers.length }} items here
          <span class="text-xs font-normal text-loot">· {{ remaining }} still there</span>
        </p>
        <Button size="icon" variant="ghost" class="size-8 shrink-0" aria-label="Close" title="Close (Esc)" @click="emit('close')">
          <XIcon class="size-4" />
        </Button>
      </div>
      <ul class="max-h-[40dvh] space-y-1 overflow-y-auto" aria-label="Items at this spot">
        <li v-for="m in sorted" :key="m.id" class="flex items-center gap-2 rounded-lg p-1 pr-0.5 hover:bg-accent/60">
          <button type="button" class="flex min-w-0 flex-1 items-center gap-2.5 text-left" :aria-label="`Open ${title(m)}`" @click="emit('open', m.id)">
            <span :class="cn('grid size-9 shrink-0 place-items-center rounded-md border-2 bg-background/60', m.lootedAt ? 'border-transparent opacity-60 grayscale' : 'border-loot')">
              <img v-if="icon(m)" :src="icon(m)!" alt="" class="size-6 object-contain">
              <PackageIcon v-else class="size-4 text-muted-foreground" />
            </span>
            <span :class="cn('min-w-0 flex-1 truncate text-sm', m.lootedAt && 'text-muted-foreground line-through decoration-muted-foreground/50')">
              {{ title(m) }}<span v-if="m.quantity > 1" class="tabular text-muted-foreground"> ×{{ m.quantity }}</span>
            </span>
          </button>
          <button
            type="button"
            :class="cn(
              'grid size-10 shrink-0 place-items-center rounded-md border transition-colors',
              m.lootedAt ? 'border-looted/40 bg-looted/15 text-looted hover:bg-looted/25' : 'border-border text-muted-foreground hover:border-loot/60 hover:text-loot',
            )"
            :aria-pressed="!!m.lootedAt"
            :aria-label="m.lootedAt ? `Mark ${title(m)} not looted` : `Mark ${title(m)} looted`"
            @click="toggleLooted(m.id)"
          >
            <CheckIcon class="size-4" :stroke-width="m.lootedAt ? 3 : 2" />
          </button>
        </li>
      </ul>
    </template>
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

const props = defineProps<{ markers: Marker[] }>()
const emit = defineEmits<{
  close: []
  edit: [marker: Marker]
  delete: [markerId: string]
  /** Pick one marker out of a group */
  open: [markerId: string]
}>()

const { getItemById, toggleLooted, updateMarker } = useGameData()

const single = computed(() => (props.markers.length === 1 ? props.markers[0]! : null))
const remaining = computed(() => props.markers.filter((m) => !m.lootedAt).length)
const sorted = computed(() => [...props.markers].sort((a, b) => Number(!!a.lootedAt) - Number(!!b.lootedAt)))

const itemName = (m: Marker) => getItemById(m.itemId)?.name
const title = (m: Marker) => m.name || itemName(m) || 'Loot'
const icon = (m: Marker) => getItemById(m.itemId)?.icon ?? null
</script>
