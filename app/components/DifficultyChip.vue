<template>
  <span class="hud-label inline-flex shrink-0 items-center gap-1.5 rounded border border-border bg-background/40 px-1.5 text-[10px] text-foreground">
    {{ difficulty }}
    <!-- Harshness as pips (1–5): colour stays reserved for loot state -->
    <span class="flex gap-0.5" aria-hidden="true">
      <span
        v-for="i in 5"
        :key="i"
        class="size-1 rounded-full"
        :class="i <= level ? 'bg-foreground' : 'bg-foreground/20'"
      />
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { DIFFICULTIES, type Difficulty } from '~/types'

const props = defineProps<{ difficulty: Difficulty }>()
const level = computed(() => DIFFICULTIES.indexOf(props.difficulty) + 1)
</script>
