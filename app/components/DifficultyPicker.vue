<template>
  <div class="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Difficulty">
    <button
      v-for="d in DIFFICULTIES"
      :key="d"
      type="button"
      role="radio"
      :aria-checked="modelValue === d"
      :class="cn(
        'hud-label h-8 rounded-md border px-2.5 transition-colors',
        modelValue === d ? 'border-primary/60 bg-primary/15 text-foreground' : 'border-border text-muted-foreground hover:text-foreground',
      )"
      @click="emit('update:modelValue', d)"
    >
      {{ d }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { DIFFICULTIES, type Difficulty } from '~/types'
import { cn } from '~/lib/utils'

defineProps<{ modelValue: Difficulty | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: Difficulty] }>()
</script>
