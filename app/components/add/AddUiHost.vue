<template>
  <component :is="current" v-if="current" :key="addUi.variant.value" />
  <AddToast />
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import AddToast from '~/components/add/AddToast.vue'
import { useAddUi, type AddVariant } from '~/composables/useAddUi'

/** Mounts the add-item variant picked with `?addui=` or the menu (docs/add-item/CONCEPTS.md). */

const addUi = useAddUi()

const variants: Record<Exclude<AddVariant, 'legacy'>, ReturnType<typeof defineAsyncComponent>> = {
  a: defineAsyncComponent(() => import('~/components/add/AddUiA.vue')),
  b: defineAsyncComponent(() => import('~/components/add/AddUiB.vue')),
  c: defineAsyncComponent(() => import('~/components/add/AddUiC.vue')),
  d: defineAsyncComponent(() => import('~/components/add/AddUiD.vue')),
}

const current = computed(() => (addUi.variant.value === 'legacy' ? null : variants[addUi.variant.value]))
</script>
