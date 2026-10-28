<template>
  <div v-if="heldClient" class="held-marker" :style="{ left: `${heldClient.x}px`, top: `${heldClient.y}px` }" aria-hidden="true" />
  <div class="satchel surface-rail rounded-lg border border-border p-2 text-foreground" @click.stop>
    <div class="flex items-center justify-between gap-3 px-1 pb-2">
      <div>
        <span class="hud-label">Satchel</span>
        <span class="ml-2 text-xs" :class="armed ? 'font-bold text-primary' : 'text-muted-foreground'">{{ held ? 'Spot held · choose items, then Enter' : armed ? `Placing ${armed.name} ×${quantity} · click map` : 'Choose an item, then click the map' }}</span>
      </div>
      <button v-if="armed || held" class="text-xs underline" @click="stop">Stop · Esc</button>
    </div>
    <div class="flex flex-wrap items-center gap-1">
      <button v-for="(item, index) in slots" :key="item.id" class="slot" :class="{ selected: armed?.id === item.id }" :title="`${item.name} · ${index === 9 ? 0 : index + 1}`" :aria-label="`Arm ${item.name}`" draggable="true" @dragstart="dragId = item.id" @click="arm(item)">
        <span class="slot-number">{{ index === 9 ? 0 : index + 1 }}</span><img v-if="item.icon" :src="item.icon" alt=""><span v-else>{{ item.name }}</span>
      </button>
      <button v-if="selectedItem" class="rounded border border-border px-2 py-1 text-xs" @click="pinSelected">Pin selected: {{ selectedItem.name }}</button>
      <button class="slot text-xl" aria-label="Search items" @click="openSearch">+</button>
      <div v-if="armed" class="ml-2 flex items-center gap-2 text-xs">
        <label>Qty <input v-model.number="quantity" aria-label="Quantity" type="number" min="1" class="w-14 rounded border border-border bg-background px-1 py-1"></label>
        <button class="underline" @click="togglePin">{{ pinned.includes(armed.id) ? 'Unpin' : 'Pin' }}</button> <button v-if="pinned.includes(armed.id)" aria-label="Move favourite left" @click="movePin(-1)">←</button><button v-if="pinned.includes(armed.id)" aria-label="Move favourite right" @click="movePin(1)">→</button>
      </div>
    </div>
    <input v-if="armed && !searchOpen" v-model="note" class="mt-2 w-full rounded border border-border bg-background px-2 py-1 text-sm" placeholder="Optional note for next placement" aria-label="Note">
    <div v-if="searchOpen" class="mt-2 border-t border-border pt-2">
      <input ref="searchInput" v-model="query" class="w-full rounded border border-border bg-background px-2 py-1 text-sm" placeholder="Search items" aria-label="Search items" @keydown.enter.prevent="chooseResult" @keydown.down.prevent="selectedResult = Math.min(selectedResult + 1, results.length - 1)" @keydown.up.prevent="selectedResult = Math.max(0, selectedResult - 1)">
      <div class="mt-1 max-h-48 overflow-auto">
        <button v-for="(item, index) in results" :key="item.id" :class="{ 'bg-muted': index === selectedResult }" class="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-muted" @click="choose(item)"><img v-if="item.icon" :src="item.icon" alt="" class="size-7 object-contain">{{ item.name }}</button>
      </div>
      <input v-model="note" class="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-sm" placeholder="Optional note for next placement" aria-label="Note">
    </div>
    <p class="mt-2 text-xs text-muted-foreground">Shift-click a spot to hold it · type to search · digits set quantity when armed · Enter adds at held spot · Esc stop</p>
  </div>
