<template>
  <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogContent class="surface-card sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Keyboard shortcuts</DialogTitle>
        <DialogDescription>They work whenever you're not typing in a field.</DialogDescription>
      </DialogHeader>
      <dl class="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
        <template v-for="s in SHORTCUT_HELP" :key="s.label">
          <dt class="flex justify-end gap-1">
            <kbd v-for="k in s.keys" :key="k" class="min-w-6 rounded border border-border bg-background/60 px-1.5 py-0.5 text-center text-xs">{{ k }}</kbd>
          </dt>
          <dd class="text-muted-foreground">{{ s.label }}</dd>
        </template>
      </dl>
      <p class="text-xs text-muted-foreground">On touch screens, long-press the map to add loot.</p>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { SHORTCUT_HELP } from '~/composables/useShortcuts'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()
</script>
