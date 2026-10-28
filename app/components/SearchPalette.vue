<template>
  <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogContent class="surface-card top-[12vh] flex max-h-[76vh] translate-y-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-xl" :show-close="false">
      <DialogTitle class="sr-only">Search</DialogTitle>
      <DialogDescription class="sr-only">Search loot in this run, places, maps and actions. Use the arrow keys and Enter.</DialogDescription>
      <div class="flex items-center gap-2 border-b border-border px-3">
        <SearchIcon class="size-4 shrink-0 text-muted-foreground" />
        <input
          ref="inputRef"
          v-model="query"
          class="h-12 min-w-0 flex-1 bg-transparent text-base placeholder:text-muted-foreground focus:outline-none"
          placeholder="Rifle ammo, Camp Office, Mystery Lake…"
          role="combobox"
          aria-expanded="true"
          aria-controls="search-results"
          :aria-activedescendant="flat[active] ? `sr-${active}` : undefined"
          @keydown.down.prevent="move(1)"
          @keydown.up.prevent="move(-1)"
          @keydown.enter.prevent="choose(flat[active])"
        >
        <kbd class="hidden text-[10px] text-muted-foreground sm:inline">Esc</kbd>
      </div>

      <div id="search-results" ref="listRef" class="min-h-0 flex-1 overflow-y-auto p-1.5" role="listbox" aria-label="Results">
        <template v-for="group in groups" :key="group.title">
          <h3 class="hud-label px-2 pb-1 pt-2.5 text-muted-foreground">{{ group.title }}</h3>
          <div
            v-for="r in group.results"
            :id="`sr-${r.index}`"
            :key="r.key"
            role="option"
            :aria-selected="r.index === active"
            :class="cn(
              'flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5',
              r.index === active ? 'bg-accent text-foreground' : 'text-foreground/90',
            )"
            @mousemove="active = r.index"
            @click="choose(r)"
          >
            <span class="grid size-8 shrink-0 place-items-center rounded-md bg-background/60">
              <img v-if="r.icon" :src="r.icon" alt="" :class="cn('size-6 object-contain', r.dim && 'opacity-50 grayscale')">
              <component :is="r.lucide" v-else class="size-4 text-muted-foreground" />
            </span>
            <span class="min-w-0 flex-1">
              <span :class="cn('block truncate text-sm', r.dim && 'text-muted-foreground line-through decoration-muted-foreground/50')">{{ r.title }}</span>
              <span v-if="r.subtitle" class="block truncate text-xs text-muted-foreground">{{ r.subtitle }}</span>
            </span>
            <kbd v-if="r.hint" class="text-[10px] text-muted-foreground">{{ r.hint }}</kbd>
          </div>
        </template>
        <p v-if="!flat.length" class="px-4 py-8 text-center text-sm text-muted-foreground">
          Nothing found for “{{ query }}”.
        </p>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch, type Component } from 'vue'
import Fuse from 'fuse.js'
import {
  CompassIcon, EyeOffIcon, KeyboardIcon, LandmarkIcon, MapIcon, PlusIcon, SearchIcon, SwordsIcon,
} from '@lucide/vue'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '~/components/ui/dialog'
import { useGameData } from '~/composables/useGameData'
import { useUiState } from '~/composables/useUiState'
import { cn } from '~/lib/utils'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  'fly-to': [target: { x: number; y: number; mapId: string }]
  action: [name: 'add-loot' | 'travel' | 'runs' | 'shortcuts' | 'hide-looted']
}>()

const {
  maps, pois, currentRunMarkers, currentMapId, getItemById, getMapById,
  setCurrentMap, getPOIPin, isPOIEnabled, enablePOIs,
} = useGameData()
const ui = useUiState()

const query = ref('')
const active = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)
const listRef = ref<HTMLElement | null>(null)

interface Result {
  key: string
  index: number
  title: string
  subtitle?: string
  icon?: string | null
  lucide?: Component
  dim?: boolean
  hint?: string
  run: () => void
}

const lootDocs = computed(() => currentRunMarkers.value.map((m) => {
  const item = getItemById(m.itemId)
  return { m, item, text: `${m.name} ${item?.name ?? ''} ${m.note ?? ''}`, map: getMapById(m.mapId)?.name ?? '' }
}))
const lootFuse = computed(() => new Fuse(lootDocs.value, { keys: [{ name: 'text', weight: 3 }, 'map'], threshold: 0.35, ignoreLocation: true }))
const poiFuse = computed(() => new Fuse(pois.value, { keys: ['name', 'type'], threshold: 0.3, ignoreLocation: true }))
const mapFuse = computed(() => new Fuse(maps.value, { keys: ['name'], threshold: 0.3 }))

