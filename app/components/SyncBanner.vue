<template>
  <div
    v-if="syncError"
    class="relative z-[650] flex items-center gap-3 border-b border-destructive/40 bg-[oklch(0.3_0.08_27)] px-3 py-2 text-sm text-foreground"
    role="alert"
  >
    <CloudAlertIcon class="size-4 shrink-0 text-destructive-foreground" />
    <p class="min-w-0 flex-1">{{ syncError.message }}</p>
    <Button v-if="syncError.action === 'reload'" size="sm" @click="reload">Reload</Button>
    <Button v-else size="sm" @click="retry">Retry</Button>
  </div>
</template>

<script setup lang="ts">
import { CloudAlertIcon } from '@lucide/vue'
import { Button } from '~/components/ui/button'
import { useAppStore } from '~/composables/useAppStore'

const { syncError, retry, flush } = useAppStore()

function reload() {
  flush()
  window.location.reload()
}
</script>