</template>
<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import type { Item } from '~/types'
import type { AddRequest, MapPos } from '~/composables/useAddUi'
const ui = useAddUi()
const add = useAddItem()
const game = useGameData()
const selection = useUiState()
const selectedItem = computed(() => { const marker = game.markers.value.find(m => m.id === selection.selectedMarkerId.value); return marker ? game.getItemById(marker.itemId) : undefined })
function pinSelected() { const item = selectedItem.value; if (item && !pinned.value.includes(item.id)) pinned.value = [...pinned.value, item.id].slice(0, 10) }
const pinned = useLocalStorage<string[]>('tld-buddy-satchel-pins', [])
const armed = ref<Item | null>(null)
const held = ref<MapPos | null>(null)
const quantity = ref(1)
const note = ref('')
const query = ref('')
const selectedResult = ref(0)
watch(query, () => { selectedResult.value = 0 })
const heldClient = computed(() => { void ui.viewTick.value; return held.value && ui.mapView.value ? ui.mapView.value.toClient(held.value) : null })
const searchOpen = ref(false)
const searchInput = ref<HTMLInputElement | null>(null)
const dragId = ref('')
const quantityDigits = ref('')
let idleTimer: ReturnType<typeof setTimeout> | undefined
function refreshIdle() { clearTimeout(idleTimer); if (armed.value) idleTimer = setTimeout(() => { armed.value = null; quantityDigits.value = ''; ui.active.value = !!held.value }, 30000) }
function disarm() { armed.value = null; quantityDigits.value = ''; clearTimeout(idleTimer); ui.active.value = !!held.value || searchOpen.value }
const batch = ref<string | undefined>()
const results = computed(() => add.search(query.value, { limit: 12 }))
const slots = computed(() => {
  const all = [...pinned.value.map(id => game.getItemById(id)).filter((i): i is Item => !!i), ...add.frecent(10), ...add.search('', { limit: 10 })]
  return [...new Map(all.map(i => [i.id, i])).values()].slice(0, 10)
})
function stop() { clearTimeout(idleTimer); quantityDigits.value = ''; armed.value = null; held.value = null; searchOpen.value = false; batch.value = undefined; quantity.value = 1; ui.active.value = false }
function arm(item: Item) { if (armed.value?.id === item.id && !held.value) { stop(); return }; armed.value = item; quantity.value = 1; quantityDigits.value = ''; ui.active.value = true; refreshIdle() }
function openSearch() { searchOpen.value = true; ui.active.value = true; nextTick(() => searchInput.value?.focus()) }
function chooseResult() { const item = results.value[selectedResult.value]; if (item) choose(item) }
function choose(item: Item) { searchInput.value?.blur(); arm(item); searchOpen.value = false; query.value = '' }
function togglePin() { if (!armed.value) return; const id = armed.value.id; pinned.value = pinned.value.includes(id) ? pinned.value.filter(x => x !== id) : [...pinned.value, id].slice(0, 10) }
function movePin(delta: number) { if (!armed.value) return; const i = pinned.value.indexOf(armed.value.id); const j = i + delta; if (i < 0 || j < 0 || j >= pinned.value.length) return; const copy = [...pinned.value]; [copy[i], copy[j]] = [copy[j]!, copy[i]!]; pinned.value = copy }
function place(pos: MapPos) {
  if (!armed.value) return
  const result = add.addAt(held.value ?? add.resolveSpot(pos), [{ itemId: armed.value.id, quantity: Math.max(1, Number(quantity.value) || 1), note: note.value || undefined }], held.value && batch.value ? { batchId: batch.value } : {})
  if (result) { if (held.value) batch.value = result.batchId; ui.announce(`Added ${armed.value.name} ×${quantity.value}`, result.batchId); note.value = ''; quantityDigits.value = ''; quantity.value = 1; if (held.value) disarm(); else refreshIdle() }
}
function request(req: AddRequest) { if (req.source === 'context') { stop(); return }; held.value = add.resolveSpot(req.pos); batch.value = undefined; ui.active.value = true; searchOpen.value = false }
function key(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey) return
  const target = e.target as HTMLElement
  if (target.matches('input, textarea, [contenteditable=true]')) { if (e.key === 'Escape') { e.preventDefault(); stop() }; return }
  if (e.key === 'Escape' && (armed.value || held.value || searchOpen.value)) { e.preventDefault(); e.stopImmediatePropagation(); stop(); return }
  if (/^[a-z]$/i.test(e.key) && held.value && !armed.value) { e.preventDefault(); e.stopImmediatePropagation(); openSearch(); query.value = e.key; return }
  if (e.key.toLowerCase() === 's') { e.preventDefault(); e.stopImmediatePropagation(); openSearch(); return }
  if (e.key === 'Enter' && held.value && armed.value) { e.preventDefault(); e.stopImmediatePropagation(); place(held.value); return }
  if (/^[0-9]$/.test(e.key) && armed.value) { e.preventDefault(); e.stopImmediatePropagation(); quantityDigits.value = (quantityDigits.value + e.key).slice(0, 4); quantity.value = Math.max(1, Number(quantityDigits.value)); refreshIdle(); return }
  if (/^[0-9]$/.test(e.key)) { const item = slots.value[e.key === '0' ? 9 : Number(e.key) - 1]; if (item) { e.preventDefault(); e.stopImmediatePropagation(); arm(item) }; return }
}
function drop(e: DragEvent) { if (!dragId.value) return; const pos = ui.mapView.value?.fromClient({ x: e.clientX, y: e.clientY }); const item = game.getItemById(dragId.value); dragId.value = ''; if (pos && item) { armed.value = item; place(pos); stop() } }
const unregister = ui.register({ start(req) { if (req) { held.value = add.resolveSpot(req.pos); batch.value = undefined }; openSearch() }, request, interceptClick(req, e) { if (e.shiftKey || !armed.value || held.value) return false; place(req.pos); return true } })
watch([game.currentMapId, () => game.currentRun.value?.id], stop)
onMounted(() => { ui.hideAddButton.value = true; window.addEventListener('keydown', key, true); window.addEventListener('drop', drop); window.addEventListener('dragover', allowDrop); window.addEventListener('blur', disarm); window.addEventListener('contextmenu', contextStop, true) })
function contextStop(e: MouseEvent) { if (armed.value || held.value || searchOpen.value) { e.preventDefault(); e.stopImmediatePropagation(); stop() } }
function allowDrop(e: DragEvent) { if (dragId.value && ui.mapView.value?.fromClient({ x: e.clientX, y: e.clientY })) e.preventDefault() }
onUnmounted(() => { unregister(); window.removeEventListener('keydown', key, true); window.removeEventListener('drop', drop); window.removeEventListener('dragover', allowDrop); window.removeEventListener('blur', disarm); window.removeEventListener('contextmenu', contextStop, true); clearTimeout(idleTimer) })
</script>
<style scoped>
.held-marker { position: fixed; z-index: 499; width: 22px; height: 22px; border: 2px solid var(--primary); border-radius: 50%; transform: translate(-50%, -50%); pointer-events: none; }
.satchel { position: absolute; z-index: 500; bottom: 1rem; left: 50%; transform: translateX(-50%); width: min(780px, 95%); }
.slot { position: relative; display: grid; place-items: center; width: 48px; height: 48px; border: 1px solid var(--border); border-radius: .375rem; background: var(--muted); font-size: 10px; }
.slot img { width: 70%; height: 70%; object-fit: contain; }
.slot.selected { border: 2px solid var(--primary); }
.slot-number { position: absolute; top: 1px; left: 3px; font-size: 10px; }
</style>