const actions = computed(() => [
  { title: 'Add loot on this map', hint: 'A', lucide: PlusIcon, name: 'add-loot' as const },
  { title: ui.hideLooted.value ? 'Show looted markers' : 'Hide looted markers', hint: 'H', lucide: EyeOffIcon, name: 'hide-looted' as const },
  { title: 'Travel mode (two maps)', hint: 'T', lucide: CompassIcon, name: 'travel' as const },
  { title: 'Runs', hint: 'R', lucide: SwordsIcon, name: 'runs' as const },
  { title: 'Keyboard shortcuts', hint: '?', lucide: KeyboardIcon, name: 'shortcuts' as const },
])

function close() {
  emit('update:open', false)
}

function goToMarker(mapId: string, x: number, y: number, markerId: string) {
  if (mapId !== currentMapId.value) setCurrentMap(mapId)
  ui.selectMarker(markerId)
  emit('fly-to', { x, y, mapId })
}

const groups = computed(() => {
  const q = query.value.trim()
  const out: { title: string; results: Omit<Result, 'index'>[] }[] = []

  const loot = (q ? lootFuse.value.search(q, { limit: 8 }).map((r) => r.item).sort((a, b) => Number(!!a.m.lootedAt) - Number(!!b.m.lootedAt)) : lootDocs.value.filter((d) => d.m.mapId === currentMapId.value && !d.m.lootedAt).slice(0, 5))
    .map(({ m, item, map }) => ({
      key: `m-${m.id}`,
      title: `${m.name || item?.name || 'Loot'}${m.quantity > 1 ? ` ×${m.quantity}` : ''}`,
      subtitle: `${map}${m.lootedAt ? ' · looted' : ''}${m.note ? ` · ${m.note}` : ''}`,
      icon: item?.icon,
      dim: !!m.lootedAt,
      run: () => goToMarker(m.mapId, m.x, m.y, m.id),
    }))
  if (loot.length) out.push({ title: q ? 'Loot in this run' : 'Still to loot here', results: loot })

  if (q) {
    const places = poiFuse.value.search(q, { limit: 6 }).map(({ item: poi }) => ({
      key: `p-${poi.id}`,
      title: poi.name,
      subtitle: `${getMapById(poi.mapId)?.name ?? ''}${getPOIPin(poi.id) ? '' : ' · not pinned'}`,
      lucide: LandmarkIcon,
      run: () => {
        if (!isPOIEnabled(poi.id)) enablePOIs([poi.id])
        if (poi.mapId !== currentMapId.value) setCurrentMap(poi.mapId)
        ui.selectPOI(poi.id)
        const pin = getPOIPin(poi.id)
        if (pin) emit('fly-to', { x: pin.x, y: pin.y, mapId: poi.mapId })
      },
    }))
    if (places.length) out.push({ title: 'Places', results: places })

    const mapHits = mapFuse.value.search(q, { limit: 5 }).map(({ item: map }) => ({
      key: `map-${map.id}`,
      title: map.name,
      subtitle: map.type === 'transition' ? 'Transition' : 'Region',
      lucide: MapIcon,
      run: () => setCurrentMap(map.id),
    }))
    if (mapHits.length) out.push({ title: 'Maps', results: mapHits })
  }

  const acts = actions.value
    .filter((a) => !q || a.title.toLowerCase().includes(q.toLowerCase()))
    .map((a) => ({ key: `a-${a.name}`, title: a.title, hint: a.hint, lucide: a.lucide, run: () => emit('action', a.name) }))
  if (acts.length) out.push({ title: 'Actions', results: acts })

  let i = 0
  return out.map((g) => ({ ...g, results: g.results.map((r) => ({ ...r, index: i++ }) as Result) }))
})

const flat = computed(() => groups.value.flatMap((g) => g.results))

function move(delta: number) {
  if (!flat.value.length) return
  active.value = (active.value + delta + flat.value.length) % flat.value.length
  nextTick(() => listRef.value?.querySelector(`#sr-${active.value}`)?.scrollIntoView({ block: 'nearest' }))
}

function choose(r: Result | undefined) {
  if (!r) return
  close()
  r.run()
}

watch(query, () => { active.value = 0 })
watch(() => props.open, (open) => {
  if (!open) return
  query.value = ''
  active.value = 0
  nextTick(() => inputRef.value?.focus())
})
</script>
