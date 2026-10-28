<template>
  <div class="inline-flex items-center rounded-md border border-border bg-background/60" role="group" :aria-label="`Quantity of ${label}`">
    <button
      type="button"
      class="grid size-8 place-items-center rounded-l-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
      :disabled="!allowZero && modelValue <= 1"
      :aria-label="`One less ${label}`"
      @click="emit('update:modelValue', modelValue - 1)"
    >
      <MinusIcon class="size-3.5" />
    </button>
    <input
      type="number"
      inputmode="numeric"
      min="1"
      :value="modelValue"
      class="tabular h-8 w-9 bg-transparent text-center text-sm font-semibold [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      :aria-label="`Quantity of ${label}`"
      @change="onInput"
    >
    <button
      type="button"
      class="grid size-8 place-items-center rounded-r-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      :aria-label="`One more ${label}`"
      @click="emit('update:modelValue', modelValue + 1)"
    >
      <PlusIcon class="size-3.5" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { MinusIcon, PlusIcon } from '@lucide/vue'

const props = defineProps<{ modelValue: number; label: string; allowZero?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

function onInput(e: Event) {
  const n = Math.round(Number((e.target as HTMLInputElement).value))
  const min = props.allowZero ? 0 : 1
  emit('update:modelValue', Number.isFinite(n) ? Math.max(min, n) : props.modelValue)
}
</script>
