<template>
  <span
    class="flex h-9 items-center gap-1.5 rounded-md px-2 text-xs"
    :class="tone"
    role="status"
    :title="detail"
  >
    <component :is="icon" :class="cn('size-4', syncStatus === 'saving' && 'animate-pulse')" />
    <span class="hidden xl:inline">{{ label }}</span>
    <span class="sr-only xl:hidden">{{ label }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CloudAlertIcon, CloudCheckIcon, CloudIcon, CloudOffIcon, CloudUploadIcon } from '@lucide/vue'
import { useAppStore } from '~/composables/useAppStore'
import { cn } from '~/lib/utils'

const { syncStatus } = useAppStore()

const state = computed(() => {
  switch (syncStatus.value) {
    case 'saving': return { icon: CloudUploadIcon, label: 'Saving…', tone: 'text-muted-foreground', detail: 'Saving your changes' }
    case 'saved': return { icon: CloudCheckIcon, label: 'Saved', tone: 'text-muted-foreground', detail: 'All changes saved to the server' }
    case 'offline': return { icon: CloudOffIcon, label: 'Offline', tone: 'text-warning', detail: 'Server unreachable. Changes are kept on this device and sent when it is back.' }
    case 'error': return { icon: CloudAlertIcon, label: 'Not saved', tone: 'text-destructive', detail: 'The server refused the last save. Changes are kept on this device; retrying.' }
    default: return { icon: CloudIcon, label: 'Connecting…', tone: 'text-muted-foreground', detail: 'Loading your data' }
  }
})
const icon = computed(() => state.value.icon)
const label = computed(() => state.value.label)
const tone = computed(() => state.value.tone)
const detail = computed(() => state.value.detail)
</script>
