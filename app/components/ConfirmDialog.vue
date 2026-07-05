<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="max-w-sm">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription v-if="description">{{ description }}</DialogDescription>
      </DialogHeader>

      <DialogFooter class="flex items-center gap-2 sm:justify-end">
        <Button variant="outline" size="sm" @click="$emit('update:open', false)">
          {{ cancelLabel }}
        </Button>
        <Button :variant="destructive ? 'destructive' : 'default'" size="sm" @click="onConfirm">
          {{ confirmLabel }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'

withDefaults(defineProps<{
  open: boolean
  title?: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}>(), {
  title: 'Are you sure?',
  description: '',
  confirmLabel: 'Delete',
  cancelLabel: 'Cancel',
  destructive: true,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: []
}>()

function onConfirm() {
  emit('confirm')
  emit('update:open', false)
}
</script>
