<template>
  <Dialog :open="show" @update:open="(val) => !val && emit('close')">
    <DialogContent class="surface-card flex max-h-[min(44rem,92dvh)] flex-col gap-3 sm:max-w-xl">
      <div class="contents" @keydown.enter.ctrl.prevent="handleSave" @keydown.enter.meta.prevent="handleSave">
      <DialogHeader>
        <DialogTitle>Add loot here</DialogTitle>
        <DialogDescription>
          Pick what you found. Type a name and press Enter to add it; Enter again to save.
        </DialogDescription>
      </DialogHeader>

      <ItemPicker
        v-if="show"
        ref="pickerRef"
        multiple
        :selected-ids="[...quantities.keys()]"
        max-height="15rem"
        @pick="toggle"
        @submit="handleSave"
      />

      <div v-if="selectedItems.length" class="space-y-1">
        <h3 class="hud-label text-muted-foreground">Adding {{ selectedItems.length }}</h3>
        <ul class="max-h-40 space-y-1 overflow-y-auto">
          <li
            v-for="item in selectedItems"
            :key="item.id"
            class="flex items-center gap-2 rounded-md bg-muted/60 py-1 pl-1.5 pr-1 text-sm"
          >
            <img v-if="item.icon" :src="item.icon" alt="" class="size-6 object-contain">
            <span class="min-w-0 flex-1 truncate">{{ item.name }}</span>
            <QuantityStepper :model-value="quantities.get(item.id) ?? 1" :label="item.name" @update:model-value="(q) => quantities.set(item.id, q)" />
            <Button size="icon" variant="ghost" class="size-8" :aria-label="`Remove ${item.name}`" @click="toggle(item)">
              <XIcon class="size-4" />
            </Button>
          </li>
        </ul>
      </div>

      <div>
        <Label for="loot-note" class="hud-label text-muted-foreground">Note <span class="normal-case tracking-normal">(optional)</span></Label>
        <Input id="loot-note" v-model="note" placeholder="e.g. in the locker by the stove" class="mt-1 h-9" />
      </div>

      <DialogFooter class="items-center gap-2">
        <span class="mr-auto hidden text-xs text-muted-foreground sm:inline"><kbd>Enter</kbd> to add · <kbd>Enter</kbd> again to save</span>
        <Button variant="ghost" @click="emit('close')">Cancel</Button>
        <Button :disabled="!quantities.size" @click="handleSave">
          {{ quantities.size > 1 ? `Add ${quantities.size} items` : 'Add loot' }}
        </Button>
      </DialogFooter>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { XIcon } from '@lucide/vue'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import ItemPicker from '~/components/ItemPicker.vue'
import QuantityStepper from '~/components/QuantityStepper.vue'
import { useGameData } from '~/composables/useGameData'
import type { Item } from '~/types'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{
  close: []
  save: [data: { items: Array<{ itemId: string; name: string; quantity: number }>; note: string }]
}>()

const { getItemById } = useGameData()

const quantities = reactive(new Map<string, number>())
const note = ref('')
const pickerRef = ref<InstanceType<typeof ItemPicker> | null>(null)

const selectedItems = computed(() => [...quantities.keys()].map((id) => getItemById(id)).filter((i): i is Item => !!i))

function toggle(item: Item) {
  if (quantities.has(item.id)) quantities.delete(item.id)
  else quantities.set(item.id, 1)
  pickerRef.value?.reset()
  pickerRef.value?.focusSearch()
}

watch(() => props.show, (open) => {
  if (open) {
    quantities.clear()
    note.value = ''
  }
})

function handleSave() {
  if (!quantities.size) return
  emit('save', {
    items: selectedItems.value.map((item) => ({ itemId: item.id, name: item.name, quantity: quantities.get(item.id) ?? 1 })),
    note: note.value.trim(),
  })
}
</script>
