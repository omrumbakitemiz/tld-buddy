<template>
  <div class="pointer-events-none absolute bottom-4 left-3 z-[560]" aria-live="polite">
    <Transition name="add-toast">
      <div
        v-if="shown"
        :key="shown.id"
        class="surface-rail pointer-events-auto flex h-10 items-center gap-3 rounded-full border border-border pl-4 pr-1.5 text-sm shadow-[0_6px_20px_oklch(0.1_0.02_258/0.55)]"
      >
        <span>{{ shown.text }}</span>
        <Button v-if="shown.batchId" size="sm" variant="ghost" class="h-7 rounded-full" @click="undo">
          Undo <kbd class="ml-1 text-[10px] text-muted-foreground">Ctrl Z</kbd>
        </Button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { Button } from '~/components/ui/button'
import { useAddItem } from '~/composables/useAddItem'
import { useAddUi } from '~/composables/useAddUi'

/** "Added 3 items · Undo" after an add, shared by every variant. */

const addUi = useAddUi()
const { undo: undoBatch } = useAddItem()
const shown = ref<{ id: number; text: string; batchId: string | null } | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined

watch(addUi.notice, (n) => {
  shown.value = n
  clearTimeout(timer)
  if (n) timer = setTimeout(() => (shown.value = null), 6000)
})

function undo() {
  const id = shown.value?.batchId
  if (!id) return
  const n = undoBatch(id)
  addUi.announce(n ? 'Undone' : 'Nothing to undo')
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<style scoped>
.add-toast-enter-active,
.add-toast-leave-active {
  transition: opacity 200ms ease, transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
}
.add-toast-enter-from,
.add-toast-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
@media (prefers-reduced-motion: reduce) {
  .add-toast-enter-active,
  .add-toast-leave-active {
    transition: none;
  }
}
</style>
