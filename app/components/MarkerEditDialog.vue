<template>
  <Dialog :open="!!marker" @update:open="(val) => !val && $emit('close')">
    <DialogScrollContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>Edit Marker</DialogTitle>
        <DialogDescription>
          Update this marker's details or remove it from the map
        </DialogDescription>
      </DialogHeader>

      <div v-if="marker" class="space-y-4 py-3">
        <!-- Item preview (read-only) -->
        <div class="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
          <div class="flex items-center justify-center h-10 w-10 rounded-lg bg-muted/50 shrink-0">
            <img
              v-if="itemData?.icon"
              :src="itemData.icon"
              :alt="itemData.name"
              class="h-8 w-8 object-contain"
            />
            <PackageIcon v-else class="h-5 w-5 text-muted-foreground" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold truncate">{{ itemData?.name ?? 'Unknown item' }}</p>
            <p v-if="itemData?.category" class="text-xs text-muted-foreground">{{ itemData.category }}</p>
          </div>
        </div>

        <!-- Name -->
        <div class="space-y-1.5">
          <Label for="edit-marker-name" class="text-xs font-medium">Name</Label>
          <Input
            id="edit-marker-name"
            v-model="editName"
            placeholder="Marker name"
            class="h-8 text-sm"
          />
        </div>

        <!-- Quantity -->
        <div class="space-y-1.5">
          <Label class="text-xs font-medium">Quantity</Label>
          <div class="flex items-center gap-1.5">
            <Button
              v-for="preset in [1, 3, 5, 10]"
              :key="preset"
              size="sm"
              :variant="editQuantity === preset && !customQty ? 'default' : 'outline'"
              class="h-7 px-2.5 text-xs"
              @click="editQuantity = preset; customQty = false"
            >
              {{ preset }}
            </Button>
            <Button
              size="sm"
              :variant="customQty ? 'default' : 'outline'"
              class="h-7 px-2 text-xs"
              @click="customQty = true"
            >
              #
            </Button>
            <Input
              v-if="customQty"
              v-model.number="editQuantity"
              type="number"
              min="1"
              placeholder="1"
              class="h-7 text-sm w-16"
              autofocus
            />
          </div>
        </div>

        <!-- Note -->
        <div class="space-y-1.5">
          <Label for="edit-marker-note" class="text-xs font-medium">Note</Label>
          <Textarea
            id="edit-marker-note"
            v-model="editNote"
            placeholder="Optional notes about this location..."
            class="text-sm min-h-[60px] resize-none"
            rows="2"
          />
        </div>
      </div>

      <DialogFooter class="flex items-center gap-2">
        <Button
          variant="destructive"
          size="sm"
          class="mr-auto"
          @click="handleDelete"
        >
          <TrashIcon class="h-3.5 w-3.5 mr-1.5" />
          Delete
        </Button>
        <Button variant="outline" size="sm" @click="$emit('close')">Cancel</Button>
        <Button size="sm" @click="handleSave">
          Save Changes
        </Button>
      </DialogFooter>
    </DialogScrollContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { TrashIcon, PackageIcon } from 'lucide-vue-next'
import { Dialog, DialogScrollContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { useGameData } from '~/composables/useGameData'
import type { Marker } from '~/types'

const props = defineProps<{
  marker: Marker | null
}>()

const emit = defineEmits<{
  close: []
  save: [data: { id: string; name: string; quantity: number; note: string }]
  delete: [markerId: string]
}>()

const { getItemById } = useGameData()

const editName = ref('')
const editQuantity = ref(1)
const editNote = ref('')
const customQty = ref(false)

const itemData = computed(() => {
  if (!props.marker) return null
  return getItemById(props.marker.itemId)
})

// Sync form state when marker prop changes (dialog opens with a new marker)
watch(() => props.marker, (m) => {
  if (m) {
    editName.value = m.name
    editQuantity.value = m.quantity
    editNote.value = m.note ?? ''
    customQty.value = ![1, 3, 5, 10].includes(m.quantity)
  }
}, { immediate: true })

function handleSave() {
  if (!props.marker) return
  emit('save', {
    id: props.marker.id,
    name: editName.value || props.marker.name,
    quantity: editQuantity.value || 1,
    note: editNote.value,
  })
}

function handleDelete() {
  if (!props.marker) return
  emit('delete', props.marker.id)
}
</script>
