<script setup lang="ts">
import { Search } from "lucide-vue-next";

export type SearchBarProps = {
	placeholder?: string;
};

defineProps<SearchBarProps>();

const model = defineModel<string>();
</script>

<template>
  <div class="relative">
    <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
    <Input type="search" :placeholder="placeholder" v-model="model"
      class="w-full appearance-none bg-background pl-8 shadow-none md:w-2/3 lg:w-1/3" />
  </div>
</template>
