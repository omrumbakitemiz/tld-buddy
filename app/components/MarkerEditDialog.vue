<template>
  <Dialog :open="!!marker" @update:open="(val) => !val && emit('close')">
    <DialogContent class="surface-card sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Edit loot</DialogTitle>
        <DialogDescription>Change the item, its name, how many there are, or your note.</DialogDescription>
      </DialogHeader>

      <form v-if="marker" class="space-y-4" @submit.prevent="handleSave">
        <div class="flex items-center gap-3 rounded-lg bg-muted/60 p-2.5">
          <div class="grid size-11 shrink-0 place-items-center rounded-md bg-background/60">
            <img v-if="item?.icon" :src="item.icon" alt="" class="size-9 object-contain">
            <PackageIcon v-else class="size-5 text-muted-foreground" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate font-medium">{{ item?.name ?? 'Unknown item' }}</p>
            <p v-if="unsorted && gameName" class="truncate text-xs text-muted-foreground">The game called it “{{ gameName }}”</p>
            <p v-else-if="item?.category" class="text-xs text-muted-foreground">{{ item.category }}</p>
          </div>
          <Button type="button" size="sm" :variant="unsorted ? 'default' : 'ghost'" :aria-expanded="showPicker" @click="showPicker = !showPicker">
            {{ showPicker ? 'Close' : unsorted ? 'Pick item' : 'Change' }}
          </Button>
        </div>

        <ItemPicker
          v-if="showPicker"
          :key="marker.id"
          :initial-query="gameName ?? ''"
          :selected-ids="[editItemId]"
          max-height="12rem"
          placeholder="Which item is it?"
          @pick="pickItem"
        />

        <div class="grid grid-cols-[1fr_auto] items-end gap-3">
          <div>
            <Label for="edit-marker-name" class="hud-label text-muted-foreground">Name</Label>
            <Input id="edit-marker-name" v-model="editName" :placeholder="item?.name ?? 'Name'" class="mt-1 h-9" />
          </div>
          <div>
            <span class="hud-label block text-muted-foreground">How many</span>
            <QuantityStepper v-model="editQuantity" :label="editName || item?.name || 'item'" class="mt-1" />
          </div>
        </div>

        <div>
          <Label for="edit-marker-note" class="hud-label text-muted-foreground">Note</Label>
          <Textarea id="edit-marker-note" v-model="editNote" placeholder="Where exactly, what's left…" class="mt-1 min-h-16 resize-none" rows="2" />
        </div>

        <label class="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-2.5">
          <input v-model="editLooted" type="checkbox" class="size-4 accent-[var(--looted)]">
          <span class="text-sm">Already looted</span>
        </label>

        <DialogFooter class="items-center gap-2">
          <Button type="button" variant="ghost" class="mr-auto text-destructive hover:bg-destructive/15 hover:text-destructive" @click="emit('delete', marker.id)">
            <TrashIcon class="size-4" /> Delete
          </Button>
          <Button type="button" variant="ghost" @click="emit('close')">Cancel</Button>
          <Button type="submit">Save</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { PackageIcon, TrashIcon } from '@lucide/vue'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import ItemPicker from '~/components/ItemPicker.vue'
import QuantityStepper from '~/components/QuantityStepper.vue'
import { useGameData } from '~/composables/useGameData'
import { gameNameFromNote, UNSORTED_ITEM_ID, UNSORTED_ITEM_NAME, withoutGameName } from '#shared/utils/live'
import type { Item, Marker } from '~/types'

const props = defineProps<{ marker: Marker | null }>()
const emit = defineEmits<{
  close: []
  save: [data: { id: string; itemId: string; name: string; quantity: number; note: string; looted: boolean }]
  delete: [markerId: string]
}>()

const { getItemById } = useGameData()

const editItemId = ref('')
const editName = ref('')
const editQuantity = ref(1)
const editNote = ref('')
const editLooted = ref(false)
const showPicker = ref(false)

const item = computed(() => getItemById(editItemId.value))
/** Still "Unsorted loot" (marked in game on something the app doesn't know). */
const unsorted = computed(() => editItemId.value === UNSORTED_ITEM_ID)
const gameName = computed(() => gameNameFromNote(props.marker?.note))

watch(() => props.marker, (m) => {
  if (!m) return
  editItemId.value = m.itemId
  editName.value = m.name
  editQuantity.value = m.quantity
  editNote.value = m.note ?? ''
  editLooted.value = !!m.lootedAt
  // Unsorted loot is there to be sorted: offer the picker right away
  showPicker.value = m.itemId === UNSORTED_ITEM_ID
}, { immediate: true })

function pickItem(picked: Item) {
  // Keep a name the player wrote; one that was just the old item's name follows the new item
  const oldName = item.value?.name ?? UNSORTED_ITEM_NAME
  if (!editName.value.trim() || editName.value.trim() === oldName) editName.value = picked.name
  // The game's name was only kept to sort it by; now it's sorted
  if (unsorted.value) editNote.value = withoutGameName(editNote.value)
  editItemId.value = picked.id
  showPicker.value = false
}

function handleSave() {
  if (!props.marker) return
  emit('save', {
    id: props.marker.id,
    itemId: editItemId.value,
    name: editName.value.trim() || props.marker.name,
    quantity: Math.max(1, editQuantity.value || 1),
    note: editNote.value,
    looted: editLooted.value,
  })
}
</script>
